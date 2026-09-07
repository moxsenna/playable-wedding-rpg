import { Scene } from "phaser";
import { BRIDGE_EVENTS, EventBus } from "../bridge";
import { validateNpcBindings, type NpcBinding } from "@wedding-rpg/contracts";

export const MANIFEST_URL = "assets/worlds/garden-village-v1/manifest.json";

interface RuntimeManifest {
  tilemap: string;
}

interface AvatarsManifest {
  avatars: { id: string; file: string }[];
}

export class PreloadScene extends Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    this.load.json("world-manifest", MANIFEST_URL);
    const base = MANIFEST_URL.slice(0, MANIFEST_URL.lastIndexOf("/") + 1);
    this.load.json("avatars-manifest", `${base}sprites/avatars.json`);
  }

  create(): void {
    const manifest = this.cache.json.get("world-manifest") as RuntimeManifest;
    if (!manifest || typeof manifest.tilemap !== "string") {
      throw new Error("world manifest missing tilemap entry");
    }
    const base = MANIFEST_URL.slice(0, MANIFEST_URL.lastIndexOf("/") + 1);
    const avatarsManifest = this.cache.json.get("avatars-manifest") as AvatarsManifest | undefined;
    const knownAvatars = new Set((avatarsManifest?.avatars ?? []).map((a) => a.id));
    const raw = this.registry.get("npcBindings") as unknown;
    const checked = validateNpcBindings(raw ?? [], [...knownAvatars]);
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
    const usedAvatars = [...new Set(bindings.map((b) => b.avatarId))];

    this.load.on("progress", (p: number) => {
      EventBus.emit(BRIDGE_EVENTS.gameLoadingProgress, p);
    });
    this.load.tilemapTiledJSON("world-map", base + manifest.tilemap);
    this.load.json("world-map-json", base + manifest.tilemap);
    this.load.image("wedding-garden", `${base}tileset.png`);
    this.load.spritesheet("guest_01", `${base}sprites/guest_01.png`, {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.json("guest_01-meta", `${base}sprites/guest_01.json`);
    for (const id of usedAvatars) {
      this.load.spritesheet(id, `${base}sprites/avatars/${id}.png`, {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    this.load.once("complete", () => this.scene.start("WeddingWorld"));
    this.load.start();
  }
}
