// Wedding snapshot envelope (M17): the persisted version payload that
// carries the validated publication together with its validated NPC
// bindings. The bare Publication shape stays exactly as Wedding Book,
// probes, and the lifecycle expect; the envelope wraps it without
// altering it. Zod strips unknown keys, so bindings must travel as an
// explicit validated field — never smuggled inside the publication.
import { z } from "zod";
import { npcBindingSchema, type NpcBinding } from "./npc";
import { publicationSchema, type Publication } from "./publication";

export const weddingSnapshotSchema = z.object({
  publication: publicationSchema,
  npcBindings: z.array(npcBindingSchema).min(1).max(24),
});
export type WeddingSnapshot = z.infer<typeof weddingSnapshotSchema>;

export interface EnvelopeLike {
  publication: unknown;
  npcBindings: unknown;
}

export function isEnvelope(data: unknown): data is EnvelopeLike {
  if (!data || typeof data !== "object") return false;
  const r = data as Record<string, unknown>;
  return "publication" in r && "npcBindings" in r;
}

export function toEnvelope(publication: Publication, npcBindings: NpcBinding[]): WeddingSnapshot {
  return { publication, npcBindings };
}
