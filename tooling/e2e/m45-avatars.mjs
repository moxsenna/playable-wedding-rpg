// M4.5 avatar probe: production 64x64 avatars render from the registry in a
// real mobile browser. Self-contained: starts `next dev`, then asserts:
//   - player uses the data-driven guest avatar (texture, 64px frames, 0.4)
//   - 10 NPCs spawn on production textures with metadata origin/physics/scale
//     and sane feet bodies (not full-frame, centered, at the feet)
//   - all 8 animation states play on one production avatar
//   - multiple distinct avatar ids coexist; dialogue opens on production art
// Saves the G4 screenshot set, then cleans up.
// Prints M4.5 AVATARS VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8105;
const URL = `http://localhost:${PORT}/`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M4.5 avatar check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Unbuffered heartbeat: survives kills, pinpoints stalls the console cannot.
const beat = (msg) => {
  try {
    appendFileSync(join(ROOT, "docs/qa/m45-heartbeat.log"), `${new Date().toISOString()} ${msg}\n`);
  } catch { /* diagnostics must never break the gate */ }
};

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

// Touch contexts route testid interactions through taps (proven flake-free
// against Next dev chrome in earlier probes).
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
  try {
    writeFileSync(join(ROOT, "docs/qa/m45-heartbeat.log"), "");
  } catch { /* noop */ }
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

    // --- player runs on the data-driven production guest avatar ---
    const player = await hook(page, () => ({
      tex: window.__wedding.player.sprite.texture.key,
      fw: window.__wedding.player.sprite.frame.width,
      fh: window.__wedding.player.sprite.frame.height,
      scale: window.__wedding.player.sprite.scaleX,
      ox: window.__wedding.player.sprite.originX,
      oy: window.__wedding.player.sprite.originY,
      bw: window.__wedding.player.sprite.body.width,
      bh: window.__wedding.player.sprite.body.height,
      cx: window.__wedding.player.sprite.body.centerX,
      sx: window.__wedding.player.sprite.x,
      bottom: window.__wedding.player.sprite.body.bottom,
      sy: window.__wedding.player.sprite.y,
    }));
    if (player.tex !== "guest_male_batik_burgundy_01") fail(`player avatar wrong: ${player.tex}`);
    if (player.fw !== 64 || player.fh !== 64) fail(`player frame not 64x64: ${player.fw}x${player.fh}`);
    if (Math.abs(player.scale - 0.4) > 0.001) fail(`player display scale wrong: ${player.scale}`);
    if (player.ox !== 0.5 || player.oy !== 0.9) fail(`player origin wrong: ${player.ox},${player.oy}`);
    if (!(player.bw >= 6 && player.bw <= 9 && player.bh >= 3.5 && player.bh <= 6)) fail(`player feet body insane: ${player.bw}x${player.bh}`);
    if (Math.abs(player.cx - player.sx) > 4) fail("player body not centered");
    if (Math.abs(player.bottom - player.sy) > 5) fail("player body not at feet");

    // --- NPCs: production textures, metadata geometry, sane feet bodies ---
    const npcs = await hook(page, () => window.__wedding.scene.npcs.map((n) => ({
      slot: n.slotId,
      tex: n.sprite.texture.key,
      fw: n.sprite.frame.width,
      scale: n.sprite.scaleX,
      ox: n.sprite.originX,
      oy: n.sprite.originY,
      bw: n.sprite.body.width,
      bh: n.sprite.body.height,
      cx: n.sprite.body.centerX,
      sx: n.sprite.x,
      bottom: n.sprite.body.bottom,
      sy: n.sprite.y,
    })));
    if (npcs.length !== 10) fail(`expected 10 NPCs, saw ${npcs.length}`);
    const textures = new Set(npcs.map((n) => n.tex));
    if (textures.size < 5) fail(`expected distinct production avatars, saw ${[...textures].join(",")}`);
    if (textures.has("guest_01")) fail("placeholder guest_01 leaked into NPCs");
    for (const n of npcs) {
      if (n.fw !== 64) fail(`${n.slot}: frame not 64px wide`);
      if (Math.abs(n.scale - 0.4) > 0.001) fail(`${n.slot}: display scale wrong`);
      if (n.ox !== 0.5 || n.oy !== 0.9) fail(`${n.slot}: origin wrong`);
      if (!(n.bw >= 6 && n.bw <= 9 && n.bh >= 3.5 && n.bh <= 6)) {
        fail(`${n.slot}: feet body insane: ${n.bw.toFixed(1)}x${n.bh.toFixed(1)}`);
      }
      if (Math.abs(n.cx - n.sx) > 4) fail(`${n.slot}: body not centered: ${n.cx} vs ${n.sx}`);
      if (Math.abs(n.bottom - n.sy) > 5) fail(`${n.slot}: body not at feet: bottom ${n.bottom} vs y ${n.sy}`);
    }

    // --- all 8 animation states on the production player avatar ---
    const animKey = () => hook(page, () => window.__wedding.player.sprite.anims.currentAnim.key);
    const holdKey = async (key, ms = 450) => {
      await page.keyboard.down(key);
      await sleep(ms);
      const a = await animKey();
      await page.keyboard.up(key);
      return a;
    };
    const seen = {};
    seen.down = await holdKey("ArrowDown");
    seen.up = await holdKey("ArrowUp");
    seen.left = await holdKey("ArrowLeft");
    seen.right = await holdKey("ArrowRight");
    await sleep(400);
    const prefix = "guest_male_batik_burgundy_01";
    for (const [dir, key] of Object.entries(seen)) {
      if (key !== `${prefix}/walk-${dir}`) fail(`walk-${dir} wrong: ${key}`);
    }
    const idle = await animKey();
    if (!idle.endsWith("idle-right")) fail(`expected idle-right at rest, saw ${idle}`);
    for (const dir of ["down", "up", "left", "right"]) {
      await page.keyboard.down(dir === "down" ? "ArrowDown" : dir === "up" ? "ArrowUp" : dir === "left" ? "ArrowLeft" : "ArrowRight");
      await sleep(150);
      await page.keyboard.up(dir === "down" ? "ArrowDown" : dir === "up" ? "ArrowUp" : dir === "left" ? "ArrowLeft" : "ArrowRight");
      await sleep(350);
      const a = await animKey();
      if (a !== `${prefix}/idle-${dir}`) fail(`idle-${dir} wrong: ${a}`);
    }

    // --- dialogue opens on production art (labels/markers over 64px heads) ---
    console.log("PHASE: dialogue-seek");
    const pos = (p) => hook(p, () => ({
      x: window.__wedding.player.sprite.x,
      y: window.__wedding.player.sprite.y,
    }));
    const seek = async (page, tx, ty, arrivePx = 25, timeoutMs = 30000) => {
      const g = await hook(page, () => window.__wedding.input.geometry());
      if (!g) fail("hud input missing at seek");
      await page.mouse.move(g.stick.x, g.stick.y);
      let down = false;
      let loopError = null;
      const start = Date.now();
      try {
        await page.mouse.down();
        down = true;
        for (;;) {
          const p = await pos(page);
          const dx = tx - p.x, dy = ty - p.y;
          const h = Math.hypot(dx, dy);
          beat(`seek(${tx},${ty}) @${Math.round(p.x)},${Math.round(p.y)} h=${Math.round(h)}`);
          if (h < arrivePx) return;
          if (Date.now() - start > timeoutMs) fail(`seek to (${tx},${ty}) timed out`);
          const len = Math.hypot(dx, dy);
          const mx = g.stick.x + (dx / len) * 44, my = g.stick.y + (dy / len) * 44;
          if (!Number.isFinite(mx) || !Number.isFinite(my)) fail(`non-finite move target: ${mx},${my}`);
          try {
            await page.mouse.move(mx, my, { steps: 6 });
          } catch (e) {
            fail(`mouse.move(${mx},${my}) failed: ${e.message}`);
          }
          await sleep(350);
        }
      } catch (e) {
        loopError = e;
      } finally {
        if (down) {
          try {
            await page.mouse.up();
          } catch (e) {
            console.error(`seek cleanup mouse.up failed: ${e.message}`);
          }
        }
      }
      if (loopError) throw loopError;
    };
    const waitTarget = async (page, id, timeoutMs = 30000) => {
      const start = Date.now();
      for (;;) {
        const seen = await hook(page, () => window.__wedding.targetId());
        beat(`waitTarget(${id}) seen=${seen}`);
        if (seen === id) return;
        if (Date.now() - start > timeoutMs) fail(`never targeted ${id}`);
        await sleep(300);
      }
    };
    await seek(page, 392, 1104);
    await waitTarget(page, "npc.greeter");
    const gg = await hook(page, () => window.__wedding.input.geometry());
    await page.touchscreen.tap(gg.interact.x, gg.interact.y);
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
    const gname = await page.textContent('[data-testid="dialogue-name"]');
    if (gname !== "Sari") fail(`dialogue shows wrong NPC: ${gname}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m45-dialogue-390.png") });
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(300);
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(300);
    await page.click('[data-testid="dialogue-continue"]');
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "hidden", timeout: 15000 });
    await page.click('[data-testid="wedding-book-close"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
    await page.screenshot({ path: join(ROOT, "docs/qa/m45-greeter-390.png") });

    // --- tour for the visual set ---
    console.log("PHASE: tour");
    await seek(page, 456, 904);
    await waitTarget(page, "npc.rsvp_keeper");
    await page.screenshot({ path: join(ROOT, "docs/qa/m45-rsvp-390.png") });
    await seek(page, 440, 728);
    await waitTarget(page, "npc.photographer");
    await page.screenshot({ path: join(ROOT, "docs/qa/m45-photo-390.png") });
    await seek(page, 400, 700);
    await seek(page, 440, 400);
    await seek(page, 392, 200, 30);
    await waitTarget(page, "npc.couple_a");
    await page.screenshot({ path: join(ROOT, "docs/qa/m45-couple-390.png") });

    if (pageLogs.length > 0) fail(`page errors during avatar test: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
    console.log("production textures + feet bodies + 8 anims + dialogue OK");

    // --- width set ---
    const browser2 = await launchBrowser();
    for (const [w, h, name] of [[320, 568, "m45-spawn-320.png"], [360, 740, "m45-spawn-360.png"], [430, 932, "m45-spawn-430.png"]]) {
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
  console.log("M4.5 AVATARS VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
