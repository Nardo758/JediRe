# Calculations vs. Assumptions — F9 ProForma Field Classification

**Status:** Active  
**Date:** 2026-05-31 (NOI bug diagnosis corrected; agent layer framing updated)  
**Authority over:** F9 ProForma calculation vs. assumption distinction; LayeredValue framing; required Layer 1 override wiring

---

## Why This Distinction Matters

The F9 ProForma has two fundamentally different types of fields:

- **Assumptions** — inputs the agent derives through market judgment: GPR, vacancy rate, cap rate, growth rates. These require reasoning about comparable properties, market trajectories, and operator posture.
- **Calculations** — outputs that follow deterministically from assumptions: EGI, NOI, NOI after reserves, IRR, equity multiple. No market judgment required — if you have the inputs, the math produces the output.

Getting this distinction wrong causes two failure modes:

1. **Agent writes calculations** — the agent produces NOI by multiplying numbers together. The math engine then re-computes the same NOI. Two competing values exist before the engine wins. Bypasses to the engine's output can then surface stale agent-computed subtotals.
2. **Engine writes assumptions** — the engine hardcodes a vacancy rate or cap rate, removing the agent's market judgment from the critical path.

The architecture's answer: **agents own assumptions, the math engine owns calculations.**

---

## LayeredValue for Both Classes

Both assumptions and calculations flow through `LayeredValue<T>`. This is intentional — even a calculation like NOI can be overridden by an operator who has better information than the formula (e.g., an OM-stated stabilized NOI that differs from current T-12 performance).

The resolution chain (see `docs/architecture/cross-surface-read-consistency.md`) handles this:

```
1. Operator override (Layer 1)   — always wins, for both assumptions and calculations
2. Engine A formula              — for COMPUTED_AGGREGATES (noi, egi, noi_after_reserves)
3. Agent layer                   — agent's derived value
4. Stored resolved               — seeder's best source
```

For a calculation like NOI: the formula runs and wins at Layer 2 unless an operator has pinned a value at Layer 1. The agent's NOI estimate (Layer 3) is informational and visible in the divergence signature, but it does not override the formula result.

---

## The 22 Assumption Fields (KEEP-AI)

These fields require market judgment, source triangulation, or contextual reasoning. The agent must derive them.

### Revenue inputs

| Field path | What the agent derives |
|---|---|
| `proforma.revenue.gpr` | Gross Potential Rent — floor-plan market rent, LTL triangulation, rent roll vs. comp set vs. archive |
| `proforma.revenue.loss_to_lease` | $/yr gap between in-place and market rent |
| `proforma.revenue.vacancy_loss` | Vacancy % × GPR; vacancy % from market trajectory |
| `proforma.revenue.concessions` | Concession % from comp set, market posture |
| `proforma.revenue.bad_debt` | T-12 TTM actuals, archive cohort |
| `proforma.revenue.non_revenue_units` | T-12 actuals / rent roll |
| `proforma.revenue.other_income.parking` | Fee schedule projection, garage size |
| `proforma.revenue.other_income.pet` | Rent roll direct signal |
| `proforma.revenue.other_income.storage` | Rent roll direct signal |
| `proforma.revenue.other_income.washer_dryer` | T-12 or archive P50 |
| `proforma.revenue.other_income.rubs` | T-12 RUBS program presence |
| `proforma.revenue.other_income.fees` | Archive P50 |
| `proforma.revenue.other_income.cable` | Bulk agreement check |
| `proforma.revenue.other_income.other` | Archive P50 |

### Operating expense inputs

| Field path | What the agent derives |
|---|---|
| `proforma.opex.personnel` | $/unit/yr payroll — T-12 TTM ± archive P50, staffing model |
| `proforma.opex.repairs_maintenance` | $/unit/yr R&M — T-12 TTM with one-time exclusions, vintage adjustment |
| `proforma.opex.turnover` | $/unit/yr make-ready — T-12 TTM, seasonality correction |
| `proforma.opex.contract_services` | $/unit/yr — T-12 TTM, amenity-driven adjustments |
| `proforma.opex.marketing` | $/unit/yr — T-12 TTM, occupancy state |
| `proforma.opex.administrative` | $/unit/yr G&A — T-12 TTM with one-time exclusions |
| `proforma.opex.management_fee` | Management fee % × EGI, operator override |
| `proforma.opex.insurance` | `fetch_jurisdiction_insurance_forecast`, T-12 |
| `proforma.opex.property_tax` | `fetch_jurisdiction_tax_forecast` + `fetch_county_tax_rules` |
| `proforma.reserves.capex` | Age-band rule ($200/$350/$500), operator override |

### Growth assumptions

| Field path | What the agent derives |
|---|---|
| `proforma.assumptions.growth.rent_y1` | Analog cohort P50 + M07/M05 deltas + rate environment + posture |
| `proforma.assumptions.growth.rent_y2_plus` | Analog cohort long-run + M11 rate regime |
| `proforma.assumptions.growth.expense_y1` | Analog cohort + jurisdiction insurance/tax factors |
| `proforma.assumptions.growth.expense_long_run` | Platform inflation forecast |
| `proforma.assumptions.growth.vacancy_stabilized` | Analog cohort P50 + M07 submarket trajectory |
| `assumptions.exit_cap_rate` | Comp sales, entry cap spread, rate environment, hold period |

