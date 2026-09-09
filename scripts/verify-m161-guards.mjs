// M16.1 guards oracle: guest paths never substitute fixture data, draft
// eligibility is explicit, admin lifecycle is server-first when configured.
// Prints M161 GUARDS VERIFIED.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M16.1 guards check FAILED: ${msg}`); process.exit(1); };

let n = 0;
const ok = (cond, msg) => {
  n++;
  if (!cond) fail(`assertion ${n}: ${msg}`);
};
const src = (p) => readFileSync(join(ROOT, p), "utf8");

const runtime = src("apps/web/src/weddings/runtime.ts");
ok(runtime.includes("inflight") && runtime.includes("fetchBootstrap"), "bootstrap uses a shared single-flight helper");
ok(/status: "loading"/.test(runtime) && /status: "error"/.test(runtime), "runtime reports loading/error states");
ok(runtime.includes('status: "fixture"'), "explicit dev fixture state exists");
ok(!/setState\(\{[^}]*DEMO_/.test(runtime), "no fetch outcome ever substitutes fixture data");
ok(/if \(!token\)[\s\S]{0,200}status: "fixture"/.test(runtime), "fixture is returned only when no guest token exists");
ok(runtime.includes("missing content") && runtime.includes("invalid publication"), "bad snapshots become errors, not fixtures");

const book = src("apps/web/src/components/wedding-book.tsx");
ok(book.includes('runtime.status === "error"'), "book renders the error state");
ok(!book.includes("DEMO_PUBLICATION"), "book no longer imports the demo fixture");

const main = src("apps/web/src/game/main.ts");
ok((main.match(/throw new Error/g) || []).length >= 4, "guest boot fails loudly instead of falling back");
ok(!main.includes("/v1/session"), "no separate session request");
ok(!main.includes('next.set("session"'), "session is never written into the URL");
ok(main.includes("__weddingSession") && main.includes("__weddingNetUrl"), "session and net travel via injection");
ok(main.includes("DEMO_NPC_BINDINGS") && main.includes("resolveWeddingId"), "dev path keeps the explicit fixture fallback");

const scene = src("packages/game/src/scenes/WeddingWorldScene.ts");
ok(scene.includes("__weddingSession") && scene.includes("__weddingNetUrl"), "scene reads injected credentials first");
ok(scene.includes('q.get("net")') && scene.includes('q.get("session")'), "URL params remain as dev fallback");

const guest = src("apps/web/src/pages/g/[token].tsx");
ok(guest.includes("fetchBootstrap"), "guest page shares the single bootstrap call");
ok(guest.includes("guest-not-live"), "draft projects get an explicit standby state");
ok(guest.includes("no-publication"), "standby state exists");
ok((guest.match(/AppWithoutSSR/g) || []).length === 2, "game mounts only in the ready branch");

const api = src("apps/api/src/api.ts");
ok(api.includes('project.status !== "live"') && api.includes("wedding not live"), "draft projects are rejected from guest bootstrap");
ok(/session: signed && signed\.ok \? signed\.session : null/.test(api), "bootstrap carries the session");
ok(api.includes("realtime: { enabled:"), "bootstrap carries realtime membership");

const admin = src("apps/web/src/pages/admin.tsx");
ok(admin.includes("/v1/admin/publish") && admin.includes("/v1/admin/activate"), "publish/activate call the server");
ok(admin.includes("admin-server-versions"), "server versions are displayed");
ok(admin.includes("serverConfigured"), "server path is explicit, dry-run stays for keyless dev");
ok(admin.includes("createVersionStore()"), "keyless dry-run lifecycle intact");

console.log(`M161 GUARDS VERIFIED (${n} assertions)`);
