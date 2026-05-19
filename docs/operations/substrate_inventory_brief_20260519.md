# Substrate Inventory Brief — Seven Platform Gaps

**Date:** 2026-05-19  
**Task:** #894  
**Method:** Live DB queries + static code trace + existing audit docs  
**Status:** Read-only inventory. No code changes.

---

## Gap 1 — Deal Capsule Completeness

**What the blueprint says:** 33 typed `LayeredValue<T>` fields are defined in `deal-capsule-blueprint.md`. All 33 pass a smoke-test query (field keys exist in the schema). The blueprint also lists 12 fields as having no UI binding.

**What the DB shows:** Queried the 5 most recent non-deleted deals.

| Field | Populated deals |
|---|---|
| `source_documents` | 0 / 5 |
| `cie_findings` | 0 / 5 |
| `extraction_t12` | 2 / 5 (464 Bishop, Sentosa) |
| `extraction_rent_roll` | 2 / 5 |
| `extraction_om` | 1 / 5 (464 Bishop only) |

`source_documents` and `cie_findings` are blueprint slots that have never been populated on any live deal. Per-span page references (doc page number, character span) are absent from the schema — no column or JSONB key carries them in `deal_data`. The 12 UI-unbound fields cannot be surfaced to the operator and are invisible to the Cashflow Agent prompt builder.

**Blocking consequence:** State A in the Deal Journey cannot cite its evidence source. DQA findings (present in `data_quality_alerts`) cannot be linked back to the originating document location. CIE arbitrage (flags where broker assumptions deviate from platform readings) has no stored output slot.

---

## Gap 2 — Event Wiring

**What exists:** All M35 service files ship (`m35-events`, `m35-forecast`, `m35-backtest`, `m35-impact`, `m35-causality`, `m35-playbook`, `m35-traffic-api`). The `key_events` + `event_forecasts` schema is the canonical consumption path (established in `EVENT_PROPAGATION_AUDIT.md` Section 11).

**What is not wired:** The consolidated backlog in `EVENT_WIRING_SYNTHESIS.md` identifies 10 ordered dispatches (W-01 through W-10) across 128 event-subtype × consumer-module cells.

| Dispatch | Target | Status |
|---|---|---|
| W-01 | CA tool: `demand_events` → `key_events + event_forecasts` repoint | UNBLOCKED (leverage 16.0 — all 16 CA M35 cells) |
| W-02 | LIUS trajectory: replace hardcoded `−0.0025` + `window_months → hold_year` bridge | UNBLOCKED Phase A |
| W-03 | M07 M35 ingestion: baseline exclusion window in calibration job | ADJACENT to TE FIX-1 (dispatched) |
| W-04 | M09 proforma: `rent_control_passage` + `tax_abatement` event blocks | INDEPENDENT |
| W-05 | M25 JEDI score: supply score reads `event_forecasts JOIN key_events` | ADJACENT to TE FIX-4 |
| W-07 | M14 macro wiring: merged EP Fix 7 + CE-03 (`rate-environment`, `cycle-intelligence`) | UNBLOCKED (2 files, 1 dispatch) |
| W-09 | ExitCapitalModule: replace 21-year hardcoded arrays with live trajectory | STACKED on W-02 |
| W-10 | CE-12 RSS: supply/buyer pressure M35-aware | ADJACENT to TE FIX-4 |

Until W-01 lands, the Cashflow Agent has zero working M35 event access. Until W-02 lands, the exit cap trajectory is a hardcoded constant (`−0.0025`) regardless of the event pipeline.

---

## Gap 3 — Archive Data Depth

**What the schema implies:** 15 tables carrying historical, benchmark, or observation data exist in the DB.

**What those tables actually contain:**

| Table | Row count |
|---|---|
| `archive_assumption_benchmarks` | **0** |
| `historical_observations` | **0** |
| `deal_historical_outcomes` | **0** |
| `expense_inflation_observations` | **0** |
| `rent_inflation_observations` | **0** |
| `line_item_benchmarks` | **0** |
| `macro_anchor_observations` | 5 |
| `metric_correlations` | 9,831 |

`metric_correlations` carries market-level F4 signal correlations (submarket ↔ submarket), not per-deal assumption benchmarks. `macro_anchor_observations` has 5 rows (macro-level anchor data). Every table that would provide per-deal, per-assumption-variable cohort benchmarks is empty.

**Operational consequence (from cashflow diagnostic F-005):** On the 464 Bishop deal, 13 of 23 assumptions (56%) were rated tier4/UNANCHORED with `archive_percentile: null` for every field. Growth assumptions (rent 3%, expense 3%, exit cap 5%) had no cohort baseline. The platform cannot anchor any agent assumption to historical actuals until these tables are populated.

