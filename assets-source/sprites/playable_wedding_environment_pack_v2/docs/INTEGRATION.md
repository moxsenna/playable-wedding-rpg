# Phaser / Tiled Integration

## Phaser

```ts
this.load.atlas(
  "wedding-foliage",
  "/assets/environment/atlases/foliage_atlas.png",
  "/assets/environment/atlases/foliage_atlas.json",
);

this.load.atlas(
  "wedding-decor",
  "/assets/environment/atlases/decor_atlas.png",
  "/assets/environment/atlases/decor_atlas.json",
);

this.load.atlas(
  "wedding-landmarks",
  "/assets/environment/atlases/landmarks_atlas.png",
  "/assets/environment/atlases/landmarks_atlas.json",
);
```

Example:

```ts
const tree = scene.add.image(x, y, "wedding-foliage", "tree_pink_blossom_01");
tree.setOrigin(0.5, 0.94);
tree.setScale(0.48);
```

Use `metadata/environment-registry.json` rather than hard-coding origin/scale/collision values.

## Tiled

- Add `terrain/terrain_tiles.tsj` for tile layers.
- Add the collection TSJs under `objects/foliage`, `objects/decor`, and `objects/landmarks`.
- Collision remains logical authoring in `06_Collision`; do not infer collision from image alpha.
- Keep `wedding_hall_chapel_01` out of the default Muslim/Garden world preset.
