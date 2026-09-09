// M16.1 guest probe: one bootstrap carrying session, no fixture fallback.
// - invalid token renders the invalid state with a single bootstrap request
// - the URL never gains session/net params from auto-boot
// - home keeps the explicit dev fixture path (onboarding boots)
// Prints M161 GUEST VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8118;
const BIN = process.platform === "win32" ? ".cmd" : "";
const fail = (msg) => { console.error(`M16.1 guest check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mainSrc = readFileSync(join(WEB_DIR, "src/game/main.ts"), "utf8");
if (!mainSrc.includes("fetchBootstrap") || !mainSrc.includes("__weddingSession")) {
  fail("main.ts missing single-flight session bootstrap");
}
if (mainSrc.includes("/v1/session") || mainSrc.includes('set("session"')) {
  fail("main.ts still mints sessions separately or leaks them into the URL");
}

const webRequire = createRequire(join(WEB_DIR, "package.json"));
let chromium;
try {
  ({ chromium } = webRequire("playwright"));
} catch {
  fail("playwright not installed in apps/web");
}

let server = null;
async function stopServer() {
  if (server && !server.killed) {
    server.kill();
    await sleep(1500);
  }
}
process.on("exit", () => { if (server && !server.killed) { try { server.kill("SIGKILL"); } catch { /* noop */ } } });

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) fail(`dev server never ready at ${url}`);
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

async function main() {
  const nextBinJs = join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextBinJs, "dev", "-p", String(PORT)], { cwd: WEB_DIR, stdio: "pipe" });
  server.on("error", (e) => fail(`could not start dev server: ${e.message}`));
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    const browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e && e.message)));
    let bootstrapCalls = 0;
    page.on("request", (req) => {
      if (/\/v1\/guest\//.test(req.url())) bootstrapCalls += 1;
    });
    await page.goto(`http://localhost:${PORT}/g/gt_invalidtoken123`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="guest-invalid"]', { state: "visible", timeout: 30000 });
    await sleep(3000);
    if (bootstrapCalls !== 1) fail(`expected exactly one bootstrap call, saw ${bootstrapCalls}`);
    const url = new URL(page.url());
    if (url.searchParams.has("session") || url.searchParams.has("net")) {
      fail(`guest URL gained plumbing params: ${url.search}`);
    }
    const body = (await page.textContent("body")) ?? "";
    if (/Ayu|Bima|demo-ayu-bima/i.test(body)) fail("invalid guest sees fixture content");
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="onboarding-panel"], #game-container', { state: "visible", timeout: 30000 });
    if (errors.length > 0) fail(`page errors: ${errors.join(" | ").slice(0, 300)}`);
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("M161 GUEST VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
