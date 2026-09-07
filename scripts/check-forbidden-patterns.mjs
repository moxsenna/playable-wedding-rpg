// Scans the new repo for forbidden old-gameplay patterns.
// Usage: node scripts/check-forbidden-patterns.mjs [--self-test]
// Prints FORBIDDEN PATTERNS ABSENT only when zero hits; --self-test proves
// the scanner detects a known-positive fixture (SELF TEST PASSED).
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PATTERNS = [
  /currentSceneIndex/,
  /sceneInstances/,
  /Pixel\w*Scene/,
  /viewMode\s*=\s*["']quest["']/,
  /hotspot/i,
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".unlazy", "output", "dist", "build"]);
const SKIP_FILES = new Set(["check-forbidden-patterns.mjs", "IMPLEMENTATION_STATUS.md", "PLAN.md"]);
// Spec docs at the repo root describe the prohibitions in prose; the gate
// governs the implementation, so only implementation trees are scanned.
const SCAN_ROOTS = ["apps", "packages", "scripts", "tooling", "tests", "assets-source", "docs"];

function scanDir(dir, hits) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) scanDir(p, hits);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|md)$/.test(e) && !SKIP_FILES.has(e)) {
      const src = readFileSync(p, "utf8");
      for (const rx of PATTERNS) {
        const m = src.match(rx);
        if (m) hits.push(`${p}: ${m[0]}`);
      }
    }
  }
  return hits;
}

if (process.argv.includes("--self-test")) {
  // Negative control: a fixture containing a forbidden pattern MUST be detected.
  const tmp = mkdtempSync(join(tmpdir(), "forbidden-"));
  try {
    writeFileSync(join(tmp, "fixture.ts"), "const i = currentSceneIndex + 1;\n");
    const hits = scanDir(tmp, []);
    if (hits.length === 0) {
      console.error("SELF TEST FAILED: known-positive fixture not detected");
      process.exit(1);
    }
    console.log("SELF TEST PASSED");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  process.exit(0);
}

const hits = [];
for (const root of SCAN_ROOTS) {
  const dir = join(ROOT, root);
  if (existsSync(dir)) scanDir(dir, hits);
}
if (hits.length > 0) {
  console.error(`FORBIDDEN PATTERNS FOUND (${hits.length}):`);
  for (const h of hits.slice(0, 20)) console.error(`  ${h}`);
  process.exit(1);
}
console.log("FORBIDDEN PATTERNS ABSENT");
