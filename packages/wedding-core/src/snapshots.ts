// Wedding snapshot boundary (M17): explicit validated envelope pairing
// a Publication with its NPC bindings. Zod strips unknown keys, so the
// two parts validate separately and persist together; legacy bare
// publications keep reading (bindings empty) for backward compatibility.
import { z } from "zod";
import {
  heartIds,
  isEnvelope,
  npcBindingSchema,
  npcSlotIds,
  validatePublication,
  weddingSnapshotSchema,
  type NpcBinding,
  type Publication,
  type WeddingSnapshot,
} from "@wedding-rpg/contracts";

export interface SnapshotValidation {
  ok: boolean;
  snapshot: WeddingSnapshot | null;
  errors: string[];
}

export interface BindingsStructure {
  ok: boolean;
  bindings: NpcBinding[];
  errors: string[];
}

/**
 * Server-side bindings check: shape, slot coverage, and heart assignment.
 * Avatar existence stays client-side against the published registry (the
 * server never trusts client-supplied allowlists); boot enforces it again.
 */
export function validateNpcBindingsStructure(bindings: unknown): BindingsStructure {
  const parsed = zArrayNpcBindings(bindings);
  if (!parsed.ok) return parsed;
  const errors: string[] = [];
  const counts = new Map<string, number>();
  for (const b of parsed.bindings) counts.set(b.slotId, (counts.get(b.slotId) ?? 0) + 1);
  for (const [slot, count] of counts) {
    if (count > 1) errors.push(`duplicate slot binding: ${slot} x${count}`);
  }
  for (const slot of npcSlotIds) {
    if (!counts.has(slot)) errors.push(`missing required slot: ${slot}`);
  }
  const hearts = parsed.bindings
    .map((b) => b.questRewardId)
    .filter((h): h is (typeof heartIds)[number] => h !== undefined);
  const distinct = new Set(hearts);
  if (distinct.size !== heartIds.length || hearts.length !== distinct.size) {
    errors.push(`exactly ${heartIds.length} distinct heart rewards required`);
  }
  return { ok: errors.length === 0, bindings: parsed.bindings, errors };
}

function zArrayNpcBindings(bindings: unknown): BindingsStructure {
  const parsed = z.array(npcBindingSchema).min(1).max(24).safeParse(bindings);
  if (!parsed.success) {
    return {
      ok: false,
      bindings: [],
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { ok: true, bindings: parsed.data, errors: [] };
}

export function validateSnapshot(data: unknown): SnapshotValidation {
  if (!isEnvelope(data)) {
    return { ok: false, snapshot: null, errors: ["snapshot must be {publication, npcBindings}"] };
  }
  const pub = validatePublication(data.publication);
  if (!pub.ok || !pub.publication) {
    return { ok: false, snapshot: null, errors: pub.errors };
  }
  const binds = validateNpcBindingsStructure(data.npcBindings);
  if (!binds.ok) {
    return { ok: false, snapshot: null, errors: binds.errors };
  }
  const parsed = weddingSnapshotSchema.safeParse({ publication: pub.publication, npcBindings: binds.bindings });
  if (!parsed.success) {
    return {
      ok: false,
      snapshot: null,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { ok: true, snapshot: parsed.data, errors: [] };
}

export interface VersionSnapshot {
  ok: boolean;
  snapshot: Record<string, unknown> | null;
  errors: string[];
}

/** Draft/publish entry point: envelope preferred, legacy bare accepted. */
export function validateVersionSnapshot(data: unknown): VersionSnapshot {
  if (isEnvelope(data)) {
    const v = validateSnapshot(data);
    if (!v.ok || !v.snapshot) return { ok: false, snapshot: null, errors: v.errors };
    return { ok: true, snapshot: v.snapshot as unknown as Record<string, unknown>, errors: [] };
  }
  const pub = validatePublication(data);
  if (!pub.ok || !pub.publication) {
    return { ok: false, snapshot: null, errors: pub.errors };
  }
  return { ok: true, snapshot: pub.publication as unknown as Record<string, unknown>, errors: [] };
}

export interface ResolvedSnapshot {
  publication: Publication;
  npcBindings: NpcBinding[];
}

/** Runtime read: envelope unwraps, legacy bare parses, garbage rejects. */
export function readSnapshot(data: unknown): ResolvedSnapshot | null {
  if (isEnvelope(data)) {
    const parsed = weddingSnapshotSchema.safeParse(data);
    if (!parsed.success) return null;
    return parsed.data;
  }
  const pub = validatePublication(data);
  if (!pub.ok || !pub.publication) return null;
  return { publication: pub.publication, npcBindings: [] };
}
