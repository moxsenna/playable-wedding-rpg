# Implementation Status — Playable Wedding RPG V1

Ledger for milestone order M0..M14 (see `.unlazy/wedding-rpg-v1/PLAN.md`).
Gates live in `.unlazy/wedding-rpg-v1/GATES.md` + `gates/leaf-*.md`.

## M0 — Foundation (VERIFIED 2026-09-07)

- Status: complete. leaf-m0 G0/G1/G2 PASS via gate-checker with recorded
  evidence; G3 manual visual review done; root G0/G1/G2/G3 met.
- Files changed: `package.json`, `pnpm-workspace.yaml`, `.gitignore`,
  `apps/web/**` (from official phaserjs/template-nextjs, adapted to portrait +
  Phaser 4.2.1), `packages/contracts/**`, `scripts/verify-m0*.mjs`,
  `scripts/check-forbidden-patterns.mjs`, `scripts/gate-lint-all.mjs`,
  `THIRD_PARTY_ASSETS.md`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `pnpm install`, `pnpm approve-builds sharp`,
  `pnpm --filter @wedding-rpg/web build` (exit 0, 3/3 static pages),
  `node scripts/gate-lint-all.mjs` (LINT OK),
  gate-checker `--approve` on leaf-m0 + root GATES (G0/G1/G2 PASS each),
  Playwright `screenshot --viewport-size=390,844` -> `docs/qa/m0-390px.png`.
- Tests: typecheck (`tsc --noEmit`) green inside M0 MOUNT VERIFIED;
  forbidden-pattern negative control SELF TEST PASSED.
- Acceptance: leaf-m0 G0..G3 all met with evidence.
- Known issues: official `@phaserjs/game` scaffolder ID from the brief does not
  exist on npm (`pnpm create @phaserjs/game` maps to `create-phaser-game`, which
  is interactive-only); used the current official equivalent
  (phaserjs/template-nextjs, MIT) per the brief's own fallback rule, upgraded
  Phaser 3-era dep to 4.2.1. Template `.eslintrc.json` removed (legacy cruft,
  eslint not installed). pnpm 11 `approve-builds` needed once for sharp.
- Next: M1 (leaf-m1) — Tiled garden-village-v1 + player + collision + camera.

## M1 — Real World (VERIFIED 2026-09-07)

- Status: complete. leaf-m1 G0/G1/G2/G3 PASS via gate-checker with recorded
  evidence; G4 manual visual review done (320/360/390/430).
- Files changed: `tooling/world-gen/**` (png-writer, gen-tileset 41 tiles,
  gen-sprites guest_01 6x4 sheet + frame meta, gen-map 56x80, build-world),
  `assets-source/{tiled,tilesets,sprites}/**`,
  `apps/web/public/assets/worlds/garden-village-v1/**` (runtime map.json with
  embedded tileset + manifest + sprites),
  `packages/game/**` (types, loader, bridge, LocalPlayer, Boot/Preload/
  WeddingWorld scenes, createWeddingGame factory),
  `apps/web/src/game/main.ts` (thin mount entry), `apps/web/src/PhaserGame.tsx`
  (bridge import), `apps/web/next.config.mjs` (transpilePackages),
  `apps/web/package.json` (+@wedding-rpg/game, +playwright dev),
  `scripts/validate-world.mjs`, `scripts/verify-m1-build.mjs`,
  `tooling/e2e/m1-move.mjs`, `docs/qa/m1-*.png`, `.unlazy/wedding-rpg-v1/**`.
  Deleted M0 demo scenes + web EventBus (superseded by packages/game).
- Commands run: `node tooling/world-gen/build-world.mjs`
  (tileset 2328B, sprites 580B, 431 solid, 14 trees),
  `node scripts/validate-world.mjs` (WORLD VALID + SELF TEST PASSED),
  `node scripts/verify-m1-build.mjs` (M1 BUILD VERIFIED: game tsc + web tsc +
  next build), `node tooling/e2e/m1-move.mjs`
  (moved up 108px then right 108px, walk anim confirmed, M1 MOVEMENT VERIFIED),
  gate-checker `--approve` on leaf-m1 (G0..G3 PASS each),
  Playwright screenshots at 320/360/390/430.
- Tests: BFS reachability from spawn.default to all landmarks/slots/spawns/
  zones inside validator; walk-anim assertion inside movement probe.
