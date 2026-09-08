import { AUTO, Game, Scale, type Types } from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { WeddingWorldScene } from "./scenes/WeddingWorldScene";
import type { NpcBinding } from "@wedding-rpg/contracts";
import { HudScene } from "./scenes/HudScene";

export { BRIDGE_EVENTS, EventBus } from "./bridge";
export type { WorldDefinition } from "./world/types";
export type { InputSource, MovementInput } from "./input/types";
export { TouchHud } from "./input/touch-hud";
export { DialogueRuntime } from "./systems/dialogue-runtime";
export type { DialogueLine } from "./systems/dialogue-runtime";
export { dispatchSemanticAction } from "./systems/semantic-actions";
export {
  createQuestState,
  grantHeart,
  missingHearts,
  startQuest,
} from "./systems/quest/quest-controller";
export type { QuestDefinitionLike, QuestStateLike } from "./systems/quest/quest-controller";
export { SnapshotBuffer, INTERP_DELAY_MS } from "./networking/interpolation";
export type { TransformSnapshot } from "./networking/interpolation";
export { RemotePlayerStore } from "./networking/remote-store";
export type { RemotePlayer } from "./networking/remote-store";
export { NetClient } from "./networking/net-client";
export type { NetState, SocketLike, NetClientOptions, NetEvents } from "./networking/net-client";

/**
 * Create the single Phaser.Game instance for the wedding world.
 * React owns the host element and overlay UI; everything world-related
 * (map, player, NPCs, camera, collision) lives inside this instance.
 * The caller must destroy the game on unmount (see PhaserGame).
 */
export interface WeddingGameOptions {
  /** Wedding-specific NPC content. Lives outside game code (web fixture now, publication later). */
  npcBindings?: NpcBinding[];
  /** Local-player avatar id from the avatar registry (guest pool). */
  playerAvatarId?: string;
}

export function createWeddingGame(parent: string, opts: WeddingGameOptions = {}): Game {
  const config: Types.Core.GameConfig = {
    type: AUTO,
    parent,
    backgroundColor: "#1a2233",
    pixelArt: true,
    roundPixels: true,
    disableContextMenu: true,
    scale: {
      mode: Scale.RESIZE,
      autoCenter: Scale.CENTER_BOTH,
      width: 360,
      height: 640,
    },
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [BootScene, PreloadScene, WeddingWorldScene, HudScene],
  };
  const game = new Game(config);
  game.registry.set("npcBindings", opts.npcBindings ?? []);
  game.registry.set("playerAvatarId", opts.playerAvatarId ?? "guest_01");
  return game;
}
