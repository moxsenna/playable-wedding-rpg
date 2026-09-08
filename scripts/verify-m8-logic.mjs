// M8 logic oracle: durable domain services (guests, RSVP, guestbook,
// publication lifecycle, audit) over the new contracts. Core sources import
// @wedding-rpg/contracts, so the tmp tree carries a package shim that maps
// the workspace import onto the transpiled contract modules.
// Prints M8 CORE VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M8 logic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m8logic-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "npc"],
    ["packages/contracts/src", "publication"],
    ["packages/contracts/src", "quest"],
    ["packages/contracts/src", "durable"],
    ["packages/wedding-core/src", "guests"],
    ["packages/wedding-core/src", "rsvp"],
    ["packages/wedding-core/src", "guestbook"],
    ["packages/wedding-core/src", "publishing"],
    ["packages/wedding-core/src", "audit"],
    ["apps/web/src/weddings", "demo-publication"],
    ["apps/web/src/weddings", "select"],
    ["apps/web/src/weddings", "raka-naya"],
    ["apps/web/src/weddings", "arvin-selena"],
  ]) {
    const src = readFileSync(join(ROOT, dir, `${name}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    if (out.diagnostics && out.diagnostics.length > 0) fail(`transpile errors in ${name}.ts`);
    writeFileSync(join(tmp, `${name}.js`), out.outputText);
  }
  // Shim @wedding-rpg/contracts onto the transpiled modules.
  const shimDir = join(tmp, "node_modules", "@wedding-rpg", "contracts");
  mkdirSync(shimDir, { recursive: true });
  writeFileSync(join(shimDir, "package.json"), JSON.stringify({ name: "@wedding-rpg/contracts", main: "index.js" }));
  writeFileSync(
    join(shimDir, "index.js"),
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../npc.js"), require("../../../publication.js"), require("../../../quest.js"), require("../../../durable.js"));`
  );
  // Core files import relatively; rebase them next to the shim target.
  for (const name of ["guests", "rsvp", "guestbook", "publishing", "audit"]) {
    const src = readFileSync(join(tmp, `${name}.js`), "utf8");
    writeFileSync(join(tmp, `${name}.js`), src);
  }

  const req = createRequire(join(tmp, "x.js"));
  const durable = req(join(tmp, "durable.js"));
  const guests = req(join(tmp, "guests.js"));
  const rsvp = req(join(tmp, "rsvp.js"));
  const guestbook = req(join(tmp, "guestbook.js"));
  const pub = req(join(tmp, "publishing.js"));
  const audit = req(join(tmp, "audit.js"));
  const demo = req(join(tmp, "demo-publication.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };
  const NOW = 1788000000;

  // --- guests + tokens ---
  const gs = guests.createGuestStore();
  let r = guests.registerGuest(gs, "  Dinda  ", NOW);
  ok(r.ok && r.guest.name === "Dinda" && r.guest.token.startsWith("gt_"), "guest registered with token");
  ok(durable.guestTokenSchema.safeParse(r.guest.token).success, "token matches schema");
  const token = r.guest.token;
  ok(!guests.registerGuest(gs, "   ", NOW).ok, "blank name rejected");
  ok(guests.findGuestByToken(gs, token)?.name === "Dinda", "token lookup hits");
  ok(guests.findGuestByToken(gs, "gt_nope") === null, "unknown token misses");
  ok(guests.findGuestByToken(gs, "not-a-token") === null, "malformed token misses");

  // --- rsvp upsert per token ---
  const rs = rsvp.createRsvpStore();
  let s = rsvp.submitRsvp(gs, rs, { token, name: "Dinda", attending: "hadir", partySize: 2 }, NOW);
  ok(s.ok && s.created && s.record.partySize === 2, "rsvp created");
  s = rsvp.submitRsvp(gs, rs, { token, name: "Dinda", attending: "tidak", partySize: 1 }, NOW + 1);
  ok(s.ok && !s.created && s.record.attending === "tidak" && rs.records.length === 1, "rsvp upserted per token");
  ok(!rsvp.submitRsvp(gs, rs, { token: "gt_nope", name: "X", attending: "hadir", partySize: 1 }, NOW).ok, "rsvp with unknown token rejected");
  ok(!rsvp.submitRsvp(gs, rs, { token, name: "Dinda", attending: "hadir", partySize: 9 }, NOW).ok, "partySize 9 rejected");
  ok(!rsvp.submitRsvp(gs, rs, { token, name: "", attending: "hadir", partySize: 1 }, NOW).ok, "blank rsvp name rejected");

  // --- guestbook ---
  const gb = guestbook.createGuestbookStore();
  let g = guestbook.addGuestbookEntry(gb, { name: "Maya", message: "Bahagia selalu!" }, NOW);
  ok(g.ok && g.entry.id === "gb-1", "guestbook entry accepted");
  ok(!guestbook.addGuestbookEntry(gb, { name: "M", message: "x".repeat(281) }, NOW).ok, "281-char message rejected");
  ok(!guestbook.addGuestbookEntry(gb, { name: "M", message: "lihat http://spam.example" }, NOW).ok, "link rejected");

  // --- publication lifecycle over the real demo fixture ---
  const vs = pub.createVersionStore();
  const snapshot = demo.DEMO_PUBLICATION_DATA ?? demo.DEMO_PUBLICATION;
  let d = pub.createDraft(vs, "demo-ayu-bima-v1", snapshot, NOW);
  ok(d.ok && d.version.status === "draft" && d.version.version === 1, "draft v1 created");
  ok(Object.isFrozen(d.version.snapshot), "snapshot immutable");
  ok(!pub.createDraft(vs, "demo-ayu-bima-v1", { ...snapshot, events: [] }).ok, "invalid snapshot never drafts");
  const draftId = d.version.id;
  ok(!pub.activateVersion(vs, draftId).ok, "draft cannot activate directly");
  let p = pub.publishDraft(vs, draftId);
  ok(p.ok && p.version.status === "published", "draft publishes");
  ok(!pub.publishDraft(vs, draftId).ok, "re-publish rejected");
  let a = pub.activateVersion(vs, draftId);
  ok(a.ok && a.version.status === "active", "published version activates");
  ok(pub.activeVersion(vs, "demo-ayu-bima-v1")?.id === draftId, "active pinned");
  d = pub.createDraft(vs, "demo-ayu-bima-v1", snapshot, NOW + 1);
  pub.publishDraft(vs, d.version.id);
  pub.activateVersion(vs, d.version.id);
  ok(pub.activeVersion(vs, "demo-ayu-bima-v1")?.version === 2, "v2 supersedes");
  ok(vs.versions.find((v) => v.id === draftId)?.status === "archived", "v1 archived on supersede");
  ok(!pub.publishDraft(vs, "pv-nope").ok, "unknown version rejected");

  // --- audit ---
  const as = audit.createAuditStore();
  const ev = audit.recordAudit(as, { actor: "admin", action: "publish", detail: draftId }, NOW);
  ok(ev.id === "ae-1" && as.events.length === 1, "audit appended");

  console.log(`M8 CORE VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
