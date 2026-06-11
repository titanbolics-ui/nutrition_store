# Bug log

## A1 — Order emails linked to old protected URL instead of magic-link order page

- **ID:** A1
- **Status:** fixed (2026-06-11)
- **Symptom:** Clicking "View order details" in order emails landed on `/us/account/orders/details/<order_id>` (login-gated) instead of `/orders/<token>`. Guest saw "Welcome back" login screen.
- **Root cause:** token generated in separate subscriber, raw value unreachable from email flow. The `order_view` token was created by a standalone `generate-order-view-token.ts` subscriber, but the raw token only exists at `generateToken()` return time — the DB stores only the sha256 hash. Email subscribers therefore never received the token, and the optional `orderViewToken?:` template prop silently fell back to the old protected URL.
- **Fix:**
  - Deleted `src/subscribers/generate-order-view-token.ts`.
  - Each email sender now generates the token in its own execution flow, right before `createNotifications` / `sendNotificationStep`:
    - `src/workflows/send-order-confirmation.ts` (order-placed) — via `generateOrderViewTokenStep`
    - `src/subscribers/order-edit-notification.ts` (order-edit-requested / order-edit-confirmed)
    - `src/subscribers/order-fulfillment-created.ts` (order-fulfilled)
    - `src/subscribers/payment-captured.ts` (order-paid)
    - `src/subscribers/shipment-created.ts` (order-shipped)
    - `src/subscribers/delivery-created.ts` (order-delivered)
  - All templates: `orderViewToken` made a **required** prop; the old-URL fallback removed entirely. Silent fallbacks in auth-critical links are forbidden — a missing token must fail loudly at render, not send a broken link.
- **Lesson:** anything that needs the raw magic-token value must run in the same execution flow as `generateToken()`. Never make auth-critical link props optional.

## A2 — Order status page showed empty qty and $0.00

- **ID:** A2
- **Status:** fixed (2026-06-11)
- **Symptom:** `/orders/<token>` page rendered items with empty `qty` and `$0.00` prices.
- **Root cause:** `query.graph` returns Medusa BigNumber objects (`{ numeric_: ... }`) for `quantity`, `unit_price`, `total` and order totals. `by-token` endpoint serialized them raw; frontend `Number(object)` → `NaN` → 0.
- **Fix:** `src/api/store/orders/by-token/[token]/route.ts` normalizes all numeric fields with `parseNum()` (same pattern as `order-edit-notification.ts`) before `res.json`.

## A3 — qty 0 / $0.00 persisted: query.graph drops computed item fields with explicit subfield lists

- **ID:** A3
- **Status:** fixed (2026-06-11)
- **Symptom:** After A2's parseNum fix, page showed `qty 0`, `$0.00`, and order total equal to shipping only (31 instead of 375).
- **Root cause:** `query.graph` with an explicit subfield list (`items.quantity`, `items.total`, …) silently omits `quantity` (it lives on the `order_item` detail entity) → item totals compute as 0 → order total = shipping only. `remoteQuery` with `items.*` in subscribers returned it fine, which is why emails were correct.
- **Fix:** by-token route requests `items.*` and whitelists fields in the response mapping.
- **Lesson:** for order line items always request `items.*`; explicit subfield lists lose computed/detail fields.

## A4 — by-token endpoint 500 once order had a fulfillment

