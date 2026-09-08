import { Scene } from "phaser";
import type { AvatarDefinition, NpcBinding, NpcSlotId } from "@wedding-rpg/contracts";
import type { WorldDefinition } from "../world/types";
import { labelForActions } from "../systems/interaction/select";

// Data-driven world actor: placement from Tiled, content from NpcBinding.
// No couple-specific branches, no hard-coded dialogue, no per-NPC subclasses.
export class NpcActor {
  readonly slotId: NpcSlotId;
  readonly binding: NpcBinding;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Text;

  constructor(scene: Scene, x: number, y: number, binding: NpcBinding, avatar: AvatarDefinition) {
    this.slotId = binding.slotId;
    this.binding = binding;
    this.sprite = scene.physics.add.staticSprite(x, y, avatar.id, avatar.animations["idle-down"].frames[0]);
    this.sprite.setScale(avatar.displayScale);
    const s = avatar.displayScale;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(avatar.physics.bodyWidth * s, avatar.physics.bodyHeight * s);
    body.setOffset(avatar.physics.offsetX, avatar.physics.offsetY);
    // Static bodies never re-sync after creation: pin the feet body in
    // world units directly instead of relying on sync timing.
    body.position.set(
      x - avatar.origin.x * avatar.sprite.frameWidth * s + avatar.physics.offsetX * s,
      y - avatar.origin.y * avatar.sprite.frameHeight * s + avatar.physics.offsetY * s
    );
    body.updateCenter();
    this.sprite.setOrigin(avatar.origin.x, avatar.origin.y);
    this.sprite.setDepth(y);
    this.sprite.anims.play(`${avatar.id}/idle-down`, true);
    const headClear = Math.round(avatar.sprite.frameHeight * avatar.displayScale * avatar.origin.y) + 4;
    this.nameLabel = scene.add
      .text(x, y - headClear, binding.displayName, {
        fontSize: "11px",
        color: "#ffffff",
        stroke: "#1a2233",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(y + 1)
      .setVisible(false);
    this.marker = scene.add
      .text(x, y - headClear - 12, "▼", { fontSize: "12px", color: "#ffe08a" })
      .setOrigin(0.5)
      .setDepth(y + 1)
      .setVisible(false);
  }

  get interactLabel(): string {
    return this.binding.interactLabel ?? labelForActions(this.binding.actions);
  }

  setTargeted(targeted: boolean): void {
    this.nameLabel.setVisible(targeted);
    this.marker.setVisible(targeted);
  }
}

/**
 * Spawn one actor per binding at its Tiled slot. Throws in development for
 * missing slots (loud failure); production logs and keeps the game running.
 */
export function spawnNpcActors(
  scene: Scene,
  def: WorldDefinition,
  bindings: readonly NpcBinding[],
  avatars: Map<string, AvatarDefinition>
): NpcActor[] {
  const actors: NpcActor[] = [];
  for (const b of bindings) {
    const slot = def.npcSlots[b.slotId];
    if (!slot) {
      const msg = `NPC binding references missing Tiled slot: ${b.slotId}`;
      if (process.env.NODE_ENV !== "production") throw new Error(msg);
      console.error(msg);
      continue;
    }
    const avatar = avatars.get(b.avatarId);
    if (!avatar) {
      const msg = `NPC binding references unknown avatar: ${b.avatarId}`;
      if (process.env.NODE_ENV !== "production") throw new Error(msg);
      console.error(msg);
      continue;
    }
    actors.push(new NpcActor(scene, slot.x, slot.y, b, avatar));
  }
  return actors;
}
