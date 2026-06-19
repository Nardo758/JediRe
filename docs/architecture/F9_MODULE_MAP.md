# F9 Pro Forma — Module Map

**Status:** Authoritative reference for Phase 2 derivation work  
**Created:** May 2026 (compiled from PROFORMA_SUBSYSTEM_AUDIT.md, PROFORMA_MATH_AUDIT.md,
F9_DATA_FLOW_AUDIT_PHASE1.md, F9_TIER1_BLOCKERS_AUDIT.md, M09_PROFORMA_SPEC.md)  
**Prior-art audit docs:** See `docs/architecture/` for full evidence trail on each finding

---

## 1. Module Inventory

### 1.1 F9 surface (frontend tabs)

| Tab | File | Data source engine |
|---|---|---|
| Pro Forma Summary | `financial-engine/ProFormaSummaryTab.tsx` | Engine A |
| Assumptions (General + Leasing) | `financial-engine/AssumptionsTab.tsx` + `LeasingAssumptionsTab.tsx` | Engine A |
| Projections | `financial-engine/ProjectionsTab.tsx` | Engine A |
| Deal Terms | `financial-engine/DealTermsTab.tsx` | Engine A |
| Returns | `financial-engine/ReturnsTab.tsx` | Engine A |
| Debt | `financial-engine/DebtTab.tsx` | Engine A (partial — see GAP-11) |
| Taxes | `financial-engine/TaxesTab.tsx` | Engine A |
| Sources & Uses | `financial-engine/SourcesUsesTab.tsx` | Engine A |
| Unit Mix | `financial-engine/UnitMixTab.tsx` | Engine A |
| Property Card (legacy) | `components/deal/sections/ProFormaTab.tsx` | ~~Engine B~~ — deprecated; surface should migrate to Engine A or be removed |

### 1.2 Backend computation engines

| ID | Entry point | Route | Reads from | Status |
|---|---|---|---|---|
| **Engine A** (F9 primary — canonical) | `getDealFinancials()` in `proforma-adjustment.service.ts` | `GET /api/v1/deals/:dealId/financials` | `deal_assumptions.year1` JSONB + `proforma_assumptions` scalars + traffic projections | **Active** — sole production engine |
| **Engine B** (financials / property card) | ~~`composeDealFinancials()`~~ deleted from `financials-composer.service.ts` | ~~`GET /api/v1/deals/:dealId/financials`~~ | — | **Deleted 2026-06-18** — unique fields migrated to Engine A; body and all helpers removed (commit `d1bbf23a7`) |
| **Engine C** (LLM / deterministic) | `financialModelEngine.buildModel()` | `POST /api/v1/financial-model` | LLM ProFormaAssumptions envelope | Active — agent pipeline |
| **Engine D** (orphaned Tier 1–3) | `projectProforma()` in `proforma-projection.service.ts` | **none** — test-only | ProjectionInputs struct | Orphaned — no production callers |

### 1.3 Backend seeder / writer services

| Service | File | Role |
|---|---|---|
| **Seeder** | `proforma-seeder.service.ts` (1 514 lines) | One-pass seed of `deal_assumptions.year1` LayeredValue JSONB; re-runs after extraction capsule writes (`forceReseed` — wired in `data-router.ts:1579`) |
| **Override writer** | `proforma-adjustment.service.ts` → `applyFinancialsOverride` | Writes individual LayeredValue overrides to `deal_assumptions.year1` |
| **ProFormaAdjustmentService class** | `proforma-adjustment.service.ts:1–1377` | CRUD for `proforma_assumptions` table (growth rate scalars) |
| **LIUS engine** | `backend/src/services/lius/engine.ts` | Tier-resolved line validation — **no production callers** (see GAP-06) |
| **Version writer** | `proforma/deal-versions.service.ts` | Snapshots to `deal_versions`; Engine C path only |

---

## 2. Storage Architecture

### 2.1 Tables and roles

