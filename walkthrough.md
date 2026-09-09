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

1. Buka link undangan, mis. `https://wedding-rpg-bli.pages.dev/?wedding=demo-ayu-bima&api=https://wedding-rpg-api.moxsenna.workers.dev`.
2. Game boot dari manifest R2 yang di-pin (`garden-village-v1/v6`); HUD `OUR STORY ♡ ♡ ♡ ♡` muncul.
3. Jalan dengan joystick, dekati NPC (Sari), tekan Aksi, ikuti dialog untuk mengumpulkan 4 hati (urutan bebas).
4. HUD penuh → gerbang aula terbuka → masuk Wedding Hall → finale Ayu & Bima.
5. Dengan `&net=wss://…&session=…`, guest lain terlihat sebagai remote player + emote real-time.

## 2. Operator: undang guest baru

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
