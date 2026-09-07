import { Scene } from "phaser";

// First engine scene: scale/input prerequisites, then hand off to Preload.
// An engine lifecycle scene, not a narrative chapter.
export class BootScene extends Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.scale.refresh();
    this.scene.start("Preload");
  }
}
