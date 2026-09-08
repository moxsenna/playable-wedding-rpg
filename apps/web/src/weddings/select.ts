// Wedding selection (M7): pure ?wedding= query lookup, no game code.
// Unknown or absent ids fall back to the demo wedding so the world always
// boots. Evaluated at module load in the browser; static prerender has no
// window and resolves the demo default.
export const WEDDING_IDS = ["demo-ayu-bima", "raka-naya", "arvin-selena"] as const;
export type WeddingId = (typeof WEDDING_IDS)[number];

export function resolveWeddingId(): WeddingId {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("wedding");
    if (q === "raka-naya" || q === "arvin-selena" || q === "demo-ayu-bima") return q;
  }
  return "demo-ayu-bima";
}
