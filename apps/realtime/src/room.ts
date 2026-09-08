import { DurableObject } from "cloudflare:workers";
import {
  MAX_MESSAGE_BYTES,
  checkEnvelope,
  clientMessageTypes,
  emotePayloadSchema,
  helloPayloadSchema,
  idlePayloadSchema,
  movePayloadSchema,
  type MovePayload,
} from "@wedding-rpg/contracts";

interface Env {
  WEDDING_ROOM: DurableObjectNamespace;
}

interface RoomPlayer {
  playerId: string;
  displayName: string;
  avatarId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: string;
  movement: string;
  lastSeq: number;
  lastMoveAt: number;
  lastEmoteAt: number;
  strikes: number;
}

const MOVE_BUDGET_MS = 50;
const MAX_MOVE_PER_SEC = 20;
const EMOTE_MS = 2000;
const MAX_STRIKES = 3;
const ROOM_KEY_RE = /^[a-z0-9_-]{1,64}$/;

function send(ws: WebSocket, type: string, payload: Record<string, unknown>): void {
  ws.send(JSON.stringify({ v: 1, type, seq: 0, ts: Date.now(), payload }));
}

export class WeddingRoom extends DurableObject<Env> {
  private seq = 0;
  private readonly players = new Map<WebSocket, RoomPlayer>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("wedding room: websocket only", { status: 426 });
    }
    const roomId = url.searchParams.get("room") ?? "demo-ayu-bima";
    if (!ROOM_KEY_RE.test(roomId)) return new Response("bad room", { status: 400 });
    // M11 local trust: display name from query. M12 resolves guest identity
    // server-side from the token against Neon; never trust these fields there.
    const displayName = (url.searchParams.get("name") ?? "Tamu").slice(0, 40);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    const player: RoomPlayer = {
      playerId: "",
      displayName,
      avatarId: "guest_01",
      x: 440,
      y: 1160,
      vx: 0,
      vy: 0,
      facing: "down",
      movement: "idle",
      lastSeq: -1,
      lastMoveAt: 0,
      lastEmoteAt: 0,
      strikes: 0,
    };
    (server as WebSocket & { __player?: RoomPlayer }).__player = player;
    this.players.set(server, player);
    void client;
    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(except: WebSocket, type: string, payload: Record<string, unknown>): void {
    for (const ws of this.players.keys()) {
      if (ws === except) continue;
      try {
        send(ws, type, payload);
      } catch {
        /* drop on next tick */
      }
    }
  }

  private strike(ws: WebSocket, player: RoomPlayer): void {
    player.strikes += 1;
    if (player.strikes >= MAX_STRIKES) {
      try {
        ws.close(4400, "protocol violations");
      } catch {
        /* already gone */
      }
    }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const player = this.players.get(ws);
    if (!player) return;
    const text = typeof raw === "string" ? raw : "";
    if (text.length === 0 || text.length > MAX_MESSAGE_BYTES) {
      this.strike(ws, player);
      return;
    }
    const checked = checkEnvelope(text, clientMessageTypes);
    if (!checked.ok) {
      this.strike(ws, player);
      return;
    }
    if (checked.seq !== undefined) {
      if (checked.seq <= player.lastSeq) return;
      player.lastSeq = checked.seq;
    }
    const p = checked.payload as Record<string, unknown>;
    switch (checked.type) {
      case "client.hello": {
        if (player.playerId) break;
        const h = helloPayloadSchema.safeParse(p);
        if (!h.success) {
          this.strike(ws, player);
          break;
        }
        this.seq += 1;
        player.playerId = `p_${this.seq}`;
        player.avatarId = h.data.avatarId;
        const others = [...this.players.values()].filter((o) => o !== player && o.playerId);
        send(ws, "room.welcome", {
          self: { playerId: player.playerId, displayName: player.displayName, avatarId: player.avatarId },
          room: { mapId: h.data.mapId, onlineCount: this.players.size },
          players: others.map((o) => ({
            playerId: o.playerId,
            displayName: o.displayName,
            avatarId: o.avatarId,
            x: o.x,
            y: o.y,
            facing: o.facing,
          })),
        });
        this.broadcast(ws, "player.joined", {
          playerId: player.playerId,
          displayName: player.displayName,
          avatarId: player.avatarId,
          x: player.x,
          y: player.y,
          facing: player.facing,
        });
        this.broadcast(ws, "room.presence", { onlineCount: this.players.size });
        break;
      }
      case "player.move":
      case "player.idle": {
        if (!player.playerId) {
          this.strike(ws, player);
          break;
        }
        const schema = checked.type === "player.move" ? movePayloadSchema : idlePayloadSchema;
        const m = schema.safeParse(p);
        if (!m.success) {
          this.strike(ws, player);
          break;
        }
        const now = Date.now();
        if (now - player.lastMoveAt < MOVE_BUDGET_MS) break;
        const moves = (player as RoomPlayer & { windowCount?: number }).windowCount ?? 0;
        if (now - player.lastMoveAt > 1000) {
          (player as RoomPlayer & { windowCount?: number }).windowCount = 1;
        } else if (moves >= MAX_MOVE_PER_SEC) {
          break;
        } else {
          (player as RoomPlayer & { windowCount?: number }).windowCount = moves + 1;
        }
        player.lastMoveAt = now;
        const mv = m.data as Partial<MovePayload> & { x: number; y: number; facing: string };
        player.x = mv.x;
        player.y = mv.y;
        player.facing = mv.facing;
        player.movement = checked.type === "player.move" ? "walk" : "idle";
        this.broadcast(ws, "player.snapshot", {
          playerId: player.playerId,
          x: player.x,
          y: player.y,
          vx: "vx" in mv && typeof mv.vx === "number" ? mv.vx : 0,
          vy: "vy" in mv && typeof mv.vy === "number" ? mv.vy : 0,
          facing: player.facing,
          movement: player.movement,
        });
        break;
      }
      case "player.emote": {
        if (!player.playerId) {
          this.strike(ws, player);
          break;
        }
        const e = emotePayloadSchema.safeParse(p);
        if (!e.success) {
          this.strike(ws, player);
          break;
        }
        const now = Date.now();
        if (now - player.lastEmoteAt < EMOTE_MS) break;
        player.lastEmoteAt = now;
        this.broadcast(ws, "player.emote", {
          playerId: player.playerId,
          emote: e.data.emote,
          expiresAt: now + 3000,
        });
        break;
      }
      default:
        break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const player = this.players.get(ws);
    this.players.delete(ws);
    if (player?.playerId) {
      this.broadcast(ws, "player.left", { playerId: player.playerId });
      this.broadcast(ws, "room.presence", { onlineCount: this.players.size });
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname.startsWith("/room")) {
      const roomId = url.searchParams.get("room") ?? "demo-ayu-bima";
      const stub = env.WEDDING_ROOM.getByName(`wedding:${roomId}:garden-village-v1`);
      return stub.fetch(request);
    }
    return new Response("not found", { status: 404 });
  },
};
