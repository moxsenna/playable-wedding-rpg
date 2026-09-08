import { z } from "zod";

/** Cardinal facing shared by player state, NPCs, and network snapshots. */
export const directionSchema = z.enum(["up", "down", "left", "right"]);
export type Direction = z.infer<typeof directionSchema>;

/** Local animation movement state (no sprint/combat in V1). */
export const movementStateSchema = z.enum(["idle", "walk"]);
export type MovementState = z.infer<typeof movementStateSchema>;

/** V1 social emotes. Free-text chat is explicitly out of scope. */
export const emoteSchema = z.enum(["wave", "heart", "celebrate", "laugh", "blessing"]);
export type Emote = z.infer<typeof emoteSchema>;

/** IDs shared by the wedding publication, world template, and quest systems. */
export const npcSlotIds = [
  "npc.greeter",
  "npc.rsvp_keeper",
  "npc.story_keeper",
  "npc.photographer",
  "npc.travel_friend",
  "npc.event_coordinator",
  "npc.venue_guide",
  "npc.proposal_friend",
  "npc.couple_a",
  "npc.couple_b",
] as const;
export const npcSlotIdSchema = z.enum(npcSlotIds);
export type NpcSlotId = z.infer<typeof npcSlotIdSchema>;

export const heartIds = [
  "heart.first_meeting",
  "heart.memories",
  "heart.journey",
  "heart.proposal",
] as const;
export const heartIdSchema = z.enum(heartIds);
export type HeartId = z.infer<typeof heartIdSchema>;

/** Reserved landmark zones (WORLD_DESIGN.md section 9). */
export const landmarkIds = [
  "landmark.entrance",
  "landmark.rsvp",
  "landmark.photo",
  "landmark.main_plaza",
  "landmark.memory_garden",
  "landmark.event_pavilion",
  "landmark.couple_garden",
  "landmark.wedding_hall",
] as const;
export const landmarkIdSchema = z.enum(landmarkIds);
export type LandmarkId = z.infer<typeof landmarkIdSchema>;
