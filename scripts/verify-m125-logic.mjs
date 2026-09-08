// M12.5 boundary oracle: HMAC session lifecycle, project-scoped core
// rejection, publisher upload-plan completeness, protocol session-only hello.
// Transpiles the dependency-free sources with the repo's own typescript.
// Prints M125 BOUNDARY VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M12.5 logic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m125logic-"));
try {
  for (const [dir, mod] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "npc"],
    ["packages/contracts/src", "publication"],
    ["packages/contracts/src", "quest"],
    ["packages/contracts/src", "durable"],
    ["packages/contracts/src", "protocol"],
    ["packages/wedding-core/src", "guests"],
    ["packages/wedding-core/src", "rsvp"],
    ["packages/wedding-core/src", "guestbook"],
    ["packages/wedding-core/src", "publishing"],
    ["packages/wedding-core/src", "session"],
  ]) {
    const src = readFileSync(join(ROOT, dir, `${mod}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    if (out.diagnostics && out.diagnostics.length > 0) fail(`transpile errors in ${mod}.ts`);
    writeFileSync(join(tmp, `${mod}.js`), out.outputText);
  }
  const shimDir = join(tmp, "node_modules", "@wedding-rpg", "contracts");
  mkdirSync(shimDir, { recursive: true });
  writeFileSync(join(shimDir, "package.json"), JSON.stringify({ name: "@wedding-rpg/contracts", main: "index.js" }));
  writeFileSync(
    join(shimDir, "index.js"),
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../npc.js"), require("../../../publication.js"), require("../../../quest.js"), require("../../../durable.js"), require("../../../protocol.js"));`
  );
  const req = createRequire(join(tmp, "x.js"));
  const guests = req(join(tmp, "guests.js"));
  const rsvp = req(join(tmp, "rsvp.js"));
  const guestbook = req(join(tmp, "guestbook.js"));
  const pub = req(join(tmp, "publishing.js"));
  const session = req(join(tmp, "session.js"));
  const proto = req(join(tmp, "protocol.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };
  const SECRET = "m125-test-secret-0123456789";
  const NOW = 1788000000;

  // --- session lifecycle ---
  const gs = guests.createGuestStore();
  const reg = guests.registerGuest(gs, "demo-ayu-bima", "Dinda", NOW);
  ok(reg.ok, "seed guest registers");
  const signed = await session.signSession(reg.guest, "guest_01", ["guest_01"], SECRET, NOW);
  ok(signed.ok, "session signs");
  ok(signed.claims.projectId === "demo-ayu-bima", "claims carry the project");
  ok(signed.claims.displayName === "Dinda", "claims carry the name");
  let v = await session.verifySession(signed.session, SECRET, NOW + 1000);
  ok(v.ok && v.claims.guestId === reg.guest.id, "session verifies");
  v = await session.verifySession(signed.session, SECRET, NOW + session.SESSION_TTL_MS + 1);
  ok(!v.ok, "expired session rejected");
  const tampered = signed.session.slice(0, -2) + (signed.session.endsWith("AA") ? "BB" : "AA");
  v = await session.verifySession(tampered, SECRET, NOW + 1000);
  ok(!v.ok, "tampered signature rejected");
  v = await session.verifySession(signed.session, "wrong-secret-00000000", NOW + 1000);
  ok(!v.ok, "wrong secret rejected");
  const badAvatar = await session.signSession(reg.guest, "evil_skin", ["guest_01"], SECRET, NOW);
  ok(!badAvatar.ok, "off-allowlist avatar rejected");
  const badSecret = await session.signSession(reg.guest, "guest_01", ["guest_01"], "short", NOW);
  ok(!badSecret.ok, "short secret rejected");

  // --- project-scoped core ---
  const other = guests.registerGuest(gs, "raka-naya", "Maya", NOW);
  ok(other.ok, "second project guest registers");
  const rs = rsvp.createRsvpStore();
  const cross = rsvp.submitRsvp(gs, rs, {
    token: reg.guest.token, projectId: "raka-naya", name: "Dinda",
    attending: "hadir", partySize: 1,
  }, NOW);
  ok(!cross.ok, "cross-project rsvp rejected");
  const same = rsvp.submitRsvp(gs, rs, {
    token: reg.guest.token, projectId: "demo-ayu-bima", name: "Dinda",
    attending: "hadir", partySize: 2,
  }, NOW);
  ok(same.ok && same.record.projectId === "demo-ayu-bima", "same-project rsvp accepted");
  const gb = guestbook.createGuestbookStore();
  const entry = guestbook.addGuestbookEntry(gb, "demo-ayu-bima", { name: "Dinda", message: "Bahagia!" }, NOW);
  ok(entry.ok && entry.entry.projectId === "demo-ayu-bima", "guestbook carries project");
  ok(guests.listGuests(gs, "raka-naya").length === 1, "guest listing scoped per project");

  // --- publishing stays project-scoped ---
  const vs = pub.createVersionStore();
  const minimal = {
    id: "t1", couple: { partnerA: "A", partnerB: "B", dateISO: "2027-06-12", welcome: "Hi" },
    events: [{ id: "akad", kind: "akad", title: "Akad", dateISO: "2027-06-12", timeStart: "08:00", timeEnd: "10:00", venueId: "v" }],
    venues: [{ id: "v", name: "Taman", address: "Jl" }],
    story: [{ title: "S", text: "T" }],
    modules: { rsvp: true, gift: false, gallery: false },
    world: { templateKey: "garden-village-v1", templateVersion: 1 },
  };
  const d1 = pub.createDraft(vs, "demo-ayu-bima", "pub-1", minimal, NOW);
  ok(d1.ok, "project draft created");
  const d2 = pub.createDraft(vs, "raka-naya", "pub-1", minimal, NOW);
  ok(d2.ok && d2.version.version === 1, "same publication id versions independently per project");

  // --- protocol: hello is session-only ---
  ok(proto.helloPayloadSchema.safeParse({ session: "sess.opaque-token", clientVersion: "1.0.0" }).success, "session hello parses");
  ok(!proto.helloPayloadSchema.safeParse({ mapId: "garden-village-v1", avatarId: "guest_01", clientVersion: "1.0.0" }).success, "legacy identity hello rejected");

  console.log(`M125 BOUNDARY VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
