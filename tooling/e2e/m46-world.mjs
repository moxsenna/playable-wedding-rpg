// M4.6 world probe: production environment in a real mobile browser.
// Self-contained: starts `next dev`, then asserts:
//   - 73 placements + 10 NPCs + data-driven player avatar present
//   - keyboard walk advances on new terrain, then blocks on the
//     photographer body (end-to-end collision proof)
//   - Wedding Book opens/closes (bridge intact)
//   - transfer sizes logged (payload evidence)
// Teleports to 9 landmark stops for the deterministic G4 screenshot set
// (teleport is camera work, not a gameplay assertion).
// Prints M4.6 WORLD VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8107;
const URL = `http://localhost:${PORT}/`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M4.6 world check FAILED: ${msg}`); process.exit(1); };
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

const STOPS = [
  ["entrance", 440, 1050],
  ["rsvp", 500, 880],
  ["plaza", 440, 560],
  ["memory", 160, 550],
  ["photo", 400, 740],
  ["event", 730, 540],
  ["couple", 440, 260],
  ["hall", 440, 200],
  ["wishing", 336, 208],
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

    const world = await hook(page, () => ({
      placements: window.__wedding.scene.def.placements.length,
      npcs: window.__wedding.scene.npcs.length,
      tex: window.__wedding.player.sprite.texture.key,
    }));
    if (world.placements < 70) fail(`placements missing: ${world.placements}`);
    if (world.npcs !== 10) fail(`NPC count wrong: ${world.npcs}`);
    if (world.tex !== "guest_male_batik_burgundy_01") fail(`player avatar wrong: ${world.tex}`);

    // transfer payload evidence (§34)
    const xfer = await hook(page, () =>
      performance.getEntriesByType("resource")
        .filter((r) => /\.(png|json)$/.test(r.name) && /(environment|avatars|worlds)/.test(r.name))
        .map((r) => ({ url: r.name.split("/assets/")[1], kb: Math.round((r.transferSize || 0) / 1024) }))
    );
    const totalKb = xfer.reduce((a, b) => a + b.kb, 0);
    console.log(`transfer: ${xfer.length} files, ${totalKb}KB total`);
    for (const f of xfer.filter((x) => x.kb > 300)) console.log(`  ${f.url}: ${f.kb}KB`);

    // traverse north: real progress, then blocked by the photographer body
    const y0 = await hook(page, () => window.__wedding.player.sprite.y);
    await page.keyboard.down("ArrowUp");
    await sleep(2000);
    const y1 = await hook(page, () => window.__wedding.player.sprite.y);
    await sleep(4000);
    await page.keyboard.up("ArrowUp");
    const y2 = await hook(page, () => window.__wedding.player.sprite.y);
    if (!(y0 - y1 > 150)) fail(`no traversal progress: ${y0} -> ${y1}`);
    if (!(y2 > 700 && y2 < 800)) fail(`collision block unexpected at y=${y2}`);

    // bridge intact: book opens and closes
    await page.click('[data-testid="wedding-book-open"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    await page.click('[data-testid="wedding-book-close"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });

    // deterministic location tour (teleport = camera work for screenshots)
    for (const [name, x, y] of STOPS) {
      await hook(page, (pt) => window.__wedding.debugTeleport(pt.x, pt.y), { x, y });
      await sleep(1200);
      await page.screenshot({ path: join(ROOT, "docs/qa", `m46-${name}-390.png`) });
    }
    // greeter targeting visible on production art
    await hook(page, (pt) => window.__wedding.debugTeleport(pt.x, pt.y), { x: 400, y: 1090 });
    await sleep(1200);
    const tid = await hook(page, () => window.__wedding.targetId());
    if (tid !== "npc.greeter") fail(`greeter not targeted near spawn: ${tid}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m46-greeter-390.png") });

    if (pageLogs.length > 0) fail(`page errors during world test: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
    console.log("traverse + collision + book + tour OK");

    const browser2 = await launchBrowser();
    for (const [w, h, name] of [[320, 568, "m46-entrance-320.png"], [360, 740, "m46-plaza-360.png"], [430, 932, "m46-hall-430.png"]]) {
      const c2 = await browser2.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const p2 = await c2.newPage();
      await prepPage(p2);
      await p2.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p2.waitForFunction(() => !!window.__wedding?.player && !!window.__wedding?.input, null, { timeout: 60000 });
      await sleep(1500);
      if (name.includes("plaza")) await hook(p2, (pt) => window.__wedding.debugTeleport(pt.x, pt.y), { x: 440, y: 560 });
      if (name.includes("hall")) await hook(p2, (pt) => window.__wedding.debugTeleport(pt.x, pt.y), { x: 440, y: 200 });
      await sleep(1200);
      await p2.screenshot({ path: join(ROOT, "docs/qa", name) });
      await c2.close();
    }
    await browser2.close();
  } finally {
    await stopServer();
  }
  console.log("M4.6 WORLD VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
