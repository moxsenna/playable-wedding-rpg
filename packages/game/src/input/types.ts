// Unified movement input: keyboard and the virtual stick produce the same
// shape, so LocalPlayer never knows which device drives it.
export type InputSource = "virtual-stick" | "keyboard";

export interface MovementInput {
  /** -1..1, already deadzoned, clamped, and diagonally normalized. */
  vectorX: number;
  /** -1..1, already deadzoned, clamped, and diagonally normalized. */
  vectorY: number;
  /** 0..1 overall deflection. Below ~0.01 counts as idle. */
  magnitude: number;
  source: InputSource;
}

export function neutralInput(source: InputSource): MovementInput {
  return { vectorX: 0, vectorY: 0, magnitude: 0, source };
}
