// Local realtime test relay (M10/M14 probes). Speaks protocol V1 over
// WebSocket: session-verified hello + join/snapshot/left/emote/presence
// broadcast. Identity is server-derived: client.hello carries an opaque HMAC
// session minted by wedding-core signSession; displayName/avatar/project
// come from verified claims only. Usage:
//   ROOM_SECRET=<secret> node tooling/realtime/local-relay.mjs <port>
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rootRequire = createRequire(join(ROOT, "package.json"));
const { WebSocketServer } = rootRequire("ws");

const PORT = Number(process.argv[2] ?? "8112");
const SECRET = process.env.ROOM_SECRET ?? "";
if (!Number.isInteger(PORT)) {
  console.error("usage: node tooling/realtime/local-relay.mjs <port>");
  process.exit(1);
}

const text = new TextEncoder();
function unb64url(s) {
  const bin = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return new Uint8Array(bin);
}
async function verifySession(session) {
  if (!SECRET || SECRET.length < 16) return null;
  const parts = String(session).split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const key = await crypto.subtle.importKey(
    "raw", text.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  let sigBytes;
  try {
    sigBytes = unb64url(sig);
  } catch {
    return null;
  }
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, text.encode(body));
  if (!valid) return null;
  try {
    const claims = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    if (typeof claims.guestId !== "string" || typeof claims.projectId !== "string") return null;
    if (typeof claims.displayName !== "string" || typeof claims.avatarId !== "string") return null;
    if (typeof claims.exp !== "number" || Date.now() >= claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
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
wss.on("connection", (ws) => {
  seq += 1;
  const playerId = `p_${seq}`;
  const self = {
    ws,
    playerId,
    claims: null,
    x: 440,
    y: 1160,
    facing: "down",
    movement: "idle",
  };

  ws.on("message", async (buf) => {
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
      if (self.claims) return;
      if (typeof p.session !== "string") {
        ws.close(4400, "hello requires a session");
        return;
      }
      const claims = await verifySession(p.session);
      if (!claims) {
        ws.close(4400, "bad session");
        return;
      }
      self.claims = claims;
      players.set(playerId, self);
      send(ws, "room.welcome", {
        self: { playerId, displayName: claims.displayName, avatarId: claims.avatarId },
        room: { mapId: "garden-village-v1", onlineCount: players.size },
        players: [...players.values()]
          .filter((o) => o.playerId !== playerId)
          .map((o) => ({
            playerId: o.playerId,
            displayName: o.claims.displayName,
            avatarId: o.claims.avatarId,
            x: o.x,
            y: o.y,
            facing: o.facing,
          })),
      });
      broadcast(playerId, "player.joined", {
        playerId,
        displayName: claims.displayName,
        avatarId: claims.avatarId,
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
