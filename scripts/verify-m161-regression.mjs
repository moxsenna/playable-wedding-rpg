// M16.1 regression oracle: M16 logic plus typechecks plus the
// credential-free CI subset. Prints M161 REGRESSION VERIFIED.
import { execSync, execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M16.1 regression check FAILED: ${msg}`); process.exit(1); };

const run = (cmd) => {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout: 600000 });
  } catch (e) {
    fail(`${cmd} -> ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(-600)}`);
  }
  console.log(`ok: ${cmd}`);
};

for (const pkg of ["contracts", "wedding-core", "api", "game", "web"]) {
  run(`pnpm --filter @wedding-rpg/${pkg} exec tsc --noEmit`);
}
try {
  execFileSync(process.execPath, ["scripts/verify-m16-logic.mjs"], { cwd: ROOT, stdio: "pipe", timeout: 300000 });
} catch (e) {
  fail(`verify-m16-logic -> ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(-600)}`);
}
console.log("ok: node scripts/verify-m16-logic.mjs");
run("node scripts/verify-ci.mjs");
console.log("M161 REGRESSION VERIFIED");
