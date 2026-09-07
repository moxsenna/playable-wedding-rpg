// Framework-agnostic dialogue runtime. Hosted in React for the M3 DOM panel,
// driven by Phaser suspend/resume around it. Mostly linear by contract;
// actions fire when advancing past their node, with an optional resume.
export interface DialogueLine {
  id: string;
  speaker?: string;
  text: string;
  next?: string;
  action?: { type: string; section?: string };
}

export type DialogueEvent =
  | { kind: "line"; line: DialogueLine }
  | { kind: "action"; action: { type: string; section?: string }; resumeId: string | null }
  | { kind: "done" };

export class DialogueRuntime {
  private readonly byId: Map<string, DialogueLine>;
  private readonly first: DialogueLine;

  constructor(nodes: readonly DialogueLine[]) {
    if (nodes.length === 0) throw new Error("dialogue needs at least one node");
    this.byId = new Map(nodes.map((n) => [n.id, n]));
    this.first = nodes[0];
  }

  start(): DialogueEvent {
    return { kind: "line", line: this.first };
  }

  advance(currentId: string): DialogueEvent {
    const node = this.byId.get(currentId);
    if (!node) return { kind: "done" };
    if (node.action) {
      return { kind: "action", action: node.action, resumeId: node.next ?? null };
    }
    const next = node.next !== undefined ? this.byId.get(node.next) : undefined;
    if (!next) return { kind: "done" };
    return { kind: "line", line: next };
  }
}
