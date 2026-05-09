# ProForma Canonical Calculation Template

**Version:** 2026-05
**Authority:** `proforma-seeder.service.ts` (FIELD_PRIORITIES, resolve() logic),
`proforma-adjustment.service.ts` (getDealFinancials assembly, REVENUE_FIELDS / OPEX_FIELDS),
`attached_assets/F9_Financial_Model_-_Agent_Specification_1777735712565.txt` (math spec),
`attached_assets/Pasted--JEDI-RE-CashFlow-Agent-Underwriting-Specification-How-_1776632066856.txt`
(evidence-tier model), `jedi-framework-v31.jsx` (canonical line-item spec, referenced in
`attached_assets/Pasted-I-have-the-canonical-ProForma-spec-from-jedi-framework-_1778106848690.txt`).
**Related audit:** `docs/audits/PROFORMA_PIPELINE_AUDIT_2026-05.md`

---

## How to Read This Document

Each row describes one Pro Forma line item. Columns are:

- **ID** — unique identifier for cross-references
- **Display label** — text shown in ProFormaSummaryTab
- **Category** — REVENUE / CTRLL_OPEX / NCTRL_OPEX / CAPEX / SUBTOTAL / BELOW_NOI
- **Type** — `sourced` (reads from extraction capsule), `derived` (formula over sourced fields), `user-input` (operator-only), `not-assembled` (spec'd but absent from year1 row array)
- **Formula** — exact derivation rule; variables reference other IDs
- **Source tier** — evidence priority order per FIELD_PRIORITIES
- **Display format** — UI formatting
- **Sign convention** — `+` = income / additive; `−` = cost / deduction
- **Phase flag** — `ALL`, `EXISTING`, `LEASE_UP`, `DEVELOPMENT`
- **Broker path** — how broker value reaches `year1.FIELD.om`
- **Platform path** — how platform value reaches `year1.FIELD.platform`
- **User path** — how operator override reaches `year1.FIELD.override`

All subtotals are stored as regular LayeredValue rows in `deal_assumptions.year1` JSONB
and returned as `OperatingStatementRow` objects. There is no `isSubtotal` metadata flag
in the API shape — subtotals are identified by field key.

---

## Section 1 — Revenue

### REV-001: Gross Potential Rent (GPR)

| Attribute | Value |
|---|---|
| **ID** | REV-001 |
| **Display label** | Gross Potential Rent |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, rent_roll_gpr, t12_gpr, om_gpr, platform_gpr)` |
| **Inputs** | `rent_roll.total_rent_annual`, `t12.scheduled_rent_annual`, `broker_claims.proforma.stabilizedGpr`, `platform.gpr_per_unit_per_month × totalUnits × 12` |
| **Source tier** | Tier 1 (rent_roll) > Tier 1 (T12) > Tier 4 (OM) > Tier 3 (platform) |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | + (income) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedGpr` → `year1.gpr.om`. **BUG-11:** mapping absent; `year1.gpr.om = null` despite capsule existing. |
| **Platform path** | `platform.gpr_per_unit_per_month × totalUnits × 12` → `year1.gpr.platform`. **BUG-01:** always null. |
| **User path** | `PATCH /api/v1/deals/:dealId/financials/override` → `year1.gpr.override`. Live (464 Bishop): $4,901,400. |

### REV-002: Vacancy Loss

| Attribute | Value |
|---|---|
| **ID** | REV-002 |
| **Display label** | Vacancy & Credit Loss |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `vacancy_loss = GPR × vacancy_pct.resolved` (assembled via `toDollarRow('vacancy_pct', 'vacancy_loss', ..., GPR)`) |
| **Inputs** | REV-001 (GPR), REV-002a (vacancy_pct) |
| **Source tier** | Derived — magnitude set by REV-002a |
| **Display format** | `($N,NNN,NNN)` |
| **Sign convention** | − (deduction from GPR) |
| **Phase flag** | ALL |
| **Broker path** | Via REV-002a |
| **Platform path** | Via REV-002a |
| **User path** | Via REV-002a |

