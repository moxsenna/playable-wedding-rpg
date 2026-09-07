# Muslim NPC Pack Usage

This pack follows the same sprite contract as the previous avatar packs.

## Runtime contract

- 384 × 256 px
- 6 columns × 4 rows
- 64 × 64 px per frame
- row-major frame numbering
- transparent background

## Frame rows

- Row 0: down
- Row 1: up
- Row 2: left
- Row 3: right

## Frame columns

- 0–1: idle
- 2–5: walk

## Intended roles

- `npc_greeter_hijabi_pastel_01` → greeter
- `npc_mc_muslim_male_01` → MC / host / announcer
- `npc_photographer_muslim_male_01` → photographer
- `npc_rsvp_keeper_hijabi_01` → RSVP keeper / event coordinator / venue guide

Use the per-avatar JSON as the source of truth for:
- animation frame lists
- origin
- physics body
- role/category metadata
