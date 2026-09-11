import "@/styles/globals.css";
// The guest chrome: the Undangan as a printed paper card, the overlays over the
// garden in night. Loaded on every route because Pages Router only allows global
// CSS from _app, but every selector is a guest-owned class name (.book-*,
// .onboarding-*, .dialogue-*, .quest-*, .emote-*, .finale-*, .loading-*) that no
// other surface renders.
import "@/styles/guest.css";
// Studio's neo-brutalist rules. Pages Router only allows global CSS from _app,
// so this file loads on every route — but every selector in it is scoped to
// `.admin-page`, `body.studio-page`, or class names that only the operator
// console renders (.studio-*, .admin-*, .guest-row, .metric-*, .field-hint,
// .empty-note). Nothing in it can match a guest or game route.
import "@/styles/studio.css";
import { useEffect } from "react";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.getElementById("boot-splash")?.remove();
  }, []);
  return <Component {...pageProps} />;
}
