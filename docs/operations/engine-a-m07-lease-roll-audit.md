# Engine A + M07 Lease-Roll Audit

**Task:** #1528  
**Date:** 2026-05-30  
**Test deal:** 464 Bishop — `3f32276f-aacd-4da3-b306-317c5109b403` (232 units, Atlanta GA)  
**Scope:** Read-only code trace and live DB verification of five fields (GPR Y1, GPR Y2–N, Loss-to-Lease, Other Income, Vacancy Timing) plus M07 occupancy baseline and fallback behavior.  
**Primary sources:** `proforma-adjustment.service.ts`, `trafficToProFormaService.ts`, `starting-state.service.ts`, `proforma/proforma-projection.service.ts`

---

## Executive Summary

All four Engine A revenue fields use a consistent **portfolio-level shortcut** pattern: each reads a pre-seeded `LayeredValue` snapshot from `deal_assumptions.year1` JSONB (written once at upload/seeding time) rather than iterating `deal_lease_transactions` at query time. The M07 occupancy baseline is **deal-anchored first** (via `leasing_events` counts from a processed rent roll snapshot), falling back to deal metadata. For 464 Bishop specifically, no M07 `traffic_projections` row and no `rent_roll_snapshots` with `derived`/`calibrated` status exist — both M07 signals default to fallbacks.

