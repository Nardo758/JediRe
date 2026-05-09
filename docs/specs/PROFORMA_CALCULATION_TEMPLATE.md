# ProForma Canonical Calculation Template

**Version:** 2026-05
**Authority:** `proforma-seeder.service.ts` (FIELD_PRIORITIES, resolve() logic),
`proforma-adjustment.service.ts` (getDealFinancials assembly),
`attached_assets/F9_Financial_Model_-_Agent_Specification_1777735712565.txt` (math spec),
`attached_assets/Pasted--JEDI-RE-CashFlow-Agent-Underwriting-Specification-How-_1776632066856.txt` (evidence-tier model).
**Related audit:** `docs/audits/PROFORMA_PIPELINE_AUDIT_2026-05.md`

---

## How to Read This Document

Each row is one Pro Forma line item. Columns are:

- **ID** — unique identifier, used in cross-references and fix tickets
- **Display label** — text shown in ProFormaSummaryTab
- **Category** — REVENUE / CTRLL_OPEX / NCTRL_OPEX / CAPEX / SUBTOTAL / DERIVED
- **Type** — `sourced` (reads from extraction capsule), `computed` (formula over sourced fields), `user-input` (only set by operator), `derived` (computed from other Pro Forma rows)
- **Formula** — exact derivation rule; variables reference other IDs or field names
- **Inputs** — source variables consumed
- **Source tier** — which evidence tier the seeder prefers (per FIELD_PRIORITIES or resolve() call order)
- **Display format** — how the value is formatted in the UI
- **Sign convention** — `+` means positive = income / increase; `−` means positive = cost / deduction
- **Phase flag** — which deal phase this row applies to: `ALL`, `EXISTING`, `LEASE_UP`, `DEVELOPMENT`
- **Broker path** — how the broker (OM) value reaches `year1.FIELD.om`
- **Platform path** — how the platform value reaches `year1.FIELD.platform`
- **User path** — how an operator override reaches `year1.FIELD.override`

Sign convention throughout: Revenue rows are positive. Deduction rows (vacancy, LTL,
concessions, bad debt) are negative in cash flow arithmetic but stored as positive
magnitudes in the DB; the sign is applied by the composer. OpEx rows are stored as
positive costs.

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
| **Broker path** | `broker_claims.proforma.stabilizedGpr` → `year1.gpr.om` via seeder broker-capsule mapping. **BUG-11:** this mapping is absent; `year1.gpr.om = null` despite capsule existing. |
| **Platform path** | `platform.gpr_per_unit_per_month × totalUnits × 12` → `year1.gpr.platform`. **BUG-01:** `platform.gpr_per_unit_per_month = null` for all live deals; slot always null. |
| **User path** | `PATCH /api/v1/deals/:dealId/assumptions` → `deal_assumptions.year1.gpr.override` |

### REV-002: Vacancy Loss

| Attribute | Value |
|---|---|
| **ID** | REV-002 |
| **Display label** | Vacancy Loss |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `vacancy_loss = GPR × vacancy_pct.resolved` |
| **Inputs** | `REV-001` (GPR), `REV-002a` (vacancy_pct) |
| **Source tier** | Derived — magnitude set by REV-002a |
| **Display format** | `($N,NNN,NNN)` |
| **Sign convention** | − (deduction from GPR) |
| **Phase flag** | ALL |
| **Broker path** | Via REV-002a (vacancy_pct.om) |
| **Platform path** | Via REV-002a (vacancy_pct.platform) |
| **User path** | Via REV-002a (vacancy_pct.override) |

### REV-002a: Vacancy Rate (intermediate field)

| Attribute | Value |
|---|---|
| **ID** | REV-002a |
| **Display label** | Vacancy % |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, rent_roll_vac, t12_vac, om_vac, platform_vac)` |
| **Inputs** | `rent_roll.vacant_units / total_units`, `t12.vacancy_loss / scheduled_rent` (formula suspected wrong — see BUG-04), `broker_claims.proforma.stabilizedVacancy`, M07 equilibrium floor |
| **Source tier** | Tier 1 (rent_roll) > Tier 1 (T12) > Tier 4 (OM) > Tier 3 (M07 floor) |
| **Display format** | `N.N%` |
| **Sign convention** | + (rate; applied as − in REV-002) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedVacancy` → `year1.vacancy_pct.om`. Live: `0.05` ✓ |
| **Platform path** | `trafficProjection.calibrated.vacancyPct` used as floor only, not as resolved value. Direct platform slot: null (BUG-01). |
| **User path** | `year1.vacancy_pct.override` |
| **Known issue** | T12 vacancy for 464 Bishop = 66.0% — formula error (BUG-04). Rent_roll (19.83%) used instead. |

