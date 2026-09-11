// M2 touch probe: proves the canvas touch HUD works in a real mobile browser.
// Self-contained: starts `next dev`, then asserts with Playwright:
//   - HUD hidden on non-touch desktop, visible on touch mobile
//   - mouse/touch drag on the stick moves the player (DRAGGING), release
//     returns to IDLE with zero residual velocity (no stuck movement)
//   - CDP two-touch: holding the stick while tapping Interact fires
//     INTERACT_PRESSED with the stick still engaged (multitouch)
//   - MODAL_OPENED suspends input (zero velocity despite held drag);
//     MODAL_CLOSED resumes cleanly
//   - Emote tap opens the picker menu (no early dispatch); picking fires
//     EMOTE_SELECTED and shows the glyph bubble above the player head
// Saves 390px + 320px screenshots, then cleans up.
// Prints M2 TOUCH VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8102;
// The guest experience lives at /demo; `/` is the marketing landing page.
const URL = `http://localhost:${PORT}/demo`;
const BIN = process.platform === "win32" ? ".cmd" : "";
const EMOTES = ["wave", "heart", "celebrate", "laugh", "blessing"];

const fail = (msg) => { console.error(`M2 touch check FAILED: ${msg}`); process.exit(1); };
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

const hook = (page, fn) => page.evaluate(fn);

