// M1 movement probe: proves keyboard input moves the local player inside a
// real browser against a real dev server. Self-contained: starts `next dev`,
// drives ArrowUp/ArrowRight via Playwright, asserts world-space displacement
// read from the dev-only probe hook, saves a screenshot, then cleans up.
// Prints M1 MOVEMENT VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8101;
// The guest experience lives at /demo; `/` is the marketing landing page.
const URL = `http://localhost:${PORT}/demo`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M1 movement check FAILED: ${msg}`); process.exit(1); };
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
    if (!server.killed) {
      try {
        execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*next-server*' -and $_.CommandLine -like '*${PORT}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`);
      } catch { /* best effort */ }
    }
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

const pos = (page) =>
  page.evaluate(() => {
    const w = window.__wedding;
    if (!w || !w.player) return null;
    return {
      x: w.player.sprite.x,
      y: w.player.sprite.y,
      anim: w.player.sprite.anims?.currentAnim?.key ?? "(none)",
    };
  });

async function main() {
  // Invoke node directly on the Next bin: spawning a Windows `.cmd` with
  // shell:false fails with EINVAL, and shell:true complicates cleanup.
  const nextBinJs = join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextBinJs, "dev", "-p", String(PORT)], {
    cwd: WEB_DIR,
    stdio: "pipe",
  });
  server.on("error", (e) => fail(`could not start dev server: ${e.message}`));
  const serverLog = [];
  server.stdout?.on("data", (d) => serverLog.push(String(d)));
  server.stderr?.on("data", (d) => serverLog.push(String(d)));
  const dumpDiagnostics = (pageLogs) => {
    console.error("--- browser console (last 30) ---");
    for (const l of pageLogs.slice(-30)) console.error(l);
    console.error("--- dev server log (last 30) ---");
    for (const l of serverLog.join("").split("\n").slice(-30)) console.error(l);
  };
  try {
    await waitForServer();

    let browser;
    try {
      browser = await chromium.launch();
    } catch (e) {
      if (!/Executable doesn't exist/i.test(String(e && e.message))) throw e;
      // Missing browser build: install exactly what this playwright version wants.
      execSync(
        `"${join(WEB_DIR, "node_modules", ".bin", `playwright${BIN}`)}" install chromium`,
        { cwd: WEB_DIR, stdio: "pipe", timeout: 420000 }
      );
      browser = await chromium.launch();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageLogs = [];
    page.on("console", (m) => pageLogs.push(`[${m.type()}] ${m.text()}`));
    page.on("pageerror", (e) => pageLogs.push(`[pageerror] ${e && e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
    });
    try {
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      try {
        await page.waitForFunction(() => !!window.__wedding?.player, null, { timeout: 60000 });
      } catch (e) {
        dumpDiagnostics(pageLogs);
        fail(`probe hook never appeared: ${e && e.message}`);
      }
      await sleep(800); // let physics settle

      const p0 = await pos(page);
      if (!p0) fail("probe hook exposed no player");
      if (!(p0.x > 0 && p0.x < 896 && p0.y > 0 && p0.y < 1280))
        fail(`spawn out of world bounds: ${p0.x},${p0.y}`);

      await page.keyboard.down("ArrowUp");
      await sleep(900);
      const mid = await pos(page);
      await page.keyboard.up("ArrowUp");
      const p1 = await pos(page);
      if (!mid || !p1) fail("lost probe hook mid-test");
      if (!/walk/i.test(mid.anim)) fail(`expected walk anim while moving, saw: ${mid.anim}`);
      const dy = p0.y - p1.y;
      if (!(dy > 40)) fail(`ArrowUp moved only ${dy.toFixed(1)}px (need >40): ${p0.y} -> ${p1.y}`);

      await page.keyboard.down("ArrowRight");
      await sleep(900);
      await page.keyboard.up("ArrowRight");
      const p2 = await pos(page);
      if (!p2) fail("lost probe hook mid-test");
      const dx = p2.x - p1.x;
      if (!(dx > 40)) fail(`ArrowRight moved only ${dx.toFixed(1)}px (need >40): ${p1.x} -> ${p2.x}`);
      if (!(p2.x >= 0 && p2.x <= 896 && p2.y >= 0 && p2.y <= 1280))
        fail(`player left world bounds: ${p2.x},${p2.y}`);

      await page.screenshot({ path: join(ROOT, "docs/qa/m1-move.png") });
      console.log(
        `moved up ${dy.toFixed(0)}px then right ${dx.toFixed(0)}px ` +
        `(${p0.x.toFixed(0)},${p0.y.toFixed(0)} -> ${p2.x.toFixed(0)},${p2.y.toFixed(0)})`
      );
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer();
  }
  console.log("M1 MOVEMENT VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
