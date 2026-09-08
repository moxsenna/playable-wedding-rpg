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
import {
  createQuestState,
  grantHeart,
  startQuest,
  type QuestDefinitionLike,
  type QuestStateLike,
} from "../systems/quest/quest-controller";
import { NetClient, type SocketLike } from "../networking/net-client";
import { RemotePlayerStore, type RemotePlayer } from "../networking/remote-store";
import { INTERP_DELAY_MS } from "../networking/interpolation";
import type {
  AvatarDefinition,
  AvatarRegistry,
  Direction,
  MovementState,
  NpcBinding,
  RuntimeEnvRegistry,
} from "@wedding-rpg/contracts";
import { collectOurStoryDefinition, type QuestState } from "@wedding-rpg/contracts";
import { landmarkIdSchema } from "@wedding-rpg/contracts";
import type { HudScene } from "./HudScene";
import { MANIFEST_URL } from "./PreloadScene";

// Short toast labels per heart; the full story text lives in the publication.
const HEART_LABELS: Record<string, string> = {
  "heart.first_meeting": "Pertemuan Pertama",
  "heart.memories": "Momen Foto",
  "heart.journey": "Perjalanan",
  "heart.proposal": "Lamaran",
};

interface RemotePlayerSeed {
  playerId: string;
  displayName: string;
  avatarId: string;
  x: number;
  y: number;
  facing: Direction;
}

const EMOTE_GLYPHS: Record<string, string> = {
  wave: "Halo!",
  heart: "♥",
  celebrate: "Hore!",
  laugh: "Ha!",
  blessing: "Doa",
};

