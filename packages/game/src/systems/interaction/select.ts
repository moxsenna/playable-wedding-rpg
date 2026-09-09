// Pure interaction-target selection. One reusable selector for every NPC,
// door, and ambient interactable: no per-actor distance loops.
// Score = distance + priority weight - facing bonus; exactly one winner.
export interface InteractionCandidate {
  id: string;
  x: number;
  y: number;
  /** Lower wins: critical 0, quest 1, npc 2, door 3, ambient 4. */
  priority: number;
  enabled: boolean;
}

export interface SelectorPose {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
}

export const PRIORITY = {
  critical: 0,
  quest: 1,
  npc: 2,
  door: 3,
  ambient: 4,
} as const;

/** Interaction radius in world px (WORLD_DESIGN §11: ~36-56). */
export const INTERACT_RADIUS = 52;

const PRIORITY_WEIGHT = 8;
const FACING_BONUS = 12;
const FACING_DOT = 0.3;

export function selectTarget(
  candidates: readonly InteractionCandidate[],
  pose: SelectorPose,
  radius: number = INTERACT_RADIUS
): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    if (!c.enabled) continue;
    const dx = c.x - pose.x;
    const dy = c.y - pose.y;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) continue;
    const facing = dist > 0.001 ? (dx * pose.facingX + dy * pose.facingY) / dist : 1;
    const score = dist + c.priority * PRIORITY_WEIGHT - (facing > FACING_DOT ? FACING_BONUS : 0);
    if (score < bestScore || (score === bestScore && (best === null || c.id < best))) {
      bestScore = score;
      best = c.id;
    }
  }
  return best;
}

interface ActionRef {
  type: string;
  section?: string;
}

/** Contextual label for the single stable Interact control. */
export function labelForActions(actions: readonly ActionRef[]): string {
  const types = actions.map((a) => a.type);
  if (types.includes("OPEN_RSVP")) return "Pesan";
  if (types.includes("OPEN_GALLERY")) return "Lihat Foto";
  const sectioned = actions.find((a) => a.type === "OPEN_WEDDING_BOOK_SECTION");
  if (sectioned) {
    if (sectioned.section === "events") return "Lihat Acara";
    if (sectioned.section === "venue") return "Lihat Lokasi";
    if (sectioned.section === "gallery") return "Lihat Foto";
    if (sectioned.section === "rsvp") return "Pesan";
  }
  if (types.includes("OPEN_MAPS")) return "Lihat Lokasi";
  if (types.includes("OPEN_WEDDING_BOOK")) return "Undangan";
  return "Bicara";
}
