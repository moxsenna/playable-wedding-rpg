// M16 guest probe: clean /g/:token route + runtime binding in a real browser.
// - bad token renders the invalid state (no query plumbing, no crash)
// - home still boots the fixture world (no regression)
// - main.ts resolves bootstrap bindings instead of fixture-only import
// Prints M16 GUEST VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8116;
const BIN = process.platform === "win32" ? ".cmd" : "";
const fail = (msg) => { console.error(`M16 guest check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mainSrc = readFileSync(join(WEB_DIR, "src/game/main.ts"), "utf8");
if (!mainSrc.includes("fetchBootstrap") || !mainSrc.includes("guestTokenFromPath")) {
  fail("main.ts still fixture-only (no guest bootstrap)");
}
if (mainSrc.includes("/v1/session")) fail("main.ts mints sessions outside the single bootstrap");
const bookSrc = readFileSync(join(WEB_DIR, "src/components/wedding-book.tsx"), "utf8");
if (bookSrc.includes('from "../weddings/demo-publication"')) fail("wedding-book still imports DEMO fixture");
if (!bookSrc.includes("useRuntimeWedding")) fail("wedding-book missing runtime binding");
const guestSrc = readFileSync(join(WEB_DIR, "src/pages/g/[token].tsx"), "utf8");
if (!guestSrc.includes("fetchBootstrap")) fail("guest page missing bootstrap fetch");

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
    await waitForServer(`http://localhost:${PORT}/demo`);
    const browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e && e.message)));
    await page.goto(`http://localhost:${PORT}/g/gt_invalidtoken123`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="guest-invalid"], [data-testid="guest-loading"]', { state: "visible", timeout: 30000 });
    await sleep(6000);
    const body = (await page.textContent("body")) ?? "";
    if (!/tidak valid|Membuka undangan/i.test(body)) fail(`guest route copy missing: ${body.slice(0, 200)}`);
    if (/projectId|publicationId|manifestRef|session token|API URL/i.test(body)) fail("guest leaks technical concepts");
    await page.goto(`http://localhost:${PORT}/demo`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(4000);
    if (errors.length > 0) fail(`page errors: ${errors.join(" | ").slice(0, 300)}`);
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("M16 GUEST VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
