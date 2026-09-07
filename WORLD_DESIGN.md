# WORLD_DESIGN.md
## Garden Village V1

## 1. World Goal

The world must communicate within the first 10 seconds:

1. the guest is inside a real game world,
2. the wedding is the purpose of the world,
3. the guest can immediately access formal information if they do not want to explore.

The world should feel like a small cozy RPG village designed around a wedding celebration.

It must NOT feel like:
- a generic fantasy RPG with wedding text pasted on top,
- a maze,
- a large empty map,
- a platformer,
- a series of web cards disguised as a map.

## 2. Camera / Orientation Model

Reference logical viewport:

```text
360 × 640
```

World reference direction:

```text
NORTH = Wedding Hall / Finale
SOUTH = Entrance / Guest Spawn
```

The world is deliberately vertically legible on portrait screens.

Important destinations are distributed mostly along a north–south spine with short east/west branches.

## 3. World Topology

```text
                             NORTH
                               ▲

                      ┌─────────────────┐
                      │  WEDDING HALL   │
                      │  Couple Finale  │
                      └────────┬────────┘
                               │
                      ┌────────┴────────┐
                      │  COUPLE GARDEN │
                      │ / Wishing Tree │
                      └────────┬────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                │                 │
      ┌───────▼────────┐  ┌────▼─────┐  ┌──────▼─────────┐
      │ MEMORY GARDEN  │  │  PLAZA   │  │ EVENT PAVILION│
      │ Story Keeper   │  │ landmark │  │ Coordinator   │
      │ Travel Friend  │  │ fountain │  │ Venue Guide   │
      └───────┬────────┘  └────┬─────┘  └──────┬─────────┘
              │                │                 │
              │        ┌───────▼────────┐        │
              └────────│ PHOTO TERRACE  │────────┘
                       │ Photographer   │
                       └───────┬────────┘
                               │
                      ┌────────▼────────┐
                      │ RSVP PAVILION  │
                      │ RSVP Keeper    │
                      └────────┬────────┘
                               │
                      ┌────────▼────────┐
                      │ ENTRANCE GATE  │
                      │ Greeter / Spawn│
                      └─────────────────┘

                               ▼
                             SOUTH
```

## 4. Traversal Time Budget

| Route | Target |
|---|---:|
| Spawn → Greeter | 1–3 sec |
| Spawn → RSVP Keeper | < 8 sec |
| Spawn → Main Plaza | 10–15 sec |
| Main Plaza → any side landmark | 5–10 sec |
| Main Plaza → Wedding Hall gate | 8–12 sec |
| Cross-map practical maximum | < 30 sec |

No meaningful destination should require wandering for one minute.

## 5. Tile Specification

Reference:
- orthogonal map
- 16×16 source tile
- integer pixel rendering
- nearest-neighbor sampling
- no texture smoothing for pixel assets

Suggested source map:
- width ≈ 56 tiles
- height ≈ 80 tiles

World source dimensions:
```text
896 × 1280
```

Rendering scale is controlled by Phaser camera/game scale, not by redrawing map data.

## 6. Required Tiled Layers

Layer names are contractually significant.

```text
00_Ground
01_Ground_Detail
02_Paths
03_Water
04_Building_Base
05_Decoration_Below
06_Collision
07_Interaction_Zones
08_NPC_Slots
09_Spawn_Points
10_Landmark_Zones
11_Decoration_Above
12_Roof_Above
13_Ambient_FX
14_Debug_Metadata
```

### 00_Ground
Walkable terrain.

### 01_Ground_Detail
Flowers, grass variation, ground texture. No collision.

### 02_Paths
Strong navigational paths guiding player toward important areas.

### 03_Water
Decorative/blocked water.

### 04_Building_Base
Lower building layers behind actors.

### 05_Decoration_Below
Objects below actor feet.

### 06_Collision
Invisible logical collision layer.
Collision must not be inferred only from decorative appearance.

### 07_Interaction_Zones
Tiled object layer for:
- doors
- finale gate
- photo zone
- wishing tree
- tutorial zone

### 08_NPC_Slots
Named Tiled object slots.

### 09_Spawn_Points
Named spawn points.

