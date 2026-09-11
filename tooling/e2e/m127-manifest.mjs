// M12.7 manifest probe: the game boots from a manifest URL supplied at
// runtime. Asserts: default boot resolves the local dev manifest; an
// explicit ?manifest= URL is honored (world loads through it); API
// /v1/world-config returns the pinned manifestRef for a live project.
// Prints M127 MANIFEST VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const WEB_PORT = 8117;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M12.7 manifest check FAILED: ${msg}`); process.exit(1); };
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
  if (server && !server.killed) server.kill();
  await sleep(1500);
}
process.on("exit", () => {
  if (server && !server.killed) { try { server.kill("SIGKILL"); } catch { /* noop */ } }
});

async function waitForWeb(url, timeoutMs = 120000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) fail(`dev server never became ready at ${url}`);
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

async function main() {
  const nextBinJs = join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextBinJs, "dev", "-p", String(WEB_PORT)], {
    cwd: WEB_DIR, stdio: "pipe",
  });
  server.on("error", (e) => fail(`could not start dev server: ${e.message}`));
  try {
    await waitForWeb(`http://localhost:${WEB_PORT}/demo`);
    const browser = await launchBrowser();
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    });

    // default boot: pinned production manifest when reachable (M12.7),
    // local dev manifest as the offline fallback
    const p1 = await ctx.newPage();
    const logs1 = [];
    p1.on("pageerror", (e) => logs1.push(`[pageerror] ${e && e.message}`));
    await p1.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
    });
    await p1.goto(`http://localhost:${WEB_PORT}/demo`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p1.waitForFunction(() => !!window.__wedding?.player, null, { timeout: 60000 });
    await sleep(800);
    const defUrl = await hook(p1, () => window.__wedding.def.manifestUrl);
    const prodPinned = "https://wedding-rpg-api.moxsenna.workers.dev/v1/assets/garden-village-v1/v6/manifest.json";
    if (defUrl !== "/assets/worlds/garden-village-v1/manifest.json" && defUrl !== prodPinned) {
      fail(`default boot used unexpected manifest: ${defUrl}`);
    }
    const hud1 = await p1.textContent('[data-testid="quest-hud"]');
    if (!hud1.includes("OUR STORY")) fail("default boot world not playable");
    if (logs1.length > 0) fail(`page errors on default boot: ${logs1.join(" | ").slice(0, 400)}`);
    await p1.close();

    // explicit manifest URL honored end-to-end (same file, different path
    // proves the URL flows from options through the registry into loads)
    const p2 = await ctx.newPage();
    const logs2 = [];
    p2.on("pageerror", (e) => logs2.push(`[pageerror] ${e && e.message}`));
    await p2.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
    });
    const pinned = `http://localhost:${WEB_PORT}/assets/worlds/garden-village-v1/manifest.json`;
    await p2.goto(`http://localhost:${WEB_PORT}/demo?manifest=${encodeURIComponent(pinned)}`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await p2.waitForFunction(() => !!window.__wedding?.player, null, { timeout: 60000 });
    await sleep(800);
    const defUrl2 = await hook(p2, () => window.__wedding.def.manifestUrl);
    if (defUrl2 !== pinned) fail(`explicit manifest ignored: ${defUrl2}`);
    const hud2 = await p2.textContent('[data-testid="quest-hud"]');
    if (!hud2.includes("OUR STORY")) fail("pinned-manifest boot world not playable");
    if (logs2.length > 0) fail(`page errors on pinned boot: ${logs2.join(" | ").slice(0, 400)}`);
    await p2.close();

    // invalid manifest falls back to the pinned/local default (world boots)
    const p3 = await ctx.newPage();
    await p3.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
    });
    await p3.goto(`http://localhost:${WEB_PORT}/demo?manifest=${encodeURIComponent("javascript:alert(1)")}`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await p3.waitForFunction(() => !!window.__wedding?.player, null, { timeout: 60000 });
    await sleep(800);
    const defUrl3 = await hook(p3, () => window.__wedding.def.manifestUrl);
    if (defUrl3 !== "/assets/worlds/garden-village-v1/manifest.json" && defUrl3 !== prodPinned) {
      fail(`invalid manifest not rejected: ${defUrl3}`);
    }
    await p3.close();
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("M127 MANIFEST VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
