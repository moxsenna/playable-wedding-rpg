# Playable Wedding Avatar Pack V1

Contents:

```text
source/
  High-resolution 1536×1024 generated source sheets.

runtime/
  Phaser-ready 384×256 sheets.
  64×64 px per frame.
  6 columns × 4 rows.

metadata/
  Per-avatar animation, origin, render, and physics contracts.

avatars-manifest.json
  Global avatar registry.

docs/PHASER_AVATAR_USAGE.md
  Loading and animation-registration guidance.
```

## Character IDs

- `guest_male_suit_navy_01`
- `guest_male_vest_brown_01`
- `guest_male_casual_green_01`
- `guest_male_batik_burgundy_01`

## Frame contract

```text
Row 0 — DOWN
  0 1 = idle
  2 3 4 5 = walk

Row 1 — UP
  6 7 = idle
  8 9 10 11 = walk

Row 2 — LEFT
  12 13 = idle
  14 15 16 17 = walk

Row 3 — RIGHT
  18 19 = idle
  20 21 22 23 = walk
```

The pack is intended to be copied into the new Phaser project under a stable asset path such as:

```text
apps/web/public/assets/avatars/
```

or into the project's R2-backed immutable asset publishing pipeline later.
