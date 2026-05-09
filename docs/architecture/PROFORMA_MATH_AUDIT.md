# Pro Forma Math Audit — Phase 0

**Task:** #662 · **Date:** 2026-05-09 · **Auditor:** Agent (read-only; no code changes)

**Test deals:**

| Deal | ID | Units | Source capsules |
|---|---|---|---|
| 464 Bishop | `3f32276f-aacd-4da3-b306-317c5109b403` | 232 | OM + T12 + Rent Roll (full) |
| Sentosa Epperson | `3d96f62d-d986-448f-8ea4-10853021a8cb` | 304 | T12 + Rent Roll only |

**Legend:** ✓ MATH_OK · ⚠ UNIT_DRIFT · ⚠ STALE_CACHE · ✗ MATH_BUG · ✗ GROWTH_LEAK · ? UNCLEAR

---

## Section 1 — Revenue Lines (GPR → EGI)

### Resolution chain helpers

```
resolvedNum(lv) → lv.resolved (number or null)      [adj.service.ts:1221-1224]
layerNum(lv, k) → lv[k] (number or null)             [adj.service.ts:1227-1231]
lv(seed, key)   → seed[key] as object or null        [adj.service.ts:1233-1236]
toRow(key, lbl) → OperatingStatementRow via lv(year1Seed, key)  [adj.service.ts:1876-1906]
toDollarRow(srcKey, outField, lbl, multiplier) → pct × multiplier as dollar row
                                                     [adj.service.ts:1914-1950]
```

`year1Rows` assembly (adj.service.ts:1958–1970) produces two parallel rows for pct fields:
- **Raw pct row** (`toRow('vacancy_pct', …)`) → displayed in AssumptionsTab
- **Dollar row** (`toDollarRow('vacancy_pct', 'vacancy_loss', …, gprForDollars)`) → displayed in ProFormaSummaryTab

ProFormaSummaryTab render path: `data.proforma.year1` fetched via `apiClient.get('/api/v1/deals/:id/financials')` at load time (`ProFormaSummaryTab.tsx:613`). Revenue deduction rows filtered by `REVENUE_FIELDS` set at `ProFormaSummaryTab.tsx:654`.

### Section 1 Line-by-Line Audit Table

| Line | Field(s) | Formula | Bishop resolved | Sentosa resolved | Bishop check | Sentosa check | Tag |
|---|---|---|---|---|---|---|---|
| **GPR** | `gpr` | `resolve('gpr', platform, {t12, rent_roll, existingOverride})` | $4,901,400 (override) | $6,592,310 (t12) | T12=$4,876,535; RR=$4,932,300; override=$4,901,400 ✓ | T12=$6,592,310; RR=$6,636,888 ✓ | ✓ MATH_OK |
| **Loss to Lease** | `loss_to_lease_pct` → dollar: `loss_to_lease` | `toDollarRow(ltl_pct, 'loss_to_lease', lbl, GPR)` | 0.3497% → $17,146 | 0% → $0 | 4,901,400×0.003497=$17,140 ✓ (±$6 rounding) | 0 ✓ | ✓ MATH_OK |
| **Vacancy** | `vacancy_pct` → dollar: `vacancy_loss` | `toDollarRow(vac_pct, 'vacancy_loss', lbl, GPR)` | 19.83% → $972,007 | 17.43% → $1,148,900 | 4,901,400×0.19828=$972,000 ✓ | 6,592,310×0.17434=$1,148,909 ✓ | ✓ MATH_OK |
| **Concessions** | `concessions_pct` → dollar: `concessions` | `toDollarRow(conc_pct, 'concessions', lbl, GPR)` | 7.78% → $381,402 | 0.82% → $54,199 | 4,901,400×0.07780=$381,289 ✓ (±$113) | 6,592,310×0.00823=$54,255 ✓ | ✓ MATH_OK |
| **Bad Debt** | `bad_debt_pct` → dollar: `bad_debt` | `toDollarRow(bd_pct, 'bad_debt', lbl, GPR)` | 3.34% → $163,807 (display) | 2.62% → $172,919 (display) | Seeder applies bad_debt to EGI, not GPR (see MATH-01) | Same divergence | ⚠ UNIT_DRIFT |
| **NRU** | `non_revenue_units_pct` → dollar: `non_revenue_units` | `toDollarRow(nru_pct, 'non_revenue_units', lbl, GPR)` | 0% → $0 | 0% → $0 | ✓ | ✓ | ✓ MATH_OK |
| **NRI** | `net_rental_income` | `GPR − GPR×LTL% − GPR×Vac% − GPR×Conc% − GPR×NRU%` (no bad_debt) | $3,531,123 (computed) | $5,388,743 (computed) | 4,901,400−17,146−972,007−381,402−0=$3,530,845 ✓ (±$278) | 6,592,310−0−1,148,909−54,255−0=$5,389,146 ✓ | ✓ MATH_OK |
| **Other Income** | `other_income_per_unit` → dollar: `other_income` | `toDollarRow(oi_pu, 'other_income', lbl, units×12)` | 904.14/unit → display $2,517K ⚠ (stale annual seed) | 96.15/unit → display $350K ✓ | Seeder OI ≈ $210K; display 12× inflated (STALE_CACHE) | 96.15×304×12=$350K ≈ $349K ✓ | ⚠ STALE_CACHE (Bishop) / ✓ MATH_OK (Sentosa) |
| **EGI** | `egi` | `(NRI + OtherIncome) × (1 − bad_debt%)` | $3,615,849 | $5,588,972 | (3,531,123+210,031)×(1−0.03342)=$3,615,849 ✓ | (5,388,743+349K)×(1−0.02623)=$5,589K ✓ | ✓ MATH_OK |

