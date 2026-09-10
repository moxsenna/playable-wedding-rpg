// M17 preview E2E: a draft plays through /g/preview/<token> while the
// active publication stays untouched. Prints M17 PREVIEW VERIFIED.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { resolveWranglerJs } from "../resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8794;
const WEB_PORT = 8124;
const BIN = process.platform === "win32" ? ".cmd" : "";
const ADMIN_KEY = "m17-preview-admin-key";
const ROOM_SECRET = "m17-preview-room-secret-0123456789";

const fail = (msg) => { console.error(`M17 preview check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let WRANGLER_JS;
try {
  WRANGLER_JS = resolveWranglerJs();
} catch (e) {
  fail(`wrangler resolve: ${(e && e.message) || e}`);
}

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
const ts = gameRequire("typescript");

function loadFixtures() {
  const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m17prev-"));
  try {
    for (const [dir, name] of [
      ["packages/contracts/src", "shared"],
      ["packages/contracts/src", "npc"],
      ["packages/contracts/src", "publication"],
      ["packages/contracts/src", "quest"],
      ["apps/web/src/weddings", "select"],
      ["apps/web/src/weddings", "raka-naya"],
      ["apps/web/src/weddings", "arvin-selena"],
      ["apps/web/src/weddings", "demo-publication"],
      ["apps/web/src/weddings", "demo-bindings"],
    ]) {
      const src = readFileSync(join(ROOT, dir, `${name}.ts`), "utf8");
      writeFileSync(join(tmp, `${name}.js`), ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      }).outputText);
    }
    const shimDir = join(tmp, "node_modules", "@wedding-rpg", "contracts");
    mkdirSync(shimDir, { recursive: true });
    writeFileSync(join(shimDir, "package.json"), JSON.stringify({ name: "@wedding-rpg/contracts", main: "index.js" }));
    writeFileSync(join(shimDir, "index.js"),
      `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../npc.js"), require("../../../publication.js"), require("../../../quest.js"));`);
    const req = createRequire(join(tmp, "x.js"));
    const demoPub = req(join(tmp, "demo-publication.js"));
    const demoBind = req(join(tmp, "demo-bindings.js"));
    return {
      publication: JSON.parse(JSON.stringify(demoPub.DEMO_PUBLICATION_DATA)),
      bindings: JSON.parse(JSON.stringify(demoBind.DEMO_NPC_BINDINGS_DATA)),
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
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

const hook = (page, fn, arg) => page.evaluate(fn, arg);
const teleport = (page, x, y) => hook(page, (a) => window.__wedding.debugTeleport(a.x, a.y), { x, y });
const pos = (page) => hook(page, () => ({ x: window.__wedding.player.sprite.x, y: window.__wedding.player.sprite.y }));
const targetId = (page) => hook(page, () => window.__wedding.targetId());

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

async function seek(page, tx, ty, timeoutMs = 30000, arrivePx = 40) {
  const g = await hook(page, () => window.__wedding.input.geometry());
  await page.mouse.move(g.stick.x, g.stick.y);
  await page.mouse.down();
  const start = Date.now();
  try {
    for (;;) {
      const p = await pos(page);
      const dx = tx - p.x, dy = ty - p.y;
      if (Math.hypot(dx, dy) < arrivePx) return p;
      if (Date.now() - start > timeoutMs) fail(`seek to (${tx},${ty}) timed out`);
      const len = Math.hypot(dx, dy);
      await page.mouse.move(g.stick.x + (dx / len) * 44, g.stick.y + (dy / len) * 44, { steps: 6 });
      await sleep(350);
    }
  } finally {
    await page.mouse.up();
  }
}

async function waitTarget(page, id, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    if ((await targetId(page)) === id) return;
    if (Date.now() - start > timeoutMs) fail(`never targeted ${id}`);
    await sleep(300);
  }
}

async function main() {
  const { publication, bindings } = loadFixtures();
  publication.couple.partnerA = "Ayu Preview";
  publication.couple.partnerB = "Bima Preview";

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
    await waitFor(`http://localhost:${WEB_PORT}/`);

    const created = await apiCall("/v1/admin/projects", {
      method: "POST", headers: H, body: JSON.stringify({ name: "Preview Probe" }),
    });
    if (created.status !== 201) fail("project create failed");
    const pid = created.body.project.id;

    const draft = await apiCall("/v1/admin/draft", {
      method: "POST", headers: H,
      body: JSON.stringify({ projectId: pid, publicationId: pid, snapshot: { publication, npcBindings: bindings } }),
    });
    if (draft.status !== 200) fail("draft failed");

    const preview = await apiCall("/v1/admin/preview", {
      method: "POST", headers: H, body: JSON.stringify({ versionId: draft.body.version.id }),
    });
    if (preview.status !== 200) fail("preview token mint failed");
    const token = preview.body.previewToken;

    const prod = await apiCall(`/v1/publication?project=${pid}&publication=${pid}`);
    if (prod.status !== 404) fail(`production must stay empty, got ${prod.status}`);

    const browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await prepPage(page);
    const pageLogs = [];
    page.on("pageerror", (e) => pageLogs.push(`[pageerror] ${e && e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "PreviewGuest", avatarId: "guest_01" }));
    });
    await page.goto(`http://localhost:${WEB_PORT}/g/preview/${token}?api=http://localhost:${API_PORT}`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await page.waitForSelector('[data-testid="guest-preview-badge"]', { state: "visible", timeout: 60000 });
    await page.waitForFunction(() => !!window.__wedding?.player, null, { timeout: 120000 });
    await sleep(1000);

    await page.click('[data-testid="wedding-book-open"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    const couple = await page.textContent('[data-testid="book-couple"]');
    if (!couple.includes("Preview")) fail(`preview book shows wrong couple: ${couple}`);
    await page.click('[data-testid="wedding-book-close"]');

    await teleport(page, 392, 1112 + 48);
    await seek(page, 392, 1112 + 16, 30000, 30);
    await waitTarget(page, "npc.greeter");
    await page.keyboard.press("e");
    await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });

    const prodAfter = await apiCall(`/v1/publication?project=${pid}&publication=${pid}`);
    if (prodAfter.status !== 404) fail("preview play activated production");

    if (pageLogs.length > 0) fail(`page errors: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
  } finally {
    await stopAll();
  }
  console.log("M17 PREVIEW VERIFIED");
}

main().catch((e) => fail((e && e.message) || String(e)));
