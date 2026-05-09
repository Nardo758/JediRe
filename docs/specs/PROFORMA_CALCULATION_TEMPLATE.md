# ProForma Canonical Calculation Template

**Version:** 2026-05  
**Authority:** Derived from `proforma-seeder.service.ts` (FIELD_PRIORITIES), `proforma-adjustment.service.ts` (getDealFinancials), and `attached_assets/Pasted-I-have-the-canonical-ProForma-spec-from-jedi-framework-_1778106848690.txt` (v31 spec).  
**Related audit:** `docs/audits/PROFORMA_PIPELINE_AUDIT_2026-05.md`

This document is the single source of truth for: (1) which line items exist in the F9 Pro Forma, (2) exactly how each value is resolved from LayeredValue sources, (3) the formulas that derive subtotals, and (4) the confidence score assigned to each resolution source. It is read by the seeder, the assembly engine, and any future agent that produces or validates Pro Forma outputs.

---

## Part 1 — Resolution Rules

### 1.1 LayeredValue Source Hierarchy

Every Pro Forma field is stored as a `LayeredValue<number>` with these possible source keys:

| Key | Meaning | Confidence |
|---|---|---|
| `override` | User-entered value (pencil edit in UI) | 95 |
| `t12` | Trailing-12-month operating statement | 85 |
| `tax_bill` | Assessor/county tax bill PDF extraction | 85 |
| `rent_roll` | Rent roll extraction | 80 |
| `box_score` | Box score / summary sheet | 75 |
| `platform` | JEDI platform location baseline *(not yet implemented — always null)* | 70 |
| `platform_fallback` | Derived/computed with no document source | 65 |
| `om` | Offering memorandum — canonical broker layer | 60 |
| `broker` | Legacy alias for `om` (dead code — do not use) | 60 |
| `computed` | Formula-derived, no extraction source | 55 |

**Resolution algorithm (`resolve()`):**
1. If `override != null` → resolved = override, resolution = `'override'`. **Stop.**
2. Walk the field's priority list in order. For each source `src`: if `field[src] != null` AND (field is not in `SKIP_ZERO_FIELDS` OR value ≠ 0) → resolved = value, resolution = src. **Stop.**
3. If `platform != null` → resolved = platform, resolution = `'platform_fallback'`.
4. Otherwise resolved = null, resolution = `'platform_fallback'`.

### 1.2 SKIP_ZERO_FIELDS

These fields treat `0` as "missing" and fall through to the next source (protects against lease-up rent rolls that report zero GPR):

- `gpr`, `egi`, `noi`, `net_rental_income`, `other_income_total`, `other_income_per_unit`, `total_opex`

### 1.3 Field Priority Table (canonical)

| Field | Source priority order | Notes |
|---|---|---|
| `gpr` | t12 → rent_roll | T12 GPR preferred; rent roll is alternate. Unit-mix override available via `da:use_unit_mix_for_gpr` flag. |
| `loss_to_lease_pct` | t12 → rent_roll | |
| `vacancy_pct` | rent_roll → t12 | Rent roll preferred (reflects actual occupancy). |
| `concessions_pct` | t12 → rent_roll | |
| `bad_debt_pct` | t12 | T12 only; no rent roll source. |
| `non_revenue_units_pct` | t12 | T12 only. |
| `other_income_total` | rent_roll → t12 → om | |
| `other_income_per_unit` | rent_roll → t12 → om | Re-synced from breakdown sum after per-category resolution. |
| `real_estate_tax` | tax_bill → t12 | IC-04 tie-break: if \|t12 − tax_bill\|/tax_bill > 15%, use t12 even when tax_bill resolves first. |
| `management_fee_pct` | t12 | |
| `insurance` | t12 | |
| All controllable opex | t12 (with om as broker layer) | Explicit `priority: ['t12']` in seeder. |
| `replacement_reserves` | (none → om) | **BUG-05**: T12 source not read. Only om/override populate this field today. |

---

## Part 2 — Line Items and Formulas

### 2.1 Revenue Section

#### Gross Potential Rent (GPR)

