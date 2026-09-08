// Local player: Arcade Physics body, 8-direction movement, 4-direction art.
// Networking never drives this controller (M10+ sends snapshots FROM it).
import { Scene } from "phaser";
import type { AvatarDefinition, Direction } from "@wedding-rpg/contracts";
import type { MovementInput } from "../input/types";

/** Pixels per second. Crosses a 180px portrait view in ~1.5s. */
export const PLAYER_SPEED = 120;

/** Register an avatar's 8 canonical animations from registry metadata. Idempotent. */
export function createAvatarAnims(scene: Scene, avatar: AvatarDefinition): void {
  for (const [name, a] of Object.entries(avatar.animations)) {
    const key = `${avatar.id}/${name}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(avatar.id, { frames: a.frames }),
      frameRate: a.frameRate,
      repeat: a.repeat,
    });
  }
}

export class LocalPlayer {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  facing: Direction = "down";
  private readonly animId: string;

  constructor(scene: Scene, x: number, y: number, avatar: AvatarDefinition) {
    this.sprite = scene.physics.add.sprite(x, y, avatar.id, avatar.animations["idle-down"].frames[0]);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(avatar.displayScale);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(avatar.physics.bodyWidth, avatar.physics.bodyHeight);
    body.setOffset(avatar.physics.offsetX, avatar.physics.offsetY);
    this.sprite.setOrigin(avatar.origin.x, avatar.origin.y);
    this.sprite.setDepth(y);
    this.animId = avatar.id;
    this.sprite.anims.play(`${avatar.id}/idle-down`, true);
  }

  update(movement: MovementInput): void {
    const { vectorX: vx, vectorY: vy, magnitude } = movement;
    this.sprite.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    if (magnitude > 0.01) {
      // facing follows the dominant axis; diagonals keep 4-direction art
      this.facing =
        Math.abs(vx) >= Math.abs(vy) ? (vx < 0 ? "left" : "right") : vy < 0 ? "up" : "down";
      this.sprite.anims.play(`${this.animId}/walk-${this.facing}`, true);
    } else {
      this.sprite.anims.play(`${this.animId}/idle-${this.facing}`, true);
    }
    // Y-sort so actors pass in front of / behind each other correctly
    this.sprite.setDepth(this.sprite.y);
  }
}