async function main() {
  const nextBinJs = join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextBinJs, "dev", "-p", String(PORT)], {
    cwd: WEB_DIR, stdio: "pipe",
  });
  server.on("error", (e) => fail(`could not start dev server: ${e.message}`));
  const serverLog = [];
  server.stdout?.on("data", (d) => serverLog.push(String(d)));
  server.stderr?.on("data", (d) => serverLog.push(String(d)));

  try {
    await waitForServer();
    const browser = await launchBrowser();

    // --- desktop (no touch): HUD must stay hidden ---
    const desktop = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const dp = await desktop.newPage();
    await dp.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
    });
    await dp.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await dp.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 60000 });
    const desktopGeom = await hook(dp, () => window.__wedding.input.geometry());
    if (desktopGeom !== null) fail("touch HUD visible on non-touch desktop");
    await desktop.close();

    // --- mobile touch context ---
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    });
    const page = await ctx.newPage();
    const pageLogs = [];
    page.on("pageerror", (e) => pageLogs.push(`[pageerror] ${e && e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
    });
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 60000 });
    await sleep(800);

    const geom = await hook(page, () => window.__wedding.input.geometry());
    if (!geom) fail("touch HUD missing on touch device");
    if (geom.phase !== "IDLE" || geom.suspended) fail("HUD must start IDLE and unsuspended");

    const read = () => hook(page, () => ({
      x: window.__wedding.player.sprite.x,
      y: window.__wedding.player.sprite.y,
      vx: window.__wedding.player.sprite.body.velocity.x,
      vy: window.__wedding.player.sprite.y !== undefined
        ? window.__wedding.player.sprite.body.velocity.y : 0,
      phase: window.__wedding.input.geometry().phase,
    }));
    await hook(page, () => {
      window.__fired = [];
      window.__wedding.events.on("INTERACT_PRESSED", () => window.__fired.push({ t: "interact" }));
      window.__wedding.events.on("EMOTE_SELECTED", (p) => window.__fired.push({ t: "emote", emote: p && p.emote }));
    });

    // --- stick drag via mouse (Phaser unifies pointer input) ---
    const before = await read();
    await page.mouse.move(geom.stick.x, geom.stick.y);
    await page.mouse.down();
    await page.mouse.move(geom.stick.x + 44, geom.stick.y, { steps: 12 });
    await sleep(700);
    const held = await read();
    if (held.phase !== "DRAGGING") fail(`expected DRAGGING while held, saw ${held.phase}`);
    if (!(held.x - before.x > 25)) fail(`stick drag moved only ${(held.x - before.x).toFixed(1)}px`);
    await page.mouse.up();
    await sleep(350);
    const rest1 = await read();
    await sleep(400);
    const rest2 = await read();
    if (rest1.phase !== "IDLE") fail(`expected IDLE after release, saw ${rest1.phase}`);
    if (Math.hypot(rest2.x - rest1.x, rest2.y - rest1.y) > 2)
      fail(`stuck movement after release: drifted ${(Math.hypot(rest2.x - rest1.x, rest2.y - rest1.y)).toFixed(1)}px`);

    // --- multitouch: hold the stick with the mouse while tapping Interact
    // with a touch tap: two concurrent pointers via stable Playwright APIs ---
    const ix = geom.interact.x, iy = geom.interact.y;
    await page.mouse.move(geom.stick.x, geom.stick.y);
    await page.mouse.down();
    await page.mouse.move(geom.stick.x + 30, geom.stick.y, { steps: 8 });
    await sleep(400);
    await page.touchscreen.tap(ix, iy);
    await sleep(400);
    const multi = await read();
    const firedMulti = await hook(page, () => window.__fired.filter((f) => f.t === "interact").length);
    await page.mouse.up();
    if (firedMulti < 1) fail(`Interact tap while holding stick did not fire (stick phase: ${multi.phase})`);
    if (multi.phase !== "DRAGGING") fail(`stick lost engagement during multitouch: ${multi.phase}`);

    // --- modal suspend: held drag must produce zero velocity ---
    await hook(page, () => window.__wedding.events.emit("MODAL_OPENED"));
    await sleep(200);
    await page.mouse.move(geom.stick.x, geom.stick.y);
    await page.mouse.down();
    await page.mouse.move(geom.stick.x, geom.stick.y - 44, { steps: 12 });
    await sleep(500);
    const frozen = await read();
    await page.mouse.up();
    if (Math.hypot(frozen.vx, frozen.vy) > 1) fail(`input not suspended by modal: v=(${frozen.vx},${frozen.vy})`);
    if (frozen.phase !== "IDLE") fail(`stick not neutral under modal: ${frozen.phase}`);
    await hook(page, () => window.__wedding.events.emit("MODAL_CLOSED"));
    await sleep(200);
    const r0 = await read();
    await page.mouse.move(geom.stick.x, geom.stick.y);
    await page.mouse.down();
    await page.mouse.move(geom.stick.x - 44, geom.stick.y, { steps: 12 });
    await sleep(600);
    const r1 = await read();
    await page.mouse.up();
    if (!(r0.x - r1.x > 20)) fail(`no movement after modal close: ${(r0.x - r1.x).toFixed(1)}px`);

    // --- emote tap opens the picker menu (no immediate dispatch) ---
    const emotesBefore = await hook(page, () => window.__fired.filter((f) => f.t === "emote").length);
    await page.touchscreen.tap(geom.emote.x, geom.emote.y);
    await page.waitForSelector('[data-testid="emote-menu"]', { state: "visible", timeout: 15000 });
    const emotesAfterMenu = await hook(page, () => window.__fired.filter((f) => f.t === "emote").length);
    if (emotesAfterMenu !== emotesBefore) fail("emote menu opened but an emote fired early");
    await page.click('[data-testid="emote-pick-heart"]');
    await sleep(300);
    const emotes = await hook(page, () => window.__fired.filter((f) => f.t === "emote"));
    if (emotes.length <= emotesBefore) fail("emote pick did not fire EMOTE_SELECTED");
    const lastEmote = emotes[emotes.length - 1].emote;
    if (lastEmote !== "heart") fail(`expected picked heart emote, saw ${lastEmote}`);
    const bubble = await hook(page, () => window.__wedding.localEmote());
    if (bubble !== "♥") fail(`expected head bubble ♥, saw ${bubble}`);

    if (pageLogs.length > 0) fail(`page errors during touch test: ${pageLogs.join(" | ").slice(0, 400)}`);
    // Steady-state shot after all interactions: HUD resumed, stick IDLE.
    await page.screenshot({ path: join(ROOT, "docs/qa/m2-390px.png") });
    await browser.close();
    console.log("stick drag + multitouch + modal suspend/resume + emote OK");

    // --- 320px spawn screenshot for the G4 review set ---
    const browser2 = await launchBrowser();
    const ctx2 = await browser2.newContext({
      viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true,
    });
    const p320 = await ctx2.newPage();
    await p320.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
    });
    await p320.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p320.waitForFunction(() => !!window.__wedding?.player, null, { timeout: 60000 });
    await sleep(2500);
    await p320.screenshot({ path: join(ROOT, "docs/qa/m2-320px.png") });
    await browser2.close();
  } finally {
    await stopServer();
  }
  console.log("M2 TOUCH VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
