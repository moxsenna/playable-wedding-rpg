// YUTEMU brand oracle: assets, metadata, old-brand cleanup, and
// probe-asserted copy preserved. Prints BRAND VERIFIED.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`Brand check FAILED: ${msg}`); process.exit(1); };

let n = 0;
const ok = (cond, msg) => {
  n++;
  if (!cond) fail(`assertion ${n}: ${msg}`);
};
const src = (p) => readFileSync(join(ROOT, p), "utf8");

for (const f of [
  "apps/web/public/brand/logo/yutemu-mark.webp",
  "apps/web/public/brand/logo/yutemu-wordmark.svg",
  "apps/web/public/brand/icon/icon-192.png",
  "apps/web/public/brand/icon/icon-512.png",
  "apps/web/public/brand/icon/apple-touch-icon.png",
  "apps/web/public/brand/icon/favicon.ico",
  "apps/web/public/manifest.webmanifest",
  "apps/web/src/config/brand.ts",
]) {
  ok(existsSync(join(ROOT, f)), `asset exists: ${f}`);
}

const manifest = JSON.parse(src("apps/web/public/manifest.webmanifest"));
ok(manifest.name === "YUTEMU" && manifest.short_name === "YUTEMU", "manifest named YUTEMU");
ok(manifest.description === "Temui kisah mereka.", "manifest tagline");
for (const icon of manifest.icons ?? []) {
  ok(existsSync(join(ROOT, "apps/web/public", icon.src.replace(/^\//, ""))), `manifest icon exists: ${icon.src}`);
}

const brand = src("apps/web/src/config/brand.ts");
ok(brand.includes('name: "YUTEMU"') && brand.includes("Temui kisah mereka."), "central brand config");

const index = src("apps/web/src/pages/index.tsx");
ok(index.includes("YUTEMU — Temui Kisah Mereka"), "home title is YUTEMU");

const doc = src("apps/web/src/pages/_document.tsx");
ok(doc.includes("YUTEMU") && doc.includes("yutemu-mark.webp"), "boot splash is YUTEMU");
ok(doc.includes("/manifest.webmanifest") && doc.includes("apple-touch-icon"), "pwa links present");
ok(!doc.includes("Taman Kebahagiaan"), "splash no longer carries the old title");

const guest = src("apps/web/src/pages/g/[token].tsx");
ok(guest.includes("YUTEMU"), "guest title carries YUTEMU");

const admin = src("apps/web/src/pages/admin.tsx");
ok(admin.includes("YUTEMU Studio"), "admin is YUTEMU Studio");

const loader = src("apps/web/src/components/loading-screen.tsx");
ok(loader.includes("YUTEMU") && loader.includes("Temui kisah mereka."), "loading screen is YUTEMU");

const onboarding = src("apps/web/src/components/onboarding-panel.tsx");
ok(onboarding.includes("YUTEMU"), "onboarding carries YUTEMU");

const book = src("apps/web/src/components/wedding-book.tsx");
ok(book.includes("YUTEMU"), "wedding book carries YUTEMU identity");

const boundary = src("apps/web/src/components/error-boundary.tsx");
ok(boundary.includes("YUTEMU"), "fallback states are YUTEMU");

const finale = src("apps/web/src/components/finale-reveal.tsx");
ok(!finale.includes("demo-publication"), "finale reads runtime data, not the fixture");

const hud = src("apps/web/src/components/quest-hud.tsx");
ok(hud.includes("OUR STORY"), "quest HUD text preserved");
ok(book.includes("Undangan"), "Undangan label preserved");
ok(guest.includes("tidak valid"), "invalid guest copy preserved");
ok(admin.includes("(dry-run)"), "keyless dry-run label preserved");

const tsxFiles = [];
const walk = (dir) => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) tsxFiles.push(rel);
  }
};
walk("apps/web/src");
const oldBrand = tsxFiles
  .filter((f) => !f.includes("weddings/demo-") && !f.includes("weddings/raka-") && !f.includes("weddings/arvin-") && !f.includes("weddings/select"))
  .filter((f) => {
    const s = src(f);
    return /Playable Wedding|Pixel Quest|pixel quest|Taman Kebahagiaan…|Admin RPG/.test(s) || s.includes("/favicon.png");
  });
ok(oldBrand.length === 0, `old brand in user-facing src: ${oldBrand.join(", ")}`);

console.log(`BRAND VERIFIED (${n} assertions)`);
