import {
  rsvpChoiceSchema,
  rsvpRecordSchema,
  type RsvpChoice,
  type RsvpRecord,
} from "@wedding-rpg/contracts";
import { findGuestByToken, type GuestStore } from "./guests";

export interface RsvpStore {
  records: RsvpRecord[];
}

export function createRsvpStore(): RsvpStore {
  return { records: [] };
}

export type RsvpResult =
  | { ok: true; record: RsvpRecord; created: boolean }
  | { ok: false; errors: string[] };

export function submitRsvp(
  guests: GuestStore,
  store: RsvpStore,
  input: { token: string; projectId: string; name: string; attending: RsvpChoice; partySize: number },
  now: number
): RsvpResult {
  const guest = findGuestByToken(guests, input.token);
  if (!guest) return { ok: false, errors: ["unknown guest token"] };
  if (guest.projectId !== input.projectId) {
    return { ok: false, errors: ["token does not belong to this project"] };
  }
  const trimmed = input.name.trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return { ok: false, errors: ["rsvp name must be 1..80 characters"] };
  }
  if (!rsvpChoiceSchema.safeParse(input.attending).success) {
    return { ok: false, errors: ["attending must be hadir or tidak"] };
  }
  const candidate = {
    token: input.token,
    projectId: guest.projectId,
    name: trimmed,
    attending: input.attending,
    partySize: input.partySize,
    updatedAt: now,
  };
  const parsed = rsvpRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  const existing = store.records.find((r) => r.token === input.token);
  if (existing) {
    Object.assign(existing, parsed.data);
    return { ok: true, record: existing, created: false };
  }
  store.records.push(parsed.data);
  return { ok: true, record: parsed.data, created: true };
}
