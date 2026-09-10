import type {
  GalleryImage,
  Publication,
  StoryItem,
  Venue,
  WeddingEvent,
} from "@wedding-rpg/contracts";
import { landmarkIds } from "@wedding-rpg/contracts";
import { moveItem, uniqueId } from "./npcOps";

type PubPatch = (patch: Partial<Publication>) => void;

export function CoupleSection({ couple, onChange }: { couple: Publication["couple"]; onChange: (c: Publication["couple"]) => void }) {
  const set = (k: keyof Publication["couple"], v: string) => onChange({ ...couple, [k]: v });
  return (
    <section aria-label="Mempelai">
      <h2>Mempelai</h2>
      <label>
        Partner A
        <input data-testid="admin-partner-a" value={couple.partnerA} onChange={(e) => set("partnerA", e.target.value)} />
      </label>
      <label>
        Partner B
        <input data-testid="admin-partner-b" value={couple.partnerB} onChange={(e) => set("partnerB", e.target.value)} />
      </label>
      <label>
        Panggilan A
        <input data-testid="admin-nickname-a" value={couple.nicknameA ?? ""} onChange={(e) => set("nicknameA", e.target.value)} placeholder="Nama panggilan" />
      </label>
      <label>
        Panggilan B
        <input data-testid="admin-nickname-b" value={couple.nicknameB ?? ""} onChange={(e) => set("nicknameB", e.target.value)} placeholder="Nama panggilan" />
      </label>
      <label>
        Sapaan
        <input value={couple.welcome} onChange={(e) => set("welcome", e.target.value)} />
      </label>
      <label>
        Bio singkat
        <textarea data-testid="admin-bio" value={couple.bio ?? ""} onChange={(e) => set("bio", e.target.value)} rows={2} placeholder="Cerita singkat mempelai" />
      </label>
      <label>
        Foto (URL)
        <input data-testid="admin-photo" value={couple.photo ?? ""} onChange={(e) => set("photo", e.target.value)} placeholder="https://…" />
      </label>
      <label>
        Tanggal (YYYY-MM-DD)
        <input data-testid="admin-date" value={couple.dateISO} onChange={(e) => set("dateISO", e.target.value)} />
      </label>
    </section>
  );
}

const KINDS = ["akad", "reception", "afterparty", "other"] as const;

