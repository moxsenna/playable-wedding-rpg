# PayCore registration — YUTEMU (self-serve checkout) — REGISTERED 2026-09-11

Self-serve checkout (`/mulai` → PayCore → Duitku) needs two things that
live outside this repo. Secrets are NEVER committed — set them with
`wrangler secret put` and hand copies to the PayCore maintainer.

## 1. Register with the PayCore maintainer — DONE 2026-09-11

App slug: `yutemu`, order prefix: `YWT-`.

| Item | Staging value | Production value |
|---|---|---|
| `webhook_url` | `https://<staging-api>/internal/payment-events` | `https://<prod-api>/internal/payment-events` |
| `return_url` | `https://<staging-web>/mulai/retur` | `https://<prod-web>/mulai/retur` |
| `product_key` Esensial | `yutemu_esensial` (Rp 1.500.000) | same |
| `product_key` Signature | `yutemu_signature` (Rp 3.500.000) | same |
| `product_key` Bespoke | `yutemu_bespoke` (Rp 7.000.000) | same |
| key id | `pk_staging_yutemu_01` | `pk_yutemu_01` |
| merchant profile | `appvibe_default` (POP redirect) | same |

Registered in PayCore as maintainer: `src/config/env.ts` +
`src/types/env.ts` resolvers, `migrations/0015_app_yutemu.sql`
(applied to **production D1 only** — no staging wedding worker
exists yet, see migration header), secrets in PayCore
`.staging.vars` / `.production.vars`, staging + production workers
deployed and healthy. Live proof: signed `POST /v1/orders`
→ 201 `YWT-20260911-W7FRB` with real Duitku prod checkout URL
(test reference `YWT-REGCHECK-01`, expires unpaid — no money moved).

Give the maintainer the staging/production `PAYCORE_APP_SECRET` and
`PAYCORE_WEBHOOK_SECRET` values (generated locally, see §2). Staging
and production MUST use different secrets.

## 2. Worker secrets (`wedding-rpg-api`)

```bash
wrangler secret put PAYCORE_BASE_URL      # staging: https://pay-staging.appvibe.biz.id
wrangler secret put PAYCORE_APP_ID        # yutemu
wrangler secret put PAYCORE_KEY_ID        # pk_staging_yutemu_01
wrangler secret put PAYCORE_APP_SECRET    # HMAC to PayCore (from local generation)
wrangler secret put PAYCORE_WEBHOOK_SECRET # verify events from PayCore (from local generation)
wrangler secret put PAYCORE_RETURN_URL    # https://<web>/mulai/retur
```

2026-09-11: production values pushed to the live worker
(`PAYCORE_BASE_URL=https://pay.appvibe.biz.id`,
`PAYCORE_KEY_ID=pk_yutemu_01`); staging values in
`apps/api/.dev.vars` (auto-loaded by `wrangler dev`), production
values in `apps/api/.dev.vars.production` (both gitignored).
Checkout stays 502 until the maintainer registers the app/keys.

Without these, `POST /v1/checkout` answers 501 `checkout unavailable`
and the landing/manual admin path keeps working.

## 3. Database

Apply `drizzle/migrations/0005_selfserve_billing.sql` to Neon
(`billing_orders`, `payment_events`, `owner_claims`,
`owner_sessions`, `wedding_projects.tier`).

## 4. Staging E2E (with maintainer)

`/health` OK → create order on `/mulai` → sandbox pay →
`payment.succeeded` → claim link on `/mulai/retur` → wizard →
publish → duplicate webhook safe (replay returns `deduped`).
Minimum gate from the PayCore guide §10, plus the local
`tooling/e2e/selfserve.mjs` (`SELFSERVE VERIFIED`) which covers the
same flow against a signature-verifying mock.
