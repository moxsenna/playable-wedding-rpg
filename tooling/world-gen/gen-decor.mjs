// Placement authoring for garden-village-v1 (M4.6): production V2 objects.
// Input: logical layout (paths, slots, zones) + normalized env registry.
// Output: placements [{asset,x,y,layer,scale?,flipX?}] with feet-anchored
// world-px coords, plus tile collision derived from registry footprints.
// Rules enforced loudly: paths stay clear (walkables excepted), slot and
// spawn tiles never covered, large spans keep distance from slots, chapel
// never placed, gate/arch passages keep their doorway gaps.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rng } from "./png-writer.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

/** World display scale override per asset (default: registry resolved scale). */
const SCALE_OVERRIDES = {};

export const FINALE_GATE = {
  id: "gate.finale",
  tiles: [[26, 9], [28, 9], [27, 9]],
  lockedTiles: [[27, 9]],
};

const WALKABLE_NO_COLLISION = new Set([  "photo_terrace_01",
  "entrance_gate_flower_01",
  "wedding_arch_01",
  "lamp_black_01",
  "lantern_post_wood_01",
  "directional_sign_01",
  "easel_flower_01",
  "pot_pink_01",
  "planter_box_pink_01",
  "photo_terrace_01",
  "carpet_rect_flower_01",
  "carpet_vertical_plain_01",
  "carpet_vertical_plain_02",
  "flowerbed_pink_01",
  "flowerbed_mixed_01",
  "flowerbed_white_01",
  "flowerbed_blue_pink_01",
  "fireflies_cluster_01",
  "firefly_glow_01",
  "grass_tuft_object_01",
  "flower_small_01",
  "flower_small_02",
]);

const key = (x, y) => `${x},${y}`;

export { WALKABLE_NO_COLLISION };

