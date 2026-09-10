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

## M5 — Collect Our Story + Wedding Finale (VERIFIED 2026-09-08)

- Status: complete. leaf-m5 G0/G1/G2/G3 PASS with recorded evidence; G4
  manual visual review done (320/390/430).
- Files changed: `packages/contracts/src/quest.ts` (quest/gate schemas,
  `collectOurStoryDefinition`), `packages/contracts/src/index.ts` (quest
  export), `packages/game/src/systems/quest/quest-controller.ts` (pure
  start/grant reducer, zero imports, wedding-agnostic),
  `packages/game/src/scenes/WeddingWorldScene.ts` (quest glue, per-frame
  semantic gate check, unlock marker, FINALE_STARTED),
  `packages/game/src/world/{types,loader}.ts` + `PreloadScene.ts` (gates
  artifact), `packages/game/src/{bridge,index}.ts` (5 quest events +
  controller exports), `apps/web/src/weddings/demo-bindings.ts` (greeter
  START_MAIN_QUEST, photographer OPEN_GALLERY+GRANT_HEART chain, grant
  nodes on story/travel/proposal, couple START_FINALE),
  `apps/web/src/components/{quest-hud,finale-reveal}.tsx` + `App.tsx` +
  `styles/globals.css` (HUD, toasts, banner, reveal),
  `tooling/world-gen/{gen-decor,build-world}.mjs` (FINALE_GATE const +
  gates.json source/runtime), `assets-source/tiled/garden-village-v1/
  gates.json` + `apps/web/public/assets/worlds/garden-village-v1/gates.json`,
  `scripts/verify-m5-{logic,build}.mjs`, `tooling/e2e/m5-quest.mjs`,
  `docs/qa/m5-*.png`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node tooling/world-gen/build-world.mjs` (73 placements,
  solid=497), `node scripts/verify-m5-logic.mjs` (M5 QUEST VERIFIED, 48
  assertions), `node scripts/verify-m5-build.mjs` (M5 BUILD VERIFIED:
  contracts + game + web tsc, next build), `node tooling/e2e/m5-quest.mjs`
  (M5 QUEST VERIFIED: locked 0/4, out-of-order grants, duplicate ignored,
  door walk-through, FINALE_STARTED x1, reveal readable).
- Tests: reducer (start-once, pre-start/unknown quest/heart rejection,
  out-of-order completion, duplicate no-op, missing tracking), binding
  coverage (4 hearts exactly once, greeter/photographer/couple chains),
  gate schema + locked tile, real-browser quest loop, no page errors.
- Acceptance: leaf-m5 G0..G4 all met with evidence.
- Known issues / decisions: game code resolves the gate from generated
  gates.json (no hardcoded tiles); quest state lives in Phaser, React
  mirrors for display; toasts/banners pointer-transparent; no audio, no
  new scene, no complex particles per scope.
- Next: M6 Single-Player Gate SP (node-sp integration + 320/360/390/430
  visual QA).

## M6 — Single-Player Gate SP (VERIFIED 2026-09-08)

- Status: complete. node-sp G0/G1/G2 PASS with recorded evidence; G3
  manual visual review done (320/360/390/430).
- Files changed: `.unlazy/wedding-rpg-v1/gates/node-sp.md`,
  `scripts/verify-sp-regressions.mjs` (20-step runner, --from/--to ranges),
  `tooling/e2e/sp-gate.mjs`, `tooling/e2e/m3-npc.mjs` + `m45-avatars.mjs`
  (probe-only: 4th Continue + book close for the M5 greeter misi node),
  `docs/qa/sp-*.png`, `.unlazy/wedding-rpg-v1/{PLAN,GATES}.md`.
- Commands run: `node scripts/verify-sp-regressions.mjs` in 5 ranged runs
  (1..13, 14..16, 17, 18..19, 20 — all SP REGRESSIONS VERIFIED),
  `node tooling/e2e/sp-gate.mjs` (SP GATE VERIFIED).
- Tests: full M1..M5 regression on the final tree (lint, forbidden
  patterns + self-test, world/avatar/environment validators, all logic
  oracles, all 7 browser probes, production build) + SP session (stick
  move, greeter quest start, book over live world, zero page errors).
- Acceptance: node-sp G0..G3 all met with evidence; root GATES G4 met.
- Known issues / decisions: M5 content change forced probe-only updates
  (no game-source change); HUD overlaps tree foliage slightly at top-left,
  readable; m45-avatars and m5-quest share port 8105, always run
  sequentially.
- Next: M7 Reusability (Raka & Naya + Arvin & Selena, zero game-source
  edits).

## M7 — Wedding Reusability (VERIFIED 2026-09-08)

- Status: complete. leaf-m7 G0/G1/G2/G3 PASS with recorded evidence; G4
  manual visual review done (390px x3).
- Files changed: `apps/web/src/weddings/{raka-naya,arvin-selena}.ts`
  (fixtures), `apps/web/src/weddings/select.ts` (?wedding= resolver),
  `apps/web/src/weddings/{demo-publication,demo-bindings}.ts` (active
  re-exports, import sites untouched), `scripts/verify-m7-{logic,build}.mjs`,
  `tooling/e2e/m7-weddings.mjs`, `docs/qa/m7-*-390.png`,
  `.unlazy/wedding-rpg-v1/**`. Zero edits under `packages/game` (git clean).
- Commands run: `node scripts/verify-m7-logic.mjs` (M7 WEDDINGS VERIFIED,
  247 assertions), `node scripts/verify-m7-build.mjs` (M7 BUILD VERIFIED),
  `node tooling/e2e/m7-weddings.mjs` (M7 WEDDINGS VERIFIED x3 weddings).
- Tests: per-wedding publication/bindings/quest-chain validation, distinct
  couples, game-source wedding-content scan, per-wedding browser quest
  smoke (book couple, greeter start, photographer heart, HUD).
- Acceptance: leaf-m7 G0..G4 all met with evidence; root GATES G5 met.
- Known issues / decisions: DEMO_* export names now mean "active wedding"
  (documented alias); player avatar stays the shared guest across weddings.
- Next: M8 Durable wedding core port (domain only, no scene gameplay).

## M8 — Durable Wedding Core (VERIFIED 2026-09-08)

- Status: complete. leaf-m8 G0/G1/G2 PASS with recorded evidence; G3
  manual API review done.
- Files changed: `packages/contracts/src/durable.ts` (guest/token/rsvp/
  guestbook/version/audit schemas) + index export,
  `packages/wedding-core/**` (guests, rsvp, guestbook, publishing, audit,
  index; package.json/tsconfig), `scripts/verify-m8-{logic,build}.mjs`,
  `.unlazy/wedding-rpg-v1/**`. No gameplay, no storage driver.
- Commands run: `node scripts/verify-m8-logic.mjs` (M8 CORE VERIFIED, 26
  assertions), `node scripts/verify-m8-build.mjs` (M8 BUILD VERIFIED: 4x
  tsc + next build).
- Tests: token register/lookup, RSVP create+upsert+negatives, guestbook
  bounds + link guard, draft/publish/activate/supersede/archive lifecycle
  over the real demo fixture, frozen snapshots, audit append.
- Acceptance: leaf-m8 G0..G3 all met with evidence.
- Known issues / decisions: token ids sequential per store (persistence
  arrives with M12); publishDraft takes no timestamp (transitions are
  status-only).
- Next: M9 Admin RPG config (World/NPC/Quest/Avatar/Realtime, no code
  editing).

## M9 — Admin RPG Config (VERIFIED 2026-09-08)

- Status: complete. leaf-m9 G0/G1/G2 PASS with recorded evidence; G3
  manual visual review done (390px).
- Files changed: `apps/web/src/pages/admin.tsx` (picker, editors, live
  validation, lifecycle dry-run, export, preview),
  `apps/web/{package.json,next.config.mjs}` (+@wedding-rpg/wedding-core),
  `apps/web/src/styles/globals.css` (admin section),
  `scripts/verify-m9-build.mjs`, `tooling/e2e/m9-admin.mjs`,
  `docs/qa/m9-admin-390.png`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node scripts/verify-m9-build.mjs` (M9 BUILD VERIFIED),
  `node tooling/e2e/m9-admin.mjs` (M9 ADMIN VERIFIED).
- Tests: fixture switch, edit/break/fix validation incl. draft/export
  locks, draft→publish→activate to v1, exported JSON shape + edit
  carried, zero page errors.
- Acceptance: leaf-m9 G0..G3 all met with evidence.
- Known issues / decisions: lifecycle is an in-memory dry-run (durable
  persistence arrives with M12); custom drafts preview via built-in links
  only; admin taps scroll into view (below-fold buttons).
- Next: M10 Realtime protocol (client net layer + interpolation).

## M10 — Realtime Protocol V1 (VERIFIED 2026-09-08)

- Status: complete. leaf-m10 G0/G1/G2/G3 PASS with recorded evidence;
  G4 manual visual review done (390px).
- Files changed: `packages/contracts/src/protocol.ts` (+ shared net
  schemas, index export), `packages/game/src/networking/{interpolation,
  remote-store,net-client}.ts` + index exports,
  `packages/game/src/scenes/WeddingWorldScene.ts` (opt-in ?net= wiring,
  remote sprites + tags + emote bubbles, emote forward, net debug),
  `tooling/realtime/local-relay.mjs` (M10-only test relay),
  `scripts/verify-m10-{logic,build}.mjs`, `tooling/e2e/m10-realtime.mjs`,
  `docs/qa/m10-duo-390.png`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node scripts/verify-m10-logic.mjs` (M10 PROTOCOL
  VERIFIED, 35 assertions), `node scripts/verify-m10-build.mjs` (M10
  BUILD VERIFIED), `node tooling/e2e/m10-realtime.mjs` (M10 REALTIME
  VERIFIED: 125px smooth remote travel, emote seen, drop on disconnect,
  quest starts online).
- Tests: envelope/payload bounds + allowlists, lerp/extrapolate/settle/
  stale-prune, move throttle + idle + emote limit + 3-strike close,
  §20 steps 1-9 in two real browsers, zero page errors.
- Acceptance: leaf-m10 G0..G4 all met with evidence; root GATES G6 met.
- Known issues / decisions: net is opt-in (?net= absent = pure
  single-player, zero behavior change); local relay trusts ?name=
  (production identity is server-canonical in M11); emote bubbles use
  text glyphs (no pictographic emoji).
- Next: M11 Cloudflare Durable Object wedding room.

## M11 — DO Wedding Room (VERIFIED 2026-09-08)

- Status: complete. leaf-m11 G0/G1/G2 PASS with recorded evidence; G3
  manual visual review done (390px).
- Files changed: `apps/realtime/{package.json,tsconfig.json,
  wrangler.jsonc,src/room.ts}` (Worker /room route + WeddingRoom DO),
  `scripts/verify-m11-build.mjs`, `tooling/e2e/m11-room.mjs`,
  `docs/qa/m11-duo-390.png`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node scripts/verify-m11-build.mjs` (M11 BUILD VERIFIED:
  realtime tsc + wrangler deploy --dry-run),
  `node tooling/e2e/m11-room.mjs` (M11 ROOM VERIFIED: 126px smooth DO
  remote travel, emote seen, drop on disconnect, quest online).
- Tests: §20 steps 1-9 against local workerd, zero page errors.
- Acceptance: leaf-m11 G0..G3 all met with evidence.
- Known issues / decisions: display names locally trusted from ?name=
  (server-canonical identity arrives with M12); roster is in-memory
  (hibernation-safe storage is M14 hardening); deploy itself is M13.
- Next: M12 Production data (Neon + R2 + immutable template publishing).

## M12 — Production Data (CODE GREEN, LIVE BLOCKED 2026-09-08)

- Status: code complete, live gates blocked on credentials. leaf-m12 G0/
  G1/G3 PASS; G2 BLOCKED.
- Files changed: `drizzle/schema.ts` (7 tables) + `drizzle.config.ts` +
  `drizzle/migrations/*` (offline-generated SQL),
  `tooling/publish/publish.mjs` (content-hashed immutable publisher,
  local + r2 drivers), `scripts/verify-m12-data.mjs`,
  `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node scripts/verify-m12-data.mjs` (M12 DATA VERIFIED,
  15 assertions).
- Blocked on: DATABASE_URL (Neon) for `drizzle-kit migrate`; Cloudflare
  login (`wrangler whoami` fails, expired token) for `wrangler r2 object
  put` via `--driver r2`.
- Next: M13 Deployment (BLOCKED, same login).

## M13 � Deployment (VERIFIED 2026-09-09)

- Status: live in production (VERIFIED 2026-09-09). API + realtime
  Workers deployed, web on Pages, R2 template v6 published, Neon migrated
  + seeded.
- Evidence (probed 2026-09-09, no secrets): api /health 200 {"ok":true};
  world-config pin garden-village-v1/v6/manifest.json; R2 v6 manifest via
  API proxy with pinned env base assets/environment/3ced0e5caac7/;
  realtime /health 200 "ok"; Pages 200, boots to scene-ready, quest HUD
  "OUR STORY ♡ ♡ ♡ ♡", zero page errors (docs/qa/prod-smoke-390.png).
- Full prod-smoke (`node tooling/e2e/prod-smoke.mjs`): PROD SMOKE VERIFIED
  2026-09-09 — world-config pin v6, R2 manifest pinned env base, session
  minted for Dinda (demo-ayu-bima), realtime welcome p_guest-dinda with
  canonical name, game boot + HUD + net joined, zero page errors.
- Remaining: production soak traffic.
- Next: M14 production soak.

## M14 — Hardening (VERIFIED LOCAL 2026-09-08; PROD SOAK 12/12 2026-09-09)

- Status: complete locally. leaf-m14 G0/G1 PASS; production soak needs
  M13. Soak done 2026-09-09: `node tooling/e2e/prod-soak.mjs` 12/12
  cycles boot+HUD ok, zero page errors (1 transient retry on cycle 8);
  boot times 26–86s via R2/API proxy path.
- Files changed: `tooling/e2e/m14-faults.mjs`,
  `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node tooling/e2e/m14-faults.mjs` (M14 HARDENED:
  offline full quest with dead relay, 20/20 load smoke, room source
  checklist clean, zero page errors).
- Known issues: local test relay has no strike engine by design (force-
  close proven on the DO room in M11); roster in-memory until M14-prod
  storage pass after deploy.
- Next: provision credentials → M12 G2 → M13 → production soak.

## M12.5 — Production Boundary Closure (VERIFIED 2026-09-08)

- Status: complete, no credentials needed. leaf-m12.5 G0..G4 PASS with
  recorded evidence. Closes the 5 production gaps: multi-tenant DB,
  server-canonical identity, API worker, full R2 uploads, hibernation-safe
  roster — plus project-scoped auth, integration tests, CI.
- Files changed: `drizzle/schema.ts` + regenerated `drizzle/migrations`
  (wedding_projects, wedding_world_configs, project_id FK + indexes on
  all tenant tables), `packages/contracts/src/{durable,protocol}.ts`
  (projectId on every durable shape; session-only hello),
  `packages/wedding-core/src/{guests,rsvp,guestbook,publishing,audit}.ts`
  (project-scoped) + `session.ts` (HMAC claims), `apps/api/**` (sessions,
  scoped rsvp/guestbook/publication, admin-key mutations, fail-closed
  dev-tokens endpoint), `apps/realtime/src/room.ts` (verifySession hello,
  attachment roster via getWebSockets, no ?name= trust),
  `packages/game/src/networking/net-client.ts` + scene (`connect(session)`
  via ?net=&session=), `tooling/{realtime/mint-session, e2e/mint-session,
  e2e/m125-integration}.mjs`, `tooling/publish/publish.mjs` (all-file R2
  loop + --dry-run plan), `scripts/verify-{m125-logic,m125-build,ci}.mjs`,
  `scripts/verify-m5-logic.mjs` (sibling-require fix),
  `tooling/e2e/{m10-realtime,m11-room,m14-faults}.mjs` (session flow),
  `.github/workflows/ci.yml`, `.unlazy/wedding-rpg-v1/**`.
- Commands run: `node scripts/verify-m125-logic.mjs` (M125 BOUNDARY
  VERIFIED, 19 assertions), `node scripts/verify-m125-build.mjs` (M125
  BUILD VERIFIED: 6x tsc + 2x dry-run), `node tooling/e2e/m10-realtime.mjs`
  + `m11-room.mjs` + `m14-faults.mjs` (all green on session flow),
  `node tooling/e2e/m125-integration.mjs` (M125 INTEGRATION VERIFIED:
  canonical welcome, impersonation/forged hello rejected, scoped rsvp,
  admin lifecycle), `node scripts/verify-ci.mjs` (CI SUBSET VERIFIED
  18/18), `node tooling/publish/publish.mjs garden-village-v1 --dry-run`.
- Tests: sign/verify/expire/tamper/wrong-secret/avatar-allowlist, cross-
  project rsvp rejection, per-project versioning, legacy hello rejection,
  forged-session close, sessionless 401, keyless-admin 401.
- Acceptance: leaf-m12.5 G0..G4 all met with evidence.
- Known issues / decisions: ADMIN_KEY + ROOM_SECRET travel as wrangler
  --var in probes (production sets real secrets); static web export kept,
  admin persistence via API worker; position ticks never touch Neon.
- Next: provision credentials → `drizzle-kit migrate` (first migration
  already on the correct schema) → R2 publish --driver r2 → deploy API +
  realtime + web → production soak.

## M12.6 — Production Persistence + Immutable Asset Closure (VERIFIED 2026-09-08)

- Status: complete. leaf-m12.6 G0..G4 PASS with recorded evidence. Neon is
  LIVE (migrated + seeded); R2/deploy still need Cloudflare login.
- Files changed: `packages/wedding-core/src/{store,memory}.ts` (NeonStore
  parameterized SQL + activateExclusive + neonHttpPool; explicit dev-only
  MemoryStore), `apps/api/src/api.ts` (Neon-first, 500 without DATABASE_URL
  unless DEV_MEMORY_STORE=1, dev guest-mint endpoint, SEED_JSON removed),
  `apps/api/wrangler.jsonc` (SEED_JSON dropped), `drizzle/schema.ts` +
  `drizzle/migrations/0001_*` (pubver_single_active partial unique index,
  applied live), `tooling/db/seed.mjs` (idempotent: 3 projects, 4 guests,
  3 configs, template v1), `tooling/publish/publish.mjs`
  (content-addressed environment@/avatars@ deps, pinned bases in version
  manifest, full upload loop incl. deps), `packages/game/src/scenes/
  PreloadScene.ts` (manifest-driven bases, legacy fallback in dev),
  `scripts/verify-{m126-logic,m126-build,m126-assets}.mjs`,
  `tooling/e2e/m126-neon.mjs`, `scripts/verify-ci.mjs` (21 steps),
  `scripts/verify-m12-data.mjs` (dep-pin assertions), `.unlazy/**`.
- Commands run: `drizzle-kit migrate` (0001 live), `node tooling/db/
  seed.mjs` x2 (4 then 0 new — idempotent), `node scripts/verify-m126-
  logic.mjs` (M126 STORE VERIFIED, 15), `node scripts/verify-m126-
  build.mjs` (M126 BUILD VERIFIED), `node tooling/e2e/m126-neon.mjs`
  (M126 NEON VERIFIED: live session/rsvp/guestbook round-trip, v1->v2
  single-active), `node scripts/verify-m126-assets.mjs` (M126 ASSETS
  VERIFIED, 13: 40 keys pinned), `node scripts/verify-ci.mjs` (21/21),
  `node tooling/e2e/m125-integration.mjs` + `m5-quest.mjs` (no regressions).
- Tests: parameterized-SQL proof, empty-activate throws (→409), no memory/
  seed in api source, memory single-active parity, forged/legacy hello
  still rejected, sessionless/keyless 401s hold.
- Acceptance: leaf-m12.6 G0..G4 all met with evidence.
- Known issues / decisions: DATABASE_URL travels as wrangler --var in
  probes (production binds a real secret); guests minted in dev carry
  gt_dev_ tokens; SEED_JSON gone from config (live guests come from Neon
  seed); env/avatar dep dirs dedupe by hash across versions.
- Next: Cloudflare login → R2 publish --driver r2 → deploy API + realtime
  + web → production soak.

## M12.7 — Deployment Readiness Closure (VERIFIED 2026-09-08)

- Status: complete. leaf-m12.7 G0..G3 PASS with recorded evidence.
  Closes the 3 audit gaps: atomic activation, pinned-manifest runtime,
  portable CI. No gameplay/asset/protocol/admin/schema changes beyond
  these three.
- Files changed: `packages/wedding-core/src/store.ts` (single-statement
  activateExclusive with target CTE), `packages/game/src/index.ts`
  (manifestUrl option + allowlist resolver) + `scenes/PreloadScene.ts`
  (registry manifest URL) + `scenes/WeddingWorldScene.ts` (forwards
  registry URL to loader), `apps/web/src/game/main.ts` (?manifest= /
  ?api&?wedding&?r2 bootstrap, local fallback) + `PhaserGame.tsx` (async
  StartGame), `apps/api/src/api.ts` (/v1/world-config public route),
  `tooling/resolve-wrangler.mjs` (workspace-local → PATH → legacy),
  `scripts/{verify-m11,m125,m126}-build.mjs` + `gate-lint-all.mjs` +
  `lint-ledger.mjs` (portable), `tooling/e2e/{m11-room,m125-integration,
  m126-neon}.mjs` (portable), `scripts/verify-m127-atomic.mjs`,
  `tooling/e2e/m127-manifest.mjs`, `scripts/verify-m126-logic.mjs`
  (single-statement assertions), `scripts/verify-ci.mjs` (22 steps),
  `.github/workflows/ci.yml` (workerd approval + chromium install),
  `.unlazy/**`.
- Commands run: `node scripts/verify-m127-atomic.mjs` (M127 ATOMIC
  VERIFIED, 6), `node tooling/e2e/m127-manifest.mjs` (M127 MANIFEST
  VERIFIED: default local, explicit pinned, invalid fallback),
  `node tooling/e2e/m126-neon.mjs` (M126 NEON VERIFIED + failed-activation
  leaves active intact), `node scripts/verify-ci.mjs` (CI SUBSET VERIFIED
  22/22), `m5/m10/m11/m125/m14` probes (no regressions).
- Tests: one-write proof, no-row throws, missing-version 404, draft-state
  400, active survives both failures; manifest allowlist rejects
  javascript: URLs; zero machine-specific paths remain in CI path.
- Acceptance: leaf-m12.7 G0..G3 all met with evidence.
- Known issues / decisions: ?manifest= allowlist is http(s)//absolute/
  assets-only; ?api+?r2 bootstrap is convention for production deploys
  (CDN base + API base passed at boot); wrangler resolves workspace-local
  first so CI never needs a global install.
- Next: Cloudflare login → R2 publish --driver r2 → set secrets → deploy
  API + realtime + web → production E2E → soak → GO.

## M16 — Production Wedding Operations & Runtime Data Binding (DELIVERED 2026-09-10)

- Status: complete. `.unlazy/m16/GATES.md` G0..G5 PASS with recorded
  evidence (logic, build, guest browser, admin browser, CI subset).
- Schema (drizzle `0002_m16_operations`, additive, non-destructive):
  `wedding_projects` + slug/created_at/updated_at,
  `guests` + phone/email/group_name/notes,
  new `analytics_events` + `preview_tokens` (project-scoped indexes).
- Contracts (`packages/contracts/src/m16.ts`): project create/update +
  slugify, guest import rows, analytics allowlist (movement ticks rejected),
  bootstrap response shape.
- Core (`packages/wedding-core`): `csv.ts` parser (BOM, header aliases,
  quoted commas, blank rows, intra-file dupe skip, missing-name reject),
  `tokens.ts` crypto-random `gt_` + `pv_` mints, `analytics.ts`
  validation + summary, `projects.ts` slug + archived→live guard.
  `NeonStore`/`MemoryStore` extended: projects, guests, import,
  analytics, preview tokens. All SQL parameterized.
- API (`apps/api/src/api.ts`): `GET /v1/guest/:token` bootstrap
  (guest/project/publication/world/realtime, 404/410, analytics-safe),
  `GET /v1/preview/:token`, `POST /v1/analytics` (server resolves
  project from session/token, never client input),
  `/v1/admin/projects` list/create/PATCH (slug-taken 409,
  archived→live 400), `/v1/admin/guests` list/create/PATCH/DELETE,
  `/v1/admin/guests/import` (csv or rows, created/skipped/rejected),
  `/v1/admin/guest-links`, `/v1/admin/versions`, `/v1/admin/preview`,
  `/v1/admin/analytics` summary. Existing draft/publish/activate,
  atomic activation, and session/RSVP/guestbook routes untouched.
- Web: `src/weddings/runtime.ts` bootstrap hook + api-base resolver,
  `src/game/main.ts` fetches bindings/publication from bootstrap
  (fixture fallback) and auto-mints session + `?net=` unless `?rt=0`,
  `wedding-book.tsx` reads runtime publication (fixture only as fallback),
  `src/pages/g/[token].tsx` clean guest URL with invalid/archived/
  no-publication states and no technical leaks,
  `src/pages/admin.tsx` keeps the M9 fixture editor green and adds
  server sections (key, projects, guests + filter, CSV import with
  preview counts, links export, analytics).
- Tests: `scripts/verify-m16-logic.mjs` (417 assertions: CSV incl.
  50-guest, 200 unique tokens, analytics negatives, slug/transitions),
  `scripts/verify-m16-build.mjs` (4x tsc + web build),
  `tooling/e2e/m16-guest.mjs` (invalid token UX, no leaks, home boots),
  `tooling/e2e/m16-admin.mjs` (server sections + M9 lifecycle v1 active,
  no horizontal overflow). `scripts/verify-ci.mjs` 22/22 green.
- Operator workflow: Admin Key → Muat Weddings → pilih wedding →
  Tambah/Import tamu → edit config → Simpan Draft → Publish → Aktifkan →
  Export Links → bagikan `/g/:token`.
  Guest workflow: buka `/g/:token` → session → onboarding → taman →
  cerita → finale → Undangan → wish.
- Non-blocking: live Neon/R2 deploy + 50-guest golden against production
  still need operator credentials (dev-memory + local probes green);
  preview tokens need a cleanup cron eventually; analytics is minimal
  counts (no funnels yet).

## M16.1 — Hardening Closure (DELIVERED 2026-09-10)

- Status: complete. `.unlazy/m161/GATES.md` G0..G5 PASS with recorded
  evidence. Closes the four review gaps on top of 72f0fe9, no game
  content or protocol changes.
- Atomic slug (`0003_m161_slug_unique`, backfill `slug=id` before the
  index): `wedding_projects.slug` is UNIQUE at the DB level; the store
  maps unique violations to `slug-taken`/`token-taken` instead of the
  legacy-column fallback, the API answers slug conflicts with 409 and
  retries token races server-side.
- No fixture fallback: guest paths (`/g/`, `?guest=`) resolve through a
  single-flight `fetchBootstrap` into loading/ready/error states; a
  failed or content-less bootstrap renders a safe error, never
  DEMO content. Fixture data remains only for the keyless dev home path.
  Draft projects are explicitly rejected from guest bootstrap (403);
  archived stays 410.
- Single bootstrap: `GET /v1/guest/:token` now also mints and returns
  the realtime session plus room membership, so one call yields guest,
  project, session, publication, world, and realtime. Session and net
  URL reach the game via injected memory; `?net=`/`?session=` remain as
  dev/probe fallback and the clean guest URL gains no params.
- Server admin lifecycle: with Admin Key + project set, Simpan
  Draft/Publish/Aktifkan run against `/v1/admin/*` with the server
  version list displayed; keyless use keeps the local dry-run editor
  (M9/M16 probes green).
- Tests: `verify-m161-slug` (11), `verify-m161-guards` (26),
  `m161-guest` (exactly one bootstrap call, no URL plumbing, no
  fixture leak), `m161-admin` (server wiring + keyless v1 active),
  `m16-guest`/`m16-admin` re-green, `verify-m161-regression`
  (5x tsc + M16 logic + CI 22/22).
- Remaining: live Neon/R2 golden (50 guests, 3 weddings) still needs
  operator credentials; preview end-to-end and operator-console IA
  stay queued behind that verification.

## YUTEMU Rebrand (DELIVERED 2026-09-10)

- Status: complete. `.unlazy/rebrand/GATES.md` G0..G5 PASS with recorded
  evidence. Presentation layer only: no gameplay, protocol, schema,
  quest, NPC, or domain-model changes.
- Assets (`apps/web/public/brand/`): Y-gateway mark in the approved
  peach→violet direction. Production icons (192/512/180/ICO) are
  exports of the supplied tile master `docs/favicon.webp`; the in-app
  mark (`logo/yutemu-mark.webp`) is exported from the supplied glow
  master `docs/logo-glow.webp`. Heavy supplied PNGs were replaced by
  ≤1024px WebP masters (864KB→139KB, 1.3MB→16KB). New
  `manifest.webmanifest` (YUTEMU, portrait, twilight theme).
- Shell: central `apps/web/src/config/brand.ts`; YUTEMU boot splash,
  loading screen, onboarding mark, Wedding Book identity tag,
  YUTEMU-toned fallback copy, `YUTEMU Studio` admin, twilight design
  tokens in `globals.css` (restrained gradients, system font stacks).
- Preserved verbatim: `OUR STORY` HUD, `Undangan` label, fixture couple
  and venue names, invalid-guest copy, keyless `(dry-run)` label,
  package names, migrations, API contracts, storage keys.
- Collateral fix: `finale-reveal` now reads the runtime publication
  instead of the demo fixture (dev behavior identical, M5 green);
  M4-D's dead-game kill switch extended to the pinned R2 asset paths
  (it could no longer kill the game after M13 went live).
- Tests: `BRAND ICONS VERIFIED`, `BRAND VERIFIED (31)`,
  `BRAND BROWSER VERIFIED` (390 + 1167 desktop, no overflow),
  `M161 GUEST VERIFIED`, `M4 BOOK VERIFIED`, `M5 QUEST VERIFIED`,
  `CI SUBSET VERIFIED (22/22)`.
- "User-facing product branding is now YUTEMU."

## M17 — Wedding Production Studio (DELIVERED 2026-09-10)

- Status: complete credential-free. `.unlazy/m17/GATES.md` G0..G8 PASS
  with recorded evidence; live golden (Neon) correctly BLOCKED pending
  operator credentials — never faked.
- G1 envelope: additive `{publication, npcBindings}` snapshot
  (`contracts/snapshot.ts`, `wedding-core/snapshots.ts`); draft/publish
  validate both parts separately; legacy bare snapshots keep reading;
  `M17 ENVELOPE VERIFIED` (18 unit) + browser quest→finale from a
  server-published envelope with renamed couple (no fixture).
- G2/G3 Studio editor: server-backed Couple/Events/Venues/Story/
  Gallery/Gift/Options sections + 10 NPC cards (name/avatar/role/
  dialogue/action/speaker) + heart assignment + slot swap, all pure
  helpers unit-tested (`M17 NPC VERIFIED` 16); project create UI;
  `M17 STUDIO VERIFIED` (create→edit→draft→publish→activate→preview
  token→reload persistence) against a live worker.
- G4 world+avatars: additive `project_avatar_pool` migration (0004);
  template catalog + world-config + avatar-pool admin routes; pool
  enforced at session mint (unknown avatar → 403); `M17 WORLD
  VERIFIED` (14, incl. URL-injection rejection).
- G5 preview: `/g/preview/<token>` plays draft data through the same
  runtime with badge, never activates; `M17 PREVIEW VERIFIED`
  (production stays 404 throughout).
- G6 publish+links: per-guest Copy (clipboard-verified), CSV export
  without secrets, active-version display; `M17 PUBLISH VERIFIED`.
- G7 isolation: 3-wedding + 50-guest golden, cross-project attacks
  rejected, pools/configs isolated; `M17 ISOLATION VERIFIED` (22).
- Contract additions (all optional/backward compatible): couple
  photo/nickname/bio, gallery cover (max 1), gift ewallet/registry.
  No upload endpoint (URL refs; upload documented as next infra).
- Collateral: nested-route asset URLs made root-absolute (guest boot
  under `/g/:token` was resolving `assets/…` relatively — found by the
  G1 E2E); M4-D kill switch extended to pinned R2 paths; m15 boots the
  local manifest (R2 v6 predates `gate.entry`); m127 accepts the
  intended pinned default.
- Open production ops (need credentials): publish template v7
  (`node tooling/publish/publish.mjs garden-village-v1 --driver r2
  --bucket wedding-templates`) then advance the pin
  (`DATABASE_URL=… node tooling/db/seed.mjs`); live 50-guest golden
  (`DATABASE_URL=… node tooling/e2e/m126-neon.mjs` + Studio publish
  flow against production).

## M17.1 — R2 Wedding Media Pipeline (DELIVERED 2026-09-10)

- Status: complete. `.unlazy/m171/GATES.md` G0..G4 PASS with recorded
  evidence. Gallery shape `[{src, alt}]` unchanged; photos now live in
  project-scoped R2 instead of URL-only strings.
- Infra: new `yutemu-wedding-media` bucket, `MEDIA` binding on the API
  worker, bucket CORS locked to the two Studio origins (PUT only).
- API (`apps/api/src/media.ts` + routes): `POST
  /v1/admin/media/upload-url` (ADMIN_KEY, MIME allowlist jpeg/png/webp,
  ≤5MB, server-minted `weddings/{project}/gallery/{uuid}.webp`) returns
  presigned PUT (10-min TTL, pinned Content-Type) when R2 S3 secrets
  exist, else a real proxied-upload mode; `POST .../media/upload`
  stores bytes via binding; `POST .../media/complete` enforces size;
  `GET /v1/media/<key>` serves immutable bytes; `DELETE
  /v1/admin/media` returns 409 when the key is referenced by the
  active publication. Fixed API CORS to allow PUT/PATCH/DELETE (this
  was also silently breaking cross-origin guest/project mutations).
- Studio: gallery upload (client WebP ≤1920px), thumbnails, reorder,
  cover, delete with active-reference guard surfacing.
- Tests: `R2 MEDIA VERIFIED` (7, incl. live bucket+CORS readback),
  `MEDIA API VERIFIED` (31, both upload modes, isolation, delete
  protection), `STUDIO MEDIA VERIFIED` (browser upload→draft→publish→
  activate→blocked delete), `M171 REGRESSION VERIFIED`.
- Operator steps for presigned direct upload: create an R2 API token
  (dashboard R2 → Manage R2 API tokens, Object Read & Write on
  `yutemu-wedding-media`), then `wrangler secret put R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` on `wedding-rpg-api`.
  Until then the proxied mode serves uploads with zero extra setup.
- 2026-09-10: S3 secrets installed, API redeployed, live presigned
  cycle verified (intent → direct PUT 200 → serve 200 → complete →
  delete → 404, test object removed).


