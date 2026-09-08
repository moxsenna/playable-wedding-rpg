// M4 book probe: canonical Wedding Book over the typed bridge, in a real
// mobile browser. Self-contained: starts `next dev`, then asserts:
//   M4-A  open book -> Home/Acara readable, no enum leaks; drag-suspended
//         while open; close stationary; stick resumes movement
//   M4-B  Event Coordinator dialogue deep-links into Acara
//   M4-C  RSVP Keeper dialogue deep-links into RSVP; mock submit succeeds
//   venue Show-in-World sets a nav marker cleared on arrival
//   M4-D  with world assets blocked (dead Phaser), couple/event/venue stay
//         readable through the Book
// Saves the G4 screenshot set, then cleans up.
// Prints M4 BOOK VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8104;
const URL = `http://localhost:${PORT}/`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M4 book check FAILED: ${msg}`); process.exit(1); };
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
const pos = (page) => hook(page, () => ({
  x: window.__wedding.player.sprite.x,
  y: window.__wedding.player.sprite.y,
}));
const targetId = (page) => hook(page, () => window.__wedding.targetId());

async function seek(page, tx, ty, timeoutMs = 30000, arrivePx = 46) {
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

async function dragUp(page, ms = 600) {
  const g = await hook(page, () => window.__wedding.input.geometry());
  await page.mouse.move(g.stick.x, g.stick.y);
  await page.mouse.down();
  await page.mouse.move(g.stick.x, g.stick.y - 44, { steps: 8 });
  await sleep(ms);
  const p = await pos(page);
  await page.mouse.up();
  return p;
}

// All probe contexts are touch-mobile, so route testid interactions through
// touch taps: the honest input for this UI, immune to the mouse hit-test path
// that Next dev chrome intermittently trips.
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
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 60000 });
    await sleep(800);

    // --- M4-A: open, read, suspend, close, resume ---
    await page.click('[data-testid="wedding-book-open"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    const couple = await page.textContent('[data-testid="book-couple"]');
    if (!couple.includes("Ayu") || !couple.includes("Bima")) fail(`couple header wrong: ${couple}`);
    const date = await page.textContent('[data-testid="book-date"]');
    if (!date.includes("Juni") || !date.includes("2027")) fail(`date not localized: ${date}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/book-home-390.png") });
    // drag while open: modal suspends the world
    const b0 = await pos(page);
    const g0 = await hook(page, () => window.__wedding.input.geometry());
    await page.mouse.move(g0.stick.x, g0.stick.y);
    await page.mouse.down();
    await page.mouse.move(g0.stick.x + 40, g0.stick.y, { steps: 8 });
    await sleep(500);
    const b1 = await pos(page);
    await page.mouse.up();
    if (Math.hypot(b1.x - b0.x, b1.y - b0.y) > 3) fail("world moved under open book");
    await page.click('[data-testid="book-nav-events"]');
    await page.waitForSelector('[data-testid="book-section-events"]', { state: "visible", timeout: 15000 });
    const akad = await page.textContent('[data-testid="book-event-akad"]');
    if (akad !== "Akad Nikah") fail(`event title wrong: ${akad}`);
    const bodyText = await page.textContent('[data-testid="wedding-book"]');
    if (/RECEPTION|CEREMONY/.test(bodyText)) fail("internal enum leaked into book UI");
    await page.screenshot({ path: join(ROOT, "docs/qa/book-acara-390.png") });
    await page.click('[data-testid="wedding-book-close"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
    const s0 = await pos(page);
    await sleep(400);
    const s1 = await pos(page);
    if (Math.hypot(s1.x - s0.x, s1.y - s0.y) > 2) fail("residual drift after book close");
    const m0 = await pos(page);
    const m1 = await dragUp(page);
    if (!(m0.y - m1.y > 20)) fail("no movement after book close");

    // --- venue deep nav: marker set, cleared on arrival ---
    await page.click('[data-testid="wedding-book-open"]');
    await page.click('[data-testid="book-nav-venue"]');
    await page.waitForSelector('[data-testid="book-section-venue"]', { state: "visible", timeout: 15000 });
    await page.screenshot({ path: join(ROOT, "docs/qa/book-lokasi-390.png") });
    await page.click('[data-testid="venue-show-in-world"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
    const nav1 = await hook(page, () => window.__wedding.scene.navZoneId ?? null);
    if (nav1 !== "landmark.main_plaza") fail(`nav marker not set: ${nav1}`);
    // Two-leg route into the plaza: west first (clears the greeter), then
    // straight north along x=360 (clears stall, photographer, fountain).
    await seek(page, 360, 1000);
    await seek(page, 440, 568);
    {
      const start = Date.now();
      for (;;) {
        const nz = await hook(page, () => window.__wedding.scene.navZoneId ?? null);
        if (nz === null) break;
        if (Date.now() - start > 20000) fail("nav marker not cleared on arrival");
        await sleep(400);
      }
    }

    // --- gallery section ---
    await page.click('[data-testid="wedding-book-open"]');
    await page.click('[data-testid="book-nav-gallery"]');
    await page.waitForSelector('[data-testid="book-section-gallery"]', { state: "visible", timeout: 15000 });
    const alts = await page.$$eval('[data-testid="gallery-img"]', (els) => els.map((e) => e.getAttribute("alt")));
    if (alts.length !== 3 || alts.some((a) => !a)) fail(`gallery images wrong: ${JSON.stringify(alts)}`);
    await page.waitForFunction(
      () => [...document.querySelectorAll('[data-testid="gallery-img"]')].every((i) => i.complete && i.naturalWidth > 0),
      null, { timeout: 30000 });
    await page.screenshot({ path: join(ROOT, "docs/qa/book-gallery-390.png") });
    await page.click('[data-testid="wedding-book-close"]');

    // --- M4-B: coordinator dialogue deep-links into Acara ---
    await seek(page, 744, 540, 30000, 25);
    await waitTarget(page, "npc.event_coordinator");
    const gb = await hook(page, () => window.__wedding.input.geometry());
    await page.touchscreen.tap(gb.interact.x, gb.interact.y);
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(300);
    await page.click('[data-testid="dialogue-continue"]');
    await page.waitForSelector('[data-testid="book-section-events"]', { state: "visible", timeout: 15000 });
    await page.click('[data-testid="wedding-book-close"]');

    // --- M4-C: RSVP keeper dialogue deep-links into RSVP; mock submit ---
    await seek(page, 456, 904, 30000, 25);
    await waitTarget(page, "npc.rsvp_keeper");
    await page.keyboard.press("e");
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(300);
    await page.click('[data-testid="dialogue-continue"]');
    await page.waitForSelector('[data-testid="book-section-rsvp"]', { state: "visible", timeout: 15000 });
    await page.fill('[data-testid="rsvp-name"]', "Dinda");
    await page.click('[data-testid="rsvp-submit"]');
    await page.waitForSelector('[data-testid="rsvp-success"]', { state: "visible", timeout: 15000 });
    const ok = await page.textContent('[data-testid="rsvp-success"]');
    if (!ok.includes("Dinda")) fail(`rsvp success wrong: ${ok}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/book-rsvp-390.png") });
    await page.click('[data-testid="wedding-book-close"]');

    if (pageLogs.length > 0) fail(`page errors during book test: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
    console.log("book open/acara/nav/gallery + coordinator/rsvp deep links OK");

    // --- M4-D: world assets blocked -> dead Phaser, book still canonical ---
    const browser2 = await launchBrowser();
    const ctx2 = await browser2.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx2.route("**/assets/worlds/**", (route) => route.abort());
    const p2 = await ctx2.newPage();
    await prepPage(p2);
    const p2errors = [];
    p2.on("pageerror", (e) => p2errors.push(String((e && e.message) || e).slice(0, 200)));
    await p2.goto(URL, { waitUntil: "networkidle", timeout: 900000 });
    await sleep(4000);
    // Dev-only: a dead game throws during boot, and Next dev renders its
    // error overlay into <nextjs-portal>, swallowing taps. Production has
    // no overlay; remove the dev chrome so the gate tests app behavior.
    await p2.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    const hookAlive = await hook(p2, () => !!window.__wedding?.player);
    if (hookAlive) fail("expected dead game hook with blocked assets");
    await p2.click('[data-testid="wedding-book-open"]');
    await sleep(1000);
    await p2.screenshot({ path: join(ROOT, "docs/qa/m4D-debug.png") });
    await p2.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    const c2 = await p2.textContent('[data-testid="book-couple"]');
    if (!c2.includes("Ayu")) fail("couple unreadable without Phaser");
    await p2.click('[data-testid="book-nav-events"]');
    const e2 = await p2.textContent('[data-testid="book-event-akad"]');
    if (e2 !== "Akad Nikah") fail("events unreadable without Phaser");
    await p2.click('[data-testid="book-nav-venue"]');
    const v2 = await p2.textContent('[data-testid="book-venue-name"]');
    if (!v2.includes("Taman Kebahagiaan")) fail("venue unreadable without Phaser");
    await browser2.close();

    // --- width set for the G4 review ---
    const browser3 = await launchBrowser();
    for (const [w, h, name] of [[320, 568, "book-home-320.png"], [360, 740, "book-home-360.png"], [430, 932, "book-home-430.png"]]) {
      const c3 = await browser3.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const p3 = await c3.newPage();
      await prepPage(p3);
      await p3.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p3.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 60000 });
      await sleep(1500);
      await p3.click('[data-testid="wedding-book-open"]');
      await p3.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
      await p3.screenshot({ path: join(ROOT, "docs/qa", name) });
      await c3.close();
    }
    await browser3.close();
  } finally {
    await stopServer();
  }
  console.log("M4 BOOK VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
