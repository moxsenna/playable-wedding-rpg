import type { NpcBinding } from "@wedding-rpg/contracts";
import { bookSections, heartIds, npcActionTypes, npcRoles, npcSlotIds } from "@wedding-rpg/contracts";
import { addDialogueNode, deleteDialogueNode, heartAssignments, moveHeart, swapSlots } from "./npcOps";

const SLOT_LABELS: Record<string, string> = {
  "npc.greeter": "Greeter",
  "npc.rsvp_keeper": "RSVP Keeper",
  "npc.story_keeper": "Story Keeper",
  "npc.photographer": "Photographer",
  "npc.travel_friend": "Travel Friend",
  "npc.event_coordinator": "Event Coordinator",
  "npc.venue_guide": "Venue Guide",
  "npc.proposal_friend": "Proposal Friend",
  "npc.couple_a": "Partner A",
  "npc.couple_b": "Partner B",
};

const ACTION_LABELS: Record<string, string> = {
  OPEN_WEDDING_BOOK: "Buka Undangan",
  OPEN_WEDDING_BOOK_SECTION: "Buka Bagian Undangan",
  OPEN_RSVP: "Buka Pesan",
  OPEN_GALLERY: "Buka Gallery",
  OPEN_MAPS: "Buka Lokasi",
  OPEN_GUESTBOOK: "Buka Guestbook",
  START_MAIN_QUEST: "Mulai Story",
  GRANT_HEART: "Beri Hati",
  START_FINALE: "Mulai Finale",
};

