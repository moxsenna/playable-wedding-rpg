import { createWeddingGame } from "@wedding-rpg/game";
import { DEMO_NPC_BINDINGS } from "../weddings/demo-bindings";

// Thin web entry: the single Phaser.Game instance is constructed inside
// @wedding-rpg/game (createWeddingGame). React mounts once via PhaserGame
// and destroys on unmount; it never touches scenes or world internals.
const StartGame = (parent: string) =>
  createWeddingGame(parent, {
    npcBindings: DEMO_NPC_BINDINGS,
    playerAvatarId: "guest_male_batik_burgundy_01",
  });

export default StartGame;