**Notes:**
- `bad_debt_pct` resolved layer for Bishop = `rent_roll` (0.03342); for Sentosa = `t12` (0.02623).
- Bad debt display row uses `GPR × bad_debt_pct` as multiplier (`adj.service.ts:1964`) but seeder applies bad_debt to `(NRI + OtherIncome)`. The display value of bad_debt in dollars is larger than actually deducted from EGI. See MATH-01.
- Bishop GPR resolution = `override` (user set $4,901,400); T12=$4,876,535, RR=$4,932,300 are available layers.
- Bishop `other_income_per_unit.resolved = 904.14` is stale — seeded before the `÷12` monthly convention. ProFormaSummaryTab at line 1966 uses `_otherIncMul = totalUnits × 12 = 232 × 12 = 2,784` → display OI = $2,517,126 (vs seeder $210K). See MATH-02.

---

## Section 2 — Controllable OpEx

ProFormaSummaryTab render: `ctrlRows` filtered by `CTRL_OPEX_FIELDS` set, rendered via `DataRow` component (`ProFormaSummaryTab.tsx:1194–1205`). Source: `toRow(k, l)` for all OPEX_FIELDS entries.

| Line | Field | Seeder source priority | Bishop resolved | Bishop res | Sentosa resolved | Sentosa res | Tag |
|---|---|---|---|---|---|---|---|
| **Payroll** | `payroll` | t12 → platform fallback | $324,800 | override | $99,193 | t12 | ✓ MATH_OK |
| **Repair & Maint** | `repairs_maintenance` | t12 (`r_and_m`) → platform | $69,600 | override | $14,005 | t12 | ✓ MATH_OK |
| **Turnover** | `turnover` | t12 → platform | $41,760 | t12 | $23,394 | t12 | ✓ MATH_OK |
| **Contract Svcs** | `contract_services` | t12 (`contract`) → platform | $28,680 | t12 | $50,217 | t12 | ✓ MATH_OK |
| **Marketing** | `marketing` | t12 → platform | $69,600 | t12 | $86,733 | t12 | ✓ MATH_OK |
| **G&A / Admin** | `g_and_a` | t12 → platform | $69,600 | t12 | $56,832 | t12 | ✓ MATH_OK |
| **Utilities** | `utilities` | t12 → platform | $187,094 | t12 | $116,580 | t12 | ✓ MATH_OK |

**ProFormaSummaryTab canonical order** (`CTRL_ORDER`, line 658): payroll → repairs_maintenance → turnover → contract_services → landscaping → marketing → utilities → g_and_a.  
Note: `landscaping` is in `CTRL_ORDER` display list but is not in `OPEX_FIELDS` for seeder (seeder has no `landscaping` key). If a row with field `landscaping` is absent from `year1Rows`, the tab renders a blank/zero row. `? UNCLEAR` for landscaping row.

---

## Section 3 — Non-Controllable OpEx + Reserves + NOI

ProFormaSummaryTab render: `nctrlRows` filtered by `NCTRL_OPEX_FIELDS` at line 662 (`NCTRL_ORDER = ['management_fee','insurance','real_estate_tax']`). Reserves rendered separately as "below-the-line" (`ProFormaSummaryTab.tsx:695–705`).

| Line | Field | Formula / Source | Bishop resolved | Sentosa resolved | Verification | Tag |
|---|---|---|---|---|---|---|
| **Mgmt Fee** | `management_fee_pct` (raw) / `management_fee` (dollar) | `mgmtFeePct = t12_mgmt_fee / t12_egi` (seeder:578–583); dollar = `EGI × pct` | 2.50% → $90,396 | 4.047% → $226,388 | Bishop: 3,615,849×0.025=$90,396 ✓; Sentosa: 5,588,972×0.04047=$226,388 ✓ | ✓ MATH_OK |
| **Insurance** | `insurance` | `opexFromT12('insurance', …)` priority t12 | $46,400 (override) | $202,373 (t12) | Bishop override confirmed (not t12=$? implied); Sentosa t12 ✓ | ✓ MATH_OK |
| **RE Tax** | `real_estate_tax` | Tax-bill scenario if capsule exists, else `opexFromT12('real_estate_tax', …)`. IC-04 tie-break: if |t12 − tax_bill|/tax_bill > 15%, prefer t12 | $1,127,126 (t12) | $1,450,990 (t12) | Bishop: tax_bill=$20,731; t12=$1,127,126; |diff|/tax_bill=5,340%>15% → IC-04 fires, t12 wins ✓. Sentosa: no tax_bill capsule → t12 direct ✓ | ✓ MATH_OK |
| **Replacement Reserves** | `replacement_reserves` | `resolve('replacement_reserves', null, {om, existingOverride})` — NOT in `total_opex_resolved` | $58,000 (override) | null (platform_fallback) | Seeder:708–712; reserves excluded from total_opex sum (seeder:685–690). ProFormaSummaryTab renders reserves as `noiAfterReserves = NOI − reserves` (line:702–705) | ✓ MATH_OK (convention noted) |
| **custom_opex_\*** | Dynamic keys | `isExcludedFromOpex` filter; remaining GL items summed into `customOpexTotal` | ~$1,067,355 (13+ keys) | ~$2,207,899 (65 keys) | See Reg D1; Sentosa includes $684,953 rate cap MTM (non-opex) | ⚠ STALE_CACHE (Sentosa) |
| **Amenities** | `amenities` | `opexFromT12('amenities', …)` — included in seeder total_opex but NOT in OPEX_FIELDS display list | $7,330 | $2,462 | Present in total_opex_resolved (seeder:687) but absent from OPEX_FIELDS at adj.service.ts:1844–1858 → NOT rendered in ProFormaSummaryTab | ? UNCLEAR (display gap) |
| **Total OpEx** | `total_opex` | Sum of all resolved OpEx (excl. reserves) | $3,129,741 | $4,537,066 | Bishop verify: 324,800+69,600+41,760+28,680+69,600+69,600+187,094+46,400+1,127,126+90,396+7,330+1,067,355=$3,129,741 ✓ | ✓ MATH_OK |
| **NOI** | `noi` | `EGI_after_bad_debt − total_opex_resolved` | $486,108 | $1,051,906 | Bishop: 3,615,849−3,129,741=$486,108 ✓; Sentosa: 5,588,972−4,537,066=$1,051,906 ✓ | ✓ MATH_OK |
| **NOI After Reserves** | computed client-side | `noiAfterReserves = NOI − |reserves|` (`ProFormaSummaryTab.tsx:702–704`) | $428,108 (486,108−58,000) | null (no reserves) | 486,108−58,000=$428,108 ✓ | ✓ MATH_OK |

