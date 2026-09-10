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
  ok(writes[0].text.includes("ELSE 'archived'"), "siblings archive in the same write");
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

  // transactional path: archive-then-activate as one transaction, where
  // every statement is individually consistent, so no physical row order
  // can transiently duplicate the single-active flag (single UPDATEs can:
  // the swap races the partial unique index depending on visit order).
  // Simulated table honors real unique semantics: duplicate active rows
  // throw, which is exactly what the legacy shape risks.
  const table = [
    { id: "pv-1", project_id: "p1", publication_id: "pub", version: 1, status: "active", snapshot: {}, created_at: 1 },
    { id: "pv-2", project_id: "p1", publication_id: "pub", version: 2, status: "published", snapshot: {}, created_at: 2 },
    { id: "pv-3", project_id: "p1", publication_id: "pub", version: 3, status: "published", snapshot: {}, created_at: 3 },
  ];
  const txnPool = {
    async query(text, params = []) {
      return (await this.transact([{ text, params }]))[0];
    },
    async transact(statements) {
      const backup = JSON.parse(JSON.stringify(table));
      const results = [];
      try {
        for (const s of statements) {
          results.push(this.apply(s.text, s.params ?? []));
        }
      } catch (e) {
        for (let i = 0; i < table.length; i++) table[i] = backup[i];
        throw e;
      }
      return results;
    },
    apply(text, params) {
      const scoped = table.filter((r) => r.project_id === params[0] && r.publication_id === params[1]);
      if (/SET status = 'archived'/.test(text)) {
        const targetPublished = table.some((r) => r.id === params[2] && r.status === "published");
        if (targetPublished) {
          for (const r of scoped) {
            if (r.status === "active") r.status = "archived";
          }
        }
        this.checkUnique();
        return { rows: scoped.map((r) => ({ ...r })) };
      }
      if (/SET status = 'active'/.test(text)) {
        const target = scoped.find((r) => r.id === params[2] && r.status === "published");
        if (!target) return { rows: [] };
        target.status = "active";
        this.checkUnique();
        return { rows: [{ ...target }] };
      }
      return { rows: [] };
    },
    checkUnique() {
      const seen = new Set();
      for (const r of table) {
        if (r.status !== "active") continue;
        const k = `${r.project_id}/${r.publication_id}`;
        if (seen.has(k)) throw new Error('duplicate key value violates unique constraint "pubver_single_active"');
        seen.add(k);
      }
    },
  };
  const db3 = new store.NeonStore(txnPool);
  const a = await db3.activateExclusive("p1", "pub", "pv-2");
  ok(a.id === "pv-2" && a.status === "active", "transactional path activates the target");
  ok(table.find((r) => r.id === "pv-1").status === "archived", "old active archived");
  ok(table.find((r) => r.id === "pv-3").status === "published", "staged versions preserved");
  const b = await db3.activateExclusive("p1", "pub", "pv-3");
  ok(b.id === "pv-3" && b.status === "active", "re-activation swaps cleanly");
  let threw3 = false;
  try {
    await db3.activateExclusive("p1", "pub", "pv-1");
  } catch (e) {
    threw3 = String((e && e.message) || e).includes("activate-exclusive-no-row");
  }
  ok(threw3, "archived target throws");
  ok(table.find((r) => r.id === "pv-3").status === "active", "failed activation keeps current active");

  console.log(`M127 ATOMIC VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