### REV-002a: Vacancy Rate (intermediate field)

| Attribute | Value |
|---|---|
| **ID** | REV-002a |
| **Display label** | Vacancy % (intermediate — not a rendered row) |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, rent_roll_vac, t12_vac, om_vac, platform_vac)` per `FIELD_PRIORITIES['vacancy_pct'] = ['rent_roll', 't12', 'om']` |
| **Inputs** | `rent_roll.vacant_units / total_units`, `t12.vacancy_loss / scheduled_rent` (BUG-04: formula error → 66%), `broker_claims.proforma.stabilizedVacancy`, M07 equilibrium floor |
| **Source tier** | Tier 1 (rent_roll) > Tier 1 (T12) > Tier 4 (OM) > Tier 3 (M07 floor) |
| **Display format** | `N.N%` |
| **Sign convention** | + (rate; applied as − in REV-002) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedVacancy` → `year1.vacancy_pct.om`. Live: 0.05 (5%). |
| **Platform path** | `trafficProjection.calibrated.vacancyPct` used as floor only; direct platform slot null (BUG-01). |
| **User path** | `year1.vacancy_pct.override`. Live: null (using rent_roll = 19.83%). |
| **Known issue** | T12 vacancy for 464 Bishop = 66.0% — formula error (BUG-04); rent_roll (19.83%) used instead. System A vacancy = 5% (BUG-08). |

### REV-003: Loss to Lease

| Attribute | Value |
|---|---|
| **ID** | REV-003 |
| **Display label** | Loss to Lease |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `loss_to_lease = GPR × loss_to_lease_pct.resolved` (via `toDollarRow`) |
| **Inputs** | REV-001 (GPR), REV-003a (loss_to_lease_pct) |
| **Source tier** | Derived |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Via REV-003a |
| **Platform path** | Via REV-003a |
| **User path** | Via REV-003a |

### REV-003a: Loss-to-Lease Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | REV-003a |
| **Display label** | Loss to Lease % (intermediate) |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, t12_ltl_pct, rent_roll_ltl_pct, om_ltl, null)` per `FIELD_PRIORITIES['loss_to_lease_pct'] = ['t12', 'rent_roll', 'om']` |
| **Inputs** | `t12.loss_to_lease / t12.scheduled_rent`, `rent_roll.avg_loss_to_lease_pct`, `broker_claims.proforma.lossToLease` |
| **Source tier** | Tier 1 (T12) > Tier 1 (rent_roll) > Tier 4 (OM) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.lossToLease` → `year1.loss_to_lease_pct.om`. Live: 0 (OM claims no LTL). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.loss_to_lease_pct.override`. Live: null (resolves to T12 = 0.35%). |

### REV-004: Concessions

| Attribute | Value |
|---|---|
| **ID** | REV-004 |
| **Display label** | Concessions |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `concessions = GPR × concessions_pct.resolved` (via `toDollarRow`) |
| **Inputs** | REV-001 (GPR), REV-004a (concessions_pct) |
| **Source tier** | Derived |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Via REV-004a |
| **Platform path** | Via REV-004a |
| **User path** | Via REV-004a |

### REV-004a: Concessions Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | REV-004a |
| **Display label** | Concessions % (intermediate) |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, t12_conc_pct, rent_roll_conc_pct, om_conc, null)` per `FIELD_PRIORITIES['concessions_pct'] = ['t12', 'rent_roll', 'om']` |
| **Inputs** | `t12.concessions / t12.scheduled_rent`, `rent_roll.concessions_pct`, `broker_claims.proforma.concessionsPct` |
| **Source tier** | Tier 1 (T12) > Tier 1 (rent_roll) > Tier 4 (OM) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.concessionsPct` → `year1.concessions_pct.om`. Live: 0 (OM claims none). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.concessions_pct.override`. Live: null (resolves to T12 = 7.78%). |
| **Known collision** | OM = 0%, T12 = 7.78% — not flagged. |

### REV-005: Bad Debt

