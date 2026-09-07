// World build orchestrator: garden-village-v1.
// Generates tileset + sprites + map from code, writes:
//   assets-source/  (Tiled-editable source of truth: .tmj + .tsj + .png + manifest)
//   apps/web/public/assets/worlds/garden-village-v1/ (runtime: embedded map.json + manifest)
// Usage: node tooling/world-gen/build-world.mjs
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
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
const { buildGuestSheet, guestSheetJson, buildAvatarSheets, buildGalleryImages } = await import("./gen-sprites.mjs");
const { buildMap } = await import("./gen-map.mjs");

for (const d of [SRC_WORLD, SRC_TILESETS, SRC_SPRITES, SRC_AVATARS, PUB_WORLD, PUB_SPRITES, PUB_AVATARS, PUB_GALLERY]) {
  mkdirSync(d, { recursive: true });
}

// 1. tileset
const tiles = buildTileset();
writeFileSync(join(SRC_TILESETS, "wedding-garden.png"), tiles.png);
const tsj = tilesetTsj("wedding-garden.png");
writeFileSync(join(SRC_TILESETS, "wedding-garden.tsj"), JSON.stringify(tsj, null, 2) + "\n");

// 2. guest sprite sheet + frame metadata
const guest = buildGuestSheet();
writeFileSync(join(SRC_SPRITES, "guest_01.png"), guest.png);
const spritesJson = guestSheetJson();
writeFileSync(join(SRC_SPRITES, "guest_01.json"), JSON.stringify(spritesJson, null, 2) + "\n");

// NPC avatar sheets (one 6x4 sheet per palette) + avatars manifest.
const avatars = buildAvatarSheets();
const avatarEntries = [];
for (const a of avatars) {
  writeFileSync(join(SRC_AVATARS, `${a.id}.png`), a.png);
  copyFileSync(join(SRC_AVATARS, `${a.id}.png`), join(PUB_AVATARS, `${a.id}.png`));
  avatarEntries.push({ id: a.id, file: `${a.id}.png` });
}
writeFileSync(join(SRC_SPRITES, "avatars.json"), JSON.stringify({ avatars: avatarEntries }, null, 2) + "\n");
copyFileSync(join(SRC_SPRITES, "avatars.json"), join(PUB_SPRITES, "avatars.json"));

// Demo gallery placeholders (wedding media arrives versioned with M8/R2).
for (const g of buildGalleryImages()) {
  writeFileSync(join(PUB_GALLERY, `${g.id}.png`), g.png);
}

// 3. map (source .tmj references the external .tsj, Tiled-editable)
const { tmj, solid, treeSpots } = buildMap();
writeFileSync(join(SRC_WORLD, "map.tmj"), JSON.stringify(tmj) + "\n");
const srcManifest = {
  templateKey: "garden-village-v1",
  version: 1,
  tilemap: "map.tmj",
  tileset: "../../tilesets/wedding-garden.tsj",
  tileSize: 16,
  size: { w: 56, h: 80 },
  sprites: ["../../sprites/guest_01.png"],
};
writeFileSync(join(SRC_WORLD, "manifest.json"), JSON.stringify(srcManifest, null, 2) + "\n");

// 4. runtime copy: Phaser cannot resolve external .tsj, so embed the tileset
//    and rewrite the image ref to the runtime-relative file.
const runtimeTsj = { ...tilesetTsj("tileset.png"), firstgid: 1 };
const runtimeMap = { ...tmj, tilesets: [runtimeTsj] };
writeFileSync(join(PUB_WORLD, "map.json"), JSON.stringify(runtimeMap) + "\n");
copyFileSync(join(SRC_TILESETS, "wedding-garden.png"), join(PUB_WORLD, "tileset.png"));
copyFileSync(join(SRC_SPRITES, "guest_01.png"), join(PUB_SPRITES, "guest_01.png"));
writeFileSync(join(PUB_SPRITES, "guest_01.json"), JSON.stringify(spritesJson, null, 2) + "\n");
const pubManifest = {
  templateKey: "garden-village-v1",
  version: 1,
  compatibilityVersion: 1,
  tilemap: "map.json",
  files: ["map.json", "tileset.png", "manifest.json", "sprites/guest_01.png", "sprites/guest_01.json", "sprites/avatars.json", ...avatarEntries.map((a) => `sprites/avatars/${a.file}`)],
};
writeFileSync(join(PUB_WORLD, "manifest.json"), JSON.stringify(pubManifest, null, 2) + "\n");

console.log(
  `WORLD BUILT tileset=${tiles.png.length}B sprites=${guest.png.length}B ` +
  `avatars=${avatars.length} solid=${solid.size} trees=${treeSpots.length}`
);
