// M12.6 asset oracle: the publisher emits content-addressed dependency
// dirs and a version manifest that pins them; dev manifests still resolve
// the legacy shared paths. No credentials, no R2.
// Prints M126 ASSETS VERIFIED only when every assertion passes.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M12.6 assets check FAILED: ${msg}`); process.exit(1); };

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

const OUT = "out/m126-probe";
rmSync(join(ROOT, OUT), { recursive: true, force: true });
const dry = run(["tooling/publish/publish.mjs", "garden-village-v1", "--out", OUT, "--dry-run"], "dry-run");
const lines = dry.split("\n");
ok(/^DRY-RUN garden-village-v1 v1 files=\d+ deps=environment@[0-9a-f]{12}:\d+,avatars@[0-9a-f]{12}:\d+$/.test(lines[0]), "dry-run header pins both dep hashes");
const keys = lines.slice(1).filter((l) => l.startsWith("  "));
ok(keys.some((k) => k.includes("wedding-templates/garden-village-v1/v1/map.json")), "version files listed");
const envKeys = keys.filter((k) => k.includes("assets/environment/"));
const avatarKeys = keys.filter((k) => k.includes("assets/avatars/"));
ok(envKeys.length >= 9, `environment dep files listed (${envKeys.length})`);
ok(avatarKeys.length >= 20, `avatar dep files listed (${avatarKeys.length})`);
ok(envKeys.every((k) => /assets\/environment\/[0-9a-f]{12}\//.test(k)), "environment keys content-addressed");
ok(avatarKeys.every((k) => /assets\/avatars\/[0-9a-f]{12}\//.test(k)), "avatar keys content-addressed");
const first = run(["tooling/publish/publish.mjs", "garden-village-v1", "--out", OUT], "publish v1");
ok(first.includes("PUBLISHED garden-village-v1 v1"), "v1 publishes");
const manifest = JSON.parse(readFileSync(join(ROOT, OUT, "garden-village-v1/v1/manifest.json"), "utf8"));
ok(/^assets\/environment\/[0-9a-f]{12}\/$/.test(manifest.environment.base), `env base pinned: ${manifest.environment.base}`);
ok(/^assets\/avatars\/[0-9a-f]{12}\/$/.test(manifest.avatars.prefix), `avatar prefix pinned: ${manifest.avatars.prefix}`);
ok(manifest.dependencies.environment.sha256.length === 64, "env sha recorded");
const envHash = manifest.dependencies.environment.sha256.slice(0, 12);
ok(manifest.environment.base.includes(envHash), "env base matches dependency hash");
const registry = JSON.parse(readFileSync(join(ROOT, OUT, `assets/environment/${envHash}/environment-registry.json`), "utf8"));
ok(registry && typeof registry === "object", "pinned env registry materialized");
const devManifest = JSON.parse(readFileSync(join(ROOT, "apps/web/public/assets/worlds/garden-village-v1/manifest.json"), "utf8"));
ok(devManifest.environment.base === "assets/environment/", "dev manifest still uses legacy shared path");
rmSync(join(ROOT, OUT), { recursive: true, force: true });

console.log(`M126 ASSETS VERIFIED (${n} assertions)`);
