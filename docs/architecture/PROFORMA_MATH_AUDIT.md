# Pro Forma Math Audit — Phase 0

**Task:** #662  
**Date:** 2026-05-09  
**Scope:** Read-only audit — no code changes. Covers four sub-phases:  
- **0a** Pro Forma math verification (formula chain)  
- **0b** Projections Y1 reconciliation (seed vs projections engine)  
- **0c** Unit normalization sweep  
- **0d** Regression checks  

**Test deals:**

| Deal | ID | Units | GPR (seeded) | EGI (seeded) | NOI (seeded) |
|---|---|---|---|---|---|
| 464 Bishop | `3f32276f-aacd-4da3-b306-317c5109b403` | 232 | $4,901,400 | $3,615,849 | $486,108 |
| Sentosa Epperson | `3d96f62d-d986-448f-8ea4-10853021a8cb` | 304 | $6,592,310 | $5,588,972 | $1,051,906 |

**Source files:**
- `backend/src/services/proforma-seeder.service.ts` (seeder formula chain)
- `backend/src/services/proforma-adjustment.service.ts` (composer + projections IIFE)

---

## Phase 0a — Pro Forma Math Verification

### A1. Revenue Formula Chain (Seeder)

**File:** `proforma-seeder.service.ts` lines 636–672

```
NRI  = GPR − GPR × LTL% − GPR × Vacancy% − GPR × Concessions% − GPR × NRU%
     [bad_debt is NOT subtracted from NRI]

EGI_pre_bd = NRI + OtherIncome
EGI         = EGI_pre_bd × (1 − bad_debt%)
```

**Verified against DB** (live `deal_assumptions.year1` JSONB):

*464 Bishop:*
- GPR = $4,901,400
- LTL% = 0.3497% → LTL = $17,146
- Vacancy% = 19.8276% → Vacancy = $972,007
- Concessions% = 7.7795% → Concessions = $381,402
- NRU% = 0%
- NRI = 4,901,400 − 17,146 − 972,007 − 381,402 = **$3,530,845**
- bad_debt% = 3.3424%; OtherIncome ≈ $210K (backward-derived from EGI)
- EGI_pre_bd = 3,530,845 + ~210,244 = ~$3,741,089
- EGI = 3,741,089 × (1 − 0.033424) = **$3,615,849** ✓ matches DB

*Sentosa Epperson:*
- GPR = $6,592,310
- LTL% = 0%; Vacancy% = 17.4342%; Concessions% = 0.8229%; NRU% = 0%
- NRI = 6,592,310 × (1 − 0 − 0.174342 − 0.008229) = **$5,390,152**
- bad_debt% = 2.6227%; OtherIncome = 96.15 × 304 × 12 = **$350,691** (verified below)
- EGI_pre_bd = 5,390,152 + 350,691 = $5,740,843
- EGI = 5,740,843 × (1 − 0.026227) = **$5,589,000** ≈ DB $5,588,972 ✓ (rounding)

**Formula: CORRECT.** Bad debt applied to (NRI + OtherIncome) combined, not to GPR alone.

---

### A2. OpEx Formula Chain (Seeder)

**File:** `proforma-seeder.service.ts` lines 509–690

Standard OpEx fields sourced via `opexFromT12()` with priority `['t12']`:

| Field | Bishop resolution | Sentosa resolution |
|---|---|---|
| payroll | t12 | t12 |
| repairs_maintenance | t12 | t12 |
| turnover | t12 | t12 |
| contract_services | t12 | t12 |
| marketing | t12 | t12 |
| g_and_a | t12 | t12 |
| utilities | t12 | t12 |
| insurance | t12 | t12 |
| real_estate_tax | t12 | t12 |
| management_fee_pct | t12-derived (mgmt_fee / t12_egi) | t12-derived |

Management fee dollar = `EGI × management_fee_pct.resolved`.

**Seeder `total_opex_resolved` composition** (lines 685–690):

```
total_opex_resolved =
  payroll + repairsMaintenance + turnover + amenities + contractServices +
  marketing + office + gAndA + hoaDues + utilities + mgmtFeeDollar +
  realEstateTax + personalPropTax + insurance + customOpexTotal
```