**Seeder `total_opex_resolved` composition** (seeder.ts:685–690):
```
total_opex_resolved = payroll + repairs + turnover + amenities + contract + marketing +
                      office + g_and_a + hoaDues + utilities + mgmtFeeDollar +
                      realEstateTax + personalPropTax + insurance + customOpexTotal
                      [replacement_reserves NOT included]
```

---

## Section 4 — Capital Metrics

**Formula sources:** `proforma-adjustment.service.ts:2314–2341` (capital stack assembly), `ProFormaSummaryTab.tsx:711–727` (frontend debt service computation), `adj.service.ts:3597–3626` (valuationSnapshot).

**Status for both test deals: N/A — no purchase price configured.**

`purchasePrice` resolution chain (adj.service.ts:2314–2317):
```ts
purchasePrice = dealData.purchase_price ?? dealData.asking_price ?? deal.budget
```

Both Bishop and Sentosa have `deal_data.purchase_price = NULL`, `deal_data.asking_price = NULL`, `deals.budget = NULL` → `purchasePrice = null` → all capital metrics null.

| Metric | Formula | Status — Bishop | Status — Sentosa | Tag |
|---|---|---|---|---|
| Purchase Price | dealData.purchase_price ?? asking_price ?? budget | null | null | ? UNCLEAR (no PP set) |
| Loan Amount | purchasePrice × ltcPct | null (ltcPct=0.75 ready) | null (ltcPct=0.65 ready) | ? UNCLEAR |
| Equity at Close | purchasePrice − loanAmount | null | null | ? UNCLEAR |
| Annual Debt Service (IO) | loanAmount × interestRate (`ProFormaSummaryTab.tsx:714–716`) | null | null | ? UNCLEAR |
| Annual Debt Service (Amort.) | PMT(r/12, n, loanAmount) × 12 (`ProFormaSummaryTab.tsx:721–724`) | null | null | ? UNCLEAR |
| DSCR | NOI / annualDS | null | null | ? UNCLEAR |
| Debt Yield | NOI / loanBalance | null (`adj.service.ts:3550`) | null | ? UNCLEAR |
| CoC (Y1) | CFBT / equityAtClose (`adj.service.ts:3548`) | null | null | ? UNCLEAR |
| Going-in Cap | NOI / purchasePrice (`adj.service.ts:3611`) | null | null | ? UNCLEAR |
| GRM | purchasePrice / GPR | null | null | ? UNCLEAR |
| GIM | purchasePrice / EGI | null | null | ? UNCLEAR |
| Price / Unit | purchasePrice / totalUnits | null | null | ? UNCLEAR |

**Formula audit (no PP):** Formulas verified by code inspection; no arithmetic bugs found in capital metrics code paths. When `purchasePrice` is populated, all derived metrics produce correct outputs. Verified in Close-out 2 (SHIPPED_WORK_VERIFICATION.md) for a deal with budget set.

**Capital stack assumptions (ready to use when PP is set):**
- Bishop: `interestRate = 0.06` (6.0%), `ltc = 0.75` (75%), `io_period_months = 36`, `amort = 30yr`
- Sentosa: `ltc = 0.65` (65%), `io_period_months = 36`, `amort = 30yr`

Note: `interest_rate` is stored as decimal (0.0600) in `deal_assumptions` and read directly (no ÷100 needed) — consistent with `exit_cap` decimal convention. See Section 6 for full convention table.

---

## Phase 0b — Projections Y1 Reconciliation

**Code reference:** Projections IIFE at `adj.service.ts:3355–3595`. Year 1 slice: `yr === 1`, `rentGrowthStep = 0`, `opexGrowthStep = 0`, `insGrowthStep = 0` (`adj.service.ts:3434–3436`).  
**Frontend slice:** `pf1 = financials.proforma?.year1 ?? []` at `ProjectionsTab.tsx:1150–1151`.

### B1. Revenue Lines — Y1 Reconciliation

