// M16 build oracle: contracts + core + api + web typecheck, plus web static build.
// Prints M16 BUILD VERIFIED only when every step exits 0.
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M16 build check FAILED: ${msg}`); process.exit(1); };
const run = (cmd, cwd = ROOT) => {
  try {
    execSync(cmd, { cwd, stdio: "pipe", timeout: 600000 });
  } catch (e) {
    fail(`${cmd} -> ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(-600)}`);
  }
  console.log(`ok: ${cmd}`);
};

run("pnpm --filter @wedding-rpg/contracts exec tsc --noEmit");
run("pnpm --filter @wedding-rpg/wedding-core exec tsc --noEmit");
run("pnpm --filter @wedding-rpg/api exec tsc --noEmit");
run("pnpm --filter @wedding-rpg/web exec tsc --noEmit");
run("pnpm --filter @wedding-rpg/web build");
console.log("M16 BUILD VERIFIED");