function loadRuntimeRegistry() {
  const p = join(ROOT, "apps/web/public/assets/environment/environment-registry.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

/** Displayed pixel rect of an asset at feet position (fx, fy). */
export function displayRect(def, fx, fy, scaleOverride) {
  const s = scaleOverride ?? def.displayScale;
  const w = def.width * s;
  const h = def.height * s;
  return { left: fx - def.origin.x * w, top: fy - def.origin.y * h, w, h, s };
}

/** Collision tiles for a placement (empty when walkable). */
export function footprintTiles(def, fx, fy, scaleOverride) {
  if (WALKABLE_NO_COLLISION.has(def.id)) return [];
  const c = def.collision;
  if (!c || c.shape !== "rect") return [];
  const r = displayRect(def, fx, fy, scaleOverride);
  const x0 = Math.floor((r.left + c.xPct * r.w) / 16);
  const x1 = Math.floor((r.left + (c.xPct + c.wPct) * r.w - 0.01) / 16);
  const y0 = Math.floor((r.top + c.yPct * r.h) / 16);
  const y1 = Math.floor((r.top + (c.yPct + c.hPct) * r.h - 0.01) / 16);
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}

function tileXY(tx, ty) {
  return { x: tx * 16 + 8, y: ty * 16 + 8 };
}

/**
 * Author all placements. layout: { path:Set, npcSlots, spawns, landmarks }
 * with npcSlots/spawns as {id:{x,y}} px maps and landmarks as {id:{x,y,w,h}}.
 */
export function planDecor(layout, registry) {
  const defs = registry.assets ?? registry.avatars;
  const def = (id) => {
    const d = defs[id];
    if (!d) throw new Error(`unknown environment asset: ${id}`);
    return d;
  };
  const placements = [];
  const put = (asset, tx, ty, layer, extra = {}) => {
    const p = tileXY(tx, ty);
    placements.push({ asset, x: p.x, y: p.y, layer, ...extra });
  };

  // ---- landmarks (below layer; floors read as walkable ground) ----
  put("event_pavilion_01", 27.5, 9.5, "below"); // wedding hall (alias-resolved neutral pavilion)
  put("rsvp_pavilion_01", 33, 56, "below");
  put("event_pavilion_01", 46, 30.5, "below");
  put("fountain_main_plaza_01", 22, 32.5, "below");
  put("entrance_gate_flower_01", 27.5, 64, "below");
  put("photo_terrace_01", 27.5, 46, "below", { ground: true });
  put("wedding_arch_01", 27, 9.5, "below"); // M5 finale dressing, locked now
  put("wishing_tree_landmark_01", 21, 13, "below", { scale: 0.24 });
  put("couple_garden_table_01", 33.5, 15.5, "below");

  // ---- trees: seeded mix on layout-provided spots ----
  // trees: seeded zone mix on layout-provided spots (willow by water,
  // blossoms in the couple garden, greens elsewhere)
  const trng = rng(4451);
  const inRect = (x, y, x0, y0, w, h) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h;
  for (const [tx, ty] of layout.treeSpots) {
    const pool = inRect(tx, ty, 2, 26, 16, 16)
      ? ["tree_willow_01", "tree_green_dense_01", "tree_green_whiteflowers_01"]
      : inRect(tx, ty, 18, 11, 20, 11)
        ? ["tree_pink_blossom_01", "tree_wisteria_01", "tree_green_pinkflowers_01"]
        : ["tree_green_dense_01", "tree_green_roses_01", "tree_green_whiteflowers_01", "tree_orange_blossom_01", "tree_pink_blossom_small_01"];
    put(pool[Math.floor(trng() * pool.length)], tx, ty, "below");
  }

  // ---- flowerbeds (walkable color) ----
  put("flowerbed_pink_01", 6, 38, "below");
  put("flowerbed_mixed_01", 45, 37, "below");
  put("flowerbed_white_01", 19, 17, "below");
  put("flowerbed_blue_pink_01", 33, 14, "below");

  // ---- fences: memory garden rooms (3.5-tile segments) ----
  for (const fx of [3, 6, 11, 14]) {
    put("fence_wood_horizontal_01", fx + 1, 26, "below");
    put("fence_wood_horizontal_01", fx + 1, 41, "below");
  }

  // ---- bush hedge along the couple-garden south edge (gap at spine) ----
  for (let hx = 18; hx <= 37; hx += 2) {
    if (hx >= 25 && hx <= 29) continue;
    put("bush_leafy_01", hx, 21, "below");
  }

  // ---- lamps along the spine (registry collision: single base tile) ----
  const lamps = [[25, 16], [29, 24], [25, 48], [29, 40], [25, 60], [29, 68], [19, 31], [36, 39]];
  lamps.forEach(([lx, ly], i) => {
    put(i % 2 === 0 ? "lamp_black_01" : "lantern_post_wood_01", lx, ly, "below");
  });

  // ---- carpets to the hall door (walkable) ----
  put("carpet_rect_flower_01", 27, 11, "below", { ground: true });
  put("carpet_vertical_plain_01", 27, 66, "below", { ground: true });
  put("carpet_vertical_plain_01", 27, 70, "below", { ground: true });

  // ---- signs at junctions ----
  put("directional_sign_01", 25, 38, "below");
  put("directional_sign_01", 30, 52, "below");

  // ---- benches: quiet memory corner + event edge ----
  put("bench_wood_01", 8, 39, "below");
  put("bench_wood_01", 49, 38, "below");

  // ---- event servicing: one table, two chairs (south corner, off-path) ----
  put("table_round_white_01", 48, 38, "below");
  put("chair_white_01", 46, 39, "below");
  put("chair_white_01", 50, 38, "below");

  // ---- photo terrace dressing ----
  put("easel_flower_01", 30, 47, "below");

  // ---- hall terrace dressing (flanks, off-path) ----
  put("gift_table_01", 21, 12, "below");
  put("guestbook_podium_01", 33, 12, "below");
  put("topiary_cone_01", 24, 10, "below");
  put("topiary_cone_01", 30, 10, "below");
  put("topiary_heart_01", 30, 16, "below");

  // ---- planters along terrace/plaza edges ----
  put("pot_pink_01", 20, 13, "below");
  put("pot_pink_01", 35, 13, "below");
  put("planter_box_pink_01", 19, 31, "below");
  put("planter_box_pink_01", 36, 39, "below");

  // ---- ambient fireflies (above layer, never collide) ----
  put("fireflies_cluster_01", 24.5, 32, "above");
  put("fireflies_cluster_01", 30, 16, "above");

  // ---- resolve scales + validate ----
  const path = layout.path;
  const slotTiles = new Set();
  for (const s of [...Object.values(layout.npcSlots), ...Object.values(layout.spawns)]) {
    slotTiles.add(key(Math.floor(s.x / 16), Math.floor(s.y / 16)));
  }
  const resolved = placements.map((p, i) => {
    const d = def(p.asset);
    const scale = p.scale ?? SCALE_OVERRIDES[p.asset] ?? d.displayScale;
    const tiles = WALKABLE_NO_COLLISION.has(p.asset) ? [] : footprintTiles(d, p.x, p.y, scale);
    for (const [tx, ty] of tiles) {
      if (path.has(key(tx, ty))) {
        throw new Error(`placement ${i} (${p.asset}) covers path tile ${tx},${ty}`);
      }
      if (slotTiles.has(key(tx, ty))) {
        throw new Error(`placement ${i} (${p.asset}) covers slot/spawn tile ${tx},${ty}`);
      }
    }
    const spanW = tiles.length > 0 ? Math.max(...tiles.map(([x]) => x)) - Math.min(...tiles.map(([x]) => x)) + 1 : 0;
    if (spanW > 2) {
      for (const [tx, ty] of tiles) {
        for (const sk of slotTiles) {
          const [sx, sy] = sk.split(",").map(Number);
          if (Math.max(Math.abs(tx - sx), Math.abs(ty - sy)) < 2) {
            throw new Error(`large placement ${i} (${p.asset}) within 2 tiles of slot ${sk}`);
          }
        }
      }
    }
    return { ...p, scale };
  });

  // explicit split-passage + locked-door collision (arch/gate posts flank paths)
  const extraCollision = [
    [24, 64], [25, 64], [30, 64], [31, 64], // entrance gate posts
    ...FINALE_GATE.tiles, // wedding arch posts + locked finale center (M5 unlocks)
  ];
  return { placements: resolved, extraCollision, registry };
}
