// Verifies M0 scaffold facts directly from the artifact tree + package manifests.
// Prints M0 SCAFFOLD VERIFIED only after every assertion passes; exits nonzero otherwise.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M0 scaffold check FAILED: ${msg}`); process.exit(1); };
const mustExist = (rel) => { if (!existsSync(join(ROOT, rel))) fail(`missing ${rel}`); };
const readJson = (rel) => {
  try { return JSON.parse(readFileSync(join(ROOT, rel), "utf8")); }
  catch (e) { fail(`unparseable ${rel}: ${e.message}`); }
};

// 1. pnpm workspace exists and declares the required members (globs expanded).
mustExist("pnpm-workspace.yaml");
const ws = readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8");
const members = ws.split("\n").map((l) => l.trim().replace(/^-\s*["']?/, "").replace(/["']$/, "")).filter(Boolean);
const covers = (rel) => members.some((m) => m === rel || (m.endsWith("/*") && rel.startsWith(m.slice(0, -1))));
for (const member of ["apps/web", "packages/contracts"]) {
  if (!covers(member)) fail(`pnpm-workspace.yaml omits ${member}`);
}

// 2. Web app manifest exists with locked runtime deps (measured, not assumed).
mustExist("apps/web/package.json");
const web = readJson("apps/web/package.json");
const deps = { ...web.dependencies, ...web.devDependencies };
for (const dep of ["next", "react", "phaser", "zod"]) {
  if (!deps[dep]) fail(`apps/web missing dependency ${dep}`);
}

// 3. Contracts package exists (typed boundary for world/protocol/publication).
mustExist("packages/contracts/package.json");

// 4. No exclusive-legacy lockfile confusion: pnpm workspace must own installs.
if (existsSync(join(ROOT, "apps/web/package-lock.json"))) {
  fail("apps/web uses npm lockfile inside a pnpm workspace");
}

console.log("M0 SCAFFOLD VERIFIED");