| Table | Convention | Live reader(s) | Notes |
|---|---|---|---|
| `deal_assumptions.year1` JSONB | **Decimal** (0.03 = 3 %) LayeredValue tree | Engines A and B | Primary per-field source of truth |
| `deal_assumptions.per_year_overrides` JSONB | Mixed — dollar amounts at nominal scale; pct fields decimal | Engine A (projections loop via `projPyOvr()`) | Year-1 and year 2+ operator overrides; also holds traffic, tax, debt, waterfall keys |
| `proforma_assumptions` | **Whole-pct** (3.0 = 3 %) | Engine A only (divides by 100 at read) | Growth rate scalars (rent, opex, vacancy, exit cap); 4–5 independent writers per field |
| `deal_assumptions` scalar cols | Mixed | **Neither engine** — DISPLAY_ONLY | Written at creation, never read by A or B |
| `proforma_templates` | Decimal | **Neither engine** | Template CRUD; never applied to a deal |
| `deal_versions` | Blob snapshot | Engine C / LLM path | Save-driven versioning |

### 2.2 LayeredValue resolution chain

Each field in `deal_assumptions.year1` is a `LayeredValue<T>` with named layers:

```
priority order: override > [field-specific priority layers] > platform

field-specific examples:
  gpr:                t12 → rent_roll (om via broker capsule)
  loss_to_lease_pct:  t12 → rent_roll
  vacancy_pct:        rent_roll → t12
  concessions_pct:    t12 → rent_roll
  bad_debt_pct:       t12
  real_estate_tax:    tax_bill → t12
  other_income_p/u:   rent_roll → t12 → om
  payroll/opex lines: t12 → platform (state-adjusted NMHC norms)
```

Defined in `FIELD_PRIORITIES` at `proforma-seeder.service.ts:297`.

### 2.3 Unit convention map

| Location | Convention | Example (3 % rent growth) |
|---|---|---|
| `proforma_assumptions.*_baseline/current` | Whole-pct | `3.000` — divided by 100 at Engine A read |
| `deal_assumptions.year1.*` LayeredValue | Decimal | `0.030` — used directly |
| `deal_assumptions` scalar cols | Whole-pct | `3.00` — DISPLAY_ONLY |
| `proforma_templates.*_rate` | Decimal | `0.030` |
| `ModelAssumptions` (Engine C) | Decimal | `0.030` |

---

## 3. Source Priority Map

How each F9 assumption reaches the Pro Forma column (Year 1 OSRow):

```
Data source priority (high → low):
  1. Operator override        (deal_assumptions.year1[field].override)
  2. T12 extraction           (deal_assumptions.year1[field].t12)
  3. Rent roll extraction     (deal_assumptions.year1[field].rent_roll)
  4. Tax bill extraction      (deal_assumptions.year1[field].tax_bill)
  5. OM / broker capsule      (deal_assumptions.year1[field].om)
  6. Platform fallback        (deal_assumptions.year1[field].platform)
     └─ city/state market avg (apartment_market_snapshots)
     └─ state-adjusted norms  (proforma-seeder.service.ts static table)

Overrides persist to: deal_assumptions.per_year_overrides or year1.override layer
Growth rates:         proforma_assumptions.*_current (÷100 at Engine A read)
```

Per-year (yr 2+) dollar overrides checked first by the projections loop via
`projPyOvr(field)` at `proforma-adjustment.service.ts:4498–4501` before falling
back to Y1 × compoundGrowth.

---

## 4. Write Paths

### 4.1 Year-1 assumptions

| Write trigger | Route | Handler | Target field |
|---|---|---|---|
| Initial seed (deal created / extraction received) | internal | `ensureDealAssumptionsSeeded()` + `seedProFormaYear1()` | `deal_assumptions.year1` |
| Operator field edit | `PATCH /api/v1/deals/:dealId/financials/override` | `applyFinancialsOverride` | `deal_assumptions.year1[field].override` |
| Extraction re-seed (forceReseed) | internal (data-router.ts:1579) | `ensureDealAssumptionsSeeded({forceReseed:true})` | `deal_assumptions.year1` (all fields) |
| Unit mix edit | `PATCH /api/v1/deals/:dealId/financials/override` | `applyUnitMixOverride` | `deal_assumptions.unit_mix` + `unit_mix_overrides` |

### 4.2 Growth rate scalars

