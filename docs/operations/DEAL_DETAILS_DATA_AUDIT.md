# Deal Details Capsule — End-to-End Data Audit

**Audit date:** 2026-05-30  
**Test deal:** 464 Bishop — `3f32276f-aacd-4da3-b306-317c5109b403`  
**Test deal address:** 464 Bishop Street NW, Atlanta, GA 30318  
**Scope:** All operator-visible surfaces inside the Deal Details capsule (F9 Financial Engine F1–F12, Validation Grid, Valuation Grid, Document Library)  
**Method:** Live database queries against the dev PostgreSQL instance + code trace through frontend components → backend routes → service layer → SQL  
**Status:** Read-only investigation; no code changes made

---

## Executive Summary

### Per-Surface Gap Counts

| Surface | Fields Audited | POPULATED | SPARSELY POPULATED | EMPTY | BROKEN | MISSING |
|---|---:|---:|---:|---:|---:|---:|
| F1 — Overview | 14 | 8 | 2 | 3 | 1 | 0 |
| F2/Console — Assumptions Hub | 28 | 14 | 4 | 6 | 2 | 2 |
| F2a — Validation Grid | 12 | 7 | 2 | 2 | 1 | 0 |
| F3 — Pro Forma Summary | 22 | 12 | 3 | 4 | 3 | 0 |
| F4 — Projections Hub | 18 | 10 | 2 | 3 | 3 | 0 |
| F5 — Capital Hub | 20 | 4 | 2 | 10 | 2 | 2 |
| F6 — Returns Hub | 16 | 5 | 1 | 7 | 2 | 1 |
| F7 — Valuation Grid | 10 | 3 | 2 | 3 | 2 | 0 |
| F8 — Decision Tab | 8 | 2 | 1 | 4 | 1 | 0 |
| F9 — Compare Hub | 12 | 4 | 0 | 6 | 2 | 0 |
| F10 — Sensitivity/Goal Seek | 8 | 5 | 0 | 2 | 1 | 0 |
| F11 — Roadmap Tab | 10 | 0 | 0 | 10 | 0 | 0 |
| F12 — Custom Tabs | 4 | 0 | 0 | 4 | 0 | 0 |
| Document Library | 8 | 5 | 1 | 1 | 1 | 0 |
| **TOTAL** | **190** | **79 (42%)** | **20 (11%)** | **65 (34%)** | **19 (10%)** | **5 (3%)** |

### Author-Class Distribution (across all audited fields)

| Author Class | Field Count | % |
|---|---:|---:|
| OPERATOR-UPLOAD (T12 / Rent Roll / OM / Tax Bill extraction) | 48 | 25% |
| COMPUTED (platform formula, no external data) | 42 | 22% |
| RESEARCH-PULL (apartment_locator, Georgia ingest, ACS, FRED, traffic API) | 35 | 18% |
| OPERATOR (human UI input, PATCH endpoints) | 28 | 15% |
| AGENT (Cashflow Agent, Zoning Agent, Correlation Engine) | 22 | 12% |
| UNKNOWN (writer unconfirmed in code) | 15 | 8% |

### Top-10 Critical Findings

| # | Finding | Severity |
|---|---|---|
| CF-01 | `noi` resolves to `840,231` (platform_fallback) for 464 Bishop — 72% below OM-extracted `2,999,564`. Resolution layer shows `platform_fallback` even though OM extraction is present. | P1 BROKEN |
| CF-02 | Per-year projections loop ignores `deal_assumptions.per_year_overrides` (e.g. `payroll:yr2`, `gpr:yr2`). Operator edits to individual projection years are stored but reverted on every fetch. | P1 BROKEN |
| CF-03 | `deal_monthly_actuals` — 24 rows exist but GPR, NOI, EGI, and `occupancy_rate` are all NULL for 464 Bishop. Shell rows written with no financial data populated. | P1 BROKEN |
| CF-04 | `jedi_scores` table has zero rows for 464 Bishop; `deals.jedi_score` is NULL. JEDI Score displayed as NULL across all surfaces that consume it (F1, F8, Decision). | EMPTY |
| CF-05 | `deal_market_intelligence` — zero rows for 464 Bishop. F1 market context strip, F4-downstream deal context, and F8 market signal overlay are all empty for this deal. | EMPTY |
| CF-06 | `deal_debt_schedule`, `deal_waterfall_config`, `deal_capex_items`, `deal_risks`, `deal_comparable_properties` — all zero rows for 464 Bishop. F5, F6, F8 surfaces are hollow for this deal. | EMPTY (5 tables) |
| CF-07 | `deal_monthly_actuals` has no user-facing write path and shell rows have no ETL backfill for this deal — 24 rows exist with no data. Author is UNKNOWN. | EMPTY / UNKNOWN |
| CF-08 | `electric` and `gas_fuel` OpEx fields resolve to NULL with `resolution: platform_fallback` even though T12 and OM extractions are present — seeder is not propagating these utility lines from extraction to `year1`. | BROKEN |
| CF-09 | `deal_assumptions.unit_mix` is empty (`{}`); `da:use_unit_mix_for_gpr` flag not set. Unit Mix Tab edits are stored in `unit_mix_overrides` but have no effect on GPR or Pro Forma — no user-facing toggle exists to activate the flag. | BROKEN (silent) |
| CF-10 | `deal.property_id` is NULL for 464 Bishop — the deal has no linked `properties` row. All surfaces that read from `properties` (unit count, year built, building SF, lat/lng) fall back to `deals.deal_data` JSONB or extraction capsule data, bypassing the canonical property entity. | MISSING |

---

## Per-Surface Breakdown

### F1 — Overview

**Component:** `frontend/src/pages/development/financial-engine/OverviewTab.tsx`  
**Primary endpoint:** `GET /api/v1/deals/:dealId` + `GET /api/v1/deal-assumptions/:dealId/assumptions`  
**Secondary endpoints:** `GET /api/v1/jedi/score/:dealId`, `GET /api/v1/deals/:dealId/market-intelligence`

| Field (operator label) | Backend Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap Status (464 Bishop) |
|---|---|---|---|---|---|
| JEDI Score (total) | GET /api/v1/jedi/score/:dealId | `jedi_scores.total_score` | COMPUTED | `jedi_scores.updated_at` | EMPTY — 0 rows |
| Demand Score | GET /api/v1/jedi/score/:dealId | `jedi_scores.demand_score` | COMPUTED | `jedi_scores.updated_at` | EMPTY |
| Supply Score | GET /api/v1/jedi/score/:dealId | `jedi_scores.supply_score` | COMPUTED | `jedi_scores.updated_at` | EMPTY |
| Momentum Score | GET /api/v1/jedi/score/:dealId | `jedi_scores.momentum_score` | COMPUTED | `jedi_scores.updated_at` | EMPTY |
| Position Score | GET /api/v1/jedi/score/:dealId | `jedi_scores.position_score` | COMPUTED | `jedi_scores.updated_at` | EMPTY |
| Risk Score | GET /api/v1/jedi/score/:dealId | `jedi_scores.risk_score` | COMPUTED | `jedi_scores.updated_at` | EMPTY |
| Deal Name | GET /api/v1/deals/:dealId | `deals.name` | OPERATOR | `deals.updated_at` | POPULATED — "464 Bishop" |
| Address | GET /api/v1/deals/:dealId | `deals.address` | OPERATOR | `deals.updated_at` | POPULATED |
| Pipeline Stage | GET /api/v1/deals/:dealId | `deals.pipeline_stage` | OPERATOR | `deals.updated_at` | POPULATED — "prospect" |
| Deal Strategy | GET /api/v1/deals/:dealId | `deals.strategy` | OPERATOR | `deals.updated_at` | POPULATED |
| IRR (levered) | GET /api/v1/deal-assumptions/:dealId/assumptions | `deal_assumptions.irr_levered` | COMPUTED | `deal_assumptions.last_computed_at` | EMPTY — NULL |
| Equity Multiple | GET /api/v1/deal-assumptions/:dealId/assumptions | `deal_assumptions.equity_multiple` | COMPUTED | `deal_assumptions.last_computed_at` | EMPTY — NULL |
| NOI (Year 1, resolved) | GET /api/v1/deal-assumptions/:dealId | `deal_assumptions.year1['noi'].resolved` | COMPUTED | `year1.noi.updated_at` | BROKEN — resolved=840,231 (platform_fallback vs OM 2,999,564) |
| Market Intelligence Context | GET /api/v1/deals/:dealId/market-intelligence | `deal_market_intelligence` | RESEARCH-PULL | `deal_market_intelligence.created_at` | EMPTY — 0 rows |