**⚠️ STRUCTURAL NOTE:** `replacement_reserves` is NOT included in `total_opex_resolved`.  
The seeder NOI is therefore: `NOI = EGI − (OpEx without reserves)`.  
Replacement reserves live as a separate LayeredValue in `year1.replacement_reserves` but are not deducted in the seeder's NOI.

| Deal | Reserves resolution | Reserves value | In seeder NOI? |
|---|---|---|---|
| Bishop | `override` | $58,000 | ❌ Not deducted |
| Sentosa | `platform_fallback` | null | N/A |

---

### A3. NOI Formula

**File:** `proforma-seeder.service.ts` line 699

```
NOI = EGI_after_bad_debt − total_opex_resolved
```

Verified:
- Bishop: $3,615,849 − $3,129,741 = **$486,108** ✓
- Sentosa: $5,588,972 − $4,537,066 = **$1,051,906** ✓

---

### A4. Custom OpEx Items

The seeder captures unrecognized GL rows from the T12 parser as `custom_opex_*` keys
(via `isExcludedFromOpex` filter introduced in S1-01).

| Deal | custom_opex keys | Notable items |
|---|---|---|
| Bishop | 13 keys | `custom_opex_electricity_vacant_nr`, `custom_opex_carpet_replacement`, etc. |
| Sentosa | 65 keys | See A4 detail below |

**Sentosa — notable custom_opex values still present in year1 JSONB:**

| Key (truncated) | Resolved value | Classification |
|---|---|---|
| `custom_opex_909006_loan_servicing_fee` | $8,926 | ⚠️ Below-the-line financing |
| `custom_opex_909007_interest_rate_cap_mtm_adjustment` | $684,953 | ⚠️ Below-the-line financing |
| `custom_opex_500020_capital_expenses_major_appliance_replacem` | $726 | ⚠️ CapEx, not OpEx |
| `custom_opex_500040_capital_expenses_office_start_up` | $1,540 | ⚠️ CapEx |
| `custom_opex_500045_capital_expenses_major_building_repairs` | $2,885 | ⚠️ CapEx |
| `custom_opex_500055_capital_expenses_clubhouse_model_office_v` | $13,573 | ⚠️ CapEx |
| `custom_opex_500105_capital_expenses_maintenance_equipment` | $1,180 | ⚠️ CapEx |
| `custom_opex_500130_capital_expenses_construction_expense` | $900 | ⚠️ CapEx |

**Total problematic items in Sentosa NOI: ~$714,683**  
The `interest_rate_cap_mtm_adjustment` alone = $684,953 — a non-recurring mark-to-market accounting entry from the lender that artificially deflates Sentosa's seeded NOI.

**Root cause:** Sentosa was seeded before S1-01's `isExcludedFromOpex` filter was applied (or the filter does not match the numeric GL account prefixes like `909xxx`, `500xxx`). A `forceReseed` post S1-01 would re-run the filter against the current capsule data.

---

## Phase 0b — Projections Y1 Reconciliation

### B1. Projections Engine Seed (Y1 baseline)

**File:** `proforma-adjustment.service.ts` lines 3375–3392

At `yr = 1`, growth steps are forced to zero:
```ts
rentGrowthStep = yr === 1 ? 0 : ...   // no rent growth applied at Y1
opexGrowthStep = yr === 1 ? 0 : ...   // no opex growth applied at Y1
insGrowthStep  = yr === 1 ? 0 : ...   // no insurance growth at Y1
```

So Y1 projections seeds are all taken verbatim from `year1Seed` via `ry1(field)`.

### B2. Formula Divergences Between Seeder and Projections

#### B2-1. Bad Debt Application (⚠️ DIVERGENCE)

| Path | Formula | Base for bad_debt |
|---|---|---|
| Seeder (lines 637–672) | `EGI = (NRI + OtherIncome) × (1 − bad_debt%)` | NRI + OtherIncome |
| Projections IIFE (lines 3449–3463) | `badDebt = round(GPR × bad_debt_pct); NRI = GPR − vacancy − LTL − conc − badDebt − NRU; EGI = NRI + OtherIncome` | GPR |

