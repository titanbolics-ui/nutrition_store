# Technical Specification — Post-Purchase Communication System

Spec for AI-assisted implementation. Work through stages **in order** — each stage has acceptance tests that must pass before moving to the next. Do not start a stage until the previous stage's tests are green.

---

## Context

**Repo 1 — Medusa backend** (`nutrition_store`): Medusa v2, PostgreSQL. Existing relevant modules:
- `src/modules/magic-token/` — token module with `generateToken`/`verifyToken`, atomic single-use via `UPDATE ... WHERE used_at IS NULL`, hard-delete cron. **Use this module as the structural reference for new modules.**
- `src/modules/resend/` — notification provider, template map + subjects in `service.ts`, React Email templates in `src/modules/email-notifications/templates/`.
- Existing emails: order-placed, order-edit-confirmed, order-edit-requested, payment-notification, order-fulfilled, order-view-link, activate-confirm, register-confirm, magic-link-login. Order emails carry order_view token links (`${FRONTEND_URL}/orders/${token}`); tokens are generated inside the email-sending subscribers (raw token only exists at generation time).

**Repo 2 — WhatsApp bot** (`onyx-wa-bot`, Python): scheduler with 3 jobs (`run_cycle` 15m, `flush_queue` 1m, `sync_posthog` 5m). Own SQLite `agent.db` (leads keyed by `phone_hash` = sha256 of E.164 digits — **raw phones are never persisted there**), `send_queue` with randomized `scheduled_at`, intent classifier (Ollama qwen2.5:3b), reply policy gates, DRY_RUN mode.

**Repo 3 — Go bridge** (`whatsapp-bridge`, whatsmeow): live WA session, `POST /api/send {recipient, message}`, writes `messages.db` (read-only for Python).

**Frontend** (`nutrition_store_front`): Next.js starter, pages under `[countryCode]/(main)`.

## Global rules (apply to every stage)

1. Never break existing flows. All changes additive; existing tests/behavior intact.
2. All new outbound messaging must respect: DRY_RUN in the bot; daily send window 10:00–20:00 recipient-local (by phone country code, fallback US/Eastern); never message a lead with status HUMAN_REVIEW or an inbound message newer than the trigger event.
3. Raw phone numbers may transit Medusa→bot in task payloads but must never be persisted in `agent.db` (hash only, existing pattern).
4. Every new endpoint that the bot calls is authenticated via header `x-bot-api-key` checked against env `BOT_API_KEY`. Constant-time comparison.
5. New tables via Medusa module migrations, modeled after `magic-token`.
6. All timestamps UTC in DB; convert to recipient-local only for send-window logic.
7. Secrets/config via env vars; list every new var in the stage notes and add to `.env.template`.

---

## Stage 0 — Phone normalization (Medusa)

**Goal:** every customer phone stored as E.164; future writes normalized at the source.

**Deliverables:**
1. `src/utils/phone.ts` — `normalizePhone(raw: string, defaultCountry?: string): string | null` using `libphonenumber-js`. Rules: strip junk; leading `+` or `00` → parse international; otherwise parse with `defaultCountry`; return E.164 or null.
2. One-off migration script `src/scripts/normalize-phones.ts` (runnable via `npx medusa exec`):
   - For each customer with a phone: defaultCountry = shipping address country_code of their most recent order (fallback: none → international parse only).
   - Valid → write back E.164. Invalid → leave untouched, append to report `phone-normalization-report.json` { customer_id, email, raw_phone, reason }.
   - Idempotent: running twice produces no further changes.
3. Apply `normalizePhone` at write points: registration request route (replace the existing ad-hoc normalizer with this util) and checkout/order-completion path (subscriber or existing hook — find where customer phone is persisted and normalize there).

**Acceptance tests:**
- Unit: `normalizePhone("+49 (151) 234-56-78") === "+491512345678"`; `normalizePhone("0151 2345678", "DE") === "+491512345678"`; `normalizePhone("(555) 123-4567", "US") === "+15551234567"`; `normalizePhone("garbage") === null`; `normalizePhone("00491512345678") === "+491512345678"`.
- Script: seed 3 customers (one clean, one messy-with-DE-order, one garbage) → run → first two E.164 in DB, third unchanged and present in report. Run again → zero changes.
- E2E: register with messy phone via the form → DB stores E.164.

---

## Stage 1 — Delivery statistics script (read-only, no sends)

**Goal:** real transit numbers from the last ~100 delivered shipments to power email copy (Stage 3) and replenishment math (Stage 7).

**Deliverables:** `src/scripts/delivery-stats.ts` — input: CSV or JSON of {tracking_number, label_created_at, delivered_at} exported from the current tracker (manual export is fine; do NOT build a scraper). Output (stdout + JSON file): count, p50, p80, p95 of label→delivered days, grouped by destination country if available, else overall.

