// Immutable world-template publisher (M12.5): hashes a built world directory
// into a content-addressed, never-overwritten version.
//   node tooling/publish/publish.mjs <templateKey> [--out <dir>] [--driver local|r2] [--dry-run]
// Local driver writes versions/<key>/v<N>/ + index.json. The r2 driver
// uploads EVERY file under the version prefix (manifest alone is not a
// publication), and fails loudly without Cloudflare login. --dry-run lists
// the upload plan (count + keys) without touching disk, bucket, or wrangler.
// Prints PUBLISHED <key> v<N> <hash> (+ UPLOADED <count>/<count> for r2).
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fail = (msg) => { console.error(`publish FAILED: ${msg}`); process.exit(1); };

const args = process.argv.slice(2);
const key = args.find((a) => !a.startsWith("--"));
const outArg = args[args.indexOf("--out") + 1];
const driverArg = args[args.indexOf("--driver") + 1];
const DRY_RUN = args.includes("--dry-run");
if (!key) fail("usage: node tooling/publish/publish.mjs <templateKey> [--out <dir>] [--driver local|r2] [--dry-run]");
const OUT = outArg ? join(ROOT, outArg) : join(ROOT, "out", "templates");
const DRIVER = driverArg ?? "local";

const SRC = join(ROOT, "apps/web/public/assets/worlds", key);
if (!existsSync(SRC)) fail(`built world missing: ${SRC} (run build-world first)`);

const files = [];
const walk = (dir, rel) => {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, `${rel}${e}/`);
    else files.push(`${rel}${e}`);
  }
};
walk(SRC, "");

const hash = createHash("sha256");
for (const f of files) {
  hash.update(f);
  hash.update(readFileSync(join(SRC, f)));
}
const contentHash = hash.digest("hex");

const keyDir = join(OUT, key);
mkdirSync(keyDir, { recursive: true });
const indexPath = join(keyDir, "index.json");
let index = { templateKey: key, versions: [] };
if (existsSync(indexPath)) {
  index = JSON.parse(readFileSync(indexPath, "utf8"));
}
const version = index.versions.length + 1;
const versionDir = join(keyDir, `v${version}`);
if (existsSync(versionDir)) fail(`v${version} already published (immutable)`);

const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
const versionManifest = {
  ...manifest,
  version,
  contentHash,
  compatibilityVersion: manifest.compatibilityVersion ?? 1,
  publishedAt: new Date().toISOString(),
  files,
};
const uploadKeys = [...new Set([...files, "manifest.json"])];

if (DRY_RUN) {
  console.log(`DRY-RUN ${key} v${version} files=${uploadKeys.length}`);
  for (const k of uploadKeys) console.log(`  wedding-templates/${key}/v${version}/${k}`);
  process.exit(0);
}

mkdirSync(versionDir, { recursive: true });
for (const f of files) {
  const dest = join(versionDir, f);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(SRC, f), dest);
}
writeFileSync(join(versionDir, "manifest.json"), JSON.stringify(versionManifest, null, 2) + "\n");
index.versions.push({ version, contentHash, publishedAt: versionManifest.publishedAt });
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

if (DRIVER === "r2") {
  let uploaded = 0;
  for (const k of uploadKeys) {
    try {
      execFileSync("wrangler", ["r2", "object", "put", `wedding-templates/${key}/v${version}/${k}`, "--file", join(versionDir, k)], {
        cwd: ROOT, stdio: "pipe", timeout: 300000,
      });
      uploaded += 1;
    } catch (e) {
      fail(`r2 upload ${uploaded}/${uploadKeys.length} then FAILED on ${k}: r2 upload needs Cloudflare login: ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(0, 200)}`);
    }
  }
  console.log(`UPLOADED ${uploaded}/${uploadKeys.length}`);
}

console.log(`PUBLISHED ${key} v${version} ${contentHash.slice(0, 12)}`);
