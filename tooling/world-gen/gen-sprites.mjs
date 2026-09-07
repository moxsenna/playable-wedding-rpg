// Procedural guest sprite-sheet painter.
// Layout: 6 cols x 4 rows of 16x16 cells (96x64 PNG).
//   rows: down, up, left, right (right = mirrored left)
//   cols: idle0, idle1(blink), walk0..walk3
// Exported draw functions take a palette so M3 can mint distinct NPC avatars
// with zero game-source changes.
import { canvas, setPx, fillRect, hex, rng, writePNG } from "./png-writer.mjs";

export const CELL = 16;
export const SHEET_COLS = 6;
export const SHEET_ROWS = 4;

export const GUEST_PALETTE = {
  skin: hex("#f2c89b"),
  skinD: hex("#d9a06f"),
  hair: hex("#5a3a22"),
  hairD: hex("#422a18"),
  hairL: hex("#7a5230"),
  shirt: hex("#2fa3a0"),
  shirtD: hex("#237a78"),
  pants: hex("#3a4a6b"),
  shoes: hex("#33363f"),
  eye: hex("#26262e"),
};

/** Frame index for (row, col) in sheet order. */
export const frameIndex = (row, col) => row * SHEET_COLS + col;

export const SHEET_ANIMS = {
  "idle-down": { row: 0, frames: [0, 1], frameRate: 3 },
  "idle-up": { row: 1, frames: [0, 1], frameRate: 3 },
  "idle-left": { row: 2, frames: [0, 1], frameRate: 3 },
  "idle-right": { row: 3, frames: [0, 1], frameRate: 3 },
  "walk-down": { row: 0, frames: [2, 3, 4, 5], frameRate: 8 },
  "walk-up": { row: 1, frames: [2, 3, 4, 5], frameRate: 8 },
  "walk-left": { row: 2, frames: [2, 3, 4, 5], frameRate: 8 },
  "walk-right": { row: 3, frames: [2, 3, 4, 5], frameRate: 8 },
};

function drawBody(px, frame, P) {
  // frame: 0 idle, 1 idle-blink, 2..5 walk
  const bob = frame === 3 || frame === 5 ? -1 : 0;
  const put = (x, y, c) => {
    const yy = y + bob;
    if (yy >= 0 && yy < 16) px(x, yy, c);
  };
  const rect = (x, y, w, h, c) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c);
  };
  // torso + arms
  rect(4, 10, 8, 3, P.shirt);
  rect(4, 12, 8, 1, P.shirtD);
  rect(3, 10, 1, 1, P.shirt); rect(12, 10, 1, 1, P.shirt);
  put(3, 11, P.skin); put(12, 11, P.skin);
  // legs: walk alternates the raised foot
  const leftUp = frame === 4;
  const rightUp = frame === 2;
  rect(5, 13, 2, 2, P.pants); rect(9, 13, 2, 2, P.pants);
  rect(5, leftUp ? 14 : 15, 2, 1, P.shoes);
  rect(9, rightUp ? 14 : 15, 2, 1, P.shoes);
  return { put, rect };
}

function headDown(put, rect, frame, P) {
  const blink = frame === 1;
  const eye = blink ? P.skin : P.eye;
  rect(4, 2, 8, 3, P.hair); // hair cap
  rect(5, 2, 3, 1, P.hairL); // highlight
  rect(5, 5, 6, 5, P.skin); // face
  rect(4, 5, 1, 4, P.hair); rect(11, 5, 1, 4, P.hair); // side locks
  rect(5, 5, 6, 1, P.hair); // bangs
  put(6, 7, eye); put(9, 7, eye);
}

function headUp(put, rect, _frame, P) {
  rect(4, 2, 8, 8, P.hair); // back of head
  rect(5, 3, 2, 5, P.hairL);
  rect(10, 4, 1, 5, P.hairD);
  rect(4, 9, 8, 1, P.hairD);
}

function headLeft(put, rect, frame, P) {
  const blink = frame === 1;
  rect(4, 2, 8, 2, P.hair); // top cap
  rect(8, 4, 4, 6, P.hair); // back mass (right side)
  rect(9, 5, 2, 4, P.hairL);
  rect(4, 4, 4, 2, P.hair); // fringe
  rect(4, 6, 4, 4, P.skin); // face (left side)
  put(5, 7, blink ? P.skin : P.eye);
  put(4, 8, P.skinD); // nose shade
}

function drawCell(sheet, sheetW, cx, cy, dir, frame, P) {
  const ox = cx * CELL;
  const oy = cy * CELL;
  if (dir === "right") {
    // render left-facing into a temp cell, then mirror-blit
    const tmp = canvas(CELL, CELL, [0, 0, 0, 0]);
    const tpx = (x, y, c) => setPx(tmp, CELL, x, y, c);
    const { put, rect } = drawBody(tpx, frame, P);
    headLeft(put, rect, frame, P);
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        const i = (y * CELL + x) * 4;
        if (tmp[i + 3] === 0) continue;
        setPx(sheet, sheetW, ox + (CELL - 1 - x), oy + y,
          [tmp[i], tmp[i + 1], tmp[i + 2], tmp[i + 3]]);
      }
    return;
  }
  const px = (x, y, c) => setPx(sheet, sheetW, ox + x, oy + y, c);
  const { put, rect } = drawBody(px, frame, P);
  if (dir === "down") headDown(put, rect, frame, P);
  else if (dir === "up") headUp(put, rect, frame, P);
  else headLeft(put, rect, frame, P);
}