**Acceptance tests:**
- Fixture of 10 synthetic records with known durations → script prints p50/p80 matching hand-computed values.
- Handles missing/invalid dates by skipping with a warning count, not crashing.

---

## Stage 2 — 17track integration + Delivered email (Medusa)

**Goal:** automatic `delivered_at` and a delivery confirmation email.

**Deliverables:**
1. `src/modules/tracking/` (or service in existing structure): `register(trackingNumber, carrierCode)` → POST to 17track register API. Called from the existing fulfillment/shipment flow where tracking numbers are saved. Carrier code passed **explicitly** (config map per supplier/route in env or settings, not auto-detect). Skip registration if the tracking number was already registered (idempotency flag in fulfillment metadata).
2. Webhook endpoint `POST /hooks/17track` — validates 17track signature (per their docs; reject if invalid), parses status events. On Delivered: write `delivered_at` ISO timestamp into the fulfillment's metadata (only if not already set), emit internal event `delivery.confirmed { order_id, fulfillment_id, delivered_at }`.
3. Subscriber on `delivery.confirmed` → sends new email template `order-delivered`:
   - Subject neutral: `Your order #<display_id> has been delivered 📦`
   - Body: delivered confirmation, order_view token button (generate token in this subscriber, same pattern as other order emails), "check mailbox/porch/neighbors — carriers sometimes mark delivery early", contact path (reply or WhatsApp link). **No item list** (discretion requirement).
4. Quota guard: only register fulfillments created after this feature ships; log registrations count.

**Env vars:** `SEVENTEENTRACK_API_KEY`, `SEVENTEENTRACK_WEBHOOK_SECRET`, `CARRIER_CODE_DEFAULT` (+ optional per-route map).

**Acceptance tests:**
- Unit: webhook handler with valid signature + Delivered payload → delivered_at set once; second identical webhook → no change, no duplicate email (idempotent).
- Webhook with invalid signature → 401, nothing written.
- Webhook with non-Delivered status → 200, no delivered_at, no email.
- Integration (mock 17track): mark fulfillment shipped → register called exactly once with explicit carrier code; re-save → not called again.
- E2E (manual, one real shipment): full cycle shipped → webhook → delivered_at in DB → email received, token link opens order page.

---

## Stage 3 — Expectation copy in shipping emails (Medusa)

**Goal:** answer "how long will it take" before the customer asks.

**Deliverables:**
1. `order-fulfilled` (fulfillment created) email: add line "Tracking number arrives within 5–7 days. Total delivery typically takes <X>–<Y> weeks door to door." X/Y from env `DELIVERY_ETA_WEEKS_MIN/MAX` seeded from Stage 1 stats.
2. Shipped/tracking email: compute date range `[ship_estimate + p50_days, ship_estimate + p80_days]` where `ship_estimate = tracking_date - SHIP_LAG_DAYS` (env, default 4 — package physically ships 3–5 days before tracking appears). Render as "Expected delivery: around Jun 25 – Jul 2". Constants `TRANSIT_P50_DAYS`, `TRANSIT_P80_DAYS` from env, seeded from Stage 1.

**Acceptance tests:**
- Unit: date-range helper with fixed inputs → correct formatted range; month/year boundary cases (Dec 28 + 10 days → "around Jan 4 – ...").
- Snapshot: both templates render the new copy; no other template changed.

---

## Stage 4 — Task queue module + endpoints (Medusa)

**Goal:** the transport layer: Medusa decides WHAT/WHO, bot or Resend executes.

**Deliverables:**
1. Module `src/modules/message-tasks/`, table `message_task`:
   `id, type (delivery_checkin|replenishment), channel (whatsapp|email), status (pending|taken|sent|skipped|failed), customer_id, order_id NULL, phone_e164 NULL, email NULL, payload jsonb, not_before, taken_at NULL, sent_at NULL, skipped_reason NULL, attempts int default 0, created_at`. Indexes: (status, channel, not_before), customer_id.
