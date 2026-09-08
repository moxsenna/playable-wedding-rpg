// Mint real HMAC realtime sessions for probes via the repo's own
// wedding-core (transpiled in a tmp dir, same pattern as
// verify-m8-logic.mjs). Import { mintSession } from "./mint-session.mjs".
// Call mintSession(projectId, name) -> session string. Call
// cleanupMintSession() once at the end.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

function secret() {
  const s = process.env.ROOM_SECRET ?? "";
  if (!s || s.length < 16) {
    throw new Error("mint-session: ROOM_SECRET missing or too short");
  }
  return s;
}

let cached = null;

function build() {
  if (cached) return cached;
  const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
  const ts = gameRequire("typescript");
  const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-mintsess-"));
  for (const [dir, mod] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "durable"],
    ["packages/wedding-core/src", "guests"],
    ["packages/wedding-core/src", "session"],
  ]) {
    const src = readFileSync(join(ROOT, dir, `${mod}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    writeFileSync(join(tmp, `${mod}.js`), out.outputText);
  }
  const shimDir = join(tmp, "node_modules", "@wedding-rpg", "contracts");
  mkdirSync(shimDir, { recursive: true });
  writeFileSync(join(shimDir, "package.json"), JSON.stringify({ name: "@wedding-rpg/contracts", main: "index.js" }));
  writeFileSync(
    join(shimDir, "index.js"),
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../durable.js"));`
  );
  const req = createRequire(join(tmp, "x.js"));
  cached = {
    tmp,
    guests: req(join(tmp, "guests.js")),
    session: req(join(tmp, "session.js")),
    store: null,
  };
  cached.store = cached.guests.createGuestStore();
  return cached;
}

export async function mintSession(projectId, name) {
  const { guests, session, store } = build();
  const r = guests.registerGuest(store, projectId, name, Date.now());
  if (!r.ok) throw new Error(`register failed: ${r.errors.join(";")}`);
  const s = await session.signSession(r.guest, "guest_01", ["guest_01"], secret(), Date.now());
  if (!s.ok) throw new Error(`sign failed: ${s.errors.join(";")}`);
  return s.session;
}

export function cleanupMintSession() {
  if (cached) {
    rmSync(cached.tmp, { recursive: true, force: true });
    cached = null;
  }
}
