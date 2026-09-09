import { useEffect, useMemo, useState } from "react";
import { EventBus, BRIDGE_EVENTS } from "@wedding-rpg/game";
import { dispatchSemanticAction } from "@wedding-rpg/game";
import { loadProfile } from "../weddings/profile";
import {
  validatePublication,
  visibleSections,
  type BookSection,
  type Publication,
} from "@wedding-rpg/contracts";
import { DEMO_PUBLICATION } from "../weddings/demo-publication";

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

function formatTimeID(hhmm: string): string {
  return hhmm.replace(":", ".");
}

interface DialogueActionPayload {
  action?: { type?: string; section?: string };
  npcId?: string;
}

const WISHES_KEY = "wedding-rpg:wishes";

// Sends a guest wish to the couple. Online (api + session in the URL),
// the message posts to the durable guestbook; otherwise it is kept in a
// local outbox on the device. Resolves true when the couple received it.
async function sendWish(name: string, message: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  const apiBase = q.get("api");
  const session = q.get("session") ?? "";
  if (apiBase && session) {
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/v1/guestbook`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-session": session },
        body: JSON.stringify({ message: `${name}: ${message}`.slice(0, 280) }),
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

// Canonical wedding information, React-owned (D-012/D-017). Usable before,
// during, and without Phaser: it never reads game state, only the validated
// publication fixture (durable backend replaces the source in M8).
export function WeddingBook() {
  const checked = useMemo(() => validatePublication(DEMO_PUBLICATION), []);
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<BookSection>("home");
  const [guestName, setGuestName] = useState(() => loadProfile()?.name ?? "");
  const [wishMessage, setWishMessage] = useState("");
  const [wishDone, setWishDone] = useState(false);
  const [wishSent, setWishSent] = useState(false);

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

  if (!checked.ok || !checked.publication) {
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
                    <img key={g.src} data-testid="gallery-img" src={g.src} alt={g.alt} loading="lazy" />
                  ))}
                </div>
              </section>
            )}
            {section === "rsvp" && (
              <section data-testid="book-section-rsvp">
                <h2>Pesan untuk Mempelai</h2>
                <p className="book-demo-tag">Tulis doa dan ucapan terbaikmu — langsung terkirim ke mempelai.</p>
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
                        void sendWish(guestName.trim(), wishMessage.trim()).then((sent) => {
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