### REV-003: Loss to Lease

| Attribute | Value |
|---|---|
| **ID** | REV-003 |
| **Display label** | Loss to Lease |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `loss_to_lease = GPR × loss_to_lease_pct.resolved` |
| **Inputs** | `REV-001` (GPR), `REV-003a` (loss_to_lease_pct) |
| **Source tier** | Derived — magnitude set by REV-003a |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − (deduction from GPR) |
| **Phase flag** | ALL |
| **Broker path** | Via REV-003a |
| **Platform path** | Via REV-003a |
| **User path** | Via REV-003a |

### REV-003a: Loss-to-Lease Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | REV-003a |
| **Display label** | Loss to Lease % |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, t12_ltl_pct, rent_roll_ltl_pct, om_ltl, null)` |
| **Inputs** | `t12.loss_to_lease / t12.scheduled_rent`, `rent_roll.avg_loss_to_lease_pct`, `broker_claims.proforma.lossToLease` |
| **Source tier** | Tier 1 (T12) > Tier 1 (rent_roll) > Tier 4 (OM) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.lossToLease` → `year1.loss_to_lease_pct.om`. Live: `0` (OM claims no LTL). |
| **Platform path** | null — no platform benchmark wired (BUG-01) |
| **User path** | `year1.loss_to_lease_pct.override` |

### REV-004: Concessions

| Attribute | Value |
|---|---|
| **ID** | REV-004 |
| **Display label** | Concessions |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `concessions = GPR × concessions_pct.resolved` |
| **Inputs** | `REV-001` (GPR), `REV-004a` (concessions_pct) |
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
| **Display label** | Concessions % |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, t12_conc_pct, rent_roll_conc_pct, om_conc, null)` |
| **Inputs** | `t12.concessions / t12.scheduled_rent`, `rent_roll.concessions_pct`, `broker_claims.proforma.concessionsPct` |
| **Source tier** | Tier 1 (T12) > Tier 1 (rent_roll) > Tier 4 (OM) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.concessionsPct` → `year1.concessions_pct.om`. Live: `0` (OM claims no concessions). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.concessions_pct.override` |
| **Known collision** | OM = 0%, T12 = 7.78% — material divergence, not flagged. |

### REV-005: Bad Debt

| Attribute | Value |
|---|---|
| **ID** | REV-005 |
| **Display label** | Bad Debt |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `bad_debt = NRI_pre_bad_debt × bad_debt_pct.resolved` where `NRI_pre_bad_debt = GPR − vacancy_loss − LTL − concessions` |
| **Inputs** | `REV-001` through `REV-004`, `REV-005a` |
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
| **Display label** | Bad Debt % |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, t12_bd_pct, null)` |
| **Inputs** | `t12.bad_debt / t12.scheduled_rent` |
| **Source tier** | Tier 1 (T12) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.badDebtPct` → `year1.bad_debt_pct.om`. Live: null (OM did not provide). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.bad_debt_pct.override` |

### REV-006: Net Rental Income (NRI)

| Attribute | Value |
|---|---|
| **ID** | REV-006 |
| **Display label** | Net Rental Income |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `NRI = GPR − vacancy_loss − loss_to_lease − concessions − bad_debt` = `REV-001 − REV-002 − REV-003 − REV-004 − REV-005` |
| **Inputs** | REV-001 through REV-005 |
| **Source tier** | Derived (subtotal) |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | Not a direct broker field; derived from broker source fields |
| **Platform path** | Not a direct platform field |
| **User path** | No direct override; indirectly via component fields |

### REV-007: Other Income