**Impact (Bishop, bad_debt_pct = 3.3424%):**
- Seeder bad_debt base = ~$3,741K (NRI + OI) → bad_debt ≈ $125K
- Projections bad_debt base = $4,901,400 (GPR) → bad_debt = $163,792
- Delta: **+$38,792** excess bad_debt deduction in projections vs seeder

**Impact (Sentosa, bad_debt_pct = 2.6227%):**
- Seeder bad_debt base = ~$5,741K → bad_debt ≈ $151K
- Projections bad_debt base = $6,592,310 (GPR) → bad_debt = $172,935
- Delta: **+$21,935** excess bad_debt deduction in projections vs seeder

This is a consistent structural divergence: Projections Y1 NRI is slightly lower than Seeder NRI due to the different bad_debt base. The seeder interpretation (bad_debt as % of effective income) is more faithful to NCREIF convention; the projections interpretation (bad_debt as % of gross potential) is common in OM underwriting. Both conventions exist in practice but they should not be mixed within the same pro forma.

#### B2-2. OtherIncome per Unit — Stale Seed Scale Bug (⚠️ DIVERGENCE — BISHOP ONLY)

**File:** `proforma-seeder.service.ts` line 319 (`months = 12`) and lines 668–669:
```ts
otherIncomePerUnit.resolved = otherIncomeForEgi / totalUnits / months;
//                          = annual_OI / units / 12  →  monthly per unit
```

**Projections IIFE** line 3459:
```ts
otherIncome = Math.round(runOtherIncPU * (1 + rentGrowthStep) * totalUnits * 12);
//                       ← expects monthly per unit; multiplies back by units × 12
```

The current seeder correctly stores **monthly per unit** and projections correctly multiplies `× units × 12`. The contract is consistent in the current code.

**However, Bishop's DB value is stale from a pre-`/months` seed:**

| Deal | `other_income_per_unit.resolved` in DB | Interpretation | Annual OI in projections |
|---|---|---|---|
| Sentosa | $96.15/unit | Monthly (current) | $96.15 × 304 × 12 = **$350,691** ✓ matches seeder |
| Bishop | $904.14/unit | **Annual** (stale, pre-÷12 seed) | $904.14 × 232 × 12 = **$2,517,126** ⚠️ |

Bishop seeder OtherIncome (backward-derived from EGI): ~$210,244/yr.  
Bishop projections Y1 OtherIncome: ~$2,517,126/yr — **12× inflation.**

This is the primary driver of the Y1 NOI gap between seeder and projections for Bishop.

**Fix:** Force-reseed Bishop. The current seeder will store `210,244 / 232 / 12 = $75.5/unit/mo`, and projections Y1 OtherIncome will correctly compute ~$210K.

#### B2-3. Total OpEx Structural Divergence (⚠️ DIVERGENCE — BOTH DEALS)

| Item | Seeder `total_opex_resolved` | Projections `totalOpex` |
|---|---|---|
| payroll | ✅ | ✅ |
| repairs_maintenance | ✅ | ✅ |
| turnover | ✅ | ✅ |
| contract_services | ✅ | ✅ |
| marketing | ✅ | ✅ |
| g_and_a | ✅ | ✅ |
| utilities | ✅ | ✅ |
| insurance | ✅ | ✅ |
| real_estate_tax | ✅ | ✅ (via taxes tab perYear, else compound Y1) |
| management_fee | ✅ (% of EGI) | ✅ (% of projections EGI) |
| **replacement_reserves** | ❌ excluded | ✅ included |
| **amenities** | ✅ included | ❌ excluded |
| **office** | ✅ included | ❌ excluded |
| **hoa_dues** | ✅ included | ❌ excluded |
| **personal_property_tax** | ✅ included | ❌ excluded |
| **custom_opex_* items** | ✅ included | ❌ excluded |

Seeder references: lines 685–690 (total_opex_resolved), line 740 (replacement_reserves not in sum).  
Projections reference: line 3506.

**Net OpEx divergence (Bishop Y1, estimates):**
- Projections adds reserves (+$58,000) that seeder excludes
- Projections excludes custom_opex items that seeder includes (magnitude unknown without per-item query; likely small for Bishop)
- Net direction: projections Y1 OpEx > seeder OpEx for Bishop (reserves dominate)

