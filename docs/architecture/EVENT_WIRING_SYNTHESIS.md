# Event Wiring Synthesis — Phase 0 Consolidated Backlog

**Date:** 2026-05-15
**Task:** Event-Wiring Synthesis Pass (read-only)
**Inputs:**
- `docs/architecture/EVENT_PROPAGATION_AUDIT.md` (#715, 1303 lines) — EP-01..EP-07, DI-01, CS-01/02, TM-01/02/03, FA-01/02/03, CE-01/02 (correlation), 7-fix sequence
- `docs/architecture/CAPITAL_EXIT_SUBSYSTEM_AUDIT.md` (#715 follow-on, 954 lines) — CE-01..CE-16, CE-M26, D1-D5 dispatch sequence (D1✓, D3✓ merged; D2 PR-pending; D4 staged; D5 gated)
- `docs/architecture/TRAFFIC_ENGINE_STATE_AUDIT.md` (#715 sibling, 803 lines) — TE-01..TE-14, FIX-1..FIX-8 (FIX-1 dispatched; FIX-3 drafted; others open)
**Purpose:** Prevent divergent-parallel-mechanism disease. Converts three parallel fix sequences into one ordered backlog. All code changes follow as dispatches cut from this document.

> **Naming note.** The EP audit's Section 10 contains two findings labelled `CE-01` and `CE-02` that are about the **Correlation Engine** (COR-06, COR-19/20). These are distinct from the Capital/Exit audit's `CE-01`..`CE-16` series. This document disambiguates them as **EP/CE-01** and **EP/CE-02** wherever both appear in context.

---

## 1. Canonical Consumption Pattern

Established by Event Propagation Audit Section 11. Adopted here as the conformance standard for all wiring fixes. Not re-litigated.

### The standard query pattern

```sql
-- Primary: event record
SELECT ke.id, ke.subtype, ke.magnitude_score, ke.magnitude_value,
       ke.status, ke.materialization_date, ke.completion_date, ke.confidence
FROM key_events ke
WHERE ke.subtype IN ($subtypes)
  AND ke.status NOT IN ('draft', 'cancelled')
  AND ke.submarket_id = $submarketId      -- or msa_id = $msaId for macro subtypes
  [AND ke.confidence >= $minConfidence]   -- optional; 0.6 for recession_indicator

-- When forecast magnitude is needed: JOIN event_forecasts
LEFT JOIN event_forecasts ef
  ON ef.event_id = ke.id
  AND ef.status = 'active'
  AND ef.window_months = $windowMonths    -- bridge to LIUS hold years via TM-03 fix
```

### Column mapping for CA tool (Fix W-01)

| Old column (`demand_events`) | New column (`key_events` / `event_forecasts`) |
|---|---|
| `impact_type` | `ke.subtype` |
| `impact_magnitude` | `ef.point_estimate` |
| `confidence` | `ef.confidence` |
| `m35_available` | `true` when rows > 0 |

### What is NOT in the canonical path

| Source | Status | Reason |
|---|---|---|
| `demand_events` | **WRONG — legacy schema** | `fetch_m35_event_forecast.ts:112` reads this; EP-02 finding; Fix W-01 repoints it |
| `event.classified` Kafka topic | **NOT in consumption path** | Per Causal Discipline §3.4, subscriptions are wiring-layer policy; no Section 11 fix reads from Kafka at event-consumption time |
| `news_events` | **WRONG for M35** | `jedi-score.service.ts calculateSupplyScore()` reads this; EP-07/FA-01 finding; Fix W-05 adds the canonical query |

### `window_months → hold_year` bridge (TM-03 prerequisite)

M35 forecasts use windows `{3, 12, 24, 36}` months. LIUS projects in annual Year 1–10 increments. The bridge mapping (new utility `backend/src/services/lius/m35-bridge.ts`, Fix W-02) is:

| window_months | hold_year index |
|---|---|
| 3 | Y1 (within-year) |
| 12 | Y1 |
| 24 | Y2 |
| 36 | Y3 |
| 48+ | extrapolate linearly |

This bridge is a prerequisite (TM-03) for all LIUS wiring in W-02 and for any M35 signal mapped to a LIUS annual projection.

---

## 2. Merge Map

Every EP Fix, every D4-related Capital/Exit finding, and every event-touching Traffic fix classified against all others. Classification: **DUPLICATE** (same files + same subtypes + same channel → must be one dispatch) · **STACKED** (one sits on top of another; sequencing dependency) · **ADJACENT** (same file or event arc, different concern; coordinate but don't merge) · **INDEPENDENT** (no overlap; can dispatch separately).

### 2.1 EP Fix × Capital/Exit Finding

| EP Fix | CE Finding | Classification | Basis |
|---|---|---|---|
| **Fix 1** — CA schema repoint (`fetch_m35_event_forecast.ts`) | CE-03 (mentions CA as one consumer, but D4 scope is Debt/Exit modules, not CA) | INDEPENDENT | CE-03 targets debt-advisor/ and cycle-intelligence; Fix 1 targets CA agent tool only |
| **Fix 2** — LIUS M35 bridge (`trajectory-engine.ts:84`, new `m35-bridge.ts`) | CE-01 (`exit_cap_trajectory: -0.0025` hardcoded) | **DUPLICATE** | Same file (`trajectory-engine.ts`), same line (84), same defect. EP Fix 2 replaces the constant with an M35-driven `pipelineSignal`; CE FIX-4 (Phase B) replaces it with a Bayesian historical trajectory. Both removals must be reconciled into W-02 so the line is touched once. |
| **Fix 2** | CE FIX-4 (`trajectory-engine.ts:84` — empirical trajectory, Phase B) | **DUPLICATE** | Same file, same line, overlapping replacement. Resolution: W-02 lands Phase A (M35 event-driven component) now; Phase B (empirical Bayesian component from `historical_observations`) is separately gated behind D2's M26 archive landing. |
| **Fix 2** | CE-14 (ExitCapitalModule events display-only; cap-rate trajectory unaffected) | **STACKED** | Fix 2 is the backend half (trajectory-engine.ts M35-aware); CE-14's fix (W-09) is the frontend half (ExitStrategyTabs/ExitCapitalModule replacing hardcoded arrays with live trajectory feeds). W-02 must land before W-09. |
| **Fix 3** — M07 M35 ingestion (`trafficPredictionEngine.ts`, `trafficCalibrationJob.ts`) | No direct Capital/Exit finding | INDEPENDENT | Capital/Exit audit does not target M07 internal files. |
| **Fix 4** — M09 proforma mutation (`proforma-adjustment.service.ts`) | CE FIX-7 (Exit Strategy write-back to `proforma_assumptions`) | ADJACENT | Both touch `proforma_assumptions` / `proforma-adjustment.service.ts` but at different entry points: Fix 4 wires rent-control/tax-abatement event signals into the adjustment pipeline; CE FIX-7 adds an explicit write-back from the Exit Strategy SensitivityTab. Different functions, no collision. Coordinate on same file. |
| **Fix 5** — M25 supply score (`jedi-score.service.ts:269–291`) | CE-12 (Exit Strategy `supplyPressure` / `buyerPressure` RSS components event-blind) | **ADJACENT** | Same event source (`multifamily_delivery`, `demolition`, `conversion`) but different consumers and files. Fix 5 wires `calculateSupplyScore()` in `jedi-score.service.ts`; CE-12's fix (W-10) wires `ExitStrategyTabs.tsx` / `ExitCapitalModule.tsx` RSS components. No file collision — coordinate dispatch order (W-05 → W-10). |
| **Fix 6** — M03 devcap (`entitlement.service.ts`, `zoning-recommendation-orchestrator.service.ts`) | No Capital/Exit finding | INDEPENDENT | M03 is outside Capital/Exit audit scope. |
| **Fix 7** — M14 macro wiring (`rate-environment.service.ts`, `cycle-intelligence.service.ts`) | CE-03 (Debt / Exit Timing / Exit Strategy not consuming `key_events`; M14_macro channel has zero registered consumers) | **DUPLICATE** | **Same two files. Same event subtypes (`rate_move`, `recession_indicator`, `major_relocation_announcement` M14 leg, `regional_shock` M14 leg). Same channel.** EP Fix 7 and CE-03 (Capital/Exit FIX-5) must become ONE dispatch (W-07). Dispatching them separately would produce two agents editing the same function bodies. |
| **Fix 7** | CE-16 Facet 3 (wire Debt / Exit Timing / Exit Strategy to consume `cycleIntelligenceService`) | **ADJACENT** | Fix 7 makes `cycle-intelligence.service.ts` consume events (internal event awareness). CE-16 F3 makes OTHER modules consume the cycle service (external consumers). Sequentially dependent: W-07 must land before CE-16 F3 dispatch (W-08) so the cycle service's phase determination is event-informed before consumers wire to it. |

### 2.2 EP Fix × Traffic Finding

| EP Fix | TE Finding | Classification | Basis |
|---|---|---|---|
| **Fix 1** — CA schema repoint | TE (none) | INDEPENDENT | |
| **Fix 2** — LIUS M35 bridge | TE (none) | INDEPENDENT | trajectory-engine.ts is not a Traffic audit target. |
| **Fix 3** — M07 M35 ingestion (`trafficPredictionEngine.ts`, `trafficCalibrationJob.ts`) | TE FIX-1 (dispatched) — schedule calibration job via Inngest (new file; does NOT edit `trafficCalibrationJob.ts` internals) | **ADJACENT** | FIX-1 creates `trafficCalibrationCron.ts` (new file); EP Fix 3 edits `trafficCalibrationJob.ts` to add baseline exclusion logic. Same file is NOT edited by FIX-1. Coordinate: W-03 must land after FIX-1 is confirmed in the codebase so the exclusion window runs inside the already-scheduled job. |
| **Fix 3** | TE FIX-4 — wire `traffic-module-wiring.ts` bridge functions (`jedi-score.service.ts:345`, `m08-strategies.service.ts`, `traffic-module-wiring.ts`) | **ADJACENT** | EP Fix 3 wires M35 events INTO the traffic engine (event ingestion); TE FIX-4 wires the traffic engine's OUTPUTS to JEDI and M08 (output routing). Different direction of data flow, different files. `trafficPredictionEngine.ts` is called by `getTrafficIntelligence()` in TE FIX-4 but is not itself edited by TE FIX-4. Sequential dependency: TE FIX-4 should land after W-03 so that M07's M35-aware predictions are what JEDI and M08 receive via the bridge. |
| **Fix 4** — M09 proforma mutation | TE (none — TE covers M07 outputs, not M09 internal event wiring) | INDEPENDENT | |
| **Fix 5** — M25 supply score (`jedi-score.service.ts:269–291`) | TE FIX-4 (`jedi-score.service.ts:345` — replace data-flow-router with `calculateTrafficContributionToJEDI()`) | **ADJACENT** | Both edit `jedi-score.service.ts` but at different line ranges and different functions: W-05 edits `calculateSupplyScore()` (lines 269–291); TE FIX-4 edits `getModuleData()` call at line 345. No function collision, but same file — must be dispatched serially or to the same agent. |
| **Fix 6** — M03 devcap | TE (none) | INDEPENDENT | |
| **Fix 7** — M14 macro wiring | TE (none) | INDEPENDENT | TE audit does not target `rate-environment.service.ts` or `cycle-intelligence.service.ts`. |

### 2.3 Capital/Exit Finding × Traffic Finding

| CE Finding | TE Finding | Classification | Basis |
|---|---|---|---|
| CE-03 / D4 (Debt/Exit consuming M14_macro events) | TE (none) | INDEPENDENT | Different modules, no file overlap. |
| CE-12 (Exit Strategy supply from M35/M07) | TE FIX-4 (traffic-module-wiring bridges) | **ADJACENT** | CE-12 needs M07 supply output to feed ExitStrategyTabs RSS; TE FIX-4 makes M07 outputs available via bridge. Sequential dependency: TE FIX-4 should land before W-10 (CE-12) can be fully populated. |
| CE-14 (ExitCapitalModule events display-only) | TE (none) | INDEPENDENT | |
| CE-16 F3 (wire cycle intelligence consumers) | TE (none) | INDEPENDENT | |

---

## 3. File Collision Matrix

Every file touched by more than one fix or finding across the three audits, with the line ranges each one targets.

| File | Fix / Finding | Line range targeted | Overlap type |
|---|---|---|---|
| `backend/src/services/lius/trajectory-engine.ts` | W-02 / EP Fix 2 | Line 84 (replace constant with M35 pipelineSignal) · `generateProjections()` (Y1 absorption spike injection) | **DUPLICATE** with CE FIX-4 on line 84 |
| `backend/src/services/lius/trajectory-engine.ts` | CE FIX-4 (Phase B) | Line 84 (replace constant with Bayesian empirical trajectory) | DUPLICATE (see above — W-02 Phase A and CE FIX-4 Phase B must land in sequence on same line) |
| `backend/src/services/debt-advisor/rate-environment.service.ts` | W-07 / EP Fix 7 | Rate curve construction function — add `rate_move` forward overlay | **DUPLICATE** merge with CE FIX-5 |
| `backend/src/services/debt-advisor/rate-environment.service.ts` | CE-03 / CE FIX-5 | Same file — register M14_macro Kafka consumer + `key_events` query | DUPLICATE — same fix |
| `backend/src/services/cycle-intelligence.service.ts` | W-07 / EP Fix 7 | Phase determination function — `recession_indicator` regime override | **DUPLICATE** merge with CE FIX-5 |
| `backend/src/services/cycle-intelligence.service.ts` | CE-03 / CE FIX-5 | Same file — M14_macro channel event queries | DUPLICATE — same fix |
| `backend/src/services/cycle-intelligence.service.ts` | CE-16 Facet 1 (Phase B) | Internal stub coefficients (`predictCapRateMovement`, `predictRentGrowth`, `predictFullChain`) | ADJACENT — separate concern (calibration, Phase B), no collision with W-07 |
| `backend/src/jobs/trafficCalibrationJob.ts` | W-03 / EP Fix 3 | Job body — add `m35TrafficApiService.getActiveEvents()` baseline exclusion window | ADJACENT with TE FIX-1 |
| `backend/src/jobs/trafficCalibrationJob.ts` | TE FIX-1 (dispatched) | No edit to this file — FIX-1 creates a new Inngest cron wrapper (`trafficCalibrationCron.ts`) | ADJACENT (new file, not this file) |
| `backend/src/services/trafficPredictionEngine.ts` | W-03 / EP Fix 3 | Lines 11–25 (add import) · trajectory section (6th weighted component) | ADJACENT with TE FIX-4 |
| `backend/src/services/trafficPredictionEngine.ts` | TE FIX-4 | Called via `getTrafficIntelligence()` (upstream consumer — no edit to this file in FIX-4 itself) | ADJACENT (read-only dependency) |
| `backend/src/services/jedi-score.service.ts` | W-05 / EP Fix 5 | Lines 269–291 (`calculateSupplyScore()`) — add `event_forecasts JOIN key_events` secondary query | ADJACENT with TE FIX-4 |
| `backend/src/services/jedi-score.service.ts` | TE FIX-4 | Line 345 — replace `dataFlowRouter.getModuleData('M07', dealId)` with `calculateTrafficContributionToJEDI()` | ADJACENT — different function |
| `backend/src/services/proforma-adjustment.service.ts` | W-04 / EP Fix 4 | Adjustment pipeline entry point — `rent_control_passage` + `tax_abatement` event blocks | ADJACENT with CE FIX-7 |
| `backend/src/services/proforma-adjustment.service.ts` | CE FIX-7 (W-09 area) | `SensitivityTab` write-back path — new `applyExitStrategyOverride()` call | ADJACENT — different function |
| `frontend/.../ExitStrategyTabs.tsx` | W-09 (CE FIX-6) | Lines 265–268 (`rg/cr/sp/va` hardcoded arrays → live endpoint) | STACKED — all CE-04/CE-14 frontend fixes land together |
| `frontend/.../ExitStrategyTabs.tsx` | W-10 (CE-12) | RSS `supplyPressure`/`buyerPressure` components | ADJACENT — different component props |
| `frontend/.../ExitCapitalModule.tsx` | W-09 (CE FIX-6) | Lines 108–158 (`RENT_GROWTH_21Y`, `CAP_RATES_21Y`, `SUPPLY_21Y`, `T10_21Y`) | STACKED |
| `frontend/.../ExitCapitalModule.tsx` | W-10 (CE-12) | RSS supply wiring | ADJACENT |
| `frontend/.../ConvergenceChart.tsx` | W-09 / CE-15 | Duplicate 21-year arrays (same defect class as CE-04 on a different surface) | STACKED — absorbed into W-09 scope |

**Repeat offenders requiring serial dispatch or single-agent scope:**

1. `trajectory-engine.ts:84` — W-02 Phase A first, then CE FIX-4 Phase B (after D2 M26 archive lands)
2. `rate-environment.service.ts` — W-07 (merged EP Fix 7 + CE-03); no other fix touches it
3. `cycle-intelligence.service.ts` — W-07 (merged); CE-16 F1 Phase B is a separate later fix
4. `jedi-score.service.ts` — W-05 and TE FIX-4 must be serial (same file, different functions)

---

## 4. Consolidated Event-Wiring Sequence

ONE ordered backlog replacing EP's 7-fix sequence + Capital/Exit D4 + relevant Traffic fixes as separate tracks. Leverage follows EP's cells-flipped/files convention where applicable. Phase A = wiring, offline-able against fixtures. Phase B = impact magnitudes, corpus-gated.

---

### W-01 — CA schema repoint: `demand_events` → `key_events + event_forecasts`

**Resolves:** EP-02
**Absorbs from Capital/Exit D4:** Nothing (CA was not in D4 scope)
**Absorbs from Traffic:** Nothing
**Files:**
- `backend/src/agents/tools/fetch_m35_event_forecast.ts` — lines 92–130 (SQL query block)

**Change:** Replace `FROM demand_events de LEFT JOIN demand_event_types det` with canonical `FROM key_events ke LEFT JOIN event_forecasts ef ON ef.event_id = ke.id AND ef.status = 'active' AND ef.window_months = $windowMonths WHERE ke.status NOT IN ('draft', 'cancelled')`. Map columns per Section 1. Tool signature and agent registration unchanged.

**Depends on:** Nothing. Unblocked.
**Blocks:** Nothing downstream from this specific fix, but until it lands, the Cashflow Agent has zero working M35 event access for all 16 subtypes.
**Phase:** A
**Leverage:** 16 cells / 1 file = **16.0** (all 16 CA MISCLASSIFIED cells → WIRED)

---

### W-02 — LIUS M35 bridge: replace hardcoded `−0.0025` + add `window_months → hold_year` mapping

**Resolves:** EP-03, TM-03, FA-02, CE-01 (Phase A M35-event component; full resolution requires Phase B)
**Absorbs from Capital/Exit D4:** CE-14 (backend half — trajectory-engine M35-aware; frontend half is W-09)
**Absorbs from Capital/Exit Phase B:** CE FIX-4 Phase A lands here; Phase B (Bayesian empirical from `historical_observations`) is a separate dispatch gated on D2
**Files:**
- `backend/src/services/lius/trajectory-engine.ts` — line 84 (`exit_cap_trajectory` constant), `generateProjections()` (Y1 absorption spike)
- `backend/src/services/lius/m35-bridge.ts` — NEW: `windowToHoldYear(windowMonths)` utility

**Change (Phase A — land now):**
```typescript
// m35-bridge.ts — resolves TM-03
export function windowToHoldYear(windowMonths: number): number {
  return Math.max(1, Math.round(windowMonths / 12));
}

// trajectory-engine.ts line 84 — replace hardcoded constant:
const pipelineSignal = await m35TrafficApiService.computeEventPipelineSignal(location);
const exitCapAdj = pipelineSignal * 0.0010; // 100bps max swing from −1..+1 signal
// Emit rate_delta primitive on exitCapRate line for affected hold years via scheduledEvents

// leaseUpAbsorption.yaml Year 1 discrete_spike:
const deliveryEvents = await m35TrafficApiService.getActiveEvents({
  subtype: 'multifamily_delivery', submarketId: deal.submarket_id,
});
const competingUnits = deliveryEvents.reduce((s, e) => s + (e.magnitudeValue ?? 0), 0);
// Apply discrete_spike reduction proportional to competingUnits / subject.totalUnits
```

**Phase B (separate dispatch, D2-gated):** Replace `exitCapAdj` source with Bayesian trajectory from `historical_observations.realized_cap_rate_change_t12/t24` for the subject's submarket × class × vintage bucket, fallback to pipelineSignal when sample is insufficient.

**Depends on:** D1 ✓ (CE FIX-1 merged — single-writer exit cap), D3 ✓ (CE FIX-3 merged — LIUS wired into deterministic model runner). Both are already in the codebase. Phase A does NOT require D2.
**Phase B additionally depends on:** D2 PR landing (M26 cap rate archive — the `historical_observations.realized_cap_rate_change_t*` columns)
**Phase:** A / B (split)
**Leverage:** 16 cells / 2 files = **8.0** (all 16 LIUS NOT_WIRED cells → WIRED)

---

### W-03 — M07 M35 event ingestion: wire `m35TrafficApiService` into prediction + calibration

**Resolves:** EP-01
**Absorbs from Capital/Exit D4:** Nothing
**Absorbs from Traffic:** ADJACENT to TE FIX-1 (dispatched) on `trafficCalibrationJob.ts`; ADJACENT to TE FIX-4 on `trafficPredictionEngine.ts`
**Files:**
- `backend/src/services/trafficPredictionEngine.ts` — lines 11–25 (add import); trajectory calculation section (6th weighted component at 15% weight)
- `backend/src/jobs/trafficCalibrationJob.ts` — job body (add baseline exclusion window)

**Change:**
```typescript
// trafficPredictionEngine.ts — add 6th component
import { m35TrafficApiService } from './m35-traffic-api.service';
const pipelineSignal = await m35TrafficApiService.computeEventPipelineSignal({
  submarketId, msaId, horizonMonths: 18,
});
trajectory = (existingWeightedSum × 0.85) + (pipelineSignal × 0.15);

// trafficCalibrationJob.ts — Mechanism A: baseline exclusion
const exclusionWindows = await m35TrafficApiService.getActiveEvents({
  submarketId: submarket.id, status: ['in_progress', 'materialized'],
});
// Exclude calibration observations that fall within event materialization windows
```

**Depends on:** TE FIX-1 dispatched and confirmed (calibration job must be scheduled before baseline exclusion is meaningful — FIX-1 created the new Inngest cron wrapper; W-03 edits the job body)
**Sequencing note:** Dispatch W-03 AFTER TE FIX-1 is confirmed merged (or in the same dispatch window if FIX-1 is already in the codebase).
**Phase:** A
**Leverage:** 10 cells / 2 files = **5.0** (all 10 M07 NOT_WIRED cells → WIRED)

---

### W-04 — M09 proforma mutation: `rent_control_passage` and `tax_abatement` event signals

**Resolves:** EP-04
**Absorbs from Capital/Exit D4:** Nothing (CE audit's proforma findings are CE-09 [gated] and CE-11 [write-back]; neither is the same as M09 proforma mutation from M35 events)
**Files:**
- `backend/src/services/proforma-adjustment.service.ts` — adjustment pipeline entry point (before finalization)

**Change:**
```typescript
// rent_control_passage: cap rent_growth assumption at legislated maximum
const rentControlEvents = await pool.query(`
  SELECT magnitude_value, materialization_date, completion_date
  FROM key_events
  WHERE subtype = 'rent_control_passage'
    AND submarket_id = $submarket AND status IN ('materialized')
`);
if (rentControlEvents.rows.length > 0) {
  const maxAllowedGrowth = rentControlEvents.rows[0].magnitude_value;
  assumptions.rentGrowth = Math.min(assumptions.rentGrowth, maxAllowedGrowth);
}

// tax_abatement: time-bounded opex reduction
// query key_events WHERE subtype='tax_abatement' AND property_id=$dealPropertyId
// emit level_reset on m26_tax_growth for years in [materialization_date, completion_date]
```

**Coordinate with:** CE FIX-7 (W-09 area) also touches `proforma-adjustment.service.ts` — dispatch serially or scope to same agent to avoid conflicts in the same file.
**Depends on:** Nothing. Unblocked.
**Phase:** A
**Leverage:** 4 cells / 1 file = **4.0** (M09 and LIUS PW→WIRED for both subtypes)

---

### W-05 — M25 supply score from `event_forecasts` for supply subtypes

**Resolves:** EP-07, FA-01
**Absorbs from Capital/Exit D4:** CE-12 is ADJACENT (same event source, different consumer — see W-10)
**Files:**
- `backend/src/services/jedi-score.service.ts` — `calculateSupplyScore()` lines 269–291

**Change:** Add secondary query alongside existing `news_events` query:
```typescript
const m35Supply = await pool.query(`
  SELECT SUM(ef.point_estimate) as m35_units
  FROM event_forecasts ef JOIN key_events ke ON ke.id = ef.event_id
  WHERE ke.subtype IN ('multifamily_delivery','multifamily_permit')
    AND ke.submarket_id = $submarket
    AND ef.metric_key IN ('deliveries','permits_issued','net_absorption_units')
    AND ef.status = 'active' AND ef.window_months = 12
`);
const m35Demolition = await pool.query(`...ke.subtype IN ('demolition','conversion')...`);
const pipelineUnits = (supply.total_units || 0)
  + (parseFloat(m35Supply.rows[0].m35_units) || 0)
  - (parseFloat(m35Demolition.rows[0].m35_units) || 0);
```

**Coordinate with:** TE FIX-4 also edits `jedi-score.service.ts` (line 345, different function). These MUST be dispatched serially (W-05 first, TE FIX-4 second) or scoped to one agent.
**Depends on:** Nothing. Unblocked.
**Phase:** A
**Leverage:** 4 cells / 1 file = **4.0** (M25 NW→WIRED for multifamily_delivery, multifamily_permit, demolition, conversion)

---

### W-06 — M03 devcap wiring: `entitlement_approval`, `zoning_upzoning`, `multifamily_permit`

**Resolves:** EP-06
**Absorbs from Capital/Exit D4:** Nothing (M03 is outside CE audit scope)
**Absorbs from Traffic:** Nothing
**Files:**
- `backend/src/services/entitlement.service.ts` — feasibility pipeline entry point
- `backend/src/services/zoning-recommendation-orchestrator.service.ts` — HBU analysis entry point

**Change:**
```typescript
// entitlement.service.ts: competitive supply from approved entitlements + permits
const competitiveApprovals = await pool.query(`
  SELECT magnitude_value FROM key_events
  WHERE subtype IN ('entitlement_approval','multifamily_permit')
    AND submarket_id = $submarket
    AND status IN ('announced','in_progress','materialized')
`);

// zoning-recommendation-orchestrator.service.ts: upzoning density uplift
const upzoningEvents = await pool.query(`
  SELECT magnitude_score FROM key_events
  WHERE subtype = 'zoning_upzoning' AND submarket_id = $submarket
    AND status NOT IN ('draft','cancelled')
`);
```

**Depends on:** Nothing. Unblocked.
**Phase:** A
**Leverage:** 6 cells / 2 files = **3.0** (M03 NW→WIRED for entitlement_approval, zoning_upzoning, multifamily_permit)

---

### W-07 — M14 macro wiring (UNIFIED: EP Fix 7 + CE-03 / D4 merged dispatch)

> **This is the D4 CE-03 absorber.** EP Fix 7 and CE-03 target the same two files with the same event subtypes. They MUST be ONE dispatch. Any separate dispatch of either is the divergent-parallel-mechanism disease the synthesis exists to prevent.

**Resolves:** EP-05, CE-03
**Absorbs from Capital/Exit D4:** CE-03 fully — this IS the D4 CE-03 work, merged
**Files:**
- `backend/src/services/debt-advisor/rate-environment.service.ts` — rate curve construction function
- `backend/src/services/cycle-intelligence.service.ts` — phase determination function
- Kafka subscription registration for `event.classified` filtered to `M14_macro` (new Kafka consumer, per CE FIX-5 / Causal Discipline §3.4 wiring policy reference table)

**Change:**
```typescript
// rate-environment.service.ts — rate_move forward overlay on SOFR forward curve
const rateMoveEvents = await pool.query(`
  SELECT magnitude_value, materialization_date FROM key_events
  WHERE subtype = 'rate_move' AND status IN ('announced','in_progress')
    AND msa_id = $msaId ORDER BY materialization_date
`);
// Apply magnitude_value (bps) as forward overlay on fwdCurve keyed to materialization_date
// Also apply major_relocation_announcement cap rate compression signal
// and regional_shock insurance spread in their respective sub-functions

// cycle-intelligence.service.ts — recession regime override
const recessionEvents = await pool.query(`
  SELECT confidence FROM key_events
  WHERE subtype = 'recession_indicator'
    AND status IN ('announced','in_progress','materialized')
    AND msa_id = $msaId AND confidence >= 0.6 LIMIT 1
`);
if (recessionEvents.rows.length > 0) phase = 'Contraction';
```

**Phase B follow-on (corpus-gated):** Event-impact magnitudes — how much a `rate_move` shifts the forward curve, how much `regional_shock` widens cap spreads. Requires M37 analog library / M38 reliability backtests.

**Depends on:** Nothing for Phase A. Unblocked.
**Sequencing note:** W-07 must land BEFORE W-08 (CE-16 F3 consumer wiring) because W-08 connects modules to cycle intelligence, which should already be event-informed when those consumers arrive.
**Phase:** A (wiring) / B (magnitudes)
**Leverage:** 4 cells / 2 files = **2.0** (rate_move×M14, recession_indicator×M14, major_relocation_announcement×M14, regional_shock×M14 — all NW→WIRED)

---

### W-08 — CE-16 Facet 3: wire cycle intelligence consumers (Debt / Exit Timing / Exit Strategy)

**Resolves:** CE-16 Facet 3
**Absorbs from Capital/Exit D4:** CE-16 F3 fully absorbed here (was part of D4 staging)
**Files:**
- `backend/src/services/debt-advisor/debt-plan-formulator.service.ts` — or rate-environment — add call to `cycleIntelligenceService.getPhase()` / `predictFullChain()`
- Exit Timing consumer (deterministic model runner or new integration) — use `FullChainPrediction.capRateMovement` in exit cap trajectory
- Exit Strategy feed endpoint (to be created in W-09) — include cycle phase in the `/exit-trajectory` response payload

**Depends on:** W-07 (cycle-intelligence.service.ts must be event-aware before wiring its consumers makes sense — the `predictCapRateMovement` and `predictFullChain` causal chain should reflect real events, not just example constants, when Debt begins consuming them)
**Phase A pre-condition note:** CE-16 Facet 2 (ops check — `SELECT COUNT(*), MAX(snapshot_date) FROM m28_cycle_snapshots`) should be confirmed populated in production before consumers are wired. If the table is empty, the cycle intelligence output is the stubbed Phase B state.
**Phase:** A (consumer wiring) / B (chain coefficient calibration from `historical_observations` corpus — same corpus gate as CE-M26)

---

### W-09 — Exit trajectory endpoint + frontend wiring (replaces D4 CE-14, CE-04, CE-07, CE-15)

**Resolves:** CE-04, CE-07, CE-14, CE-15
**Absorbs from Capital/Exit D4:** CE-14 fully (frontend half of the W-02 backend work); CE-04 and CE-07 scoped as sub-items here
**Files:**
- New backend endpoint: `GET /api/v1/deals/:dealId/exit-trajectory` — returns LIUS exit cap year projections + Debt rate environment classification + M07/M35 supply trajectory for N years
- `frontend/src/components/deal/sections/ExitStrategyTabs.tsx` — lines 265–268 (`rg/cr/sp/va` hardcoded arrays → live endpoint)
- `frontend/src/components/deal/sections/ExitCapitalModule.tsx` — lines 108–158 (`RENT_GROWTH_21Y`, `CAP_RATES_21Y`, `SUPPLY_21Y`, `T10_21Y` → live endpoint)
- `frontend/src/components/deal/sections/ExitDrivesCapital.tsx` — lines 28–32 (same)
- `frontend/src/components/deal/sections/ConvergenceChart.tsx` — CE-15: same hardcoded-array defect on Portfolio / AssetOwned surfaces; include in same scope
- `frontend/src/components/deal/sections/ExitStrategyTabs.tsx` `useMonitoringData()` — CE-05: replace hardcoded mock with live drift detection endpoint

**Depends on:** W-02 (LIUS trajectory-engine.ts M35-aware — provides the backend trajectory this endpoint serves), W-07 (rate environment classification event-aware)
**Phase B additionally depends on:** D2 PR landing — the historical back-half of the 21-year projection in `ExitCapitalModule.tsx` requires `historical_observations.realized_cap_rate_change_t*`
**Phase:** A (wiring, endpoint, replace hardcoded arrays with live data) / B (historical back-half of 21-year projection)
**Also absorbs:** CE-05 (Monitor tab hardcoded data — `useMonitoringData()` stub replacement is in scope for the same frontend dispatch)

---

### W-10 — Exit Strategy supply wiring from M35/M07 (CE-12)

**Resolves:** CE-12
**Absorbs from Capital/Exit D4:** CE-12 fully absorbed here
**Files:**
- `frontend/src/components/deal/sections/ExitStrategyTabs.tsx` — `supplyPressure` / `buyerPressure` RSS components
- `frontend/src/components/deal/sections/ExitCapitalModule.tsx` — supply-related RSS inputs
- Backend: extend the `/exit-trajectory` endpoint (W-09) to include M35 supply trajectory data

**Change:** Connect `supplyPressure` / `buyerPressure` RSS sub-scores to:
1. M07 supply data (via TE FIX-4's `getTrafficIntelligence()` / `calculateTrafficContributionToJEDI()` path, once wired)
2. M35 `multifamily_delivery` events (same canonical query as W-05 but for Exit Strategy consumer context)

**Depends on:** W-09 (the `/exit-trajectory` endpoint already exists for this to extend); W-05 (adjacent supply-event query pattern is already established); TE FIX-4 (M07 supply signal available via bridge, preferable but not strictly blocking)
**Phase:** A (structural wiring) / B (RSS component calibration weights)

---

### Summary table

| ID | Name | Resolves | Key files | Cells flipped | Phase | Gate |
|---|---|---|---|---|---|---|
| W-01 | CA schema repoint | EP-02 | `fetch_m35_event_forecast.ts` | 16 CA | A | None |
| W-02 | LIUS M35 bridge | EP-03, TM-03, FA-02, CE-01(A) | `trajectory-engine.ts`, new `m35-bridge.ts` | 16 LIUS | A/B | D1✓, D3✓ |
| W-03 | M07 M35 ingestion | EP-01 | `trafficPredictionEngine.ts`, `trafficCalibrationJob.ts` | 10 M07 | A | TE FIX-1✓ dispatched |
| W-04 | M09 proforma mutation | EP-04 | `proforma-adjustment.service.ts` | 4 M09/LIUS | A | None |
| W-05 | M25 supply score | EP-07, FA-01 | `jedi-score.service.ts` | 4 M25 | A | None; serial before TE FIX-4 |
| W-06 | M03 devcap wiring | EP-06 | `entitlement.service.ts`, `zoning-recommendation-orchestrator.service.ts` | 6 M03 | A | None |
| W-07 | M14 macro wiring (UNIFIED) | EP-05, CE-03 | `rate-environment.service.ts`, `cycle-intelligence.service.ts`, Kafka reg | 4 M14 | A/B | None for A |
| W-08 | CE-16 F3 — cycle intel consumers | CE-16 F3 | debt-advisor service, exit consumers | — | A/B | W-07 |
| W-09 | Exit trajectory + frontend wiring | CE-04, CE-05, CE-07, CE-14, CE-15 | New endpoint, ExitStrategyTabs, ExitCapitalModule, ExitDrivesCapital, ConvergenceChart | — | A/B | W-02, W-07; D2 for Phase B |
| W-10 | Exit Strategy supply wiring | CE-12 | ExitStrategyTabs, ExitCapitalModule (supply RSS) | — | A/B | W-09, W-05, TE FIX-4 preferred |

**Total cell flips from W-01..W-07 alone:** 64 of 66 EP NOT_WIRED/MISCLASSIFIED cells (matching the EP audit's projection). W-08..W-10 address CE-specific findings not in the EP matrix.

---

## 5. Disposition of Staged D4 Draft

**D4 as staged consists of:** CE-03 + CE-14 + CE-12 + CE-16 F3

### Verdict: D4 dissolves. All four findings are absorbed into the consolidated sequence.

**Reasoning:** D4's scope is entirely covered by W-07 (CE-03), W-02 + W-09 (CE-14 backend + frontend), W-10 (CE-12), and W-08 (CE-16 F3). Dispatching D4 as a monolithic agent after this synthesis would:
1. Duplicate EP Fix 7 into the same files (rate-environment.service.ts, cycle-intelligence.service.ts) — triggering the divergent-parallel-mechanism failure
2. Lose the sequencing dependency (W-07 must precede W-08 which precedes W-09 for the cycle intelligence to be event-informed before consumers arrive)

### Per-finding absorption

| D4 Finding | Absorbed into | Rationale |
|---|---|---|
| CE-03 — M14_macro channel has zero consumers | **W-07** (MERGED with EP Fix 7) | Identical files, identical subtypes, identical channel. Must be one dispatch. |
| CE-14 — ExitCapitalModule events display-only; cap-rate trajectory unaffected | **W-02** (backend half) + **W-09** (frontend half) | W-02 makes trajectory-engine M35-aware (backend); W-09 replaces the hardcoded frontend arrays with the live trajectory. CE-14 is the frontend half only. |
| CE-12 — Exit Strategy `supplyPressure`/`buyerPressure` event-blind | **W-10** | ADJACENT to EP Fix 5 (same event source, different consumer). W-10 absorbs CE-12 fully. |
| CE-16 F3 — Debt / Exit modules not consuming cycle intelligence | **W-08** | Sequentially dependent on W-07 landing first. |

---

## 6. Disposition of Traffic Fixes

Traffic FIX-1 is dispatched. FIX-3 is drafted. Classifying FIX-2 through FIX-8 as event-wiring (belongs in consolidated sequence) vs. traffic-internal (stays in Traffic audit's own track).

| TE Fix | Status | Classification | Disposition |
|---|---|---|---|
| FIX-1 — Schedule TrafficCalibrationJob via Inngest | **DISPATCHED** | Traffic-internal (infrastructure) | Completed; W-03 depends on it being in the codebase |
| FIX-2 — Kafka subscriber for `traffic.calibration.updated` | Open | Traffic-internal (downstream refresh) | Stays in Traffic audit track; no event-subtype wiring. Coordinate: dispatch after W-03 so the calibration job fires M35-aware events when it runs |
| FIX-3 — Emit asymmetric confidence bands | **DRAFTED** | Traffic-internal (output contract) | Stays in Traffic audit track; enables M09/M14/M25 tail-risk consumers but is not event-wiring itself |
| **FIX-4 — Wire `traffic-module-wiring.ts` bridge functions** | Open | **ADJACENT to consolidated sequence** | Include in consolidated ordering: must land AFTER W-03 (so the M35-aware prediction engine is what JEDI and M08 receive via the bridge); must land AFTER W-05 (both edit `jedi-score.service.ts`). Dispatch as TE FIX-4 from the Traffic track, but note the dependency on W-03 and the serial requirement with W-05. |
| FIX-5 — T-08 generator proximity score as named field | Open | Traffic-internal | Stays in Traffic audit track |
| FIX-6 — Resolve V1/V2 prediction path ambiguity | Open | Traffic-internal | Stays in Traffic audit track |
| FIX-7 — Deprecate legacy `traffic-calibration.service.ts` | Open | Traffic-internal | Stays in Traffic audit track |
| FIX-8 — Empirical absorption p25/p75 | Open | Traffic-internal | Stays in Traffic audit track |

**Summary:** Only TE FIX-4 has a meaningful sequencing dependency on the consolidated event-wiring sequence. All other Traffic fixes are traffic-internal and can proceed on the Traffic audit's own track, with the exception that FIX-2 should coordinate dispatch timing with W-03.

---

## 7. F47 / Task #727 Placement

**Verdict: F47 is CLOSED as a separate ticket. It does NOT fold into the consolidated sequence.**

Task #727 completed the synthesis-pass reconciliation of the `POST /rate/cycle-phase` endpoint (F47, `capital-structure.service.ts:classifyCyclePhase()`) against the CE-07 rate-environment path (`classifyRateEnvironment()`). Decision recorded in `CAPITAL_EXIT_SUBSYSTEM_AUDIT.md §8.1`: keep separate.

**Why it stays separate from the consolidated sequence:**
1. F47 is a stateless formula (no event-wiring; caller provides `fedDirection`, `durationMonths`, `yieldCurveSlope` on each POST). It has no `key_events` or `event_forecasts` reads and requires none.
2. The synthesis addresses event-wiring gaps — how M35 events propagate to consuming modules. F47 is a downstream formula tool, not an event consumer.
3. F47's callers (`DebtTab.tsx:171`, `CapitalStructureSection.tsx:195`) are UI consumers of user-provided inputs, not event-driven pipelines.

**No action required from this synthesis for F47.** CE-07 (the rate environment classification convergence finding) is addressed by W-07 (wiring M14 events into `rate-environment.service.ts`), which is the live-data path. F47's stateless phase label is a separate, complementary signal that does not conflict.

---

## 8. Open Dependencies and Gates

### Critical-path gates

| Gate | What it blocks | Status | Action |
|---|---|---|---|
| **D2 PR landing** (CE FIX-2 — M26 cap rate archive: `cap_rate_archive` table + writer + `source-resolver.ts` redirect) | W-02 Phase B (Bayesian trajectory in `trajectory-engine.ts:84`), W-09 Phase B (historical back-half of 21-year cap rate projection in `ExitCapitalModule.tsx`), CE-16 F1 Phase B (empirical chain coefficients in `cycle-intelligence.service.ts`) | **PR-PENDING** | No Phase B dispatch on trajectory-engine.ts or ExitCapitalModule until D2 is merged and `historical_observations.realized_cap_rate_change_t*` are populated |
| **TE FIX-1 confirmed** (Inngest cron for TrafficCalibrationJob) | W-03 (baseline exclusion in `trafficCalibrationJob.ts` body) | **DISPATCHED** | Confirm merge before W-03 dispatch |
| **W-01 landing** (CA schema repoint) | CA agent has working M35 access for all 16 subtypes | Unblocked | Highest-leverage fix; dispatch first |
| **W-02 Phase A landing** | W-09 (the `/exit-trajectory` endpoint needs the trajectory-engine to be M35-aware) | Blocked only by D1✓ and D3✓ (already merged) | Dispatch second |
| **W-07 landing** | W-08 (cycle intelligence consumers should receive event-informed cycle phase) | Unblocked for W-07 | Dispatch W-07 before W-08 |
| **W-09 landing** | W-10 (exit trajectory endpoint provides the extension point for supply wiring) | Blocked by W-02, W-07 | W-09 after W-02 + W-07 |
| **W-05 serial-before-TE-FIX-4** | Both edit `jedi-score.service.ts` (different functions) | W-05 unblocked | W-05 → TE FIX-4, serial or same agent |

### Non-critical ordering preferences (leverage descends)

```
W-01  (16.0) → immediately
W-02  (8.0)  → immediately after D1✓ D3✓ confirmed (already merged)
W-03  (5.0)  → after TE FIX-1 confirmed
W-04  (4.0)  → any time (independent)
W-05  (4.0)  → any time; serial before TE FIX-4
W-06  (3.0)  → any time (independent)
W-07  (2.0 EP cells, broader CE-03 scope) → after W-04..W-06 can be parallel; before W-08
W-08  → after W-07
W-09  → after W-02 + W-07; D2 for Phase B
W-10  → after W-09 + W-05
TE FIX-4 (Traffic track) → after W-03 + W-05
TE FIX-2 (Traffic track) → after W-03
```

### Phase B corpus gates (all require `historical_observations.realized_cap_rate_change_t*`)

All of the following are Phase B and share a single corpus gate:
- W-02 Phase B: empirical Bayesian exit cap trajectory in `trajectory-engine.ts:84`
- W-09 Phase B: historical back-half of 21-year cap rate projection
- W-08 Phase B: CE-16 F1 empirical chain coefficients in `cycle-intelligence.service.ts`
- W-07 Phase B: event-impact magnitudes for M14 forward overlay

These Phase B items should be consolidated into one dispatch after the corpus gate clears, as they share the same data dependency and many of the same files.

### Ops checks (not code tasks)

- **CE-16 Facet 2:** `SELECT COUNT(*), MAX(snapshot_date) FROM m28_cycle_snapshots` — confirm monthly cron has populated rows before W-08 wires consumers
- **CE-13:** `SELECT COUNT(*) FROM archive_line_items WHERE line_item = 'exitCapRate'` — confirm or rule out any historical seed; informs whether D2's new `cap_rate_archive` table is a clean slate or has legacy rows to migrate

---

## WS-3 Layer 3 — Phase B Empirical Rezone Probability Calibration

**Landed:** Task #763 | **Status:** Engine live, corpus pending (Task #768)

### What was built

Phase B replaces the Phase A hand-set linear constants with empirically-derived rezone rates from `historical_observations`.  The engine is fully deployed; Phase B activates automatically once the corpus is populated — no additional deploy is needed.

### Corpus schema (migration 20260518_historical_obs_rezone_calibration.sql)

Five columns added to `historical_observations`:

| Column | Type | Purpose |
|---|---|---|
| `rezone_upzoning_event_count` | INTEGER | Upzoning events in submarket at observation time |
| `rezone_approval_event_count` | INTEGER | Entitlement-approval events at observation time |
| `rezone_moratorium_active` | BOOLEAN | Was a development moratorium active? |
| `rezone_outcome` | BOOLEAN | Did a confirmed MF rezone occur within the window? |
| `rezone_window_months` | SMALLINT | Observation window (default 24 months) |

Partial index `idx_hist_obs_rezone_corpus` on `(rezone_upzoning_event_count, rezone_outcome) WHERE rezone_outcome IS NOT NULL`.

### Calibration logic (`rezone-trend.service.ts`)

`computeTrendSignalPhaseB()` runs two corpus tiers in parallel:

- **Tier 1 — Submarket-specific:** rows where `submarket_id = current` AND `rezone_window_months = 24`.  Preferred for precision.
- **Tier 2 — Cross-submarket event-density bucket:** rows from any submarket where `ABS(rezone_upzoning_event_count - current) ≤ 2` AND `rezone_window_months = 24` AND moratorium state matches.  Used only when Tier 1 has fewer than 5 observations.

Activation threshold: **5 observations** in the winning tier (`MIN_PHASE_B_CORPUS = 5`).

When activated, a Bayesian shrinkage blend is applied:

```
w = corpusSize / (corpusSize + 20)          # PHASE_B_SHRINKAGE_FACTOR = 20
calibrated = w × empirical_rate + (1-w) × phaseA_base
```

w → 1 as corpus grows; w → 0 when corpus just clears the threshold.  This prevents wild swings from small samples.  Moratorium cap (5%) and global max (40%) are re-applied after blending.

### Fallback transparency

`TrendSignal.phaseBCorpusSize` is always returned — even when Phase B falls back to Phase A.  This enables the Forward Supply UI to distinguish three states:

| UI badge | Condition |
|---|---|
| `PHASE B EMPIRICAL` (green) | Phase B active — `modelPhase = 'B_empirical'` |
| `PHASE A (FALLBACK)` (purple) | Corpus found but < 5 — `phaseBCorpusSize > 0 && modelPhase = 'A_linear'` |
| `PHASE A LINEAR` (purple) | No corpus at all — `phaseBCorpusSize = 0 && modelPhase = 'A_linear'` |

Hover tooltip shows the exact corpus count on all three badges.

### Corpus gate

Phase B does NOT activate until `historical_observations` has ≥5 rows with `rezone_outcome IS NOT NULL` and compatible `rezone_upzoning_event_count` values.

**Next step:** Task #768 — ingest real Atlanta rezone outcomes to activate Phase B in production.

### Pending Phase B items (not part of Task #763)

- **Task #768:** Load real Atlanta rezone outcomes so Phase B activates
- **Task #769:** Show inline corpus count (n=N) next to phase badge in the UI
- **Task #770:** Back-test `PHASE_B_SHRINKAGE_FACTOR = 20` against held-out Atlanta outcomes

---

*End of EVENT_WIRING_SYNTHESIS.md*
