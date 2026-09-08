// Pack-terrain mapping for garden-village-v1 (M4.6).
// Loads terrain_tiles.json (48 tiles, 16px) and routes deterministic piece
// selection. Deliberately avoids orientation-guessing: junctions always use
// rotation-safe cross tiles, ends use centers. Curves exist in the pack but
// garden-village-v1 topology needs none (plus-shaped routes only).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACK_TILE_FILE = join(
  HERE, "..", "..", "assets-source", "sprites",
  "playable_wedding_environment_pack_v2", "terrain", "terrain_tiles.json"
);

export const GRASS_SEQUENCE = [
  "grass_plain_01",
  "grass_plain_02",
  "grass_plain_01",
  "grass_flowers_01",
  "grass_plain_01",
  "grass_flowers_sparse_01",
  "grass_plain_02",
  "grass_weeds_01",
  "grass_plain_01",
  "grass_tuft_01",
  "grass_flowers_dense_01",
  "grass_plain_01",
  "grass_bare_patch_01",
];

export const MEADOW_PICK = ["grass_flowers_01", "grass_flowers_dense_01", "grass_flowers_sparse_01"];
export const TUFT_PICK = ["grass_tuft_01", "grass_weeds_01"];

let cache = null;

/** Load the pack tile list once. Returns { byName: Map<name, gid>, tiles }. */
export function loadTerrain() {
  if (cache) return cache;
  const doc = JSON.parse(readFileSync(PACK_TILE_FILE, "utf8"));
  const byName = new Map();
  for (const t of doc.tiles ?? []) byName.set(t.name, t.id + 1); // firstgid 1
  cache = { byName, tiles: doc.tiles ?? [], tileSize: doc.tileSize ?? 16 };
  return cache;
}

export function terrainGid(name) {
  const { byName } = loadTerrain();
  const gid = byName.get(name);
  if (gid === undefined) throw new Error(`unknown terrain tile: ${name}`);
  return gid;
}

/**
 * Path piece for a cell with path neighbors n/s/e/w (the plus-shaped
 * garden routes only need straights, crosses, and center caps).
 */
export function routePiece(set, n, s, e, w) {
  const count = (n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0);
  if (n && s && !e && !w) return `${set}_vertical`;
  if (e && w && !n && !s) return `${set}_horizontal`;
  if (count >= 3) return `${set}_cross`;
  if (count === 2) return `${set}_cross`;
  return `${set}_center_01`;
}

/** Dirt vs stone route families. */
export const DIRT = "path_dirt";
export const STONE = "path_stone";

/**
 * Pond edge piece. Diagonal-corner mapping is a first guess (diag_01 NW,
 * diag_02 NE, diag_03 SE, shore_corner_01 SW); G4 zoomed screenshots judge
 * it and the mapping is adjusted with evidence if wrong.
 */
export function waterPiece(n, s, e, w) {
  if (n && s && e && w) return "water_center_01";
  if (!n && s && e && w) return "water_edge_north_01";
  if (n && !s && e && w) return "water_edge_south_01";
  if (n && s && !e && w) return "water_edge_east_01";
  if (n && s && e && !w) return "water_edge_west_01";
  if (!n && !w) return "water_edge_diag_01";
  if (!n && !e) return "water_edge_diag_02";
  if (!s && !e) return "water_edge_diag_03";
  if (!s && !w) return "water_shore_corner_01";
  return "water_center_02";
}
