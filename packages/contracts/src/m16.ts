// M16 operations contracts: projects, guest import, analytics, bootstrap.
// Pure Zod boundary — no Node APIs so web + workers can share it.
import { z } from "zod";

export const projectSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);
export type ProjectSlug = z.infer<typeof projectSlugSchema>;

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(80),
  slug: projectSlugSchema.optional(),
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  status: z.enum(["draft", "live", "archived"]).optional(),
});
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

export function slugifyProject(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length > 0 ? base : "wedding";
}

export const guestImportRowSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().max(32).optional(),
  email: z.string().max(120).optional(),
  group: z.string().max(64).optional(),
  notes: z.string().max(280).optional(),
});
export type GuestImportRow = z.infer<typeof guestImportRowSchema>;

export const analyticsEventNames = [
  "guest_link_opened",
  "session_started",
  "onboarding_completed",
  "game_ready",
  "book_opened",
  "heart_collected",
  "finale_reached",
  "rsvp_submitted",
  "wish_submitted",
] as const;
export const analyticsEventSchema = z.object({
  type: z.enum(analyticsEventNames),
  guestId: z.string().min(1).max(64).optional(),
});
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export const analyticsSummarySchema = z.object({
  totalGuests: z.number().int().nonnegative(),
  uniqueOpened: z.number().int().nonnegative(),
  uniqueStarted: z.number().int().nonnegative(),
  heartsCollected: z.number().int().nonnegative(),
  finaleReached: z.number().int().nonnegative(),
  wishes: z.number().int().nonnegative(),
  rsvps: z.number().int().nonnegative(),
});
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

export const bootstrapResponseSchema = z.object({
  guest: z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
  }),
  project: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
  }),
  session: z.string().nullable(),
  sessionGuest: z
    .object({ displayName: z.string(), avatarId: z.string() })
    .nullable(),
  publication: z
    .object({ snapshot: z.record(z.string(), z.unknown()), version: z.number() })
    .nullable(),
  world: z.object({ manifestRef: z.string().nullable() }),
  realtime: z.object({ enabled: z.boolean(), room: z.string().optional() }),
});
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
