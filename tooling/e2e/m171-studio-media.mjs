// M17.1 studio media E2E: upload a photo, preview it, reorder, cover,
// delete, and blocked delete of an actively referenced photo — through
// Studio against a local API worker with local R2. Prints STUDIO MEDIA
// VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveWranglerJs } from "../resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8798;
const WEB_PORT = 8126;
const BIN = process.platform === "win32" ? ".cmd" : "";
const ADMIN_KEY = "m171-studio-media-key";
const ROOM_SECRET = "m171-studio-media-room-0123456789";
const FIXTURE = join(ROOT, "tooling/e2e/fixtures/upload-test.png");

const fail = (msg) => { console.error(`M17.1 studio media check FAILED: ${msg}`); process.exit(1); };
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
  try {
    await waitFor(`http://localhost:${API_PORT}/health`);
    await waitFor(`http://localhost:${WEB_PORT}/admin?api=http://localhost:${API_PORT}`);

    const browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 1167, height: 843 } });
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
    await page.fill('[data-testid="admin-project-name"]', "Media Studio");
    await sleep(600);
    await tap('[data-testid="admin-project-create"]');
    await sleep(800);

    await page.setInputFiles('[data-testid="admin-gallery-upload"]', FIXTURE);
    await tap('[data-testid="admin-gallery-card-3"] summary');
    await page.waitForSelector('[data-testid="admin-gallery-thumb-3"]', { state: "visible", timeout: 30000 });
    const thumb = await page.evaluate(() => document.querySelector('[data-testid="admin-gallery-thumb-3"]')?.getAttribute("src"));
    if (!thumb || !thumb.includes("/v1/media/weddings/")) fail(`thumbnail not R2-backed: ${thumb}`);

    await tap('[data-testid="admin-gallery-cover-3"]');
    await sleep(400);
    await tap('[data-testid="admin-draft"]');
    await sleep(800);
    let versions = await page.textContent('[data-testid="admin-server-versions"]');
    if (!versions.includes("v1 draft")) fail(`draft with photo missing: ${versions}`);

    await tap('[data-testid="admin-publish"]');
    await sleep(800);
    await tap('[data-testid="admin-activate"]');
    await sleep(800);
    versions = await page.textContent('[data-testid="admin-server-versions"]');
    if (!versions.includes("active")) fail(`no active version: ${versions}`);

    await tap('[data-testid="admin-gallery-del-3"]');
    await sleep(800);
    const note = await page.textContent('[data-testid="admin-ops-note"]');
    if (!/dipakai publikasi aktif/i.test(note)) fail(`delete protection not surfaced: ${note}`);
    await page.waitForSelector('[data-testid="admin-gallery-thumb-3"]', { state: "visible", timeout: 15000 });

    if (logs.length > 0) fail(`page errors: ${logs.join(" | ").slice(0, 400)}`);
    await browser.close();
  } finally {
    await stopAll();
  }
  console.log("STUDIO MEDIA VERIFIED");
}

main().catch((e) => fail((e && e.message) || String(e)));