/** Build the full guest sheet PNG for a palette. */
export function buildGuestSheet(palette = GUEST_PALETTE) {
  const W = SHEET_COLS * CELL;
  const H = SHEET_ROWS * CELL;
  const buf = canvas(W, H, [0, 0, 0, 0]);
  const dirs = ["down", "up", "left", "right"];
  for (let row = 0; row < SHEET_ROWS; row++)
    for (let col = 0; col < SHEET_COLS; col++)
      drawCell(buf, W, col, row, dirs[row], col, palette);
  return { png: writePNG(W, H, buf), cols: SHEET_COLS, rows: SHEET_ROWS };
}

/** Frame-metadata sidecar consumed by the Phaser loader (no parsing needed). */
export function guestSheetJson() {
  const anims = {};
  for (const [name, a] of Object.entries(SHEET_ANIMS)) {
    anims[name] = {
      frames: a.frames.map((c) => frameIndex(a.row, c)),
      frameRate: a.frameRate,
    };
  }
  return {
    frameWidth: CELL, frameHeight: CELL,
    cols: SHEET_COLS, rows: SHEET_ROWS,
    anims,
  };
}

/** Per-NPC avatar palettes. Same 6x4 sheet layout, distinct wedding-party looks. */
export const AVATAR_PALETTES = {
  greeter: { ...GUEST_PALETTE, shirt: hex("#d96a5f"), shirtD: hex("#a84a42"), hair: hex("#2e2e33"), hairD: hex("#1e1e22"), hairL: hex("#4a4a52") },
  rsvp: { ...GUEST_PALETTE, shirt: hex("#c8a24a"), shirtD: hex("#96702e"), pants: hex("#4a3a5a") },
  story: { ...GUEST_PALETTE, shirt: hex("#7a5fa0"), shirtD: hex("#5a4480"), hair: hex("#b8b0a8"), hairD: hex("#8a827a"), hairL: hex("#d8d2c8") },
  photo: { ...GUEST_PALETTE, shirt: hex("#4a6b8a"), shirtD: hex("#33506a"), hair: hex("#2e2e33"), hairD: hex("#1e1e22"), hairL: hex("#4a4a52") },
  travel: { ...GUEST_PALETTE, shirt: hex("#4a8a4f"), shirtD: hex("#356b3a") },
  event: { ...GUEST_PALETTE, shirt: hex("#b04a8a"), shirtD: hex("#863a6a") },
  venue: { ...GUEST_PALETTE, shirt: hex("#3a5a9a"), shirtD: hex("#2c4478") },
  proposal: { ...GUEST_PALETTE, shirt: hex("#d47a9a"), shirtD: hex("#a85a78") },
  partner_a: { ...GUEST_PALETTE, shirt: hex("#e8e0d0"), shirtD: hex("#b8ad98"), hair: hex("#1e1e22"), hairD: hex("#101014"), hairL: hex("#3a3a44") },
  partner_b: { ...GUEST_PALETTE, shirt: hex("#f0e8f0"), shirtD: hex("#c0b4c4"), hair: hex("#6a4a2a"), hairD: hex("#4a3018"), hairL: hex("#8a6238") },
};

/** Build one sheet per avatar id. Returns [{ id, png, cols, rows }]. */
export function buildAvatarSheets() {
  return Object.entries(AVATAR_PALETTES).map(([id, palette]) => ({ id, ...buildGuestSheet(palette) }));
}

export const GALLERY_W = 320;
export const GALLERY_H = 200;

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ];
}

/** Simple scenic placeholders (garden hues, sun, flower dots). Real wedding
photos arrive as versioned media with the durable backend (M8/R2). */
export function buildGalleryImages() {
  const variants = [
    { id: "demo-1", skyTop: "#9fd8ef", skyBot: "#e8f6e8", ground: "#79c25f", sun: "#fff6d8" },
    { id: "demo-2", skyTop: "#f2b8a0", skyBot: "#f6e3c8", ground: "#67ad4e", sun: "#ffdf8a" },
    { id: "demo-3", skyTop: "#7a86c8", skyBot: "#c8b8e0", ground: "#4a7a44", sun: "#f2f0ff" },
  ];
  return variants.map((v) => {
    const buf = canvas(GALLERY_W, GALLERY_H);
    const top = hex(v.skyTop);
    const bot = hex(v.skyBot);
    for (let y = 0; y < 120; y++) {
      fillRect(buf, GALLERY_W, 0, y, GALLERY_W, 1, lerpColor(top, bot, y / 120));
    }
    const r = rng(v.id.length * 101 + 7);
    const sunC = hex(v.sun);
    for (let y = -14; y <= 14; y++)
      for (let x = -14; x <= 14; x++)
        if (x * x + y * y <= 150) setPx(buf, GALLERY_W, 250 + x, 42 + y, sunC);
    const g = hex(v.ground);
    fillRect(buf, GALLERY_W, 0, 120, GALLERY_W, 80, g);
    for (let i = 0; i < 260; i++) {
      setPx(buf, GALLERY_W, Math.floor(r() * GALLERY_W), 120 + Math.floor(r() * 80),
        r() < 0.7 ? hex("#5da244") : hex("#8fd47a"));
    }
    for (let i = 0; i < 26; i++) {
      setPx(buf, GALLERY_W, Math.floor(r() * GALLERY_W), 125 + Math.floor(r() * 70),
        r() < 0.5 ? hex("#ffffff") : hex("#f7b8c8"));
    }
    for (const bx of [40, 280]) {
      fillRect(buf, GALLERY_W, bx - 22, 96, 44, 34, hex("#2c7a38"));
      fillRect(buf, GALLERY_W, bx - 16, 88, 32, 26, hex("#3f9e4d"));
    }
    return { id: v.id, png: writePNG(GALLERY_W, GALLERY_H, buf) };
  });
}
