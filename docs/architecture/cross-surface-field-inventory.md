# Cross-Surface Field Inventory

Maps every key deal field to its canonical read source on each surface.
Established by Task #1541 (Piece B2). Update when new surfaces are added.

**Status legend:**
- ✅ Migrated — uses canonical path as of Task #1541
- 🔵 Native — surface owns this field; no cross-surface risk
- ⚠️ Deferred — known non-canonical path; scheduled for a later piece
- — Not displayed on this surface

---

## Leaf fields (set by operator or seeder)

| Field | Pro Forma | Valuation Grid | Returns Tab | Overview Tab | Validation Grid | Decision Tab |
|---|---|---|---|---|---|---|
| `exit_cap` | 🔵 `getDealFinancials` computes internally | ⚠️ SQL `year1.exit_cap.resolved` (deferred B3) | 🔵 `getDealFinancials → ret.exitCapRate` | 🔵 `f9Financials.proforma.valuationSnapshot` | ✅ `fin != null ? fin.assumptions.exitCap` (CF-02) | — |
| `hold_period_years` | 🔵 `getDealFinancials` | ⚠️ SQL `year1.hold_period_years.resolved` (deferred B3) | 🔵 `getDealFinancials → ret.holdPeriod` | `assumptions.holdPeriod` (local store) | ✅ `fin != null ? fin.assumptions.holdYears` (CF-03) | — |
| `rent_growth_yr1` | 🔵 `getDealFinancials` | — | — | — | ✅ `fin != null ? fin.assumptions.rentGrowthYr1` (CF-04) | — |
| `purchase_price` | 🔵 `getDealFinancials` | ⚠️ SQL `da.year1.purchase_price` (deferred B3) | 🔵 `getDealFinancials → capitalStack.purchasePrice` | `f9Financials.capitalStack.purchasePrice` | ✅ `fin != null ? fin.capitalStack.purchasePrice` (CF-05) | — |
| `loan_amount` | 🔵 `getDealFinancials` | — | — | — | ✅ `fin != null ? fin.capitalStack.loanAmount` (CF-06) | — |
| `interest_rate` | 🔵 `getDealFinancials` | — | — | — | ✅ `fin != null ? fin.assumptions.interestRate` (CF-06) | — |
| `egi` | 🔵 `getDealFinancials` | ⚠️ SQL `year1.egi.resolved` (deferred B3) | 🔵 `getDealFinancials → proforma` | `f9Financials.proforma.unitEconomics.egiPerUnit` | — | — |
| `total_opex` | 🔵 `getDealFinancials` | ⚠️ SQL `year1.total_opex.resolved` (deferred B3) | 🔵 `getDealFinancials → proforma` | `f9Financials.proforma.unitEconomics.opexPerUnit` | — | — |
| `replacement_reserves` | 🔵 `getDealFinancials` | — | — | — | — | — |

## Computed aggregates (Engine A formula)

| Field | Formula | Pro Forma | Valuation Grid | Returns Tab | Overview Tab | Validation Grid |
|---|---|---|---|---|---|---|
| `noi` | `egi − total_opex` | 🔵 `getDealFinancials` | ✅ `getFieldValue('noi')` (CF-01) | 🔵 `getDealFinancials → proforma.year1 noi row` | `f9Financials.proforma.unitEconomics.noiPerUnit` | — |
| `noi_after_reserves` | `(egi − total_opex) − replacement_reserves` | 🔵 `getDealFinancials` | — | 🔵 `getDealFinancials → proforma` | — | — |

## Canonical read path rules

| Surface | Canonical source | Notes |
|---|---|---|
| Pro Forma (all tabs) | `getDealFinancials()` response | Engine A computes and returns all fields. No direct DB reads in the Pro Forma render layer. |
| Valuation Grid (backend) | `ValuationGridService` → `getSubjectProperty()` | Aggregates: `getFieldValue()`. Leaf fields: direct SQL (deferred to B3). |
| Returns Tab | `getDealFinancials()` → `ret.*` and `capitalStack.*` | All reads from the same Engine A response as Pro Forma. |
| Overview Tab | `f9Financials.*` (Engine A response stored in React state) | Hold period falls back to `assumptions.holdPeriod` from local store — acceptable since overview is summary only. |
| Validation Grid (frontend) | `f9Financials` with `fin != null` guard | Falls back to `ModelAssumptions` only while Engine A hasn't responded (loading state). |
| Decision Tab | Not yet audited — deferred to Piece B4 | — |

## Fields not yet in ALLOWED_FIELDS (getFieldValue whitelist)

These fields appear in `deal_assumptions.year1` but are read via direct SQL or the
Engine A path only. They can be added to `ALLOWED_FIELDS` in
`backend/src/services/field-access/get-field-value.service.ts` when a surface needs
to read them via the canonical accessor:

`gpr`, `vacancy_loss`, `other_income`, `insurance`, `real_estate_taxes`, `management_fees`,
`payroll`, `repairs_maintenance`, `utilities`, `general_admin`, `marketing`,
`target_irr`, `target_em`, `pref_rate`, `gp_promote`, `construction_cost`,
`soft_costs`, `land_cost`.

## Deferred (Piece B3 — Engine A write-back)

Valuation Grid leaf fields (exitCap, holdYears, purchasePrice, EGI, total_opex) are
still read from stored `da.year1[field].resolved` in SQL. These will be migrated to
`getFieldValue()` when Piece B3 implements Engine A write-back, ensuring the stored
`.resolved` is always current before being read.
