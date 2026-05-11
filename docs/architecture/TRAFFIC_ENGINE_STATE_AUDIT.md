# Traffic Engine (M07) State Audit — Phase 0

**Audit date:** 2026-05-11
**Auditor:** Claude (agent)
**Scope boundary:** M07 internal state and outputs flowing OUT of M07.
**Out of scope:** M35→M07 event ingress, UI traffic visualizations, performance, test execution against live DB.

> **BOUNDARY NOTE vs #715:** Task #715 (Event Propagation Audit, completed) covers events flowing INTO M07 — M35 event subtypes consumed by calibration, baseline-exclusion windows (Mechanism A), and m35TrafficApiService usage. This audit covers M07's internal state, coefficient hierarchy, output contract, extractor pipeline, operational modes, and consumption surface only. Where a finding is adjacent to #715 scope, it is cross-referenced rather than reproduced.

---

## Table of Contents

1. [Header](#1-header)
2. [Service Inventory with Role Classification](#2-service-inventory-with-role-classification)
3. [Calibration State — Baseline, Platform, Deal Layers](#3-calibration-state--baseline-platform-deal-layers)
4. [Output Contract — M07 Response Fields](#4-output-contract--m07-response-fields)
5. [Extractor Inventory](#5-extractor-inventory)
6. [Operational Mode Status](#6-operational-mode-status)
7. [Consumption Surface](#7-consumption-surface)
8. [Calibration Job State](#8-calibration-job-state)
9. [Spec Compliance Gaps](#9-spec-compliance-gaps)
10. [Finding Inventory (TE-N)](#10-finding-inventory-te-n)
11. [Recommended Phase 2 Build Sequence](#11-recommended-phase-2-build-sequence)

---

## 1. Header

This audit catalogs M07 Traffic Engine internal state, outputs, calibration layers, extractors, operational modes, consumption surface, and spec compliance gaps as of 2026-05-11. It is the Phase 0 prerequisite for any Phase 2 fixes. It does not alter code.

**Related documents:**
- `docs/architecture/EVENT_PROPAGATION_AUDIT.md` — #715, covers M35→M07 event ingress
- `docs/architecture/RENT_ROLL_ANALYTICS_FRAMEWORK.md`
- `docs/architecture/deal-capsule-blueprint.md`

---

## 2. Service Inventory with Role Classification

### 2.1 Known Entry Points (from task spec)

| File | Role | Status | Notes |
|---|---|---|---|
| `backend/src/types/traffic-calibration.types.ts` | TYPE_SYSTEM | INVOKED | Canonical type definitions for all M07 contracts: `LayeredValue`, `TrafficCoefficientFamily`, `CalibrationMeta`, `StartingState` discriminated union, `DerivedSnapshotMetrics`, `ConcessionEnvironmentOutput`, `SubjectTrafficHistory` |
| `backend/src/jobs/trafficCalibrationJob.ts` | CALIBRATION | INVOKED (on-demand) | Nightly job: evidence → Bayesian update → `traffic_calibration_factors`. Invoked via `POST /api/v1/calibration/job/run`. **No Inngest/cron schedule found** — see TE-08 |
| `backend/src/services/trafficPredictionEngine.ts` | PREDICTION | INVOKED | Primary prediction entry point. Two paths: `predict()` (v1, 2084 lines) and `predictTrafficV2()` (v2 funnel). Default export is singleton instance |
| `backend/src/services/traffic-calibration.service.ts` | CALIBRATION | INVOKED (legacy) | Legacy submarket calibration writing to `traffic_submarket_calibration` table. **Parallel and disconnected** from the `traffic_calibration_factors` Bayesian hierarchy — see TE-10 |
| `backend/src/services/trafficToProFormaService.ts` | CONSUMPTION_BRIDGE | INVOKED | Two code paths: `pushTrafficToProForma()` (legacy, writes `proforma_assumptions` 3-layer assumptions) and `getTrafficProjection()` (modern, reads cached trajectories for `financials-composer`) |
| `backend/src/services/m35-traffic-api.service.ts` | M35_BRIDGE | INVOKED | Out of scope per boundary — see #715 |
| `backend/src/services/traffic-correlation.service.ts` | CORRELATION | INVOKED | T-04 (correlation signal), T-07 (8-week trajectory), T-09 (competitive share). Reads from `latest_traffic_predictions` view |
| `backend/src/services/traffic-analytics.service.ts` | ANALYTICS/EXTRACTION | INVOKED | `computeTrafficSnapshot()`: velocity, seasonality, expiration waterfall, lease term distribution from `deal_lease_transactions`. Separate pipeline from rent-roll derivations |
| `backend/src/services/trafficLearningService.ts` | LEARNING | INVOKED | EMA recalibration of conversion rates (α=0.15), per-metric MAPE, bias detection. Writes `traffic_learned_rates`. Invoked by v2 prediction path and upload endpoints |
| `backend/src/services/comp-traffic.service.ts` | ANALYTICS | INVOKED | Comp property traffic lookups, proxy candidates, deal-with-traffic-history queries |
| `backend/src/services/traffic-data-sources.service.ts` | DATA_SOURCE | INVOKED | ADT data ingestion from CSV/Excel, nearest-ADT queries, real-time Google factor |
| `backend/src/services/traffic-growth-index.service.ts` | DATA_SOURCE | INVOKED | Computes `trafficGrowthIndex` = (Google realtime ADT − DOT historical ADT) / DOT historical ADT × 100 |
| `backend/src/services/traffic-module-wiring.ts` | ANALYTICS | ⚠ ORPHANED | Exports `calculateTrafficContributionToJEDI()`, `calculateTrafficStrategyModifiers()`, `calculateTrafficProFormaInputs()`. **No live callers found** — see TE-07 |
| `backend/src/api/rest/traffic-ai.routes.ts` | ROUTE | INVOKED | Mapbox isochrone generation for drive-time boundaries. Unrelated to M07 calibration |
| `backend/src/api/rest/deal-traffic.routes.ts` | ROUTE | INVOKED | `GET /:dealId/traffic/forecast-vs-actual`, calibration stats |

### 2.2 Discovered Files (appended per Files-of-Record protocol)

| File | Role | Status | Notes |
|---|---|---|---|
| `backend/src/services/coefficient-resolver.service.ts` | CALIBRATION | INVOKED | Subject-First Calibration rule implementation. Resolves 4-layer hierarchy (SUBJECT → PLATFORM → BASELINE). Called from `trafficPredictionEngine.ts` and `m07-calibration.routes.ts` |
| `backend/src/services/starting-state.service.ts` | CALIBRATION | INVOKED | Resolves STABILIZED / LEASE_UP / REDEVELOPMENT starting state from deal data + rent roll. Called from `trafficPredictionEngine.ts` and `m07-calibration.routes.ts` |
| `backend/src/services/rent-roll-derivations.service.ts` | EXTRACTION | INVOKED | Single-snapshot derivations: signing velocity 24m histogram, renewal rate proxy, expiration waterfall, unit-type breakdown. Writes to `rent_roll_snapshots.derived_metrics` |
| `backend/src/services/module-wiring/m07-projections-adapter.ts` | CONSUMPTION_BRIDGE | INVOKED | Stateless transformer: M07 dealContext data → `OccupancyLeasingBlock` + `ConcessionsBlock` for F9 Projections tab. Reads `starting_state`, `concession_environment`, `subject_history` |
| `backend/src/services/concession-environment-engine.ts` | CALIBRATION | INVOKED | M07 concession sub-engine (Task #525). Produces `ConcessionEnvironmentOutput.per_year[]`. Reads `traffic_calibration_factors` for submarket concession intensity |
| `backend/src/services/catalog-metrics-wiring.service.ts` | CALIBRATION | INVOKED | Layer A boost + Layer C dampers (`CatalogMetricWeight`). Applied as final step in `trafficPredictionEngine.predict()` |
| `backend/src/services/proforma-adjustment.service.ts` | CONSUMPTION_BRIDGE | INVOKED | `updatePlatformLayerFromTraffic()` writes vacancy/rent/exitCap to `proforma_assumptions`. Also assembles `getTrafficProjection()` result for financials-composer |
| `backend/src/services/financials-composer.service.ts` | CONSUMPTION_BRIDGE | INVOKED | Calls `getTrafficProjection()`. Reads `calibrated.vacancyPct`, `calibrated.rentGrowthPct`, `yearly[]`, `leasingSignals` for M07 vacancy formula derivation |
| `backend/src/services/jedi-score.service.ts` | ANALYTICS | ⚠ PARTIAL | Reads M07 via `dataFlowRouter.getModuleData('M07', dealId)` → `traffic_trajectory` field only. See TE-06 |
| `backend/src/services/m08-strategies.service.ts` | ANALYTICS | ✗ SPEC_ONLY | References `trafficQuadrant` in hardcoded mock data only. No live read of M07 `expected_demand_strength` — see TE-06 |
| `backend/src/services/rent-roll/rent-roll-parser.service.ts` | EXTRACTION | INVOKED | Detects format (Yardi CSV/XLSX, generic), maps columns, stores `leasing_events` rows |
| `backend/src/services/rent-roll/rent-roll-diff.service.ts` | EXTRACTION | INVOKED | S2 diff-extractor: computes `SubjectObservedDynamics` from ≥2 snapshots ≥60 days apart |
| `backend/src/services/rent-roll/subject-history-s1.service.ts` | EXTRACTION | INVOKED | S1 extractor: computes `SubjectCurrentState` from a single parsed snapshot |
| `backend/src/services/dot-temporal-profiles.service.ts` | DATA_SOURCE | INVOKED | FDOT seasonal/hourly/DOW factors for road classes. Used by hourly walk-in potential calculation |
| `backend/src/services/trend-pattern-detector.ts` | ANALYTICS | INVOKED | Classifies digital+AADT momentum into named patterns (e.g. ACCELERATING, SEASONAL_DRIVEN) |
| `backend/src/services/multifamilyTrafficService.ts` | ANALYTICS | INVOKED | T-05 lease-to-traffic conversion for multifamily; not the same as M07's leasing funnel |
| `backend/src/services/digitalTrafficService.ts` | DATA_SOURCE | INVOKED | T-03 digital traffic score (separate from M07 core prediction) |
| `backend/src/api/rest/m07-calibration.routes.ts` | ROUTE | INVOKED | Full M07 calibration API: upload, derive, snapshots, job/run, coefficients, starting-state, absorption-benchmark, deal-mode update, subject-history |
| `backend/src/api/rest/trafficPrediction.routes.ts` | ROUTE | INVOKED | Legacy prediction endpoints + `traffic_calibration_legacy_factors` write path |
| `backend/src/api/rest/leasing-traffic.routes.ts` | ROUTE | INVOKED | Invokes `trafficCalibrationService.recalculateForDeal()` (legacy path) |
| `backend/src/api/rest/traffic-comps.routes.ts` | ROUTE | INVOKED | Comp traffic analysis endpoints |
| `backend/src/api/rest/traffic-data.routes.ts` | ROUTE | INVOKED | ADT data and property traffic context endpoints |
| `backend/src/services/kafka/event-schemas.ts` | TYPE_SYSTEM | INVOKED | `TrafficCalibrationUpdatedMessage` schema, `KAFKA_TOPICS.TRAFFIC_CALIBRATION` constant |

---

## 3. Calibration State — Baseline, Platform, Deal Layers

### 3.1 Baseline Layer

**Source:** `BASELINE_COEFFICIENTS` constant, `backend/src/jobs/trafficCalibrationJob.ts` lines 29–36

| Coefficient | Value | Interpretation |
|---|---|---|
| `visibility_capture_rate` | 0.04 | Fraction of passing vehicles that notice the property |
| `apartment_seeker_pct` | 0.02 | Fraction of visibility-aware passers-by who are actively seeking an apartment |
| `stop_probability` | 0.15 | Probability a seeker stops and walks in |
| `walkin_to_tour` | 0.40 | Fraction of walk-ins who schedule/take a tour |
| `tour_to_app` | 0.60 | Fraction of tours that result in an application |
| `app_to_signed` | 0.70 | Fraction of applications that convert to a signed lease |

**Bayesian prior role:** Each coefficient's baseline value serves as the cold-start prior when `n_prior = 0` (no existing DB row). On subsequent updates the DB row's `posterior_value` becomes the prior. (`trafficCalibrationJob.ts` lines 390–396)

**Classification: ✓ FULLY_IMPLEMENTED** — constants defined, used as prior, invoked at every coefficient resolution path.

---

### 3.2 Platform Layer

**Storage table:** `traffic_calibration_factors`

**Schema dimensions (from `rollUpToBuckets`, lines 270–333):**

| Scope level | Dimensions | Priority |
|---|---|---|
| `submarket` | msa_id + submarket_id + property_class + vintage_band + cal_window | Most specific |
| `msa` | msa_id + property_class + cal_window | — |
| `class` | property_class + cal_window | Cross-MSA |
| `vintage` | vintage_band + cal_window | Cross-MSA |
| `platform` | (all null) + cal_window | Most general |

**Vintage bands:** `pre_1980`, `1980_2000`, `2000_2015`, `post_2015` (`trafficCalibrationJob.ts` lines 584–592)

**Calibration windows:** TTM (last 12 months), PYTM (prior 12 months, 13–24 months ago), TTM_24 (24 months, for sparse buckets)

**Bayesian update formula** (`bayesianUpdateBucket`, lines 394–396):
```
posterior = (priorValue × n_prior + avgEvidence × n_evidence) / (n_prior + n_evidence)
```

**Sample-size thresholds:**
- `MIN_PROPERTIES_TTM = 5` (required for TTM/PYTM buckets)
- `MIN_PROPERTIES_SPARSE = 2` (required for TTM_24 buckets)
- Buckets below threshold are silently skipped (no fallback logging)

**Confidence band stored per row** (`trafficCalibrationJob.ts` lines 398–400):
```typescript
const stdDev = this.stdDev(evidenceValues);
const confidenceLow  = Math.max(0, posterior - stdDev);
const confidenceHigh = posterior + stdDev;
```
This is ±1σ around the posterior — NOT an asymmetric percentile distribution. (See TE-01.)

**Classification: ✓ FULLY_IMPLEMENTED** — Bayesian update, multi-scope hierarchy, sample-size gating, confidence band, history archiving all implemented.

**Fallback when bucket missing:** `CoefficientResolverService.loadPlatformCoefficients()` tries scopes in degradation order: submarket → msa → class → vintage → platform. Returns baseline constants when all scopes miss.

---

### 3.3 Deal Layer — Subject-First Calibration Rule

**Implementation:** `backend/src/services/coefficient-resolver.service.ts`

**Entry point:** `resolveForDeal(dealId, submarketId, propertyClass, yearBuilt, msaId)` (line 61)

**Four-layer resolution hierarchy:**
1. **SUBJECT** — subject_traffic_history for this deal (S1/S2 observed dynamics)
2. **PLATFORM** — traffic_calibration_factors (Bayesian posterior, scope-degraded)
3. **BASELINE** — hard-coded BASELINE_COEFFICIENTS constants
4. ~~DEAL~~ — intentionally excluded: "The DEAL proxy layer (single-snapshot derived coefficients) is intentionally excluded from M07 resolution" (comment at line 9)

**Subject-First promotion threshold** (`SUBJECT_N_REQUIRED`, `traffic-calibration.types.ts` lines 266–279):

| Metric | n_required | Subject coefficient |
|---|---|---|
| `walkin_to_tour` | 6 | signing_velocity |
| `stop_probability` | 6 | days_vacant_median |
| `app_to_signed` | 6 | renewal_rate |
| `apartment_seeker_pct` | 6 | concession_trend / loss_to_lease |
| `tour_to_app` | 6 | tour_to_app |
| `visibility_capture_rate` | 6 | visibility_capture_rate |
| `renewal_rate` | 12 | (S2 longitudinal) |
| `turnover_rate` | 12 | — |
| `signing_velocity` | 8 | — |
| `days_vacant_median` | 8 | — |
| `loss_to_lease` | 4 | (S1, single snapshot) |
| `concession_trend` | 3 | (S2, 3 diff periods) |

**Bayesian blend formula** (lines 144–153):
```typescript
w_subject = min(1, n_observations / n_required)
effective = w_subject × subject_value + (1 − w_subject) × platformPeerValue
```
- `w >= 0.5` → tier = **SUBJECT** (subject dominates)
- `0 < w < 0.5` → tier = **PLATFORM** (peer dominates; blend still applied)
- `w = 0` → bypass subject → PLATFORM or BASELINE

**Wiring into prediction engine** (`trafficPredictionEngine.ts` lines 1104–1126):
```typescript
[earlyResolvedCoefficients, earlyStartingState] = await Promise.all([
  this.coefficientResolver.resolveForDeal(...),
  this.startingStateService.resolveStartingState(dealId),
]);
```
Resolved before the conversion chain so Bayesian values bake into walk-in math.

**Is it actually firing?** The code path is fully wired and will fire for any deal where `subject_traffic_history` rows exist (i.e., after rent roll upload + S1/S2 derivation). For deals without rent rolls, `loadSubjectHistory()` returns null and the resolver falls straight to platform/baseline.

**Classification: ✓ FULLY_IMPLEMENTED** — Subject-First rule implemented, threshold table defined, blend formula correct, wired into prediction engine before conversion chain.

---

## 4. Output Contract — M07 Response Fields

### 4.1 Primary Response Shape

The canonical type is `TrafficPrediction` (`trafficPredictionEngine.ts` lines 212–299). The extended calibrated variant is `TrafficPredictionCalibrated` (`traffic-calibration.types.ts` lines 235–255).

| Field | TypeScript type | Classification | Notes |
|---|---|---|---|
| `property_id` | `string` | ✓ EMITTED | Always present |
| `deal_id` | `string \| undefined` | ✓ EMITTED | Optional — absent for property-only predictions |
| `weekly_walk_ins` | `number` | ✓ EMITTED | Final mode-dispatched value (post-catalog-adjustment) |
| `daily_average` | `number` | ✓ EMITTED | `weekly_walk_ins / 7` |
| `peak_hour_estimate` | `number` | ✓ EMITTED | Max hourly walk-in potential |
| `breakdown.*` | object | ✓ EMITTED | physical_factors, market_demand_factors, effective_base_adt, distance_decay, road_class_weight, frontage_factor, temporal_adjusted_adt, traffic_trajectory, etc. |
| `conversion_chain` | `ConversionChainRates` | ✓ EMITTED | visibility_capture_rate, apartment_seeker_pct, stop_probability, combined_rate, source |
| `hourly_potential` | `HourlyWalkInPotential[]` | ✓ EMITTED | 9–17h, per-hour directional walk-in potential |
| `daily_breakdown` | `DailyBreakdown[]` | ✓ EMITTED | 7-day DOW walk-in breakdown |
| `temporal_patterns` | object | ✓ EMITTED | weekday_avg, weekend_avg, peak_day, peak_hour |
| `confidence` | `{ score: number; tier: 'High'\|'Medium'\|'Low'; breakdown: Record<string,number> }` | ✓ EMITTED | **SCALAR** — see §4.3 for confidence representation finding |
| `market_context` | object | ✓ EMITTED | submarket, market_condition, foot_traffic_index, supply_demand_ratio |
| `physical_traffic_score` | `PhysicalTrafficScore` | ✓ EMITTED | score 0–100, ADT/walk-in percentiles vs submarket peers |
| `detected_patterns` | `TrendPattern[]` | ✓ EMITTED | Named momentum patterns from trend-pattern-detector |
| `calibration_meta` | `CalibrationMeta` | ✓ EMITTED | When deal context available: match_tier, window, calibration_source, n_peer_properties, confidence_band, coefficients family, mode, subject_history_tier |
| `starting_state` | `StartingState` | ✓ EMITTED | When deal context: STABILIZED \| LEASE_UP \| REDEVELOPMENT discriminated union |
| `match_tier` | `'SUBJECT'\|'DEAL'\|'PLATFORM'\|'BASELINE'` | ✓ EMITTED | Convenience top-level field (promoted from calibration_meta) |
| `window` | `'TTM'\|'PYTM'\|'TTM_24'` | ✓ EMITTED | Convenience field |
| `calibration_source` | `string` | ✓ EMITTED | Convenience field, e.g. `"submarket:atl_midtown \| class:A"` |
| `confidence_band` | `{ low: number; mid: number; high: number }` | ✓ EMITTED | **3-point ±1σ band** — NOT {p10,p25,median,p75,p90} — see TE-01 |
| `deal_mode` | `'STABILIZED'\|'LEASE_UP'\|'REDEVELOPMENT'` | ✓ EMITTED | Convenience field |
| `unit_type_breakdown` | `Array<{unit_type, signing_velocity, days_vacant_avg, concession_intensity, renewal_rate}>` | ✓ EMITTED | When rent roll present for deal |
| `expiration_waterfall` | `Array<{months_out 1–24, expiring_units, expiring_pct}>` | ✓ EMITTED | When rent roll present for deal |
| `model_version` | `string` | ✓ EMITTED | Currently `'1.2.0'` for v1 path |

### 4.2 V2 Funnel Extension (TrafficPredictionV2)

`TrafficPredictionV2` extends `TrafficPrediction` with additional funnel fields (`trafficPredictionEngine.ts` lines 104–135):

| Field | Classification | Notes |
|---|---|---|
| `in_person_tours` | ✓ EMITTED | tours = walk_ins × tour_rate |
| `applications` | ✓ EMITTED | apps = tours × app_rate |
| `net_leases` | ✓ EMITTED | leases = apps × lease_rate × occupancy_modifier |
| `occupancy_pct` | ✓ EMITTED | Next-period occupancy |
| `effective_rent` | ✓ EMITTED | Rent after seasonal adjustment |
| `closing_ratio` | ✓ EMITTED | net_leases / walk_ins |
| `rates` | ✓ EMITTED | {tour_rate, app_rate, lease_rate} |
| `funnel_breakdown` | ✓ EMITTED | {traffic_to_tours, tours_to_apps, apps_to_leases, occupancy_modifier, seasonal_factor} |
| `confidence_v2` | ✓ EMITTED | {score, tier, data_weeks, per_metric} — per-metric confidence |

### 4.3 T-01 through T-10 Signal Classification

From `TrafficIntelligence` interface (`traffic-module-wiring.ts` lines 31–68) and `traffic-correlation.service.ts`:

| Signal | Spec description | Classification | Source service | Notes |
|---|---|---|---|---|
| T-01 | Weekly Walk-In Prediction | ✓ EMITTED | `trafficPredictionEngine.ts` | Core output; mode-dispatched |
| T-02 | Physical Traffic Score (0–100) | ✓ EMITTED | `trafficPredictionEngine.ts` | `PhysicalTrafficScore` (ADT + walk-in percentile vs submarket) |
| T-03 | Digital Traffic Score (0–100) | ⚠ EMITTED_NULL | `digitalTrafficService.ts` | NOT native to M07 core prediction response; separate service |
| T-04 | Traffic Correlation Signal (Hidden Gem / Validated / Hype / Dead) | ✓ EMITTED | `traffic-correlation.service.ts` | 2×2 physical×digital matrix |
| T-05 | Traffic-to-Lease Prediction (closing ratio) | ✓ EMITTED | `trafficPredictionEngine.ts` (v2), `trafficToProFormaService.ts` | `leasingSignals.t05ClosingRatio` |
| T-06 | Capture Rate / Weekly Leases | ✓ EMITTED | `trafficPredictionEngine.ts` | `conversion_chain.visibility_capture_rate` |
| T-07 | Traffic Trajectory (8-week trend) | ✓ EMITTED | `traffic-correlation.service.ts` | `TrafficTrajectory.trend_direction`, `.eight_week_change_pct` |
| T-08 | Generator Proximity Score | ⚠ EMITTED_NULL | `trafficPredictionEngine.ts` | Computed implicitly in `calculateResidentialWalkins`, `calculateWorkerWalkins`, `calculateTransitWalkins` but not aggregated into a discrete T-08 score field |
| T-09 | Competitive Traffic Share | ✓ EMITTED | `traffic-correlation.service.ts` | `CompetitiveShare.traffic_share_pct` |
| T-10 | Validation Confidence | ✓ EMITTED | `trafficPredictionEngine.ts` | `confidence.score` (scalar) + `confidence.tier` |

### 4.4 The Confidence Representation Finding ★

**Spec requirement (Phase 1c):** `leasingSignals.confidence` should be `{p10, p25, median, p75, p90}` asymmetric percentile object; `yearly[*].confidenceBand` should be a percentile object, not a scalar.

**What actually exists — THREE confidence representations, none matching the spec:**

| Representation | Location in response | Shape | How computed |
|---|---|---|---|
| `confidence` (top-level) | `TrafficPrediction.confidence` | `{ score: number 0–100; tier: 'High'\|'Medium'\|'Low'; breakdown: Record<string,number> }` | Scalar from `calculateConfidence()` |
| `confidence_band` (calibration) | `TrafficPrediction.confidence_band` (top-level convenience) = `calibration_meta.confidence_band` | `{ low: number; mid: number; high: number }` | ±1σ of evidence values around posterior (`stdDev` of `evidenceValues`) |
| `confidence_v2` (v2 funnel) | `TrafficPredictionV2.confidence_v2` | `{ score: number; tier: 'Low'\|'Medium'\|'High'; data_weeks: number; per_metric: Record<string,number> }` | Per-metric confidence decay from `data_weeks` |

**In `LeasingSignals.confidence`** (`trafficToProFormaService.ts` line ~1033):
```typescript
confidence: lr?.confidence_level != null ? Number(lr.confidence_level) : null,
```
This is a **scalar** read from `traffic_learned_rates.confidence_level`.

**Finding classification: TE-01 (AMBIGUOUS)**

- The response object has BOTH a scalar (top-level `confidence.score`) AND a 3-point band (`confidence_band`).
- The `confidence_band` is ±1σ — not an asymmetric percentile distribution.
- No path exists that produces {p10, p25, median, p75, p90}.
- `leasingSignals.confidence` is always scalar.

---

## 5. Extractor Inventory

Two parallel extractor pipelines exist, operating on different source tables.

### 5.1 Pipeline A — rent-roll-derivations.service.ts (M07 Bayesian pipeline)

**Input:** `leasing_events` rows (from `rent_roll_snapshots` → parser pipeline)
**Output:** `DerivedSnapshotMetrics` stored in `rent_roll_snapshots.derived_metrics`
**Invocation:** Called by `m07-calibration.routes.ts` after rent roll upload

| Extractor function | Spec section | T-N signal produced | Output field | Consumption |
|---|---|---|---|---|
| `computeSigningVelocity(rows, snapshotDate)` | §5.3 | Velocity proxy (T-01 upstream input) | `signing_velocity_24m: number[]` (24-bucket histogram) | CalibrationJob evidence → Bayesian update; attached to TrafficPrediction.unit_type_breakdown |
| `computeRenewalRateProxy(rows, snapshotDate)` | §5.8 | Renewal rate signal | `renewal_rate_proxy: number` | CalibrationJob → `app_to_signed` coefficient proxy |
| `computeExpirationWaterfall(rows, snapshotDate)` | §5.11 | Waterfall (T-06 downstream) | `expiration_waterfall: Array<{months_out 1–24, expiring_units, expiring_pct}>` | TrafficPrediction.expiration_waterfall, StartingState.expiration_waterfall |
| `computeUnitTypeBreakdown(rows, snapshotDate)` | §5.9 | Term mix proxy + velocity by type | `unit_type_breakdown: UnitTypeMetrics[]` — per-type: signing_velocity, days_vacant_avg, concession_intensity, renewal_rate | TrafficPrediction.unit_type_breakdown; CalibrationJob evidence aggregation |

### 5.2 Pipeline B — traffic-analytics.service.ts (deal analytics pipeline)

**Input:** `deal_lease_transactions` table
**Output:** `TrafficSnapshot` object (not stored in DB — computed on demand for UI)
**Invocation:** REST endpoint for deal analytics views

| Extractor function | T-N signal produced | Notes |
|---|---|---|
| `computeSigningVelocity(leases)` | Velocity (T-01 input) | Trailing 3/6/12mo windows with survivor-bias decay |
| `computeSeasonalityCurve(leases)` | Seasonality (T-05 related) | 12-bucket monthly normalized factor |
| `computeExpirationWaterfall(leases)` | Waterfall (T-06 related) | Month-bucket expiration with cliff flag |
| `computeLeaseTermDistribution(leases)` | Term mix (T-07 related) | Buckets by term length (MTM, 3/6/12/24 months) |
| `computeTradeOutAnalytics(leases)` | Loss-to-lease (LTL) | New lease vs renewal trade-out analysis |
| `computeMtmExposure(leases)` | MTM risk | Month-to-month unit count + dollar exposure |
| `computeConversionFunnel(funnelRows)` | Conversion funnel | From `box_score` / `conversion_funnel` lease types |

**Note:** This pipeline operates independently from Pipeline A and does NOT feed the Bayesian coefficient hierarchy.

### 5.3 Diff-Extractors (S2 — require 2+ snapshots)

**Service:** `backend/src/services/rent-roll/rent-roll-diff.service.ts`
**Trigger condition:** `S2_MIN_PERIOD_DAYS` separation between snapshots (constant exported from service)
**Output:** `SubjectObservedDynamics` — renewal_rate, turnover_rate, new_lease_trade_out_pct, renewal_trade_out_pct, signing_velocity, days_vacant_median, concession_trend, loss_to_lease, diff_period_count

**Consumption:** `CoefficientResolverService` reads `observed_dynamics` from `subject_traffic_history` to derive S2-tier subject coefficients.

### 5.4 Single-Snapshot S1 Extractor

**Service:** `backend/src/services/rent-roll/subject-history-s1.service.ts`
**Output:** `SubjectCurrentState` — occupancy_rate, unit counts, loss_to_lease, avg_concession_value, avg_market_rent, expiration_waterfall, signing_velocity, lease_term_distribution
**Invocation:** Called after each rent roll upload via `m07-calibration.routes.ts`

---

## 6. Operational Mode Status

Three modes are spec'd: STABILIZED, LEASE_UP, REDEVELOPMENT.

### 6.1 Mode Detection

**Service:** `backend/src/services/starting-state.service.ts`, `resolveStartingState()` (lines 33–90)

**Resolution logic:**
1. Explicit `deal.deal_mode` column always wins (never overridden by inference)
2. `isRedevelopment(deal)` detection — checks `project_type`, `development_type` fields
3. Has rent roll + `occupancy >= 0.80` → STABILIZED
4. Default (no rent roll or occ < 0.80) → LEASE_UP

**Mode source:** `deals.deal_mode` column + rent roll snapshot derived metrics.
**API for override:** `PUT /api/v1/calibration/deal/:dealId/mode`

### 6.2 Mode-Dispatched Prediction Formulas

**Implementation:** `trafficPredictionEngine.ts` lines 1191–1216

| Mode | Formula | Implementation |
|---|---|---|
| STABILIZED | No walk-in adjustment — multi-source signal blend anchors to observed occupancy/ADT | `finalWeeklyWalkins = signalWeeklyWalkins` (no-op) |
| LEASE_UP | Boost front-loaded for low-efficiency early-stage funnel | `leaseUpMultiplier = 1.0 + (1.0 − currentOcc) × 0.5` |
| REDEVELOPMENT | Scale by online units ratio; floor at 0.2 | `onlineRatio = (total_units − offline_units) / total_units; finalWeeklyWalkins × max(0.2, onlineRatio)` |

**Example:** 0% occupancy LEASE_UP property receives 1.5× walk-in boost; 50% offline REDEVELOPMENT receives 0.5× scale.

### 6.3 Mode Propagation

- `starting_state.mode` written to `calibration_meta.mode`
- `prediction.deal_mode` convenience field set
- `m07-projections-adapter.ts` receives `deal_mode` from `ProjectionsDealContext` and resolves per-year mode transitions (LEASE_UP → STABILIZED, REDEVELOPMENT → STABILIZED) with UI transition badge emission

**Classification: ✓ FULLY_IMPLEMENTED** — detection, formula dispatch, per-year transition all implemented.

---

## 7. Consumption Surface

### 7.1 trafficToProFormaService — Method Inventory

**Method 1: `pushTrafficToProForma(propertyId, dealId?)`**
- **Purpose:** M07→M09 integration; generates 3-layer assumptions
- **Data flow:** STORED_READ (reads from `traffic_projections` cache table and `traffic_learned_rates`)
- **Write targets in `proforma_assumptions`** (if dealId present via `persistPlatformLayer`):
  - `vacancy` (id='vacancy'): platform.values = 10yr occupancy trajectory vacancy% from `traffic_projections.occupancy_trajectory`
  - `rentGrowth` (id='rentGrowth'): platform.values = 10yr rent growth% from `traffic_projections.effective_rent_trajectory`
  - `absorption` (id='absorption'): platform.values = 10yr annual leases from `traffic_learned_rates` funnel
  - `opexGrowth` (id='opexGrowth'): platform.values = hard-coded 3.0% — **M07 does not adjust expenses**
  - `exitCap` (id='exitCap'): platform.values = sparse (Y5, Y10 only) based on leasing velocity threshold
- **Layer target:** PLATFORM layer (`a.platform`)
- **Status:** ⚠ STORED_READ — reads cached projection, not live walk-in prediction

**Method 2: `getTrafficProjection(pool, dealId, holdYears)` (modern path)**
- **Purpose:** Returns `TrafficProjection` object for financials-composer
- **Reads from:**
  - `traffic_projections` table (occupancy_trajectory, effective_rent_trajectory, lease_up_weeks_to_90/93/95)
  - `traffic_learned_rates` (tour_rate, app_rate, lease_rate)
  - `traffic_predictions` (weekly_walk_ins for funnel decay)
  - `proforma_assumptions` (vacancy_current, rent_growth_current, exit_cap_current as `calibrated.*`)
  - `deal_market_data`, `apartment_market_snapshots` (peer benchmark)
- **Output fields:**
  - `yearly[yr].vacancyPct` — from occupancy_trajectory (null if no row)
  - `yearly[yr].occupancyPct` — from occupancy_trajectory
  - `yearly[yr].effRent` — from effective_rent_trajectory
  - `yearly[yr].rentGrowthPct` — computed from adjacent effRent values
  - `yearly[yr].t01WeeklyTours` — from traffic_learned_rates + decay factor
  - `yearly[yr].t05ClosingRatio` — from traffic_learned_rates
  - `yearly[yr].t06WeeklyLeases` — derived: t01 × t05
  - `yearly[yr].walkInsPerWeek`, `toursPerWeek`, `appsPerWeek`, `leasesPerWeek` — funnel counts
  - `leaseUp.weeksTo90/93/95` — from traffic_projections
  - `calibrated.vacancyPct`, `calibrated.rentGrowthPct`, `calibrated.exitCap` — from proforma_assumptions (÷100 boundary)
  - `leasingSignals.t01WeeklyTours`, `t05ClosingRatio`, `t06WeeklyLeases`, `t07LeaseUpWeeksTo95`, `stabilizedOccupancyPct`, `confidence` (scalar)
  - `peerBenchmark` — peer distribution {p50 only for vacancy/rent/leaseVelocity; p25/p75 are null}
- **Status:** ⚠ STORED_READ

**Note on `yearly[*].confidenceBand`:** This field does NOT exist in `TrafficProjectionYear`. The type has no percentile band at the yearly level. See TE-01, TE-12.

### 7.2 proforma-adjustment.service.ts

- **`updatePlatformLayerFromTraffic(dealId, values, source)`** (line 717): Writes `vacancy_current`, `rent_growth_current`, `exit_cap_current` to `proforma_assumptions` platform layer. Called when traffic predictions are refreshed.
- **Status: ✓ LIVE_READ** — actively called on prediction refresh

### 7.3 financials-composer.service.ts

- **Reads via** `getTrafficProjection()` (proforma-adjustment.service.ts, line 1730)
- **Consumes:**
  - `trafficProjection.calibrated.vacancyPct` → M07 vacancy equilibrium (M05_EQUILIBRIUM_MIN) for derived vacancy formula (line 2228)
  - `trafficProjection.calibrated.rentGrowthPct`
  - `trafficProjection.leasingSignals.t01WeeklyTours` + `t05ClosingRatio` → primary vacancy derivation path (lines 2233–2237)
  - `trafficProjection.yearly[0].vacancyPct` → fallback vacancy derivation
  - `trafficProjection.yearly[]` → assembled into `DealFinancials.trafficProjection.yearly`
  - `trafficProjection.leaseUp` → `DealFinancials.trafficProjection.leaseUp`
  - `trafficProjection.peerBenchmark`
- **Status: ⚠ STORED_READ** — reads from DB cache, not live prediction

### 7.4 m07-projections-adapter.ts → F9 Projections Tab

- **Reads:** `ProjectionsDealContext.traffic` which includes `starting_state`, `concession_environment`, `subject_history`, `market_rent_growth`, `market_rent_per_unit`
- **Produces:** `OccupancyLeasingBlock[]` (physical_occupancy, loss_to_lease, rent_growth, effective_rent, market_rent per year) and `ConcessionsBlock[]` (free_months, concession_pct, supply_pressure_modifier per year)
- **Source hierarchy per field:**
  - Physical Occupancy Y1 STABILIZED: `subject_history.current_state.occupancy_rate` (S1) → `starting_state.current_occupancy` → mean-reversion model
  - Physical Occupancy Y1 LEASE_UP: `starting_state.absorption_curve[year × 12]`
  - Physical Occupancy REDEVELOPMENT: phase-weighted blended (M22 capex phases; degrades to 0 renovation_pct if M22 missing, flagged as `degraded_reason: 'M22_MISSING_CAPEX_SCHEDULE'`)
  - Loss-to-Lease Y1: `subject_history.current_state.loss_to_lease` (S1) → `observed_dynamics.loss_to_lease` (S2+) → 3% baseline
  - Rent Growth: `traffic.market_rent_growth` (M05 posterior) → `observed_dynamics.new_lease_trade_out_pct` (S2+) → 3% baseline
  - Concessions: `ConcessionEnvironmentOutput.per_year[n]` → mode-based defaults
- **Status: ✓ LIVE_READ** — built fresh from dealContext each call; no DB caching

### 7.5 jedi-score.service.ts

- **Reads M07 via** `dataFlowRouter.getModuleData('M07', dealId)` (line 345)
- **Consumes:** `traffic_trajectory` field only
- **Classification: ⚠ STORED_READ** — data-flow-router caches module data; only trajectory consumed (not walk-ins, confidence, or demand_strength)

### 7.6 m08-strategies.service.ts

- **Spec'd consumption:** `expected_demand_strength` (Causal Discipline §3.3)
- **Actual state:** `trafficQuadrant: 'hidden_gem'` appears in hardcoded mock data at line 925. No live `getModuleData('M07', ...)` or traffic service call found.
- **Status: ✗ SPEC_ONLY** — see TE-06

### 7.7 traffic-module-wiring.ts (orphaned bridge functions)

These functions are exported but no live callers were found importing them:

| Function | Intended consumer | Status |
|---|---|---|
| `calculateTrafficContributionToJEDI(intelligence)` | M25 JEDI Score | ✗ ORPHANED |
| `calculateTrafficStrategyModifiers(intelligence)` | M08 Strategy | ✗ ORPHANED |
| `calculateTrafficProFormaInputs(intelligence, totalUnits)` | M09 ProForma | ✗ ORPHANED |
| `getTrafficIntelligence(propertyId)` | All above | ✗ ORPHANED |

See TE-07. All four functions are fully implemented with complete logic; only call sites are missing.

---

## 8. Calibration Job State

### 8.1 Schedule Configuration

**Finding:** No Inngest function, cron job, or scheduler registration found for `TrafficCalibrationJob`. The Inngest functions directory (`backend/src/inngest/functions/`) contains only `rateSheetStaleness.cron.ts` (Sunday 03:00 UTC). The M07 nightly calibration job has no automatic schedule.

**Only trigger:** `POST /api/v1/calibration/job/run` (admin route, `m07-calibration.routes.ts` line ~330) — manual on-demand invocation only.

**Classification: ✗ NOT_IMPLEMENTED** for scheduled execution — see TE-02, TE-08.

### 8.2 Kafka Publish / Subscription Audit

The job publishes `traffic.calibration.updated` to `KAFKA_TOPICS.TRAFFIC_CALIBRATION` (`trafficCalibrationJob.ts` line 645):

```typescript
await kafkaProducer.publish(KAFKA_TOPICS.TRAFFIC_CALIBRATION, event, {
  key: `calibration-${payload.runAt.toISOString()}`,
  publishedBy: 'traffic-calibration-job',
});
```

The publish is wrapped in try/catch with warn-level logging and does not throw — calibration completes successfully even if Kafka is unavailable.

**Subscriber search:** No consumer of `KAFKA_TOPICS.TRAFFIC_CALIBRATION` or `'traffic.calibration.updated'` found in any file under `backend/src/`. The topic is published but never consumed. See TE-03, TE-09.

### 8.3 Sample-Size Gating

```typescript
const minRequired = bucket.window === 'TTM_24' ? MIN_PROPERTIES_SPARSE : MIN_PROPERTIES_TTM;
if (n_evidence < minRequired) return { updated: 0, created: 0 };
```

- Buckets below threshold are silently skipped — no fallback logging, no downscope promotion within the same run.
- The coefficient-resolver handles downscope at read-time (submarket → msa → class → vintage → platform), so skipped buckets fall through to coarser resolution at query time.

### 8.4 Absorption Benchmark Computation

**Function:** `computeAbsorptionBenchmarks(allSnapshots)` — runs on ALL historical snapshots (not just TTM window), correct by design (absorption benchmarks are point-in-time statistics, not cumulative Bayesian updates).

**Grouping:** `(submarket_id, property_class, size_band)` — size_band: `small` (≤100 units), `medium` (≤300 units), `large` (>300 units)

**Minimum sample:** 3 properties per group; 3 velocity curves of length-24 required.

**Formula:**
1. Collect `derived_metrics.signing_velocity_24m` arrays (24-bucket histograms) from each snapshot
2. Element-wise median curve → monthly absorption rate
3. Cumulative sum → cumulative absorption curve
4. Scan for months_to_80, months_to_90, months_to_stabilization (93%) thresholds
5. `months_to_stabilization_p25 = round(p50 × 0.75)`, `p75 = round(p50 × 1.35)` — **fixed-ratio approximation, not empirical percentile** — see TE-11

**Storage:** Persisted as `coefficient_name='absorption_curve'` with `curve_data` JSONB in `traffic_calibration_factors` table (reusing same table, separate from coefficient rows).

---

## 9. Spec Compliance Gaps

### Gap 1 — Confidence Representation: Asymmetric Percentile Bands Missing

**Spec section:** Phase 1c / output contract
**Spec requirement:** `leasingSignals.confidence` should emit `{p10, p25, median, p75, p90}` asymmetric percentile object; `yearly[*].confidenceBand` should be a percentile object, not a scalar.
**Finding:** PARTIAL
**Evidence:**
- `TrafficPrediction.confidence`: `{ score: number; tier: string; breakdown: Record<string,number> }` — scalar
- `calibration_meta.confidence_band`: `{ low: number; mid: number; high: number }` — 3-point ±1σ computed from `stdDev(evidenceValues)`
- `leasingSignals.confidence`: `Number(lr.confidence_level)` — scalar from `traffic_learned_rates`
- `yearly[*]` fields in `TrafficProjectionYear`: no `confidenceBand` field at all
**Impact:** Consumers cannot assess tail-risk (p10/p90 scenarios). M14 Risk cannot compute asymmetric downside. M09 ProForma cannot show confidence intervals on vacancy/rent projections.
**Effort estimate:** M

---

### Gap 2 — Nightly Calibration Job Has No Automatic Schedule

**Spec section:** Phase 1g / calibration job state
**Spec requirement:** Job runs "nightly" to update platform-layer posteriors from new rent roll evidence.
**Finding:** NOT_IMPLEMENTED (schedule)
**Evidence:** No Inngest cron, no node-cron registration, no scheduler in `backend/src/index.replit.ts` or `start.sh` for `TrafficCalibrationJob`. Only `POST /api/v1/calibration/job/run` exists.
**Impact:** Platform layer never updates automatically. Deals processed today use the same coefficients as day 1. Subject-First calibration also stales because platform peer posteriors never refresh.
**Effort estimate:** S

---

### Gap 3 — Kafka `traffic.calibration.updated` Has No Subscriber

**Spec section:** Phase 1g
**Spec requirement:** Downstream modules should invalidate/refresh when calibration completes.
**Finding:** NOT_IMPLEMENTED
**Evidence:** `kafkaProducer.publish(KAFKA_TOPICS.TRAFFIC_CALIBRATION, ...)`, `trafficCalibrationJob.ts:645`. No consumer found for `KAFKA_TOPICS.TRAFFIC_CALIBRATION` anywhere in `backend/src/`.
**Impact:** Even if the job were scheduled, no downstream cache invalidation fires. Stale coefficients remain in use until manual re-prediction.
**Effort estimate:** M

---

### Gap 4 — T-03 Digital Score Not Native to M07 Core Prediction

**Spec section:** T-01 through T-10 signal inventory
**Spec requirement:** T-03 digital traffic score should be part of the M07 prediction response.
**Finding:** PARTIAL
**Evidence:** `TrafficIntelligence.digital_score` (traffic-module-wiring.ts:43) is a field of the composed intelligence package but comes from `digitalTrafficService.ts` via a separate query. It does NOT appear in `TrafficPrediction` or `TrafficPredictionV2` response shapes. `getTrafficIntelligence()` (traffic-module-wiring.ts) is orphaned.
**Impact:** M07 cannot independently produce a complete T-01–T-10 package without calling digital service separately.
**Effort estimate:** S

---

### Gap 5 — T-08 Generator Proximity Score Not Aggregated as Named Field

**Spec section:** T-08 signal
**Spec requirement:** Generator proximity score should be a discrete, emitted signal.
**Finding:** PARTIAL
**Evidence:** `calculateResidentialWalkins()`, `calculateWorkerWalkins()`, `calculateTransitWalkins()` exist in `trafficPredictionEngine.ts` (lines 1482–1516) but their values feed `physicalTraffic` total, not a named T-08 score field. `TrafficIntelligence.generator_score` (traffic-module-wiring.ts:58) is spec'd but `getTrafficIntelligence()` is orphaned.
**Impact:** Downstream consumers (M25 JEDI) cannot read generator proximity as an independent signal.
**Effort estimate:** S

---

### Gap 6 — M08 Does Not Read M07 expected_demand_strength

**Spec section:** Phase 1f / Causal Discipline §3.3
**Spec requirement:** m08-strategies.service.ts should read M07 `expected_demand_strength` for strategy recommendations.
**Finding:** NOT_IMPLEMENTED
**Evidence:** `m08-strategies.service.ts` line 925 has `trafficQuadrant: 'hidden_gem'` hardcoded in mock data. No import of any M07 service or data-flow-router read. `calculateTrafficStrategyModifiers()` (traffic-module-wiring.ts) is the intended integration point but is orphaned.
**Impact:** M08 strategy arbitrage recommendations don't incorporate real demand signals. Operators receive strategy recommendations that ignore M07 traffic intelligence.
**Effort estimate:** M

---

### Gap 7 — traffic-module-wiring.ts Bridge Functions Are Orphaned

**Spec section:** Phase 1f
**Spec requirement:** M07 outputs should flow into M25 JEDI Score (position/risk adjustments) and M08 Strategy (strategy modifiers) via a defined interface.
**Finding:** PARTIAL
**Evidence:** `calculateTrafficContributionToJEDI()`, `calculateTrafficStrategyModifiers()`, `calculateTrafficProFormaInputs()` fully implemented in `traffic-module-wiring.ts` but no live import found. `jedi-score.service.ts` reads only `traffic_trajectory` via data-flow-router (not these functions).
**Impact:** M25 JEDI position/risk adjustments (±10/±5 points) are not applied. M08 strategy modifiers are not applied. The logic exists but is unwired.
**Effort estimate:** M

---

### Gap 8 — Legacy traffic-calibration.service.ts Is a Parallel Disconnected System

**Spec section:** Phase 1b (calibration state)
**Spec requirement:** Single Bayesian calibration hierarchy (Baseline → Platform → Deal/Subject).
**Finding:** PARTIAL
**Evidence:** `traffic-calibration.service.ts` writes to `traffic_submarket_calibration` table with average-based aggregation (no Bayesian update). Still invoked via `leasing-traffic.routes.ts` and `weekly-report-parser.service.ts`. This table is NOT read by `CoefficientResolverService`. Two calibration systems exist; the legacy one feeds no downstream consumer in the M07 hierarchy.
**Impact:** Calibration data written by the legacy path is dead — it neither contributes to platform posteriors nor influences predictions.
**Effort estimate:** S (deprecation/redirect); M (full removal)

---

### Gap 9 — Absorption Benchmark p25/p75 Are Fixed-Ratio Approximations

**Spec section:** Phase 1g / computeAbsorptionBenchmarks
**Spec requirement:** Absorption benchmarks should reflect actual peer distribution percentiles.
**Finding:** PARTIAL
**Evidence:**
```typescript
months_to_stabilization_p25: Math.max(1, Math.round(monthsToStab * 0.75)),
months_to_stabilization_p75: Math.round(monthsToStab * 1.35),
```
`trafficCalibrationJob.ts` lines 527–528. These are 75%/135% of the median — fixed multipliers, not empirical percentiles from sorting the actual per-property distribution.
**Impact:** StartingState.months_to_stabilization_p25/p75 for LEASE_UP mode are inaccurate when the actual distribution is non-symmetric. M09 Projections tab lease-up timeline confidence ranges are distorted.
**Effort estimate:** S

---

### Gap 10 — No Confidence Band at Per-Year Trajectory Level

**Spec section:** Phase 1c — `yearly[*].confidenceBand`
**Spec requirement:** Per-year trajectory output should carry confidence bands.
**Finding:** NOT_EMITTED
**Evidence:** `TrafficProjectionYear` interface has `vacancyPct`, `occupancyPct`, `effRent`, `rentGrowthPct`, `t01WeeklyTours`, etc. — no `confidenceBand` field. `buildHandoff()` computes `conf = Math.max(40, Math.round(92 - (year-1) * 5.3))` (Y1=92%, Y10≈45%) but this is embedded in `rawTraffic[].confidence` and not surfaced in `yearly[]`.
**Impact:** F9 ProForma tab cannot display year-by-year confidence decay bands. M14 Risk cannot flag high-uncertainty outer years.
**Effort estimate:** M

---

## 10. Finding Inventory (TE-N)

| ID | Classification | Description | Priority | Effort | Downstream Impact |
|---|---|---|---|---|---|
| TE-01 | AMBIGUOUS confidence_band | Three confidence representations exist (scalar, ±1σ 3-point, per-metric v2). None is {p10,p25,median,p75,p90} as spec'd. `leasingSignals.confidence` is always scalar. `yearly[*]` has no confidenceBand at all. | P0 | M | M09 ProForma, M14 Risk, M25 JEDI |
| TE-02 | NO_SCHEDULE | TrafficCalibrationJob has no Inngest cron or automatic trigger — manual admin only. | P0 | S | ALL M07 consumers (stale platform coefficients) |
| TE-03 | NO_SUBSCRIBER | Kafka `traffic.calibration.updated` published but no consumer found. No downstream cache invalidation on calibration completion. | P0 | M | ALL M07 consumers |
| TE-04 | T03_NOT_NATIVE | T-03 digital score not part of core M07 prediction response; comes from a separate service path. | P1 | S | M25 JEDI, M08 |
| TE-05 | T08_NOT_AGGREGATED | T-08 generator proximity score computed internally (residential + worker + transit walk-ins) but not surfaced as a named output field. | P2 | S | M25 JEDI |
| TE-06 | M08_SPEC_ONLY | M08 does not read M07 `expected_demand_strength`. `trafficQuadrant` hardcoded in mock data. | P1 | M | M08 Strategy Arbitrage |
| TE-07 | WIRING_ORPHANED | `traffic-module-wiring.ts` bridge functions (JEDI contribution, strategy modifiers, proforma inputs) fully implemented but not called from any live code path. | P1 | M | M25 JEDI, M08, M09 |
| TE-08 | NO_SCHEDULE | (same root as TE-02 — recorded separately for calibration-job-state section) No nightly schedule exists for calibration to keep platform posteriors fresh. | P0 | S | Platform layer staleness |
| TE-09 | KAFKA_UNSUBSCRIBED | (same root as TE-03 — recorded separately for job-state section) Kafka publish in calibration job has no listener; downstream refresh never fires. | P0 | M | Cache invalidation chain |
| TE-10 | PARALLEL_LEGACY | Legacy `traffic-calibration.service.ts` is a parallel calibration system writing to `traffic_submarket_calibration`, disconnected from `traffic_calibration_factors` Bayesian hierarchy. | P2 | S–M | Operator confusion, dead writes |
| TE-11 | ABSORPTION_P25_P75_APPROX | Absorption benchmark p25/p75 are fixed-ratio approximations (×0.75, ×1.35 of median), not empirical percentiles. | P2 | S | M09 Projections lease-up timeline accuracy |
| TE-12 | NO_YEARLY_CONFIDENCE_BAND | `TrafficProjectionYear` has no `confidenceBand` field; per-year confidence decay is computed but not emitted. | P1 | M | M09 ProForma year display, M14 Risk |
| TE-13 | PEER_BENCHMARK_SPARSE | `peerBenchmark.peerDistribution` has p50 only; p25/p75 are hardcoded `null`. Full peer distribution not computed. | P2 | M | M09 peer comparison panel |
| TE-14 | V1_V2_AMBIGUITY | Two prediction paths (v1 `predict()` and v2 `predictTrafficV2()`) have different output shapes. No canonical path documented; consumers pick arbitrarily. | P1 | S | Consumer consistency, API surface clarity |

---

## 11. Recommended Phase 2 Build Sequence

Fixes ordered by leverage (number of downstream modules unblocked). Fixes that unblock multiple consumers are listed first.

---

### FIX-1 — Schedule TrafficCalibrationJob via Inngest (resolves TE-02, TE-08)

**Why first:** Without a nightly schedule, the entire Bayesian coefficient system is frozen after initial seed. All downstream consumers (M09, M25, M14) operate on stale platform posteriors indefinitely.

**File:** `backend/src/inngest/functions/` — new file, e.g. `trafficCalibrationCron.ts`
**Expected shape:**
```typescript
export const trafficCalibrationCron = inngest.createFunction(
  { id: 'traffic-calibration-nightly', name: 'M07 Nightly Calibration' },
  { cron: '0 2 * * *' },  // 02:00 UTC nightly
  async ({ step }) => {
    const job = new TrafficCalibrationJob(pool);
    return step.run('run-calibration', () => job.run(24));
  },
);
```
**Register in:** existing Inngest function index file
**Unblocks:** M09 ProForma (fresher vacancy/rent assumptions), M25 JEDI (fresher coefficients), M14 Risk

---

### FIX-2 — Add Kafka Subscriber for `traffic.calibration.updated` (resolves TE-03, TE-09)

**Why second:** Once FIX-1 delivers fresh calibration events, FIX-2 makes downstream refresh automatic.

**Files:**
- Kafka consumer registration (existing consumer setup pattern)
- `backend/src/services/coefficient-resolver.service.ts` — add `invalidateCache()` if in-memory caching is present
- `backend/src/services/trafficPredictionEngine.ts` — hook for cache bust on calibration update

**Expected change shape:** Subscribe to `KAFKA_TOPICS.TRAFFIC_CALIBRATION`; on receipt, trigger coefficient cache invalidation in `CoefficientResolverService` and optionally re-queue predictions for active deals.
**Unblocks:** M09 (real-time vacancy refresh), M25 JEDI (live coefficient update), M14 Risk

---

### FIX-3 — Emit Asymmetric Confidence Bands (resolves TE-01, TE-12)

**Why third:** Most structurally important gap per spec Phase 1c. Unblocks M14 Risk tail analysis and M09 year-by-year confidence display.

**Files:**
- `backend/src/jobs/trafficCalibrationJob.ts` lines 398–400: replace ±1σ computation with empirical percentile storage
  - Store per-evidence values in a JSONB array column or compute p25/p75 from sorted `evidenceValues`
  - Update `confidence_band` shape: `{ low: number; p25: number; p50: number; p75: number; high: number }`
- `backend/src/types/traffic-calibration.types.ts` line 61: update `CalibrationMeta.confidence_band` type
- `backend/src/services/trafficToProFormaService.ts` (`getTrafficProjection`): add `confidenceBand: {p10, p25, p50, p75, p90}` to `TrafficProjectionYear`
- `backend/src/services/trafficPredictionEngine.ts`: derive confidence band from coefficient family for scalar → percentile promotion

**Unblocks:** M09 ProForma (year-by-year bands), M14 Risk (tail-risk), M25 JEDI (confidence-weighted signals)

---

### FIX-4 — Wire traffic-module-wiring.ts Bridge Functions (resolves TE-07, TE-04, TE-05, TE-06)

**Why fourth:** Wiring the orphaned functions connects M07 outputs to M25 JEDI and M08 simultaneously with no new logic required — the integration code is complete.

**Files:**
- `backend/src/services/jedi-score.service.ts` line 345: replace raw data-flow-router read with `calculateTrafficContributionToJEDI(intelligence)` call; requires `getTrafficIntelligence(propertyId)` to be un-orphaned.
- `backend/src/services/m08-strategies.service.ts`: add live read via `getTrafficIntelligence(propertyId)`, call `calculateTrafficStrategyModifiers(intelligence)`, remove hardcoded `trafficQuadrant: 'hidden_gem'`.
- `backend/src/services/traffic-module-wiring.ts`: activate `getTrafficIntelligence()` to call both `trafficPredictionEngine` (T-01/T-02/T-06/T-08/T-10) and `digitalTrafficService` (T-03) and `traffic-correlation.service.ts` (T-04/T-07/T-09).

**Unblocks:** M25 JEDI (±10/±5 point position/risk adjustments go live), M08 Strategy (traffic-informed strategy scoring)

---

### FIX-5 — Add T-08 Generator Proximity Score as Named Output Field (resolves TE-05)

**File:** `backend/src/services/trafficPredictionEngine.ts`
**Expected change:** Aggregate `calculateResidentialWalkins()` + `calculateWorkerWalkins()` + `calculateTransitWalkins()` into a normalized 0–100 score. Add `generator_score: number` to `TrafficPrediction` interface. Populate in prediction build step (lines 1237–1283).
**Unblocks:** M25 JEDI (T-08 contribution to position signal via `traffic-module-wiring.ts` after FIX-4)
**Effort:** S

---

### FIX-6 — Resolve V1/V2 Prediction Path Ambiguity (resolves TE-14)

**File:** `backend/src/services/trafficPredictionEngine.ts`
**Expected change:** Document (or enforce) which path is canonical. If V2 is canonical, wire all callers to `predictTrafficV2()` and deprecate V1. If V1 remains canonical, ensure V2 supplemental fields are merged into the V1 response before return. Add a single exported entry point that always returns the enriched object.
**Unblocks:** Consumer consistency, simpler testing, correct API surface
**Effort:** M

---

### FIX-7 — Deprecate Legacy traffic-calibration.service.ts (resolves TE-10)

**Files:**
- `backend/src/services/traffic-calibration.service.ts` — mark deprecated; add redirect comment
- `backend/src/api/rest/leasing-traffic.routes.ts` — redirect calibration call to new M07 hierarchy (`CoefficientResolverService` / `TrafficCalibrationJob`)
- `backend/src/services/weekly-report-parser.service.ts` — remove legacy calibration call
**Expected change:** Keep `traffic_submarket_calibration` table read-only for legacy data; no new writes from application code.
**Unblocks:** Eliminates dual-system confusion; operators see single authoritative calibration source
**Effort:** M

---

### FIX-8 — Compute Empirical Absorption p25/p75 (resolves TE-11)

**File:** `backend/src/jobs/trafficCalibrationJob.ts` lines 527–528
**Expected change:** Sort the per-property `months_to_stabilization` values from the group; take actual 25th and 75th percentile values instead of fixed-ratio approximation:
```typescript
const sortedMonths = groupSnaps
  .map(s => computeMonthsToStab(s))
  .filter(n => n != null)
  .sort((a, b) => a - b);
const p25 = sortedMonths[Math.floor(sortedMonths.length * 0.25)] ?? sortedMonths[0];
const p75 = sortedMonths[Math.floor(sortedMonths.length * 0.75)] ?? sortedMonths[sortedMonths.length - 1];
```
**Unblocks:** M09 Projections lease-up timeline accuracy
**Effort:** S

---

*End of TRAFFIC_ENGINE_STATE_AUDIT.md*
