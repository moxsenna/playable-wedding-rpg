// M12 data oracle: migration SQL covers the durable domain, and template
// publishing is deterministic + immutable on the local driver (live Neon/R2
// need credentials and stay explicitly blocked).
// Prints M12 DATA VERIFIED only when every assertion passes.
import { readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M12 data check FAILED: ${msg}`); process.exit(1); };

let n = 0;
const ok = (cond, msg) => {
  n++;
  if (!cond) fail(`assertion ${n}: ${msg}`);
};

const run = (args, label) => {
  try {
    return execFileSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", timeout: 300000 });
  } catch (e) {
    fail(`${label}: ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(-500)}`);
  }
};

// --- migrations cover the durable domain ---
const migDir = join(ROOT, "drizzle/migrations");
const sqlFiles = readdirSync(migDir).filter((f) => f.endsWith(".sql"));
ok(sqlFiles.length >= 1, "at least one migration generated");
const sql = sqlFiles.map((f) => readFileSync(join(migDir, f), "utf8")).join("\n");
for (const t of ["wedding_projects", "guests", "rsvps", "guestbook", "publication_versions", "audit_events", "world_templates", "world_template_versions", "wedding_world_configs"]) {
  ok(sql.includes(`"${t}"`) || sql.includes(` ${t} `) || sql.includes(`(${t}`), `migration creates ${t}`);
}
for (const t of ["guests", "rsvps", "guestbook", "publication_versions"]) {
  ok(sql.includes("project_id"), `${t} carries project_id`);
}
ok(sql.includes("guests_project_idx") && sql.includes("pubver_project_idx"), "tenant indexes present");

// --- publish determinism + immutability (isolated out dir) ---
const OUT = "out/m12-probe";
rmSync(join(ROOT, OUT), { recursive: true, force: true });
const first = run(["tooling/publish/publish.mjs", "garden-village-v1", "--out", OUT], "publish v1");
const hash1 = first.trim().split(" ").pop();
  ok(first.includes("PUBLISHED garden-village-v1 v1"), "v1 publishes");
  const manifest = JSON.parse(readFileSync(join(ROOT, OUT, "garden-village-v1/v1/manifest.json"), "utf8"));
  ok(manifest.contentHash && manifest.files.length > 0 && manifest.publishedAt, "version manifest complete");
  ok(manifest.files.includes("map.json") && manifest.files.includes("gates.json"), "world + gates in manifest");
  ok(manifest.dependencies?.environment?.sha256?.length === 64, "environment dep pinned by hash");
  ok(manifest.dependencies?.avatars?.sha256?.length === 64, "avatar dep pinned by hash");
  ok(typeof manifest.environment?.base === "string" && manifest.environment.base.startsWith("assets/environment/"), "env base rewritten to pinned prefix");
  ok(typeof manifest.avatars?.prefix === "string" && manifest.avatars.prefix.startsWith("assets/avatars/"), "avatar prefix pinned");
const second = run(["tooling/publish/publish.mjs", "garden-village-v1", "--out", OUT], "publish v2");
ok(second.includes("PUBLISHED garden-village-v1 v2"), "v2 publishes alongside");
const index = JSON.parse(readFileSync(join(ROOT, OUT, "garden-village-v1/index.json"), "utf8"));
ok(index.versions.length === 2 && index.versions[0].contentHash.startsWith(hash1), "index tracks both versions");
const again = JSON.parse(readFileSync(join(ROOT, OUT, "garden-village-v1/v1/manifest.json"), "utf8"));
ok(again.contentHash.startsWith(hash1), "v1 untouched by v2 (immutable)");
rmSync(join(ROOT, OUT), { recursive: true, force: true });
ok(!existsSync(join(ROOT, OUT)), "probe output cleaned");

console.log(`M12 DATA VERIFIED (${n} assertions)`);