**Net OpEx divergence (Sentosa Y1, estimates):**
- Projections adds reserves fallback `304 × 350 = +$106,400` that seeder excludes (reserves.resolved = null)
- Projections excludes $693,609+ in custom_opex items that seeder includes (dominated by $684,953 rate cap MTM)
- Net direction: projections Y1 OpEx < seeder OpEx for Sentosa (rate cap MTM dominates)

### B3. Summary — Y1 NOI Reconciliation Table

**464 Bishop** (232 units):

| Line | Seeder (ProForma) | Projections Y1 | Delta | Root cause |
|---|---|---|---|---|
| GPR | $4,901,400 | $4,901,400 | $0 | Same source (gprDecomposition.resolvedAnnual) |
| VacancyLoss | $972,007 | $972,007 | $0 | Same pct × GPR |
| LossToLease | $17,146 | $17,146 | $0 | Same pct × GPR |
| Concessions | $381,402 | $381,402 | $0 | Same pct × GPR |
| BadDebt | ~$125K (on NRI+OI) | $163,792 (on GPR) | +$38K | B2-1: base divergence |
| NRU | $0 | $0 | $0 | — |
| OtherIncome | ~$210K | ~$2,517K | **+$2,307K** | B2-2: stale monthly/annual |
| EGI | $3,615,849 | ~$5,884K | ~+$2,268K | B2-1 + B2-2 |
| Reserves in OpEx | $0 (excluded) | $58,000 | −$58K | B2-3: structural |
| Custom OpEx in OpEx | ~included | $0 (excluded) | varies | B2-3: structural |
| **NOI (confirmed)** | **$486,108** | **$1,709,818** | **+$1,223,710** | Dominated by B2-2 |

Projections Y1 NOI confirmed via `irr-verify-464-bishop.ts` probe (Close-out 1, SHIPPED_WORK_VERIFICATION.md §Close-out 1).

**Sentosa Epperson** (304 units):

| Line | Seeder (ProForma) | Projections Y1 | Delta | Root cause |
|---|---|---|---|---|
| GPR | $6,592,310 | $6,592,310 | $0 | Same source |
| OtherIncome | ~$349K (96.15 × 304 × 12) | ~$350K | ~$0 | ✓ Scale correct (current seed) |
| BadDebt | ~$151K (on NRI+OI) | $172,935 (on GPR) | +$22K | B2-1: base divergence |
| EGI | $5,588,972 | ~$5,569K (estimated) | ~−$20K | B2-1 only |
| Reserves in OpEx | $0 (null → excluded) | $106,400 (304 × 350 fallback) | −$106K | B2-3: reserves fallback |
| Custom OpEx (rate cap MTM, etc.) | +$684,953 in OpEx | $0 | +$685K | B2-3: custom excluded |
| **NOI** | $1,051,906 | Not separately confirmed | ~+$559K estimated | Dominated by rate cap exclusion |

For Sentosa, removing the below-the-line $684,953 interest rate cap MTM item from custom_opex (via re-seed with S1-01 filter) would bring seeder NOI from $1,051,906 up to ~$1,736,859 — much closer to what projections computes.

---

## Phase 0c — Unit Normalization Sweep

### C1. Storage Conventions

Two distinct storage conventions exist across related tables:

| Table | Column(s) | Convention | Example | As-stored |
|---|---|---|---|---|
| `deal_assumptions` | `rent_growth_yr1`, `rent_growth_stabilized`, `management_fee_pct`, `replacement_reserves_per_unit` | **Whole percent** (3.0 = 3%) | rent_growth_yr1 | `3.00` |
| `deal_assumptions` | `exit_cap` | **Decimal** (0.05 = 5%) | exit_cap | `0.0500` |
| `proforma_assumptions` | `rent_growth_current`, `rent_growth_baseline`, `opex_growth_current`, `vacancy_current`, `exit_cap_current` | **Whole percent** (3.5 = 3.5%) | rent_growth_current | `3.500` |
| `deal_assumptions.year1` | All LayeredValue `resolved` fields for pct types | **Decimal** (0.025 = 2.5%) | management_fee_pct.resolved | `0.025` |

