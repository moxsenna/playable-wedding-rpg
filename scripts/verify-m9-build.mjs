// Verifies M9 build integrity: web typechecks and production-builds with
// the admin RPG config page wired (fixtures + validators + wedding-core).
// Prints M9 BUILD VERIFIED only when every step exits 0.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M9 build check FAILED: ${msg}`); process.exit(1); };
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

const webDir = join(ROOT, "apps/web");
run(join(webDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", webDir, "web typecheck");
run(join(webDir, "node_modules", ".bin", `next${BIN}`), "build", webDir, "web production build");

console.log("M9 BUILD VERIFIED");
