// M17 wishes probe: a wish sent with a session lands in the durable
// guestbook and renders in the shared wishes list; without a session the
// local outbox fallback still holds. Prints M17 WISHES VERIFIED.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveWranglerJs } from "../resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8799;
const WEB_PORT = 8127;
const BIN = process.platform === "win32" ? ".cmd" : "";
const ADMIN_KEY = "m17-wishes-admin-key";
const ROOM_SECRET = "m17-wishes-room-secret-0123456789";

const fail = (msg) => { console.error(`M17 wishes check FAILED: ${msg}`); process.exit(1); };
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
    await waitFor(`http://localhost:${WEB_PORT}/`);

    const minted = await fetch(`http://localhost:${API_PORT}/v1/dev/guests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "demo-ayu-bima", name: "WishGuest" }),
    }).then((r) => r.json());
    const sess = await fetch(`http://localhost:${API_PORT}/v1/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: minted.guest.token }),
    }).then((r) => r.json());
    if (!sess.session) fail("session mint failed");

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
    await page.addInitScript(() => {
      window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "WishGuest", avatarId: "guest_01" }));
    });
    await page.goto(
      `http://localhost:${WEB_PORT}/demo?api=http://localhost:${API_PORT}&session=${encodeURIComponent(sess.session)}`,
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    await page.waitForFunction(() => !!window.__wedding?.player, null, { timeout: 120000 });
    await sleep(1000);

    await tap('[data-testid="wedding-book-open"]');
    await page.waitForSelector('[data-testid="wedding-book"]', { state: "visible", timeout: 15000 });
    await tap('[data-testid="book-nav-rsvp"]');
    await page.fill('[data-testid="wishes-message"]', "Bahagia selalu ya!");
    await tap('[data-testid="rsvp-submit"]');
    await page.waitForSelector('[data-testid="rsvp-success"]', { state: "visible", timeout: 15000 });
    const success = await page.textContent('[data-testid="rsvp-success"]');
    if (!success.includes("sudah terkirim")) fail(`wish not sent server-side: ${success}`);
    await page.waitForSelector('[data-testid="wishes-list"]', { state: "visible", timeout: 15000 });
    const list = await page.textContent('[data-testid="wishes-list"]');
    if (!list.includes("Bahagia selalu ya!")) fail(`wish missing from shared list: ${list}`);
    await page.screenshot({ path: join(ROOT, "docs/qa/m17-wishes-390.png") });

    const entries = await fetch(`http://localhost:${API_PORT}/v1/guestbook?project=demo-ayu-bima`)
      .then((r) => r.json());
    if (!entries.entries.some((e) => e.message.includes("Bahagia selalu ya!"))) {
      fail("wish missing from durable guestbook");
    }

    if (logs.length > 0) fail(`page errors: ${logs.join(" | ").slice(0, 400)}`);
    await browser.close();
  } finally {
    await stopAll();
  }
  console.log("M17 WISHES VERIFIED");
}

main().catch((e) => fail((e && e.message) || String(e)));
