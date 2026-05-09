# ProForma Pipeline Audit — May 2026

**Date:** 2026-05-09  
**Auditor:** Task #669  
**Scope:** End-to-end F9 Pro Forma data path from raw extraction capsules to rendered UI, including every bug that causes broker/platform columns to be absent, wrong, or fictitious.  
**Test deal:** 464 Bishop Street, deal ID `3f32276f-aacd-4da3-b306-317c5109b403` (232 units)  
**Status:** AUDIT ONLY. No code fixes in this task.

---

## 1. Executive Summary

The F9 Pro Forma engine has two distinct UI surfaces that share a name but have completely separate data paths:

| Surface | Component | Data source | Real data? |
|---|---|---|---|
| **Financial Engine (F9)** | `ProFormaSummaryTab.tsx` | `GET /api/v1/deals/:dealId/financials` | **Yes** |
| **M09 Intelligence Panel** | `ProFormaIntelligence.tsx` | `enhancedProFormaMockData.ts` | **No — 100% mock** |

The Financial Engine path is architecturally sound: it flows through a 5-layer seeder, integrity-checked assembly, and a typed API contract. However, **the platform layer is always null at seed time** due to an un-implemented TODO in the seeder, causing the platform column to be blank in every ProFormaSummaryTab render. The M09 Intelligence Panel shows fictional numbers for every deal and must be flagged for migration to the live API or removal.

Eight additional bugs are documented below with exact file locations and severity ratings.

---

## 2. Data Flow — Full Pipeline Map

```
Document Upload (T12 / Rent Roll / Tax Bill / OM)
        │
        ▼
deal_data JSONB (deals table)
  ├── extraction_t12
  ├── extraction_rent_roll
  ├── extraction_tax_bill
  └── extraction_om  (= broker layer; source tag 'om')
        │
        ▼  POST extraction → data-router → seedProFormaYear1()
proforma-seeder.service.ts  [buildSeed()]
  ├── reads 4 capsules
  ├── applies resolve() with FIELD_PRIORITIES
  ├── platform baseline → ALL NULL (BUG-01)
  └── writes LayeredValue JSONB to deal_assumptions.year1
        │
        ▼  GET /api/v1/deals/:dealId/financials (inline-deals.routes.ts:1740)
getDealFinancials()  [proforma-adjustment.service.ts:1722]
  ├── calls ensureDealAssumptionsSeeded() (auto-seeds if missing)
  ├── reads deal_assumptions.year1 (the JSONB blob)
  ├── builds OperatingStatementRow[] (toRow / toDollarRow)
  │    broker  = field.om ?? field.broker
  │    platform = field.platform        ← always null (BUG-01 downstream)
  │    t12     = field.t12
  │    rentRoll = field.rent_roll
  │    resolved = field.resolved
  ├── runs 4 integrity checks (IC-01 to IC-04)
  ├── builds gprDecomposition, capitalStack, rentRollSummary
  ├── assembles perYear assumptions (M07 traffic integration)
  └── returns DealFinancials contract
        │
        ▼  consumed by two callers
   ┌────────────────────┬──────────────────────────┐
   │                    │                          │
ProFormaSummaryTab  (real F9)     ProFormaIntelligence  (BUG-02)
frontend/.../           frontend/src/components/
financial-engine/       deal/sections/
ProFormaSummaryTab.tsx  ProFormaIntelligence.tsx
   │                    │
   │                    └── import { ... } from
   │                        '../../data/enhancedProFormaMockData'
   │                        100% FICTITIOUS DATA — NOT CONNECTED
   │
   ▼
Rendered F9 tabs: ProForma, Projections, Assumptions, Debt, etc.
```

---

## 3. Layer-by-Layer Findings

### 3.1 Extraction Capsules (`deals.deal_data` JSONB)

**Where:** `deals.deal_data` (PostgreSQL JSONB column)  
**Keys:** `extraction_t12`, `extraction_rent_roll`, `extraction_tax_bill`, `extraction_om`

**Findings:**
- The broker layer is stored under key `extraction_om` (Offering Memorandum). Source tag inside LayeredValue is `'om'`.  
- A second broker path exists: `deal_data.broker_claims.proforma` (read by seeder at line 820-824). This is the capsule produced by the OM extraction pipeline, not the user-entered broker data.  
- When neither OM capsule key exists, broker values are null across the board. There is no broker-manual-entry path in the seeder.

### 3.2 ProForma Seeder (`proforma-seeder.service.ts`)

