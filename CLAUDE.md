# Onyx Genetics — Medusa backend

E-commerce backend. Medusa v2 + PostgreSQL. Storefront is a separate repo (Next.js).

## Commands
- dev: `npm run dev`
- migrations: `npx medusa db:generate <Module>` then `npx medusa db:migrate`
- scripts: `npx medusa exec ./src/scripts/<name>.ts`
- tests: `npm run test` (unit), see package.json for suites

## Architecture facts (do not violate)
- Module structural reference: `src/modules/magic-token/` — copy its patterns
  (model, service, migrations, hard-delete cron) for any new module.
- Single-use tokens: atomic `UPDATE ... WHERE used_at IS NULL` — TOCTOU pattern,
  reuse for any claim/take semantics (e.g. message_tasks take).
- Emails: Resend module (`src/modules/resend/service.ts` = template map + subjects),
  React Email templates in `src/modules/email-notifications/templates/`.
- order_view tokens are generated INSIDE email-sending subscribers — raw token
  exists only at generation time (DB stores sha256). Never try to "look up" a raw token.
- Bot-facing endpoints: auth via `x-bot-api-key` header, constant-time compare.
- Raw customer phones never leave Medusa except inside task payloads to the bot.
- Customer-facing pages live in the storefront repo under `[countryCode]/(main)/`.

## Project docs
- Active spec: `docs/post-purchase-tech-spec.md` (staged, with acceptance tests).
  Read only the stage you're working on + "Global rules" section.
- Stage journal: `HANDOFF.md` — append a stage note after every completed stage.

## Conventions
- New env vars: add to `.env.template` and list in the report.
- Public store endpoints (no customer auth) must be explicitly excluded from
  auth middleware; publishable key stays required.

- Two product templates (compound/peptide) derived from root category; product content is
  schema-validated JSON in metadata.content + shared contentBlocks[]. See
  docs/storefront-redesign-tech-spec.md. No external CMS.
- Manual product display order: metadata.rank (number). Lower = higher in listings. Use
  multiples of 10 (10, 20, 30…) to allow inserting between two without renumbering. Missing
  or non-numeric rank is treated as 9999 (sorts last). Enforced storefront-side in
  nutrition_store_front/src/lib/util/sort-products.ts (sortByRank).
- Restock estimate: variant.metadata.restock_eta (string, optional). Either an ISO date
  ("2026-07-20") or free text ("~2 weeks"). Only read when the variant is out of stock.
  Storefront renders it via resolveStockState/formatRestockEta in
  nutrition_store_front/src/lib/util/resolve-stock-state.ts.