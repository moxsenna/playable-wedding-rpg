# ADMIN_RPG_CONFIG.md

## 1. Goal

Internal operator configures a wedding RPG instance without touching code or Tiled for normal client orders.

Operators select a published world template and bind wedding-specific content/assets into predefined slots.

## 2. Admin Wedding Sections

Retain:
```text
Overview
Couple
Events
Story
Theme
Media
Guests
RSVP
Guestbook
Preview
Publish
```

Replace old scene editor with:
```text
World
NPCs
Quest
Avatars
Realtime
```

## 3. World Section

Fields:
```text
World Template
  garden-village-v1

World Template Version
  pinned immutable version

Ambient Preset
  garden-day
  garden-golden-hour
  garden-evening

World Music
  media ref

Finale Theme
  garden-arch
```

Normal operator cannot edit raw map geometry.

## 4. NPC Bindings

Admin gets slot cards from world-template manifest:

```text
Greeter
RSVP Keeper
Story Keeper
Photographer
Travel Friend
Event Coordinator
Venue Guide
Proposal Friend
Partner A
Partner B
```

Each form:
```text
Enabled
Display Name
Avatar Preset
Dialogue
Wedding Book Action
Quest Reward
Optional Portrait
```

Reserved slot IDs cannot be renamed.

## 5. Dialogue Editor

Structured data only.

Example:

```json
[
  {
    "id": "hello",
    "speaker": "Maya",
    "text": "Dinda! Akhirnya datang juga.",
    "next": "quest_intro"
  },
  {
    "id": "quest_intro",
    "speaker": "Maya",
    "text": "Ada empat kenangan yang tersebar di village.",
    "action": "START_MAIN_QUEST"
  }
]
```

Allowed semantic actions are allowlisted.

No arbitrary JavaScript.

## 6. Wedding Book Bindings

NPC can open:

```text
book.home
book.events
book.venue
book.gallery
book.rsvp
book.gift
book.story
```

Canonical content comes from wedding domain records.
Do not force operator to duplicate event/venue data in NPC config.

## 7. Quest Section

V1 locked quest template:

`collect-our-story-v1`

Operator may edit:
- narrative labels
- NPC-to-heart assignment within valid slots
- reward copy
- finale intro copy

Operator cannot add arbitrary new mechanics.

## 8. Avatar Section

Configure:
- Partner A avatar
- Partner B avatar
- default guest avatar pool
- optional guest avatar choice
- NPC avatar per slot

Every avatar ID must exist in published asset manifest.

## 9. Realtime Section

```text
Realtime Enabled: true/false

Show Online Count: true

Remote Guests Visible: true

Client Render Cap Hint: 20

Emotes:
  wave
  heart
  celebrate
  laugh
  blessing
```

No free-text chat setting exists in V1.

## 10. Preview Modes

```text
Single Player
Generic Guest
Named Guest
320 px
360 px
390 px
430 px
Desktop
Reduced Motion
Realtime Offline
```

Automated E2E additionally provides:
`Two Guest Simulation`

## 11. World Template Management

Developer/superuser workflow only.

```ts
type WorldTemplateRecord = {
  key: string;
  version: number;
  status: "draft" | "published" | "deprecated";
  mapAssetRef: string;
  manifestAssetRef: string;
  requiredNpcSlots: string[];
  requiredSpawns: string[];
  requiredLandmarks: string[];
  compatibilityVersion: number;
};
```

Wedding publication pins an immutable template version.

Existing weddings never silently switch to a newer map.

## 12. Map Publishing Pipeline

```text
Tiled source
↓
validate
↓
resolve/package assets
↓
upload to R2/static storage
↓
create immutable world template version
↓
make available to wedding operator
```

Blocking validation:
- missing required layer
- missing reserved NPC slot
- missing spawn
- missing landmark
- invalid asset ref
- spawn inside collision
- duplicate identifier
- unsupported orientation/version
- mandatory destination unreachable where validator supports reachability

## 13. Publication Snapshot

Example:

```json
{
  "world": {
    "templateKey": "garden-village-v1",
    "templateVersion": 1,
    "mapManifestUrl": "https://immutable.example/world/1/manifest.json",
    "npcBindings": [],
    "quest": {},
    "realtime": {}
  }
}
```

Do not reference mutable `latest.json`.

## 14. Operator Guardrails

Normal operator cannot:
- upload arbitrary JS
- write Phaser code
- edit network protocol
- modify collision
- move reserved world geometry
- invent unknown NPC action types

Custom map geometry belongs to new world-template development.
