import { guestbookEntrySchema, type GuestbookEntry } from "@wedding-rpg/contracts";

export interface GuestbookStore {
  entries: GuestbookEntry[];
  seq: number;
}

export function createGuestbookStore(): GuestbookStore {
  return { entries: [], seq: 0 };
}

export type GuestbookResult =
  | { ok: true; entry: GuestbookEntry }
  | { ok: false; errors: string[] };

export function addGuestbookEntry(
  store: GuestbookStore,
  input: { name: string; message: string },
  now: number
): GuestbookResult {
  const name = input.name.trim();
  const message = input.message.trim();
  if (name.length === 0 || name.length > 40) {
    return { ok: false, errors: ["guestbook name must be 1..40 characters"] };
  }
  if (message.length === 0 || message.length > 280) {
    return { ok: false, errors: ["guestbook message must be 1..280 characters"] };
  }
  if (/https?:\/\//i.test(message)) {
    return { ok: false, errors: ["guestbook message must not contain links"] };
  }
  store.seq += 1;
  const candidate = { id: `gb-${store.seq}`, name, message, createdAt: now };
  const parsed = guestbookEntrySchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  store.entries.push(parsed.data);
  return { ok: true, entry: parsed.data };
}