- **ID:** A4
- **Status:** fixed (2026-06-11)
- **Symptom:** Email link → `/orders/<token>` → Not Found, but only for orders WITH a fulfillment (order-fulfilled email). Orders without fulfillments rendered fine.
- **Root cause:** route requested `fulfillments.tracking_links.*` — the Fulfillment entity has no `tracking_links` property (it's `labels`). The remote joiner only touches the fulfillment service when fulfillments exist, so the ValidationError fired only after a fulfillment was created → 500 → page `notFound()`.
- **Fix:** request `fulfillments.labels.*` and map labels → `tracking_links` in the response (frontend contract unchanged).

## A5 — Tracking link in email pointed at relative `ler-send.com/...`

- **ID:** A5
- **Status:** fixed (2026-06-11)
- **Symptom:** "Track package" in order-shipped email resolved against the mail client host (`localhost:8025/view/ler-send.com/...`).
- **Root cause:** admin-entered `tracking_url` was stored truncated and schemeless (`ler-send.com/...`); the subscriber trusted any non-empty `tracking_url`.
- **Fix:** `src/utils/tracking.ts` → `buildTrackingUrl()` — only absolute `http(s)://` URLs are trusted, anything else falls back to `https://dealer-send.com/en-US/track-my-shipment?trackingNumber=<n>`. Used by shipment subscriber, by-token route, and lookup route.

## A6 — /orders/track lookup showed "pending" for shipped order, no tracking

- **ID:** A6
- **Status:** fixed (2026-06-11)
- **Symptom:** Track-order lookup returned status "pending" and no tracking number for an already-shipped order.
- **Root cause:** Medusa keeps `order.status = "pending"` until completion; tracking numbers were read from `order.metadata.tracking` while the real ones live in fulfillment `labels`.
- **Fix:** lookup route derives status from fulfillments (delivered → shipped → processing → order.status) and returns `tracking_links` from labels (sanitized), merged with legacy metadata numbers. Order page badge does the same derivation client-side.

## A7 — Footer/side-menu "Track Order" linked to login-gated /account/orders

- **ID:** A7
- **Status:** fixed (2026-06-11)
- **Fix:** footer + side-menu now link to `/orders/track`.

## Known upstream limitation — order-edit "Send notification" toggle is dead

- **Status:** not fixable locally (Medusa upstream)
- The admin order-edit dialog toggle is hardcoded `send_notification: false // TODO: not supported in the API ATM` in `@medusajs/dashboard` and never sent to the API; the confirm endpoint takes no body and the `order-edit.confirmed` event payload is `{ order_id, actions }` only.
- Our subscriber already honors `no_notification` if it ever arrives (event payload or `order_change.metadata.no_notification`). Fulfillment / shipment / delivery toggles DO work — those events carry `no_notification` and all three subscribers check it.

## B1 — Profile "null null" after activation from order email

- **ID:** B1
- **Status:** fixed (2026-06-11)
- **Symptom:** Account activated from an order email shows `null null` name and no phone. (Not an overwrite — E3 login path correctly never mutates.)
- **Root cause:** activate/confirm create-branch only used token payload; activation from an order has an empty payload, so the customer was created with email only. Guest customer record (checkout data) was never consulted.
- **Fix:** create-branch fallback chain: token payload → guest customer record (first_name/last_name/phone, phone normalized to E.164). Existing accounts still untouched.

## B2 — Guest orders not claimed on login (E4 / C6)

- **ID:** B2
- **Status:** fixed (2026-06-11)
- **Symptom:** Registration onto an email with guest orders → login email path → orders never appear in account. Same for "Account detected → log in" from guest order page.
- **Root cause:** transfer loop lived only in activate/confirm; magic-link/exchange (every login) had none.
- **Fix:** extracted `src/utils/claim-guest-orders.ts` → `claimGuestOrders(container, email, customerId)`, called from BOTH activate/confirm and magic-link/exchange. Idempotent — runs on every login, so previously stuck orders self-heal.

## B3 — Dead "confirm transfer" emails on auto-claim

- **ID:** B3
- **Status:** fixed (2026-06-11)
- **Root cause:** `order.transfer_requested` subscriber emailed for every transfer, including our synchronous auto-accept ones.
- **Fix:** auto-claims set `internal_note: "auto_claim_email_verified"` on the order change; subscriber reads internal_note and skips silently. External transfers still email.

## B4 — Stuck transfer (one order failed mid-claim)

- **ID:** B4
- **Status:** fixed (2026-06-11)
- **Fix:** claim util now: per-order try/catch with order_id logging; a stale "requested" transfer change is accepted if its token is valid, otherwise cancelled (`cancelOrderTransferRequestWorkflow`) and re-requested. Retried automatically on next login.

## F1 — "Partially shipped" shown when ALL shipments shipped

- **ID:** F1
- **Status:** fixed (2026-06-11)
- **Root cause:** `isPartial = deliveredCount < totalCount` — true even when 2/2 shipped, 0 delivered.
- **Fix:** `preparingCount`-based logic: partial-shipped only when some shipments haven't left; partial-delivered only when all shipped and some delivered. Tracking URL also sanitized here (absolute http(s) or fallback).

## F2 — Pages render under the fixed header (mobile and desktop)

- **ID:** F2
- **Status:** fixed (2026-06-11)
- **Root cause:** header is `fixed top-0 h-20`; each page compensated individually (or didn't).
- **Fix:** global `h-20` spacer in `(main)/layout.tsx`; home pulls hero under the translucent header with `-mt-20`; per-page compensations trimmed (products/store/categories/collections/lab-results/account-layout).

## F3 — Scroll position carried over between pages

- **ID:** F3
- **Status:** fixed (2026-06-11)
- **Fix:** `ScrollToTop` (was home-only) moved to root layout — window scroll resets on every pathname/searchParams change.

## C5 — Logged-in owner now redirected from /orders/[token] to account order page

- **Status:** implemented (2026-06-11) — email match required; foreign orders still get the masked guest view.

## F4 — Guest order page: flat view + "Shipped" badge on partially shipped order

- **ID:** F4
- **Status:** fixed (2026-06-11)
- **Symptom:** `/orders/[token]` showed simple item list; order with 1 of 2 fulfillments shipped displayed "Shipped"; second fulfillment invisible.
- **Fix (single component rule):** `OrderDetailsTemplate` got `variant: "account" | "guest"` + `footer` slot. Guest variant reuses the SAME warehouse groups / Fulfillments / ShippingDetails / OrderSummary as the account page, hides the back-link and payment internals (PaymentHistory/PaymentDetails/PaymentInstructions), footer hosts the ActivationBlock. Old `order-status-client.tsx` deleted.
- **Backend:** by-token now serves the full order shape: `created_at`, whitelisted `metadata` (tracking, warehouse_items), `shipping_methods`, full `fulfillments` (location_id, items, sanitized labels), masked address (street/phone masked, name kept — token holder is the owner). `fulfillment_status` and `payment_status` are **derived in the route** (query.graph doesn't return the computed fields): partially_shipped/shipped/partially_delivered/delivered; payment from payment_collections statuses. `/orders/lookup` derives the same statuses.

## F5 — Guest order view: shipping cost $0.00, total missing shipping

- **ID:** F5 (same class as A3)
- **Status:** fixed (2026-06-11)
- **Symptom:** guest `/orders/[token]` showed Method "Standart ($0.00)", empty Shipping row, Total = subtotal without shipping. Emails were correct.
- **Root cause:** by-token requested `shipping_methods.name`/`shipping_methods.total` as an explicit subfield list — computed amounts dropped AND the order's own `shipping_total`/`total` computed without shipping.
- **Fix:** request `shipping_methods.*`.
- **Lesson (now twice):** in query.graph always request `.*` for entities with computed/raw amount fields (items, shipping_methods); explicit subfield lists silently break totals.

## F6 — Store credit invisible in order summary + guest "Paid" on unpaid order

- **ID:** F6
- **Status:** fixed (2026-06-11)
- **Symptom (order #1490, $15 store credit):** checkout confirmation correct; order-placed email and account/guest order pages showed Subtotal+Shipping+Tax that didn't add up to Total (credit row missing). Guest page also showed payment "Paid" while admin showed Paid $0 / outstanding $48.
- **Root causes:**
  1. `OrderSummary` component and order-placed email had no credit-line/gift-card rows; component also displayed `order.subtotal` (which includes shipping in Medusa) as "Subtotal".
  2. by-token derived payment status from `payment_collections.status` — it reports "completed" with `captured_amount` set even when `summary.paid_total` is 0 (store-credit checkout). **payment_collections is not a truth source; `order.summary` is** (admin uses it too).
- **Fixes:**
  - `OrderSummary`: Subtotal = `item_subtotal` (items only, like checkout), "Store credit −$X" row from `credit_line_total`/credit_lines, taxes/shipping render $0.00 instead of blank.
  - order-placed email + send-order-confirmation workflow: `credit_line_total`/`gift_card_total` fetched and rendered as −rows.
  - by-token: requests `summary`, derives payment_status from `pending_difference`/`paid_total` (collections only as fallback), returns normalized `summary` → "Balance due" banner works for guests; payment provider ids included and PaymentInstructions now shown to guests awaiting payment.

## B5 — Activation profile chain + address book seeding

- **ID:** B5 (extends B1)
- **Status:** done (2026-06-11)
- Per-field source chain in confirm create-branch: token payload → guest customers (newest first, "latest order wins") → shipping address of the most recent order. Only non-empty values picked — an empty phone on a newer order never clobbers a filled one.
- Shipping address of the latest order is copied into the account address book (`is_default_shipping: true`) — next checkout prefilled.
- Frontend guards: profile Name/Phone render "Add your name"/"Add your phone" instead of "null null"; overview greeting falls back to "there".

## Backlog

- **C6 UI**: third state on token page exists ("Account detected → log in"); order binding after login works via B2. Verify e2e.
- **Account orders list redesign**: smaller thumbnails, status/tracking visible per order without opening details.

## G1 — Gift cards not applicable at checkout (promo field said "invalid")

- **ID:** G1
- **Status:** implemented (2026-06-11)
- **Context:** gift cards come from `@medusajs/loyalty-plugin` — they are NOT promotions. The plugin exposes `POST/DELETE /store/carts/:id/gift-cards` with `{ code }` (no auth — guests can redeem). Applying creates a **credit line** with `reference: "gift-card"` (store credit uses `reference: "store-credit"`), so totals flow through `credit_line_total` like store credit.
- **Implementation:**
  - `lib/data/cart.ts`: `applyGiftCard(code)` / `removeGiftCard(code)` server actions (dead starter stubs removed); cart fetch now includes `*gift_cards`.
  - Promo field (`discount-code` component): tries promotion first, falls back to gift card; "not found" on both → "Invalid promotion or gift card code."; balance/currency errors shown as-is. Applied gift cards listed with 🎁 badge + remove.
  - Display split by credit-line reference everywhere: checkout `CartTotals` ("Gift card −$X" row), order pages `OrderSummary`, order-placed email (workflow fetches `credit_lines.reference/total`), by-token returns `credit_lines`.

## F7 — Gift card total wrong in cart, email, guest view (3 surfaces, 2 causes)

- **ID:** F7
- **Status:** fixed (2026-06-11)
- **Symptoms (order #1491, $115 gift card):** cart total $531 (not reduced); order-placed email total + Cash App "Amount due" $531 with no gift-card row; guest by-token view $531. Checkout confirmation, account page, admin all correct ($416).
- **Causes:**
  1. **Manual totals math** in `checkout-summary` (`correctedTotals` recomputed total and only knew store-credit) — backend `cart.total` is correct and already subtracts ALL credit lines (verified live: 416). Manual recomputation removed; backend value used. **Rule: never recompute totals the backend already computes — use `cart.total` / `order.summary`.**
  2. **Explicit subfield lists, third occurrence (A3/F5 class):** `credit_lines.reference`/`credit_lines.total` in query.graph dropped raw amounts → order total decorator computed 531 and credit-line sums became unparseable. Fixed with `credit_lines.*`; additionally `order.total` now prefers `summary.current_order_total` (backend truth) in by-token and the order-placed workflow.

## G2 — "Activate account" block sent to registered customers

- **ID:** G2
- **Status:** fixed (2026-06-11)
- **Symptom:** logged-in customers placing orders still got "Activate account" in every order email.
- **Fix:** every email sender now checks `listCustomers({ email, has_account: true })` and passes `hasRegisteredAccount` to the template; all 9 templates render `ActivateAccountBlock` only when `!hasRegisteredAccount`. Senders covered: order-placed workflow (token step now returns `{ token, hasRegisteredAccount }`), payment-captured, shipment-created, delivery-created, order-fulfillment-created, order-edit-notification, lookup/send-link, admin send-payment-notification.
- **Bonus:** `payment-notification.tsx` still had the old `/us/account/orders/details/` silent fallback (A1 class) — token made required, fallback removed.
