import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import type { Publication } from "@wedding-rpg/contracts";
import { validatePublication } from "@wedding-rpg/contracts";
import {
  CoupleSection,
  EventsSection,
  GallerySection,
  GiftSection,
  OptionsSection,
  StorySection,
  VenuesSection,
} from "@/studio/WeddingSections";
import { resolveApiBase } from "@/weddings/runtime";

const SKELETON: Publication = {
  id: "main",
  couple: {
    partnerA: "Nama Mempelai A",
    partnerB: "Nama Mempelai B",
    dateISO: "2027-06-12",
    welcome: "Selamat datang di pernikahan kami",
  },
  events: [
    {
      id: "event-akad",
      kind: "akad",
      title: "Akad Nikah",
      dateISO: "2027-06-12",
      timeStart: "08:00",
      timeEnd: "10:00",
      venueId: "venue-utama",
    },
  ],
  venues: [{ id: "venue-utama", name: "Gedung Acara", address: "Alamat lengkap gedung acara" }],
  gallery: [],
  story: [{ title: "Awal kisah kami", text: "Tulis kisah kalian di sini" }],
  modules: { rsvp: true, gift: false, gallery: true },
  world: { templateKey: "garden-village-v1", templateVersion: 1 },
};

const PLACEHOLDERS = [
  SKELETON.couple.partnerA,
  SKELETON.couple.partnerB,
  "Alamat lengkap gedung acara",
  "Tulis kisah kalian di sini",
];

const STEPS = [
  "Mempelai",
  "Acara",
  "Lokasi",
  "Cerita",
  "Galeri",
  "Hadiah",
  "Tamu",
  "Terbitkan",
] as const;

interface GuestRow {
  id: string;
  name: string;
  token: string;
  rsvp: string | null;
}

