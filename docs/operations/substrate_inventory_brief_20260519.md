# Substrate Inventory Brief — Seven Platform Gaps

**Date:** 2026-05-19 | **Task:** #894 | **Method:** Live DB queries + code trace + audit docs

---

## Gap 1 — Deal Capsule Completeness

33 typed `LayeredValue<T>` fields are defined in the blueprint — all 33 pass a smoke-test query. 12 have no UI binding. DB survey of 5 recent deals shows the critical missing writes:

| Field | Populated |
|---|---|
| `source_documents` | 0 / 5 |
| `cie_findings` | 0 / 5 |
| `extraction_t12` | 2 / 5 |
| `extraction_rent_roll` | 2 / 5 |
| `extraction_om` | 1 / 5 |

Per-span page references (doc page, character offset) are absent from the schema entirely — no JSONB key carries them in `deal_data`. Without `cie_findings`, CIE arbitrage (broker vs. platform delta) has no write slot. Without `source_documents`, State A in the Deal Journey cannot cite evidence. The 12 UI-unbound fields are also invisible to the Cashflow Agent prompt builder.

**One-thing-first:** Add `source_documents` and `cie_findings` write paths to the document-extraction pipeline. Effort: S (2 write calls + schema slot documentation, no migration needed).

---

## Gap 2 — Event Wiring

All M35 service files exist. The canonical consumption schema (`key_events + event_forecasts`) is established. What is not wired: 10 ordered dispatches across 128 event-subtype × module cells, per `EVENT_WIRING_SYNTHESIS.md`.

The Cashflow Agent tool (`fetch_m35_event_forecast.ts:112`) still reads from `demand_events` — a legacy table. All 16 M35 event subtypes return nothing to the agent today (EP-02). W-01 fixes one file in ~40 lines and unblocks all 16 cells. W-07 (M14 macro wiring — `rate-environment.service.ts` + `cycle-intelligence.service.ts`) is the other unblocked dispatch; it covers debt and exit timing event awareness. Both W-01 and W-07 are unblocked and have no file collision with other dispatches.

**One-thing-first:** Dispatch W-01 (CA schema repoint). Effort: XS (1 file, 40 lines, leverage = 16 cells).

---

## Gap 3 — Archive Data Depth

Six of the seven relevant archive/benchmark tables are empty. The one exception (`metric_correlations`: 9,831 rows) stores market-level pairwise correlations for F4 display — not per-deal assumption benchmarks.

| Table | Rows |
|---|---|
| `archive_assumption_benchmarks` | 0 |
| `historical_observations` | 0 |
| `deal_historical_outcomes` | 0 |
| `expense_inflation_observations` | 0 |
| `rent_inflation_observations` | 0 |
| `line_item_benchmarks` | 0 |
| `macro_anchor_observations` | 5 |

