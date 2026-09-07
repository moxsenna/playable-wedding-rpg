# Phaser Avatar Pack Usage

## Runtime standard

Each runtime sprite sheet is:

- 384 × 256 px
- 6 columns × 4 rows
- 64 × 64 px per frame
- transparent background
- row-major frame numbering

Rows:

1. Down
2. Up
3. Left
4. Right

Columns per row:

- 0–1: idle
- 2–5: walk

## Recommended Phaser preload

```ts
const avatar = avatarManifest.avatars.find(
  (item) => item.id === "guest_male_batik_burgundy_01"
);

this.load.spritesheet(
  avatar.id,
  `/assets/avatars/${avatar.sprite}`,
  {
    frameWidth: 64,
    frameHeight: 64,
  },
);
```

## Register animations

Use the metadata JSON instead of hard-coding frame arrays.

Conceptual helper:

```ts
type AvatarMetadata = {
  id: string;
  animations: Record<
    string,
    {
      frames: number[];
      frameRate: number;
      repeat: number;
    }
  >;
};

export function registerAvatarAnimations(
  scene: Phaser.Scene,
  meta: AvatarMetadata,
) {
  for (const [name, animation] of Object.entries(meta.animations)) {
    const key = `${meta.id}:${name}`;

    if (scene.anims.exists(key)) continue;

    scene.anims.create({
      key,
      frames: animation.frames.map((frame) => ({
        key: meta.id,
        frame,
      })),
      frameRate: animation.frameRate,
      repeat: animation.repeat,
    });
  }
}
```

## Runtime state mapping

```ts
function animationKey(
  avatarId: string,
  movement: "idle" | "walk",
  facing: "up" | "down" | "left" | "right",
) {
  return `${avatarId}:${movement}-${facing}`;
}
```

## Physics

The metadata intentionally uses a small collision body around the feet.

Do not use the whole 64×64 frame as the physics body.

Remote wedding guests should have:

```ts
collideWithPlayers = false
```

The local player should collide with the environment only.

## Important

Do not infer animation ordering from filenames or visual inspection at runtime.
`avatars-manifest.json` and each avatar metadata JSON are the source of truth.
