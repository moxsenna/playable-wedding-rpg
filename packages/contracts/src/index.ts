// Shared typed boundary for the wedding RPG.
// Phaser owns world/actors/camera; React owns DOM UI; the realtime room speaks
// this protocol. All schemas are Zod-validated at every trust boundary.
// Source: REALTIME_PROTOCOL.md (v1) + WORLD_DESIGN.md slot/landmark IDs.
import { z } from "zod";

export * from "./npc";
export * from "./quest";
export * from "./durable";
export * from "./protocol";
export * from "./publication";
export * from "./avatar";
export * from "./environment";
export * from "./m16";

export const PROTOCOL_VERSION = 1 as const;

/** World template key pinned by every V1 publication. */
export const WORLD_TEMPLATE_KEY = "garden-village-v1" as const;

/** Cardinal facing shared by player state, NPCs, and network snapshots. */
export { directionSchema, movementStateSchema, emoteSchema } from "./shared";
export type { Direction, MovementState, Emote } from "./shared";

/** Bounded JSON envelope for every realtime message. */
export const realtimeEnvelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.string().min(1).max(64),
  seq: z.number().int().nonnegative().optional(),
  ts: z.number().int().nonnegative().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type RealtimeEnvelope = z.infer<typeof realtimeEnvelopeSchema>;

/** Reserved NPC slot IDs (WORLD_DESIGN.md section 7). Map places, wedding config fills. */
export { npcSlotIds, npcSlotIdSchema } from "./shared";
export type { NpcSlotId } from "./shared";

/** Reserved spawn points (WORLD_DESIGN.md section 8). */
export const spawnPointIds = [
  "spawn.default",
  "spawn.returning",
  "spawn.wedding_hall",
  "spawn.preview",
] as const;
export const spawnPointIdSchema = z.enum(spawnPointIds);

/** Reserved landmark zones (WORLD_DESIGN.md section 9). */
export { landmarkIds, landmarkIdSchema } from "./shared";
export type { LandmarkId } from "./shared";

/** Main-quest heart IDs for `collect-our-story-v1` (RPG_GAMEPLAY_SPEC.md section 10). */
export { heartIds, heartIdSchema } from "./shared";
export type { HeartId } from "./shared";
