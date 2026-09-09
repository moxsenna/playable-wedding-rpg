// Verifies M15 build integrity: game + web typecheck, world rebuild with
// the entry gate, world validation, then the web production build.
// Prints M15 BUILD VERIFIED only when every step exits 0.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M15 build check FAILED: ${msg}`); process.exit(1); };
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

function node(args, label) {
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: "pipe", timeout: 600000 });
  } catch (e) {
    const out = ((e.stdout || "") + (e.stderr || e.message || "")).toString();
    fail(`${label} failed: ${out.slice(-800)}`);
  }
}

const gameDir = join(ROOT, "packages/game");
const webDir = join(ROOT, "apps/web");

run(join(gameDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", gameDir, "game typecheck");
run(join(webDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", webDir, "web typecheck");
node(["tooling/world-gen/build-world.mjs"], "world rebuild");
node(["scripts/validate-world.mjs", "assets-source/tiled/garden-village-v1"], "world validation");
run(join(webDir, "node_modules", ".bin", `next${BIN}`), "build", webDir, "web production build");

console.log("M15 BUILD VERIFIED");
