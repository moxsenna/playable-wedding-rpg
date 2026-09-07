// World publish validator: garden-village-v1 (WORLD_DESIGN.md section 18).
// Usage: node scripts/validate-world.mjs <sourceDir> [--self-test]
// Prints WORLD VALID only when every blocking check passes; exits nonzero
// otherwise. --self-test mutates a temp copy (drops a required layer) and
// proves the validator fails it (SELF TEST PASSED).
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

const REQUIRED_LAYERS = [
  "00_Ground", "01_Ground_Detail", "02_Paths", "03_Water", "04_Building_Base",
  "05_Decoration_Below", "06_Collision", "07_Interaction_Zones", "08_NPC_Slots",
  "09_Spawn_Points", "10_Landmark_Zones", "11_Decoration_Above", "12_Roof_Above",
  "13_Ambient_FX", "14_Debug_Metadata",
];
const REQUIRED_SLOTS = [
  "npc.greeter", "npc.rsvp_keeper", "npc.story_keeper", "npc.photographer",
  "npc.travel_friend", "npc.event_coordinator", "npc.venue_guide",
  "npc.proposal_friend", "npc.couple_a", "npc.couple_b",
];
const REQUIRED_SPAWNS = ["spawn.default", "spawn.returning", "spawn.wedding_hall", "spawn.preview"];
const REQUIRED_LANDMARKS = [
  "landmark.entrance", "landmark.rsvp", "landmark.photo", "landmark.main_plaza",
  "landmark.memory_garden", "landmark.event_pavilion", "landmark.couple_garden",
  "landmark.wedding_hall",
];
const MAX_W = 64;
const MAX_H = 96;

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function validateDir(dir) {
  const errors = [];
  const fail = (m) => errors.push(m);
  let map;
  try {
    map = loadJson(join(dir, "map.tmj"));
  } catch (e) {
    return { ok: false, errors: [`unreadable map.tmj: ${e.message}`] };
  }

  // dimensions under budget
  if (map.width > MAX_W || map.height > MAX_H || map.width <= 0 || map.height <= 0)
    fail(`dimensions ${map.width}x${map.height} exceed budget ${MAX_W}x${MAX_H}`);
  if (map.tilewidth !== 16 || map.tileheight !== 16)
    fail(`tile size must be 16x16, got ${map.tilewidth}x${map.tileheight}`);
  if (map.orientation !== "orthogonal") fail(`orientation must be orthogonal, got ${map.orientation}`);

  // required layers, exact names, no duplicates
  const names = (map.layers || []).map((l) => l.name);
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) fail(`duplicate layer id: ${n}`);
    seen.add(n);
  }
  for (const req of REQUIRED_LAYERS)
    if (!seen.has(req)) fail(`missing required layer: ${req}`);

  const byName = Object.fromEntries((map.layers || []).map((l) => [l.name, l]));
  const objs = (n) => (byName[n] && byName[n].objects) || [];
  const objNames = (n) => objs(n).map((o) => o.name);

  // NPC slots / spawns / landmarks present, no duplicate ids
  for (const [label, req, layer] of [
    ["npc slot", REQUIRED_SLOTS, "08_NPC_Slots"],
    ["spawn point", REQUIRED_SPAWNS, "09_Spawn_Points"],
    ["landmark", REQUIRED_LANDMARKS, "10_Landmark_Zones"],
  ]) {
    const got = objNames(layer);
    const gset = new Set();
    for (const n of got) {
      if (gset.has(n)) fail(`duplicate ${label} id: ${n}`);
      gset.add(n);
    }
    for (const r of req) if (!gset.has(r)) fail(`missing ${label}: ${r}`);
  }

  // gate zone exists
  const zones = objs("07_Interaction_Zones");
  if (!zones.some((z) => z.name === "gate.finale")) fail("missing interaction zone: gate.finale");

  // referenced tileset + image exist
  for (const ts of map.tilesets || []) {
    if (!ts.source) { fail("embedded tilesets not allowed in source .tmj (use external .tsj)"); continue; }
    const tsPath = resolve(dir, ts.source);
    if (!existsSync(tsPath)) { fail(`missing tileset: ${ts.source}`); continue; }
    let tsj;
    try { tsj = loadJson(tsPath); } catch { fail(`unparseable tileset: ${ts.source}`); continue; }
    const imgPath = resolve(dirname(tsPath), tsj.image || "");
    if (!tsj.image || !existsSync(imgPath)) fail(`missing tileset image: ${tsj.image || "(none)"}`);
  }

  // source manifest pins the template
  const manPath = join(dir, "manifest.json");
  if (!existsSync(manPath)) fail("missing manifest.json");
  else {
    try {
      const man = loadJson(manPath);
      if (man.templateKey !== "garden-village-v1") fail(`manifest templateKey must be garden-village-v1`);
      if (!(man.version >= 1)) fail(`manifest version must be >= 1`);
    } catch { fail("unparseable manifest.json"); }
  }

  // collision grid from 06_Collision
  const coll = byName["06_Collision"];
  const W = map.width, H = map.height;
  const solid = new Set();
  if (!coll || coll.type !== "tilelayer") fail("06_Collision must be a tilelayer");
  else {
    const data = coll.data || [];
    if (data.length !== W * H) fail(`collision layer size ${data.length} != ${W * H}`);
    else for (let i = 0; i < data.length; i++) if (data[i] !== 0) solid.add(i);
  }
  const tileOf = (x, y) => y * W + x;
  const blocked = (x, y) => x < 0 || y < 0 || x >= W || y >= H || solid.has(tileOf(x, y));
  const objTile = (o) => [Math.floor(o.x / 16), Math.floor(o.y / 16)];

  // spawn.default must not sit inside collision
  const spawns = Object.fromEntries(objs("09_Spawn_Points").map((o) => [o.name, objTile(o)]));
  if (spawns["spawn.default"]) {
    const [sx, sy] = spawns["spawn.default"];
    if (blocked(sx, sy)) fail(`spawn.default tile (${sx},${sy}) is inside collision`);
  }

  // reachability: BFS from spawn.default over walkable tiles
  if (errors.length === 0 && spawns["spawn.default"]) {
    const [sx, sy] = spawns["spawn.default"];
    const seenT = new Set([tileOf(sx, sy)]);
    const q = [[sx, sy]];
    while (q.length) {
      const [cx, cy] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (blocked(nx, ny) || seenT.has(tileOf(nx, ny))) continue;
        seenT.add(tileOf(nx, ny));
        q.push([nx, ny]);
      }
    }
    const reachTile = (tx, ty) => !blocked(tx, ty) && seenT.has(tileOf(tx, ty));
    const reachRect = (o) => {
      const x0 = Math.floor(o.x / 16), y0 = Math.floor(o.y / 16);
      const w = Math.max(1, Math.round((o.width || 16) / 16));
      const h = Math.max(1, Math.round((o.height || 16) / 16));
      for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++) if (reachTile(x, y)) return true;
      return false;
    };
    for (const o of objs("10_Landmark_Zones"))
      if (!reachRect(o)) fail(`landmark unreachable from spawn: ${o.name}`);
    for (const o of [...objs("08_NPC_Slots"), ...objs("09_Spawn_Points")]) {
      const [tx, ty] = objTile(o);
      if (!reachTile(tx, ty)) fail(`object tile unreachable: ${o.name} (${tx},${ty})`);
    }
    for (const o of zones) if (!reachRect(o)) fail(`interaction zone unreachable: ${o.name}`);
  }

  return { ok: errors.length === 0, errors };
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  // Negative control: a map missing a required layer MUST fail validation.
  const src = args.find((a) => !a.startsWith("--")) || "assets-source/tiled/garden-village-v1";
  const tmp = mkdtempSync(join(tmpdir(), "worldval-"));
  try {
    const map = loadJson(join(src, "map.tmj"));
    map.layers = map.layers.filter((l) => l.name !== "05_Decoration_Below");
    writeFileSync(join(tmp, "map.tmj"), JSON.stringify(map));
    writeFileSync(join(tmp, "manifest.json"), readFileSync(join(src, "manifest.json"), "utf8"));
    const r = validateDir(tmp);
    if (r.ok || !r.errors.some((e) => e.includes("05_Decoration_Below"))) {
      console.error(`SELF TEST FAILED: mutated map not rejected (${r.errors.join("; ")})`);
      process.exit(1);
    }
    console.log("SELF TEST PASSED");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  process.exit(0);
}

const dir = args.find((a) => !a.startsWith("--"));
if (!dir) {
  console.error("Usage: node scripts/validate-world.mjs <sourceDir> [--self-test]");
  process.exit(2);
}
const { ok, errors } = validateDir(dir);
if (!ok) {
  console.error(`WORLD INVALID (${errors.length}):`);
  for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("WORLD VALID");
