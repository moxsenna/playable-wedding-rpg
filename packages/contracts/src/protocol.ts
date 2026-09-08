// Realtime protocol V1 (M10, session-bound since M12.5): bounded JSON
// envelopes + allowlisted message set per REALTIME_PROTOCOL.md. Identity is
// never client-supplied: client.hello carries an opaque HMAC session minted
// by the API worker; the room verifies it and derives guest/project/name/
// avatar from claims. All inbound traffic validates here; the server (M11)
// and the client net layer share these schemas.
import { z } from "zod";
import { directionSchema, emoteSchema, movementStateSchema } from "./shared";

/** Max inbound WebSocket message: 4KB. Anything larger is a strike. */
export const MAX_MESSAGE_BYTES = 4096;

export const PROTOCOL_CLIENT_VERSION = "1.0.0" as const;

const finite = z.number().finite();
const boundedCoord = finite.min(-4096).max(4096);

export const helloPayloadSchema = z.object({
  session: z.string().min(8).max(2048),
  clientVersion: z.string().min(1).max(32),
});
export type HelloPayload = z.infer<typeof helloPayloadSchema>;

export const movePayloadSchema = z.object({
  x: boundedCoord,
  y: boundedCoord,
  vx: finite.min(-400).max(400),
  vy: finite.min(-400).max(400),
  facing: directionSchema,
  movement: movementStateSchema,
});
export type MovePayload = z.infer<typeof movePayloadSchema>;

export const idlePayloadSchema = z.object({
  x: boundedCoord,
  y: boundedCoord,
  facing: directionSchema,
});
export type IdlePayload = z.infer<typeof idlePayloadSchema>;

export const emotePayloadSchema = z.object({
  emote: emoteSchema,
});
export type EmotePayload = z.infer<typeof emotePayloadSchema>;

export const clientMessageTypes = [
  "client.hello",
  "player.move",
  "player.idle",
  "player.emote",
  "client.ping",
] as const;
export const clientMessageTypeSchema = z.enum(clientMessageTypes);

export const welcomePayloadSchema = z.object({
  self: z.object({
    playerId: z.string().min(1).max(64),
    displayName: z.string().min(1).max(40),
    avatarId: z.string().min(1).max(64),
  }),
  room: z.object({
    mapId: z.string().min(1).max(64),
    onlineCount: z.number().int().nonnegative().max(1000),
  }),
  players: z
    .array(
      z.object({
        playerId: z.string().min(1).max(64),
        displayName: z.string().min(1).max(40),
        avatarId: z.string().min(1).max(64),
        x: boundedCoord,
        y: boundedCoord,
        facing: directionSchema,
      })
    )
    .max(64),
});
export type WelcomePayload = z.infer<typeof welcomePayloadSchema>;

export const joinedPayloadSchema = z.object({
  playerId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(40),
  avatarId: z.string().min(1).max(64),
  x: boundedCoord,
  y: boundedCoord,
  facing: directionSchema,
});
export type JoinedPayload = z.infer<typeof joinedPayloadSchema>;

export const snapshotPayloadSchema = z.object({
  playerId: z.string().min(1).max(64),
  x: boundedCoord,
  y: boundedCoord,
  vx: finite.min(-400).max(400),
  vy: finite.min(-400).max(400),
  facing: directionSchema,
  movement: movementStateSchema,
});
export type SnapshotPayload = z.infer<typeof snapshotPayloadSchema>;

export const leftPayloadSchema = z.object({
  playerId: z.string().min(1).max(64),
});
export type LeftPayload = z.infer<typeof leftPayloadSchema>;

export const remoteEmotePayloadSchema = z.object({
  playerId: z.string().min(1).max(64),
  emote: emoteSchema,
  expiresAt: z.number().int().nonnegative(),
});
export type RemoteEmotePayload = z.infer<typeof remoteEmotePayloadSchema>;

export const presencePayloadSchema = z.object({
  onlineCount: z.number().int().nonnegative().max(1000),
});
export type PresencePayload = z.infer<typeof presencePayloadSchema>;

export const serverMessageTypes = [
  "room.welcome",
  "player.joined",
  "player.snapshot",
  "player.left",
  "player.emote",
  "room.presence",
  "server.error",
] as const;
export const serverMessageTypeSchema = z.enum(serverMessageTypes);

export const envelopeSchema = z.object({
  v: z.literal(1),
  type: z.string().min(1).max(64),
  seq: z.number().int().nonnegative().max(1_000_000_000).optional(),
  ts: z.number().int().nonnegative().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type Envelope = z.infer<typeof envelopeSchema>;

export type EnvelopeCheck =
  | { ok: true; type: string; seq?: number; ts?: number; payload: Record<string, unknown> }
  | { ok: false; reason: string };

/** Validate one inbound frame: size bound, envelope shape, allowlisted type. */
export function checkEnvelope(
  raw: string,
  allowed: readonly string[]
): EnvelopeCheck {
  if (raw.length > MAX_MESSAGE_BYTES) return { ok: false, reason: "oversize frame" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed json" };
  }
  const parsed = envelopeSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "bad envelope" };
  if (!allowed.includes(parsed.data.type)) return { ok: false, reason: `unknown type: ${parsed.data.type}` };
  return {
    ok: true,
    type: parsed.data.type,
    seq: parsed.data.seq,
    ts: parsed.data.ts,
    payload: parsed.data.payload,
  };
}