| Write trigger | Handler | Target |
|---|---|---|
| Deal creation (capsule bridge) | `capsule-bridge.routes.ts` | `proforma_assumptions.*_baseline` and `*_current` |
| Market recalibration | `setMarketBaseline()` / `calculateRentGrowthAdjustment()` | `proforma_assumptions.*_current` |
| Operator override | `overrideAssumption()` | `proforma_assumptions.*_current` + `*_override` |
| OperatorStance reblend | `operatorStanceService.reblend()` | `proforma_assumptions.*_current` |

---

## 5. Cross-Module Wiring

### 5.1 Upstream feeders → F9 Year-1 seed

| Module | Field fed | Mechanism |
|---|---|---|
| M18 Documents (T12 extraction) | GPR, vacancy, OpEx all lines | Seeder reads `deal_data.extraction_t12` |
| M18 Documents (Rent Roll extraction) | GPR, vacancy, concessions, other income | Seeder reads `deal_data.extraction_rent_roll` |
| M18 Documents (OM extraction) | Other income, reserves, broker rent | Seeder reads `deal_data.extraction_om` |
| M26 Tax | Real estate tax | Tax service writes to `deal_assumptions.year1.real_estate_tax` |
| M27 Sale Comps | exit cap baseline | `capsule-bridge.routes.ts` → `proforma_assumptions.exit_cap_current` |

### 5.2 Upstream feeders → Projections (growth rates)

| Module | Field fed | Mechanism |
|---|---|---|
| M05 Market (rent growth) | `rent_growth_current` | `calculateRentGrowthAdjustment()` |
| M07 Traffic (vacancy) | `vacancy_current` | `calculateVacancyAdjustment()` → `proforma_assumptions` |
| M35 Events (correlation deltas) | growth rate adjustments | Correlation Engine → upstream modules → `proforma_assumptions.*_current` |
| OperatorStance (reblend) | all 4 growth scalars | `operatorStanceService.reblend()` → `proforma_assumptions.*_current` |

### 5.3 F9 → downstream

| Consumer | Fields read | Mechanism |
|---|---|---|
| M11 Debt (two-pass) | NOI stub | Engine A → capital-structure-adapter.ts |
| M14 Risk (two-pass) | key_financials | Engine A → risk score recalculation |
| Cashflow Agent | full getDealFinancials response | Engine A, via `fetch_operator_stance` tool |
| Excel export | projections, returns, S&U | `f9-financial-export.service.ts` reads Engine A response |

---

## 6. Projections Loop — Current Behavior

Engine A inline projections (lines 4451–4600 of `proforma-adjustment.service.ts`):

```
for yr = 1 to holdYears:
  rentGrowthStep = perYear[yr-1].rentGrowthPct
               ?? layeredEngine[yr-1].rentGrowth.value
               ?? rentGrowthStabilized
               ?? 0.03

  opexStep(line) = layeredEngine[yr].opex[line].growthTuned
                ?? flat opexGrowthRate

  projPyOvr(field) = per_year_overrides['field:yrN'].value (or null)

  gpr      = projPyOvr('gpr')      ?? round(runGpr × (1 + rentGrowthStep))
  payroll  = projPyOvr('payroll')  ?? round(runPayroll × (1 + payrollStep))
  [all other opex lines — same pattern]
  ...
```

Per-year dollar overrides are consumed (checked first, formula fallback second).
The per-line layered OPEX growth engine is wired when `_layeredByYear` produces
results; falls back to flat `opexGrowthRate` otherwise.

---

## 7. Previously Resolved Issues (Reference)

These gaps were open in prior audits and have since been closed:

| Prior ID | Finding | Resolution | Evidence |
|---|---|---|---|
| PF-02 | Per-year projection overrides never consumed | **FIXED** — `projPyOvr()` at line 4498 reads `per_year_overrides['field:yrN']` before formula fallback | `proforma-adjustment.service.ts:4498–4544` |
| UNIT-01 | `opex_growth_current` missing ÷100 | **FIXED** — line 2997 divides by 100: `+(parseFloat(v) / 100).toFixed(4)` | `proforma-adjustment.service.ts:2996–2997` |
| P2-A | `da:use_unit_mix_for_gpr` flag had no UI toggle | **FIXED** — toggle in UnitMixTab.tsx | `F9_TIER1_BLOCKERS_AUDIT.md` ITEM 2 |
| P3-A | Ancillary income stale cache / 12× inflation | **FIXED** — forceReseed wired in data-router.ts:1579; ancillary math confirmed correct for live deals | `F9_TIER1_BLOCKERS_AUDIT.md` ITEM 3; `TODO_F9_DATA_FLOW.md` Phase 0 correction |
| P1-B/C | Terminal CapitalTab hardcoded $45M / 2% closing | **FIXED** | `F9_TIER1_BLOCKERS_AUDIT.md` ITEM 1 |
| P2-B | LP/GP split — no write surface | **FIXED** — WaterfallTab is canonical write surface; cross-reference display in Deal Terms + Returns | `F9_TIER1_BLOCKERS_AUDIT.md` ITEM 4 |

