// Environment pipeline oracle: pack integrity, registry/atlas/terrain
// contracts, alias/preset resolution, chapel exclusion, and (once authored)
// placement cross-checks. Prints ENVIRONMENT VALID only when all checks pass.
// Includes a negative self-test.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`Environment validation FAILED: ${msg}`); process.exit(1); };

const PACK = join(ROOT, "assets-source/sprites/playable_wedding_environment_pack_v2");
const PUB_ENV = join(ROOT, "apps/web/public/assets/environment");

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}
function pngSize(p) {
  const b = readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`not a PNG: ${p}`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const { scanEnvironment } = await import("../tooling/assets/build-environment.mjs");
const contracts = await import("../packages/contracts/src/environment.ts");
const { runtimeEnvRegistrySchema, placementsFileSchema, resolveEnvAlias } = contracts;
if (!runtimeEnvRegistrySchema || !placementsFileSchema || !resolveEnvAlias) {
  fail("environment contract exports missing");
}

const errors = [];
const scanned = scanEnvironment();
for (const e of scanned.errors) errors.push(`scan: ${e}`);
if (errors.length > 0) {
  console.error(`ENVIRONMENT INVALID:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}

// terrain: 48 unique ids/names, grid-aligned, TSJ agrees
{
  const tiles = scanned.terrain.tiles ?? [];
  if (tiles.length !== 48) fail(`terrain tile count ${tiles.length} != 48`);
  const ids = new Set();
  const names = new Set();
  for (const t of tiles) {
    if (ids.has(t.id) || names.has(t.name)) fail(`duplicate terrain tile: ${t.id}/${t.name}`);
    ids.add(t.id);
    names.add(t.name);
    if (t.x % 16 !== 0 || t.y % 16 !== 0 || t.w !== 16 || t.h !== 16) fail(`tile ${t.name} not 16px grid-aligned`);
  }
  const tsj = loadJson(join(PACK, "terrain/terrain_tiles.tsj"));
  if (tsj.tilecount !== 48 || tsj.tilewidth !== 16 || tsj.tileheight !== 16) fail("terrain TSJ not 48x16px");
  const tsjIds = new Set((tsj.tiles ?? []).map((t) => t.id));
  for (const t of tiles) {
    if (!tsjIds.has(t.id)) fail(`terrain tile ${t.id} missing from TSJ`);
  }
  const img = pngSize(join(PACK, "terrain/terrain_tiles.png"));
  if (img.width !== tsj.imagewidth || img.height !== tsj.imageheight) fail("terrain PNG/TSJ dimension mismatch");
}

// atlases: files exist, dims match, every registry asset resolves in-bounds
const atlasFrames = {};
for (const a of ["foliage", "decor", "landmarks"]) {
  const png = join(PACK, `atlases/${a}_atlas.png`);
  const js = join(PACK, `atlases/${a}_atlas.json`);
  if (!existsSync(png) || !existsSync(js)) fail(`atlas ${a} files missing`);
  const doc = loadJson(js);
  const frames = Array.isArray(doc.frames)
    ? Object.fromEntries(doc.frames.map((f) => [f.filename ?? f.name, f]))
    : doc.frames;
  atlasFrames[a] = { frames, W: doc.meta?.size?.w ?? 0, H: doc.meta?.size?.h ?? 0 };
  const size = pngSize(png);
  if (size.width !== atlasFrames[a].W || size.height !== atlasFrames[a].H) {
    fail(`atlas ${a} PNG/JSON dimension mismatch`);
  }
}
{
  const reg = scanned.registry;
  const counts = { foliage: 0, decor: 0, landmarks: 0 };
  const all = [...(reg.assets.foliage ?? []), ...(reg.assets.decor ?? []), ...(reg.assets.landmarks ?? [])];
  for (const e of all) {
    const atlas = e.category === "landmarks" ? "landmarks" : e.category === "decor" ? "decor" : "foliage";
    counts[atlas] = (counts[atlas] ?? 0) + 1;
    const fr = atlasFrames[atlas].frames[e.id];
    if (!fr) fail(`registry asset ${e.id} has no frame in ${atlas} atlas`);
    else {
      const r = fr.frame;
      if (r.x + r.w > atlasFrames[atlas].W || r.y + r.h > atlasFrames[atlas].H) {
        fail(`frame ${e.id} out of ${atlas} bounds`);
      }
    }
  }
  if (counts.foliage < 50 || counts.decor < 70 || counts.landmarks < 9) {
    fail(`asset counts low: ${JSON.stringify(counts)}`);
  }
  // chapel must exist but never be default-eligible
  const chapel = atlasFrames.landmarks.frames["wedding_hall_chapel_01"];
  if (!chapel) fail("chapel frame missing from landmarks atlas");
  else if (chapel.meta?.defaultEligible !== false) fail("chapel must be defaultEligible=false");
}

// aliases resolve, no loops; presets parse
{
  const aliases = scanned.aliases?.aliases ?? {};
  for (const [alias, target] of Object.entries(aliases)) {
    const r = resolveEnvAlias(aliases, alias);
    if (!r.ok) fail(`alias loop: ${alias} (${r.reason})`);
    const all = [...(scanned.registry.assets.foliage ?? []), ...(scanned.registry.assets.decor ?? []), ...(scanned.registry.assets.landmarks ?? [])];
    if (!all.some((e) => e.id === r.id)) fail(`alias ${alias} resolves to unknown asset ${r.id}`);
  }
  const presets = scanned.presets?.presets ?? {};
  if (Object.keys(presets).length === 0) fail("collision presets empty");
  for (const need of ["tree_trunk", "fountain_round", "gate_passage"]) {
    if (!presets[need]) fail(`collision preset missing: ${need}`);
  }
}

// runtime registry validates under the Zod contract
{
  const p = join(PUB_ENV, "environment-registry.json");
  if (!existsSync(p)) fail("runtime environment-registry.json missing (run build-world first)");
  const parsed = runtimeEnvRegistrySchema.safeParse(loadJson(p));
  if (!parsed.success) {
    fail(`runtime registry schema: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
}

// placements cross-checks (once authored by the world build)
{
  const p = join(ROOT, "assets-source/tiled/garden-village-v1/placements.json");
  if (existsSync(p)) {
    const parsed = placementsFileSchema.safeParse(loadJson(p));
    if (!parsed.success) {
      fail(`placements schema: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    } else {
      const reg = loadJson(join(PUB_ENV, "environment-registry.json"));
      const ids = new Set(Object.keys(reg.avatars ?? reg.assets ?? {}));
      const list = parsed.data.placements;
      if (list.length === 0) fail("placements file is empty");
      const seen = new Set();
      for (const pl of list) {
        if (!ids.has(pl.asset)) fail(`placement references unknown asset: ${pl.asset}`);
        if (pl.asset === "wedding_hall_chapel_01") fail("chapel referenced by a placement");
        const k = `${pl.asset}@${pl.x},${pl.y}`;
        if (seen.has(k)) fail(`duplicate placement: ${k}`);
        seen.add(k);
      }
      console.log(`placements checked: ${list.length}`);
    }
  } else {
    console.log("placements pending (world build not yet extended)");
  }
}

// negative self-test: schema violation + alias loop must both fail
{
  const badReg = {
    schemaVersion: 1,
    pack: "test",
    terrain: { tileset: "t.tsj", image: "t.png", tileSize: 16, count: 1 },
    atlases: {
      foliage: { png: "f.png", json: "f.json", width: 100, height: 100 },
      decor: { png: "d.png", json: "d.json", width: 100, height: 100 },
      landmarks: { png: "l.png", json: "l.json", width: 100, height: 100 },
    },
    assets: {
      bad1: { id: "bad1", category: "decor", atlas: "decor", frame: "bad1", width: 50, height: 50, origin: { x: 0.5, y: 0.9 }, displayScale: 5, collision: null, defaultEligible: true },
    },
  };
  if (runtimeEnvRegistrySchema.safeParse(badReg).success) {
    fail("self-test: displayScale 5 validated (oracle cannot fail)");
  }
  const looped = resolveEnvAlias({ a: "b", b: "a" }, "a");
  if (looped.ok) fail("self-test: alias loop not detected");
  console.log("SELF TEST PASSED");
}

console.log("ENVIRONMENT VALID");
