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

---

## Storefront Redesign Stage C — metadata.content schema + validation — DONE (2026-07-10)

Source spec: `nutrition_store_front/docs/storefront-redesign-tech-spec.md` (this repo's copy
of that spec doesn't exist — only found in the front repo; flagged as a discrepancy).
Stages A/B of that spec were intentionally reverted by the user — categories/variants are
being done manually in prod Admin, not automated.

**What:**
- `src/utils/product-content-schema.ts` — zod discriminated union on `type`
  (`"compound" | "peptide"`), each with its required fields per the spec, plus shared
  optional `coaUrl`/`faq[]`/`contentBlocks[]`/`alsoKnownAs`. `validateProductContent(raw)`
  returns a single readable, field-named error on the first zod issue (e.g. `"Invalid
  metadata.content: dosage.beginner — ..."`), or the parsed content.
- `src/api/admin/products/middlewares.ts` + one-line registration in
  `src/api/middlewares.ts` — plain inspect-and-short-circuit middleware (mirrors the
  existing `/store/customers/me` phone-normalization entry) on `POST /admin/products` and
  `POST /admin/products/:id`. Only reads `metadata.content`; every other field in the body
  passes through untouched. Rejects with `400` before the product workflow runs, since
  `updateProductsWorkflow`'s only hook (`productsUpdated`) fires after the DB write —
  confirmed by reading `@medusajs/core-flows`'s compiled workflow, too late to reject.

**Fix (2026-07-11, after first real Admin UI attempt):** `validateProductContent` now
accepts a JSON-encoded **string**, not just an already-parsed object. Admin's generic
metadata table (the key/value editor visible for `form`/`class`/etc.) submits every value
as a plain string — that's the actual, only way this content gets authored per this repo's
own `CLAUDE.md` ("Editing stays manual JSON for now"), so rejecting a string outright
(`"expected object, received string"`) blocked the real workflow entirely. The middleware
now parses a string with `JSON.parse` before validating, and on success **normalizes it in
place** to the parsed object (patching both `req.body.metadata` and
`req.validatedBody.metadata` — the core route reads from the latter, confirmed by the
first version of this fix silently no-op'ing until both were patched) so what's actually
persisted, and what the storefront reads, is always a real object, never the raw string. A
string that isn't valid JSON still gets a readable `Invalid metadata.content: content —
Invalid JSON: ...` error, same as any other malformed shape.

**Fix 2 (2026-07-11, same session):** the real product content the user tried to save had a
`contentBlocks` entry shaped `{ title, content }` (natural author instinct) instead of the
spec's `{ type, body }`. Validation correctly rejected it, but zod's default message for a
discriminated-union mismatch was a bare `"Invalid input"` — technically named the field
(`contentBlocks.0.type`) but gave no hint what was actually expected, which is exactly the
"unreadable error" this validation was built to avoid. `validateProductContent` now
special-cases the two `discriminatedUnion` mismatches (top-level `content.type` and each
`contentBlocks[].type`) to spell out the accepted literal values, e.g. `"missing or
unrecognized block type. Each contentBlocks entry needs "type" set to one of: "text",
"image", "callout", "table"."`. Also added an optional `title` field to the `text` and
`callout` block shapes (additive, not spec'd but a real, low-risk authoring need — a
titled paragraph/callout, which the author was already trying to write) — the storefront
renders it as a heading above the body when present.

**Deviations from the spec doc:**
- `reconstitution` is deliberately **not** in this schema — per this turn's explicit
  instructions it lives on variant metadata instead
  (`variant.metadata.reconstitution = { enabled, vialAmount, unit }`), same convention as
  the existing `restock_eta`. Not validated server-side this stage (frontend reads it
  defensively); Stage D can tighten this when it builds the real calculator.
- `profile.*`/`dosage.*` fields are typed as `string`, not number/enum — the spec's inline
  shape gives no numeric/enum constraint and real values ("100:100", "Moderate") don't fit
  a clean enum. `product-metadata-schema.md`, referenced as the fuller schema source, was
  not found anywhere in either repo.

**Tests:** `npm run test:unit` — `src/utils/__tests__/product-content-schema.unit.spec.ts`
(13 cases: valid compound/peptide, missing required field names the field, unknown `type`
with the accepted-values message, all 4 contentBlocks types valid, malformed block names
the field, non-JSON string doesn't throw, valid content JSON-encoded as a string is
accepted and parsed, malformed/truncated JSON string rejected with a readable "Invalid
JSON" error, **contentBlocks entry with wrong field names (title/content instead of
type/body) rejected with a message spelling out the accepted block types**, **unrecognized
top-level type spells out the accepted values**, **optional `title` accepted on text/
callout blocks**, **text/callout blocks still valid without a title**).
`npm run test:integration:http` — `integration-tests/http/product-content-validation.spec.ts`
(5 cases against a real admin user + real `POST /admin/products/:id`: invalid content →
400 naming the field, product unchanged; valid content → 200, persisted; no content at all
→ 200, succeeds exactly as before; content submitted as a JSON string → 200, persisted as
a real object; malformed JSON string → 400, "Invalid JSON"). All green (43 unit + 21
integration total, including pre-existing suites). Also reproduced both fixes against the
live local dev server/DB directly (same request shape the Admin dashboard sends) to
confirm outside the test harness too, then reverted.

**Manual verification:** patched real products via the running local dev server/DB —
`delatestryl-300-test-e-1ml-amp-canadabiolabs` (compound) and
`spectros-140iu-hgh-spectrum-pharma` (HGH, peptide-layout override) — confirmed against
the storefront, then reverted both back to no `metadata.content`. A throwaway local admin
user (`verify-admin@example.com`) was created for this and left in place (Medusa doesn't
allow a user to self-delete) — harmless local-dev-only account, delete via Admin if
unwanted.

**Frontend half:** `nutrition_store_front/HANDOFF.md` has the tabs/template-resolution
side of this stage.

## Content import/export workflow — DONE (2026-07-13)

**What:** git-committed `content/<handle>.json` as the source of truth for product copy,
with import/export CLI scripts — because Admin's metadata table stores primitives only and
can't edit the nested `metadata.content` object.

- `src/scripts/import-content.ts` — `npx medusa exec ./src/scripts/import-content.ts
  [handle...] [dry-run]`. No handle → every `content/*.json`; handles → only those (a
  requested handle with no file fails loudly). Pure `planContentImport()` /`parseArgs()`
  exported for unit tests. Each file: JSON.parse → `validateProductContent` (reused from
  `src/utils/product-content-schema.ts`, same schema the Admin API enforces) → product
  lookup → `isDeepStrictEqual` vs existing content → created/updated/unchanged/invalid/
  not_found. Writes via `updateProductsWorkflow` with metadata merged explicitly
  (`{...existing, content}`) so rank/template/specs survive. Idempotent; invalid files
  never written (valid ones in the same run still import); `process.exitCode=1` on any
  invalid/not_found.
- `src/scripts/export-content.ts` — pulls DB `metadata.content` into `content/*.json`
  (bootstrap / keep in sync). Validates before writing (skips invalid legacy content with
  a reason). Canonical serialization (`src/utils/content-files.ts` `serializeContent` =
  2-space JSON + trailing newline) guarantees export→import round-trips as `unchanged`.
- `content/README.md` — workflow + filled compound & peptide copy-paste shapes.
  `content/oxandrolone-zphc.json` — bootstrapped by running export against the local DB.
- CLAUDE.md — documented the not-editable-in-Admin workflow.

**GOTCHA (important):** `medusa exec`'s own CLI (yargs) intercepts `--options` and errors
before the script runs — `--dry-run` does NOT work. Pass the flag as the bare positional
token `dry-run`. Documented in both script headers, README, and CLAUDE.md.

**Verified:** `npm run test:unit` 57/57 (new `import-content.unit.spec.ts` covers malformed
JSON→invalid, missing `dosage.pct`→invalid naming the field, created, merged metadata keeps
rank/template, idempotent unchanged, not_found, parseArgs, export→import round-trip;
`readme-examples.unit.spec.ts` validates the README shapes against the live schema).
`npm run build` clean. Live against local DB: export created the file; re-import
`unchanged`; edited a field → real import `updated`, psql confirmed the new value AND an
injected `rank` key survived the merge; broke the file (removed `dosage.pct`) → `invalid —
dosage.pct`, exit 1, nothing written; DB restored, final round-trip `unchanged`.

## content файл несе active_ingredient — DONE (2026-07-13)

**What:** `content/<handle>.json` тепер може містити top-level `active_ingredient`. Схема
content його стирала (підтверджено тестом), тому import відщеплює його ПЕРЕД валідацією і
пише в плоский `metadata.active_ingredient` (те, що читає підзаголовок сторінки); решта
валідується як раніше.

- `src/scripts/import-content.ts` — `planContentImport`: `const {active_ingredient, ...rest}
  = parsed`, валідує `rest` як content; порожній/не-рядок `active_ingredient` → invalid з
  назвою поля; merged metadata `{...existing, content, active_ingredient?}`; idempotency
  порівнює І content, І active_ingredient; пропуск поля у файлі не стирає наявне значення.
- `src/scripts/export-content.ts` + `src/utils/content-files.ts` — новий
  `serializeContentFile(content, activeIngredient?)`: канонічний порядок
  `{type, active_ingredient?, ...content}`. Export включає плоский active_ingredient назад у
  файл. Round-trip export→import = unchanged.
- `content/README.md`, `CLAUDE.md` — задокументовано.

**Verified:** `test:unit` 62/62 (нові: split у плоский metadata не в content; blank→invalid;
пропуск не стирає; зміна лише active_ingredient→updated; round-trip з active_ingredient).
`build` чисто. Live: oxandrolone-zphc — import `updated`, psql: flat active_ingredient=
Oxandrolone, content НЕ містить active_ingredient, alsoKnownAs=4, ключі цілі; export→import
→ unchanged.
