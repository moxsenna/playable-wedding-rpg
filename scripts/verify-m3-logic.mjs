// M3 logic oracle: NPC schemas + pure interaction/dialogue/dispatch, in node.
// Transpiles the dependency-free sources with the repo's own typescript
// (no duplication) and runs the assertions. Prints M3 LOGIC VERIFIED only
// when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M3 logic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

// Transpile inside packages/contracts so runtime `require("zod")` resolves
// from the workspace layout without env hacks.
const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m3logic-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "index"],
    ["packages/contracts/src", "npc"],
    ["packages/game/src/systems/interaction", "select"],
    ["packages/game/src/systems", "dialogue-runtime"],
    ["packages/game/src/systems", "semantic-actions"],
  ]) {
    const src = readFileSync(join(ROOT, dir, `${name}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    if (out.diagnostics && out.diagnostics.length > 0) fail(`transpile errors in ${name}.ts`);
    writeFileSync(join(tmp, `${name}.js`), out.outputText);
  }
  const req = createRequire(join(tmp, "x.js"));
  const npc = req(join(tmp, "npc.js"));
  const select = req(join(tmp, "select.js"));
  const dlg = req(join(tmp, "dialogue-runtime.js"));
  const sem = req(join(tmp, "semantic-actions.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  const AVATARS = ["guest_01", "npc_greeter", "npc_keeper"];
  const goodBinding = (over = {}) => ({
    slotId: "npc.greeter",
    npcId: "maya_greeter",
    role: "greeter",
    displayName: "Maya",
    avatarId: "npc_greeter",
    dialogue: [{ id: "hi", text: "Halo!" }],
    ...over,
  });
  const tenBindings = () => [
    "npc.greeter", "npc.rsvp_keeper", "npc.story_keeper", "npc.photographer",
    "npc.travel_friend", "npc.event_coordinator", "npc.venue_guide",
    "npc.proposal_friend", "npc.couple_a", "npc.couple_b",
  ].map((slotId, i) => goodBinding({ slotId, npcId: `npc_${i}`, avatarId: "npc_greeter" }));

  // --- binding validation ---
  let r = npc.validateNpcBindings(tenBindings(), AVATARS);
  ok(r.ok && r.bindings.length === 10, "ten valid bindings pass");

  r = npc.validateNpcBindings([goodBinding({ slotId: "npc.nope" })], AVATARS);
  ok(!r.ok, "unknown slot id rejected");

  const dup = tenBindings();
  dup.push(goodBinding({ slotId: "npc.greeter", npcId: "greeter_two" }));
  r = npc.validateNpcBindings(dup, AVATARS);
  ok(!r.ok && r.errors.some((e) => e.includes("duplicate slot")), "duplicate slot rejected");

  const missing = tenBindings().filter((b) => b.slotId !== "npc.couple_b");
  r = npc.validateNpcBindings(missing, AVATARS);
  ok(!r.ok && r.errors.some((e) => e.includes("missing required slot")), "missing slot rejected");

  const badAvatar = tenBindings().map((b) => ({ ...b, avatarId: "ghost_xyz" }));
  r = npc.validateNpcBindings(badAvatar, AVATARS);
  ok(!r.ok && r.errors.some((e) => e.includes("unknown avatarId")), "unknown avatar rejected");

  r = npc.validateNpcBindings([goodBinding({
    dialogue: [{ id: "a", text: "Hi", action: { type: "DELETE_EVERYTHING" } }],
  })], AVATARS);
  ok(!r.ok, "unknown semantic action rejected by schema");

  r = npc.validateNpcBindings([goodBinding({
    dialogue: [
      { id: "a", text: "Hi", next: "b" },
      { id: "a", text: "dup", next: "ghost" },
    ],
  })], AVATARS);
  ok(!r.ok, "duplicate node id + dangling next rejected");

  r = npc.validateNpcBindings([goodBinding({ dialogue: [] })], AVATARS);
  ok(!r.ok, "empty dialogue rejected");

  const deep = tenBindings().map((b, i) => i === 0 ? {
    ...b,
    dialogue: [{ id: "a", text: "Lihat!", action: { type: "OPEN_WEDDING_BOOK_SECTION", section: "events" } }],
    actions: [{ type: "OPEN_WEDDING_BOOK_SECTION", section: "events" }],
  } : b);
  r = npc.validateNpcBindings(deep, AVATARS);
  ok(r.ok, "section deep-link action validates");

  // --- selection ---
  const P = select.PRIORITY;
  const pose = (x, y, fx, fy) => ({ x, y, facingX: fx, facingY: fy });
  const cand = (id, x, y, priority = P.npc, enabled = true) => ({ id, x, y, priority, enabled });
  ok(select.selectTarget([], pose(0, 0, 1, 0)) === null, "empty set selects nothing");
  ok(select.selectTarget(
    [cand("a", 30, 0), cand("b", 20, 0)], pose(0, 0, 1, 0)) === "b", "nearest wins");
  ok(select.selectTarget(
    [cand("a", 20, 0, P.npc, false), cand("b", 30, 0)], pose(0, 0, 1, 0)) === "b", "disabled skipped");
  ok(select.selectTarget([cand("a", 200, 0)], pose(0, 0, 1, 0)) === null, "out of radius skipped");
  ok(select.selectTarget(
    [cand("quest", 28, 0, P.quest), cand("npc", 22, 0, P.npc)], pose(0, 0, 1, 0)) === "quest",
    "quest priority beats slightly nearer npc");
  ok(select.selectTarget(
    [cand("behind", 27, 0, P.npc), cand("front", 30, 0, P.npc)], pose(0, 0, -1, 0)) === "behind",
    "facing bias prefers the NPC ahead (spec example mirrored)");
  ok(select.selectTarget(
    [cand("b", 20, 0), cand("a", 20, 0)], pose(0, 0, 1, 0)) === "a", "ties break by id");

  // --- labels ---
  const L = select.labelForActions;
  ok(L([]) === "Bicara", "default label");
  ok(L([{ type: "OPEN_RSVP" }]) === "RSVP", "rsvp label");
  ok(L([{ type: "OPEN_GALLERY" }]) === "Lihat Foto", "gallery label");
  ok(L([{ type: "OPEN_WEDDING_BOOK_SECTION", section: "events" }]) === "Lihat Acara", "events label");
  ok(L([{ type: "OPEN_WEDDING_BOOK_SECTION", section: "venue" }]) === "Lihat Lokasi", "venue label");
  ok(L([{ type: "OPEN_MAPS" }]) === "Lihat Lokasi", "maps label");

  // --- dialogue runtime ---
  const rt = new dlg.DialogueRuntime([
    { id: "hi", text: "Halo!", next: "go" },
    { id: "go", text: "Lihat galeri.", action: { type: "OPEN_GALLERY" } },
  ]);
  let ev = rt.start();
  ok(ev.kind === "line" && ev.line.id === "hi", "starts at first line");
  ev = rt.advance("hi");
  ok(ev.kind === "line" && ev.line.id === "go", "linear advance");
  ev = rt.advance("go");
  ok(ev.kind === "action" && ev.action.type === "OPEN_GALLERY" && ev.resumeId === null, "terminal action emits with null resume");
  ev = rt.advance("missing");
  ok(ev.kind === "done", "unknown id ends cleanly");
  const rt2 = new dlg.DialogueRuntime([
    { id: "a", text: "A", action: { type: "GRANT_HEART" }, next: "b" },
    { id: "b", text: "B" },
  ]);
  ev = rt2.advance("a");
  ok(ev.kind === "action" && ev.resumeId === "b", "mid-dialogue action carries resume");

  // --- dispatch ---
  let d = sem.dispatchSemanticAction("OPEN_RSVP");
  ok(d.handled && d.deferred === "react", "rsvp defers to react");
  d = sem.dispatchSemanticAction("GRANT_HEART");
  ok(d.handled && d.deferred === "quest", "heart defers to quest (M5)");
  d = sem.dispatchSemanticAction("DELETE_EVERYTHING");
  ok(!d.handled, "unknown action rejected");

  console.log(`M3 LOGIC VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
