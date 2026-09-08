// M5 logic oracle: quest reducer transitions + demo binding coverage + gate
// artifact schema. Transpiles the dependency-free sources with the repo's own
// typescript and runs the assertions.
// Prints M5 QUEST VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M5 logic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

// Transpile inside packages/contracts so runtime `require("zod")` resolves.
const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m5logic-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "npc"],
    ["packages/contracts/src", "quest"],
    ["packages/game/src/systems/quest", "quest-controller"],
    ["apps/web/src/weddings", "select"],
    ["apps/web/src/weddings", "raka-naya"],
    ["apps/web/src/weddings", "arvin-selena"],
    ["apps/web/src/weddings", "demo-bindings"],
  ]) {
    const src = readFileSync(join(ROOT, dir, `${name}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    if (out.diagnostics && out.diagnostics.length > 0) fail(`transpile errors in ${name}.ts`);
    writeFileSync(join(tmp, `${name}.js`), out.outputText);
  }
  const req = createRequire(join(tmp, "x.js"));
  const shared = req(join(tmp, "shared.js"));
  const npc = req(join(tmp, "npc.js"));
  const quest = req(join(tmp, "quest.js"));
  const qc = req(join(tmp, "quest-controller.js"));
  const demo = req(join(tmp, "demo-bindings.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  // --- definition + state schema ---
  const def = quest.collectOurStoryDefinition();
  ok(def.questId === "collect-our-story-v1", "quest id pinned");
  ok(JSON.stringify(def.required) === JSON.stringify(shared.heartIds), "required covers all four hearts");
  ok(quest.questDefinitionSchema.safeParse(def).success, "definition validates");
  ok(!quest.questDefinitionSchema.safeParse({ ...def, required: [def.required[0], def.required[0], def.required[2], def.required[3]] }).success, "duplicate required heart rejected");
  const init = quest.initialQuestState();
  ok(quest.questStateSchema.safeParse(init).success, "initial state validates");

  // --- start once ---
  let s = qc.createQuestState(def);
  let r = qc.startQuest(def, s);
  ok(r.ok && r.state.status === "active", "start activates idle quest");
  r = qc.startQuest(def, r.state);
  ok(r.ok && r.state.status === "active", "re-start is a no-op success");
  const wrong = { ...s, questId: "side-quest-nope" };
  ok(!qc.startQuest(def, wrong).ok, "unknown quest rejected on start");
  ok(!qc.grantHeart(def, wrong, def.required[0]).ok, "unknown quest rejected on grant");

  // --- grant rules ---
  ok(!qc.grantHeart(def, s, def.required[0]).ok, "grant before start rejected");
  let active = qc.startQuest(def, s).state;
  ok(!qc.grantHeart(def, active, "heart.nope").ok, "unknown heart rejected");

  // out-of-canonical-order completion: proposal, journey, memories, first_meeting
  const order = ["heart.proposal", "heart.journey", "heart.memories", "heart.first_meeting"];
  let cur = active;
  order.forEach((h, i) => {
    const g = qc.grantHeart(def, cur, h);
    ok(g.ok && g.granted === h, `grant ${h} accepted`);
    ok(g.completed === (i === 3), `completed flips only on the fourth heart (${h})`);
    cur = g.state;
  });
  ok(cur.status === "complete" && cur.finaleUnlocked, "fourth heart completes + unlocks finale");
  ok(quest.questStateSchema.safeParse(cur).success, "completed state validates");
  const dup = qc.grantHeart(def, cur, "heart.proposal");
  ok(dup.ok && dup.granted === null && dup.state.collected.length === 4, "duplicate ignored, still complete");
  ok(qc.missingHearts(def, active).length === 4, "nothing collected yet reports four missing");
  const partial = qc.grantHeart(def, active, "heart.journey").state;
  ok(JSON.stringify(qc.missingHearts(def, partial)) !== JSON.stringify([]) && !qc.missingHearts(def, partial).includes("heart.journey"), "missing tracks partial progress");

  // --- demo binding coverage ---
  const bindings = demo.DEMO_NPC_BINDINGS;
  ok(Array.isArray(bindings) && bindings.length === 10, "ten demo bindings present");
  bindings.forEach((b, i) => {
    ok(npc.npcBindingSchema.safeParse(b).success, `binding ${i} (${b.slotId}) validates`);
  });
  const rewards = bindings.filter((b) => b.questRewardId).map((b) => b.questRewardId);
  ok(rewards.length === 4, "exactly four heart rewards assigned");
  for (const h of def.required) {
    ok(rewards.filter((x) => x === h).length === 1, `heart ${h} assigned exactly once`);
  }
  const bySlot = (id) => bindings.find((b) => b.slotId === id);
  const actionTypes = (b) => b.dialogue.filter((d) => d.action).map((d) => d.action.type);
  ok(actionTypes(bySlot("npc.greeter")).includes("START_MAIN_QUEST"), "greeter starts the quest");
  const photo = actionTypes(bySlot("npc.photographer"));
  ok(photo.includes("OPEN_GALLERY") && photo.includes("GRANT_HEART"), "photographer chains gallery + grant");
  ok(actionTypes(bySlot("npc.couple_a")).includes("START_FINALE"), "couple accepts the finale");

  // --- gate artifact ---
  for (const p of [
    "assets-source/tiled/garden-village-v1/gates.json",
    "apps/web/public/assets/worlds/garden-village-v1/gates.json",
  ]) {
    const doc = JSON.parse(readFileSync(join(ROOT, p), "utf8"));
    const g = quest.gateFileSchema.safeParse(doc);
    ok(g.success, `${p} validates against gateFileSchema`);
    const gate = g.data.gates[0];
    ok(gate.lockedTiles.some((t) => t.x === 27 && t.y === 9), `${p} locks the finale center tile`);
  }
  ok(!quest.gateFileSchema.safeParse({ templateKey: "garden-village-v1", version: 1, gates: [] }).success, "empty gates rejected");

  console.log(`M5 QUEST VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
