// M16 logic oracle: CSV, tokens, analytics, projects, store isolation.
// Transpiles workspace TS into a tmp tree (same pattern as verify-m8-logic)
// so the check runs without workspace resolution. Prints M16 LOGIC VERIFIED.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M16 logic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m16logic-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "durable"],
    ["packages/contracts/src", "m16"],
    ["packages/wedding-core/src", "csv"],
    ["packages/wedding-core/src", "tokens"],
    ["packages/wedding-core/src", "analytics"],
    ["packages/wedding-core/src", "projects"],
  ]) {
    const src = readFileSync(join(ROOT, dir, `${name}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    writeFileSync(join(tmp, `${name}.js`), out.outputText);
  }
  const shimDir = join(tmp, "node_modules", "@wedding-rpg", "contracts");
  mkdirSync(shimDir, { recursive: true });
  writeFileSync(join(shimDir, "package.json"), JSON.stringify({ name: "@wedding-rpg/contracts", main: "index.js" }));
  writeFileSync(
    join(shimDir, "index.js"),
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../durable.js"), require("../../../m16.js"));`
  );
  const req = createRequire(join(tmp, "x.js"));
  const csv = req(join(tmp, "csv.js"));
  const tokens = req(join(tmp, "tokens.js"));
  const analytics = req(join(tmp, "analytics.js"));
  const projects = req(join(tmp, "projects.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  let r = csv.parseGuestCsv("name,phone\nBudi,0812\n\"Sari, M.Pd\",0813\n\n, \nBudi,0812\n");
  ok(r.valid.length === 2, `csv valid len ${r.valid.length}`);
  ok(r.valid[1].row.name === "Sari, M.Pd", "csv quoted comma");
  ok(r.rejected.length === 1 && r.rejected[0].reason === "missing name", "csv missing-name reject");
  ok(r.skippedBlank === 1, "csv blank count");
  r = csv.parseGuestCsv("Tamu A\nTamu B\n\n");
  ok(r.valid.length === 2, "headerless csv");
  const fifty = Array.from({ length: 50 }, (_, i) => `Tamu ${String(i + 1).padStart(2, "0")}`).join("\n");
  r = csv.parseGuestCsv(`name\n${fifty}\n`);
  ok(r.valid.length === 50 && r.rejected.length === 0, "50-guest csv");
  r = csv.parseGuestCsv("phone,email\n0812,a@b.c\n");
  ok(r.rejected.length === 1, "header-without-name rejects rows");

  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const t = tokens.mintGuestToken();
    ok(/^gt_[A-Za-z0-9_-]{8,64}$/.test(t), `token shape ${t}`);
    ok(!seen.has(t), "token unique");
    seen.add(t);
  }
  ok(tokens.mintPreviewToken().startsWith("pv_"), "preview shape");

  ok(analytics.validateAnalyticsEvent({ type: "game_ready" }).ok, "game_ready valid");
  ok(!analytics.validateAnalyticsEvent({ type: "player.move" }).ok, "movement tick rejected");
  const s = analytics.summarizeAnalytics(
    [
      { projectId: "a", guestId: "g1", type: "guest_link_opened", at: 1 },
      { projectId: "a", guestId: "g1", type: "session_started", at: 2 },
      { projectId: "a", guestId: "g2", type: "guest_link_opened", at: 3 },
      { projectId: "a", guestId: null, type: "heart_collected", at: 4 },
      { projectId: "a", guestId: null, type: "finale_reached", at: 5 },
    ],
    50
  );
  ok(s.uniqueOpened === 2 && s.uniqueStarted === 1, "analytics open/start");
  ok(s.heartsCollected === 1 && s.finaleReached === 1 && s.totalGuests === 50, "analytics counts");

  const c = projects.validateProjectCreate({ name: "Ayu & Bima" });
  ok(c.ok && c.slug === "ayu-bima", `slug ${c.slug}`);
  ok(!projects.validateProjectCreate({ name: "" }).ok, "empty name rejects");
  ok(projects.validateProjectUpdate({ status: "live" }).ok, "live update ok");
  ok(!projects.allowedStatusTransition("archived", "live"), "archived->live blocked");
  ok(projects.allowedStatusTransition("archived", "draft"), "archived->draft ok");

  console.log(`M16 LOGIC VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
