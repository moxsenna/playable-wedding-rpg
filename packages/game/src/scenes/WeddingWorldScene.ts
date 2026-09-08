import { Scene } from "phaser";
import { BRIDGE_EVENTS, EventBus } from "../bridge";
import { parseWorldDefinition, type WorldDefinition } from "../world/loader";
import { createAvatarAnims, LocalPlayer } from "../actors/player";
import { spawnNpcActors, type NpcActor } from "../actors/npc";
import { keyboardToInput, readKeyboard } from "../input/keyboard";
import { neutralInput } from "../input/types";
import { TouchHud } from "../input/touch-hud";
import { PRIORITY, selectTarget, type InteractionCandidate } from "../systems/interaction/select";
import { dispatchSemanticAction } from "../systems/semantic-actions";
import type { AvatarDefinition, AvatarRegistry, NpcBinding, RuntimeEnvRegistry } from "@wedding-rpg/contracts";
import { landmarkIdSchema } from "@wedding-rpg/contracts";
import type { HudScene } from "./HudScene";
import { MANIFEST_URL } from "./PreloadScene";

const TILE_LAYERS = [
  "00_Ground",
  "01_Ground_Detail",
  "02_Paths",
  "03_Water",
  "04_Building_Base",
  "05_Decoration_Below",
  "06_Collision",
  "11_Decoration_Above",
  "12_Roof_Above",
];

// The one persistent world scene for V1: map, local player, collision,
// camera. Wedding memories are content inside this world, never new scenes.
export class WeddingWorldScene extends Scene {
  private player!: LocalPlayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private hud: TouchHud | null = null;
  private def!: WorldDefinition;
  private npcs: NpcActor[] = [];
  private target: NpcActor | null = null;
  private dialogueOpen = false;
  private lastLabel = "";
  private navMarker: Phaser.GameObjects.Text | null = null;
  private navZoneId: string | null = null;

  constructor() {
    super("WeddingWorld");
  }

  create(): void {
    const manifest = this.cache.json.get("world-manifest") as {
      templateKey: string;
      version: number;
      placements?: string;
      environment?: { base: string };
    };
    const mapJson = this.cache.json.get("world-map-json") as Parameters<
      typeof parseWorldDefinition
    >[2];
    const placementsDoc = this.cache.json.get("world-placements");
    this.def = parseWorldDefinition(MANIFEST_URL, manifest, mapJson, placementsDoc);

    const map = this.make.tilemap({ key: "world-map" });
    const tilesetName = map.tilesets[0]?.name ?? "wedding-garden-terrain-v2";
    const tileset = map.addTilesetImage(tilesetName, "terrain-tiles");
    if (!tileset) throw new Error(`tileset ${tilesetName} missing from world map`);

    const layers: Record<string, Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer> = {};
    for (const name of TILE_LAYERS) {
      const layer = map.createLayer(name, tileset, 0, 0);
      if (!layer) throw new Error(`world map missing layer instance: ${name}`);
      layers[name] = layer;
    }

    const coll = layers["06_Collision"];
    coll.setVisible(false);
    coll.setCollisionByExclusion([-1, 0]);
    // Overhead layers always render above actors; actors Y-sort among themselves.
    layers["11_Decoration_Above"].setDepth(100);
    layers["12_Roof_Above"].setDepth(101);

    const worldW = map.widthInPixels;
    const worldH = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldW, worldH);

    const avatarRegistry = this.registry.get("avatarRegistry") as AvatarRegistry | undefined;
    const playerAvatarId = (this.registry.get("playerAvatarId") as string | undefined) ?? "guest_01";
    const playerAvatar = avatarRegistry?.avatars[playerAvatarId];
    if (!playerAvatar) throw new Error(`player avatar missing from registry: ${playerAvatarId}`);
    createAvatarAnims(this, playerAvatar);
    const spawn = this.def.spawns["spawn.default"];
    this.player = new LocalPlayer(this, spawn.x, spawn.y, playerAvatar);
    this.physics.add.collider(this.player.sprite, coll);

    const kb = this.input.keyboard;
    if (!kb) throw new Error("keyboard input unavailable");
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
    this.hud = null;
    this.scene.launch("Hud");