| Attribute | Value |
|---|---|
| **ID** | REV-005 |
| **Display label** | Bad Debt |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `bad_debt = NRI_pre_bad_debt × bad_debt_pct.resolved` where `NRI_pre_bad_debt = GPR − vacancy_loss − LTL − concessions − non_revenue_units` |
| **Inputs** | REV-001 through REV-005a |
| **Source tier** | Derived |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Via REV-005a |
| **Platform path** | Via REV-005a |
| **User path** | Via REV-005a |

### REV-005a: Bad Debt Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | REV-005a |
| **Display label** | Bad Debt % (intermediate) |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, t12_bd_pct, null)` per `FIELD_PRIORITIES['bad_debt_pct'] = ['t12']` |
| **Inputs** | `t12.bad_debt / t12.scheduled_rent` |
| **Source tier** | Tier 1 (T12) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.badDebtPct` → `year1.bad_debt_pct.om`. Live: null (OM did not provide). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.bad_debt_pct.override`. Live: null (resolves to T12 = 3.34%). |

### REV-006: Non-Revenue Units

| Attribute | Value |
|---|---|
| **ID** | REV-006 |
| **Display label** | Non-Revenue Units |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `non_revenue_units = GPR × non_revenue_units_pct.resolved` (via `toDollarRow`) |
| **Inputs** | REV-001, `year1.non_revenue_units_pct` |
| **Source tier** | Derived |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL — Phase 2 feature (may be 0 for many deals) |
| **Broker path** | Not typically in OM capsule |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.non_revenue_units_pct.override` |

### REV-007: Other Income

| Attribute | Value |
|---|---|
| **ID** | REV-007 |
| **Display label** | Other Income |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `other_income = other_income_per_unit.resolved × totalUnits × 12` (via `toDollarRow('other_income_per_unit', 'other_income', ..., totalUnits × 12)`, `proforma-adjustment.service.ts:1966`) |
| **Inputs** | `rent_roll.other_income_breakdown` (parking, RUBS, pet rent, application fees, late fees), `t12.other_income`, `broker_claims.proforma.stabilizedOtherIncomeAnnual ÷ totalUnits ÷ 12` |
| **Source tier** | Tier 1 (rent_roll) > Tier 1 (T12) > Tier 4 (OM) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedOtherIncomeAnnual ÷ totalUnits ÷ 12` → `year1.other_income_per_unit.om`. Live: $307.76/unit/yr. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.other_income_per_unit.override`. Live: null (resolves to rent_roll = $75.34/unit/yr). |
| **Known collision** | OM $1,474/unit/yr vs rent_roll $75/unit/yr — 19.6× discrepancy, not flagged. |

### REV-008: Net Rental Income (NRI) — Sub-subtotal

| Attribute | Value |
|---|---|
| **ID** | REV-008 |
| **Display label** | Net Rental Income |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `NRI = GPR − vacancy_loss − loss_to_lease − concessions − bad_debt − non_revenue_units` |
| **Inputs** | REV-001 through REV-006 |
| **Source tier** | Derived |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | Not a direct broker field |
| **Platform path** | null |
| **User path** | No direct override |

### REV-009: Effective Gross Income (EGI)

