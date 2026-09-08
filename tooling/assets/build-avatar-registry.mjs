// Canonical avatar registry builder: scans approved pack manifests and
// normalizes them into one validated registry. Source packs are read-only;
// outputs go to generated locations only (never inside pack dirs).
// Dual-mode: imported by build-world.mjs, or CLI:
//   node tooling/assets/build-avatar-registry.mjs [--source-out F] [--runtime-out D]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SPRITES_DIR = join(ROOT, "assets-source", "sprites");

const PACK_DIRS = [
  "playable_wedding_avatar_pack_v1",
  "playable_wedding_avatar_pack_v2",
  "playable_wedding_hijab_pack_v1",
  "playable_wedding_muslim_npc_pack_v1",
];

/** World display scale for 64px frames on the 16px tilemap (zoom 2).
 *  64 * 0.4 = 25.6 world px: detailed but proportional. Calibrated M4.5;
 *  metadata recommendedDisplayScale targets a different showcase layout. */
export const CALIBRATED_DISPLAY_SCALE = 0.4;

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

export function readPngSize(p) {
  const b = readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`not a PNG: ${p}`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

/**
 * Read-only pack walk. Returns entries + hard errors (parse failures, id
 * mismatches, missing files, dimension mismatches). Never writes.
 */
export function scanPacks() {
  const entries = [];
  const errors = [];
  const allIds = new Set();
  const roleRefs = [];
  for (const pack of PACK_DIRS) {
    const dir = join(SPRITES_DIR, pack);
    const manifestPath = join(dir, "avatars-manifest.json");
    let manifest;
    try {
      manifest = readJson(manifestPath);
    } catch (e) {
      errors.push(`${pack}: unreadable avatars-manifest.json (${e.message})`);
      continue;
    }
    if (manifest.schemaVersion !== 1) errors.push(`${pack}: unsupported schemaVersion ${manifest.schemaVersion}`);
    for (const roleFile of ["npc-role-manifest.json", "role-manifest.json"]) {
      const rp = join(dir, roleFile);
      if (existsSync(rp)) {
        try {
          const rm = readJson(rp);
          const recs = rm.recommendedBindings ?? {};
          for (const ids of Object.values(recs)) {
            for (const id of Array.isArray(ids) ? ids : []) roleRefs.push({ pack, file: roleFile, id });
          }
        } catch (e) {
          errors.push(`${pack}/${roleFile}: unparseable (${e.message})`);
        }
      }
    }
    for (const item of manifest.avatars ?? []) {
      allIds.add(item.id);
      const metaPath = join(dir, item.metadata);
      let meta;
      try {
        meta = readJson(metaPath);
      } catch (e) {
        errors.push(`${pack}/${item.id}: unreadable metadata ${item.metadata} (${e.message})`);
        continue;
      }
      if (meta.id !== item.id) {
        errors.push(`${pack}/${item.id}: metadata id mismatch (${meta.id})`);
        continue;
      }
      const spritePath = join(dir, item.sprite);
      if (!existsSync(spritePath)) {
        errors.push(`${pack}/${item.id}: missing runtime sprite ${item.sprite}`);
        continue;
      }
      let size;
      try {
        size = readPngSize(spritePath);
      } catch (e) {
        errors.push(`${pack}/${item.id}: ${e.message}`);
        continue;
      }
      const sp = meta.sprite ?? {};
      if (size.width !== sp.sheetWidth || size.height !== sp.sheetHeight) {
        errors.push(`${pack}/${item.id}: PNG is ${size.width}x${size.height}, metadata declares ${sp.sheetWidth}x${sp.sheetHeight}`);
        continue;
      }
      if (sp.sheetWidth !== sp.frameWidth * sp.cols || sp.sheetHeight !== sp.frameHeight * sp.rows) {
        errors.push(`${pack}/${item.id}: frame geometry does not tile the sheet`);
        continue;
      }
      const roleHints = [...new Set([...(item.roleHints ?? []), ...(meta.roleHints ?? [])])];
      entries.push({ pack, manifestEntry: item, meta, spritePath, size, roleHints });
    }
  }
  for (const ref of roleRefs) {
    if (!allIds.has(ref.id)) errors.push(`${ref.pack}/${ref.file}: references unknown avatar ${ref.id}`);
  }
  return { entries, errors };
}

function toRegistryEntry(e) {
  const m = e.meta;
  return {
    id: m.id,
    displayName: m.displayName,
    category: m.category,
    roleHints: e.roleHints,
    ...(m.genderPresentation ? { genderPresentation: m.genderPresentation } : {}),
    tags: m.tags ?? [],
    pack: e.pack,
    sprite: {
      file: `${e.pack}/runtime/${basename(e.spritePath)}`,
      frameWidth: m.sprite.frameWidth,
      frameHeight: m.sprite.frameHeight,
      cols: m.sprite.cols,
      rows: m.sprite.rows,
      sheetWidth: m.sprite.sheetWidth,
      sheetHeight: m.sprite.sheetHeight,
    },
    origin: { x: m.origin.x, y: m.origin.y },
    physics: {
      bodyWidth: m.physics.bodyWidth,
      bodyHeight: m.physics.bodyHeight,
      offsetX: m.physics.offsetX,
      offsetY: m.physics.offsetY,
    },
    render: { pixelArt: m.render.pixelArt !== false, smoothing: m.render.smoothing === true },
    displayScale: CALIBRATED_DISPLAY_SCALE,
    animations: Object.fromEntries(
      Object.entries(m.animations).map(([name, a]) => [name, { frames: a.frames, frameRate: a.frameRate, repeat: a.repeat }])
    ),
  };
}

async function legacyGuestEntry() {
  const { guestSheetJson } = await import("../world-gen/gen-sprites.mjs");
  const meta = guestSheetJson();
  const pngPath = join(SPRITES_DIR, "guest_01.png");
  if (!existsSync(pngPath)) {
    throw new Error("legacy guest_01.png missing: run guest sprite generation first");
  }
  const size = readPngSize(pngPath);
  const animations = Object.fromEntries(
    Object.entries(meta.anims).map(([name, a]) => [name, { frames: a.frames, frameRate: a.frameRate, repeat: -1 }])
  );
  return {
    entry: {
      id: "guest_01",
      displayName: "Guest 01 (legacy fallback)",
      category: "player",
      roleHints: [],
      tags: ["legacy", "fallback", "dev"],
      pack: "legacy-generated",
      sprite: {
        file: "guest_01.png",
        frameWidth: meta.frameWidth,
        frameHeight: meta.frameHeight,
        cols: meta.cols,
        rows: meta.rows,
        sheetWidth: size.width,
        sheetHeight: size.height,
      },
      origin: { x: 0.5, y: 0.5 },
      physics: { bodyWidth: 10, bodyHeight: 8, offsetX: 3, offsetY: 8 },
      render: { pixelArt: true, smoothing: false },
      displayScale: 1.0,
      animations,
      legacy: true,
    },
    pngPath,
  };
}

/**
 * Build + write the source registry, copy runtime PNGs, write the runtime
 * registry (filenames relative to its own dir). Throws loudly on any fault.
 */
export async function buildRegistry({
  sourceFile = join(SPRITES_DIR, "avatar-registry.json"),
  runtimeDir = join(ROOT, "apps/web/public/assets/avatars"),
} = {}) {
  const { entries, errors } = scanPacks();
  if (errors.length > 0) {
    throw new Error(`avatar pack scan failed:\n  - ${errors.join("\n  - ")}`);
  }
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.meta.id)) throw new Error(`duplicate avatar id across packs: ${e.meta.id}`);
    seen.add(e.meta.id);
  }
  const avatars = {};
  for (const e of entries) avatars[e.meta.id] = toRegistryEntry(e);
  const legacy = await legacyGuestEntry();
  avatars[legacy.entry.id] = legacy.entry;

  const guestPool = Object.values(avatars)
    .filter((a) => a.category === "guest")
    .map((a) => a.id)
    .sort();
  const registry = { schemaVersion: 1, avatars, guestPool };
  mkdirSync(dirname(sourceFile), { recursive: true });
  writeFileSync(sourceFile, JSON.stringify(registry, null, 2) + "\n");

  mkdirSync(runtimeDir, { recursive: true });
  const copied = [];
  for (const e of entries) {
    const dest = join(runtimeDir, basename(e.spritePath));
    copyFileSync(e.spritePath, dest);
    copied.push(dest);
  }
  copyFileSync(legacy.pngPath, join(runtimeDir, "guest_01.png"));
  copied.push(join(runtimeDir, "guest_01.png"));
  const runtime = {
    ...registry,
    avatars: Object.fromEntries(
      Object.values(avatars).map((a) => [a.id, { ...a, sprite: { ...a.sprite, file: basename(a.sprite.file) } }])
    ),
  };
  writeFileSync(join(runtimeDir, "avatar-registry.json"), JSON.stringify(runtime, null, 2) + "\n");
  return { registry, copied, sourceFile, runtimeDir };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const get = (flag, dflt) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
  };
  buildRegistry({
    sourceFile: get("--source-out", join(SPRITES_DIR, "avatar-registry.json")),
    runtimeDir: get("--runtime-out", join(ROOT, "apps/web/public/assets/avatars")),
  })
    .then((r) => console.log(`AVATAR REGISTRY BUILT avatars=${Object.keys(r.registry.avatars).length} copied=${r.copied.length}`))
    .catch((e) => {
      console.error(`AVATAR REGISTRY FAILED: ${e.message}`);
      process.exit(1);
    });
}