- Acceptance: leaf-m1 G0..G4 all met with evidence.
- Known issues / decisions: tilemapTiledJSON lands in the tilemap cache, so
  PreloadScene dual-loads the map as JSON for the definition parser
  (commented at the load site). Camera zoom 2 (integer, crisp pixels), speed
  120px/s. Couple NPC slots placed on the hall terrace (finale plays on the
  terrace; hall mass stays solid in M1). `pnpm add -D playwright` needed once
  for the e2e probe. M0 mount gate extended to scan packages/game (invariant
  preserved across the rewire; M0 SCAFFOLD/MOUNT re-verified green).
- Next: M2 (virtual joystick + Interact) and M3 (NPCs) are READY; M4
  (Wedding Book) is READY.

## M2 — Mobile Controls (VERIFIED 2026-09-07)

- Status: complete. leaf-m2 G0/G1/G2/G3 PASS via gate-checker with recorded
  evidence; G4 manual visual review done (390px + 320px).
- Files changed: `packages/game/src/input/**` (types, pure joystick-state
  machine, keyboard adapter, VirtualJoystick view, TouchHud assembly),
  `packages/game/src/actors/player.ts` (consumes unified MovementInput),
  `packages/game/src/scenes/WeddingWorldScene.ts` (stick-wins merge, Hud
  launch + lazy resolve), `packages/game/src/scenes/HudScene.ts` (new:
  parallel zoom-1 interface scene), `packages/game/src/bridge.ts`
  (MODAL_OPENED/CLOSED, INTERACT_PRESSED, EMOTE_SELECTED),
  `packages/game/src/index.ts` (input exports),
  `scripts/verify-m2-input.mjs`, `scripts/verify-m2-build.mjs`,
  `tooling/e2e/m2-touch.mjs`, `docs/qa/m2-*.png`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node scripts/verify-m2-input.mjs` (M2 INPUT VERIFIED,
  20 assertions over transpiled sources), `node scripts/verify-m2-build.mjs`
  (M2 BUILD VERIFIED: game tsc + web tsc + next build),
  `node tooling/e2e/m2-touch.mjs` (stick drag + multitouch + modal
  suspend/resume + emote OK, M2 TOUCH VERIFIED),
  `node tooling/e2e/m1-move.mjs` re-run as M1 regression (108px up/right,
  M1 MOVEMENT VERIFIED), gate-checker `--approve` on leaf-m2 (G0..G3 PASS).
- Tests: pure state-machine transitions incl. strict drag-from-IDLE ignore and
  modal reset(); multitouch via mouse-held stick + touch-tap Interact;
  release-then-drift < 2px (no stuck movement); HUD hidden on non-touch
  desktop context.
- Acceptance: leaf-m2 G0..G4 all met with evidence.
- Known issues / decisions: canvas HUD chosen over DOM per spec preferred
  split (no coordinate mixing). Bare Shape `setInteractive` hit areas proved
  unreliable in-probe (taps never fired); buttons use the same global
  pointerdown + radius routing as the stick. `scrollFactor(0)` ignores scroll
  but NOT camera zoom-2, which pushed HUD off-screen (diagnosed by position
  math, visible only by accident at 320px); fixed with a parallel HudScene on
  its own zoom-1 camera. TouchHud touched M1-owned scene/player/bridge files
  (wiring only); M1 keyboard movement re-verified green afterward.
- Next: M3 (NPCs + dialogue) and M4 (Wedding Book) are READY.

## M3 — NPCs + Dialogue (VERIFIED 2026-09-07)

- Status: complete. leaf-m3 G0/G1/G2/G3 PASS via gate-checker with recorded
  evidence; G4 manual visual review done (360/390/430).
- Files changed: `packages/contracts/src/npc.ts` (roles, allowlisted actions,
  book sections, dialogue/binding schemas, validateNpcBindings) +
  `packages/contracts/src/shared.ts` (slot/heart IDs moved to break a CJS
  cycle in the node oracle; index re-exports),
  `packages/game/src/systems/interaction/select.ts` (pure selector: radius,
  priority weights, facing bias, id tiebreak + contextual labels),
  `packages/game/src/systems/dialogue-runtime.ts` (pure linear runtime with
  action-on-advance + resume),
  `packages/game/src/systems/semantic-actions.ts` (allowlist dispatcher),
  `packages/game/src/actors/npc.ts` (data-driven NpcActor + spawner, dev-throw
  on missing slot), `packages/game/src/scenes/PreloadScene.ts` (registry
  bindings validated, avatar sheets queued),
  `packages/game/src/scenes/WeddingWorldScene.ts` (per-frame selection,
  labels, Interact/E-Space, dialogue suspend/resume, action validation),
  `packages/game/src/bridge.ts` (DIALOGUE_OPENED/ACTION/CLOSED),
  `packages/game/src/input/touch-hud.ts` (reason-counted suspend/resume,
  interact label getter), `tooling/world-gen/gen-sprites.mjs` +
  `build-world.mjs` (10 avatar palettes/sheets/manifest),
  `apps/web/src/weddings/demo-bindings.ts` (10 bindings, linked dialogues),
  `apps/web/src/components/dialogue-panel.tsx` (DOM panel + runtime),
  `apps/web/src/game/main.ts` (passes bindings), `apps/web/src/App.tsx`
  (mounts panel), `apps/web/src/styles/globals.css` (panel styles),
  `scripts/verify-m3-logic.mjs`, `scripts/verify-m3-build.mjs`,
  `tooling/e2e/m3-npc.mjs`, `docs/qa/m3-*.png`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node scripts/verify-m3-logic.mjs` (M3 LOGIC VERIFIED,
  30 assertions: schema negatives, selection, facing, labels, runtime,
  dispatch), `node scripts/verify-m3-build.mjs` (M3 BUILD VERIFIED),
  `node tooling/e2e/m3-npc.mjs` (greeter dialogue + keyboard RSVP + tour OK,
  M3 NPC VERIFIED), gate-checker `--approve` on leaf-m3 (G0..G3 PASS).
