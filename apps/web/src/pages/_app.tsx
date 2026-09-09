import "@/styles/globals.css";
import { useEffect } from "react";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.getElementById("boot-splash")?.remove();
  }, []);
  return <Component {...pageProps} />;
}
