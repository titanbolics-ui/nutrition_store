---
description: Implement one stage from the storefront redesign spec
---
Implement Stage $ARGUMENTS from docs/storefront-redesign-tech-spec.md.

Process:
1. Read ONLY: the "Global rules" section + the Stage $ARGUMENTS section. Not other stages.
2. If this stage involves a DATA MIGRATION (variant or category changes) or destructive
   DB work:
   - FIRST state the backup command and the restore/rollback command, and confirm the
     backup is restorable, BEFORE any migration code runs.
   - For variant consolidation: produce the duplicate-grouping as a report and STOP for my
     approval before merging anything.
3. If this stage involves VISUAL work: read /mnt/skills/public/frontend-design/SKILL.md
   first. Keep the brand (near-black + acid-green); do not redesign identity.
4. If this stage involves the CALCULATOR: implement the exact formulas from the spec, write
   the unit tests with the worked examples, and cover the guard rails (div-by-zero,
   dose>syringe, non-numeric).
5. Enter plan mode: show files, schema/migration/grouping, and the test plan. Wait for
   approval.
6. Implement. Write the acceptance tests from the spec; for data migrations, test on a
   RESTORED COPY of real data, not fresh seed.
7. Honesty check before finishing: no fake COA/batch, no faked stock, no invented purity,
   no "Conclusion" sections, optional sections hidden when data absent.
8. Standard report + append a stage note to HANDOFF.md. Do not commit or push.