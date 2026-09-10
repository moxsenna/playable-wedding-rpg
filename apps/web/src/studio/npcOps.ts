// Pure Studio editing operations (M17): dialogue add/remove with next-ref
// maintenance, slot swaps, heart reassignment, ordered-list moves.
// Generic over the contract shapes so validated data stays validated.
export interface DialogueNodeLike {
  id: string;
  text: string;
  speaker?: string;
  next?: string;
  action?: { type: string; section?: string };
}

export interface BindingLike {
  slotId: string;
}

export interface HeartBindingLike extends BindingLike {
  questRewardId?: string;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function addDialogueNode<D extends DialogueNodeLike>(nodes: D[], text: string): D[] {
  const ids = new Set(nodes.map((n) => n.id));
  let i = nodes.length + 1;
  while (ids.has(`node-${i}`)) i++;
  const id = `node-${i}`;
  const out = nodes.map((n) => ({ ...n }));
  const tail = [...out].reverse().find((n) => !n.next);
  if (tail) tail.next = id;
  out.push({ id, text } as D);
  return out;
}

export function deleteDialogueNode<D extends DialogueNodeLike>(
  nodes: D[],
  nodeId: string
): { nodes: D[]; deleted: boolean; reason?: string } {
  if (nodes.length === 0) return { nodes, deleted: false, reason: "empty" };
  if (nodes[0].id === nodeId) return { nodes, deleted: false, reason: "entry node is required" };
  const target = nodes.find((n) => n.id === nodeId);
  if (!target) return { nodes, deleted: false, reason: "unknown node" };
  const out = nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => (n.next === nodeId ? { ...n, next: target.next } : n));
  return { nodes: out, deleted: true };
}

export function swapSlots<B extends BindingLike>(bindings: B[], slotA: string, slotB: string): B[] {
  if (slotA === slotB) return bindings;
  return bindings.map((b) => {
    if (b.slotId === slotA) return { ...b, slotId: slotB };
    if (b.slotId === slotB) return { ...b, slotId: slotA };
    return b;
  });
}

export function moveHeart<B extends HeartBindingLike>(bindings: B[], heartId: string, toSlot: string): B[] {
  return bindings.map((b) => {
    if (b.questRewardId === heartId && b.slotId !== toSlot) {
      const c = { ...b };
      delete c.questRewardId;
      return c;
    }
    if (b.slotId === toSlot) return { ...b, questRewardId: heartId } as B;
    return b;
  });
}

export function heartAssignments<B extends HeartBindingLike>(
  bindings: B[]
): { heartId: string; slotId: string | null }[] {
  const ids = ["heart.first_meeting", "heart.memories", "heart.journey", "heart.proposal"];
  return ids.map((heartId) => ({
    heartId,
    slotId: bindings.find((b) => b.questRewardId === heartId)?.slotId ?? null,
  }));
}

export function uniqueId(prefix: string, existing: string[]): string {
  let i = existing.length + 1;
  while (existing.includes(`${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}