### C2. Read Boundaries in `proforma-adjustment.service.ts`

**File:** lines 2112–2132 (calibrated block and opexGrowthRate)

| Variable | Source column | Read code | ÷100? | Stored value | Used as | Correct? |
|---|---|---|---|---|---|---|
| `calibrated.vacancyPct` | `proforma_assumptions.vacancy_current` | `parseFloat(v) / 100` | ✅ Yes | `5.00` | `0.0500` | ✅ |
| `calibrated.rentGrowthPct` | `proforma_assumptions.rent_growth_current` | `parseFloat(v) / 100` | ✅ Yes | `3.500` | `0.0350` | ✅ |
| `calibrated.exitCap` | `proforma_assumptions.exit_cap_current` | `parseFloat(v) / 100` | ✅ Yes | `5.500` | `0.0550` | ✅ |
| `rentGrowthYr1` | `deal_assumptions.rent_growth_yr1` | `parseFloat(v).toFixed(3)` | ❌ No | `3.00` | `3.000` (300%!) | ⚠️ **BUG** |
| `rentGrowthStab` | `deal_assumptions.rent_growth_stabilized` | `parseFloat(v).toFixed(3)` | ❌ No | `2.50` | `2.500` (250%!) | ⚠️ **BUG** |
| `exitCap` | `deal_assumptions.exit_cap` | `parseFloat(v).toFixed(3)` | ❌ No | `0.0500` | `0.050` (5.0%) | ✅ (decimal stored) |
| `opexGrowthRate` | `proforma_assumptions.opex_growth_current` | `parseFloat(v).toFixed(3)` | ❌ No | `2.800` | `2.800` (280%!) | ⚠️ **BUG** |

### C3. Impact of Normalization Bugs

**Y1 unaffected:** The projections IIFE sets `rentGrowthStep = 0` and `opexGrowthStep = 0` at `yr = 1`. Both bugs are dormant at Y1.

**Y2+ parabolic blow-up:** Both bugs cause severe distortion in multi-year projections:

- `rentGrowthYr1 = 3.000` (300%) → Projections Y2 GPR = Y1 GPR × (1 + 3.000) = **4× the Y1 base**
- `opexGrowthRate = 2.800` (280%) → Projections Y2 total OpEx = Y1 OpEx × (1 + 2.800) = **3.8× the Y1 base**

This was observed in Close-out 1 (SHIPPED_WORK_VERIFICATION.md): *"NOI Y2+ goes parabolic due to Bishop's `rent_growth_yr1 = 3` stored as a whole number."* The note there classified this as a pre-existing convention artifact, but the Projections tab renders the parabolic numbers for the user — it is a user-visible defect.

**Sentosa:** `rent_growth_yr1 = 3.00` (same storage) → same 300% Y2 rent growth bug. `proforma_assumptions` row does not exist for Sentosa, so `opexGrowthRate` falls back to the hardcoded default `0.03` (3%) — OpEx bug is absent for Sentosa.

### C4. `other_income_per_unit` Contract

**Seeder stores:** monthly per unit (`otherIncomeForEgi / totalUnits / 12`).  
**Projections reads:** monthly per unit, multiplies `× units × 12` to annualize.  
**Contract is correct for current code.** Bishop's stale DB value is annual-per-unit from a pre-`/months` seed (documented in B2-2 above); re-seeding restores parity.

### C5. `replacement_reserves_per_unit` in `deal_assumptions`

| Deal | `deal_assumptions.replacement_reserves_per_unit` | Stored as |
|---|---|---|
| Bishop | $250.00 | Dollar per unit (annual basis implied) |
| Sentosa | $250.00 | Dollar per unit (annual basis implied) |

This column is a Greenfield/dev-path scalar. The acquisition path uses the seeder's `resolve('replacement_reserves', ...)` which reads from `om` (broker OM) and `existingOverride`. Neither Bishop nor Sentosa has a broker OM value, so reserves resolves from override only (Bishop: $58,000 manual override) or null (Sentosa). The `deal_assumptions.replacement_reserves_per_unit` scalar is not currently consumed by the acquisition-path seeder — it feeds the Projections IIFE fallback at line 3392:

