// M17 envelope E2E: draft -> publish -> activate an envelope snapshot on a
// local API worker, then play it in a real browser through /g/:token.
// Modified couple names prove every surface reads server data, never the
// fixture. Prints M17 ENVELOPE VERIFIED only when every assertion passes.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { resolveWranglerJs } from "../resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8791;
const WEB_PORT = 8122;
const BIN = process.platform === "win32" ? ".cmd" : "";
const ADMIN_KEY = "m17-local-admin-key";
const ROOM_SECRET = "m17-local-room-secret-0123456789";

const fail = (msg) => { console.error(`M17 envelope check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let WRANGLER_JS;
try {
  WRANGLER_JS = resolveWranglerJs();
} catch (e) {
  fail(`wrangler resolve: ${(e && e.message) || e}`);
}

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

function loadFixtures() {
  const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m17env-"));
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
      const out = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      });
      writeFileSync(join(tmp, `${name}.js`), out.outputText);
    }
    const shimDir = join(tmp, "node_modules", "@wedding-rpg", "contracts");
    mkdirSync(shimDir, { recursive: true });
    writeFileSync(join(shimDir, "package.json"), JSON.stringify({ name: "@wedding-rpg/contracts", main: "index.js" }));
    writeFileSync(
      join(shimDir, "index.js"),
      `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../npc.js"), require("../../../publication.js"), require("../../../quest.js"));`
    );
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

const apiCall = async (path, opts = {}) => {
  const res = await fetch(`http://localhost:${API_PORT}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};
const adminHeaders = { "content-type": "application/json", "x-admin-key": ADMIN_KEY };

const hook = (page, fn, arg) => page.evaluate(fn, arg);
const teleport = (page, x, y) => hook(page, (a) => window.__wedding.debugTeleport(a.x, a.y), { x, y });
const questState = (page) => hook(page, () => window.__wedding.questState());
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

async function closeBookIfOpen(page) {
  const open = await page.evaluate(() => !!document.querySelector('[data-testid="wedding-book"]'));
  if (!open) return;
  await page.click('[data-testid="wedding-book-close"]');
  await page.waitForSelector('[data-testid="wedding-book"]', { state: "hidden", timeout: 15000 });
}

async function talkThrough(page, tx, ty, slotId, clicks) {
  await teleport(page, tx, ty + 48);
  await seek(page, tx, ty + 16, 30000, 30);
  await waitTarget(page, slotId);
  await page.keyboard.press("e");
  await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "visible", timeout: 15000 });
  for (let i = 0; i < clicks; i++) {
    await page.click('[data-testid="dialogue-continue"]');
    await sleep(500);
    await closeBookIfOpen(page);
    await sleep(200);
  }
  await page.waitForSelector('[data-testid="dialogue-panel"]', { state: "hidden", timeout: 15000 });
}

async function main() {
  const { publication, bindings } = loadFixtures();
  publication.couple.partnerA = "Ayu Kirana";
  publication.couple.partnerB = "Bima Sakti";

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
    await waitFor(`http://localhost:${WEB_PORT}/`);

    const created = await apiCall("/v1/admin/projects", {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "Env Studio" }),
    });
    if (created.status !== 201) fail(`project create failed: ${JSON.stringify(created.body)}`);
    const projectId = created.body.project.id;

    const draft = await apiCall("/v1/admin/draft", {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ projectId, publicationId: projectId, snapshot: { publication, npcBindings: bindings } }),
    });
    if (draft.status !== 200) fail(`draft failed: ${JSON.stringify(draft.body)}`);

    const published = await apiCall("/v1/admin/publish", {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ versionId: draft.body.version.id }),
    });
    if (published.status !== 200) fail(`publish failed: ${JSON.stringify(published.body)}`);

    const activated = await apiCall("/v1/admin/activate", {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ versionId: draft.body.version.id }),
    });
    if (activated.status !== 200) fail(`activate failed: ${JSON.stringify(activated.body)}`);

    const live = await apiCall(`/v1/admin/projects/${projectId}`, {
      method: "PATCH", headers: adminHeaders, body: JSON.stringify({ status: "live" }),
    });
    if (live.status !== 200) fail(`go-live failed: ${JSON.stringify(live.body)}`);

    const pub = await apiCall(`/v1/publication?project=${projectId}&publication=${projectId}`);
    if (pub.status !== 200) fail("active publication unreadable");
    if (!Array.isArray(pub.body.snapshot?.npcBindings) || pub.body.snapshot.npcBindings.length !== 10) {
      fail("bindings missing from persisted snapshot");
    }

    const minted = await apiCall("/v1/dev/guests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, name: "EnvGuest" }),
    });
    if (minted.status !== 200) fail("dev guest mint failed");
    const token = minted.body.guest.token;

    const boot = await apiCall(`/v1/guest/${token}`);
    if (boot.status !== 200) fail(`bootstrap failed: ${JSON.stringify(boot.body)}`);
    if (!Array.isArray(boot.body.publication?.snapshot?.npcBindings) || boot.body.publication.snapshot.npcBindings.length !== 10) {
      fail("bindings missing from bootstrap");
    }
    if (!boot.body.session) fail("bootstrap carries no session");

    const browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await prepPage(page);
    const pageLogs = [];
    page.on("pageerror", (e) => pageLogs.push(`[pageerror] ${e && e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "EnvGuest", avatarId: "guest_01" }));
    });
    await page.goto(`http://localhost:${WEB_PORT}/g/${token}?api=http://localhost:${API_PORT}&rt=0`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await page.waitForFunction(
      () => !!window.__wedding?.player && !!window.__wedding?.input && !!window.__wedding?.questState,
      null, { timeout: 120000 });
    await sleep(1000);

    await page.click('[data-testid="wedding-book-open"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    const couple = await page.textContent('[data-testid="book-couple"]');
    if (!couple.includes("Kirana") || !couple.includes("Sakti")) fail(`book shows fixture couple, not server: ${couple}`);
    await page.click('[data-testid="wedding-book-close"]');

    await talkThrough(page, 392, 1112, "npc.greeter", 4);
    let qs = await questState(page);
    if (qs.status !== "active") fail(`server dialogue did not start quest: ${JSON.stringify(qs)}`);
    await talkThrough(page, 440, 728, "npc.photographer", 3);
    qs = await questState(page);
    if (!qs.collected.includes("heart.memories")) fail("server heart assignment broken");
    await talkThrough(page, 424, 280, "npc.proposal_friend", 3);
    await talkThrough(page, 104, 552, "npc.story_keeper", 3);
    await talkThrough(page, 200, 600, "npc.travel_friend", 3);
    qs = await questState(page);
    if (qs.status !== "complete" || !qs.finaleUnlocked) fail(`quest incomplete on server data: ${JSON.stringify(qs)}`);
    await page.waitForSelector('[data-testid="unlock-banner"]', { state: "visible", timeout: 15000 });

    await teleport(page, 440, 220);
    await seek(page, 440, 204, 30000, 30);
    await talkThrough(page, 392, 200, "npc.couple_a", 2);
    await page.waitForSelector('[data-testid="finale-reveal"]', { state: "visible", timeout: 15000 });
    const reveal = await page.textContent('[data-testid="finale-reveal"]');
    if (!reveal.includes("Kirana")) fail(`finale shows fixture couple: ${reveal}`);

    const url = new URL(page.url());
    if (url.searchParams.has("session") || url.searchParams.has("net")) fail(`guest URL gained plumbing: ${url.search}`);
    if (pageLogs.length > 0) fail(`page errors: ${pageLogs.join(" | ").slice(0, 400)}`);
    await browser.close();
  } finally {
    await stopAll();
  }
  console.log("M17 ENVELOPE VERIFIED");
}

main().catch((e) => fail((e && e.message) || String(e)));