### 10_Landmark_Zones
Logical area labels used by navigation and analytics.

### 11_Decoration_Above
Canopies, arches, signs above actors.

### 12_Roof_Above
Optional overhead structures.

### 13_Ambient_FX
Anchor points for particles/fireflies/leaves.

### 14_Debug_Metadata
Editor-only metadata. Production gameplay must not depend on it.

## 7. Required NPC Slot Names

```text
npc.greeter
npc.rsvp_keeper
npc.story_keeper
npc.photographer
npc.travel_friend
npc.event_coordinator
npc.venue_guide
npc.proposal_friend
npc.couple_a
npc.couple_b
```

Optional:

```text
npc.decorative.01
npc.decorative.02
npc.decorative.03
npc.decorative.04
npc.decorative.05
```

NPC slot determines placement.
Wedding instance determines content and character skin.

## 8. Required Spawn Points

```text
spawn.default
spawn.returning
spawn.wedding_hall
spawn.preview
```

`spawn.default` must be near Greeter without overlapping interaction radius.

## 9. Landmark IDs

```text
landmark.entrance
landmark.rsvp
landmark.photo
landmark.main_plaza
landmark.memory_garden
landmark.event_pavilion
landmark.couple_garden
landmark.wedding_hall
```

Used by:
- Wedding Book navigation hints
- quest markers
- analytics
- admin preview

## 10. Collision Rules

Player collides with:
- water bounds
- walls
- tree trunks
- closed gates
- building geometry
- selected decoration

Player does NOT collide with:
- remote guests
- particles
- quest markers
- decorative flowers
- grass

NPCs should use small bodies/interaction zones and never create narrow traps.

Required route width:
- 3 source tiles preferred
- never below 2 source tiles on mandatory routes

## 11. NPC Interaction Geometry

NPC consists of:
```text
visual sprite
+
optional small physics body
+
interaction radius/zone
```

Recommended interaction radius:
- ~36–56 rendered world pixels depending on scale

Inside range:
- contextual Interact activates
- NPC gets subtle marker/highlight

## 12. Wedding Hall Gate

States:
```text
LOCKED
UNLOCKED
```

Locked:
- finale inaccessible
- gate explains four-heart requirement

Unlocked:
- after four Heart Memories
- gate animation/transition
- finale accessible

Wedding Book remains available in both states.

## 13. Navigation Aids

V1 does not require minimap.

Use:
- strong paths
- landmark silhouettes
- signs
- quest arrow
- optional distance
- Wedding Book → `Show in World`

Flow:
```text
select destination
↓
close Wedding Book
↓
navigation pointer appears
↓
clear when player enters target landmark
```

## 14. Camera Specification

Camera:
- follows local player
- clamped to world bounds
- `roundPixels`
- mild lerp
- small deadzone
- optional directional look-ahead

Reference tuning:
```text
followLerpX ≈ 0.14
followLerpY ≈ 0.14
```

Player should appear around 55–60% down from top where world bounds permit.

Avoid:
- aggressive shake
- large zoom jumps
- laggy camera feel

## 15. Depth / Y Sorting

Top-down actors use Y-based depth sorting:

```text
actor.depth = baseActorDepth + actor.y
```

Overhead tile layers remain explicitly above actors.

## 16. Ambient World

Allowed:
- water animation
- flowers
- leaves
- fireflies
- fountain
- birds
- idle NPCs
- wedding decorations

Ambient FX require reduced-motion fallback.

## 17. World Asset Pack

```text
worlds/garden-village-v1/
├── map.tmj
├── tileset-ground.tsj
├── tileset-buildings.tsj
├── tileset-decor.tsj
├── tileset-wedding.tsj
├── atlas-world.png
├── atlas-world.json
└── manifest.json
```

One manifest enumerates immutable dependencies.

## 18. Map Publish Validation

A map cannot publish unless validation confirms:

- all required layers exist
- all required NPC slots exist
- all required spawn points exist
- required landmark zones exist
- spawn not inside collision
- required destinations reachable
- wedding hall gate zone exists
- no duplicate reserved IDs
- referenced tilesets/assets exist
- dimensions under configured budget

Optional advanced validation:
- pathfinding reachability from spawn to all required landmarks
