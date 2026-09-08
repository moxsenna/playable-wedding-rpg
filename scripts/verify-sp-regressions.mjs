// SP regression runner: re-verifies every M1..M5 runnable gate on the final
// tree. Build steps run once (verify-m5-build typechecks contracts+game+web
// and production-builds the whole app — a superset of earlier build gates);
// every logic oracle and browser probe re-runs unmodified.
// Prints SP REGRESSIONS VERIFIED only when every step exits 0.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`SP regression check FAILED: ${msg}`); process.exit(1); };

const STEPS = [
  ["node", "scripts/gate-lint-all.mjs"],
  ["node", "scripts/check-forbidden-patterns.mjs"],
  ["node", "scripts/check-forbidden-patterns.mjs --self-test"],
  ["node", "scripts/validate-world.mjs assets-source/tiled/garden-village-v1"],
  ["node", "scripts/verify-m2-input.mjs"],
  ["node", "scripts/verify-m3-logic.mjs"],
  ["node", "scripts/verify-m4-logic.mjs"],
  ["node", "scripts/verify-m45-build.mjs"],
  ["node", "scripts/verify-m46-build.mjs"],
  ["node", "scripts/verify-m5-logic.mjs"],
  ["node", "scripts/verify-m5-build.mjs"],
  ["node", "scripts/validate-avatars.mjs"],
  ["node", "scripts/validate-environment.mjs"],
  ["node", "tooling/e2e/m1-move.mjs"],
  ["node", "tooling/e2e/m2-touch.mjs"],
  ["node", "tooling/e2e/m3-npc.mjs"],
  ["node", "tooling/e2e/m4-book.mjs"],
  ["node", "tooling/e2e/m45-avatars.mjs"],
  ["node", "tooling/e2e/m46-world.mjs"],
  ["node", "tooling/e2e/m5-quest.mjs"],
];

const args = process.argv.slice(2);
let from = 1, to = STEPS.length;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--from") from = Number(args[++i]);
  if (args[i] === "--to") to = Number(args[++i]);
}
if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > STEPS.length || from > to) {
  fail(`bad range --from ${args} (1..${STEPS.length})`);
}

for (let s = from - 1; s < to; s++) {
  const [bin, cmd] = STEPS[s];
  try {
    execSync(`${bin} ${cmd}`, { cwd: ROOT, stdio: "pipe", timeout: 600000 });
  } catch (e) {
    const out = ((e.stdout || "") + (e.stderr || e.message || "")).toString();
    fail(`${cmd} -> ${out.slice(-800)}`);
  }
  console.log(`ok [${s + 1}/${STEPS.length}]: ${cmd}`);
}

console.log(`SP REGRESSIONS VERIFIED (steps ${from}..${to})`);
