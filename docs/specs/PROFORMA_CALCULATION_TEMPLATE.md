# ProForma Canonical Calculation Template

**Version:** 2026-05
**Authority:** `proforma-seeder.service.ts` (FIELD_PRIORITIES, resolve() logic),
`proforma-adjustment.service.ts` (getDealFinancials, REVENUE_FIELDS / OPEX_FIELDS),
`attached_assets/F9_Financial_Model_-_Agent_Specification_1777735712565.txt` (math spec),
`attached_assets/Pasted--JEDI-RE-CashFlow-Agent-Underwriting-Specification-How-_1776632066856.txt`
(evidence-tier model), jedi-framework-v31.jsx description in
`attached_assets/Pasted-I-have-the-canonical-ProForma-spec-from-jedi-framework-_1778106848690.txt`.
**Related audit:** `docs/audits/PROFORMA_PIPELINE_AUDIT_2026-05.md`

---

## How to Read This Document

Each row describes one Pro Forma line item. Every entry uses the same schema:

- **ID** — unique identifier for cross-references
- **Display label** — text shown in ProFormaSummaryTab
- **Category** — `REVENUE`, `CTRLL_OPEX`, `NCTRL_OPEX`, `CAPEX`, `SUBTOTAL`, or `BELOW_NOI`
- **Type** — `sourced` (reads from extraction capsule), `derived` (formula over sourced fields), `user-input` (operator-only), `not-assembled` (v31 spec'd but absent from year1 row array)
- **Formula** — exact derivation rule; variables reference other IDs
- **Inputs** — upstream field IDs or data sources that feed the formula
- **Source tier** — evidence priority order; live FIELD_PRIORITIES where applicable
- **Display format** — UI number formatting
- **Sign convention** — `+` = income or additive; `−` = cost or deduction
- **Phase flag** — `ALL`, `EXISTING`, `LEASE_UP`, or `DEVELOPMENT`
- **Broker path** — how broker/OM value reaches `year1.FIELD.om`; live value for 464 Bishop noted
- **Platform path** — how platform value reaches `year1.FIELD.platform`; all are null (BUG-01)
- **User path** — how operator override reaches `year1.FIELD.override`; live value noted

All subtotals are stored as regular LayeredValue rows in `deal_assumptions.year1` JSONB and
returned as `OperatingStatementRow` objects. There is **no `isSubtotal` metadata flag** —
subtotals are identified by field key only.

---

## Section 1 — Revenue

### REV-001: Gross Potential Rent (GPR)

| Attribute | Value |
|---|---|
| **ID** | REV-001 |
| **Display label** | Gross Potential Rent |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `gpr.resolved = COALESCE(override, rent_roll_gpr, t12_gpr, om_gpr, platform_gpr)` |
| **Inputs** | `rent_roll.total_rent_annual` (Σ unit_count × in_place_rent × 12), `t12.scheduled_rent_annual`, `broker_claims.proforma.stabilizedGpr`, `platform.gpr_per_unit_per_month × totalUnits × 12` |
| **Source tier** | override > Tier 1 (rent_roll) > Tier 1 (T12) > Tier 4 (OM) > Tier 3 (platform) |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | + (income) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedGpr` → `year1.gpr.om`. **BUG-11: mapping absent; `year1.gpr.om = null` despite stabilizedGpr = $4,901,400 in capsule.** |
| **Platform path** | `platform.gpr_per_unit_per_month × totalUnits × 12` → `year1.gpr.platform`. **BUG-01: always null.** |
| **User path** | `PATCH /api/v1/deals/:dealId/financials/override` body `{ field: 'gpr', value: N }` → `year1.gpr.override`. Live (464 Bishop): $4,901,400. |

### REV-002: Loss to Lease ($)

| Attribute | Value |
|---|---|
| **ID** | REV-002 |
| **Display label** | Loss to Lease |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `loss_to_lease = REV-001 × REV-002a.resolved` via `toDollarRow('loss_to_lease_pct', 'loss_to_lease', ..., GPR)` at service:1961 |
| **Inputs** | REV-001 (GPR), REV-002a (loss_to_lease_pct rate) |
| **Source tier** | Derived — tier governed by REV-002a |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − (deduction from GPR) |
| **Phase flag** | ALL |
| **Broker path** | Derived from REV-002a; `year1.loss_to_lease_pct.om = 0` → dollar broker = $0 |
| **Platform path** | null (BUG-01) |
| **User path** | Via REV-002a |

### REV-002a: Loss-to-Lease Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | REV-002a |
| **Display label** | Loss to Lease % (intermediate — not a distinct rendered row) |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `loss_to_lease_pct.resolved = COALESCE(override, t12_ltl_pct, rent_roll_ltl_pct, om_ltl)` per `FIELD_PRIORITIES['loss_to_lease_pct'] = ['t12', 'rent_roll', 'om']` |
| **Inputs** | `t12.loss_to_lease / t12.scheduled_rent`, `rent_roll.avg_loss_to_lease_pct`, `broker_claims.proforma.lossToLease` |
| **Source tier** | override > Tier 1 (T12) > Tier 1 (rent_roll) > Tier 4 (OM) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate applied as − in REV-002) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.lossToLease` → `year1.loss_to_lease_pct.om`. Live: 0 (OM claims no LTL). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.loss_to_lease_pct.override`. Live: null (resolves to T12 = 0.35%). |

### REV-003: Vacancy Loss ($)

| Attribute | Value |
|---|---|
| **ID** | REV-003 |
| **Display label** | Vacancy & Credit Loss |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `vacancy_loss = REV-001 × REV-003a.resolved` via `toDollarRow('vacancy_pct', 'vacancy_loss', ..., GPR)` at service:1962 |
| **Inputs** | REV-001 (GPR), REV-003a (vacancy_pct rate) |
| **Source tier** | Derived — tier governed by REV-003a |
| **Display format** | `($N,NNN,NNN)` |
| **Sign convention** | − (deduction from GPR) |
| **Phase flag** | ALL |
| **Broker path** | Derived from REV-003a; `year1.vacancy_pct.om = 0.05` → broker vacancy loss = $245,070 vs resolved $971,887 |
| **Platform path** | null (BUG-01) |
| **User path** | Via REV-003a |

### REV-003a: Vacancy Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | REV-003a |
| **Display label** | Vacancy % (intermediate) |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `vacancy_pct.resolved = COALESCE(override, rent_roll_vac, t12_vac, om_vac)` per `FIELD_PRIORITIES['vacancy_pct'] = ['rent_roll', 't12', 'om']`; M07 equilibrium vacancy used as floor (seeder:2052) |
| **Inputs** | `rent_roll.vacant_units / total_units`, `t12.vacancy_loss / t12.scheduled_rent` (BUG-04: formula error → 66.0%), `broker_claims.proforma.stabilizedVacancy`, M07 `calibrated.vacancyPct` floor |
| **Source tier** | override > Tier 1 (rent_roll) > Tier 1 (T12 — BUG-04) > Tier 4 (OM) |
| **Display format** | `NN.N%` |
| **Sign convention** | + (rate; applied as − via REV-003) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedVacancy` → `year1.vacancy_pct.om`. Live: 0.05 (5%). |
| **Platform path** | M07 `calibrated.vacancyPct` used as floor only; direct `platform` slot null (BUG-01). |
| **User path** | `year1.vacancy_pct.override`. Live: null (resolves to rent_roll = 19.83%). |
| **Known issue** | System A vacancy = 5.00%; System B = 19.83% for same deal (BUG-08). T12 vacancy = 66.0% — formula error (BUG-04). |

### REV-004: Concessions ($)

| Attribute | Value |
|---|---|
| **ID** | REV-004 |
| **Display label** | Concessions |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `concessions = REV-001 × REV-004a.resolved` via `toDollarRow('concessions_pct', 'concessions', ..., GPR)` at service:1963 |
| **Inputs** | REV-001 (GPR), REV-004a (concessions_pct rate) |
| **Source tier** | Derived — tier governed by REV-004a |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Derived from REV-004a; `year1.concessions_pct.om = 0` → broker concessions = $0 vs resolved $381,280 (BUG-06: not flagged) |
| **Platform path** | null (BUG-01) |
| **User path** | Via REV-004a |

### REV-004a: Concessions Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | REV-004a |
| **Display label** | Concessions % (intermediate) |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `concessions_pct.resolved = COALESCE(override, t12_conc_pct, rent_roll_conc_pct, om_conc)` per `FIELD_PRIORITIES['concessions_pct'] = ['t12', 'rent_roll', 'om']` |
| **Inputs** | `t12.concessions / t12.scheduled_rent`, `rent_roll.concessions_pct`, `broker_claims.proforma.concessionsPct` |
| **Source tier** | override > Tier 1 (T12) > Tier 1 (rent_roll) > Tier 4 (OM) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.concessionsPct` → `year1.concessions_pct.om`. Live: 0 (OM claims none). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.concessions_pct.override`. Live: null (resolves to T12 = 7.78%). |
| **Known collision** | OM = 0%, T12 = 7.78% — not flagged. Live dollar impact: $381,280. |

### REV-005: Bad Debt ($)

| Attribute | Value |
|---|---|
| **ID** | REV-005 |
| **Display label** | Bad Debt |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `bad_debt = (GPR − vacancy_loss − loss_to_lease − concessions − non_revenue_units) × REV-005a.resolved` via `toDollarRow('bad_debt_pct', 'bad_debt', ..., NRI_pre_bad_debt)` at service:1964 |
| **Inputs** | REV-001 through REV-003 and REV-005a; NRI_pre_bad_debt is the running net after prior deductions |
| **Source tier** | Derived — tier governed by REV-005a |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `year1.bad_debt_pct.om = null` (OM did not provide) → no broker bad debt value |
| **Platform path** | null (BUG-01) |
| **User path** | Via REV-005a |

### REV-005a: Bad Debt Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | REV-005a |
| **Display label** | Bad Debt % (intermediate) |
| **Category** | REVENUE |
| **Type** | sourced |
| **Formula** | `bad_debt_pct.resolved = COALESCE(override, t12_bd_pct)` per `FIELD_PRIORITIES['bad_debt_pct'] = ['t12']` |
| **Inputs** | `t12.bad_debt / t12.scheduled_rent`, `broker_claims.proforma.badDebtPct` (not present for 464 Bishop) |
| **Source tier** | override > Tier 1 (T12) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.badDebtPct` → `year1.bad_debt_pct.om`. Live: null (OM did not include). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.bad_debt_pct.override`. Live: null (resolves to T12 = 3.34%). |

### REV-006: Non-Revenue Units ($)

| Attribute | Value |
|---|---|
| **ID** | REV-006 |
| **Display label** | Non-Revenue Units |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `non_revenue_units = REV-001 × non_revenue_units_pct.resolved` via `toDollarRow('non_revenue_units_pct', 'non_revenue_units', ..., GPR)` at service:1965 |
| **Inputs** | REV-001 (GPR), `year1.non_revenue_units_pct` (% of units that are down/model/employee) |
| **Source tier** | Derived; `FIELD_PRIORITIES['non_revenue_units_pct']` resolves to T12 |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL — Phase 2 feature (often 0) |
| **Broker path** | `year1.non_revenue_units_pct.om = null` (OM did not include). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.non_revenue_units_pct.override`. Live: null (resolves to T12 = 0% → $0). |

### REV-007: Other Income ($)

| Attribute | Value |
|---|---|
| **ID** | REV-007 |
| **Display label** | Other Income |
| **Category** | REVENUE |
| **Type** | derived |
| **Formula** | `other_income = other_income_per_unit.resolved × totalUnits × 12` via `toDollarRow('other_income_per_unit', 'other_income', ..., totalUnits × 12)` at service:1966 |
| **Inputs** | `rent_roll.other_income_breakdown` (parking, RUBS, pet rent, application fees, late fees), `t12.other_income`, `broker_claims.proforma.stabilizedOtherIncomeAnnual ÷ totalUnits ÷ 12` |
| **Source tier** | override > Tier 1 (rent_roll) > Tier 1 (T12) > Tier 4 (OM) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.stabilizedOtherIncomeAnnual ÷ totalUnits ÷ 12` → `year1.other_income_per_unit.om`. Live: $307.76/unit/yr ($71,400/yr annualized). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.other_income_per_unit.override`. Live: null (resolves to rent_roll = $75.34/unit/yr → $209,749/yr). |
| **Known collision** | OM $71K vs resolved $210K (3×) — not flagged. |

### SUB-REV-001: Net Rental Income (NRI)

| Attribute | Value |
|---|---|
| **ID** | SUB-REV-001 |
| **Display label** | Net Rental Income |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `NRI = REV-001 − REV-002 − REV-003 − REV-004 − REV-005 − REV-006` = `GPR − loss_to_lease − vacancy_loss − concessions − bad_debt − non_revenue_units` |
| **Inputs** | REV-001 through REV-006 |
| **Source tier** | Derived (sum of sourced components) |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | `year1.net_rental_income.om = null` (no direct OM slot). Implied broker NRI = $4,902,400 − $0 − $245,070 − $0 − $0 − $0 ≈ $4,657,330. |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override — indirectly via component overrides |
| **Live value (464 Bishop)** | $3,531,123 (year1.net_rental_income.resolved; resolution = platform_fallback) |

### SUB-REV-002: Effective Gross Income (EGI)

| Attribute | Value |
|---|---|
| **ID** | SUB-REV-002 |
| **Display label** | Effective Gross Income |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `EGI = SUB-REV-001 + REV-007` = `NRI + other_income` |
| **Inputs** | SUB-REV-001 (NRI), REV-007 (other income) |
| **Source tier** | Derived — stored in `year1.egi` at seed time |
| **Display format** | `$N,NNN,NNN` (highlighted row) |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | Not stored as `year1.egi.om`; implied from broker components. Broker stabilizedEgi = $4,998,237 (reported in capsule). Resolved = $3,615,849 — delta −$1,382,388 (−27.7%), not flagged (BUG-06). |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override; indirectly via component overrides |
| **Live value (464 Bishop)** | $3,615,849.05 |
| **Aggregation membership** | Includes REV-001 through REV-007; excludes capital items |

---

## Section 2 — Controllable Operating Expenses

All CTRLL rows use `toRow(key, label)` at `proforma-adjustment.service.ts:1967`.
Generic resolution: `COALESCE(override, om, t12, platform)` unless FIELD_PRIORITIES specifies otherwise.
All `platform` slots null (BUG-01). All `benchmarkPosition` null.

### CTRLL-001: Repairs & Maintenance

| Attribute | Value |
|---|---|
| **ID** | CTRLL-001 |
| **Display label** | Repair & Maintenance |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `repairs_maintenance.resolved = COALESCE(override, om_rm, t12_rm, platform_rm)` |
| **Inputs** | `broker_claims.proforma.repairsMaintenanceAnnual`, `t12.repairs_maintenance`, `platform.opex_per_unit_annual.maintenance × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.repairsMaintenanceAnnual` → `year1.repairs_maintenance.om`. Live: $69,600. |
| **Platform path** | `platform.opex_per_unit_annual.maintenance × totalUnits` → `year1.repairs_maintenance.platform`. Live: null (BUG-01). |
| **User path** | `year1.repairs_maintenance.override`. Live: $69,600. T12 = $4,090 (partial year). |

### CTRLL-002: Contract Services

| Attribute | Value |
|---|---|
| **ID** | CTRLL-002 |
| **Display label** | Contract Services |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `contract_services.resolved = COALESCE(override, om_contract, t12_contract, platform_contract)` |
| **Inputs** | `broker_claims.proforma.contractServicesAnnual`, `t12.contract_services`, `platform.opex_per_unit_annual.contract_services × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.contractServicesAnnual` → `year1.contract_services.om`. Live: **null** (OM did not break out contract services). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.contract_services.override`. Live: $28,680 (operator override; T12 = $19,640). |

### CTRLL-003: Landscaping / Grounds

| Attribute | Value |
|---|---|
| **ID** | CTRLL-003 |
| **Display label** | Landscaping / Grounds |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `landscaping.resolved = COALESCE(override, om_landscaping, t12_landscaping, platform_landscaping)` |
| **Inputs** | `broker_claims.proforma.landscapingAnnual`, `t12.landscaping`, `platform.opex_per_unit_annual.landscaping × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `year1.landscaping.om`. Live: **null** (OM did not provide). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.landscaping.override`. Live: **null** — no data for this deal in any tier; resolved = null. |

### CTRLL-004: Personnel / Payroll

| Attribute | Value |
|---|---|
| **ID** | CTRLL-004 |
| **Display label** | Personnel |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `payroll.resolved = COALESCE(override, om_payroll, t12_payroll, platform_payroll)` |
| **Inputs** | `broker_claims.proforma.payrollAnnual`, `t12.payroll`, `platform.opex_per_unit_annual.payroll × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.payrollAnnual` → `year1.payroll.om`. Live: $324,800. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.payroll.override`. Live: $324,800. T12 = $29,125 (partial year or miscategorised). |

### CTRLL-005: Marketing / Advertising

| Attribute | Value |
|---|---|
| **ID** | CTRLL-005 |
| **Display label** | Marketing / Advertising |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `marketing.resolved = COALESCE(override, om_marketing, t12_marketing, platform_marketing)` |
| **Inputs** | `broker_claims.proforma.marketingAnnual`, `t12.marketing`, `platform.opex_per_unit_annual.marketing × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.marketingAnnual` → `year1.marketing.om`. Live: $69,600. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.marketing.override`. Live: $69,600. |

### CTRLL-006: General & Administrative

| Attribute | Value |
|---|---|
| **ID** | CTRLL-006 |
| **Display label** | Administrative |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `g_and_a.resolved = COALESCE(override, om_ga, t12_ga, platform_ga)` |
| **Inputs** | `broker_claims.proforma.gAndAAnnual`, `t12.g_and_a`, `platform.opex_per_unit_annual.admin × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.gAndAAnnual` → `year1.g_and_a.om`. Live: $69,600. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.g_and_a.override`. Live: $69,600. |

### CTRLL-007: Turnover / Make-Ready

| Attribute | Value |
|---|---|
| **ID** | CTRLL-007 |
| **Display label** | Turnover / Make-Ready |
| **Category** | CTRLL_OPEX |
| **Type** | sourced |
| **Formula** | `turnover.resolved = COALESCE(override, om_turnover, t12_turnover, platform_turnover)` |
| **Inputs** | `broker_claims.proforma.turnoverAnnual`, `t12.turnover`, `platform.opex_per_unit_annual.turnover × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.turnoverAnnual` → `year1.turnover.om`. Live: $41,760. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.turnover.override`. Live: $41,760. T12 = $1,540 (partial year). |

---

## Section 3 — Non-Controllable Operating Expenses

### NCTRL-001: Water & Sewer

| Attribute | Value |
|---|---|
| **ID** | NCTRL-001 |
| **Display label** | Water & Sewer |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `water_sewer.resolved = COALESCE(override, om_water_sewer, t12_water_sewer, platform_water_sewer)` |
| **Inputs** | `broker_claims.proforma.waterSewerAnnual` (not present for 464 Bishop — OM provided combined `utilitiesAnnual`), `t12.water_sewer`, `platform.opex_per_unit_annual.water_sewer × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `year1.water_sewer.om`. Live: **null** — OM provided a combined `utilitiesAnnual=$187,094` that was not decomposed into sub-lines. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.water_sewer.override`. Live: **null** — no data in any tier; resolved = null. |

### NCTRL-002: Electric

| Attribute | Value |
|---|---|
| **ID** | NCTRL-002 |
| **Display label** | Electric |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `electric.resolved = COALESCE(override, om_electric, t12_electric, platform_electric)` |
| **Inputs** | `broker_claims.proforma.electricAnnual` (not present — OM combined), `t12.electric`, `platform.opex_per_unit_annual.electric × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `year1.electric.om`. Live: **null** (OM combined utilities not decomposed). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.electric.override`. Live: **null** — resolved = null. |

### NCTRL-003: Gas / Fuel

| Attribute | Value |
|---|---|
| **ID** | NCTRL-003 |
| **Display label** | Gas / Fuel |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `gas_fuel.resolved = COALESCE(override, om_gas_fuel, t12_gas_fuel, platform_gas_fuel)` |
| **Inputs** | `broker_claims.proforma.gasFuelAnnual` (not present — OM combined), `t12.gas_fuel`, `platform.opex_per_unit_annual.gas × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `year1.gas_fuel.om`. Live: **null** (OM combined utilities not decomposed). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.gas_fuel.override`. Live: **null** — resolved = null. |

### NCTRL-003a: Utilities (combined OM field)

| Attribute | Value |
|---|---|
| **ID** | NCTRL-003a |
| **Display label** | Utilities (combined — not in OPEX_FIELDS canonical list) |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `utilities.resolved = COALESCE(override, om_utilities, t12_utilities, platform_utilities)` |
| **Inputs** | `broker_claims.proforma.utilitiesAnnual` (combined), `t12.utilities` (combined total) |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.utilitiesAnnual` → `year1.utilities.om`. Live: $187,094. |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.utilities.override`. Live: $187,094. T12 = $936 (partial year). |
| **Note** | `utilities` field is NOT in `OPEX_FIELDS` array at service:1844. It is a catch-all that captures OM combined utilities but the canonical P&L expects decomposed `water_sewer` + `electric` + `gas_fuel`. Both sets may be populated simultaneously, causing double-counting risk. |

### NCTRL-004: Property Insurance

| Attribute | Value |
|---|---|
| **ID** | NCTRL-004 |
| **Display label** | Insurance |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `insurance.resolved = COALESCE(override, platform_insurance, t12_insurance)` — platform checked before T12 in resolve() call; `FIELD_PRIORITIES['insurance'] = ['t12']` |
| **Inputs** | `platform.opex_per_unit_annual.insurance × totalUnits`, `t12.insurance`, `broker_claims.proforma.insuranceAnnual` |
| **Source tier** | override > Tier 3 (platform — null for this deal) > Tier 1 (T12 — null for this deal). Spec: `insuranceService.forecast()` per jurisdiction — not implemented. |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.insuranceAnnual` → `year1.insurance.om`. Live: $46,400. |
| **Platform path** | `platform.opex_per_unit_annual.insurance × totalUnits` → `year1.insurance.platform`. Live: **null** — no benchmark data (BUG-01, BUG-09). |
| **User path** | `year1.insurance.override`. Live: $46,400. T12 = null. |
| **Known issue** | `LV.warning = "No property insurance line in T12 — using platform baseline"` but platform is also null. Warning not surfaced in API response (BUG-14). |

### NCTRL-005: Real Estate Taxes

| Attribute | Value |
|---|---|
| **ID** | NCTRL-005 |
| **Display label** | Property Tax |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `real_estate_tax.resolved = COALESCE(override, tax_bill_annual, t12_re_tax)` per `FIELD_PRIORITIES['real_estate_tax'] = ['tax_bill', 't12']` |
| **Inputs** | `tax_bill.assessed_value × millage_rate` (extracted PDF), `t12.real_estate_taxes`, `broker_claims.proforma.realEstateTaxesAnnual` (null for 464 Bishop) |
| **Source tier** | override > Tier 1 (tax_bill) > Tier 1 (T12). Spec: `taxService.forecast()` per jurisdiction — NOT wired for P&L line (BUG-05). |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.realEstateTaxesAnnual` → `year1.real_estate_tax.om`. Live: **null** (OM did not include RE tax). |
| **Platform path** | `taxService.forecast()` result → `year1.real_estate_tax.platform`. Live: **null** — taxService not called for P&L line (BUG-05). |
| **User path** | `year1.real_estate_tax.override`. Live: null (resolves to T12 = $1,127,126; tax_bill = $20,731). |
| **Known issue** | tax_bill $20,731 vs T12 $1,127,126 — 54× gap. Likely partial-year or pre-reassessment bill. |

### NCTRL-006: Management Fee ($)

| Attribute | Value |
|---|---|
| **ID** | NCTRL-006 |
| **Display label** | Management Fee |
| **Category** | NCTRL_OPEX |
| **Type** | derived |
| **Formula** | `management_fee = SUB-REV-002 × NCTRL-006a.resolved` = `EGI × management_fee_pct` via `toDollarRow('management_fee_pct', 'management_fee', ..., EGI)` at service:1969 |
| **Inputs** | SUB-REV-002 (EGI = $3,615,849), NCTRL-006a (management_fee_pct = 2.50%) |
| **Source tier** | Derived — tier governed by NCTRL-006a |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Derived from NCTRL-006a; OM rate 2.75% × broker EGI ≈ $137K vs resolved $90,396 |
| **Platform path** | null (BUG-01) |
| **User path** | Via NCTRL-006a |
| **Live value (464 Bishop)** | $90,396 ($3,615,849 × 2.50%) |

### NCTRL-006a: Management Fee Rate (intermediate)

| Attribute | Value |
|---|---|
| **ID** | NCTRL-006a |
| **Display label** | Management Fee % (intermediate) |
| **Category** | NCTRL_OPEX |
| **Type** | sourced |
| **Formula** | `management_fee_pct.resolved = COALESCE(override, om_mgmt_pct, t12_mgmt_pct, platform_mgmt_pct)` |
| **Inputs** | `broker_claims.proforma.managementFeePct`, `t12.management_fee / t12.scheduled_rent`, `platform.management_fee_pct` |
| **Source tier** | override > Tier 4 (OM) > Tier 1 (T12) > Tier 3 (platform) |
| **Display format** | `N.NN%` |
| **Sign convention** | + (rate; applied as − via NCTRL-006) |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.managementFeePct` → `year1.management_fee_pct.om`. Live: 0.0275 (2.75%). |
| **Platform path** | null (BUG-01) |
| **User path** | `year1.management_fee_pct.override`. Live: 0.0250 (2.50% — operator reduced from OM). |
| **Known issue** | T12 mgmt_fee_pct = 11.42% — nonsensical; likely dollar amount used as rate or wrong denominator. |

---

## Section 4 — Subtotals

### SUB-001: Total Operating Expenses

| Attribute | Value |
|---|---|
| **ID** | SUB-001 |
| **Display label** | Total Operating Expenses |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `total_opex = SUM(CTRLL-001..007) + SUM(NCTRL-001..006)` — computed at seeder time, stored in `year1.total_opex`; runtime verification: `total_opex = EGI − NOI` |
| **Inputs** | All CTRLL and NCTRL rows (CTRLL-001 through NCTRL-006); excludes CAPEX items |
| **Source tier** | Derived stored subtotal |
| **Display format** | `($N,NNN,NNN)` (highlighted section total) |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | Not stored in `year1.total_opex.om`. Broker implied OpEx = $1,998,673 (from broker components) vs resolved $3,129,741 — **+$1,131,068 / +56.6% collision not flagged (BUG-06)**. |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override — controlled via component row overrides |
| **Live value (464 Bishop)** | $3,129,741.08 |
| **Integrity check** | `EGI − NOI = $3,615,849 − $486,108 = $3,129,741` ✓ |
| **Aggregation** | Includes CTRLL-001..007, NCTRL-001..006; excludes REV rows and CAPEX-001..002 |

### SUB-002: Net Operating Income (NOI)

| Attribute | Value |
|---|---|
| **ID** | SUB-002 |
| **Display label** | Net Operating Income |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `NOI = SUB-REV-002 − SUB-001` = `EGI − total_opex` — computed at seeder time, stored in `year1.noi` |
| **Inputs** | SUB-REV-002 (EGI = $3,615,849), SUB-001 (total_opex = $3,129,741) |
| **Source tier** | Derived stored subtotal |
| **Display format** | `$NNN,NNN` (highlighted, blue) |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | `year1.noi.om = $2,999,564`. Resolved = $486,108. **CRITICAL COLLISION: −$2,513,456 / −83.8% — not flagged (BUG-06)**. |
| **Platform path** | null (BUG-01) |
| **User path** | No direct override; indirectly via component overrides |
| **Live value (464 Bishop)** | $486,107.97 |
| **Integrity check** | `EGI − total_opex = $3,615,849 − $3,129,741 = $486,108` ✓ |
| **Aggregation** | EGI minus all operating expenses; excludes CAPEX items, debt service, taxes |

### SUB-003: NOI Margin (display metric)

| Attribute | Value |
|---|---|
| **ID** | SUB-003 |
| **Display label** | NOI Margin |
| **Category** | SUBTOTAL |
| **Type** | derived |
| **Formula** | `noi_margin = SUB-002 / SUB-REV-002` = `NOI / EGI` |
| **Inputs** | SUB-002 (NOI), SUB-REV-002 (EGI) |
| **Source tier** | Derived |
| **Display format** | `NN.N%` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Broker path** | Implied broker margin = $2,999,564 / $4,998,237 = 60.0% vs resolved 13.4% |
| **Platform path** | null |
| **User path** | No override |
| **Live value (464 Bishop)** | 13.4% |

---

## Section 5 — Capital & Reserves

### CAPEX-001: Replacement Reserves

| Attribute | Value |
|---|---|
| **ID** | CAPEX-001 |
| **Display label** | Replacement Reserves |
| **Category** | CAPEX |
| **Type** | sourced |
| **Formula** | `replacement_reserves.resolved = COALESCE(override, om_reserves, platform_reserves)` |
| **Inputs** | `broker_claims.proforma.replacementReservesPerUnit × totalUnits`, `platform.replacement_reserves_per_unit × totalUnits` |
| **Source tier** | override > Tier 4 (OM) > Tier 3 (platform) |
| **Display format** | `$NNN,NNN ($NNN/unit)` |
| **Sign convention** | − |
| **Phase flag** | ALL |
| **Broker path** | `broker_claims.proforma.replacementReservesPerUnit × totalUnits` → `year1.replacement_reserves.om`. Live: $46,400 ($200/unit). |
| **Platform path** | `platform.replacement_reserves_per_unit × totalUnits` → `year1.replacement_reserves.platform`. Live: **null** (BUG-01). |
| **User path** | `year1.replacement_reserves.override`. Live: $58,000 ($250/unit). |
| **Projection fallback** | `proforma-adjustment.service.ts:3393`: `reservesY1 = ry1('replacement_reserves') || (totalUnits × 350)` — if year1 null, defaults to $350/unit. |

### CAPEX-002: Capital Expenditure Draw (development / value-add)

| Attribute | Value |
|---|---|
| **ID** | CAPEX-002 |
| **Display label** | CapEx Draw |
| **Category** | CAPEX |
| **Type** | user-input |
| **Formula** | `capex_draw = capex_per_unit.resolved × totalUnits` |
| **Inputs** | `year1.capex_per_unit.override`, `totalUnits` |
| **Source tier** | User override only; no extraction source |
| **Display format** | `$N,NNN,NNN` |
| **Sign convention** | − |
| **Phase flag** | DEVELOPMENT, REDEVELOPMENT |
| **Broker path** | Not typically in OM capsule |
| **Platform path** | null |
| **User path** | `year1.capex_per_unit.override` |

---

## Section 6 — Below-NOI (v31 Spec Line Items)

The v31 canonical spec defines these rows on or below the Pro Forma surface.
Current assembly state documented per row.

### BELOW-001: NOI After Reserves

| Attribute | Value |
|---|---|
| **ID** | BELOW-001 |
| **Display label** | NOI After Reserves |
| **Category** | BELOW_NOI |
| **Type** | not-assembled (BUG-13) |
| **Formula** | `noi_after_reserves = SUB-002 − CAPEX-001` = `NOI − replacement_reserves` |
| **Inputs** | SUB-002 (NOI = $486,108), CAPEX-001 (replacement_reserves = $58,000) |
| **Source tier** | Derived |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + |
| **Phase flag** | ALL |
| **Expected value (464 Bishop)** | $486,108 − $58,000 = **$428,108** |
| **Live DB `year1.noi_after_reserves`** | **null** — not assembled as OperatingStatementRow |
| **Where computed today** | Projection engine: `proforma-adjustment.service.ts:3393` as `const reservesY1 = ry1('replacement_reserves') || (totalUnits × 350)` — per-year only, not surfaced in year1 |
| **Gap vs v31 spec** | v31 spec: "NOI AFTER RESERVES — subtotal" on Pro Forma surface. Absent from `getDealFinancials()` row assembly. `ProFormaSummaryTab` cannot render it (BUG-13). Fix: add derived row after NOI_FIELDS in assembly at service:1970. |
| **Broker path** | Not implemented |
| **Platform path** | Not implemented |
| **User path** | Not implemented |
| **Aggregation** | NOI minus reserves only; excludes debt service and income tax |

### BELOW-002: Total Debt Service

| Attribute | Value |
|---|---|
| **ID** | BELOW-002 |
| **Display label** | Total Debt Service |
| **Category** | BELOW_NOI |
| **Type** | not-assembled |
| **Formula** | `debt_service = annual_interest + annual_principal_amortization`; IO period: `annual_interest = loanAmount × interestRate`, principal = 0 |
| **Inputs** | `capitalStack.loanAmount`, `capitalStack.interestRate`, `capitalStack.ioPeriodMonths`, `capitalStack.amortizationYears` |
| **Source tier** | Derived from capital stack loan terms |
| **Display format** | `($NNN,NNN)` |
| **Sign convention** | − |
| **Phase flag** | ALL (0 when no debt) |
| **Live DB year1 value** | null — not assembled in year1 OperatingStatementRow[] |
| **Where computed today** | Per-year in projection loop |
| **Broker path** | Not applicable |
| **Platform path** | Not applicable |
| **User path** | Via capital stack overrides |

### BELOW-003: Cash Flow Before Tax (CFBD)

| Attribute | Value |
|---|---|
| **ID** | BELOW-003 |
| **Display label** | Cash Flow Before Tax |
| **Category** | BELOW_NOI |
| **Type** | not-assembled |
| **Formula** | `cfbd = BELOW-001 − BELOW-002` = `noi_after_reserves − debt_service` |
| **Inputs** | BELOW-001 (NOI After Reserves), BELOW-002 (Total Debt Service) |
| **Source tier** | Derived |
| **Display format** | `$NNN,NNN` |
| **Sign convention** | + or − depending on leverage |
| **Phase flag** | ALL |
| **Live DB year1 value** | null — not in year1 OperatingStatementRow[] |
| **Where computed today** | Per-year projection loop; also `frontend/src/services/proFormaGenerator.ts:314` (`noi - debtService`) for 3D design model |
| **Per v31 spec** | "Cash Flow Before Tax — in Projections tab, not summary Pro Forma." **CFBD correctly belongs in Projections, not the Pro Forma surface.** Only BELOW-001 (NOI After Reserves) is a Pro Forma surface gap. |
| **Broker path** | Not applicable |
| **Platform path** | Not applicable |
| **User path** | Not applicable |

---

## Section 7 — System A Scalars (`GET /api/v1/proforma/:dealId`)

Separate system — `proforma_assumptions` table. No P&L line items here.

| ID | Display label | Formula | Source | Format | Sign | Phase | Broker path | Platform path | User path | Live value |
|---|---|---|---|---|---|---|---|---|---|---|
| SCA-001 | Rent Growth | `effective = COALESCE(rent_growth_override, rent_growth_current, rent_growth_baseline)` | M35 → current; `getMarketBaseline()` → baseline (hardcoded 3.5% — BUG-03) | `N.N%` | + | ALL | None | Hardcoded 3.5% | `proforma_assumptions.rent_growth_override` | baseline=3.5%, current=3.5%, effective=3.5% |
| SCA-002 | Vacancy | `effective = COALESCE(vacancy_override, vacancy_current, vacancy_baseline)` | M35 → current; hardcoded 5.0% → baseline (BUG-03) | `N.N%` | + | ALL | None | Hardcoded 5.0% | `proforma_assumptions.vacancy_override` | baseline=5.0%, current=5.0%, effective=5.0% |
| SCA-003 | OpEx Growth | `effective = COALESCE(opex_growth_override, opex_growth_current, opex_growth_baseline)` | M35 → current; hardcoded 2.8% → baseline (BUG-03) | `N.N%` | + | ALL | None | Hardcoded 2.8% | `proforma_assumptions.opex_growth_override` | baseline=2.8%, current=2.8%, effective=2.8% |
| SCA-004 | Exit Cap Rate | `effective = COALESCE(exit_cap_override, exit_cap_current, exit_cap_baseline)` | M35 → current; hardcoded 5.5% → baseline (BUG-03) | `N.NN%` | + | ALL | None | Hardcoded 5.5% | `proforma_assumptions.exit_cap_override` | baseline=5.5%, current=5.5%, effective=5.5% |
| SCA-005 | Absorption | `effective = COALESCE(absorption_override, absorption_current, absorption_baseline)` | M35 → current; hardcoded 8.0 leases/mo → baseline (BUG-03) | `N.N leases/mo` | + | LEASE_UP | None | Hardcoded 8.0 | `proforma_assumptions.absorption_override` | baseline=8.0, current=8.0, effective=8.0 |

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
  // all opex lines not listed above:
  // ['override', 'om', 't12', 'platform']  ← default priority
};
```

Generic `resolve(field, platformValue, { t12, rent_roll, om, tax_bill, existingOverride })`:
```
if existingOverride != null → override (confidence 95)
elif field in rent_roll-first list AND rent_roll != null → rent_roll (confidence 80)
elif field in t12-first list AND t12 != null → t12 (confidence 85)
elif om != null → om (confidence 60)
elif platformValue != null → platform (confidence 70)
else → null (resolution = 'platform_fallback', confidence 65)
```

`platformValue` is null for every field in the live system (BUG-01), meaning the
'platform_fallback' label is a misnomer — it signals no-data, not a platform estimate.

---

## Appendix B — SOURCE_CONFIDENCE Lookup

From `proforma-adjustment.service.ts:1863-1874`:

| Resolution tag | Confidence | Meaning |
|---|---|---|
| `override` | 95 | Operator confirmed |
| `t12` | 85 | 12-month historical actuals |
| `tax_bill` | 85 | Official tax document extraction |
| `rent_roll` | 80 | Current lease data |
| `box_score` | 75 | Comp-set aggregation |
| `platform` | 70 | Market-wide (M05/M07) — always null (BUG-01) |
| `platform_fallback` | 65 | No source found — null data, not platform estimate |
| `om` | 60 | Broker OM — lowest authority |
| `broker` | 60 | Alias for om |
| `computed` | 55 | Derived with no direct source |

---

## Appendix C — Known Bugs by Line Item

| Bug ID | Affects row IDs | Impact on displayed value |
|---|---|---|
| BUG-01 | All rows | `platform` slot null; `benchmarkPosition` null; platform column always blank |
| BUG-02 | SCA-001..005 `computed` block | IRR, NOI, CoC computed with hardcoded phantom-deal inputs, not live deal data |
| BUG-03 | SCA-001..005 baselines | All 5 baselines hardcoded; no live M05/M07/M15 integration |
| BUG-04 | REV-003a | T12 vacancy = 66.0% (formula error); rent_roll (19.83%) used instead |
| BUG-05 | NCTRL-005 | taxService not called for P&L line; $20K bill vs $1.1M T12 unreconciled |
| BUG-06 | SUB-REV-002, SUB-001, SUB-002 | NOI collision −83.8%, EGI −27.7%, OpEx +56.6% — not flagged |
| BUG-08 | REV-003a vs SCA-002 | System A vacancy (5%) and System B vacancy (19.83%) fully decoupled |
| BUG-09 | NCTRL-004 | LV.warning references non-existent platform baseline |
| BUG-11 | REV-001 | Broker GPR capsule not mapped to `year1.gpr.om`; slot null |
| BUG-13 | BELOW-001 | NOI After Reserves absent from year1 assembly; `ProFormaSummaryTab` cannot render |
| BUG-14 | NCTRL-004 and any row with LV.warning | `LV.warning` not extracted by `toRow()`; silently dropped from API |
