// Pure quest reducer for `collect-our-story-v1` (M5). Zero imports so node
// verifiers can transpile this file standalone: the caller supplies the
// definition (questId + required hearts) and plain state objects.
// Wedding-agnostic: any four-heart definition drives identical transitions.
export interface QuestDefinitionLike {
  questId: string;
  required: readonly string[];
}

export interface QuestStateLike {
  questId: string;
  status: "idle" | "active" | "complete";
  collected: string[];
  finaleUnlocked: boolean;
}

export type QuestTransition =
  | { ok: true; state: QuestStateLike; granted: string | null; completed: boolean }
  | { ok: false; reason: string; state: QuestStateLike };

export function createQuestState(def: QuestDefinitionLike): QuestStateLike {
  return { questId: def.questId, status: "idle", collected: [], finaleUnlocked: false };
}

function clone(state: QuestStateLike): QuestStateLike {
  return { ...state, collected: [...state.collected] };
}

/** Start the quest once. Re-starting an active/complete quest is a no-op success. */
export function startQuest(def: QuestDefinitionLike, state: QuestStateLike): QuestTransition {
  if (state.questId !== def.questId) {
    return { ok: false, reason: `unknown quest: ${state.questId}`, state };
  }
  if (state.status !== "idle") return { ok: true, state, granted: null, completed: false };
  const next = clone(state);
  next.status = "active";
  return { ok: true, state: next, granted: null, completed: false };
}

/**
 * Grant one heart: open-order, duplicates ignored, unknown hearts rejected.
 * Completing the fourth heart flips status to complete + unlocks the finale.
 */
export function grantHeart(
  def: QuestDefinitionLike,
  state: QuestStateLike,
  heartId: string
): QuestTransition {
  if (state.questId !== def.questId) {
    return { ok: false, reason: `unknown quest: ${state.questId}`, state };
  }
  if (!def.required.includes(heartId)) {
    return { ok: false, reason: `unknown heart: ${heartId}`, state };
  }
  if (state.status === "idle") {
    return { ok: false, reason: "quest not started", state };
  }
  if (state.collected.includes(heartId)) {
    return { ok: true, state, granted: null, completed: state.status === "complete" };
  }
  const next = clone(state);
  next.collected.push(heartId);
  const completed = next.collected.length >= def.required.length;
  if (completed) {
    next.status = "complete";
    next.finaleUnlocked = true;
  }
  return { ok: true, state: next, granted: heartId, completed };
}

/** Hearts still missing, in definition order. */
export function missingHearts(def: QuestDefinitionLike, state: QuestStateLike): string[] {
  return def.required.filter((h) => !state.collected.includes(h));
}
