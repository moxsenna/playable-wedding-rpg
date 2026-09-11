// Self-serve probe: checkout (against a mock PayCore that verifies our HMAC
// per the PayCore spec) -> simulated payment.succeeded webhook -> claim ->
// owner draft/publish/activate -> public publication serves the content.
// Prints SELFSERVE VERIFIED.
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHmac, createHash } from "node:crypto";
import http from "node:http";
import { resolveWranglerJs } from "../resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const API_DIR = join(ROOT, "apps/api");
const API_PORT = 8797;
const WEB_PORT = 8125;
const MOCK_PORT = 8891;
const BIN = process.platform === "win32" ? ".cmd" : "";

const ADMIN_KEY = "selfserve-admin-key";
const ROOM_SECRET = "selfserve-room-secret-0123456789";
const APP_SECRET = "selfserve-paycore-app-secret";
const WEBHOOK_SECRET = "selfserve-paycore-webhook-secret";

const fail = (msg) => { console.error(`Selfserve check FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, msg) => { if (!cond) fail(msg); };

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

// Mock PayCore: verifies our order signature exactly per the PayCore spec,
// then returns a fake checkout. Rejects anything that fails verification.
function startMockPayCore() {
  return http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/orders") {
      res.writeHead(404).end("{}");
      return;
    }
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      try {
        const ts = req.headers["x-paycore-timestamp"] ?? "";
        const sig = String(req.headers["x-paycore-signature"] ?? "").replace(/^sha256=/, "");
        const bodyHash = createHash("sha256").update(raw).digest("hex");
        const expected = createHmac("sha256", APP_SECRET).update(`${ts}.POST./v1/orders.${bodyHash}`).digest("hex");
        let match = sig.length === expected.length;
        for (let i = 0; match && i < sig.length; i++) match = sig[i] === expected[i] && match;
        if (!match) {
          res.writeHead(401).end(JSON.stringify({ error: "bad signature" }));
          return;
        }
        const body = JSON.parse(raw);
        if (body.amount !== 3500000 || body.product_key !== "yutemu_signature") {
          res.writeHead(400).end(JSON.stringify({ error: "bad order body" }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
          order_id: "PC-TEST-0001",
          external_order_id: body.external_order_id,
          payment_status: "pending",
          checkout_url: `http://localhost:${WEB_PORT}/mulai/retur?order=${encodeURIComponent(body.external_order_id)}`,
        }));
      } catch {
        res.writeHead(400).end("{}");
      }
    });
  }).listen(MOCK_PORT);
}

function signEvent(rawBody) {
  const ts = new Date().toISOString();
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest("hex");
  return { ts, sig: `sha256=${sig}` };
}

