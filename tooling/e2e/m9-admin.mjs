// M9 admin probe: the RPG config page in a real mobile browser. Asserts:
//   fixture picker switches weddings (validation stays green)
//   editing a couple name keeps validation green; clearing it fails loudly
//   draft -> publish -> activate lifecycle reaches active v1
//   export produces a JSON download with publication + npcBindings
// Prints M9 ADMIN VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const PORT = 8110;
const URL = `http://localhost:${PORT}/admin`;
const BIN = process.platform === "win32" ? ".cmd" : "";

const fail = (msg) => { console.error(`M9 admin check FAILED: ${msg}`); process.exit(1); };
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

async function prepPage(page) {
  const origClick = page.click.bind(page);
  page.click = async (selector, options) => {
    if (typeof selector === "string" && selector.startsWith("[data-testid")) {
      await page.waitForSelector(selector, { state: "visible", timeout: 15000 });
      const pt = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
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
    await page.waitForSelector('[data-testid="admin-page"]', { state: "visible", timeout: 30000 });
    await sleep(1000);

    const valid0 = await page.textContent('[data-testid="admin-validation"]');
    if (!valid0.includes("VALID")) fail(`admin should start valid: ${valid0}`);

    // switch fixture: validation stays green, NPC roster changes
    await page.click('[data-testid="admin-pick-raka-naya"]');
    await sleep(500);
    const valid1 = await page.textContent('[data-testid="admin-validation"]');
    if (!valid1.includes("raka-naya")) fail(`fixture switch not reflected: ${valid1}`);
    const tania = await page.waitForSelector('[data-testid="admin-npc-npc.greeter"]', { state: "visible", timeout: 15000 });
    if (!((await tania.textContent()) ?? "").includes("Tania")) fail("raka greeter missing");

    // edit couple name: stays valid
    await page.fill('[data-testid="admin-partner-a"]', "Raka Aditya Pratama");
    await sleep(500);
    const valid2 = await page.textContent('[data-testid="admin-validation"]');
    if (!valid2.includes("VALID")) fail(`edited name should stay valid: ${valid2}`);

    // break it loudly: empty name fails validation, draft/export lock
    await page.fill('[data-testid="admin-partner-a"]', "");
    await sleep(500);
    const invalid = await page.textContent('[data-testid="admin-validation"]');
    if (invalid.includes("VALID") || !invalid.includes("masalah")) fail(`empty name must fail: ${invalid}`);
    if (await page.isEnabled('[data-testid="admin-draft"]')) fail("draft must lock while invalid");
    if (await page.isEnabled('[data-testid="admin-export"]')) fail("export must lock while invalid");
    await page.fill('[data-testid="admin-partner-a"]', "Raka Aditya");
    await sleep(500);

    // lifecycle: draft -> publish -> activate
    await page.click('[data-testid="admin-draft"]');
    await sleep(400);
    await page.click('[data-testid="admin-publish"]');
    await sleep(400);
    await page.click('[data-testid="admin-activate"]');
    await sleep(400);
    const versions = await page.textContent('[data-testid="admin-versions"]');
    if (!versions.includes("v1 active")) fail(`lifecycle did not reach active v1: ${versions}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m9-admin-390.png") });

    // export downloads the instance JSON
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.click('[data-testid="admin-export"]'),
    ]);
    const path = await download.path();
    if (!path) fail("export download missing");
    const fs = await import("node:fs");
    const json = JSON.parse(fs.readFileSync(path, "utf8"));
    if (!json.publication || !Array.isArray(json.npcBindings) || json.npcBindings.length !== 10) {
      fail("exported instance malformed");
    }
    if (json.publication.couple.partnerA !== "Raka Aditya") fail("export does not carry the edit");

    if (pageLogs.length > 0) fail(`page errors during admin test: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
  } finally {
    await stopServer();
  }
  console.log("M9 ADMIN VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
