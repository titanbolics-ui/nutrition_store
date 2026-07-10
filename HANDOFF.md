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

---

## Waitlist (out-of-stock signups) — DONE (2026-07-08)

**What:** minimal out-of-stock waitlist. Row always created (transactional); Resend
contact sync only on explicit `marketing_consent`. No promo-code generation — the 10%
code is sent manually via a Resend broadcast when stock returns. Structural reference:
`src/modules/magic-token/` (model/service/migration/hard-delete-cron shape, business
logic embedded directly in the service rather than a workflow — same as magic-token).

- `src/modules/waitlist/` — model (`product_id`, `variant_id`, `email`,
  `marketing_consent`, `resend_contact_id` nullable, `notified_at` nullable),
  `WaitlistModuleService` (`signUp` idempotent on `(email, variant_id)` + 5-active-per-email
  cap, `setResendContactId`, `listRetryable`, `countsByVariant`, `hardDeleteStale`),
  migration with `UNIQUE(email, variant_id) WHERE deleted_at IS NULL` + `variant_id` index.
  Registered in `medusa-config.ts`.
- `src/utils/turnstile.ts` — `verifyTurnstile(token, remoteIp?)`, POSTs to Cloudflare's
  `siteverify`. **Fails closed**: unset `TURNSTILE_SECRET_KEY` → always rejects, by design
  (a bot gate that silently no-ops is worse than none).
- `src/utils/rate-limit.ts` — minimal in-process per-key fixed-window limiter (not
  Redis-backed; resets on restart, not shared across instances — fine at current scale).
- `src/api/store/waitlist/route.ts` — `POST /store/waitlist`, public (no `authenticate()`
  wrapper, same as `orders/lookup` — publishable key still required by the framework
  default). **Final contract, build the storefront against this:**
  - Body: `{ email: string, variant_id: string, marketing_consent: boolean, turnstile_token: string }`.
  - `product_id` is resolved server-side from `variant_id` via `query.graph` — the
    storefront does not send it.
  - `200` in all normal cases (new signup, idempotent repeat, invalid body shape) with
    `{ message: "You're on the waitlist. We'll email you if it comes back in stock." }` —
    always the same message, no enumeration, no `409` on duplicate.
  - `400` only for the two "real" rejections: failed/missing Turnstile
    (`{ message: "Verification failed. Please try again." }`) and the 5-active-signup cap
    (`{ message: "You already have 5 active waitlist signups..." }`).
  - `429` if the per-IP rate limit is exceeded.
- Resend sync (only when `marketing_consent === true`): **uses Segments, not the
  deprecated `audience_id` field** — confirmed via the `resend-openapi` spec that
  `audience_id` is `deprecated: true` in favor of `segments`, and the installed `resend`
  SDK (`6.5.2`) has no `segments` param on `contacts.create()` at all — contact creation is
  org-level (`POST /contacts`), then a separate `resend.contacts.segments.add({ contactId,
  segmentId })` call attaches it. Both calls are wrapped so a Resend failure never fails
  the signup — logged, `resend_contact_id` stays `null`, row is retryable via
  `listRetryable()` / `GET /admin/waitlist?variant_id=`.
- `src/modules/resend/emails/waitlist-confirmation.tsx` — new template, wired into
  `src/modules/resend/service.ts` (`Templates.WAITLIST_CONFIRMATION`). Copy is factual,
  promo-free: "You're on the waitlist for {product}. When it's back in stock we'll email
  you a 10% code." No urgency language, no CTA. Sent once, only on a genuinely new signup
  (not on the idempotent-duplicate path).
- `src/api/admin/waitlist/route.ts` — `GET /admin/waitlist` → counts per variant
  (`total`/`active`, sorted by `active` desc — the restock-demand signal);
  `GET /admin/waitlist?variant_id=...` → raw rows for that variant, including
  `resend_contact_id` (null + `marketing_consent: true` = needs a manual retry).
- `src/jobs/cleanup-waitlist.ts` — daily cron, hard-deletes rows where `notified_at` is
  more than 90 days old. **90-day figure is a default I chose** (no retention number was
  specified in the brief) — un-notified (still-active) rows are never auto-deleted since
  they're the live demand signal. Easy to tune, it's one constant.
- `.env.template`: added `TURNSTILE_SECRET_KEY` and `RESEND_SEGMENT_ID`.

**Manual post-merge steps (not done here):**
1. Create the Turnstile site in the Cloudflare dashboard; set `TURNSTILE_SECRET_KEY`
   (backend) and the matching site key (storefront widget) in prod.
2. Create the Resend Segment (dashboard or API) that opted-in waitlist contacts should
   join; set `RESEND_SEGMENT_ID` in prod. Without it, consent sync is skipped (logged, not
   fatal) — signups still work.

**Tests:** `npm run test:unit` (turnstile fail-closed/success/failure/throw, rate-limit
window/isolation/reset) + `npm run test:integration:http`
(`integration-tests/http/waitlist.spec.ts`) — duplicate signup → one row/same response;
6th active signup rejected, first 5 untouched; consent false → no Resend call; consent
true → Resend called once, contact id stored; Resend failure/throw → signup still
succeeds, `resend_contact_id` stays null; bad Turnstile token → rejected, nothing created;
confirmation email sent exactly once per new signup, not resent on duplicate. All green
(30 unit + 16 integration total, including pre-existing suites); `npm run build` clean.
