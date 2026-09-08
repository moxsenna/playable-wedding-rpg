// Verifies M12.6 build integrity: contracts + wedding-core + game + api +
// realtime + web typecheck, then both workers render without deploying.
// Prints M126 BUILD VERIFIED only when every step exits 0.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, execFileSync } from "node:child_process";
import { resolveWranglerJs } from "../tooling/resolve-wrangler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M12.6 build check FAILED: ${msg}`); process.exit(1); };
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

for (const pkg of ["packages/contracts", "packages/wedding-core", "packages/game", "apps/api", "apps/realtime", "apps/web"]) {
  const dir = join(ROOT, pkg);
  run(join(dir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", dir, `${pkg} typecheck`);
}

let WRANGLER_JS;
try {
  WRANGLER_JS = resolveWranglerJs();
} catch (e) {
  fail((e && e.message) || String(e));
}
for (const app of ["apps/realtime", "apps/api"]) {
  try {
    execFileSync(process.execPath, [WRANGLER_JS, "deploy", "--dry-run"], {
      cwd: join(ROOT, app), stdio: "pipe", timeout: 300000,
    });
  } catch (e) {
    const out = ((e.stdout || "") + (e.stderr || e.message || "")).toString();
    fail(`${app} dry-run failed: ${out.slice(0, 1200)}`);
  }
}

console.log("M126 BUILD VERIFIED");
