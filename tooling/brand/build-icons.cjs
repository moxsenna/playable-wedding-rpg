const { join } = require("node:path");
const fs = require("node:fs");
const ROOT = "D:/Coding/playable_wedding inv/new pixel";
const OUT = join(ROOT, "apps/web/public/brand/icon");
const LOGO_OUT = join(ROOT, "apps/web/public/brand/logo/yutemu-mark.webp");
const TILE_SRC = "file:///D:/Coding/playable_wedding%20inv/new%20pixel/docs/favicon.webp";
const GLOW_SRC = "file:///D:/Coding/playable_wedding%20inv/new%20pixel/docs/logo-glow.webp";
const SIZES = [512, 192, 180, 48, 32, 16];
(async () => {
  const WEB = join(ROOT, "apps/web");
  const { chromium } = require(join(WEB, "node_modules", "playwright"));
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();

  await p.goto(TILE_SRC);
  await p.waitForTimeout(400);
  const tile = await p.evaluate(() => {
    const img = document.querySelector("img");
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const probe = document.createElement("canvas");
    probe.width = w;
    probe.height = h;
    const x = probe.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h).data;
    const lit = (px, py) => {
      const i = (py * w + px) * 4;
      return d[i] > 14 || d[i + 1] > 14 || d[i + 2] > 14;
    };
    const colHas = (px) => {
      for (let y = 0; y < h; y += 4) if (lit(px, y)) return true;
      return false;
    };
    const rowHas = (py) => {
      for (let x = 0; x < w; x += 4) if (lit(x, py)) return true;
      return false;
    };
    let l = 0;
    while (l < w && !colHas(l)) l++;
    let r = w - 1;
    while (r > l && !colHas(r)) r--;
    let t = 0;
    while (t < h && !rowHas(t)) t++;
    let bo = h - 1;
    while (bo > t && !rowHas(bo)) bo--;
    const fi = ((t + 10) * w + Math.floor((l + r) / 2)) * 4;
    return { w, h, l, r, t, bo, fill: [d[fi], d[fi + 1], d[fi + 2]] };
  });
  const tw = tile.r - tile.l + 1;
  const th = tile.bo - tile.t + 1;
  const side = Math.max(tw, th);
  const tileUrl = await p.evaluate(
    ({ t, l, tw, th, side, fill }) => {
      const img = document.querySelector("img");
      const c = document.createElement("canvas");
      c.width = side;
      c.height = side;
      const x = c.getContext("2d");
      x.fillStyle = `rgb(${fill[0]},${fill[1]},${fill[2]})`;
      x.fillRect(0, 0, side, side);
      x.drawImage(img, l, t, tw, th, Math.floor((side - tw) / 2), Math.floor((side - th) / 2), tw, th);
      return c.toDataURL("image/png");
    },
    { ...tile, tw, th, side }
  );

  await p.goto(GLOW_SRC);
  await p.waitForTimeout(400);
  const markUrl = await p.evaluate(() => {
    const img = document.querySelector("img");
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const probe = document.createElement("canvas");
    probe.width = w;
    probe.height = h;
    const x = probe.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h).data;
    const vis = (px, py) => d[(py * w + px) * 4 + 3] > 16;
    const colHas = (px) => {
      for (let y = 0; y < h; y += 6) if (vis(px, y)) return true;
      return false;
    };
    const rowHas = (py) => {
      for (let x = 0; x < w; x += 6) if (vis(x, py)) return true;
      return false;
    };
    let l = 0;
    while (l < w && !colHas(l)) l++;
    let r = w - 1;
    while (r > l && !colHas(r)) r--;
    let t = 0;
    while (t < h && !rowHas(t)) t++;
    let bo = h - 1;
    while (bo > t && !rowHas(bo)) bo--;
    const pad = Math.round(Math.max(r - l, bo - t) * 0.04);
    l = Math.max(0, l - pad);
    t = Math.max(0, t - pad);
    r = Math.min(w - 1, r + pad);
    bo = Math.min(h - 1, bo + pad);
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    c.getContext("2d").drawImage(img, l, t, r - l + 1, bo - t + 1, 0, 0, 512, 512);
    return c.toDataURL("image/webp", 0.86);
  });
  await b.close();

  fs.writeFileSync(LOGO_OUT, Buffer.from(markUrl.split(",")[1], "base64"));

  const tileImg = { url: tileUrl, side };
  const saved = [];
  const { chromium: chrom2 } = require(join(WEB, "node_modules", "playwright"));
  const b2 = await chrom2.launch();
  const q = await (await b2.newContext()).newPage();
  await q.setContent("<body></body>");
  for (const s of SIZES) {
    const url = await q.evaluate(
      ({ tileUrl, side, size }) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = size;
            c.height = size;
            c.getContext("2d").drawImage(img, 0, 0, size, size);
            resolve(c.toDataURL("image/png"));
          };
          img.src = tileUrl;
        }),
      { tileUrl: tileImg.url, side: tileImg.side, size: s }
    );
    const buf = Buffer.from(url.split(",")[1], "base64");
    fs.writeFileSync(join(OUT, `icon-${s}.png`), buf);
    if (buf.slice(1, 4).toString() !== "PNG") throw new Error(`not a png: icon-${s}.png`);
    saved.push({ size: s, buf });
  }
  await b2.close();
  const small = saved.filter((x) => [16, 32, 48].includes(x.size));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(small.length, 4);
  const dir = [];
  let offset = 6 + 16 * small.length;
  for (const x of small) {
    const e = Buffer.alloc(16);
    e.writeUInt8(x.size, 0);
    e.writeUInt8(x.size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(x.buf.length, 8);
    e.writeUInt32LE(offset, 12);
    dir.push(e);
    offset += x.buf.length;
  }
  fs.writeFileSync(join(OUT, "favicon.ico"), Buffer.concat([header, ...dir, ...small.map((x) => x.buf)]));
  const ico = fs.readFileSync(join(OUT, "favicon.ico"));
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1 || ico.readUInt16LE(4) !== small.length) {
    throw new Error("ico header malformed");
  }
  fs.copyFileSync(join(OUT, "icon-180.png"), join(OUT, "apple-touch-icon.png"));
  console.log("BRAND ICONS VERIFIED");
})().catch((e) => {
  console.error("FAIL " + (e && e.message));
  process.exit(1);
});
