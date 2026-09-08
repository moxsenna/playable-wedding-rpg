// Garden Village v1 map authoring (M4.6): logical layout + pack-terrain paint.
// Layout reference: WORLD_DESIGN.md (north = Wedding Hall, south = spawn).
// The .tmj keeps the 15 reserved layers and all semantic object IDs; tile
// art comes from the production terrain TSJ, structures/decor/landmarks from
// V2 atlas placements (gen-decor). planLayout() is pure placement-agnostic
// geography; buildMap() paints tiles and merges placement collision.
import { rng } from "./png-writer.mjs";
import { loadTerrain, terrainGid, routePiece, waterPiece, DIRT, STONE, GRASS_SEQUENCE, MEADOW_PICK, TUFT_PICK } from "./terrain-v2.mjs";
import { footprintTiles, WALKABLE_NO_COLLISION } from "./gen-decor.mjs";

export const MAP_W = 56;
export const MAP_H = 80;
export const TILE = 16;

export const LAYER_NAMES = [
  "00_Ground", "01_Ground_Detail", "02_Paths", "03_Water", "04_Building_Base",
  "05_Decoration_Below", "06_Collision", "07_Interaction_Zones", "08_NPC_Slots",
  "09_Spawn_Points", "10_Landmark_Zones", "11_Decoration_Above", "12_Roof_Above",
  "13_Ambient_FX", "14_Debug_Metadata",
];

export const NPC_SLOTS = [
  ["npc.greeter", 24, 69],
  ["npc.rsvp_keeper", 28, 56],
  ["npc.story_keeper", 6, 34],
  ["npc.photographer", 27, 45],
  ["npc.travel_friend", 12, 37],
  ["npc.event_coordinator", 46, 33],
  ["npc.venue_guide", 43, 37],
  ["npc.proposal_friend", 26, 17],
  ["npc.couple_a", 24, 12],
  ["npc.couple_b", 30, 12],
];

export const SPAWNS = [
  ["spawn.default", 27, 72],
  ["spawn.returning", 27, 69],
  ["spawn.wedding_hall", 27, 13],
  ["spawn.preview", 27, 35],
];

export const LANDMARKS = [
  ["landmark.entrance", 20, 62, 16, 12],
  ["landmark.rsvp", 22, 52, 18, 10],
  ["landmark.photo", 18, 42, 20, 10],
  ["landmark.main_plaza", 16, 28, 24, 14],
  ["landmark.memory_garden", 2, 26, 16, 16],
  ["landmark.event_pavilion", 39, 28, 16, 14],
  ["landmark.couple_garden", 18, 11, 20, 11],
  ["landmark.wedding_hall", 18, 0, 20, 11],
];

export const INTERACTIONS = [
  ["gate.finale", 25, 8, 5, 3],
  ["photo", 20, 43, 16, 7],
  ["wishing_tree", 28, 14, 5, 5],
  ["tutorial", 22, 68, 12, 8],
];

const key = (x, y) => `${x},${y}`;
const inRect = (x, y, x0, y0, w, h) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h;

/** Pure logical geography: paths, pond, slots, structure cells for avoidance. */
export function planLayout() {
  const W = MAP_W;
  const H = MAP_H;
  const r = rng(20260907);
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  const path = new Set();
  for (let y = 10; y <= 74; y++) for (let x = 26; x <= 28; x++) path.add(key(x, y));
  for (let x = 6; x <= 49; x++) for (let y = 34; y <= 36; y++) path.add(key(x, y));

  const pond = new Set();
  for (let y = 26; y <= 32; y++)
    for (let x = 4; x <= 14; x++) {
      const dx = (x - 9) / 4, dy = (y - 29) / 2;
      if (dx * dx + dy * dy <= 1) pond.add(key(x, y));
    }

  const px = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
  const npcSlots = Object.fromEntries(NPC_SLOTS.map(([n, x, y]) => [n, { ...px(x, y) }]));
  const spawns = Object.fromEntries(SPAWNS.map(([n, x, y]) => [n, { ...px(x, y) }]));
  const landmarks = Object.fromEntries(
    LANDMARKS.map(([n, x, y, w, h]) => [n, { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE }])
  );

  // structure cells (trunk avoidance): landmark footprints, floors, hedge/fence/bed lines
  const struct = new Set();
  const structRect = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) struct.add(key(x, y));
  };
  structRect(20, 1, 16, 10); // hall mass
  structRect(29, 53, 9, 5); // rsvp stall zone
  structRect(40, 28, 13, 5); // event pavilion zone
  structRect(21, 30, 6, 5); // fountain zone
  structRect(23, 63, 9, 3); // entrance arch zone
  structRect(18, 30, 20, 11); // plaza floor
  structRect(20, 10, 16, 4); // hall terrace
  structRect(20, 43, 16, 7); // photo deck
  for (let hx = 18; hx <= 37; hx++) struct.add(key(hx, 21)); // hedge row
  for (const fy of [26, 41]) for (let fx = 3; fx <= 16; fx++) struct.add(key(fx, fy)); // fences
  for (const [bx, by] of [[21, 13], [32, 13], [5, 36], [44, 36], [18, 16]])
    structRect(bx, by, 3, 2); // beds
  for (const [lx, ly] of [[25, 16], [29, 24], [25, 48], [29, 40], [25, 60], [29, 68], [19, 31], [36, 39]])
    struct.add(key(lx, ly)); // lanterns

  // tree spots: seeded, clear of paths/pond/structures/slots (margin 2)
  const reserved = new Set([...path, ...pond, ...struct]);
  for (const [, sx, sy] of [...NPC_SLOTS, ...SPAWNS]) {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) reserved.add(key(sx + dx, sy + dy));
  }
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 14 && guard++ < 4000) {
    const x = 2 + Math.floor(r() * 52);
    const y = 11 + Math.floor(r() * 64);
    if (!inB(x, y) || reserved.has(key(x, y))) continue;
    treeSpots.push([x, y]);
    reserved.add(key(x, y));
  }

  return { W, H, path, pond, npcSlots, spawns, landmarks, treeSpots, rng: r };
}

