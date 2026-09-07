// Procedural wedding-garden tileset painter.
// 16x16 tiles, 8 columns x 6 rows (48 slots, 42 used). All art is generated
// in-repo (no license encumbrance); Tiled/Phaser consume the PNG + .tsj.
// Local tile ids are 1-based; with firstgid=1, gid === local id.
import { canvas, setPx, fillRect, hex, rng, writePNG } from "./png-writer.mjs";

export const TW = 16;
export const TH = 16;
export const COLS = 8;
export const ROWS = 6;

export const T = {
  GRASS_A: 1, GRASS_B: 2, GRASS_C: 3, MEADOW: 4, TUFTS: 5, PATH: 6,
  EDGE_N: 7, EDGE_S: 8, EDGE_W: 9, EDGE_E: 10,
  CORNER_NW: 11, CORNER_NE: 12, CORNER_SW: 13, CORNER_SE: 14,
  WATER: 15, WATER_DEEP: 16,
  WALL: 17, WINDOW: 18, ROOF: 19, ROOF_SHADOW: 20, RIDGE: 21,
  TRUNK: 22, CANOPY: 23, BUSH: 24,
  ROSES: 25, LANTERN: 26, FENCE: 27, FOUNTAIN: 28, POND_SPARKLE: 29,
  PLAZA: 30, PLAZA_ALT: 31, CARPET: 32,
  STAGE: 33, PETALS: 34, PILLAR: 35, BLOOMS: 36, STALL_ROOF: 37,
  COUNTER: 38, GATE: 39, SPARE: 40, COLLISION: 41,
};

const C = {
  grass: hex("#79c25f"), grassD: hex("#5da244"), grassL: hex("#8fd47a"),
  grassB: hex("#71b958"), grassC: hex("#67ad4e"),
  path: hex("#e6d29a"), pathD: hex("#d4bd7f"), pathL: hex("#f4e6bd"),
  water: hex("#3fa7e0"), waterD: hex("#2b7fc4"), spark: hex("#bfe9ff"),
  cream: hex("#f3e7cb"), creamD: hex("#d9c69c"), timber: hex("#8a5a33"),
  timberD: hex("#6b4426"), roof: hex("#c94f4f"), roofD: hex("#a03a3a"),
  roofL: hex("#e08a8a"), trunk: hex("#7a4f2b"), trunkD: hex("#5d3a1f"),
  leaf: hex("#3f9e4d"), leafD: hex("#2c7a38"), leafL: hex("#63c774"),
  bushD: hex("#35793f"), rose: hex("#d94040"), roseL: hex("#f27676"),
  stem: hex("#2c7a38"), post: hex("#4a4a52"), glow: hex("#ffe08a"),
  glowW: hex("#fff6d8"), cap: hex("#33363f"), wood: hex("#9a6b3f"),
  woodD: hex("#7a5230"), stone: hex("#b9c2cc"), stoneD: hex("#8d97a3"),
  plaza: hex("#cfd4d9"), plazaB: hex("#bcc2c9"), grout: hex("#9aa1a9"),
  carpet: hex("#c93a4b"), carpetD: hex("#8e2432"), gold: hex("#e8b64c"),
  stage: hex("#b07a45"), stageD: hex("#8a5a30"), white: hex("#ffffff"),
  pink: hex("#f7b8c8"), bloom: hex("#f2a0c0"), soil: hex("#6b4a2f"),
  iron: hex("#3c3f4a"), magenta: hex("#ff00ff"),
};

function tileCtx(buf, id) {
  const col = (id - 1) % COLS;
  const row = Math.floor((id - 1) / COLS);
  const ox = col * TW;
  const oy = row * TH;
  return {
    px: (x, y, c) => setPx(buf, COLS * TW, ox + x, oy + y, c),
    fill: (c) => fillRect(buf, COLS * TW, ox, oy, TW, TH, c),
    rect: (x, y, w, h, c) => fillRect(buf, COLS * TW, ox + x, oy + y, w, h, c),
  };
}

function speckle(g, r, colors, n) {
  for (let i = 0; i < n; i++) {
    g.px(Math.floor(r() * 16), Math.floor(r() * 16), colors[Math.floor(r() * colors.length)]);
  }
}

function grassBase(g, r, base = C.grass) {
  g.fill(base);
  speckle(g, r, [C.grassD, C.grassD, C.grassL], 16);
}

