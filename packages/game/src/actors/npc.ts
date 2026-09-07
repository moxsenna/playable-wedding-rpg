import { Scene } from "phaser";
import type { NpcBinding, NpcSlotId } from "@wedding-rpg/contracts";
import type { WorldDefinition } from "../world/types";
import { createPlayerAnims, type SheetMeta } from "./player";
import { labelForActions } from "../systems/interaction/select";

// Data-driven world actor: placement from Tiled, content from NpcBinding.
// No couple-specific branches, no hard-coded dialogue, no per-NPC subclasses.
export class NpcActor {
  readonly slotId: NpcSlotId;
  readonly binding: NpcBinding;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Text;

  constructor(scene: Scene, x: number, y: number, binding: NpcBinding, animMeta: SheetMeta) {
    this.slotId = binding.slotId;
    this.binding = binding;
    this.sprite = scene.physics.add.staticSprite(x, y, binding.avatarId, 0);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 8);
    body.setOffset(3, 8);
    this.sprite.setDepth(y);
    createPlayerAnims(scene, binding.avatarId, animMeta, binding.avatarId);
    this.sprite.anims.play(`${binding.avatarId}/idle-down`, true);
    this.nameLabel = scene.add
      .text(x, y - 26, binding.displayName, {
        fontSize: "11px",
        color: "#ffffff",
        stroke: "#1a2233",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(y + 1)
      .setVisible(false);
    this.marker = scene.add
      .text(x, y - 40, "▼", { fontSize: "12px", color: "#ffe08a" })
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
  animMeta: SheetMeta
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
    actors.push(new NpcActor(scene, slot.x, slot.y, b, animMeta));
  }
  return actors;
}
