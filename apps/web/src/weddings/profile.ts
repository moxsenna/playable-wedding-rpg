// Guest profile: name + avatar picked once at onboarding, persisted
// locally. The game entry reads it before boot; HUD greets by name.
export interface GuestProfile {
  name: string;
  avatarId: string;
}

const KEY = "wedding-rpg:profile";

export const PROFILE_NAME_MAX = 12;

export function loadProfile(): GuestProfile | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestProfile>;
    if (typeof parsed.name !== "string" || typeof parsed.avatarId !== "string") return null;
    const name = parsed.name.trim();
    if (name.length === 0 || name.length > PROFILE_NAME_MAX) return null;
    if (!/^[a-z0-9_]+$/i.test(parsed.avatarId)) return null;
    return { name, avatarId: parsed.avatarId };
  } catch {
    return null;
  }
}

export function saveProfile(profile: GuestProfile): void {
  window.localStorage.setItem(KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent("profileChosen"));
}

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Isi namamu dulu ya";
  if (trimmed.length > PROFILE_NAME_MAX) return `Maksimal ${PROFILE_NAME_MAX} huruf`;
  return null;
}