**Entry points:**
- `seedProFormaYear1(pool, dealId)` — full seed; called by data-router after extraction
- `ensureDealAssumptionsSeeded(pool, dealId)` — idempotent guard called by getDealFinancials on every request
- `applyUserOverride(pool, dealId, fieldPath, value, userId)` — single-field user edit + re-derive

**FIELD_PRIORITIES (canonical, lines 136-148):**

| Field | Priority order |
|---|---|
| `gpr` | t12 → rent_roll |
| `loss_to_lease_pct` | t12 → rent_roll |
| `vacancy_pct` | rent_roll → t12 |
| `concessions_pct` | t12 → rent_roll |
| `bad_debt_pct` | t12 |
| `non_revenue_units_pct` | t12 |
| `other_income_total/per_unit` | rent_roll → t12 → om |
| `real_estate_tax` | tax_bill → t12 (with IC-04 tie-break: if |t12 - tax_bill|/tax_bill > 15%, prefer t12) |
| `management_fee_pct` | t12 |
| `insurance` | t12 |
| All other opex | t12 (explicit `priority: ['t12']` in opexFromT12) |

**`SKIP_ZERO_FIELDS`** (lines 157-165): GPR, EGI, NOI, NRI, other_income total/per_unit, total_opex — zero is treated as missing and falls through to next source. Protects against lease-up rent rolls that report `gpr_monthly: 0`.

**BUG-01 — Platform baseline is always null (CRITICAL):**  
At `proforma-seeder.service.ts:795-806`:
```typescript
// TODO: real platform baseline from location-baseline service.
// All-null fallback means seeder uses extraction values 1:1 when present.
const platform: PlatformBaseline = {
  gpr_per_unit_per_month: null,
  vacancy_pct: null,
  concessions_pct: null,
  bad_debt_pct: null,
  opex_per_unit_annual: {
    payroll: null, r_and_m: null, turnover: null, contract_services: null,
    marketing: null, g_and_a: null, utilities: null, insurance: null,
  },
  management_fee_pct_egi: null,
};
```
This is the only call site for `buildSeed()`. Because `platform` is all-null, every `LayeredValue<number>.platform` in the year1 JSONB is null. Downstream, `getDealFinancials → toRow()` reads `layerNum(field, 'platform')` → always null. The platform column in every `OperatingStatementRow` is null. `benchmarkPosition` is always null. The platform comparison in F9 Assumptions tab is blank for all deals.

**BUG-04 — `water_sewer`, `electric`, `gas_fuel`, `landscaping` never seeded (MEDIUM):**  
`getDealFinancials` exposes these OPEX_FIELDS (lines 1850-1860):
```
water_sewer, electric, gas_fuel, landscaping
```
But `buildSeed()` seeds a single compound `utilities` field from `t12Opex['utilities']`. There is no code that populates `water_sewer`, `electric`, or `gas_fuel` as separate LayeredValues. Similarly, `landscaping` is not seeded (it is presumably subsumed under `contract_services`). Impact: these four rows always render as null in F9.

**BUG-05 — `replacement_reserves` has no T12 source in seeder (MEDIUM):**  
At `proforma-seeder.service.ts:708-712`:
```typescript
const replacementReserves: LayeredValue<number> = resolve('replacement_reserves', null, {
  om: bpReserves,
  existingOverride: getOverride('replacement_reserves'),
  priority: ['t12', 'om'],
});
```
No `t12: ...` argument is passed. The resolve call has `priority: ['t12', 'om']` but there is no T12 value to walk. The seeder does not read a `replacement_reserves` (or `reserves`) key from `t12Opex`. Result: replacement reserves is always null unless an OM capsule or user override provides it.

**BUG-06 — `bad_debt` applied to full EGI including other income (MEDIUM, spec deviation):**  
The canonical industry convention applies bad debt only to rental income. The seeder's formula (lines 672, 699):
```typescript
const egi_after_bad_debt = egi_resolved * (1 - (badDebtPct.resolved ?? 0));
// where egi_resolved = nri_resolved + otherIncomeForEgi
```
Bad debt is multiplied against EGI (which includes other income such as parking, utility reimbursements, etc.). The v31 spec places `Bad Debt` as a deduction from GPR in the revenue waterfall, not from EGI. This causes bad debt to overstate the deduction when other income is material. The recomputeDerived function at line 1029-1030 mirrors this pattern.