*(Count: 22 assumption inputs + 6 growth assumptions. Total KEEP-AI: ~28. Note: the "22 and 14" count referenced in prior sessions may reflect a slightly different grouping — this catalog is authoritative.)*

---

## The 8 Calculation Fields (CONVERT)

These fields are pure arithmetic from assumption inputs. The math engine (`proFormaMathEngine.ts`, `correctSnapshotMath` in `cashflow.postprocess.ts`) is the single source of truth. The agent should NOT produce these independently.

**Current state:** The agent currently writes subtotals to `proforma_snapshot`, and `correctSnapshotMath` then overwrites them. Two competing values exist before the engine wins. GAP-1 from the AI-compute audit recommends removing subtotals from the agent's required snapshot output — the agent's inputs (GPR, vacancy_pct, opex line items) are sufficient for `write_underwriting`'s sanity checks.

| Field path | Formula | Current state |
|---|---|---|
| `proforma.revenue.base_rental_revenue` | GPR − (LTL + vacancy + concessions + bad_debt + non_revenue) | Agent writes; math engine auto-corrects |
| `proforma.revenue.other_income` | Σ all `other_income.*` components | Agent writes aggregate; math engine reconciles |
| `proforma.revenue.egi` | base_rental_revenue + other_income | Agent writes; math engine auto-corrects |
| `proforma.opex.controllable_total` | Σ personnel + R&M + turnover + contract + marketing + admin | Agent writes; math engine auto-corrects |
| `proforma.opex.non_controllable_total` | Σ management_fee + insurance + property_tax | Agent writes; math engine auto-corrects |
| `proforma.opex.total` | controllable_total + non_controllable_total | Agent writes; sanity-checked; math engine auto-corrects |
| `proforma.noi` | EGI − total_opex | Agent writes; sanity-checked; math engine auto-corrects |
| `proforma.noi_after_reserves` | NOI − capex reserves | Agent writes; math engine auto-corrects |

---

## The 9 Deterministic Outputs (ALREADY-DETERMINISTIC)

These are produced by `compute_proforma.ts` or `proforma-generator.service.ts`, not by agent reasoning. The agent calls `compute_proforma` as a tool and receives these as outputs.

| Metric | Source |
|---|---|
| Annual debt service | PMT formula (loan, rate, amortization) — `compute_proforma.ts` |
| Year-by-year NOI ($) | noi_year1 × rent_growth^(n-1) − expense growth — `compute_proforma.ts` |
| DSCR per year | NOI / annual_debt_service — `compute_proforma.ts` |
| Cash flow after debt | NOI − debt_service — `compute_proforma.ts` |
| Cash-on-cash % | BTCF / equity_invested — `compute_proforma.ts` |
| Exit value | exit_NOI / exit_cap_rate — `compute_proforma.ts` |
| Remaining loan balance | Standard amortization at hold year — `compute_proforma.ts` |
| IRR | Newton-Raphson on [-equity, CF_y1…CF_yn + exit] — `compute_proforma.ts` + `proforma-generator.service.ts` |
| Equity multiple | Total distributions / equity_invested — `proforma-generator.service.ts` |

---

## What About the NOI Bug Specifically

The Deal Details UI/Backend audit (2026-05-31) found that both Pro Forma and Valuation Grid were showing the same NOI value (the formula-computed value) rather than an OM-extracted value of $2.99M. This was diagnosed as:

> "The formula is running on the leaf inputs and producing the correct current-state NOI. The OM-extracted $2.99M is in `year1.noi.om` and is visible in the divergence signature, but the formula result wins because no operator override has been set."

This is correct behavior per the architecture. The $2.99M OM-stated NOI represents the seller's stabilized projection, not current operating performance. The formula result represents what the property actually produces today given its current inputs.

The bug that WAS confirmed: the operator had no UI to pin a NOI override (Layer 1). If they believe the OM's stabilized NOI is more appropriate for their underwriting, they have no mechanism to set it. This is Task #1520 — wiring the override write path for NOI (and the ~4 other unwired fields).

**The read-path resolution chain is correct.** The `getFieldValue` formula gate at line 512 (`if (aggDef && !usingAlias && override == null)`) already skips the formula when an operator override is present. Item B (NOI formula-vs-chain governance) is resolved: the override-first guard is already implemented.

---

## OperatorStance Reblend

OperatorStance allows reblending of Layer 2 outputs (platform/agent-derived values) without a new LLM call. The stance applies modulation rules to the cached `proforma_snapshot` baseline and produces an ephemeral reblend view.

**Layer 1 overrides are preserved through reblends.** If an operator has pinned NOI at $1.2M, a stance change to DEFENSIVE does not override that pin. The reblend applies to the agent layer (Layer 3) and below.

**Status:** Verified operational (2026-05-31). `operatorStance.service.ts` background reblend applies modulation to the baseline snapshot with no LLM call in the path.

---

## Reconciliation Action

The `agent` resolution layer (Layer 3) exists and is documented in `get-field-value.service.ts`. It sits between Engine A formula (Layer 2) and the seeder's stored resolved (Layer 4).

The seeder's `FIELD_PRIORITIES` constant in `proforma-seeder.service.ts` governs seed-time source selection (which of t12, rent_roll, om, broker to prefer per field). It is a different concern from the read-time resolution chain and does not need to include `agent`.

**Item A decision (resolved 2026-05-31):** The agent layer is correctly documented and positioned in `get-field-value.service.ts`. No code change needed; this was a documentation gap, not an implementation gap.
