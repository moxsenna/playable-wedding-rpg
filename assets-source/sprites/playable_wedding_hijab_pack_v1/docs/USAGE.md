# Hijab Pack Usage

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

## Important

Use the per-avatar JSON as the source of truth for:
- animation frame lists
- origin
- physics body
- role/category metadata
