// M5 quest probe: open-order four-heart quest + finale gate + couple finale
// in a real mobile browser. Self-contained: starts `next dev`, then asserts:
//   M5-A  HUD starts empty (OUR STORY ♡♡♡♡); bumping the locked gate shows
//         the locked message with heart counts
//   M5-B  greeter starts the quest; photo/proposal/story/travel grant hearts
//         out of canonical order; HUD tracks; memory toast fires
//   M5-C  duplicate re-talk grants nothing; fourth heart unlocks + banner
//   M5-D  walk through the opened door; couple dialogue fires FINALE_STARTED;
//         publication reveal readable
// Saves the G4 screenshot set, then cleans up.
// Prints M5 QUEST VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8105;
const URL = `http://localhost:${PORT}/`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M5 quest check FAILED: ${msg}`); process.exit(1); };
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
const targetId = (page) => hook(page, () => window.__wedding.targetId());
const questState = (page) => hook(page, () => window.__wedding.questState());
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

async function seek(page, tx, ty, timeoutMs = 30000, arrivePx = 40) {
  const g = await hook(page, () => window.__wedding.input.geometry());
  await page.mouse.move(g.stick.x, g.stick.y);
  await page.mouse.down();
  const start = Date.now();
  try {
    for (;;) {
      const p = await pos(page);
      const dx = tx - p.x, dy = ty - p.y;
      if (Math.hypot(dx, dy) < arrivePx) return p;
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
    if ((await targetId(page)) === id) return;
    if (Date.now() - start > timeoutMs) fail(`never targeted ${id}`);
    await sleep(300);
  }
}

async function closeBookIfOpen(page) {
  const open = await page.evaluate(() => !!document.querySelector('[data-testid="wedding-book"]'));
  if (!open) return;
  await page.click('[data-testid="wedding-book-close"]');
  await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
}

// Walk up to an NPC by tile coords, open dialogue, click through `clicks`
// Continue taps (closing the Wedding Book whenever an action opens it).
async function talkThrough(page, tx, ty, slotId, clicks) {
  await teleport(page, tx, ty + 48);
  await seek(page, tx, ty + 16, 30000, 30);
  await waitTarget(page, slotId);
  await page.keyboard.press("e");
  await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
  for (let i = 0; i < clicks; i++) {
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(500);
    await closeBookIfOpen(page);
    await sleep(200);
  }
  await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "hidden", timeout: 15000 });
}

const hudText = (page) => page.textContent('[data-testid="quest-hud"]');

// Hold the stick north for a fixed duration: proves real collision blocking
// (or passing) instead of seek arrival radius.
async function walkNorth(page, ms) {
  const g = await hook(page, () => window.__wedding.input.geometry());
  await page.mouse.move(g.stick.x, g.stick.y);
  await page.mouse.down();
  await page.mouse.move(g.stick.x, g.stick.y - 44, { steps: 8 });
  await sleep(ms);
  await page.mouse.up();
  return pos(page);
}

// Step into the finale gate zone from the south. Teleports bypass collision,
// so walk down in small steps and let the scene's per-frame zone check fire.
async function enterGateZone(page) {
  await teleport(page, 440, 200);
  await sleep(300);
  for (let i = 0; i < 12; i++) {
    const p = await pos(page);
    if (p.x >= 400 && p.x < 480 && p.y >= 128 && p.y < 176) return p;
    await teleport(page, p.x, p.y - 8);
    await sleep(300);
  }
  fail("could not enter the finale gate zone");
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
    await hook(page, () => {
      window.__finaleEvents = [];
      window.__wedding.events.on("FINALE_STARTED", () => window.__finaleEvents.push(1));
    });

    // --- M5-A: empty HUD + locked gate first ---
    const hud0 = await hudText(page);
    if (!hud0.includes("OUR STORY") || hud0.includes("♥")) fail(`HUD should start empty: ${hud0}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m5-hud-empty-390.png") });
    await teleport(page, 440, 260);
    await enterGateZone(page);
    await page.waitForSelector('[data-testid="gate-locked"]', { state: "visible", timeout: 15000 });
    const locked = await page.textContent('[data-testid="gate-locked"]');
    if (!locked.includes("0/4")) fail(`locked message should show 0/4: ${locked}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m5-locked-390.png") });
    await teleport(page, 440, 220);
    const blockedY = (await walkNorth(page, 2500)).y;

    // --- M5-B: start at greeter, then collect out of canonical order ---
    await talkThrough(page, 392, 1112, "npc.greeter", 4);
    let qs = await questState(page);
    if (qs.status !== "active") fail(`quest not active after greeter: ${JSON.stringify(qs)}`);
    await talkThrough(page, 440, 728, "npc.photographer", 3);
    qs = await questState(page);
    if (!qs.collected.includes("heart.memories")) fail("memories heart missing after photographer");
    const hud1 = await hudText(page);
    if (!hud1.includes("♥")) fail(`HUD should show one heart: ${hud1}`);
    await talkThrough(page, 424, 280, "npc.proposal_friend", 3);
    qs = await questState(page);
    if (!qs.collected.includes("heart.proposal")) fail("proposal heart missing");
    await talkThrough(page, 104, 552, "npc.story_keeper", 3);
    qs = await questState(page);
    if (!qs.collected.includes("heart.first_meeting")) fail("first_meeting heart missing");

    // --- M5-C: fourth heart, duplicate, unlock banner ---
    await talkThrough(page, 200, 600, "npc.travel_friend", 3);
    qs = await questState(page);
    if (qs.status !== "complete" || !qs.finaleUnlocked) fail(`quest not complete: ${JSON.stringify(qs)}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m5-toast-390.png") });
    await page.waitForSelector('[data-testid="unlock-banner"]', { state: "visible", timeout: 15000 });
    await page.screenshot({ path: join(ROOT, "docs/qa/m5-unlock-390.png") });
    const hudFull = await hudText(page);
    if (hudFull.includes("♡")) fail(`HUD should be full: ${hudFull}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m5-hud-full-390.png") });
    await talkThrough(page, 200, 600, "npc.travel_friend", 3);
    qs = await questState(page);
    if (qs.collected.length !== 4) fail("duplicate re-talk changed collection");

    // --- M5-D: through the door, couple finale, reveal ---
    await teleport(page, 440, 220);
    const throughY = (await walkNorth(page, 2500)).y;
    if (!(throughY < blockedY - 10)) fail(`door still blocked: before=${blockedY} after=${throughY}`);
    await talkThrough(page, 392, 200, "npc.couple_a", 2);
    await page.waitForSelector('[data-testid="finale-reveal"]', { state: "visible", timeout: 15000 });
    const reveal = await page.textContent('[data-testid="finale-reveal"]');
    if (!reveal.includes("Ayu") || !reveal.includes("Bima")) fail(`reveal missing couple: ${reveal}`);
    const finales = await hook(page, () => window.__finaleEvents.length);
    if (finales !== 1) fail(`FINALE_STARTED fired ${finales}x, expected 1`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m5-finale-390.png") });
    await page.click('[data-testid="finale-close"]');

    if (pageLogs.length > 0) fail(`page errors during quest test: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
    console.log("locked gate + out-of-order quest + unlock + finale OK");

    // --- width set for the G4 review ---
    const browser3 = await launchBrowser();
    for (const [w, h, name] of [[320, 568, "m5-hud-empty-320.png"], [430, 932, "m5-hud-empty-430.png"]]) {
      const c3 = await browser3.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const p3 = await c3.newPage();
      await prepPage(p3);
      await p3.addInitScript(() => {
        window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
      });
      await p3.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p3.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.questState, null, { timeout: 60000 });
      await sleep(1500);
      await p3.screenshot({ path: join(ROOT, "docs/qa", name) });
      await c3.close();
    }
    await browser3.close();
  } finally {
    await stopServer();
  }
  console.log("M5 QUEST VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