/** Paint the TMJ from layout + placements + pack terrain. */
export function buildMap(layout, decor, terrain) {
  const { W, H, path, pond, npcSlots, spawns, landmarks } = layout;
  const r = rng(20260907 + 1);
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const isPath = (x, y) => path.has(key(x, y));

  const solid = new Set();
  const block = (x, y) => { if (inB(x, y)) solid.add(key(x, y)); };
  for (let x = 0; x < W; x++) { block(x, 0); block(x, H - 1); }
  for (let y = 0; y < H; y++) { block(0, y); block(W - 1, y); }
  for (const k of pond) {
    const [x, y] = k.split(",").map(Number);
    block(x, y);
  }
  // placement footprints (registry fractions) + explicit door/gate tiles
  for (const p of decor.placements) {
    if (WALKABLE_NO_COLLISION.has(p.asset)) continue;
    const entry = decor.registry.assets[p.asset];
    if (!entry) throw new Error(`placement references unknown asset: ${p.asset}`);
    for (const [x, y] of footprintTiles(entry, p.x, p.y, p.scale)) block(x, y);
  }
  for (const [x, y] of decor.extraCollision) block(x, y);

  const grid = () => new Array(W * H).fill(0);
  const G = {
    ground: grid(), detail: grid(), paths: grid(), water: grid(),
    base: grid(), decor: grid(), coll: grid(), above: grid(), roof: grid(),
  };
  const set = (g, x, y, gid) => { if (inB(x, y)) g[y * W + x] = gid; };
  const gid = (name) => {
    const v = terrain.byName.get(name);
    if (v === undefined) throw new Error(`unknown terrain tile: ${name}`);
    return v;
  };

  // 00 ground: restrained pack-grass variation (no single-tile repetition)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      set(G.ground, x, y, gid(GRASS_SEQUENCE[(x * 7 + y * 13) % GRASS_SEQUENCE.length]));
    }

  // 01 detail: meadow + tufts, never on paths
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isPath(x, y)) continue;
      const v = r();
      if (inRect(x, y, 3, 27, 13, 14) || inRect(x, y, 19, 12, 18, 9)) {
        if (v < 0.24) set(G.detail, x, y, gid(MEADOW_PICK[Math.floor(r() * MEADOW_PICK.length)]));
      } else if (inRect(x, y, 18, 10, 20, 5) || inRect(x, y, 16, 28, 24, 14)) {
        if (v < 0.10) set(G.detail, x, y, gid("grass_flowers_sparse_01"));
        else if (v < 0.2) set(G.detail, x, y, gid(TUFT_PICK[Math.floor(r() * TUFT_PICK.length)]));
      } else if (v < 0.05) {
        set(G.detail, x, y, gid(TUFT_PICK[Math.floor(r() * TUFT_PICK.length)]));
      }
    }

  // 02 paths: dirt everywhere, stone on the formal hall approach (spine y10-21)
  const at = (x, y) => (isPath(x, y) ? 1 : 0);
  for (const k of path) {
    const [x, y] = k.split(",").map(Number);
    const formal = x >= 26 && x <= 28 && y >= 10 && y <= 21;
    const setName = formal ? STONE : DIRT;
    set(G.paths, x, y, gid(routePiece(setName, at(x, y - 1), at(x, y + 1), at(x + 1, y), at(x - 1, y))));
  }

  // 03 water: pond with edged shoreline + lily accents
  for (const k of pond) {
    const [x, y] = k.split(",").map(Number);
    const inPond = (ax, ay) => pond.has(key(ax, ay)) ? 1 : 0;
    set(G.water, x, y, gid(waterPiece(inPond(x, y - 1), inPond(x, y + 1), inPond(x + 1, y), inPond(x - 1, y))));
  }
  set(G.water, 8, 29, gid("water_lily_pond_01"));
  set(G.water, 10, 30, gid("water_center_02"));

  // 04 floors in stone (skip path cells): plaza, pavilion, terrace, deck
  const stone = (x, y) => gid((x + y) % 2 === 0 ? "path_stone_center_01" : "path_stone_center_02");
  const paintFloor = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) if (!isPath(x, y)) set(G.base, x, y, stone(x, y));
  };
  paintFloor(18, 30, 20, 11);
  paintFloor(41, 30, 11, 10);
  paintFloor(20, 10, 16, 4);
  paintFloor(20, 43, 16, 7);

  // 05/11/12 stay empty: decor now arrives as atlas placements (below/above).
  // 06 collision mirrors the solid set through a terrain tile (invisible).
  const collGid = gid("grass_plain_01");
  for (const k of solid) {
    const [x, y] = k.split(",").map(Number);
    set(G.coll, x, y, collGid);
  }

  // ---- object layers (semantic IDs unchanged) ----
  let oid = 1;
  const pt = (name, type, tx, ty, extra = {}) => ({
    height: 0, id: oid++, name, point: true, rotation: 0, type,
    visible: true, width: 0, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, ...extra,
  });
  const rc = (name, type, tx, ty, w, h, extra = {}) => ({
    height: h * TILE, id: oid++, name, rotation: 0, type,
    visible: true, width: w * TILE, x: tx * TILE, y: ty * TILE, ...extra,
  });
  const interactions = INTERACTIONS.map(([n, x, y, w, h]) => rc(n, "interaction", x, y, w, h));
  const npcSlotObjs = NPC_SLOTS.map(([n, x, y]) => pt(n, "npc_slot", x, y));
  const spawnObjs = SPAWNS.map(([n, x, y]) => pt(n, "spawn", x, y));
  const landmarkObjs = LANDMARKS.map(([n, x, y, w, h]) => rc(n, "landmark", x, y, w, h));
  const ambient = [
    rc("ambient.fountain", "ambient", 24, 32, 2, 2,
      { properties: [{ name: "fx", type: "string", value: "sparkle" }] }),
    rc("ambient.wishing_tree", "ambient", 20, 12, 3, 3,
      { properties: [{ name: "fx", type: "string", value: "petals" }] }),
    rc("ambient.pond", "ambient", 7, 28, 4, 3,
      { properties: [{ name: "fx", type: "string", value: "ripple" }] }),
    rc("ambient.plaza", "ambient", 31, 35, 3, 3,
      { properties: [{ name: "fx", type: "string", value: "petals" }] }),
  ];
  const debug = [pt("debug.world", "debug", 0, 0, {
    properties: [
      { name: "templateKey", type: "string", value: "garden-village-v1" },
      { name: "templateVersion", type: "int", value: 1 },
      { name: "generator", type: "string", value: "tooling/world-gen" },
    ],
  })];

  const tileLayer = (id, name, data, visible = true) => ({
    data, height: H, id, name, opacity: 1, type: "tilelayer",
    visible, width: W, x: 0, y: 0,
  });
  const objLayer = (id, name, objects) => ({
    draworder: "topdown", id, name, objects, opacity: 1,
    type: "objectgroup", visible: true, x: 0, y: 0,
  });

  const tmj = {
    compressionlevel: -1, height: H, infinite: false,
    layers: [
      tileLayer(1, "00_Ground", G.ground),
      tileLayer(2, "01_Ground_Detail", G.detail),
      tileLayer(3, "02_Paths", G.paths),
      tileLayer(4, "03_Water", G.water),
      tileLayer(5, "04_Building_Base", G.base),
      tileLayer(6, "05_Decoration_Below", G.decor),
      tileLayer(7, "06_Collision", G.coll, false),
      objLayer(8, "07_Interaction_Zones", interactions),
      objLayer(9, "08_NPC_Slots", npcSlotObjs),
      objLayer(10, "09_Spawn_Points", spawnObjs),
      objLayer(11, "10_Landmark_Zones", landmarkObjs),
      tileLayer(12, "11_Decoration_Above", G.above),
      tileLayer(13, "12_Roof_Above", G.roof),
      objLayer(14, "13_Ambient_FX", ambient),
      objLayer(15, "14_Debug_Metadata", debug),
    ],
    nextlayerid: 16, nextobjectid: oid,
    orientation: "orthogonal", renderorder: "right-down",
    tiledversion: "1.10", tileheight: TILE, tilesets: [
      { firstgid: 1, source: "../../sprites/playable_wedding_environment_pack_v2/terrain/terrain_tiles.tsj" },
    ],
    tilewidth: TILE, type: "map", version: "1.10", width: W,
  };

  return { tmj, solid, path, treeSpots: layout.treeSpots };
}
