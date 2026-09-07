// Garden Village v1 map authoring script.
// Builds a real Tiled .tmj (56x80, 16px, orthogonal) with the 15 reserved
// layers, 10 NPC slots, 4 spawns, 8 landmarks, interaction zones, and a
// collision model. Output is Tiled-editable; the checked-in .tmj is the
// source of truth, this script is the reproducible author.
// Layout reference: WORLD_DESIGN.md (north = Wedding Hall, south = spawn).
import { T } from "./gen-tileset.mjs";
import { rng } from "./png-writer.mjs";

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

export function buildMap() {
  const W = MAP_W;
  const H = MAP_H;
  const r = rng(20260907);
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  // ---- path set: north-south spine + east-west branch ----
  const path = new Set();
  for (let y = 10; y <= 74; y++) for (let x = 26; x <= 28; x++) path.add(key(x, y));
  for (let x = 6; x <= 49; x++) for (let y = 34; y <= 36; y++) path.add(key(x, y));
  const isPath = (x, y) => path.has(key(x, y));

  // ---- collision set (tile coords) ----
  const solid = new Set();
  const block = (x, y) => { if (inB(x, y)) solid.add(key(x, y)); };
  const blockRect = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) block(x, y);
  };
  // map border ring
  for (let x = 0; x < W; x++) { block(x, 0); block(x, H - 1); }
  for (let y = 0; y < H; y++) { block(0, y); block(W - 1, y); }

  // ---- tile layers ----
  const grid = () => new Array(W * H).fill(0);
  const G = {
    ground: grid(), detail: grid(), paths: grid(), water: grid(),
    base: grid(), decor: grid(), coll: grid(), above: grid(), roof: grid(),
  };
  const set = (g, x, y, gid) => { if (inB(x, y)) g[y * W + x] = gid; };

  // 00 ground: grass-a + noise patches of b/c
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = r();
      set(G.ground, x, y, n < 0.72 ? T.GRASS_A : n < 0.88 ? T.GRASS_B : T.GRASS_C);
    }

  // 01 detail: meadow clusters + tufts + petals
  const inRect = (x, y, x0, y0, w, h) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isPath(x, y)) continue;
      const v = r();
      if (inRect(x, y, 3, 27, 13, 14) || inRect(x, y, 19, 12, 18, 9)) {
        if (v < 0.22) set(G.detail, x, y, T.MEADOW);
        else if (v < 0.34) set(G.detail, x, y, T.TUFTS);
      } else if (inRect(x, y, 18, 10, 20, 5) || inRect(x, y, 16, 28, 24, 14)) {
        if (v < 0.10) set(G.detail, x, y, T.PETALS);
        else if (v < 0.20) set(G.detail, x, y, T.TUFTS);
      } else if (v < 0.06) {
        set(G.detail, x, y, T.TUFTS);
      }
    }

  // 02 paths with auto edge ring data (edges painted into decor layer later)
  for (const k of path) {
    const [x, y] = k.split(",").map(Number);
    set(G.paths, x, y, T.PATH);
  }
  // edge variant selection for border path cells
  const edgeFor = (x, y) => {
    const n = !isPath(x, y - 1), s = !isPath(x, y + 1);
    const w = !isPath(x - 1, y), e = !isPath(x + 1, y);
    if (n && w) return T.CORNER_NW;
    if (n && e) return T.CORNER_NE;
    if (s && w) return T.CORNER_SW;
    if (s && e) return T.CORNER_SE;
    if (n) return T.EDGE_N;
    if (s) return T.EDGE_S;
    if (w) return T.EDGE_W;
    if (e) return T.EDGE_E;
    return T.PATH;
  };

  // 03 water: memory-garden pond ellipse
  const pond = new Set();
  for (let y = 26; y <= 32; y++)
    for (let x = 4; x <= 14; x++) {
      const dx = (x - 9) / 4, dy = (y - 29) / 2;
      const d = dx * dx + dy * dy;
      if (d <= 1) {
        pond.add(key(x, y));
        set(G.water, x, y, d <= 0.4 ? T.WATER_DEEP : T.WATER);
        block(x, y);
      }
    }

  // helper: paint rect of tiles, optionally skipping path cells
  const paintRect = (g, x0, y0, w, h, gidFn, skipPath = false) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (skipPath && isPath(x, y)) continue;
        const gid = typeof gidFn === "function" ? gidFn(x, y) : gidFn;
        set(g, x, y, gid);
      }
  };
  const checker = (a, b) => (x, y) => ((x + y) % 2 === 0 ? a : b);

  // 04 building base: floors (skip path cells so the spine stays continuous)
  paintRect(G.base, 18, 30, 20, 11, checker(T.PLAZA, T.PLAZA_ALT), true); // plaza
  paintRect(G.base, 41, 30, 11, 10, checker(T.PLAZA, T.PLAZA_ALT), true); // pavilion floor
  paintRect(G.base, 20, 43, 16, 7, T.STAGE, true); // photo deck
  paintRect(G.base, 20, 10, 16, 4, checker(T.PLAZA, T.PLAZA_ALT), true); // hall terrace

  // wedding hall mass: north wall with windows, front row with gate
  for (let x = 20; x <= 35; x++) {
    const win = x === 22 || x === 23 || x === 31 || x === 32;
    set(G.base, x, 7, win ? T.WINDOW : T.WALL); block(x, 7);
    set(G.base, x, 8, T.WALL); block(x, 8);
  }
  for (let x = 20; x <= 35; x++) {
    if (x === 27) { set(G.base, x, 9, T.GATE); block(x, 9); } // locked finale gate
    else { set(G.base, x, 9, T.WALL); block(x, 9); }
  }
  block(20, 9); block(35, 9);

  // RSVP stall: counter + posts (east of spine, spine stays open)
  paintRect(G.base, 30, 56, 7, 1, T.COUNTER);
  blockRect(30, 56, 7, 1);
  for (const [px, py] of [[30, 55], [36, 55], [30, 57], [36, 57]]) {
    set(G.decor, px, py, T.PILLAR); block(px, py);
  }

  // event pavilion corner pillars
  for (const [px, py] of [[41, 30], [51, 30], [41, 39], [51, 39]]) {
    set(G.base, px, py, T.PILLAR); block(px, py);
  }

  // entrance arch pillars (gap x25-30 keeps the spine open)
  for (const px of [24, 31]) { set(G.decor, px, 64, T.PILLAR); block(px, 64); }

  // 05 decor below: path edges, carpet, fountain, flower beds, fences, lanterns
  for (const k of path) {
    const [x, y] = k.split(",").map(Number);
    const e = edgeFor(x, y);
    if (e !== T.PATH) set(G.paths, x, y, e);
  }
  paintRect(G.decor, 26, 10, 3, 4, T.CARPET); // wedding carpet to the gate
  // fountain (west of spine so the spine stays straight)
  paintRect(G.decor, 24, 32, 2, 2, T.FOUNTAIN);
  blockRect(24, 32, 2, 2);
  // flower beds (walkable decoration)
  for (const [bx, by] of [[21, 13], [32, 13], [5, 36], [44, 36]])
    paintRect(G.decor, bx, by, 3, 2, T.ROSES);
  // memory-garden fences with north/south entry gaps
  for (const fy of [26, 41])
    for (const fx of [3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16]) {
      if (pond.has(key(fx, fy))) continue;
      set(G.decor, fx, fy, T.FENCE); block(fx, fy);
    }
  // couple-garden hedge with a wide spine gap
  for (let hx = 18; hx <= 37; hx++) {
    if (hx >= 25 && hx <= 29) continue;
    set(G.decor, hx, 21, T.BUSH); block(hx, 21);
  }
  // lanterns (small: no collision)
  for (const [lx, ly] of [[25, 16], [29, 24], [25, 48], [29, 40], [25, 60], [29, 68], [19, 31], [36, 39]])
    set(G.decor, lx, ly, T.LANTERN);
  // border bushes (selected decoration: collide)
  for (const [bx, by] of [[2, 5], [2, 15], [2, 25], [2, 45], [2, 55], [2, 65], [53, 10], [53, 20], [53, 30], [53, 50], [53, 60], [53, 70], [10, 77], [20, 77], [30, 77], [40, 77], [50, 77]]) {
    set(G.decor, bx, by, T.BUSH); block(bx, by);
  }

  // trees: seeded rejection sampling, clear of paths/structures/slots/spawns
  const reserved = new Set([...path, ...pond, ...solid]);
  for (const [id, sx, sy] of [...NPC_SLOTS, ...SPAWNS]) {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) reserved.add(key(sx + dx, sy + dy));
  }
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 14 && guard++ < 2000) {
    const x = 2 + Math.floor(r() * 52);
    const y = 11 + Math.floor(r() * 64);
    if (reserved.has(key(x, y)) || reserved.has(key(x, y - 1))) continue;
    // keep off floors/beds/hedge row
    if (inRect(x, y, 16, 28, 24, 14) || inRect(x, y, 39, 28, 16, 14) ||
        inRect(x, y, 18, 10, 20, 5) || inRect(x, y, 18, 43, 20, 8) || y === 21) continue;
    treeSpots.push([x, y]);
    reserved.add(key(x, y)); reserved.add(key(x, y - 1));
  }
  for (const [tx, ty] of treeSpots) {
    set(G.decor, tx, ty, T.TRUNK); block(tx, ty);
    set(G.above, tx, ty - 1, T.CANOPY);
  }
  // wishing tree (hero tree, couple garden)
  set(G.decor, 30, 16, T.TRUNK); block(30, 16);
  set(G.above, 30, 15, T.CANOPY);

  // 11 above: entrance arch top
  paintRect(G.above, 24, 63, 8, 1, T.BLOOMS);

  // 12 roof: hall + stall + pavilion
  paintRect(G.roof, 20, 1, 16, 1, T.RIDGE);
  paintRect(G.roof, 20, 2, 16, 4, T.ROOF);
  paintRect(G.roof, 20, 6, 16, 1, T.ROOF_SHADOW);
  paintRect(G.roof, 29, 53, 9, 2, T.STALL_ROOF);
  paintRect(G.roof, 41, 29, 11, 1, T.RIDGE);
  paintRect(G.roof, 41, 30, 11, 1, T.ROOF_SHADOW);

  // collision layer mirrors the solid set
  for (const k of solid) {
    const [x, y] = k.split(",").map(Number);
    set(G.coll, x, y, T.COLLISION);
  }

  // ---- object layers ----
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
  const npcSlots = NPC_SLOTS.map(([n, x, y]) => pt(n, "npc_slot", x, y));
  const spawns = SPAWNS.map(([n, x, y]) => pt(n, "spawn", x, y));
  const landmarks = LANDMARKS.map(([n, x, y, w, h]) => rc(n, "landmark", x, y, w, h));
  const ambient = [
    rc("ambient.fountain", "ambient", 24, 32, 2, 2,
      { properties: [{ name: "fx", type: "string", value: "sparkle" }] }),
    rc("ambient.wishing_tree", "ambient", 29, 15, 3, 3,
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
      objLayer(9, "08_NPC_Slots", npcSlots),
      objLayer(10, "09_Spawn_Points", spawns),
      objLayer(11, "10_Landmark_Zones", landmarks),
      tileLayer(12, "11_Decoration_Above", G.above),
      tileLayer(13, "12_Roof_Above", G.roof),
      objLayer(14, "13_Ambient_FX", ambient),
      objLayer(15, "14_Debug_Metadata", debug),
    ],
    nextlayerid: 16, nextobjectid: oid,
    orientation: "orthogonal", renderorder: "right-down",
    tiledversion: "1.10", tileheight: TILE, tilesets: [
      { firstgid: 1, source: "../../tilesets/wedding-garden.tsj" },
    ],
    tilewidth: TILE, type: "map", version: "1.10", width: W,
  };

  return { tmj, solid, path, treeSpots };
}
