# SPEC — MULTI-YEAR HISTORY CAPTURE (Stub)

**#6 of 6. Type: design stub (author now, flesh out at build; partly shaped by OM spec #5). No gate.**
**Problem (from audit Part D):** the Periodic Timeline's actual-zone consumes UP TO 60 months of history (Highlands = 53 months; hybrid-actuals ≤60mo merge rule). Extraction captures the summary T-12 (WORKS) but SILENTLY DROPS multi-period depth: BPI multi-period packages stub at `data-router.ts:540` (single `report_month` target); OM financial-appendix history not captured (extraction grabs only forward-looking broker pro forma). Result: a deal with 3 years of monthly history in its documents renders an empty or shallow actual-zone.

## Goal
Capture temporal DEPTH — 2-5 years of monthly actuals where documents provide it — landing month-keyed in `deal_monthly_actuals`, correctly origin-tagged, feeding the ribbon's actual-zone.

## Scope (to detail at build)
1. **BPI multi-period fix (`data-router.ts:540` stub):** the single-`report_month` target must accept a series — iterate the package's periods, write one `deal_monthly_actuals` row per month, not one row for the latest.
2. **OM historical-financials capture:** receive the `financials_historical` pages the OM Extraction spec (#5) classifies and routes; extract the monthly/annual series; land month-keyed. (This is the dependency on #5 — it produces the pages, this consumes them.)
3. **Month-keying + origin discipline:** every historical row keyed to its actual calendar month, tagged with correct origin_class (QW-2 column) and `document` provenance. No collapsing a 36-month series into one period.
4. **Merge with the ≤60mo hybrid rule:** captured history feeds the existing actual/gap/projection zone logic — respect the 60-month window and the boundary-derived-not-stored rule.
5. **Dedup/overlap handling:** if a T-12 and a historical package overlap months, one source wins per a stated rule (freshest? most-granular?) — define at build.

## Silent-drop guard (the acceptance heart)
Acceptance must prove: a document carrying N months of history produces N month-keyed `deal_monthly_actuals` rows, not 1. The exact failure the audit found (summary captured, series dropped) must be impossible — a test with a known multi-period fixture asserting row count == month count.

## Dependencies
- **QW-2** (origin_class column) — for correct row tagging.
- **OM Extraction (#5)** — produces the `financials_historical` pages this consumes; build #5 first or co-design.
- **CREATE-1** — deals must materialize before history seeds them.
Build-order: after #5 (OM classification) at minimum for the OM path; the BPI-stub fix (scope item 1) is independent and could ship earlier as its own quick win if the BPI path has active data.
