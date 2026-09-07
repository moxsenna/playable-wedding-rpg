# MIGRATION_PLAN.md
## Old Scene Renderer → New Social RPG

## 1. Principle

Do not upgrade old renderer file-by-file.

Create a greenfield implementation in `pixel new` and migrate only stable product/domain concepts.

`pixel old` stays intact as reference.

## 2. Old Architecture Diagnosis

Old runtime is:

```text
PixelQuestExperience
  currentSceneIndex
  viewMode = quest/formal
  registry → React scene component
  static stage
  button/hotspot interaction
```

This is intentionally abandoned for gameplay.

Old narrative components conceptually obsolete:

```text
PixelCoverScene
MemoryCardScene
FirstEncounterScene
DistanceJourneyScene
RoadtripScene
ProposalSearchScene
WeddingRevealScene
ClosingScene
```

Copy/assets may inspire new content.
Their React gameplay implementations do not migrate.

`FormalInvitationScene` becomes Wedding Book/direct web UI.

## 3. Preserve / Port

Port concepts carefully:

```text
WeddingProject
CoupleProfile
WeddingEvent
StoryProfile
StoryMilestone
ThemeConfig
MediaAsset
Guest
RSVP
GuestbookEntry
PublicationVersion
AuditEvent
Analytics
Admin authentication
Guest token model
Draft → validate → immutable publication → activate
```

Keep PostgreSQL/Drizzle concepts where compatible.

## 4. Replace

Replace:

```text
sceneInstances as gameplay structure
scene registry for chapters
React scene navigation
hotspot x/y schema
scene completion progression
```

With:

```text
WorldTemplate
WorldTemplateVersion
WeddingWorldConfig
NpcBinding
QuestConfig
AvatarDefinition
RealtimeRoomConfig
```

Old scene tables may remain only for compatibility while old app exists.

## 5. New Durable Entities

### WorldTemplate
- id
- key
- name
- status

### WorldTemplateVersion
- id
- templateId
- version
- manifest storage/url
- map ref
- compatibility version
- publishedAt

### WeddingWorldConfig
- projectId
- worldTemplateVersionId
- ambient preset
- music ref
- finale config
- realtime config

### NpcBinding
- projectId
- slotId
- npcId
- displayName
- avatarId
- dialogue JSON
- action binding
- quest reward

### AvatarPreset
May be static global manifest in V1.

## 6. Publication Contract

Old:
```text
publication.scenes[]
```

New:
```text
publication.world
publication.npcs
publication.quest
publication.modules
```

Preserve:
- couple
- events
- story
- media
- modules
- guest context resolution

Use new schema major version for RPG.

Do not reinterpret old snapshots as new RPG snapshots.

## 7. Local Folder Strategy

```text
playable wedding inv/
├── pixel old/
│   └── existing project untouched
└── pixel new/
    ├── apps/
    ├── packages/
    ├── assets-source/
    └── docs/
```

Use separate env/database namespace while experimenting.

## 8. Milestones

### M0 — Scaffold
- official Phaser scaffold
- pnpm workspace
- packages boundaries
- realtime Worker skeleton
- CI/typecheck/lint/tests

Gate:
blank Phaser world mounts correctly in portrait web shell.

### M1 — World Prototype
- Tiled Garden Village
- required layers
- player
- collision
- camera
- keyboard
- virtual joystick

Gate:
real free-roaming map on phone.

### M2 — NPC / Interaction
- NPC slots
- configured NPCs
- proximity selection
- dialogue
- React event bridge
- Wedding Book

Gate:
walk to multiple NPCs and open correct data.

### M3 — Quest
- Greeter
- four Heart Memories
- gate
- finale

Gate:
complete quest using data, not client-specific code.

### M4 — Wedding Core Port
Port:
- publication DTO
- guest token
- event/story
- modules
- RSVP
- guestbook
- publishing/versioning

Gate:
demo wedding is configuration only.

### M5 — Admin RPG Config
- world picker
- NPC slot editor
- dialogue editor
- quest
- avatars
- realtime
- preview
- validation

Gate:
operator creates instance without code.

### M6 — Realtime Local/Test
- protocol
- remote interpolation
- two-client Playwright
- emotes

Gate:
two browser contexts see smooth movement.

### M7 — Cloudflare Realtime
- Worker
- Durable Object
- Hibernation
- join auth
- rate limiting
- reconnect

Gate:
two deployed clients share one wedding room.

### M8 — Production Data
- Neon PostgreSQL
- Hyperdrive where chosen
- migrations
- R2
- immutable world template publishing

Gate:
no production local-filesystem dependency.

### M9 — Hardening
- mobile performance
- network faults
- 20-remote render smoke
- security
- logging/monitoring
- rollback

## 9. Never Migrate These Patterns

Do not port:
```text
currentSceneIndex
old viewMode as quest progression
hotspot-button exploration
CSS faux game world
chapter-specific React gameplay components
old scene mechanic registry
```

These are the failure mode being replaced.

## 10. Parallel Safety

During development:
- old app remains runnable
- new app uses separate env
- separate database/schema/project
- separate R2 prefix
- separate DO room prefix
- no migration mutates old data automatically

## 11. Cutover Criteria

New RPG becomes canonical only when:

- virtual joystick is good on real mobile browsers
- collision stable
- Wedding Book complete
- quest polished
- NPC config reusable
- RSVP correct
- two-client realtime passes
- realtime outage degrades gracefully
- operator creates a second dummy wedding without code
- asset loading acceptable on mobile network
- publication version pinning works
- no client-specific code

## 12. Reuse Test

Create two dummy weddings:

```text
Raka & Naya
Arvin & Selena
```

They differ in:
- couple
- events
- story
- NPC dialogue
- avatars
- palette/ambient preset

They share:
- map
- runtime
- protocol
- quest engine
- NPC slot architecture

If the second wedding requires source-code edits, productization gate fails.