export function NpcSection({
  bindings,
  avatarIds,
  onChange,
}: {
  bindings: NpcBinding[];
  avatarIds: string[];
  onChange: (b: NpcBinding[]) => void;
}) {
  const set = (slotId: string, patch: Partial<NpcBinding>) =>
    onChange(bindings.map((b) => (b.slotId === slotId ? { ...b, ...patch } : b)));
  const ordered = [...bindings].sort(
    (a, b) => npcSlotIds.indexOf(a.slotId as (typeof npcSlotIds)[number]) - npcSlotIds.indexOf(b.slotId as (typeof npcSlotIds)[number])
  );
  return (
    <section aria-label="NPC" id="st-npc">
      <h2>NPC ({bindings.length}/{npcSlotIds.length})</h2>
      <p className="field-hint">Setiap peran diisi tepat satu karakter. Lokasi mengikuti slot; tukar untuk memindahkan.</p>
      {ordered.map((b) => (
        <details key={b.slotId} data-testid={`admin-npc-${b.slotId}`}>
          <summary>
            {SLOT_LABELS[b.slotId] ?? b.slotId} — {b.displayName}
          </summary>
          <label>
            Nama tampilan
            <input
              data-testid={`admin-npc-name-${b.slotId}`}
              value={b.displayName}
              onChange={(e) => set(b.slotId, { displayName: e.target.value })}
            />
          </label>
          <label>
            Avatar
            <select
              data-testid={`admin-npc-avatar-${b.slotId}`}
              value={avatarIds.includes(b.avatarId) ? b.avatarId : ""}
              onChange={(e) => set(b.slotId, { avatarId: e.target.value })}
            >
              {!avatarIds.includes(b.avatarId) && <option value="">{b.avatarId} (tidak dikenal)</option>}
              {avatarIds.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Peran
            <select value={b.role} onChange={(e) => set(b.slotId, { role: e.target.value as NpcBinding["role"] })}>
              {npcRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Lokasi (tukar dengan slot lain)
            <select
              data-testid={`admin-slot-${b.slotId}`}
              value={b.slotId}
              onChange={(e) => onChange(swapSlots(bindings, b.slotId, e.target.value))}
            >
              {npcSlotIds.map((s) => (
                <option key={s} value={s}>{SLOT_LABELS[s] ?? s}</option>
              ))}
            </select>
          </label>
          {b.dialogue.map((d) => (
            <div key={d.id} data-testid={`admin-dialog-${b.slotId}-${d.id}`}>
              <label>
                {d.id} — teks
                <input
                  data-testid={`admin-node-${b.slotId}-${d.id}`}
                  value={d.text}
                  onChange={(e) =>
                    set(b.slotId, { dialogue: b.dialogue.map((x) => (x.id === d.id ? { ...x, text: e.target.value } : x)) })
                  }
                />
              </label>
              <label>
                Pembicara
                <input
                  value={d.speaker ?? ""}
                  onChange={(e) =>
                    set(b.slotId, {
                      dialogue: b.dialogue.map((x) => (x.id === d.id ? { ...x, speaker: e.target.value || undefined } : x)),
                    })
                  }
                  placeholder={b.displayName}
                />
              </label>
              <label>
                Aksi
                <select
                  value={d.action?.type ?? ""}
                  onChange={(e) => {
                    const type = e.target.value || undefined;
                    set(b.slotId, {
                      dialogue: b.dialogue.map((x) =>
                        x.id === d.id
                          ? { ...x, action: type ? { type: type as NpcBinding["actions"][number]["type"] } : undefined }
                          : x
                      ),
                    });
                  }}
                >
                  <option value="">— tidak ada —</option>
                  {npcActionTypes.map((a) => (
                    <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
                  ))}
                </select>
              </label>
              {d.action?.type === "OPEN_WEDDING_BOOK_SECTION" && (
                <label>
                  Bagian
                  <select
                    value={d.action.section ?? "home"}
                    onChange={(e) =>
                      set(b.slotId, {
                        dialogue: b.dialogue.map((x) =>
                          x.id === d.id && x.action
                            ? { ...x, action: { ...x.action, section: e.target.value as (typeof bookSections)[number] } }
                            : x
                        ),
                      })
                    }
                  >
                    {bookSections.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}
              <button
                data-testid={`admin-node-del-${b.slotId}-${d.id}`}
                onClick={() => {
                  const r = deleteDialogueNode(b.dialogue, d.id);
                  if (r.deleted) set(b.slotId, { dialogue: r.nodes });
                }}
                disabled={b.dialogue.length <= 1 || b.dialogue[0].id === d.id}
                title={b.dialogue[0].id === d.id ? "Dialog pembuka wajib ada" : undefined}
              >
                Hapus dialog
              </button>
            </div>
          ))}
          <button
            data-testid={`admin-node-add-${b.slotId}`}
            onClick={() => set(b.slotId, { dialogue: addDialogueNode(b.dialogue, "Tulis dialog di sini.") })}
            disabled={b.dialogue.length >= 24}
          >
            Tambah dialog
          </button>
        </details>
      ))}
    </section>
  );
}

const HEART_LABELS: Record<string, string> = {
  "heart.first_meeting": "Pertemuan",
  "heart.memories": "Kenangan",
  "heart.journey": "Perjalanan",
  "heart.proposal": "Lamaran",
};

export function HeartsSection({
  bindings,
  onChange,
}: {
  bindings: NpcBinding[];
  onChange: (b: NpcBinding[]) => void;
}) {
  const rows = heartAssignments(bindings);
  const assigned = rows.filter((r) => r.slotId !== null);
  const complete = assigned.length === 4 && new Set(assigned.map((r) => r.slotId)).size === 4;
  return (
    <section aria-label="Our Story">
      <h2>Our Story — 4 Hati</h2>
      <p data-testid="admin-hearts-state" className={complete ? "admin-valid" : "admin-invalid"}>
        {complete ? "Lengkap — 4 hati di slot berbeda" : `${assigned.length}/4 hati terpasang di slot berbeda`}
      </p>
      {heartIds.map((h) => {
        const row = rows.find((r) => r.heartId === h);
        return (
          <label key={h}>
            ♥ {HEART_LABELS[h] ?? h}
            <select
              data-testid={`admin-heart-${h}`}
              value={row?.slotId ?? ""}
              onChange={(e) => {
                if (e.target.value) onChange(moveHeart(bindings, h, e.target.value));
              }}
            >
              <option value="">— belum dipasang —</option>
              {npcSlotIds.map((s) => (
                <option key={s} value={s}>{SLOT_LABELS[s] ?? s}</option>
              ))}
            </select>
          </label>
        );
      })}
    </section>
  );
}
