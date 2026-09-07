// M4 logic oracle: publication schema, section visibility, deep-link and
// navigate payloads. Transpiles the dependency-free contract sources with the
// repo's own typescript and runs the assertions.
// Prints M4 LOGIC VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M4 logic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

// Transpile inside packages/contracts so runtime `require("zod")` resolves.
const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m4logic-"));
try {
  for (const name of ["shared", "index", "npc", "publication"]) {
    const src = readFileSync(join(ROOT, "packages/contracts/src", `${name}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    if (out.diagnostics && out.diagnostics.length > 0) fail(`transpile errors in ${name}.ts`);
    writeFileSync(join(tmp, `${name}.js`), out.outputText);
  }
  const req = createRequire(join(tmp, "x.js"));
  const pub = req(join(tmp, "publication.js"));
  const npc = req(join(tmp, "npc.js"));
  const shared = req(join(tmp, "shared.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };

  const validPub = () => ({
    id: "demo-1",
    couple: { partnerA: "Ayu Lestari", partnerB: "Bima Pratama", dateISO: "2027-06-12", welcome: "Selamat datang!" },
    events: [
      { id: "akad", kind: "akad", title: "Akad Nikah", dateISO: "2027-06-12", timeStart: "08:00", timeEnd: "10:00", venueId: "taman" },
      { id: "resepsi", kind: "reception", title: "Resepsi Pernikahan", dateISO: "2027-06-12", timeStart: "11:00", timeEnd: "13:00", venueId: "taman" },
    ],
    venues: [{ id: "taman", name: "Taman Kebahagiaan", address: "Jl. Mawar No. 8", landmarkId: "landmark.main_plaza" }],
    dresscode: { text: "Pastel." },
    gallery: [{ src: "assets/gallery/demo-1.png", alt: "Foto taman" }],
    gift: { bankName: "Bank Demo", accountNumber: "0000", accountName: "Ayu & Bima" },
    story: [{ title: "Awal", text: "Sapa, tawa, rindu." }],
    modules: { rsvp: true, gift: true, gallery: true },
    world: { templateKey: "garden-village-v1", templateVersion: 1 },
  });

  // --- valid + negatives ---
  let r = pub.validatePublication(validPub());
  ok(r.ok && r.publication !== null, "valid publication passes");

  r = pub.validatePublication({ ...validPub(), couple: { ...validPub().couple, dateISO: "12-06-2027" } });
  ok(!r.ok, "bad dateISO rejected");

  const leaked = validPub();
  leaked.events = [{ ...leaked.events[0], title: "RECEPTION DINNER" }];
  r = pub.validatePublication(leaked);
  ok(!r.ok && r.errors.some((e) => e.includes("enum")), "enum leak in title rejected");

  const badVenue = validPub();
  badVenue.events = [{ ...badVenue.events[0], venueId: "void" }];
  r = pub.validatePublication(badVenue);
  ok(!r.ok && r.errors.some((e) => e.includes("unknown venue")), "unknown venue rejected");

  const dupEvents = validPub();
  dupEvents.events = [dupEvents.events[0], { ...dupEvents.events[1], id: "akad" }];
  r = pub.validatePublication(dupEvents);
  ok(!r.ok && r.errors.some((e) => e.includes("duplicate event")), "duplicate event id rejected");

  r = pub.validatePublication({ ...validPub(), events: [] });
  ok(!r.ok, "empty events rejected");

  r = pub.validatePublication({ ...validPub(), story: [] });
  ok(!r.ok, "empty story rejected");

  // --- section visibility ---
  const secs = (p) => pub.visibleSections(pub.validatePublication(p).publication);
  ok(JSON.stringify(secs(validPub())) === JSON.stringify(["home", "events", "venue", "dresscode", "gallery", "rsvp", "gift", "story"]), "full section order");
  const noDress = validPub();
  delete noDress.dresscode;
  ok(!secs(noDress).includes("dresscode") && secs(noDress).length === 7, "dresscode hidden when absent");
  const noGiftMod = { ...validPub(), modules: { rsvp: true, gift: false, gallery: true } };
  ok(!secs(noGiftMod).includes("gift"), "gift hidden when module off");
  const noGallery = { ...validPub(), modules: { rsvp: true, gift: true, gallery: false } };
  ok(!secs(noGallery).includes("gallery"), "gallery hidden when module off");
  const noRsvp = { ...validPub(), modules: { rsvp: false, gift: true, gallery: true } };
  ok(!secs(noRsvp).includes("rsvp"), "rsvp hidden when module off");

  // --- deep-link + navigate payloads ---
  ok(npc.bookSectionSchema.safeParse("events").success, "events section parses");
  ok(!npc.bookSectionSchema.safeParse("admin").success, "non-section rejected");
  ok(shared.landmarkIdSchema.safeParse("landmark.main_plaza").success, "known landmark parses");
  ok(!shared.landmarkIdSchema.safeParse("landmark.nope").success, "unknown landmark rejected");

  console.log(`M4 LOGIC VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