**Positive observations:**
- `recomputeDerived()` is called after every `applyUserOverride()`, keeping NOI/EGI/total_opex consistent with user edits
- Custom GL line items (unrecognized T12 rows) are captured in `customOpexItems` with a robust exclusion filter (`EXCLUDE_FROM_CUSTOM_OPEX`)
- IC-04 tie-break: when tax_bill vs T12 diverge > 15%, seeder forces resolution to T12 (lines 616-630)
- User overrides on percentages (e.g. `loss_to_lease_pct`) survive re-seeding because `existingOverride` is fetched from the existing JSONB before building the new seed

### 3.3 `getDealFinancials()` (`proforma-adjustment.service.ts:1722`)

**Route:** `GET /api/v1/deals/:dealId/financials` (mounted in `inline-deals.routes.ts:1740`)  
**Also called by:** `deal-assumptions.routes.ts` (lines 476, 983)

**Row assembly — `toRow()` (line 1876):**
```typescript
return {
  field: key,
  label,
  broker:  layerNum(field, 'om') ?? layerNum(field, 'broker'),
  platform: layerNum(field, 'platform'),   // ← always null (BUG-01)
  t12:     layerNum(field, 't12'),
  rentRoll: layerNum(field, 'rent_roll'),
  taxBill: layerNum(field, 'tax_bill'),
  resolved,
  resolution,
  ...
};
```

**Source confidence map (lines 1863-1874):**

| Source | Confidence |
|---|---|
| override | 95 |
| t12 | 85 |
| tax_bill | 85 |
| rent_roll | 80 |
| box_score | 75 |
| platform | 70 |
| platform_fallback | 65 |
| om / broker | 60 |
| computed | 55 |

**Integrity checks (lines 1974-2038):**

| Check | Threshold | Status when no data |
|---|---|---|
| IC-01: T12 NOI reconciliation | Gap < $1,000 absolute | Skipped (both sides null) |
| IC-02: GPR rent_roll vs T12 | Delta < 3% | Skipped (both sides null) |
| IC-03: Controllable OpEx completeness | All 7 fields non-null | Warns with missing list |
| IC-04: Tax-line assessor match | Delta < 15% | Skipped (both sides null) |

IC-03 checks: `['payroll', 'repairs_maintenance', 'turnover', 'contract_services', 'marketing', 'utilities', 'g_and_a']`. Note `utilities` is used here (the compound field), not the split sub-lines.

**M07 vacancy derivation (lines 2040-2071):**  
Formula: `vacancyPct = 1 - (T01_weekly_tours × T05_closing_ratio × 52 × avg_lease_term) / total_units`  
Three fallback paths: (1) actual T01/T05 from traffic_learned_rates, (2) year1 trajectory vacancy from traffic_projections, (3) calibrated vacancy from proforma_assumptions. Result stored in `unitEconomics.derivedVacancyPct` — informational, does NOT override the resolved vacancy_pct.

**BUG-07 — `t12AnnualTax` reads wrong layer (MEDIUM):**  
At `proforma-adjustment.service.ts:2556`:
```typescript
const t12AnnualTax: number | null = 
  layerN(taxLvObj, 'broker') ?? layerN(taxLvObj, 't12') ?? layerN(taxLvObj, 'resolved');
```
The function reads `'broker'` first — but the broker layer in the seeder is stored as `'om'`, not `'broker'`. `layerN(taxLvObj, 'broker')` will always return null unless a legacy pre-seeder record used `'broker'` key. The intent is to fall through to `t12`, which usually works, but the `broker` read is dead code.

**Positive observations:**
- `ensureDealAssumptionsSeeded()` is called on every request as a safety net — deals get data on first view even without explicit trigger
- `xirr()` Newton-Raphson implementation is self-contained and correct
- Per-year vacancy/rent-growth overrides from `per_year_overrides` JSONB are plumbed through the `perYear` array properly
- `unitMixForGpr` opt-in flag (`da:use_unit_mix_for_gpr`) is correctly gated

### 3.4 Route Layer

**`GET /api/v1/deals/:dealId/financials`** (inline-deals.routes.ts:1740)  
**`PATCH /api/v1/deals/:dealId/financials/override`** (inline-deals.routes.ts:1930)

Both use `requireAuth` middleware. Hold years defaults to 10 (query param `?holdYears=N` supported). No caching layer — computation runs on every request.

