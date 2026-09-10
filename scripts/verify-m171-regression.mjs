// M17.1 regression oracle: typechecks, media gates, M17 studio flows,
// and the credential-free CI subset. Prints M171 REGRESSION VERIFIED.
import { execSync, execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M17.1 regression check FAILED: ${msg}`); process.exit(1); };

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

for (const pkg of ["contracts", "wedding-core", "api", "web"]) {
  run(`pnpm --filter @wedding-rpg/${pkg} exec tsc --noEmit`);
}
runNode(["scripts/verify-m171-r2.mjs"], 300000);
runNode(["scripts/verify-m171-media.mjs"], 600000);
runNode(["tooling/e2e/m171-studio-media.mjs"], 600000);
runNode(["tooling/e2e/m17-studio.mjs"], 600000);
runNode(["tooling/e2e/m17-publish.mjs"], 600000);
runNode(["scripts/verify-ci.mjs"], 600000);
console.log("M171 REGRESSION VERIFIED");
