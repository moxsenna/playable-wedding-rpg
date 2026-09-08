import type { Publication } from "@wedding-rpg/contracts";
import { RAKA_NAYA_PUBLICATION } from "./raka-naya";
import { ARVIN_SELANA_PUBLICATION } from "./arvin-selena";
import { resolveWeddingId } from "./select";

// Demo wedding publication for garden-village-v1 (M4). Canonical wedding data
// lives here — never inside Wedding Book JSX. M8 replaces this fixture with
// the durable publication system; UI stays untouched.
// NOTE: demo identity only. M7 introduces Raka & Naya / Arvin & Selena as
// separate reusability fixtures; do not rename this couple to those.
export const DEMO_PUBLICATION_DATA: Publication = {
  id: "demo-ayu-bima-v1",
  couple: {
    partnerA: "Ayu Lestari",
    partnerB: "Bima Pratama",
    dateISO: "2027-06-12",
    welcome: "Terima kasih sudah datang — jelajahi taman, kumpulkan kenangan, dan rayakan bersama kami!",
  },
  events: [
    {
      id: "akad",
      kind: "akad",
      title: "Akad Nikah",
      dateISO: "2027-06-12",
      timeStart: "08:00",
      timeEnd: "10:00",
      venueId: "taman-kebahagiaan",
    },
    {
      id: "resepsi",
      kind: "reception",
      title: "Resepsi Pernikahan",
      dateISO: "2027-06-12",
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
    text: "Bernuansa pastel; mohon hindari putih dan hitam pekat.",
  },
  gallery: [
    { src: "assets/gallery/demo-1.png", alt: "Foto taman dan dekorasi pernikahan" },
    { src: "assets/gallery/demo-2.png", alt: "Foto kedua mempelai di wishing tree" },
    { src: "assets/gallery/demo-3.png", alt: "Foto plaza utama saat golden hour" },
  ],
  gift: {
    bankName: "Bank Demo",
    accountNumber: "0000-0000-0000",
    accountName: "Ayu & Bima",
    note: "Mode demo — jangan transfer. Tanda terima dinonaktifkan sampai M8.",
  },
  story: [
    {
      title: "Pertemuan Pertama",
      text: "Berawal dari sapaan sederhana di sebuah kedai kopi, obrolan mengalir sampai lupa waktu.",
    },
    {
      title: "Perjalanan Bersama",
      text: "Road trip ke pantai: tiga hari, dua ban bocor, dan satu kenangan yang tak terlupakan.",
    },
    {
      title: "Lamaran",
      text: "Satu lutut, satu cincin, seribu deg-degan — dan jawaban ya.",
    },
  ],
  modules: { rsvp: true, gift: true, gallery: true },
  world: { templateKey: "garden-village-v1", templateVersion: 1 },
};

// Active publication: ?wedding= selects the fixture, default stays the demo
// couple. Import sites (Wedding Book, finale reveal) keep working unchanged.
const PUBLICATIONS: Record<string, Publication> = {
  "demo-ayu-bima": DEMO_PUBLICATION_DATA,
  "raka-naya": RAKA_NAYA_PUBLICATION,
  "arvin-selena": ARVIN_SELANA_PUBLICATION,
};

export const DEMO_PUBLICATION: Publication =
  PUBLICATIONS[resolveWeddingId()] ?? DEMO_PUBLICATION_DATA;
