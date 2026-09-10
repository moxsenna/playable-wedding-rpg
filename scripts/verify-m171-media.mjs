// M17.1 media oracle: upload authorization, project isolation, MIME/size
// validation, serving, presigned structure, and active-reference delete
// protection against a local API worker. Prints MEDIA API VERIFIED.
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveWranglerJs } from "../tooling/resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8797;
const ADMIN_KEY = "m171-media-admin-key";
const ROOM_SECRET = "m171-media-room-secret-0123456789";

const fail = (msg) => { console.error(`M17.1 media check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rootRequire = createRequire(join(ROOT, "package.json"));
let WRANGLER_JS;
try {
  WRANGLER_JS = resolveWranglerJs();
} catch (e) {
  fail(`wrangler resolve: ${(e && e.message) || e}`);
}
void rootRequire;

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

function boot(extraVars = []) {
  const vars = [
    "--var", `ROOM_SECRET:${ROOM_SECRET}`, "--var", `ADMIN_KEY:${ADMIN_KEY}`,
    "--var", "ALLOW_DEV_TOKENS:1", "--var", "DEV_MEMORY_STORE:1",
    ...extraVars.flatMap(([k, v]) => ["--var", `${k}:${v}`]),
  ];
  api = spawn(process.execPath, [WRANGLER_JS, "dev", "--port", String(API_PORT), ...vars], {
    cwd: API_DIR, stdio: "pipe",
  });
  api.on("error", (e) => fail(`could not start api worker: ${e.message}`));
}

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  boot();
  const call = async (path, opts = {}) => {
    const res = await fetch(`http://localhost:${API_PORT}${path}`, opts);
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };
  const H = { "content-type": "application/json", "x-admin-key": ADMIN_KEY };

  try {
    await waitFor(`http://localhost:${API_PORT}/health`);

    const created = await call("/v1/admin/projects", {
      method: "POST", headers: H, body: JSON.stringify({ name: "Media Probe" }),
    });
    ok(created.status === 201, "project created");
    const pid = created.body.project.id;
    const other = await call("/v1/admin/projects", {
      method: "POST", headers: H, body: JSON.stringify({ name: "Media Other" }),
    });
    const pidB = other.body.project.id;

    let r = await call("/v1/admin/media/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: pid, contentType: "image/webp", sizeBytes: 1000 }),
    });
    ok(r.status === 401, "upload-url requires admin key");

    const ask = (payload) => call("/v1/admin/media/upload-url", { method: "POST", headers: H, body: JSON.stringify(payload) });
    r = await ask({ projectId: pid, contentType: "image/gif", sizeBytes: 1000 });
    ok(r.status === 400, "gif rejected");
    r = await ask({ projectId: pid, contentType: "image/webp", sizeBytes: 6 * 1024 * 1024 });
    ok(r.status === 400, "oversize rejected");
    r = await ask({ projectId: pid, contentType: "image/webp", sizeBytes: 0 });
    ok(r.status === 400, "empty size rejected");
    r = await ask({ projectId: "BAD ID!!", contentType: "image/webp", sizeBytes: 1000 });
    ok(r.status === 400, "malformed project rejected");
    r = await ask({ projectId: "a-valid-looking-id-1", contentType: "image/webp", sizeBytes: 1000 });
    ok(r.status === 404, "unknown project rejected");

    r = await ask({ projectId: pid, contentType: "image/webp", sizeBytes: 4096 });
    ok(r.status === 200 && r.body.mode === "proxy", "proxy mode without S3 secrets");
    ok(/^weddings\/[a-z0-9-]+\/gallery\/[0-9a-f-]{36}\.webp$/.test(r.body.key), `key shape: ${r.body.key}`);
    ok(r.body.key.startsWith(`weddings/${pid}/`), "key bound to project");
    ok(r.body.publicUrl.endsWith(`/v1/media/${r.body.key}`), "public URL compatible");
    const key = r.body.key;
    const publicUrl = r.body.publicUrl;

    const put = (projectId, putKey, ct, bytes) => fetch(
      `http://localhost:${API_PORT}/v1/admin/media/upload?projectId=${projectId}&key=${encodeURIComponent(putKey)}&contentType=${encodeURIComponent(ct)}`,
      { method: "POST", headers: { "x-admin-key": ADMIN_KEY, "content-type": "application/octet-stream" }, body: bytes }
    );
    let up = await put(pidB, key, "image/webp", PNG_1PX);
    ok(up.status === 400, "cross-project key rejected");
    up = await put(pid, key, "image/png", PNG_1PX);
    ok(up.status === 400, "content-type/key mismatch rejected");
    up = await put(pid, key, "image/webp", Buffer.alloc(6 * 1024 * 1024));
    ok(up.status === 400, "oversize bytes rejected");
    up = await put(pid, key, "image/webp", PNG_1PX);
    ok(up.status === 200, "proxied upload stored");

    const got = await fetch(`http://localhost:${API_PORT}/v1/media/${key}`);
    ok(got.status === 200, "media served");
    ok(got.headers.get("content-type") === "image/webp", "served content type");
    ok(Buffer.from(await got.arrayBuffer()).equals(PNG_1PX), "served bytes intact");
    const bad = await fetch(`http://localhost:${API_PORT}/v1/media/evil.png`);
    ok(bad.status === 400, "bad key rejected on serve");
    const missing = await fetch(`http://localhost:${API_PORT}/v1/media/weddings/${pid}/gallery/00000000-0000-4000-8000-000000000000.webp`);
    ok(missing.status === 404, "missing object 404s");

    const del = (payload, key2) => call("/v1/admin/media", {
      method: "DELETE", headers: key2 ? { ...H, "x-admin-key": key2 } : H, body: JSON.stringify(payload),
    });
    r = await del({ projectId: pid, key });
    ok(r.status === 200, "unreferenced delete succeeds");
    ok((await fetch(`http://localhost:${API_PORT}/v1/media/${key}`)).status === 404, "deleted object gone");

    const again = await ask({ projectId: pid, contentType: "image/webp", sizeBytes: 4096 });
    const key2 = again.body.key;
    await put(pid, key2, "image/webp", PNG_1PX);
    const pub = {
      id: "m", couple: { partnerA: "A", partnerB: "B", dateISO: "2027-06-12", welcome: "Hi" },
      events: [{ id: "e", kind: "other", title: "Acara", dateISO: "2027-06-12", timeStart: "10:00", timeEnd: "11:00", venueId: "v" }],
      venues: [{ id: "v", name: "Venue", address: "Jalan" }],
      story: [{ title: "S", text: "T" }],
      gallery: [{ src: again.body.publicUrl, alt: "Foto" }],
      modules: { rsvp: false, gift: false, gallery: true },
      world: { templateKey: "garden-village-v1", templateVersion: 1 },
    };
    const draft = await call("/v1/admin/draft", {
      method: "POST", headers: H, body: JSON.stringify({ projectId: pid, publicationId: pid, snapshot: pub }),
    });
    ok(draft.status === 200, "draft with gallery url accepted");
    await call("/v1/admin/publish", { method: "POST", headers: H, body: JSON.stringify({ versionId: draft.body.version.id }) });
    await call("/v1/admin/activate", { method: "POST", headers: H, body: JSON.stringify({ versionId: draft.body.version.id }) });
    await call(`/v1/admin/projects/${pid}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "live" }) });
    r = await del({ projectId: pid, key: key2 });
    ok(r.status === 409, "active reference blocks delete");
    r = await del({ projectId: pidB, key: key2 });
    ok(r.status === 400, "cross-project delete rejected");

    console.log(`MEDIA API VERIFIED (${n} assertions, part 1)`);
  } finally {
    await stop();
  }

  boot([["R2_ACCOUNT_ID", "deadbeefcafe"], ["R2_ACCESS_KEY_ID", "testid"], ["R2_SECRET_ACCESS_KEY", "testsecret"]]);
  try {
    await waitFor(`http://localhost:${API_PORT}/health`);
    const created = await fetch(`http://localhost:${API_PORT}/v1/admin/projects`, {
      method: "POST", headers: H, body: JSON.stringify({ name: "Presign Probe" }),
    }).then((res) => res.json());
    const pid = created.project.id;
    const r = await fetch(`http://localhost:${API_PORT}/v1/admin/media/upload-url`, {
      method: "POST", headers: H,
      body: JSON.stringify({ projectId: pid, contentType: "image/webp", sizeBytes: 4096 }),
    }).then((res) => res.json());
    ok(r.mode === "presigned", "presigned mode with S3 secrets");
    const u = new URL(r.uploadUrl);
    ok(u.hostname.endsWith(".r2.cloudflarestorage.com"), "presigned host is R2");
    ok(u.searchParams.get("X-Amz-Expires") === "600", "10-minute expiry");
    ok(decodeURIComponent(u.pathname).endsWith(r.key), "presigned key embedded");
    ok(!r.uploadUrl.includes("testsecret"), "secret never in URL");
    ok(r.key.startsWith(`weddings/${pid}/`), "presigned key project-scoped");
    console.log(`MEDIA API VERIFIED (${n} assertions)`);
  } finally {
    await stop();
  }
}

main().catch((e) => fail((e && e.message) || String(e)));