```
Resolved via FIELD_PRIORITIES['gpr'] = ['t12', 'rent_roll']

GPR_unit_mix = Σ(unit_type_count × in_place_rent × 12)
  (only when da:use_unit_mix_for_gpr flag is true and unit_mix data exists)
  When active, this mutates the 'unit_mix' layer and forces resolution = 'unit_mix'.

Default resolution: t12 GPR annual total (from extraction_t12.gpr)
Fallback: rent_roll total annual rent (from extraction_rent_roll.total_annual_rent or floor_plan_mix sum)
Broker (om layer): extraction_om / broker_claims.proforma GPR

Seeder key: 'gpr'
Display fields: broker, platform, t12, rentRoll, resolved, perUnit
perUnit = resolved / totalUnits ($/unit/year)
```

#### Loss to Lease

```
loss_to_lease_pct resolved via ['t12', 'rent_roll']
  t12 source: extraction_t12.loss_to_lease_pct
  rent_roll source: extraction_rent_roll.loss_to_lease_pct

Loss to Lease ($) = GPR × loss_to_lease_pct    [toDollarRow, multiplier = GPR_resolved]
  (displayed as canonical dollar row 'loss_to_lease'; pct row 'loss_to_lease_pct' also retained)
```

#### Vacancy & Credit Loss

```
vacancy_pct resolved via ['rent_roll', 't12']
  rent_roll source: extraction_rent_roll.vacancy_pct
  t12 source: extraction_t12.vacancy_pct

M07 derived vacancy (informational, not used in resolution):
  Primary:   1 - (T01_weekly_tours × T05_closing_ratio × 52 × avg_lease_term) / total_units
  Secondary: traffic_projections.yearly[0].vacancyPct
  Tertiary:  proforma_assumptions.vacancy_current / 100
  Cap: [M05_equilibrium_min, 0.30]

Vacancy Loss ($) = GPR × vacancy_pct    [toDollarRow, multiplier = GPR_resolved]
```

#### Concessions

```
concessions_pct resolved via ['t12', 'rent_roll']

Concessions ($) = GPR × concessions_pct    [toDollarRow, multiplier = GPR_resolved]
```

#### Bad Debt

```
bad_debt_pct resolved via ['t12']

⚠️ IMPLEMENTATION NOTE (BUG-06): Bad debt is currently applied to full EGI
(NRI + Other Income), not just to rental income. The v31 spec places bad debt
as a GPR deduction in the revenue waterfall. See audit BUG-06 for correction plan.

Current implementation:
  EGI_pre = NRI + Other Income
  EGI = EGI_pre × (1 - bad_debt_pct)

Canonical spec (to be corrected):
  NRI = GPR × (1 - loss_to_lease_pct - vacancy_pct - concessions_pct
                 - non_revenue_units_pct - bad_debt_pct)
  EGI = NRI + Other Income
```

#### Non-Revenue Units

```
non_revenue_units_pct resolved via ['t12']

Non-Revenue Units ($) = GPR × non_revenue_units_pct    [toDollarRow, multiplier = GPR_resolved]
```

#### Net Rental Income (NRI)

```
NRI = GPR
    - GPR × loss_to_lease_pct
    - GPR × vacancy_pct
    - GPR × concessions_pct
    - GPR × non_revenue_units_pct

Stored as LayeredValue with resolution = 'platform_fallback' (fully derived).
Not resolved from any document source directly.
```

#### Other Income

```
other_income_per_unit resolved via ['rent_roll', 't12', 'om']
  (per-unit monthly rate; multiplier for $ total = total_units × 12)

Per-category breakdown (other_income_breakdown JSONB):
  Keys: parking, utility_reimb_rubs, valet_trash, cable_internet,
        washer_dryer, renters_insurance, storage, other_ancillary, pet_fees
  Each resolved independently via ['rent_roll', 'om'] with t12 as fallback.

User-added lines (other_income_user_lines array):
  { monthly: number, label: string }  — added via dedicated CRUD endpoints

Other Income Total ($) = Σ(other_income_breakdown[*].resolved) + Σ(user_lines[*].monthly × 12)

other_income_per_unit is re-synced = OtherIncomeTotal / total_units / 12
  (unless user has an override on other_income_per_unit directly)
```

#### Effective Gross Income (EGI)

