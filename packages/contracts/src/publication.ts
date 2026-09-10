// New-RPG publication contract: the canonical wedding data model that NPC
// content, Wedding Book, and (M8+) the durable backend all share.
// Old publication.scenes[] is obsolete; this schema versions the replacement.
import { z } from "zod";
import { landmarkIdSchema } from "./shared";
import type { BookSection } from "./npc";

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM");

export const coupleProfileSchema = z.object({
  partnerA: z.string().min(1).max(40),
  partnerB: z.string().min(1).max(40),
  dateISO,
  welcome: z.string().min(1).max(300),
  heroImage: z.string().min(1).max(256).optional(),
  photo: z.string().url().max(512).optional(),
  nicknameA: z.string().min(1).max(40).optional(),
  nicknameB: z.string().min(1).max(40).optional(),
  bio: z.string().min(1).max(600).optional(),
});
export type CoupleProfile = z.infer<typeof coupleProfileSchema>;

/** Internal kinds stay lowercase; guests only ever see `title`. */
export const eventKindSchema = z.enum(["akad", "reception", "afterparty", "other"]);
export type EventKind = z.infer<typeof eventKindSchema>;

export const weddingEventSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: eventKindSchema,
    title: z.string().min(1).max(80),
    dateISO,
    timeStart: clockTime,
    timeEnd: clockTime,
    venueId: z.string().min(1).max(64),
  })
  .superRefine((e, ctx) => {
    if (/RECEPTION|CEREMONY/.test(e.title)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "event title leaks internal enum name" });
    }
  });
export type WeddingEvent = z.infer<typeof weddingEventSchema>;

export const venueSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  address: z.string().min(1).max(200),
  mapsUrl: z.string().url().max(512).optional(),
  landmarkId: landmarkIdSchema.optional(),
});
export type Venue = z.infer<typeof venueSchema>;

export const storyItemSchema = z.object({
  title: z.string().min(1).max(80),
  text: z.string().min(1).max(600),
});
export type StoryItem = z.infer<typeof storyItemSchema>;

export const galleryImageSchema = z.object({
  src: z.string().min(1).max(256),
  alt: z.string().min(1).max(120),
  cover: z.boolean().optional(),
});
export type GalleryImage = z.infer<typeof galleryImageSchema>;

export const giftInfoSchema = z.object({
  bankName: z.string().min(1).max(80),
  accountNumber: z.string().min(1).max(64),
  accountName: z.string().min(1).max(80),
  note: z.string().max(200).optional(),
  ewalletProvider: z.string().min(1).max(40).optional(),
  ewalletNumber: z.string().min(1).max(64).optional(),
  ewalletName: z.string().min(1).max(80).optional(),
  registryUrl: z.string().url().max(512).optional(),
});
export type GiftInfo = z.infer<typeof giftInfoSchema>;

export const weddingModulesSchema = z.object({
  rsvp: z.boolean(),
  gift: z.boolean(),
  gallery: z.boolean(),
});
export type WeddingModules = z.infer<typeof weddingModulesSchema>;

export const worldRefSchema = z.object({
  templateKey: z.string().min(1).max(64),
  templateVersion: z.number().int().positive(),
});
export type WorldRef = z.infer<typeof worldRefSchema>;

export const publicationSchema = z
  .object({
    id: z.string().min(1).max(64),
    couple: coupleProfileSchema,
    events: z.array(weddingEventSchema).min(1).max(12),
    venues: z.array(venueSchema).min(1).max(8),
    dresscode: z.object({ text: z.string().min(1).max(400) }).optional(),
    gallery: z.array(galleryImageSchema).max(24).default([]),
    gift: giftInfoSchema.optional(),
    story: z.array(storyItemSchema).min(1).max(12),
    modules: weddingModulesSchema,
    world: worldRefSchema,
  })
  .superRefine((p, ctx) => {
    const venueIds = new Set(p.venues.map((v) => v.id));
    for (const e of p.events) {
      if (!venueIds.has(e.venueId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `event ${e.id} references unknown venue ${e.venueId}` });
      }
    }
    const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
    for (const d of dupes(p.events.map((e) => e.id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate event id: ${d}` });
    }
    for (const d of dupes(p.venues.map((v) => v.id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate venue id: ${d}` });
    }
    if (p.gallery.filter((g) => g.cover === true).length > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "at most one gallery cover" });
    }
  });
export type Publication = z.infer<typeof publicationSchema>;

export interface PublicationValidation {
  ok: boolean;
  publication: Publication | null;
  errors: string[];
}

export function validatePublication(data: unknown): PublicationValidation {
  const parsed = publicationSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      publication: null,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { ok: true, publication: parsed.data, errors: [] };
}

const SECTION_ORDER: BookSection[] = [
  "home",
  "events",
  "venue",
  "dresscode",
  "gallery",
  "rsvp",
  "gift",
  "story",
];

/** Visible sections in nav order. Absent/empty optionals never appear. */
export function visibleSections(pub: Publication): BookSection[] {
  return SECTION_ORDER.filter((s) => {
    switch (s) {
      case "home":
      case "events":
      case "venue":
      case "story":
        return true;
      case "dresscode":
        return pub.dresscode !== undefined;
      case "gallery":
        return pub.modules.gallery;
      case "rsvp":
        return pub.modules.rsvp;
      case "gift":
        return pub.modules.gift && pub.gift !== undefined;
    }
  });
}
