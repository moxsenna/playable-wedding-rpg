---
name: YUTEMU
description: Undangan pernikahan yang bisa dimasuki dan dimainkan.
colors:
  # Two worlds, on purpose. See "Dua Dunia" below.
  # Ruang kerja (Studio + halaman pemasaran)
  paper: "#fff6ea"
  card: "#ffffff"
  ink: "#171719"
  muted-ink: "#5c5a55"
  lentera-gold: "#ffd98a"
  gold-deep: "#f2c46a"
  coral: "#e4636f"
  leaf: "#3e9b73"
  # Dunia tamu (game, Wedding Book, onboarding)
  guest-paper: "#fff6ea"
  guest-card: "#ffffff"
  guest-ink: "#171719"
  guest-muted: "#5c5a55"
  night-fill: "#151d2e"
  night-deep: "#0d1320"
  night: "#191331"
  night-deep-brand: "#221a3d"
  guest-ground: "#1a2233"
  screen: "#101014"
  ink-light: "#f2f4f8"
  muted-lavender: "#b9b3d4"
  violet: "#8b76c9"
typography:
  display:
    fontFamily: '"Archivo Black", Arial, Helvetica, sans-serif'
    source: "self-hosted /fonts/archivo-black-latin.woff2 (SIL OFL 1.1)"
    use: "halaman pemasaran saja — h1/h2/h3 dan angka harga"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    use: "semua kontrol, label, tabel, dan prosa di kedua permukaan"
  data:
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
    use: "hanya pengenal, versi, jumlah, dan metrik — bukan prosa, bukan judul"
  guest-display:
    fontFamily: "Georgia, serif"
    use: "momen emosional dunia tamu saja — nama brand, judul onboarding, kop undangan"
rounded:
  all: "0px"
  guest-joystick-base: "999px"
spacing:
  sm: "8px"
  md: "16px"
components:
  button-primary:
    backgroundColor: "{colors.lentera-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.all}"
    border: "3px solid {colors.ink}"
    shadow: "3px 3px 0 {colors.ink}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    border: "3px solid {colors.ink}"
  button-guest:
    backgroundColor: "{colors.lentera-gold}"
    textColor: "{colors.guest-ink}"
    rounded: "{rounded.all}"
    border: "3px solid {colors.guest-ink}"
    shadow: "3px 3px 0 {colors.guest-ink}"
    height: "52px"
  button-guest-night:
    backgroundColor: "{colors.lentera-gold}"
    textColor: "{colors.night-deep}"
    rounded: "{rounded.all}"
    border: "3px solid {colors.night-deep}"
    shadow: "3px 3px 0 rgba(5,4,10,.9)"
---

# Design System: YUTEMU

## Dua Dunia

YUTEMU punya **dua dunia visual**, dan itu keputusan sadar, bukan drift.

| | **Ruang Kerja** | **Dunia Tamu** |
|---|---|---|
| **Permukaan** | YUTEMU Studio (`/admin`), halaman pemasaran (`/`) | game (`/demo`, `/g/:token`), Wedding Book, onboarding, quest HUD |
| **Siapa** | operator yang bekerja sejam, calon pembeli yang menimbang | tamu di HP-nya, di sela acara |
| **Mode** | Operate + Persuade | Experience |
| **Tanah** | kertas `#fff6ea` | malam `#191331` |
| **Sudut** | 0px | 999px pil, 16px kartu |
| **Bayangan** | blok keras `6px 6px 0` | ambient `0 12px 40px` |
| **Suara huruf** | Archivo Black (judul) + Arial (kerja) + mono (data) | Georgia (momen) + Arial (kerja) |

Alasannya ada di pedoman brand §19: brand hidup di loading, sistem UI, onboarding, dan Studio — bukan di dalam dunia pasangan. **Studio adalah meja kerja operator, bukan undangan.** Operator butuh keterbacaan sebelum butuh suasana; tamu butuh suasana. Karena itu keduanya boleh berbeda, dan tidak boleh saling menular.

Satu-satunya tempat keduanya bertemu: **hero halaman pemasaran** — satu lempeng gelap `#101014` di tengah halaman kertas, memegang render asli dunia. Itu satu-satunya tempat sudut malam muncul di ruang kerja, dan ia dibingkai oleh aturan tinta yang sama.

---

# Dunia 1 — Ruang Kerja

