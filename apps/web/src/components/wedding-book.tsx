import { useEffect, useMemo, useState } from "react";
import { EventBus, BRIDGE_EVENTS } from "@wedding-rpg/game";
import { dispatchSemanticAction } from "@wedding-rpg/game";
import { loadProfile } from "../weddings/profile";
import { resolveApiBase, useRuntimeWedding } from "../weddings/runtime";
import { resolveWeddingId } from "../weddings/select";
import {
  validatePublication,
  visibleSections,
  type BookSection,
  type Publication,
} from "@wedding-rpg/contracts";

const SECTION_LABELS: Record<BookSection, string> = {
  home: "Home",
  events: "Acara",
  venue: "Lokasi",
  dresscode: "Dresscode",
  gallery: "Gallery",
  rsvp: "Pesan",
  gift: "Hadiah",
  story: "Cerita Kami",
};

function formatDateID(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function resolveGallerySrc(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith("/")) return src;
  return `/${src.replace(/^\.\//, "")}`;
}

function formatTimeID(hhmm: string): string {
  return hhmm.replace(":", ".");
}

interface DialogueActionPayload {
  action?: { type?: string; section?: string };
  npcId?: string;
}

const WISHES_KEY = "wedding-rpg:wishes";

export interface WishEntry {
  name: string;
  message: string;
  createdAt: number;
}

// Posts to the shared guestbook when a session exists (memory on clean
// URLs, ?session= on dev URLs); otherwise keeps a local outbox.
async function sendWish(name: string, message: string, session: string | null): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (session) {
    try {
      const res = await fetch(`${resolveApiBase().replace(/\/$/, "")}/v1/guestbook`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-session": session },
        body: JSON.stringify({ message: message.slice(0, 280) }),
      });
      if (res.ok) return true;
    } catch {
      /* fall through to the local outbox */
    }
  }
  try {
    const raw = window.localStorage.getItem(WISHES_KEY);
    const list = raw ? (JSON.parse(raw) as { name: string; message: string; at: number }[]) : [];
    list.push({ name, message, at: Date.now() });
    window.localStorage.setItem(WISHES_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable; the success screen still confirms */
  }
  return false;
}

