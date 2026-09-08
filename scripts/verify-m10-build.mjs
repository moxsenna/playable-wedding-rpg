// Verifies M10 build integrity: contracts + game + web typecheck, then the
// web production build with the net layer wired into the world scene.
// Prints M10 BUILD VERIFIED only when every step exits 0.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M10 build check FAILED: ${msg}`); process.exit(1); };
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

for (const pkg of ["packages/contracts", "packages/game", "apps/web"]) {
  const dir = join(ROOT, pkg);
  run(join(dir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", dir, `${pkg} typecheck`);
}
const webDir = join(ROOT, "apps/web");
run(join(webDir, "node_modules", ".bin", `next${BIN}`), "build", webDir, "web production build");

console.log("M10 BUILD VERIFIED");
