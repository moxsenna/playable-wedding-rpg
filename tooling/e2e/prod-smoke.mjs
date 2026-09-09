// Production smoke: deployed Pages + API + Realtime + R2 + Neon, in a real
// browser. Token travels DATABASE_URL (env) -> API session; the token value
// is never printed. Asserts: world-config pin, R2 manifest fetch, session
// mint, realtime join with canonical name, quest HUD boots.
// Prints PROD SMOKE VERIFIED only when every assertion passes.
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const fail = (msg) => { console.error(`prod smoke FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.env.DATABASE_URL) fail("DATABASE_URL missing");

const WEB = "https://wedding-rpg-bli.pages.dev";
const API = "https://wedding-rpg-api.moxsenna.workers.dev";
const RT = "wss://wedding-rpg-realtime.moxsenna.workers.dev";
const PROJECT = "demo-ayu-bima";
const BIN = process.platform === "win32" ? ".cmd" : "";

const webRequire = createRequire(join(WEB_DIR, "package.json"));
let chromium;
try {
  ({ chromium } = webRequire("playwright"));
} catch {
  fail("playwright not installed in apps/web");
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

const hook = (page, fn, arg) => page.evaluate(fn, arg);

async function main() {
  // 1. world-config pin from production API
  const wc = await (await fetch(`${API}/v1/world-config?project=${PROJECT}`)).json();
  if (!wc.manifestRef || !wc.manifestRef.endsWith("/manifest.json")) {
    fail(`bad world-config: ${JSON.stringify(wc)}`);
  }
  console.log(`world-config pin: ${wc.manifestRef}`);

  // 2. R2 manifest fetch via wrangler (API path, unaffected by local
  // r2.dev TLS interception). Falls back to OAuth when the env token is
  // IP-restricted for this operation.
  const { execFileSync } = await import("node:child_process");
  const { resolveWranglerJs } = await import("../resolve-wrangler.mjs");
  const WRANGLER_JS = resolveWranglerJs();
  const r2get = (withToken) => execFileSync(
    process.execPath,
    [WRANGLER_JS, "r2", "object", "get", `wedding-templates/${wc.manifestRef}`, "--remote", "--pipe"],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
      env: withToken ? process.env : Object.fromEntries(
        Object.entries(process.env).filter(([k]) => k !== "CLOUDFLARE_API_TOKEN")
      ),
    }
  );
  let buf;
  try {
    buf = r2get(true);
  } catch {
    buf = r2get(false);
  }
  const man = JSON.parse(buf.toString("utf8"));
  if (man.templateKey !== "garden-village-v1") fail("wrong template from R2");
  if (!man.environment.base.startsWith("assets/environment/")) fail("env base not pinned");
  console.log(`R2 manifest v${man.version} env=${man.environment.base}`);

  // 3. real guest token from Neon (value never printed)
  const cfg = readFileSync(join(ROOT, "drizzle.config.ts"), "utf8");
  if (!cfg.includes("dbCredentials")) fail("drizzle config missing dbCredentials");
  const { Client } = await import("pg").catch(() => fail("pg missing (pnpm add -Dw pg)"));
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const g = await c.query("SELECT token FROM guests WHERE project_id = $1 AND name = 'Dinda' LIMIT 1", [PROJECT]);
  await c.end();
  if (g.rows.length === 0) fail("seeded guest missing in Neon");
  const token = g.rows[0].token;

  // 4. production session mint
  const sess = await (
    await fetch(`${API}/v1/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, avatarId: "guest_01" }),
    })
  ).json();
  if (!sess.session || sess.guest.displayName !== "Dinda") fail("production session mint failed");
  console.log(`session minted for ${sess.guest.displayName} (${sess.guest.projectId})`);

  // 5. realtime join against production DO with the real session
  const rootRequire = createRequire(join(ROOT, "package.json"));
  const { WebSocket } = rootRequire("ws");
  const ws = new WebSocket(`${RT}/room?room=${PROJECT}`);
  await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
  let welcome = null;
  ws.on("message", (buf) => {
    try {
      const m = JSON.parse(String(buf));
      if (m.type === "room.welcome") welcome = m.payload;
    } catch { /* ignore */ }
  });
  ws.send(JSON.stringify({ v: 1, type: "client.hello", payload: { session: sess.session, clientVersion: "1.0.0" } }));
  {
    const start = Date.now();
    for (;;) {
      if (welcome) break;
      if (Date.now() - start > 20000) fail("no production welcome");
      await sleep(400);
    }
  }
  if (welcome.self.displayName !== "Dinda") fail("production welcome not canonical");
  console.log(`realtime welcome: ${welcome.self.displayName} (${welcome.self.playerId})`);
  ws.close();

  // 6. boot the deployed game with pinned manifest + production net.
  // No &r2=: the game serves pinned files through the API origin (same
  // CORS, no extra public bucket URL needed — and r2.dev may be
  // unreachable from filtered networks).
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const logs = [];
  const consoleErrs = [];
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e && e.message}`));
  await page.addInitScript(() => {
    window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
  });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") consoleErrs.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
  });
  const url =
    `${WEB}/?wedding=${PROJECT}` +
    `&api=${encodeURIComponent(API)}` +
    `&net=${encodeURIComponent(`${RT}/room?room=${PROJECT}`)}` +
    `&session=${encodeURIComponent(sess.session)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Production-safe readiness: the dev-only window.__wedding hook does not
  // exist in production builds; the scene-ready marker + HUD do.
  await page.waitForSelector('#game-container[data-scene-ready="wedding-world"]', { timeout: 90000 });
  await sleep(2000);
  const hud = await page.textContent('[data-testid="quest-hud"]');
  if (!hud.includes("OUR STORY")) fail("quest HUD missing on production boot");
  await page.screenshot({ path: join(ROOT, "docs/qa/prod-smoke-390.png") });
  if (logs.length > 0) fail(`page errors: ${logs.join(" | ").slice(0, 400)}`);
  await browser.close();

  console.log("PROD SMOKE VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
