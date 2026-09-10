// M17 publish E2E: activate through the API, then copy a guest link and
// export the CSV through Studio. No session secrets may leak.
// Prints M17 PUBLISH VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveWranglerJs } from "../resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8795;
const WEB_PORT = 8125;
const BIN = process.platform === "win32" ? ".cmd" : "";
const ADMIN_KEY = "m17-publish-admin-key";
const ROOM_SECRET = "m17-publish-room-secret-0123456789";

const fail = (msg) => { console.error(`M17 publish check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let WRANGLER_JS;
try {
  WRANGLER_JS = resolveWranglerJs();
} catch (e) {
  fail(`wrangler resolve: ${(e && e.message) || e}`);
}

const webRequire = createRequire(join(WEB_DIR, "package.json"));
let chromium;
try {
  ({ chromium } = webRequire("playwright"));
} catch {
  fail("playwright not installed in apps/web");
}

let api = null;
let web = null;
async function stopAll() {
  for (const p of [web, api]) {
    if (p && !p.killed) p.kill();
  }
  await sleep(2000);
}
process.on("exit", () => {
  for (const p of [web, api]) {
    if (p && !p.killed) { try { p.kill("SIGKILL"); } catch { /* noop */ } }
  }
});

async function waitFor(url, timeoutMs = 300000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) fail(`never ready: ${url}`);
    await sleep(3000);
  }
}

function launchBrowser() {
  try {
    return chromium.launch();
  } catch (e) {
    if (!/Executable doesn't exist/i.test(String(e && e.message))) throw e;
    execSync(`"${join(WEB_DIR, "node_modules", ".bin", `playwright${BIN}`)}" install chromium`, {
      cwd: WEB_DIR, stdio: "pipe", timeout: 420000,
    });
    return chromium.launch();
  }
}

async function main() {
  api = spawn(process.execPath, [WRANGLER_JS, "dev", "--port", String(API_PORT),
    "--var", `ROOM_SECRET:${ROOM_SECRET}`, "--var", `ADMIN_KEY:${ADMIN_KEY}`,
    "--var", "ALLOW_DEV_TOKENS:1", "--var", "DEV_MEMORY_STORE:1"], {
    cwd: API_DIR, stdio: "pipe",
  });
  api.on("error", (e) => fail(`could not start api worker: ${e.message}`));
  const nextBinJs = join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
  web = spawn(process.execPath, [nextBinJs, "dev", "-p", String(WEB_PORT)], {
    cwd: WEB_DIR, stdio: "pipe",
  });
  web.on("error", (e) => fail(`could not start web server: ${e.message}`));

  const apiCall = async (path, opts = {}) => {
    const res = await fetch(`http://localhost:${API_PORT}${path}`, opts);
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };
  const H = { "content-type": "application/json", "x-admin-key": ADMIN_KEY };

  try {
    await waitFor(`http://localhost:${API_PORT}/health`);
    await waitFor(`http://localhost:${WEB_PORT}/admin?api=http://localhost:${API_PORT}`);

    const created = await apiCall("/v1/admin/projects", {
      method: "POST", headers: H, body: JSON.stringify({ name: "Publish Probe" }),
    });
    if (created.status !== 201) fail("project create failed");
    const pid = created.body.project.id;

    const browser = await launchBrowser();
    const ctx = await browser.newContext({
      viewport: { width: 1167, height: 843 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
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
    await page.goto(`http://localhost:${WEB_PORT}/admin?api=http://localhost:${API_PORT}`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await page.waitForSelector('[data-testid="admin-page"]', { state: "visible", timeout: 30000 });
    await sleep(800);
    await page.fill('[data-testid="admin-key"]', ADMIN_KEY);
    await sleep(600);
    await tap('[data-testid="admin-reload-projects"]');
    await sleep(800);
    await page.selectOption('[data-testid="admin-active-project"]', pid);
    await sleep(1200);

    await page.fill('[data-testid="admin-guest-name"]', "Budi Publish");
    await sleep(400);
    await tap('[data-testid="admin-guest-add"]');
    await sleep(800);
    const guestText = await page.textContent('[data-testid="admin-guests"]');
    if (!guestText.includes("Budi Publish") || !guestText.includes("/g/gt_")) {
      fail(`guest row missing link: ${guestText}`);
    }
    const guestId = await page.evaluate(() => {
      const li = [...document.querySelectorAll('[data-testid="admin-guests"] li')]
        .find((el) => el.textContent.includes("Budi Publish"));
      const btn = li?.querySelector("button");
      return btn?.getAttribute("data-testid");
    });
    if (!guestId || !guestId.startsWith("admin-copy-")) fail("copy button missing on guest row");
    await tap(`[data-testid="${guestId}"]`);
    await sleep(600);
    const pasted = await page.evaluate(() => window.navigator.clipboard.readText());
    if (!pasted.includes("/g/gt_")) fail(`clipboard link malformed: ${pasted}`);
    if (/session/i.test(pasted)) fail("session secret leaked into guest link");
    const note = await page.textContent('[data-testid="admin-ops-note"]');
    if (!note.includes("disalin")) fail(`copy not confirmed: ${note}`);

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      tap('[data-testid="admin-links-export"]'),
    ]);
    const dlPath = await download.path();
    if (!dlPath) fail("CSV export produced no file");
    const fs = await import("node:fs");
    const csv = fs.readFileSync(dlPath, "utf8");
    const lines = csv.trim().split("\n");
    if (lines[0] !== "name,link") fail(`CSV header wrong: ${lines[0]}`);
    if (!lines.some((l) => l.includes("Budi Publish") && l.includes("/g/gt_"))) {
      fail(`CSV missing guest link: ${csv.slice(0, 200)}`);
    }
    if (/session/i.test(csv)) fail("session secret leaked into CSV export");

    if (logs.length > 0) fail(`page errors: ${logs.join(" | ").slice(0, 400)}`);
    await browser.close();
  } finally {
    await stopAll();
  }
  console.log("M17 PUBLISH VERIFIED");
}

main().catch((e) => fail((e && e.message) || String(e)));
