// Portable wrangler resolver (M12.7): always returns the wrangler .js entry
// so callers can execFileSync(process.execPath, [js, ...args]) on any OS.
// Order: workspace-local install, node_modules/wrangler layout next to a
// PATH bin dir, author's legacy global path. Throws when absent.
import { existsSync } from "node:fs";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const LEGACY_GLOBAL_JS =
  "C:\\Users\\bimap\\AppData\\Roaming\\npm\\node_modules\\wrangler\\bin\\wrangler.js";

export function resolveWranglerJs() {
  const localJs = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
  if (existsSync(localJs)) return localJs;
  const pathDirs = (process.env.PATH ?? "").split(delimiter);
  for (const dir of pathDirs) {
    if (!dir) continue;
    for (const cand of [
      join(dir, "node_modules", "wrangler", "bin", "wrangler.js"),
      join(dir, "..", "node_modules", "wrangler", "bin", "wrangler.js"),
    ]) {
      if (existsSync(cand)) return cand;
    }
  }
  if (existsSync(LEGACY_GLOBAL_JS)) return LEGACY_GLOBAL_JS;
  throw new Error("wrangler not found (run pnpm install to get the workspace-local copy)");
}
