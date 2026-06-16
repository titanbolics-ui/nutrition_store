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
