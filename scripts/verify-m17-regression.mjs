// M17 full regression: every credential-free gate in dependency order.
// Prints M17 REGRESSION VERIFIED only when each step exits 0.
import { execSync, execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M17 regression check FAILED: ${msg}`); process.exit(1); };

const run = (cmd, timeout = 600000) => {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout });
  } catch (e) {
    fail(`${cmd} -> ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(-600)}`);
  }
  console.log(`ok: ${cmd}`);
};

const runNode = (args, timeout = 600000) => {
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: "pipe", timeout });
  } catch (e) {
    fail(`node ${args.join(" ")} -> ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(-600)}`);
  }
  console.log(`ok: node ${args.join(" ")}`);
};

for (const pkg of ["contracts", "wedding-core", "api", "game", "web"]) {
  run(`pnpm --filter @wedding-rpg/${pkg} exec tsc --noEmit`);
}
runNode(["scripts/verify-m16-logic.mjs"], 300000);
runNode(["scripts/verify-m161-slug.mjs"], 300000);
runNode(["scripts/verify-m161-guards.mjs"], 300000);
runNode(["scripts/verify-m17-envelope.mjs"], 300000);
runNode(["scripts/verify-m17-npc.mjs"], 300000);
runNode(["scripts/verify-m17-isolation.mjs"], 300000);
runNode(["scripts/verify-brand.mjs"], 300000);
runNode(["scripts/verify-ci.mjs"], 600000);
runNode(["tooling/e2e/m127-manifest.mjs"], 600000);
runNode(["tooling/e2e/m4-book.mjs"], 600000);
runNode(["tooling/e2e/m5-quest.mjs"], 600000);
runNode(["tooling/e2e/m16-guest.mjs"], 600000);
runNode(["tooling/e2e/m16-admin.mjs"], 600000);
runNode(["tooling/e2e/m161-guest.mjs"], 600000);
runNode(["tooling/e2e/m161-admin.mjs"], 600000);
runNode(["tooling/e2e/brand.mjs"], 600000);
runNode(["tooling/e2e/m17-envelope.mjs"], 600000);
runNode(["tooling/e2e/m17-studio.mjs"], 600000);
runNode(["tooling/e2e/m17-preview.mjs"], 600000);
runNode(["tooling/e2e/m17-publish.mjs"], 600000);
console.log("M17 REGRESSION VERIFIED");