| Line | ProForma (seeder) | Projections Y1 formula | Bishop ProForma | Bishop Proj Y1 | Delta | Classification |
|---|---|---|---|---|---|---|
| GPR | `gpr.resolved` | `gprY1 = gprDecomposition.resolvedAnnual ?? ry1('gpr')` | $4,901,400 | $4,901,400 | $0 | ✓ MATCH |
| Vacancy Loss | `gpr × vacancy_pct` | `round(gpr × vacPct)` where vacPct = tv?.vacancyPct ?? pv?.vacancyPct ?? ry1('vacancy_pct') | $972,007 | $972,007 | $0 | ✓ MATCH |
| Loss to Lease | `gpr × ltl_pct` | `round(gpr × lossToLeasePct)` | $17,146 | $17,146 | $0 | ✓ MATCH |
| Concessions | `gpr × conc_pct` | `round(gpr × concPct)` | $381,402 | $381,402 | $0 | ✓ MATCH |
| Bad Debt | applied to EGI in seeder | `round(gpr × badDebtPct)` applied to GPR in projections (`adj.service.ts:3453`) | ~$125K (on EGI) | $163,792 (on GPR) | +$38,792 | COMPUTE_DRIFT (MATH-01) |
| NRU | $0 | $0 | $0 | $0 | $0 | ✓ MATCH |
| NRI | `GPR − LTL − Vac − Conc − NRU` (no bad_debt) | `GPR − vacancyLoss − lossToLease − conc − badDebt − NRU` (bad_debt IN NRI) | $3,531,123 | ~$3,367,061 | −$164K | COMPUTE_DRIFT (MATH-01) |
| **OtherIncome** | ~$210,031 (breakdown sum) | `ry1('other_income_per_unit') × totalUnits × 12 = 904.14 × 232 × 12` | ~$210,031 | **$2,517,126** | **+$2,307,095** | **SOURCE_DRIFT** (MATH-02: stale seed) |
| EGI | `(NRI + OI) × (1−bd%)` = $3,615,849 | `nri + otherIncome` (no second bd reduction) | $3,615,849 | ~$5,884,187 | ~+$2,268K | SOURCE_DRIFT + COMPUTE_DRIFT |

| Line | ProForma (seeder) | Projections Y1 formula | Sentosa ProForma | Sentosa Proj Y1 | Delta | Classification |
|---|---|---|---|---|---|---|
| GPR | $6,592,310 | same as above | $6,592,310 | $6,592,310 | $0 | ✓ MATCH |
| OtherIncome | $349,207 | `96.15 × 304 × 12` | $349,207 | ~$350,691 | +$1,484 | ROUNDING |
| Bad Debt | ~$151K (on EGI) | $172,935 (on GPR, 2.62% × $6.59M) | varies | varies | +$21,935 | COMPUTE_DRIFT |
| EGI | $5,588,972 | ~$5,570,000 (est.) | $5,588,972 | ~$5,570K | ~−$19K | COMPUTE_DRIFT |

### B2. Expense Lines — Y1 Reconciliation

At `yr = 1` all opexGrowthStep = 0, so projections seeds match `ry1(field)` exactly for standard fields.

| Line | ProForma in seeder total_opex | In projections totalOpex | Bishop | Sentosa | Classification |
|---|---|---|---|---|---|
| Payroll | ✅ | ✅ | $324,800 match | $99,193 match | ✓ MATCH |
| Repairs | ✅ | ✅ | $69,600 match | $14,005 match | ✓ MATCH |
| Turnover | ✅ | ✅ | $41,760 match | $23,394 match | ✓ MATCH |
| Contract Svcs | ✅ | ✅ | $28,680 match | $50,217 match | ✓ MATCH |
| Marketing | ✅ | ✅ | $69,600 match | $86,733 match | ✓ MATCH |
| G&A | ✅ | ✅ | $69,600 match | $56,832 match | ✓ MATCH |
| Utilities | ✅ | ✅ | $187,094 match | $116,580 match | ✓ MATCH |
| Insurance | ✅ | ✅ | $46,400 match | $202,373 match | ✓ MATCH |
| RE Tax | ✅ | ✅ (taxes tab, else compound) | $1,127,126 | $1,450,990 | ✓ MATCH (both seeded from t12) |
| Mgmt Fee | ✅ `EGI × pct` | ✅ `egi × mgmtFeePct` | ~$90,396 | ~$225,659 | COMPUTE_DRIFT (EGI differs due to B1 gap) |
| **Amenities** | ✅ in seeder total | ❌ absent in projections | $7,330 | $2,462 | INTENTIONAL (not in IIFE) |
| Office | ✅ ($0) | ❌ absent | $0 | $0 | INTENTIONAL ($0, no impact) |
| HOA Dues | ✅ ($0) | ❌ absent | $0 | $0 | INTENTIONAL ($0, no impact) |
| Personal Prop Tax | ✅ ($0) | ❌ absent | $0 | $0 | INTENTIONAL ($0, no impact) |
| **custom_opex_\*** | ✅ in seeder total | ❌ absent in projections | ~$1,067,355 | ~$2,207,899 | INTENTIONAL (structural) |
| **Replacement Reserves** | ❌ excluded from seeder total | ✅ `ry1('replacement_reserves') \|\| units×350` | $0 (excluded) | $0 (excluded) | INTENTIONAL (seeder) vs +$58,000 (Bishop proj) / +$106,400 (Sentosa proj) |

### B3. Y1 NOI Comparison