const TILE_LAYERS = [  "00_Ground",
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
  private questDef: QuestDefinitionLike = collectOurStoryDefinition();
  private quest: QuestStateLike = createQuestState(this.questDef);
  private collLayer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | null = null;
  private gateApplied = false;
  private insideGatePrev = false;
  private unlockMarker: Phaser.GameObjects.Text | null = null;
  private net: NetClient | null = null;
  private remotes = new RemotePlayerStore();
  private remoteViews = new Map<
    string,
    { sprite: Phaser.GameObjects.Sprite; tag: Phaser.GameObjects.Text; bubble: Phaser.GameObjects.Text }
  >();
  private netSelfId: string | null = null;
  private netWasMoving = false;

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
    const gatesDoc = this.cache.json.get("world-gates");
    this.def = parseWorldDefinition(MANIFEST_URL, manifest, mapJson, placementsDoc, gatesDoc);
    this.questDef = collectOurStoryDefinition();
    this.quest = createQuestState(this.questDef);
    this.gateApplied = false;
    this.insideGatePrev = false;

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
    this.collLayer = coll;
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
    EventBus.on(BRIDGE_EVENTS.emoteSelected, this.onEmoteSelected, this);
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
    this.maybeStartNet();

    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      (window as unknown as { __wedding: unknown }).__wedding = {
        scene: this,
        player: this.player,
        def: this.def,
        input: null as TouchHud | null,
        events: EventBus,
        targetId: () => this.getTargetId(),
        questState: () => ({ ...this.quest }),
        net: () => ({
          state: this.net?.getState() ?? "idle",
          selfId: this.netSelfId,
          remoteIds: this.remotes.ids(),
          remoteNames: Object.fromEntries(
            this.remotes.ids().map((id) => [id, this.remotes.get(id)?.displayName ?? null])
          ),
          remoteEmotes: Object.fromEntries(
            this.remotes.ids().map((id) => [id, this.remotes.get(id)?.emote ?? null])
          ),
          remotePos: Object.fromEntries(
            this.remotes.ids().map((id) => {
              const sample = this.remotes.get(id)?.buffer.sample(Date.now() - INTERP_DELAY_MS);
              return [id, sample ? { x: sample.x, y: sample.y } : null];
            })
          ),
        }),
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
    if (!result.handled) {
      console.warn(result.reason);
      return;
    }
    if (result.deferred === "quest") this.applyQuestAction(type, payload?.npcId);
  }

  private emitQuestState(): void {
    EventBus.emit(BRIDGE_EVENTS.questStateChanged, { state: { ...this.quest } as QuestState });
  }

  private applyQuestAction(type: string, npcId: string | undefined): void {
    if (type === "START_MAIN_QUEST") {
      const r = startQuest(this.questDef, this.quest);
      if (!r.ok) {
        console.warn(r.reason);
        return;
      }
      this.quest = r.state;
      this.emitQuestState();
      return;
    }
    if (type === "GRANT_HEART") {
      const binding = this.npcs
        .map((n) => n.binding)
        .find((b) => b.npcId === npcId);
      const heart = binding?.questRewardId;
      if (!heart) {
        console.warn(`ignoring GRANT_HEART without questRewardId: ${npcId ?? "unknown"}`);
        return;
      }
      const r = grantHeart(this.questDef, this.quest, heart);
      if (!r.ok) {
        console.warn(r.reason);
        return;
      }
      this.quest = r.state;
      this.emitQuestState();
      if (r.granted) {
        EventBus.emit(BRIDGE_EVENTS.memoryToast, { heart: r.granted, label: HEART_LABELS[r.granted] ?? r.granted });
      }
      if (r.completed) {
        EventBus.emit(BRIDGE_EVENTS.finaleUnlocked, { questId: this.questDef.questId });
      }
      return;
    }
    if (type === "START_FINALE") {
      if (!this.quest.finaleUnlocked) {
        console.warn("ignoring START_FINALE before the finale unlocks");
        return;
      }
      EventBus.emit(BRIDGE_EVENTS.finaleStarted, { questId: this.questDef.questId });
    }
  }

  private checkFinaleGate(): void {
    const gate = this.def.gates[0];
    if (!gate) return;
    const t = this.def.tileSize;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const inside =
      px >= gate.zoneTiles.x * t &&
      px < (gate.zoneTiles.x + gate.zoneTiles.w) * t &&
      py >= gate.zoneTiles.y * t &&
      py < (gate.zoneTiles.y + gate.zoneTiles.h) * t;
    if (!inside) {
      this.insideGatePrev = false;
      return;
    }
    if (this.quest.finaleUnlocked && !this.gateApplied) {
      this.gateApplied = true;
      const removable = this.collLayer as unknown as {
        removeTileAt?: (x: number, y: number) => void;
      } | null;
      for (const tile of gate.lockedTiles) removable?.removeTileAt?.(tile.x, tile.y);
      const cx = (gate.zoneTiles.x + gate.zoneTiles.w / 2) * t;
      this.unlockMarker = this.add
        .text(cx, gate.zoneTiles.y * t - 6, "✦ Aula Terbuka ✦", {
          fontSize: "14px",
          color: "#ffd98a",
          stroke: "#1a2233",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(150);
    }
    if (!this.quest.finaleUnlocked && !this.insideGatePrev) {
      EventBus.emit(BRIDGE_EVENTS.finaleGateBlocked, {
        collected: [...this.quest.collected],
        required: [...this.questDef.required],
      });
    }
    this.insideGatePrev = true;
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

  private maybeStartNet(): void {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const url = q.get("net");
    if (!url) return;
    const socketFor = (ws: WebSocket): SocketLike => ({
      send: (d: string) => ws.send(d),
      close: () => ws.close(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    });
    const client = new NetClient(
      {
        openSocket: () => {
          const ws = new WebSocket(url);
          const like = socketFor(ws);
          ws.onopen = () => like.onopen?.();
          ws.onmessage = (ev) => like.onmessage?.({ data: String(ev.data) });
          ws.onclose = () => like.onclose?.();
          ws.onerror = () => like.onerror?.();
          return like;
        },
      },
      {
        onWelcome: (p) => {
          const w = p as { self: { playerId: string }; players: RemotePlayerSeed[] };
          this.netSelfId = w.self.playerId;
          for (const seed of w.players) this.addRemoteView(seed, Date.now());
        },
        onJoined: (p) => this.addRemoteView(p as RemotePlayerSeed, Date.now()),
        onSnapshot: (p, ts) => {
          const s = p as {
            playerId: string;
            x: number;
            y: number;
            vx: number;
            vy: number;
            facing: Direction;
            movement: MovementState;
          };
          this.remotes.snapshot(
            { ...s, facing: s.facing as string, movement: s.movement as string },
            ts,
            Date.now()
          );
        },
        onLeft: (id) => this.dropRemoteView(id),
        onEmote: (p) => {
          const e = p as { playerId: string; emote: string; expiresAt: number };
          this.remotes.emote(e.playerId, e.emote, e.expiresAt);
        },
      }
    );
    this.net = client;
    client.connect(this.def.templateKey, (this.registry.get("playerAvatarId") as string | undefined) ?? "guest_01");
  }

  private addRemoteView(
    seed: RemotePlayerSeed,
    now: number
  ): void {
    if (seed.playerId === this.netSelfId) return;
    this.remotes.join({ ...seed, facing: seed.facing as string }, now);
    if (this.remoteViews.has(seed.playerId)) return;
    if (!this.textures.exists(seed.avatarId)) {
      console.warn(`ignoring remote with unknown avatar: ${seed.avatarId}`);
      return;
    }
    const sprite = this.add.sprite(seed.x, seed.y, seed.avatarId, 0);
    const tag = this.add
      .text(seed.x, seed.y - 26, seed.displayName, {
        fontSize: "11px",
        color: "#ffffff",
        stroke: "#1a2233",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const bubble = this.add
      .text(seed.x, seed.y - 40, "", { fontSize: "16px" })
      .setOrigin(0.5)
      .setVisible(false);
    this.remoteViews.set(seed.playerId, { sprite, tag, bubble });
  }

  private dropRemoteView(id: string): void {
    this.remotes.leave(id);
    const view = this.remoteViews.get(id);
    if (!view) return;
    view.sprite.destroy();
    view.tag.destroy();
    view.bubble.destroy();
    this.remoteViews.delete(id);
  }

  private publishNet(): void {
    if (!this.net || this.net.getState() !== "joined") return;
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;
    const moving = Math.hypot(vx, vy) > 5;
    if (moving) {
      this.net.sendMove({
        x: Math.round(this.player.sprite.x * 10) / 10,
        y: Math.round(this.player.sprite.y * 10) / 10,
        vx: Math.round(vx),
        vy: Math.round(vy),
        facing: this.player.facing,
        movement: "walk",
      });
    } else if (this.netWasMoving) {
      this.net.sendIdle({
        x: Math.round(this.player.sprite.x * 10) / 10,
        y: Math.round(this.player.sprite.y * 10) / 10,
        facing: this.player.facing,
      });
    }
    this.netWasMoving = moving;
  }

  private renderRemotes(): void {
    if (!this.net) return;
    const now = Date.now();
    for (const id of this.remotes.prune(now)) this.dropRemoteView(id);
    const renderTime = now - INTERP_DELAY_MS;
    for (const id of this.remotes.ids()) {
      const player = this.remotes.get(id);
      const view = this.remoteViews.get(id);
      if (!player || !view) continue;
      const sample = player.buffer.sample(renderTime);
      view.sprite.setPosition(sample.x, sample.y);
      view.sprite.setDepth(sample.y);
      view.tag.setPosition(sample.x, sample.y - 26);
      if (player.emote && now < player.emoteExpiresAt) {
        view.bubble.setText(EMOTE_GLYPHS[player.emote] ?? "!");
        view.bubble.setPosition(sample.x, sample.y - 40).setVisible(true);
      } else {
        view.bubble.setVisible(false);
      }
    }
  }

  private onEmoteSelected(payload: { emote?: string }): void {
    if (!this.net || this.net.getState() !== "joined") return;
    const emote = payload?.emote;
    if (emote !== "wave" && emote !== "heart" && emote !== "celebrate" && emote !== "laugh" && emote !== "blessing") {
      return;
    }
    this.net.sendEmote({ emote });
  }

  private unsubscribeBridge(): void {
    this.net?.close();
    this.net = null;
    EventBus.off(BRIDGE_EVENTS.emoteSelected, this.onEmoteSelected, this);
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
    this.checkFinaleGate();
    this.publishNet();
    this.renderRemotes();
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
