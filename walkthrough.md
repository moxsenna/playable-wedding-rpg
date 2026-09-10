# Walkthrough — Playable Wedding RPG (production)

Live stack (verified 2026-09-09):

| Layer    | URL                                                        |
| -------- | ---------------------------------------------------------- |
| Web      | https://wedding-rpg-bli.pages.dev                          |
| API      | https://wedding-rpg-api.moxsenna.workers.dev               |
| Realtime | wss://wedding-rpg-realtime.moxsenna.workers.dev            |
| Assets   | R2 `wedding-templates` via API `/v1/assets` (pinned v6)    |
| Data     | Neon Postgres (migrated + seeded)                          |

## 1. Guest flow (HP)

1. Buka link undangan bersih, mis. `https://wedding-rpg-bli.pages.dev/g/gt_AbC123XyZ9qQ`
   (tanpa `?wedding=&api=&session=&net=` — satu bootstrap server me-resolve
   guest, project, session, publication, world, dan realtime sekaligus).
   Token salah → “Tautan tidak valid”; wedding diarsip → info arsip;
   wedding draft → “Undangan belum tersedia”; belum ada publikasi aktif →
   info standby. Tidak ada fallback ke wedding lain.
2. Game boot dari manifest R2 yang di-pin (`garden-village-v1/v6`); HUD `OUR STORY ♡ ♡ ♡ ♡` muncul.
3. Jalan dengan joystick, dekati NPC (Sari), tekan Aksi, ikuti dialog untuk mengumpulkan 4 hati (urutan bebas).
4. HUD penuh → gerbang aula terbuka → masuk Wedding Hall → finale Ayu & Bima.
5. Realtime tersambung otomatis dari bootstrap (`?rt=0` untuk opt-out);
   guest lain terlihat sebagai remote player + emote real-time.

## 1b. Operator flow (M17 Studio, tanpa SQL / tanpa edit source)

1. Buka `/admin`, isi Admin Key (operator, sessionStorage perangkat saja),
   klik Muat Weddings, pilih wedding aktif. Wedding baru: isi nama →
   Buat Wedding (langsung berstatus draft).
2. Konten: Mempelai (nama, panggilan, bio, foto URL, sapaan, tanggal),
   Acara (tambah/ubah/hapus/susun), Venue (nama, alamat, Maps URL,
   landmark), Cerita, Gallery (URL + susunan + cover), Hadiah (bank,
   e-wallet, registry), Opsi modul & dresscode. NPC per slot (nama,
   avatar, peran, dialog, aksi) + 4 hati Our Story + tukar lokasi
   antar-slot. World (template, suasana, musik) + Avatar Tamu
   (centang dari registry). Memuat editan server: Muat dari Server.
   Gallery: tempel URL, atau Unggah foto (otomatis WebP, tersimpan di
   R2 per-project); susun, jadikan cover, hapus (ditolak bila dipakai
   publikasi aktif).
3. Simpan Draft → Preview Draft (buka `/g/preview/<token>`, data draft,
   production tidak tersentuh) → Publish → Aktifkan.
4. Tamu: Tambah satu per satu (tombol Copy per baris), atau tempel CSV
   (`name,phone,email,group,notes`)
   → Preview & Import → ringkasan dibuat/dilewati/ditolak.
5. Export Links → `guest-links-<wedding>.csv` berisi `name,link` (`/g/:token`,
   tanpa session secret) → bagikan.
6. Analitik: Muat Analitik (total, dibuka, mulai, hati, finale, wishes, RSVP).
   Catatan: event bertoken adalah bearer credential (pemegang URL bisa
   mengirimnya) — perlakukan sebagai metrik indikatif, bukan otoritatif.
   Jalur normal memakai session yang di-mint saat bootstrap.
6. CSV contoh:
```csv
name,phone,group
Budi,0812,Keluarga
"Sari, M.Pd",,Teman
```

## 2. Operator: undang guest baru (legacy, tetap didukung)

Token guest deterministik: `gt_live_<id>` (lihat `tooling/db/seed.mjs`). Untuk guest baru:

1. `INSERT INTO guests (id, project_id, name, token, created_at)` ke Neon
   (atau tambah ke `GUESTS` di `tooling/db/seed.mjs` lalu `node tooling/db/seed.mjs` — idempoten).
2. Tukarkan token → session: `POST /v1/session { "token": "gt_live_...", "avatarId": "guest_01" }`.
3. Beri guest link: `?wedding=<id>&api=<API>&net=wss://…/room?room=<id>&session=<SESSION>`.
4. Display name + avatar di derived dari session server (HMAC `ROOM_SECRET`) — `?name=` diabaikan.

## 3. Operator: admin publication

Buka `/admin` (pick wedding → edit couple/section → validate → draft → publish → activate). Atau via API (`x-admin-key`):

```text
POST /v1/admin/draft    { projectId, publicationId, snapshot }
POST /v1/admin/publish  { versionId }
POST /v1/admin/activate { versionId }   # atomik: single-statement, 409 jika konflik
GET  /v1/publication?project=&publication=
```

## 4. Operator: publish world baru

```bash
node tooling/world-gen/build-world.mjs
node tooling/publish/publish.mjs garden-village-v1 --driver r2 --bucket wedding-templates --out out/prod
node tooling/db/seed.mjs   # majukan pin manifestRef ke versi terbaru
```

Publisher meng-hash world + deps (`environment@`, `avatars@`) dan menulis manifest dengan base pinned `assets/<dep>/<sha12>/`; game membaca base dari manifest (fallback legacy `assets/` di dev).

## 5. Secrets / env (Cloudflare dashboard atau `wrangler secret put`)

| Secret         | Worker            | Keterangan                              |
| -------------- | ----------------- | --------------------------------------- |
| `DATABASE_URL` | api               | Neon pooled URL (jangan commit)         |
| `ROOM_SECRET`  | api + realtime    | HMAC session, ≥16 char, **sama** di kedua worker |
| `ADMIN_KEY`    | api               | header `x-admin-key`                    |
| `CLOUDFLARE_API_TOKEN` | sesi shell | hanya untuk deploy/publish, hapus setelahnya |

Token wrangler bertoken IP-restricted (9109) untuk sebagian operasi baca — deploy tetap jalan; Pages deploy pakai sesi OAuth.

## 6. Deploy ulang

```bash
pnpm --filter @wedding-rpg/web build
wrangler pages deploy apps/web/dist --project-name wedding-rpg
wrangler deploy --config apps/api/wrangler.jsonc
wrangler deploy --config apps/realtime/wrangler.jsonc
```

## 7. Verifikasi

```bash
node scripts/verify-ci.mjs                    # 22 gates credential-free
node tooling/e2e/prod-smoke.mjs               # butuh DATABASE_URL di env (smoke penuh)
node tooling/e2e/prod-soak.mjs                # 12 siklus boot produksi, tanpa secret
```

Bukti terakhir: `docs/qa/prod-smoke-390.png`, `out/soak-evidence.log` (diabaikan git).
Ledger per milestone: `.unlazy/wedding-rpg-v1/gates/` (diabaikan git, baca di worktree);
status ringkas: `IMPLEMENTATION_STATUS.md`.
