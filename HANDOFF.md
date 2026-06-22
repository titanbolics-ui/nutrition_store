# Stage journal — Post-Purchase Communication System

Append one note per completed stage. Source spec: `docs/post-purchase-tech-spec.md`.

---

## Stage 0 — Phone normalization (Medusa) — DONE (2026-06-13)

**What:** every customer phone stored as E.164; future writes normalized at the source.

- `src/utils/phone.ts` — `normalizePhone(raw, defaultCountry?) → string | null` (spec
  signature), plus `isE164()` and `normalizeBodyPhone()` helpers.
- Write points normalize with `normalizePhone(raw, country) ?? raw` (invalid kept as
  entered): `register/request`, `activate/confirm` (×2), and a new
  `POST /store/customers/me` body middleware in `src/api/middlewares.ts`.
- `src/subscribers/order-placed-customer-phone.ts` — copies normalized shipping phone
  to guest customers on `order.placed` (guests only, only if phone empty, replay-safe).
- `src/scripts/normalize-phones.ts` — one-off backfill (`npx medusa exec`): normalize
  existing phones + backfill guests from latest order shipping phone. Report
  `phone-normalization-report.json` (gitignored — contains PII).
- Storefront: soft non-blocking phone validation in register + profile-phone
  components; new `src/lib/util/phone.ts`; added `libphonenumber-js` dep.

**Read-time contract for later stages:** `customer.phone` may hold raw/invalid values.
Stage 4 `resolveChannel` must gate on `isE164()` (valid E.164 → whatsapp candidate,
else email). Acceptance line added to the Stage 4 spec.

**Tests:** `npm run test:unit` (phone util + script logic), `npm run test:integration:http`
(`phone-normalization.spec.ts` — script, subscriber, registration route). All green.

**Infra note:** test runs needed two fixes — `jest.config.js` now transforms `.tsx`
(Resend templates) and `medusa-config.ts` swaps redis modules for in-memory under
`NODE_ENV=test`; `.env.test` carries local DB creds.

---

## Stage 2 — Delivery detection — provider EasyPost (refactor, 2026-06-22)

**What:** delivery tracking migrated 17track → EasyPost. 17track now bills USPS as a
paid "Special Carrier" (code 21051) and rejects domestic numbers, spamming a
re-registration cron. EasyPost tracks standalone packages, self-updates, and pushes
webhooks — so the polling pool/cron is gone. We resolve the carrier ourselves and pass
it explicitly; EasyPost auto-detection is never used.

- `src/utils/easypost-client.ts` — `createTracker` (`POST /v2/trackers`, Basic auth,
  3-month dedup, explicit carrier), `verifyWebhookSignature` (mirrors EasyPost's official
  `validateWebhook`: HMAC-SHA256, NFKD secret, **weight-correction** of the body before
  signing — integer `"weight":n` → `n.0`, else every real tracker webhook 401s —
  header `x-hmac-signature`), `isDelivered` (top-level `result.status`).
- `src/utils/resolve-carrier.ts` — one pattern map → `USPS` (`/^9\d{21}$/`, verified) /
  GoFo (`/^CR\d{12}$/`, `verified: false` → resolves to `null` until the
  `CirroECommerce` identifier is confirmed live); no match → `null`, never a default.
- `src/utils/easypost-tracker.ts` — `registerTrackerForFulfillment` (carrier null →
  flag `carrier_unresolved`, don't register; idempotent via `metadata.easypost_tracker_id`;
  optional explicit tracking-number override) + `markDeliveredByTrackingNumber` (runs
  `markOrderFulfillmentAsDeliveredWorkflow` → native `delivered_at` + `delivery.created`).
- `src/api/hooks/easypost/route.ts` — invalid signature → 401, nothing written; 200 fast;
  delivered → mark delivered; non-delivered → no-op. Raw body via `middlewares.ts`.
- Registration triggers: `src/subscribers/register-tracker.ts` (`shipment.created`) +
  direct calls in `sync-tracking-from-sheets.ts` (already-shipped branch) and
  `admin/fulfillments/[id]/tracking/route.ts` (manual entry).
- Removed: `seventeen-track` module + `sync-17track-pool` cron + client/pool utils +
  old webhook route; `medusa-config.ts` registration; `SEVENTEEN_TRACK_*` env.
- `.env.template`: added `EASYPOST_API_KEY`, `EASYPOST_WEBHOOK_SECRET`.

**Note — `delivered_at` is the native field, not metadata** (spec PART A.2 said metadata):
delivery flows through `markOrderFulfillmentAsDeliveredWorkflow` → `delivery.created` →
`order-delivered` email. Writing metadata instead would break that chain. Kept as-is.

**Tests:** `npm run test:unit` — `resolve-carrier`, `easypost-client` (HMAC + createTracker),
`easypost-tracker` (register null/present/idempotent/override; delivered once/replay/no-match).
45 unit tests green; `npm run build` clean.

**Manual post-merge steps (not done here):**
1. Set `EASYPOST_API_KEY` + `EASYPOST_WEBHOOK_SECRET` in prod.
2. EasyPost dashboard: point the webhook URL at `https://<backend>/hooks/easypost`;
   disable the old 17track webhook.
3. Confirm carrier id `CirroECommerce` against live Carrier Metadata, then flip the GoFo
   pattern to `verified: true` in `resolve-carrier.ts`. Until then GoFo numbers are
   intentionally left `carrier_unresolved` (manual review), never auto-registered. USPS
   is unaffected.
4. Drop the orphaned table: `npx medusa exec ./src/scripts/drop-seventeen-track-table.ts`.