export function EventsSection({
  events,
  venues,
  coupleDate,
  onChange,
}: {
  events: WeddingEvent[];
  venues: Venue[];
  coupleDate: string;
  onChange: (e: WeddingEvent[]) => void;
}) {
  const set = (id: string, patch: Partial<WeddingEvent>) =>
    onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const add = () => {
    const id = uniqueId("event", events.map((e) => e.id));
    onChange([
      ...events,
      {
        id,
        kind: "other",
        title: "Acara Baru",
        dateISO: /^\d{4}-\d{2}-\d{2}$/.test(coupleDate) ? coupleDate : "2027-06-12",
        timeStart: "10:00",
        timeEnd: "12:00",
        venueId: venues[0]?.id ?? "venue",
      },
    ]);
  };
  return (
    <section aria-label="Acara">
      <h2>Acara</h2>
      {events.map((e, i) => (
        <details key={e.id} data-testid={`admin-event-card-${e.id}`}>
          <summary>{e.title}</summary>
          <label>
            Judul
            <input data-testid={`admin-event-${e.id}`} value={e.title} onChange={(ev) => set(e.id, { title: ev.target.value })} />
          </label>
          <label>
            Jenis
            <select value={e.kind} onChange={(e2) => set(e.id, { kind: e2.target.value as WeddingEvent["kind"] })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Tanggal
            <input value={e.dateISO} onChange={(e2) => set(e.id, { dateISO: e2.target.value })} />
          </label>
          <label>
            Mulai
            <input value={e.timeStart} onChange={(e2) => set(e.id, { timeStart: e2.target.value })} />
          </label>
          <label>
            Selesai
            <input value={e.timeEnd} onChange={(e2) => set(e.id, { timeEnd: e2.target.value })} />
          </label>
          <label>
            Venue
            <select value={e.venueId} onChange={(e2) => set(e.id, { venueId: e2.target.value })}>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Urutkan acara">
            <button data-testid={`admin-event-up-${e.id}`} onClick={() => onChange(moveItem(events, i, i - 1))} disabled={i === 0}>
              Naik
            </button>
            <button data-testid={`admin-event-down-${e.id}`} onClick={() => onChange(moveItem(events, i, i + 1))} disabled={i === events.length - 1}>
              Turun
            </button>
            <button data-testid={`admin-event-del-${e.id}`} onClick={() => onChange(events.filter((x) => x.id !== e.id))} disabled={events.length <= 1}>
              Hapus
            </button>
          </div>
        </details>
      ))}
      <button data-testid="admin-event-add" onClick={add} disabled={events.length >= 12}>
        Tambah Acara
      </button>
    </section>
  );
}

export function VenuesSection({
  venues,
  events,
  onChange,
}: {
  venues: Venue[];
  events: WeddingEvent[];
  onChange: (v: Venue[]) => void;
}) {
  const set = (id: string, patch: Partial<Venue>) =>
    onChange(venues.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const usedBy = (id: string) => events.filter((e) => e.venueId === id).map((e) => e.title);
  return (
    <section aria-label="Venue">
      <h2>Venue</h2>
      {venues.map((v) => {
        const used = usedBy(v.id);
        return (
          <details key={v.id} data-testid={`admin-venue-card-${v.id}`}>
            <summary>{v.name}</summary>
            <label>
              Nama
              <input data-testid={`admin-venue-name-${v.id}`} value={v.name} onChange={(e) => set(v.id, { name: e.target.value })} />
            </label>
            <label>
              Alamat
              <input value={v.address} onChange={(e) => set(v.id, { address: e.target.value })} />
            </label>
            <label>
              Maps URL
              <input value={v.mapsUrl ?? ""} onChange={(e) => set(v.id, { mapsUrl: e.target.value })} placeholder="https://…" />
            </label>
            <label>
              Landmark
              <select
                value={v.landmarkId ?? ""}
                onChange={(e) => set(v.id, { landmarkId: (e.target.value || undefined) as Venue["landmarkId"] })}
              >
                <option value="">— tidak ditautkan —</option>
                {landmarkIds.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
            {used.length > 0 && <p>Dipakai: {used.join(", ")}</p>}
            <button
              data-testid={`admin-venue-del-${v.id}`}
              onClick={() => onChange(venues.filter((x) => x.id !== v.id))}
              disabled={used.length > 0 || venues.length <= 1}
              title={used.length > 0 ? "Dipakai acara — pindahkan acara dulu" : undefined}
            >
              Hapus
            </button>
          </details>
        );
      })}
      <button
        data-testid="admin-venue-add"
        onClick={() => {
          const id = uniqueId("venue", venues.map((v) => v.id));
          onChange([...venues, { id, name: "Venue Baru", address: "" }]);
        }}
        disabled={venues.length >= 8}
      >
        Tambah Venue
      </button>
    </section>
  );
}

export function StorySection({ story, onChange }: { story: StoryItem[]; onChange: (s: StoryItem[]) => void }) {
  return (
    <section aria-label="Cerita">
      <h2>Cerita Kami</h2>
      {story.map((s, i) => (
        <details key={`${s.title}-${i}`} data-testid={`admin-story-card-${i}`}>
          <summary>{s.title}</summary>
          <label>
            Judul
            <input
              data-testid={`admin-story-title-${i}`}
              value={s.title}
              onChange={(e) => {
                const next = [...story];
                next[i] = { ...s, title: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <label>
            Isi
            <textarea
              data-testid={`admin-story-text-${i}`}
              value={s.text}
              onChange={(e) => {
                const next = [...story];
                next[i] = { ...s, text: e.target.value };
                onChange(next);
              }}
              rows={3}
            />
          </label>
          <div role="group" aria-label="Urutkan cerita">
            <button onClick={() => onChange(moveItem(story, i, i - 1))} disabled={i === 0}>
              Naik
            </button>
            <button onClick={() => onChange(moveItem(story, i, i + 1))} disabled={i === story.length - 1}>
              Turun
            </button>
            <button data-testid={`admin-story-del-${i}`} onClick={() => onChange(story.filter((_, j) => j !== i))} disabled={story.length <= 1}>
              Hapus
            </button>
          </div>
        </details>
      ))}
      <button
        data-testid="admin-story-add"
        onClick={() => onChange([...story, { title: "Bab Baru", text: "Tulis kisah di sini." }])}
        disabled={story.length >= 12}
      >
        Tambah Bab
      </button>
    </section>
  );
}

export function GallerySection({ gallery, onChange }: { gallery: GalleryImage[]; onChange: (g: GalleryImage[]) => void }) {
  const set = (i: number, patch: Partial<GalleryImage>) => {
    const next = [...gallery];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const setCover = (i: number) => onChange(gallery.map((g, j) => ({ ...g, cover: j === i ? true : undefined })));
  return (
    <section aria-label="Galeri">
      <h2>Gallery</h2>
      {gallery.map((g, i) => (
        <details key={`${g.src}-${i}`} data-testid={`admin-gallery-card-${i}`}>
          <summary>{g.alt || g.src}{g.cover ? " ★" : ""}</summary>
          <label>
            URL gambar
            <input data-testid={`admin-gallery-src-${i}`} value={g.src} onChange={(e) => set(i, { src: e.target.value })} placeholder="https://… atau assets/…" />
          </label>
          <label>
            Keterangan
            <input data-testid={`admin-gallery-alt-${i}`} value={g.alt} onChange={(e) => set(i, { alt: e.target.value })} />
          </label>
          <label>
            <input type="checkbox" data-testid={`admin-gallery-cover-${i}`} checked={g.cover === true} onChange={() => setCover(i)} />
            Jadikan cover
          </label>
          <div role="group" aria-label="Urutkan galeri">
            <button onClick={() => onChange(moveItem(gallery, i, i - 1))} disabled={i === 0}>
              Naik
            </button>
            <button onClick={() => onChange(moveItem(gallery, i, i + 1))} disabled={i === gallery.length - 1}>
              Turun
            </button>
            <button data-testid={`admin-gallery-del-${i}`} onClick={() => onChange(gallery.filter((_, j) => j !== i))}>
              Hapus
            </button>
          </div>
        </details>
      ))}
      <button
        data-testid="admin-gallery-add"
        onClick={() => onChange([...gallery, { src: "https://", alt: "Foto baru" }])}
        disabled={gallery.length >= 24}
      >
        Tambah Foto
      </button>
    </section>
  );
}

export function GiftSection({ pub, onChange }: { pub: Publication; onChange: PubPatch }) {
  const gift = pub.gift;
  return (
    <section aria-label="Hadiah">
      <h2>Hadiah</h2>
      {!gift ? (
        <button
          data-testid="admin-gift-add"
          onClick={() => onChange({ gift: { bankName: "", accountNumber: "", accountName: "" } })}
        >
          Aktifkan Info Hadiah
        </button>
      ) : (
        <>
          <label>
            Bank
            <input value={gift.bankName} onChange={(e) => onChange({ gift: { ...gift, bankName: e.target.value } })} />
          </label>
          <label>
            Nomor rekening
            <input value={gift.accountNumber} onChange={(e) => onChange({ gift: { ...gift, accountNumber: e.target.value } })} />
          </label>
          <label>
            Atas nama
            <input value={gift.accountName} onChange={(e) => onChange({ gift: { ...gift, accountName: e.target.value } })} />
          </label>
          <label>
            E-wallet
            <input
              data-testid="admin-gift-ewallet"
              value={gift.ewalletProvider ?? ""}
              onChange={(e) => onChange({ gift: { ...gift, ewalletProvider: e.target.value } })}
              placeholder="DANA / OVO / GoPay"
            />
          </label>
          <label>
            Nomor e-wallet
            <input value={gift.ewalletNumber ?? ""} onChange={(e) => onChange({ gift: { ...gift, ewalletNumber: e.target.value } })} />
          </label>
          <label>
            Registry URL
            <input value={gift.registryUrl ?? ""} onChange={(e) => onChange({ gift: { ...gift, registryUrl: e.target.value } })} placeholder="https://…" />
          </label>
          <label>
            Catatan
            <input value={gift.note ?? ""} onChange={(e) => onChange({ gift: { ...gift, note: e.target.value } })} />
          </label>
        </>
      )}
    </section>
  );
}

export function OptionsSection({ pub, onChange }: { pub: Publication; onChange: PubPatch }) {
  return (
    <section aria-label="Opsi">
      <h2>Opsi Undangan</h2>
      {(["rsvp", "gallery", "gift"] as const).map((m) => (
        <label key={m}>
          <input
            type="checkbox"
            data-testid={`admin-module-${m}`}
            checked={pub.modules[m]}
            onChange={(e) => onChange({ modules: { ...pub.modules, [m]: e.target.checked } })}
          />
          Modul {m}
        </label>
      ))}
      <label>
        Dresscode
        <textarea
          data-testid="admin-dresscode"
          value={pub.dresscode?.text ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? { dresscode: { text: e.target.value } } : { dresscode: undefined })
          }
          rows={2}
          placeholder="Kosongkan untuk menyembunyikan"
        />
      </label>
    </section>
  );
}
