// Verifies M7 build integrity: game untouched but still typechecks, web
// typechecks and production-builds with all three wedding fixtures wired.
// Prints M7 BUILD VERIFIED only when every step exits 0.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M7 build check FAILED: ${msg}`); process.exit(1); };
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

// Zero game-source edits: packages/game must be clean (M7 is data/config only).
try {
  const out = execFileSync("git", ["status", "--porcelain", "--", "packages/game"], {
    cwd: ROOT, encoding: "utf8", timeout: 60000,
  }).trim();
  if (out) fail(`packages/game dirty during M7:\n${out.slice(0, 800)}`);
} catch (e) {
  if (e.message && e.message.startsWith("packages/game dirty")) throw e;
  fail(`git status check failed: ${(e.message || "").slice(0, 300)}`);
}

const gameDir = join(ROOT, "packages/game");
const webDir = join(ROOT, "apps/web");

run(join(gameDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", gameDir, "game typecheck");
run(join(webDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", webDir, "web typecheck");
run(join(webDir, "node_modules", ".bin", `next${BIN}`), "build", webDir, "web production build");

console.log("M7 BUILD VERIFIED");
