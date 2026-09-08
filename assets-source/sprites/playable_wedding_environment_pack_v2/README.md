# Playable Wedding Environment Pack V2

This is the revised, sliced and repacked environment pack for `garden-village-v1`.

## What changed from V1

- Four latest generated sheets are frozen under `source-v2/`.
- Source sheets are no longer treated as direct Phaser/Tiled spritesheets.
- Terrain is normalized into a deterministic **16×16 Tiled tileset**.
- Foliage, wedding decor, and landmarks are split into **named individual PNGs**.
- The same object assets are repacked into **Phaser atlas PNG + JSON**.
- Tiled image-collection TSJ files are included for large objects.
- Origins, recommended world scales, and collision hints are included.
- The chapel-like hall is **excluded from the default theme**.
- `wedding_hall_garden_01` and `wedding_hall_muslim_01` currently alias the neutral garden event pavilion.

## Runtime recommendation

Use:
- `terrain/terrain_tiles.tsj` in Tiled for tile layers.
- `objects/*/*_collection.tsj` in Tiled for large object placement.
- `atlases/*_atlas.json` in Phaser for runtime object textures.
- `metadata/environment-registry.json` as the source of truth.

## Important visual note

The terrain is technically ready to author, but because it was derived from generative source art,
perform a seam/repetition review inside the actual Garden Village map before declaring M4.6 visual-complete.
