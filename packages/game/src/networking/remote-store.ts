// Remote player set (§7, §10 Phase A): join/snapshot/left transitions plus
// emote expiry. Rendering reads this; networking writes it. No Phaser.
import { SnapshotBuffer, type TransformSnapshot } from "./interpolation";

export interface RemotePlayer {
  playerId: string;
  displayName: string;
  avatarId: string;
  facing: string;
  movement: string;
  buffer: SnapshotBuffer;
  emote: string | null;
  emoteExpiresAt: number;
  lastSeenAt: number;
}

const STALE_MS = 15000;

export class RemotePlayerStore {
  private readonly players = new Map<string, RemotePlayer>();

  join(p: { playerId: string; displayName: string; avatarId: string; x: number; y: number; facing: string }, now: number): RemotePlayer {
    const snap: TransformSnapshot = { serverTs: now, x: p.x, y: p.y, vx: 0, vy: 0 };
    const existing = this.players.get(p.playerId);
    if (existing) {
      existing.displayName = p.displayName;
      existing.avatarId = p.avatarId;
      existing.buffer.push(snap);
      existing.lastSeenAt = now;
      return existing;
    }
    const player: RemotePlayer = {
      playerId: p.playerId,
      displayName: p.displayName,
      avatarId: p.avatarId,
      facing: p.facing,
      movement: "idle",
      buffer: new SnapshotBuffer(),
      emote: null,
      emoteExpiresAt: 0,
      lastSeenAt: now,
    };
    player.buffer.push(snap);
    this.players.set(p.playerId, player);
    return player;
  }

  snapshot(
    p: { playerId: string; x: number; y: number; vx: number; vy: number; facing: string; movement: string },
    serverTs: number,
    now: number
  ): RemotePlayer | null {
    const player = this.players.get(p.playerId);
    if (!player) return null;
    player.buffer.push({ serverTs, x: p.x, y: p.y, vx: p.vx, vy: p.vy });
    player.facing = p.facing;
    player.movement = p.movement;
    player.lastSeenAt = now;
    return player;
  }

  emote(playerId: string, emote: string, expiresAt: number): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.emote = emote;
    player.emoteExpiresAt = expiresAt;
    return true;
  }

  leave(playerId: string): boolean {
    return this.players.delete(playerId);
  }

  prune(now: number): string[] {
    const gone: string[] = [];
    for (const [id, p] of this.players) {
      if (p.emote && now >= p.emoteExpiresAt) p.emote = null;
      if (now - p.lastSeenAt > STALE_MS) {
        this.players.delete(id);
        gone.push(id);
      }
    }
    return gone;
  }

  get(playerId: string): RemotePlayer | undefined {
    return this.players.get(playerId);
  }

  ids(): string[] {
    return [...this.players.keys()];
  }

  count(): number {
    return this.players.size;
  }
}
