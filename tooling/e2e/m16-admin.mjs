// M16 admin probe: production-backed console keeps the M9 fixture flow green.
// - admin page exposes server sections (key, projects, guests, csv, analytics)
// - M9 core flow still passes: fixture switch, break/fix validation, draft/publish/activate v1
// Prints M16 ADMIN VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8117;
const BIN = process.platform === "win32" ? ".cmd" : "";
const fail = (msg) => { console.error(`M16 admin check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const adminSrc = readFileSync(join(WEB_DIR, "src/pages/admin.tsx"), "utf8");
for (const needle of [
  "/v1/admin/projects",
  "/v1/admin/guests",
  "/v1/admin/guests/import",
  "admin-key",
  "admin-guests",
  "admin-csv",
  "admin-analytics",
  "admin-links-export",
]) {
  if (!adminSrc.includes(needle)) fail(`admin.tsx missing production section: ${needle}`);
}
if (adminSrc.includes("createVersionStore()") === false) fail("admin lost fixture lifecycle (M9 regression)");
for (const legacy of ["admin-pick-", "admin-partner-a", "admin-draft", "admin-publish", "admin-activate", "admin-versions", "admin-export"]) {
  if (!adminSrc.includes(legacy)) fail(`admin lost M9 testid: ${legacy}`);
}
if (adminSrc.includes("DEMO_PUBLICATION") === false && adminSrc.includes("DEMO_PUBLICATION_DATA") === false) {
  fail("admin lost fixture config editor");
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
    for (const sel of [
      '[data-testid="admin-key"]',
      '[data-testid="admin-reload-projects"]',
      '[data-testid="admin-guest-name"]',
      '[data-testid="admin-csv"]',
      '[data-testid="admin-import"]',
      '[data-testid="admin-analytics-reload"]',
    ]) {
      await page.waitForSelector(sel, { state: "visible", timeout: 15000 });
    }
    const valid0 = await page.textContent('[data-testid="admin-validation"]');
    if (!valid0.includes("VALID")) fail(`admin should start valid: ${valid0}`);
    await tap('[data-testid="admin-pick-raka-naya"]');
    await sleep(500);
    const valid1 = await page.textContent('[data-testid="admin-validation"]');
    if (!valid1.includes("raka-naya")) fail(`fixture switch lost: ${valid1}`);
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
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) fail(`admin horizontal overflow: ${overflow}px`);
    if (logs.length > 0) fail(`page errors: ${logs.join(" | ").slice(0, 300)}`);
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("M16 ADMIN VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
