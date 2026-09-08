// Durable wedding domain (M8): guests, tokens, RSVP, guestbook, immutable
// publication versions, audit events. Schemas only — services live in
// @wedding-rpg/wedding-core. Storage-agnostic: Neon/Drizzle (M12) persists
// these shapes unchanged.
import { z } from "zod";

export const guestIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/);
export type GuestId = z.infer<typeof guestIdSchema>;

export const guestTokenSchema = z.string().min(8).max(64).regex(/^gt_[A-Za-z0-9_-]+$/);
export type GuestToken = z.infer<typeof guestTokenSchema>;

export const guestSchema = z.object({
  id: guestIdSchema,
  name: z.string().min(1).max(80),
  token: guestTokenSchema,
  createdAt: z.number().int().nonnegative(),
});
export type Guest = z.infer<typeof guestSchema>;

export const rsvpChoiceSchema = z.enum(["hadir", "tidak"]);
export type RsvpChoice = z.infer<typeof rsvpChoiceSchema>;

export const rsvpRecordSchema = z.object({
  token: guestTokenSchema,
  name: z.string().min(1).max(80),
  attending: rsvpChoiceSchema,
  partySize: z.number().int().min(1).max(6),
  updatedAt: z.number().int().nonnegative(),
});
export type RsvpRecord = z.infer<typeof rsvpRecordSchema>;

export const guestbookEntrySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(40),
  message: z.string().min(1).max(280),
  createdAt: z.number().int().nonnegative(),
});
export type GuestbookEntry = z.infer<typeof guestbookEntrySchema>;

export const versionStatusSchema = z.enum(["draft", "published", "active", "archived"]);
export type VersionStatus = z.infer<typeof versionStatusSchema>;

export const publicationVersionSchema = z.object({
  id: z.string().min(1).max(64),
  publicationId: z.string().min(1).max(64),
  version: z.number().int().positive(),
  status: versionStatusSchema,
  snapshot: z.record(z.string(), z.unknown()),
  createdAt: z.number().int().nonnegative(),
});
export type PublicationVersion = z.infer<typeof publicationVersionSchema>;

export const auditEventSchema = z.object({
  id: z.string().min(1).max(64),
  at: z.number().int().nonnegative(),
  actor: z.string().min(1).max(80),
  action: z.string().min(1).max(64),
  detail: z.string().max(280).optional(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
