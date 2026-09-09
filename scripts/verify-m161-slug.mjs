// M16.1 slug oracle: uniqueness enforced by the database, API maps
// conflicts to 409, token races retry. Prints M161 SLUG VERIFIED.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M16.1 slug check FAILED: ${msg}`); process.exit(1); };

let n = 0;
const ok = (cond, msg) => {
  n++;
  if (!cond) fail(`assertion ${n}: ${msg}`);
};

const mig = readFileSync(join(ROOT, "drizzle/migrations/0003_m161_slug_unique.sql"), "utf8");
ok(mig.includes('CREATE UNIQUE INDEX "projects_slug_unique"'), "migration creates unique slug index");
ok(mig.replace(/"slug" = "id"/, "").includes("slug") && mig.includes('"slug" = "id"'), "migration backfills empty slugs from id");
ok(mig.indexOf("UPDATE") < mig.indexOf("CREATE UNIQUE INDEX"), "backfill runs before the unique index");

const schema = readFileSync(join(ROOT, "drizzle/schema.ts"), "utf8");
ok(schema.includes('uniqueIndex("projects_slug_unique")'), "schema declares unique slug index");

const store = readFileSync(join(ROOT, "packages/wedding-core/src/store.ts"), "utf8");
ok(store.includes("23505") && store.includes("slug-taken"), "store maps unique violations to slug-taken");
ok(store.includes("token-taken"), "store maps token races to token-taken");
ok(store.includes("42703") && store.includes("isUndefinedColumn"), "legacy fallback only on missing columns");

const api = readFileSync(join(ROOT, "apps/api/src/api.ts"), "utf8");
ok(api.includes("slug taken") && api.includes("409"), "project create answers slug conflicts with 409");
ok(/token-taken[\s\S]*?continue/.test(api), "guest create retries token races");

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}
const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m161slug-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "durable"],
    ["packages/contracts/src", "m16"],
    ["packages/wedding-core/src", "csv"],
    ["packages/wedding-core/src", "tokens"],
    ["packages/wedding-core/src", "analytics"],
    ["packages/wedding-core/src", "projects"],
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
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../durable.js"), require("../../../m16.js"));`
  );
  const req = createRequire(join(tmp, "x.js"));
  const projects = req(join(tmp, "projects.js"));
  const c = projects.validateProjectCreate({ name: "Ayu & Bima" });
  ok(c.ok && c.slug === "ayu-bima", "slug derivation intact");
  ok(!projects.allowedStatusTransition("archived", "live"), "archived->live still blocked");
  console.log(`M161 SLUG VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