```
Current formula (see BUG-06 caveat):
  EGI_pre_bad_debt = NRI + Other Income Total
  EGI = EGI_pre_bad_debt × (1 - bad_debt_pct)

Stored as LayeredValue with resolution = 'platform_fallback' (fully derived).
```

---

### 2.2 Expenses — Controllable

For all controllable opex fields:
- **Source priority:** `['t12']` (T12 is authoritative; platform as fallback when implemented)
- **Broker layer (om):** populated from `broker_claims.proforma` OM capsule values
- **Platform layer:** always null today (BUG-01 pending location-baseline service)
- **Dollar value:** total for property (per-unit × units conversion happens at read/display layer)

| Field | Seeder key | T12 capsule key | Broker (OM) source |
|---|---|---|---|
| Personnel | `payroll` | `t12Opex.payroll` | `broker_claims.proforma.payroll` |
| Repair & Maintenance | `repairs_maintenance` | `t12Opex.r_and_m` | `broker_claims.proforma.r_and_m` |
| Turnover / Make-Ready | `turnover` | `t12Opex.turnover` | `broker_claims.proforma.turnover` |
| Contract Services | `contract_services` | `t12Opex.contract` | *(none currently)* |
| Marketing / Advertising | `marketing` | `t12Opex.marketing` | `broker_claims.proforma.marketing` |
| Administrative | `g_and_a` | `t12Opex.g_and_a` | `broker_claims.proforma.g_and_a` |

**Subtotal — Controllable Expenses:**
```
Controllable = payroll + repairs_maintenance + turnover + contract_services
             + marketing + g_and_a
(+ amenities, office, hoa_dues — seeded but not in v31 OPEX_FIELDS display)
```

---

### 2.3 Expenses — Non-Controllable

| Field | Seeder key | T12 capsule key | Priority | Notes |
|---|---|---|---|---|
| Water & Sewer | `water_sewer` | *(not seeded)* | — | **BUG-04**: compound `utilities` used instead |
| Electric | `electric` | *(not seeded)* | — | **BUG-04**: not seeded separately |
| Gas / Fuel | `gas_fuel` | *(not seeded)* | — | **BUG-04**: not seeded separately |
| Utilities (compound) | `utilities` | `t12Opex.utilities` | t12 | Used until BUG-04 is fixed |
| Insurance | `insurance` | `t12Opex.insurance` | t12 | Warn when T12 has no insurance line |
| Property Tax | `real_estate_tax` | `t12Opex.real_estate_tax` | tax_bill → t12 | IC-04 tie-break applies |
| Management Fee | `management_fee_pct` | `t12Opex.mgmt_fee / egi` | t12 | Dollar = EGI × management_fee_pct |
| Landscaping / Grounds | `landscaping` | *(not seeded)* | — | **BUG-04**: presumed in contract_services |

#### Management Fee

```
management_fee_pct resolved via ['t12']
  t12 source: mgmt_fee_t12 / t12_egi (ratio)
  om source: broker_claims.proforma.mgmt_pct

Management Fee ($) = EGI × management_fee_pct    [toDollarRow, multiplier = EGI_resolved]
  (uses post-bad-debt EGI — consistent with industry convention)
```

#### Property Tax

```
real_estate_tax resolved via ['tax_bill', 't12']

Tax Bill path: extraction_tax_bill
  Base: annual_tax_current ?? totalAnnualTax
  Scenarios when appeal pending:
    appeal_settled_at_current = billCurrent
    appeal_lost_unappealed = billUnappealed
  Warning appended when appeal_status = 'pending'

IC-04 tie-break (applied after initial resolution):
  IF resolution = 'tax_bill'
    AND |t12 - tax_bill| / tax_bill > 15%
  THEN force resolved = t12, resolution = 't12'
  (Assessor bill pre-dates reassessment; T12 reflects actual paid amount)
```

**Subtotal — Non-Controllable Expenses:**
```
Non-Controllable = utilities (or water_sewer + electric + gas_fuel when split)
                 + insurance + real_estate_tax + management_fee_dollar
                 + personal_property_tax (if present)
```

