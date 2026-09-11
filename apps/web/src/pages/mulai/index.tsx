import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TIERS, WA_MESSAGES, waLink } from "@/config/offer";
import { resolveApiBase } from "@/weddings/runtime";
import styles from "@/styles/Landing.module.css";

type TierId = "esensial" | "signature" | "bespoke";

const TIER_IDS: TierId[] = ["esensial", "signature", "bespoke"];

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: 52,
  marginTop: 6,
  padding: "0 14px",
  fontSize: 16,
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#171719",
  background: "#fff",
  border: "3px solid #171719",
  borderRadius: 0,
  boxShadow: "3px 3px 0 #171719",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  margin: "14px 0",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

export default function Mulai() {
  const router = useRouter();
  const [tier, setTier] = useState<TierId>("signature");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    const q = router.query.tier;
    if (router.isReady && typeof q === "string" && (TIER_IDS as string[]).includes(q)) {
      setTier(q as TierId);
    }
    if (router.isReady && router.query.sandbox === "1") {
      setSandbox(true);
    }
  }, [router.isReady, router.query.tier, router.query.sandbox]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${resolveApiBase()}/v1/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, customer: { name, whatsapp, email }, sandbox }),
      });
      const body = (await res.json()) as { checkoutUrl?: string; externalOrderId?: string; error?: string };
      if (!res.ok || !body.checkoutUrl || !body.externalOrderId) {
        setError(body.error === "payment provider unavailable"
          ? "Pembayaran sedang tidak bisa dijangkau — coba lagi sebentar."
          : body.error === "checkout sandbox unavailable"
            ? "Mode test belum dikonfigurasi — hubungi admin."
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
    <div className={styles.page}>
      <Head>
        <title>{sandbox ? "YUTEMU — Coba checkout (TEST)" : "YUTEMU — Buat undangan playable"}</title>
        <meta name="description" content="Pilih paket, bayar, lalu isi data pernikahanmu sendiri lewat wizard terpandu." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <a className={styles.wordmark} href="/">
            <img
              className={styles.wordmarkMark}
              src="/brand/logo/yutemu-mark.webp"
              alt=""
              width={28}
              height={28}
            />
            YUTEMU
          </a>
          <a
            className={styles.topCta}
            href={waLink(WA_MESSAGES.general)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Chat WhatsApp
          </a>
        </div>
      </header>

      <main>
        <section className={styles.section}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h1 className={styles.sectionTitle}>Buat undangan playable.</h1>
              <p className={styles.sectionLede}>
                Pilih paket, bayar, lalu isi data pernikahanmu sendiri — tanpa coding, tanpa menunggu admin.
              </p>
            </div>

            {sandbox && (
              <p
                data-testid="mulai-sandbox"
                role="note"
                style={{ margin: "0 0 18px", padding: "12px 14px", fontSize: 14, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", color: "#171719", background: "#ffd98a", border: "3px solid #171719", boxShadow: "3px 3px 0 #171719" }}
              >
                Mode test — bayar via Duitku sandbox, bukan uang asli.
              </p>
            )}

            <p className={styles.stepIndex}>01</p>
            <h2 className={styles.stepTitle}>Pilih paket</h2>
            <div className={styles.ladder} role="radiogroup" aria-label="Pilih paket">
              {TIERS.map((t) => (
                <label
                  key={t.id}
                  className={styles.rung}
                  style={tier === t.id ? { background: "#ffd98a" } : undefined}
                >
                  <input
                    type="radio"
                    name="tier"
                    data-testid={`mulai-tier-${t.id}`}
                    checked={tier === t.id}
                    onChange={() => setTier(t.id as TierId)}
                    style={{ width: 20, height: 20, accentColor: "#171719" }}
                  />
                  <span className={styles.rungName}>{t.name}</span>
                  <span className={styles.rungPrice}>
                    mulai dari
                    <span className={styles.rungValue}>{t.price}</span>
                  </span>
                </label>
              ))}
            </div>

            <p className={styles.stepIndex} style={{ marginTop: 28 }}>02</p>
            <h2 className={styles.stepTitle}>Data pemesan</h2>
            <div className={styles.partner}>
              <label style={labelStyle}>
                Nama
                <input data-testid="mulai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                WhatsApp
                <input data-testid="mulai-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="08…" inputMode="tel" style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, marginBottom: 4 }}>
                Email
                <input data-testid="mulai-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" inputMode="email" style={inputStyle} />
              </label>

              {error && (
                <p
                  data-testid="mulai-error"
                  role="alert"
                  style={{ margin: "14px 0 0", padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#171719", border: "3px solid #e4636f", background: "#fff" }}
                >
                  {error}
                </p>
              )}

              <div style={{ marginTop: 18 }}>
                <button
                  data-testid="mulai-pay"
                  className={styles.btnGold}
                  onClick={() => void submit()}
                  disabled={busy}
                  style={{ fontFamily: "inherit", cursor: "pointer" }}
                >
                  {busy ? "Menyiapkan pembayaran…" : sandbox ? "Bayar TEST & lanjut isi data" : "Bayar & lanjut isi data"}
                </button>
              </div>
              <p className={styles.caption}>
                Setelah bayar berhasil kamu dapat link pribadi untuk mengisi data pernikahan.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footerInner}>
            <span className={styles.footerBrand}>
              <img src="/brand/logo/yutemu-mark.webp" alt="" width={22} height={22} />
              YUTEMU
            </span>
            <span>Temui kisah mereka.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
