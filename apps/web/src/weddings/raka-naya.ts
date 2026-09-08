import type { NpcBinding, Publication } from "@wedding-rpg/contracts";

// Second wedding fixture (M7): Raka & Naya. Same garden-village-v1 template,
// same quest chain shape, distinct content. Game code never branches on
// couple identity — this file is the entire difference.
export const RAKA_NAYA_PUBLICATION: Publication = {
  id: "raka-naya-v1",
  couple: {
    partnerA: "Raka Aditya",
    partnerB: "Naya Putri",
    dateISO: "2027-09-18",
    welcome: "Selamat datang di taman kami — kumpulkan empat hati kenangan, lalu rayakan di aula!",
  },
  events: [
    {
      id: "akad",
      kind: "akad",
      title: "Akad Nikah",
      dateISO: "2027-09-18",
      timeStart: "08:00",
      timeEnd: "10:00",
      venueId: "taman-kebahagiaan",
    },
    {
      id: "resepsi",
      kind: "reception",
      title: "Resepsi Pernikahan",
      dateISO: "2027-09-18",
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
    text: "Bernuansa sage dan krem; mohon hindari putih dan hitam pekat.",
  },
  gallery: [
    { src: "assets/gallery/demo-1.png", alt: "Foto taman dan dekorasi pernikahan" },
    { src: "assets/gallery/demo-2.png", alt: "Foto kedua mempelai di wishing tree" },
    { src: "assets/gallery/demo-3.png", alt: "Foto plaza utama saat golden hour" },
  ],
  gift: {
    bankName: "Bank Demo",
    accountNumber: "1111-2222-3333",
    accountName: "Raka & Naya",
    note: "Mode demo — jangan transfer.",
  },
  story: [
    {
      title: "Pertemuan Pertama",
      text: "Hujan deras, satu payung, dua orang asing yang akhirnya searah.",
    },
    {
      title: "Perjalanan Bersama",
      text: "Naik kereta ke timur: peta salah, tawa benar, kenangan terkunci.",
    },
    {
      title: "Lamaran",
      text: "Di bawah pohon wishes, satu kotak kecil, jawaban tercepat sedunia.",
    },
  ],
  modules: { rsvp: true, gift: true, gallery: true },
  world: { templateKey: "garden-village-v1", templateVersion: 1 },
};

export const RAKA_NAYA_BINDINGS: NpcBinding[] = [
  {
    slotId: "npc.greeter",
    npcId: "tania_greeter",
    role: "greeter",
    displayName: "Tania",
    avatarId: "npc_greeter_female_01",
    interactLabel: "Bicara",
    dialogue: [
      { id: "sapa", text: "Halo! Selamat datang di taman Raka & Naya.", next: "gerak" },
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
    npcId: "galih_rsvp",
    role: "rsvp",
    displayName: "Galih",
    avatarId: "npc_mc_muslim_male_01",
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
    npcId: "nek_sari",
    role: "story",
    displayName: "Nek Sari",
    avatarId: "guest_female_hijab_rose_01",
    questRewardId: "heart.first_meeting",
    dialogue: [
      { id: "sapa", text: "Sini, dengar cerita payung hujan itu.", next: "temu" },
      {
        id: "temu",
        text: "Satu payung untuk dua orang — selebihnya sejarah.",
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
    npcId: "bimo_photo",
    role: "photo",
    displayName: "Bimo",
    avatarId: "npc_photographer_male_01",
    questRewardId: "heart.memories",
    dialogue: [
      { id: "sapa", text: "Lihat kamera! Langitnya pas banget.", next: "galeri" },
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
    npcId: "citra_travel",
    role: "travel",
    displayName: "Citra",
    avatarId: "guest_female_sage_dress_01",
    questRewardId: "heart.journey",
    dialogue: [
      { id: "sapa", text: "Aku yang salah baca peta waktu itu!", next: "jalan" },
      {
        id: "jalan",
        text: "Nyasar dua jam, malah nemu air terjun tersembunyi.",
        next: "hati",
      },
      {
        id: "hati",
        text: "Rasakan cipratannya — satu hati kenangan! ♥",
        action: { type: "GRANT_HEART" },
      },
    ],
    actions: [],
  },
  {
    slotId: "npc.event_coordinator",
    npcId: "rani_event",
    role: "event",
    displayName: "Rani",
    avatarId: "npc_event_coordinator_female_01",
    dialogue: [
      { id: "sapa", text: "Rundown hari-H aman bersamaku!", next: "acara" },
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
    npcId: "bagus_venue",
    role: "venue",
    displayName: "Bagus",
    avatarId: "guest_male_vest_brown_01",
    dialogue: [
      { id: "sapa", text: "Butuh arah? Aku hafal tiap sudut taman.", next: "lokasi" },
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
    npcId: "eko_proposal",
    role: "proposal",
    displayName: "Eko",
    avatarId: "npc_host_male_01",
    questRewardId: "heart.proposal",
    dialogue: [
      { id: "sapa", text: "Kotak cincinnya kutitip di sakuku seminggu.", next: "lamar" },
      { id: "lamar", text: "Deg-degannya menular ke seluruh geng.", next: "hati" },
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
    npcId: "naya_mempelai",
    role: "couple",
    displayName: "Naya",
    avatarId: "couple_bride_white_01",
    dialogue: [
      {
        id: "sapa",
        text: "Makasih sudah datang ke hari kami!",
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
    npcId: "raka_mempelai",
    role: "couple",
    displayName: "Raka",
    avatarId: "couple_groom_white_01",
    dialogue: [{ id: "sapa", text: "Nanti rayakan bersama di aula ya!" }],
    actions: [],
  },
];
