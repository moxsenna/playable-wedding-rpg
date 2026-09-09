import { useEffect, useState } from "react";
import { EventBus, BRIDGE_EVENTS } from "@wedding-rpg/game";
import { emoteSchema, type Emote } from "@wedding-rpg/contracts";

const EMOTES = emoteSchema.options;

const EMOTE_GLYPHS: Record<Emote, string> = {
  wave: "👋",
  heart: "♥",
  celebrate: "🎉",
  laugh: "😄",
  blessing: "🙏",
};

// Emoji picker overlay. The canvas emote button (or Q on desktop) requests
// the menu; picking an emoji emits the existing emoteSelected event, which
// the scene renders above the local player's head (and sends to the room).
export function EmoteMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onRequest = () => setOpen(true);
    EventBus.on(BRIDGE_EVENTS.emoteMenuRequested, onRequest);
    return () => {
      EventBus.off(BRIDGE_EVENTS.emoteMenuRequested, onRequest);
    };
  }, []);

  if (!open) return null;
  const pick = (emote: Emote) => {
    setOpen(false);
    EventBus.emit(BRIDGE_EVENTS.emoteSelected, { emote });
  };
  return (
    <div data-testid="emote-menu" className="emote-menu" role="dialog" aria-modal="true" aria-label="Pilih emoji">
      <div className="emote-grid" role="group" aria-label="Emoji">
        {EMOTES.map((e) => (
          <button
            key={e}
            data-testid={`emote-pick-${e}`}
            className="emote-pick"
            aria-label={e}
            onClick={() => pick(e)}
          >
            {EMOTE_GLYPHS[e]}
          </button>
        ))}
      </div>
      <button data-testid="emote-close" className="emote-close" onClick={() => setOpen(false)}>
        Tutup
      </button>
    </div>
  );
}
