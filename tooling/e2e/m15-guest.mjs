// M15 guest-experience probe: loading shimmer, onboarding name+avatar,
// emoji menu + head bubble, Sari entry gate, "Undangan" rename, wishes
// submit — in a real mobile browser. Self-contained: starts `next dev`.
// Boots the LOCAL dev manifest explicitly: the pinned R2 template (v6)
// predates the Sari entry gate, so the default prod-pinned boot cannot
// exercise gate.entry; manifest sourcing itself is covered by m127.
// Prints M15 GUEST VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8110;
const URL = `http://localhost:${PORT}/`;
const LOCAL_MANIFEST = `http://localhost:${PORT}/assets/worlds/garden-village-v1/manifest.json`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M15 guest check FAILED: ${msg}`); process.exit(1); };
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
const teleport = (page, x, y) => hook(page, (a) => window.__wedding.debugTeleport(a.x, a.y), { x, y });

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

async function walkNorth(page, ms) {
  const g = await hook(page, () => window.__wedding.input.geometry());
  if (!g) fail("no touch input geometry");
  await page.mouse.move(g.stick.x, g.stick.y);
  await page.mouse.down();
  await page.mouse.move(g.stick.x, g.stick.y - 44, { steps: 8 });
  await sleep(ms);
  await page.mouse.up();
  return pos(page);
}

async function waitTarget(page, id, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    if ((await targetId(page)) === id) return;
    if (Date.now() - start > timeoutMs) fail(`never targeted ${id}`);
    await sleep(300);
  }
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
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(`${URL}?manifest=${encodeURIComponent(LOCAL_MANIFEST)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(1200);

    // --- G1: onboarding first, game boots only after ---
    await page.waitForSelector('[data-testid="onboarding-panel"]', { state: "visible", timeout: 15000 });
    const bootedEarly = await page.evaluate(() => !!window.__wedding?.player);
    if (bootedEarly) fail("game booted before onboarding completed");
    await page.click('[data-testid="onboarding-submit"]');
    await page.waitForSelector('[data-testid="onboarding-error"]', { state: "visible", timeout: 15000 });
    await page.fill('[data-testid="onboarding-name"]', "Dinda");
    await page.click('[data-testid="onboarding-avatar-guest_female_kebaya_pink_01"]');
    await page.click('[data-testid="onboarding-submit"]');
    await page.waitForSelector('[data-testid="onboarding-panel"]', { state: "hidden", timeout: 15000 });

    // --- G1: loading shimmer covers the boot, then hides ---
    await page.waitForSelector('[data-testid="loading-screen"]', { state: "visible", timeout: 15000 });
    await page.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 90000 });
    await page.waitForSelector('[data-testid="loading-screen"]', { state: "hidden", timeout: 30000 });
    const tex = await hook(page, () => window.__wedding.player.sprite.texture.key);
    if (tex !== "guest_female_kebaya_pink_01") fail(`picked avatar not applied: ${tex}`);
    const hud = await page.textContent('[data-testid="quest-hud"]');
    if (!hud.includes("Halo, Dinda!")) fail(`greeting missing: ${hud}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m15-onboarding-390.png") });

    // --- G2: emoji menu + head bubble ---
    await page.keyboard.press("q");
    await page.waitForSelector('[data-testid="emote-menu"]', { state: "visible", timeout: 15000 });
    await page.click('[data-testid="emote-pick-heart"]');
    await page.waitForSelector('[data-testid="emote-menu"]', { state: "hidden", timeout: 15000 });
    await sleep(400);
    const bubble = await hook(page, () => window.__wedding.localEmote());
    if (bubble !== "♥") fail(`expected head bubble, saw ${bubble}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m15-emote-390.png") });

    // --- G3: Sari gate blocks the door approach, then opens ---
    await teleport(page, 440, 175);
    await sleep(800);
    await page.waitForSelector('[data-testid="entry-locked"]', { state: "visible", timeout: 15000 });
    await teleport(page, 440, 220);
    await sleep(300);
    const blockedY = (await walkNorth(page, 2500)).y;
    if (!(blockedY > 176)) fail(`walked through the entry barrier: y=${blockedY}`);
    await teleport(page, 392, 1160);
    await seek(page, 392, 1128, 30000, 30);
    await waitTarget(page, "npc.greeter");
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
    await page.waitForSelector('[data-testid="entry-opened"]', { state: "visible", timeout: 15000 });
    await teleport(page, 440, 220);
    await sleep(300);
    const openY = (await walkNorth(page, 2500)).y;
    if (!(openY < blockedY - 8)) fail(`door approach still blocked: before=${blockedY} after=${openY}`);
    // flanks stay shut: due west of the door at row 9
    await teleport(page, 320, 200);
    await sleep(300);
    const flankY = (await walkNorth(page, 2500)).y;
    if (!(flankY > 150)) fail(`flank wall passable: y=${flankY}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m15-gate-390.png") });

    // --- G4: "Undangan" copy, no "Buku Nikah" anywhere ---
    const openLabel = await page.textContent('[data-testid="wedding-book-open"]');
    if (!openLabel.includes("Undangan")) fail(`open button not renamed: ${openLabel}`);
    await page.click('[data-testid="wedding-book-open"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    const sheetText = await page.textContent('[data-testid="wedding-book"]');
    if (sheetText.includes("Buku Nikah")) fail("sheet still mentions Buku Nikah");
    if (!sheetText.includes("Undangan")) fail("sheet header not renamed");
    const bodyText = await page.textContent("body");
    if (bodyText.includes("Buku Nikah")) fail("Buku Nikah copy survives somewhere in DOM");

    // --- G5: wishes submit (offline local outbox, no ?api=) ---
    await page.click('[data-testid="book-nav-rsvp"]');
    await page.waitForSelector('[data-testid="book-section-rsvp"]', { state: "visible", timeout: 15000 });
    const navLabel = await page.textContent('[data-testid="book-nav-rsvp"]');
    if (!navLabel.includes("Pesan")) fail(`nav not renamed: ${navLabel}`);
    const prefilled = await page.inputValue('[data-testid="rsvp-name"]');
    if (prefilled !== "Dinda") fail(`name not prefilled from profile: ${prefilled}`);
    await page.fill('[data-testid="wishes-message"]', "Selamat menempuh hidup baru!");
    await page.click('[data-testid="rsvp-submit"]');
    await page.waitForSelector('[data-testid="rsvp-success"]', { state: "visible", timeout: 15000 });
    const okMsg = await page.textContent('[data-testid="rsvp-success"]');
    if (!okMsg.includes("Dinda")) fail(`wishes success wrong: ${okMsg}`);
    const stored = await page.evaluate(() => window.localStorage.getItem("wedding-rpg:wishes"));
    if (!stored || !stored.includes("Selamat menempuh hidup baru")) fail("wish missing from local outbox");
    await page.screenshot({ path: join(ROOT, "docs/qa/m15-wishes-390.png") });
    await page.click('[data-testid="wedding-book-close"]');

    if (pageLogs.length > 0) fail(`page errors during guest test: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("M15 GUEST VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
