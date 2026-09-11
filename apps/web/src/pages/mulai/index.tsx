import Head from "next/head";
import { useState } from "react";
import { TIERS } from "@/config/offer";
import { resolveApiBase } from "@/weddings/runtime";

type TierId = "esensial" | "signature" | "bespoke";

export default function Mulai() {
  const [tier, setTier] = useState<TierId>("signature");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${resolveApiBase()}/v1/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, customer: { name, whatsapp, email } }),
      });
      const body = (await res.json()) as { checkoutUrl?: string; externalOrderId?: string; error?: string };
      if (!res.ok || !body.checkoutUrl || !body.externalOrderId) {
        setError(body.error === "payment provider unavailable"
          ? "Pembayaran sedang tidak bisa dijangkau — coba lagi sebentar."
          : body.error === "checkout unavailable"
            ? "Checkout belum dikonfigurasi — hubungi kami via WhatsApp."
            : "Data belum valid — periksa nama, nomor WhatsApp, dan email.");
        return;
      }
      try {
        sessionStorage.setItem("yutemu-order", body.externalOrderId);
      } catch {
        // Private mode: the return page still works via the order query param.
      }
      window.location.href = body.checkoutUrl;
    } catch {
      setError("Jaringan bermasalah — coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
      <Head>
        <title>YUTEMU — Buat undangan playable</title>
        <meta name="description" content="Pilih paket, bayar, lalu isi data pernikahanmu sendiri lewat wizard terpandu." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <p><a href="/">← YUTEMU</a></p>
      <h1>Buat undangan playable</h1>
      <p>Pilih paket, bayar, lalu isi data pernikahanmu sendiri — tanpa coding, tanpa menunggu admin.</p>

      <h2>1. Pilih paket</h2>
      {TIERS.map((t) => (
        <label key={t.id} style={{ display: "block", border: "2px solid #171719", margin: "8px 0", padding: 12 }}>
          <input
            type="radio"
            name="tier"
            data-testid={`mulai-tier-${t.id}`}
            checked={tier === t.id}
            onChange={() => setTier(t.id as TierId)}
          />{" "}
          <strong>{t.name}</strong> — mulai dari {t.price}
        </label>
      ))}

      <h2>2. Data pemesan</h2>
      <label style={{ display: "block", margin: "8px 0" }}>
        Nama
        <input data-testid="mulai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" style={{ display: "block", width: "100%" }} />
      </label>
      <label style={{ display: "block", margin: "8px 0" }}>
        WhatsApp
        <input data-testid="mulai-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="08…" inputMode="tel" style={{ display: "block", width: "100%" }} />
      </label>
      <label style={{ display: "block", margin: "8px 0" }}>
        Email
        <input data-testid="mulai-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" inputMode="email" style={{ display: "block", width: "100%" }} />
      </label>

      {error && <p data-testid="mulai-error" role="alert">{error}</p>}
      <button data-testid="mulai-pay" onClick={() => void submit()} disabled={busy}>
        {busy ? "Menyiapkan pembayaran…" : "Bayar & lanjut isi data"}
      </button>
      <p><small>Setelah bayar berhasil kamu dapat link pribadi untuk mengisi data pernikahan.</small></p>
    </div>
  );
}
