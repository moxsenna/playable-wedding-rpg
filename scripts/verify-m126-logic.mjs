// M12.6 store oracle: NeonStore SQL + single-active guard + no-memory-
// fallback, asserted against a fake DbPool (no credentials). Also covers the
// MemoryStore dev adapter contract.
// Prints M126 STORE VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M12.6 store check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m126logic-"));
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
  const memory = req(join(tmp, "memory.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  // fake pool records every statement
  const seen = [];
  const fakePool = {
    async query(text, params = []) {
      seen.push({ text, params });
      if (text.includes("COALESCE(MAX(version)")) return { rows: [{ m: 2 }], rowCount: 1 };
      if (text.includes("WITH target AS")) {
        return {
          rows: [{ id: "pv-1", project_id: "p1", publication_id: "pub", version: 3, status: "active", snapshot: {}, created_at: 1 }],
          rowCount: 1,
        };
      }
      if (text.includes("COUNT(*)")) return { rows: [{ c: 7 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  };
  const db = new store.NeonStore(fakePool);

  // upsert uses parameterized SQL, never string interpolation of values
  await db.upsertRsvp({ token: "gt_x", projectId: "p1", name: "Dinda", attending: "hadir", partySize: 2, updatedAt: 5 });
  const up = seen.find((s) => s.text.includes("INSERT INTO rsvps"));
  ok(up && up.params[0] === "gt_x" && up.text.includes("$1"), "rsvp upsert parameterized");
  ok(!up.text.includes("gt_x"), "no value interpolated into SQL");

  // activateExclusive is ONE statement: archive + activate atomically.
  // Exactly one query may touch publication_versions here.
  const before = seen.length;
  await db.activateExclusive("p1", "pub", "pv-1");
  const touched = seen.slice(before).filter((s) => s.text.includes("publication_versions"));
  ok(touched.length === 1, `single atomic statement (saw ${touched.length})`);
  const stmt = touched[0];
  ok(stmt.text.includes("WITH target AS"), "target validated inside the statement");
  // (M17: literals carry ::version_status casts because the status
  // column is a Postgres enum; the archived-sibling semantic is unchanged.)
  ok(stmt.text.includes("ELSE 'archived'"), "archive + activate in one write");
  ok(/status = 'published'/.test(stmt.text), "target must be published");

  // empty activate result throws (caller maps to 409, never two actives)
  const emptyPool = { async query() { return { rows: [], rowCount: 0 }; } };
  const db2 = new store.NeonStore(emptyPool);
  let threw = false;
  try {
    await db2.activateExclusive("p1", "pub", "pv-x");
  } catch (e) {
    threw = String((e && e.message) || e).includes("activate-exclusive-no-row");
  }
  ok(threw, "activate with no published row throws");

  // no silent fallback: api source must refuse boot without DATABASE_URL
  const apiSrc = readFileSync(join(ROOT, "apps/api/src/api.ts"), "utf8");
  ok(apiSrc.includes("DATABASE_URL missing"), "api refuses boot without DATABASE_URL");
  ok(apiSrc.includes("DEV_MEMORY_STORE"), "memory only behind explicit dev flag");
  const memRefs = (apiSrc.match(/createGuestStore|createRsvpStore|createGuestbookStore|createVersionStore|SEED_JSON/g) || []).length;
  ok(memRefs === 0, "api has no in-memory stores or seed fixtures left");

  // memory adapter still satisfies the interface (dev + probes)
  const mem = new memory.MemoryStore();
  const now = Date.now();
  const g = await (async () => {
    const { registerGuest, createGuestStore } = req(join(tmp, "guests.js"));
    const gs = createGuestStore();
    return registerGuest(gs, "p1", "Dinda", now);
  })();
  ok(g.ok, "dev guest registers (memory)");
  const up2 = await mem.upsertRsvp({ token: "gt_dev", projectId: "p1", name: "Dinda", attending: "hadir", partySize: 1, updatedAt: now });
  ok(up2.created, "memory upsert creates");
  const up3 = await mem.upsertRsvp({ ...up2.record, partySize: 3 });
  ok(!up3.created && up3.record.partySize === 3, "memory upsert updates");
  const v1 = { id: "v1", projectId: "p1", publicationId: "pub", version: 1, status: "published", snapshot: {}, createdAt: now };
  const v2 = { id: "v2", projectId: "p1", publicationId: "pub", version: 2, status: "published", snapshot: {}, createdAt: now };
  await mem.insertVersion(v1);
  await mem.insertVersion(v2);
  await mem.updateVersionStatus("v1", "active");
  const ex = await mem.activateExclusive("p1", "pub", "v2");
  ok(ex.id === "v2", "memory exclusive activate flips target");
  const act2 = await mem.findActive("p1", "pub");
  ok(act2 && act2.id === "v2", "exactly one active after exclusive activate");
  const old = await mem.findVersion("v1");
  ok(old && old.status === "archived", "sibling archived");

  console.log(`M126 STORE VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