async function loadWishes(projectId: string): Promise<WishEntry[]> {
  try {
    const res = await fetch(
      `${resolveApiBase().replace(/\/$/, "")}/v1/guestbook?project=${encodeURIComponent(projectId)}`
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { entries?: { name: string; message: string; createdAt: number }[] };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    return entries.slice(-30).reverse().map((e) => ({
      name: String(e.name ?? "").slice(0, 40),
      message: String(e.message ?? "").slice(0, 280),
      createdAt: Number(e.createdAt ?? 0),
    }));
  } catch {
    return [];
  }
}

// Canonical wedding information, React-owned (D-012/D-017). Usable before,
// during, and without Phaser: it never reads game state, only the validated
// publication fixture (durable backend replaces the source in M8).
export function WeddingBook() {
  const runtime = useRuntimeWedding();
  const publication = runtime.status === "ready" || runtime.status === "fixture" ? runtime.publication : null;
  const checked = useMemo(() => (publication ? validatePublication(publication) : null), [publication]);
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<BookSection>("home");
  const [guestName, setGuestName] = useState(() => loadProfile()?.name ?? "");
  const [wishMessage, setWishMessage] = useState("");
  const [wishDone, setWishDone] = useState(false);
  const [wishSent, setWishSent] = useState(false);
  const [wishes, setWishes] = useState<WishEntry[]>([]);

  const session =
    runtime.status === "ready" && runtime.session
      ? runtime.session
      : typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("session") ??
          (window as unknown as { __weddingSession?: string }).__weddingSession ??
          null
        : null;
  const wishesProject =
    runtime.status === "ready" ? runtime.projectId : resolveWeddingId();

  useEffect(() => {
    if (!open || section !== "rsvp") return;
    let cancelled = false;
    void loadWishes(wishesProject).then((list) => {
      if (!cancelled) setWishes(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, section, wishesProject, wishDone]);

  const openBook = (s: BookSection) => {
    setSection(s);
    setOpen(true);
    EventBus.emit(BRIDGE_EVENTS.modalOpened);
  };
  const closeBook = () => {
    setOpen(false);
    EventBus.emit(BRIDGE_EVENTS.modalClosed);
  };

  useEffect(() => {
    const onDialogueAction = (p: DialogueActionPayload) => {
      const type = p?.action?.type;
      if (typeof type !== "string") return;
      const result = dispatchSemanticAction(type);
      if (!result.handled || result.deferred !== "react") return;
      if (type === "OPEN_RSVP") openBook("rsvp");
      else if (type === "OPEN_GALLERY") openBook("gallery");
      else if (type === "OPEN_MAPS") openBook("venue");
      else if (type === "OPEN_WEDDING_BOOK") openBook("home");
      else if (type === "OPEN_WEDDING_BOOK_SECTION") {
        const s = p.action?.section;
        openBook(s === "events" || s === "venue" || s === "gallery" || s === "rsvp" ? s : "home");
      }
    };
    EventBus.on(BRIDGE_EVENTS.dialogueAction, onDialogueAction);
    return () => {
      EventBus.off(BRIDGE_EVENTS.dialogueAction, onDialogueAction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBook();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  if (runtime.status === "loading") {
    return (
      <button data-testid="wedding-book-open" className="book-open-btn" disabled>
        Undangan
      </button>
    );
  }
  if (runtime.status === "error" || !checked?.ok || !checked.publication) {
    return (
      <>
        <button data-testid="wedding-book-open" className="book-open-btn" onClick={() => openBook("home")}>
          Undangan
        </button>
        {open && (
          <div data-testid="wedding-book" className="book-sheet" role="dialog" aria-modal="true" aria-label="Undangan">
            <p data-testid="book-error">Data undangan belum tersedia.</p>
            <button className="book-close" onClick={closeBook}>
              Tutup
            </button>
          </div>
        )}
      </>
    );
  }
  const pub: Publication = checked.publication;
  const sections = visibleSections(pub);
  const venueById = Object.fromEntries(pub.venues.map((v) => [v.id, v]));

  return (
    <>
        <button data-testid="wedding-book-open" className="book-open-btn" onClick={() => openBook("home")}>
          Undangan
        </button>
        {open && (
          <div data-testid="wedding-book" className="book-sheet" role="dialog" aria-modal="true" aria-label="Undangan">
            <div className="book-header">
              <strong>Undangan</strong>
              <span className="book-brand">YUTEMU</span>
            <button data-testid="wedding-book-close" className="book-close" onClick={closeBook} autoFocus>
              Tutup
            </button>
          </div>
          <nav className="book-nav" aria-label="Bagian Undangan">
            {sections.map((s) => (
              <button
                key={s}
                data-testid={`book-nav-${s}`}
                className={s === section ? "book-nav-active" : ""}
                aria-current={s === section ? "page" : undefined}
                onClick={() => setSection(s)}
              >
                {SECTION_LABELS[s]}
              </button>
            ))}
          </nav>
          <div className="book-body">
            {section === "home" && (
              <section data-testid="book-section-home">
                <h2 data-testid="book-couple">
                  {pub.couple.partnerA} &amp; {pub.couple.partnerB}
                </h2>
                <p data-testid="book-date">{formatDateID(pub.couple.dateISO)}</p>
                <p>{pub.couple.welcome}</p>
              </section>
            )}
            {section === "events" && (
              <section data-testid="book-section-events">
                <h2>Acara</h2>
                {pub.events.map((e) => (
                  <article key={e.id} className="book-event">
                    <h3 data-testid={`book-event-${e.id}`}>{e.title}</h3>
                    <p>
                      {formatDateID(e.dateISO)} · {formatTimeID(e.timeStart)}–{formatTimeID(e.timeEnd)}
                    </p>
                    <p>{venueById[e.venueId]?.name ?? ""}</p>
                  </article>
                ))}
              </section>
            )}
            {section === "venue" && (
              <section data-testid="book-section-venue">
                <h2>Lokasi</h2>
                {pub.venues.map((v) => (
                  <article key={v.id} className="book-venue">
                    <h3 data-testid="book-venue-name">{v.name}</h3>
                    <p>{v.address}</p>
                    {v.mapsUrl && (
                      <p>
                        <a href={v.mapsUrl} target="_blank" rel="noreferrer">
                          Buka di Maps
                        </a>
                      </p>
                    )}
                    {v.landmarkId && (
                      <button
                        data-testid="venue-show-in-world"
                        onClick={() => {
                          EventBus.emit(BRIDGE_EVENTS.navigateToLandmark, { landmarkId: v.landmarkId });
                          closeBook();
                        }}
                      >
                        Tunjukkan di Dunia
                      </button>
                    )}
                  </article>
                ))}
              </section>
            )}
            {section === "dresscode" && pub.dresscode && (
              <section data-testid="book-section-dresscode">
                <h2>Dresscode</h2>
                <p>{pub.dresscode.text}</p>
              </section>
            )}
            {section === "gallery" && (
              <section data-testid="book-section-gallery">
                <h2>Gallery</h2>
                <div className="book-gallery">
                  {pub.gallery.map((g) => (
                    <img key={g.src} data-testid="gallery-img" src={resolveGallerySrc(g.src)} alt={g.alt} loading="lazy" />
                  ))}
                </div>
              </section>
            )}
            {section === "rsvp" && (
              <section data-testid="book-section-rsvp">
                <h2>Pesan untuk Mempelai</h2>
                {/* Not the demo sticker: that is reserved for the synthetic-data
                    label. And the copy does not promise instant delivery, because
                    an offline guest's wish lands in a local outbox first. */}
                <p className="book-helper">Tulis doa dan ucapan terbaikmu untuk mereka.</p>
                {!wishDone ? (
                  <div className="book-rsvp-form">
                    <label>
                      Nama
                      <input
                        data-testid="rsvp-name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Nama kamu"
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      Pesan
                      <textarea
                        data-testid="wishes-message"
                        value={wishMessage}
                        onChange={(e) => setWishMessage(e.target.value)}
                        placeholder="Contoh: Selamat menempuh hidup baru…"
                        rows={4}
                        maxLength={280}
                      />
                    </label>
                    <button
                      data-testid="rsvp-submit"
                      disabled={guestName.trim().length === 0 || wishMessage.trim().length === 0}
                      onClick={() => {
                        void sendWish(guestName.trim(), wishMessage.trim(), session).then((sent) => {
                          setWishSent(sent);
                          setWishDone(true);
                        });
                      }}
                    >
                      Kirim Pesan
                    </button>
                  </div>
                ) : (
                  <p data-testid="rsvp-success">
                    Terima kasih, {guestName.trim()}!{" "}
                    {wishSent
                      ? "Pesanmu sudah terkirim ke mempelai. ♥"
                      : "Pesanmu tersimpan di perangkat ini dan akan terkirim saat online."}
                  </p>
                )}
                <div className="book-wishes">
                  <h3>Doa & Ucapan Tamu</h3>
                  {wishes.length === 0 ? (
                    <p className="book-wishes-empty">Jadilah yang pertama menulis ucapan.</p>
                  ) : (
                    <ul data-testid="wishes-list">
                      {wishes.map((w, i) => (
                        <li key={`${w.createdAt}-${i}`}>
                          <strong>{w.name}</strong>
                          <p>{w.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}
            {section === "gift" && pub.gift && (
              <section data-testid="book-section-gift">
                <h2>Hadiah</h2>
                <p className="book-demo-tag">Contoh — belum aktif.</p>
                <div data-testid="gift-info" className="book-gift">
                  <p>{pub.gift.bankName}</p>
                  <p>{pub.gift.accountNumber}</p>
                  <p>{pub.gift.accountName}</p>
                  {pub.gift.note && <p>{pub.gift.note}</p>}
                </div>
              </section>
            )}
            {section === "story" && (
              <section data-testid="book-section-story">
                <h2>Cerita Kami</h2>
                {pub.story.map((s) => (
                  <article key={s.title} className="book-story">
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </article>
                ))}
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
