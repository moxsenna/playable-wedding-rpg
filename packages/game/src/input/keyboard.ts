// Keyboard (WASD/arrows) adapter producing the unified MovementInput.
// Only `import type` from phaser here so node oracles can transpile this
// module without the Phaser runtime.
import type { MovementInput } from "./types";

export interface KeyState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** Read held state from Phaser cursor + WASD key objects. */
export function readKeyboard(
  cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>
): KeyState {
  return {
    left: cursors.left.isDown || wasd.A.isDown,
    right: cursors.right.isDown || wasd.D.isDown,
    up: cursors.up.isDown || wasd.W.isDown,
    down: cursors.down.isDown || wasd.S.isDown,
  };
}

/** Normalize held keys: full deflection, diagonals scaled to unit length. */
export function keyboardToInput(keys: KeyState): MovementInput {
  let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (vx !== 0 && vy !== 0) {
    const inv = 1 / Math.hypot(vx, vy);
    vx *= inv;
    vy *= inv;
  }
  return { vectorX: vx, vectorY: vy, magnitude: vx === 0 && vy === 0 ? 0 : 1, source: "keyboard" };
}
