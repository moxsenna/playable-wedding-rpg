import type { NpcBinding } from "@wedding-rpg/contracts";

// Demo wedding bindings for garden-village-v1 (M3). Wedding-specific content
// lives here — never in actor code. M4/M7 replace this fixture with the
// publication-driven source; the actor system stays untouched.
export const DEMO_NPC_BINDINGS: NpcBinding[] = [
  {
    slotId: "npc.greeter",
    npcId: "sari_greeter",
    role: "greeter",
    displayName: "Sari",
    avatarId: "greeter",
    interactLabel: "Bicara",
    dialogue: [
      { id: "sapa", text: "Halo! Selamat datang di Taman Kebahagiaan.", next: "gerak" },
      { id: "gerak", text: "Geser joystick kiri untuk jalan. Dekati kami, lalu tekan Aksi.", next: "buku" },
      {
        id: "buku",
        text: "Semua info acara ada di Buku Nikah — bisa dibuka kapan saja.",
        action: { type: "OPEN_WEDDING_BOOK" },
      },
    ],
    actions: [{ type: "OPEN_WEDDING_BOOK" }],
  },
  {
    slotId: "npc.rsvp_keeper",
    npcId: "bimo_rsvp",
    role: "rsvp",
    displayName: "Bimo",
    avatarId: "rsvp",
    dialogue: [
      { id: "sapa", text: "Hai! Sudah isi RSVP belum?", next: "tanya" },
      {
        id: "tanya",
        text: "Buka formulirnya di sini, cuma sebentar.",
        action: { type: "OPEN_RSVP" },
      },
    ],
    actions: [{ type: "OPEN_RSVP" }],
  },
  {
    slotId: "npc.story_keeper",
    npcId: "nek_rina",
    role: "story",
    displayName: "Nek Rina",
    avatarId: "story",
    questRewardId: "heart.first_meeting",
    dialogue: [
      { id: "sapa", text: "Duduk sini sebentar, Nak." },
      { id: "temu", text: "Awal kisah mereka sederhana: sapa, tawa, lalu rindu." },
    ],
    actions: [],
  },
  {
    slotId: "npc.photographer",
    npcId: "aji_photo",
    role: "photo",
    displayName: "Aji",
    avatarId: "photo",
    dialogue: [
      { id: "sapa", text: "Senyum! Momen bagus tidak datang dua kali.", next: "galeri" },
      {
        id: "galeri",
        text: "Koleksi foto tersimpan di galeri.",
        action: { type: "OPEN_GALLERY" },
      },
    ],
    actions: [{ type: "OPEN_GALLERY" }],
  },
  {
    slotId: "npc.travel_friend",
    npcId: "lala_travel",
    role: "travel",
    displayName: "Lala",
    avatarId: "travel",
    questRewardId: "heart.journey",
    dialogue: [
      { id: "sapa", text: "Aku ikut mereka road trip ke pantai!", next: "jalan" },
      { id: "jalan", text: "Tiga hari, dua ban bocor, satu kenangan tak terlupakan." },
    ],
    actions: [],
  },
  {
    slotId: "npc.event_coordinator",
    npcId: "rudi_event",
    role: "event",
    displayName: "Rudi",
    avatarId: "event",
    dialogue: [
      { id: "sapa", text: "Jadwal hari-H sudah final!", next: "acara" },
      {
        id: "acara",
        text: "Akad pagi, resepsi sore. Detailnya ada di Buku Nikah.",
        action: { type: "OPEN_WEDDING_BOOK_SECTION", section: "events" },
      },
    ],
    actions: [{ type: "OPEN_WEDDING_BOOK_SECTION", section: "events" }],
  },
  {
    slotId: "npc.venue_guide",
    npcId: "wulan_venue",
    role: "venue",
    displayName: "Wulan",
    avatarId: "venue",
    dialogue: [
      { id: "sapa", text: "Taman ini luas, tapi jangan khawatir tersesat.", next: "lokasi" },
      {
        id: "lokasi",
        text: "Denah dan rute ada di Buku Nikah.",
        action: { type: "OPEN_WEDDING_BOOK_SECTION", section: "venue" },
      },
    ],
    actions: [{ type: "OPEN_WEDDING_BOOK_SECTION", section: "venue" }],
  },
  {
    slotId: "npc.proposal_friend",
    npcId: "dimas_proposal",
    role: "proposal",
    displayName: "Dimas",
    avatarId: "proposal",
    questRewardId: "heart.proposal",
    dialogue: [
      { id: "sapa", text: "Psst, aku yang menyiapkan lamaran itu.", next: "lamar" },
      { id: "lamar", text: "Satu lutut, satu cincin, seribu deg-degan." },
    ],
    actions: [],
  },
  {
    slotId: "npc.couple_a",
    npcId: "mempelai_a",
    role: "couple",
    displayName: "Mempelai A",
    avatarId: "partner_a",
    dialogue: [{ id: "sapa", text: "Terima kasih sudah datang dan bermain bersama kami!" }],
    actions: [],
  },
  {
    slotId: "npc.couple_b",
    npcId: "mempelai_b",
    role: "couple",
    displayName: "Mempelai B",
    avatarId: "partner_b",
    dialogue: [{ id: "sapa", text: "Nanti rayakan bersama di aula ya!" }],
    actions: [],
  },
];
