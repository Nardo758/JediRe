# AI-Compute → Derivation Audit

**Task:** #1420  
**Date:** 2026-05-28  
**Status:** Complete

## Purpose

Audit every field the cashflow agent writes to `proforma_fields` / `proforma_snapshot` and classify each as:

- **KEEP-AI** — Genuine inference; requires market judgment, source triangulation, or contextual reasoning. The agent must produce this.
- **CONVERT** — Pure arithmetic from other agent-written inputs. The math engine should be the single source of truth; the agent should not produce this.
- **ALREADY-DETERMINISTIC** — Computed by deterministic tools (`compute_proforma`, `proforma-generator.service.ts`). Not agent-authored.

---

## Architecture

The cashflow agent operates in three layers:

### Layer 1 — Agent reasoning → proforma_snapshot

The agent calls `write_underwriting` with a `proforma_snapshot` containing:
- Assumption inputs (per-unit rates, growth rates, cap rates)
- Computed intermediates it derived from those inputs (GPR, EGI, NOI)

Before writing, `write_underwriting` runs sanity checks that look for `gpr`, `egi`, `total_opex`, `noi` in the snapshot and blocks the write if arithmetic is wildly wrong.

### Layer 2 — compute_proforma tool

The agent calls `compute_proforma` during its run, passing `purchase_price`, `gross_revenue_year1`, `noi_year1`, and financing/hold assumptions. The tool returns year-by-year NOI, debt service, DSCR, cash flow, IRR, and exit proceeds — all computed deterministically. These are returned to the agent as tool output; the agent may include them in its snapshot.

### Layer 3 — proFormaMathEngine post-processor

`correctSnapshotMath` runs in `cashflow.postprocess.ts` after every agent run. It validates all subtotals in `proforma_fields` against their canonical formulas (`LINE_ITEM_CONFIG`) and auto-corrects arithmetic mismatches before the output reaches the frontend. This layer is the enforcer.

---

## Revenue Stack

### Inputs — KEEP-AI

| Field path | Agent derives | Why AI |
|---|---|---|
| `proforma.revenue.gpr` | Gross Potential Rent (Y1) | Floor-plan market rent, loss-to-lease triangulation, rent roll vs comp set vs archive |
| `proforma.revenue.loss_to_lease` | $/yr gap between in-place and market | Per-floor-plan market rent benchmark |
| `proforma.revenue.vacancy_loss` | $/yr vacancy credit loss | Vacancy % × GPR; vacancy % from market trajectory + archive |
| `proforma.revenue.concessions` | $/yr concession value | Concession pct from comp set, market posture, archive |
| `proforma.revenue.bad_debt` | $/yr bad debt | T-12 TTM actuals, archive cohort |
| `proforma.revenue.non_revenue_units` | $/yr drag | T-12 actuals / rent roll |
| `proforma.revenue.other_income.parking` | $/unit/mo | Fee schedule projection, garage size |
| `proforma.revenue.other_income.pet` | $/unit/mo | Rent roll direct signal |
| `proforma.revenue.other_income.storage` | $/unit/mo | Rent roll direct signal |
| `proforma.revenue.other_income.washer_dryer` | $/unit/mo | T-12 or archive P50 |
| `proforma.revenue.other_income.rubs` | $/unit/mo | T-12 RUBS program presence |
| `proforma.revenue.other_income.fees` | $/unit/mo | Archive P50 |
| `proforma.revenue.other_income.cable` | $/unit/mo | Bulk agreement check |
| `proforma.revenue.other_income.other` | $/unit/mo | Archive P50 |

### Subtotals — CONVERT

| Field path | Formula | Current state |
|---|---|---|
| `proforma.revenue.base_rental_revenue` | GPR − (loss_to_lease + vacancy + concessions + bad_debt + non_revenue) | Agent writes; math engine auto-corrects |
| `proforma.revenue.other_income` | Σ all `other_income.*` components | Agent writes aggregate AND components; math engine reconciles hierarchical subtotal |
| `proforma.revenue.egi` | base_rental_revenue + other_income | Agent writes; math engine auto-corrects |

---

## OpEx Stack

### Inputs — KEEP-AI

