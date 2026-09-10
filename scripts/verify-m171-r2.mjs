// M17.1 R2 oracle: media bucket exists with the MEDIA binding and
// Studio-only CORS. Prints R2 MEDIA VERIFIED.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M17.1 R2 check FAILED: ${msg}`); process.exit(1); };

const rootRequire = createRequire(join(ROOT, "package.json"));
let resolveWranglerJs;
try {
  ({ resolveWranglerJs } = rootRequire("./tooling/resolve-wrangler.mjs"));
} catch {
  fail("tooling/resolve-wrangler.mjs missing");
}
let WRANGLER_JS;
try {
  WRANGLER_JS = resolveWranglerJs();
} catch (e) {
  fail(`wrangler resolve: ${(e && e.message) || e}`);
}

let n = 0;
const ok = (cond, msg) => {
  n++;
  if (!cond) fail(`assertion ${n}: ${msg}`);
};

const wrangler = (args) => {
  try {
    return execFileSync(process.execPath, [WRANGLER_JS, ...args], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000,
    });
  } catch (e) {
    fail(`wrangler ${args.join(" ")}: ${((e.stdout || "") + (e.stderr || e.message || "")).toString().slice(-400)}`);
  }
};

const cfg = JSON.parse(readFileSync(join(ROOT, "apps/api/wrangler.jsonc"), "utf8"));
const media = (cfg.r2_buckets ?? []).find((b) => b.binding === "MEDIA");
ok(media?.bucket_name === "yutemu-wedding-media", "MEDIA binding points at yutemu-wedding-media");

const buckets = wrangler(["r2", "bucket", "list"]);
ok(buckets.includes("yutemu-wedding-media"), "media bucket exists");

const cors = wrangler(["r2", "bucket", "cors", "list", "yutemu-wedding-media"]);
ok(cors.includes("https://wrpg.appvibe.biz.id"), "Studio origin allowed");
ok(cors.includes("https://wedding-rpg-bli.pages.dev"), "Pages origin allowed");
ok(/allowed_methods:\s*PUT/i.test(cors) && !/GET|DELETE/.test(cors.split("allowed_methods:")[1] ?? ""), "PUT-only methods");
ok(cors.includes("content-type"), "content-type header allowed");

const file = JSON.parse(readFileSync(join(ROOT, "tooling/r2/cors-media.json"), "utf8"));
ok(Array.isArray(file.rules) && file.rules.length === 1, "CORS file is the applied single rule");

console.log(`R2 MEDIA VERIFIED (${n} assertions)`);