**`GET /api/v1/proforma/:dealId/comparison`** (proforma.routes.ts:384)  
This endpoint returns **news-driven adjustment comparison** (baseline vs news-adjusted assumptions), not a broker/platform/user 3-layer comparison. The shape is `{ dealName, strategy, baseline.rentGrowth, baseline.vacancy, baseline.opexGrowth, baseline.exitCap, differences.* }`. It is **not** the data source for the F9 column comparisons shown in ProFormaSummaryTab.

**BUG-03 — Comparison endpoint widely misunderstood (LOW, documentation):**  
The endpoint `GET /api/v1/proforma/:dealId/comparison` is named and described in comments as a "side-by-side comparison" but it compares news-adjusted vs baseline assumptions, not broker vs platform vs user layers. Any future consumer expecting a 3-layer source comparison from this endpoint will get the wrong shape.

### 3.5 ProFormaSummaryTab (Real F9 Consumer)

**File:** `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx`  
**Data source:** `GET /api/v1/deals/:dealId/financials` — **real API, correctly wired**

This is the authoritative F9 rendering surface. It correctly consumes `DealFinancials` and renders the `OperatingStatementRow[]` grid. The broker/platform/user column rendering logic is present and correct — columns will show data whenever the corresponding fields in the LayeredValue are non-null.

**Column render state:**
- `broker` column: shows data when T12 + OM are uploaded (needs OM capsule for opex broker values)
- `platform` column: **always blank** (BUG-01)
- `t12` column: shows data when T12 uploaded
- `resolved` column: always shows (falls to platform_fallback at minimum)

### 3.6 ProFormaIntelligence.tsx (Legacy M09 Panel — CRITICAL)

**File:** `frontend/src/components/deal/sections/ProFormaIntelligence.tsx`  
**Data source:** `import { ... } from '../../data/enhancedProFormaMockData'` (line 19)

**BUG-02 — 100% mock data, no API connection (CRITICAL):**  
Every value shown in the M09 ProForma Intelligence panel — broker NOI, platform NOI, year-over-year comparisons, all percentage columns — comes from a static TypeScript file (`enhancedProFormaMockData.ts`). The data is identical for every deal. This component:
- Is NOT connected to `getDealFinancials` or any live endpoint
- Shows the same numbers regardless of which deal is open
- Cannot be correct for any real deal
- The mock data likely reflects a placeholder deal built during prototyping

This is the most severe user-facing bug: an analyst reviewing the M09 panel is reading fabricated intelligence.

---

## 4. Bug Register

| ID | Severity | File | Line(s) | Description | Impact |
|---|---|---|---|---|---|
| BUG-01 | **CRITICAL** | `proforma-seeder.service.ts` | 795-806 | Platform baseline is all-null (TODO not implemented). No location-baseline service call. | `OperatingStatementRow.platform` = null for all rows, all deals. Platform column blank in F9. `benchmarkPosition` always null. |
| BUG-02 | **CRITICAL** | `ProFormaIntelligence.tsx` | 19 | Entire M09 panel imports from `enhancedProFormaMockData.ts` — no live API call. | Every number in the M09 ProForma Intelligence panel is fictitious and deal-invariant. |
| BUG-03 | LOW | `proforma.routes.ts` | 381-395 | `GET /api/v1/proforma/:dealId/comparison` returns news-adjustment comparison, not broker/platform/user 3-layer. | Misleading endpoint name; future consumers will get wrong shape. |
| BUG-04 | MEDIUM | `proforma-seeder.service.ts` | 508-538 | `water_sewer`, `electric`, `gas_fuel`, `landscaping` not seeded as separate LayeredValues (only compound `utilities` seeded). | Four OPEX_FIELDS in the F9 display always null. |
| BUG-05 | MEDIUM | `proforma-seeder.service.ts` | 708-712 | `replacement_reserves` — no T12 source read; `t12:` argument missing from `resolve()` call. | Replacement reserves always null unless OM capsule provides broker value or user overrides. |
| BUG-06 | MEDIUM | `proforma-seeder.service.ts` | 637-672 | Bad debt applied to full EGI (NRI + other income), not just rental income. Spec places bad debt as GPR deduction. | Overstates bad debt when other income is material; diverges from industry convention and v31 spec. |
| BUG-07 | LOW | `proforma-adjustment.service.ts` | 2556 | `t12AnnualTax` reads `layerN(taxLvObj, 'broker')` first; broker layer stored as `'om'` not `'broker'`. | Dead code — `layerN(..., 'broker')` always null; falls through to `t12` which is correct. No user-visible impact today. |
| BUG-08 | LOW | `proforma-adjustment.service.ts` | 1892-1893 | `toRow()` reads `broker: layerNum(field, 'om') ?? layerNum(field, 'broker')`. The `?? layerNum(field, 'broker')` fallback is dead — seeder never writes `'broker'` key, only `'om'`. | No current user impact; creates confusion when reading code or adding new broker-data paths. |