The F-005 finding from the 464 Bishop diagnostic (2026-05-17) remains representative: 13 of 23 assumptions (56%) rated UNANCHORED with `archive_percentile: null`. Growth assumptions (rent 3%, expense 3%, exit cap 5%) have no cohort baseline. The `historical_observations` rezone corpus schema was extended (Task #763/768) and Phase B engine is live — but corpus is empty, so Phase B falls back to Phase A linear.

**One-thing-first:** Seed `rent_inflation_observations` and `expense_inflation_observations` from Atlanta MSA FRED data + CoStar comps for ≥2 asset classes. Effort: M (data pipeline, 1 submarket to start).

---

## Gap 4 — Historical Correlations

`computePlausibility()` in `sigma-engine.ts` implements Mahalanobis distance but uses a diagonal Σ — each variable treated as independent (line 8: "Phase A uses a diagonal Σ with hardcoded priors. Phase B will replace with empirical estimation."). No stored covariance matrix table exists anywhere in the schema. No `sigma_matrices`, `covariance_matrices`, or equivalent found.

The archive being empty (Gap 3) means no variable history exists to compute correlations from. The 8 highest-leverage pairs to prioritize once corpus clears 30 rows:

1. `rentGrowthY1` ↔ `vacancyAtStabilization` — rent-vacancy inverse drives most IRR variance
2. `exitCapRate` ↔ `rentGrowthStabilized` — cycle co-movement
3. `ltv` ↔ `goingInCapRate` — DSCR constraints bind jointly
4. `capexPerUnitYr1` ↔ `rentGrowthY1` — heavy capex precedes above-market growth bets
5. `leaseUpMonths` ↔ `vacancyAtStabilization` — absorption duration and stabilized occupancy
6. `concessionsPct` ↔ `vacancyAtStabilization` — concessions proxy for demand pressure
7. `interestRate` ↔ `exitCapRate` — cap rate follows rate environment
8. `opexPerUnit` ↔ `expenseGrowthRate` — high-opex assets trend toward higher growth

**One-thing-first:** Add a `sigma_matrices` table with a daily compute job over `rent_inflation_observations` + `deal_historical_outcomes` pairs once corpus clears 30 rows. Effort: S (schema migration + job, no UI needed).

---

## Gap 5 — F9 ProForma Residual

Open findings from prior audits not yet closed:

- **RC-002** (OPEN): `other_income_dollars` key not written by seed — confirmed null in live DB rows.
- **RC-006** (OPEN): Dual engine (PF-01) — `financials-composer.service.ts` (2,543 lines) and `proforma-adjustment.service.ts` (4,931 lines) both serve M09 with no shared contract. A fix to one does not propagate to the other.
- **PF-02** (OPEN): Per-year projection overrides silently revert — `getDealFinancials` re-derives every year from `Y1 × compoundGrowth` on each fetch. The Projections tab is uncovered by prior audits.
- **PF-06** (OPEN): LIUS is 100% orphaned — 21 line schemas (7 OpEx, 7 Capital, 6 Exit, 1 Reserves) are written but `runLIUSEngine` is never called in production. The OpEx, Capital, and Exit tab cells that LIUS was meant to validate are not covered by any audit.
- **PF-13** (OPEN): `concessions = 0` hardcoded in bridge at line 241.
- **proforma_templates** (NOT_WIRED): Full CRUD exists for the `proforma_templates` table but no route applies a template to a deal.
- CS Phase 1 PARTIAL (M36 Phase 2): documented in `deal-journey-framework.md` Section 9 — not a new blocker.

**One-thing-first:** Fix RC-002 (write `other_income_dollars` in seed). Effort: XS (1 function, forceReseed 2 deals).

---

## Gap 6 — Workspace Composability

No `workspace`, `tab_config`, or `layout` tables exist in the DB. The F-key tab structure (F1–F11) is statically defined in `FinancialEnginePage.tsx` at compile time. No per-deal tab ordering, no pinning, no saved operator layouts.

Agent write paths: `deal_assumptions.year1` (via `compute_proforma`), `deals` (via `create_deal_draft`), `deal_versions` (Engine C / LLM path only). No tool writes to a "saved analysis" or comparison layout slot. The Journey overlay (Task #711) is the only cross-tab surface — a modal, not a composable workspace.

Minimum primitives for expansion: (1) a `deal_workspaces` table with per-deal JSON layout blob, (2) a "pin view" write path from agent tools, (3) a frontend slot that renders pinned views as side-by-side panels.

**One-thing-first:** Add `deal_workspaces` table (deal_id, operator_id, layout JSONB, updated_at). Effort: XS (1 migration, no UI yet — table-only unblocks agent writes).

---

## Gap 7 — Broader Goal Seek

F-jgs-1 (5-bundle Pareto frontier via postprocessor) is the entirety of what exists. The solver bisects on LTV only within each debt bundle. 0 live deals carry a populated `pareto_frontier` as of 2026-05-19.

**Smallest meaningful extension (4 variables):** Add `rentGrowthY1`, `vacancyAtStabilization`, and `exitCapRate` to the solver's walk space alongside LTV. All four are in `VARIABLE_META`. The extension replaces the 1D bisection with a 4D coordinate-descent pass per bundle (~20 iterations × 5 bundles = 100 proforma calls, within 30s). This is the minimum that gives the agent operating-lever flexibility beyond pure capital-structure variation.

**Leverage reduced** because Gap 3 (archive empty) means plausibility bounds are heuristic-only and Gap 4 (no empirical Σ) means aggressiveness decomposition is unavailable. Results cannot be validated against cohort history until both substrates exist.

**One-thing-first:** Add `rentGrowthY1` and `exitCapRate` as walked variables in `run_joint_goal_seek.ts` (coordinate descent, 2 additional variables, locked LTV per bundle). Effort: S (solver extension in 1 file, no new tables).

---

## Prioritization Recommendation

**Ship order:**
1. **W-01** (Gap 2) — unblocked, 40 lines, unblocks all 16 M35 cells for the Cashflow Agent. Highest leverage per unit of effort on the platform.
2. **RC-002** (Gap 5) — XS fix, force-reseed propagates immediately, removes a data void in every proforma run.
3. **W-07** (Gap 2) — unblocked merged dispatch, gives debt and exit timing event awareness.
4. **Gap 3 archive seeding** — M effort, but is the substrate blocker for Gaps 4 and 7. Nothing else in the goal-seek or correlation stack can become empirical until corpus exists.
5. **Gap 1 source_documents write path** — S effort, unblocks CIE arbitrage and Deal Journey evidence citations.
6. **Gap 6 deal_workspaces table** — XS migration, unblocks agent write paths for workspace persistence.
7. **Gap 7 solver extension** — after archive seeds (Step 4); extensions without cohort bounds produce heuristic-only plausibility.

---

## I Couldn't Determine

- **Exact row counts for `benchmark_projects`, `insurance_cost_observations`, `tax_assessment_observations`, `m28_historical_events`** — not queried; the six zeroed tables above are the highest-priority archive gaps.
- **Whether `proforma_templates` was ever populated** — `NOT_WIRED` from code trace; no SQL row count was run.
- **`metric_correlations` column schema and submarket coverage** — 9,831 rows confirmed but breakdown by submarket/variable was not pulled; may overlap with what archive seeding would need.

---

## Summary

| Gap | One-thing-first | Effort | Severity |
|---|---|---|---|
| 1 Deal Capsule | Write `source_documents` + `cie_findings` | S | HIGH |
| 2 Event Wiring | Dispatch W-01 (CA schema repoint) | XS | HIGH |
| 3 Archive Depth | Seed `rent_inflation_observations` (Atlanta) | M | HIGH |
| 4 Historical Correlations | Add `sigma_matrices` table + daily job | S | MEDIUM |
| 5 F9 Residual | Fix RC-002 `other_income_dollars` in seed | XS | MEDIUM |
| 6 Workspace | Add `deal_workspaces` table (migration only) | XS | MEDIUM |
| 7 Goal Seek | Add 2 walked variables to solver | S | MEDIUM |
