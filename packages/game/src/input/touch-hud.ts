import { Scene } from "phaser";
import { BRIDGE_EVENTS, EventBus } from "../bridge";
import { neutralInput, type MovementInput } from "./types";
import { VirtualJoystick } from "./virtual-joystick";

const STICK_RADIUS = 56;

// Palette for the on-canvas chrome, matching the night side of the design system
// (apps/web/src/styles/guest.css). Phaser colours are 0xRRGGBB; alpha is passed
// separately. Kept here rather than imported so packages/game stays free of any
// web-app dependency.
const C = {
  gold: 0xffd98a,
  nightFill: 0x151d2e,
  nightDeep: 0x0d1320,
  inkLight: 0xf2f4f8,
  goldDeep: 0xf2c46a,
} as const;

/**
 * Touch HUD: analog stick (bottom-left) + contextual Interact (bottom-right)
 * + Emote button above it (opens the React emoji picker). All Phaser-canvas,
 * camera-fixed, shown only on touch-capable devices. M3 drives the Interact
 * label; M10 sends the selected emote to the room.
 *
 * The buttons are drawn as hard-edged blocks with heavy gold rules, in the same
 * language as the DOM chrome around them; soft translucent circles read as a
 * different, older product sitting on top of the world.
 *
 * The joystick base stays CIRCULAR on purpose: it is a radial control and the
 * round form is what tells the thumb "push any direction". Squaring it would
 * make the control worse to teach, so only its material changes.
 */
export class TouchHud {
  readonly touchCapable: boolean;
  private readonly scene: Scene;
  private joystick: VirtualJoystick | null = null;
  private interactVisual: Phaser.GameObjects.Rectangle | null = null;
  private interactLabel: Phaser.GameObjects.Text | null = null;
  private emoteVisual: Phaser.GameObjects.Rectangle | null = null;
  private emoteLabel: Phaser.GameObjects.Text | null = null;
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
      // A solid block with a heavy gold rule. Hit testing is unchanged: it stays
      // a radius check around (ix, iy), which is more forgiving than the square.
      this.interactVisual = this.scene.add
        .rectangle(ix, iy, 84, 84, C.nightFill, 0.94)
        .setScrollFactor(0)
        .setDepth(200);
      this.interactVisual.setStrokeStyle(3, C.gold, 1);
      this.interactLabel = this.scene.add
        .text(ix, iy, "Aksi", {
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "14px",
          fontStyle: "900",
          color: "#ffd98a",
        })
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
        .rectangle(ex, ey, 60, 60, C.nightFill, 0.94)
        .setScrollFactor(0)
        .setDepth(200);
      this.emoteVisual.setStrokeStyle(3, C.gold, 1);
      this.emoteLabel = this.scene.add
        .text(ex, ey, "EMO", {
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "12px",
          fontStyle: "900",
          color: "#ffd98a",
        })
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
    // Press feedback matches the DOM controls: the block sinks into the page.
    this.interactVisual?.setFillStyle(C.gold, 1);
    this.interactLabel?.setColor("#0d1320");
    this.scene.time.delayedCall(110, () => {
      this.interactVisual?.setFillStyle(C.nightFill, 0.94);
      this.interactLabel?.setColor("#ffd98a");
    });
    EventBus.emit(BRIDGE_EVENTS.interactPressed);
  }

  private onEmoteDown(): void {
    if (this.suspended || !this.touchCapable) return;
    this.emoteVisual?.setFillStyle(C.goldDeep, 1);
    this.emoteLabel?.setColor("#0d1320");
    this.scene.time.delayedCall(110, () => {
      this.emoteVisual?.setFillStyle(C.nightFill, 0.94);
      this.emoteLabel?.setColor("#ffd98a");
    });
    EventBus.emit(BRIDGE_EVENTS.emoteMenuRequested);
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
