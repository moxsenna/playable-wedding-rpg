// Lints every unlazy ledger in this scope using the skill's gate-lint.
// Prints LINT OK only when every ledger exits 0 without --strict findings.
import { execSync, execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = "C:\\Users\\bimap\\.agents\\skills\\unlazy\\scripts\\gate-lint.mjs";
const SCOPE = join(ROOT, ".unlazy/wedding-rpg-v1");

const ledgers = [join(SCOPE, "GATES.md")];
const gatesDir = join(SCOPE, "gates");
if (existsSync(gatesDir)) {
  for (const e of readdirSync(gatesDir)) {
    if (e.endsWith(".md")) ledgers.push(join(gatesDir, e));
  }
}

let warnings = 0;
for (const ledger of ledgers) {
  let out;
  try {
    out = execFileSync(process.execPath, [SKILL, ledger], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    console.error(`LINT FAILED for ${ledger}:\n${(e.stdout || "") + (e.stderr || e.message)}`);
    process.exit(1);
  }
  const m = out.match(/(\d+)\s+warning/);
  if (m) warnings += Number(m[1]);
}
console.log(`LINT OK (${warnings} warning(s))`);
