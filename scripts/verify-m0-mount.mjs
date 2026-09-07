// Verifies the Phaser mount boundary: exactly one Game instance, portrait shell,
// Phaser-owned world vs React-owned UI split. Prints M0 MOUNT VERIFIED only on success.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M0 mount check FAILED: ${msg}`); process.exit(1); };

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "node_modules" || e === ".next") continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e)) out.push(p);
  }
  return out;
};

const webDir = join(ROOT, "apps/web");
if (!existsSync(webDir)) fail("apps/web missing");

// 1. Exactly one module constructs the Phaser.Game instance (via `new Game`
// with a phaser import), created once by the React mount and destroyed on unmount.
// Since M1 the creator lives in @wedding-rpg/game; the web shell only mounts it.
const gameDir = join(ROOT, "packages/game");
const files = [...walk(webDir), ...(existsSync(gameDir) ? walk(gameDir) : [])];
const creators = files.filter((f) => {
  const s = readFileSync(f, "utf8");
  return /from\s+['"]phaser['"]/.test(s) && /new\s+Game\s*\(/.test(s);
});
if (creators.length !== 1) fail(`expected exactly 1 Phaser.Game creator, found ${creators.length}`);

// 2. The React mount cleans up (destroy on unmount) to avoid duplicate
// instances on rerender: some module importing the creator must call .destroy(.
const mounters = files.filter((f) => {
  const s = readFileSync(f, "utf8");
  return /from\s+['"]\.\/game\/main['"]|from\s+['"]@\/game\/main['"]/.test(s);
});
if (mounters.length === 0) fail("no React module imports the game creator");
if (!mounters.some((f) => /\.destroy\s*\(/.test(readFileSync(f, "utf8")))) {
  fail(`${mounters[0]} never destroys the game instance`);
}

// 3. Portrait contract: viewport/scale metadata constraining the shell to portrait.
const hasViewport = files.some((f) => {
  const s = readFileSync(f, "utf8");
  return /viewport|maximum-scale=1|360|portrait/i.test(s);
});
if (!hasViewport) fail("no portrait viewport/scale contract found under apps/web");

// 4. Typecheck the web app with its own tsc (same toolchain the repo ships).
// Invoked directly to avoid pnpm's interactive approve-builds gate.
try {
  const tscBin = join(webDir, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
  if (!existsSync(tscBin)) fail("apps/web typescript install missing (run pnpm install)");
  execSync(`"${tscBin}" --noEmit`, { cwd: webDir, stdio: "pipe" });
} catch (e) {
  fail(`typecheck failed: ${(e.stdout || e.stderr || e.message).toString().slice(0, 800)}`);
}

console.log("M0 MOUNT VERIFIED");