2. Channel resolution helper `resolveChannel(customer)`: valid E.164 phone AND customer.metadata.wa_status === 'confirmed' → whatsapp; valid phone AND wa_status unset/'unknown' → whatsapp (optimistic, bot verifies); no valid phone OR wa_status === 'not_on_wa' → email.
3. `POST /bot/tasks/take` (x-bot-api-key): body `{ channel: "whatsapp", limit }`. Atomic claim: `UPDATE ... SET status='taken', taken_at=now() WHERE id IN (SELECT id FROM message_task WHERE status='pending' AND channel='whatsapp' AND not_before <= now() ORDER BY not_before LIMIT $limit FOR UPDATE SKIP LOCKED) RETURNING *`. Two concurrent calls never return the same row.
4. `POST /bot/tasks/:id/report` (x-bot-api-key): body `{ status: sent|skipped|failed, reason?, wa_status? }`. Updates task; if `wa_status` present → cache into customer.metadata; if reason === 'no_whatsapp' → create a NEW task, same type/payload, channel=email, not_before=now.
5. Scheduled job `email-task-sender` (every 5 min): claims pending email-channel tasks (same atomic pattern), sends via Resend using a per-type template, marks sent/failed.
6. Scheduled job `requeue-stale-tasks` (every 15 min): status='taken' AND taken_at < now()-1h → back to pending, attempts+1. attempts >= 3 → status='failed'.

**Env vars:** `BOT_API_KEY`.

**Acceptance tests:**
- Concurrency: seed 5 pending tasks, fire two parallel `take(limit=5)` → union of results = 5 tasks, intersection = empty (run 20 iterations).
- `take` ignores not_before in the future and non-matching channel.
- Report `sent` → status flips, sent_at set. Report with `wa_status: 'confirmed'` → customer metadata updated.
- Report `skipped/no_whatsapp` → original task skipped AND a new email task exists with same payload.
- Stale: taken task with taken_at 2h ago → requeue job returns it to pending, attempts=1; after 3 cycles → failed.
- Auth: missing/wrong x-bot-api-key → 401 on both endpoints.
- Email job: pending email task → Resend called (mock), task sent.
- `resolveChannel` with a raw-stored invalid phone (non-E.164, kept as entered by Stage 0) → returns `"email"`.

---

## Stage 5 — Bridge check endpoint + bot poller (Go bridge + Python bot)

**Goal:** bot pulls tasks, verifies WhatsApp, sends through its existing queue, reports back.

**Deliverables:**
1. Go bridge: `GET /api/check?phone=E164` → whatsmeow IsOnWhatsApp → `{ "on_whatsapp": true|false }`. No batch endpoint (deliberate — lazy checks only).
2. Bot: 4th scheduler job `poll_medusa_tasks()` every 5 min:
   - `POST {MEDUSA_API}/bot/tasks/take { channel: "whatsapp", limit: 10 }` with API key.
   - Per task: if payload.wa_status !== 'confirmed' → bridge `/api/check`; not on WA → report `{status:'skipped', reason:'no_whatsapp', wa_status:'not_on_wa'}`, done. On WA → include `wa_status:'confirmed'` in the eventual report.
   - **Dedup gates (before scheduling, re-checked at flush):** (a) any inbound message from this phone_hash with timestamp > task trigger time (payload.trigger_at) → report skipped `customer_initiated`; (b) lead status HUMAN_REVIEW → skipped `human_review_active`; (c) a task of the same type for the same order already sent (local ledger) → skipped `duplicate`.
   - Passed gates → render template by task type (see Stage 6/7 texts) → insert into existing `send_queue` with scheduled_at = random within the next valid send-window slot (10:00–20:00 recipient-local by phone country code); store task_id on the queue row.
   - On flush success → existing outbound ledger/event flow runs + report `{status:'sent', wa_status:'confirmed'}` to Medusa. On flush failure after retries → report failed.
3. flush_queue upgrades: retry failed sends (max 3 attempts, exponential backoff ≥10 min) — applies to all queue items, not only Medusa tasks; respect send window for task-originated rows.
4. Raw phone from payload used for JID + check only; persist hash per existing pattern.

**Env vars (bot):** `MEDUSA_API_URL`, `MEDUSA_BOT_API_KEY`.

**Acceptance tests:**
- Bridge: check with a known-WA number → true; a landline → false; malformed → 400. (Manual, live session.)
- Bot unit (mock Medusa + bridge): task with wa_status unknown + check true → send_queue row created within send window, report contains wa_status confirmed.
- Check false → no send_queue row, skipped/no_whatsapp reported.
- Dedup: insert inbound message newer than trigger_at → skipped/customer_initiated. Lead in HUMAN_REVIEW → skipped. Same task type+order already sent → skipped/duplicate.
- Send window: task taken at 23:00 recipient time → scheduled_at falls inside next day 10:00–20:00.
- Retry: simulate bridge 500 → row retried with backoff, max 3, then failed + reported.
- DRY_RUN=true → full pipeline runs, report says sent, no real HTTP send.
- Crash safety: kill bot after take, before report → Medusa requeue job recovers the task within ~1h (joint test with Stage 4).

---

## Stage 6 — Delivery check-in (Medusa task creation)

**Goal:** human-feeling "did it arrive ok?" 1–2 days after delivery.

