// M7 reusability probe: each wedding fixture boots the same world with its
// own couple, dialogue, and quest chain — zero game-source changes.
// For ?wedding=demo-ayu-bima|raka-naya|arvin-selena asserts: book couple,
// greeter identity + quest start, photographer heart + HUD.
// Prints M7 WEDDINGS VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8109;
const URL = `http://localhost:${PORT}/`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M7 weddings check FAILED: ${msg}`); process.exit(1); };
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
const teleport = (page, x, y) => hook(page, (a) => window.__wedding.debugTeleport(a.x, a.y), { x, y });

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

async function seek(page, tx, ty, timeoutMs = 30000, arrivePx = 30) {
  const g = await hook(page, () => window.__wedding.input.geometry());
  await page.mouse.move(g.stick.x, g.stick.y);
  await page.mouse.down();
  const start = Date.now();
  try {
    for (;;) {
      const p = await pos(page);
      const dx = tx - p.x, dy = ty - p.y;
      if (Math.hypot(dx, dy) < arrivePx) return;
      if (Date.now() - start > timeoutMs) fail(`seek to (${tx},${ty}) timed out`);
      const len = Math.hypot(dx, dy);
      await page.mouse.move(g.stick.x + (dx / len) * 44, g.stick.y + (dy / len) * 44, { steps: 6 });
      await sleep(350);
    }
  } finally {
    await page.mouse.up();
  }
}

async function waitTarget(page, id, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    if ((await hook(page, () => window.__wedding.targetId())) === id) return;
    if (Date.now() - start > timeoutMs) fail(`never targeted ${id}`);
    await sleep(300);
  }
}

async function talkThrough(page, tx, ty, slotId, clicks) {
  await teleport(page, tx, ty + 48);
  await seek(page, tx, ty + 16);
  await waitTarget(page, slotId);
  await page.keyboard.press("e");
  await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
  for (let i = 0; i < clicks; i++) {
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
}

const WEDDINGS = [
  { id: "demo-ayu-bima", a: "Ayu", b: "Bima", greeter: "Sari" },
  { id: "raka-naya", a: "Raka", b: "Naya", greeter: "Tania" },
  { id: "arvin-selena", a: "Arvin", b: "Selena", greeter: "Putri" },
];

async function main() {
  const nextBinJs = join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextBinJs, "dev", "-p", String(PORT)], {
    cwd: WEB_DIR, stdio: "pipe",
  });
  server.on("error", (e) => fail(`could not start dev server: ${e.message}`));
  try {
    await waitForServer();
    const browser = await launchBrowser();
    for (const w of WEDDINGS) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      });
      const page = await ctx.newPage();
      await prepPage(page);
      const pageLogs = [];
      page.on("pageerror", (e) => pageLogs.push(`[pageerror] ${e && e.message}`));
      await page.goto(`${URL}?wedding=${w.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(
        () => !!window.__wedding?.player && !!window.__wedding?.input && !!window.__wedding?.questState,
        null, { timeout: 60000 });
      await sleep(800);
      await page.click('[data-testid="wedding-book-open"]');
      await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
      const couple = await page.textContent('[data-testid="book-couple"]');
      if (!couple.includes(w.a) || !couple.includes(w.b)) fail(`[${w.id}] couple wrong: ${couple}`);
      await page.click('[data-testid="wedding-book-close"]');
      await talkThrough(page, 392, 1112, "npc.greeter", 4);
      const name = await hook(page, () => window.__wedding.questState()).then((q) => q.status);
      if (name !== "active") fail(`[${w.id}] quest not active`);
      const hud0 = await page.textContent('[data-testid="quest-hud"]');
      if (hud0.includes("♥")) fail(`[${w.id}] HUD should be empty after start: ${hud0}`);
      await talkThrough(page, 440, 728, "npc.photographer", 3);
      const qs = await hook(page, () => window.__wedding.questState());
      if (qs.collected.length !== 1) fail(`[${w.id}] one heart expected: ${JSON.stringify(qs)}`);
      const hud1 = await page.textContent('[data-testid="quest-hud"]');
      if (!hud1.includes("♥")) fail(`[${w.id}] HUD should show one heart: ${hud1}`);
      await page.screenshot({ path: join(ROOT, "docs/qa", `m7-${w.id}-390.png`) });
      if (pageLogs.length > 0) fail(`[${w.id}] page errors: ${pageLogs.join(" | ").slice(0, 400)}`);
      console.log(`ok: ${w.id} (${w.a} & ${w.b})`);
      await ctx.close();
    }
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("M7 WEDDINGS VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