---

## 8. Open Gaps — Phase 2 Readiness

### 8.1 Classification key

| Label | Meaning |
|---|---|
| **Phase 1 blocker** | Must be resolved before Phase 2 derivation begins; unresolved = wrong derivation targets or wrong formulas |
| **Phase 2 concern** | Must be addressed as part of Phase 2 derivation work itself |
| **Explicitly deferred** | Not relevant to Phase 1 or Phase 2 derivation scope |

---

### 8.2 Open Gaps

---

#### GAP-01 — Dual-Engine Architecture: No Authoritative Phase 2 Write Target Declared

**Prior ID:** PF-01  
**Classification:** PHASE 1 BLOCKER  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-01

**Finding:**
Two independent production engines serve Pro Forma data on different routes
with different response shapes and different business logic:
- Engine A: `GET /api/v1/deal-assumptions/:dealId` (F9 tabs)
- ~~Engine B: `GET /api/v1/deals/:dealId/financials` (property card / legacy)~~ — **deleted 2026-06-18**

A fix or derivation applied to Engine A's data contract is not visible to
~~Engine B consumers, and vice versa.~~ Phase 2 derivation writes LayeredValue
results to `deal_assumptions.year1` — Engine A is the sole authoritative Phase 2 target.
consumers receive derived values.

**Phase 2 risk (historical — resolved 2026-06-18):**
~~If Phase 2 derivation writes to Engine A's storage but doesn't account for
Engine B, the property card and any Engine B surface will show stale
pre-derivation values.~~ Engine B has been deleted. All surfaces now read from
Engine A. Phase 2 derivation targets `deal_assumptions.year1` exclusively.

**RESOLUTION (Phase 1 decision — documented here):**

> **Engine A (`getDealFinancials`) is the exclusive Phase 2 write target.**
>
> - Phase 2 derivation writes results to `deal_assumptions.year1` LayeredValue
>   JSONB via the seeder / override path. This is Engine A's authoritative source.
> - ~~Engine B reads the same `deal_assumptions.year1` JSONB, so derived values
>   propagate to Engine B automatically on the next `/financials` fetch.~~
>   Engine B deleted 2026-06-18. All surfaces now read from Engine A.
> - Engine C (LLM path) operates independently; Phase 2 does not target Engine C.
> - Engine D (Tier 1–3 projection service) is the Phase 2 growth wiring target
>   (see GAP-06); Phase 2 wires it INTO Engine A.

**Status:** ✅ FULLY RESOLVED 2026-06-18 — Engine B deleted. Unique fields (`concessionRecognition`, `extractionRentRoll`, `subjectHistory`) migrated to Engine A. `PATCH /financials/override` now calls `getDealFinancials` directly. `composeDealFinancials` and all internal helpers removed from `financials-composer.service.ts` (commit `d1bbf23a7`).

---

#### GAP-02 — Bad Debt Display Formula Diverges from Seeder (EGI vs GPR)

**Prior ID:** PF-03  
**Classification:** PHASE 1 BLOCKER  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-03; `PROFORMA_MATH_AUDIT.md` MATH-01

**Finding:**
Two formulas for bad debt co-exist in production:

| Location | Formula | Effect |
|---|---|---|
| Seeder / EGI computation | `bad_debt_deduction = (NRI + OtherIncome) × bad_debt_pct` | Correct industry convention — bad debt applied to collectible income |
| ProFormaSummaryTab display row | `bad_debt_display = GPR × bad_debt_pct` | Inflated — GPR is ~35 % larger than EGI for a typical deal |

At 3.34 % bad debt rate (464 Bishop), the display overstates bad debt by
~$38 K/year vs the actual EGI-based deduction. The display row and the EGI
computation disagree on the same deal.