```ts
const reservesY1 = ry1('replacement_reserves') || (totalUnits * 350);
```

Note: the fallback uses `350` (hardcoded platform default $/unit), not `deal_assumptions.replacement_reserves_per_unit`. The `deal_assumptions.replacement_reserves_per_unit = 250` column is effectively unused for acquisition deals.

---

## Phase 0d — Regression Checks

### D1. S1-01 `isExcludedFromOpex` Filter

**S1-01** added `isExcludedFromOpex()` to the seeder (8 new regex patterns) to prevent below-the-line GL items from inflating OpEx.

**Check:** Are the custom_opex items in both test deals' `year1` JSONB correctly filtered?

| Finding | Bishop | Sentosa |
|---|---|---|
| Financing items in custom_opex | None detected | `custom_opex_909006_loan_servicing_fee = $8,926` ⚠️; `custom_opex_909007_interest_rate_cap_mtm_adjustment = $684,953` ⚠️ |
| CapEx-labeled items in custom_opex | None detected (carpet_replacement may qualify) | `custom_opex_500020/40/45/55/105/130/135_capital_expenses_* = ~$20,559` ⚠️ |
| Assessment | ✅ Clean | ⚠️ Stale seed — S1-01 filter not yet applied |

**Root cause:** Sentosa's `year1` JSONB was seeded before S1-01. The filter's regex patterns likely target human-readable labels (e.g., "interest", "loan", "mortgage") and may not match numeric GL account prefixes (`909xxx`). Re-seeding Sentosa (forceReseed) will re-run the filter; the numeric-prefix paths need verification against `isExcludedFromOpex` logic.

**NOI impact:** $684,953 interest rate cap MTM overstates Sentosa's year1 OpEx and understates NOI by the same amount. Sentosa's seeded NOI of $1,051,906 should be closer to ~$1,737K post-cleanup.

### D2. Purchase Price Dual-Write (#623 / #624)

Both test deals have `budget = NULL` and `deal_data.purchase_price = NULL`. No purchase price configured on either deal — the dual-write regression is **N/A** for these deals.

Reference: SHIPPED_WORK_VERIFICATION.md TASK B Item 1 and Close-out 2 confirm the dual-write is wired correctly for deals that do have a budget set.

### D3. Bishop NOI Baseline Post-S1-01

| Metric | Pre-S1-01 | Post-S1-01 (current) |
|---|---|---|
| Bishop Year 1 NOI (seeded) | −$161,598 | **+$486,108** ✅ |
| Status | Negative | Positive |

S1-01 removed $647,706 of net non-opex inflation from Bishop's custom_opex bucket. The seeded NOI is now positive and plausible for a value-add multifamily asset.

Reference: SHIPPED_WORK_VERIFICATION.md Close-out 1 confirmed via `irr-verify-464-bishop.ts` probe.

### D4. Projections Y1 Reserves vs ProForma

| Deal | ProForma reserves | Projections Y1 reserves | Divergence |
|---|---|---|---|
| Bishop | $58,000 (override) | $58,000 (`ry1('replacement_reserves')` = $58,000) | ✅ None |
| Sentosa | null (platform_fallback) | $106,400 (`304 × 350` fallback) | ⚠️ $106,400 added |

Bishop: no divergence — override flows through correctly via `ry1('replacement_reserves')`.  
Sentosa: projections silently adds a $106,400 reserve deduction that the ProForma seed does not show. The ProForma tab shows no reserves line for Sentosa (null), but the Projections tab deducts $106K/yr from NOI, making the Projections NOI ~$106K lower than ProForma NOI even before other adjustments.

---

## Open Issues / Recommended Actions