| Attribute | Value |
|---|---|
| **ID** | REV-007 |
| **Display label** | Other Income |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `other_income = other_income_per_unit.resolved × totalUnits × 12` (via `toDollarRow()`, `proforma-adjustment.service.ts:1817-1900`) |
| **Inputs** | `rent_roll.other_income_breakdown` (parking, RUBS, pet rent, application fees, late fees), `t12.other_income`, `broker_claims.proforma.stabilizedOtherIncomeAnnual / totalUnits / 12` |
| **Source tier** | Tier 1 (rent_roll) > Tier 1 (T12) > Tier 4 (OM) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedOtherIncomeAnnual ÷ totalUnits ÷ 12` → `year1.other_income_per_unit.om`. Live: `$307.76/unit/yr`. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.other_income_per_unit.override` |
| **Known collision** | OM $1,474/unit/yr vs rent_roll $75/unit/yr — 19.6× discrepancy, not flagged. |

### REV-008: Effective Gross Income (EGI)

| Attribute | Value |
|---|---|
| **ID** | REV-008 |
| **Display label** | Effective Gross Income |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `EGI = NRI + other_income` = `REV-006 + REV-007` |
| **Inputs** | REV-006, REV-007 |
| **Source tier** | Derived (subtotal) |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | Not direct; derived from broker components. `broker_claims.proforma.stabilizedEgi = $4,998,237` vs resolved $3,615,849 (−27.7%) — collision not flagged. |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override |
| **Live value (464 Bishop)** | $3,615,849.05 |

---

## Section 2 — Controllable Operating Expenses

### CTRLL-001: Payroll & Benefits

| Attribute | Value |
|---|---|
| **ID** | CTRLL-001 |
| **Display label** | Payroll & Benefits |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_payroll, t12_payroll, platform_payroll)` |
| **Inputs** | `broker_claims.proforma.payrollAnnual`, `t12.payroll`, `platform.opex_per_unit_annual.payroll × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − (cost) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.payrollAnnual` → `year1.payroll.om`. Live: $324,800. |
| **Platform path** | `platform.opex_per_unit_annual.payroll × totalUnits` → `year1.payroll.platform`. Live: null (BUG-01). |
| **User path** | `year1.payroll.override`. Live: $324,800 (operator kept OM value). |
| **Known issue** | T12 payroll = $29,125 — partial year or miscategorised. Seeder resolves to OM/override. |

### CTRLL-002: Repairs & Maintenance

| Attribute | Value |
|---|---|
| **ID** | CTRLL-002 |
| **Display label** | Repairs & Maintenance |
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

### CTRLL-003: Turnover Costs

| Attribute | Value |
|---|---|
| **ID** | CTRLL-003 |
| **Display label** | Turnover |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_turnover, t12_turnover, platform_turnover)` |
| **Inputs** | `broker_claims.proforma.turnoverAnnual`, `t12.turnover`, `platform.opex_per_unit_annual.turnover × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.turnoverAnnual` → `year1.turnover.om`. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.turnover.override` |

### CTRLL-004: Contract Services

| Attribute | Value |
|---|---|
| **ID** | CTRLL-004 |
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

### CTRLL-005: Marketing

| Attribute | Value |
|---|---|
| **ID** | CTRLL-005 |
| **Display label** | Marketing |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_marketing, t12_marketing, platform_marketing)` |
| **Inputs** | `broker_claims.proforma.marketingAnnual`, `t12.marketing`, `platform.opex_per_unit_annual.marketing × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.marketingAnnual` → `year1.marketing.om`. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.marketing.override` |

### CTRLL-006: Utilities

| Attribute | Value |
|---|---|
| **ID** | CTRLL-006 |
| **Display label** | Utilities |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_utilities, t12_utilities, platform_utilities)` |
| **Inputs** | `broker_claims.proforma.utilitiesAnnual`, `t12.utilities`, `platform.opex_per_unit_annual.utilities × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.utilitiesAnnual` → `year1.utilities.om`. Live: $187,094. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.utilities.override` |

### CTRLL-007: General & Administrative

| Attribute | Value |
|---|---|
| **ID** | CTRLL-007 |
| **Display label** | General & Administrative |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_ga, t12_ga, platform_ga)` |
| **Inputs** | `broker_claims.proforma.gAndAAnnual`, `t12.general_administrative`, `platform.opex_per_unit_annual.admin × totalUnits` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.gAndAAnnual` → `year1.general_administrative.om`. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.general_administrative.override` |

