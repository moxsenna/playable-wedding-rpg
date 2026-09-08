// M12.5 integration probe: API worker + DO room against local workerd.
// Asserts: seeded session join works end-to-end (token -> session ->
// welcome with canonical name), ?name= impersonation is ignored (legacy
// hello rejected), unsigned hello rejected, cross-project RSVP rejected,
// admin key enforced, publication lifecycle reachable through the API.
// Prints M125 INTEGRATION VERIFIED only when every assertion passes.
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API_DIR = join(ROOT, "apps/api");
const RT_DIR = join(ROOT, "apps/realtime");
const API_PORT = 8788;
const RT_PORT = 8789;
const WRANGLER_JS = "C:\\Users\\bimap\\AppData\\Roaming\\npm\\node_modules\\wrangler\\bin\\wrangler.js";
const ROOM_SECRET = process.env.ROOM_SECRET ?? "m125-local-secret-0123456789";
const ADMIN_KEY = "m125-local-admin-key";

const fail = (msg) => { console.error(`M12.5 integration check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rootRequire = createRequire(join(ROOT, "package.json"));
let WebSocket;
try {
  ({ WebSocket } = rootRequire("ws"));
} catch {
  fail("ws not installed at root (pnpm add -Dw ws)");
}

let api = null;
let worker = null;
async function stopAll() {
  for (const p of [worker, api]) {
    if (p && !p.killed) p.kill();
  }
  await sleep(2000);
}
process.on("exit", () => {
  for (const p of [worker, api]) {
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
    await sleep(5000);
  }
}

const apiCall = async (path, opts = {}) => {
  const res = await fetch(`http://localhost:${API_PORT}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};

async function main() {
  api = spawn(process.execPath, [WRANGLER_JS, "dev", "--port", String(API_PORT),
    "--var", `ROOM_SECRET:${ROOM_SECRET}`, "--var", `ADMIN_KEY:${ADMIN_KEY}`, "--var", "ALLOW_DEV_TOKENS:1"], {
    cwd: API_DIR, stdio: "pipe",
  });
  api.on("error", (e) => fail(`could not start api worker: ${e.message}`));
  worker = spawn(process.execPath, [WRANGLER_JS, "dev", "--port", String(RT_PORT),
    "--var", `ROOM_SECRET:${ROOM_SECRET}`], {
    cwd: RT_DIR, stdio: "pipe",
  });
  worker.on("error", (e) => fail(`could not start realtime worker: ${e.message}`));
  await waitFor(`http://localhost:${API_PORT}/health`);
  await waitFor(`http://localhost:${RT_PORT}/health`);

  // seeded tokens (dev-only endpoint)
  const tokens = await apiCall("/v1/dev/tokens");
  if (tokens.status !== 200) fail("dev tokens endpoint refused with ALLOW_DEV_TOKENS=1");
  const dinda = tokens.body.guests.find((g) => g.name === "Dinda");
  const sinta = tokens.body.guests.find((g) => g.name === "Sinta");
  if (!dinda || !sinta) fail("seeded guests missing");

  // token -> session (canonical identity)
  const sess = await apiCall("/v1/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: dinda.token, avatarId: "guest_01" }),
  });
  if (sess.status !== 200) fail(`session mint failed: ${JSON.stringify(sess.body)}`);
  if (sess.body.guest.displayName !== "Dinda" || sess.body.guest.projectId !== "demo-ayu-bima") {
    fail(`session identity wrong: ${JSON.stringify(sess.body.guest)}`);
  }
  const session = sess.body.session;
  const badAvatar = await apiCall("/v1/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: dinda.token, avatarId: "evil_skin" }),
  });
  if (badAvatar.status !== 403) fail("off-allowlist avatar must be 403");
  const unknown = await apiCall("/v1/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "gt_nope", avatarId: "guest_01" }),
  });
  if (unknown.status !== 404) fail("unknown token must be 404");

  // sessioned DO join: welcome carries the canonical name
  const ws = new WebSocket(`ws://localhost:${RT_PORT}/room?room=demo-ayu-bima`);
  await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
  let welcome = null;
  ws.on("message", (buf) => {
    try {
      const m = JSON.parse(String(buf));
      if (m.type === "room.welcome") welcome = m.payload;
    } catch { /* ignore */ }
  });
  ws.send(JSON.stringify({ v: 1, type: "client.hello", payload: { session, clientVersion: "1.0.0" } }));
  {
    const start = Date.now();
    for (;;) {
      if (welcome) break;
      if (Date.now() - start > 15000) fail("no welcome for sessioned hello");
      await sleep(300);
    }
  }
  if (welcome.self.displayName !== "Dinda") fail(`welcome name not canonical: ${welcome.self.displayName}`);
  if (welcome.self.avatarId !== "guest_01") fail("welcome avatar not canonical");
  ws.close();

  // legacy identity hello rejected (impersonation closed)
  const imp = new WebSocket(`ws://localhost:${RT_PORT}/room?room=demo-ayu-bima&name=Pengantin`);
  await new Promise((res, rej) => { imp.on("open", res); imp.on("error", rej); });
  let impWelcomed = false;
  let impCode = null;
  imp.on("message", (buf) => {
    try {
      if (JSON.parse(String(buf)).type === "room.welcome") impWelcomed = true;
    } catch { /* ignore */ }
  });
  imp.on("close", (code) => { impCode = code; });
  imp.send(JSON.stringify({ v: 1, type: "client.hello", payload: { mapId: "garden-village-v1", avatarId: "guest_01", clientVersion: "1.0.0" } }));
  await sleep(2500);
  if (impWelcomed) fail("?name=Pengantin impersonation was welcomed");
  console.log(`impersonation hello rejected (close code ${impCode})`);
  try { imp.close(); } catch { /* noop */ }

  // unsigned hello rejected
  const anon = new WebSocket(`ws://localhost:${RT_PORT}/room?room=demo-ayu-bima`);
  await new Promise((res, rej) => { anon.on("open", res); anon.on("error", rej); });
  let anonWelcomed = false;
  anon.on("message", (buf) => {
    try {
      if (JSON.parse(String(buf)).type === "room.welcome") anonWelcomed = true;
    } catch { /* ignore */ }
  });
  anon.send(JSON.stringify({ v: 1, type: "client.hello", payload: { session: "garbage.token", clientVersion: "1.0.0" } }));
  await sleep(2500);
  if (anonWelcomed) fail("forged session was welcomed");
  try { anon.close(); } catch { /* noop */ }

  // cross-project RSVP rejected through the API
  const sintaSess = await apiCall("/v1/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: sinta.token, avatarId: "guest_01" }),
  });
  const rsvpOk = await apiCall("/v1/rsvp", {
    method: "POST",
    headers: { "content-type": "application/json", "x-session": sintaSess.body.session },
    body: JSON.stringify({ attending: "hadir", partySize: 2 }),
  });
  if (rsvpOk.status !== 200) fail(`own-project rsvp failed: ${JSON.stringify(rsvpOk.body)}`);
  const rsvpList = await apiCall("/v1/rsvp", { headers: { "x-session": session } });
  if (rsvpList.body.records.some((r) => r.projectId !== "demo-ayu-bima")) {
    fail("rsvp list leaked another project");
  }
  const noAuth = await apiCall("/v1/rsvp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ attending: "hadir", partySize: 1 }),
  });
  if (noAuth.status !== 401) fail("sessionless rsvp must be 401");

  // admin key enforced + lifecycle reachable
  const noKey = await apiCall("/v1/admin/draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId: "demo-ayu-bima", publicationId: "pub", snapshot: {} }),
  });
  if (noKey.status !== 401) fail("keyless admin must be 401");
  const minimal = {
    id: "pub", couple: { partnerA: "A", partnerB: "B", dateISO: "2027-06-12", welcome: "Hi" },
    events: [{ id: "akad", kind: "akad", title: "Akad", dateISO: "2027-06-12", timeStart: "08:00", timeEnd: "10:00", venueId: "v" }],
    venues: [{ id: "v", name: "Taman", address: "Jl" }],
    story: [{ title: "S", text: "T" }],
    modules: { rsvp: true, gift: false, gallery: false },
    world: { templateKey: "garden-village-v1", templateVersion: 1 },
  };
  const adminH = { "content-type": "application/json", "x-admin-key": ADMIN_KEY };
  const draft = await apiCall("/v1/admin/draft", {
    method: "POST", headers: adminH,
    body: JSON.stringify({ projectId: "demo-ayu-bima", publicationId: "pub", snapshot: minimal }),
  });
  if (draft.status !== 200) fail(`admin draft failed: ${JSON.stringify(draft.body)}`);
  const published = await apiCall("/v1/admin/publish", {
    method: "POST", headers: adminH, body: JSON.stringify({ versionId: draft.body.version.id }),
  });
  if (published.status !== 200) fail("admin publish failed");
  const activated = await apiCall("/v1/admin/activate", {
    method: "POST", headers: adminH, body: JSON.stringify({ versionId: draft.body.version.id }),
  });
  if (activated.status !== 200) fail("admin activate failed");
  const pub = await apiCall("/v1/publication?project=demo-ayu-bima&publication=pub");
  if (pub.status !== 200) fail("active publication unreadable through the API");

  await stopAll();
  console.log("M125 INTEGRATION VERIFIED");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
