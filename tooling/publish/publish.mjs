// Immutable world-template publisher (M12.6): content-addressed version +
// content-addressed dependency dirs (environment/, avatars/). The world dir
// is hashed as before; each dep dir is hashed independently and published
// under assets/<name>/<sha12>/, and the version manifest pins them — so
// Environment V3 can never visually mutate a pinned wedding. The game reads
// the pinned prefixes from the version manifest (falls back to the legacy
// shared paths when absent). Usage:
//   node tooling/publish/publish.mjs <templateKey> [--out <dir>] [--driver local|r2] [--dry-run]
// Local driver writes versions/<key>/v<N>/ + assets/<name>/<sha12>/ +
// index.json. The r2 driver uploads EVERY file (version + deps), and fails
// loudly without Cloudflare login. --dry-run lists the upload plan
// (count + keys) without touching disk, bucket, or wrangler.
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

const hashDir = (dir) => {
  const h = createHash("sha256");
  const list = [];
  const w = (d, rel) => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) w(p, `${rel}${e}/`);
      else list.push(`${rel}${e}`);
    }
  };
  w(dir, "");
  for (const f of list) {
    h.update(f);
    h.update(readFileSync(join(dir, f)));
  }
  return { digest: h.digest("hex"), files: list };
};
const sha12 = (digest) => digest.slice(0, 12);

const ASSETS = join(ROOT, "apps/web/public/assets");
const deps = [
  { name: "environment", dir: join(ASSETS, "environment") },
  { name: "avatars", dir: join(ASSETS, "avatars") },
];
for (const d of deps) {
  if (!existsSync(d.dir)) fail(`dependency dir missing: ${d.dir}`);
  Object.assign(d, hashDir(d.dir));
  d.prefix = `assets/${d.name}/${sha12(d.digest)}/`;
}

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
const envDep = deps.find((d) => d.name === "environment");
const avatarDep = deps.find((d) => d.name === "avatars");
const versionManifest = {
  ...manifest,
  version,
  contentHash,
  compatibilityVersion: manifest.compatibilityVersion ?? 1,
  publishedAt: new Date().toISOString(),
  files,
  dependencies: {
    environment: { prefix: envDep.prefix, sha256: envDep.digest, files: envDep.files.length },
    avatars: { prefix: avatarDep.prefix, sha256: avatarDep.digest, files: avatarDep.files.length },
  },
  environment: {
    ...(manifest.environment ?? {}),
    base: envDep.prefix,
  },
  avatars: { prefix: avatarDep.prefix },
};
const depKeys = deps.flatMap((d) => d.files.map((f) => ({ dep: d, file: f })));
const uploadKeys = [...new Set([...files.map((f) => `wedding-templates/${key}/v${version}/${f}`), `wedding-templates/${key}/v${version}/manifest.json`, ...depKeys.map(({ dep, file }) => `${dep.prefix}${file}`)])];

if (DRY_RUN) {
  console.log(`DRY-RUN ${key} v${version} files=${uploadKeys.length} deps=${deps.map((d) => `${d.name}@${sha12(d.digest)}:${d.files.length}`).join(",")}`);
  for (const k of uploadKeys) console.log(`  ${k}`);
  process.exit(0);
}

mkdirSync(versionDir, { recursive: true });
for (const f of files) {
  const dest = join(versionDir, f);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(SRC, f), dest);
}
writeFileSync(join(versionDir, "manifest.json"), JSON.stringify(versionManifest, null, 2) + "\n");
for (const d of deps) {
  const depDir = join(OUT, d.prefix);
  if (!existsSync(depDir)) {
    for (const f of d.files) {
      const dest = join(depDir, f);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(join(d.dir, f), dest);
    }
  }
}
index.versions.push({ version, contentHash, publishedAt: versionManifest.publishedAt, dependencies: versionManifest.dependencies });
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

if (DRIVER === "r2") {
  let uploaded = 0;
  const put = (r2key, localFile) => {
    execFileSync("wrangler", ["r2", "object", "put", r2key, "--file", localFile], {
      cwd: ROOT, stdio: "pipe", timeout: 300000,
    });
    uploaded += 1;
  };
  try {
    for (const f of [...files, "manifest.json"]) {
      put(`wedding-templates/${key}/v${version}/${f}`, join(versionDir, f));
    }
    for (const { dep, file } of depKeys) {
      put(`${dep.prefix}${file}`, join(OUT, dep.prefix, file));
    }
  } catch (e) {
    fail(`r2 upload ${uploaded}/${uploadKeys.length} then FAILED: r2 upload needs Cloudflare login: ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(0, 200)}`);
  }
  console.log(`UPLOADED ${uploaded}/${uploadKeys.length}`);
}

console.log(`PUBLISHED ${key} v${version} ${contentHash.slice(0, 12)}`);
