// M7 logic oracle: all three wedding fixtures validate (publication +
// bindings + quest chain) and the game runtime holds zero wedding-specific
// content. Prints M7 WEDDINGS VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M7 logic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m7logic-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "npc"],
    ["packages/contracts/src", "publication"],
    ["packages/contracts/src", "quest"],
    ["apps/web/src/weddings", "select"],
    ["apps/web/src/weddings", "demo-publication"],
    ["apps/web/src/weddings", "demo-bindings"],
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
  const req = createRequire(join(tmp, "x.js"));
  const npc = req(join(tmp, "npc.js"));
  const pub = req(join(tmp, "publication.js"));
  const quest = req(join(tmp, "quest.js"));
  const select = req(join(tmp, "select.js"));
  const demoPub = req(join(tmp, "demo-publication.js"));
  const demoBind = req(join(tmp, "demo-bindings.js"));
  const raka = req(join(tmp, "raka-naya.js"));
  const arvin = req(join(tmp, "arvin-selena.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  ok(JSON.stringify(select.WEDDING_IDS) === JSON.stringify(["demo-ayu-bima", "raka-naya", "arvin-selena"]), "three wedding ids registered");
  ok(select.resolveWeddingId() === "demo-ayu-bima", "node (no window) resolves the demo default");
  ok(demoPub.DEMO_PUBLICATION.id === "demo-ayu-bima-v1", "default publication is the demo couple");

  const def = quest.collectOurStoryDefinition();
  const weddings = [
    ["demo-ayu-bima", demoPub.DEMO_PUBLICATION_DATA ?? demoPub.DEMO_PUBLICATION, demoBind.DEMO_NPC_BINDINGS_DATA ?? demoBind.DEMO_NPC_BINDINGS],
    ["raka-naya", raka.RAKA_NAYA_PUBLICATION, raka.RAKA_NAYA_BINDINGS],
    ["arvin-selena", arvin.ARVIN_SELANA_PUBLICATION, arvin.ARVIN_SELANA_BINDINGS],
  ];
  const couples = new Set();
  for (const [id, publication, bindings] of weddings) {
    const v = pub.validatePublication(publication);
    ok(v.ok, `${id} publication validates${v.ok ? "" : `: ${v.errors.join("; ")}`}`);
    ok(publication.world.templateKey === "garden-village-v1", `${id} pins the garden template`);
    const avatars = [...new Set(bindings.map((b) => b.avatarId))];
    const bv = npc.validateNpcBindings(bindings, avatars);
    ok(bv.ok, `${id} bindings validate${bv.ok ? "" : `: ${bv.errors.join("; ")}`}`);
    const rewards = bindings.filter((b) => b.questRewardId).map((b) => b.questRewardId);
    ok(rewards.length === 4, `${id} assigns exactly four hearts`);
    for (const h of def.required) {
      ok(rewards.filter((x) => x === h).length === 1, `${id} heart ${h} assigned exactly once`);
    }
    const bySlot = (s) => bindings.find((b) => b.slotId === s);
    const acts = (b) => b.dialogue.filter((d) => d.action).map((d) => d.action.type);
    ok(acts(bySlot("npc.greeter")).includes("START_MAIN_QUEST"), `${id} greeter starts the quest`);
    const photo = acts(bySlot("npc.photographer"));
    ok(photo.includes("OPEN_GALLERY") && photo.includes("GRANT_HEART"), `${id} photographer chains gallery + grant`);
    ok(acts(bySlot("npc.couple_a")).includes("START_FINALE"), `${id} couple accepts the finale`);
    couples.add(`${publication.couple.partnerA} & ${publication.couple.partnerB}`);
  }
  ok(couples.size === 3, "three distinct couples");
  ok(
    [...couples].some((c) => c.includes("Raka") && c.includes("Naya")) &&
    [...couples].some((c) => c.includes("Arvin") && c.includes("Selena")),
    "Raka & Naya and Arvin & Selena present"
  );

  // zero wedding content inside the game runtime (data/config only milestone)
  const names = ["Ayu", "Bima", "Raka", "Naya", "Arvin", "Selena", "Lestari", "Pratama", "Aditya", "Maharani", "Nugraha"];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!p.endsWith(".ts")) continue;
      const src = readFileSync(p, "utf8");
      for (const name of names) {
        if (src.includes(name)) fail(`packages/game holds wedding content: ${p} mentions ${name}`);
        n++;
      }
    }
  };
  walk(join(ROOT, "packages/game/src"));

  console.log(`M7 WEDDINGS VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