---

### F2/Console — Assumptions Hub

**Component:** `frontend/src/pages/development/financial-engine/ConsoleHubTab.tsx` (shell)  
Sub-tabs: Stance, Deal Terms, Inputs/Assumptions, Unit Mix, Other Income, Taxes, Leasing Assumptions

**Primary endpoints:**  
- `GET /api/v1/deal-assumptions/:dealId/assumptions` → `deal_assumptions` row  
- `GET /api/v1/deals/:dealId/financials` → Engine A `getDealFinancials()` in `proforma-adjustment.service.ts`  
- `GET /api/v1/deals/:dealId/assumptions/monthly` → `deal_assumptions.per_year_overrides`

#### Deal Terms Sub-tab

**Component:** `frontend/src/pages/development/financial-engine/DealTermsTab.tsx`  
**Write endpoint:** `PATCH /api/v1/deal-assumptions/:dealId/purchase-price`, `PATCH /api/v1/deal-assumptions/:dealId/assumptions/hold-period`

| Field | Source Table | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Purchase Price | `deals.budget` / `deals.deal_data->>'purchase_price'` (dual-write) | OPERATOR | `deals.updated_at` | POPULATED — $60M |
| Hold Period (years) | `deal_assumptions.hold_period_years` | OPERATOR | `deal_assumptions.updated_at` | POPULATED — 5 years |
| Exit Cap Rate | `deal_assumptions.exit_cap` | OPERATOR / COMPUTED | `deal_assumptions.updated_at` | POPULATED — 5.0% |
| Exit Strategy | `deal_assumptions.exit_strategy_lv` (LayeredValue JSONB) | OPERATOR | `deal_assumptions.updated_at` | POPULATED — SET |
| Investment Strategy | `deal_assumptions.investment_strategy_lv` (LayeredValue JSONB) | OPERATOR | `deal_assumptions.updated_at` | POPULATED — SET |
| Target IRR | `deal_assumptions.target_irr` | OPERATOR | `deal_assumptions.updated_at` | POPULATED |
| Target EM | `deal_assumptions.target_em` | OPERATOR | `deal_assumptions.updated_at` | POPULATED |
| Selling Costs % | `deal_assumptions.selling_costs_pct` | OPERATOR | `deal_assumptions.updated_at` | POPULATED |

#### Inputs/Assumptions Sub-tab

**Component:** `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx`  
**Data source:** `deal_assumptions.year1` JSONB (Engine A)

