// Local player: Arcade Physics body, 8-direction movement, 4-direction art.
// Networking never drives this controller (M10+ sends snapshots FROM it).
import { Scene } from "phaser";
import type { Direction } from "@wedding-rpg/contracts";
import type { MovementInput } from "../input/types";

/** Pixels per second. Crosses a 180px portrait view in ~1.5s. */
export const PLAYER_SPEED = 120;

export interface SheetMeta {
  anims: Record<string, { frames: number[]; frameRate: number }>;
}

/** Register the 8 guest animations from generated frame metadata. Idempotent. */
export function createPlayerAnims(scene: Scene, texture: string, meta: SheetMeta, prefix = ""): void {
  for (const [name, a] of Object.entries(meta.anims)) {
    const key = prefix ? `${prefix}/${name}` : name;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(texture, { frames: a.frames }),
      frameRate: a.frameRate,
      repeat: -1,
    });
  }
}

export class LocalPlayer {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  facing: Direction = "down";

  constructor(scene: Scene, x: number, y: number, texture: string) {
    this.sprite = scene.physics.add.sprite(x, y, texture, 0);
    this.sprite.setCollideWorldBounds(true);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 8);
    body.setOffset(3, 8);
    this.sprite.setDepth(y);
    this.sprite.anims.play("idle-down", true);
  }

  update(movement: MovementInput): void {
    const { vectorX: vx, vectorY: vy, magnitude } = movement;
    this.sprite.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    if (magnitude > 0.01) {
      // facing follows the dominant axis; diagonals keep 4-direction art
      this.facing =
        Math.abs(vx) >= Math.abs(vy) ? (vx < 0 ? "left" : "right") : vy < 0 ? "up" : "down";
      this.sprite.anims.play(`walk-${this.facing}`, true);
    } else {
      this.sprite.anims.play(`idle-${this.facing}`, true);
    }
    // Y-sort so actors pass in front of / behind each other correctly
    this.sprite.setDepth(this.sprite.y);
  }
}