| | Bishop ProForma NOI | Bishop Proj Y1 NOI | Sentosa ProForma NOI | Sentosa Proj Y1 NOI |
|---|---|---|---|---|
| **Value** | **$486,108** | **$1,709,818** | **$1,051,906** | **~$1,610,000 (est.)** |
| **Gap** | | **+$1,223,710** | | **+$558,094 (est.)** |
| **Primary causes** | | MATH-02 ($2.3M OI inflation) offset by reserves, mgmt recalc | | Rate cap MTM ($685K) in seeder OpEx not in Proj; reserves ($106K) added in Proj |

Bishop Y1 NOI confirmed at $1,709,818 via `irr-verify-464-bishop.ts` probe (SHIPPED_WORK_VERIFICATION.md §Close-out 1).

---

## Phase 0c — Unit Normalization Sweep

### C1. `deal_assumptions` Scalar Field Inventory

Query run against both test deals. Fields classified by storage convention and downstream consumer.

| Field | Bishop stored | Sentosa stored | Convention | Consumer (read as) | Used correctly? |
|---|---|---|---|---|---|
| `rent_growth_yr1` | `3.00` | `3.00` | **WHOLE_PERCENT** (3.0 = 3%) | `adj.service.ts:2125`: `parseFloat(v).toFixed(3)` → `3.000` — NO ÷100 | ⚠ UNIT_DRIFT: used as 3.0 (300%) in projections Y2+ |
| `rent_growth_stabilized` | `2.50` | `2.50` | **WHOLE_PERCENT** (2.5 = 2.5%) | `adj.service.ts:2126`: `parseFloat(v).toFixed(3)` → `2.500` — NO ÷100 | ⚠ UNIT_DRIFT: used as 2.5 (250%) in projections Y3+ |
| `exit_cap` | `0.0500` | `0.0500` | **DECIMAL** (0.05 = 5%) | `adj.service.ts:2124`: `parseFloat(v).toFixed(3)` → `0.050` | ✓ MATH_OK |
| `interest_rate` | `0.0600` | null | **DECIMAL** (0.06 = 6%) | `adj.service.ts:2325`: `parseFloat(v).toFixed(4)` → `0.0600` | ✓ MATH_OK |
| `ltc` | `0.7500` | `0.6500` | **DECIMAL** (0.75 = 75%) | `adj.service.ts:2318`: `parseFloat(v).toFixed(4)` → `0.7500` | ✓ MATH_OK |
| `ltv` | null | null | ZERO_OR_NULL | Not read by composer | N/A |
| `dscr_min` | `1.25` | `1.25` | **RATIO** (not pct) | `adj.service.ts:2328`: `parseFloat(v).toFixed(2)` → `1.25` | ✓ MATH_OK |
| `origination_fee_pct` | `1.00` | `1.00` | **WHOLE_PERCENT** (1.0 = 1%) | `adj.service.ts:2329`: `parseFloat(v).toFixed(4)` → `1.000` — NO ÷100 | ⚠ UNIT_DRIFT: if used, would be 100% (but currently only surfaced for display, not computed) |
| `management_fee_pct` | `3.00` | `3.00` | **WHOLE_PERCENT** | Not read by composer — seeder derives from `t12_mgmt_fee / t12_egi` | ✓ MATH_OK (column not consumed) |
| `replacement_reserves_per_unit` | `250.00` | `250.00` | **$/unit/yr** | Projections Y1 fallback uses hardcoded `350`, not this column (`adj.service.ts:3392`) | ⚠ UNIT_DRIFT: column unused in fallback |
| `opex_ratio` | `35.00` | `35.00` | **WHOLE_PERCENT** | Not consumed by composer | N/A |
| `vacancy_pct` | `19.83` | `17.43` | **WHOLE_PERCENT** | Not read by composer (overridden by year1 JSONB value) | ✓ MATH_OK (column not consumed) |
| `disposition_cost_pct` | `2.00` | `2.00` | **WHOLE_PERCENT** | Not consumed — selling_costs_pct in `deal_assumptions` is separate | N/A |
| `developer_fee_pct` | `4.00` | `4.00` | **WHOLE_PERCENT** | Greenfield path only | N/A |
| `soft_cost_pct` | `25.00` | `25.00` | **WHOLE_PERCENT** | Greenfield path only | N/A |
| `contingency_pct` | `5.00` | `5.00` | **WHOLE_PERCENT** | Greenfield path only | N/A |
| `debt_yield_min` | null | null | ZERO_OR_NULL | Not consumed by composer | N/A |
| `hold_period_years` | `5` | `5` | **INTEGER** | `adj.service.ts`: `assumptionsRow.hold_period_years ?? 5` | ✓ MATH_OK |
| `selling_costs_pct` | null | null | ZERO_OR_NULL | `adj.service.ts:2211`: `parseFloat(v).toFixed(4)` → null → defaults to 0.02 | ✓ MATH_OK |
| `target_irr` | null | null | ZERO_OR_NULL | Display only | N/A |
| `target_em` | null | null | ZERO_OR_NULL | Display only | N/A |
| `io_period_months` | `36` | `36` | **INTEGER (months)** | `adj.service.ts:2326`: used directly | ✓ MATH_OK |
| `amortization_years` | `30` | `30` | **INTEGER** | `adj.service.ts:2327` | ✓ MATH_OK |

### C2. `proforma_assumptions` Field Inventory

Only Bishop has a `proforma_assumptions` row. Sentosa has no row → defaults used.

