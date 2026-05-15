# Pro Forma Subsystem Audit — Phase 0

**Task:** #773  
**Date:** 2026-05-15  
**Auditor:** Agent (read-only; no code changes)  
**Scope:** Full pro forma subsystem — data sources, write paths, unit conventions, UI correspondence  
**Prior art:** `PROFORMA_MATH_AUDIT.md` (Task #662), `F9_DATA_FLOW_AUDIT_PHASE1.md`, `F9_TIER1_BLOCKERS_AUDIT.md`, `PROFORMA_SURFACE_AUDIT.md`, `CAPITAL_EXIT_SUBSYSTEM_AUDIT.md`

---

## Classification Legend

| Tag | Meaning |
|---|---|
| `SINGLE_WRITER` | Exactly one authoritative writer; read path is clean |
| `CONSISTENT` | Multi-writer but all writers agree on type/unit/table |
| `LAYERED` | LayeredValue resolution chain is present and wired |
| `WIRED` / `LIVE` | Connected end-to-end from storage through UI |
| `PARALLEL` | Two independent engines serve the same conceptual field |
| `MIXED` | Some writers correct, others stale or wrong |
| `FALLBACK` | No real data; static industry norm or hardcoded constant used |
| `HARDCODED` | Literal constant in code; no config, no DB, no override path |
| `DISPLAY_ONLY` | Stored in DB but never read by either live engine |
| `NOT_WIRED` | Module exists as code but has no live caller on production routes |
| `PHANTOM` | Column or key appears in display list but is never seeded |
| `RACE` | Two or more independent writers share a resource with no transaction boundary |
| `ON_MOCK_DATA` | UI renders; data source is a hardcoded stub returning nulls or placeholders |
| `STRUCTURALLY_MISALIGNED` | Unit, type, or convention mismatch between writer and reader |

---

## Executive Summary

The Pro Forma subsystem has three storage tables, two parallel live computation engines, and one LLM-gated deterministic path — none of which share a transaction boundary. The most urgent structural problem is **PF-01**: `getDealFinancials` (deal-assumptions endpoint) and `composeDealFinancials` (financials endpoint) are independent assemblies that read the same `deal_assumptions.year1` JSONB but apply different business logic, return different shapes, and are served on different routes without a documented contract about which the frontend should call for what. Until this is resolved, any fix applied to one engine silently does not apply to the other.

Six high-severity findings that block accurate financial output:

1. **PF-02** — Per-year operator overrides (`payroll:yr2`, `gpr:yr2`, etc.) are persisted to `deal_assumptions.per_year_overrides` but the projections loop in `getDealFinancials` re-derives every year from Y1 × compound growth rate, ignoring them. Operator edits to individual projection years appear to save but revert on refresh.
2. **PF-04** — `proforma_assumptions` (5-scalar adjustment table) and `deal_assumptions.year1` (full LayeredValue JSONB) are written by independent services with no transaction boundary. A concurrent recalculation and override can leave the two tables in a contradictory state.
3. **PF-05** — Unit convention split: `proforma_assumptions` stores whole-percent (3.0 = 3 %); the LayeredValue JSONB, the deterministic runner, and the templates all use decimal (0.03 = 3 %). The conversion is applied correctly at read time in `getDealFinancials` (÷ 100) but this is a silent convention that any new writer can break.
4. **PF-07** — `proforma-projection.service.ts` (the Tier 1–3 layered-growth engine: five-component rent growth, nine-line OPEX, three revenue formulas) is imported **only in test files** and has no live caller in any production route. Its outputs are never used to compute F9 values.
5. **PF-03** — `bad_debt_pct` display row uses `GPR × bad_debt_pct` as multiplier; seeder applies bad debt against `(NRI + other_income)`. Dollar display is materially larger than the amount actually deducted from EGI.
6. **PF-13** — `concessions = 0` hardcoded in `proforma-assumptions-bridge.ts:241`. The seeder correctly resolves `concessions_pct` via LayeredValue, but that value never reaches the deterministic runner via the LLM (financial-model) path.

---

## Architecture Map

### Storage Tables

| Table | Owner service(s) | Convention | Live readers |
|---|---|---|---|
| `proforma_assumptions` | `proforma-adjustment.service.ts` (class) | **whole-pct** (3.0 = 3 %) | `getDealFinancials` (reads and ÷ 100), `proforma.routes.ts` |
| `deal_assumptions.year1` | `proforma-seeder.service.ts`, `applyFinancialsOverride`, `applyUnitMixOverride` | **decimal** (0.03 = 3 %) in LayeredValue | `getDealFinancials`, `composeDealFinancials` |
| `deal_assumptions` (scalar cols) | Legacy insertion at deal creation; never updated | **whole-pct** (5.00 = 5 %) | **Neither live engine** — columns are DISPLAY_ONLY |
| `proforma_templates` | `proforma-template.service.ts` | **decimal** (0.03 = 3 %) | **Neither live engine** — template rows are never applied |
| `deal_versions` | `deal-versions.service.ts` | n/a — blob snapshot | `financial-model.routes.ts` (LLM path only) |

### Computation Engines

| Engine | Entry point | Route | Reads | Produces |
|---|---|---|---|---|
| **Engine A** (F9 main) | `getDealFinancials()` | `GET /api/v1/deal-assumptions/:dealId` | `deal_assumptions.year1` + `proforma_assumptions` growth scalars | `year1Rows`, inline projections, returns, debt metrics |
| **Engine B** (financials) | `composeDealFinancials()` | `GET /api/v1/deals/:dealId/financials` | `deal_assumptions.year1` only — ignores `proforma_assumptions` | `proforma.year1` OSRows, traffic stub, concession recognition |
| **Engine C** (LLM / deterministic) | `financialModelEngine.buildModel()` | `POST /api/v1/financial-model` | `ProFormaAssumptions` envelope (LLM JSON) → bridge → runner | Full `ModelResults` cached separately; never merged to `deal_assumptions` |
| **Engine D** (orphaned Tier 1–3) | `projectProforma()` | **none** — test-only import | `ProjectionInputs` struct | `ProjectionResult` — dead code path in production |

---

## Module-by-Module Audit

### Q1 Data Source · Q2 Write Path · Q3 Unit Convention · Q4 UI Correspondence

---

### 1. Gross Potential Rent (GPR)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.gpr` LayeredValue; priority: override → t12 → rent_roll → platform baseline (city/state `apartment_market_snapshots`) | `LAYERED` |
| **Q2 Write path** | `proforma-seeder.service.ts:496` `resolve('gpr', gpr_platform, {t12, rent_roll, om, existingOverride})`. User override via `PATCH /financials/override` → `applyFinancialsOverride`. Unit mix path gated by `da:use_unit_mix_for_gpr` flag (never set by UI). | `SINGLE_WRITER` (seeder); `RACE` risk when user override and reseed concurrent |
| **Q3 Units** | Annual dollars. Seeder converts `gpr_monthly` (rent roll) × 12. Platform baseline = `avg_rent_per_unit_month × totalUnits × 12`. Decimal LayeredValue. | `CONSISTENT` |
| **Q4 UI** | ProFormaSummaryTab renders `year1.gpr.resolved`. AssumptionsTab shows per-source layers. | `WIRED` |

**Notes:**
- Unit mix GPR derivation (`useUnitMixForGpr`) has no UI toggle to activate it — edits to the Unit Mix Tab do not affect GPR unless the `da:use_unit_mix_for_gpr` flag is manually set via raw PATCH API. See **PF-08**.
- Projection years 2–N use `gprY1 × rentMult` (compound growth) ignoring `per_year_overrides['gpr:yr2']` etc. See **PF-02**.

---

### 2. Loss to Lease (LTL)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.loss_to_lease_pct` LayeredValue; priority: t12 → rent_roll | `LAYERED` |
| **Q2 Write path** | `proforma-seeder.service.ts`, user override via `applyFinancialsOverride` | `SINGLE_WRITER` |
| **Q3 Units** | Stored as decimal (0.003497 = 0.35 %). Display dollar row = LTL% × GPR. | `CONSISTENT` |
| **Q4 UI** | Dollar row `loss_to_lease` rendered in ProFormaSummaryTab revenue section. Math confirmed correct (PROFORMA_MATH_AUDIT §1). | `WIRED` |

---

### 3. Vacancy

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | **Four independent sources exist.** (a) `deal_assumptions.year1.vacancy_pct` LayeredValue (decimal). (b) `proforma_assumptions.vacancy_current` (whole-pct, e.g., 5.00). (c) `deal_assumptions.vacancy_pct` scalar column (whole-pct, never read). (d) `proforma_template.vacancyRate` (decimal, never applied). | `PARALLEL` + `STRUCTURALLY_MISALIGNED` |
| **Q2 Write path** | Seeder writes (a). Adjustment service writes (b). No writer ensures (a) and (b) are consistent with each other. | `RACE` |
| **Q3 Units** | (a) decimal; (b) whole-pct. getDealFinancials reads (b) and does NOT divide by 100 (confirmed: only opex_growth and rent_growth get the ÷ 100 treatment at lines 2562–2575). Needs verification that vacancy read from `proforma_assumptions` is handled correctly. | `STRUCTURALLY_MISALIGNED` — **PF-05** |
| **Q4 UI** | ProFormaSummaryTab renders `year1.vacancy_pct.resolved`. AssumptionsTab shows effective vacancy from `proforma_assumptions.vacancy_current`. Two panels can show different values for the same deal. | `PARALLEL` |

**Notes:**
- `buildVacancySchedule()` in the deterministic runner takes `vacancyY1` and `vacancyStab` as separate decimal inputs. The bridge maps `stabilizedOccupancy` → `vacancyStab = 1 − stabilizedOccupancy`, `vacancyY1 = vacancyStab` (conservative: no Y1 step-up). This means the LLM path always starts at stabilized vacancy regardless of actual lease-up status.

---

### 4. Concessions

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.concessions_pct` LayeredValue; priority: t12 → rent_roll | `LAYERED` |
| **Q2 Write path** | Seeder writes via `resolve('concessions_pct', ...)`. User override via `applyFinancialsOverride`. OperatorStance `leasingCostTreatment` modulates the concessions row in `composeDealFinancials` (CAPITALIZED → 0; HYBRID → partial). | `MIXED` |
| **Q3 Units** | Decimal (0.0778 = 7.78 %). Dollar row = concessions_pct × GPR. Math confirmed correct (PROFORMA_MATH_AUDIT §1). | `CONSISTENT` |
| **Q4 UI** | ProFormaSummaryTab renders dollar row. Stance modulation only in Engine B path. | `WIRED` in Engine B; `NOT_WIRED` in Engine C (bridge hardcodes `concessions = 0`) — **PF-13** |

---

### 5. Bad Debt

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.bad_debt_pct` LayeredValue; priority: t12 | `LAYERED` |
| **Q2 Write path** | Seeder writes. User override via `applyFinancialsOverride`. | `SINGLE_WRITER` |
| **Q3 Units** | Decimal (0.0334 = 3.34 %). | `CONSISTENT` |
| **Q4 UI** | **Display dollar row uses `GPR × bad_debt_pct`** (adj.service.ts:1964). Seeder applies bad debt against `(NRI + other_income)` not GPR. The dollar row in the UI is materially larger than the amount actually deducted from EGI. Confirmed on both 464 Bishop and Sentosa Epperson. | `STRUCTURALLY_MISALIGNED` — **PF-03** |

---

### 6. Non-Revenue Units (NRU)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.non_revenue_units_pct` LayeredValue; t12 only | `LAYERED` |
| **Q2 Write path** | Seeder only | `SINGLE_WRITER` |
| **Q3 Units** | Decimal. Dollar row = NRU% × GPR. | `CONSISTENT` |
| **Q4 UI** | Wired; resolves to $0 for most deals (no NRU in T12). | `WIRED` |

---

### 7. Other Income

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.other_income_per_unit` LayeredValue; priority: rent_roll → t12 → om | `LAYERED` |
| **Q2 Write path** | Seeder. Also `otherIncomeUserLines` table for custom user-added lines. | `MIXED` |
| **Q3 Units** | **Annual dollars per unit.** Display: `toDollarRow` multiplies by `totalUnits × 12`. If the seeded value was stored as monthly (an observed stale-cache pattern in 464 Bishop where seed was set to 904.14/unit — annual — but was re-multiplied by units × 12), display is 12× inflated. See PROFORMA_MATH_AUDIT MATH-02. | `STRUCTURALLY_MISALIGNED` — **PF-09** |
| **Q4 UI** | Ancillary breakdown panel (per-category: parking, RUBS, pet rent) is informational only; it does not feed back into `other_income_per_unit`. | `DISPLAY_ONLY` for breakdown; `WIRED` for aggregate |

---

### 8. Effective Gross Income (EGI)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | Computed: `(NRI + other_income) × (1 − bad_debt_pct)`. Also stored in seed as `deal_assumptions.year1.egi` LayeredValue when T12 provides it directly. | `LAYERED` + computed |
| **Q2 Write path** | Seeder + computed inline in `getDealFinancials`. | `CONSISTENT` |
| **Q3 Units** | Annual dollars. Math confirmed correct (PROFORMA_MATH_AUDIT §1). | `CONSISTENT` |
| **Q4 UI** | Rendered as OSRow. | `WIRED` |

---

### 9. Controllable OpEx Lines (Payroll, R&M, Turnover, Contract Services, Marketing, G&A, Utilities)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.<field>` LayeredValues; priority each: t12 → platform (state-adjusted NMHC norms). | `LAYERED` |
| **Q2 Write path** | Seeder (`FIELD_PRIORITIES` map). User override via `applyFinancialsOverride`. Projection years via inline loop (Y1 × `opexMult`). | `SINGLE_WRITER` (seeder); per-year override loop ignores `per_year_overrides['payroll:yr2']` etc. — **PF-02** |
| **Q3 Units** | Annual dollars (total, not per-unit). Seeder uses `OPEX_FIELDS_PER_UNIT × totalUnits`. LayeredValue decimal. | `CONSISTENT` |
| **Q4 UI** | All 7 lines wired to ProFormaSummaryTab via `CTRL_ORDER`. Math confirmed on both test deals (PROFORMA_MATH_AUDIT §2). | `WIRED` |

**Notes:**
- `landscaping` appears in `CTRL_ORDER` display list and in `INPUTS_TAB_SECTION_AUDIT.md` but has **no corresponding key in the seeder's `OPEX_FIELDS`**. T12 landscaping line items are bucketed into Custom OpEx instead. The named `landscaping` row always renders blank. See **PF-10**.
- **Layered OPEX growth engine** (`opex-growth.ts`) defines nine per-line anchors with asset-class spreads and weight schedules. This engine is imported only by `proforma-projection.service.ts`, which has no live caller. See **PF-07**. The live path uses a flat `opexGrowthRate` scalar from `proforma_assumptions.opex_growth_current ÷ 100`.

---

### 10. Opex Growth Rate

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `proforma_assumptions.opex_growth_current` (whole-pct, e.g., `2.800`) | `SINGLE_WRITER` (adjustment service) |
| **Q2 Write path** | (a) News-event trigger (`calculateOpExAdjustment` → `UPDATE proforma_assumptions SET opex_growth_current = $1`). (b) User override (`overrideAssumption`). (c) `setMarketBaseline`. (d) `capsule-bridge.routes.ts` PATCH. (e) `resetToMarket`. Five writers, no transaction with `deal_assumptions`. | `RACE` — **PF-04** |
| **Q3 Units** | **Whole-percent in DB** (3.000 = 3 %). `getDealFinancials:2565` converts: `+(parseFloat(row.opex_growth_current) / 100).toFixed(4)`. Deterministic runner expects decimal. | `STRUCTURALLY_MISALIGNED` (DB vs runner); correct at read boundary but fragile — **PF-05** |
| **Q4 UI** | `AssumptionsTab` shows effective value. ProFormaSummaryTab projection years use the converted decimal. | `WIRED` (conversion present) |

---

### 11. Rent Growth Rate

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `proforma_assumptions.rent_growth_current` (whole-pct). Also `deal_assumptions.per_year_overrides['gpr:yr2']` etc. for per-year dollar overrides. | `PARALLEL` |
| **Q2 Write path** | Same five writers as opex growth. Per-year overrides written by ProjectionsTab but never read by projection loop. | `RACE` + **PF-02** |
| **Q3 Units** | Whole-pct in `proforma_assumptions`; decimal in `per_year_overrides`; decimal in deterministic runner. `getDealFinancials:2575` converts `rent_growth_current ÷ 100`. | `STRUCTURALLY_MISALIGNED` (DB convention) — **PF-05** |
| **Q4 UI** | AssumptionsTab shows current. ProjectionsTab writes overrides that are silently ignored. | `WIRED` for display; `NOT_WIRED` for per-year override consumption |
| **Layered growth engine** | `rent-growth.ts` five-component model (momentum + cycle + anchor + event + position) is pure math, imported only by the orphaned `proforma-projection.service.ts`. Not wired to any live endpoint. | `NOT_WIRED` — **PF-07** |

---

### 12. Management Fee

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.management_fee_pct` LayeredValue; priority: t12. Seeder baseline = 4.5 % of EGI. | `LAYERED` |
| **Q2 Write path** | Seeder. User override via `applyFinancialsOverride`. | `SINGLE_WRITER` |
| **Q3 Units** | Decimal fraction of EGI. | `CONSISTENT` |
| **Q4 UI** | Rendered in NCTRL_ORDER. | `WIRED` |

---

### 13. Insurance

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.insurance` LayeredValue; priority: t12. Platform fallback = state-adjusted per-unit annual (FL: $300 × 1.50 = $450). | `LAYERED` |
| **Q2 Write path** | Seeder. User override. | `SINGLE_WRITER` |
| **Q3 Units** | Annual total dollars. | `CONSISTENT` |
| **Q4 UI** | NCTRL row. | `WIRED` |

---

### 14. Real Estate Tax

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.real_estate_tax` LayeredValue; priority: tax_bill → t12. | `LAYERED` |
| **Q2 Write path** | Seeder. Tax service (`tax.service.ts`) computes per-year schedule in deterministic runner. | `CONSISTENT` |
| **Q3 Units** | Annual total dollars. For FL: purchase_price × 0.85 × millage (DEF_MILLAGE = 0.0218). Non-FL: baseTax × `(1 + expenseGrowth)^y`. | `CONSISTENT` |
| **Q4 UI** | NCTRL row. Multi-year schedule in TaxTab. | `WIRED` |

---

### 15. Replacement Reserves

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_assumptions.year1.replacement_reserves_per_unit` LayeredValue. Seeder: `bpResPerUt` (broker OM) → platform fallback. Bridge: `getExpAmt('replacement_reserves') / units` or `capex.reservesPerUnit ?? 250`. | `LAYERED` |
| **Q2 Write path** | Seeder, bridge. | `CONSISTENT` |
| **Q3 Units** | Per-unit annual in LayeredValue; total annual in deterministic runner output. | `CONSISTENT` |
| **Q4 UI** | Rendered as "below-the-line" row in ProFormaSummaryTab. | `WIRED` |

---

### 16. NOI

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | Computed: `EGI − totalOpEx`. Also in `deal_assumptions.year1.noi` LayeredValue when T12 provides it. | `LAYERED` + computed |
| **Q2 Write path** | Seeder + inline computation. | `CONSISTENT` |
| **Q3 Units** | Annual dollars. | `CONSISTENT` |
| **Q4 UI** | ProFormaSummaryTab NOI row. | `WIRED` |

---

### 17. Exit Cap Rate

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `proforma_assumptions.exit_cap_current` (whole-pct). Also bridge default `0.065` decimal. Also `deal_assumptions.exit_strategy_lv` (intentionally nullable). | `PARALLEL` |
| **Q2 Write path** | Adjustment service (5 writers). Bridge hardcodes fallback `0.065` if `a.disposition?.exitCapRate` is falsy — bypasses `proforma_assumptions` entirely for the LLM path. | `RACE` |
| **Q3 Units** | `proforma_assumptions.exit_cap_current = 5.250` (whole-pct). Bridge reads `a.disposition.exitCapRate` which is decimal. `getDealFinancials` converts ÷ 100 at line 2565. | `STRUCTURALLY_MISALIGNED` (DB) — **PF-05** |
| **Q4 UI** | DealTermsTab shows exit cap. Returns tab uses it for net sale proceeds. | `WIRED` |
| **LIUS** | `runLIUSEngine` (CE-02 from CAPITAL_EXIT_SUBSYSTEM_AUDIT) is orphaned — no live caller. Exit cap path bypasses LIUS entirely via `proforma-assumptions-bridge.ts:319`. | `NOT_WIRED` — CE-02 |

---

### 18. Purchase Price / Basis

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_data.purchase_price` → `deal_data.asking_price` → `deals.budget` (priority in `getDealFinancials:2291`). Also `deal_assumptions.acquisition_costs`. | `MIXED` |
| **Q2 Write path** | `inline-deals.routes.ts` (fixed in Task #623/#624 to dual-write `deals.budget` + `deal_data.purchase_price`). | `SINGLE_WRITER` (post-fix) |
| **Q3 Units** | Dollars. | `CONSISTENT` |
| **Q4 UI** | DealTermsTab / F9 S&U tab. Terminal CapitalTab uses a separate hardcoded fallback (`$45M` for 464 Bishop). | `WIRED` in F9; `HARDCODED` in Terminal — see F9_TIER1_BLOCKERS_AUDIT ITEM 1 |

---

### 19. Loan Amount / Financing

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deal_data.loan_amount` or `ltv × purchasePrice`. Bridge reads `a.financing.loanAmount` (LLM path). | `MIXED` |
| **Q2 Write path** | LLM path writes to model cache only; does not write back to `deal_data`. No explicit single-writer path for loan amount outside the LLM call. | `RACE` |
| **Q3 Units** | Dollars. Financing term/amort: **years in `ProFormaAssumptions`; months in `ModelAssumptions`**. Bridge converts: `term × 12`, `amort × 12`. | `CONSISTENT` (bridge handles conversion) |
| **Q4 UI** | DebtTab, S&U tab. | `WIRED` |

---

### 20. Hold Period / Projections

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `holdYears` passed as query param to `getDealFinancials`. `deal_assumptions.hold_period_years` scalar (default 5). | `MIXED` |
| **Q2 Write path** | Passed per-request; not stored per-override call. | `SINGLE_WRITER` (request param) |
| **Q3 Units** | Integer years. | `CONSISTENT` |
| **Q4 UI** | Projections tab renders years 1–N. `hold_period.changed` DOM event triggers re-fetch. | `WIRED` |

**Critical note — per-year overrides:** Per-year dollar overrides (`payroll:yr2`, `gpr:yr2`, etc.) are stored in `deal_assumptions.per_year_overrides` by the Projections tab but are **never consumed** by the projections loop at `getDealFinancials:3285–3310`. Loop formula: `payroll = Math.round(payrollY1 × opexMult)` with no per-year override lookup. See **PF-02**.

---

### 21. Capital Stack / Waterfall

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `wf:lpShare` / `wf:gpShare` overrides in `deal_assumptions.per_year_overrides`. Default LP/GP = 90/10 (hardcoded in `getDealFinancials:2943`). | `FALLBACK` |
| **Q2 Write path** | PATCH `/financials/override` only — no UI control. No Deal Terms row for LP/GP split. | `NOT_WIRED` (UI) |
| **Q3 Units** | Fraction (decimal). | `CONSISTENT` |
| **Q4 UI** | Returns tab shows LP/GP IRR and distributions, always using default 90/10 unless manually set via API. | `HARDCODED` default — **PF-11** |

---

### 22. Revenue Formulas (SIMPLE / MARK_TO_MARKET / RENEWAL_AWARE)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `revenue-formulas.ts` — three pure functions. `RENEWAL_RATE_BASELINES` table with asset-class × market-type matrix (spec §14 — calibration TBD). | `NOT_WIRED` |
| **Q2 Write path** | No write path — pure computation only. | n/a |
| **Q3 Units** | Per-year revenue dollars. | `CONSISTENT` |
| **Q4 UI** | Not rendered — no live caller from any production route. Imported only by `proforma-projection.service.ts` which is itself orphaned. | `NOT_WIRED` — **PF-07** |

---

### 23. Layered Growth Engine (Tier 1–3)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `layered-growth/rent-growth.ts` (5-component model) + `layered-growth/opex-growth.ts` (9-line OPEX) + `layered-growth/position-adjustment.ts` | `NOT_WIRED` |
| **Q2 Write path** | Pure computation — no DB writes. | n/a |
| **Q3 Units** | Decimal rates. `ASSET_CLASS_SPREAD_BPS` (e.g., multifamily = 30 bps over CPI shelter). `calibrationStatus: 'tbd'`. | `FALLBACK` (calibration pending) |
| **Q4 UI** | Not reachable from any production route. Imported only in `proforma-projection.service.ts` (test-only) and `__tests__/`. | `NOT_WIRED` — **PF-07** |

---

### 24. Traffic Projection (M07)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `buildTrafficProjection()` in `financials-composer.service.ts:2038` returns a hardcoded stub: `{ yearly: [], leaseUp: null, calibrated: { vacancyPct: null, rentGrowthPct: null, exitCap: null, lastCalibrated: null }, leasingSignals: null }`. | `ON_MOCK_DATA` |
| **Q2 Write path** | No write — stub. Real M07 data lives in `subject_traffic_history` (read for `subjectHistory` field) but is NOT plumbed into `trafficProjection`. | `NOT_WIRED` |
| **Q3 Units** | n/a — all nulls. | n/a |
| **Q4 UI** | Frontend receives `trafficProjection` from Engine B; all null fields render as dashes or empty charts. | `ON_MOCK_DATA` — **PF-15** |

---

### 25. ProForma Templates (`proforma_templates` table)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `proforma_templates` table managed by `proforma-template.service.ts`. Contains per-user templates with decimal growth rates. | `DISPLAY_ONLY` |
| **Q2 Write path** | `proformaTemplateService.create()` / `update()` / `delete()`. No route applies a template to a deal's `deal_assumptions.year1`. | `SINGLE_WRITER` |
| **Q3 Units** | Decimal (0.03 = 3 %, consistent with runner convention). | `CONSISTENT` |
| **Q4 UI** | Template CRUD endpoints exist (`/proforma/templates`). No UI flow that loads a template and merges it into the live `deal_assumptions.year1` for a deal. | `NOT_WIRED` — **PF-12** |

---

### 26. OperatorStance Modulation in Pro Forma

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `deals.operator_stance` JSONB, read in `composeDealFinancials` (Engine B) at line 203. | `SINGLE_WRITER` (PUT /stance route) |
| **Q2 Write path** | StanceTab → PUT `/stance`. Triggers re-blend. | `SINGLE_WRITER` |
| **Q3 Units** | Stance fields (`underwritingPosture`, `rateEnvironment`, etc.) are string enums; modulation outputs decimal scalars. | `CONSISTENT` |
| **Q4 UI** | `leasingCostTreatment` modulates concessions row in Engine B (CAPITALIZED → 0, HYBRID → partial). **Not applied in Engine A** (`getDealFinancials`). Concessions row in Engine A always reflects the seeder-resolved value regardless of stance. | `MIXED` — **PF-16** |

---

### 27. Concession Recognition (§14)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | `computeConcessionRecognition()` in `financials-composer.service.ts`. Uses `concession_records` table — `null until Task #573 wires LV engine output`. Comment at line 129: "Null until Task #573". | `NOT_WIRED` |
| **Q2 Write path** | `concession_records` not yet populated. | `NOT_WIRED` |
| **Q3 Units** | n/a — feature stub. | n/a |
| **Q4 UI** | `concessionRecognition` field on ComposedFinancials — always null until #573. | `NOT_WIRED` |

---

### 28. `deal_assumptions` Scalar Columns (Legacy)

| Axis | Finding | Tag |
|---|---|---|
| **Q1 Source** | Columns: `vacancy_pct = 5.00`, `rent_growth_yr1 = 3.00`, `opex_ratio = 35.00`, `management_fee_pct = 3.00`, `replacement_reserves_per_unit = 250`, etc. Whole-pct convention. | `DISPLAY_ONLY` |
| **Q2 Write path** | Written at deal creation (some defaults); never updated by seeder or override system. | `DISPLAY_ONLY` |
| **Q3 Units** | Whole-pct (inconsistent with `year1` JSONB which uses decimal). | `STRUCTURALLY_MISALIGNED` |
| **Q4 UI** | Neither `getDealFinancials` nor `composeDealFinancials` reads these scalar columns — both read `deal_assumptions.year1` JSONB. The scalar columns are dead weight. | `DISPLAY_ONLY` |

---

## Consolidated Findings

### PF-01 — Dual-Engine Architecture (PARALLEL)

**Priority:** P0 · **Effort:** L · **Phase:** A

Two independent production engines (`getDealFinancials` and `composeDealFinancials`) assemble pro forma data from the same underlying tables but via different code paths, returning different shape envelopes, served on different routes (`/deal-assumptions/:id` vs `/deals/:id/financials`). Any bug fix, growth-rate change, or OperatorStance modulation applied to one engine silently does not apply to the other.

**Evidence:**
- Engine A (`getDealFinancials`): `proforma-adjustment.service.ts:1940+` — reads `proforma_assumptions` growth scalars + `deal_assumptions.year1`. Applies no OperatorStance.
- Engine B (`composeDealFinancials`): `financials-composer.service.ts:179+` — reads `deal_assumptions.year1` only. Applies OperatorStance concession modulation.
- Frontend routes: `deal-assumptions.routes.ts:493` calls Engine A; `inline-deals.routes.ts:2101` calls Engine B.

**Remediation:** Define a canonical `F9FinancialsContract` type; consolidate both engines into a single composition function or establish a documented ownership boundary with explicit feature flags for which engine owns which fields.

---

### PF-02 — Per-Year Override Break (NOT_WIRED)

**Priority:** P0 · **Effort:** M · **Phase:** A  
**Prior reference:** `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 3 🔴 RED

Per-year dollar overrides (`payroll:yr2`, `gpr:yr2`, `g_and_a:yr2`, etc.) written by the Projections Tab via `PATCH /financials/override` are persisted to `deal_assumptions.per_year_overrides` but the inline projections loop in `getDealFinancials:3285–3310` re-derives every year from `Y1 × compoundGrowth`. The loop has no lookup of `per_year_overrides['payroll:yr2']`. Operator edits appear to save but revert on the next fetch.

**Evidence:** `proforma-adjustment.service.ts:3307` — `payroll = Math.round(payrollY1 × opexMult)` with no per-year override check. `deal_assumptions.per_year_overrides` for 464 Bishop contains `{payroll:yr2: 334544, gpr:yr2: 5048442, ...}` — confirmed unread.

**Remediation:** At projection loop year `yr`, check `pyOvs['payroll:yr' + yr]?.value` before falling back to formula.

---

### PF-03 — Bad Debt Display vs Math Mismatch (STRUCTURALLY_MISALIGNED)

**Priority:** P0 · **Effort:** S · **Phase:** A  
**Prior reference:** `PROFORMA_MATH_AUDIT.md` MATH-01

The display dollar row for `bad_debt` uses multiplier `GPR × bad_debt_pct` (`proforma-adjustment.service.ts:1964`). The seeder and EGI formula deduct bad debt from `(NRI + other_income)` — a smaller base. For Bishop (bad_debt_pct = 3.34 %): display row = $163,807 vs actual EGI deduction ≈ $121,000 — a 35 % overstatement.

**Remediation:** Change `toDollarRow('bad_debt_pct', 'bad_debt', lbl, gprForDollars)` to use `egi` as the multiplier base, or add a note in the display row that it is an approximation.

---

### PF-04 — No Transaction Boundary Between `proforma_assumptions` and `deal_assumptions` (RACE)

**Priority:** P1 · **Effort:** M · **Phase:** A

`proforma_assumptions` (5-scalar adjustment table) and `deal_assumptions.year1` (full LayeredValue JSONB) are written independently by separate services. A concurrent `recalculate()` call and user `PATCH /financials/override` can interleave, producing a state where `proforma_assumptions.rent_growth_current` reflects a news-event adjustment but `deal_assumptions.year1.vacancy_pct.resolved` still holds the pre-event value from the previous seed — or vice versa.

**Evidence:** `proforma-adjustment.service.ts:366` writes `proforma_assumptions`; `proforma-seeder.service.ts:seedProFormaYear1` writes `deal_assumptions.year1` — no shared transaction.

**Remediation:** Wrap recalculation paths that touch both tables in a single Postgres transaction. At minimum, document which table is canonical for each field and enforce single-writer discipline via routing.

---

### PF-05 — Whole-Percent / Decimal Convention Split (STRUCTURALLY_MISALIGNED)

**Priority:** P1 · **Effort:** S · **Phase:** A

`proforma_assumptions` stores `rent_growth_baseline`, `opex_growth_baseline`, `exit_cap_baseline`, `vacancy_baseline` as whole-percent (`3.000`, `5.250`). The `deal_assumptions.year1` JSONB, `proforma_templates`, and `ModelAssumptions` (deterministic runner) all use decimal (`0.03`, `0.0525`). `getDealFinancials` correctly converts at read time (line 2565: `÷ 100` for opex_growth; line 2575 for rent_growth) but this conversion is undocumented and fragile — any new writer that writes a decimal value to `proforma_assumptions` will silently produce 0.003 % growth instead of 3 %.

**Affected fields:** `rent_growth_*`, `opex_growth_*`, `exit_cap_*`, `vacancy_*` in `proforma_assumptions`.

**Remediation (option A):** Migrate `proforma_assumptions` columns to decimal convention and remove ÷ 100 at read time. **Option B:** Add a DB `CHECK` constraint enforcing `rent_growth_baseline BETWEEN 0.5 AND 15.0` (whole-pct range) and document the convention prominently in the table comment.

---

### PF-06 — LIUS Engine Orphaned (NOT_WIRED)

**Priority:** P1 · **Effort:** M · **Phase:** A  
**Prior reference:** `CAPITAL_EXIT_SUBSYSTEM_AUDIT.md` CE-02

`runLIUSEngine` has no live caller. The exit cap path in the LLM engine bypasses LIUS entirely: `proforma-assumptions-bridge.ts:319` — `exitCap = toNumber(a.disposition?.exitCapRate, 0.065)`. The default fallback of 6.5 % is used whenever the LLM does not return an explicit exit cap.

**Remediation:** Either (a) wire `runLIUSEngine` into `proforma-assumptions-bridge.ts` exit cap resolution, or (b) formally deprecate and remove it.

---

### PF-07 — Tier 1–3 Layered Growth Engine Not Connected to Production (NOT_WIRED)

**Priority:** P1 · **Effort:** L · **Phase:** A

`proforma-projection.service.ts`, `layered-growth/rent-growth.ts`, `layered-growth/opex-growth.ts`, `layered-growth/position-adjustment.ts`, and `revenue/revenue-formulas.ts` are fully implemented pure-math modules. They are imported only in `src/services/proforma/__tests__/tier3-refinement.test.ts`. No production route calls `projectProforma()`.

The live path uses a flat `opexGrowthRate` scalar and a flat `rentGrowth[]` array with no momentum/cycle/anchor weighting, no asset-class spread anchoring, no position-adjustment contribution, and no revenue-formula dispatch (SIMPLE / MARK_TO_MARKET / RENEWAL_AWARE).

**Remediation:** Create a bridge function `projectProformaForDeal(dealId, year1Seed, proformaAssumptions) → ProjectionResult` and call it from `getDealFinancials` to replace the inline flat-growth loop.

---

### PF-08 — Unit Mix GPR Activation Gap (NOT_WIRED)

**Priority:** P1 · **Effort:** S · **Phase:** A  
**Prior reference:** `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 1 🟡 YELLOW

The `da:use_unit_mix_for_gpr` flag that gates GPR derivation from the Unit Mix has no user-facing toggle in any UI. Unit Mix Tab edits (`UnitMixTab.tsx`) do not affect GPR unless this flag is manually set via raw API PATCH. Default: off for all deals.

**Remediation:** Add a toggle in the Unit Mix Tab (or AssumptionsTab) that sets `da:use_unit_mix_for_gpr = true` via `PATCH /financials/override`.

---

### PF-09 — Other Income Stale-Cache Pattern (STRUCTURALLY_MISALIGNED)

**Priority:** P1 · **Effort:** S · **Phase:** A  
**Prior reference:** `PROFORMA_MATH_AUDIT.md` MATH-02

`other_income_per_unit.resolved` is expected to hold an annual dollar value per unit. The display formula multiplies by `totalUnits × 12` (units-per-year expansion). If the seeder wrote a monthly per-unit value instead of annual, or if the unit convention changed between seed versions, the value is 12× inflated. Confirmed on 464 Bishop: seed value 904.14 (monthly total erroneously stored as per-unit annual) → display $2,517 K vs correct ≈ $210 K.

**Remediation:** (a) Validate at seed time that `other_income_per_unit` is in annual-per-unit convention. (b) Add a unit-dimension check to the seeder (`if (val > 5000) warn "possible monthly total stored as per-unit annual"`). (c) Provide a forced-reseed endpoint to clear stale values.

---

### PF-10 — `landscaping` Phantom Row (PHANTOM)

**Priority:** P2 · **Effort:** S · **Phase:** A  
**Prior reference:** `PROFORMA_SURFACE_AUDIT.md` NW-1

`landscaping` is in the `CTRL_ORDER` display array and referenced in `INPUTS_TAB_SECTION_AUDIT.md` but has no corresponding key in the seeder's `OPEX_FIELDS`. T12 landscaping GL items are bucketed into Custom OpEx instead. The named row always renders blank (dashes), and if a T12 has material landscaping costs, they appear only in the Custom OpEx bucket — not in the standard controllable OpEx section the operator expects.

**Remediation:** Add `landscaping` to the seeder's `OPEX_FIELDS` key list, map T12 `custom_opex_landscaping_*` items to it, and include it in the platform baseline OpEx norms.

---

### PF-11 — No UI for LP/GP Split (NOT_WIRED)

**Priority:** P2 · **Effort:** S · **Phase:** A  
**Prior reference:** `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 4

`wf:lpShare` / `wf:gpShare` are only settable via `PATCH /financials/override` as raw API calls. No UI control in Deal Terms or Waterfall Tab. All deals default to 90/10.

**Remediation:** Add an LP/GP split row to the DealTermsTab or WaterfallTab, dispatching a `PATCH /financials/override` with keys `wf:lpShare` and `wf:gpShare`.

---

### PF-12 — ProForma Templates Never Applied (NOT_WIRED)

**Priority:** P2 · **Effort:** M · **Phase:** A

`proforma_templates` table and `proforma-template.service.ts` support full CRUD. Template rows exist in DB. No route or service method applies a template's growth rates, cap rates, or debt assumptions to a deal's `deal_assumptions.year1`. Template creation and selection are effectively cosmetic.

**Remediation:** Add a `POST /proforma/templates/:templateId/apply?dealId=...` route that merges template fields into `deal_assumptions.year1` LayeredValues with `resolution = 'om'` (or a new `'template'` source).

---

### PF-13 — Concessions Hardcoded Zero in LLM Bridge (HARDCODED)

**Priority:** P2 · **Effort:** S · **Phase:** A

`proforma-assumptions-bridge.ts:241`: `const concessions = 0; // ProFormaAssumptions does not carry a concessions scalar`. The seeder correctly resolves `concessions_pct` from T12/rent-roll and stores it in `deal_assumptions.year1`. But the deterministic runner (Engine C / LLM path) always receives `concessions = 0` regardless of the seeded value. For deals with material concessions (Bishop: 7.78 %), the LLM-path model understates deductions.

**Remediation:** Add `concessions_pct` to `ProFormaAssumptions.revenue`; populate it from the seed's `year1.concessions_pct.resolved` before calling `buildModel()`.

---

### PF-14 — `deal_assumptions` Scalar Columns Are Dead Weight (DISPLAY_ONLY)

**Priority:** P3 · **Effort:** S · **Phase:** A

`deal_assumptions` has ~15 scalar columns (`vacancy_pct = 5.00`, `rent_growth_yr1 = 3.00`, `opex_ratio = 35.00`, `management_fee_pct = 3.00`, `replacement_reserves_per_unit = 250`, etc.) written at deal creation with defaults. Neither Engine A nor Engine B reads these columns — both read the `year1` JSONB instead. The scalar columns are populated once and never updated by the seeder, override system, or adjustment service.

**Remediation:** Either (a) deprecate and `DROP` these columns in a migration after confirming no external consumer reads them, or (b) synchronise them with `year1.resolved` values in the seeder so they serve as a human-readable snapshot of the JSONB.

---

### PF-15 — Traffic Projection Stub (ON_MOCK_DATA)

**Priority:** P3 · **Effort:** L · **Phase:** B

`buildTrafficProjection()` in `financials-composer.service.ts:2038` returns a hardcoded stub with `yearly: []`, all `calibrated.*` fields null, and `leasingSignals: null`. The real M07 traffic data (stored in `subject_traffic_history`) is read for `subjectHistory` but not plumbed into `trafficProjection`. The M07 spec (§6) calls for `trafficProjection.calibrated.vacancyPct` to feed back into the Year 1 vacancy assumption.

**Remediation:** Wire `subject_traffic_history.current_state.vacancyPct` + `current_state.rentGrowthPct` into `buildTrafficProjection()` output; expose calibrated coefficients as the `calibrated` block. Block on M07 Phase 2 (corpus-gated).

---

### PF-16 — OperatorStance Modulation Missing in Engine A (MIXED)

**Priority:** P3 · **Effort:** S · **Phase:** A

OperatorStance `leasingCostTreatment` (OPERATING / CAPITALIZED / HYBRID) modulates the concessions row only in Engine B (`composeDealFinancials`). Engine A (`getDealFinancials`) does not read `deals.operator_stance` and always returns the raw seeded concessions value regardless of the operator's chosen treatment. Any UI that renders Engine A's response will show pre-stance concessions.

**Remediation:** In `getDealFinancials`, read `deals.operator_stance.leasingCostTreatment` and apply the same CAPITALIZED/HYBRID modulation logic already present in Engine B.

---

## Remediation Priority Table

| Finding | Description | Priority | Effort | Phase | Engine(s) affected |
|---|---|---|---|---|---|
| PF-01 | Dual-engine architecture — no shared contract | P0 | L | A | A, B |
| PF-02 | Per-year overrides never consumed by projection loop | P0 | M | A | A |
| PF-03 | Bad debt dollar display uses GPR not EGI base | P0 | S | A | A |
| PF-04 | No transaction boundary between proforma_assumptions and deal_assumptions.year1 | P1 | M | A | A, B |
| PF-05 | Whole-pct / decimal convention split in proforma_assumptions | P1 | S | A | A |
| PF-06 | LIUS engine orphaned (exit cap bypass) | P1 | M | A | C |
| PF-07 | Tier 1–3 layered growth engine never wired to production | P1 | L | A | A, B |
| PF-08 | Unit mix GPR activation flag has no UI toggle | P1 | S | A | A, B |
| PF-09 | Other income stale-cache (12× inflation risk) | P1 | S | A | A, B |
| PF-10 | `landscaping` phantom row in CTRL_ORDER | P2 | S | A | A, B |
| PF-11 | No UI for LP/GP split (hardcoded 90/10) | P2 | S | A | A |
| PF-12 | ProForma templates never applied to deals | P2 | M | A | A, B |
| PF-13 | Concessions hardcoded 0 in LLM bridge | P2 | S | A | C |
| PF-14 | deal_assumptions scalar columns are dead weight | P3 | S | A | n/a |
| PF-15 | Traffic projection stub (all nulls) | P3 | L | B | B |
| PF-16 | OperatorStance concession modulation missing in Engine A | P3 | S | A | A |

---

## Cross-Cutting Issues

### Unit Convention Map

| Location | Convention | Value example (3 % rent growth) | Conversion needed |
|---|---|---|---|
| `proforma_assumptions.*_baseline/current` | **Whole-pct** | `3.000` | ÷ 100 at read |
| `deal_assumptions.year1.*` (LayeredValue) | **Decimal** | `0.030` | none |
| `deal_assumptions` scalar cols | **Whole-pct** | `3.00` | DISPLAY_ONLY — never read |
| `proforma_templates.*_rate` | **Decimal** | `0.030` | none |
| `ModelAssumptions` (deterministic runner) | **Decimal** | `0.030` | none |
| `ProFormaAssumptions` (LLM envelope) | **Decimal** | `0.030` | none |

The ÷ 100 conversion exists at `getDealFinancials:2562–2575` for `opex_growth_current` and `rent_growth_current`. Confirming `exit_cap_current` and `vacancy_current` also receive the same treatment in `getDealFinancials` is recommended before any refactor.

### OperatorStance Coverage Gap

OperatorStance modulation touches: concessions (Engine B only), leasingCostTreatment. It does NOT modulate vacancy, rent growth, or OpEx growth in either live engine. The 15 deterministic modulation rules defined in `operator-stance.ts` are described as "zero-LLM-cost re-blend against the cached underwriting snapshot" — but the `getDealFinancials` cache snapshot is `proforma_assumptions`, and the re-blend writes back to `proforma_assumptions.*_current` only. It does not update `deal_assumptions.year1` LayeredValues.

### Cashflow Agent Integration

The cashflow agent reads `fetch_operator_stance` (confirmed in `replit.md`). It does not read `deal_assumptions.year1` directly — it receives data via the `getDealFinancials` response shape. This means PF-02 (per-year override break) and PF-05 (unit convention) are both visible to the cashflow agent's context window.

### Proforma Generator vs Proforma Seeder

`proforma-generator.service.ts` (371 lines) is a lightweight LLM-gated generator that writes hardcoded defaults to its output shape (`rentGrowth: '0.0300'`, `interestRate: '0.0650'`, `exitCapRate: '0.0550'` — correctly decimal). It is a separate code path from `proforma-seeder.service.ts` (1514 lines, LayeredValue-aware). These serve different callers; there is no documented hand-off between them.

---

## Appendix A — File-to-Table Cross-Reference

| File | Table written | Table read | Engine |
|---|---|---|---|
| `proforma-seeder.service.ts` | `deal_assumptions.year1` | `deals`, `apartment_market_snapshots`, extraction capsules | B (lazy seed) |
| `proforma-adjustment.service.ts` (class methods) | `proforma_assumptions` | `proforma_assumptions` | — |
| `proforma-adjustment.service.ts` (`getDealFinancials`) | — | `deal_assumptions.year1`, `proforma_assumptions` | A |
| `financials-composer.service.ts` | — | `deal_assumptions.year1`, `deals.operator_stance` | B |
| `financial-model-engine.service.ts` | model cache table | `deals.deal_data`, `deal_assumptions.year1` | C |
| `proforma-assumptions-bridge.ts` | — | `ProFormaAssumptions` struct (in-memory) | C |
| `deterministic-model-runner.ts` | — | `ModelAssumptions` struct (in-memory) | C |
| `proforma-projection.service.ts` | — | `ProjectionInputs` struct (in-memory) | D (orphaned) |
| `proforma-template.service.ts` | `proforma_templates` | `proforma_templates` | — (not wired to deals) |
| `deal-versions.service.ts` | `deal_versions` | `deal_versions` | C only |
| `capsule-bridge.routes.ts` | `proforma_assumptions` | — | writes proforma_assumptions |

---

*Audit complete. No code was changed. All findings are read-only observations.*
