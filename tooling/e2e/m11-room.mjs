// M11 room probe: two clients share one Cloudflare WeddingRoom (wrangler
// dev, local workerd) — the same §20 steps as M10, now against the Durable
// Object: joint join, mutual names, smooth remote travel, emote seen,
// disconnect drops, quest continues online.
// Prints M11 ROOM VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { mintSession, cleanupMintSession } from "./mint-session.mjs";
import { resolveWranglerJs } from "../resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const RT_DIR = join(ROOT, "apps/realtime");
const RT_PORT = 8787;
const WEB_PORT = 8114;
const WRANGLER_JS = (() => {
  try {
    return resolveWranglerJs();
  } catch (e) {
    console.error(`M11 room check FAILED: ${(e && e.message) || e}`);
    process.exit(1);
  }
})();
const BIN = process.platform === "win32" ? ".cmd" : "";
const ROOM_SECRET = process.env.ROOM_SECRET ?? "m125-local-secret-0123456789";
process.env.ROOM_SECRET = ROOM_SECRET;

const fail = (msg) => { console.error(`M11 room check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const webRequire = createRequire(join(WEB_DIR, "package.json"));
let chromium;
try {
  ({ chromium } = webRequire("playwright"));
} catch {
  fail("playwright not installed in apps/web (pnpm add -D playwright --filter @wedding-rpg/web)");
}

let worker = null;
let server = null;
async function stopAll() {
  for (const p of [server, worker]) {
    if (p && !p.killed) p.kill();
  }
  await sleep(2000);
}
process.on("exit", () => {
  for (const p of [server, worker]) {
    if (p && !p.killed) { try { p.kill("SIGKILL"); } catch { /* noop */ } }
  }
});

async function waitForHealth(timeoutMs = 300000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`http://localhost:${RT_PORT}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) fail("wrangler dev never became ready (workerd download can take minutes on first run)");
    await sleep(5000);
  }
}

async function waitForWeb(url, timeoutMs = 120000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) fail(`dev server never became ready at ${url}`);
    await sleep(2000);
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (e) {
    if (!/Executable doesn't exist/i.test(String(e && e.message))) throw e;
    execSync(`"${join(WEB_DIR, "node_modules", ".bin", `playwright${BIN}`)}" install chromium`, {
      cwd: WEB_DIR, stdio: "pipe", timeout: 420000,
    });
    return await chromium.launch();
  }
}

const hook = (page, fn, arg) => page.evaluate(fn, arg);
const net = (page) => hook(page, () => window.__wedding.net());

async function prepPage(page) {
  const origClick = page.click.bind(page);
  page.click = async (selector, options) => {
    if (typeof selector === "string" && selector.startsWith("[data-testid")) {
      await page.waitForSelector(selector, { state: "visible", timeout: 15000 });
      const pt = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, selector);
      if (!pt) fail(`tap target missing: ${selector}`);
      return page.touchscreen.tap(pt.x, pt.y);
    }
    return origClick(selector, options);
  };
}

async function waitJoined(page, who, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    const n = await net(page);
    if (n && n.state === "joined" && n.selfId) return n;
    if (Date.now() - start > timeoutMs) fail(`${who} never joined`);
    await sleep(300);
  }
}

