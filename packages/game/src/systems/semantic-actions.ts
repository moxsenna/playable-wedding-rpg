// Semantic-action dispatcher: allowlist only, no eval, no function names,
// no arbitrary JS from NPC config. React-owned OPEN_* actions are validated
// here and deferred to the DOM layer; quest-owned actions belong to M5.

export type DispatchResult =
  | { handled: true; deferred: "react" | "quest" }
  | { handled: false; reason: string };

const REACT_ACTIONS: ReadonlySet<string> = new Set([
  "OPEN_WEDDING_BOOK",
  "OPEN_WEDDING_BOOK_SECTION",
  "OPEN_RSVP",
  "OPEN_GALLERY",
  "OPEN_MAPS",
  "OPEN_GUESTBOOK",
]);

const QUEST_ACTIONS: ReadonlySet<string> = new Set([
  "START_MAIN_QUEST",
  "GRANT_HEART",
  "START_FINALE",
]);

export function dispatchSemanticAction(type: string): DispatchResult {
  if (REACT_ACTIONS.has(type)) return { handled: true, deferred: "react" };
  if (QUEST_ACTIONS.has(type)) return { handled: true, deferred: "quest" };
  return { handled: false, reason: `unknown semantic action: ${type}` };
}
