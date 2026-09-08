// Portable single-ledger lint: resolves the unlazy gate-lint from
// UNLAZY_SKILL_DIR (CI sets it to a checked-in copy or skill install path),
// falling back to the author's local machine path. Prints LINT OK only when
// the ledger exits 0 without parse errors.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`lint-ledger FAILED: ${msg}`); process.exit(1); };

const target = process.argv[2];
if (!target) fail("usage: node scripts/lint-ledger.mjs <ledger.md>");
const ledger = resolve(ROOT, target);
if (!existsSync(ledger)) fail(`ledger missing: ${target}`);

const candidates = [
  process.env.UNLAZY_SKILL_DIR ? join(process.env.UNLAZY_SKILL_DIR, "scripts", "gate-lint.mjs") : null,
  "C:\\Users\\bimap\\.agents\\skills\\unlazy\\scripts\\gate-lint.mjs",
].filter(Boolean);
const skill = candidates.find((p) => existsSync(p));
if (!skill) fail("gate-lint.mjs not found (set UNLAZY_SKILL_DIR)");

try {
  const out = execFileSync(process.execPath, [skill, ledger], {
    cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000,
  });
  process.stdout.write(out);
} catch (e) {
  fail(((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(0, 800));
}