**Deliverables:**
1. Extend the `delivery.confirmed` subscriber (Stage 2): after the email, create message_task `{ type:'delivery_checkin', channel: resolveChannel(customer), not_before: delivered_at + random(24h, 48h), payload: { first_name, order_display_id, trigger_at: delivered_at, wa_status } }`. One per order (skip if a checkin task for this order exists).
2. WhatsApp text (bot templates.py): `Hey {first_name}! Tracking shows your package landed — everything arrive okay? Any questions about what you got, I'm here 🤙` Email variant (Resend template `delivery-checkin`): same message, neutral subject `Quick check-in on your order`.

**Acceptance tests:**
- Delivered webhook → exactly one checkin task; replayed webhook → still one.
- not_before within [delivered_at+24h, delivered_at+48h].
- Customer with no valid phone → channel=email; email job sends template.
- Full joint test (staging, DRY_RUN): webhook → task → bot takes → gates pass → scheduled → "sent" report → task closed.
- Reply routing (manual): respond to a real check-in with a complaint-like message → classifier routes to human review (existing pipeline, just verify).

---

## Stage 7 — Replenishment reminders

**Goal:** be present at the moment the supply runs out.

**Deliverables:**
1. Script `src/scripts/reorder-intervals.ts`: per product — median days between consecutive purchases by the same customer (min 3 pairs to qualify). Output report; write qualifying medians to product metadata `reorder_days`. Products below data threshold: leave for manual entry via admin.
2. Daily job `replenishment-scan` (after delivered data exists):
   - For each delivered order item where product has reorder_days: due_at = delivered_at + reorder_days * 0.8.
   - Guards, ALL must pass: due_at <= today; no newer order by this customer containing this product; no open (incomplete) order by this customer; no proactive task (any type) sent to this customer in the last 14 days; customer not in stop-list (customer.metadata.no_proactive !== true); no pending/taken replenishment task for this customer.
   - One task per customer per scan even if multiple products due (pick the earliest due). Payload: { first_name, product_title, trigger_at: now }.
3. Stop-list mechanics: bot — new intent handling: any opt-out-like inbound ("stop", "не пиши", classifier intent or keyword fallback) → report to a new Medusa endpoint `POST /bot/customers/opt-out { phone_e164 }` (x-bot-api-key) → sets no_proactive=true. Also settable manually in admin.
4. WhatsApp text: `Hey {first_name}! By my math your {product_title} supply might be running low — just a heads up if you want to restock. No rush 🤙` Email variant template `replenishment-reminder`.

**Acceptance tests:**
- Intervals script: synthetic history (customer A buys product X on days 0/60/120) → median 60 → metadata written. Product with 1 purchase pair → not written, listed in report.
- Scan guards (unit, one test per guard): newer order with same product → no task; open order → no task; task 10 days ago → no task; no_proactive → no task; two products due → exactly one task.
- Scan idempotent: run twice same day → no duplicate tasks.
- Opt-out: POST opt-out → metadata set → next scan produces no task for that customer.
- Joint (DRY_RUN): seed delivered order with reorder_days=10, delivered_at=9 days ago → scan creates task → bot pipeline to "sent".

---

## Stage 8 — Measurement (PostHog)

**Goal:** conversion per message type as a number, not a feeling.

**Deliverables:**
1. Medusa emits PostHog events on task lifecycle: `proactive_message_sent` / `_skipped` (with reason) / `_failed`, properties: type, channel, order_id, customer distinct_id (reuse existing PostHog identity conventions; never raw phone).
2. `proactive_message_converted`: scheduled job correlates — order placed by the same customer within 7 days after a sent task → emit once per task.
3. Dashboard spec (PostHog insights, manual setup checklist in README): funnel sent→converted per type; skip-reason breakdown; weekly volume.

**Acceptance tests:**
- Mock PostHog capture: task sent → event with correct props; skipped → reason present.
- Conversion job: sent task + order 3 days later → converted event exactly once; order 10 days later → none; rerun → no duplicate.
- No event payload contains a raw phone (assert in tests).

---

## Rollout order & gates

```
0 (phones) → 1 (stats) → 2 (17track) → 3 (copy)
                              ↓
                  4 (queue) → 5 (bot poller) → 6 (check-in)
                              ↓
                  7 (replenishment) ← requires 1 + delivered data
                              ↓
                  8 (measurement)  ← build alongside 5–7
```

Gate to production per stage: all acceptance tests green + one manual smoke in DRY_RUN (where sends are involved) + stage notes appended to HANDOFF.md in the respective repo. Stages 5–7 run a minimum of 3 days in DRY_RUN observing logs/dashboard before flipping live.