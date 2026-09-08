import { useEffect, useRef, useState } from "react";
import { EventBus, BRIDGE_EVENTS } from "@wedding-rpg/game";
import { DEMO_PUBLICATION } from "../weddings/demo-publication";

interface ToastPayload {
  heart?: string;
  label?: string;
}

interface BlockedPayload {
  collected?: string[];
  required?: string[];
}

// Transient quest feedback (toasts/banners) + the persistent finale reveal.
// All transient elements are pointer-transparent so play never blocks.
export function FinaleReveal() {
  const [toast, setToast] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const later = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    const onToast = (p: ToastPayload) => {
      setToast(`♥ ${p?.label ?? p?.heart ?? "Kenangan"}`);
      later(1500, () => setToast(null));
    };
    const onBlocked = (p: BlockedPayload) => {
      const found = p?.collected?.length ?? 0;
      setBlocked(`Aula terkunci — hati ${found}/4 ♥ ♥ ♡ ♡`);
      later(2200, () => setBlocked(null));
    };
    const onUnlocked = () => {
      setUnlocked(true);
      later(3500, () => setUnlocked(false));
    };
    const onStarted = () => setRevealed(true);
    EventBus.on(BRIDGE_EVENTS.memoryToast, onToast);
    EventBus.on(BRIDGE_EVENTS.finaleGateBlocked, onBlocked);
    EventBus.on(BRIDGE_EVENTS.finaleUnlocked, onUnlocked);
    EventBus.on(BRIDGE_EVENTS.finaleStarted, onStarted);
    return () => {
      EventBus.off(BRIDGE_EVENTS.memoryToast, onToast);
      EventBus.off(BRIDGE_EVENTS.finaleGateBlocked, onBlocked);
      EventBus.off(BRIDGE_EVENTS.finaleUnlocked, onUnlocked);
      EventBus.off(BRIDGE_EVENTS.finaleStarted, onStarted);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  const couple = DEMO_PUBLICATION.couple;
  return (
    <>
      {toast && (
        <div data-testid="memory-toast" className="quest-toast" role="status">
          {toast}
        </div>
      )}
      {blocked && (
        <div data-testid="gate-locked" className="quest-toast quest-blocked" role="status">
          {blocked}
        </div>
      )}
      {unlocked && (
        <div data-testid="unlock-banner" className="quest-toast quest-unlocked" role="status">
          ✦ Aula Terbuka — rayakan bersama! ✦
        </div>
      )}
      {revealed && (
        <div data-testid="finale-reveal" className="finale-sheet" role="dialog" aria-label="Finale">
          <h2>
            {couple.partnerA} &amp; {couple.partnerB}
          </h2>
          <p>Terima kasih — kisah kami lengkap karena kamu ikut mengumpulkannya! ♥ ♥ ♥ ♥</p>
          <button
            data-testid="finale-close"
            className="finale-close"
            onClick={() => setRevealed(false)}
          >
            Rayakan
          </button>
        </div>
      )}
    </>
  );
}
