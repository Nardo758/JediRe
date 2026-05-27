# Session Journal

Ongoing log of session-level findings worth preserving across dispatches.
Entries are appended chronologically. Each entry is self-contained.

---

## Entry 1 — Wave 3 Lessons (2026-05-27)

### Context

Wave 3 dispatches: Tax Gap Remediation verification, OpEx/Batch 1 verification,
f9-financial-export.service.ts:172 cleanup. Two corrections surfaced during verification
that were not anticipated by the dispatch authors.

---

### Lesson 1 — Verification Catches Data-Level Errors in Completed Work

**What happened:**

The Tax Gap Remediation dispatch landed all 5 jurisdiction gaps as "fixed" with high confidence.
The Build-mode bot's state verification confirmed each gap had a corresponding code or prompt change.
The dispatch's own testing section passed.

The Wave 3 verification dispatch caught a numeric error: TN `assessmentRatio` was set to `0.25`
(residential rate) instead of `0.40` (commercial/multifamily rate). This was hidden inside a data
addition that looked structurally complete — the right key existed, the right field was set,
the wrong value was used.

**What would have happened without verification:**

TN tax estimates would have produced values at 62.5% of the correct figure indefinitely. Operators
underwriting TN deals would have modelled materially lower property tax burdens than reality. The
error would not have surfaced until a TN deal closed and the actual tax bill arrived months later.

**Standing lesson:**

P8 verification doesn't just confirm document integrity — it catches data-level errors hidden
inside implementations that look structurally correct. Spot-checks must include sample-level data
validation against authoritative external reference, not just confirmation that "the change
was made."

**For future verification dispatches involving data additions** (new jurisdictions, new line items,
new ratios, new defaults): always include at least one numeric spot-check against an authoritative
external source (state statute, jurisdiction website, reference table). Internal consistency is
necessary but not sufficient.

---

### Lesson 2 — State Verification Catches Dispatch Author Assumptions About Dead Code

**What happened:**

The f9-financial-export.service.ts:172 cleanup dispatch was drafted with the assumption that the
`$350` hardcoded reserves fallback was dead code. The reasoning: Batch 1 wired a three-tier
derivation rule for `replacement_reserves`; therefore the export-path fallback would never fire.

The bot's state verification caught the assumption error: `y1('replacement_reserves')` can still
return `null` for deals underwritten before Batch 1 was deployed. The hardcode protects legacy
deals from null output during F9 Excel export.

**What the correct fix was:**

Not removal, but observability — retain the fallback, add `console.warn` so that when the fallback
fires it is visible in server logs. Operators can then identify which legacy deals need a Batch 1
re-run to produce a properly derived reserves value.

**Standing lesson:**

Dispatch authors (Claude, in this case) can be wrong about what is "dead code" or "safe to
remove." State verification catches these assumption errors before they produce regressions.

Corollary: dispatches that authorize removal of "dead" code should explicitly include "verify
dead-ness" as the first state verification step, with a fallback plan if dead-ness is not confirmed.

For future cleanup dispatches: always frame as **"verify dead-ness THEN remove"** rather than
"remove" with verification as an implicit precondition.

---

### Meta-Observation

Both lessons share a common thread: the bot's state verification discipline catches errors that are
invisible from above. Dispatch authors operate on conceptual models of "what should be true" or
"what's done." The bot operates on what is actually in the code right now.

When these diverge, the bot's view is authoritative. The dispatch gets corrected, not the codebase.

This is exactly the discipline P8's state verification corollary was added to produce. Both
lessons confirm the corollary is working as intended.

---