**Phase 2 risk:**
Phase 2 derivation will derive `bad_debt_pct` using a formula. If the wrong
base (GPR vs EGI) is chosen, the derived rate will produce a correct EGI
deduction but a misleading display row, or vice versa. Must decide canonical
formula before Phase 2 begins.

**RESOLUTION (Phase 1 decision — documented here):**

> **Canonical formula: EGI-based.** Bad debt is a loss on collectible income,
> not on gross rent. The seeder formula is correct. The display row in
> `ProFormaSummaryTab` has an arithmetic error.
>
> - Phase 2 derivation targets the EGI-based formula. Derived `bad_debt_pct`
>   values will be correct when applied to EGI.
> - The ProFormaSummaryTab display fix (change multiplier from GPR to NRI +
>   OtherIncome) is a Phase 2 code change, not Phase 1. Phase 2 must include it
>   to prevent a diverging display after derivation goes live.
> - Display fix: `proforma-adjustment.service.ts:1964` — change `toDollarRow`
>   multiplier from `gprForDollars` to `nriPlusOtherIncome`.

**Status:** RESOLVED — canonical formula documented. Code fix tagged for Phase 2.

---

#### GAP-03 — No Transaction Boundary Between `proforma_assumptions` and `deal_assumptions`

**Prior ID:** PF-04  
**Classification:** PHASE 2 CONCERN  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-04

**Finding:**
`proforma_assumptions.*_current` has 4–5 independent writers
(`calculateRentGrowthAdjustment`, `overrideAssumption`, `setMarketBaseline`,
`resetToMarket`, capsule-bridge). `deal_assumptions.year1` has 2+ writers
(seeder, applyFinancialsOverride). No shared transaction boundary exists
between the two tables. Concurrent requests can write inconsistent state —
e.g., OperatorStance reblend writes `rent_growth_current` while a user
override writes `year1.gpr`, with no isolation.

**Phase 2 risk:**
Phase 2 adds another writer (derivation pipeline). The race surface grows.
Mitigate in Phase 2 via advisory locks or serialized derivation runs.

**Status:** OPEN — acknowledged; mitigate in Phase 2 implementation.

---

#### GAP-04 — `landscaping` Phantom Row in ProFormaSummaryTab

**Prior ID:** PF-10  
**Classification:** EXPLICITLY DEFERRED  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-10; `PROFORMA_MATH_AUDIT.md` §2

**Finding:**
`landscaping` is in `CTRL_ORDER` display list (ProFormaSummaryTab:658) but absent
from the seeder's `OPEX_FIELDS`. T12 landscaping items route to the Custom OpEx
bucket. The named `landscaping` OSRow is always blank/zero.

**Deferral rationale:** Display-only correction. Not a derivation input, not a
write path. No impact on NOI accuracy or Phase 2 derivation targets. Defer to a
display cleanup pass.

**Status:** DEFERRED — display-only fix, no Phase 2 impact.

---

#### GAP-05 — LIUS Engine Fully Orphaned (All 21 Lines)

**Prior ID:** PF-06  
**Classification:** PHASE 2 CONCERN  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-06, Part 4

**Finding:**
`runLIUSEngine` (`backend/src/services/lius/engine.ts:96`) has no production
caller. All 21 LIUS line schemas — 7 OpEx, 7 Capital, 6 Exit, 1 Reserves —
are architecturally complete but bypassed. Pro Forma never receives
LIUS-tier-resolved values for any line. The bypass is silent (no telemetry,
no fallback flag).

Current bypass for each category:
- OpEx: Seeder uses T12 → NMHC norms (no LIUS tier resolution)
- Reserves: Seeder uses broker capsule → $250/unit platform norm
- Exit cap: Bridge hardcode `toNumber(a.disposition?.exitCapRate, 0.065)`
- Capital lines: Runner aggregate `capexBudget` only

**Phase 2 concern:** Wiring LIUS into Engine A's compute path is the core
deliverable of Phase 2 derivation. Phase 2 calls `runLIUSForLine` per field
and writes resolved values to `deal_assumptions.year1` via the seeder override
path. This gap exists so Phase 2 knows what to wire, not what to skip.

