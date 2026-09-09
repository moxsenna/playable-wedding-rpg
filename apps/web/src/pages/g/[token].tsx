import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchBootstrap } from "@/weddings/runtime";

const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

type GuestState = "loading" | "ready" | "invalid" | "archived" | "not-live" | "no-publication";

export default function GuestEntry() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const [state, setState] = useState<GuestState>("loading");
  const [couple, setCouple] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchBootstrap(token).then((body) => {
      if (cancelled) return;
      if (body.status === 404) {
        setState("invalid");
        return;
      }
      if (body.status === 410) {
        setState("archived");
        return;
      }
      if (body.status === 403) {
        setState("not-live");
        return;
      }
      if (body.status !== 200) {
        setState("invalid");
        return;
      }
      const snapshot = body.publication?.snapshot as
        | { couple?: { partnerA?: string; partnerB?: string } }
        | undefined;
      if (snapshot?.couple) setCouple(`${snapshot.couple.partnerA ?? ""} & ${snapshot.couple.partnerB ?? ""}`);
      setState(body.publication ? "ready" : "no-publication");
    });
    return () => {
      cancelled = true;
    };
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
  if (state === "not-live") {
    return (
      <main className="guest-entry" data-testid="guest-not-live">
        <h1>Undangan belum tersedia</h1>
        <p>Mempelai masih menyiapkan undangan ini.</p>
      </main>
    );
  }
  if (state === "no-publication") {
    return (
      <main className="guest-entry" data-testid="guest-no-publication">
        <h1>Undangan sedang disiapkan</h1>
        <p>Game belum aktif — info menyusul.</p>
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
        <AppWithoutSSR />
      </main>
    </>
  );
}
