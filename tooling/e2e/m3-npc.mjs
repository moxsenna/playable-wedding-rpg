// M3 NPC probe: Tiled-slot NPCs, proximity selection, contextual Interact,
// DOM dialogue round-trip with movement suspension, keyboard parity, and
// semantic-action dispatch — all in a real mobile browser.
// Self-contained: starts `next dev`, runs scenarios M3-A (stick), M3-B
// (keyboard), an NPC tour for screenshots, then cleans up.
// Prints M3 NPC VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8103;
const URL = `http://localhost:${PORT}/`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M3 NPC check FAILED: ${msg}`); process.exit(1); };
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
  vx: window.__wedding.player.sprite.body.velocity.x,
  vy: window.__wedding.player.sprite.body.velocity.y,
}));
const targetId = (page) => hook(page, () => window.__wedding.targetId());
const interactLabel = (page) => hook(page, () => window.__wedding.interactLabel());

// Drag the stick toward a world point until within arrivePx (default 46).
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
    const pageLogs = [];
    page.on("pageerror", (e) => pageLogs.push(`[pageerror] ${e && e.message}`));
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 60000 });
    await sleep(800);
    await hook(page, () => {
      window.__npcEvents = [];
      window.__wedding.events.on("DIALOGUE_OPENED", (p) => window.__npcEvents.push({ t: "opened", p }));
      window.__wedding.events.on("DIALOGUE_ACTION", (p) => window.__npcEvents.push({ t: "action", p }));
      window.__wedding.events.on("DIALOGUE_CLOSED", (p) => window.__npcEvents.push({ t: "closed", p }));
    });
    const npcEvents = () => hook(page, () => window.__npcEvents);

    // --- far from everyone: no target, default label ---
    if ((await targetId(page)) !== null) fail("target selected at spawn, 68px from greeter");
    if ((await interactLabel(page)) !== "Aksi") fail("Interact label must default to Aksi");

    // --- M3-A: stick to Greeter, Bicara, dialogue round-trip ---
    await seek(page, 392, 1104, 30000, 25);
    await waitTarget(page, "npc.greeter");
    if ((await interactLabel(page)) !== "Bicara") fail(`greeter label must be Bicara, saw ${await interactLabel(page)}`);
    const g = await hook(page, () => window.__wedding.input.geometry());
    await page.touchscreen.tap(g.interact.x, g.interact.y);
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
    const panelName = await page.textContent('[data-testid="dialogue-name"]');
    if (panelName !== "Sari") fail(`dialogue shows wrong NPC: ${panelName}`);
    const t0 = await page.textContent('[data-testid="dialogue-text"]');
    if (!t0.includes("Taman Kebahagiaan")) fail(`greeter opening line wrong: ${t0}`);
    // suspended: velocity zero and drags do nothing
    const held = await pos(page);
    if (Math.hypot(held.vx, held.vy) > 1) fail("movement not suspended during dialogue");
    await page.mouse.move(g.stick.x, g.stick.y);
    await page.mouse.down();
    await page.mouse.move(g.stick.x + 40, g.stick.y, { steps: 8 });
    await sleep(500);
    const held2 = await pos(page);
    await page.mouse.up();
    if (Math.hypot(held2.x - held.x, held2.y - held.y) > 3) fail("world moved during dialogue");
    await page.screenshot({ path: join(ROOT, "docs/qa/m3-dialogue-390.png") });
    // progress: sapa -> gerak -> buku(action OPEN_WEDDING_BOOK, resumes misi)
    // -> misi(action START_MAIN_QUEST, terminal). The book opens as soon as
    // the buku action fires, so close it before finishing the misi line.
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(300);
    const t1 = await page.textContent('[data-testid="dialogue-text"]');
    if (t1 === t0) fail("dialogue did not advance");
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(300);
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(500);
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    await page.click('[data-testid="wedding-book-close"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
    await page.click('[data-testid="dialogue-continue"]');
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "hidden", timeout: 15000 });
    const evs = await npcEvents();
    const opened = evs.filter((e) => e.t === "opened");
    const actions = evs.filter((e) => e.t === "action");
    const closed = evs.filter((e) => e.t === "closed");
    if (opened.length !== 1 || opened[0].p.npcId !== "sari_greeter") fail("DIALOGUE_OPENED malformed");
    const types = actions.map((a) => a.p.action.type);
    if (JSON.stringify(types) !== JSON.stringify(["OPEN_WEDDING_BOOK", "START_MAIN_QUEST"])) {
      fail(`greeter must dispatch book then quest start, saw ${JSON.stringify(types)}`);
    }
    if (closed.length !== 1) fail("DIALOGUE_CLOSED missing");
    // the buku action already deep-linked into the Book (opened + closed
    // above); the quest is now active from the misi line.
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
    // resumes cleanly: new input moves again, zero residual drift first
    const r0 = await pos(page);
    await sleep(400);
    const r1 = await pos(page);
    if (Math.hypot(r1.x - r0.x, r1.y - r0.y) > 2) fail("residual drift after dialogue close");
    await page.mouse.move(g.stick.x, g.stick.y);
    await page.mouse.down();
    await page.mouse.move(g.stick.x, g.stick.y - 44, { steps: 8 });
    await sleep(600);
    const r2 = await pos(page);
    await page.mouse.up();
    if (!(r0.y - r2.y > 20)) fail("no movement after dialogue close");

    // --- M3-B: keyboard to RSVP keeper, RSVP dispatch ---
    await seek(page, 456, 904, 30000, 25);
    await waitTarget(page, "npc.rsvp_keeper");
    if ((await interactLabel(page)) !== "RSVP") fail("rsvp keeper label must be RSVP");
    await page.screenshot({ path: join(ROOT, "docs/qa/m3-rsvp-390.png") });
    await page.keyboard.press("e");
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
    const nadia = await page.textContent('[data-testid="dialogue-name"]');
    if (nadia !== "Nadia") fail(`rsvp dialogue shows wrong NPC: ${nadia}`);
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(300);
    await page.click('[data-testid="dialogue-continue"]');
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "hidden", timeout: 15000 });
    const evs2 = await npcEvents();
    const rsvpActions = evs2.filter((e) => e.t === "action" && e.p.action.type === "OPEN_RSVP");
    if (rsvpActions.length < 1) fail("rsvp keeper must dispatch OPEN_RSVP");
    // keeper terminal action deep-links into RSVP (M4 integration)
    await page.waitForSelector('[data-testid="book-section-rsvp"]', { state: "visible", timeout: 15000 });
    await page.click('[data-testid="wedding-book-close"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });

    // --- tour: photographer, story keeper, event coordinator ---
    await seek(page, 440, 728);
    await waitTarget(page, "npc.photographer");
    if ((await interactLabel(page)) !== "Lihat Foto") fail("photographer label must be Lihat Foto");
    await page.screenshot({ path: join(ROOT, "docs/qa/m3-photo-390.png") });
    await seek(page, 104, 552, 30000, 25);
    await waitTarget(page, "npc.story_keeper");
    await page.screenshot({ path: join(ROOT, "docs/qa/m3-story-390.png") });
    // target stability: sample repeatedly while idle
    const seen = new Set();
    for (let i = 0; i < 5; i++) {
      seen.add(await targetId(page));
      await sleep(200);
    }
    if (seen.size !== 1 || !seen.has("npc.story_keeper")) fail("target selection not deterministic");
    await seek(page, 744, 540, 30000, 25);
    await waitTarget(page, "npc.event_coordinator");
    if ((await interactLabel(page)) !== "Lihat Acara") fail("coordinator label must be Lihat Acara");
    await page.screenshot({ path: join(ROOT, "docs/qa/m3-event-390.png") });

    if (pageLogs.length > 0) fail(`page errors during NPC test: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
    console.log("greeter dialogue + keyboard rsvp + tour OK");

    // --- 360/430 spawn views for the G4 set ---
    const browser2 = await launchBrowser();
    for (const [w, h, name] of [[360, 740, "m3-spawn-360.png"], [430, 932, "m3-spawn-430.png"]]) {
      const c2 = await browser2.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const p2 = await c2.newPage();
      await p2.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p2.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 60000 });
      await sleep(2500);
      await p2.screenshot({ path: join(ROOT, "docs/qa", name) });
      await c2.close();
    }
    await browser2.close();
  } finally {
    await stopServer();
  }
  console.log("M3 NPC VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
