// M17 envelope oracle: validated {publication, npcBindings} snapshots
// persist through the version lifecycle; legacy bare snapshots keep
// reading. Prints M17 ENVELOPE VERIFIED.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M17 envelope check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m17env-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "npc"],
    ["packages/contracts/src", "publication"],
    ["packages/contracts/src", "snapshot"],
    ["packages/wedding-core/src", "snapshots"],
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
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../npc.js"), require("../../../publication.js"), require("../../../snapshot.js"));`
  );
  const req = createRequire(join(tmp, "x.js"));
  const shared = req(join(tmp, "shared.js"));
  const pub = req(join(tmp, "publication.js"));
  const snaps = req(join(tmp, "snapshots.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  const goodPub = {
    id: "env-probe",
    couple: { partnerA: "Ayu", partnerB: "Bima", dateISO: "2027-06-12", welcome: "Hai!" },
    events: [{ id: "akad", kind: "akad", title: "Akad Nikah", dateISO: "2027-06-12", timeStart: "08:00", timeEnd: "10:00", venueId: "taman" }],
    venues: [{ id: "taman", name: "Taman Kebahagiaan", address: "Jl. Mawar 8" }],
    story: [{ title: "Awal", text: "Bertemu di kedai kopi." }],
    modules: { rsvp: true, gift: false, gallery: false },
    world: { templateKey: "garden-village-v1", templateVersion: 1 },
  };
  const goodBindings = shared.npcSlotIds.map((slotId, i) => ({
    slotId,
    npcId: `npc_${i}`,
    role: "decorative",
    displayName: `NPC ${i}`,
    avatarId: "guest_01",
    dialogue: [{ id: "hello", text: "Halo!" }],
    actions: [],
    ...(i < 4 ? { questRewardId: ["heart.first_meeting", "heart.memories", "heart.journey", "heart.proposal"][i] } : {}),
  }));

  let v = snaps.validateSnapshot({ publication: goodPub, npcBindings: goodBindings });
  ok(v.ok && v.snapshot !== null, "valid envelope validates");
  ok(v.snapshot.publication.couple.partnerA === "Ayu", "publication survives");
  ok(v.snapshot.npcBindings.length === 10, "bindings survive");

  v = snaps.validateSnapshot({ publication: goodPub, npcBindings: goodBindings.slice(0, 9) });
  ok(!v.ok, "missing slot rejected");

  const dupes = [...goodBindings];
  dupes[1] = { ...dupes[1], slotId: dupes[0].slotId };
  v = snaps.validateSnapshot({ publication: goodPub, npcBindings: dupes });
  ok(!v.ok, "duplicate slot rejected");

  const noHearts = goodBindings.map((b) => {
    const c = { ...b };
    delete c.questRewardId;
    return c;
  });
  v = snaps.validateSnapshot({ publication: goodPub, npcBindings: noHearts });
  ok(!v.ok, "missing heart assignment rejected");

  v = snaps.validateSnapshot({ publication: { ...goodPub, events: [] }, npcBindings: goodBindings });
  ok(!v.ok, "invalid publication rejected inside envelope");

  v = snaps.validateSnapshot({ publication: goodPub });
  ok(!v.ok, "bare object without bindings is not an envelope");

  v = snaps.validateVersionSnapshot({ publication: goodPub, npcBindings: goodBindings });
  ok(v.ok && v.snapshot !== null, "version entry accepts the envelope");
  v = snaps.validateVersionSnapshot(goodPub);
  ok(v.ok && v.snapshot !== null, "version entry still accepts legacy bare publications");
  v = snaps.validateVersionSnapshot({ nope: true });
  ok(!v.ok, "garbage version snapshot rejected");

  const read = snaps.readSnapshot({ publication: goodPub, npcBindings: goodBindings });
  ok(read !== null && read.npcBindings.length === 10, "envelope unwraps");
  const legacy = snaps.readSnapshot(goodPub);
  ok(legacy !== null && legacy.npcBindings.length === 0, "legacy bare unwraps with empty bindings");
  ok(snaps.readSnapshot({ nope: true }) === null, "garbage read rejects");
  ok(snaps.readSnapshot({ publication: goodPub, npcBindings: [] }) === null, "envelope with empty bindings rejects");

  const stripped = pub.validatePublication({ ...goodPub, npcBindings: goodBindings });
  ok(stripped.ok && !("npcBindings" in (stripped.publication ?? {})), "negative control: bare parser strips bindings");

  v = snaps.validateSnapshot({ publication: { ...goodPub, couple: { ...goodPub.couple, nicknameA: "Ayu", bio: "Hai" }, gallery: [{ src: "https://x.example/a.png", alt: "A", cover: true }], gift: { bankName: "B", accountNumber: "1", accountName: "AB", ewalletProvider: "DANA", ewalletNumber: "0812", registryUrl: "https://x.example/r" } }, npcBindings: goodBindings });
  ok(v.ok, "additive M17 fields validate");

  const badCover = JSON.parse(JSON.stringify(goodPub));
  badCover.gallery = [
    { src: "https://x.example/a.png", alt: "A", cover: true },
    { src: "https://x.example/b.png", alt: "B", cover: true },
  ];
  v = snaps.validateSnapshot({ publication: badCover, npcBindings: goodBindings });
  ok(!v.ok, "double gallery cover rejected");

  console.log(`M17 ENVELOPE VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
