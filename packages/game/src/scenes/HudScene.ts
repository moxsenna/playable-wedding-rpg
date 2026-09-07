import { Scene } from "phaser";
import { TouchHud } from "../input/touch-hud";

// Parallel interface scene with its own default (zoom-1) camera. The world
// camera stays zoomed for crisp pixels, which would push camera-fixed HUD
// elements off-screen; rendering them here keeps true screen coordinates.
// Launched once from WeddingWorldScene; input arrives via the shared bridge.
export class HudScene extends Scene {
  hud: TouchHud | null = null;

  constructor() {
    super("Hud");
  }

  create(): void {
    this.hud = new TouchHud(this);
  }
}
