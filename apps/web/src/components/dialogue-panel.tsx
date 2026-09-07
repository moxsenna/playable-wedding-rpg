import { useEffect, useRef, useState } from "react";
import { DialogueRuntime, type DialogueLine } from "@wedding-rpg/game";
import { EventBus, BRIDGE_EVENTS } from "@wedding-rpg/game";
import { dialogueSchema } from "@wedding-rpg/contracts";

interface OpenPayload {
  npcId: string;
  displayName: string;
  dialogue: DialogueLine[];
}

// DOM dialogue panel: readable body font, touch-sized Continue, NPC name.
// Driven over the typed bridge; progression runs the shared pure runtime.
export function DialoguePanel() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [line, setLine] = useState<DialogueLine | null>(null);
  const runtime = useRef<DialogueRuntime | null>(null);
  const nodes = useRef<DialogueLine[]>([]);
  const npcId = useRef("");

  useEffect(() => {
    const onOpen = (p: OpenPayload) => {
      const parsed = dialogueSchema.safeParse(p?.dialogue);
      if (
        !parsed.success ||
        typeof p?.npcId !== "string" ||
        typeof p?.displayName !== "string"
      ) {
        console.error("invalid DIALOGUE_OPENED payload");
        return;
      }
      runtime.current = new DialogueRuntime(parsed.data);
      nodes.current = parsed.data;
      npcId.current = p.npcId;
      const first = runtime.current.start();
      if (first.kind !== "line") return;
      setName(p.displayName);
      setLine(first.line);
      setOpen(true);
    };
    EventBus.on(BRIDGE_EVENTS.dialogueOpened, onOpen);
    return () => {
      EventBus.off(BRIDGE_EVENTS.dialogueOpened, onOpen);
    };
  }, []);

  const close = (id: string) => {
    runtime.current = null;
    nodes.current = [];
    setOpen(false);
    setLine(null);
    EventBus.emit(BRIDGE_EVENTS.dialogueClosed, { npcId: id });
  };

  const advance = () => {
    const rt = runtime.current;
    if (!rt || !line) return;
    const ev = rt.advance(line.id);
    if (ev.kind === "line") {
      setLine(ev.line);
      return;
    }
    if (ev.kind === "action") {
      EventBus.emit(BRIDGE_EVENTS.dialogueAction, { action: ev.action, npcId: npcId.current });
      const resume = ev.resumeId ? nodes.current.find((x) => x.id === ev.resumeId) ?? null : null;
      if (resume) {
        setLine(resume);
        return;
      }
    }
    close(npcId.current);
  };

  if (!open || !line) return null;
  return (
    <div data-testid="dialogue-panel" className="dialogue-panel">
      <div className="dialogue-name" data-testid="dialogue-name">
        {line.speaker ?? name}
      </div>
      <p className="dialogue-text" data-testid="dialogue-text">
        {line.text}
      </p>
      <button data-testid="dialogue-continue" onClick={advance} className="dialogue-continue">
        Lanjut
      </button>
    </div>
  );
}
