// M12.7 atomic oracle: activateExclusive issues exactly ONE statement and
// the statement itself validates the target — a failed activation changes
// nothing (the old active is never archived without a successor).
// Prints M127 ATOMIC VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M12.7 atomic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m127logic-"));
try {
  for (const [dir, mod] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "npc"],
    ["packages/contracts/src", "publication"],
    ["packages/contracts/src", "quest"],
    ["packages/contracts/src", "durable"],
    ["packages/wedding-core/src", "guests"],
    ["packages/wedding-core/src", "rsvp"],
    ["packages/wedding-core/src", "guestbook"],
    ["packages/wedding-core/src", "publishing"],
    ["packages/wedding-core/src", "store"],
    ["packages/wedding-core/src", "memory"],
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
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../npc.js"), require("../../../publication.js"), require("../../../quest.js"), require("../../../durable.js"));`
  );
  const req = createRequire(join(tmp, "x.js"));
  const store = req(join(tmp, "store.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  // one statement for the whole transition
  const seen = [];
  const fakePool = {
    async query(text, params = []) {
      seen.push({ text, params });
      return {
        rows: [{ id: "pv-2", project_id: "p1", publication_id: "pub", version: 2, status: "active", snapshot: {}, created_at: 1 }],
        rowCount: 1,
      };
    },
  };
  const db = new store.NeonStore(fakePool);
  const v = await db.activateExclusive("p1", "pub", "pv-2");
  ok(v.id === "pv-2" && v.status === "active", "returns the activated row");
  const writes = seen.filter((s) => s.text.includes("publication_versions"));
  ok(writes.length === 1, `exactly one write statement (saw ${writes.length})`);
  ok(writes[0].text.includes("WITH target AS"), "target CTE validates inside the statement");
  ok(writes[0].text.includes("ELSE 'archived' END"), "siblings archive in the same write");
  ok(/status = 'published'/.test(writes[0].text), "target must be published");

  // failure path: no matching published target -> zero rows -> throws,
  // and the single statement means no partial archive ever happened
  const db2 = new store.NeonStore({ async query() { return { rows: [], rowCount: 0 }; } });
  let threw = false;
  try {
    await db2.activateExclusive("p1", "pub", "pv-archived");
  } catch (e) {
    threw = String((e && e.message) || e).includes("activate-exclusive-no-row");
  }
  ok(threw, "non-published target throws without changing anything");

  console.log(`M127 ATOMIC VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
