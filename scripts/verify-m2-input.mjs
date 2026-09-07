// M2 pure input-logic oracle: deadzone, clamp, diagonal normalization,
// IDLE/TOUCH_START/DRAGGING/RELEASED transitions, keyboard adapter.
// The sources are dependency-free TypeScript; this script transpiles them
// with the repo's own typescript (no duplication) and runs the assertions.
// Prints M2 INPUT VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M2 input check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(tmpdir(), "m2input-"));
try {
  for (const name of ["joystick-state", "keyboard"]) {
    const src = readFileSync(join(ROOT, "packages/game/src/input", `${name}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    if (out.diagnostics && out.diagnostics.length > 0) fail(`transpile errors in ${name}.ts`);
    writeFileSync(join(tmp, `${name}.js`), out.outputText);
  }
  const req = createRequire(join(tmp, "x.js"));
  const { JoystickState } = req(join(tmp, "joystick-state.js"));
  const { keyboardToInput } = req(join(tmp, "keyboard.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };
  const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

  // --- state machine ---
  let j = new JoystickState({ radius: 56, deadzone: 0.22 });
  ok(j.getPhase() === "IDLE", "starts IDLE");
  let o = j.press();
  ok(o.phase === "TOUCH_START" && o.magnitude === 0, "press -> TOUCH_START neutral");
  o = j.drag(5, 0);
  ok(o.phase === "DRAGGING" && o.magnitude === 0 && o.vectorX === 0, "deadzone absorbs small drag");
  o = j.drag(56, 0);
  ok(o.phase === "DRAGGING" && approx(o.magnitude, 1) && approx(o.vectorX, 1) && approx(o.vectorY, 0), "full deflection");
  o = j.drag(200, -30);
  ok(approx(o.magnitude, 1), "magnitude clamps to 1");
  ok(approx(Math.hypot(o.vectorX, o.vectorY), 1), "clamped vector stays unit");
  o = j.drag(40, 40);
  ok(approx(o.magnitude, 1), "diagonal magnitude is 1, not sqrt(2)");
  ok(approx(Math.hypot(o.vectorX, o.vectorY), 1), "diagonal vector normalized");
  o = j.drag(20, 0);
  ok(approx(o.magnitude, 20 / 56) && approx(o.vectorX, 20 / 56), "partial deflection scales");
  o = j.release();
  ok(o.phase === "RELEASED" && o.magnitude === 0, "release observes RELEASED neutral");
  ok(j.getPhase() === "IDLE", "release settles back to IDLE");

  // strict machine: drag without press is ignored
  j = new JoystickState({ radius: 56, deadzone: 0.22 });
  o = j.drag(50, 0);
  ok(o.phase === "IDLE" && o.magnitude === 0, "drag-from-IDLE ignored");

  // modal path: reset() jumps straight to IDLE neutral
  j.press();
  j.drag(40, 0);
  o = j.reset();
  ok(o.phase === "IDLE" && o.magnitude === 0 && j.getPhase() === "IDLE", "reset forces IDLE neutral");
  o = j.press();
  ok(o.phase === "TOUCH_START", "machine reusable after reset");

  // defaults match the HUD geometry
  j = new JoystickState();
  o = j.press();
  o = j.drag(56, 0);
  ok(approx(o.magnitude, 1), "default radius is 56");

  // --- keyboard adapter ---
  const K = (keys) => keyboardToInput({ left: false, right: false, up: false, down: false, ...keys });
  o = K({});
  ok(o.magnitude === 0 && o.vectorX === 0 && o.vectorY === 0 && o.source === "keyboard", "neutral keys");
  o = K({ right: true });
  ok(o.vectorX === 1 && o.vectorY === 0 && o.magnitude === 1, "right full deflection");
  o = K({ up: true, left: true });
  ok(approx(o.vectorX, -1 / Math.SQRT2) && approx(o.vectorY, -1 / Math.SQRT2) && o.magnitude === 1, "diagonal normalized");
  o = K({ left: true, right: true });
  ok(o.vectorX === 0 && o.magnitude === 0, "opposing keys cancel");
  o = K({ up: true, down: true });
  ok(o.vectorY === 0 && o.magnitude === 0, "opposing vertical keys cancel");

  console.log(`M2 INPUT VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