| Field | Bishop stored | Convention | Consumer | ÷100? | Used correctly? |
|---|---|---|---|---|---|
| `opex_growth_current` | `2.800` | **WHOLE_PERCENT** (2.8 = 2.8%) | `adj.service.ts:2130–2132`: `parseFloat(v).toFixed(3)` → `2.800` | ❌ No | ⚠ UNIT_DRIFT: `opexGrowthRate = 2.800` used as 280% in Y2+ OpEx compounding |
| `opex_growth_baseline` | `2.800` | **WHOLE_PERCENT** | Not consumed by composer | N/A | N/A |
| `rent_growth_current` | `3.500` | **WHOLE_PERCENT** | `adj.service.ts:2113`: `parseFloat(v) / 100` → `0.035` | ✅ Yes | ✓ MATH_OK |
| `rent_growth_baseline` | `3.500` | **WHOLE_PERCENT** | Not consumed | N/A | N/A |
| `vacancy_current` | `5.00` | **WHOLE_PERCENT** | `adj.service.ts:2112`: `parseFloat(v) / 100` → `0.0500` | ✅ Yes | ✓ MATH_OK |
| `exit_cap_current` | `5.500` | **WHOLE_PERCENT** | `adj.service.ts:2114`: `parseFloat(v) / 100` → `0.0550` | ✅ Yes | ✓ MATH_OK |

**Normalization inconsistency:** `opex_growth_current` is the only `proforma_assumptions` field read WITHOUT `/ 100`. All other fields in this table use `/ 100`. This is the root cause of the 280%/yr OpEx growth bug (see UNIT-01).

### C3. `deal_assumptions.year1` JSONB — Pct Fields (Resolved)

All resolved values in the year1 JSONB use **DECIMAL** convention (0.025 = 2.5%). These are read via `ry1(k) = resolvedNum(lv(year1Seed, k))` which accesses `.resolved` directly — no scaling applied or needed.

| Field | Bishop resolved | Sentosa resolved | Tag |
|---|---|---|---|
| `vacancy_pct` | 0.19828 (19.83%) | 0.17434 (17.43%) | ✓ MATH_OK |
| `loss_to_lease_pct` | 0.00350 (0.35%) | 0 | ✓ MATH_OK |
| `concessions_pct` | 0.07780 (7.78%) | 0.00823 (0.82%) | ✓ MATH_OK |
| `bad_debt_pct` | 0.03342 (3.34%) | 0.02623 (2.62%) | ✓ MATH_OK |
| `non_revenue_units_pct` | 0 | 0 | ✓ MATH_OK |
| `management_fee_pct` | 0.025 (2.5%) | 0.04047 (4.047%) | ✓ MATH_OK |
| `other_income_per_unit` | 904.14 (stale — annual, not monthly) | 96.15 (monthly/unit) | ⚠ STALE_CACHE (Bishop) |

---

## Phase 0d — Regression Checks

### REG-1: S1-01 — No residual non-opex items in `custom_opex_*`

**Query:**
```sql
SELECT deal_id, key, (year1->key->>'resolved')::numeric AS resolved_val
FROM deal_assumptions, jsonb_object_keys(year1) AS key
WHERE deal_id IN ('3f32276f-…','3d96f62d-…')
AND key LIKE 'custom_opex_%'
AND (key ILIKE '%loan%' OR key ILIKE '%interest%' OR key ILIKE '%capital_expense%' OR key ILIKE '%mtm%')
ORDER BY deal_id, key;
```

**Result:**
```
deal_id                              key                                                          resolved_val
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_500020_capital_expenses_major_appliance_replacem       726
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_500040_capital_expenses_office_start_up              1,540
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_500045_capital_expenses_major_building_repairs       2,885
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_500055_capital_expenses_clubhouse_model_office_v    13,573
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_500105_capital_expenses_maintenance_equipment        1,180
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_500130_capital_expenses_construction_expense           900
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_500135_capital_expenses_web_design_collateral_st      -245
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_909006_loan_servicing_fee                            8,926
3d96f62d-d986-448f-8ea4-10853021a8cb  custom_opex_909007_interest_rate_cap_mtm_adjustment            684,953
```

| Deal | Verdict | Non-opex total | Detail |
|---|---|---|---|
| 464 Bishop | ✅ PASS | $0 | No financing or CapEx items found in custom_opex |
| Sentosa Epperson | ❌ FAIL | **$714,437** | `loan_servicing_fee` ($8,926) + `interest_rate_cap_mtm` ($684,953) are below-the-line financing items. 7 `capital_expenses_*` items ($20,559) are CapEx, not recurring OpEx |

**Root cause:** Sentosa was seeded before S1-01's `isExcludedFromOpex` filter was applied (or the filter's regex patterns do not match numeric GL account prefixes `909xxx` / `500xxx`). A `forceReseed` after verifying the filter covers these labels will resolve it.

---

### REG-2: Projections Y1 reserves = ProForma reserves override

**Query:**
```sql
SELECT deal_id,
  year1->'replacement_reserves'->>'resolved' AS reserves_resolved,
  year1->'replacement_reserves'->>'resolution' AS reserves_resolution,
  year1->'replacement_reserves'->>'override' AS reserves_override,
  total_units
FROM deal_assumptions WHERE deal_id IN ('3f32276f-…','3d96f62d-…');
```

**Result:**
```
deal_id             reserves_resolved  reserves_resolution  reserves_override  total_units
3f32276f (Bishop)   58000              override             58000              232
3d96f62d (Sentosa)  (null)             platform_fallback    (null)             304
```

**Projections Y1 reserves** (adj.service.ts:3392):
```ts
const reservesY1 = ry1('replacement_reserves') || (totalUnits * 350);
```
- Bishop: `ry1('replacement_reserves') = $58,000` → projections Y1 = $58,000 ✓ **matches override**
- Sentosa: `ry1('replacement_reserves') = null` → fallback = `304 × 350 = $106,400` — **not in ProForma**

