import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { resolveApiBase } from "@/weddings/runtime";
import { waLink, WA_MESSAGES } from "@/config/offer";

type Status = "menunggu" | "paid" | "gagal" | "tidak-dikenal";

export default function Retur() {
  const router = useRouter();
  const [externalId, setExternalId] = useState("");
  const [status, setStatus] = useState<Status>("menunggu");
  const [claimToken, setClaimToken] = useState<string | null>(null);

  useEffect(() => {
    const q = typeof router.query.order === "string" ? router.query.order : "";
    let id = q;
    if (!id) {
      try {
        id = sessionStorage.getItem("yutemu-order") ?? "";
      } catch {
        id = "";
      }
    }
    if (!router.isReady) return;
    if (!id) {
      setStatus("tidak-dikenal");
      return;
    }
    setExternalId(id);
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`${resolveApiBase()}/v1/checkout/${encodeURIComponent(id)}`);
        if (!res.ok) {
          if (!stop) setStatus("tidak-dikenal");
          return;
        }
        const body = (await res.json()) as { status?: string; claimToken?: string | null };
        if (stop) return;
        if (body.status === "paid") {
          setStatus("paid");
          setClaimToken(body.claimToken ?? null);
          stop = true;
          return;
        }
        if (body.status === "failed") {
          setStatus("gagal");
          stop = true;
          return;
        }
      } catch {
        // Keep polling through transient network failures.
      }
      if (!stop) window.setTimeout(() => void poll(), 4000);
    };
    void poll();
    return () => {
      stop = true;
    };
  }, [router.isReady, router.query.order]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
      <Head>
        <title>YUTEMU — Status pembayaran</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <p><a href="/">← YUTEMU</a></p>
      <h1>Status pembayaran</h1>
      {status === "menunggu" && (
        <p data-testid="retur-menunggu">Menunggu konfirmasi pembayaran{externalId ? ` (${externalId})` : ""}… halaman ini memeriksa otomatis.</p>
      )}
      {status === "paid" && claimToken && (
        <div>
          <p data-testid="retur-berhasil">Pembayaran berhasil. Link pribadimu untuk mengisi data pernikahan sudah siap — simpan baik-baik.</p>
          <p><Link data-testid="retur-claim" href={`/mulai/${encodeURIComponent(claimToken)}`}>Isi data pernikahan →</Link></p>
        </div>
      )}
      {status === "paid" && !claimToken && (
        <p data-testid="retur-berhasil-tanpa-link">Pembayaran berhasil, tapi link isi data belum tersedia — hubungi kami via WhatsApp.</p>
      )}
      {(status === "gagal" || status === "tidak-dikenal") && (
        <p>
          {status === "gagal" ? "Pembayaran gagal atau kedaluwarsa." : "Order tidak ditemukan."}{" "}
          <a href={waLink(WA_MESSAGES.general)} target="_blank" rel="noopener noreferrer">Chat WhatsApp</a> untuk bantuan.
        </p>
      )}
    </div>
  );
}