---

## 5. Integrity Checks — Live Status

For the test deal (464 Bishop, 232 units):

| Check | Expected trigger | Notes |
|---|---|---|
| IC-01 | |resolved NOI − T12 NOI| > $1,000 | Will fire if T12 extraction + seeder are complete. Requires both `noi.resolved` and `noi.t12` to be non-null. |
| IC-02 | RR GPR vs T12 GPR gap > 3% | Requires both `gpr.rent_roll` and `gpr.t12` non-null. |
| IC-03 | Any of 7 controllable opex fields null | Will warn for `water_sewer`, `electric`, `gas_fuel` always (BUG-04). Will warn for `utilities` if T12 lacks a utilities line. |
| IC-04 | |T12 tax − tax bill|/tax bill > 15% | Requires both T12 and tax bill uploaded. |
| IC-SEED | No source data at all | Fires when zero capsules are present. |

---

## 6. Recommendations (Priority Order)

1. **[BUG-01] Implement location-baseline service integration in the seeder.**  
   Replace the all-null `PlatformBaseline` constant with a call to a location/submarket lookup that returns typical per-unit opex, vacancy, and rent-growth rates for the deal's market. Until this is done, the entire platform layer is dark.

2. **[BUG-02] Migrate or deprecate `ProFormaIntelligence.tsx`.**  
   Options: (a) Wire it to `getDealFinancials` and remove the mock import, or (b) remove the M09 panel entirely if it has been superseded by F9. The static mock file `enhancedProFormaMockData.ts` should be deleted once this component no longer imports it.

3. **[BUG-04] Seed `water_sewer`, `electric`, `gas_fuel` as separate fields.**  
   Either split the T12 `utilities` field at extraction time into sub-components, or define three new T12 capsule keys and add corresponding `opexFromT12()` calls in `buildSeed()`. Update IC-03 to check the sub-fields instead of the compound `utilities`.

4. **[BUG-05] Pass T12 reserves to `replacement_reserves` resolver.**  
   Read `t12Opex['replacement_reserves']` (or `t12Opex['reserves']`) and pass it as `t12:` argument to the `resolve()` call for `replacement_reserves`.

5. **[BUG-06] Correct bad debt formula to apply only to rental income.**  
   Per v31 spec, bad debt is a deduction from GPR in the revenue waterfall, not from EGI. The corrected formula:  
   `NRI = GPR × (1 - ltl - vacancy - concessions - nru - bad_debt)`  
   `EGI = NRI + Other Income`  
   Update `buildSeed`, `recomputeDerived`, and the corresponding DealFinancials assembly in `getDealFinancials`.

6. **[BUG-03] Rename or document the comparison endpoint.**  
   Rename `GET /api/v1/proforma/:dealId/comparison` to `GET /api/v1/proforma/:dealId/news-comparison` or add explicit documentation in the route comment that it returns news-adjustment deltas, not a 3-layer source comparison.

7. **[BUG-07/BUG-08] Clean up dead broker key reads.**  
   Remove the `layerN(taxLvObj, 'broker')` read in getDealFinancials:2556 and the `?? layerNum(field, 'broker')` fallback in `toRow()`. Document that `'om'` is the canonical broker layer key.

---

## 7. Reference Files

| File | Role |
|---|---|
| `backend/src/services/proforma-seeder.service.ts` | Broker/T12/RR/TaxBill → year1 JSONB |
| `backend/src/services/proforma-adjustment.service.ts` | year1 → DealFinancials (getDealFinancials function at line 1722) |
| `backend/src/api/rest/inline-deals.routes.ts` | Route: GET /:dealId/financials (line 1740) |
| `backend/src/api/rest/proforma.routes.ts` | News-adjustment comparison endpoint |
| `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | Real F9 UI consumer |
| `frontend/src/components/deal/sections/ProFormaIntelligence.tsx` | Mock-only M09 panel (BUG-02) |
| `frontend/src/data/enhancedProFormaMockData.ts` | Source of BUG-02 mock data |
| `docs/architecture/F9_DATA_FLOW_AUDIT_PHASE1.md` | Prior audit (Flow 1-4) |
| `docs/specs/PROFORMA_CALCULATION_TEMPLATE.md` | Canonical calculation reference (this audit) |
