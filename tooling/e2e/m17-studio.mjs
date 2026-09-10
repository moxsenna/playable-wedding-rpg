// M17 studio E2E: create wedding, edit couple/event/NPC/hearts, save
// draft, publish, activate, and mint a resolving preview token — all
// through YUTEMU Studio against a local API worker. Prints M17 STUDIO
// VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveWranglerJs } from "../resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8792;
const WEB_PORT = 8123;
const BIN = process.platform === "win32" ? ".cmd" : "";
const ADMIN_KEY = "m17-studio-admin-key";
const ROOM_SECRET = "m17-studio-room-secret-0123456789";

const fail = (msg) => { console.error(`M17 studio check FAILED: ${msg}`); process.exit(1); };
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
    await page.goto(`http://localhost:${WEB_PORT}/admin?api=http://localhost:${API_PORT}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="admin-page"]', { state: "visible", timeout: 30000 });
    await sleep(800);

    await page.fill('[data-testid="admin-key"]', ADMIN_KEY);
    await page.fill('[data-testid="admin-project-name"]', "Studio Uno");
    await sleep(600);
    await tap('[data-testid="admin-project-create"]');
    await sleep(800);
    let note = await page.textContent('[data-testid="admin-ops-note"]');
    if (!note.includes("draft")) fail(`project create not confirmed: ${note}`);
    const selected = await page.evaluate(() => document.querySelector('[data-testid="admin-active-project"]').value);
    if (!selected) fail("new project not selected");

    await page.fill('[data-testid="admin-partner-a"]', "Ayu Studio");
    await sleep(600);
    const valid = await page.textContent('[data-testid="admin-validation"]');
    if (!valid.includes("VALID")) fail(`edited couple should validate: ${valid}`);

    await tap('[data-testid="admin-draft"]');
    await sleep(800);
    let serverVersions = await page.textContent('[data-testid="admin-server-versions"]');
    if (!serverVersions.includes("v1 draft")) fail(`server draft missing: ${serverVersions}`);

    await tap('[data-testid="admin-npc-npc.greeter"] summary');
    await sleep(300);
    await page.fill('[data-testid="admin-npc-name-npc.greeter"]', "Sari Studio");
    await page.selectOption('[data-testid="admin-heart-heart.first_meeting"]', "npc.story_keeper");
    await sleep(400);
    const hearts = await page.textContent('[data-testid="admin-hearts-state"]');
    if (!hearts.includes("Lengkap")) fail(`hearts incomplete after move: ${hearts}`);
    await tap('[data-testid="admin-draft"]');
    await sleep(800);
    serverVersions = await page.textContent('[data-testid="admin-server-versions"]');
    if (!serverVersions.includes("v2 draft")) fail(`second draft missing: ${serverVersions}`);

    await tap('[data-testid="admin-event-add"]');
    await sleep(400);
    await tap('[data-testid="admin-draft"]');
    await sleep(800);

    await tap('[data-testid="admin-publish"]');
    await sleep(800);
    await tap('[data-testid="admin-activate"]');
    await sleep(800);
    serverVersions = await page.textContent('[data-testid="admin-server-versions"]');
    if (!serverVersions.includes("active")) fail(`no active version: ${serverVersions}`);

    await tap('[data-testid="admin-preview-make"]');
    await sleep(800);
    const previewHref = await page.evaluate(() => document.querySelector('[data-testid="admin-preview-link"]')?.getAttribute("href"));
    if (!previewHref || !previewHref.includes("/g/preview/")) fail(`preview link missing: ${previewHref}`);
    const previewToken = previewHref.split("/g/preview/")[1];
    const previewRes = await fetch(`http://localhost:${API_PORT}/v1/preview/${previewToken}`);
    if (!previewRes.ok) fail(`preview token does not resolve: ${previewRes.status}`);
    const previewBody = await previewRes.json();
    if (previewBody.snapshot?.publication?.couple?.partnerA !== "Ayu Studio") {
      fail("preview does not carry draft data");
    }

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="admin-page"]', { state: "visible", timeout: 30000 });
    await sleep(800);
    await page.fill('[data-testid="admin-key"]', ADMIN_KEY);
    await sleep(600);
    await tap('[data-testid="admin-reload-projects"]');
    await sleep(800);
    await page.selectOption('[data-testid="admin-active-project"]', selected);
    await sleep(1200);
    serverVersions = await page.textContent('[data-testid="admin-server-versions"]');
    if (!serverVersions.includes("active")) fail(`state lost after reload: ${serverVersions}`);

    if (logs.length > 0) fail(`page errors: ${logs.join(" | ").slice(0, 400)}`);
    await browser.close();
  } finally {
    await stopAll();
  }
  console.log("M17 STUDIO VERIFIED");
}

main().catch((e) => fail((e && e.message) || String(e)));
