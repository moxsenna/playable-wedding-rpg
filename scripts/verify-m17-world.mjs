// M17 world oracle: template catalog, world config, and per-project
// avatar pools through a local API worker, including session enforcement.
// Prints M17 WORLD VERIFIED.
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWranglerJs } from "../tooling/resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8796;
const ADMIN_KEY = "m17-world-admin-key";
const ROOM_SECRET = "m17-world-room-secret-0123456789";

const fail = (msg) => { console.error(`M17 world check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let WRANGLER_JS;
try {
  WRANGLER_JS = resolveWranglerJs();
} catch (e) {
  fail(`wrangler resolve: ${(e && e.message) || e}`);
}

let n = 0;
const ok = (cond, msg) => {
  n++;
  if (!cond) fail(`assertion ${n}: ${msg}`);
};

let api = null;
async function stop() {
  if (api && !api.killed) api.kill();
  await sleep(2000);
}
process.on("exit", () => {
  if (api && !api.killed) { try { api.kill("SIGKILL"); } catch { /* noop */ } }
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

async function main() {
  api = spawn(process.execPath, [WRANGLER_JS, "dev", "--port", String(API_PORT),
    "--var", `ROOM_SECRET:${ROOM_SECRET}`, "--var", `ADMIN_KEY:${ADMIN_KEY}`,
    "--var", "ALLOW_DEV_TOKENS:1", "--var", "DEV_MEMORY_STORE:1"], {
    cwd: API_DIR, stdio: "pipe",
  });
  api.on("error", (e) => fail(`could not start api worker: ${e.message}`));

  const call = async (path, opts = {}) => {
    const res = await fetch(`http://localhost:${API_PORT}${path}`, opts);
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };
  const H = { "content-type": "application/json", "x-admin-key": ADMIN_KEY };

  try {
    await waitFor(`http://localhost:${API_PORT}/health`);

    const created = await call("/v1/admin/projects", {
      method: "POST", headers: H, body: JSON.stringify({ name: "World Probe" }),
    });
    ok(created.status === 201, "project created");
    const pid = created.body.project.id;

    const templates = await call("/v1/admin/templates", { headers: { "x-admin-key": ADMIN_KEY } });
    ok(templates.status === 200 && templates.body.templates.length >= 1, "template catalog listed");
    const tpl = templates.body.templates[0];
    ok(tpl.templateName && tpl.version >= 1, "template human readable");

    let r = await call("/v1/admin/world-config", {
      method: "POST", headers: H,
      body: JSON.stringify({ projectId: pid, templateVersionId: tpl.id, ambientPreset: "garden-day", musicRef: "media/lagu.mp3" }),
    });
    ok(r.status === 200, "world config saved");
    r = await call(`/v1/admin/world-config?project=${pid}`, { headers: { "x-admin-key": ADMIN_KEY } });
    ok(r.status === 200 && r.body.config?.ambientPreset === "garden-day", "world config read back");
    r = await call("/v1/admin/world-config", {
      method: "POST", headers: H, body: JSON.stringify({ projectId: pid, templateVersionId: "nope" }),
    });
    ok(r.status === 400, "unknown template rejected");
    r = await call("/v1/admin/world-config", {
      method: "POST", headers: H,
      body: JSON.stringify({ projectId: pid, templateVersionId: tpl.id, ambientPreset: "club-neon" }),
    });
    ok(r.status === 400, "unknown ambient rejected");

    r = await call("/v1/admin/avatar-pool", {
      method: "POST", headers: H, body: JSON.stringify({ projectId: pid, avatarIds: ["guest_male_batik_burgundy_01"] }),
    });
    ok(r.status === 200, "pool saved");
    r = await call(`/v1/admin/avatar-pool?project=${pid}`, { headers: { "x-admin-key": ADMIN_KEY } });
    ok(r.status === 200 && r.body.avatarIds.length === 1, "pool read back");
    r = await call("/v1/admin/avatar-pool", {
      method: "POST", headers: H, body: JSON.stringify({ projectId: pid, avatarIds: ["https://evil.example/x.png"] }),
    });
    ok(r.status === 400, "asset URL injection rejected");
    r = await call("/v1/admin/avatar-pool", {
      method: "POST", headers: H, body: JSON.stringify({ projectId: pid, avatarIds: [] }),
    });
    ok(r.status === 400, "empty pool rejected");

    const minted = await call("/v1/dev/guests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: pid, name: "PoolGuest" }),
    });
    ok(minted.status === 200, "guest minted");
    const token = minted.body.guest.token;
    r = await call("/v1/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, avatarId: "not_in_pool_avatar" }),
    });
    ok(r.status === 403, "out-of-pool avatar rejected");
    r = await call("/v1/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, avatarId: "guest_male_batik_burgundy_01" }),
    });
    ok(r.status === 200 && r.body.session, "pooled avatar accepted");

    console.log(`M17 WORLD VERIFIED (${n} assertions)`);
  } finally {
    await stop();
  }
}

main().catch((e) => fail((e && e.message) || String(e)));