| Attribute | Value |
|---|---|
| **ID** | REV-009 |
| **Display label** | Effective Gross Income |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `EGI = NRI + other_income` = `REV-008 + REV-007` |
| **Inputs** | REV-007, REV-008 |
| **Source tier** | Derived (subtotal — stored in `year1.egi`) |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedEgi = $4,998,237`. Not in a direct `year1.egi.om` slot; derived from broker components. Collision vs resolved ($3,615,849): −27.7% — not flagged (BUG-06). |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override; indirectly via component overrides |
| **Live value (464 Bishop)** | $3,615,849.05 |

---

## Section 2 — Controllable Operating Expenses

Seeder canonical list: `OPEX_FIELDS` at `proforma-adjustment.service.ts:1844`.
For all CTRLL rows: `resolved = COALESCE(override, om, t12, platform)` unless noted.
All platform slots are null (BUG-01). All `benchmarkPosition` fields are null.

### CTRLL-001: Repairs & Maintenance

| Attribute | Value |
|---|---|
| **ID** | CTRLL-001 |
| **Display label** | Repair & Maintenance |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_rm, t12_rm, platform_rm)` |
| **Inputs** | `broker_claims.proforma.repairsMaintenanceAnnual`, `t12.repairs_maintenance`, `platform.opex_per_unit_annual.maintenance × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.repairsMaintenanceAnnual` → `year1.repairs_maintenance.om`. Live: $69,600. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.repairs_maintenance.override`. Live: $69,600. |

### CTRLL-002: Contract Services

| Attribute | Value |
|---|---|
| **ID** | CTRLL-002 |
| **Display label** | Contract Services |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_contract, t12_contract, platform_contract)` |
| **Inputs** | `broker_claims.proforma.contractServicesAnnual`, `t12.contract_services`, `platform.opex_per_unit_annual.contract_services × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.contractServicesAnnual` → `year1.contract_services.om`. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.contract_services.override` |

### CTRLL-003: Landscaping / Grounds

| Attribute | Value |
|---|---|
| **ID** | CTRLL-003 |
| **Display label** | Landscaping / Grounds |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_landscaping, t12_landscaping, platform_landscaping)` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Not typically in OM capsule |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.landscaping.override` |

### CTRLL-004: Payroll & Benefits

| Attribute | Value |
|---|---|
| **ID** | CTRLL-004 |
| **Display label** | Personnel |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_payroll, t12_payroll, platform_payroll)` |
| **Inputs** | `broker_claims.proforma.payrollAnnual`, `t12.payroll`, `platform.opex_per_unit_annual.payroll × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.payrollAnnual` → `year1.payroll.om`. Live: $324,800. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.payroll.override`. Live: $324,800. |
| **Known issue** | T12 payroll = $29,125 — partial year or miscategorised. |

### CTRLL-005: Marketing / Advertising

| Attribute | Value |
|---|---|
| **ID** | CTRLL-005 |
| **Display label** | Marketing / Advertising |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_marketing, t12_marketing, platform_marketing)` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.marketingAnnual` → `year1.marketing.om`. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.marketing.override` |

### CTRLL-006: General & Administrative

| Attribute | Value |
|---|---|
| **ID** | CTRLL-006 |
| **Display label** | Administrative |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_ga, t12_ga, platform_ga)` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.gAndAAnnual` → `year1.g_and_a.om`. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.g_and_a.override` |

### CTRLL-007: Turnover / Make-Ready

| Attribute | Value |
|---|---|
| **ID** | CTRLL-007 |
| **Display label** | Turnover / Make-Ready |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_turnover, t12_turnover, platform_turnover)` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.turnoverAnnual` → `year1.turnover.om`. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.turnover.override` |

---

## Section 3 — Non-Controllable Operating Expenses

### NCTRL-001: Water & Sewer

| Attribute | Value |
|---|---|
| **ID** | NCTRL-001 |
| **Display label** | Water & Sewer |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_water_sewer, t12_water_sewer, platform_water_sewer)` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Not typically in OM capsule (included in utilities bundle) |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.water_sewer.override` |

### NCTRL-002: Electric

| Attribute | Value |
|---|---|
| **ID** | NCTRL-002 |
| **Display label** | Electric |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_electric, t12_electric, platform_electric)` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Typically bundled under `utilitiesAnnual` in OM |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.electric.override` |

### NCTRL-003: Gas / Fuel

| Attribute | Value |
|---|---|
| **ID** | NCTRL-003 |
| **Display label** | Gas / Fuel |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_gas_fuel, t12_gas_fuel, platform_gas_fuel)` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Typically bundled under `utilitiesAnnual` |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.gas_fuel.override` |

### NCTRL-004: Property Insurance

