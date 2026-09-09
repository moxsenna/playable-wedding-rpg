// SP gate probe: one coherent single-player session in a real mobile
// browser (move, greeter dialogue starts the quest, Wedding Book opens over
// a live world), plus the width screenshot set for manual review.
// Prints SP GATE VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8106;
const URL = `http://localhost:${PORT}/`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`SP gate check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const webRequire = createRequire(join(WEB_DIR, "package.json"));
let chromium;
try {
  ({ chromium } = webRequire("playwright"));
} catch {
  fail("playwright not installed in apps/web (pnpm add -D playwright --filter @wedding-rpg/web)");
}

let server = null;
async function stopServer() {
  if (server && !server.killed) {
    server.kill();
    await sleep(1500);
  }
}
process.on("exit", () => { if (server && !server.killed) { try { server.kill("SIGKILL"); } catch { /* noop */ } } });

async function waitForServer(timeoutMs = 120000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(URL, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) fail(`dev server never became ready at ${URL}`);
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
const pos = (page) => hook(page, () => ({
  x: window.__wedding.player.sprite.x,
  y: window.__wedding.player.sprite.y,
}));

async function prepPage(page) {
  const origClick = page.click.bind(page);
  page.click = async (selector, options) => {
    if (typeof selector === "string" && selector.startsWith("[data-testid")) {
      await page.waitForSelector(selector, { state: "visible", timeout: 15000 });
      const pt = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, selector);
      if (!pt) fail(`tap target missing: ${selector}`);
      return page.touchscreen.tap(pt.x, pt.y);
    }
    return origClick(selector, options);
  };
}

async function main() {
  const nextBinJs = join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextBinJs, "dev", "-p", String(PORT)], {
    cwd: WEB_DIR, stdio: "pipe",
  });
  server.on("error", (e) => fail(`could not start dev server: ${e.message}`));
  try {
    await waitForServer();
    const browser = await launchBrowser();
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    });
    const page = await ctx.newPage();
    await prepPage(page);
    const pageLogs = [];
    page.on("pageerror", (e) => pageLogs.push(`[pageerror] ${e && e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
    });
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => !!window.__wedding?.player && !!window.__wedding?.input && !!window.__wedding?.questState,
      null, { timeout: 60000 });
    await sleep(800);

    // move: stick drag walks north
    const m0 = await pos(page);
    const g = await hook(page, () => window.__wedding.input.geometry());
    await page.mouse.move(g.stick.x, g.stick.y);
    await page.mouse.down();
    await page.mouse.move(g.stick.x, g.stick.y - 44, { steps: 8 });
    await sleep(900);
    await page.mouse.up();
    const m1 = await pos(page);
    if (!(m0.y - m1.y > 20)) fail("no movement from stick drag");

    // greeter dialogue starts the quest
    await hook(page, (a) => window.__wedding.debugTeleport(a.x, a.y), { x: 392, y: 1160 });
    const g2 = await hook(page, () => window.__wedding.input.geometry());
    await page.mouse.move(g2.stick.x, g2.stick.y);
    await page.mouse.down();
    const start = Date.now();
    for (;;) {
      const p = await pos(page);
      if (Math.hypot(392 - p.x, 1128 - p.y) < 30) break;
      if (Date.now() - start > 30000) fail("seek to greeter timed out");
      const dx = 392 - p.x, dy = 1128 - p.y;
      const len = Math.hypot(dx, dy);
      await page.mouse.move(g2.stick.x + (dx / len) * 44, g2.stick.y + (dy / len) * 44, { steps: 6 });
      await sleep(350);
    }
    await page.mouse.up();
    const t0 = Date.now();
    for (;;) {
      if ((await hook(page, () => window.__wedding.targetId())) === "npc.greeter") break;
      if (Date.now() - t0 > 30000) fail("never targeted npc.greeter");
      await sleep(300);
    }
    await page.keyboard.press("e");
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
    for (let i = 0; i < 4; i++) {
      await page.click('[data-testid="dialogue-continue"]');
      await sleep(500);
      const bookOpen = await page.evaluate(() => !!document.querySelector('[data-testid="wedding-book"]'));
      if (bookOpen) {
        await page.click('[data-testid="wedding-book-close"]');
        await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
      }
      await sleep(200);
    }
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "hidden", timeout: 15000 });
    const qs = await hook(page, () => window.__wedding.questState());
    if (qs.status !== "active") fail(`quest not active: ${JSON.stringify(qs)}`);
    const hud = await page.textContent('[data-testid="quest-hud"]');
    if (!hud.includes("OUR STORY")) fail(`quest HUD missing: ${hud}`);

    // book opens over the live world
    await page.click('[data-testid="wedding-book-open"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    const couple = await page.textContent('[data-testid="book-couple"]');
    if (!couple.includes("Ayu") || !couple.includes("Bima")) fail(`couple header wrong: ${couple}`);
    await page.click('[data-testid="wedding-book-close"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
    await page.screenshot({ path: join(ROOT, "docs/qa/sp-gate-390.png") });

    if (pageLogs.length > 0) fail(`page errors during SP gate: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
    console.log("move + quest start + book over live world OK");

    const browser3 = await launchBrowser();
    for (const [w, h, name] of [[320, 568, "sp-320.png"], [360, 740, "sp-360.png"], [430, 932, "sp-430.png"]]) {
      const c3 = await browser3.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const p3 = await c3.newPage();
      await prepPage(p3);
      await p3.addInitScript(() => {
        window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
      });
      await p3.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p3.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 60000 });
      await sleep(1500);
      await p3.screenshot({ path: join(ROOT, "docs/qa", name) });
      await c3.close();
    }
    await browser3.close();
  } finally {
    await stopServer();
  }
  console.log("SP GATE VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
