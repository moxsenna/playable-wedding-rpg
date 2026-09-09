import { useEffect, useState } from "react";
import { EventBus, BRIDGE_EVENTS } from "@wedding-rpg/game";
import { loadProfile } from "../weddings/profile";
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
  const [guestName, setGuestName] = useState(() => loadProfile()?.name ?? "");

  useEffect(() => {
    const onState = (p: { state?: QuestState }) => {
      if (p?.state && Array.isArray(p.state.collected)) setState(p.state);
    };
    const onProfile = () => setGuestName(loadProfile()?.name ?? "");
    EventBus.on(BRIDGE_EVENTS.questStateChanged, onState);
    window.addEventListener("profileChosen", onProfile);
    return () => {
      EventBus.off(BRIDGE_EVENTS.questStateChanged, onState);
      window.removeEventListener("profileChosen", onProfile);
    };
  }, []);

  const found = state.collected.length;
  const hearts = Array.from({ length: 4 }, (_, i) => (i < found ? "♥" : "♡")).join(" ");
  return (
    <div data-testid="quest-hud" className="quest-hud" aria-label={`Our Story ${found} dari 4 hati`}>
      {guestName !== "" && <span data-testid="quest-greeting">Halo, {guestName}! </span>}
      OUR STORY {hearts}
    </div>
  );
}
