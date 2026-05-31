# Cross-Surface Field Inventory

Maps every key deal field to its canonical read source on each surface.
Established by Task #1541 (Piece B2). Updated by Task #1563 (Piece B, Phase 2B-1). Updated by Task #1569 (Piece B3 — exit_cap + hold_period_years migration).

**Status legend:**
- ✅ Migrated — uses canonical `getFieldValue()` path
- 🔵 Native — surface reads exclusively from Engine A (`getDealFinancials`) response; no cross-surface risk
- ⚠️ Deferred — known non-canonical path; scheduled for Piece B3 (Engine A write-back)
- — Not displayed on this surface

---

## F9 Financial Engine — surface inventory

### Sub-tabs within F9 that read from `getDealFinancials` (Engine A) response

All sub-tabs below receive `f9Financials` (the Engine A response) as a prop.
They never perform independent DB reads for deal-assumption fields.

| Sub-tab | Key field reads | Read source | Status |
|---|---|---|---|
| **ProFormaSummaryTab** | All Pro Forma year-1 rows (GPR → NOI → NOI after reserves) | `f9Financials.proforma.year1[]` — full row array | 🔵 Native |
| **ProjectionsTab** | Multi-year rent growth, cashflow, NOI projections | `f9Financials.proforma.year1[]`, `f9Financials.trafficProjection` | 🔵 Native |
| **OverviewTab** | Purchase price, loan amount, equity at close, NOI/unit/mo, EGI/unit/mo, cap rate, hold period | `f9Financials.capitalStack.*`, `f9Financials.proforma.unitEconomics.*`, `f9Financials.proforma.valuationSnapshot` | 🔵 Native |
| **ReturnsTab** | IRR, EM, LP/GP returns, DSCR, LTV, debt yield, positive leverage | `f9Financials.returns.*`, `f9Financials.capitalStack.*`, `f9Financials.debtMetrics.*` | 🔵 Native |
| **SourcesUsesTab** | Purchase price, loan amount, equity at close, fees, transfer tax | `f9Financials.sourcesUses`, `f9Financials.capitalStack.*`, `f9Financials.taxes.transferTax.*` | 🔵 Native |
| **DebtTab** | NOI Y1 (integrity check input), loan terms, hold years, refi, coverage metrics | `f9Financials.proforma.year1.find(noi).resolved`, `f9Financials.debt.*`, `f9Financials.capitalStack.*` | 🔵 Native |
| **DecisionTab** | Integrity checks, all year-1 Pro Forma rows, concession recognition, capital stack | `f9Financials.proforma.year1[]`, `f9Financials.proforma.integrityChecks`, `f9Financials.concessionRecognition`, `f9Financials.capitalStack` | 🔵 Native |
| **AssumptionsTab** | Rent growth, vacancy, expense growth, exit cap assumption inputs | `f9Financials.assumptions.*` | 🔵 Native |
| **SensitivityTab** | Interest rate, LTV, exit cap — for sensitivity ranges | `f9Financials.assumptions.*`, `assumptions.*` (local store — presentation only, not underwriting) | 🔵 Native |
| **StanceTab** | OperatorStance posture fields | `f9Financials.operatorStance` (dedicated API) | 🔵 Native |

### Cross-surface discrepancies audited

