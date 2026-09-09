// M16.1 admin probe: server-first lifecycle wiring with the keyless
// dry-run intact (M9 flow still reaches v1 active in a real browser).
// Prints M161 ADMIN VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8119;
const BIN = process.platform === "win32" ? ".cmd" : "";
const fail = (msg) => { console.error(`M16.1 admin check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const adminSrc = readFileSync(join(WEB_DIR, "src/pages/admin.tsx"), "utf8");
if (!adminSrc.includes("serverConfigured")) fail("admin missing explicit server/dry-run split");
if (!adminSrc.includes("/v1/admin/versions")) fail("admin never reads server versions");
if (!adminSrc.includes("Tidak ada draft server") || !adminSrc.includes("Tidak ada versi published")) {
  fail("server lifecycle lacks explicit empty states");
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
    const URL = `http://localhost:${PORT}/admin`;
    await waitForServer(URL);
    const browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const tap = async (sel) => {
      await page.waitForSelector(sel, { state: "visible", timeout: 15000 });
      await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) throw new Error(`missing ${s}`);
        el.scrollIntoView({ block: "center" });
        el.click();
      }, sel);
    };
    const logs = [];
    page.on("pageerror", (e) => logs.push(String(e && e.message)));
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="admin-page"]', { state: "visible", timeout: 30000 });
    await sleep(800);
    const heading = await page.textContent('[aria-label="Publikasi"] h2');
    if (!heading.includes("(dry-run)")) fail(`keyless admin must label the dry-run mode: ${heading}`);
    const valid0 = await page.textContent('[data-testid="admin-validation"]');
    if (!valid0.includes("VALID")) fail(`admin should start valid: ${valid0}`);
    await tap('[data-testid="admin-pick-raka-naya"]');
    await sleep(500);
    await page.fill('[data-testid="admin-partner-a"]', "");
    await sleep(400);
    const invalid = await page.textContent('[data-testid="admin-validation"]');
    if (invalid.includes("VALID")) fail("empty name must fail validation");
    await page.fill('[data-testid="admin-partner-a"]', "Raka Aditya");
    await sleep(400);
    await tap('[data-testid="admin-draft"]');
    await sleep(300);
    await tap('[data-testid="admin-publish"]');
    await sleep(300);
    await tap('[data-testid="admin-activate"]');
    await sleep(300);
    const versions = await page.textContent('[data-testid="admin-versions"]');
    if (!versions.includes("v1 active")) fail(`lifecycle did not reach v1 active: ${versions}`);
    if (logs.length > 0) fail(`page errors: ${logs.join(" | ").slice(0, 300)}`);
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("M161 ADMIN VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
