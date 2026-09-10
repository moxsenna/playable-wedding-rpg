---
name: YUTEMU
description: Undangan pernikahan yang bisa dimasuki dan dimainkan.
colors:
  lentera-gold: "#ffd98a"
  night: "#191331"
  night-deep: "#221a3d"
  panel: "#232c44"
  ink: "#f2f4f8"
  muted-lavender: "#b9b3d4"
  coral: "#e4636f"
  violet: "#8b76c9"
  cream: "#fff6ea"
  success-leaf: "#9fe8a9"
  warning-rose: "#f2a3a3"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontWeight: 700
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  label:
    fontSize: "14px"
    fontWeight: 400
rounded:
  pill: "999px"
  card: "16px"
  field: "12px"
spacing:
  sm: "8px"
  md: "16px"
components:
  button-primary:
    backgroundColor: "{colors.lentera-gold}"
    textColor: "{colors.night}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  button-secondary:
    backgroundColor: "rgba(255,255,255,.07)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
---

# Design System: YUTEMU

## Overview

**Creative North Star: "Arsip Kenangan"**

YUTEMU terlihat seperti album kenangan yang dibuka bersama orang tersayang: premium tapi dekat, tidak pernah jauh atau formal. Latar senja yang dalam menahan konten, dan cahaya lentera emas menandai satu-satunya hal yang penting di setiap layar — tindakan berikutnya, status yang hidup, dan nama-nama yang dirayakan. Game-nya boleh magis; perkakasnya tertib seperti arsip yang terawat: setiap bagian punya tempat, setiap status terbaca dalam sekejap.

Malam hari adalah pilihannya karena adegannya: operator bekerja dengan fokus, tamu membuka undangan di sela acara. Kontras dijaga tinggi, sentuhan harus besar, dan tidak ada yang berkedip meminta perhatian selain momen yang memang spesial. Key Characteristics:
- Senja yang tenang, bukan neon yang ramai.
- Satu aksen emas untuk semua tindakan dan status penting.
- Tertib arsip: hierarki jelas, kepadatan disengaja, tidak ada dekorasi tanpa tugas.

## Colors

Senja dalam dengan satu lentera; warna lain hanya untuk status dan identitas brand.

