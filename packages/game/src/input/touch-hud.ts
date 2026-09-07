import { Scene } from "phaser";
import { BRIDGE_EVENTS, EventBus } from "../bridge";
import { emoteSchema, type Emote } from "@wedding-rpg/contracts";
import { neutralInput, type MovementInput } from "./types";
import { VirtualJoystick } from "./virtual-joystick";

const EMOTES = emoteSchema.options;
const STICK_RADIUS = 56;

/**
 * Touch HUD: analog stick (bottom-left) + contextual Interact (bottom-right)
 * + compact Emote cycler above it. All Phaser-canvas, camera-fixed, shown
 * only on touch-capable devices. M3 drives the Interact label; M10 sends
 * the selected emote to the room.
 */
export class TouchHud {
  readonly touchCapable: boolean;
  private readonly scene: Scene;
  private joystick: VirtualJoystick | null = null;
  private interactVisual: Phaser.GameObjects.Arc | null = null;
  private interactLabel: Phaser.GameObjects.Text | null = null;
  private emoteVisual: Phaser.GameObjects.Arc | null = null;
  private emoteLabel: Phaser.GameObjects.Text | null = null;
  private emoteIndex = 0;
  private suspended = false;
  private suspendReasons = new Set<string>();
  private ix = 0;
  private iy = 0;
  private ex = 0;
  private ey = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.touchCapable = scene.sys.game.device.input.touch;
    if (!this.touchCapable) return;
    // Second concurrent touch point: hold the stick while tapping Interact.
    scene.input.addPointer(1);
    // Buttons route through one global listener with radius checks (same
    // deterministic mechanism as the stick) instead of Shape hit areas.
    scene.input.on("pointerdown", this.routeDown, this);
    this.layout(scene.scale.width, scene.scale.height);
    EventBus.on(BRIDGE_EVENTS.modalOpened, this.onModalOpened, this);
    EventBus.on(BRIDGE_EVENTS.modalClosed, this.onModalClosed, this);
    scene.scale.on("resize", this.relayout, this);
    scene.sys.events.once("shutdown", this.destroy, this);
  }

  isSuspended(): boolean {
    return this.suspended;
  }

  getPhase() {
    return this.joystick ? this.joystick.getPhase() : "IDLE";
  }

  /** Probe geometry for e2e (null on non-touch devices). */
  geometry() {
    if (!this.touchCapable || !this.joystick) return null;
    return {
      stick: { x: this.stickX(), y: this.stickY(), radius: STICK_RADIUS },
      interact: { x: this.scene.scale.width - 88, y: this.scene.scale.height - 112 },
      emote: { x: this.scene.scale.width - 88, y: this.scene.scale.height - 190 },
      phase: this.getPhase(),
      suspended: this.suspended,
    };
  }

  /** Per-frame movement from the stick; neutral while suspended. */
  consume(): MovementInput {
    if (!this.touchCapable || this.suspended || !this.joystick) {
      return neutralInput("virtual-stick");
    }
    return this.joystick.getOutput();
  }

  private currentLabel = "Aksi";

  getInteractLabel(): string {
    return this.currentLabel;
  }

  setInteractLabel(text: string): void {
    this.currentLabel = text;
    this.interactLabel?.setText(text);
  }

  currentEmote(): Emote {
    return EMOTES[this.emoteIndex];
  }

  private stickX(): number {
    return 96;
  }

  private stickY(): number {
    return this.scene.scale.height - 120;
  }

  private relayout = (gameSize: Phaser.Structs.Size): void => {
    this.layout(gameSize.width, gameSize.height);
  };

  private layout(width: number, height: number): void {
    if (!this.joystick) {
      this.joystick = new VirtualJoystick(this.scene, this.stickX(), height - 120, STICK_RADIUS);
    } else {
      this.joystick.setPosition(this.stickX(), height - 120);
    }
    const ix = width - 88;
    const iy = height - 112;
    this.ix = ix;
    this.iy = iy;
    if (!this.interactVisual) {
      this.interactVisual = this.scene.add
        .circle(ix, iy, 40, 0xffffff, 0.14)
        .setScrollFactor(0)
        .setDepth(200);
      this.interactVisual.setStrokeStyle(2, 0xffffff, 0.4);
      this.interactLabel = this.scene.add
        .text(ix, iy, "Aksi", { fontSize: "15px", color: "#ffffff" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(201);
    } else {
      this.interactVisual.setPosition(ix, iy);
      this.interactLabel?.setPosition(ix, iy);
    }
    const ex = width - 88;
    const ey = height - 190;
    this.ex = ex;
    this.ey = ey;
    if (!this.emoteVisual) {
      this.emoteVisual = this.scene.add
        .circle(ex, ey, 26, 0xffffff, 0.12)
        .setScrollFactor(0)
        .setDepth(200);
      this.emoteVisual.setStrokeStyle(2, 0xffffff, 0.35);
      this.emoteLabel = this.scene.add
        .text(ex, ey, EMOTES[this.emoteIndex], { fontSize: "11px", color: "#ffffff" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(201);
    } else {
      this.emoteVisual.setPosition(ex, ey);
      this.emoteLabel?.setPosition(ex, ey);
    }
    this.applyDim();
  }

  private routeDown(pointer: Phaser.Input.Pointer): void {
    if (this.suspended) return;
    if (Math.hypot(pointer.x - this.ix, pointer.y - this.iy) <= 52) {
      this.onInteractDown();
    } else if (Math.hypot(pointer.x - this.ex, pointer.y - this.ey) <= 38) {
      this.onEmoteDown();
    }
  }

  private onInteractDown(): void {
    if (this.suspended || !this.touchCapable) return;
    this.interactVisual?.setScale(1.12);
    this.scene.time.delayedCall(110, () => this.interactVisual?.setScale(1));
    EventBus.emit(BRIDGE_EVENTS.interactPressed);
  }

  private onEmoteDown(): void {
    if (this.suspended || !this.touchCapable) return;
    this.emoteIndex = (this.emoteIndex + 1) % EMOTES.length;
    this.emoteLabel?.setText(EMOTES[this.emoteIndex]);
    EventBus.emit(BRIDGE_EVENTS.emoteSelected, { emote: EMOTES[this.emoteIndex] });
  }

  suspend(reason: string): void {
    this.suspendReasons.add(reason);
    this.syncSuspend();
  }

  resume(reason: string): void {
    this.suspendReasons.delete(reason);
    this.syncSuspend();
  }

  private syncSuspend(): void {
    const suspended = this.suspendReasons.size > 0;
    if (suspended === this.suspended) return;
    this.suspended = suspended;
    this.joystick?.setEnabled(!suspended);
    this.applyDim();
  }

  private onModalOpened(): void {
    this.suspend("modal");
  }

  private onModalClosed(): void {
    this.resume("modal");
  }

  private applyDim(): void {
    const alpha = this.suspended ? 0.45 : 1;
    this.interactVisual?.setAlpha(alpha);
    this.interactLabel?.setAlpha(alpha);
    this.emoteVisual?.setAlpha(alpha);
    this.emoteLabel?.setAlpha(alpha);
  }

  private destroy(): void {
    this.scene.input.off("pointerdown", this.routeDown, this);
    EventBus.off(BRIDGE_EVENTS.modalOpened, this.onModalOpened, this);
    EventBus.off(BRIDGE_EVENTS.modalClosed, this.onModalClosed, this);
    this.scene.scale.off("resize", this.relayout, this);
  }
}