**Neo-brutalism terang.** Kertas, tinta tebal, blok yang benar-benar tertekan saat ditekan.

## Overview

**North Star: "Meja Kerja"**

Studio terlihat seperti buku besar yang diatur tangan: setiap hal punya kolomnya, setiap tindakan meninggalkan jejak, dan tidak ada yang mengambang. Tidak ada kaca, tidak ada gradien hiasan, tidak ada sudut membulat — hanya aturan tinta, blok, dan satu emas untuk hal yang harus ditekan.

Halaman pemasaran memakai tangan yang sama, supaya wedding organizer bertemu orang yang sama di kedua permukaan.

### Key Characteristics
- **Satu emas.** `#ffd98a` hanya untuk tindakan utama, pilihan aktif, dan status draft.
- **Sudut nol, di mana-mana.** Tidak ada `border-radius` selain `0`.
- **Bayangan adalah offset, bukan kabut.** `6px 6px 0` / `3px 3px 0`, tanpa blur.
- **Setiap status adalah tanda cetak.** Diam = aturan; hover = naik; ditekan = tenggelam; nonaktif = bergaris; terhalang = garis hazard.
- **Mono hanya untuk data.** Pengenal, versi, jumlah, metrik. Tidak pernah prosa, tidak pernah judul.

## Warna