### Primary
- **Lentera Emas** (#ffd98a): satu-satunya warna tindakan — tombol utama, pilihan aktif, status draft, focus ring, dan sorotan brand. Kelangkaannya adalah inti sistem.

### Secondary (optional; omit if the project has only one accent)
- **Merah Muda Peringatan** (#f2a3a3): error, validasi gagal, status arsip, dan hapus yang destruktif.
- **Daun Sukses** (#9fe8a9): valid, RSVP hadir, hati terkumpul, dan status live.

### Tertiary (optional)
- **Koral** (#e4636f) dan **Violet** (#8b76c9): identitas brand (mark Y, wordmark) dan momen magis di dalam game. Tidak dipakai untuk chrome perkakas.
- **Krim** (#fff6ea): kanvas tile logo dan momen terang; teks di atasnya selalu gelap.

### Neutral
- **Malam** (#191331): kanvas aplikasi dan admin.
- **Malam Pekat** (#221a3d): ujung gradien hero dan lapisan kedua.
- **Panel** (#232c44): input, select, dan permukaan kartu yang diangkat.
- **Tinta** (#f2f4f8): teks utama.
- **Lavender Redup** (#b9b3d4): teks sekunder, hint, dan metadata. Jangan pakai abu-abu netral — redupkan dari rona tinta.

### Named Rules (optional, powerful)
**The One Lantern Rule.** Aksen emas muncul hanya untuk tindakan, pilihan aktif, dan status. Tidak untuk border dekoratif, ikon pasif, atau teks pajangan.

## Typography

**Display Font:** Georgia, 'Times New Roman', serif (dengan fallback serif sistem)
**Body Font:** Arial, Helvetica, sans-serif

**Character:** Serif Georgia membawa momen emosional (nama brand, judul onboarding, kop undangan); sans sistem membawa semua pekerjaan. Tidak ada display face ketiga.

### Hierarchy
- **Display** (700, 22–26px, Georgia, letter-spacing 6–8px untuk wordmark): nama brand dan judul onboarding.
- **Headline** (700, 16px, emas): judul section (h2) di Studio dan Wedding Book.
- **Title** (700, 15–17px): nama tamu, nama acara, ringkasan kartu.
- **Body** (400, 15px, Arial): isi formulir, paragraf, daftar.
- **Label** (400, 12–14px, lavender redup): label field, hint, metadata, dan teks tombol sekunder.

### Named Rules (optional)
**The Two Voices Rule.** Georgia berbicara kepada hati (brand, momen); sans bekerja untuk tangan (kontrol, data). Jangan tertukar.

## Layout

Kolom tunggal 720px untuk alur Studio di mobile; di ≥1024px menjadi rail 288px (konteks + navigasi, sticky) dan kolom konten. Shell game 430px portrait, kanvas penuh. Ritme: 18px di atas heading section, 8px di bawahnya; grup rapat (6–10px), antar-section lega (16–24px). Tabel tamu memakai grid nama–aksi–link–meta; metrik analitik 2 kolom di mobile, 4 di desktop.

## Elevation & Depth

Bayangan adalah sistem struktural: lapisan melayang terangkat dari kanvas malam dengan bayangan ambient, dan CTA emas membawa kilau hangatnya sendiri.

### Shadow Vocabulary (if applicable)
- **Lenting Emas** (`box-shadow: 0 4px 16px rgba(255,217,138,.3)`): tombol submit onboarding dan momen konfirmasi utama.
- **Angkat Lapisan** (`box-shadow: 0 12px 40px rgba(0,0,0,.55)`): menu emote dan sheet modal di atas dunia game.

### Named Rules (optional)
**The Resting Flat Rule.** Kartu dan section diam tanpa bayangan; depth datang dari tone, bukan dari semua permukaan sekaligus.

## Shapes

Semua yang bisa disentuh berbentuk pil (999px): tombol, nav, chip status, dan pill status draft/live/archived. Wadah berbentuk kartu 16px (sheet 18px); field 12px; thumbnail 10–12px. Border 1px terang 12–20% untuk memisahkan lapisan, bukan untuk menghias. Tidak ada mask geometris dan tidak ada sudut tajam di chrome produk.

## Components

### Buttons
- **Shape:** pil penuh (999px), tinggi sentuh min 44px, padding 10px 14px.
- **Primary:** emas Lentera di atas teks malam; hover cerah (brightness), active turun 1px, disabled 45% dengan cursor terkunci.
- **Hover / Focus:** ring emas 2px dengan offset 2px untuk semua kontrol fokus-keyboard.
- **Secondary / Ghost / Tertiary (if applicable):** sekunder hantu — teks tinta di atas kaca 7% dengan border terang 20%; tanpa varian tersier.

### Chips (if used)
- **Style:** pill status uppercase 12px dengan varian live (daun), draft (emas), archived (mawar) di atas kaca berwarna.
- **State:** chip adalah label status, bukan toggle; tidak ada interaksi.

### Cards / Containers
- **Corner Style:** 16px; sheet dialog 18px.
- **Background:** kaca 4–6% di atas malam; kartu status memakai kaca berwarna 8–18%.
- **Shadow Strategy:** diam tanpa bayangan; lihat Elevation & Depth.
- **Border:** 1px `rgba(255,255,255,.12)`; dashed 20% untuk empty state.
- **Internal Padding:** 12–14px kartu, 10–12px baris daftar.

### Inputs / Fields
- **Style:** dasar panel (#232c44) atau kaca 6%, radius 12px, teks tinta 15px, tinggi min 44px.
- **Focus:** outline emas 2px, offset 2px; select memakai `color-scheme: dark` agar popup bawaan tetap gelap.
- **Error / Disabled:** error memakai teks mawar dan daftar alasan; field terkunci memakai opacity 45%.

### Navigation
- **Style, typography, default/hover/active states, mobile treatment.** Navigasi Studio adalah pil outline emas 13px tebal; anchor melompat ke section; rail sticky di desktop dan menumpuk di atas konten pada mobile. Tidak ada sidebar tersembunyi — semua tujuan terlihat sekaligus.

### Studio Metric (optional; if the project has a distinctive custom component worth documenting)
Kartu angka analitik: angka 22px tabular-nums di atas label 12px lavender; grid 2 kolom mobile, 4 kolom desktop.

## Do's and Don'ts

Concrete visual guardrails grounded in the incumbent implementation or the user's chosen world. Lead each with "Do" or "Don't" and include exact values only when established. Do not turn a task-specific concept or surface strategy into a system-wide prohibition.

### Do:
- **Do** pakai emas Lentera (#ffd98a) hanya untuk tindakan, pilihan aktif, dan status.
- **Do** jaga tinggi sentuh min 44px untuk semua kontrol.
- **Do** beri setiap destructive action konfirmasi dan setiap daftar kosong empty state yang mengajari.
- **Do** redupkan teks sekunder dari rona tinta (#b9b3d4), bukan abu-abu netral.

### Don't:
- **Don't** memakai estetika kasino/mobile-game generik — tidak ada neon ramai, tidak ada chrome RPG inventaris.
- **Don't** mendinginkan Studio menjadi SaaS korporat — malamnya hangat, kopinya formalitas arsip.
- **Don't** menaruh teks di atas tile logo krem kecuali dengan tinta gelap.
- **Don't** menduplikasi `data-testid` antar dua tombol — satu aksi, satu identitas uji.
