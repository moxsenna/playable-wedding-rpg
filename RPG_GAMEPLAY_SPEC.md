# RPG_GAMEPLAY_SPEC.md

## 1. Core Experience

The player is a wedding guest arriving in a small social RPG village.

The guest can:
- freely walk
- talk to wedding NPCs
- discover relationship memories
- see other online guests
- exchange predefined emotes
- inspect canonical wedding details
- RSVP
- reach an optional emotional finale

Expected session:
- quick-info guest: 20–60 sec
- explorer: 3–7 min
- social/explorer: open-ended but lightweight

## 2. Player State

```ts
type PlayerState = {
  guestId?: string;
  displayName: string;
  avatarId: string;
  mapId: string;
  x: number;
  y: number;
  facing: "up" | "down" | "left" | "right";
  movement: "idle" | "walk";
  quest: {
    heartMemories: string[];
    finaleUnlocked: boolean;
  };
  currentInteractableId?: string;
};
```

Quest progress may remain session-scoped in V1.
RSVP is durable server business data.

## 3. Input State Machine

```ts
type MovementInput = {
  vectorX: number; // -1..1
  vectorY: number; // -1..1
  magnitude: number; // 0..1
  source: "virtual-stick" | "keyboard";
};
```

Virtual joystick states:

```text
IDLE
TOUCH_START
DRAGGING
RELEASED
```

Rules:
- fixed lower-left control zone
- deadzone around center
- magnitude clamped to 1
- normalize before applying movement speed
- multitouch supports joystick + Interact simultaneously
- respect safe-area insets

Reference layout:

```text
top-right: Wedding Book

bottom-left: virtual stick
bottom-right: Interact
near bottom-right: compact Emote
```

Desktop:
- WASD/arrows
- E/Space interact

## 4. Movement

- 8-direction physical movement
- 4-direction sprite animation acceptable
- normalized diagonal speed
- no sprint
- no stamina
- no jump
- no attack

Reference feel:
cross visible portrait screen in roughly 1.5–2.5 seconds.

## 5. Required Player Animations

```text
idle-down
idle-up
idle-left
idle-right
walk-down
walk-up
walk-left
walk-right
```

Left/right may share mirrored art if appropriate.

Local movement begins immediately from input.
Never wait for network ack.

## 6. Interaction Selection

Continuously or at modest interval:

1. find nearby interactables
2. filter enabled
3. rank by distance
4. add facing bias
5. apply priority
6. set single primary target

Priority:

```text
critical NPC
> active quest NPC
> normal NPC
> door
> ambient interactable
```

Only one primary target at a time.

## 7. Contextual Interact Button

Examples:

```text
💬 Bicara
🚪 Masuk
📷 Foto
❤️ Beri Doa
📍 Lihat Lokasi
```

One stable physical control; label/action changes contextually.

## 8. NPC Dialogue

During dialogue:
- local movement suspended
- joystick resets neutral
- other remote guests may continue moving
- player remains in room

Dialogue panel:
- NPC name
- optional portrait
- 1–3 short lines per step
- large Continue target

Do not turn every NPC into a long visual novel.

NPC contract:

```ts
type WeddingNpc = {
  slotId: string;
  npcId: string;
  avatarId: string;
  displayName: string;
  role:
    | "greeter"
    | "story"
    | "event"
    | "venue"
    | "photo"
    | "rsvp"
    | "memory"
    | "couple"
    | "decorative";
  dialogue: DialogueNode[];
  questRewardId?: string;
  weddingBookAction?: string;
};
```

## 9. Canonical NPC Roles

### Greeter
- welcome
- teach movement
- explain Wedding Book
- start quest

### RSVP Keeper
- opens RSVP
- reflects existing RSVP state

### Story Keeper
Reward:
`heart.first_meeting`

### Photographer
Reward:
`heart.memories`
Also opens gallery.

### Travel Friend
Reward:
`heart.journey`

### Proposal Friend
Reward:
`heart.proposal`

### Event Coordinator
Opens event schedule.

### Venue Guide
Opens venue/maps.

### Couple A / B
Finale dialogue.

## 10. Main Quest — Collect Our Story

Start from Greeter.

HUD:
```text
♡ ♡ ♡ ♡
```

Heart IDs:
```text
heart.first_meeting
heart.memories
heart.journey
heart.proposal
```

After collecting:
```text
♥ ♥ ♥ ♥
```

Then:
- Wedding Hall gate unlocks
- finale marker activates
- optional celebration effect

Quest NPCs must sit on obvious paths.

## 11. Quest Marker

Only one primary marker by default.

Use:
- small icon above NPC/landmark
- no giant MMO beams

Wedding Book may select navigation target.

## 12. Wedding Book

Always available.

React/DOM sheet/modal:

```text
Home
Acara
Lokasi
Dresscode
Gallery
RSVP
Hadiah
Cerita Kami
```

Same canonical publication data as NPCs.

Wedding Book must work even if Phaser fails.

## 13. RSVP Integration

```text
Phaser emits OPEN_RSVP
↓
React RSVP sheet opens
↓
movement suspended
↓
submit API
↓
React returns RSVP_SUCCESS
↓
Phaser updates keeper dialogue/effect
```

RSVP persistence remains server-side.

## 14. Other Online Guests

Remote display:
```text
avatar
nametag
movement animation
temporary emote bubble
```

No collision.

Nametags:
- safe display name only
- truncate visually
- never token/email

## 15. Guest-to-Guest Interaction

V1:
- presence
- movement
- predefined emotes

Emotes:
```text
wave
heart
celebrate
laugh
blessing
```

Prefer custom pixel-art bubbles/assets over raw emoji when assets exist.

## 16. No Free-Text Chat

V1 excludes live chat.

Guestbook remains text channel.

## 17. Presence HUD

Minimal:
```text
● 12 tamu online
```

No full player list by default.

## 18. Remote Density

Initial policy:
- render nearest/relevant remote players
- practical cap ~15–20
- tune from performance tests

Server may know more players than rendered.

## 19. Realtime Failure

If socket drops:
- local game remains playable
- remote guests fade/disappear/reconnecting
- Wedding Book works
- RSVP works
- bounded reconnect backoff

Realtime is enhancement, not hard dependency.

## 20. Loading Flow

```text
React shell visible
↓
Wedding Book/direct info available
↓
publication loaded
↓
Phaser bundle
↓
critical map/assets
↓
local spawn
↓
realtime connect
```

Do not block wedding info behind game loading.

## 21. Return Visits

V1 defaults to entrance spawn.
Do not persist physical position across days.

## 22. Audio

World audio:
- ambient
- music
- interaction cues

Rules:
- user gesture for sound
- shared mute preference
- dialogue does not restart soundtrack
- failure does not block gameplay

## 23. Reduced Motion

Reduce:
- particles
- camera easing
- ambient animation

If Phaser fails:
- full Wedding Book/direct invitation remains usable.

## 24. Analytics

```text
game_loaded
game_started
world_spawned
npc_interacted
quest_started
heart_collected
quest_completed
wedding_hall_entered
finale_completed
realtime_connected
realtime_disconnected
emote_sent
```
