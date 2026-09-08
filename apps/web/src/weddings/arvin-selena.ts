import type { NpcBinding, Publication } from "@wedding-rpg/contracts";

// Third wedding fixture (M7): Arvin & Selena. Same garden-village-v1
// template, same quest chain shape, distinct content. Game code never
// branches on couple identity — this file is the entire difference.
export const ARVIN_SELANA_PUBLICATION: Publication = {
  id: "arvin-selena-v1",
  couple: {
    partnerA: "Arvin Nugraha",
    partnerB: "Selena Maharani",
    dateISO: "2027-11-02",
    welcome: "Terima kasih sudah mampir — jelajahi taman, kumpulkan kenangan, rayakan bersama!",
  },
  events: [
    {
      id: "akad",
      kind: "akad",
      title: "Akad Nikah",
      dateISO: "2027-11-02",
      timeStart: "08:00",
      timeEnd: "10:00",
      venueId: "taman-kebahagiaan",
    },
    {
      id: "resepsi",
      kind: "reception",
      title: "Resepsi Pernikahan",
      dateISO: "2027-11-02",
      timeStart: "11:00",
      timeEnd: "13:00",
      venueId: "taman-kebahagiaan",
    },
  ],
  venues: [
    {
      id: "taman-kebahagiaan",
      name: "Taman Kebahagiaan",
      address: "Jl. Mawar No. 8, Bandung",
      mapsUrl: "https://maps.google.com/?q=Taman+Kebahagiaan+Bandung",
      landmarkId: "landmark.main_plaza",
    },
  ],
  dresscode: {
    text: "Bernuansa biru navy dan krem; mohon hindari putih dan hitam pekat.",
  },
  gallery: [
    { src: "assets/gallery/demo-1.png", alt: "Foto taman dan dekorasi pernikahan" },
    { src: "assets/gallery/demo-2.png", alt: "Foto kedua mempelai di wishing tree" },
    { src: "assets/gallery/demo-3.png", alt: "Foto plaza utama saat golden hour" },
  ],
  gift: {
    bankName: "Bank Demo",
    accountNumber: "4444-5555-6666",
    accountName: "Arvin & Selena",
    note: "Mode demo — jangan transfer.",
  },
  story: [
    {
      title: "Pertemuan Pertama",
      text: "Antre kopi yang sama tiap pagi, sampai akhirnya satu antrean untuk berdua.",
    },
    {
      title: "Perjalanan Bersama",
      text: "Mendaki gunung pertama: kaki gemetar, hati mantap.",
    },
    {
      title: "Lamaran",
      text: "Di puncak saat sunrise, cincin keluar sebelum sarapan.",
    },
  ],
  modules: { rsvp: true, gift: true, gallery: true },
  world: { templateKey: "garden-village-v1", templateVersion: 1 },
};

export const ARVIN_SELANA_BINDINGS: NpcBinding[] = [
  {
    slotId: "npc.greeter",
    npcId: "putri_greeter",
    role: "greeter",
    displayName: "Putri",
    avatarId: "guest_female_hijab_navy_01",
    interactLabel: "Bicara",
    dialogue: [
      { id: "sapa", text: "Halo! Selamat datang di taman Arvin & Selena.", next: "gerak" },
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
    npcId: "yoga_rsvp",
    role: "rsvp",
    displayName: "Yoga",
    avatarId: "guest_male_casual_green_01",
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
    npcId: "wulan_story",
    role: "story",
    displayName: "Kak Wulan",
    avatarId: "guest_female_hijab_navy_cream_01",
    questRewardId: "heart.first_meeting",
    dialogue: [
      { id: "sapa", text: "Cerita antrean kopi itu legendaris.", next: "temu" },
      {
        id: "temu",
        text: "Tiap pagi antre yang sama, sampai sang barista hafal pesanan berdua.",
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
    npcId: "sinta_photo",
    role: "photo",
    displayName: "Sinta",
    avatarId: "guest_female_kebaya_pastel_01",
    questRewardId: "heart.memories",
    dialogue: [
      { id: "sapa", text: "Pose santai saja, candid lebih hidup.", next: "galeri" },
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
    npcId: "danu_travel",
    role: "travel",
    displayName: "Danu",
    avatarId: "guest_male_suit_navy_01",
    questRewardId: "heart.journey",
    dialogue: [
      { id: "sapa", text: "Pendakian itu hampir batal karena hujan.", next: "jalan" },
      {
        id: "jalan",
        text: "Sampai puncak pas sunrise — semua lelah terbayar.",
        next: "hati",
      },
      {
        id: "hati",
        text: "Rasakan angin puncaknya — satu hati kenangan! ♥",
        action: { type: "GRANT_HEART" },
      },
    ],
    actions: [],
  },
  {
    slotId: "npc.event_coordinator",
    npcId: "fira_event",
    role: "event",
    displayName: "Fira",
    avatarId: "guest_female_hijab_sage_01",
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
    npcId: "hadi_venue",
    role: "venue",
    displayName: "Hadi",
    avatarId: "guest_male_batik_burgundy_01",
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
    npcId: "irfan_proposal",
    role: "proposal",
    displayName: "Irfan",
    avatarId: "npc_mc_muslim_male_01",
    questRewardId: "heart.proposal",
    dialogue: [
      { id: "sapa", text: "Aku yang bawa cincin sampai puncak.", next: "lamar" },
      { id: "lamar", text: "Tangan gemetar, sunrise tepat waktu.", next: "hati" },
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
    npcId: "selena_mempelai",
    role: "couple",
    displayName: "Selena",
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
    npcId: "arvin_mempelai",
    role: "couple",
    displayName: "Arvin",
    avatarId: "couple_groom_white_01",
    dialogue: [{ id: "sapa", text: "Nanti rayakan bersama di aula ya!" }],
    actions: [],
  },
];