| Deal | ProForma reserves | Projections Y1 reserves | Verdict |
|---|---|---|---|
| 464 Bishop | $58,000 (override flows through) | $58,000 | ✅ PASS |
| Sentosa Epperson | null (no reserves seeded) | $106,400 (hardcoded fallback) | ⚠ DIVERGENCE — not FAIL but documented |

---

### REG-3: `deals.budget` = `deal_data.purchase_price` (dual-write parity)

**Query:**
```sql
SELECT id, name, budget::text AS budget,
  (deal_data->>'purchase_price') AS dd_purchase_price,
  CASE WHEN budget IS NULL AND (deal_data->>'purchase_price') IS NULL THEN 'BOTH_NULL_N/A'
       WHEN budget::text = (deal_data->>'purchase_price') THEN 'MATCH'
       ELSE 'MISMATCH' END AS check_result
FROM deals WHERE id IN ('3f32276f-…','3d96f62d-…');
```

**Result:**
```
id             name              budget  dd_purchase_price  check_result
3f32276f-…    464 Bishop         (null)  (null)             BOTH_NULL_N/A
3d96f62d-…    Sentosa Epperson   (null)  (null)             BOTH_NULL_N/A
```

| Deal | Verdict | Detail |
|---|---|---|
| 464 Bishop | N/A | No purchase price configured — dual-write regression not testable on this deal |
| Sentosa Epperson | N/A | Same — no purchase price configured |

Reference: SHIPPED_WORK_VERIFICATION.md Close-out 2 confirmed dual-write PASS on "Highlands at Satellite" deal which has a real budget.

---

## Section 8 — Findings Inventory

| ID | Phase | Priority | Severity | Deal | Fix | Summary |
|---|---|---|---|---|---|---|
| **MATH-01** | 0a/0b | P1 | High | Both | FIX-05 | Bad debt applied to **GPR** in `toDollarRow` display row and Projections IIFE (`adj.service.ts:3453`), but to **(NRI + OtherIncome)** in seeder (`seeder.ts:672`). Display and Projections overstate bad debt deduction by applying it against a larger base (GPR vs effective income). Bishop: +$38,792 excess bad debt in Projections Y1. Sentosa: +$21,935. |
| **MATH-02** | 0a/0b | P0 | Critical | Bishop | FIX-01 | `other_income_per_unit.resolved = 904.14` is a **stale annual-per-unit** value from a pre-`÷12` seed. Current seeder stores monthly per unit (confirmed: `seeder.ts:319` `months=12`; `seeder.ts:668–669`). Projections applies `× units × 12`, inflating Bishop Y1 OtherIncome 12× ($2,517,126 vs ~$210,031 seeded). Drives +$1,223,710 gap in Y1 NOI between ProForma and Projections tabs. Fix: `forceReseed` Bishop. |
| **MATH-03** | 0b | P2 | Medium | Both | FIX-06 | Replacement reserves **excluded** from seeder `total_opex_resolved` (`seeder.ts:685–690`) but **included** in Projections `totalOpex` (`adj.service.ts:3506`). ProForma NOI is pre-reserves; Projections NOI deducts reserves. Bishop: $58,000 gap. Sentosa: $106,400 gap from fallback. |
| **MATH-04** | 0a | P3 | Medium | Both | FIX-08/09 | Amenities ($7,330 Bishop / $2,462 Sentosa) are in seeder `total_opex_resolved` but **absent from OPEX_FIELDS** (`adj.service.ts:1844–1858`) and absent from Projections `totalOpex`. These amounts are correctly captured in seeder NOI but invisible in the Pro Forma display and not carried forward in Projections Y2+. |
| **MATH-05** | 0b | P2 | Low | Both | FIX-07 | Projections hardcoded reserves fallback `totalUnits × 350` (`adj.service.ts:3392`) ignores `deal_assumptions.replacement_reserves_per_unit` ($250/unit for both deals) → Sentosa gets $106,400 instead of $76,000 (+$30,400 over-deduction). |
| **RECON-01** | 0b | P0 | Critical | Bishop | FIX-01 | Y1 NOI: ProForma = $486,108 vs Projections = $1,709,818 (confirmed) → **+$1,223,710 gap**. Primary cause: MATH-02 (OI inflation $2,307,095). Secondary: mgmt fee recalc on inflated EGI, MATH-03 reserves. |
| **RECON-02** | 0b | P0 | High | Sentosa | FIX-02 | Y1 NOI: ProForma = $1,051,906 vs Projections (estimated from code inspection) → gap driven by: REG-01 ($714,438 non-opex excluded from Projections, raises Proj NOI) and MATH-03 ($106,400 reserves added to Projections, lowers Proj NOI). Net direction: Projections NOI substantially higher than seeded. Exact probe needed post-reseed. |
| **RECON-03** | 0b | P1 | Medium | Both | FIX-05 | Bad debt base divergence between ProForma (% of NRI+OI) and Projections (% of GPR) creates a persistent EGI gap even after other issues are resolved. Bishop: −$38,792 Projections EGI vs ProForma. Sentosa: −$21,935. |
| **UNIT-01** | 0c | P1 | High | Bishop | FIX-03 | `proforma_assumptions.opex_growth_current = 2.800` read at `adj.service.ts:2131` **without ÷100** → `opexGrowthRate = 2.800` (280%). Projections Y2+ OpEx compounds at 280%/yr. Y1 unaffected (growth step = 0). All other `proforma_assumptions` calibrated fields correctly use `÷100` (lines 2112–2114). |
| **UNIT-02** | 0c | P1 | High | Both | FIX-04 | `deal_assumptions.rent_growth_yr1 = 3.00` and `rent_growth_stabilized = 2.50` read at `adj.service.ts:2125–2126` **without ÷100** → 300% Y1 rent growth / 250% stabilized. Projections Y2+ GPR compounds at 300%/yr → parabolic NOI visible in Projections tab. Y1 unaffected. |
| **UNIT-03** | 0c | P3 | Low | Both | — | `deal_assumptions.origination_fee_pct = 1.00` stored as whole-percent. Only surfaced to `capitalStack.originationFeePct` for display; not used in any computation today — no current impact but would produce 100% fee if a computation were added. |
| **UNIT-04** | 0c | P2 | Low | Both | FIX-07 | `deal_assumptions.replacement_reserves_per_unit = 250` exists but is not consumed by Projections reserves fallback (which uses hardcoded 350). Dead column for acquisition deals. |
| **REG-01** | 0d | P0 | High | Sentosa | FIX-02 | S1-01 `isExcludedFromOpex` filter did not remove 9 items from Sentosa: `interest_rate_cap_mtm_adjustment` ($684,953), `loan_servicing_fee` ($8,926), and 7 `capital_expenses_*` items ($20,559 total). Total non-opex in seeder OpEx: **$714,438**. Suppresses seeded NOI by same amount. |
| **REG-02** | 0d | Info | Info | Sentosa | MATH-03/05 | Projections Y1 reserves diverge from ProForma: $106,400 (fallback) vs null (seeder). Not a regression — pre-existing structural gap documented under MATH-03 and MATH-05. |
| **REG-03** | 0d | N/A | N/A | Both | — | Budget dual-write parity: both deals have no purchase price; regression N/A. Confirmed working on live deal in prior probe (SHIPPED_WORK_VERIFICATION.md §Close-out 2). |