**CF-02 per-year-override status (post Task #1521):**
- GPR Y2–N: **FIXED** — `projPyOvr('gpr')` is read in `buildProjectionsForExport`.
- Vacancy per-year: **ALWAYS WORKED** — `pyOverrides['vacancy_pct:yr${yr}']` was already in the `perYear` build loop.
- Other income per-year: **ALWAYS WORKED** — `projPyOvr('other_income')` is read in the projection loop.
- Loss-to-Lease: **NOT OVERRIDEABLE PER-YEAR** — `lossToLeasePct` is read once from `ry1('loss_to_lease_pct')` as a flat constant; no `projPyOvr('loss_to_lease_pct')` call exists in the loop.

---

## Field-by-Field Trace

### 1A — GPR Year 1

**Pattern:** Portfolio-level, snapshot-based.

**Code path:**
```
deal_assumptions.year1 JSONB → year1Seed.gpr (LayeredValue)
  ↓ resolvedNum(lv(year1Seed, 'gpr'))
  ↓ Resolution priority: override > agent > t12 > rent_roll > om > platform
  → $4,901,400 (resolution = 'agent')
```

**How layers are seeded:**  
The proforma seeder (not traced at query time) populates each layer from the extraction capsule:
- `t12` ← T12 document extraction
- `rent_roll` ← Σ(count × in_place_rent × 12) across floor plan mix
- `om` ← OM/broker claim
- `platform` ← platform model estimate
- `agent` ← written by Cashflow Agent after analysis

**Unit-mix GPR alternate path:**  
A gated path computes GPR as Σ(unit_type.count × in_place_rent × 12) across `parsedUnitMix`, injecting a synthetic `unit_mix` resolution layer and forcing `resolved = gprFromUnitMix`. Activated only when `per_year_overrides['da:use_unit_mix_for_gpr'].value === true`.

**464 Bishop live values:**

| Layer | Annual |
|-------|--------|
| override | null |
| agent | $4,901,400 |
| t12 | $4,876,535 |
| rent_roll | $4,932,300 |
| om | $4,901,400 |
| platform | $4,128,672 |
| **resolved** | **$4,901,400** (resolution: `agent`) |
| unit_mix flag | `false` (explicitly set OFF) |

**Does NOT read:** `deal_lease_transactions`, `leasing_events`, or `deal_traffic_snapshots` at query time.

---

### 1B — GPR Year 2–N

**Pattern:** Portfolio-level running-base compounding.

**Code path (`buildProjectionsForExport`):**
```
for yr = 1..holdYears:
  gprOvr = projPyOvr('gpr')                           // reads per_year_overrides['gpr:yr${yr}']
  _stabilizedGpr = gprOvr ?? round(runGpr × (1 + rentGrowthStep))
  gpr = _isConstrYr ? 0 : round(_stabilizedGpr × _rampFactor)
  runGpr = _stabilizedGpr                              // compound from stabilized base
```

**`rentGrowthStep` source (in order):**
1. `prevPv?.rentGrowthPct` — operator per-year override for rent growth (from `per_year_overrides['rent_growth_pct:yr${yr-1}']`)
2. `_prevLy?.rentGrowth.value` — five-component layered rent model (`projectProformaForDeal` → `projectProforma`)
3. `assumptions.rentGrowthStabilized` — `proforma_assumptions.rent_growth_current`
4. `0.03` — hardcoded fallback

**464 Bishop values:**
- `proforma_assumptions.rent_growth_current` = 3.5%
- `per_year_overrides['gpr:yr2']` = `{value: 5048442, resolution: 'override'}` — IS now applied post Task #1521
- No `traffic_projections` row → layered rent model blends without M07 calibration signal

**CF-02 status for GPR:** RESOLVED (Task #1521). The `projPyOvr('gpr')` call at line 4602 correctly reads and applies year-level dollar overrides, including the existing yr2 override of $5,048,442.

---

### 2 — Loss-to-Lease

**Pattern:** Portfolio-level flat percentage, constant across hold years.

**Code path:**
```
Year 1 display:
  toDollarRow('loss_to_lease_pct', 'loss_to_lease', ..., _gprForDollars)
    → lossToLease$ = year1.loss_to_lease_pct.resolved × GPR_resolved

Projection loop (all years):
  lossToLeasePct = ry1('loss_to_lease_pct')     // read ONCE, outside loop, at line 4459
  lossToLease = round(gpr × lossToLeasePct)     // applied uniformly every year
```

**Key characteristic:** `lossToLeasePct` is extracted from the year1 seed once before the projection loop begins. It is **not** subject to `projPyOvr()` — there is no `projPyOvr('loss_to_lease_pct')` call anywhere in the loop. This means loss-to-lease cannot be overridden per-year from the F9 UI and does not react to lease expirations.

**NOT:** per-unit computation of (market_rent − in_place_rent) summed across units.

**464 Bishop live values:**

| Layer | Value |
|-------|-------|
| t12 | 0.3497% |
| rent_roll | 1.318% |
| **resolved** | **0.3497%** (resolution: `t12`) |
| Year 1 dollar | **~$17,150** (0.35% × $4,901,400) |

**Observation:** The `deal_traffic_snapshots.summary.lossToLeasePct` shows **13.8%** — this is the lease-level gap computed by `traffic-analytics.service.ts` from `deal_lease_transactions`. Engine A does NOT read this signal. The gap between 13.8% (live) and 0.35% (Engine A year1) is large and reflects that Engine A is reading the T12 trailing average, not current lease-level spread.

---

### 3 — Other Income

**Pattern:** Portfolio-level per-unit shortcut, growing at the same rate as GPR rent growth.

**Code path:**
```
Year 1 display:
  toDollarRow('other_income_per_unit', 'other_income', ..., _otherIncMul, 'other_income_dollars')
    → resolved = other_income_dollars.resolved  (agent write-back preferred)
                 OR other_income_per_unit.resolved × (totalUnits × 12)
    _otherIncMul = totalUnits × 12 = 232 × 12 = 2,784

Projection loop:
  otherIncPU = ry1('other_income_per_unit')     // seeded from year1 LV, read ONCE at line 4463
  runOtherIncPU = otherIncPU                    // running base (per-unit, per-month)
  ...
  otherIncOvr = projPyOvr('other_income')       // reads per_year_overrides['other_income:yr${yr}']
  otherIncome = otherIncOvr != null
    ? round(otherIncOvr)
    : round(runOtherIncPU × (1 + rentGrowthStep) × totalUnits × 12)
  runOtherIncPU = otherIncOvr != null
    ? otherIncOvr / (totalUnits × 12)           // anchor new base from override
    : runOtherIncPU × (1 + rentGrowthStep)
```

**Growth rate:** Inherits `rentGrowthStep` — the same scalar as GPR. Other income has no separate growth anchor.

**Does NOT scale at lease-roll dates** (e.g., storage/pet/utility-billing income does not step up at lease expirations).

**464 Bishop live values:**

| Key | Value |
|-----|-------|
| `other_income_per_unit.resolved` | $777.16/unit/year (resolution: `rent_roll`) |
| `other_income_per_unit.t12` | $169.19/unit/year |
| `other_income_per_unit.rent_roll` | $58.45/unit/year |
| `other_income_per_unit.om` | $857.22/unit/year |
| `other_income_dollars.resolved` | **$341,907/year** (resolution: `agent`) |
| **Year 1 displayed** | **$341,907** (agent `other_income_dollars` key takes priority) |

**Projection engine seed:** `otherIncPU = ry1('other_income_per_unit')` = $777.16/unit/year. At yr=1 (rentGrowthStep=0): projection Y1 = $777.16 × 232 = $180,261. This differs from the Y1 display value ($341,907) because `buildProjectionsForExport` reads `other_income_per_unit` while the operating statement display reads `other_income_dollars` (agent key). **This is a known display-vs-projection-seed discrepancy** — the projection loop compounds from the per-unit seed, not the agent's annual dollar figure.

---

### 4 — Vacancy Timing

**Pattern:** Hybrid — M07 per-year trajectory when available, flat % fallback otherwise.

**Code path — Year 1 display:**
```
toDollarRow('vacancy_pct', 'vacancy_loss', ..., _gprForDollars, 'vacancy_loss_dollars')
  → resolved = vacancy_loss_dollars.resolved (agent) OR year1.vacancy_pct.resolved × GPR
```

**Code path — Projection loop vacancy per-year (perYear array, lines 3057–3069):**
```
vacancyBase = calibVacancy ?? (yr === 1 ? derivedVacancyPct : null)
  calibVacancy = trafficProjection?.calibrated.vacancyPct          // M07 calibrated floor
  derivedVacancyPct = computed from M07 T-01×T-05 OR yr1 trajectory vacancy OR M07 calibrated
vacancyPct = min(0.30, vacancyBase) OR null
→ pyOverrides['vacancy_pct:yr${yr}'] can override this per-year value
```

**Code path — Projection loop per-year vacancy application (line 4606):**
```
vacPct = tv?.vacancyPct       // M07 per-year trajectory (traffic_projections.yearly[yr-1])
       ?? pv?.vacancyPct      // perYear[yr-1] array (calibVacancy-seeded)
       ?? ry1('vacancy_pct')  // year1 seed fallback
       ?? 0.05                // hardcoded default
```

**`tv` source:** `trafficProjectionOut.yearly.find(t => t.year === yr)` — built by `getTrafficProjection()` from the `traffic_projections` table (`occupancy_trajectory` and `effective_rent_trajectory` columns). This is the M07 per-year forward vacancy trajectory.

**`derivedVacancyPct` derivation (3-path, in priority order):**
1. Primary: `1 − (T01_tours/wk × T05_closing_rate × 52 × avgLeaseTerm) / totalUnits`
2. Secondary: `trafficProjection.yearly[0].vacancyPct` (year-1 trajectory vacancy)
3. Tertiary: `calibrated.vacancyPct × leaseTermAdj`

**464 Bishop live values:**

| Source | Value |
|--------|-------|
| `year1.vacancy_pct.t12` | 66.01% (likely poor T12 period data) |
| `year1.vacancy_pct.rent_roll` | 19.83% |
| **`year1.vacancy_pct.resolved`** | **19.83%** (resolution: `rent_roll`) |
| deal_traffic_snapshots.occupancyPct | 81% (vacantUnits=44/232) |
| traffic_projections row | NONE |
| proforma_assumptions.vacancy_current | 5.00% |

**For 464 Bishop projection years:** No `traffic_projections` row → `tv` is null → `calibVacancy` is null → `derivedVacancyPct` is null → `pv.vacancyPct` is null → `perYear` entries have `vacancyPct: null` → projection loop falls back to `ry1('vacancy_pct')` = **19.83%** for all years, OR 5.00% from the proforma_assumptions scalar path if seeded differently.

**NOT:** monthly trajectory from lease expirations or notice dates in `leasing_events`.

---

## M07 Occupancy Baseline

**Service:** `StartingStateService.resolveStartingState(dealId)` — called by `TrafficPredictionEngine` at engine boot.

**Resolution chain:**

```
1. Explicit deal.deal_mode → STABILIZED / LEASE_UP / REDEVELOPMENT (always wins)
2. Load latest rent_roll_snapshots WHERE status IN ('derived', 'calibrated')
3. If snapshot found:
     getOccupancy() → leasing_events counts (snapshot_id match)
       = COUNT(*) FILTER (unit_status IN ('occupied','renewal','notice')) / COUNT(*)
4. If occupancy >= 0.80 AND hasRentRoll → STABILIZED
   Else → LEASE_UP (start_occupancy = observedOcc if real signal, else 0)
5. Fallbacks when no snapshot (or no leasing_events rows):
   a. deal.current_occupancy = deal_data->'market_intelligence'->'data'->'demographics'
                                          ->'submarket'->>'avg_occupancy' / 100
   b. deal.deal_data.occupancy
   c. 0.90 default
```

**Data source for occupancy:** `leasing_events` table (snapshot-level unit status counts), NOT `deal_lease_transactions` directly. The `leasing_events` table is populated when the rent roll extraction is processed (one row per unit per snapshot).

**464 Bishop status:**

| Check | Result |
|-------|--------|
| rent_roll_snapshots (derived/calibrated) | **NONE** — no rows with qualifying status |
| deal_traffic_snapshots | Row exists (2026-05-20), occupancyPct=81, but NOT read by StartingStateService |
| traffic_projections | **NONE** — M07 has not run for this deal/property |
| M07 starting state for 464 Bishop | Falls back to step 5a/5b/5c — submarket avg or deal metadata |

**Note:** The `deal_traffic_snapshots` table (populated by `traffic-analytics.service.ts` from `deal_lease_transactions`) is a **separate surface** from the M07 engine. `StartingStateService` reads `rent_roll_snapshots` + `leasing_events`, not `deal_traffic_snapshots`. The 81% occupancy visible in the Traffic tab comes from `deal_lease_transactions` processing, not from M07's starting state resolution.

---

## Fallback Behavior Summary

| Field | M07/Data Available | Fallback (no data) |
|-------|-------------------|--------------------|
| GPR Y1 | Agent layer wins | Falls through LV chain → platform estimate |
| GPR Y2–N | Operator per-year override | `proforma_assumptions.rent_growth_current` (3.5% for 464 Bishop) → 3.0% hardcoded |
| Loss-to-Lease | T12 layer | Rent-roll layer → OM layer → platform layer → null (0) |
| Other Income | Agent `other_income_dollars` | `other_income_per_unit.resolved` × units × 12 |
| Vacancy Y1 | `rent_roll` resolved | `t12` → `om` → `platform` → 5% default in projection |
| Vacancy Y2+ | M07 `tv.vacancyPct` per-year | perYear `calibVacancy` → Y1 seed (19.83%) → 5.0% |
| M07 Start Occ | `leasing_events` unit counts | `deal.current_occupancy` → `deal_data.occupancy` → 0.90 |

**Silent fallbacks:** None of the fallback paths surface a user-visible warning or alert. The `resolution` field on the LayeredValue indicates source, but degraded fallbacks (e.g., platform estimate for GPR, 5% default for vacancy) are not flagged in the UI.

---

## Per-Year Override (CF-02) Status

| Field | `projPyOvr()` called? | Notes |
|-------|----------------------|-------|
| `gpr` | YES — line 4602 | **FIXED Task #1521.** 464 Bishop has gpr:yr2=$5,048,442, now applied. |
| `other_income` | YES — line 4615 | Always worked in `buildProjectionsForExport`. |
| `vacancy_pct` (in perYear build) | YES — line 3063 (`vacOverride`) | Stored in `perYear` before loop; loop reads `pv?.vacancyPct`. |
| `bad_debt_pct` | YES — line 4611 | Always worked. |
| `loss_to_lease_pct` | **NO** | `lossToLeasePct` read once at line 4459, no per-year override path. |
| OPEX lines (payroll, repairs, etc.) | YES — lines 4627–4650 | **FIXED Task #1521.** |

**Loss-to-Lease gap:** If an operator needs to model improving LTL over hold years (as mark-to-market leases reset), there is no UI-accessible mechanism — the only path is to set a single year1 percentage. A per-year override key (`loss_to_lease_pct:yr${yr}`) does not exist in the projection loop.

---

## Architectural Pattern Conclusion

Engine A uses a **snapshot-at-ingestion** model for all four revenue fields:

1. At upload time, the proforma seeder processes `deal_lease_transactions` → rent roll extraction capsule → populates `deal_assumptions.year1` LayeredValues (one snapshot).
2. At query time (F9, export, PDF), Engine A reads ONLY `deal_assumptions.year1` JSONB. No live iteration of `deal_lease_transactions`.
3. The `deal_lease_transactions` table IS used at query time by `traffic-analytics.service.ts` to build the lease velocity surface (LVE expiration waterfall, MTM exposure, signing velocity) in `deal_traffic_snapshots` — but this is a separate surface, not consumed by Engine A.
4. M07's `StartingStateService` reads `leasing_events` (derived from a rent roll snapshot), not `deal_lease_transactions` directly. For 464 Bishop, neither is available in a qualifying state.

This separation is deliberate: the extraction/seeding step is the integration point for lease-level data. Engine A projections are deterministic given the year1 seed — they do not vary with subsequent lease events until a re-seeding (new rent roll upload or agent re-run) occurs.

---

## Open Observations

1. **LTL display vs. live:** Engine A year1 LTL = 0.35% ($17K) vs. `deal_traffic_snapshots` lease-level LTL = 13.8%. The T12 layer is anchoring LTL unrealistically low. No mechanism propagates the live lease-level LTL signal into Engine A.

2. **Other income display-vs-projection-seed discrepancy:** Year1 operating statement displays `other_income_dollars.resolved` = $341,907 (agent). Projection loop seeds from `other_income_per_unit.resolved` = $777.16/unit → $180,261/year at yr1. The two values diverge by ~$161K. Per-year override (`projPyOvr('other_income')`) bypasses this if set for yr1.

3. **464 Bishop vacancy disconnect:** Year1 vacancy_pct = 19.83% (44 vacant units from rent roll). For projection years 2+, if M07 is unavailable, the loop falls back to this same 19.83% for all years — there is no automatic convergence to submarket equilibrium unless M07 is run and produces a `traffic_projections` record.

4. **No LTL per-year override path:** If LTL is expected to compress as mark-to-market leases reset, the only current mechanism is re-running the seeder after lease data changes. A `projPyOvr('loss_to_lease_pct')` hook does not exist.