| Attribute | Value |
|---|---|
| **ID** | NCTRL-004 |
| **Display label** | Insurance |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, platform_insurance, t12_insurance, null)` per `FIELD_PRIORITIES['insurance'] = ['t12']`; platform checked before t12 in `resolve()` call |
| **Inputs** | `platform.opex_per_unit_annual.insurance × totalUnits`, `t12.insurance`, `broker_claims.proforma.insuranceAnnual` |
| **Source tier** | Tier 3 (platform) > Tier 1 (T12) > Tier 4 (OM). Spec: `insuranceService.forecast()` should drive this — not implemented. |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.insuranceAnnual` → `year1.insurance.om`. Live: $46,400. |
| **Platform path** | `platform.opex_per_unit_annual.insurance × totalUnits` → `year1.insurance.platform`. Live: null — no benchmark (BUG-01, BUG-09). |
| **User path** | `year1.insurance.override`. Live: $46,400. |
| **Known issue** | T12 insurance = null. LV.warning: "No property insurance line in T12 — using platform baseline." Platform also null. Warning not surfaced in API (BUG-14). |

### NCTRL-005: Real Estate Taxes

| Attribute | Value |
|---|---|
| **ID** | NCTRL-005 |
| **Display label** | Property Tax |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, tax_bill_annual, t12_re_tax, null)` per `FIELD_PRIORITIES['real_estate_tax'] = ['tax_bill', 't12']` |
| **Inputs** | `tax_bill.assessed_value × millage_rate` (extracted from tax bill PDF), `t12.real_estate_taxes`, `broker_claims.proforma.realEstateTaxesAnnual` |
| **Source tier** | Tier 1 (tax_bill) > Tier 1 (T12). Spec: `taxService.forecast()` per jurisdiction ruleset — not implemented for this P&L line (BUG-05). |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.realEstateTaxesAnnual` → `year1.real_estate_tax.om`. Live: null (OM did not include RE tax). |
| **Platform path** | null — `taxService.forecast()` not wired for P&L line (BUG-05). |
| **User path** | `year1.real_estate_tax.override` |
| **Known issue** | tax_bill = $20,731 vs T12 = $1,127,126 — 54× gap. Partial-year or pre-reassessment bill. |

### NCTRL-006: Management Fee

| Attribute | Value |
|---|---|
| **ID** | NCTRL-006 |
| **Display label** | Management Fee |
| **Category** | NCTRL_OPEX |
| **Type** | derived |
| **Formula** | `management_fee = EGI × management_fee_pct.resolved` (via `toDollarRow('management_fee_pct', 'management_fee', ..., EGI)` at `proforma-adjustment.service.ts:1969`) |
| **Inputs** | REV-009 (EGI), NCTRL-006a (management_fee_pct) |
| **Source tier** | Derived — magnitude set by NCTRL-006a |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Via NCTRL-006a |
| **Platform path** | Via NCTRL-006a |
| **User path** | Via NCTRL-006a |
| **Live value (464 Bishop)** | $90,396 ($3,615,849 × 2.50%) |

### NCTRL-006a: Management Fee Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | NCTRL-006a |
| **Display label** | Management Fee % (intermediate) |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_mgmt_pct, t12_mgmt_pct, platform_mgmt_pct)` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.managementFeePct` → `year1.management_fee_pct.om`. Live: 2.75%. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.management_fee_pct.override`. Live: 2.50% (operator reduced). |
| **Known issue** | T12 mgmt_fee_pct = 11.42% — nonsensical; likely dollar amount / wrong base. |

---

## Section 4 — Subtotals

### SUB-001: Total Operating Expenses

| Attribute | Value |
|---|---|
| **ID** | SUB-001 |
| **Display label** | Total Operating Expenses |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `total_opex = SUM(CTRLL-001..007) + SUM(NCTRL-001..006)` — computed at seed time, stored in `year1.total_opex` |
| **Inputs** | All CTRLL and NCTRL rows |
| **Source tier** | Derived (stored subtotal) |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.totalOpexAnnual = $1,998,673` vs resolved $3,129,741 (+56.6%) — collision not flagged (BUG-06). |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override |
| **Live value (464 Bishop)** | $3,129,741.08 |
| **Integrity** | `EGI − NOI = $3,615,849 − $486,108 = $3,129,741` ✓ |

