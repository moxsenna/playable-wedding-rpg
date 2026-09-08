// Immutable world-template publisher (M12): hashes a built world directory
// into a content-addressed, never-overwritten version.
//   node tooling/publish/publish.mjs <templateKey> [--out <dir>] [--driver local]
// Local driver writes versions/<key>/v<N>/ + index.json. The r2 driver shells
// to `wrangler r2 object put` and fails loudly without Cloudflare login.
// Prints PUBLISHED <key> v<N> <hash> on success.
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
if (!key) fail("usage: node tooling/publish/publish.mjs <templateKey> [--out <dir>] [--driver local|r2]");
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
mkdirSync(versionDir, { recursive: true });

const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
for (const f of files) {
  const dest = join(versionDir, f);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(SRC, f), dest);
}
const versionManifest = {
  ...manifest,
  version,
  contentHash,
  compatibilityVersion: manifest.compatibilityVersion ?? 1,
  publishedAt: new Date().toISOString(),
  files,
};
writeFileSync(join(versionDir, "manifest.json"), JSON.stringify(versionManifest, null, 2) + "\n");
index.versions.push({ version, contentHash, publishedAt: versionManifest.publishedAt });
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

if (DRIVER === "r2") {
  try {
    execFileSync("wrangler", ["r2", "object", "put", `wedding-templates/${key}/v${version}/manifest.json`, "--file", join(versionDir, "manifest.json")], {
      cwd: ROOT, stdio: "pipe", timeout: 300000,
    });
  } catch (e) {
    fail(`r2 upload needs Cloudflare login: ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(0, 300)}`);
  }
}

console.log(`PUBLISHED ${key} v${version} ${contentHash.slice(0, 12)}`);