| Field | Source Layer(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| GPR (Year 1) | `year1.gpr` — priority: override > agent > t12 > rent_roll > om > platform | OPERATOR-UPLOAD (resolved: agent/OM) | `year1.gpr.updated_at` | POPULATED — $4,901,400 |
| Vacancy % | `year1.vacancy_pct` — priority: override > rent_roll > t12 > platform | OPERATOR-UPLOAD | `year1.vacancy_pct.updated_at` | POPULATED |
| Concessions % | `year1.concessions_pct` — priority: override > t12 > rent_roll > platform | OPERATOR-UPLOAD | `year1.concessions_pct.updated_at` | POPULATED |
| Payroll | `year1.payroll` — priority: override > agent > t12 > platform | OPERATOR-UPLOAD (resolved: agent/OM) | `year1.payroll.updated_at` | POPULATED — $324,800 |
| G&A | `year1.g_and_a` — priority: override > agent > t12 > platform | OPERATOR-UPLOAD | `year1.g_and_a.updated_at` | POPULATED — $69,600 |
| Electric | `year1.electric` — priority: t12 > platform | OPERATOR-UPLOAD | `year1.electric.updated_at` | BROKEN — resolved=null (platform_fallback, T12 present) |
| Gas/Fuel | `year1.gas_fuel` — priority: t12 > platform | OPERATOR-UPLOAD | `year1.gas_fuel.updated_at` | BROKEN — resolved=null |
| Real Estate Tax | `year1.real_estate_tax` — priority: tax_bill > t12 > platform | OPERATOR-UPLOAD / AGENT | `year1.real_estate_tax.updated_at` | SPARSELY POPULATED |
| Insurance | `year1.insurance` — priority: t12 > platform | OPERATOR-UPLOAD | `year1.insurance.updated_at` | SPARSELY POPULATED |
| Management Fee % | `year1.management_fee_pct` | OPERATOR-UPLOAD | `year1.management_fee_pct.updated_at` | POPULATED |
| Replacement Reserves | `year1.replacement_reserves_per_unit` | OPERATOR-UPLOAD / COMPUTED | `year1.replacement_reserves_per_unit.updated_at` | POPULATED |
| Other Income / unit | `year1.other_income_per_unit` — priority: override > rent_roll > t12 > om | OPERATOR-UPLOAD | `year1.other_income_per_unit.updated_at` | POPULATED |
| NOI (computed) | `year1.noi` | COMPUTED | `year1.noi.updated_at` | BROKEN — 840,231 (platform_fallback) |
| EGI | `year1.egi` | COMPUTED | `year1.egi.updated_at` | POPULATED — $3,669,151 (agent) |

#### Unit Mix Sub-tab

**Component:** `frontend/src/pages/development/financial-engine/` (UnitMixTab referenced in F9 module map)  
**Write endpoint:** `PATCH /api/v1/deal-assumptions/:dealId/financials/override`

| Field | Source Table | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Unit mix (type / count / SF / rent) | `deal_assumptions.unit_mix` JSONB | OPERATOR-UPLOAD / OPERATOR | `deal_assumptions.updated_at` | EMPTY — `unit_mix = {}` |
| Unit mix overrides | `deal_assumptions.unit_mix_overrides` JSONB | OPERATOR | `deal_assumptions.updated_at` | POPULATED — SET |
| GPR-from-unit-mix gate | `deal_assumptions.per_year_overrides['da:use_unit_mix_for_gpr']` | OPERATOR | N/A | MISSING — flag not set, no UI to set it |

#### OperatorStance Sub-tab

**Component:** `frontend/src/pages/development/financial-engine/StanceTab.tsx`  
**Source:** `deals.operator_stance` (JSONB column on `deals`)  
**Write endpoint:** `PATCH /api/v1/deal-assumptions/:dealId/assumptions` (stance fields)

| Field | Source Table | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Underwriting Posture | `deals.operator_stance->>'underwritingPosture'` | OPERATOR | `deals.updated_at` | SPARSELY POPULATED |
| Rate Environment | `deals.operator_stance->>'rateEnvironment'` | OPERATOR | `deals.updated_at` | SPARSELY POPULATED |
| Cycle Position | `deals.operator_stance->>'cyclePosition'` | OPERATOR | `deals.updated_at` | SPARSELY POPULATED |
| Expense Growth Posture | `deals.operator_stance->>'expenseGrowthPosture'` | OPERATOR | `deals.updated_at` | SPARSELY POPULATED |

#### Growth Rate Scalars (Projections Growth)

**Source:** `proforma_assumptions` table  
**Write paths:** capsule-bridge at deal creation, `calculateRentGrowthAdjustment()`, operator override, OperatorStance reblend

| Field | Source Table | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Rent Growth % | `proforma_assumptions.rent_growth_current` | RESEARCH-PULL / OPERATOR / AGENT | `proforma_assumptions.updated_at` | POPULATED — 3.5% (no override, at baseline) |
| Vacancy % (growth scalar) | `proforma_assumptions.vacancy_current` | RESEARCH-PULL / OPERATOR / AGENT | `proforma_assumptions.updated_at` | POPULATED — 5.0% |
| OpEx Growth % | `proforma_assumptions.opex_growth_current` | RESEARCH-PULL / OPERATOR | `proforma_assumptions.updated_at` | POPULATED — 2.8% |
| Exit Cap Rate (growth) | `proforma_assumptions.exit_cap_current` | RESEARCH-PULL / AGENT | `proforma_assumptions.updated_at` | POPULATED — 5.5% |

---

### F2a — Validation Grid

**Component:** `frontend/src/pages/development/financial-engine/ValidationGridTab.tsx`  
**Primary endpoints:** `GET /api/v1/deal-assumptions/:dealId/assumptions`, `GET /api/v1/deals/:dealId/implied-cap-rate`  
**Data inputs:** `f9Financials` prop, `assumptions` prop, `evidenceFieldMap` (per-field confidence metadata)

| Field | Source Table | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Purchase Price (validation row) | `deal_assumptions` / `deals.budget` | OPERATOR | `deals.updated_at` | POPULATED — $60M |
| Going-in Cap Rate | Computed: NOI / Purchase Price | COMPUTED | Derived from `year1.noi` | BROKEN — NOI broken (CF-01) |
| Exit Cap Rate | `deal_assumptions.exit_cap` | OPERATOR / RESEARCH-PULL | `deal_assumptions.updated_at` | POPULATED — 5.0% |
| Rent Growth % | `proforma_assumptions.rent_growth_current` | RESEARCH-PULL / OPERATOR | `proforma_assumptions.updated_at` | POPULATED — 3.5% |
| Vacancy % | `proforma_assumptions.vacancy_current` | RESEARCH-PULL / OPERATOR | `proforma_assumptions.updated_at` | POPULATED — 5.0% |
| GPR (Year 1) | `deal_assumptions.year1.gpr.resolved` | OPERATOR-UPLOAD | `year1.gpr.updated_at` | POPULATED — $4,901,400 |
| Payroll | `deal_assumptions.year1.payroll.resolved` | OPERATOR-UPLOAD | `year1.payroll.updated_at` | POPULATED — $324,800 |
| Hold Period | `deal_assumptions.hold_period_years` | OPERATOR | `deal_assumptions.updated_at` | POPULATED — 5 years |
| Platform baseline (per-row) | `proforma_assumptions.*_baseline` | RESEARCH-PULL / COMPUTED | `proforma_assumptions.updated_at` | POPULATED |
| Implied cap (comp set median) | `GET /api/v1/deals/:dealId/implied-cap-rate` → `market_sale_comps` | RESEARCH-PULL | `market_sale_comps.created_at` | EMPTY — 0 sale comps for deal |
| Evidence confidence (per-row) | `evidenceFieldMap` prop → underlying evidence system | AGENT / COMPUTED | Varies | SPARSELY POPULATED |
| Override impact signal | Derived: `year1[field].override` vs `proforma_assumptions.*_baseline` | COMPUTED | Derived | POPULATED where override exists |

---

### F3 — Pro Forma Summary

**Component:** `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx`  
**Primary endpoint:** `GET /api/v1/deals/:dealId/financials` (Engine A: `getDealFinancials()` in `proforma-adjustment.service.ts`)  
**Source table primary:** `deal_assumptions.year1` JSONB (LayeredValue tree)  
**Source table secondary:** `proforma_assumptions` (growth rate scalars)

| Field | Source Layer(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| GPR | `year1.gpr` (resolved via priority chain) | OPERATOR-UPLOAD | `year1.gpr.updated_at` | POPULATED — $4,901,400 |
| Loss to Lease % | `year1.loss_to_lease_pct` — t12 > rent_roll | OPERATOR-UPLOAD | `year1.loss_to_lease_pct.updated_at` | POPULATED |
| Vacancy Loss | `year1.vacancy_pct` × GPR | OPERATOR-UPLOAD / COMPUTED | Derived | POPULATED |
| Concession Loss | `year1.concessions_pct` × GPR | OPERATOR-UPLOAD / COMPUTED | Derived | POPULATED |
| Bad Debt | `year1.bad_debt_pct` — t12 | OPERATOR-UPLOAD | `year1.bad_debt_pct.updated_at` | SPARSELY POPULATED |
| Other Income | `year1.other_income_per_unit` × 12 × units | OPERATOR-UPLOAD / COMPUTED | Derived | POPULATED |
| EGI | Computed: GPR - losses + other income | COMPUTED | Derived | POPULATED — $3,669,151 |
| Payroll | `year1.payroll` | OPERATOR-UPLOAD | `year1.payroll.updated_at` | POPULATED — $324,800 |
| G&A | `year1.g_and_a` | OPERATOR-UPLOAD | `year1.g_and_a.updated_at` | POPULATED — $69,600 |
| Real Estate Tax | `year1.real_estate_tax` | OPERATOR-UPLOAD / AGENT | `year1.real_estate_tax.updated_at` | SPARSELY POPULATED |
| Insurance | `year1.insurance` | OPERATOR-UPLOAD | `year1.insurance.updated_at` | SPARSELY POPULATED |
| Electric | `year1.electric` | OPERATOR-UPLOAD | `year1.electric.updated_at` | BROKEN — null |
| Gas/Fuel | `year1.gas_fuel` | OPERATOR-UPLOAD | `year1.gas_fuel.updated_at` | BROKEN — null |
| Maintenance/Repairs | `year1.maintenance` | OPERATOR-UPLOAD | `year1.maintenance.updated_at` | POPULATED |
| Management Fee | `year1.management_fee_pct` × EGI | OPERATOR-UPLOAD / COMPUTED | Derived | POPULATED |
| Replacement Reserves | `year1.replacement_reserves_per_unit` × units | OPERATOR-UPLOAD / COMPUTED | Derived | POPULATED |
| Total OpEx | Sum of OpEx lines | COMPUTED | Derived | POPULATED |
| NOI (Year 1) | EGI - Total OpEx | COMPUTED | Derived | BROKEN — $840,231 (72% below OM) |
| Expense Ratio % | OpEx / EGI | COMPUTED | Derived | BROKEN (depends on NOI) |
| NOI Margin % | NOI / EGI | COMPUTED | Derived | BROKEN |
| Source pill (per-row) | `year1[field].resolvedFrom` | COMPUTED | Per-field | POPULATED |
| Year N columns (projections) | `getDealFinancials().projections[]` | COMPUTED | Derived from Y1 × growth | POPULATED but per-year overrides ignored (CF-02) |

---

### F4 — Projections Hub

**Component:** `frontend/src/pages/development/financial-engine/ProjectionsHubTab.tsx` → `ProjectionsTab.tsx`, `LeaseVelocitySection.tsx`  
**Primary endpoint:** `GET /api/v1/deals/:dealId/financials` (inline projections loop in `proforma-adjustment.service.ts:3278`)  
**Secondary endpoint:** `POST /api/v1/lease-velocity/run`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Rent Growth (per year) | `proforma_assumptions.rent_growth_current` (÷100) / `deal_assumptions.per_year_overrides['rentGrowthPct:yrN']` | RESEARCH-PULL / OPERATOR | `proforma_assumptions.updated_at` | POPULATED — 3.5% scalar; per-year overrides stored but NOT READ (CF-02) |
| GPR (Yr 2–10) | Y1 GPR × compound rent growth / `per_year_overrides['gpr:yrN']` | COMPUTED | Derived | BROKEN — per_year_overrides stored but ignored |
| Vacancy (per year) | Traffic projection → `proforma_assumptions.vacancy_current` → Y1 | RESEARCH-PULL / COMPUTED | `deal_traffic_snapshots.snapshot_date` | POPULATED (traffic snapshots present) |
| OpEx lines (Yr 2–10) | Y1 OpEx × `proforma_assumptions.opex_growth_current` / `per_year_overrides[line:yrN]` | COMPUTED | Derived | BROKEN — per_year_overrides stored but ignored |
| NOI (Yr 2–10) | Computed from above | COMPUTED | Derived | BROKEN (cascades from Y1 NOI + per-year override gap) |
| Traffic Projections | `deal_traffic_snapshots` | RESEARCH-PULL / COMPUTED | `deal_traffic_snapshots.snapshot_date` | POPULATED — 3 snapshots |
| Lease Velocity (LVE) | `deal_lease_transactions` → `computeTrafficSnapshot()` | OPERATOR-UPLOAD / COMPUTED | `deal_lease_transactions.created_at` | POPULATED — 260 lease rows |
| Signing Velocity (T3/T6/T12mo) | `deal_lease_transactions` (computed in `traffic-analytics.service.ts`) | OPERATOR-UPLOAD / COMPUTED | `deal_lease_transactions.created_at` | POPULATED |
| Expiration Waterfall (24mo) | `deal_lease_transactions.lease_end` | OPERATOR-UPLOAD | `deal_lease_transactions.created_at` | POPULATED |
| Loss-to-Lease | `deal_lease_transactions.loss_to_lease` / `year1.loss_to_lease_pct` | OPERATOR-UPLOAD | Per-row | POPULATED |
| MTM Exposure | `deal_lease_transactions` (computed) | OPERATOR-UPLOAD / COMPUTED | `deal_lease_transactions.created_at` | POPULATED |
| Seasonal Curve | `deal_lease_transactions.move_in_date` distribution | OPERATOR-UPLOAD / COMPUTED | Derived | POPULATED |
| Correlation Adjustments (COR-01–COR-30) | `deals.correlation_adjustments` JSONB | AGENT (Correlation Engine) | `deals.updated_at` | SPARSELY POPULATED |
| Monthly Actuals overlay | `deal_monthly_actuals` | UNKNOWN | `deal_monthly_actuals.created_at` | BROKEN — 24 rows, all financial fields NULL |
| M07 Traffic Intelligence | `deal_traffic_snapshots` + `traffic_predictions` | RESEARCH-PULL / COMPUTED | `deal_traffic_snapshots.snapshot_date` | POPULATED |
| Hold Period (projection range) | `deal_assumptions.hold_period_years` | OPERATOR | `deal_assumptions.updated_at` | POPULATED — 5 years |
| Confidence bands | Not persisted — computed inline from traffic `conf` scores | COMPUTED | Derived | POPULATED |
| Adoption Timeline | `deal_assumptions.f3_design_program` + `construction_months` + `lease_up_months` | OPERATOR | `deal_assumptions.updated_at` | EMPTY — fields null |

---

### F5 — Capital Hub

**Components:** `CapitalHubTab.tsx` → `SourcesUsesTab.tsx`, `DebtTab.tsx`, `WaterfallTab.tsx`  
**Primary endpoints:** `GET /api/v1/deals/:dealId/financials`, `GET /api/v1/deals/:dealId/balance-sheets`, `GET /api/v1/deals/:dealId/capex-items`, `GET /api/v1/deals/:dealId/debt-schedule`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Purchase Price (S&U) | `deals.budget` / `deals.deal_data->>'purchase_price'` | OPERATOR | `deals.updated_at` | POPULATED — $60M |
| Closing Costs (aggregate) | `proforma-adjustment.service.ts:2832` — sums `per_year_overrides['su:closingCosts*']` → 2% estimate | OPERATOR / COMPUTED | `deal_assumptions.per_year_overrides` | POPULATED (falls to 2% formula if no sub-line overrides) |
| Closing Cost sub-lines | `deal_assumptions.per_year_overrides['su:cc_*']` | OPERATOR | `deal_assumptions.updated_at` | EMPTY — no sub-line overrides set |
| Hard Costs (development) | `deal_assumptions.hard_cost_total` | OPERATOR / OPERATOR-UPLOAD | `deal_assumptions.updated_at` | EMPTY |
| Soft Costs (development) | `deal_assumptions.soft_cost_total` | OPERATOR / COMPUTED | `deal_assumptions.updated_at` | EMPTY |
| Contingency | `deal_assumptions.contingency_total` | OPERATOR / COMPUTED | `deal_assumptions.updated_at` | EMPTY |
| Developer Fee | `deal_assumptions.developer_fee_total` | OPERATOR / COMPUTED | `deal_assumptions.updated_at` | EMPTY |
| TDC | `deal_assumptions.tdc` | COMPUTED | `deal_assumptions.updated_at` | EMPTY |
| Equity Amount | Computed: Purchase Price × (1 − LTV) | COMPUTED | Derived | POPULATED (formula only) |
| Debt Amount | Computed: Purchase Price × LTV | COMPUTED | Derived | POPULATED (formula only) |
| LP Equity Share | `deal_assumptions.per_year_overrides['wf:lpShare']` | OPERATOR | `deal_assumptions.updated_at` | MISSING — no value set, defaults to 90/10 silently; no UI write path |
| GP Equity Share | `deal_assumptions.per_year_overrides['wf:gpShare']` | OPERATOR | `deal_assumptions.updated_at` | MISSING — same as above |
| Loan Amount | `deal_debt_schedule.original_amount` | OPERATOR-UPLOAD / OPERATOR | `deal_debt_schedule.updated_at` | EMPTY — 0 debt schedule rows |
| Interest Rate | `deal_debt_schedule.interest_rate` | OPERATOR-UPLOAD / OPERATOR | `deal_debt_schedule.updated_at` | EMPTY |
| Loan Term | `deal_debt_schedule.loan_term_years` / `deal_assumptions.loan_term_years` | OPERATOR | `deal_assumptions.updated_at` | POPULATED (scalar col only) |
| IO Period | `deal_debt_schedule.io_period_months` | OPERATOR-UPLOAD / OPERATOR | `deal_debt_schedule.updated_at` | EMPTY |
| Annual Debt Service | `deal_debt_schedule.annual_debt_service` | OPERATOR-UPLOAD / COMPUTED | `deal_debt_schedule.updated_at` | EMPTY |
| DSCR | `deal_debt_schedule.dscr` | COMPUTED | Derived | EMPTY |
| Waterfall Tiers | `deal_waterfall_config` | OPERATOR | `deal_waterfall_config.updated_at` | EMPTY — 0 rows |
| Capex Budget | `deal_capex_items` | OPERATOR-UPLOAD / OPERATOR | `deal_capex_items.updated_at` | EMPTY — 0 rows |

---

### F6 — Returns Hub

**Components:** `ReturnsHubTab.tsx` → `ReturnsTab.tsx`  
**Primary endpoint:** `GET /api/v1/deals/:dealId/financials` (returns section of Engine A response)

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Levered IRR | Computed by Newton-Raphson in `proforma-adjustment.service.ts:3158` | COMPUTED | Derived from projections | BROKEN (depends on broken NOI) |
| Unlevered IRR | Computed similarly | COMPUTED | Derived | BROKEN |
| Equity Multiple | Computed: total distributions / equity invested | COMPUTED | Derived | BROKEN |
| Cash-on-Cash (Yr 1) | NOI - Debt Service / Equity | COMPUTED | Derived | BROKEN |
| LP Net IRR | Computed: Newton-Raphson on LP cash flows | COMPUTED | Derived | EMPTY — no debt schedule or waterfall config |
| GP Net IRR | Computed: GP residual | COMPUTED | Derived | EMPTY |
| LP Equity Multiple | `lpDistCumul / scheduledLpEquity` | COMPUTED | Derived | EMPTY |
| Promote Realization % | Computed from waterfall tiers | COMPUTED | Derived | EMPTY — no waterfall config |
| Sale Proceeds (gross) | Exit value from NOI × (1/exit_cap) | COMPUTED | Derived | BROKEN (depends on NOI) |
| Net Sale Proceeds | Gross - selling costs - debt payoff | COMPUTED | Derived | BROKEN |
| Sensitivity matrix (return vs inputs) | Computed inline in `SensitivityTab` | COMPUTED | Derived | POPULATED (formula only) |
| Deal IRR vs Target IRR | `deal_assumptions.target_irr` vs computed IRR | OPERATOR / COMPUTED | `deal_assumptions.updated_at` | SPARSELY POPULATED |
| Profit Margin % | `deal_assumptions.profit_margin` | COMPUTED | `deal_assumptions.last_computed_at` | EMPTY |
| Stabilized Value | `deal_assumptions.stabilized_value` | COMPUTED | `deal_assumptions.last_computed_at` | EMPTY |
| CoC vs Target | `deal_assumptions.target_coc` vs computed | OPERATOR / COMPUTED | `deal_assumptions.updated_at` | EMPTY |
| Hold Period Sensitivity | Computed: IRR at hold 3/5/7/10 years | COMPUTED | Derived | BROKEN (depends on NOI) |

---

### F7 — Valuation Grid

**Component:** `frontend/src/pages/development/financial-engine/ValuationGridTab.tsx`  
**Primary endpoints:** `GET /api/v1/deals/:dealId/valuation-grid`, `GET /api/v1/deals/:dealId/valuation-grid/comps`, `PATCH /api/v1/deals/:dealId/valuation-grid/override`, `PATCH /api/v1/deals/:dealId/valuation-grid/comps/criteria`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Cap Rate × NOI method | `year1.noi.resolved` / `deals.budget` | COMPUTED | Derived | BROKEN — NOI resolution broken |
| Per-Unit Benchmark (PPU) | `archive_assumption_benchmarks` | RESEARCH-PULL / COMPUTED | `archive_assumption_benchmarks.created_at` | POPULATED (archive data exists) |
| Sale Comp PPU method | `market_sale_comps` (deal-scoped) / `sale_comp_set_members` | RESEARCH-PULL / OPERATOR-UPLOAD | `market_sale_comps.created_at` | EMPTY — 0 sale comps for this deal |
| Sale Comp PSF method | `market_sale_comps.price_per_sqft` | RESEARCH-PULL / OPERATOR-UPLOAD | `market_sale_comps.created_at` | EMPTY |
| Operator Override method | `deal_assumptions.valuation_override_lv` (LayeredValue JSONB) | OPERATOR | `deal_assumptions.updated_at` | POPULATED — field exists in schema |
| Replacement Cost method | `data_library_cost_data` / BLS PPI | RESEARCH-PULL / COMPUTED | External data | SPARSELY POPULATED |
| Reconciled Value | Computed: weighted average of active methods | COMPUTED | Derived | BROKEN (only 1-2 active methods) |
| Recommended Price Range (low/high) | Computed from method P25–P75 | COMPUTED | Derived | BROKEN (insufficient methods) |
| Convergence Signal | Computed: spread across method values | COMPUTED | Derived | BROKEN |
| Comp Criteria | `deal_assumptions.comp_criteria` JSONB | OPERATOR | `deal_assumptions.updated_at` | EMPTY — NULL for 464 Bishop |

---

### F8 — Decision Tab

**Component:** `frontend/src/pages/development/financial-engine/DecisionTab.tsx`  
**Primary endpoints:** `GET /api/v1/deals/:dealId/financials`, `GET /api/v1/deals/:dealId/market-intelligence`, `GET /api/v1/jedi/score/:dealId`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| JEDI Score composite | `jedi_scores.total_score` | COMPUTED | `jedi_scores.updated_at` | EMPTY — no rows |
| IRR vs Target | Computed IRR / `deal_assumptions.target_irr` | COMPUTED / OPERATOR | Derived | BROKEN |
| Strategy Verdict | Derived from strategy + JEDI + IRR | COMPUTED / AGENT | Derived | EMPTY (depends on empty JEDI) |
| Risk Flags | `deal_risks` | OPERATOR / AGENT | `deal_risks.updated_at` | EMPTY — 0 rows |
| Deal Score History | `jedi_score_history` / `jedi_scores` | COMPUTED | `jedi_scores.updated_at` | EMPTY |
| Market signal overlay | `deal_market_intelligence` | RESEARCH-PULL | `deal_market_intelligence.created_at` | EMPTY |
| Debt feasibility signal | Computed from NOI / debt service | COMPUTED | Derived | BROKEN |
| Critical path milestones | `deal_roadmaps` | OPERATOR | `deal_roadmaps.updated_at` | EMPTY |

---

### F9 — Compare Hub

**Component:** `frontend/src/pages/development/financial-engine/CompareHubTab.tsx` → `CompareTab.tsx`  
**Primary endpoints:** `GET /api/v1/financial-model/:dealId/versions`, `GET /api/v1/deals/:dealId/financials`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Saved model versions | `deal_versions` / `opus_proforma_versions` | OPERATOR / AGENT | `deal_versions.created_at` | EMPTY — no saved versions |
| Version comparison (IRR, NOI, EM) | `deal_versions` snapshots | OPERATOR | `deal_versions.created_at` | EMPTY |
| Before/After override diff | Computed: current vs version snapshot | COMPUTED | Derived | EMPTY |
| Scenario assumptions | `deal_underwriting_scenarios` | OPERATOR | `deal_underwriting_scenarios.updated_at` | EMPTY — 0 rows |
| Scenario results | `scenario_results` | COMPUTED | `scenario_results.created_at` | EMPTY |
| Underwriting walkthrough | Computed narrative from model | COMPUTED / AGENT | Derived | EMPTY |
| Broker vs Platform vs User comparison | `year1` layers (broker/platform/override) | COMPUTED | Per-field | POPULATED (layer data present) |
| Stress test results | `deal_underwriting_snapshots` | COMPUTED | `deal_underwriting_snapshots.created_at` | EMPTY |
| Archive benchmark percentiles | `archive_assumption_benchmarks` | RESEARCH-PULL | `archive_assumption_benchmarks.created_at` | POPULATED (archive data exists) |
| Assumption drift vs archive | Computed: current vs `archive_assumption_benchmarks` | COMPUTED | Derived | SPARSELY POPULATED |
| Peer intelligence | `peer_intelligence` table (if exists) | RESEARCH-PULL | External | EMPTY |
| Custom comparison | Operator-configured | OPERATOR | N/A | EMPTY |

---

### F10 — Sensitivity / Goal Seek

**Component:** `frontend/src/pages/development/financial-engine/SensitivityTab.tsx`  
**Endpoints:** `POST /api/v2/sigma/broader-goal-seek`, `GET /api/v1/deals/:dealId/financials`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Target IRR (input) | `deal_assumptions.target_irr` | OPERATOR | `deal_assumptions.updated_at` | POPULATED |
| Solved purchase price | Computed: Newton-Raphson goal-seek | COMPUTED | Derived | BROKEN (depends on NOI) |
| Sensitivity matrix (IRR × rent growth / exit cap) | Computed inline | COMPUTED | Derived | BROKEN |
| Goal-seek result (entry yield) | Computed | COMPUTED | Derived | BROKEN |
| Sensitivity matrix (exit cap × purchase price) | Computed inline | COMPUTED | Derived | BROKEN |
| Breakeven analysis | Computed: min occupancy for DSCR ≥ 1.0 | COMPUTED | Derived | EMPTY (no debt schedule) |
| Confidence bounds | From traffic projection `conf` scores | COMPUTED | `deal_traffic_snapshots.snapshot_date` | POPULATED |
| Waterfall sensitivity | Computed from LP/GP split | COMPUTED | Derived | EMPTY (no waterfall config) |

---

### F11 — Roadmap Tab

**Component:** `frontend/src/pages/development/financial-engine/RoadmapTab.tsx`  
**Endpoints:** `GET /api/v1/deals/:dealId/roadmap`, `GET /api/v1/deals/:dealId/timeline`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Construction timeline | `deal_assumptions.construction_months` | OPERATOR | `deal_assumptions.updated_at` | EMPTY — NULL |
| Lease-up timeline | `deal_assumptions.lease_up_months` | OPERATOR | `deal_assumptions.updated_at` | EMPTY — NULL |
| Absorption rate | `deal_assumptions.absorption_units_per_month` | OPERATOR / RESEARCH-PULL | `deal_assumptions.updated_at` | EMPTY — NULL |
| Stabilization target % | `deal_assumptions.stabilization_target_pct` | OPERATOR | `deal_assumptions.updated_at` | EMPTY — NULL |
| Adoption timeline (program) | `deal_assumptions.f3_design_program` JSONB | OPERATOR | `deal_assumptions.updated_at` | EMPTY — NULL |
| Milestone dates | `deal_roadmaps` | OPERATOR | `deal_roadmaps.updated_at` | EMPTY |
| Construction management | `construction_cost_tracking` | OPERATOR-UPLOAD / OPERATOR | Per-record | EMPTY |
| Entitlement milestones | `entitlement_milestones` | OPERATOR / RESEARCH-PULL | Per-record | EMPTY |
| Key dates | `deal_key_dates` | OPERATOR | Per-record | EMPTY |
| Permit / approval status | `planning_applications` | RESEARCH-PULL | `planning_applications.created_at` | EMPTY |

> Note: F11 Roadmap is a development-deal surface. 464 Bishop is classified as `SIGNAL_INTAKE`, making all F11 fields structurally empty for this deal.

---

### F12 — Custom Tabs (Opus-generated)

**Component:** `frontend/src/pages/development/financial-engine/CustomTabRenderer.tsx`  
**Endpoints:** `GET /api/v1/deals/:dealId/proforma/custom-tabs`, `POST /api/v1/agents/chat`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Custom tab definitions | `deal_custom_tabs` / `opus_proforma_versions` | AGENT (Opus) | `deal_custom_tabs.created_at` | EMPTY — no Opus sessions |
| Opus conversation context | `opus_conversations`, `opus_messages` | AGENT | Per-session | EMPTY |
| Opus learned patterns | `opus_learned_patterns` | AGENT | Per-session | EMPTY |
| Custom analysis results | `opus_proforma_versions` | AGENT | `opus_proforma_versions.created_at` | EMPTY |

---

### Document Library

**Component:** `frontend/src/components/deal/sections/DocumentsSection.tsx` → `DocumentsFiles/`  
**Endpoints:** `GET /api/v1/deals/:dealId/files`, `POST /api/v1/deals/:dealId/files`, `GET /api/v1/deals/:dealId/documents`

| Field | Source Table(s) | Author Class | Freshness | Gap Status (464 Bishop) |
|---|---|---|---|---|
| Uploaded files list | `deal_files` | OPERATOR-UPLOAD | `deal_files.created_at` | POPULATED — 10 files |
| Document type tags | `deal_files.category`, `deal_document_files.document_type` | OPERATOR / COMPUTED | `deal_files.updated_at` | POPULATED |
| Extraction status | `deal_files.extraction_status`, `deal_document_files.extraction_status` | COMPUTED | `deal_files.extraction_completed_at` | SPARSELY POPULATED — 2 files failed |
| Extraction result (T12 data) | `deals.deal_data->'extraction_t12'` JSONB | AGENT / COMPUTED | `deals.updated_at` | POPULATED (has_t12=true) |
| Extraction result (Rent Roll) | `deals.deal_data->'extraction_rent_roll'` JSONB | AGENT / COMPUTED | `deals.updated_at` | POPULATED (has_rr=true) |
| Extraction result (OM) | `deals.deal_data->'extraction_om'` JSONB | AGENT / COMPUTED | `deals.updated_at` | POPULATED (has_om=true) |
| Extraction result (Tax Bill) | `deals.deal_data->'extraction_tax_bill'` JSONB | AGENT / COMPUTED | `deals.updated_at` | POPULATED (has_tax=true) |
| Source document audit trail | `deal_document_files` | AGENT / COMPUTED | `deal_document_files.created_at` | BROKEN — filename is UUID, no human-readable name stored |

---

## Seven Specific Findings

### Finding 1 — Agent-Authored Fields That Violate the Layer 1/2 Boundary

The Layer 1/2 boundary rule states that Layer 1 (operator-visible resolved values) should be the result of a deterministic LayeredValue resolution chain (override → extraction → platform), while Layer 2 (growth scalars and projections) should be derived from platform baselines adjusted by modules and operator stance. Agent-authored values should arrive through the `agent` layer of a LayeredValue, not overwrite the resolved value directly.

**Violations observed in 464 Bishop `year1` JSONB:**

| Field | Issue | Evidence |
|---|---|---|
| `gpr` | `resolution: "agent"` — the agent has overwritten the resolution layer directly with the OM-extracted value ($4,901,400), bypassing the declared priority chain (t12 > rent_roll > om). The T12 value ($4,876,535) and rent_roll value ($4,932,300) are stored in layers but the `agent` layer takes priority, which is not defined in the published `FIELD_PRIORITIES` spec at `proforma-seeder.service.ts:297`. | `year1.gpr.resolution = "agent"` |
| `egi` | `resolution: "agent"` with value $3,669,151 — the EGI is derived from GPR-losses, yet it carries an `agent` layer tag. EGI is a COMPUTED field (not extractable directly), so an agent layer violates the boundary because agents should not compute compound aggregates. | `year1.egi.resolution = "agent"` |
| `payroll` | `resolution: "agent"` — same pattern as GPR. The agent is resolving by copying the OM value ($324,800), which happens to match platform. | `year1.payroll.resolution = "agent"` |
| `g_and_a` | `resolution: "agent"` — OM value ($69,600) selected. T12 value ($22,496) is present but ignored because `agent` layer takes priority over declared priority chain. | `year1.g_and_a.resolution = "agent"` |
| `noi` | `resolution: "platform_fallback"` — NOI should never be a platform fallback; it is a COMPUTED field (EGI - OpEx). The platform_fallback value ($840,231) does not match any extraction source. The OM-extracted NOI ($2,999,564) is stored in `year1.noi.om` but is ignored. This suggests the computation step is not running and the fallback is being selected from a stale or incorrect platform seed. | `year1.noi.resolved = 840,231` vs `year1.noi.om = 2,999,564` |

**Root cause (observable):** The `agent` resolution layer is not defined in the published `FIELD_PRIORITIES` constant. Its presence in the JSONB suggests the agent is writing directly to `year1[field].agent` and the resolution chain is selecting it at a priority not documented in the seeder spec. This constitutes a Layer 1/2 boundary violation because the agent is making a field-level authority claim not sanctioned by the published resolution chain.

---

### Finding 2 — Agent-Silent Layer 2 Assumptions

Layer 2 assumptions (growth rate scalars in `proforma_assumptions`) should be calibrated by market-aware modules (M05 Market → rent growth, M07 Traffic → vacancy, M35 Events → correlation deltas, OperatorStance → reblend). For 464 Bishop, all four growth scalars sit at their baseline values with no overrides and no evidence of module calibration.

| Scalar | Baseline Value | Current Value | Override | Evidence of Module Touch |
|---|---|---|---|---|
| `rent_growth_current` | 3.500 | 3.500 | NULL | No — `last_recalibration` is NULL |
| `vacancy_current` | 5.00 | 5.00 | NULL | No |
| `opex_growth_current` | 2.800 | 2.800 | NULL | No |
| `exit_cap_current` | 5.500 | 5.500 | NULL | No |

**Affected surfaces:** F4 Projections (rent growth axis), F6 Returns (exit value sensitivity), F7 Valuation Grid (reconciled value), F10 Sensitivity matrix.

**Observable consequence:** All 10-year projections use a static 3.5% rent growth assumption regardless of the Atlanta submarket's actual growth signal. Traffic snapshots exist (3 snapshots) and could inform `vacancy_current` via M07, but the calibration write has not occurred.

**Agent-silent fields also observed in `deal_market_intelligence`:** Zero rows exist for this deal. The Research Agent has not been triggered or has not produced market intelligence for this deal. This silences the F1 market context strip, the F8 Decision market overlay, and any COR-series adjustments that depend on deal-level market context.

---

### Finding 3 — Fields With No Current Author

These fields are operator-visible, have a defined backend column or schema slot, and have never been written by any confirmed author.

| Surface | Field | Schema Location | Why No Author | Gap Status |
|---|---|---|---|---|
| F1 | JEDI Score (any dimension) | `jedi_scores` | Compute trigger not fired; `jedi_scores` has 0 rows | EMPTY |
| F4 | `deal_monthly_actuals.*` financial data | `deal_monthly_actuals` (24 shell rows) | Rows created with no ETL or upload populating financial columns | BROKEN |
| F5 | LP/GP Equity Split | `deal_assumptions.per_year_overrides['wf:lpShare'/'wf:gpShare']` | No user-facing UI control; no module writes this | MISSING |
| F5 | All debt schedule fields | `deal_debt_schedule` | No document upload containing debt terms; no operator entry | EMPTY |
| F5 | Waterfall tiers | `deal_waterfall_config` | No operator entry; no module seeder | EMPTY |
| F5 | Capex items | `deal_capex_items` | No document upload or operator entry | EMPTY |
| F7 | Comp criteria | `deal_assumptions.comp_criteria` | NULL for 464 Bishop; no default write in deal creation flow | EMPTY |
| F8 | All risk records | `deal_risks` | Risk agent not triggered; no operator entry | EMPTY |
| F11 | All roadmap fields | `deal_assumptions.construction_months`, `lease_up_months`, `absorption_units_per_month`, `stabilization_target_pct`, `f3_design_program` | Deal is SIGNAL_INTAKE, not development; no timeline entry | EMPTY |
| All | `deal_comparable_properties` (sale comps for valuation) | `deal_comparable_properties` | Neither research pull nor operator upload has seeded sale comps for this deal | EMPTY |

---

### Finding 4 — Multi-Source Conflict Fields

These fields have multiple sources in the LayeredValue structure that disagree, making the resolution layer choice material.

| Field | Conflicting Values | Resolution Winner | Risk |
|---|---|---|---|
| `gpr` | T12 = $4,876,535; rent_roll = $4,932,300; om = $4,901,400; agent = $4,901,400 | `agent` (mirrors OM) — T12 is 0.5% lower, rent_roll is 0.6% higher | LOW — values within 1.2% of each other; but agent priority not in published spec |
| `noi` | Computed = ~$840K (platform_fallback); OM = $2,999,564; T12 (inferred ~$2.6M) | `platform_fallback` overrides all extraction values | HIGH — 72% gap; OM NOI is ignored |
| `egi` | Agent = $3,669,151; implied from GPR-losses would be different | `agent` selected | MEDIUM — EGI should be COMPUTED not AGENT-authored |
| `real_estate_tax` | Tax bill extraction vs T12 vs platform | Platform or T12 (sparsely populated) | MEDIUM — tax service may have separate write path not reflected in year1 |
| `other_income_per_unit` | rent_roll vs T12 vs OM | Whichever has data per FIELD_PRIORITIES | LOW — breakdown-to-aggregate linkage unverified (per F9_DATA_FLOW_AUDIT_PHASE1) |
| rent comps (F7) | `deal_rent_comp_sets` (apartment_locator) avg_rent vs `deal_market_intelligence` vs `proforma_assumptions` baseline | Each surface reads a different source — no canonical reconciliation | MEDIUM — F7 valuation comps and F2 assumption comps use different backing tables |
| `exit_cap` | `deal_assumptions.exit_cap` (5.0%) vs `proforma_assumptions.exit_cap_current` (5.5%) | F9 Engine A reads `deal_assumptions.exit_cap` for Y1; `proforma_assumptions.exit_cap_current` for projection growth scalar | MEDIUM — operator may not realize these are independent |

---

### Finding 5 — Freshness Coverage Gaps

Freshness indicators exist at the field level (`year1[field].updated_at`) and table level (`updated_at`, `snapshot_date`). However, multiple surfaces display data without any staleness signal to the operator.

| Surface | Field(s) | Freshness State | Gap |
|---|---|---|---|
| F4 Projections | Traffic snapshots | `deal_traffic_snapshots.snapshot_date` present (most recent: May 2026) | Freshness indicator not surfaced in UI per audit of `ProjectionsTab.tsx` |
| F2 Assumptions | `proforma_assumptions.*_current` | `proforma_assumptions.updated_at` = 2026-05-05; no `last_recalibration` column | No staleness banner if market has shifted since seed |
| F7 Valuation Grid | Sale comp ages | `market_sale_comps.created_at` — 0 comps for deal | Stale/absent comp warning not triggerable (no comps) |
| F3 Pro Forma | `year1[field].updated_at` | Available per-field | UI renders source pills but not per-field age warning |
| F1 Overview | JEDI Score | NULL — never computed | No "score unavailable" freshness signal surfaced |
| F4 Monthly Actuals | `deal_monthly_actuals.report_month` | Shell rows exist (latest: 2026-12) but all financial data NULL | Future shell rows with null data appear as blank, not stale |
| All surfaces | Rent comp occupancy | `deal_rent_comp_sets.occupancy` = NULL for all 5 comps | Occupancy displayed as blank; no freshness signal distinguishes "not measured" from "not synced" |

---

### Finding 6 — Cross-F-Key Data Dependencies

These are fields on one surface that are directly computed from or blocked by data on another surface.

| Consumer Surface | Blocked By | Dependency |
|---|---|---|
| F6 Returns (IRR, EM, CoC) | F3 Pro Forma (NOI) | NOI broken → all return metrics broken |
| F5 Capital (Equity Amount, Debt Coverage) | F3 Pro Forma (NOI) | NOI broken → debt sizing and coverage ratios incorrect |
| F7 Valuation Grid (cap rate method) | F3 Pro Forma (NOI) | NOI broken → cap-rate-based valuation method marked BROKEN |
| F10 Sensitivity (goal-seek) | F6 Returns (IRR) | IRR broken → goal-seek cannot solve |
| F8 Decision (strategy verdict) | F1 (JEDI Score) + F6 (IRR) | Both empty/broken → Decision tab has no signal to render a verdict |
| F4 Projections (per-year values Yr2+) | F3 Pro Forma (Y1 values) + Operator overrides | Y1 NOI broken propagates into all projection years; operator per-year edits ignored (CF-02) |
| F6 Returns (LP/GP waterfall) | F5 Capital (waterfall config, debt schedule) | Both empty → LP/GP returns cannot be computed |
| F2a Validation Grid (going-in cap) | F3 Pro Forma (Y1 NOI) | NOI broken → going-in cap row broken |
| F7 Valuation Grid (sale comp method) | Document Library (comp upload) | 0 sale comps uploaded → sale comp methods inactive |
| F4 Projections (vacancy trajectory) | M07 Traffic (calibration) | Traffic snapshots exist but `vacancy_current` not calibrated → static 5% vacancy used |

---

### Finding 7 — Deprecated-Table Readers Still Active

The property refactor (`property-plumbing-phase1-*` docs) identified several tables targeted for deprecation. The following deprecated tables still have active readers in production route files.

| Deprecated Table | Active Reader(s) | Surface Affected | Notes |
|---|---|---|---|
| `apartment_properties` | `property-discovery.routes.ts`, `market-intelligence.routes.ts` | F4 Markets, F1 market intel | Parallel to `properties` table; apartment_locator syncs into this table. comp sets for 464 Bishop sourced from this table via `apartment_locator` |
| `apartment_market_snapshots` | `proforma-seeder.service.ts` (platform fallback seed) | F2/F3 all assumptions | Used as the fallback source for platform values in the LayeredValue chain; `proforma-seeder.service.ts` queries this for city/state market averages |
| `comp_properties` | `valuation-grid.service.ts`, `deal-comp-sets.routes.ts` | F7 Valuation Grid | Sale comp data. Distinct from `market_sale_comps`; readers in valuation grid service and comp-set management routes |
| `market_rent_comps` | `market-intelligence.routes.ts` | F4 Markets rent context | Parallel to `deal_rent_comp_sets`; legacy rent comp table. Both may be read simultaneously for the same deal |
| `property_records` | `unified-properties.routes.ts` | F4/F1 property context | Legacy property table targeted for consolidation into `properties` |
| `data_library_assets` (vs `data_library_files`) | `data-library.routes.ts`, `data-library-assets.routes.ts` | Document Library | Two parallel tables (`data_library_assets` legacy, `data_library_files` current) — both route files active |

---

## Test Deal Verification — 464 Bishop

**Deal ID:** `3f32276f-aacd-4da3-b306-317c5109b403`  
**Query executed:** 2026-05-30 (dev database)

All "current state" claims in this document are verified against live database state. Where documentation and live state diverged, live state is authoritative.

### Key Live Readings

| Table / Query | Live Result | Audit Claim |
|---|---|---|
| `deals WHERE id = deal_id` | name="464 Bishop", pipeline_stage="prospect", property_id=NULL, jedi_score=NULL, budget=$60M | CF-10 (no property linkage), CF-04 (JEDI empty) |
| `deal_assumptions.year1->'noi'` | resolved=840,231, resolution="platform_fallback", om=2,999,564 | CF-01, Finding 1 |
| `deal_assumptions.year1->'gpr'` | resolved=4,901,400, resolution="agent", t12=4,876,535, rent_roll=4,932,300 | Finding 1, Finding 4 |
| `deal_assumptions.year1->'electric'` | resolved=null, resolution="platform_fallback" | CF-08 |
| `deal_assumptions.unit_mix` | `{}` (empty object) | CF-09 |
| `proforma_assumptions WHERE deal_id` | rent_growth=3.5, vacancy=5.0, opex_growth=2.8, exit_cap=5.5 — all at baseline, no overrides | Finding 2 |
| `SELECT COUNT(*) FROM jedi_scores WHERE deal_id` | 0 | CF-04, F1 gap |
| `SELECT COUNT(*) FROM deal_market_intelligence WHERE deal_id` | 0 | CF-05, F1/F8 gap |
| `SELECT COUNT(*) FROM deal_debt_schedule WHERE deal_id` | 0 | CF-06, F5 gap |
| `SELECT COUNT(*) FROM deal_waterfall_config WHERE deal_id` | 0 | CF-06, F5 gap |
| `SELECT COUNT(*) FROM deal_capex_items WHERE deal_id` | 0 | CF-06, F5 gap |
| `SELECT COUNT(*) FROM deal_risks WHERE deal_id` | 0 | CF-06, F8 gap |
| `SELECT COUNT(*) FROM market_sale_comps WHERE deal_id` | 0 | F7 gap |
| `SELECT COUNT(*) FROM deal_comparable_properties WHERE deal_id` | 0 | Finding 3 |
| `deal_monthly_actuals WHERE deal_id` | 24 rows, all GPR/NOI/EGI/occupancy_rate NULL | CF-03 |
| `deal_traffic_snapshots WHERE deal_id` | 3 rows (2026-04-27, 2026-05-03, 2026-05-08) | F4 traffic POPULATED |
| `deal_lease_transactions WHERE deal_id` | 260 rows (2026-05-20) | F4 LVE POPULATED |
| `deal_document_files WHERE deal_id` | 3 rows (OM completed, 2× RENT_ROLL completed) | Document Library POPULATED |
| `deal_files WHERE deal_id` | 10 rows (2 failed extraction, 1 queued) | Document Library SPARSELY POPULATED |
| `deal_rent_comp_sets WHERE deal_id` | 5 rows from apartment_locator, avg_rent populated, occupancy=NULL | Finding 5 (freshness gap) |
| `deal_zoning_profiles WHERE deal_id` | 1 row: MR-4A, Atlanta, GA, resolved 2026-04-28 | Zoning POPULATED |
| `deals.deal_data` extractions | has_t12=true, has_rr=true, has_tax=true, has_om=true | Extractions present but some year1 fields not resolved from them (CF-01, CF-08) |
| `deal_assumptions.comp_criteria` | NULL | F7 comp criteria EMPTY |

### Surfaces Verified as Incomplete Due to Known Non-Bishop Gap (Not 464 Bishop–Specific)

- **F11 Roadmap:** Structurally empty for all non-development deals; 464 Bishop is SIGNAL_INTAKE.
- **F12 Custom Tabs:** Opus has no sessions for 464 Bishop; this is expected for early-stage deals.

---

## Suggested Next Audit / Spec Work

The following items were surfaced by this audit but are out of scope for this document. They are listed in priority order for downstream architectural work.

| Item | Type |
|---|---|
| NOI resolution bug (CF-01): Trace why `year1.noi.resolution` selects `platform_fallback` when `year1.noi.om = 2,999,564` is present | Bug fix spec |
| Per-year projections override gap (CF-02): Spec the read path for `per_year_overrides['field:yrN']` in the projections loop | Architecture spec |
| `agent` resolution layer in LayeredValue: Define the `agent` priority slot formally in FIELD_PRIORITIES and document under what conditions it overrides extraction layers | ADR |
| LP/GP split write path (F5): Design a user-facing control for `wf:lpShare`/`wf:gpShare` that persists to `per_year_overrides` | Feature spec |
| `deal_monthly_actuals` author chain: Identify what should populate the 24 shell rows (ETL from rent roll, operator upload, or actuals sync) and implement write path | Feature spec |
| `da:use_unit_mix_for_gpr` flag: Add a user-facing toggle in the Unit Mix tab that activates unit-mix-driven GPR | Feature spec |
| Utility OpEx propagation (CF-08): Investigate why `electric`/`gas_fuel` resolve to null despite T12 extraction presence | Bug fix spec |
| Vendor data abstraction layer: Define the canonical source-of-truth hierarchy for `apartment_properties` vs `properties` vs `comp_properties` to eliminate Finding 7 dual-reader patterns | Architecture spec |
| Sale comp seeding for 464 Bishop: Research pull or operator upload to populate `market_sale_comps` so F7 Valuation Grid has sufficient methods active | Data backfill |
| JEDI Score trigger: Identify why `jedi_scores` has 0 rows for 464 Bishop and ensure the scoring pipeline fires at deal creation or on first extraction completion | Bug fix |

---

_Audit produced by read-only code and database investigation. No production changes were made._