### SUB-002: Net Operating Income (NOI)

| Attribute | Value |
|---|---|
| **ID** | SUB-002 |
| **Display label** | Net Operating Income |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `NOI = EGI − total_opex` = `REV-009 − SUB-001` — computed at seed time, stored in `year1.noi` |
| **Inputs** | REV-009, SUB-001 |
| **Source tier** | Derived (stored subtotal) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedNOI = $2,999,564` vs resolved $486,108 (−83.8%) — critical collision not flagged (BUG-06). |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override |
| **Live value (464 Bishop)** | $486,107.97 |
| **Integrity check** | NOI = EGI − OpEx: $3,615,849 − $3,129,741 = $486,108 ✓ |

### SUB-003: NOI Margin

| Attribute | Value |
|---|---|
| **ID** | SUB-003 |
| **Display label** | NOI Margin |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `noi_margin = NOI / EGI` |
| **Inputs** | SUB-002, REV-009 |
| **Source tier** | Derived |
| **Display format** | `NN.N%` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | Derived from broker components |
| **Platform path** | null |
| **User path** | No override |
| **Live value (464 Bishop)** | 13.4% (vs OM implied 60.0%) |

---

## Section 5 — Capital & Reserves

### CAPEX-001: Replacement Reserves

| Attribute | Value |
|---|---|
| **ID** | CAPEX-001 |
| **Display label** | Replacement Reserves |
| **Category** | CAPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_reserves, platform_reserves)` |
| **Inputs** | `broker_claims.proforma.replacementReservesPerUnit × totalUnits`, `platform.replacement_reserves_per_unit × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN ($NNN/unit)` |
| **Sign convention** | − (below-NOI deduction) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.replacementReservesPerUnit × totalUnits` → `year1.replacement_reserves.om`. Live: $46,400 ($200/unit). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.replacement_reserves.override`. Live: $58,000 ($250/unit). |
| **Projection fallback** | In projection engine (line 3393): `reservesY1 = ry1('replacement_reserves') || (totalUnits × 350)` — fallback $350/unit if year1 null. |

### CAPEX-002: Capital Expenditure Draw (development / value-add)

| Attribute | Value |
|---|---|
| **ID** | CAPEX-002 |
| **Display label** | CapEx Draw |
| **Category** | CAPEX |
| **Type** | user-input |
| **Formula** | `capex_draw = capex_per_unit × totalUnits` |
| **Inputs** | `year1.capex_per_unit.override`, `totalUnits` |
| **Source tier** | User override only |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | DEVELOPMENT, REDEVELOPMENT |
| **Broker path** | Not typically in OM capsule |
| **Platform path** | null |
| **User path** | `year1.capex_per_unit.override` |

---

## Section 6 — Below-NOI (v31 Spec Required; Partially Not Assembled)

The v31 canonical spec defines these rows on the Pro Forma surface. Current state noted for each.

### BELOW-001: NOI After Reserves

| Attribute | Value |
|---|---|
| **ID** | BELOW-001 |
| **Display label** | NOI After Reserves |
| **Category** | BELOW_NOI |
| **Type** | not-assembled (BUG-13) |
| **Formula** | `noi_after_reserves = NOI − replacement_reserves` = `SUB-002 − CAPEX-001` |
| **Inputs** | SUB-002 (NOI = $486,108), CAPEX-001 (replacement_reserves = $58,000) |
| **Source tier** | Derived |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Expected value (464 Bishop)** | $486,108 − $58,000 = **$428,108** |
| **Live DB year1 value** | **null** — not in year1 OperatingStatementRow[] |
| **Where computed today** | Projection engine only: `proforma-adjustment.service.ts:3393` as `reservesY1` |
| **Gap** | v31 spec: "NOI AFTER RESERVES — subtotal" on Pro Forma surface. Absent from `getDealFinancials()` row assembly. `ProFormaSummaryTab` cannot render it. Fix: add as derived row in `getDealFinancials()` after NOI_FIELDS assembly. |
| **Broker path** | N/A — not implemented |
| **Platform path** | N/A — not implemented |
| **User path** | N/A — not implemented |

