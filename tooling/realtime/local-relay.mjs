// Local realtime relay for M10 probes only (M11 replaces it with the
// Cloudflare Durable Object room). Speaks protocol V1 over WebSocket:
// welcome/join/snapshot/left/emote/presence broadcast. Display names come
// from the connection query (?name=); nothing here is trusted in production.
// Usage: node tooling/realtime/local-relay.mjs <port>
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rootRequire = createRequire(join(ROOT, "package.json"));
const { WebSocketServer } = rootRequire("ws");

const PORT = Number(process.argv[2] ?? "8112");
if (!Number.isInteger(PORT)) {
  console.error("usage: node tooling/realtime/local-relay.mjs <port>");
  process.exit(1);
}

const ALLOWED = new Set([
  "client.hello",
  "player.move",
  "player.idle",
  "player.emote",
  "client.ping",
]);

let seq = 0;
const players = new Map();

const send = (ws, type, payload, seqOut) => {
  ws.send(JSON.stringify({ v: 1, type, seq: seqOut ?? 0, ts: Date.now(), payload }));
};

const broadcast = (except, type, payload) => {
  for (const [id, p] of players) {
    if (id === except || p.ws.readyState !== 1) continue;
    send(p.ws, type, payload);
  }
};

const wss = new WebSocketServer({ port: PORT });
wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://local");
  const displayName = (url.searchParams.get("name") || "Tamu").slice(0, 40);
  seq += 1;
  const playerId = `p_${seq}`;
  const self = {
    ws,
    playerId,
    displayName,
    avatarId: "guest_01",
    x: 440,
    y: 1160,
    facing: "down",
    movement: "idle",
  };

  ws.on("message", (buf) => {
    const raw = String(buf);
    if (raw.length > 4096) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || msg.v !== 1 || !ALLOWED.has(msg.type)) return;
    const p = msg.payload ?? {};
    if (msg.type === "client.hello") {
      if (typeof p.avatarId === "string" && p.avatarId.length <= 64) self.avatarId = p.avatarId;
      players.set(playerId, self);
      send(ws, "room.welcome", {
        self: { playerId, displayName, avatarId: self.avatarId },
        room: { mapId: "garden-village-v1", onlineCount: players.size },
        players: [...players.values()]
          .filter((o) => o.playerId !== playerId)
          .map((o) => ({
            playerId: o.playerId,
            displayName: o.displayName,
            avatarId: o.avatarId,
            x: o.x,
            y: o.y,
            facing: o.facing,
          })),
      });
      broadcast(playerId, "player.joined", {
        playerId,
        displayName,
        avatarId: self.avatarId,
        x: self.x,
        y: self.y,
        facing: self.facing,
      });
      broadcast(playerId, "room.presence", { onlineCount: players.size });
    } else if (msg.type === "player.move" || msg.type === "player.idle") {
      if (!players.has(playerId)) return;
      if (typeof p.x === "number" && typeof p.y === "number") {
        self.x = p.x;
        self.y = p.y;
      }
      if (typeof p.facing === "string") self.facing = p.facing;
      self.movement = msg.type === "player.move" ? "walk" : "idle";
      broadcast(playerId, "player.snapshot", {
        playerId,
        x: self.x,
        y: self.y,
        vx: p.vx ?? 0,
        vy: p.vy ?? 0,
        facing: self.facing,
        movement: self.movement,
      });
    } else if (msg.type === "player.emote") {
      if (!players.has(playerId) || typeof p.emote !== "string") return;
      broadcast(playerId, "player.emote", {
        playerId,
        emote: p.emote,
        expiresAt: Date.now() + 3000,
      });
    }
  });

  ws.on("close", () => {
    if (!players.has(playerId)) return;
    players.delete(playerId);
    broadcast(playerId, "player.left", { playerId });
    broadcast(playerId, "room.presence", { onlineCount: players.size });
  });
});

console.log(`LOCAL RELAY listening on ${PORT}`);
