// World build orchestrator: garden-village-v1.
// Generates tileset + sprites + map from code, writes:
//   assets-source/  (Tiled-editable source of truth: .tmj + .tsj + .png + manifest)
//   apps/web/public/assets/worlds/garden-village-v1/ (runtime: embedded map.json + manifest)
// Usage: node tooling/world-gen/build-world.mjs
import { mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SRC_WORLD = join(ROOT, "assets-source", "tiled", "garden-village-v1");
const SRC_TILESETS = join(ROOT, "assets-source", "tilesets");
const SRC_SPRITES = join(ROOT, "assets-source", "sprites");
const PUB_WORLD = join(ROOT, "apps", "web", "public", "assets", "worlds", "garden-village-v1");
const PUB_SPRITES = join(PUB_WORLD, "sprites");
const SRC_AVATARS = join(SRC_SPRITES, "avatars");
const PUB_AVATARS = join(PUB_SPRITES, "avatars");
const PUB_GALLERY = join(ROOT, "apps", "web", "public", "assets", "gallery");

const { buildTileset, tilesetTsj } = await import("./gen-tileset.mjs");
const { buildGuestSheet, buildGalleryImages } = await import("./gen-sprites.mjs");
const { planLayout, buildMap, INTERACTIONS } = await import("./gen-map.mjs");
const { planDecor, FINALE_GATE, ENTRY_GATE } = await import("./gen-decor.mjs");
const { buildRegistry } = await import("../assets/build-avatar-registry.mjs");
const { buildEnvironment } = await import("../assets/build-environment.mjs");
const { loadTerrain } = await import("./terrain-v2.mjs");

for (const d of [SRC_WORLD, SRC_TILESETS, SRC_SPRITES, PUB_WORLD, PUB_SPRITES, PUB_GALLERY]) {
  mkdirSync(d, { recursive: true });
}

// 1. environment pack first: placements and the map depend on its registry.
const { registry: envRegistry } = await buildEnvironment({});
// Retired procedural tileset must never reappear as canonical art.
rmSync(join(SRC_TILESETS, "wedding-garden.png"), { force: true });
rmSync(join(SRC_TILESETS, "wedding-garden.tsj"), { force: true });
rmSync(join(PUB_WORLD, "tileset.png"), { force: true });

// 2. guest sprite sheet + frame metadata
const guest = buildGuestSheet();
writeFileSync(join(SRC_SPRITES, "guest_01.png"), guest.png);

// NPC avatars resolve through the approved pack registry (M4.5). Stale
// procedural outputs are deleted so nothing canonical is overwritten.
rmSync(SRC_AVATARS, { recursive: true, force: true });
rmSync(join(SRC_SPRITES, "avatars.json"), { force: true });
rmSync(PUB_AVATARS, { recursive: true, force: true });
rmSync(join(PUB_SPRITES, "guest_01.json"), { force: true });
const { registry: avatarRegistry } = await buildRegistry({});

// Demo gallery placeholders (wedding media arrives versioned with M8/R2).
for (const g of buildGalleryImages()) {
  const target = join(PUB_GALLERY, `${g.id}.png`);
  if (!existsSync(target)) {
    writeFileSync(target, g.png);
  }
}

// 3. logical layout -> atlas placements -> painted map + merged collision
const layout = planLayout();
const decor = planDecor(layout, envRegistry);
const terrain = loadTerrain();
const { tmj, solid } = buildMap(layout, decor, terrain);
writeFileSync(join(SRC_WORLD, "map.tmj"), JSON.stringify(tmj) + "\n");
writeFileSync(
  join(SRC_WORLD, "placements.json"),
  JSON.stringify({ templateKey: "garden-village-v1", version: 1, placements: decor.placements }, null, 2) + "\n"
);
const srcManifest = {
  templateKey: "garden-village-v1",
  version: 1,
  tilemap: "map.tmj",
  tileset: "../../sprites/playable_wedding_environment_pack_v2/terrain/terrain_tiles.tsj",
  placements: "placements.json",
  gates: "gates.json",
  tileSize: 16,
  size: { w: 56, h: 80 },
  sprites: ["../../sprites/guest_01.png"],
};
writeFileSync(join(SRC_WORLD, "manifest.json"), JSON.stringify(srcManifest, null, 2) + "\n");

// 4. runtime copy: embed the pack terrain TSJ (image ref stays accurate;
//    Phaser resolves the texture from the loaded image, not this field).
const terrainTsjPath = join(
  ROOT, "assets-source/sprites/playable_wedding_environment_pack_v2/terrain/terrain_tiles.tsj"
);
const runtimeTsj = {
  ...JSON.parse(readFileSync(terrainTsjPath, "utf8")),
  image: "../../environment/terrain/terrain_tiles.png",
  firstgid: 1,
};
const runtimeMap = { ...tmj, tilesets: [runtimeTsj] };
writeFileSync(join(PUB_WORLD, "map.json"), JSON.stringify(runtimeMap) + "\n");
copyFileSync(join(SRC_SPRITES, "guest_01.png"), join(PUB_SPRITES, "guest_01.png"));
copyFileSync(join(SRC_WORLD, "placements.json"), join(PUB_WORLD, "placements.json"));
const gateZone = INTERACTIONS.find(([n]) => n === FINALE_GATE.id);
if (!gateZone) throw new Error(`interaction zone missing for ${FINALE_GATE.id}`);
const gatesDoc = {
  templateKey: "garden-village-v1",
  version: 1,
  gates: [
    {
      id: FINALE_GATE.id,
      zoneTiles: { x: gateZone[1], y: gateZone[2], w: gateZone[3], h: gateZone[4] },
      tiles: FINALE_GATE.tiles.map(([x, y]) => ({ x, y })),
      lockedTiles: FINALE_GATE.lockedTiles.map(([x, y]) => ({ x, y })),
    },
    {
      id: ENTRY_GATE.id,
      zoneTiles: { ...ENTRY_GATE.zoneTiles },
      tiles: ENTRY_GATE.tiles.map(([x, y]) => ({ x, y })),
      lockedTiles: ENTRY_GATE.lockedTiles.map(([x, y]) => ({ x, y })),
    },
  ],
};
writeFileSync(join(SRC_WORLD, "gates.json"), JSON.stringify(gatesDoc, null, 2) + "\n");
copyFileSync(join(SRC_WORLD, "gates.json"), join(PUB_WORLD, "gates.json"));
const pubManifest = {
  templateKey: "garden-village-v1",
  version: 1,
  compatibilityVersion: 1,
  tilemap: "map.json",
  placements: "placements.json",
  gates: "gates.json",
  files: ["map.json", "manifest.json", "placements.json", "gates.json", "sprites/guest_01.png"],
  environment: {
    pack: "playable_wedding_environment_pack_v2",
    version: 2,
    base: "assets/environment/",
    registry: "environment-registry.json",
    terrainImage: "terrain/terrain_tiles.png",
    atlases: {
      foliage: { png: "foliage/foliage_atlas.png", json: "foliage/foliage_atlas.json" },
      decor: { png: "decor/decor_atlas.png", json: "decor/decor_atlas.json" },
      landmarks: { png: "landmarks/landmarks_atlas.png", json: "landmarks/landmarks_atlas.json" },
    },
  },
};
writeFileSync(join(PUB_WORLD, "manifest.json"), JSON.stringify(pubManifest, null, 2) + "\n");

console.log(
  `WORLD BUILT tileset=terrain-v2 placements=${decor.placements.length} ` +
  `avatars=${Object.keys(avatarRegistry.avatars).length} solid=${solid.size} trees=${layout.treeSpots.length}`
);
