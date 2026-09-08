import {
  guestSchema,
  guestTokenSchema,
  type Guest,
} from "@wedding-rpg/contracts";

export interface GuestStore {
  guests: Guest[];
  seq: number;
}

export function createGuestStore(): GuestStore {
  return { guests: [], seq: 0 };
}

function newToken(seq: number): string {
  return `gt_${seq.toString(36).padStart(6, "0")}-invitation`;
}

export type GuestResult =
  | { ok: true; guest: Guest }
  | { ok: false; errors: string[] };

export function registerGuest(store: GuestStore, name: string, now: number): GuestResult {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return { ok: false, errors: ["guest name must be 1..80 characters"] };
  }
  store.seq += 1;
  const candidate = {
    id: `guest-${store.seq}`,
    name: trimmed,
    token: newToken(store.seq),
    createdAt: now,
  };
  const parsed = guestSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  store.guests.push(parsed.data);
  return { ok: true, guest: parsed.data };
}

export function findGuestByToken(store: GuestStore, token: string): Guest | null {
  if (!guestTokenSchema.safeParse(token).success) return null;
  return store.guests.find((g) => g.token === token) ?? null;
}
