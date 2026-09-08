// CI subset runner: every credential-free gate in dependency order.
// Mirrors .github/workflows/ci.yml locally. Live Neon/R2/deploy probes stay
// out (they need DATABASE_URL + Cloudflare login).
// Prints CI SUBSET VERIFIED only when every step exits 0.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`CI subset check FAILED: ${msg}`); process.exit(1); };

const STEPS = [
  "node scripts/gate-lint-all.mjs",
  "node scripts/check-forbidden-patterns.mjs",
  "node scripts/check-forbidden-patterns.mjs --self-test",
  "node scripts/validate-world.mjs assets-source/tiled/garden-village-v1",
  "node scripts/verify-m2-input.mjs",
  "node scripts/verify-m3-logic.mjs",
  "node scripts/verify-m4-logic.mjs",
  "node scripts/verify-m5-logic.mjs",
  "node scripts/verify-m7-logic.mjs",
  "node scripts/verify-m8-logic.mjs",
  "node scripts/verify-m10-logic.mjs",
  "node scripts/verify-m125-logic.mjs",
  "node scripts/verify-m126-logic.mjs",
  "node scripts/verify-m127-atomic.mjs",
  "node scripts/validate-avatars.mjs",
  "node scripts/validate-environment.mjs",
  "node scripts/verify-m125-build.mjs",
  "node scripts/verify-m126-build.mjs",
  "node scripts/verify-m5-build.mjs",
  "node scripts/verify-m12-data.mjs",
  "node scripts/verify-m126-assets.mjs",
  "node tooling/publish/publish.mjs garden-village-v1 --dry-run",
];

for (const [i, cmd] of STEPS.entries()) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout: 600000 });
  } catch (e) {
    const out = ((e.stdout || "") + (e.stderr || e.message || "")).toString();
    fail(`[${i + 1}/${STEPS.length}] ${cmd} -> ${out.slice(-800)}`);
  }
  console.log(`ok [${i + 1}/${STEPS.length}]: ${cmd}`);
}

console.log("CI SUBSET VERIFIED");