- Tests: unit (selector determinism incl. tie-break), E2E M3-A (stick seek,
  Bicara, suspension incl. drag-during-dialogue, 3-step progression,
  OPEN_WEDDING_BOOK dispatch, close, resume without drift), M3-B (keyboard
  seek, RSVP label, E key, OPEN_RSVP dispatch), tour (photo/story/event
  labels, 5/5 target stability), desktop HUD-hidden (in m2 probe).
- Acceptance: leaf-m3 G0..G4 all met with evidence.
- Known issues / decisions: demo fixture omitted explicit `next` links the
  strict runtime requires (fixture bug, diagnosed via in-browser key dump,
  fixed + cleanup removed); E2E seeks target slot tiles with tight arrival
  radii (46px waypoints let neighbors win the radius); dialogue panel is DOM
  per D-017 (readable fonts, touch targets); quest actions exist as contract
  only (M5 behavior); TouchHud touched M2-owned file (reason-counted suspend
  so modal+dialogue can't leak); M1 keyboard re-verified after scene edits.
- Next: M4 (Wedding Book) is READY; M5 waits for M4.

## M4 — Wedding Book + Bridge (VERIFIED 2026-09-07)

- Status: complete. leaf-m4 G0/G1/G2/G3 PASS via gate-checker with recorded
  evidence; G4 manual visual review done (320/360/390/430).
- Files changed: `packages/contracts/src/publication.ts` (new-RPG publication
  schema, guest-title enum-leak guard, visibleSections),
  `packages/contracts/src/shared.ts` + `index.ts` (landmark IDs moved to
  shared; `export *` for npc + publication),
  `apps/web/src/weddings/demo-publication.ts` (Ayu & Bima demo fixture;
  Raka/Naya + Arvin/Selena reserved for M7),
  `apps/web/src/components/wedding-book.tsx` (8 sections, deep links, single
  canonical mock RSVP, venue Show-in-World, Esc/safe-area/a11y basics),
  `apps/web/src/components/error-boundary.tsx` (Phaser mount isolation),
  `apps/web/src/App.tsx` (mounts book + boundary),
  `apps/web/src/styles/globals.css` (sheet/nav/gallery/img aspect styles),
  `packages/game/src/bridge.ts` (NAVIGATE_TO_LANDMARK),
  `packages/game/src/scenes/WeddingWorldScene.ts` (validated nav marker set
  on arrival-clear), `packages/game/src/index.ts` (dispatchSemanticAction),
  `tooling/world-gen/gen-sprites.mjs` + `build-world.mjs` (3 gallery
  placeholders), `scripts/verify-m4-logic.mjs`,
  `scripts/verify-m4-build.mjs`, `tooling/e2e/m4-book.mjs`,
  `docs/qa/book-*.png + m4D-debug.png`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node scripts/verify-m4-logic.mjs` (M4 LOGIC VERIFIED,
  16 assertions), `node scripts/verify-m4-build.mjs` (M4 BUILD VERIFIED),
  `node tooling/e2e/m4-book.mjs` (book/nav/gallery + deep links + dead-Phaser
  readability OK, M4 BOOK VERIFIED), gate-checker `--approve` on leaf-m4
  (G0..G3 PASS).
- Tests: E2E M4-A (open/home/acara/enum scan/drag-suspend/close stationary/
  resume), venue nav marker set + cleared on arrival, gallery decode assert,
  M4-B coordinator→Acara, M4-C RSVP keeper→RSVP mock submit, M4-D asset-block
  (dead hook + couple/event/venue readable), width set 320/360/430.
- Regression (§40) after M4, all on the final tree: M1 MOVEMENT VERIFIED
  (104px up / 108px right), M2 TOUCH VERIFIED (drag + multitouch + modal +
  emote), M3 NPC VERIFIED (dialogue + keyboard RSVP + tour, incl. new
  Book-integration asserts). No regressions.
- Acceptance: leaf-m4 G0..G4 all met with evidence.
- Known issues / decisions: M4-D needed dev-error-overlay removal in-probe
  (Next dev renders boot-throw overlay into nextjs-portal swallowing taps;
  production has no overlay). Gallery needed intrinsic aspect-ratio + decode
  wait (lazy + instant screenshot raced). Mid-M4 duplicate nav-marker blocks
  (re-issued batch during a context-confused turn) slipped past two green
  builds — tsc/Next tolerated what dev SWC rejected; caught by the checker
  re-run, deduped, G2 re-passed. RSVP is clearly-marked local mock until M8;
  gallery placeholders until versioned media (M8/R2). Single RSVP surface for
  book + keeper paths.
- Next: M5 (Four Hearts + Finale) is READY. M6+ per master order.

## M4.5 — Production Avatar Pipeline (VERIFIED 2026-09-07)

- Status: complete. leaf-m4.5 G0/G1/G2/G3 PASS via gate-checker with recorded
  evidence; G4 manual visual review done (320/360/390/430).
- Files changed: `packages/contracts/src/avatar.ts` (avatar/registry Zod
  contract: 8 required anims, frame bounds, geometry, guest pool),
  `tooling/assets/build-avatar-registry.mjs` (pack scan + registry build,
  calibrated displayScale 0.4, legacy guest_01 synthesis),
  `assets-source/sprites/avatar-registry.json` (23 avatars, 11-strong guest
  pool), `apps/web/public/assets/avatars/` (23 runtime sheets + registry),
  `tooling/world-gen/build-world.mjs` (registry-driven, stale placeholder
  outputs deleted), `packages/game/src/actors/player.ts` +
  `npc.ts` (metadata origin/physics/scale, derived label offsets, canonical
  anims), `packages/game/src/scenes/PreloadScene.ts` (registry load,
  referenced-only sheets with per-avatar geometry),
  `packages/game/src/scenes/WeddingWorldScene.ts` (avatar resolution),
  `packages/game/src/index.ts` (playerAvatarId option),
  `apps/web/src/weddings/demo-bindings.ts` (muslim/couple/guest rebinds;
  Nadia/Maya/Ayu/Bima), `apps/web/src/game/main.ts` (batik player avatar),
  `scripts/validate-avatars.mjs`, `scripts/verify-m45-build.mjs`,
  `tooling/e2e/m45-avatars.mjs`, `docs/qa/m45-*.png`,
  `THIRD_PARTY_ASSETS.md` (first-party pack provenance),
  `.unlazy/wedding-rpg-v1/**`. Source packs untouched.
- Commands run: `node tooling/world-gen/build-world.mjs` (23 avatars),
  `node scripts/validate-avatars.mjs` (AVATARS VALID: packs, schema,
  dims, refs, placeholder tripwire, self-test),
  `node scripts/verify-m45-build.mjs` (M4.5 BUILD VERIFIED),
  `node tooling/e2e/m45-avatars.mjs` (textures/feet/8-anims/dialogue OK,
  M4.5 AVATARS VERIFIED), gate-checker `--approve` on leaf-m4.5 (G0..G3 PASS).
- Tests: body geometry probed live (7.2x4.8 feet, centered, at feet line);
  all 8 anim states on production art; 10 NPCs on distinct textures;
  guest_01 absent from NPCs; dialogue + labels over 64px heads.
- Acceptance: leaf-m4.5 G0..G4 all met with evidence.
- Known issues / decisions: Arcade Body.setSize freezes scale at call time
  while offsets live-scale (verified in Phaser source) — sizes pre-scaled,
  offsets raw; static bodies never re-sync, so NPC feet pinned explicitly
  (dynamic player self-syncs; probe distinguishes both). Display 0.4 overrode
  metadata 1.5 hint after calibration (25.6px chars on 16px tiles). Probe
  self-bugs fixed along the way (seek/page params, arrival radii vs hedge
  and photographer bodies). RSVP/event/venue share one hijabi asset until
  more packs arrive (mission-allowed). MC registered, slotless, for later use.
- Next: M5 (Four Hearts + Finale) is READY. Stopping here per mission scope
  (do not start M5).
- Regression (§22) after M4.5, all on the final tree: M1 MOVEMENT VERIFIED,
  M2 TOUCH VERIFIED, M3 NPC VERIFIED (incl. Nadia rename maintenance),
  M4 BOOK VERIFIED (incl. deep links + dead-Phaser readability).
  No regressions. World build re-ran cleanly with production avatars intact
  (registry + 384×256 runtime sheets verified post-build).

## M4.6 — Production Environment / World Art Pipeline (VERIFIED 2026-09-07)

- Status: complete. leaf-m4.6 G0/G1/G2/G3 PASS via gate-checker with recorded
  evidence; G4 manual visual review done (9 stops at 390 + 3 widths + 3x
  closeup + live depth dump).
- Files changed: `packages/contracts/src/environment.ts` (registry/atlas/
  placement/alias Zod contracts), `tooling/assets/build-environment.mjs`
  (pack validate + runtime publish), `tooling/world-gen/terrain-v2.mjs`
  (deterministic piece router, rotation-safe junctions),
  `tooling/world-gen/gen-decor.mjs` (73 placements, footprint collision,
  slot/path/chapel guards), `tooling/world-gen/gen-map.mjs` (planLayout +
  pack-terrain paint + merged collision; procedural tiles retired),
  `tooling/world-gen/build-world.mjs` (env-first orchestration, placements
  artifact, manifest environment section),
  `packages/game/src/world/{types,loader}.ts` (placements in definition),
  `packages/game/src/scenes/PreloadScene.ts` (manifest-driven terrain/
  atlases/registry/placements loads), `packages/game/src/scenes/
  WeddingWorldScene.ts` (dynamic tileset, Y-sorted atlas objects, nav
  marker intact), `scripts/validate-environment.mjs`,
  `scripts/verify-m46-build.mjs`, `tooling/e2e/m46-world.mjs`,
  `docs/qa/m46-*.png`, `THIRD_PARTY_ASSETS.md` (pack provenance),
  `.unlazy/wedding-rpg-v1/**`. Pack sources untouched.
- Commands run: `node scripts/validate-environment.mjs` (ENVIRONMENT VALID:
  48 tiles, 58/83/10 assets, aliases, presets, chapel excluded, 73
  placements, self-test), `node scripts/verify-m46-build.mjs` (double-build
  hash match, pack tileset wired, atlases present, tsc, next build),
  `node tooling/e2e/m46-world.mjs` (traverse + photographer-block collision
  + book + 9-stop tour OK, transfer logged), gate-checker `--approve` on
  leaf-m4.6 (G0..G3 PASS).
- Tests: E2E traverse (2s progress + NPC-body block band), NPC count +
  player avatar, book open/close, nav marker set/clear (in m4 probe
  regression), placement guard negatives (interrupted builds failed loudly
  on path/slot violations during authoring: gate posts, table cluster,
  topiary cones/heart all relocated by the guard before first green build).
- Acceptance: mission G1..G9 covered (G5 collision via fountain/tree/hedge/
  gate footprints + photographer-block E2E; G6 all nine landmarks read
  distinctly; G7 widths reviewed; G8 regressions below; G9 double-build
  hashes).
- Payload (§34 measured): 22 files, 9256KB total; atlases 7.5MB dominate
  (foliage 2471 + decor 2429 + landmarks 2633KB). Single-stage preload kept
  for M4.6 correctness; staged loading deferred to M14 with this trigger.
  Animated water deferred (static shorelines verified).
- Known issues / decisions: display = registry recommended x 2/3 uniform
  (bench lands exactly in the 2-4 tile spec range); water diag-corner mapping
  was a first guess, verified correct in screenshots; photo terrace + carpets
  are ground-depth floors (depth 1, proven by live depth dump after a
  thumbnail misread); dirt micro-texture and grass tile edges visible only
  at 3x inspection zoom, coherent at play scale (watch-items, pack-revision
  material, not blocking); hall/event share the pavilion asset per registry
  alias (accepted repetition, flagged for a future distinct hall); wishing
  tree at 0.24 to fit the garden; RSVP/event/venue share one hijabi asset
  (unchanged from M4.5).
- Regression (§33) after M4.6, all on the final tree: M1 MOVEMENT VERIFIED,
  M2 TOUCH VERIFIED, M3 NPC VERIFIED, M4 BOOK VERIFIED (after re-routing one
  probe waypoint around the bigger production fountain — probe-only change),
  M4.5 AVATARS VERIFIED. No regressions.
- Next: M5 (Four Hearts + Finale) is READY. STOPPED per mission scope.
