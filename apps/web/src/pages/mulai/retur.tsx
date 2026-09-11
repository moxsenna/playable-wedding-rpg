import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { resolveApiBase } from "@/weddings/runtime";
import { waLink, WA_MESSAGES } from "@/config/offer";
import styles from "@/styles/Landing.module.css";

type Status = "menunggu" | "paid" | "gagal" | "tidak-dikenal";

const labelStyle: React.CSSProperties = {
  display: "block",
  margin: "14px 0",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

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

export default function Retur() {
  const router = useRouter();
  const [externalId, setExternalId] = useState("");
  const [status, setStatus] = useState<Status>("menunggu");
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoverOrder, setRecoverOrder] = useState("");
  const [recoverContact, setRecoverContact] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverError, setRecoverError] = useState("");

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
        const body = (await res.json()) as { status?: string; claimToken?: string | null; sandbox?: boolean };
        if (stop) return;
        if (body.sandbox === true) setSandbox(true);
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

  useEffect(() => {
    if (status !== "paid" || !claimToken) return;
    const t = window.setTimeout(() => {
      window.location.href = `/mulai/${encodeURIComponent(claimToken)}`;
    }, 2500);
    return () => window.clearTimeout(t);
  }, [status, claimToken]);

  const claimHref = claimToken ? `/mulai/${encodeURIComponent(claimToken)}` : "";

  const copyLink = async () => {
    if (!claimHref) return;
    const absolute = `${window.location.origin}${claimHref}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const recover = async () => {
    setRecoverBusy(true);
    setRecoverError("");
    try {
      const res = await fetch(`${resolveApiBase()}/v1/owner/recover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: recoverOrder, contact: recoverContact }),
      });
      const body = (await res.json()) as { claimToken?: string; projectId?: string; error?: string };
      if (!res.ok || !body.claimToken) {
        setRecoverError("Link tidak ditemukan — periksa ID order dan email/WhatsApp yang dipakai saat bayar.");
        return;
      }
      window.location.href = `/mulai/${encodeURIComponent(body.claimToken)}`;
    } catch {
      setRecoverError("Jaringan bermasalah — coba lagi.");
    } finally {
      setRecoverBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <Head>
        <title>YUTEMU — Status pembayaran</title>
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
        </div>
      </header>

      <main>
        <section className={styles.section}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h1 className={styles.sectionTitle}>Status pembayaran.</h1>
            </div>

            {sandbox && (
              <p
                data-testid="retur-sandbox"
                role="note"
                style={{ margin: "0 0 18px", padding: "12px 14px", fontSize: 14, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", color: "#171719", background: "#ffd98a", border: "3px solid #171719", boxShadow: "3px 3px 0 #171719" }}
              >
                Mode test — pembayaran via Duitku sandbox, bukan uang asli.
              </p>
            )}

            <div className={styles.partner}>
              {status === "menunggu" && (
                <p data-testid="retur-menunggu" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Menunggu konfirmasi pembayaran{externalId ? ` (${externalId})` : ""}… halaman ini memeriksa otomatis tiap beberapa detik. Biarkan terbuka.
                </p>
              )}
              {status === "paid" && claimToken && (
                <div>
                  <p data-testid="retur-berhasil" style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>
                    Pembayaran berhasil. Membuka studio isi datamu…
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a data-testid="retur-claim" className={`${styles.btnGold} ${styles.btnCompact}`} href={claimHref}>
                      Isi data pernikahan →
                    </a>
                    <button
                      data-testid="retur-copy"
                      className={`${styles.btnGhost} ${styles.btnCompact}`}
                      onClick={() => void copyLink()}
                      style={{ fontFamily: "inherit", cursor: "pointer" }}
                    >
                      {copied ? "Tersalin ✓" : "Salin link"}
                    </button>
                  </div>
                  <p className={styles.caption}>
                    Link ini bisa dibuka ulang kapan saja sampai kedaluwarsa — simpan baik-baik. Isianmu tersimpan otomatis tiap langkah.
                  </p>
                </div>
              )}
              {status === "paid" && !claimToken && (
                <p data-testid="retur-berhasil-tanpa-link" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Pembayaran berhasil, tapi link isi data belum tersedia — hubungi kami via WhatsApp.
                </p>
              )}
              {(status === "gagal" || status === "tidak-dikenal") && (
                <p style={{ margin: 0, fontSize: 16 }}>
                  {status === "gagal" ? "Pembayaran gagal atau kedaluwarsa." : "Order tidak ditemukan."}{" "}
                  <a href={waLink(WA_MESSAGES.general)} target="_blank" rel="noopener noreferrer">Chat WhatsApp</a> untuk bantuan.
                </p>
              )}
            </div>

            <p className={styles.stepIndex} style={{ marginTop: 28 }}>Buka lagi nanti</p>
            <h2 className={styles.stepTitle}>Lupa menyimpan link isi data?</h2>
            <div className={styles.partner}>
              <p className={styles.caption} style={{ marginTop: 0 }}>
                Masukkan ID order (mis. YWT-20260911-HA8V) dan email atau nomor WhatsApp yang dipakai saat bayar.
              </p>
              <label style={labelStyle}>
                ID order
                <input data-testid="retur-recover-order" value={recoverOrder} onChange={(e) => setRecoverOrder(e.target.value)} placeholder="YWT-…" style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, marginBottom: 4 }}>
                Email / WhatsApp
                <input data-testid="retur-recover-contact" value={recoverContact} onChange={(e) => setRecoverContact(e.target.value)} placeholder="email / 08…" style={inputStyle} />
              </label>
              {recoverError && (
                <p data-testid="retur-recover-error" role="alert" style={{ margin: "14px 0 0", padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#171719", border: "3px solid #e4636f", background: "#fff" }}>
                  {recoverError}
                </p>
              )}
              <div style={{ marginTop: 18 }}>
                <button
                  data-testid="retur-recover"
                  className={styles.btnGold}
                  onClick={() => void recover()}
                  disabled={recoverBusy}
                  style={{ fontFamily: "inherit", cursor: "pointer" }}
                >
                  {recoverBusy ? "Mencari…" : "Buka studio isi dataku"}
                </button>
              </div>
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