---

## Section 3 — Non-Controllable Operating Expenses

### NCTRL-001: Management Fee

| Attribute | Value |
|---|---|
| **ID** | NCTRL-001 |
| **Display label** | Management Fee |
| **Category** | NCTRL_OPEX |
| **Type** | derived |
| **Formula** | `management_fee = EGI × management_fee_pct.resolved` |
| **Inputs** | `REV-008` (EGI), `NCTRL-001a` (management_fee_pct) |
| **Source tier** | Derived — magnitude set by NCTRL-001a |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Via NCTRL-001a |
| **Platform path** | Via NCTRL-001a |
| **User path** | Via NCTRL-001a |

### NCTRL-001a: Management Fee Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | NCTRL-001a |
| **Display label** | Management Fee % |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, om_mgmt_pct, t12_mgmt_pct, platform_mgmt_pct)` |
| **Inputs** | `broker_claims.proforma.managementFeePct`, `t12.management_fee / t12.egi`, `platform.management_fee_pct` |
| **Source tier** | Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.managementFeePct` → `year1.management_fee_pct.om`. Live: 2.75%. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.management_fee_pct.override`. Live: 2.50% (operator reduced below OM). |
| **Known issue** | T12 management_fee_pct = 11.42% — nonsensical; likely dollar amount divided by wrong EGI base. |

### NCTRL-002: Property Insurance

| Attribute | Value |
|---|---|
| **ID** | NCTRL-002 |
| **Display label** | Insurance |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, platform_insurance, t12_insurance, null)` |
| **Inputs** | `platform.opex_per_unit_annual.insurance × totalUnits`, `t12.insurance`, `broker_claims.proforma.insuranceAnnual` |
| **Source tier** | Tier 3 (platform) > Tier 1 (T12) > Tier 4 (OM) — note: spec says taxService/insuranceService should drive this, not broker |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.insuranceAnnual` → `year1.insurance.om`. Live: $46,400. |
| **Platform path** | `platform.opex_per_unit_annual.insurance × totalUnits` → `year1.insurance.platform`. Live: null — no benchmark (BUG-01, BUG-09). |
| **User path** | `year1.insurance.override`. Live: $46,400. |
| **Known issue** | T12 insurance = null. LV.warning: "No property insurance line in T12 — using platform baseline." Platform baseline is also null. Silent failure (BUG-09). |

### NCTRL-003: Real Estate Taxes

| Attribute | Value |
|---|---|
| **ID** | NCTRL-003 |
| **Display label** | Real Estate Taxes |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `resolved = COALESCE(override, tax_bill_annual, t12_re_tax, null)` |
| **Inputs** | `tax_bill.assessed_value × millage_rate` (extracted from tax bill PDF), `t12.real_estate_taxes`, `broker_claims.proforma.realEstateTaxesAnnual` |
| **Source tier** | Tier 1 (tax_bill) > Tier 1 (T12). Note: spec requires `taxService.forecast()` per jurisdiction ruleset for this line (not implemented — BUG-05). |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.realEstateTaxesAnnual` → `year1.real_estate_tax.om`. Live: null (OM did not provide RE tax). |
| **Platform path** | null — `taxService.forecast()` not wired for P&L line (BUG-05). |
| **User path** | `year1.real_estate_tax.override` |
| **Known issue** | tax_bill = $20,731 vs T12 = $1,127,126 — 54× gap. Tax bill likely partial-year or pre-reassessment. `taxService.forecast()` called for Section C income tax only, not this line (BUG-05). |

---

## Section 4 — Subtotals

### SUB-001: Total Operating Expenses