// Path tile with grass lip on the given sides ("n","s","e","w" combos).
function edgeTile(g, r, sides) {
  g.fill(C.path);
  speckle(g, r, [C.pathD, C.pathL], 12);
  const lip = (x, y, w, h) => {
    g.rect(x, y, w, h, C.grass);
    // scalloped transition dots
    for (let i = 0; i < Math.max(w, h); i += 2) {
      const sx = h === 2 || h === 3 ? x + i : x + (w > 2 ? 1 : 0);
      const sy = w === 2 || w === 3 ? y + i : y + (h > 2 ? 1 : 0);
      if (r() < 0.7) g.px(sx, sy, C.grassD);
    }
  };
  if (sides.includes("n")) lip(0, 0, 16, 3);
  if (sides.includes("s")) lip(0, 13, 16, 3);
  if (sides.includes("w")) lip(0, 0, 3, 16);
  if (sides.includes("e")) lip(13, 0, 3, 16);
}

const painters = {
  [T.GRASS_A]: (g, r) => grassBase(g, r),
  [T.GRASS_B]: (g, r) => { grassBase(g, r, C.grassB); },
  [T.GRASS_C]: (g, r) => { grassBase(g, r, C.grassC); },
  [T.MEADOW]: (g, r) => {
    grassBase(g, r);
    for (let i = 0; i < 5; i++) {
      const x = 1 + Math.floor(r() * 14);
      const y = 1 + Math.floor(r() * 14);
      g.px(x, y, C.white); g.px(x + 1, y, C.white);
      g.px(x, y + 1, C.stem); g.px(x, y - 1 >= 0 ? y - 1 : y, hex("#ffd94d"));
    }
  },
  [T.TUFTS]: (g, r) => {
    grassBase(g, r);
    for (let i = 0; i < 6; i++) {
      const x = 1 + Math.floor(r() * 14);
      const y = 2 + Math.floor(r() * 12);
      g.px(x, y, C.grassD); g.px(x, y - 1, C.grassD); g.px(x + 1, y, C.leafD);
    }
  },
  [T.PATH]: (g, r) => {
    g.fill(C.path);
    speckle(g, r, [C.pathD, C.pathD, C.pathL], 18);
    g.rect(0, 15, 16, 1, C.pathD);
  },
  [T.EDGE_N]: (g, r) => edgeTile(g, r, "n"),
  [T.EDGE_S]: (g, r) => edgeTile(g, r, "s"),
  [T.EDGE_W]: (g, r) => edgeTile(g, r, "w"),
  [T.EDGE_E]: (g, r) => edgeTile(g, r, "e"),
  [T.CORNER_NW]: (g, r) => edgeTile(g, r, "nw"),
  [T.CORNER_NE]: (g, r) => edgeTile(g, r, "ne"),
  [T.CORNER_SW]: (g, r) => edgeTile(g, r, "sw"),
  [T.CORNER_SE]: (g, r) => edgeTile(g, r, "se"),
  [T.WATER]: (g, r) => {
    g.fill(C.water);
    speckle(g, r, [C.waterD], 8);
    g.rect(2, 4, 5, 1, C.spark); g.rect(9, 10, 4, 1, C.spark);
  },
  [T.WATER_DEEP]: (g, r) => {
    g.fill(C.waterD);
    g.rect(3, 3, 2, 1, C.spark); g.rect(10, 11, 3, 1, C.water);
  },
  [T.WALL]: (g) => {
    g.fill(C.cream);
    g.rect(0, 0, 16, 3, C.timber); g.rect(0, 2, 16, 1, C.timberD);
    g.rect(0, 14, 16, 2, C.creamD);
    speckle(g, rng(99), [C.creamD], 4);
  },
  [T.WINDOW]: (g) => {
    g.fill(C.cream);
    g.rect(0, 0, 16, 3, C.timber);
    g.rect(3, 5, 10, 7, C.timber); g.rect(4, 6, 8, 5, hex("#9fd8ef"));
    g.rect(7, 6, 2, 5, C.timber); g.rect(4, 8, 8, 1, C.timber);
    g.rect(2, 12, 12, 2, C.creamD);
  },
  [T.ROOF]: (g, r) => {
    g.fill(C.roof);
    for (let y = 3; y < 16; y += 4) g.rect(0, y, 16, 1, C.roofD);
    g.rect(0, 0, 16, 1, C.roofL);
    speckle(g, r, [C.roofD], 5);
  },
  [T.ROOF_SHADOW]: (g, r) => {
    g.fill(C.roofD);
    for (let y = 3; y < 16; y += 4) g.rect(0, y, 16, 1, hex("#7e2c2c"));
    g.rect(0, 14, 16, 2, hex("#6e2626"));
    speckle(g, r, [C.roof], 3);
  },
  [T.RIDGE]: (g) => {
    g.fill(C.roof);
    g.rect(0, 6, 16, 4, C.roofL); g.rect(0, 7, 16, 2, hex("#f2b0b0"));
    g.rect(0, 0, 16, 2, C.roofD); g.rect(0, 14, 16, 2, C.roofD);
  },
  [T.TRUNK]: (g, r) => {
    grassBase(g, r);
    g.rect(6, 0, 4, 16, C.trunk); g.rect(6, 0, 1, 16, C.trunkD);
    g.rect(9, 2, 1, 12, hex("#96703f"));
    g.rect(4, 13, 8, 2, C.trunkD); g.rect(3, 14, 10, 1, C.soil);
  },
  [T.CANOPY]: (g, r) => {
    // transparent background: overhead layer
    const blob = (cx, cy, rx, ry, c) => {
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++)
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) g.px(cx + x, cy + y, c);
    };
    blob(8, 8, 7, 6, C.leafD);
    blob(8, 7, 6, 5, C.leaf);
    blob(6, 5, 3, 2, C.leafL);
    speckle(g, r, [C.leafL, C.roseL], 4);
    g.rect(2, 13, 12, 1, C.leafD);
  },
  [T.BUSH]: (g, r) => {
    grassBase(g, r);
    g.rect(2, 7, 12, 6, C.leaf); g.rect(2, 7, 12, 2, C.leafL);
    g.rect(2, 12, 12, 1, C.bushD);
    g.rect(4, 5, 3, 2, C.leaf); g.rect(9, 5, 3, 2, C.leaf);
    speckle(g, r, [C.leafD], 6);
  },
  [T.ROSES]: (g, r) => {
    grassBase(g, r);
    g.rect(1, 10, 14, 4, C.soil); g.rect(1, 10, 14, 1, hex("#83603c"));
    for (let i = 0; i < 4; i++) {
      const x = 2 + i * 3 + Math.floor(r() * 2);
      g.rect(x, 6, 1, 4, C.stem);
      g.rect(x - 1, 3, 3, 3, C.rose); g.px(x, 3, C.roseL); g.px(x, 4, C.roseL);
    }
  },
  [T.LANTERN]: (g) => {
    grassBase(g, rng(7));
    g.rect(7, 7, 2, 9, C.post);
    g.rect(5, 5, 6, 1, C.cap); g.rect(6, 2, 4, 3, C.glow);
    g.rect(7, 2, 2, 3, C.glowW); g.rect(5, 0, 6, 2, C.cap);
    g.rect(6, 15, 4, 1, C.cap);
  },
  [T.FENCE]: (g) => {
    grassBase(g, rng(11));
    g.rect(0, 5, 16, 2, C.wood); g.rect(0, 10, 16, 2, C.woodD);
    for (const x of [2, 12]) { g.rect(x, 2, 3, 12, C.wood); g.rect(x, 2, 3, 1, C.woodD); }
  },
  [T.FOUNTAIN]: (g, r) => {
    g.fill(C.stone);
    g.rect(0, 0, 16, 2, C.stoneD); g.rect(0, 14, 16, 2, C.stoneD);
    g.rect(3, 3, 10, 10, C.water);
    g.rect(4, 5, 4, 1, C.spark); g.rect(8, 9, 4, 1, C.spark);
    speckle(g, r, [C.waterD], 5);
    g.rect(7, 6, 2, 2, C.stoneD);
  },
  [T.POND_SPARKLE]: (g, r) => {
    g.fill(C.water);
    g.rect(1, 2, 5, 1, C.spark); g.rect(8, 6, 6, 1, C.spark);
    g.rect(4, 11, 4, 1, C.waterD); g.rect(11, 12, 3, 1, C.spark);
    speckle(g, r, [C.waterD], 4);
  },
  [T.PLAZA]: (g) => {
    g.fill(C.plaza);
    for (let y = 0; y < 16; y += 8)
      for (let x = 0; x < 16; x += 8) { g.px(x + 7, y + 3, C.grout); }
    g.rect(0, 7, 16, 1, C.grout); g.rect(7, 0, 1, 16, C.grout);
    g.rect(0, 15, 16, 1, C.plazaB);
  },
  [T.PLAZA_ALT]: (g) => {
    g.fill(C.plazaB);
    g.rect(0, 7, 16, 1, C.grout); g.rect(7, 0, 1, 16, C.grout);
    g.rect(0, 0, 16, 1, C.plaza);
  },
  [T.CARPET]: (g, r) => {
    g.fill(C.carpet);
    g.rect(0, 0, 2, 16, C.carpetD); g.rect(14, 0, 2, 16, C.carpetD);
    g.rect(2, 0, 1, 16, C.gold); g.rect(13, 0, 1, 16, C.gold);
    for (let y = 2; y < 16; y += 5) { g.px(7, y, C.gold); g.px(8, y, C.gold); }
    speckle(g, r, [C.carpetD], 4);
  },
  [T.STAGE]: (g) => {
    g.fill(C.stage);
    for (let y = 3; y < 16; y += 4) g.rect(0, y, 16, 1, C.stageD);
    g.rect(0, 0, 16, 1, hex("#c8925a"));
    g.px(3, 1, C.stageD); g.px(12, 9, C.stageD);
  },
  [T.PETALS]: (g, r) => {
    grassBase(g, r);
    for (let i = 0; i < 12; i++) {
      g.px(Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? C.white : C.pink);
    }
  },
  [T.PILLAR]: (g) => {
    grassBase(g, rng(13));
    g.rect(5, 0, 6, 16, C.cream); g.rect(5, 0, 2, 16, C.creamD);
    g.rect(4, 0, 8, 2, C.creamD); g.rect(4, 14, 8, 2, C.creamD);
  },
  [T.BLOOMS]: (g, r) => {
    grassBase(g, r);
    g.rect(1, 2, 2, 14, C.timber); g.rect(13, 2, 2, 14, C.timber);
    g.rect(1, 0, 14, 5, C.bloom);
    speckle(g, r, [C.rose, C.white, C.leaf], 14);
    g.rect(1, 5, 14, 1, C.stem);
  },
  [T.STALL_ROOF]: (g) => {
    for (let x = 0; x < 16; x += 4) {
      g.rect(x, 0, 2, 14, C.roof); g.rect(x + 2, 0, 2, 14, hex("#f6f1e3"));
    }
    g.rect(0, 14, 16, 2, C.roofD);
    for (let x = 0; x < 16; x += 4) g.rect(x, 13, 2, 1, C.roofD);
  },
  [T.COUNTER]: (g) => {
    g.fill(C.wood);
    g.rect(0, 0, 16, 4, hex("#c08a52")); g.rect(0, 3, 16, 1, C.woodD);
    g.rect(0, 8, 16, 1, C.woodD);
    g.rect(3, 10, 10, 3, hex("#a87947"));
  },
  [T.GATE]: (g) => {
    g.fill(C.path);
    for (const x of [2, 6, 10, 14]) {
      g.rect(x - 1, 1, 3, 14, C.iron);
      g.px(x, 0, C.gold); g.px(x, 1, C.gold);
    }
    g.rect(0, 7, 16, 2, C.iron);
    g.px(8, 7, C.gold); g.px(8, 8, C.gold);
  },
  [T.COLLISION]: (g) => {
    g.fill(C.magenta);
  },
};

/** Build the full tileset PNG. Returns { png: Buffer, ...dims }. */
export function buildTileset() {
  const W = COLS * TW;
  const H = ROWS * TH;
  const buf = canvas(W, H, [0, 0, 0, 0]);
  for (const [key, id] of Object.entries(T)) {
    const painter = painters[id];
    if (!painter) continue; // spare slots stay transparent
    painter(tileCtx(buf, id), rng(id * 7919 + 13));
  }
  return { png: writePNG(W, H, buf), columns: COLS, tilecount: COLS * ROWS };
}

/** Tiled external-tileset (.tsj) document for the generated PNG. */
export function tilesetTsj(imageFile) {
  return {
    columns: COLS,
    image: imageFile,
    imageheight: ROWS * TH,
    imagewidth: COLS * TW,
    margin: 0,
    name: "wedding-garden",
    spacing: 0,
    tilecount: COLS * ROWS,
    tiledversion: "1.10",
    tileheight: TH,
    tilewidth: TW,
    type: "tileset",
    version: "1.10",
  };
}
