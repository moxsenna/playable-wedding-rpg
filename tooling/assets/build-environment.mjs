// Production environment pipeline: validates the V2 pack and publishes ONLY
// runtime assets (terrain + 3 atlases + normalized registry). Source sheets,
// authoring PNGs, and docs never leave assets-source. The chapel stays out
// of default placements via defaultEligible metadata (asserted, not assumed).
// Dual-mode: imported by build-world.mjs, or CLI:
//   node tooling/assets/build-environment.mjs [--runtime-out D]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PACK = join(ROOT, "assets-source", "sprites", "playable_wedding_environment_pack_v2");

/** Matches contracts ENV_DISPLAY_FACTOR: registry scales target a larger grid. */
const DISPLAY_FACTOR = 2 / 3;

/** Per-id display-scale overrides after visual calibration (empty = uniform). */
const SCALE_OVERRIDES = {};

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function atlasFrames(atlasJson) {
  const fr = atlasJson.frames;
  if (Array.isArray(fr)) {
    return Object.fromEntries(fr.map((f) => [f.filename ?? f.name, f]));
  }
  return fr;
}

/** Read-only pack walk shared by the builder and the validator. */
export function scanEnvironment(packDir = PACK) {
  const errors = [];
  const get = (rel) => {
    const p = join(packDir, rel);
    if (!existsSync(p)) {
      errors.push(`missing pack file: ${rel}`);
      return null;
    }
    try {
      return readJson(p);
    } catch (e) {
      errors.push(`unparseable ${rel} (${e.message})`);
      return null;
    }
  };
  const registry = get("metadata/environment-registry.json");
  const aliases = get("metadata/landmark-aliases.json");
  const presets = get("metadata/collision-presets.json");
  const terrain = get("terrain/terrain_tiles.json");
  const atlases = {};
  for (const a of ["foliage", "decor", "landmarks"]) {
    atlases[a] = get(`atlases/${a}_atlas.json`);
  }
  return { packDir, registry, aliases, presets, terrain, atlases, errors };
}

export function buildEnvironment({ runtimeDir = join(ROOT, "apps/web/public/assets/environment") } = {}) {
  const { registry, aliases, presets, terrain, atlases, errors } = scanEnvironment();
  if (errors.length > 0) {
    throw new Error(`environment pack scan failed:\n  - ${errors.join("\n  - ")}`);
  }
  if (registry.schemaVersion !== 2) throw new Error(`unsupported pack schema ${registry.schemaVersion}`);
  if (registry.worldBaseTileSize !== 16) throw new Error("pack world base is not 16px");

  const out = { schemaVersion: 1, pack: registry.packId, terrain: null, atlases: {}, assets: {} };
  const copied = [];
  const put = (rel, dest) => {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(PACK, rel), dest);
    copied.push(dest);
  };

  // terrain (grid-aligned Tiled set, used as-is)
  const terrainTiles = terrain.tiles ?? [];
  if (terrainTiles.length === 0) throw new Error("terrain tile list empty");
  put("terrain/terrain_tiles.png", join(runtimeDir, "terrain/terrain_tiles.png"));
  put("terrain/terrain_tiles.tsj", join(runtimeDir, "terrain/terrain_tiles.tsj"));
  put("terrain/terrain_tiles.json", join(runtimeDir, "terrain/terrain_tiles.json"));
  out.terrain = { tileset: "terrain/terrain_tiles.tsj", image: "terrain/terrain_tiles.png", tileSize: 16, count: terrainTiles.length };

  // atlases (named frames, TexturePacker JSON)
  for (const a of ["foliage", "decor", "landmarks"]) {
    const meta = atlases[a]?.meta ?? {};
    put(`atlases/${a}_atlas.png`, join(runtimeDir, `${a}/${a}_atlas.png`));
    put(`atlases/${a}_atlas.json`, join(runtimeDir, `${a}/${a}_atlas.json`));
    out.atlases[a] = { png: `${a}/${a}_atlas.png`, json: `${a}/${a}_atlas.json`, width: meta.size?.w ?? 0, height: meta.size?.h ?? 0 };
  }

  // normalized asset entries: atlas frame meta wins, registry entry fills gaps
  const byId = {};
  for (const [cat, list] of Object.entries(registry.assets ?? {})) {
    for (const e of list ?? []) byId[e.id] = { ...e, category: cat };
  }
  for (const [id, e] of Object.entries(byId)) {
    const atlas = e.category === "landmarks" ? "landmarks" : e.category === "decor" ? "decor" : "foliage";
    if (!["foliage", "decor", "landmarks"].includes(e.category)) {
      throw new Error(`asset ${id} has unknown category ${e.category}`);
    }
    const frames = atlasFrames(atlases[atlas] ?? {});
    const fr = frames[id];
    if (!fr) throw new Error(`asset ${id} has no frame in the ${atlas} atlas`);
    const fmeta = fr.meta ?? {};
    const collision = fmeta.collision ?? e.collision ?? null;
    out.assets[id] = {
      id,
      category: e.category,
      atlas,
      frame: id,
      width: e.width,
      height: e.height,
      origin: e.origin ?? { x: 0.5, y: 0.94 },
      displayScale: SCALE_OVERRIDES[id] ?? (fmeta.recommendedScale ?? e.recommendedScale ?? 0.48) * DISPLAY_FACTOR,
      collision: collision && collision.shape === "rect" ? collision : null,
      defaultEligible: fmeta.defaultEligible ?? true,
    };
  }

  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(join(runtimeDir, "environment-registry.json"), JSON.stringify(out, null, 2) + "\n");
  return { registry: out, copied, runtimeDir, aliases: aliases?.aliases ?? {}, presets: presets?.presets ?? {} };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const get = (flag, dflt) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
  };
  try {
    const r = buildEnvironment({
      runtimeDir: get("--runtime-out", join(ROOT, "apps/web/public/assets/environment")),
    });
    console.log(`ENVIRONMENT BUILT assets=${Object.keys(r.registry.assets).length} copied=${r.copied.length}`);
  } catch (e) {
    console.error(`ENVIRONMENT BUILD FAILED: ${e.message}`);
    process.exit(1);
  }
}