| Attribute | Value |
|---|---|
| **ID** | SUB-001 |
| **Display label** | Total Operating Expenses |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `total_opex = SUM(CTRLL-001..007) + SUM(NCTRL-001..003)` |
| **Inputs** | All CTRLL and NCTRL rows |
| **Source tier** | Derived (subtotal) |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | − (total cost) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.totalOpexAnnual = $1,998,673` vs resolved $3,129,741 (+56.6%) — collision not flagged (BUG-06). |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override; indirectly via component overrides |
| **Live value (464 Bishop)** | $3,129,741.08 |

### SUB-002: Net Operating Income (NOI)

| Attribute | Value |
|---|---|
| **ID** | SUB-002 |
| **Display label** | Net Operating Income |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `NOI = EGI − total_opex` = `REV-008 − SUB-001` |
| **Inputs** | REV-008, SUB-001 |
| **Source tier** | Derived (subtotal) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedNOI = $2,999,564` vs resolved $486,108 (−83.8%) — critical collision not flagged (BUG-06). |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override |
| **Live value (464 Bishop)** | $486,107.97 |
| **Integrity check** | `NOI = EGI − OpEx` verified live: $3,615,849 − $3,129,741 = $486,108 ✓ |

### SUB-003: NOI Margin

| Attribute | Value |
|---|---|
| **ID** | SUB-003 |
| **Display label** | NOI Margin |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `noi_margin = NOI / EGI` |
| **Inputs** | SUB-002, REV-008 |
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
| **Sign convention** | − (below-NOI cost) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.replacementReservesPerUnit × totalUnits` → `year1.replacement_reserves.om`. Live: $46,400 ($200/unit). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.replacement_reserves.override`. Live: $58,000 ($250/unit). |

### CAPEX-002: Capital Expenditure Draw (development/value-add)

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

## Section 6 — System A Scalars (`GET /api/v1/proforma/:dealId`)

These are the 5 market-positioning scalars returned by the primary audit endpoint.
They live in `proforma_assumptions` table, not `deal_assumptions.year1`.
They are **not connected to** the line items above (BUG-08).

| ID | Display label | Formula | Source | Display format | Sign | Phase | Broker path | Platform path | User path |
|---|---|---|---|---|---|---|---|---|---|
| SCA-001 | Rent Growth | `effective = user_override ?? current ?? baseline` | M35 news adjustment → current; M05 submarket → baseline (currently hardcoded 3.5% — BUG-03) | `N.N%` | + | ALL | None — System A has no broker field | `getMarketBaseline()` → `rent_growth_baseline` (hardcoded 3.5%) | `proforma_assumptions.rent_growth_user_override` |
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
  insurance:          ['t12'],      // platform before t12 in resolve() call
  // all opex lines: ['override', 'om', 't12', 'platform']
};
```

The generic `resolve(field, platformValue, { t12, rent_roll, om, tax_bill, existingOverride })`
function at `proforma-seeder.service.ts:204` applies:

```
if existingOverride != null → override
elif t12 != null (if in t12-priority list) → t12
elif rent_roll != null (if in rent_roll-priority list) → rent_roll
elif om != null → om
elif platformValue != null → platform
else → null (platform_fallback label assigned)
```

`platformValue` is null for every field in the live system (BUG-01).

---

## Appendix B — Known Bugs Affecting Calculations

| Bug ID | Affects rows | Impact on displayed value |
|---|---|---|
| BUG-01 | All rows — platform slot | Platform column always blank; broker is effectively Tier 2 fallback, not Tier 4 reference |
| BUG-02 | SCA-001..005 computed metrics | IRR, NOI Year 1, CoC on System A response are for a phantom deal with hardcoded inputs |
| BUG-03 | SCA-001..005 baselines | All baselines are hardcoded constants; M05/M07/M15 not integrated |
| BUG-04 | REV-002a (vacancy_pct) | T12 vacancy shows 66% (formula error); rent_roll used instead |
| BUG-05 | NCTRL-003 (real_estate_tax) | taxService not called for P&L line; $20K tax bill vs $1.1M T12 unreconciled |
| BUG-06 | SUB-001, SUB-002, REV-008 | NOI/EGI/OpEx broker collisions (−83.8%, −27.7%, +56.6%) not flagged |
| BUG-08 | REV-002a vs SCA-002 | System A vacancy (5%) and System B vacancy (19.83%) decoupled |
| BUG-09 | NCTRL-002 (insurance) | Platform slot null; LV.warning references non-existent baseline |
| BUG-11 | REV-001 (GPR) | Broker GPR not mapped to year1.gpr.om; slot null despite capsule |
