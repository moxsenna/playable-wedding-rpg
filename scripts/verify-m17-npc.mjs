// M17 NPC oracle: pure Studio operations keep dialogue chains, slot
// uniqueness, and heart assignment valid. Prints M17 NPC VERIFIED.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M17 NPC check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m17npc-"));
try {
  const src = readFileSync(join(ROOT, "apps/web/src/studio/npcOps.ts"), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  writeFileSync(join(tmp, "npcOps.js"), out.outputText);
  const req = createRequire(join(tmp, "x.js"));
  const ops = req(join(tmp, "npcOps.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  const chain = [
    { id: "hello", text: "Hai", next: "quest" },
    { id: "quest", text: "Misi", next: "bye" },
    { id: "bye", text: "Dadah" },
  ];
  const added = ops.addDialogueNode(chain, "Baru");
  ok(added.length === 4 && added[2].next === added[3].id, "added node linked from tail");
  ok(new Set(added.map((x) => x.id)).size === 4, "added node id unique");

  const del = ops.deleteDialogueNode(added, added[3].id);
  ok(del.deleted && del.nodes.length === 3 && del.nodes[2].next === undefined, "tail delete drops cleanly");
  const mid = ops.deleteDialogueNode(chain, "quest");
  ok(mid.deleted && mid.nodes.length === 2, "middle delete shrinks");
  ok(mid.nodes.find((x) => x.id === "hello").next === "bye", "refs retarget to deleted next");
  const entry = ops.deleteDialogueNode(chain, "hello");
  ok(!entry.deleted && entry.nodes.length === 3, "entry node protected");
  const missing = ops.deleteDialogueNode(chain, "nope");
  ok(!missing.deleted, "unknown node rejected");

  const moved = ops.moveItem([1, 2, 3], 0, 2);
  ok(JSON.stringify(moved) === "[2,3,1]", "ordered move works");
  ok(ops.moveItem([1], 0, 5).length === 1, "out-of-range move is a no-op");

  const bindings = [
    { slotId: "npc.greeter", questRewardId: "heart.first_meeting" },
    { slotId: "npc.photographer", questRewardId: "heart.memories" },
    { slotId: "npc.rsvp_keeper" },
  ];
  const swapped = ops.swapSlots(bindings, "npc.greeter", "npc.photographer");
  ok(swapped.find((b) => b.questRewardId === "heart.first_meeting").slotId === "npc.photographer", "swap carries content");
  ok(swapped.find((b) => b.slotId === "npc.greeter").questRewardId === "heart.memories", "swap is symmetric");
  ok(ops.swapSlots(bindings, "npc.greeter", "npc.greeter") === bindings, "self swap is identity");

  const reassigned = ops.moveHeart(bindings, "heart.first_meeting", "npc.rsvp_keeper");
  ok(reassigned.find((b) => b.slotId === "npc.rsvp_keeper").questRewardId === "heart.first_meeting", "heart moves");
  ok(!("questRewardId" in reassigned.find((b) => b.slotId === "npc.greeter")), "old holder cleared");

  const rows = ops.heartAssignments([
    ...bindings,
    { slotId: "npc.travel_friend", questRewardId: "heart.journey" },
    { slotId: "npc.proposal_friend", questRewardId: "heart.proposal" },
  ]);
  ok(rows.length === 4 && rows.every((r) => r.slotId !== null), "all four hearts resolve to slots");

  ok(ops.uniqueId("event", ["event-1", "event-2"]) === "event-3", "unique id skips taken");

  console.log(`M17 NPC VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