`historical_observations` has schema columns added for Phase B rezone calibration (Task #763/768), but 0 rows — Phase B engine is live and waiting, corpus is empty.

---

## Gap 4 — Historical Correlations

**What exists:** `metric_correlations` has 9,831 rows — these are market-level pairwise correlations used by F4 (signal display and staleness detection). `spatial_correlations` and `traffic_correlation_signals` tables also exist.

**What does not exist:** No stored per-bundle covariance (Σ matrix) in any DB table. The sigma engine (`backend/src/services/sigma/sigma-engine.ts`) implements `computePlausibility()` using Mahalanobis distance, but the comment at line 9 reads: "Phase B will replace with empirical estimation." The current Σ is hand-calibrated heuristic values baked into the service file. No `sigma_matrices`, `covariance_matrices`, or equivalent table was found.

**Consequence for M36:** The plausibility scores assigned to Pareto frontier bundles are computed against a heuristic Σ, not an empirical one derived from comparable-deal distributions. The per-variable contribution decomposition (`mahalanobisD`, `perVariableContribution`) is PENDING — only the heuristic band label (`Realistic / Stretch / Aggressive / Heroic`) ships with Phase 1.

---

## Gap 5 — F9 ProForma Residual

**Open items identified across prior audits:**

| Finding | Status |
|---|---|
| RC-002: `other_income_dollars` key missing in seed output | OPEN — confirmed null in live DB sample rows |
| RC-006: Dual engine (PF-01) — `financials-composer` + `proforma-adjustment` both claim M09 | OPEN — two 2,500–4,900 line services with overlapping responsibility |
| S1-01: Custom opex filter gap (12 revenue lines leaking into opex) | CLOSED 2026-05-09 |
| S1-03: GPR T-12 priority | VERIFY_NEEDED (both live deals show correct state) |
| S1-05: IC-04 tax tie-break | MONITOR (no live deal affected) |

**Pareto frontier population:** Queried `deal_assumptions.year1->'capital_structure'->'optimization'->'pareto_frontier'` on the 3 most recent deals with `year1`. All three returned `null`. The F-jgs-1 postprocessor (shipped 2026-05-19) writes to this path after every cashflow run — but no cashflow run has been executed since the postprocessor landed.

---

## Gap 6 — Workspace Composability

**DB findings:** Zero tables named `workspace`, `tab_config`, `layout`, or any variant. No per-deal tab configuration is persisted.

**Code findings:** The F-key tab structure (F1 Overview through F11 Tools) is statically defined in `FinancialEnginePage.tsx`. Tab IDs and render order are compile-time constants. There is no mechanism for a deal to request a different tab set, reorder panels, pin views, or save a per-operator layout. The Journey overlay (Task #711) is the only cross-tab surface added since the static structure was established, and it is a modal, not a composable workspace component.

**Consequence for Goal Seek presentation:** When the Pareto frontier produces 5 bundles representing different capital structure / assumption postures, there is no workspace surface where the operator can compare bundles side-by-side, pin a specific bundle's projections alongside a baseline, or save a "what-if" layout. Results are presentable only within the existing tab sequence.

---

## Gap 7 — Broader Goal Seek

Gap 7 differs from Gaps 1–6: the concern is not current-state mapping but substrate dependency. The question is "what must exist before full goal-seek is meaningful?"

**What shipped (F-jgs-1):** A 5-bundle Pareto frontier postprocessor fires as a fallback after every cashflow run. Bundles are role-sorted deterministically from `investors.type`. Per-bundle plausibility scores are computed using the heuristic Σ. Output path: `proforma.capital_structure.optimization.pareto_frontier`. As of 2026-05-19, 0 live deals carry a populated frontier (postprocessor has not yet fired on a real cashflow run).

**Substrate dependencies for full goal-seek:**

| Substrate | Current state | Required for |
|---|---|---|
| Gap 3: archive benchmarks | 0 rows | Goal-seek bounds validation — cannot confirm a proposed bundle is within historical norms for the deal's asset class / market tier |
| Gap 4: empirical Σ matrix | Heuristic only | Mahalanobis distance is unreliable until Σ reflects actual assumption covariance from comparable deals; aggressiveness decomposition is PENDING Phase 2 |
| Gap 2: M35 event wiring (W-01, W-02) | Unbuilt | Goal-seek bundles cannot incorporate event-adjusted exit cap or absorption trajectories without W-02; agent tool cannot read any M35 signal without W-01 |
| Gap 6: workspace composability | Static tabs only | Operator cannot compare frontier bundles in a structured surface; results are surfaced via the JOURNEY overlay at best |

Full goal-seek — where the agent proposes bundles anchored to historical cohort bounds, plausibility-scored against an empirical Σ, event-adjusted, and presentable as a composable side-by-side — requires all four substrates. The current state delivers the frontier computation skeleton with heuristic scoring.

---

## Summary Table

| Gap | Key evidence | Severity |
|---|---|---|
| 1 — Deal Capsule | `source_documents` + `cie_findings` 0/5 deals; 12 fields UI-unbound | HIGH |
| 2 — Event Wiring | W-01 unblocked (16.0 leverage); CA has zero M35 access today | HIGH |
| 3 — Archive Depth | 6 benchmark tables at 0 rows; 56% assumptions unanchored (F-005) | HIGH |
| 4 — Historical Correlations | 9,831 market correlations; 0 stored Σ; heuristic Phase A only | MEDIUM |
| 5 — F9 Residual | RC-002 `other_income_dollars` null; RC-006 dual engine; pareto 0 deals | MEDIUM |
| 6 — Workspace | No tab config tables; F1-F11 static compile-time constants | MEDIUM |
| 7 — Broader Goal Seek | Postprocessor shipped; 0 deals populated; blocked by Gaps 2/3/4/6 | MEDIUM |
