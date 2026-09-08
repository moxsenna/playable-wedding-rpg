import type { NpcBinding } from "@wedding-rpg/contracts";
import { RAKA_NAYA_BINDINGS } from "./raka-naya";
import { ARVIN_SELANA_BINDINGS } from "./arvin-selena";
import { resolveWeddingId } from "./select";

// Demo wedding bindings for garden-village-v1 (M3). Wedding-specific content
// lives here — never in actor code. M4/M7 replace this fixture with the
// publication-driven source; the actor system stays untouched.
export const DEMO_NPC_BINDINGS_DATA: NpcBinding[] = [
  {
    slotId: "npc.greeter",
    npcId: "sari_greeter",
    role: "greeter",
    displayName: "Sari",
    avatarId: "npc_greeter_hijabi_pastel_01",
    interactLabel: "Bicara",
    dialogue: [
      { id: "sapa", text: "Halo! Selamat datang di Taman Kebahagiaan.", next: "gerak" },
      { id: "gerak", text: "Geser joystick kiri untuk jalan. Dekati kami, lalu tekan Aksi.", next: "buku" },
      {
        id: "buku",
        text: "Semua info acara ada di Buku Nikah — bisa dibuka kapan saja.",
        action: { type: "OPEN_WEDDING_BOOK" },
        next: "misi",
      },
      {
        id: "misi",
        text: "Mau ikut misi kami? Kumpulkan 4 hati kenangan: pertemuan, foto, jalan, lamaran. Mulai dari aku!",
        action: { type: "START_MAIN_QUEST" },
      },
    ],
    actions: [{ type: "OPEN_WEDDING_BOOK" }],
  },
  {
    slotId: "npc.rsvp_keeper",
    npcId: "bimo_rsvp",
    role: "rsvp",
    displayName: "Nadia",
    avatarId: "npc_rsvp_keeper_hijabi_01",
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
    avatarId: "guest_female_hijab_sage_01",
    questRewardId: "heart.first_meeting",
    dialogue: [
      { id: "sapa", text: "Duduk sini sebentar, Nak.", next: "temu" },
      {
        id: "temu",
        text: "Awal kisah mereka sederhana: sapa, tawa, lalu rindu.",
        next: "hati",
      },
      {
        id: "hati",
        text: "Kisah itu untukmu — satu hati kenangan! ♥",
        action: { type: "GRANT_HEART" },
      },
    ],
    actions: [],
  },
  {
    slotId: "npc.photographer",
    npcId: "aji_photo",
    role: "photo",
    displayName: "Aji",
    avatarId: "npc_photographer_muslim_male_01",
    questRewardId: "heart.memories",
    dialogue: [
      { id: "sapa", text: "Senyum! Momen bagus tidak datang dua kali.", next: "galeri" },
      {
        id: "galeri",
        text: "Koleksi foto tersimpan di galeri.",
        action: { type: "OPEN_GALLERY" },
        next: "kenang",
      },
      {
        id: "kenang",
        text: "Foto ini kusimpan untukmu — satu hati kenangan! ♥",
        action: { type: "GRANT_HEART" },
      },
    ],
    actions: [{ type: "OPEN_GALLERY" }],
  },
  {
    slotId: "npc.travel_friend",
    npcId: "lala_travel",
    role: "travel",
    displayName: "Lala",
    avatarId: "guest_female_kebaya_pink_01",
    questRewardId: "heart.journey",
    dialogue: [
      { id: "sapa", text: "Aku ikut mereka road trip ke pantai!", next: "jalan" },
      {
        id: "jalan",
        text: "Tiga hari, dua ban bocor, satu kenangan tak terlupakan.",
        next: "hati",
      },
      {
        id: "hati",
        text: "Rasakan debur ombaknya — satu hati kenangan! ♥",
        action: { type: "GRANT_HEART" },
      },
    ],
    actions: [],
  },
  {
    slotId: "npc.event_coordinator",
    npcId: "rudi_event",
    role: "event",
    displayName: "Maya",
    avatarId: "npc_rsvp_keeper_hijabi_01",
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
    avatarId: "npc_rsvp_keeper_hijabi_01",
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
    avatarId: "npc_host_male_01",
    questRewardId: "heart.proposal",
    dialogue: [
      { id: "sapa", text: "Psst, aku yang menyiapkan lamaran itu.", next: "lamar" },
      {
        id: "lamar",
        text: "Satu lutut, satu cincin, seribu deg-degan.",
        next: "hati",
      },
      {
        id: "hati",
        text: "Dan jawabannya YA — satu hati kenangan! ♥",
        action: { type: "GRANT_HEART" },
      },
    ],
    actions: [],
  },
  {
    slotId: "npc.couple_a",
    npcId: "mempelai_a",
    role: "couple",
    displayName: "Ayu",
    avatarId: "couple_bride_hijab_ivory_01",
    dialogue: [
      {
        id: "sapa",
        text: "Terima kasih sudah datang dan bermain bersama kami!",
        next: "rayakan",
      },
      {
        id: "rayakan",
        text: "Kalau empat hati sudah terkumpul, ayo rayakan di aula bersamaku!",
        action: { type: "START_FINALE" },
      },
    ],
    actions: [],
  },
  {
    slotId: "npc.couple_b",
    npcId: "mempelai_b",
    role: "couple",
    displayName: "Bima",
    avatarId: "couple_groom_white_01",
    dialogue: [{ id: "sapa", text: "Nanti rayakan bersama di aula ya!" }],
    actions: [],
  },
];

// Active bindings: ?wedding= selects the fixture, default stays the demo
// couple. Import sites (game entry, verifiers) keep working unchanged.
const BINDINGS: Record<string, NpcBinding[]> = {
  "demo-ayu-bima": DEMO_NPC_BINDINGS_DATA,
  "raka-naya": RAKA_NAYA_BINDINGS,
  "arvin-selena": ARVIN_SELANA_BINDINGS,
};

export const DEMO_NPC_BINDINGS: NpcBinding[] =
  BINDINGS[resolveWeddingId()] ?? DEMO_NPC_BINDINGS_DATA;