**Total Operating Expenses:**
```
Total OpEx = Controllable + Non-Controllable
           + replacement_reserves (below-the-line — excluded from Total OpEx per spec)
           + custom_opex_* (unrecognized GL lines from T12 that pass EXCLUDE_FROM_CUSTOM_OPEX filter)

NOTE: replacement_reserves is NOT included in total_opex_resolved in the seeder.
It is a below-the-line item shown separately between NOI and Debt Service.
```

---

### 2.4 NOI

```
NOI = EGI - Total Operating Expenses

Stored as LayeredValue:
  om layer: broker_claims.proforma.noi (from OM extraction)
  resolved: EGI_resolved - total_opex_resolved
  resolution: 'platform_fallback' (fully derived)

NOI per unit = NOI / total_units
```

---

### 2.5 Below-the-Line (Projections Tab Only)

These items appear in the Projections tab, not the Year-1 Pro Forma summary.

#### Replacement Reserves

```
replacement_reserves resolved via: om → override    [BUG-05: no T12 source]
  om source: broker_claims.proforma.replacement_reserves

This is a below-the-line item; not included in Total OpEx.
NOI After Reserves = NOI - replacement_reserves
```

#### Debt Service

```
Interest rate:        deal_assumptions.interest_rate
IO period:            deal_assumptions.io_period_months
Amortization:         deal_assumptions.amortization_years
Loan amount:          purchase_price × ltc_pct (or deal_assumptions.ltv)

During IO period:
  Interest Expense = loan_amount × interest_rate
  Principal = 0

Post-IO:
  Annual debt service = loan_amount × [r(1+r)^n / ((1+r)^n - 1)]
  where r = interest_rate / 12 (monthly), n = amortization_years × 12
  Interest Expense = beginning_balance × interest_rate
  Principal = total_payment - interest_expense

DSCR = NOI / Total Debt Service
```

---

### 2.6 Capital Stack

```
purchase_price: deal_data.purchase_price ?? deal_data.asking_price ?? deals.budget
loan_amount: purchase_price × ltc_pct
equity_at_close: purchase_price - loan_amount + capitalized_lease_up_total
  (capitalized_lease_up_total > 0 only when leasingCostTreatment = 'CAPITALIZED' or 'HYBRID')

price_per_unit: purchase_price / total_units
```

---

### 2.7 Projection Engine (Years 2–N)

```
Per-year loop (perYear array, length = holdYears, default 10):

  rentGrowthPct[yr]:
    growthBase = rentGrowthYr1 ?? calibrated.rentGrowthPct
    growthStab = rentGrowthStabilized ?? growthBase
    blendFactor = min(1, (yr - 1) / 5)
    rentGrowthPct[yr] = growthBase + (growthStab - growthBase) × blendFactor
    Override: per_year_overrides['rent_growth_pct:yr{N}']

  vacancyPct[yr]:
    Base = calibrated.vacancyPct ?? derivedVacancyPct (year 1 only)
    vacancyPct[yr] = min(0.30, vacancyBase)
    Override: per_year_overrides['vacancy_pct:yr{N}']

  exitCapIfLastYear[yr]:
    Only populated for yr = holdYears
    Source: deal_assumptions.exit_cap (decimal form, e.g. 0.055)

  capexDraw[yr]:
    Source: per_year_overrides['capexPerYear:yr{N}'] ($/unit)

OpEx growth:
  opexGrowthRate = proforma_assumptions.opex_growth_current / 100
  Fallback: 3% (0.03)
  Applied as compounding multiplier: opex[yr] = opex[yr-1] × (1 + opexGrowthRate)

Concession burn-off:
  concessionBurnOffPct = per_year_overrides['concessionBurnOffPct:yr1']
  Used by projection engine for concession amortization (CAPITALIZED path)
```

---

### 2.8 Returns (Projections Tab)

```
IRR: xirr(cashflows) — Newton-Raphson, annual cashflows
  cashflows[0] = -equityAtClose
  cashflows[1..N-1] = CFBT[yr]  (cash flow before tax)
  cashflows[N] = CFBT[N] + net_sale_proceeds

Net Sale Proceeds:
  exit_value = NOI[N] / exit_cap_rate
  gross_sale = exit_value
  selling_costs = gross_sale × selling_costs_pct
  net_sale = gross_sale - selling_costs - remaining_loan_balance

Equity Multiple (EM) = total_distributions / equityAtClose
Cash-on-Cash (CoC) = CFBT[yr] / equityAtClose
DSCR = NOI[yr] / total_debt_service[yr]
Debt Yield = NOI[yr] / loan_amount
```

