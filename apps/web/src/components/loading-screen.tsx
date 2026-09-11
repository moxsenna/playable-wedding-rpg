import { useEffect, useState } from "react";
import { EventBus, BRIDGE_EVENTS } from "@wedding-rpg/game";

const TIPS = [
  "Menyiapkan taman…",
  "Menyambut tamu…",
  "Merangkai bunga…",
  "Menata aula…",
];

// Animated boot status while Phaser preloads. Visible from React mount
// until the world scene reports ready; the static _document splash covers
// the pre-hydration gap and is removed on mount. Hides on boot failure too:
// a dead game never reports ready, and the overlay (z-index 90) would
// otherwise trap guests on the loading screen with no access to Undangan.
export function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const onProgress = (p: number) => {
      if (typeof p === "number" && Number.isFinite(p)) {
        setProgress(Math.max(0, Math.min(1, p)));
      }
    };
    const onReady = () => setReady(true);
    // Async Phaser boot failures never reach the error boundary and never
    // report ready; surface them so the React shell stays usable.
    const onBootError = () => setFailed(true);
    EventBus.on(BRIDGE_EVENTS.gameLoadingProgress, onProgress);
    EventBus.on(BRIDGE_EVENTS.currentSceneReady, onReady);
    window.addEventListener("error", onBootError);
    window.addEventListener("unhandledrejection", onBootError);
    const tipTimer = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), 1800);
    return () => {
      EventBus.off(BRIDGE_EVENTS.gameLoadingProgress, onProgress);
      EventBus.off(BRIDGE_EVENTS.currentSceneReady, onReady);
      window.removeEventListener("error", onBootError);
      window.removeEventListener("unhandledrejection", onBootError);
      window.clearInterval(tipTimer);
    };
  }, []);

  if (ready || failed) return null;
  const pct = Math.round(progress * 100);
  return (
    <div data-testid="loading-screen" className="loading-screen" role="status" aria-label="Membuka YUTEMU">
      <img data-testid="loading-mark" className="loading-mark" src="/brand/logo/yutemu-mark.webp" alt="YUTEMU" />
      <div className="loading-brand">YUTEMU</div>
      <div className="loading-tagline">Temui kisah mereka.</div>
      <div className="loading-bar" aria-hidden="true">
        <div className="loading-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div data-testid="loading-status" className="loading-status">
        {TIPS[tip]} {pct}%
      </div>
    </div>
  );
}
