// Verifies M11 build integrity: the realtime Worker typechecks and its
// config validates (dry-run render puerto, no deploy, no account needed).
// Prints M11 BUILD VERIFIED only when every step exits 0.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, execFileSync } from "node:child_process";
import { resolveWranglerJs } from "../tooling/resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M11 build check FAILED: ${msg}`); process.exit(1); };
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

const rtDir = join(ROOT, "apps/realtime");
run(join(rtDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", rtDir, "realtime typecheck");

let WRANGLER_JS;
try {
  WRANGLER_JS = resolveWranglerJs();
} catch (e) {
  fail((e && e.message) || String(e));
}
try {
  execFileSync(process.execPath, [WRANGLER_JS, "deploy", "--dry-run"], {
    cwd: rtDir, stdio: "pipe", timeout: 300000,
  });
} catch (e) {
  const out = ((e.stdout || "") + (e.stderr || e.message || "")).toString();
  fail(`wrangler dry-run failed: ${out.slice(0, 1200)}`);
}

console.log("M11 BUILD VERIFIED");
