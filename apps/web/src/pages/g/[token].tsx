import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { resolveApiBase } from "@/weddings/runtime";

const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

export default function GuestEntry() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "archived" | "no-publication">("loading");
  const [couple, setCouple] = useState("");

  useEffect(() => {
    if (!token) return;
    const api = resolveApiBase();
    fetch(`${api}/v1/guest/${encodeURIComponent(token)}`)
      .then((r) => {
        if (r.status === 404) {
          setState("invalid");
          return null;
        }
        if (r.status === 410) {
          setState("archived");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((body) => {
        if (!body) {
          setState((s) => (s === "loading" ? "invalid" : s));
          return;
        }
        const snapshot = body.publication?.snapshot as
          | { couple?: { partnerA?: string; partnerB?: string } }
          | undefined;
        if (snapshot?.couple) setCouple(`${snapshot.couple.partnerA ?? ""} & ${snapshot.couple.partnerB ?? ""}`);
        setState(body.publication ? "ready" : "no-publication");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  if (state === "loading") {
    return (
      <main className="guest-entry" data-testid="guest-loading">
        <p>Membuka undangan…</p>
      </main>
    );
  }
  if (state === "invalid") {
    return (
      <main className="guest-entry" data-testid="guest-invalid">
        <h1>Tautan tidak valid</h1>
        <p>Minta tautan undangan yang baru kepada mempelai.</p>
      </main>
    );
  }
  if (state === "archived") {
    return (
      <main className="guest-entry" data-testid="guest-archived">
        <h1>Undangan ini sudah diarsipkan</h1>
        <p>Hubungi mempelai untuk informasi terbaru.</p>
      </main>
    );
  }
  return (
    <>
      <Head>
        <title>{couple ? `Undangan ${couple}` : "Undangan Pernikahan"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <main>
        {state === "no-publication" && (
          <p data-testid="guest-no-publication" className="guest-notice">
            Undangan sedang disiapkan — game belum aktif, info menyusul.
          </p>
        )}
        <AppWithoutSSR />
      </main>
    </>
  );
}