export default function Wizard() {
  const router = useRouter();
  const claimToken = typeof router.query.token === "string" ? router.query.token : "";
  const [phase, setPhase] = useState<"loading" | "invalid" | "ready">("loading");
  const [ownerToken, setOwnerToken] = useState("");
  const [projectName, setProjectName] = useState("");
  const [tier, setTier] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pub, setPub] = useState<Publication>(SKELETON);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestCsv, setGuestCsv] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [liveVersion, setLiveVersion] = useState<number | null>(null);
  const exchanged = useRef(false);

  const api = resolveApiBase();
  const ownerHeaders = (token: string): Record<string, string> => ({
    "content-type": "application/json",
    "x-owner-token": token,
  });

  useEffect(() => {
    if (!router.isReady || !claimToken || exchanged.current) return;
    exchanged.current = true;
    const boot = async () => {
      let token = "";
      try {
        token = localStorage.getItem(`yutemu-owner-session:${claimToken}`) ?? "";
      } catch {
        token = "";
      }
      if (!token) {
        const res = await fetch(`${resolveApiBase()}/v1/owner/claim`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: claimToken }),
        });
        if (!res.ok) {
          setPhase("invalid");
          return;
        }
        const body = (await res.json()) as { ownerToken?: string };
        token = body.ownerToken ?? "";
        if (!token) {
          setPhase("invalid");
          return;
        }
        try {
          localStorage.setItem(`yutemu-owner-session:${claimToken}`, token);
        } catch {
          // Session-only fallback: the wizard still works until reload.
        }
      }
      const me = await fetch(`${resolveApiBase()}/v1/owner/me`, { headers: { "x-owner-token": token } });
      if (!me.ok) {
        try {
          localStorage.removeItem(`yutemu-owner-session:${claimToken}`);
        } catch {
          // Ignore cleanup failure.
        }
        setPhase("invalid");
        return;
      }
      const meBody = (await me.json()) as {
        project?: { id: string; name: string; tier: string | null; status: string };
      };
      setOwnerToken(token);
      setProjectName(meBody.project?.name ?? "");
      setTier(meBody.project?.tier ?? "");
      setProjectId(meBody.project?.id ?? "");
      try {
        const backup = localStorage.getItem(`yutemu-wizard:${claimToken}`);
        if (backup) {
          const parsed = validatePublication(JSON.parse(backup));
          if (parsed.ok && parsed.publication) setPub(parsed.publication);
        }
      } catch {
        // Corrupt backup is ignored; the draft below wins when present.
      }
      const draft = await fetch(`${resolveApiBase()}/v1/owner/draft`, {
        headers: { "x-owner-token": token },
      }).then((r) => r.json()) as { version?: { id: string; snapshot: unknown } };
      if (draft.version) {
        const parsed = validatePublication(draft.version.snapshot);
        if (parsed.ok && parsed.publication) {
          setPub(parsed.publication);
          setDraftId(draft.version.id);
        }
      }
      setPhase("ready");
    };
    void boot();
  }, [router.isReady, claimToken]);

  useEffect(() => {
    if (phase !== "ready" || !claimToken) return;
    try {
      localStorage.setItem(`yutemu-wizard:${claimToken}`, JSON.stringify(pub));
    } catch {
      // Backup is best-effort; the server draft is the source of truth.
    }
  }, [pub, phase, claimToken]);

  const patch = (p: Partial<Publication>) => setPub((prev) => ({ ...prev, ...p }));

  const saveDraft = async (): Promise<string | null> => {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(`${api}/v1/owner/draft`, {
        method: "PUT",
        headers: ownerHeaders(ownerToken),
        body: JSON.stringify({ snapshot: pub }),
      });
      const body = (await res.json()) as { version?: { id: string }; error?: string };
      if (!res.ok || !body.version) {
        setNotice(`Gagal menyimpan: ${body.error ?? "periksa lagi isianmu"}`);
        return null;
      }
      setDraftId(body.version.id);
      setNotice("Draf tersimpan.");
      return body.version.id;
    } catch {
      setNotice("Gagal menyimpan — periksa koneksi.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const loadGuests = async () => {
    const res = await fetch(`${api}/v1/owner/guests`, { headers: { "x-owner-token": ownerToken } });
    if (!res.ok) return;
    const body = (await res.json()) as { guests?: GuestRow[] };
    setGuests(body.guests ?? []);
  };

  useEffect(() => {
    if (phase === "ready" && STEPS[step] === "Tamu" && ownerToken) void loadGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  const addGuest = async () => {
    const name = guestName.trim();
    if (!name) return;
    const res = await fetch(`${api}/v1/owner/guests`, {
      method: "POST",
      headers: ownerHeaders(ownerToken),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setNotice("Gagal menambah tamu.");
      return;
    }
    setGuestName("");
    await loadGuests();
  };

  const importGuests = async () => {
    if (!guestCsv.trim()) return;
    const res = await fetch(`${api}/v1/owner/guests/import`, {
      method: "POST",
      headers: ownerHeaders(ownerToken),
      body: JSON.stringify({ csv: guestCsv }),
    });
    const body = (await res.json()) as { created?: number; skipped?: number; rejected?: unknown[] };
    if (!res.ok) {
      setNotice("Impor gagal — periksa format CSV.");
      return;
    }
    setNotice(`Impor selesai: ${body.created ?? 0} ditambah, ${body.skipped ?? 0} dilewati.`);
    setGuestCsv("");
    await loadGuests();
  };

  const preview = async () => {
    const id = draftId ?? (await saveDraft());
    if (!id) return;
    const res = await fetch(`${api}/v1/owner/preview`, {
      method: "POST",
      headers: ownerHeaders(ownerToken),
      body: JSON.stringify({ versionId: id }),
    });
    const body = (await res.json()) as { previewToken?: string };
    if (!res.ok || !body.previewToken) {
      setNotice("Gagal membuat pratinjau.");
      return;
    }
    window.open(`/g/preview/${body.previewToken}`, "_blank", "noopener");
  };

  const publish = async () => {
    const id = draftId ?? (await saveDraft());
    if (!id) return;
    setBusy(true);
    try {
      const pubRes = await fetch(`${api}/v1/owner/publish`, {
        method: "POST",
        headers: ownerHeaders(ownerToken),
        body: JSON.stringify({ versionId: id }),
      });
      const pubBody = (await pubRes.json()) as { error?: string };
      if (!pubRes.ok) {
        setNotice(`Gagal menerbitkan: ${pubBody.error ?? "periksa validasi"}`);
        return;
      }
      const actRes = await fetch(`${api}/v1/owner/activate`, {
        method: "POST",
        headers: ownerHeaders(ownerToken),
        body: JSON.stringify({ versionId: id }),
      });
      const actBody = (await actRes.json()) as { version?: { version: number }; error?: string };
      if (!actRes.ok || !actBody.version) {
        setNotice(`Draf terbit, aktivasi gagal: ${actBody.error ?? "coba lagi"}`);
        return;
      }
      setLiveVersion(actBody.version.version);
      setNotice("Undanganmu sudah live. Bagikan link tamu dari langkah Tamu.");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
        <Head><title>YUTEMU — Isi data pernikahan</title></Head>
        <p>Menyiapkan studio pribadimu…</p>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
        <Head><title>YUTEMU — Link tidak valid</title></Head>
        <h1>Link tidak valid</h1>
        <p data-testid="wizard-invalid">Link isi data ini sudah dipakai, kedaluwarsa, atau salah. Minta link baru via WhatsApp kami.</p>
        <p><a href="/">← Kembali</a></p>
      </div>
    );
  }

  const validation = validatePublication(pub);
  const json = JSON.stringify(pub);
  const untouched = PLACEHOLDERS.filter((p) => json.includes(p));
  const current = STEPS[step];

  return (
    <div className="admin-page" style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
      <Head>
        <title>YUTEMU — Isi data pernikahan</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <p><small data-testid="wizard-project">{projectName}{tier ? ` · ${tier}` : ""}</small></p>
      <h1>Isi data pernikahan</h1>
      <ol style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 0, listStyle: "none" }}>
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              data-testid={`wizard-step-${i}`}
              onClick={() => setStep(i)}
              disabled={i === step}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      {current === "Mempelai" && (
        <CoupleSection couple={pub.couple} onChange={(couple) => patch({ couple })} />
      )}
      {current === "Acara" && (
        <EventsSection events={pub.events} venues={pub.venues} coupleDate={pub.couple.dateISO} onChange={(events) => patch({ events })} />
      )}
      {current === "Lokasi" && (
        <VenuesSection venues={pub.venues} events={pub.events} onChange={(venues) => patch({ venues })} />
      )}
      {current === "Cerita" && (
        <StorySection story={pub.story} onChange={(story) => patch({ story })} />
      )}
      {current === "Galeri" && (
        <GallerySection
          gallery={pub.gallery}
          onChange={(gallery) => patch({ gallery })}
          media={{ apiBase: api, adminKey: "", projectId, ownerToken }}
          onNotice={(msg) => setNotice(msg)}
        />
      )}
      {current === "Hadiah" && (
        <>
          <OptionsSection pub={pub} onChange={patch} />
          <GiftSection pub={pub} onChange={patch} />
        </>
      )}
      {current === "Tamu" && (
        <section aria-label="Tamu">
          <h2>Tamu</h2>
          <label>
            Nama tamu
            <input data-testid="wizard-guest-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nama tamu / keluarga" />
          </label>
          <button data-testid="wizard-guest-add" onClick={() => void addGuest()}>Tambah</button>
          <label style={{ display: "block", marginTop: 12 }}>
            Impor CSV (nama, atau nama,telepon,email)
            <textarea data-testid="wizard-guest-csv" value={guestCsv} onChange={(e) => setGuestCsv(e.target.value)} rows={3} style={{ display: "block", width: "100%" }} />
          </label>
          <button data-testid="wizard-guest-import" onClick={() => void importGuests()}>Impor</button>
          <ul data-testid="wizard-guest-list">
            {guests.map((g) => (
              <li key={g.id}>
                {g.name} — <code>/g/{g.token}</code>
              </li>
            ))}
          </ul>
          {liveVersion !== null && guests.length === 0 && (
            <p>Undanganmu live tapi belum ada tamu — tambahkan minimal satu nama di atas.</p>
          )}
        </section>
      )}
      {current === "Terbitkan" && (
        <section aria-label="Terbitkan">
          <h2>Periksa & terbitkan</h2>
          {!validation.ok && (
            <ul data-testid="wizard-errors">
              {validation.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {validation.ok && <p data-testid="wizard-valid">Semua data valid.</p>}
          {untouched.length > 0 && (
            <p data-testid="wizard-placeholders">Masih contoh, ganti dengan datamu: {untouched.join(", ")}</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button data-testid="wizard-save" onClick={() => void saveDraft()} disabled={busy}>Simpan draf</button>
            <button data-testid="wizard-preview" onClick={() => void preview()} disabled={busy}>Pratinjau</button>
            <button data-testid="wizard-publish" onClick={() => void publish()} disabled={busy || !validation.ok}>
              Terbitkan sekarang
            </button>
          </div>
          {liveVersion !== null && (
            <p data-testid="wizard-live">Undanganmu live (versi {liveVersion}). Tamu dengan link pribadi bisa masuk sekarang.</p>
          )}
        </section>
      )}

      {notice && <p data-testid="wizard-notice" role="status">{notice}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Kembali</button>
        {step < STEPS.length - 1 && (
          <button
            data-testid="wizard-next"
            onClick={async () => {
              const id = await saveDraft();
              if (id) setStep((s) => s + 1);
            }}
            disabled={busy}
          >
            Simpan & lanjut
          </button>
        )}
      </div>
    </div>
  );
}