| Field path | Agent derives | Why AI |
|---|---|---|
| `proforma.opex.personnel` | $/unit/yr payroll | T-12 TTM ± archive P50, staffing model |
| `proforma.opex.repairs_maintenance` | $/unit/yr R&M | T-12 TTM with one-time exclusions, vintage adjustment |
| `proforma.opex.turnover` | $/unit/yr make-ready | T-12 TTM, seasonality correction |
| `proforma.opex.contract_services` | $/unit/yr contract svc | T-12 TTM, amenity-driven adjustments |
| `proforma.opex.marketing` | $/unit/yr marketing | T-12 TTM, occupancy state |
| `proforma.opex.administrative` | $/unit/yr G&A | T-12 TTM with one-time exclusions |
| `proforma.opex.management_fee` | $/unit/yr mgmt fee | Management fee % × EGI, operator override |
| `proforma.opex.insurance` | $/unit/yr insurance | `fetch_jurisdiction_insurance_forecast`, T-12 |
| `proforma.opex.property_tax` | $/unit/yr tax | `fetch_jurisdiction_tax_forecast` + `fetch_county_tax_rules` |
| `proforma.reserves.capex` | $/unit/yr reserves | Age-band rule ($200/$350/$500), operator override |

### Subtotals — CONVERT

| Field path | Formula | Current state |
|---|---|---|
| `proforma.opex.controllable_total` | Σ personnel + R&M + turnover + contract + marketing + admin | Agent writes; math engine auto-corrects |
| `proforma.opex.non_controllable_total` | Σ mgmt_fee + insurance + property_tax | Agent writes; math engine auto-corrects |
| `proforma.opex.total` | controllable_total + non_controllable_total | Agent writes; sanity-checked pre-write; math engine auto-corrects |
| `proforma.noi` | EGI − total_opex | Agent writes; sanity-checked pre-write; math engine auto-corrects |
| `proforma.noi_after_reserves` | NOI − capex | Agent writes; math engine auto-corrects |

---

## Growth Assumptions — KEEP-AI

| Field path | Agent derives |
|---|---|
| `proforma.assumptions.growth.rent_y1` | Analog cohort P50 + M07/M05 deltas + rate environment + posture |
| `proforma.assumptions.growth.rent_y2_plus` | Analog cohort long-run + M11 rate regime |
| `proforma.assumptions.growth.expense_y1` | Analog cohort + jurisdiction insurance/tax factors |
| `proforma.assumptions.growth.expense_long_run` | Platform inflation forecast |
| `proforma.assumptions.growth.vacancy_stabilized` | Analog cohort P50 + M07 submarket trajectory |
| `assumptions.exit_cap_rate` | Comp sales, entry cap spread, rate environment, hold period |

---

## Returns Metrics — ALREADY-DETERMINISTIC

These are NOT produced by agent reasoning. They come from deterministic tool calls (`compute_proforma.ts`) or the proforma generator engine:

| Metric | How computed | Source |
|---|---|---|
| Annual debt service | PMT formula (loan, rate, amortization) | `compute_proforma.ts` |
| Year-by-year NOI ($) | noi_year1 × rent_growth^(n-1) − expense growth | `compute_proforma.ts` |
| DSCR per year | NOI / annual_debt_service | `compute_proforma.ts` |
| Cash flow after debt | NOI − debt_service | `compute_proforma.ts` |
| Cash-on-cash % | BTCF / equity_invested | `compute_proforma.ts` |
| Exit value | exit_NOI / exit_cap_rate | `compute_proforma.ts` |
| Remaining loan balance | Standard amortization at hold year | `compute_proforma.ts` |
| IRR | Newton-Raphson on [-equity, CF_y1…CF_yn + exit] | `compute_proforma.ts` + `proforma-generator.service.ts` |
| Equity multiple | Total distributions / equity_invested | `proforma-generator.service.ts` |

---

## Posture and Diagnostics — KEEP-AI

| Field path | What the agent produces |
|---|---|
| `proforma.posture.y<N>.classification` | Offense / Neutral / Defense per hold year |
| `proforma.posture.y<N>.signal_breakdown` | Scored signals from M07, M04, M05, M14 |
| `proforma.posture.y<N>.assumption_modulation` | Modulated assumption values per posture |
| `proforma.assumptions.growth.<field>.cohort_baseline_p50` | Analog cohort medians per assumption |
| `proforma.diagnostics.implied_rent_growth_y1` | Walk-implied growth vs assumed growth |
| `proforma.diagnostics.reconciliation_delta_rent_y1` | Divergence flag (target ~0) |
| `proforma.valuation.cap_rate` | Going-in cap rate (NOI / purchase_price) |
| `proforma.valuation.stabilized_value` | Stabilized NOI / cap rate with comp context |

