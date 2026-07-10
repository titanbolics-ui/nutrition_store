---
description: Implement one stage from the post-purchase tech spec
---
Implement Stage $ARGUMENTS from docs/post-purchase-tech-spec.md.

Process:
1. Read ONLY: the "Global rules" section + the Stage $ARGUMENTS section of the spec.
   Do not read other stages.
2. Check HANDOFF.md stage journal: confirm the previous stage is marked done.
   If not — stop and ask.
3. Enter plan mode. Present: files to create/change, migration needs, test plan.
   Wait for approval.
4. Implement. Write the acceptance tests from the spec as runnable tests where
   the stack allows; otherwise provide exact manual reproduction steps.
5. Run the tests. Fix until green.
6. Produce the standard report (format from global CLAUDE.md) and append a
   stage note to HANDOFF.md.