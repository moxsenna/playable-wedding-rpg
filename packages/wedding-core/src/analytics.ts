// M16 analytics: allowlisted event validation + operator summary math.
import { analyticsEventSchema, type AnalyticsSummary } from "@wedding-rpg/contracts";

export type AnalyticsEventInput = { type: string; guestId?: string };

export function validateAnalyticsEvent(input: AnalyticsEventInput): { ok: boolean; errors: string[] } {
  const parsed = analyticsEventSchema.safeParse(input);
  if (parsed.success) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

export interface AnalyticsRow {
  projectId: string;
  guestId: string | null;
  type: string;
  at: number;
}

const OPENED = new Set(["guest_link_opened", "session_started", "onboarding_completed", "game_ready"]);
const STARTED = new Set(["session_started", "onboarding_completed", "game_ready"]);

export function summarizeAnalytics(rows: AnalyticsRow[], totalGuests: number): AnalyticsSummary {
  const opened = new Set<string>();
  const started = new Set<string>();
  let hearts = 0;
  let finales = 0;
  let wishes = 0;
  let rsvps = 0;
  for (const r of rows) {
    if (OPENED.has(r.type) && r.guestId) opened.add(r.guestId);
    if (STARTED.has(r.type) && r.guestId) started.add(r.guestId);
    if (r.type === "heart_collected") hearts++;
    if (r.type === "finale_reached") finales++;
    if (r.type === "wish_submitted") wishes++;
    if (r.type === "rsvp_submitted") rsvps++;
  }
  return {
    totalGuests,
    uniqueOpened: opened.size,
    uniqueStarted: started.size,
    heartsCollected: hearts,
    finaleReached: finales,
    wishes,
    rsvps,
  };
}