| Code | From Surface | To Surface | Field | Status |
|---|---|---|---|---|
| **CF-01** | Pro Forma | Valuation Grid | `noi` | ✅ Fixed (Task #1541) — `getFieldValue('noi')` in `getSubjectProperty()` |
| **CF-02** | Pro Forma | Validation Grid | `exit_cap` | ✅ Fixed (Task #1541) — `fin != null` guard |
| **CF-03** | Pro Forma | Validation Grid | `hold_period_years` | ✅ Fixed (Task #1541) — `fin != null` guard |
| **CF-04** | Pro Forma | Validation Grid | `rent_growth_yr1` | ✅ Fixed (Task #1541) — `fin != null` guard |
| **CF-05** | Pro Forma | Validation Grid | `purchase_price` | ✅ Fixed (Task #1541) — `fin != null` guard |
| **CF-06** | Pro Forma | Validation Grid | `loan_amount` / `interest_rate` | ✅ Fixed (Task #1541) — `fin != null` guard |
| **CF-07** | Pro Forma | Valuation Grid | `egi` | ✅ Fixed (Task #1563) — `getFieldValue('egi')` in `getSubjectProperty()`; EGI added to `COMPUTED_AGGREGATES` as `net_rental_income + other_income` |
| **CF-08** | Pro Forma | Valuation Grid | `gpr` | ✅ Fixed (Task #1563) — `getFieldValue('gpr')` in `getSubjectProperty()`; GRM method activated with implied multiplier in evidence trail |
| **CF-09** | Pro Forma | Valuation Grid | `total_opex` | ✅ Fixed (Task #1563) — `getFieldValue('total_opex')` in `getSubjectProperty()` |
| **CF-10** | Pro Forma | Valuation Grid | `exit_cap` | ✅ Fixed (Task #1569) — `getFieldValue('exit_cap')` in `getSubjectProperty()`; canary shadow-comparison active |
| **CF-11** | Pro Forma | Valuation Grid | `hold_period_years` | ✅ Fixed (Task #1569) — `getFieldValue('hold_period_years')` in `getSubjectProperty()`; canary shadow-comparison active |

---

## Valuation Grid — backend field reads

Handled in `ValuationGridService.getSubjectProperty()` (backend, SQL).

| Field | Read path | Status |
|---|---|---|
| `noi` | `getFieldValues(pool, dealId, ['noi', ...], 1)` | ✅ Migrated (CF-01) |
| `egi` | `getFieldValues(pool, dealId, [..., 'egi', ...], 1)` | ✅ Migrated (CF-07) — computed aggregate `net_rental_income + other_income` |
| `gpr` | `getFieldValues(pool, dealId, [..., 'gpr', ...], 1)` | ✅ Migrated (CF-08) — leaf field; canary shadow-comparison active |
| `total_opex` | `getFieldValues(pool, dealId, [..., 'total_opex'], 1)` | ✅ Migrated (CF-09) — leaf field; canary shadow-comparison active |
| `purchase_price` | `da.acquisition_price` (property table column) | 🔵 Native (not a LV field) |
| `exit_cap` | `getFieldValues(pool, dealId, [..., 'exit_cap', ...], 1)` | ✅ Migrated (CF-10) — leaf field; canary shadow-comparison active |
| `hold_period_years` | `getFieldValues(pool, dealId, [..., 'hold_period_years'], 1)` | ✅ Migrated (CF-11) — leaf field; canary shadow-comparison active |

### Shadow-comparison (canary period)

`getSubjectProperty()` runs **both** the canonical `getFieldValue` path AND fetches
raw stored `da.year1->'<field>'->>'resolved'` from SQL for `egi`, `gpr`, `total_opex`,
`exit_cap`, and `hold_period_years`. When they differ by >1% relative, a
`[valuation-grid] shadow-divergence` log line is emitted at INFO level. This canary
pattern runs until all live deals have been confirmed to agree across both paths, at
which point `_logShadowDivergence` and the shadow SQL columns can be removed.

---

## Other product surfaces (F4, F8)

| Surface | Field reads | Status |
|---|---|---|
| **F4 Market Intelligence** | Submarket/MSA metrics — from `market_sale_comps`, `historical_observations`, `ValuationGridService` | Not a deal-field surface; no cross-surface read risk |
| **F8 Investor / Capital** | LP/GP capital calls, distributions, waterfall — from `deals.investor_data` and dedicated investor services | Not a deal-assumption-field surface |

---

## Piece B3 — completed

All Valuation Grid fields previously marked ⚠️ Deferred have been migrated to the
canonical `getFieldValue()` chain. `exit_cap` (CF-10) and `hold_period_years` (CF-11)
were migrated in Task #1569, following the same shadow-comparison canary pattern
established by earlier B2 migrations. No ⚠️ Deferred fields remain in
`ValuationGridService.getSubjectProperty()`.

## Fields in ALLOWED_FIELDS (available for getFieldValue callers)

All fields listed below are in `ALLOWED_FIELDS` in
`backend/src/services/field-access/get-field-value.service.ts` and can be passed to
`getFieldValue` / `getFieldValues` without any code change:

**Revenue leaf fields:** `gpr`, `vacancy`, `concessions`, `bad_debt`, `non_revenue_units`,
`loss_to_lease`, `other_income`

**Revenue aggregates (with computed formula):**
- `net_rental_income` — storedResolved (no Engine A formula added yet)
- `egi` — ✅ computed aggregate: `net_rental_income + other_income` (Task #1563)
- `noi` — ✅ computed aggregate: `egi - total_opex` (Task #1541)
- `noi_after_reserves` — ✅ computed aggregate: `(egi - total_opex) - replacement_reserves` (Task #1541)

**OpEx leaf fields:** `real_estate_tax`, `insurance`, `management_fee`, `repairs_maintenance`,
`utilities`, `payroll`, `administrative`, `marketing`, `contract_services`

**OpEx aggregates:** `total_opex` — storedResolved (no Engine A formula added yet)

**Capital & deal fields:** `purchase_price`, `equity_at_close`, `loan_amount`, `interest_rate`,
`ltc_pct`, `exit_cap`, `rent_growth_yr1`, `hold_period_years`

**Fields NOT yet in ALLOWED_FIELDS** (add when a surface needs canonical access):
`vacancy_loss`, `real_estate_taxes` (alias), `management_fees` (alias), `general_admin`,
`target_irr`, `target_em`, `pref_rate`, `gp_promote`, `construction_cost`,
`soft_costs`, `land_cost`.
