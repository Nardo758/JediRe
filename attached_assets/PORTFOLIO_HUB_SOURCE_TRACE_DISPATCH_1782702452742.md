# TRACE DISPATCH: what is the Portfolio Hub actually reading? (AUDIT ONLY — answer one question)

The GATE found 2023/2024 tax and Q1 2025 GPR are NULL in `deal_monthly_actuals` where the seeder reads — but the user sees this data in the Portfolio Hub. Both can be true. Either (A) the Hub reads the same rows and the seeder's READ is missing them (a read-path bug like the EGI key mismatch — data present, lookup wrong), or (B) the Hub reads a different/budget source and the gap is real. This decides whether the next step is a one-line read fix or a data upload. **Do not load, ingest, or change anything — trace and report.** STOP at the verdict.

---

## T1 — What does the Portfolio Hub display for the gap months?

For Highlands, the periods the GATE flagged NULL — **property_tax 2023 & 2024, GPR Jan–Mar 2025** — capture what the Portfolio Hub shows:
- The actual values rendered in the Hub for those fields/months. Paste them.
- Are they non-zero, real-looking monthly figures? Or blanks/estimates?

## T2 — Trace the Hub's data source (the decisive step)

Find the component that renders the Portfolio Hub's monthly financials and trace its fetch to ground:
- Which endpoint/query feeds it? `file:line`.
- Which **table** does that endpoint read — `deal_monthly_actuals`, or something else (a different table, a cached/computed view, a direct BPI-package read, an API)?
- If `deal_monthly_actuals`: **what `source` / `is_budget` / `is_proforma` rows does it select?** Does it filter `is_budget=false` like the seeder, or does it show budget/proforma rows too?
- Paste the query/filter the Hub uses, next to the seeder's filter (`is_budget=false AND is_proforma=false`, proforma-seeder lines ~1276/2344). Are they reading the **same** rows or **different** rows?

## T3 — The verdict (one of three)

**(A) READ BUG — data is real and present, seeder isn't reading it.**
Hub reads `deal_monthly_actuals`, the gap-month values are `is_budget=false` real actuals, and they're populated in a column/source the seeder's read misses (wrong column key, wrong source priority, an over-narrow filter — same class as the EGI `egi`≠`effective_gross_income` bug). 
→ Report exactly which column/source holds the real data and why the seeder misses it. **This is a read-path fix, not an upload** — the data's already there. Name the fix (likely a key/column/filter alignment in the seeder's read).

**(B) BUDGET MIRAGE — Hub shows budget, not actuals.**
Hub displays `is_budget=true` (or proforma) rows — the `seed_script` budget data the GATE found and the seeder correctly excludes. The numbers look real but are projections, not operating actuals.
→ The gap is real. The Hub is showing budget. Real actuals genuinely aren't ingested → user upload / re-ingest is the path. Confirm and report what the Hub is actually sourcing so the user knows the Hub's "data" for those months is budget.

**(C) DIFFERENT SOURCE — Hub reads real data from somewhere the seeder doesn't.**
Hub pulls real actuals from a table/view/API the seeder never reads (e.g. a separate financials store). 
→ The data exists and is real, but not where the seeder looks. Report the source and whether it can feed `deal_monthly_actuals` (a load/wiring fix) vs needing upload.

---

## Report

- T1: what the Hub displays for the gap months (pasted values).
- T2: the Hub's source + filter, next to the seeder's, showing same-rows or different-rows.
- T3: verdict A / B / C with the evidence, and the implied next step (read-fix / upload / source-wiring).

**Change nothing.** This is the fork that decides upload-vs-read-fix, and getting it wrong means either uploading data that's already there (masking a read bug) or chasing a read bug for data that isn't there. One trace settles it. STOP after the verdict.

---

**Why this before uploading:** if the Hub proves the real actuals are already in `deal_monthly_actuals` (verdict A), uploading would duplicate present data and leave the actual bug — the seeder's read — unfixed. And if it's budget (verdict B), the user should know the Hub numbers for those months aren't real before treating them as the source. The trace is cheap; guessing wrong is expensive both ways.
