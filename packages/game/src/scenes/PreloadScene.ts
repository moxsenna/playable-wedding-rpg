import { Scene } from "phaser";
import { BRIDGE_EVENTS, EventBus } from "../bridge";
import { validateNpcBindings, runtimeEnvRegistrySchema, type AvatarRegistry, type NpcBinding, type RuntimeEnvRegistry } from "@wedding-rpg/contracts";

export const DEFAULT_MANIFEST_URL = "/assets/worlds/garden-village-v1/manifest.json";
export const MANIFEST_URL = DEFAULT_MANIFEST_URL;
export const LEGACY_AVATAR_BASE = "/assets/avatars/";
export const LEGACY_ENV_BASE = "/assets/environment/";
export const AVATAR_REGISTRY_URL = `${LEGACY_AVATAR_BASE}avatar-registry.json`;
export const ENV_REGISTRY_URL = `${LEGACY_ENV_BASE}environment-registry.json`;

interface RuntimeManifest {
  tilemap: string;
  placements?: string;
  gates?: string;
  avatars?: {
    prefix?: string;
    registry?: string;
  };
  environment?: {
    base: string;
    registry: string;
    terrainImage: string;
    atlases: Record<string, { png: string; json: string }>;
  };
}

export class PreloadScene extends Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    const manifestUrl =
      (this.registry.get("manifestUrl") as string | undefined) ?? DEFAULT_MANIFEST_URL;
    this.registry.set("manifestUrl", manifestUrl);
    this.load.json("world-manifest", manifestUrl);
  }

  create(): void {
    const manifest = this.cache.json.get("world-manifest") as RuntimeManifest;
    if (!manifest || typeof manifest.tilemap !== "string") {
      throw new Error("world manifest missing tilemap entry");
    }
    const env = manifest.environment;
    if (!env || typeof env.base !== "string" || !env.atlases) {
      throw new Error("world manifest missing environment section");
    }
    // Pinned dependency prefixes come from the published version manifest;
    // dev (unpublished) manifests fall back to the legacy shared paths.
    // Site-root convention: manifest payload paths resolve against "/"
    // so nested routes boot the same files; absolute R2 bases unchanged.
    const siteResolve = (p: string): string =>
      /^https?:\/\//i.test(p) || p.startsWith("/") ? p : `/${p}`;
    const envBase = siteResolve(env.base);
    const avatarBase = siteResolve(manifest.avatars?.prefix ?? LEGACY_AVATAR_BASE);
    this.load.json("avatar-registry", `${avatarBase}avatar-registry.json`);
    this.load.json("environment-registry", `${envBase}${env.registry}`);
    this.load.once("complete", () => this.continueBoot(manifest, envBase, avatarBase));
    this.load.start();
  }

  private continueBoot(manifest: RuntimeManifest, envBase: string, avatarBase: string): void {
    const env = manifest.environment;
    if (!env || typeof env.base !== "string" || !env.atlases) {
      throw new Error("world manifest missing environment section");
    }
    const registry = this.cache.json.get("avatar-registry") as AvatarRegistry | undefined;
    if (!registry || typeof registry.avatars !== "object") {
      throw new Error("avatar registry missing or malformed");
    }
    const raw = this.registry.get("npcBindings") as unknown;
    const checked = validateNpcBindings(raw ?? [], Object.keys(registry.avatars));
    let bindings: NpcBinding[];
    if (!checked.ok) {
      const msg = `invalid NPC bindings: ${checked.errors.join("; ")}`;
      if (process.env.NODE_ENV !== "production") throw new Error(msg);
      console.error(msg);
      bindings = [];
    } else {
      bindings = checked.bindings;
    }
    this.registry.set("npcBindingsParsed", bindings);
    this.registry.set("avatarRegistry", registry);
    const envChecked = runtimeEnvRegistrySchema.safeParse(
      this.cache.json.get("environment-registry")
    );
    if (!envChecked.success) {
      const msg = `invalid environment registry: ${envChecked.error.issues.map((i) => i.message).join("; ")}`;
      if (process.env.NODE_ENV !== "production") throw new Error(msg);
      console.error(msg);
    }
    if (envChecked.success) {
      this.registry.set("environmentRegistry", envChecked.data);
    }
    const playerAvatarId = (this.registry.get("playerAvatarId") as string | undefined) ?? "guest_01";
    const needed = new Set(bindings.map((b) => b.avatarId));
    needed.add(playerAvatarId);
    for (const id of needed) {
      const def = registry.avatars[id];
      if (!def) {
        const msg = `unknown avatar referenced: ${id}`;
        if (process.env.NODE_ENV !== "production") throw new Error(msg);
        console.error(msg);
        continue;
      }
      this.load.spritesheet(id, `${avatarBase}${id}.png`, {
        frameWidth: def.sprite.frameWidth,
        frameHeight: def.sprite.frameHeight,
      });
    }

    const manifestUrl =
      (this.registry.get("manifestUrl") as string | undefined) ?? DEFAULT_MANIFEST_URL;
    const base = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
    this.load.on("progress", (p: number) => {
      EventBus.emit(BRIDGE_EVENTS.gameLoadingProgress, p);
    });
    this.load.tilemapTiledJSON("world-map", base + manifest.tilemap);
    this.load.json("world-map-json", base + manifest.tilemap);
    this.load.json("world-placements", base + (manifest.placements ?? "placements.json"));
    this.load.json("world-gates", base + (manifest.gates ?? "gates.json"));
    this.load.image("terrain-tiles", envBase + env.terrainImage);
    for (const [key, ref] of Object.entries(env.atlases)) {
      this.load.atlas(`wedding-${key}`, envBase + ref.png, envBase + ref.json);
    }
    this.load.once("complete", () => this.scene.start("WeddingWorld"));
    this.load.start();
  }
}