### Primary
- **Lentera Emas** (#ffd98a): satu-satunya warna tindakan. Tombol utama, pilihan aktif, status draft, cap validasi, pita penutup.
- **Emas Dalam** (#f2c46a): keadaan hover dari tombol utama.

### Secondary
- **Koral** (#e4636f): status arsip, peringatan, aksi destruktif, dan cap "ada masalah". **Selalu dengan tinta di atasnya, tidak pernah putih** — putih di atas koral hanya 3.33:1.
- **Daun** (#3e9b73): status live dan RSVP hadir. Tinta di atasnya, bukan putih (putih hanya 3.42:1).

### Neutral
- **Kertas** (#fff6ea): kanvas kedua permukaan ruang kerja.
- **Kartu** (#ffffff): permukaan terangkat.
- **Tinta** (#171719): teks utama, semua aturan, semua bayangan.
- **Lavender Tinta** (#5c5a55): teks sekunder dan hint, diredupkan dari rona tinta — bukan abu-abu netral.

### Named Rules
**The One Lantern Rule.** Emas muncul hanya untuk tindakan, pilihan aktif, dan status. Tidak untuk border dekoratif atau teks pajangan.
**The Ink On Every Fill Rule.** Setiap bidang berwarna membawa tinta gelap di atasnya. Putih tidak pernah dipakai sebagai teks di permukaan ini.

## Typography

Tiga suara, masing-masing dengan satu tugas:

- **Archivo Black** (self-hosted, SIL OFL 1.1) — **judul halaman pemasaran saja**: h1/h2/h3 dan angka harga. Beratnya 400; ia sudah hitam secara desain, jadi jangan ditebalkan lagi.
- **Arial** — semua pekerjaan: kontrol, label, paragraf, tabel, pesan. Studio sepenuhnya Arial.
- **Mono** — hanya pengenal, versi, jumlah, metrik. Bukan prosa, bukan judul.

### Hierarchy
- **Display** (Archivo Black, clamp 1.5–4.2rem, uppercase, tracking −0.02em): judul pemasaran.
- **Headline** (Arial 900, 15–21px, uppercase): judul section Studio.
- **Body** (Arial 400, 15–18px).
- **Label** (Arial 700 11–12px uppercase, atau mono 11–12px): label field dan metadata.
- **Data** (mono 11–26px, tabular-nums): angka dan pengenal.

### Named Rules
**The Two Voices Rule.** Judul menjual; Arial bekerja. Jangan tertukar.
**The Mono Is Data Rule.** Kalau bukan pengenal, versi, jumlah, atau metrik, ia bukan mono.

## Layout

Halaman pemasaran: kolom tunggal maks 1180px. Studio: kolom tunggal sampai 1000px, lalu rail 296px (ringkasan, cap validasi, delapan tujuan bernomor, aktivitas) dengan area kerja di sebelahnya. Rail dan log punya scroll sendiri.

Ritme: rapat di dalam grup (6–10px), lega antar grup (20–28px), lebih banyak ruang di atas judul daripada di bawahnya.

## Elevation & Depth

Dua bayangan, keduanya offset keras tanpa blur:
- **Angkat Blok** (`6px 6px 0 #171719`): bingkai bukti, kartu rail, panel partner.
- **Angkat Kecil** (`3px 3px 0 #171719`): tombol, baris menu.

**The Press Rule.** Setiap kontrol yang bisa ditekan tenggelam tepat sebesar offsetnya saat `:active` — `transform: translate(3px, 3px)` dengan `box-shadow: none`. Bukan sekadar berubah warna.

**The Inverted Lift Rule.** Di atas lempeng gelap hero, offset menjadi krem (`6px 6px 0 #fff6ea`). Bayangan hitam di atas bidang hampir hitam terukur 1.53:1 dan tidak terbaca sebagai bayangan sama sekali.

## Shapes

Sudut **0px** di seluruh ruang kerja. Pil `999px` tidak dipakai di sini — itu bahasa dunia tamu. Field dan kartu berbagi sudut yang sama; yang membedakan hanya bobot aturan.

Border: 3px tinta untuk wadah, 2px untuk elemen dalam dan kartu berulang.

## Components

### Buttons
- **Shape:** persegi, min-height 46px, padding 11px 16px, border 3px tinta, `3px 3px 0` tinta.
- **Primary:** emas di atas tinta. **Secondary:** kartu putih. Keduanya aturan yang sama.
- **State:** hover menaikkan ke emas; `:active` tenggelam 3px dan kehilangan bayangan; **disabled bergaris diagonal** (bukan pudar) dengan bayangan dihapus, karena tindakan yang terkunci harus terlihat terkunci.

### Chips
Pil status **persegi**, mono 11px uppercase, border 2px tinta. Varian: live (daun), draft (emas), archived (koral) — semuanya dengan tinta di atasnya. Chip adalah label, bukan toggle.

### Cards / Containers
Sudut 0px, border 3px tinta, bayangan `6px 6px 0` untuk yang terangkat. Tidak ada kaca, tidak ada gradien. Kartu diam di dalam kartu hanya untuk sub-section bernama, dan selalu turun bobot (2px, tanpa bayangan).

### Inputs / Fields
Kartu putih, border 3px tinta, radius 0, min-height 48px, teks 15px **Arial 700** (nilai terisi harus terbaca sebagai nilai). Fokus: latar emas + outline tinta 3px. Select memakai chevron yang digambar dari border, bukan glyph.

### Disclosure
`<details>` adalah rumah setiap editor berulang: kartu, bukan panel. Ringkasannya 48px, uppercase, dengan **penanda digambar** dari dua border (bukan karakter ▸/▾). Terbuka = latar emas + aturan bawah tinta.

### Navigation
Rail Studio: daftar bernomor vertikal, satu baris per tujuan, dengan jumlah hidup di kanan. Urutannya **urutan kerja operator**, bukan urutan abjad, dan setiap tujuan ada di dokumen dalam urutan yang sama. Tujuan aktif ditandai latar tinta penuh.

### Pipeline
Tiga langkah (Simpan Draft → Publish → Aktifkan) sebagai strip bergaris: selesai = tinta penuh, sekarang = emas, menunggu = kertas. Operan selalu tahu langkah berikutnya.

### Reception / Stamp
Catatan tindakan terakhir duduk di rail, terlihat dari mana saja, dengan label jenisnya sendiri (berhasil / gagal / catatan). Sebelumnya ia hanya hidup di dalam section Wedding.

## Do's and Don'ts

### Do:
- **Do** pakai emas hanya untuk tindakan, pilihan aktif, dan status.
- **Do** jaga tinggi sentuh min 44px; di ruang kerja 46–48px.
- **Do** beri setiap status tanda cetak — bukan hanya perubahan warna.
- **Do** taruh tinta di atas setiap bidang berwarna.
- **Do** reset `margin` setiap `<figure>` sebelum memakainya sebagai sel grid.
- **Do** ukur kontras dari piksel terkomposit saat teks duduk di atas gambar.

### Don't:
- **Don't** memakai `border-radius` apa pun di ruang kerja.
- **Don't** memakai putih sebagai teks di atas koral atau daun; gagal kontras.
- **Don't** memakai mono untuk prosa atau judul.
- **Don't** memakai glyph Unicode sebagai ikon; gambar dari border atau SVG.
- **Don't** memakai `z-index` negatif untuk lapisan yang harus terlihat di atas gambar.
- **Don't** membuat bayangan tanpa offset, atau dengan blur.

---

# Dunia 2 — Dunia Tamu

**Satu aturan memegang seluruh permukaan: kertas adalah dokumen undangannya, malam adalah suara dunianya.**

Undangan (Wedding Book) dan sampul onboarding **adalah** undangannya, jadi keduanya kartu kertas cetak. Semua yang mengambang di atas taman — dialog, quest HUD, menu emote, finale, layar muat — tetap bertanah malam, karena panel kertas yang melayang di atas taman pixel senja akan melubangi dunia pasangan. Chrome malam tetap memakai disiplin baru sepenuhnya: isian rata tanpa gradien hiasan, bayangan offset keras, sudut nol, satu aksen, mono untuk data.

## Overview

**North Star: "Arsip Kenangan"**

Undangan terlihat seperti album kenangan yang dibuka bersama orang tersayang: premium tapi dekat. Tamu memegang sesuatu yang terbaca sebagai undangan cetak; di antara momen-momen itu ia berada di dalam dunia pixel senja yang UI-nya milik dunia itu.

### Key Characteristics
- **Kertas untuk dokumen, malam untuk dunia.** Tidak pernah tertukar.
- Satu aksen emas untuk semua tindakan dan status penting.
- Tertib arsip: hierarki jelas, tidak ada dekorasi tanpa tugas.

## Colors

### Kertas (Undangan, onboarding)
- **Kertas** (`#fff6ea`): tanah lembar undangan.
- **Kartu** (`#ffffff`): baris catatan, kartu acara, field input.
- **Tinta** (`#171719`): teks, semua aturan, semua bayangan.
- **Lavender Tinta** (`#5c5a55`): teks sekunder, label, tab tidak aktif.

### Malam (chrome di atas dunia)
- **Isian Malam** (`#151d2e`): panel dialog, HUD, toast, finale, tombol kanvas.
- **Malam Pekat** (`#0d1320`): label di atas emas, layar muat, garis dalam.
- **Tinta Terang** (`#f2f4f8`) dan **Lavender Redup** (`#b9b3d4`): teks utama dan sekunder.
- **Aturan Emas**: `3px solid #ffd98a` adalah bingkai panel malam. Satu slot emas, tidak lebih.

### Aksen bersama
- **Lentera Emas** (`#ffd98a`): satu-satunya warna tindakan di kedua tanah. **Emas selalu menjadi isian, tidak pernah menjadi teks di atas kertas** — emas di atas krem hanya ~1.4:1 dan gagal. Di atas malam, emas boleh menjadi teks karena terukur 12.46:1.
- **Emas Dalam** (`#f2c46a`): keadaan ditekan dari tombol emas.
- **Koral** (`#e4636f`) dan **Daun** (`#3e9b73`): status, selalu dengan tinta di atasnya.

### Named Rules
**The One Lantern Rule.** Emas muncul hanya untuk tindakan, pilihan aktif, dan status.
**The Ink On Every Fill Rule.** Setiap bidang berwarna di atas kertas membawa tinta gelap; putih tidak pernah dipakai sebagai teks di sana.

## Typography

Tiga suara, masing-masing satu tugas — sama seperti ruang kerja, dengan Georgia mengambil peran yang di ruang kerja dipegang Archivo Black:

- **Georgia** — **hanya momen pasangan**: nama kedua mempelai di kop undangan, judul "Selamat Datang!", nama pasangan di finale. Bukan judul seksi, bukan label, bukan tombol.
- **Arial** — semua pekerjaan YUTEMU: judul seksi, label, tombol, prosa, isi formulir.
- **Mono** (`ui-monospace`) — pengenal dan hitungan: stempel merek, penghitung hati di quest HUD, status layar muat, label "sampul" di galeri. **Indeks seksi undangan bukan mono**: nama seksi adalah kata, bukan data, jadi ia Arial — aturan Mono-Is-Data yang memutuskan, bukan daftar ini.

### Named Rules
**The Two Voices Rule.** Georgia bicara untuk pasangan; Arial bekerja untuk YUTEMU. Judul seksi adalah suara YUTEMU, jadi ia Arial.
**The Mono Is Data Rule.** Kalau bukan pengenal, versi, jumlah, atau metrik, ia bukan mono.

## Shapes

**Kedua tanah: sudut 0px.** Tidak ada `border-radius` di permukaan tamu selain `0`. Ini perubahan sadar dari pil 999px sebelumnya: undangan yang dicetak tidak punya sudut membulat, dan chrome malam kini memakai bahasa yang sama supaya satu layar tidak memegang dua sistem bentuk.

Satu pengecualian, dan ia fungsional: **dasar joystick tetap lingkaran**. Ia kontrol radial, dan bentuk bulat itulah yang memberi tahu ibu jari bahwa ia bisa mendorong ke segala arah. Membuatnya kotak akan membuat kontrolnya lebih buruk untuk dipelajari.

## Elevation & Depth

Bayangan adalah offset keras tanpa blur, di kedua tanah:
- **Angkat Blok** (`6px 6px 0 #171719`) di atas kertas; `6px 6px 0 rgba(5,4,10,.9)` di atas malam.
- **Angkat Kecil** (`3px 3px 0`) untuk tombol dan kontrol.

**The Press Rule.** Setiap kontrol yang bisa ditekan tenggelam tepat sebesar offsetnya saat `:active`. Di kanvas Phaser, tombol interaksi membalik isian ke emas alih-alih bergeser, karena koordinatnya dipakai untuk hit-testing.

## Components

### Undangan (lembar)
Kartu penuh layar: kertas, aturan tinta 3px, sudut 0. Kop dengan nama pasangan (Georgia) di atas tanggal bergaris. Delapan seksi sebagai **indeks cetak 4 kolom yang membungkus ke dua baris** — bukan baris yang menggulir. Baris yang menggulir menyembunyikan tiga dari delapan seksi di balik tepi, jadi tamu tidak bisa tahu seksi itu ada; indeks yang menyembunyikan entri bukan indeks. Di bawah 360px, tipe tab turun ke 10px alih-alih turun ke dua kolom, yang akan memakan satu baris tinggi badan.

### Catatan (acara, venue, cerita, ucapan)
Baris buku besar: kartu putih, aturan tinta 2px, angkat `3px 3px 0`. Bukan kaca, bukan gradien, bukan sudut membulat.

### Input dan tombol
Field putih dengan aturan tinta 3px, radius 0, min-height 50px, teks Arial 700; fokus menjadi emas. Tombol emas dengan aturan tinta 3px dan angkat kecil. **Disabled bergaris diagonal**, bukan pudar.

### Chrome malam
Panel dialog (bingkai emas 3px, nama NPC mono dengan tanda digambar), quest HUD (mono, bingkai emas 2px, `pointer-events: none`), toast, finale (nama pasangan Georgia), menu emote, dan layar muat dengan gauge bergaris dan langkah diskrit alih-alih animasi yang di-tween.

### Kontrol kanvas
Tombol Aksi dan Emote di kanvas Phaser: blok malam solid dengan aturan emas 3px dan label emas. Isiannya sengaja hampir opak — pada 0.72 di atas rumput terang ia terkomposit menjadi hijau gelap dengan aturan emasnya hanya 1.33:1, sehingga keterbacaan kontrol berpindah mengikuti medan di belakangnya.

## Do's and Don'ts

### Do:
- **Do** jaga kontras tinggi untuk tamu yang membuka di sela acara.
- **Do** beri setiap empty state yang mengajari, bukan "tidak ada apa-apa".
- **Do** pakai emas sebagai isian di atas kertas, dan sebagai teks hanya di atas malam.
- **Do** jaga informasi kanonis tetap satu ketukan jauhnya, tanpa gameplay.
- **Do** taruh tinta di atas setiap bidang berwarna di kertas.

### Don't:
- **Don't** memakai estetika kasino/mobile-game generik — tidak ada neon ramai.
- **Don't** mendinginkan dunia tamu menjadi SaaS korporat; malamnya hangat.
- **Don't** menaruh teks di atas tile logo krem kecuali dengan tinta gelap.
- **Don't** menduplikasi `data-testid` antar dua tombol — satu aksi, satu identitas uji.
- **Don't** memakai `border-radius` di permukaan tamu selain `0`, kecuali dasar joystick.
- **Don't** menaruh panel kertas di atas taman malam; dokumen memakai kertas, dunia memakai malam.

---

## Permukaan Pemasaran (`/`) — Tempat Kedua Dunia Bertemu

Halaman depan publik adalah **permukaan brand** (§19 pedoman brand), bukan lingkungan di dalam dunia satu pasangan. Ia memakai tangan kertas yang sama seperti Studio, dan menyimpan **satu lempeng gelap** yang memegang render asli dunia. Itu satu-satunya tempat sudut malam muncul di ruang kerja.

### Lempeng gelap (hero)
- Lempeng `#101014`, penuh viewport, memegang render asli dunia pada skala blok aslinya.
- **Grade** di atas gambar — radial untuk tepi bingkai plus pita linear yang opak di kaki halaman, sekitar 0.68 alpha di pita salinan. Grade **wajib di atas** gambar (z-index positif); sebagai anak ber-z negatif ia tidak akan pernah terlukis.
- **Satu lampu** `#ffd98a` (puncak ~0.42, kolam lebar) melayang perlahan 30 detik bolak-balik. Ini satu-satunya hal yang bergerak di belakang chrome.
- **Chrome tidak pernah beranimasi**, supaya dunia di belakangnya bisa. Satu gerak masuk saja: 560ms `cubic-bezier(0.16, 1, 0.3, 1)` dengan stagger 80–340ms untuk isi hero, lalu halaman diam. Satu denyut diam: `MULAI`. Semuanya di dalam `@media (prefers-reduced-motion: no-preference)`.
- Bingkainya tetap **aturan tinta 3px** yang sama seperti seluruh halaman kertas.
- **Bayangan offset dibalik menjadi krem** (`6px 6px 0 #fff6ea`) di lempeng ini — hitam di atas bidang hampir hitam terukur 1.53:1 dan tidak terbaca sebagai bayangan sama sekali.

### Perangkat komposisi
- **Baris menu (leader row).** Baris label–titik-titik–nilai yang menutup layar judul. Kertas `#fff6ea` dengan aturan tinta 2px, radius 0, min-height 46px; label tinta 900 uppercase, nilai mono 700. Karena duduk di atas lempeng gelap, bayangannya juga dibalik menjadi krem (`3px 3px 0 #fff6ea`).
- **Tangga harga.** Tiga tingkat disusun sebagai baris bergaris (`border-bottom: 2px solid #171719`), bukan tiga kartu seukuran. Nama tingkat dan angka memakai **Archivo Black** (angka 26px `tabular-nums`); aksi emas rata kanan di kolom yang sama.
- **Bingkai bukti.** Tangkapan layar produk dibungkus `.frame`: kartu putih, aturan tinta 3px, radius 0, angkat keras `6px 6px 0 #171719`. Semua `<figure>` di halaman ini **wajib** `margin: 0`; margin bawaan UA `1em 40px` memakan 40px tiap sisi dan diam-diam mengecilkan setiap tangkapan.

### Aturan encoding gambar dunia
Semua 13 raster dunia di `apps/web/public/landing/` adalah **WebP lossless, tanpa resample**. Keduanya mengikat: resample mengubah blok pixel-art 2px menjadi tone kontinu, dan pass lossy menambah derau di setiap bidang rata — meng-encode ulang satu tangkapan yang sudah baik di q88 menjatuhkan kerataan blok terukurnya dari 33,1% ke 8,3%, dan q98 pun meruntuhkannya ke 6,0%. Lossless berbiaya sekitar 1,7x lossy dan tetap lebih kecil daripada PNG sumbernya.

Tangkapan kamera untuk hero harus memakai lebar yang habis dibagi 4: kamera menggulir ke `player - (lebar/2)/zoom`, jadi lebar lain mendarat di setengah piksel dan setiap blok 2px tergambar keluar fase, yang justru diperbesar oleh `image-rendering: pixelated`.

### Do:
- **Do** taruh grade di atas render dunia, lalu ukur kontras dari piksel terkomposit — matematika pasangan palet tidak bisa melihat latar bergambar.
- **Do** pakai WebP lossless untuk semua raster pixel-art dunia.
- **Do** reset `margin` setiap `<figure>` sebelum memakainya sebagai sel grid.
- **Do** biarkan chrome diam dan berikan gerak hanya pada dunia.

### Don't:
- **Don't** memakai encoding lossy atau resample pada raster dunia.
- **Don't** menaruh salinan hero di atas bidang terang tanpa grade; teks terang di atas taman siang jatuh ke sekitar 2:1.
- **Don't** memakai `z-index` negatif untuk lapisan yang harus terlihat di atas gambar.
