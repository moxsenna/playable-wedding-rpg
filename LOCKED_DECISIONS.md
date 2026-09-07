# Locked Decisions — RPG Rewrite

These decisions are frozen for V1 unless the product owner explicitly changes them.

## D-001 Product Category
The product is a **portrait-first social wedding RPG**, not a sequence of interactive web cards.

## D-002 Greenfield Folder
The new implementation is created in `pixel new`. The old implementation remains intact in `pixel old` for migration reference.

## D-003 Game Engine
Phaser 4 is the runtime game engine.

Do not use Godot, Unity, Kaboom, KAPLAY, Pixi-only, or a custom DOM game engine for V1.

## D-004 Map Authoring
Maps are authored in Tiled and loaded as data/assets by Phaser.

No hard-coded map drawn with JSX/CSS.

## D-005 Orientation
Portrait mobile is canonical.

Target:
- CSS viewport: 360–430 px wide
- logical reference viewport: 360 × 640
- responsive scaling preserving playable visibility

Landscape is fallback, not primary design.

## D-006 World Model
V1 uses one persistent top-down overworld per wedding template.

Wedding information is discoverable through NPCs and always reachable immediately through Wedding Book UI.

## D-007 Player Input
Mobile:
- virtual analog joystick
- contextual `Interact` button
- compact `Emote` control

Desktop:
- WASD / arrows
- E / Space interact

## D-008 Guest-to-Guest Interaction
V1 supports:
- live presence
- remote movement
- nametags
- predefined emotes

V1 does NOT support:
- free-text realtime chat
- voice
- collision between guests
- trading
- combat

## D-009 Multiplayer Authority
One Cloudflare Durable Object is the realtime room authority per wedding world/room key.

The Durable Object is not the primary relational database.

## D-010 Persistent Database
Neon PostgreSQL stores:
- projects
- publications
- guests
- RSVP
- wedding configuration
- NPC content
- world/template references
- guestbook
- admin data

## D-011 Ephemeral Realtime State
Durable Object owns:
- connected sessions
- player position
- facing
- movement state
- current map
- emote state
- realtime connection metadata

Do not persist every movement tick to PostgreSQL.

## D-012 Wedding Book
Canonical wedding information must never be locked behind gameplay.

Wedding Book provides:
- couple
- schedule
- venue/maps
- dress code
- gallery
- RSVP
- gift
- story summary

## D-013 Quest Gate
Gameplay may gate optional rewards/finale only.

Gameplay may not gate essential wedding information or RSVP.

## D-014 World Template Reuse
Client weddings are instances of reusable world templates.

No client-specific code branches.

## D-015 Collision
Remote guests have no collision with each other.

Environment collision comes from published map collision data.

## D-016 Network Rate
Local simulation renders at display refresh rate.

Movement snapshots target ~10 Hz by default and are interpolated remotely.

## D-017 Phaser vs React Boundary
Phaser owns:
- world
- player
- NPCs
- map
- collision
- camera
- world interactions
- in-world effects

React/DOM owns:
- Wedding Book
- RSVP
- gallery modal
- gift UI
- guestbook text input
- admin
- accessibility/direct fallback

## D-018 Map Size
V1 Garden Village target:
- around 56 × 80 tiles
- 16 × 16 source tiles
- orthogonal top-down

## D-019 V1 World
Initial template key: `garden-village-v1`

## D-020 V1 Main Quest
`Collect Our Story`

Player collects four Heart Memories, then unlocks Wedding Hall finale.

## D-021 No Godot/Unity Runtime
Agent access to Godot/Unity is irrelevant to V1 unless explicitly approved later.

Preferred tooling:
- Tiled
- Phaser Editor if useful
- sprite/pixel-art tooling
- Playwright
- Cloudflare tooling

## D-022 Old Platform Reuse
Migrate durable domain concepts from old project where useful.

Do not migrate old scene-based gameplay architecture.
