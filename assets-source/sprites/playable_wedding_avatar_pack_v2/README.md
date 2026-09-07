# Playable Wedding Avatar Pack V2

Contains female guest avatars plus core NPC/couple sprites for Garden Village V1.

## Runtime contract

All runtime sheets are normalized to:

```text
384 × 256 px
6 columns × 4 rows
64 × 64 per frame
24 frames total
```

Frame order:

```text
ROW 0 / DOWN
0 1       idle
2 3 4 5   walk

ROW 1 / UP
6 7       idle
8 9 10 11 walk

ROW 2 / LEFT
12 13       idle
14 15 16 17 walk

ROW 3 / RIGHT
18 19       idle
20 21 22 23 walk
```

## Categories

### Guest
- guest_female_kebaya_pink_01
- guest_female_sage_dress_01
- guest_female_hijab_navy_01
- guest_female_kebaya_pastel_01

### NPC
- npc_greeter_female_01
- npc_event_coordinator_female_01
- npc_photographer_male_01
- npc_host_male_01

### Couple
- couple_bride_white_01
- couple_groom_white_01

## Files

- `avatars-manifest.json` — all avatar IDs
- `npc-role-manifest.json` — recommended Garden Village NPC slot bindings
- `metadata/*.json` — per-avatar animation/physics/render metadata
- `runtime/*.png` — normalized runtime sheets
- `source/*.png` — high-resolution source sheets

## Phaser rule

Do not hard-code frame arrays in gameplay classes. Load avatar metadata and register animations from JSON.