**Status:** OPEN — Phase 2 target. Wire `runLIUSEngine` from Engine A for all
OpEx, Reserves, and Exit fields.

---

#### GAP-06 — Tier 1–3 Layered Growth Engine Not Wired to Production

**Prior ID:** PF-07  
**Classification:** PHASE 2 CONCERN  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-07, §1.5–1.7

**Finding:**
`proforma-projection.service.ts`, `layered-growth/rent-growth.ts`,
`layered-growth/opex-growth.ts`, and `revenue/revenue-formulas.ts` contain
the complete five-component rent growth model and nine-line OPEX model
(spec §6–7 of `f9-proforma-spec.md`). Production callers: zero. Live path
uses flat scalar growth for all years and all model types.

The projections loop in Engine A already calls the layered engine via
`_layeredByYear.get(yr)` (lines 4461–4474) with a flat-scalar fallback —
the wiring scaffold is in place; the layered engine output is missing.

Current live path for projections:
- Rent: `proforma_assumptions.rent_growth_current ÷ 100` (flat scalar)
- OpEx: `proforma_assumptions.opex_growth_current ÷ 100` (flat scalar)

Calibration status: `ASSET_CLASS_SPREAD_BPS` has `calibrationStatus: 'tbd'`
(set 2026-04-29). `RENEWAL_RATE_BASELINES` matrix also `calibrationStatus: 'tbd'`.

**Phase 2 concern:** Wiring the layered growth engine (Phase 2 work §6–7)
requires completing the Engine D→Engine A bridge: `projectProforma()` must
become a production caller with live data inputs (M04 cycle, M05 momentum,
BLS anchors). Calibration backtests (f9-proforma-spec.md §14) must run before
the engine goes live.

**Status:** OPEN — Phase 2 target. Wire Engine D into Engine A. Run calibration
backtests before promoting flat-scalar fallback to layered-engine primary.

---

#### GAP-07 — Development DealMode Defaults to `'existing'` in LLM Bridge

**Prior ID:** PF-D1  
**Classification:** PHASE 2 CONCERN  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-D1

**Finding:**
`proforma-assumptions-bridge.ts:387`:
```typescript
dealType: a.modelType || 'existing'
```
Development and redevelopment deals that do not explicitly set `modelType`
in `ProFormaAssumptions` receive acquisition-mode integrity checks (INV-5,
INV-7 as hard errors instead of warnings). A development deal with negative
Y1 NOI can fail Engine C with a hard error when a warning is the correct
response.

Engine A does not branch on deal type at all — OSRow assembly
is identical for acquisition, development, and redevelopment.

**Phase 2 concern:** Phase 2 derivation must produce deal-type-specific
LayeredValue results (development deals have no T12, different OpEx profiles,
lease-up vacancy ramps). The Engine C bridge default is a separate issue from
Engine A derivation, but Phase 2 derivation logic must explicitly handle
`project_type` branching.

**Status:** OPEN — Phase 2 must implement deal-type branching in derivation
logic. Engine C bridge fix is a separate S-size task.

---

#### GAP-08 — OperatorStance Concession Modulation Missing from Engine A

**Prior ID:** PF-16  
**Classification:** PHASE 2 CONCERN  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-16, §6.2

**Finding:**
OperatorStance `leasingCostTreatment` modulates concessions in Engine A via `applyStanceToFinancials` (`CAPITALIZED` → 0, `HYBRID` → partial reduction). Previously Engine B only; resolved 2026-06-18.
Engine A (`getDealFinancials`) always returns raw seeded `concessions_pct`
regardless of stance. The 15 OperatorStance modulation rules write to
`proforma_assumptions.*_current` via `reblend()` — those flow into Engine A's
growth scalars — but the Year-1 OSRow concession value is not stance-modulated
in Engine A.

**Phase 2 concern:** Phase 2 will derive Year-1 concession values via the LIUS
tier system. Stance modulation should be applied as a post-derivation adjustment
layer in Engine A, consistent with the existing stance→growth-scalar path.

**Status:** OPEN — Phase 2 must apply OperatorStance concession modulation in
Engine A's OSRow assembly.

---

#### GAP-09 — ProForma Templates Never Applied to Deals

**Prior ID:** PF-12  
**Classification:** EXPLICITLY DEFERRED  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-12

