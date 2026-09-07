// Typed NPC configuration boundary (WORLD_DESIGN + RPG_GAMEPLAY_SPEC + ADMIN).
// Tiled owns placement; this schema owns content. Actor code never branches
// on couple identity: NpcActor + NpcBinding + DialogueRuntime + dispatcher.
import { z } from "zod";
import { heartIdSchema, npcSlotIdSchema, npcSlotIds } from "./shared";

export const npcRoles = [
  "greeter",
  "rsvp",
  "story",
  "photo",
  "travel",
  "event",
  "venue",
  "proposal",
  "memory",
  "couple",
  "decorative",
] as const;
export const npcRoleSchema = z.enum(npcRoles);
export type NpcRole = z.infer<typeof npcRoleSchema>;

/** Allowlisted semantic actions. Quest-owned entries exist as contract only (M5). */
export const npcActionTypes = [
  "OPEN_WEDDING_BOOK",
  "OPEN_WEDDING_BOOK_SECTION",
  "OPEN_RSVP",
  "OPEN_GALLERY",
  "OPEN_MAPS",
  "OPEN_GUESTBOOK",
  "START_MAIN_QUEST",
  "GRANT_HEART",
  "START_FINALE",
] as const;
export const npcActionTypeSchema = z.enum(npcActionTypes);
export type NpcActionType = z.infer<typeof npcActionTypeSchema>;

/** Wedding Book sections addressable from NPC deep links (ADMIN §6). */
export const bookSections = [
  "home",
  "events",
  "venue",
  "dresscode",
  "gallery",
  "rsvp",
  "gift",
  "story",
] as const;
export const bookSectionSchema = z.enum(bookSections);
export type BookSection = z.infer<typeof bookSectionSchema>;

export const npcSemanticActionSchema = z.object({
  type: npcActionTypeSchema,
  section: bookSectionSchema.optional(),
});
export type NpcSemanticAction = z.infer<typeof npcSemanticActionSchema>;

export const dialogueNodeSchema = z.object({
  id: z.string().min(1).max(64),
  speaker: z.string().min(1).max(40).optional(),
  text: z.string().min(1).max(280),
  next: z.string().min(1).max(64).optional(),
  action: npcSemanticActionSchema.optional(),
});
export type DialogueNode = z.infer<typeof dialogueNodeSchema>;

/** Linear-by-default dialogue: unique ids, every `next` must resolve. */
export const dialogueSchema = z
  .array(dialogueNodeSchema)
  .min(1)
  .max(24)
  .superRefine((nodes, ctx) => {
    const ids = new Set<string>();
    for (const n of nodes) {
      if (ids.has(n.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate dialogue id: ${n.id}` });
      }
      ids.add(n.id);
    }
    for (const n of nodes) {
      if (n.next !== undefined && !ids.has(n.next)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown next ref: ${n.next}` });
      }
    }
  });

export const npcBindingSchema = z.object({
  slotId: npcSlotIdSchema,
  npcId: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  role: npcRoleSchema,
  displayName: z.string().min(1).max(40),
  avatarId: z.string().min(1).max(64),
  dialogue: dialogueSchema,
  actions: z.array(npcSemanticActionSchema).max(8).default([]),
  interactLabel: z.string().min(1).max(24).optional(),
  questRewardId: heartIdSchema.optional(),
});
export type NpcBinding = z.infer<typeof npcBindingSchema>;

export interface NpcValidationResult {
  ok: boolean;
  bindings: NpcBinding[];
  errors: string[];
}

/**
 * Validate a wedding's NPC bindings: shape first, then world rules —
 * every required Tiled slot bound exactly once, no unknown slots,
 * every avatar resolvable against the published avatar manifest.
 */
export function validateNpcBindings(
  bindings: unknown,
  validAvatars: readonly string[]
): NpcValidationResult {
  const parsed = z.array(npcBindingSchema).safeParse(bindings);
  if (!parsed.success) {
    return {
      ok: false,
      bindings: [],
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  const errors: string[] = [];
  const counts = new Map<string, number>();
  parsed.data.forEach((b, i) => {
    counts.set(b.slotId, (counts.get(b.slotId) ?? 0) + 1);
    if (!validAvatars.includes(b.avatarId)) {
      errors.push(`[${i}] ${b.slotId}: unknown avatarId ${b.avatarId}`);
    }
  });
  for (const [slot, count] of counts) {
    if (count > 1) errors.push(`duplicate slot binding: ${slot} x${count}`);
  }
  for (const slot of npcSlotIds) {
    if (!counts.has(slot)) errors.push(`missing required slot: ${slot}`);
  }
  return { ok: errors.length === 0, bindings: parsed.data, errors };
}
