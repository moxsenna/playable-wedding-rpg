# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

YUTEMU Studio dioperasikan siapa pun yang memproduksi wedding: tim internal, wedding organizer partner, maupun mempelai langsung. Tingkat kenyamanan teknis mereka berbeda-beda — Studio tidak boleh berasumsi operator adalah developer. Tamu undangan membuka dari HP dan hanya ingin mengalami undangan, bukan mempelajari antarmuka.

## Product Purpose

YUTEMU adalah undangan pernikahan yang bisa dimasuki, dijelajahi, dan dimainkan sebagai small social game world — sekaligus mesin produksi (Studio) yang memungkinkan satu template dijual ke wedding berikutnya berkali-kali tanpa coding, SQL, atau CLI. Sukses berarti operator non-teknis bisa menerbitkan undangan playable dari awal sampai link terkirim.

## Positioning

Undangan yang bisa dimainkan, bukan website wedding yang ditempeli mini-game. Wedding Book (undangan formal) selalu ada sebagai fallback dan akses informasi resmi — bukan hadiah di balik gameplay.

## Operating Context

Alur operator: Buat Wedding → isi Konten/NPC/World → Tamu → Simpan Draft → Preview draft → Validasi → Publish → Aktifkan → link `/g/:token` → bagikan. Lingkungan: browser desktop untuk operator, browser HP untuk tamu; backend Cloudflare Workers + Neon + R2; Admin Key tunggal sebagai otorisasi operator.

## Capabilities and Constraints

- Mampu: multi-wedding isolation per project, publikasi versioned draft→published→active yang atomik, preview draft tanpa menyentuh produksi, guest link per tamu, realtime presence + emote (tanpa chat bebas), analytics undangan.
- Batasan: info pernikahan kanonis tidak boleh terkunci di balik gameplay; mobile-first (tamu HP, target 360–430px); tidak adaiky; quest tunggal `collect-our-story-v1` (hatinya bisa di-assign ulang, mekaniknya tetap).
- Terminologi: Wedding = project; Publikasi = snapshot konten aktif; NPC = 10 slot tetap per template; Hearts = 4 kenangan quest.
- Paket komersial (dikonfirmasi pemilik untuk permukaan pemasaran): tiga tingkat dengan harga "mulai dari" **Rp 1,5jt / Rp 3,5jt / Rp 7jt**. Nama paket dan isi tiap tingkat **belum diputuskan** — jangan dikarang.
- Jalur konversi pemasaran: **chat WhatsApp** (situs static export, jadi tidak ada penanganan form di server). Nomor tujuan **belum diberikan** — sampai diisi, pakai placeholder yang jelas dan catat di daftar penggantian.
- Permukaan pemasaran adalah Persuade dan menyapa **dua pembeli**: pasangan (Indonesia-first) dan wedding organizer/vendor.

## Brand Commitments

Nama: YUTEMU (kapital semua). Tagline ID "Temui kisah mereka.", EN "Your love story, playable." Mark: gateway-Y (dua path menyatu + sparkle), gradien peach→violet di atas cream, festgelegt di `docs/logo-glow.webp` / `docs/favicon.webp`. Voice: hangat, playful, tidak kekanak-kanakan; UI operator berbahasa Indonesia.

## Evidence on Hand

- Live stack: web Pages, API + realtime Workers, R2 `wedding-templates` + `yutemu-wedding-media`, Neon. Lihat `walkthrough.md`.
- Milestone ledger: `IMPLEMENTATION_STATUS.md` (M0–M17.1 + rebrand + production acceptance).
- Browser probes per milestone di `tooling/e2e/`; aset brand di `apps/web/public/brand/`.
- **Screenshot produk asli**: `docs/qa/` berisi 78 tangkapan Playwright dari world, Wedding Book, quest HUD, finale, emote, RSVP, dan Studio pada lebar 320/360/390/430 (plus satu Studio desktop 1167). Maksud tiap tangkapan bisa diverifikasi di sumbernya — `tooling/e2e/m46-world.mjs` mendokumentasikan sembilan titik teleport landmark, begitu pula `m5-quest.mjs`, `m4-book.mjs`, `m15-guest.mjs`, `m45-avatars.mjs`. Nama berkas tidak selalu jujur: `m15-onboarding-390.png` adalah world setelah onboarding (HUD "Halo, Dinda!"), **bukan** form onboarding.
- **Pack pixel-art first-party**: 23 runtime avatar sheet + atlas environment di `apps/web/public/assets/`; sumber di `assets-source/`; provenans di `THIRD_PARTY_ASSETS.md` (milik pemilik, bukan open source).
- **Copy produk nyata yang bisa dikutip**: onboarding memakai judul "Selamat Datang!", subjudul "Isi namamu dan pilih karakter untuk masuk ke taman.", label "Nama"/"Karakter", tombol "Masuk Taman"; label aksi NPC memakai "Bicara", "Masuk", "Foto", "Beri Doa", "Lihat Lokasi".
- **Yang tidak ada dan tidak boleh dikarang**: testimoni, nama/logo pelanggan, liputan pers, angka benchmark atau konversi, foto pasangan nyata untuk pemasaran, serta nama dan isi paket harga.
- **Fixture demo bersifat sintetis**: `Ayu Lestari` & `Bima Pratama` (`demo-ayu-bima-v1`) adalah identitas demo, bukan pelanggan. Setiap kali ditampilkan di permukaan pemasaran harus diberi label demo.

## Product Principles

1. Undangan dulu, game kemudian — informasi resmi selalu satu ketukan jauhnya.
2. Operator awam bisa menerbitkan — tidak ada JSON, ID teknis, atau SQL di jalur normal.
3. Satu wedding tidak pernah bocor ke wedding lain — isolasi project adalah janji produk.
4. Draft tidak pernah menyentuh produksi kecuali lewat Activate yang eksplisit.
5. Kegagalan game tidak boleh membuat informasi wedding tidak bisa diakses.

## Accessibility & Inclusion

Tamu dan operator memakai HP kelas menengah: kontras WCAG-conscious, target sentuh aman, tidak ada gerakan dekoratif yang menghambat alur, teks Indonesia yang terbaca di layar kecil.