let api = null;
let web = null;
async function stopAll() {
  for (const p of [web, api]) {
    if (p && !p.killed) { try { p.kill("SIGKILL"); } catch { /* noop */ } }
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

async function main() {
  const mock = startMockPayCore();
  api = spawn(process.execPath, [WRANGLER_JS, "dev", "--port", String(API_PORT),
    "--var", `ROOM_SECRET:${ROOM_SECRET}`, "--var", `ADMIN_KEY:${ADMIN_KEY}`,
    "--var", "ALLOW_DEV_TOKENS:1", "--var", "DEV_MEMORY_STORE:1",
    "--var", `PAYCORE_BASE_URL:http://localhost:${MOCK_PORT}`,
    "--var", "PAYCORE_APP_ID:yutemu",
    "--var", "PAYCORE_KEY_ID:pk_test_yutemu_01",
    "--var", `PAYCORE_APP_SECRET:${APP_SECRET}`,
    "--var", `PAYCORE_WEBHOOK_SECRET:${WEBHOOK_SECRET}`,
    "--var", `PAYCORE_RETURN_URL:http://localhost:${WEB_PORT}/mulai/retur`], {
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

    const API = `http://localhost:${API_PORT}`;

    // 1. Checkout validation rejects bad input.
    const bad = await fetch(`${API}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier: "platinum", customer: { name: "X", whatsapp: "081", email: "x" } }),
    });
    ok(bad.status === 400, "checkout should reject unknown tier");

    // 1b. Sandbox checkout without staging creds is refused, not routed to prod.
    const sb = await fetch(`${API}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tier: "esensial",
        customer: { name: "Uji Coba", whatsapp: "081234567890", email: "uji@example.com" },
        sandbox: true,
      }),
    });
    ok(sb.status === 501, "sandbox checkout without staging creds should be 501");

    // 2. Real checkout against the signature-verifying mock.
    const co = await fetch(`${API}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tier: "signature",
        customer: { name: "Uji Coba", whatsapp: "081234567890", email: "uji@example.com" },
      }),
    }).then((r) => r.json());
    ok(co.checkoutUrl && co.externalOrderId, `checkout failed: ${JSON.stringify(co)}`);

    // 3. Forged webhook is refused.
    const forged = JSON.stringify({ event_id: "evt_forged", event_type: "payment.succeeded", data: {} });
    const forgedRes = await fetch(`${API}/internal/payment-events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-PayCore-Event-Timestamp": new Date().toISOString(),
        "X-PayCore-Event-Signature": "sha256=00",
      },
      body: forged,
    });
    ok(forgedRes.status === 401, "forged webhook should be 401");

    // 4. Genuine payment.succeeded fulfills the order.
    const eventBody = JSON.stringify({
      event_id: "evt_test_0001",
      event_type: "payment.succeeded",
      occurred_at: new Date().toISOString(),
      data: {
        order_id: "PC-TEST-0001",
        external_order_id: co.externalOrderId,
        app_id: "yutemu",
        provider: "duitku",
        provider_reference: "DUITKU-REF-1",
        amount: 3500000,
        currency: "IDR",
        product_key: "yutemu_signature",
        fulfillment_data: { tier: "signature" },
        paid_at: new Date().toISOString(),
      },
    });
    const { ts, sig } = signEvent(eventBody);
    const fulfilled = await fetch(`${API}/internal/payment-events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-PayCore-Event-Timestamp": ts,
        "X-PayCore-Event-Signature": sig,
      },
      body: eventBody,
    }).then((r) => r.json());
    ok(fulfilled.ok && fulfilled.projectId, `fulfill failed: ${JSON.stringify(fulfilled)}`);
    const projectId = fulfilled.projectId;

    // 5. Retry of the same event is idempotent, no duplicate project.
    const { ts: ts2, sig: sig2 } = signEvent(eventBody);
    const replay = await fetch(`${API}/internal/payment-events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-PayCore-Event-Timestamp": ts2,
        "X-PayCore-Event-Signature": sig2,
      },
      body: eventBody,
    }).then((r) => r.json());
    ok(replay.ok && replay.deduped, `replay should dedupe: ${JSON.stringify(replay)}`);

    // 6. Checkout status exposes the claim token once paid.
    const st = await fetch(`${API}/v1/checkout/${encodeURIComponent(co.externalOrderId)}`).then((r) => r.json());
    ok(st.status === "paid" && st.claimToken, `status should be paid with claim: ${JSON.stringify(st)}`);

    // 7. Claim exchange mints a scoped owner session; reuse is refused.
    const claim = await fetch(`${API}/v1/owner/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: st.claimToken }),
    }).then((r) => r.json());
    ok(claim.ownerToken && claim.projectId === projectId && claim.tier === "signature",
      `claim failed: ${JSON.stringify(claim)}`);
    const OH = { "content-type": "application/json", "x-owner-token": claim.ownerToken };
    const reuse = await fetch(`${API}/v1/owner/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: st.claimToken }),
    });
    ok(reuse.status === 404, "claim reuse should be refused");

    // 8. Owner writes a draft, publishes, and activates it.
    const snapshot = {
      id: "main",
      couple: { partnerA: "Uji", partnerB: "Coba", dateISO: "2027-06-12", welcome: "Selamat datang" },
      events: [{ id: "e1", kind: "akad", title: "Akad", dateISO: "2027-06-12", timeStart: "08:00", timeEnd: "10:00", venueId: "v1" }],
      venues: [{ id: "v1", name: "Gedung", address: "Jl. Mawar 1" }],
      gallery: [],
      story: [{ title: "Awal", text: "Kisah kami" }],
      modules: { rsvp: true, gift: false, gallery: false },
      world: { templateKey: "garden-village-v1", templateVersion: 1 },
    };
    const draft = await fetch(`${API}/v1/owner/draft`, {
      method: "PUT", headers: OH, body: JSON.stringify({ snapshot }),
    }).then((r) => r.json());
    ok(draft.version && draft.version.id, `draft failed: ${JSON.stringify(draft)}`);
    const published = await fetch(`${API}/v1/owner/publish`, {
      method: "POST", headers: OH, body: JSON.stringify({ versionId: draft.version.id }),
    }).then((r) => r.json());
    ok(published.version && published.version.status === "published", `publish failed: ${JSON.stringify(published)}`);
    const activated = await fetch(`${API}/v1/owner/activate`, {
      method: "POST", headers: OH, body: JSON.stringify({ versionId: draft.version.id }),
    }).then((r) => r.json());
    ok(activated.version && activated.version.status === "active", `activate failed: ${JSON.stringify(activated)}`);

    // 9. The public publication serves the owner's content.
    const pub = await fetch(`${API}/v1/publication?project=${encodeURIComponent(projectId)}&publication=main`).then((r) => r.json());
    ok(pub.snapshot && pub.snapshot.couple.partnerA === "Uji",
      `public publication mismatch: ${JSON.stringify(pub).slice(0, 200)}`);

    // 10. Owner cannot touch another project's version.
    const other = await fetch(`${API}/v1/admin/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ name: "Proyek Tetangga" }),
    }).then((r) => r.json());
    ok(other.project && other.project.id, `admin project create failed: ${JSON.stringify(other)}`);
    const adminDraft = await fetch(`${API}/v1/admin/draft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ projectId: other.project.id, publicationId: "main", snapshot }),
    }).then((r) => r.json());
    const cross = await fetch(`${API}/v1/owner/publish`, {
      method: "POST", headers: OH, body: JSON.stringify({ versionId: adminDraft.version.id }),
    });
    ok(cross.status === 404, "cross-project publish should be 404");

    // 11. Admin can mint a manual claim (WA/manual-payment path).
    const manual = await fetch(`${API}/v1/admin/claims`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ projectId: other.project.id }),
    }).then((r) => r.json());
    ok(manual.claimToken, `manual claim failed: ${JSON.stringify(manual)}`);

    // 12. Browser: the wizard boots from the manual claim and shows the project.
    let browser = null;
    try {
      browser = await chromium.launch();
    } catch (e) {
      if (!/Executable doesn't exist/i.test(String(e && e.message))) throw e;
      execSync(`"${join(WEB_DIR, "node_modules", ".bin", `playwright${BIN}`)}" install chromium`, {
        cwd: WEB_DIR, stdio: "pipe", timeout: 420000,
      });
      browser = await chromium.launch();
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${WEB_PORT}/mulai/${encodeURIComponent(manual.claimToken)}?api=http://localhost:${API_PORT}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="wizard-project"]', { state: "visible", timeout: 30000 });
    await page.screenshot({ path: join(ROOT, "docs/qa/selfserve-390.png") });
    const invalid = await ctx.newPage();
    await invalid.goto(`http://localhost:${WEB_PORT}/mulai/oc_bogus?api=http://localhost:${API_PORT}`, { waitUntil: "domcontentloaded" });
    await invalid.waitForSelector('[data-testid="wizard-invalid"]', { state: "visible", timeout: 30000 });
    await browser.close();

    console.log("SELFSERVE VERIFIED");
  } finally {
    mock.close();
    await stopAll();
  }
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