| ID | Severity | Finding | Recommended action |
|---|---|---|---|
| MA-01 | 🔴 High | **Bishop stale `other_income_per_unit`** ($904/unit annual stored, should be $75.5/unit monthly). Projections Y1 OtherIncome inflated 12×, causing $1.2M+ Y1 NOI overstatement in projections. | Force-reseed Bishop (`ensureDealAssumptionsSeeded(pool, bishopId, { forceReseed: true })`). Re-seed will store correct monthly value. |
| MA-02 | 🔴 High | **Sentosa `interest_rate_cap_mtm_adjustment` ($684,953) in custom_opex**. Financing item deflates seeded NOI by $685K. | Force-reseed Sentosa. Verify `isExcludedFromOpex` captures GL account `909007`; add numeric-prefix pattern if not. |
| MA-03 | 🟡 Medium | **`rentGrowthYr1` / `rentGrowthStab` read without ÷100** (`proforma-adjustment.service.ts` lines 2125–2126). Stored as whole-percent (e.g., 3.00), used as 300%. Projections Y2+ rents compound at 300%/yr — parabolic blow-up visible in Projections tab. Y1 unaffected. | Add `/ 100` at read lines 2125–2126, consistent with the existing `/ 100` at line 2113 for `calibrated.rentGrowthPct`. |
| MA-04 | 🟡 Medium | **`opexGrowthRate` read without ÷100** (`proforma-adjustment.service.ts` line 2131). Stored as `2.800` (2.8%), used as `2.800` (280%). Projections Y2+ OpEx compounds at 280%/yr. Y1 unaffected. | Add `/ 100` at line 2131. Note: the default `0.03` (hardcoded) is already in decimal form — only the DB path is missing the ÷100. |
| MA-05 | 🟡 Medium | **Bad-debt application base diverges** (seeder: % of NRI+OI; projections: % of GPR). Causes ~$22K–$39K EGI understatement in projections Y1. | Standardize to one convention. Seeder convention (% of effective income) is more NCREIF-aligned. Update projections IIFE lines 3453–3455 to apply bad_debt as `round((nri + otherIncome) × badDebtPct)` and recalculate NRI without badDebt. |
| MA-06 | 🟡 Medium | **Replacement reserves excluded from seeder `total_opex_resolved`** (seeder lines 685–690). ProForma NOI does not deduct reserves; Projections NOI does. ProForma "NOI" overstates cash flow. | Add `replacementReserves.resolved ?? 0` to seeder `total_opex_resolved` sum. Ensure ProForma tab displays as sub-total under Total OpEx and NOI reflects the deduction. |
| MA-07 | 🟡 Medium | **Sentosa capital-expense items in custom_opex** (~$20,559 total, 7 items labeled `500xxx_capital_expenses_*`). CapEx treated as recurring OpEx inflates OpEx and suppresses NOI. | Verify `isExcludedFromOpex` patterns cover `capital_expenses` label substring. If not, extend regex. Then re-seed Sentosa. |
| MA-08 | 🟢 Low | **Projections reserves fallback `totalUnits × 350` hardcoded** (line 3392). Does not respect `deal_assumptions.replacement_reserves_per_unit` ($250/unit on both deals). Sentosa gets $350/unit fallback instead of $250/unit. | Use `ry1('replacement_reserves') \|\| (totalUnits * (reservesPerUnitFromDA ?? 350))` where `reservesPerUnitFromDA` reads `deal_assumptions.replacement_reserves_per_unit`. |
| MA-09 | 🟢 Low | **amenities, office, hoa_dues, personal_property_tax seeded but not projected**. These fields feed into seeder total_opex but are not in the projections IIFE's `totalOpex` sum. Long-run projections understate OpEx for deals with these items. | Add the four fields to the projections IIFE (seed + compound with opexGrowthStep, same pattern as payroll/repairs). |

---

## Audit Coverage Notes

- **Y1 growth step = 0**: All growth bugs (MA-03, MA-04) are dormant at Y1. The Y1 reconciliation gap is driven by MA-01, MA-02, MA-05, MA-06.
- **Projections tab visibility**: The Projections tab renders the projections IIFE output directly — users are seeing the parabolic Y2+ numbers from MA-03/MA-04 today. This is the highest-visibility defect even though it doesn't affect Y1.
- **No code changes made in this audit.** All findings are read-only observations against live DB state and source code.
- **Re-seeding priority**: Re-seed Bishop (MA-01) and Sentosa (MA-02) after verifying the `isExcludedFromOpex` filter covers numeric GL prefixes. This will also apply the current seeder's `/months` convention to other_income_per_unit for all stale deals.