---

## Gaps and Recommendations

### GAP-1: Dual subtotal computation (medium severity)

**Problem:** The agent writes `proforma.noi`, `proforma.revenue.egi`, `proforma.opex.total` AND the `proFormaMathEngine` recomputes them in post-processing. Two competing values exist before the engine wins.

**Risk:** Any code path that bypasses `cashflow.postprocess.ts` (direct snapshot reads, reblend paths) sees stale agent-computed subtotals.

**Recommendation:** Remove subtotals from the agent's required proforma_snapshot output. Refactor `write_underwriting` sanity checks to compute EGI and NOI from the agent's INPUTS (GPR, vacancy_pct, opex line items) rather than from agent-written aggregate fields. Treat the math engine as the single authoritative source for all subtotals.

### GAP-2: Sanity check dependency on agent subtotals (low severity)

**Problem:** `write_underwriting.ts` sanity checks look for `noi`, `egi`, `gpr`, `total_opex` from the agent snapshot. If agents stop writing subtotals (per GAP-1), sanity checks lose their inputs.

**Recommendation:** Implement `computeFromInputs(snapshot)` helper in `write_underwriting.ts` that derives EGI and NOI from the input fields before running sanity checks. Decouple validation from agent-written aggregates.

### GAP-3: compute_proforma results not enforced to persistence (medium severity)

**Problem:** The agent calls `compute_proforma` and receives IRR, DSCR, equity_multiple as tool output. The agent may or may not include these in the snapshot. No enforced write path exists for returns metrics.

**Recommendation:** Add a `write_returns_metrics` step in `cashflow.postprocess.ts` that runs `compute_proforma` with the final resolved assumptions (after math engine correction) and writes IRR/DSCR/equity_multiple to `deal_underwriting_snapshots.returns_json`.

### GAP-4: All rows in mv_market_rent_benchmarks are asset_class = 'C' (low severity)

**Problem:** `apartment_locator_properties.year_built` is NULL for all 954 rows, so the CASE expression always falls to ELSE → 'C'. The `fetch_market_rent_benchmark` tool always returns Class C benchmarks regardless of deal asset class.

**Recommendation:** Backfill `year_built` from ApartmentIQ sync data during the next data refresh. Interim: the tool should note the all-C limitation in evidence `notes` fields.

---

## Verdict Summary

| Category | Count | Action |
|---|---|---|
| KEEP-AI (assumption inputs + posture) | ~25 field paths | No change |
| CONVERT (subtotals, engine should own) | 8 field paths | Refactor per GAP-1 |
| ALREADY-DETERMINISTIC (tool outputs) | 9 metrics | Enforce write path per GAP-3 |
| Posture/diagnostics | ~8 field paths | No change |

---

## Files Audited

| File | Role |
|---|---|
| `backend/src/agents/prompts/cashflow/output-schema.ts` | Generic proforma_fields map (no hardcoded calculated fields) |
| `backend/src/agents/prompts/cashflow/system.ts` | Full 2,136-line system prompt — field paths, evidence requirements |
| `backend/src/agents/tools/write_underwriting.ts` | Sanity checks + proforma_snapshot persistence |
| `backend/src/agents/tools/write_evidence_rows.ts` | Evidence row persistence (separate from snapshot) |
| `backend/src/agents/tools/compute_proforma.ts` | Deterministic multi-year projection + IRR engine |
| `backend/src/agents/cashflow.config.ts` | Tool registration, budget caps |
| `backend/src/agents/cashflow.postprocess.ts` | Post-processing: math engine, stance modulation, evidence normalization |
| `backend/src/services/proforma/proFormaMathEngine.ts` | LINE_ITEM_CONFIG, subtotal formulas, correctSnapshotMath |
| `backend/src/services/proforma-generator.service.ts` | Alternative IRR / equity_multiple computation |
| `backend/src/services/proforma-adjustment.service.ts` | Assumption adjustment layer (baseline vs news-adjusted) |
