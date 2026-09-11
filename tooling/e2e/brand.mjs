// YUTEMU browser probe: branded shell across mobile and desktop widths.
// Prints BRAND BROWSER VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8121;
const BIN = process.platform === "win32" ? ".cmd" : "";
const fail = (msg) => { console.error(`Brand browser check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

    // The brand surface is now two routes: `/` is the marketing landing page and
    // `/demo` is where a guest actually enters. Both must carry YUTEMU identity,
    // so both are checked rather than moving the old assertions to one of them.
    const mobile = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
    const logs = [];
    mobile.on("pageerror", (e) => logs.push(String(e && e.message)));

    await mobile.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const title = await mobile.title();
    if (!title.includes("YUTEMU")) fail(`home title not YUTEMU: ${title}`);
    await sleep(1200);
    const homeText = (await mobile.textContent("body")) ?? "";
    if (!homeText.includes("YUTEMU")) fail("landing page missing YUTEMU identity");
    if ((await mobile.evaluate(() => document.querySelectorAll("#boot-splash").length)) !== 0) {
      fail("boot splash stuck on home");
    }
    const iconHref = await mobile.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute("href"));
    if (!iconHref || !iconHref.includes("brand/")) fail(`favicon not YUTEMU: ${iconHref}`);
    await mobile.screenshot({ path: join(ROOT, "docs/qa/brand-home-390.png") });
    const overflowMobile = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflowMobile > 1) fail(`home horizontal overflow: ${overflowMobile}px`);

    await mobile.goto(`http://localhost:${PORT}/demo`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mobile.waitForSelector('[data-testid="onboarding-panel"]', { state: "visible", timeout: 60000 });
    await sleep(500);
    if ((await mobile.evaluate(() => document.querySelectorAll("#boot-splash").length)) !== 0) {
      fail("boot splash stuck on the guest entry");
    }
    const onboarding = (await mobile.textContent('[data-testid="onboarding-panel"]')) ?? "";
    if (!onboarding.includes("YUTEMU")) fail("onboarding missing YUTEMU identity");
    const overflowDemo = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflowDemo > 1) fail(`guest entry horizontal overflow: ${overflowDemo}px`);

    const desktop = await (await browser.newContext({ viewport: { width: 1167, height: 743 } })).newPage();
    desktop.on("pageerror", (e) => logs.push(String(e && e.message)));
    await desktop.goto(`http://localhost:${PORT}/admin`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await desktop.waitForSelector('[data-testid="admin-page"]', { state: "visible", timeout: 30000 });
    await sleep(800);
    const h1 = await desktop.textContent('[data-testid="admin-page"] h1');
    if (!h1.includes("YUTEMU Studio")) fail(`admin not YUTEMU Studio: ${h1}`);
    await desktop.screenshot({ path: join(ROOT, "docs/qa/brand-admin-1167.png") });
    const overflowAdmin = await desktop.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflowAdmin > 1) fail(`admin horizontal overflow: ${overflowAdmin}px`);

    if (logs.length > 0) fail(`page errors: ${logs.join(" | ").slice(0, 300)}`);
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("BRAND BROWSER VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
