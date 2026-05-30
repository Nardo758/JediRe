# Cross-Surface Field Inventory

Maps every key deal field to its canonical read source on each surface.
Established by Task #1541 (Piece B2). Update when new surfaces are added.

**Status legend:**
- ✅ Migrated — uses canonical path as of Task #1541
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
| **CF-01** | Pro Forma | Valuation Grid | `noi` | ✅ Fixed — `getFieldValue('noi')` in `getSubjectProperty()` |
| **CF-02** | Pro Forma | Validation Grid | `exit_cap` | ✅ Fixed — `fin != null` guard |
| **CF-03** | Pro Forma | Validation Grid | `hold_period_years` | ✅ Fixed — `fin != null` guard |
| **CF-04** | Pro Forma | Validation Grid | `rent_growth_yr1` | ✅ Fixed — `fin != null` guard |
| **CF-05** | Pro Forma | Validation Grid | `purchase_price` | ✅ Fixed — `fin != null` guard |
| **CF-06** | Pro Forma | Validation Grid | `loan_amount` / `interest_rate` | ✅ Fixed — `fin != null` guard |

---

## Valuation Grid — backend field reads

Handled in `ValuationGridService.getSubjectProperty()` (backend, SQL).

| Field | Read path | Status |
|---|---|---|
| `noi` | `getFieldValue(pool, dealId, 'noi', 1)` | ✅ Migrated (CF-01) |
| `exit_cap` | `da.year1.exit_cap.resolved` (SQL) | ⚠️ Deferred to B3 |
| `hold_period_years` | `da.year1.hold_period_years.resolved` (SQL) | ⚠️ Deferred to B3 |
| `purchase_price` | `da.acquisition_price` (property table column) | 🔵 Native (not a LV field) |
| `egi` | `da.year1.egi.resolved` (SQL) | ⚠️ Deferred to B3 |
| `total_opex` | `da.year1.total_opex.resolved` (SQL) | ⚠️ Deferred to B3 |

---

## Other product surfaces (F4, F8)

| Surface | Field reads | Status |
|---|---|---|
| **F4 Market Intelligence** | Submarket/MSA metrics — from `market_sale_comps`, `historical_observations`, `ValuationGridService` | Not a deal-field surface; no cross-surface read risk |
| **F8 Investor / Capital** | LP/GP capital calls, distributions, waterfall — from `deals.investor_data` and dedicated investor services | Not a deal-assumption-field surface |

---

## Deferred to Piece B3 (Engine A write-back)

The fields marked ⚠️ above are still read from stored `da.year1[field].resolved` in raw
SQL within `ValuationGridService`. These will be migrated to `getFieldValue()` when
Piece B3 implements Engine A write-back — ensuring the stored `.resolved` is always
up-to-date before being read.

## Fields not yet in ALLOWED_FIELDS

These appear in `deal_assumptions.year1` but have no caller needing `getFieldValue` yet.
Add to the whitelist in `backend/src/services/field-access/get-field-value.service.ts`
when a surface needs canonical access:

`gpr`, `vacancy_loss`, `other_income`, `insurance`, `real_estate_taxes`, `management_fees`,
`payroll`, `repairs_maintenance`, `utilities`, `general_admin`, `marketing`,
`target_irr`, `target_em`, `pref_rate`, `gp_promote`, `construction_cost`,
`soft_costs`, `land_cost`.