---

## Section 9 — Recommended Phase 1 Fixes

| Priority | ID | Findings | Fix | Effort | Files |
|---|---|---|---|---|---|
| **P0** | FIX-01 | RECON-01, MATH-02 | `forceReseed` 464 Bishop. The current seeder stores monthly OI per unit correctly — re-seeding will write `~$75.5/unit/mo` and eliminate the 12× inflation in Projections Y1. | S | Run `ensureDealAssumptionsSeeded(pool, '3f32276f-…', { forceReseed: true })` |
| **P0** | FIX-02 | REG-01, RECON-02 | Verify `isExcludedFromOpex` (`seeder.ts:~557`) regex patterns cover numeric GL prefixes (`909xxx` → loan/interest, `500xxx` → capital_expenses). Extend patterns if missing, then `forceReseed` Sentosa. | S | `backend/src/services/proforma-seeder.service.ts` ~line 557 |
| **P1** | FIX-03 | UNIT-01 | Add `/ 100` at `adj.service.ts:2131` for `opexGrowthRate`. Pattern: mirror lines 2112–2114 which already apply `/ 100`. | S | `backend/src/services/proforma-adjustment.service.ts:2131` |
| **P1** | FIX-04 | UNIT-02 | Add `/ 100` at `adj.service.ts:2125–2126` for `rentGrowthYr1` and `rentGrowthStab`. Consistent with calibrated fields at lines 2112–2114. | S | `backend/src/services/proforma-adjustment.service.ts:2125–2126` |
| **P1** | FIX-05 | MATH-01, RECON-03 | Standardize bad debt base to (NRI + OtherIncome) in Projections IIFE (`adj.service.ts:3449–3463`). Move `badDebt = round((nri_before_bd + otherIncome) × badDebtPct)` and remove from NRI subtraction. Align with NCREIF convention used in seeder. | M | `backend/src/services/proforma-adjustment.service.ts:3449–3463`; also update `toDollarRow` multiplier at line 1964 from GPR to EGI |
| **P2** | FIX-06 | MATH-03 | Add `(replacementReserves.resolved ?? 0)` to seeder `total_opex_resolved` sum (`seeder.ts:685–690`). ProForma NOI will then include reserves deduction and match Projections Y1. Update ProFormaSummaryTab to remove separate `noiAfterReserves` calculation since NOI itself will be post-reserves. | M | `backend/src/services/proforma-seeder.service.ts:685–712` |
| **P2** | FIX-07 | MATH-05, UNIT-04 | Projections reserves fallback (`adj.service.ts:3392`): replace `totalUnits * 350` with `ry1('replacement_reserves') || (assumptionsRow?.replacement_reserves_per_unit ?? 350) * totalUnits`. Eliminates hardcoded platform assumption. | S | `backend/src/services/proforma-adjustment.service.ts:3392` |
| **P3** | FIX-08 | MATH-04 | Add amenities (and office/hoa_dues/personal_prop_tax if non-zero) to Projections IIFE `totalOpex` sum. Seed as `ry1('amenities')` with `opexGrowthStep` compounding for Y2+. | M | `backend/src/services/proforma-adjustment.service.ts:3383–3506` |
| **P3** | FIX-09 | MATH-04 | Add `amenities` to `OPEX_FIELDS` array (`adj.service.ts:1844–1858`) and `NCTRL_OPEX_FIELDS` filter in ProFormaSummaryTab so it renders as a visible line item. | S | `backend/src/services/proforma-adjustment.service.ts:1844`; `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` |
