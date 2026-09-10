// M17 isolation golden: three weddings with separate projects, guests,
// publications, bindings, links, and analytics, plus a 50-guest import —
// all through the store boundary with project scoping enforced.
// Prints M17 ISOLATION VERIFIED.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M17 isolation check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m17iso-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "durable"],
    ["packages/contracts/src", "npc"],
    ["packages/contracts/src", "publication"],
    ["packages/wedding-core/src", "guests"],
    ["packages/wedding-core/src", "rsvp"],
    ["packages/wedding-core/src", "guestbook"],
    ["packages/wedding-core/src", "publishing"],
    ["packages/wedding-core/src", "memory"],
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
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../durable.js"), require("../../../npc.js"), require("../../../publication.js"));`
  );
  const req = createRequire(join(tmp, "x.js"));
  const { MemoryStore } = req(join(tmp, "memory.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  const store = new MemoryStore();
  const now = Date.now();
  const projects = [
    { id: "wed-ayu-bima", name: "Ayu & Bima", slug: "ayu-bima" },
    { id: "wed-raka-naya", name: "Raka & Naya", slug: "raka-naya" },
    { id: "wed-arvin-selena", name: "Arvin & Selena", slug: "arvin-selena" },
  ];
  for (const p of projects) {
    await store.createProject({ ...p, status: "live", createdAt: now, updatedAt: now });
  }
  ok((await store.listProjects()).length === 3, "three projects listed");

  const envelope = (couple) => ({
    publication: {
      id: "v1", couple, events: [], venues: [], story: [], modules: {}, world: {},
    },
    npcBindings: [{ slotId: "npc.greeter", name: `Greeter ${couple.partnerA}` }],
  });
  const couples = [
    { partnerA: "Ayu", partnerB: "Bima" },
    { partnerA: "Raka", partnerB: "Naya" },
    { partnerA: "Arvin", partnerB: "Selena" },
  ];
  for (let i = 0; i < projects.length; i++) {
    await store.insertVersion({
      id: `pv-${projects[i].id}`, projectId: projects[i].id, publicationId: projects[i].id,
      version: 1, status: "active", snapshot: envelope(couples[i]), createdAt: now,
    });
  }
  for (let i = 0; i < projects.length; i++) {
    const v = await store.findActive(projects[i].id, projects[i].id);
    ok(v?.snapshot?.npcBindings?.[0]?.name?.includes(couples[i].partnerA), `wedding ${i} has own bindings`);
  }

  for (let i = 1; i <= 50; i++) {
    await store.insertGuest({
      id: `ga-${i}`, projectId: "wed-ayu-bima", name: `Tamu ${i}`,
      token: `gt_golden_${i.toString(36).padStart(8, "0")}test`, createdAt: now + i,
    });
  }
  await store.insertGuest({ id: "gb-1", projectId: "wed-raka-naya", name: "Sinta", token: "gt_golden_b1test00", createdAt: now });
  await store.insertGuest({ id: "gc-1", projectId: "wed-arvin-selena", name: "Putri", token: "gt_golden_c1test00", createdAt: now });
  ok((await store.listGuests("wed-ayu-bima")).length === 50, "50 guests persisted in wedding A");
  ok((await store.listGuests("wed-raka-naya")).length === 1, "wedding B isolated");
  ok((await store.listGuests("wed-arvin-selena")).length === 1, "wedding C isolated");

  const guestA = await store.findGuestByToken("gt_golden_00000001test");
  ok(guestA?.projectId === "wed-ayu-bima", "guest token resolves to its own project");
  ok((await store.findGuestByToken("gt_nope_notreal")) === null, "forged token resolves nothing");

  await store.upsertRsvp({ token: guestA.token, projectId: "wed-ayu-bima", name: guestA.name, attending: "hadir", partySize: 2, updatedAt: now });
  ok((await store.listRsvps("wed-raka-naya")).length === 0, "RSVP invisible cross-project");
  ok((await store.listRsvps("wed-ayu-bima")).length === 1, "RSVP recorded in own project");

  await store.insertGuestbook({ id: "gb-a1", projectId: "wed-ayu-bima", name: "Tamu 1", message: "Selamat!", createdAt: now });
  ok((await store.listGuestbook("wed-raka-naya")).length === 0, "guestbook invisible cross-project");

  await store.recordAnalyticsEvent({ projectId: "wed-ayu-bima", guestId: "ga-1", type: "game_ready", at: now });
  ok((await store.listAnalyticsEvents("wed-raka-naya")).length === 0, "analytics invisible cross-project");
  ok((await store.listAnalyticsEvents("wed-ayu-bima")).length === 1, "analytics recorded in own project");

  ok((await store.updateGuest("wed-raka-naya", "ga-1", { name: "X" })) === null, "cross-project update rejected");
  ok((await store.deleteGuest("wed-raka-naya", "ga-1")) === false, "cross-project delete rejected");
  ok((await store.listGuests("wed-ayu-bima")).length === 50, "target rows intact after attacks");

  await store.setAvatarPool("wed-ayu-bima", ["guest_01", "guest_male_batik"]);
  ok((await store.getAvatarPool("wed-ayu-bima")).length === 2, "pool stored per project");
  ok((await store.getAvatarPool("wed-raka-naya")).length === 0, "pool isolated per project");

  await store.upsertWorldConfig({ id: "worldcfg-wed-ayu-bima", projectId: "wed-ayu-bima", templateVersionId: "v6", ambientPreset: "garden-day", musicRef: null });
  ok((await store.getWorldConfig("wed-ayu-bima"))?.ambientPreset === "garden-day", "world config per project");
  ok((await store.getWorldConfig("wed-raka-naya")) === null, "world config isolated");
  ok((await store.listTemplateVersions()).length >= 1, "template catalog listed");

  console.log(`M17 ISOLATION VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
