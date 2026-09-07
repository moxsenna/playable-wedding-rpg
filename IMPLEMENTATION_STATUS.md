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
