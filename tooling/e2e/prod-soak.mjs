// Production soak (no secrets): repeated production page boots against the
// pinned R2 manifest via the API proxy + API health + world-config reads.
// Asserts every cycle boots to scene-ready with HUD and zero page errors.
// Prints PROD SOAK VERIFIED with per-cycle timings.
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB_DIR = join(ROOT, "apps/web");
const fail = (msg) => { console.error(`prod soak FAILED: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WEB = "https://wedding-rpg-bli.pages.dev";
const API = "https://wedding-rpg-api.moxsenna.workers.dev";
const CYCLES = Number(process.env.SOAK_CYCLES ?? "12");
const GAP_MS = Number(process.env.SOAK_GAP_MS ?? "60000");
const START_AT = Number(process.env.SOAK_START_AT ?? "1");
const BIN = process.platform === "win32" ? ".cmd" : "";

const webRequire = createRequire(join(WEB_DIR, "package.json"));
let chromium;
try {
  ({ chromium } = webRequire("playwright"));
} catch {
  fail("playwright not installed in apps/web");
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (e) {
    if (!/Executable doesn't exist/i.test(String(e && e.message))) throw e;
    execSync(`"${join(WEB_DIR, "node_modules", ".bin", `playwright${BIN}`)}" install chromium`, {
      cwd: WEB_DIR, stdio: "pipe", timeout: 420000,
    });
    return await chromium.launch();
  }
}

async function fetchJson(url, label, cycle) {
  let last = "";
  for (let a = 1; a <= 3; a++) {
    try {
      return await (await fetch(url)).json();
    } catch (e) {
      last = (e && e.message) || String(e);
      await sleep(5000);
    }
  }
  fail(`cycle ${cycle}: ${label} failed after 3 attempts (${last.slice(0, 120)})`);
  throw new Error("unreachable");
}

async function main() {
  const browser = await launchBrowser();
  const times = [];
  const retries = [];
  try {
    for (let i = START_AT; i <= CYCLES; i++) {
      const t0 = Date.now();
      const h = await fetchJson(`${API}/health`, "api health", i).catch(() => null);
      if (!h || h.ok !== true) fail(`cycle ${i}: api health bad`);
      const wc = await fetchJson(`${API}/v1/world-config?project=demo-ayu-bima`, "world-config", i).catch(() => null);
      if (!wc || !wc.manifestRef.endsWith("/manifest.json")) fail(`cycle ${i}: world-config bad`);

      let booted = false;
      let hud = "";
      let errs = [];
      for (let attempt = 1; attempt <= 2 && !booted; attempt++) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        errs = [];
        page.on("pageerror", (e) => errs.push(e.message));
        await page.addInitScript(() => {
          window.localStorage.setItem("wedding-rpg:profile", JSON.stringify({ name: "Dinda", avatarId: "guest_01" }));
        });
        await page.goto(`${WEB}/?wedding=demo-ayu-bima&api=${encodeURIComponent(API)}`, {
          waitUntil: "domcontentloaded", timeout: 60000,
        });
        try {
          await page.waitForSelector('#game-container[data-scene-ready="wedding-world"]', { timeout: 90000 });
          hud = await page.textContent('[data-testid="quest-hud"]');
          booted = hud.includes("OUR STORY") && errs.length === 0;
          if (!booted && attempt < 2) console.log(`cycle ${i}: attempt ${attempt} soft-fail, retrying`);
        } catch {
          if (attempt < 2) console.log(`cycle ${i}: attempt ${attempt} boot timeout, retrying`);
        }
        await ctx.close();
      }
      if (!booted) fail(`cycle ${i}: boot failed twice (hud=${hud.slice(0, 40)}, errs=${errs.join("|").slice(0, 200)})`);
      const dt = Date.now() - t0;
      times.push(dt);
      console.log(`cycle ${i}/${CYCLES}: boot+HUD ok in ${(dt / 1000).toFixed(1)}s`);
      if (i < CYCLES) await sleep(GAP_MS);
    }
  } finally {
    await browser.close();
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`PROD SOAK VERIFIED (${CYCLES} cycles, avg ${(avg / 1000).toFixed(1)}s, max ${(Math.max(...times) / 1000).toFixed(1)}s)`);
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
