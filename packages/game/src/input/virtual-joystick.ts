import { Scene } from "phaser";
import { JoystickState, type JoystickOutput } from "./joystick-state";
import type { MovementInput } from "./types";

// On-canvas analog stick: base ring + thumb rendered in game units with
// scrollFactor(0), so no DOM/canvas coordinate mixing is ever needed.
// Pointer claim uses object identity (multi-touch safe): the first pointer
// down inside the capture radius owns the stick until it lifts.
export class VirtualJoystick {
  private readonly state: JoystickState;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;
  private readonly radius: number;
  private readonly scene: Scene;
  private baseX: number;
  private baseY: number;
  private enabled = true;
  private activePointer: Phaser.Input.Pointer | null = null;
  private last: JoystickOutput = { vectorX: 0, vectorY: 0, magnitude: 0, phase: "IDLE" };

  constructor(scene: Scene, x: number, y: number, radius = 56) {
    this.scene = scene;
    this.radius = radius;
    this.baseX = x;
    this.baseY = y;
    this.state = new JoystickState({ radius, deadzone: 0.22 });
    // The base keeps its circular form because it is a radial control: the round
    // shape is what tells the thumb it can push any direction. Only the material
    // follows the world's night-and-gold system — flat fill, heavy rule.
    //
    // The fill is nearly opaque on purpose. At 0.72 over bright grass it composited
    // to dark GREEN with its gold rule at 1.33:1, so the control's legibility moved
    // with whatever terrain sat behind it. At 0.9 it reads as the same night block
    // as the buttons over any ground.
    this.base = scene.add
      .circle(x, y, radius, 0x151d2e, 0.9)
      .setScrollFactor(0)
      .setDepth(200);
    this.base.setStrokeStyle(3, 0xffd98a, 1);
    this.thumb = scene.add
      .circle(x, y, radius * 0.42, 0xffd98a, 1)
      .setScrollFactor(0)
      .setDepth(201);
    this.thumb.setStrokeStyle(3, 0x0d1320, 1);
    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointercancel", this.onUp, this);
    scene.sys.events.once("shutdown", this.destroy, this);
  }

  getPhase() {
    return this.state.getPhase();
  }

  getOutput(): MovementInput {
    return { vectorX: this.last.vectorX, vectorY: this.last.vectorY, magnitude: this.last.magnitude, source: "virtual-stick" };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  setPosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.base.setPosition(x, y);
    this.thumb.setPosition(x, y);
  }

  /** Forced neutral (modal opened): pointer released, thumb homed. */
  reset(): void {
    this.activePointer = null;
    this.thumb.setPosition(this.baseX, this.baseY);
    this.last = this.state.reset();
  }

  private claimRadius(): number {
    return this.radius * 1.6;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || this.activePointer !== null) return;
    if (Math.hypot(pointer.x - this.baseX, pointer.y - this.baseY) > this.claimRadius()) return;
    this.activePointer = pointer;
    this.last = this.state.press();
    this.moveThumb(pointer);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer !== this.activePointer) return;
    this.moveThumb(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer !== this.activePointer) return;
    this.activePointer = null;
    this.thumb.setPosition(this.baseX, this.baseY);
    this.last = this.state.release();
  }

  private moveThumb(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.baseX;
    const dy = pointer.y - this.baseY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.radius);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    this.thumb.setPosition(this.baseX + nx * clamped, this.baseY + ny * clamped);
    this.last = this.state.drag(dx, dy);
  }

  private destroy(): void {
    this.scene.input.off("pointerdown", this.onDown, this);
    this.scene.input.off("pointermove", this.onMove, this);
    this.scene.input.off("pointerup", this.onUp, this);
    this.scene.input.off("pointercancel", this.onUp, this);
  }
}