async function main() {
  worker = spawn(process.execPath, [WRANGLER_JS, "dev", "--port", String(RT_PORT), "--var", `ROOM_SECRET:${ROOM_SECRET}`], {
    cwd: RT_DIR, stdio: "pipe",
  });
  worker.on("error", (e) => fail(`could not start wrangler dev: ${e.message}`));
  await waitForHealth();
  const nextBinJs = join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextBinJs, "dev", "-p", String(WEB_PORT)], {
    cwd: WEB_DIR, stdio: "pipe",
  });
  server.on("error", (e) => fail(`could not start dev server: ${e.message}`));
  try {
    await waitForWeb(`http://localhost:${WEB_PORT}/`);
    const browser = await launchBrowser();
    const mkPage = async (name) => {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      });
      const page = await ctx.newPage();
      await prepPage(page);
      const logs = [];
      page.on("pageerror", (e) => logs.push(`[pageerror] ${e && e.message}`));
      await page.addInitScript((guestName) => {
        window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: guestName, avatarId: "guest_01" }));
      }, name);
      const netUrl = encodeURIComponent(`ws://localhost:${RT_PORT}/room?room=demo-ayu-bima`);
      const session = await mintSession("demo-ayu-bima", name);
      await page.goto(`http://localhost:${WEB_PORT}/?net=${netUrl}&session=${encodeURIComponent(session)}`, {
        waitUntil: "domcontentloaded", timeout: 60000,
      });
      await page.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.net, null, { timeout: 60000 });
      await sleep(800);
      return { ctx, page, logs };
    };
    const dinda = await mkPage("Dinda");
    const maya = await mkPage("Maya");

    await waitJoined(dinda.page, "Dinda");
    await waitJoined(maya.page, "Maya");
    await sleep(1500);
    const nd = await net(dinda.page);
    const nm = await net(maya.page);
    if (nd.remoteIds.length !== 1 || !Object.values(nd.remoteNames).includes("Maya")) {
      fail(`Dinda does not see Maya: ${JSON.stringify(nd)}`);
    }
    if (nm.remoteIds.length !== 1 || !Object.values(nm.remoteNames).includes("Dinda")) {
      fail(`Maya does not see Dinda: ${JSON.stringify(nm)}`);
    }
    const dindaIdOnMaya = nm.remoteIds[0];

    const g = await hook(dinda.page, () => window.__wedding.input.geometry());
    await dinda.page.mouse.move(g.stick.x, g.stick.y);
    await dinda.page.mouse.down();
    await dinda.page.mouse.move(g.stick.x, g.stick.y - 44, { steps: 8 });
    const samples = [];
    for (let i = 0; i < 6; i++) {
      await sleep(250);
      const n = await net(maya.page);
      if (n.remotePos[dindaIdOnMaya]) samples.push(n.remotePos[dindaIdOnMaya]);
    }
    await dinda.page.mouse.up();
    if (samples.length < 5) fail(`too few remote samples: ${samples.length}`);
    const total = Math.hypot(
      samples[samples.length - 1].x - samples[0].x,
      samples[samples.length - 1].y - samples[0].y
    );
    if (total < 40) fail(`remote barely moved: ${total.toFixed(1)}px`);
    for (let i = 1; i < samples.length; i++) {
      const step = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
      if (step > 50) fail(`remote snapped ${step.toFixed(1)}px between samples`);
    }
    console.log(`DO remote travel ${total.toFixed(0)}px over ${samples.length} smooth samples`);

    const geom = await hook(dinda.page, () => window.__wedding.input.geometry());
    await dinda.page.touchscreen.tap(geom.emote.x, geom.emote.y);
    await dinda.page.waitForSelector('[data-testid="emote-menu"]', { state: "visible", timeout: 15000 });
    await dinda.page.click('[data-testid="emote-pick-heart"]');
    {
      const start = Date.now();
      for (;;) {
        const n = await net(maya.page);
        if (n.remoteEmotes[dindaIdOnMaya]) break;
        if (Date.now() - start > 8000) fail("Maya never saw the emote");
        await sleep(300);
      }
    }
    await maya.page.screenshot({ path: join(ROOT, "docs/qa/m11-duo-390.png") });

    await maya.ctx.close();
    {
      const start = Date.now();
      for (;;) {
        const n = await net(dinda.page);
        if (n.remoteIds.length === 0) break;
        if (Date.now() - start > 10000) fail("Dinda never dropped Maya");
        await sleep(400);
      }
    }

    await hook(dinda.page, (a) => window.__wedding.debugTeleport(a.x, a.y), { x: 392, y: 1160 });
    const g2 = await hook(dinda.page, () => window.__wedding.input.geometry());
    await dinda.page.mouse.move(g2.stick.x, g2.stick.y);
    await dinda.page.mouse.down();
    {
      const start = Date.now();
      for (;;) {
        const p = await hook(dinda.page, () => ({
          x: window.__wedding.player.sprite.x,
          y: window.__wedding.player.sprite.y,
        }));
        if (Math.hypot(392 - p.x, 1128 - p.y) < 30) break;
        if (Date.now() - start > 30000) fail("seek to greeter timed out");
        const dx = 392 - p.x, dy = 1128 - p.y;
        const len = Math.hypot(dx, dy);
        await dinda.page.mouse.move(g2.stick.x + (dx / len) * 44, g2.stick.y + (dy / len) * 44, { steps: 6 });
        await sleep(350);
      }
    }
    await dinda.page.mouse.up();
    {
      const start = Date.now();
      for (;;) {
        if ((await hook(dinda.page, () => window.__wedding.targetId())) === "npc.greeter") break;
        if (Date.now() - start > 30000) fail("never targeted npc.greeter");
        await sleep(300);
      }
    }
    await dinda.page.keyboard.press("e");
    await dinda.page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
    for (let i = 0; i < 4; i++) {
      await dinda.page.click('[data-testid="dialogue-continue"]');
      await sleep(500);
      const bookOpen = await dinda.page.evaluate(() => !!document.querySelector('[data-testid="wedding-book"]'));
      if (bookOpen) {
        await dinda.page.click('[data-testid="wedding-book-close"]');
        await dinda.page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
      }
      await sleep(200);
    }
    const qs = await hook(dinda.page, () => window.__wedding.questState());
    if (qs.status !== "active") fail("quest did not start while online");

    const allLogs = [...dinda.logs, ...maya.logs];
    if (allLogs.length > 0) fail(`page errors: ${allLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
    cleanupMintSession();
  } finally {
    await stopAll();
  }
  console.log("M11 ROOM VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