---

## Part 3 — F9 Tab Structure

Per `attached_assets/Pasted-I-have-the-canonical-ProForma-spec-from-jedi-framework-_1778106848690.txt` (v31 spec):

**9-tab layout (shipped):**

| Tab | Contents |
|---|---|
| Overview | Deal summary, key metrics, JEDI score |
| Pro Forma | Year-1 operating statement: GPR → EGI → OpEx → NOI |
| Projections | 10-year column grid: NOI, Debt Service, CFBT, DSCR, CoC, DY |
| Assumptions | Section A (document-sourced Y1 inputs) + Section B (trajectory Y2+ inputs) |
| Debt | Capital stack, IO schedule, amortization table, DSCR by year |
| Waterfall | LP/GP split, preferred return, promote |
| Sensitivity | Two-axis sensitivity grid (exit cap × rent growth, etc.) |
| Decision | Go/No-Go framework, risk flags, alerts |
| Compare | Field-by-field comparison: broker / platform / user / resolved |

**12-tab spec (original design, partially merged into 9-tab):**

Taxes, Sources & Uses, and Returns were folded into Overview + Assumptions in the v31 revision. If any of these are re-added as standalone tabs, the 7-Ring Schema Change Rule applies.

---

## Part 4 — 7-Ring Schema Change Rule

Any add/delete of a Pro Forma or Projections line item must update all 7 rings. See `CLAUDE.md` for the full table. Summary:

| Ring | Surface |
|---|---|
| 0 | Database schema (migration + seed data) |
| 1 | F9 Tabs (AssumptionsTab STATIC_ROWS, ProjectionsTab columns, etc.) |
| 2 | Backend types + DealContext + dealStore |
| 3 | Document parsers *(Section A fields only)* |
| 4 | Downstream module consumers (underwriting, DSCR, returns, sensitivity) |
| 5 | Agent logic (CashFlow Agent prompt + tool schema) |
| 6 | Excel export (`buildProjectionsSheet` row map) |
| 7 | Archive backfill plan |

**Section A** (document-sourced, Y1 base): requires Ring 3. Editing recomputes Y1 and cascades to Y2+.  
**Section B** (trajectory/platform/agent, Y2+): Ring 3 NOT required. Y1 is never modified by Section B edits.

---

## Part 5 — Source Key Glossary

| Code | LayeredValue key | Document / system |
|---|---|---|
| T12 | `t12` | Trailing-12-month P&L (extraction_t12 capsule) |
| RR | `rent_roll` | Rent roll (extraction_rent_roll capsule) |
| TB | `tax_bill` | County/assessor tax bill (extraction_tax_bill capsule) |
| OM | `om` | Offering Memorandum (extraction_om capsule; canonical broker layer) |
| OVR | `override` | Analyst pencil edit (persisted in year1 JSONB override slot) |
| PLT | `platform` | JEDI location baseline *(not yet implemented — always null)* |
| PFB | `platform_fallback` | Derived/computed; no document source |
| BSC | `box_score` | Box score summary sheet extraction |

---

## Part 6 — Known Deviations from v31 Spec

| # | Spec requirement | Current implementation | Audit ref |
|---|---|---|---|
| 1 | Bad debt is a GPR deduction in the revenue waterfall | Bad debt applied to full EGI (NRI + Other Income) | BUG-06 |
| 2 | Platform baseline column populated from JEDI location model | Platform baseline is always null (TODO) | BUG-01 |
| 3 | `water_sewer`, `electric`, `gas_fuel` as separate opex rows | Single compound `utilities` field only | BUG-04 |
| 4 | `landscaping` as separate opex row | Not seeded; presumed in contract_services | BUG-04 |
| 5 | `replacement_reserves` sourced from T12 when available | No T12 read; only om/override | BUG-05 |
| 6 | `NOI After Reserves` as distinct subtotal line | `replacement_reserves` exists as LayeredValue but subtotal not consistently shown | — |
