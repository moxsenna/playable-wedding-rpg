// Avatar pipeline oracle: pack manifests, registry schema, file integrity,
// demo references, and placeholder-overwrite tripwire. Prints AVATARS VALID
// only when every check passes. Includes a negative self-test.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`Avatar validation FAILED: ${msg}`); process.exit(1); };

const SPRITES_DIR = join(ROOT, "assets-source", "sprites");
const PUB_AVATARS = join(ROOT, "apps/web/public/assets/avatars");
const SRC_REGISTRY = join(SPRITES_DIR, "avatar-registry.json");
const PUB_REGISTRY = join(PUB_AVATARS, "avatar-registry.json");

function readPngSize(p) {
  const b = readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`not a PNG: ${p}`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

const { scanPacks } = await import("../tooling/assets/build-avatar-registry.mjs");
const contracts = await import("../packages/contracts/src/avatar.ts");
const { avatarRegistrySchema } = contracts;
if (!avatarRegistrySchema) fail("avatarRegistrySchema not exported from contracts");

const errors = [];

// 1. pack scan must be clean
const scanned = scanPacks();
for (const e of scanned.errors) errors.push(`scan: ${e}`);

// 2. registries exist and validate under the Zod contract
for (const [label, path] of [["source", SRC_REGISTRY], ["runtime", PUB_REGISTRY]]) {
  if (!existsSync(path)) {
    errors.push(`missing ${label} registry (run node tooling/world-gen/build-world.mjs first)`);
    continue;
  }
  let reg;
  try {
    reg = loadJson(path);
  } catch {
    errors.push(`unparseable ${label} registry`);
    continue;
  }
  const parsed = avatarRegistrySchema.safeParse(reg);
  if (!parsed.success) {
    errors.push(`${label} registry schema: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
}
if (errors.length > 0) {
  console.error(`AVATARS INVALID (${errors.length}):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
const reg = loadJson(SRC_REGISTRY);

// 3. registry covers every scanned avatar plus the legacy fallback
if (Object.keys(reg.avatars).length !== scanned.entries.length + 1) {
  fail(`registry has ${Object.keys(reg.avatars).length} avatars, scanned ${scanned.entries.length} pack avatars + legacy`);
}

// 4. every source file exists with declared dimensions; every runtime copy
//    is a real 384x256 production sheet (procedural placeholders are 96x64:
//    any other size here proves a silent overwrite).
for (const [id, a] of Object.entries(reg.avatars)) {
  const src = join(SPRITES_DIR, a.sprite.file);
  if (!existsSync(src)) fail(`missing source sprite for ${id}: ${a.sprite.file}`);
  const sSize = readPngSize(src);
  if (sSize.width !== a.sprite.sheetWidth || sSize.height !== a.sprite.sheetHeight) {
    fail(`${id}: source PNG is ${sSize.width}x${sSize.height}, registry declares ${a.sprite.sheetWidth}x${a.sprite.sheetHeight}`);
  }
  const pub = join(PUB_AVATARS, `${id}.png`);
  if (!existsSync(pub)) fail(`missing runtime sprite for ${id}`);
  const pSize = readPngSize(pub);
  const expectRuntime = a.legacy ? { width: 96, height: 64 } : { width: 384, height: 256 };
  if (pSize.width !== expectRuntime.width || pSize.height !== expectRuntime.height) {
    fail(`${id}: runtime PNG is ${pSize.width}x${pSize.height}, expected ${expectRuntime.width}x${expectRuntime.height} (placeholder overwrite?)`);
  }
}

// 5. every avatar referenced by the demo bindings exists in the registry
const fixture = readFileSync(join(ROOT, "apps/web/src/weddings/demo-bindings.ts"), "utf8");
const referenced = [...new Set([...fixture.matchAll(/avatarId:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]))];
if (referenced.length === 0) fail("no avatarIds found in demo bindings");
for (const id of referenced) {
  if (!reg.avatars[id]) fail(`demo bindings reference unknown avatar: ${id}`);
}

// 6. negative self-test: a registry missing a required animation must fail
const mutated = JSON.parse(JSON.stringify(reg));
const firstId = Object.keys(mutated.avatars)[0];
delete mutated.avatars[firstId].animations["idle-up"];
if (avatarRegistrySchema.safeParse(mutated).success) {
  fail("self-test: registry missing idle-up validated (oracle cannot fail)");
}

console.log(
  `AVATARS VALID packs=${new Set(scanned.entries.map((e) => e.pack)).size} ` +
  `avatars=${Object.keys(reg.avatars).length} guests=${reg.guestPool.length} demoRefs=${referenced.length}`
);
