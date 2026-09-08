// Verifies M4.6 build integrity: environment pipeline runs deterministically
// (double-build hash match), game + web typecheck, production bundle builds.
// Prints M4.6 BUILD VERIFIED only when every step exits 0.
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M4.6 build check FAILED: ${msg}`); process.exit(1); };
const BIN = process.platform === "win32" ? ".cmd" : "";
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function run(bin, args, cwd, label) {
  if (!existsSync(bin)) fail(`${label} binary missing: ${bin} (run pnpm install)`);
  try {
    execSync(`"${bin}" ${args}`, { cwd, stdio: "pipe", timeout: 420000 });
  } catch (e) {
    const out = ((e.stdout || "") + (e.stderr || e.message || "")).toString();
    fail(`${label} failed: ${out.slice(0, 1200)}`);
  }
}

// determinism: build twice, map + placements + manifest must be identical
const WORLD = join(ROOT, "apps/web/public/assets/worlds/garden-village-v1");
const FP = ["map.json", "placements.json", "manifest.json"].map((f) => join(WORLD, f));
try {
  execFileSync(process.execPath, ["tooling/world-gen/build-world.mjs"], { cwd: ROOT, stdio: "pipe" });
} catch (e) {
  fail(`first world build failed: ${(e.stderr || e.message).toString().slice(0, 600)}`);
}
const before = FP.map(sha);
try {
  execFileSync(process.execPath, ["tooling/world-gen/build-world.mjs"], { cwd: ROOT, stdio: "pipe" });
} catch (e) {
  fail(`second world build failed: ${(e.stderr || e.message).toString().slice(0, 600)}`);
}
const after = FP.map(sha);
if (JSON.stringify(before) !== JSON.stringify(after)) fail("world build not deterministic");

// production wiring: terrain TSJ + atlases present, no placeholder fallback
const mapJson = JSON.parse(readFileSync(join(WORLD, "map.json"), "utf8"));
const tsNames = (mapJson.tilesets || []).map((t) => t.name);
if (!tsNames.includes("wedding-garden-terrain-v2")) {
  fail(`runtime map uses wrong tileset: ${tsNames.join(",")}`);
}
const PUB_ASSETS = join(ROOT, "apps/web/public/assets");
for (const f of ["environment/terrain/terrain_tiles.png", "environment/foliage/foliage_atlas.png", "environment/decor/decor_atlas.png", "environment/landmarks/landmarks_atlas.png"]) {
  if (!existsSync(join(PUB_ASSETS, f))) fail(`missing runtime asset: ${f}`);
}
const manifest = JSON.parse(readFileSync(join(WORLD, "manifest.json"), "utf8"));
if (!manifest.environment || manifest.environment.pack !== "playable_wedding_environment_pack_v2") {
  fail("world manifest missing environment section");
}

const gameDir = join(ROOT, "packages/game");
const webDir = join(ROOT, "apps/web");
run(join(gameDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", gameDir, "game typecheck");
run(join(webDir, "node_modules", ".bin", `tsc${BIN}`), "--noEmit -p tsconfig.json", webDir, "web typecheck");
run(join(webDir, "node_modules", ".bin", `next${BIN}`), "build", webDir, "web production build");

console.log("M4.6 BUILD VERIFIED");