### BELOW-002: Total Debt Service

| Attribute | Value |
|---|---|
| **ID** | BELOW-002 |
| **Display label** | Total Debt Service |
| **Category** | BELOW_NOI |
| **Type** | not-assembled |
| **Formula** | `debt_service = annual_interest + annual_principal_amortization` (from capital stack loan terms) |
| **Inputs** | `capitalStack.loanAmount`, `capitalStack.interestRate`, `capitalStack.ioPeriodMonths`, `capitalStack.amortizationYears` |
| **Source tier** | Derived from capital stack |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL (0 when no debt) |
| **Expected value (464 Bishop)** | Not computed at year1 level — only in projections |
| **Live DB year1 value** | null — not in year1 OperatingStatementRow[] |
| **Where computed today** | Projection engine per year |
| **Gap** | v31 spec: "TOTAL DEBT SERVICE — total" on Pro Forma surface. Absent from year1 assembly. |
| **Broker path** | N/A |
| **Platform path** | N/A |
| **User path** | N/A |

### BELOW-003: Cash Flow Before Tax (CFBD)

| Attribute | Value |
|---|---|
| **ID** | BELOW-003 |
| **Display label** | Cash Flow Before Tax |
| **Category** | BELOW_NOI |
| **Type** | not-assembled |
| **Formula** | `cfbd = noi_after_reserves − total_debt_service` = `BELOW-001 − BELOW-002` |
| **Inputs** | BELOW-001 (NOI After Reserves), BELOW-002 (Total Debt Service) |
| **Source tier** | Derived |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + or − depending on leverage |
| **Phase flag** | ALL |
| **Live DB year1 value** | null — not in year1 OperatingStatementRow[] |
| **Where computed today** | `proFormaGenerator.ts:314` (`noi - debtService`) for 3D design model only. F9 pipeline: per-year projections array, not year1 summary. |
| **Per v31 spec** | "Cash Flow Before Tax — in Projections tab, not summary Pro Forma." CFBD is correctly a Projections-tab item per spec. |
| **Gap** | BELOW-001 (NOI After Reserves) IS required on the Pro Forma surface per spec. CFBD is NOT required on the Pro Forma surface — it belongs in Projections. |
| **Broker path** | N/A |
| **Platform path** | N/A |
| **User path** | N/A |

---

## Section 7 — System A Scalars (`GET /api/v1/proforma/:dealId`)

These are the 5 market-positioning scalars from the `proforma_assumptions` table.
They live in a completely separate system from the line items above (BUG-08).

| ID | Display label | Formula | Source | Display format | Sign | Phase | Broker path | Platform path | User path |
|---|---|---|---|---|---|---|---|---|---|
| SCA-001 | Rent Growth | `effective = user_override ?? current ?? baseline` | M35 news adjustment → current; M05 submarket → baseline (currently hardcoded 3.5% — BUG-03) | `N.N%` | + | ALL | None — System A has no broker field | `getMarketBaseline()` → hardcoded 3.5% (BUG-03) | `proforma_assumptions.rent_growth_user_override` |
| SCA-002 | Vacancy | `effective = user_override ?? current ?? baseline` | M35 → current; M07 calibrated → baseline (currently hardcoded 5.0% — BUG-03) | `N.N%` | + | ALL | None | Hardcoded 5.0% | `proforma_assumptions.vacancy_user_override` |
| SCA-003 | OpEx Growth | `effective = user_override ?? current ?? baseline` | M35 → current; CPI + 0.5% → baseline (currently hardcoded 2.8% — BUG-03) | `N.N%` | + | ALL | None | Hardcoded 2.8% | `proforma_assumptions.opex_growth_user_override` |
| SCA-004 | Exit Cap Rate | `effective = user_override ?? current ?? baseline` | M35 → current; M15 transaction comps → baseline (currently hardcoded 5.5% — BUG-03) | `N.NN%` | + | ALL | None | Hardcoded 5.5% | `proforma_assumptions.exit_cap_user_override` |
| SCA-005 | Absorption | `effective = user_override ?? current ?? baseline` | M35 → current; M07 signing velocity → baseline (currently hardcoded 8.0 leases/mo — BUG-03) | `N.N leases/mo` | + | LEASE_UP | None | Hardcoded 8.0 | `proforma_assumptions.absorption_user_override` |

