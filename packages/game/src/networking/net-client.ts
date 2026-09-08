// Realtime client (§3-4, §13-14, §16, §18): lifecycle, throttled move,
// immediate idle, emote rate limit, validated inbound, backoff reconnect.
// Transport- and clock-injectable so node verifiers drive it without sockets.
import {
  PROTOCOL_CLIENT_VERSION,
  checkEnvelope,
  emotePayloadSchema,
  idlePayloadSchema,
  joinedPayloadSchema,
  leftPayloadSchema,
  movePayloadSchema,
  presencePayloadSchema,
  remoteEmotePayloadSchema,
  serverMessageTypes,
  snapshotPayloadSchema,
  welcomePayloadSchema,
  type EmotePayload,
  type IdlePayload,
  type MovePayload,
} from "@wedding-rpg/contracts";

export type NetState = "idle" | "connecting" | "joined" | "reconnecting" | "closed";

export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface NetClientOptions {
  openSocket: () => SocketLike;
  now?: () => number;
  moveIntervalMs?: number;
  emoteIntervalMs?: number;
  maxBackoffMs?: number;
}

export interface NetEvents {
  onState?: (s: NetState) => void;
  onWelcome?: (p: unknown) => void;
  onJoined?: (p: unknown) => void;
  onSnapshot?: (p: unknown, serverTs: number) => void;
  onLeft?: (playerId: string) => void;
  onEmote?: (p: unknown) => void;
  onPresence?: (count: number) => void;
  onError?: (reason: string) => void;
}

const MOVE_MS = 100;
const EMOTE_MS = 2000;
const BACKOFF_CAP_MS = 10000;
const MAX_STRIKES = 3;

export class NetClient {
  private socket: SocketLike | null = null;
  private state: NetState = "idle";
  private seq = 0;
  private strikes = 0;
  private lastMoveAt = -Infinity;
  private lastEmoteAt = -Infinity;
  private lastSent: MovePayload | null = null;
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly now: () => number;

  constructor(
    private readonly opts: NetClientOptions,
    private readonly events: NetEvents = {}
  ) {
    this.now = opts.now ?? Date.now;
  }

  getState(): NetState {
    return this.state;
  }

  connect(mapId: string, avatarId: string): void {
    if (this.state === "connecting" || this.state === "joined") return;
    this.setState("connecting");
    const socket = this.opts.openSocket();
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      this.strikes = 0;
      this.send("client.hello", {
        mapId,
        avatarId,
        clientVersion: PROTOCOL_CLIENT_VERSION,
      });
    };
    socket.onmessage = (ev) => this.handleFrame(ev.data);
    socket.onclose = () => this.scheduleReconnect(mapId, avatarId);
    socket.onerror = () => {
      this.events.onError?.("socket error");
    };
  }

  private scheduleReconnect(mapId: string, avatarId: string): void {
    if (this.state === "closed") return;
    this.setState("reconnecting");
    this.socket = null;
    this.attempts += 1;
    const backoff = Math.min(
      this.opts.maxBackoffMs ?? BACKOFF_CAP_MS,
      500 * 2 ** Math.min(this.attempts, 5) + Math.floor(Math.random() * 250)
    );
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.setState("idle");
      this.connect(mapId, avatarId);
    }, backoff);
  }

  close(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.setState("closed");
    this.socket?.close();
    this.socket = null;
  }

  private setState(s: NetState): void {
    this.state = s;
    this.events.onState?.(s);
  }

  private send(type: string, payload: Record<string, unknown>): void {
    if (!this.socket) return;
    this.seq += 1;
    this.socket.send(JSON.stringify({ v: 1, type, seq: this.seq, ts: this.now(), payload }));
  }

  sendMove(m: MovePayload): boolean {
    const t = this.now();
    const same =
      this.lastSent &&
      this.lastSent.x === m.x &&
      this.lastSent.y === m.y &&
      this.lastSent.facing === m.facing &&
      this.lastSent.movement === m.movement;
    if (same) return false;
    if (t - this.lastMoveAt < (this.opts.moveIntervalMs ?? MOVE_MS)) return false;
    if (!movePayloadSchema.safeParse(m).success) return false;
    this.lastMoveAt = t;
    this.lastSent = { ...m };
    this.send("player.move", { ...m });
    return true;
  }

  sendIdle(m: IdlePayload): boolean {
    if (!idlePayloadSchema.safeParse(m).success) return false;
    this.lastSent = null;
    this.send("player.idle", { ...m });
    return true;
  }

  sendEmote(e: EmotePayload): boolean {
    const t = this.now();
    if (t - this.lastEmoteAt < (this.opts.emoteIntervalMs ?? EMOTE_MS)) return false;
    if (!emotePayloadSchema.safeParse(e).success) return false;
    this.lastEmoteAt = t;
    this.send("player.emote", { ...e });
    return true;
  }

  private strike(reason: string): void {
    this.strikes += 1;
    this.events.onError?.(reason);
    if (this.strikes >= MAX_STRIKES) this.socket?.close();
  }

  private handleFrame(raw: string): void {
    const checked = checkEnvelope(raw, serverMessageTypes);
    if (!checked.ok) {
      this.strike(checked.reason);
      return;
    }
    const p = checked.payload;
    switch (checked.type) {
      case "room.welcome": {
        const w = welcomePayloadSchema.safeParse(p);
        if (!w.success) return this.strike("bad welcome");
        this.setState("joined");
        this.events.onWelcome?.(w.data);
        break;
      }
      case "player.joined": {
        const j = joinedPayloadSchema.safeParse(p);
        if (!j.success) return this.strike("bad joined");
        this.events.onJoined?.(j.data);
        break;
      }
      case "player.snapshot": {
        const s = snapshotPayloadSchema.safeParse(p);
        if (!s.success) return this.strike("bad snapshot");
        this.events.onSnapshot?.(s.data, checked.ts ?? this.now());
        break;
      }
      case "player.left": {
        const l = leftPayloadSchema.safeParse(p);
        if (!l.success) return this.strike("bad left");
        this.events.onLeft?.(l.data.playerId);
        break;
      }
      case "player.emote": {
        const e = remoteEmotePayloadSchema.safeParse(p);
        if (!e.success) return this.strike("bad emote");
        this.events.onEmote?.(e.data);
        break;
      }
      case "room.presence": {
        const pr = presencePayloadSchema.safeParse(p);
        if (!pr.success) return this.strike("bad presence");
        this.events.onPresence?.(pr.data.onlineCount);
        break;
      }
      default:
        break;
    }
  }
}
