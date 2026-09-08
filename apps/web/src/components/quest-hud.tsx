import { useEffect, useState } from "react";
import { EventBus, BRIDGE_EVENTS } from "@wedding-rpg/game";
import type { QuestState } from "@wedding-rpg/contracts";

const EMPTY: QuestState = {
  questId: "collect-our-story-v1",
  status: "idle",
  collected: [],
  finaleUnlocked: false,
};

// Persistent heart HUD. Phaser owns quest state; this mirrors it for display.
export function QuestHud() {
  const [state, setState] = useState<QuestState>(EMPTY);

  useEffect(() => {
    const onState = (p: { state?: QuestState }) => {
      if (p?.state && Array.isArray(p.state.collected)) setState(p.state);
    };
    EventBus.on(BRIDGE_EVENTS.questStateChanged, onState);
    return () => {
      EventBus.off(BRIDGE_EVENTS.questStateChanged, onState);
    };
  }, []);

  const found = state.collected.length;
  const hearts = Array.from({ length: 4 }, (_, i) => (i < found ? "♥" : "♡")).join(" ");
  return (
    <div data-testid="quest-hud" className="quest-hud" aria-label={`Our Story ${found} dari 4 hati`}>
      OUR STORY {hearts}
    </div>
  );
}