---

## Appendix A — Resolution Priority Map

From `proforma-seeder.service.ts:136-148` (FIELD_PRIORITIES):

```typescript
const FIELD_PRIORITIES: Record<string, string[]> = {
  vacancy_pct:        ['rent_roll', 't12', 'om'],
  gpr:                ['override', 'rent_roll', 't12'],
  loss_to_lease_pct:  ['t12', 'rent_roll', 'om'],
  concessions_pct:    ['t12', 'rent_roll', 'om'],
  bad_debt_pct:       ['t12'],
  real_estate_tax:    ['tax_bill', 't12'],
  insurance:          ['t12'],      // platform checked first in resolve() call
  // all opex lines:  ['override', 'om', 't12', 'platform']
};
```

Generic `resolve(field, platformValue, { t12, rent_roll, om, tax_bill, existingOverride })`:
```
if existingOverride != null → override
elif field in t12-priority list AND t12 != null → t12
elif field in rent_roll-priority list AND rent_roll != null → rent_roll
elif om != null → om
elif platformValue != null → platform
else → null (resolution label: 'platform_fallback')
```

`platformValue` is null for every field in the live system (BUG-01).

---

## Appendix B — SOURCE_CONFIDENCE Lookup

From `proforma-adjustment.service.ts:1863-1874`:

| Resolution tag | Confidence (0-100) | Notes |
|---|---|---|
| `override` | 95 | Operator-confirmed |
| `t12` | 85 | Historical actuals (12+ months preferred) |
| `tax_bill` | 85 | Extracted from official document |
| `rent_roll` | 80 | Current lease data |
| `box_score` | 75 | Comp-set aggregation |
| `platform` | 70 | Market-wide (M05/M07) — but always null (BUG-01) |
| `platform_fallback` | 65 | Catch-all when no source provides data |
| `om` | 60 | Broker OM — lowest authority |
| `broker` | 60 | Alias for om |
| `computed` | 55 | Derived with no direct source |

---

## Appendix C — Known Bugs Affecting Line Items

| Bug ID | Affects rows | Impact on displayed value |
|---|---|---|
| BUG-01 | All rows — platform slot | benchmarkPosition always null; platform column always blank; broker is effective Tier 2 fallback |
| BUG-02 | SCA-001..005 computed metrics | IRR, NOI Year 1, CoC on System A computed with hardcoded phantom-deal inputs |
| BUG-03 | SCA-001..005 baselines | All 5 baselines hardcoded; no M05/M07/M15 integration |
| BUG-04 | REV-002a | T12 vacancy shows 66% (formula error); rent_roll (19.83%) used instead |
| BUG-05 | NCTRL-005 | taxService not called for P&L line; $20K bill vs $1.1M T12 unreconciled |
| BUG-06 | SUB-001, SUB-002, REV-009 | NOI/EGI/OpEx broker collisions (−83.8%, −27.7%, +56.6%) not flagged |
| BUG-08 | REV-002a vs SCA-002 | System A vacancy (5%) and System B vacancy (19.83%) fully decoupled |
| BUG-09 | NCTRL-004 | Platform slot null; LV.warning references non-existent baseline |
| BUG-11 | REV-001 | Broker GPR capsule not mapped to year1.gpr.om; slot null |
| BUG-13 | BELOW-001 | NOI After Reserves not in year1 assembly; ProFormaSummaryTab cannot render |
| BUG-14 | NCTRL-004, others with warnings | LV.warning not extracted by toRow(); silently dropped from API |
