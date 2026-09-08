// Verifies M5 build integrity: contracts + game + web typecheck, production
// bundle builds with quest HUD/reveal/gate artifact wired.
// Prints M5 BUILD VERIFIED only when every step exits 0.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M5 build check FAILED: ${msg}`); process.exit(1); };
const BIN = process.platform === "win32" ? ".cmd" : "";

function run(bin, args, cwd, label) {
  if (!existsSync(bin)) fail(`${label} binary missing: ${bin} (run pnpm install)`);
  try {
    execSync(`"${bin}" ${args}`, { cwd, stdio: "pipe", timeout: 420000 });
  } catch (e) {
    const out = ((e.stdout || "") + (e.stderr || e.message || "")).toString();
    fail(`${label} failed: ${out.slice(0, 1200)}`);
  }
}

for (const p of [
  "assets-source/tiled/garden-village-v1/gates.json",
  "apps/web/public/assets/worlds/garden-village-v1/gates.json",
]) {
  if (!existsSync(join(ROOT, p))) fail(`gate artifact missing: ${p} (run node tooling/world-gen/build-world.mjs)`);
}

const contractsDir = join(ROOT, "packages/contracts");
const gameDir = join(ROOT, "packages/game");
const webDir = join(ROOT, "apps/web");

run(join(contractsDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", contractsDir, "contracts typecheck");
run(join(gameDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", gameDir, "game typecheck");
run(join(webDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", webDir, "web typecheck");
run(join(webDir, "node_modules", ".bin", `next${BIN}`), "build", webDir, "web production build");

console.log("M5 BUILD VERIFIED");
