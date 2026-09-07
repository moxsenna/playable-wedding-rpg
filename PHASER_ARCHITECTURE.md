# PHASER_ARCHITECTURE.md

## 1. Goal

Replace React scene-by-scene gameplay with a real persistent Phaser world while preserving React for web-native product surfaces.

## 2. Target Project Boundary

```text
apps/web
  Next.js / React
  ├── public wedding route
  ├── Phaser mount
  ├── Wedding Book
  ├── RSVP
  ├── Gallery
  ├── Guestbook
  └── Admin

packages/game
  Phaser runtime
  ├── boot
  ├── world
  ├── actors
  ├── systems
  ├── input
  ├── interactions
  ├── networking
  └── assets

apps/realtime
  Cloudflare Worker
  └── WeddingRoom Durable Object

packages/contracts
  Zod + TS
  ├── public wedding DTO
  ├── world config
  ├── realtime protocol
  └── admin config

packages/wedding-core
  portable durable domain code
```

## 3. Phaser Lifecycle

React creates one game host element.

Conceptual API:

```ts
mountWeddingGame({
  parent,
  publication,
  guestContext,
  eventBus,
  realtimeClient,
});
```

Return:
```ts
{ destroy(): void }
```

Destroy Phaser instance on React unmount.
Never create multiple Phaser.Game instances because of rerenders.

## 4. Phaser Scene Model

Internal engine scenes:

```text
BootScene
PreloadScene
WeddingWorldScene
```

Optional:
```text
DebugScene
```

These are engine lifecycle scenes, NOT narrative chapters.

### BootScene
- scale/input prerequisites
- minimal setup

### PreloadScene
- world manifest
- critical tile assets
- player atlas
- spawn-area NPCs
- progress events to React

### WeddingWorldScene
- persistent map
- player
- NPCs
- collision
- camera
- interactions
- quest
- remote players

Forbidden narrative scene architecture:
```text
FirstEncounterScene
RoadtripScene
ProposalScene
...
```

Wedding memories are content inside one persistent world.

## 5. Phaser Configuration

Conceptual only; exact syntax must match installed Phaser 4:

```ts
const config = {
  type: Phaser.AUTO,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
};
```

Do not copy Phaser 3 snippets blindly.

## 6. Rendering / Coordinate Boundary

World coordinates belong to Phaser.

Preferred V1 split:
- Phaser canvas: world, actors, camera, joystick/interact/emote
- React DOM: Wedding Book, RSVP, Gallery, Gift, Guestbook, admin

If joystick is implemented as DOM instead, create one typed input adapter and document it. Do not mix ad-hoc coordinate math.

## 7. Tiled Loader

One typed loader must:

1. fetch world manifest
2. validate template/version
3. load `.tmj`
4. resolve tilesets
5. create visual layers
6. build collision layer
7. parse object layers
8. validate required slot IDs
9. build `WorldDefinition`

Do not scatter string lookups for Tiled object names throughout actors.

## 8. World Definition

Conceptual:

```ts
type WorldDefinition = {
  templateKey: string;
  version: number;
  spawns: Record<string, Point>;
  npcSlots: Record<string, NpcSlot>;
  landmarks: Record<string, LandmarkZone>;
  interactions: InteractionZone[];
};
```

Parsing happens once.

## 9. Actor Model

Concepts:

```text
Actor
├── LocalPlayer
├── RemotePlayer
└── NpcActor
```

Prefer composition to deep inheritance.

Shared systems may include:
- animation
- interaction
- nametag
- network transform
- depth sorting

## 10. Local Player Controller

Responsibilities:
- consume unified input
- normalize vector
- set Arcade Physics velocity
- collide with environment
- update facing
- update animation
- evaluate nearby interactable
- feed movement snapshot throttler

Networking never directly drives local movement.

## 11. Remote Player Controller

Remote player:
- no collision with local/remote guests
- snapshot buffer
- interpolation
- network-derived animation state
- destroy/hide on leave

Remote transform can never overwrite local player.

## 12. NPC System

Spawn formula:

```text
published NPC binding
+
Tiled NPC slot
+
avatar definition
=
NpcActor
```

NPC implementation must not contain couple-specific dialogue.

Semantic actions:

```text
OPEN_DIALOGUE
OPEN_RSVP
OPEN_GALLERY
OPEN_WEDDING_BOOK_SECTION
OPEN_MAPS
GRANT_HEART
START_MAIN_QUEST
START_FINALE
```

No arbitrary executable scripts from admin content.

## 13. React ↔ Phaser Event Bridge

Phaser → React:

```text
GAME_READY
GAME_LOADING_PROGRESS
OPEN_WEDDING_BOOK
OPEN_RSVP
OPEN_GALLERY
OPEN_GUESTBOOK
OPEN_MAPS
WORLD_ERROR
```

React → Phaser:

```text
MODAL_OPENED
MODAL_CLOSED
RSVP_UPDATED
NAVIGATE_TO_LANDMARK
AUDIO_PREFERENCE_CHANGED
PUBLICATION_CONTEXT_UPDATED
```

Use shared typed contract.
Do not use random global event strings.

## 14. Input Suspension

When React modal opens:
- movement disabled
- joystick reset
- Interact disabled
- local network movement transitions to idle

Resume cleanly on close.

## 15. Camera

Requirements:
- bounds = map/world
- follow local player
- round pixels
- lerp/deadzone
- responsive resize
- optional directional look-ahead
- no subpixel visual blur

Camera tuning belongs in config, not scattered magic numbers.

## 16. Asset Loading

Classify:

```text
critical
nearby
deferred
```

Critical:
- map
- critical tileset/atlas
- local avatar
- spawn-area NPCs

Deferred:
- distant NPCs
- optional FX

Gallery media belongs to React and must not block world load.

## 17. Avatar System

V1 uses stable avatar presets.

```ts
type AvatarDefinition = {
  id: string;
  atlasKey: string;
  frameMap: AnimationFrameMap;
};
```

Future modular avatars may compose body/hair/outfit/accessory.
Do not block V1 on avatar creator.

## 18. Published World Config

```ts
type PublishedWorldConfig = {
  worldTemplateKey: "garden-village-v1";
  worldTemplateVersion: number;
  npcBindings: NpcBinding[];
  finale: FinaleConfig;
  theme: WorldThemeConfig;
  realtime: RealtimeRoomConfig;
};
```

Publication pins versioned immutable world references.

## 19. Physics

Use Phaser Arcade Physics for:
- local player/environment collision
- trigger overlaps where useful

Do not add Matter/Rapier unless a later mechanic genuinely requires them.

## 20. Performance Rules

Initial targets:
- stable gameplay on reasonable mid-range phones
- no React rerender per Phaser frame
- remote render cap ~15–20 initially
- sprite atlases
- avoid thousands of animated objects
- no whole-world server simulation

Measure before optimizing.

## 21. Debug Tooling

Dev-only overlay:
- FPS
- x/y
- current landmark
- current interaction
- socket state
- remote count
- network send rate
- collision debug toggle

Never visibly ship debug HUD in production.

## 22. Testing

Unit:
- map parser
- movement normalization
- interaction selection
- quest reducer
- interpolation
- protocol schemas

Integration:
- map loads
- collision works
- NPC slots spawn

Browser:
- joystick
- keyboard
- interaction
- Wedding Book bridge
- RSVP bridge

Multiplayer:
- two contexts join
- see each other
- move
- emote
- disconnect

## 23. Forbidden Old Pattern

Do not recreate:
```text
currentSceneIndex
next narrative React component
hotspot buttons over static stage
one React component per chapter
```
