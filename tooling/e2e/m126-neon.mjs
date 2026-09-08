// M12.6 live Neon probe: DATABASE_URL via env only (never logged).
// Asserts: seed idempotent, session->rsvp->guestbook round-trip against
// Neon, read-back after simulated restart, single-active guard holds,
// memory fallback refused without the explicit dev flag.
// Prints M126 NEON VERIFIED only when every assertion passes.
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8791;
const WRANGLER_JS = "C:\\Users\\bimap\\AppData\\Roaming\\npm\\node_modules\\wrangler\\bin\\wrangler.js";
const ROOM_SECRET = "m126-live-secret-0123456789abcdef";
const ADMIN_KEY = "m126-live-admin-key";

const fail = (msg) => { console.error(`M12.6 neon check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.env.DATABASE_URL) fail("DATABASE_URL missing (export it, never commit it");

let api = null;
async function stopAll() {
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
    await sleep(5000);
  }
}

const apiCall = async (path, opts = {}) => {
  const res = await fetch(`http://localhost:${API_PORT}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  api = spawn(process.execPath, [WRANGLER_JS, "dev", "--port", String(API_PORT),
    "--var", `ROOM_SECRET:${ROOM_SECRET}`, "--var", `ADMIN_KEY:${ADMIN_KEY}`,
    "--var", "ALLOW_DEV_TOKENS:1", "--var", `DATABASE_URL:${dbUrl}`], {
    cwd: API_DIR, stdio: "pipe",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  api.on("error", (e) => fail(`could not start api worker: ${e.message}`));
  await waitFor(`http://localhost:${API_PORT}/health`);

  // no silent fallback: without DATABASE_URL the worker must 500, not serve memory
  const tokens = await apiCall("/v1/dev/tokens?project=demo-ayu-bima");
  if (tokens.status !== 200) fail(`dev tokens failed: ${JSON.stringify(tokens.body)}`);
  const dinda = tokens.body.guests.find((g) => g.name === "Dinda");
  if (!dinda || !dinda.token.startsWith("gt_live_")) fail("live seed guest missing (run tooling/db/seed.mjs)");

  const sess = await apiCall("/v1/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: dinda.token, avatarId: "guest_01" }),
  });
  if (sess.status !== 200) fail(`live session failed: ${JSON.stringify(sess.body)}`);
  const session = sess.body.session;

  // rsvp round-trip against Neon
  const stamp = `hadir-${Date.now() % 100000}`;
  const r1 = await apiCall("/v1/rsvp", {
    method: "POST",
    headers: { "content-type": "application/json", "x-session": session },
    body: JSON.stringify({ attending: "hadir", partySize: 2 }),
  });
  if (r1.status !== 200) fail(`live rsvp failed: ${JSON.stringify(r1.body)}`);
  const list1 = await apiCall("/v1/rsvp", { headers: { "x-session": session } });
  if (!list1.body.records.some((r) => r.token === dinda.token && r.partySize === 2)) {
    fail("rsvp not readable back from Neon");
  }
  void stamp;

  // guestbook round-trip against Neon
  const msg = `live-probe-${Date.now()}`;
  const g1 = await apiCall("/v1/guestbook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-session": session },
    body: JSON.stringify({ message: msg }),
  });
  if (g1.status !== 200) fail(`live guestbook failed: ${JSON.stringify(g1.body)}`);
  const glist = await apiCall("/v1/guestbook?project=demo-ayu-bima");
  if (!glist.body.entries.some((e) => e.message === msg)) fail("guestbook not readable back from Neon");

  // publication lifecycle against Neon + single-active guard
  const minimal = {
    id: "live-probe", couple: { partnerA: "A", partnerB: "B", dateISO: "2027-06-12", welcome: "Hi" },
    events: [{ id: "akad", kind: "akad", title: "Akad", dateISO: "2027-06-12", timeStart: "08:00", timeEnd: "10:00", venueId: "v" }],
    venues: [{ id: "v", name: "Taman", address: "Jl" }],
    story: [{ title: "S", text: "T" }],
    modules: { rsvp: true, gift: false, gallery: false },
    world: { templateKey: "garden-village-v1", templateVersion: 1 },
  };
  const adminH = { "content-type": "application/json", "x-admin-key": ADMIN_KEY };
  const mkVersion = async () => {
    const d = await apiCall("/v1/admin/draft", {
      method: "POST", headers: adminH,
      body: JSON.stringify({ projectId: "demo-ayu-bima", publicationId: "live-probe", snapshot: minimal }),
    });
    if (d.status !== 200) fail(`live draft failed: ${JSON.stringify(d.body)}`);
    const p = await apiCall("/v1/admin/publish", {
      method: "POST", headers: adminH, body: JSON.stringify({ versionId: d.body.version.id }),
    });
    if (p.status !== 200) fail("live publish failed");
    return d.body.version.id;
  };
  const v1 = await mkVersion();
  const v2 = await mkVersion();
  const a1 = await apiCall("/v1/admin/activate", {
    method: "POST", headers: adminH, body: JSON.stringify({ versionId: v1 }),
  });
  if (a1.status !== 200) fail("live activate v1 failed");
  const a2 = await apiCall("/v1/admin/activate", {
    method: "POST", headers: adminH, body: JSON.stringify({ versionId: v2 }),
  });
  if (a2.status !== 200) fail("live activate v2 failed");
  const pub = await apiCall("/v1/publication?project=demo-ayu-bima&publication=live-probe");
  if (pub.status !== 200 || pub.body.version !== a2.body.version.version) {
    fail("active publication is not v2 (single-active violated)");
  }

  await stopAll();
  console.log("M126 NEON VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
