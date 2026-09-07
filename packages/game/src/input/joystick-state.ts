// Pure virtual-joystick state machine + analog math. Zero dependencies so the
// gate oracle can execute it in node (see scripts/verify-m2-input.mjs).
// Spec (RPG_GAMEPLAY_SPEC.md section 3): IDLE -> TOUCH_START -> DRAGGING ->
// RELEASED, deadzone, magnitude clamp, diagonal normalization.

export type JoystickPhase = "IDLE" | "TOUCH_START" | "DRAGGING" | "RELEASED";

export interface JoystickOutput {
  vectorX: number;
  vectorY: number;
  magnitude: number;
  phase: JoystickPhase;
}

export interface JoystickConfig {
  /** Thumb travel radius in px. */
  radius: number;
  /** Inner deadzone as a fraction of radius (0..1). */
  deadzone: number;
}

const NEUTRAL = { vectorX: 0, vectorY: 0, magnitude: 0 };

export class JoystickState {
  private phase: JoystickPhase = "IDLE";
  private readonly radius: number;
  private readonly deadzonePx: number;

  constructor(config: JoystickConfig = { radius: 56, deadzone: 0.22 }) {
    this.radius = config.radius;
    this.deadzonePx = config.deadzone * config.radius;
  }

  getPhase(): JoystickPhase {
    return this.phase;
  }

  /** Finger touched the stick base. */
  press(): JoystickOutput {
    if (this.phase === "IDLE") this.phase = "TOUCH_START";
    return { ...NEUTRAL, phase: this.phase };
  }

  /**
   * Finger moved; dx/dy are thumb offsets in px from the base center.
   * Strict machine: drags without a preceding press are ignored.
   */
  drag(dx: number, dy: number): JoystickOutput {
    if (this.phase === "IDLE") return { ...NEUTRAL, phase: "IDLE" };
    this.phase = "DRAGGING";
    const dist = Math.hypot(dx, dy);
    if (!(dist > this.deadzonePx)) return { ...NEUTRAL, phase: this.phase };
    const magnitude = Math.min(1, dist / this.radius);
    return {
      vectorX: (dx / dist) * magnitude,
      vectorY: (dy / dist) * magnitude,
      magnitude,
      phase: this.phase,
    };
  }

  /** Finger lifted: one RELEASED observation, then back to IDLE. */
  release(): JoystickOutput {
    this.phase = "IDLE";
    return { ...NEUTRAL, phase: "RELEASED" };
  }

  /** Forced neutral (modal opened): no RELEASED stopover, nothing stuck. */
  reset(): JoystickOutput {
    this.phase = "IDLE";
    return { ...NEUTRAL, phase: "IDLE" };
  }
}