    const stored = this.registry.get("npcBindingsParsed") as NpcBinding[] | undefined;
    const bindings = Array.isArray(stored) ? stored : [];
    try {
      const avatarById = new Map<string, AvatarDefinition>(Object.entries(avatarRegistry.avatars));
      for (const b of bindings) {
        const a = avatarById.get(b.avatarId);
        if (a) createAvatarAnims(this, a);
      }
      this.npcs = spawnNpcActors(this, this.def, bindings, avatarById);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      this.npcs = [];
    }
    for (const npc of this.npcs) {
      this.physics.add.collider(this.player.sprite, npc.sprite);
    }
    this.spawnPlacements();
    EventBus.on(BRIDGE_EVENTS.interactPressed, this.onInteractPressed, this);
    EventBus.on(BRIDGE_EVENTS.dialogueClosed, this.onDialogueClosed, this);
    EventBus.on(BRIDGE_EVENTS.dialogueAction, this.onDialogueAction, this);
    EventBus.on(BRIDGE_EVENTS.navigateToLandmark, this.onNavigateToLandmark, this);
    kb.on("keydown-E", this.onInteractPressed, this);
    kb.on("keydown-SPACE", this.onInteractPressed, this);
    this.sys.events.once("shutdown", this.unsubscribeBridge, this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.setZoom(2);
    cam.setDeadzone(12, 12);
    cam.setRoundPixels(true);
    cam.startFollow(this.player.sprite, false, 0.14, 0.14);

    EventBus.emit(BRIDGE_EVENTS.currentSceneReady, this);

    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      (window as unknown as { __wedding: unknown }).__wedding = {
        scene: this,
        player: this.player,
        def: this.def,
        input: null as TouchHud | null,
        events: EventBus,
        targetId: () => this.getTargetId(),
        interactLabel: () => this.hud?.getInteractLabel() ?? "Aksi",
        debugTeleport: (x: number, y: number) => {
          this.player.sprite.body?.reset(x, y);
        },
      };
    }
  }

  getTargetId(): string | null {
    return this.target?.slotId ?? null;
  }

  private onNavigateToLandmark(payload: { landmarkId?: string }): void {
    const parsed = landmarkIdSchema.safeParse(payload?.landmarkId);
    if (!parsed.success) {
      console.warn("ignoring navigate with unknown landmark");
      return;
    }
    const zone = this.def.landmarks[parsed.data];
    if (!zone) {
      console.warn(`ignoring navigate to missing zone: ${parsed.data}`);
      return;
    }
    this.clearNavMarker();
    this.navZoneId = parsed.data;
    this.navMarker = this.add
      .text(zone.x + zone.w / 2, zone.y - 10, "▼", {
        fontSize: "20px",
        color: "#ffd98a",
        stroke: "#1a2233",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(150);
  }

  private clearNavMarker(): void {
    this.navMarker?.destroy();
    this.navMarker = null;
    this.navZoneId = null;
  }

  private facingVector(): { x: number; y: number } {
    switch (this.player.facing) {
      case "up":
        return { x: 0, y: -1 };
      case "down":
        return { x: 0, y: 1 };
      case "left":
        return { x: -1, y: 0 };
      case "right":
        return { x: 1, y: 0 };
    }
  }

  private refreshTarget(): void {
    const facing = this.facingVector();
    const candidates: InteractionCandidate[] = this.npcs.map((n) => ({
      id: n.slotId,
      x: n.sprite.x,
      y: n.sprite.y,
      priority: PRIORITY.npc,
      enabled: !this.dialogueOpen,
    }));
    const id = selectTarget(
      candidates,
      { x: this.player.sprite.x, y: this.player.sprite.y, facingX: facing.x, facingY: facing.y }
    );
    const next = id ? this.npcs.find((n) => n.slotId === id) ?? null : null;
    if (next !== this.target) {
      this.target?.setTargeted(false);
      this.target = next;
      this.target?.setTargeted(true);
    }
    const label = next ? next.interactLabel : "Aksi";
    if (label !== this.lastLabel) {
      this.lastLabel = label;
      this.hud?.setInteractLabel(label);
    }
  }

  private onInteractPressed(): void {
    if (this.dialogueOpen || !this.target) return;
    if (this.hud && this.hud.touchCapable && this.hud.isSuspended()) return;
    this.openDialogue(this.target);
  }

  private openDialogue(npc: NpcActor): void {
    this.dialogueOpen = true;
    this.player.sprite.setVelocity(0, 0);
    this.hud?.suspend("dialogue");
    EventBus.emit(BRIDGE_EVENTS.dialogueOpened, {
      npcId: npc.binding.npcId,
      displayName: npc.binding.displayName,
      dialogue: npc.binding.dialogue,
    });
  }

  private onDialogueClosed(): void {
    this.dialogueOpen = false;
    this.hud?.resume("dialogue");
  }

  private onDialogueAction(payload: { action?: { type?: string }; npcId?: string }): void {
    const type = payload?.action?.type;
    if (typeof type !== "string") {
      console.warn("ignoring dialogue action without type");
      return;
    }
    const result = dispatchSemanticAction(type);
    if (!result.handled) console.warn(result.reason);
  }

  private spawnPlacements(): void {
    const env = this.registry.get("environmentRegistry") as RuntimeEnvRegistry | undefined;
    if (!env) throw new Error("environment registry missing from game registry");
    for (const p of this.def.placements) {
      const def = env.assets[p.asset];
      if (!def) throw new Error(`placement references unknown environment asset: ${p.asset}`);
      const img = this.add.image(p.x, p.y, `wedding-${def.atlas}`, def.frame);
      img.setOrigin(def.origin.x, def.origin.y);
      img.setScale(p.scale ?? def.displayScale);
      if (p.flipX) img.setFlipX(true);
      img.setDepth(p.ground ? 1 : p.layer === "above" ? 150 : p.y);
    }
  }

  private unsubscribeBridge(): void {
    EventBus.off(BRIDGE_EVENTS.interactPressed, this.onInteractPressed, this);
    EventBus.off(BRIDGE_EVENTS.dialogueClosed, this.onDialogueClosed, this);
    EventBus.off(BRIDGE_EVENTS.dialogueAction, this.onDialogueAction, this);
    EventBus.off(BRIDGE_EVENTS.navigateToLandmark, this.onNavigateToLandmark, this);
  }

  update(): void {
    if (!this.hud) {
      const hudScene = this.scene.get("Hud") as HudScene | null;
      if (!hudScene?.hud) return;
      this.hud = hudScene.hud;
      const w = window as unknown as { __wedding?: { input?: TouchHud | null } };
      if (w.__wedding) w.__wedding.input = this.hud;
    }
    if (this.dialogueOpen) {
      this.player.update(neutralInput("keyboard"));
      return;
    }
    this.refreshTarget();
    if (this.navZoneId) {
      const z = this.def.landmarks[this.navZoneId];
      const px = this.player.sprite.x;
      const py = this.player.sprite.y;
      if (z && px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) {
        this.clearNavMarker();
      }
    }
    // Stick wins while deflected; keyboard is the desktop fallback.
    const stick = this.hud.consume();
    const keys = keyboardToInput(readKeyboard(this.cursors, this.wasd));
    this.player.update(stick.magnitude > 0.01 ? stick : keys);
  }
}
