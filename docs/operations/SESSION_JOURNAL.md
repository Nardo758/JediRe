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

## Entry 2 — Valuation Grid Diagnostic Lessons (2026-05-28)

### Context

Valuation Grid v0.1 shipped structurally complete. Every active method returned INSUFFICIENT
when tested. A data-layer surface diagnostic was run to find the root cause.

---

### Lesson 3 — Schema and Database-State References Must Verify Against Actual Table Content

**What happened:**

The Valuation Grid spec referenced three data sources that appeared correct from code inspection:
`sale_comp_sets`, `mv_market_rent_benchmarks`, and `archive_assumption_benchmarks` with cap rate
rows. The implementation was built against these references.

When the diagnostic COUNT queries were run against the live database:
- `sale_comp_sets`: 0 rows
- `mv_market_rent_benchmarks`: view does not exist (query error — relation not found)
- `archive_assumption_benchmarks`: 12 rows, but none with `cap_rate` or `price_per_unit` — only
  `vacancy_pct` and `expense_ratio_pct` rows present

Every active Valuation Grid method returned INSUFFICIENT for this reason, not due to any code bug.

**What would have happened without the diagnostic:**

The Valuation Grid would have been marked as "working" based on passing code review — no crash,
no 500 error — while never producing a real value for any deal. Operators would see INSUFFICIENT
on every method with no actionable path forward and no explanation distinguishing "data gap" from
"feature not implemented."

**Standing lesson:**

Schema references in specs must be verified against actual database content before the spec drives
implementation. Specifically:
- `SELECT COUNT(*) FROM <table>` — confirm rows exist
- `SELECT DISTINCT <key_column> FROM <table>` — confirm the expected rows exist (not just any rows)
- For materialized views: `SELECT matviewname FROM pg_matviews WHERE matviewname = '<view>'`

Code references to data sources (in services, queries, type definitions) are **NOT** evidence that
the sources exist or are populated. They indicate intent at the time they were written, not state.

**For future feature specs:** Include a data-state verification step (COUNT queries, view existence
check) before the implementation dispatch. Flag any "expected but empty" source as a P10 Layer 1 gap.

---

### Meta-Observation (Entry 2)

Entry 2 confirms P10's rationale from a different angle: code-level completeness and data-layer
completeness are orthogonal. A feature can be perfectly wired, crash-free, and have passing code
review while being entirely inoperable because its Layer 1 sources are empty.

The diagnostic discipline (COUNT queries before build dispatches) is the preventive form of Lesson 3.
P10's verification step codifies this as a standing principle.

---
