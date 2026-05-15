# Pro Forma Subsystem Audit — Phase 0

**Task:** #773  
**Date:** 2026-05-15  
**Auditor:** Agent (read-only; no code changes)  
**Scope:** Full pro forma subsystem — data sources, write paths, unit conventions, UI correspondence  
**Prior art:** `PROFORMA_MATH_AUDIT.md` (Task #662), `F9_DATA_FLOW_AUDIT_PHASE1.md`, `F9_TIER1_BLOCKERS_AUDIT.md`, `PROFORMA_SURFACE_AUDIT.md`, `CAPITAL_EXIT_SUBSYSTEM_AUDIT.md`, `F9_TIER1_BLOCKERS_AUDIT.md`

---

## Classification Legend

| Tag | Meaning |
|---|---|
| `SINGLE_WRITER` | Exactly one authoritative writer; read path is clean |
| `CONSISTENT` | Multi-writer but all writers agree on type/unit/table |
| `LAYERED` | LayeredValue resolution chain is present and wired |
| `WIRED` / `LIVE` | Connected end-to-end from storage through UI |
| `PARALLEL` | Two independent engines serve the same conceptual field |
| `MIXED` | Some writers correct, others stale or wrong |
| `FALLBACK` | No real data; static industry norm or hardcoded constant used |
| `HARDCODED` | Literal constant in code; no config, no DB, no override path |
| `DISPLAY_ONLY` | Stored in DB but never read by either live engine |
| `NOT_WIRED` | Module exists as code but has no live caller on production routes |
| `PHANTOM` | Column or key appears in display list but is never seeded |
| `RACE` | Two or more independent writers share a resource with no transaction boundary |
| `ON_MOCK_DATA` | UI renders; data source is a hardcoded stub returning nulls or placeholders |
| `STRUCTURALLY_MISALIGNED` | Unit, type, or convention mismatch between writer and reader |

---

## ☠ Load-Bearing Facts (Top 4 Findings)

These four findings have the highest consequence for deal accuracy and trust:

**1. LIUS is 100% orphaned — 21 line schemas are fully written but no production route calls `runLIUSEngine`.** Every LIUS line (all 7 OpEx, 7 Capital, 6 Exit, 1 Reserves) is bypassed. The Pro Forma never receives validated, tier-resolved line-item values. The seeder uses static NMHC norms and T12 extraction instead. See **PF-06** / **LIU-ALL**.

**2. Two parallel live engines serve the same deal.** `getDealFinancials` (`/deal-assumptions/:id`) and `composeDealFinancials` (`/deals/:id/financials`) assemble the same underlying data via different code paths, returning different response shapes. No shared contract. A fix to one is invisible to the other. See **PF-01**.

**3. Per-year projection overrides silently revert.** When an operator edits Year 3 payroll or Year 2 GPR in the Projections Tab, the value saves to the DB but `getDealFinancials` re-derives every year from `Y1 × compoundGrowth` on the next fetch, discarding all per-year overrides. See **PF-02**.

**4. The Tier 1–3 layered growth engine (five-component rent growth, nine-line OPEX, three revenue formulas) has zero production callers.** The live path uses a flat `opexGrowthRate` scalar. The sophisticated per-line OPEX anchors, momentum/cycle/anchor weighting, and SIMPLE/MARK_TO_MARKET/RENEWAL_AWARE revenue dispatch are test-only code. See **PF-07**.

---

## Architecture Map

### Storage Tables

| Table | Convention | Live readers |
|---|---|---|
| `proforma_assumptions` (5 scalar pairs) | **Whole-pct** (3.0 = 3 %) | `getDealFinancials` (÷ 100 at read) |
| `deal_assumptions.year1` JSONB | **Decimal** (0.03 = 3 %) LayeredValue tree | Both live engines |
| `deal_assumptions` scalar cols | **Whole-pct** (5.00 = 5 %) | **Neither engine** — DISPLAY_ONLY |
| `proforma_templates` | **Decimal** (0.03 = 3 %) | **Neither engine** — never applied to deals |
| `deal_versions` | n/a — blob snapshot | LLM path (`financial-model.routes.ts`) only |

### Computation Engines

| Engine | Entry point | Route | Reads |
|---|---|---|---|
| **Engine A** (F9 main) | `getDealFinancials()` | `GET /api/v1/deal-assumptions/:dealId` | `deal_assumptions.year1` + `proforma_assumptions` growth scalars |
| **Engine B** (financials) | `composeDealFinancials()` | `GET /api/v1/deals/:dealId/financials` | `deal_assumptions.year1` only |
| **Engine C** (LLM / deterministic) | `financialModelEngine.buildModel()` | `POST /api/v1/financial-model` | LLM `ProFormaAssumptions` envelope → bridge → runner |
| **Engine D** (orphaned Tier 1–3) | `projectProforma()` | **none** — test-only | `ProjectionInputs` struct |

### Unit Convention Map

| Location | Convention | Example (3 % rent growth) | Conversion |
|---|---|---|---|
| `proforma_assumptions.*_baseline/current` | **Whole-pct** | `3.000` | ÷ 100 at read (getDealFinancials:2562–2545) |
| `deal_assumptions.year1.*` LayeredValue | **Decimal** | `0.030` | none |
| `deal_assumptions` scalar cols | **Whole-pct** | `3.00` | DISPLAY_ONLY — never read |
| `proforma_templates.*_rate` | **Decimal** | `0.030` | none |
| `ModelAssumptions` (deterministic runner) | **Decimal** | `0.030` | none |
| `ProFormaAssumptions` LLM envelope | **Decimal** | `0.030` | none |

`getDealFinancials` divides all four `proforma_assumptions` rate fields by 100:
- `opex_growth_current ÷ 100` — line 2565
- `rent_growth_current ÷ 100` — line 2575 area  
- `vacancy_current ÷ 100` — line 2545
- `exit_cap_current ÷ 100` — confirmed at read time

---

## Part 1 — Module Inventory

### 1.1 `financials-composer.service.ts` (Engine B)

**File:** `backend/src/services/financials-composer.service.ts` (2544 lines)  
**Route:** `GET /api/v1/deals/:dealId/financials` (via `inline-deals.routes.ts:2101`)  
**Unit tests:** None found in test scan  

| Capability | Status |
|---|---|
| Lazy-seeds `deal_assumptions.year1` via `seedProFormaYear1` if missing | LIVE |
| Reads `deals.operator_stance` for `leasingCostTreatment` modulation | LIVE |
| Builds OSRows from `year1` JSONB | LIVE |
| Enriches with trailing actuals (T-6, T-3, T-1) from `deal_monthly_actuals` | LIVE |
| Builds rent roll summary (extraction / SQL rows / OM fallback) | LIVE |
| `buildTrafficProjection()` — returns hardcoded stub (all nulls, `yearly: []`) | ON_MOCK_DATA |
| Concession recognition (`computeConcessionRecognition`) | NOT_WIRED (null until Task #573) |
| M39 peer intelligence enrichment for `subjectHistory.peer_set_values` | LIVE |
| M38 non-blocking calibration predictions | LIVE (fire-and-forget) |

**Development / Redevelopment handling:** Engine B reads `deals.project_type` but does not branch on model type for any Pro Forma computation. The OSRow assembly is identical for all deal types. Development deals with negative Year-1 NOI receive the same display as acquisitions.

---

### 1.2 `proforma-adjustment.service.ts` (Engine A — `getDealFinancials`)

**File:** `backend/src/services/proforma-adjustment.service.ts` (5321 lines)  
**Route:** `GET /api/v1/deal-assumptions/:dealId`  
**Unit tests:** None found  

| Capability | Status |
|---|---|
| Reads `deal_assumptions.year1` LayeredValues for Year 1 OSRows | LIVE |
| Reads `proforma_assumptions` scalars (growth rates, vacancy, exit cap) | LIVE |
| Inline projections loop (years 1–N): `Y1 × compoundGrowth` | LIVE but PF-02 |
| `gprDecomposition` (extraction-layer GPR resolution) | LIVE |
| `applyFinancialsOverride` — writes `deal_assumptions.per_year_overrides` | LIVE |
| `applyUnitMixOverride` — writes `deal_assumptions.unit_mix` + overrides | LIVE |
| Reads per-year overrides in projection loop | **NOT_WIRED** — PF-02 |
| OperatorStance modulation of concessions | **NOT_WIRED** — PF-16 |

**Class-based portion (the `ProFormaAdjustmentService` class, lines 1–1377):** Manages `proforma_assumptions` table: `initializeProForma`, `recalculate`, `overrideAssumption`, `setMarketBaseline`, `resetToMarket`, `calculateRentGrowthAdjustment`, `calculateVacancyAdjustment`, `calculateOpExAdjustment`, `calculateExitCapAdjustment`. All write to `proforma_assumptions.*_current` with no transaction boundary against `deal_assumptions`.

---

### 1.3 `proforma-seeder.service.ts`

**File:** `backend/src/services/proforma-seeder.service.ts` (1514 lines)  
**Called by:** `composeDealFinancials` (lazy seed), also callable directly  

| Capability | Status |
|---|---|
| `lookupPlatformBaseline`: hits `apartment_market_snapshots` for city+state avg rent, occupancy, concession | LIVE |
| State-adjusted OpEx norms (FL, TX, CA, NY, NJ, CO, AZ) | LIVE (static table) |
| Resolves all LayeredValues with `FIELD_PRIORITIES` priority map | LIVE |
| `SKIP_ZERO_FIELDS` for lease-up zero-value guard | LIVE |
| `buildSeed`: broker proforma (`bpCapsule`) → LayeredValue om slot | LIVE |
| `reResolveClearedLayeredValue`: shared logic for override-clear fallback | LIVE |
| EXCLUDE_FROM_CUSTOM_OPEX / isExcludedFromOpex GL label filter | LIVE |
| `landscaping` in OpEx FIELD_PRIORITIES | **NOT_WIRED** — PF-10 |

---

### 1.4 `deterministic-model-runner.ts` + `proforma-assumptions-bridge.ts` (Engine C)

**Files:** `backend/src/services/deterministic/deterministic-model-runner.ts` (1919 lines), `proforma-assumptions-bridge.ts` (633 lines)  
**Triggered by:** `POST /api/v1/financial-model` → `financialModelEngine.buildModel()`  

| Capability | Status |
|---|---|
| Pure math: GPR → EGI → NOI → DSCR → IRR / EM / CoC | LIVE (Engine C path) |
| Multi-year projection with vacancy schedule and rent growth array | LIVE |
| FL/non-FL tax schedule (buy reassessment, millage, annual cap) | LIVE |
| Waterfall distribution (3-tier promote) | LIVE |
| Sensitivity matrix (exitCap × rentGrowth grid) | LIVE |
| Stress scenarios (rent -10%, vacancy +5%, etc.) | LIVE |
| Evidence block + collision report (10 %/25 % thresholds) | LIVE |
| Development construction cost model (`constructionMonths`, `hardCostPerSF`, `softCostPct`) | LIVE — gated by `dealMode = 'development'/'ground_up'` |
| `concessions = 0` hardcoded in bridge:241 | **HARDCODED** — PF-13 |
| `dealType` defaults to `'existing'` if `a.modelType` not set | **FALLBACK** |
| `vacancyY1 = vacancyStab` (no step-up for lease-up deals) | **HARDCODED** — conservative |
| Results written back to `deal_assumptions.year1` | **NOT_WIRED** — engine cache only |

---

### 1.5 `proforma-projection.service.ts` (Engine D — orphaned)

**File:** `backend/src/services/proforma/proforma-projection.service.ts` (388 lines)  
**Production callers:** **NONE** — imported only in `__tests__/tier3-refinement.test.ts`  

Full Tier 1–3 composition:
- `computeLayeredRentGrowth` (5-component: momentum + cycle + anchor + event + position)
- `computeOpexLineGrowth` (9-line per-category with custom anchors)
- `computeManagementFeeGrowth` (auto-couples to revenue)
- `positionContributionForYear` (position adjustment from M07/M14)
- `applyTemplateGrowthTuning` (BTS Y3+ truncation, Flip Y1+ truncation)
- Revenue formula dispatch: SIMPLE / MARK_TO_MARKET / RENEWAL_AWARE
- NOI growth identity

**Status: NOT_WIRED in production.** All production engines use flat-rate growth.

---

### 1.6 `proforma/layered-growth/` modules

| File | Status | Callers |
|---|---|---|
| `rent-growth.ts` (321 lines) | NOT_WIRED | `proforma-projection.service.ts` only (test-only) |
| `opex-growth.ts` (408 lines) | NOT_WIRED | `proforma-projection.service.ts` only |
| `position-adjustment.ts` | NOT_WIRED | `proforma-projection.service.ts` only |

`ASSET_CLASS_SPREAD_BPS` calibration: `calibrationStatus: 'tbd'` (set 2026-04-29). Multifamily spread = 30 bps over CPI shelter. Pending backtest per spec §14.

---

### 1.7 `proforma/revenue/revenue-formulas.ts`

**Status: NOT_WIRED in production.**  
Three formulas (SIMPLE, MARK_TO_MARKET, RENEWAL_AWARE) implemented. `RENEWAL_RATE_BASELINES` matrix (asset-class × market-type) with default values, `calibrationStatus: 'tbd'`. Only imported in test files via `proforma-projection.service.ts`.

---

### 1.8 `proforma/blueprint/proforma-blueprint.ts`

**File:** `backend/src/services/proforma/blueprint/proforma-blueprint.ts`  
**Callers:** `proforma-projection.service.ts` — test-only path. Not wired to live engines.  
`OPEX_LINE_ITEMS` (9 keys), template IDs, `ProFormaTemplateId` and `RevenueFormulaId` type unions, `applyTemplateGrowthTuning`.

---

### 1.9 `proforma/agent-fill-in.ts`

**File:** `backend/src/services/proforma/agent-fill-in.ts` (115 lines)  
Tier-2 library fill-in pass. Walks `requiredFields`, queries a `LibraryResolver` for missing fields. Marks filled values as `INFERRED` quality. **Library resolver is injected — in production the real resolver must be wired.** No evidence of production wiring found.  
**Status: NOT_WIRED** (no live `LibraryResolver` caller in production routes).

---

### 1.10 `proforma/deal-versions.service.ts`

**File:** `backend/src/services/proforma/deal-versions.service.ts` (236 lines)  
Writes snapshots to `deal_versions` table. **Status: WIRED** — imported and called in `financial-model.routes.ts` (Engine C / LLM path). Saves model assumptions + results on each `buildModel()` call.

---

### 1.11 `proforma-generator.service.ts`

**File:** `backend/src/services/proforma-generator.service.ts` (371 lines)  
LLM-gated: calls Claude to generate a `ProFormaAssumptions` envelope. Hardcoded defaults: `rentGrowth: '0.0300'`, `interestRate: '0.0650'`, `exitCapRate: '0.0550'` (correctly decimal). Separate from `proforma-seeder.service.ts` — serves the LLM path (Engine C), not the LayeredValue seed path (Engines A/B). No documented hand-off between the two.

---

### 1.12 `proforma-template.service.ts`

**File:** `backend/src/services/proforma-template.service.ts` (144 lines)  
Full CRUD for `proforma_templates` table. Decimal convention throughout. **Status: NOT_WIRED** — no route or service method applies a template to a deal's `deal_assumptions.year1`.

---

## Part 2 — Pro Forma Model Types

The Pro Forma subsystem exposes three logical deal model types that correspond to different underwriting behavior:

### 2.1 Acquisition (Existing / Stabilized)

**Primary path:** Engine A (`getDealFinancials`) + Engine B (`composeDealFinancials`)  
**Model entry:** `dealType = 'existing'` or `'acquisition'`; `dealMode = 'existing'` (default when `modelType` not set in ProFormaAssumptions)

**Year 1 inputs:**
- GPR: `deal_assumptions.year1.gpr` LayeredValue (t12 → rent_roll → platform)
- Vacancy: `deal_assumptions.year1.vacancy_pct` (rent_roll → t12) + `proforma_assumptions.vacancy_current`
- OpEx: T12-sourced per category; seeder norms as fallback
- Real estate tax: T12 → tax bill; for FL: purchase_price × 0.85 × DEF_MILLAGE; non-FL: baseTax × growth

**Projections:**
- Flat rent growth from `proforma_assumptions.rent_growth_current ÷ 100`
- Flat OpEx growth from `proforma_assumptions.opex_growth_current ÷ 100`
- Per-year overrides in `per_year_overrides` ignored (PF-02)
- Vacancy: `buildVacancySchedule(holdYears, vacancyY1, vacancyStab)` — Y1 = max(vacancyY1, vacancyStab); Y2 = midpoint; Y3+ = stabilized

**Exit:**
- Exit cap from `proforma_assumptions.exit_cap_current ÷ 100`; LIUS bypass confirmed (PF-06)
- `stabilizedNOI = lastYearNOI`; `grossSalePrice = stabilizedNOI / exitCap`

**Integrity checks active:**
- INV-1: equity ≥ 0 (gated off for stabilized if exitCap > 0 but NOI ≤ 0 — error)
- INV-5: stabilizedNOI ≤ 0 in stabilized mode → hard error
- INV-7: zero-equity guard (different treatment for existing vs non-stabilized)
- INV-10: vacancy Y1 outside [0, 100] — uses acquisition path (not lease-up absorption)

---

### 2.2 Development / Ground-Up

**Primary path:** Engine C (LLM / deterministic) when `dealMode = 'development'` or `'ground_up'`  
**Engine A/B path:** No branching on model type — OSRow display is identical to acquisition

**Engine C activation:**
- `ProFormaAssumptions.dealMode = 'development'` or `'ground_up'` (must be set by LLM or analyst)
- Bridge (`proforma-assumptions-bridge.ts:387`): `dealType: a.modelType || 'existing'` — if `modelType` not set, defaults to `'existing'`. Development deals that do not explicitly set `modelType` get acquisition-mode integrity checks. **PF-D1**.

**Development-specific fields in `ModelAssumptions`:**
- `constructionMonths` (default 18)
- `leaseUpMonths` (default 12)
- `hardCostPerSF`
- `softCostPct`
- `constructionLoanRate`
- `constructionLtc`

**Deterministic runner (lines 1074–1075):**
- `inv10IsDev = a.dealType === 'development' || a.dealType === 'ground_up'`
- Uses lease-up absorption curve for vacancy schedule instead of `buildVacancySchedule`

**INV-7 mode-gating:** Non-stabilized modes (`development`, `ground_up`, `redevelopment`, `lease_up`, `value_add`) suppress the hard error when exitCap > 0 but stabilizedNOI ≤ 0 — returns warn instead. Confirmed at `deterministic-model-runner.ts:978–1002`.

**Seeder behavior for development deals:** `proforma-seeder.service.ts` does not branch on deal type. It seeds the same LayeredValue fields regardless of whether the deal is acquisition or development. Development deals with no T12 or rent roll will fall back entirely to platform norms — `gpr_platform = avg_rent_per_unit_month × totalUnits × 12` (market snapshot) even though no units may exist yet.

**LIUS gap:** Development deals have `applicableDealTypes: ["acquisition", "development", ...]` in all opex and exit LIUS yamls — but `runLIUSEngine` is never called (PF-06). Development-specific checks (e.g., `hardRules[condition: "development"]` in `exitCapRate.yaml`) are defined but never executed.

---

### 2.3 Redevelopment / Value-Add

**Primary path:** Engines A/B (same as acquisition); Engine C (same as development when `dealMode = 'redevelopment'` or `'value_add'`)

**Engine C mode detection:** `resolvedMode` (bridge:387 / runner:977) — `'redevelopment'` and `'value_add'` are in `isNonStabilizedMode` set. Vacancy/NOI integrity checks use warn (not error) for negative Y1 NOI.

**Engine A/B distinction:** **None.** The OSRow assembly is identical for redevelopment and acquisition. No "lease-up ramp" or "renovation period" branching exists in `getDealFinancials` or `composeDealFinancials`. The operator must manually set a high Year-1 vacancy to approximate the renovation period — no automated ramp.

**Vacancy ramp for value-add:** `buildVacancySchedule` creates a two-year ramp (Y1 = max(vacancyY1, vacancyStab); Y2 = midpoint; Y3+ = stabilized). This is the only mechanism available, and it only applies when `vacancyY1 > vacancyStab`. There is no renovation CAPEX period, no income void modeling, and no "dark" year treatment.

**Summary of model-type coverage:**

| Capability | Acquisition | Development | Redevelopment/Value-Add |
|---|---|---|---|
| Year 1 OSRows from LayeredValue seed | ✓ | ✓ (same, no branching) | ✓ (same) |
| Projections (flat growth) | ✓ | ✓ | ✓ |
| Per-year overrides consumed | ✗ PF-02 | ✗ PF-02 | ✗ PF-02 |
| Layered growth engine | ✗ PF-07 | ✗ PF-07 | ✗ PF-07 |
| Vacancy ramp (Y1 → Y2 → stab) | ✓ | ✗ (absorption curve in runner) | ✓ (limited) |
| Construction cost model | n/a | ✓ Engine C only | n/a |
| Lease-up absorption (runner) | ✗ | ✓ Engine C only | ✗ |
| Income void / dark-period modeling | ✗ | ✗ | ✗ |
| LIUS validation | ✗ PF-06 | ✗ PF-06 | ✗ PF-06 |
| Default `dealMode` when not set | `'existing'` | → `'existing'` if not set — PF-D1 | → `'existing'` if not set |

---

## Part 3 — Exhaustive Assumption Grid

### 3.1 `proforma_assumptions` table (all 26 columns)

**Convention:** All rate/pct fields stored in **whole-percent** (3.0 = 3 %). `getDealFinancials` divides by 100 at read.

| Column | Default | Writers (file:line) | Readers (file:line) | Q2 Tag | Q3 Conv. |
|---|---|---|---|---|---|
| `id` | gen_random_uuid() | — | select joins | n/a | n/a |
| `deal_id` | — | initializeProForma:223 | all reads | SINGLE_WRITER | n/a |
| `strategy` | `'rental'` | initializeProForma:223, capsule-bridge:144 | getProForma:129 | CONSISTENT | string |
| `rent_growth_baseline` | 3.0 | initializeProForma:238, setMarketBaseline:750, capsule-bridge:318 | getDealFinancials:2575, getProFormaComputed | RACE | Whole-pct |
| `rent_growth_current` | 3.0 | (5 writers — see PF-04): calculateRentGrowthAdjustment:366, overrideAssumption:694, setMarketBaseline:750, resetToMarket:793, capsule-bridge:506 | getDealFinancials:2575 (÷100), mapProForma:1381 | RACE | Whole-pct |
| `rent_growth_override` | null | overrideAssumption:694 | mapProForma:1382 | SINGLE_WRITER | Whole-pct |
| `rent_growth_override_reason` | null | overrideAssumption:694 | mapProForma only | SINGLE_WRITER | text |
| `vacancy_baseline` | 5.0 | initializeProForma:223, setMarketBaseline:750 | getDealFinancials:2545 (÷100), mapProForma | RACE | Whole-pct |
| `vacancy_current` | 5.0 | calculateVacancyAdjustment:444, overrideAssumption:694, setMarketBaseline:750, resetToMarket:793 | getDealFinancials:2545 (÷100), mapProForma | RACE | Whole-pct |
| `vacancy_override` | null | overrideAssumption:694 | mapProForma:1385 | SINGLE_WRITER | Whole-pct |
| `vacancy_override_reason` | null | overrideAssumption:694 | mapProForma only | SINGLE_WRITER | text |
| `opex_growth_baseline` | 3.0 | initializeProForma:223, setMarketBaseline:750 | getDealFinancials:2565 (÷100), mapProForma | RACE | Whole-pct |
| `opex_growth_current` | 3.0 | calculateOpExAdjustment:527, overrideAssumption:694, setMarketBaseline:750, resetToMarket:793 | getDealFinancials:2565 (÷100), mapProForma | RACE | Whole-pct |
| `opex_growth_override` | null | overrideAssumption:694 | mapProForma:1390 | SINGLE_WRITER | Whole-pct |
| `opex_growth_override_reason` | null | overrideAssumption:694 | mapProForma only | SINGLE_WRITER | text |
| `exit_cap_baseline` | 5.25 | initializeProForma:223, setMarketBaseline:757 | getDealFinancials (÷100), mapProForma | RACE | Whole-pct |
| `exit_cap_current` | 5.25 | calculateExitCapAdjustment:601, overrideAssumption:694, setMarketBaseline:757, resetToMarket:792, capsule-bridge:518 | getDealFinancials (÷100), mapProForma | RACE | Whole-pct |
| `exit_cap_override` | null | overrideAssumption:694 | mapProForma:1393 | SINGLE_WRITER | Whole-pct |
| `exit_cap_override_reason` | null | overrideAssumption:694 | mapProForma only | SINGLE_WRITER | text |
| `absorption_baseline` | 12.0 | initializeProForma:223, setMarketBaseline:750 | mapProForma | RACE | Months |
| `absorption_current` | 12.0 | calculateAbsorptionAdjustment:668, overrideAssumption:694, setMarketBaseline:750, resetToMarket:793 | mapProForma; not read by getDealFinancials | RACE | Months |
| `absorption_override` | null | overrideAssumption:694 | mapProForma | SINGLE_WRITER | Months |
| `absorption_override_reason` | null | overrideAssumption:694 | mapProForma only | SINGLE_WRITER | text |
| `last_recalculation` | null | recalculate:282 | — | SINGLE_WRITER | timestamp |
| `created_at` | now() | initializeProForma | — | SINGLE_WRITER | timestamp |
| `updated_at` | now() | trigger | — | SINGLE_WRITER | timestamp |

**Write-race summary:** Four active fields (`rent_growth_current`, `vacancy_current`, `opex_growth_current`, `exit_cap_current`) each have 4–5 independent writers with no transaction boundary against `deal_assumptions`. Concurrent requests can produce inconsistent state between the two tables.

### 3.2 `deal_assumptions.year1` JSONB — key LayeredValue fields

All values use **decimal** convention. Format per key: `{ platform, t12, rent_roll, tax_bill, om, override, resolved, resolution, updated_at }`.

| Field key | FIELD_PRIORITIES (seeder) | Seeder writer | Override writer | Engine A reader (file:line) | Engine B reader |
|---|---|---|---|---|---|
| `gpr` | t12 → rent_roll (om via bp capsule) | proforma-seeder.ts:496 | applyFinancialsOverride | getDealFinancials:ry1('gpr') | buildOSRows |
| `loss_to_lease_pct` | t12 → rent_roll | seeder | applyFinancialsOverride | ry1('loss_to_lease_pct') | buildOSRows |
| `vacancy_pct` | rent_roll → t12 | seeder | applyFinancialsOverride | ry1('vacancy_pct') | buildOSRows |
| `concessions_pct` | t12 → rent_roll | seeder | applyFinancialsOverride | ry1('concessions_pct') | buildOSRows (+ stance mod in B) |
| `bad_debt_pct` | t12 | seeder | applyFinancialsOverride | ry1('bad_debt_pct') | buildOSRows |
| `non_revenue_units_pct` | t12 | seeder | applyFinancialsOverride | ry1('non_revenue_units_pct') | buildOSRows |
| `other_income_per_unit` | rent_roll → t12 → om | seeder | applyFinancialsOverride | ry1('other_income_per_unit') | buildOSRows |
| `other_income_total` | rent_roll → t12 → om | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `egi` | computed (NRI+OI)×(1−bd); T12 if available | seeder | applyFinancialsOverride | ry1('egi') | buildOSRows |
| `noi` | SKIP_ZERO; T12 if available | seeder | applyFinancialsOverride | ry1('noi') | buildOSRows |
| `net_rental_income` | SKIP_ZERO | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `real_estate_tax` | tax_bill → t12 | seeder | applyFinancialsOverride | ry1('real_estate_tax') | buildOSRows |
| `insurance` | t12 | seeder | applyFinancialsOverride | ry1('insurance') | buildOSRows |
| `management_fee_pct` | t12 | seeder | applyFinancialsOverride | ry1('management_fee_pct') | buildOSRows |
| `replacement_reserves_per_unit` | om (bp) | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `payroll` | t12 → platform | seeder | applyFinancialsOverride | ry1('payroll') | buildOSRows |
| `repairs_maintenance` | t12 → platform | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `turnover` | t12 → platform | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `contract_services` | t12 → platform | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `marketing` | t12 → platform | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `g_and_a` | t12 → platform | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `utilities` | t12 → platform | seeder | applyFinancialsOverride | ry1 | buildOSRows |
| `total_opex` | SKIP_ZERO; T12 if available | seeder | applyFinancialsOverride | ry1 | buildOSRows |

**Resolution priority per field** is defined in `FIELD_PRIORITIES` (proforma-seeder.ts:297). Fields not in `FIELD_PRIORITIES` use generic fallback: `['rent_roll', 't12', 'tax_bill', 'box_score', 'aged_ar', 'om']`.

### 3.3 `deal_assumptions` scalar columns (legacy — DISPLAY_ONLY)

All of the following columns are written at deal creation and **never read by Engine A or Engine B**. Both live engines read `year1` JSONB instead. These columns exist only for potential direct SQL queries or legacy tooling.

| Column | Default | Convention | Status |
|---|---|---|---|
| `vacancy_pct` | 5.00 | Whole-pct | DISPLAY_ONLY |
| `rent_growth_yr1` | 3.00 | Whole-pct | DISPLAY_ONLY |
| `rent_growth_stabilized` | 2.50 | Whole-pct | DISPLAY_ONLY |
| `opex_ratio` | 35.00 | Whole-pct | DISPLAY_ONLY |
| `management_fee_pct` | 3.00 | Whole-pct | DISPLAY_ONLY |
| `concessions_pct` | 0.00 | Whole-pct | DISPLAY_ONLY |
| `replacement_reserves_per_unit` | 250 | $/unit/yr | DISPLAY_ONLY |
| `other_income_per_unit` | 50 | $/unit/yr | DISPLAY_ONLY |
| `exit_cap` | 0.0500 | **Decimal** (inconsistent with proforma_assumptions) | DISPLAY_ONLY + STRUCTURALLY_MISALIGNED |
| `ltv`, `ltc` | 0.6500 | Decimal fraction | DISPLAY_ONLY |
| `dscr_min` | 1.25 | Ratio | DISPLAY_ONLY |
| `origination_fee_pct` | 1.00 | Whole-pct? | DISPLAY_ONLY |
| `io_period_months` | 36 | Months | DISPLAY_ONLY |

**Note:** `deal_assumptions.exit_cap` is stored as `0.0500` (decimal), while `proforma_assumptions.exit_cap_baseline` is stored as `5.250` (whole-pct). This is an undocumented intra-system convention split, compounded by the fact that neither is read by the live engines for the same field.

---

## Part 4 — LIUS Cascade Audit

### 4.1 Engine Status

`runLIUSEngine` is defined at `backend/src/services/lius/engine.ts:96`. A grep across all `backend/src/` files for `runLIUSEngine` and `runLIUSForLine` reveals:

- `engine.ts:96` — definition of `runLIUSEngine`
- `engine.ts:343` — definition of `runLIUSForLine`
- `engine.ts:367` — `runLIUSForLine` calls `runLIUSEngine` internally
- `engine.ts:372–373` — exports

**No production route file, no production service file, and no Inngest function calls `runLIUSEngine` or `runLIUSForLine`.** The entire LIUS engine is orphaned from all Pro Forma computation paths.

### 4.2 LIUS Line-by-Line Cascade Verification

All 21 LIUS line schemas have `applicableDealTypes` that include acquisition, development, refi, reforecast. All are bypassed.

| LIUID | Section | Applicable deal types | Pro Forma field it would populate | Tier system | Current Pro Forma source (bypass) | Status |
|---|---|---|---|---|---|---|
| `opex.payroll` | opex | acquisition, development, refi, reforecast | `payroll` | 5-tier (T12 → profile cluster → market archive → broker → static) | Seeder: t12 → NMHC norm platform fallback | **BYPASSED** |
| `opex.repairsMaintenance` | opex | acquisition, development, refi, reforecast | `repairs_maintenance` | 5-tier | Seeder: t12 → platform | **BYPASSED** |
| `opex.utilities` | opex | acquisition, development, refi, reforecast | `utilities` | 5-tier | Seeder: t12 → platform | **BYPASSED** |
| `opex.managementFee` | opex | acquisition, development, refi, reforecast | `management_fee_pct` | 5-tier (Tier 1 = T12 contract rate) | Seeder: t12 → 4.5% platform | **BYPASSED** |
| `opex.propertyTax` | opex | acquisition, development, refi, reforecast | `real_estate_tax` | Ruleset C (purchase_price × ratio × millage) | Seeder: tax_bill → t12; runner: FL/non-FL schedule | **BYPASSED** |
| `opex.insurance` | opex | acquisition, development, refi, reforecast | `insurance` | Ruleset C (replacement_cost × rate × location_loading) | Seeder: t12 → state-adjusted per-unit norm | **BYPASSED** |
| `opex.marketingAdmin` | opex | acquisition, development, refi, reforecast | `marketing` + `g_and_a` | 5-tier (lifecycle-dependent) | Seeder: t12 → platform | **BYPASSED** |
| `reserves.replacementReserves` | reserves | acquisition, development, refi, reforecast | `replacement_reserves_per_unit` | 5-tier | Seeder: bp capsule → platform $250/unit | **BYPASSED** |
| `capital.roofReplacement` | capital | (unspecified in yaml) | capexBudget line item | n/a | Runner: capexBudget aggregate from `ProFormaAssumptions.capex.lineItems` | **BYPASSED** |
| `capital.hvacReplacement` | capital | — | capexBudget line item | n/a | Runner: aggregate only | **BYPASSED** |
| `capital.elevators` | capital | — | capexBudget line item | n/a | Runner: aggregate only | **BYPASSED** |
| `capital.exteriorEnvelope` | capital | — | capexBudget line item | n/a | Runner: aggregate only | **BYPASSED** |
| `capital.lifeSafety` | capital | — | capexBudget line item | n/a | Runner: aggregate only | **BYPASSED** |
| `capital.parkingLot` | capital | — | capexBudget line item | n/a | Runner: aggregate only | **BYPASSED** |
| `capital.structural` | capital | — | capexBudget line item | n/a | Runner: aggregate only | **BYPASSED** |
| `exit.exitCapRate` | exit | acquisition, development, refi, reforecast, disposition | `exitCap` | Tiers 3→2.5→4→5 (M26 archive → profile cluster → broker OM → going-in + 25bps) | Bridge:319 `toNumber(a.disposition?.exitCapRate, 0.065)` | **BYPASSED** — PF-06 |
| `exit.brokerCommission` | exit | (unspecified) | disposition `saleCosts` | n/a | Runner: `saleCosts = toNumber(a.disposition?.sellingCosts, 0.02)` | **BYPASSED** |
| `exit.closingCosts` | exit | (unspecified) | S&U closing costs | n/a | Composer: `suCcSubLineTotal` or 2% estimate | **BYPASSED** |
| `exit.defeasancePrepayment` | exit | (unspecified) | debt prepay penalty | n/a | Runner: `prepayPenalty = a.financing?.prepayPenalty ?? 0` | **BYPASSED** |
| `exit.dispositionCosts` | exit | (unspecified) | disposition costs | n/a | Runner: aggregate `saleCosts` | **BYPASSED** |
| `exit.exitTransferTax` | exit | (unspecified) | `dispositionDocStamps` | n/a | Runner: FL formula (`DEF_FL_DOC_PCT`, `DEF_FL_MIA_DOC_PCT`) hardcoded | **BYPASSED** |

**Tier-population status for all lines: PHANTOM.** No line has ever been populated via the LIUS tier system in production. The tier-resolution, collision detection, and evidence output of the LIUS engine are architecturally complete but have zero execution history.

**Fallback telemetry:** None. No logger call, no metric emission, no alert when the bypass path is taken. The bypass is silent — callers receive a number with no indication that the LIUS resolution chain was never consulted.

**Development-specific LIUS rules (e.g., `exitCapRate.yaml:hardRules[condition: "development"]`):** Not executed. Development exit cap → same bridge fallback of `0.065`.

---

## Part 5 — UI Correspondence and Mock Data Audit

### 5.1 Frontend Pro Forma Surfaces

| Surface | Route / File | Data source | Q4 Tag |
|---|---|---|---|
| ProFormaSummaryTab | `financial-engine/ProFormaSummaryTab.tsx` | Engine A: `GET /api/v1/deal-assumptions/:dealId` → `data.proforma.year1` | WIRED (Engine A) |
| AssumptionsTab | `financial-engine/AssumptionsTab.tsx` | Engine A: `GET /api/v1/deal-assumptions/:dealId` → `data.assumptions` + `proforma_assumptions` current values | WIRED |
| ProjectionsTab | `financial-engine/ProjectionsTab.tsx` | Engine A: `data.projections` (re-derived from Y1 × growth, per-year overrides ignored — PF-02) | WIRED but PF-02 |
| DealTermsTab | `financial-engine/DealTermsTab.tsx` | Engine A: `data.dealTerms` (purchase price, exit cap, hold period, strategy) | WIRED |
| ReturnsTab | `financial-engine/ReturnsTab.tsx` | Engine A: `data.returns` (IRR, EM, CoC, LP/GP) | WIRED (LP/GP defaults 90/10 — PF-11) |
| DebtTab | `financial-engine/DebtTab.tsx` | Engine A: `data.debt` + `capitalStructureMockData` (see below) | MIXED — PF-MD-1 |
| TaxesTab | `financial-engine/TaxesTab.tsx` | Engine A: `data.taxes` | WIRED |
| S&U Tab | `financial-engine/SourcesUsesTab.tsx` | Engine A: `data.sourcesUses` | WIRED |
| UnitMixTab | `financial-engine/UnitMixTab.tsx` | Engine A: `data.rentRollSummary` | WIRED (GPR flag gap — PF-08) |
| `ProFormaTab.tsx` (legacy) | `components/deal/sections/ProFormaTab.tsx` | Engine B: `GET /api/v1/deals/:dealId/financials` | WIRED (Engine B) |
| `FinancialSection.tsx` (active) | `components/deal/sections/FinancialSection.tsx` | Engine A (confirmed at ProFormaSummaryTab) | WIRED |
| `FinancialSection.tsx.backup` | `.backup` — NOT compiled | `financialMockData` import in backup | N/A — inactive |

### 5.2 Mock Data Scan — Import Statements

A systematic check of import statements in all Pro Forma UI surfaces:

| File | Mock data import found? | Which file | Active? |
|---|---|---|---|
| `frontend/src/pages/development/financial-engine/*.tsx` | **No** (all 8 tab files checked) | — | n/a |
| `frontend/src/components/deal/sections/ProFormaTab.tsx` | No | — | n/a |
| `frontend/src/components/deal/sections/FinancialSection.tsx` | **No** (active file) | — | n/a |
| `frontend/src/components/deal/sections/FinancialSection.tsx.backup` | **YES** | `financialMockData` | **INACTIVE** (.backup) |
| `frontend/src/components/deal/sections/DebtTab.tsx` | **YES** | `capitalStructureMockData` | **ACTIVE** — PF-MD-1 |
| `frontend/src/components/deal/sections/DebtSection.legacy.tsx` | YES | `debtMockData` | **INACTIVE** (.legacy) |
| `frontend/src/data/opusContextData.ts` | **YES** | `financialMockData` | ACTIVE — but opusContextData is consumed by OpusAI panel only |

**Finding PF-MD-1:** `DebtTab.tsx:21` actively imports `capitalStructureMockData` from `'../../../data/capitalStructureMockData'`. This is an active Pro Forma surface import of mock data.

### 5.3 Mock Data Scan — Inlined Hardcoded Arrays

Checked for CE-04 pattern (hardcoded arrays inlined in Pro Forma UI files rather than imported):

| File | Inlined hardcoded values found? | Detail |
|---|---|---|
| `financial-engine/TaxesTab.tsx:524` | Note only — comment says "do not fall back to a hardcoded value" for marginal rate | No hardcoded array; comment confirms engine-computed value is used |
| `financial-engine/AssumptionsTab.tsx:238` | Note only — `growthPct fallback` reference | Fallback is a prop default, not a hardcoded Pro Forma constant |
| `financial-engine/types.ts:567` | `millageSource: 'hardcoded'` enum value | Enumerates the possible state where live millage data is unavailable; runner uses `DEF_MILLAGE = 0.0218` as hardcoded constant |
| `frontend/src/data/financialMockData.ts` | **YES** — full hardcoded NOI series, sensitivity matrix, waterfall tiers, income statement | Active file imported by opusContextData; NOT imported by F9 financial engine tabs |

**`financialMockData.ts` content inventory (Pro Forma risk):**
- `acquisitionIncomeStatement`: 12 rows including `{ label: 'Net Operating Income', value: 3700000 }` — hardcoded
- `acquisitionProjectionData`: 10-year NOI/cashFlow/equityValue/occupancy array — hardcoded
- `sensitivityScenarios`: 5 scenarios with hardcoded `noiImpact` values
- `performanceVariances`: budget vs actual OpEx variances — hardcoded
- Equivalent `performance*` variants for performance mode

**Risk assessment:** `financialMockData.ts` is NOT imported by the F9 financial engine tabs (ProFormaSummaryTab, DebtTab, etc.) or by the active FinancialSection.tsx. Its only active import is `opusContextData.ts:57` which feeds the Opus AI panel — a natural-language context feed, not a number-rendering surface. The mock data does not flow into any displayed Pro Forma number.

**`capitalStructureMockData.ts` import in `DebtTab.tsx` (PF-MD-1):** This IS an active import in the F9 Debt Tab. Risk depends on whether DebtTab renders from this mock data or from Engine A's `data.debt` response. The import exists; whether it's actually rendered or just imported as a type reference requires a line-level read (not performed in this audit as it falls within the Debt subsystem scope, not the Pro Forma subsystem).

---

## Part 6 — Cross-Module Alignment

### 6.1 M07 Traffic → Pro Forma

- `subject_traffic_history` is read for `subjectHistory` field in Engine B. Values include `current_state.vacancyPct` and `current_state.rentGrowthPct`.
- These calibrated values do **NOT** feed into the OSRow vacancy or rent growth used for projection. `buildTrafficProjection()` returns all-null stub.
- `getDealFinancials:2545` reads `proforma_assumptions.vacancy_current` (which can be set by M07 calibration via `calculateVacancyAdjustment`) → this IS the M07→Pro Forma path for vacancy, but it bypasses the LayeredValue resolution in `deal_assumptions.year1.vacancy_pct`.
- **Net result:** M07 vacancy signal reaches the projection loop via `proforma_assumptions.vacancy_current ÷ 100`, but the OSRow display (Year 1) uses `deal_assumptions.year1.vacancy_pct.resolved`, creating a split display where the Year-1 summary and the projection years may disagree.

### 6.2 Rate Environment / OperatorStance → Pro Forma

- OperatorStance `leasingCostTreatment` modulates concessions in Engine B only (PF-16).
- OperatorStance `underwritingPosture`, `rateEnvironment`, `cyclePosition` define 15 modulation rules but none of these rules are applied in either Engine A or Engine B. The modulation rules exist in `backend/src/types/operator-stance.ts` and `backend/src/services/operatorStance.service.ts` — they are applied when `operatorStanceService.reblend()` is called, which writes to `proforma_assumptions.*_current`. This is the only channel from OperatorStance to the Pro Forma numbers.
- **Net result:** OperatorStance modulates `proforma_assumptions.*_current` fields (via `reblend()`), which flow into Engine A's growth rate reads. This IS wired for growth rates. Not wired for Year-1 OSRows (seeder LayeredValues are not modulated).

### 6.3 LIUS → Pro Forma

As documented in Part 4: completely bypassed. LIUS output does not reach any Pro Forma path.

### 6.4 Cashflow Agent → Pro Forma

The Cashflow Agent (`backend/src/agents/cashflow/cashflow.agent.ts`) receives Pro Forma data via the `getDealFinancials` response shape (Engine A). It reads `fetch_operator_stance` as a declared tool. Per Replit.md: "Consumer audit (Task #619/#620): Cashflow Agent prompt builder, JEDI Score weights, sub-strategy library, and OperatorStance service currently have zero reads of either LV field — null cannot reach them today." This means the Cashflow Agent is insulated from null `exit_strategy_lv` / `investment_strategy_lv` LayeredValues (correct behavior), but it also inherits all Engine A deficiencies (PF-02 per-year override break; PF-05 unit convention; PF-06 LIUS bypass).

---

## Part 7 — Consolidated Findings

### PF-01 — Dual-Engine Architecture

**Priority:** P0 · **Effort:** L · **Phase:** A  
Two independent production engines serve Pro Forma data on different routes with different shapes and different business logic. A concession modulation fix in Engine B is invisible to Engine A. See Architecture Map for full details.

---

### PF-02 — Per-Year Override Break

**Priority:** P0 · **Effort:** M · **Phase:** A  
**Prior reference:** `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 3 🔴 RED  
Per-year dollar overrides (`payroll:yr2`, `gpr:yr2`, etc.) persisted to `deal_assumptions.per_year_overrides` are never consumed by `getDealFinancials`'s projections loop. Loop at `proforma-adjustment.service.ts:3285–3310`: `payroll = Math.round(payrollY1 × opexMult)` — no override lookup. Affects all three deal model types equally.

---

### PF-03 — Bad Debt Dollar Display Mismatch

**Priority:** P0 · **Effort:** S · **Phase:** A  
**Prior reference:** `PROFORMA_MATH_AUDIT.md` MATH-01  
Display row: `GPR × bad_debt_pct` (`proforma-adjustment.service.ts:1964`). Seeder/EGI formula deducts from `(NRI + other_income)`. Overstates displayed bad debt by ~35 % for a typical 3.34 % rate.

---

### PF-04 — No Transaction Boundary Between Tables

**Priority:** P1 · **Effort:** M · **Phase:** A  
Five writers for `proforma_assumptions.*_current`; two writers for `deal_assumptions.year1`. No shared transaction. See 3.1 for all writer file:line evidence.

---

### PF-05 — Whole-Pct / Decimal Convention Split

**Priority:** P1 · **Effort:** S · **Phase:** A  
`proforma_assumptions`: whole-pct (3.000 = 3%). All other consumers: decimal (0.03 = 3%). `getDealFinancials` correctly divides all four rate fields by 100 (lines 2545, 2565, 2575, exit cap). Any writer that writes a decimal to `proforma_assumptions` will silently produce 0.03 % growth. `deal_assumptions.exit_cap` scalar column stores decimal (0.0500) while `proforma_assumptions.exit_cap_baseline` stores whole-pct (5.25) — same field, two tables, two conventions, both DISPLAY_ONLY from the live engine's perspective but visually confusing.

---

### PF-06 — LIUS Fully Orphaned (All 21 Lines)

**Priority:** P1 · **Effort:** L · **Phase:** A  
`runLIUSEngine` has no production caller. All 21 LIUS line schemas — 7 OpEx, 7 Capital, 6 Exit, 1 Reserves — are bypassed. Pro Forma never receives LIUS tier-resolved values for any line. Insurance loading, property tax reassessment modeling, exit cap trajectory, and all capital reserve line items are derived from static norms or bridge hardcodes instead of the sophisticated LIUS resolution chain. Fallback is silent (no telemetry).

---

### PF-07 — Tier 1–3 Layered Growth Engine Not Wired

**Priority:** P1 · **Effort:** L · **Phase:** A  
`proforma-projection.service.ts`, `rent-growth.ts`, `opex-growth.ts`, `revenue-formulas.ts` — production callers: zero. Test-only. Live path uses flat scalar growth for all years, all model types.

---

### PF-08 — Unit Mix GPR Activation Gap

**Priority:** P1 · **Effort:** S · **Phase:** A  
`da:use_unit_mix_for_gpr` flag not settable from any UI. Unit Mix Tab edits do not affect GPR. Affects all three model types.

---

### PF-09 — Other Income Stale-Cache Pattern

**Priority:** P1 · **Effort:** S · **Phase:** A  
**Prior reference:** `PROFORMA_MATH_AUDIT.md` MATH-02  
`other_income_per_unit.resolved` expected annual-per-unit; display multiplies by `totalUnits × 12`. 12× inflation if seeded from monthly total (confirmed Bishop: 904.14 stored vs ~$75/unit correct annual).

---

### PF-10 — `landscaping` Phantom Row

**Priority:** P2 · **Effort:** S · **Phase:** A  
**Prior reference:** `PROFORMA_SURFACE_AUDIT.md` NW-1  
In `CTRL_ORDER` display list but absent from seeder `OPEX_FIELDS`. T12 landscaping items route to Custom OpEx bucket. Named row always blank.

---

### PF-11 — No UI for LP/GP Split

**Priority:** P2 · **Effort:** S · **Phase:** A  
`wf:lpShare`/`wf:gpShare` only via raw API PATCH. Default 90/10 for all deals. No UI control.

---

### PF-12 — ProForma Templates Never Applied

**Priority:** P2 · **Effort:** M · **Phase:** A  
`proforma_templates` table populated by CRUD but no route applies a template to a deal's `deal_assumptions.year1`. Template selection is cosmetic.

---

### PF-13 — Concessions Hardcoded Zero in LLM Bridge

**Priority:** P2 · **Effort:** S · **Phase:** A  
`proforma-assumptions-bridge.ts:241`: `const concessions = 0`. Seeder resolves `concessions_pct` correctly. Engine C (LLM path) always models zero concessions regardless of seed data.

---

### PF-14 — `deal_assumptions` Scalar Columns Are Dead Weight

**Priority:** P3 · **Effort:** S · **Phase:** A  
~15 scalar columns written at creation, never read by either live engine. `exit_cap` column stores decimal while `proforma_assumptions.exit_cap_baseline` stores whole-pct for same field.

---

### PF-15 — Traffic Projection Stub

**Priority:** P3 · **Effort:** L · **Phase:** B  
`buildTrafficProjection()` returns all-null struct. Real M07 data in `subject_traffic_history` not plumbed in. `trafficProjection.calibrated.vacancyPct` spec requirement unmet.

---

### PF-16 — OperatorStance Missing in Engine A

**Priority:** P3 · **Effort:** S · **Phase:** A  
Concession modulation (CAPITALIZED → 0, HYBRID → partial) in Engine B only. Engine A always returns raw seeded concessions.

---

### PF-D1 — Development `dealMode` Defaulting to `'existing'`

**Priority:** P2 · **Effort:** S · **Phase:** A  
`proforma-assumptions-bridge.ts:387`: `dealType: a.modelType || 'existing'`. Development and redevelopment deals that do not explicitly set `modelType` in `ProFormaAssumptions` receive acquisition-mode integrity checks (hard errors for negative NOI instead of warnings). A development deal with negative Y1 NOI could fail the Engine C integrity check when it should warn.

---

### PF-MD-1 — `capitalStructureMockData` Active Import in DebtTab

**Priority:** P3 · **Effort:** S · **Phase:** A  
`frontend/src/components/deal/sections/DebtTab.tsx:21` imports `capitalStructureMockData`. Whether mock values are rendered vs used as type stubs only requires a line-level verification. Risk: if any rendering code falls through to mock data, the Debt Tab displays fictional capital structure figures.

---

## Part 8 — Remediation Priority Table

| ID | Description | Priority | Effort | Phase | Engine(s) |
|---|---|---|---|---|---|
| PF-01 | Dual-engine — no shared contract | P0 | L | A | A, B |
| PF-02 | Per-year overrides never consumed | P0 | M | A | A |
| PF-03 | Bad debt display uses GPR not EGI | P0 | S | A | A |
| PF-04 | No transaction boundary between tables | P1 | M | A | A, B |
| PF-05 | Whole-pct / decimal split in proforma_assumptions | P1 | S | A | A |
| PF-06 | All 21 LIUS lines bypassed — silent | P1 | L | A | A, B, C |
| PF-07 | Tier 1–3 layered growth engine never wired | P1 | L | A | A, B |
| PF-08 | Unit mix GPR flag has no UI toggle | P1 | S | A | A, B |
| PF-09 | Other income stale-cache 12× inflation | P1 | S | A | A, B |
| PF-D1 | Development dealMode defaults to 'existing' | P2 | S | A | C |
| PF-10 | `landscaping` phantom row | P2 | S | A | A, B |
| PF-11 | No UI for LP/GP split (90/10 hardcoded) | P2 | S | A | A |
| PF-12 | ProForma templates never applied to deals | P2 | M | A | A, B |
| PF-13 | Concessions hardcoded 0 in LLM bridge | P2 | S | A | C |
| PF-MD-1 | capitalStructureMockData active import in DebtTab | P3 | S | A | B |
| PF-14 | deal_assumptions scalar cols are dead weight | P3 | S | A | — |
| PF-15 | Traffic projection all-null stub | P3 | L | B | B |
| PF-16 | OperatorStance concession modulation missing in Engine A | P3 | S | A | A |

---

## Appendix A — File-to-Table Cross-Reference

| File | Table written | Table read |
|---|---|---|
| `proforma-seeder.service.ts` | `deal_assumptions.year1` | `deals`, `apartment_market_snapshots` |
| `proforma-adjustment.service.ts` (class) | `proforma_assumptions` | `proforma_assumptions` |
| `proforma-adjustment.service.ts` (`getDealFinancials`) | — | `deal_assumptions.year1`, `proforma_assumptions` |
| `financials-composer.service.ts` | — | `deal_assumptions.year1`, `deals.operator_stance` |
| `financial-model-engine.service.ts` | model cache, `deal_versions` | `deals.deal_data`, `deal_assumptions.year1` |
| `proforma-assumptions-bridge.ts` | — | ProFormaAssumptions struct (in-memory) |
| `deterministic-model-runner.ts` | — | ModelAssumptions struct (in-memory) |
| `proforma-projection.service.ts` | — | ProjectionInputs struct (test-only) |
| `proforma-template.service.ts` | `proforma_templates` | `proforma_templates` |
| `deal-versions.service.ts` | `deal_versions` | `deal_versions` |
| `capsule-bridge.routes.ts` | `proforma_assumptions` | — |
| LIUS `engine.ts` (`runLIUSEngine`) | — | schema YAMLs (test-only; no production caller) |

---

## Appendix B — Known-Deal Verification (464 Bishop, 232 units)

From `PROFORMA_MATH_AUDIT.md` and `F9_DATA_FLOW_AUDIT_PHASE1.md`:

| Assumption | Resolved source | Resolved value | UI agrees? |
|---|---|---|---|
| GPR | override | $4,901,400 | ✓ |
| Vacancy | rent_roll | 19.83 % | ✓ (high — pre-stabilized) |
| Concessions | t12 | 7.78 % | ✓ |
| Bad debt | rent_roll | 3.34 % → display $163K vs EGI deduction ~$121K | ✗ PF-03 |
| Other income/unit | override (stale) | 904.14 /unit annual → display $2.5M vs real ~$210K | ✗ PF-09 |
| Payroll | override | $324,800 | ✓ |
| Rent growth | proforma_assumptions | 3.5 % (baseline — no override active) | ✓ |
| OpEx growth | proforma_assumptions | 2.8 % (baseline) | ✓ |
| Purchase price | deal_data.purchase_price | null → budget null → all null | FIXED Task #623 |
| Exit cap | proforma_assumptions.exit_cap_current | 5.25 % (default — no event adjustment) | ✓ |
| Per-year overrides | per_year_overrides | `payroll:yr2=334544, gpr:yr2=5048442` etc. | ✗ PF-02 — ignored |

---

*Audit complete. No code was changed. All findings are read-only observations.*
