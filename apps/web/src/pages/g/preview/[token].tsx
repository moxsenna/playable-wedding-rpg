import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchPreview } from "@/weddings/runtime";

const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

export default function PreviewEntry() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchPreview(token).then((body) => {
      if (cancelled) return;
      setState(body.status === 200 ? "ready" : "invalid");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state !== "ready") {
    return (
      <main className="guest-entry" data-testid={state === "loading" ? "guest-loading" : "guest-invalid"}>
        {state === "loading" ? <p>Membuka pratinjau…</p> : (
          <>
            <h1>Pratinjau tidak valid</h1>
            <p>Minta tautan pratinjau baru dari Studio.</p>
          </>
        )}
      </main>
    );
  }
  return (
    <>
      <Head>
        <title>Pratinjau Draft · YUTEMU</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <main>
        <p data-testid="guest-preview-badge" className="guest-notice">
          Mode pratinjau — data draft, bukan publikasi aktif.
        </p>
        <AppWithoutSSR />
      </main>
    </>
  );
}