**Finding:**
`proforma-template.service.ts` (144 lines) provides full CRUD for the
`proforma_templates` table. No route or service method applies a template
to a deal's `deal_assumptions.year1`. Template selection is cosmetic — it
updates the template record but produces no deal-level effect.

**Deferral rationale:** Template application is a product feature (deals
inherit a starting set of assumption defaults from a named template). Not
a derivation prerequisite. Defer to a product feature task after Phase 2.

**Status:** DEFERRED — product feature, no Phase 2 derivation dependency.

---

#### GAP-10 — Concessions Hardcoded Zero in LLM Bridge (Engine C)

**Prior ID:** PF-13  
**Classification:** EXPLICITLY DEFERRED  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-13

**Finding:**
`proforma-assumptions-bridge.ts:241`: `const concessions = 0`. The Engine C
(LLM / deterministic) path always models zero concessions regardless of seed
data. Engine A correctly resolves `concessions_pct` from the
LayeredValue seed.

**Deferral rationale:** Engine C is the LLM path, not the F9 primary path.
Phase 2 derivation targets Engine A. The Engine C concessions fix is an
isolated S-size task with no derivation dependency.

**Status:** DEFERRED — Engine C only; no Phase 2 Engine A impact.

---

#### GAP-11 — DebtTab Rate Strategy and Debt Products Render Mock Data

**Prior ID:** PF-MD-1  
**Classification:** EXPLICITLY DEFERRED  
**Audit source:** `PROFORMA_SUBSYSTEM_AUDIT.md` §PF-MD-1, §5.2

**Finding:**
`frontend/src/components/deal/sections/DebtTab.tsx:21` imports
`capitalStructureMockData`. The following DebtTab sub-tabs render hardcoded
fictional values from this import:

| Sub-tab | Mock constants used |
|---|---|
| Rate Strategy | `lockVsFloatAnalysis`, `rateForecast`, `currentRates` (fallback) |
| Debt Products | `debtProducts`, `strategyTemplates`, `defaultCapitalStack` |
| Spread Analysis | `spreadAnalysis` |

Lock vs float recommendation, NPV figures, spread analysis, and rate forecast
shown to the operator are not computed from any deal's actual financing terms.

**Deferral rationale:** DebtTab is served by the M11 Capital Structure
Engine, not Engine A. Phase 2 derivation targets Engine A's LayeredValue fields, not the
DebtTab rate-strategy surface. Defer to an M11 completion task.

**Status:** DEFERRED — M11 / DebtTab UX gap; no Phase 2 Engine A impact.

---

### 8.3 Gap Summary Table

| Gap | Prior ID | Classification | Resolution |
|---|---|---|---|
| GAP-01 Dual-engine write target | PF-01 | **PHASE 1 BLOCKER** | ✅ FULLY RESOLVED 2026-06-18 — Engine B deprecated; unique fields migrated to Engine A; PATCH endpoint now calls Engine A |
| GAP-02 Bad debt formula (GPR vs EGI) | PF-03 | **PHASE 1 BLOCKER** | ✅ RESOLVED — EGI-based is canonical; display fix tagged for Phase 2 |
| GAP-03 No transaction boundary | PF-04 | PHASE 2 CONCERN | Mitigate via advisory locks in Phase 2 implementation |
| GAP-04 `landscaping` phantom row | PF-10 | EXPLICITLY DEFERRED | Display-only; no derivation impact |
| GAP-05 LIUS fully orphaned | PF-06 | PHASE 2 CONCERN | Wire `runLIUSEngine` from Engine A (Phase 2 core deliverable) |
| GAP-06 Tier 1–3 growth engine not wired | PF-07 | PHASE 2 CONCERN | Wire Engine D into Engine A; run calibration backtests first |
| GAP-07 Dev dealMode bridge default | PF-D1 | PHASE 2 CONCERN | Phase 2 derivation must handle `project_type` branching |
| GAP-08 OperatorStance only in Engine B | PF-16 | PHASE 2 CONCERN | ✅ RESOLVED — Stance concession modulation (effectiveLct) already in Engine A; verified 2026-06-18 |
| GAP-09 Templates never applied | PF-12 | EXPLICITLY DEFERRED | Product feature; no derivation dependency |
| GAP-10 Concessions = 0 in Engine C | PF-13 | EXPLICITLY DEFERRED | Engine C only; no Phase 2 Engine A impact |
| GAP-11 DebtTab mock data | PF-MD-1 | EXPLICITLY DEFERRED | M11 / DebtTab surface; no Phase 2 Engine A impact |

