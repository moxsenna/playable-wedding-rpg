// Live seed (idempotent): wedding projects + world template/version +
// per-project world configs + a starter guest per project. Uses pg directly
// (no ORM runtime dependency). DATABASE_URL via env only — never logged.
// The template version row pins the latest locally published R2 version
// (out/prod index); re-running after a new publish advances the pin.
// Prints SEED OK with row counts.
import pg from "pg";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const { Client } = pg;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fail = (msg) => { console.error(`seed FAILED: ${msg}`); process.exit(1); };
if (!process.env.DATABASE_URL) fail("DATABASE_URL missing");

const PROJECTS = [
  { id: "demo-ayu-bima", name: "Ayu & Bima", status: "live" },
  { id: "raka-naya", name: "Raka & Naya", status: "live" },
  { id: "arvin-selena", name: "Arvin & Selena", status: "live" },
];
const GUESTS = [
  { id: "guest-dinda", projectId: "demo-ayu-bima", name: "Dinda" },
  { id: "guest-maya", projectId: "demo-ayu-bima", name: "Maya" },
  { id: "guest-sinta", projectId: "raka-naya", name: "Sinta" },
  { id: "guest-putri", projectId: "arvin-selena", name: "Putri" },
];

const client = new Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();

  await client.query(
    `INSERT INTO wedding_projects (id, name, status) VALUES ($1, $2, 'live')
     ON CONFLICT (id) DO NOTHING`,
    ["__seed_probe__", "__probe__"]
  );
  await client.query(`DELETE FROM wedding_projects WHERE id = '__seed_probe__'`);

  for (const p of PROJECTS) {
    await client.query(
      `INSERT INTO wedding_projects (id, name, status) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status`,
      [p.id, p.name, p.status]
    );
  }

  const manifestRaw = readFileSync(
    join(ROOT, "apps/web/public/assets/worlds/garden-village-v1/manifest.json"),
    "utf8"
  );
  const contentHash = createHash("sha256").update(manifestRaw).digest("hex");
  // Pin the newest locally published R2 version (falls back to v1 when no
  // local publish index exists yet).
  let publishedVersion = 1;
  let publishedHash = contentHash;
  const prodIndex = join(ROOT, "out/prod/garden-village-v1/index.json");
  if (existsSync(prodIndex)) {
    try {
      const idx = JSON.parse(readFileSync(prodIndex, "utf8"));
      const latest = (idx.versions ?? []).reduce(
        (best, v) => (v.version > (best?.version ?? 0) ? v : best),
        null
      );
      if (latest) {
        publishedVersion = latest.version;
        const localManifest = join(ROOT, `out/prod/garden-village-v1/v${latest.version}/manifest.json`);
        if (existsSync(localManifest)) {
          publishedHash = JSON.parse(readFileSync(localManifest, "utf8")).contentHash ?? contentHash;
        }
      }
    } catch {
      /* keep v1 fallback */
    }
  }
  const manifestRef = `garden-village-v1/v${publishedVersion}/manifest.json`;
  await client.query(
    `INSERT INTO world_templates (id, key, name, status) VALUES ('garden-village-v1', 'garden-village-v1', 'Garden Village', 'live')
     ON CONFLICT (id) DO NOTHING`
  );
  const ver = await client.query(
    `INSERT INTO world_template_versions (id, template_id, version, manifest_ref, content_hash, compatibility_version, published_at)
     VALUES ('garden-village-v1', 'garden-village-v1', $3, $1, $2, 1, NOW())
     ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, manifest_ref = EXCLUDED.manifest_ref, content_hash = EXCLUDED.content_hash RETURNING id`,
    [manifestRef, publishedHash, publishedVersion]
  );
  void ver;

  for (const p of PROJECTS) {
    await client.query(
      `INSERT INTO wedding_world_configs (id, project_id, template_version_id)
       VALUES ($1, $2, 'garden-village-v1')
       ON CONFLICT (id) DO NOTHING`,
      [`worldcfg-${p.id}`, p.id]
    );
  }

  let n = 0;
  for (const g of GUESTS) {
    const token = `gt_live_${g.id.replace(/[^a-z0-9]/g, "")}`;
    const r = await client.query(
      `INSERT INTO guests (id, project_id, name, token, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [g.id, g.projectId, g.name, token, Date.now()]
    );
    if (r.rowCount > 0) n += 1;
  }

  const counts = await client.query(`SELECT
    (SELECT COUNT(*) FROM wedding_projects) AS projects,
    (SELECT COUNT(*) FROM guests) AS guests,
    (SELECT COUNT(*) FROM wedding_world_configs) AS configs,
    (SELECT COUNT(*) FROM world_template_versions) AS versions`);
  console.log(`SEED OK projects=${counts.rows[0].projects} guests=${counts.rows[0].guests} configs=${counts.rows[0].configs} versions=${counts.rows[0].versions} new_guests=${n}`);
} finally {
  await client.end().catch(() => undefined);
}
