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
- `metadata.content` is NOT editable in Admin (nested object; the metadata table stores
  primitives only). Edit `content/<handle>.json` (git-committed source of truth), then
  `npx medusa exec ./src/scripts/import-content.ts [handle]`. `export-content.ts` pulls DB
  content back into the folder. Both validate against product-content-schema.ts before
  writing; import merges so other metadata keys (rank/template) survive. Flag is the bare
  token `dry-run`, not `--dry-run` (medusa exec's CLI rejects `--options`). See content/README.md.
  The file may carry a top-level `active_ingredient` string — it is split out into the flat
  `metadata.active_ingredient` (feeds the storefront subtitle), NOT stored inside content.

## Design
- Any UI work happens in the storefront repo. Its design system lives at
  `nutrition_store_front/docs/frontend-design.md` — read it there, not here.