**Phase 1 blockers:** 2 — both RESOLVED  
**Phase 2 concerns:** 4 — all acknowledged; 1 resolved (GAP-08)  
**Explicitly deferred:** 4 — no Phase 2 dependency confirmed

---

### 8.4 Sweep Closing Note — Phase 2 Readiness

**Sweep completed:** May 27, 2026  
**Sweep scope:** All 11 open gaps identified from prior audit docs (PROFORMA_SUBSYSTEM_AUDIT.md,
PROFORMA_MATH_AUDIT.md, F9_DATA_FLOW_AUDIT_PHASE1.md, F9_TIER1_BLOCKERS_AUDIT.md)

**Phase 1 clearance:**

Both Phase 1 blockers are resolved as architectural decisions with no code change required:

1. **GAP-01** (dual-engine): ~~Engine A is the Phase 2 write target. Engine B reads the same
   `deal_assumptions.year1` JSONB and receives derived values automatically.~~
   **Resolved 2026-06-18.** Engine B deleted. Engine A is the sole Phase 2 write
   target. All surfaces read from `deal_assumptions.year1` exclusively.

2. **GAP-02** (bad debt formula): EGI-based formula is canonical. Phase 2 derivation targets
   EGI-based `bad_debt_pct`. The display fix in `ProFormaSummaryTab` (change multiplier from
   GPR to NRI + OtherIncome at line 1964) is a required Phase 2 code change.

**Key discoveries during sweep (previously unconfirmed):**

- **PF-02 is FIXED** (previously listed as P0 blocker in PROFORMA_SUBSYSTEM_AUDIT.md):
  The projections loop at `proforma-adjustment.service.ts:4498–4544` does consume
  per-year overrides via `projPyOvr(field)` before falling back to growth formula.
  This is not reflected in PROFORMA_SUBSYSTEM_AUDIT.md because the fix shipped
  after the audit was written.

- **UNIT-01 is FIXED** (opex_growth_current missing ÷100): Line 2997 correctly
  divides by 100. The fix is already in production.

- **forceReseed is WIRED** (extraction pipeline hook): `data-router.ts:1579` fires
  `ensureDealAssumptionsSeeded({forceReseed:true})` after capsule writes. The
  `other_income_per_unit` stale-cache pattern is closed for new extractions.

**Phase 2 entry conditions (all met):**

✅ Write target declared: Engine A, `deal_assumptions.year1` LayeredValue JSONB  
✅ Bad debt canonical formula: EGI-based  
✅ Per-year override storage format: `per_year_overrides['field:yrN'].value`  
✅ Seeder forceReseed mechanism: exists and is wired  
✅ Projections loop: consumes per-year overrides (confirmed at lines 4498–4544)  
✅ Per-line OPEX growth scaffold: in place (`_layeredByYear` + `projPyOvr` fallback)

**Phase 2 must address (5 open concerns):**

| Priority | Gap | What Phase 2 does |
|---|---|---|
| P0 | GAP-05 LIUS wiring | Call `runLIUSForLine` for each OpEx/Reserves/Exit field; write results via seeder override |
| P0 | GAP-06 Layered growth | Wire `proforma-projection.service.ts` output into `_layeredByYear` feed for Engine A; run calibration backtests |
| P1 | GAP-02 display fix | Change `ProFormaSummaryTab:1964` bad debt multiplier from GPR to NRI+OtherIncome |
| P1 | GAP-08 Stance modulation | Apply OperatorStance concession mod in Engine A OSRow assembly (parallel to Engine B) |
| P2 | GAP-03 Transaction boundary | Advisory lock or serialized derivation runner to prevent race with stance reblend |
| P2 | GAP-07 Dev deal branching | Phase 2 derivation branches on `deals.project_type` for seed inputs |

**4 gaps are explicitly deferred** (GAP-04, GAP-09, GAP-10, GAP-11) with confirmed no
Phase 2 derivation dependency.
