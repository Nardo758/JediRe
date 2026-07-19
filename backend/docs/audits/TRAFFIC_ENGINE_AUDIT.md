# TRAFFIC ENGINE AUDIT

**Date:** 2026-07-18
**Executor:** ENGINE-AUTHORITY multi-agent audit (T1–T5)
**Repo:** `Nardo758/JediRe.git`
**Rule:** S1-01 — file:line evidence, verify counts, no fixes

---

## SCOPE VERDICT

**Layer 1 is "build deal-level traffic modeling" — NOT "wire what exists."**

The current traffic engine produces **property_id-level, weekly** predictions. The absorption engine spec requires **address-level, per-month** traffic that can be projected forward, run on land (no property row), and called for arbitrary comp addresses. None of these are true today. The gap is structural, not a wiring omission.

---

## T1 · INPUTS

### DB Tables — Wired (61 total)

| # | Table | Evidence |
|---|-------|----------|
| 1 | `property_visibility` | `trafficPredictionEngine.ts:543` |
| 2 | `property_traffic_context` | `trafficPredictionEngine.ts:582` |
| 3 | `properties` | `trafficPredictionEngine.ts:588` |
| 4 | `adt_counts` | `trafficPredictionEngine.ts:592,834` |
| 5 | `property_website_analytics` | `trafficPredictionEngine.ts:732` |
| 6 | `apartment_market_data` | `trafficPredictionEngine.ts:797` |
| 7 | `deals` | `trafficPredictionEngine.ts:1064` |
| 8 | `traffic_predictions` | `trafficPredictionEngine.ts:975` |
| 9 | `traffic_calibration_legacy_factors` | `trafficPredictionEngine.ts:1907` |
| 10 | `validation_properties` | `trafficPredictionEngine.ts:1962` |
| 11 | `market_events` | `trafficPredictionEngine.ts:2005` |
| 12 | `deal_monthly_actuals` | `trafficPredictionEngine.ts:1930` |
| 13 | `rent_roll_snapshots` | `trafficPredictionEngine.ts:1663` |
| 14 | `traffic_learned_rates` | `trafficLearningService.ts:259` |
| 15 | `traffic_submarket_calibration` | `trafficLearningService.ts:371` |
| 16 | `traffic_validation` | `trafficLearningService.ts:699` |
| 17 | `market_research_cache` | `multifamilyTrafficService.ts:477` |
| 18 | `dot_temporal_profiles` | `dot-temporal-profiles.service.ts:174` |
| 19 | `traffic_weight_config` | `catalog-metrics-wiring.service.ts:108` |
| 20 | `demand_signals` | `catalog-metrics-wiring.service.ts:146` |
| 21 | `supply_signals` | `catalog-metrics-wiring.service.ts:175` |
| 22 | `veraset_subscriptions` | `veraset-mobility.service.ts:64` |
| 23 | `veraset_ingest_jobs` | `veraset-mobility.service.ts:132` |
| 24 | `deal_lease_transactions` | `traffic-analytics.service.ts:153` |
| 25 | `deal_traffic_snapshots` | `traffic-analytics.service.ts:718` |
| 26 | `data_library_assets` | `traffic-analytics.service.ts:825` |
| 27 | `latest_traffic_predictions` | `traffic-correlation.service.ts:61` |
| 28 | `digital_traffic_scores` | `traffic-correlation.service.ts:74` |
| 29 | `traffic_correlation_signals` | `traffic-correlation.service.ts:220` |
| 30 | `traffic_prediction_history` | `traffic-correlation.service.ts:283` |
| 31 | `traffic_competitive_share` | `traffic-correlation.service.ts:470` |
| 32 | `metric_time_series` | `traffic-growth-index.service.ts:75` |
| 33 | `traffic_comp_snapshots` | `comp-traffic.service.ts:166` |
| 34 | `leasing_traffic_predictions` | `comp-traffic.service.ts:252` |
| 35 | `weekly_traffic_snapshots` | `comp-traffic.service.ts:388` |
| 36 | `deal_traffic_comp_selections` | `comp-traffic.service.ts:396` |
| 37 | `property_ga_connections` | `comp-traffic.service.ts:570` |
| 38 | `property_engagement_daily` | `digitalTrafficService.ts:78` |
| 39 | `property_events` | `digitalTrafficService.ts:180` |
| 40 | `geographies` | `dot-aggregator.service.ts:280` |
| 41 | `demand_events` | `demand-signal.service.ts:147` |
| 42 | `demand_event_types` | `demand-signal.service.ts:708` |
| 43 | `demand_projections` | `demand-signal.service.ts:456` |
| 44 | `demand_phasing_templates` | `demand-signal.service.ts:429` |
| 45 | `trade_areas` | `demand-signal.service.ts:545` |
| 46 | `trade_area_event_impacts` | `demand-signal.service.ts:510` |
| 47 | `trade_area_demand_forecast` | `demand-signal.service.ts:564` |
| 48 | `supply_events` | `supply-signal.service.ts:151` |
| 49 | `supply_event_types` | `supply-signal.service.ts:651` |
| 50 | `supply_pipeline` | `supply-signal.service.ts:276` |
| 51 | `supply_risk_scores` | `supply-signal.service.ts:339` |
| 52 | `supply_delivery_timeline` | `supply-signal.service.ts:673` |
| 53 | `competitive_projects` | `supply-signal.service.ts:476` |
| 54 | `backtest_runs` | `event-impact-modifier.service.ts:254` |
| 55 | `event_causality_results` | `event-impact-modifier.service.ts:295` |
| 56 | `learning_adjustments` | `event-impact-modifier.service.ts:331` |
| 57 | `traffic_projections` | `tenYearProjectionService.ts:545` |
| 58 | `traffic_calibration_factors` | `trafficCalibrationJob.ts:386` |
| 59 | `traffic_calibration_history` | `trafficCalibrationJob.ts:441` |
| 60 | `key_events` | `trafficCalibrationJob.ts:644` |
| 61 | `data_library_files` | `traffic-calibration.service.ts:229` |

### External APIs — Wired (4) / Stubbed (1)

| Status | API | Evidence |
|--------|-----|----------|
| Wired | Google Maps Directions API | `traffic-data-sources.service.ts:450` |
| Wired | ArcGIS REST (FL/GA/TX/NC DOT) | `dot-fetcher.service.ts:267` |
| Wired | SpyFu API | `property-analytics.service.ts:603` |
| Wired | M35 Event Pipeline | `m35-traffic-api.service.ts:149` |
| Stubbed | Veraset Mobility API | `veraset-mobility.service.ts:139-170` |

### File/Static Sources — Stubbed (5)

| Source | Evidence |
|--------|----------|
| `BASELINE_DATA` constants (Highlands seasonality) | `multifamilyTrafficService.ts:20` |
| `DEFAULT_SEASONAL_TRAFFIC` (52-week index) | `tenYearProjectionService.ts:129` |
| MSA bounding boxes (hardcoded) | `dot-aggregator.service.ts:17-154` |
| `LeasingTrafficService` placeholder (`Math.random()`) | `leasingTrafficService.ts:64-125` |
| `LeasingTrafficService.forecast` (sine-wave + `Math.random()`) | `leasingTrafficService.ts:130-191` |

**Key observation:** No absent sources. Every referenced data source has either a wired implementation or an explicit stub.

---

## T2 · FORMULA

### Three Distinct Engines

| Engine | File | Core Formula |
|--------|------|-------------|
| **TrafficPredictionEngine v1** | `trafficPredictionEngine.ts:1106` | `baseTraffic = (physicalTraffic × 0.60) + (demandTraffic × 0.40)` |
| **TrafficPredictionEngine v2** | `trafficPredictionEngine.ts:2026-2142` | `tours = adjustedTraffic × tourRate; apps = tours × appRate; netLeases = apps × leaseRate × occModifier` |
| **MultifamilyTrafficService** | `multifamilyTrafficService.ts:153,182-188` | `base_traffic = (units / 290) × 11; predicted = base × demand × pricing × seasonality × occupancy` |
| **LeaseVelocityEngine** | `lease-velocity-engine.ts:108,140,154` | Mode-dispatched: LU (S-curve), ST (steady-state), RC (catch-up) |

### Grain: Property — NOT Address

| Grain | Evidence | Key |
|-------|----------|-----|
| **Property** | `trafficPredictionEngine.ts:141-183` | `property_id` is the structural key; `address` is an unstructured string |
| **Submarket** | `trafficPredictionEngine.ts:148` | `submarket_id` used for calibration, peer percentiles |
| **MSA** | `trafficPredictionEngine.ts:182` | `msa_id` for M35 event pipeline |

### Time Resolution: Weekly (Native)

| Resolution | Evidence | Status |
|------------|----------|--------|
| Hourly | `trafficPredictionEngine.ts:390` | ✅ Available |
| Daily | `trafficPredictionEngine.ts:425` | ✅ Available |
| **Weekly** | `trafficPredictionEngine.ts:218-221` | ✅ **Native** |
| Monthly | `lease-velocity-engine.ts:74` | ❌ Separate service only |
| Quarterly | `tenYearProjectionService.ts:391` | ✅ Available (projection only) |
| Annual | `trafficToProFormaService.ts:30` | ✅ Available (handoff only) |

### Projection: Yes — Ten-Year Decay

`tenYearProjectionService.ts:170-177`:
- Phase 1 (Y1–Y2): Weekly (104 weeks)
- Phase 2 (Y3–Y5): Monthly (36 months)
- Phase 3 (Y6–Y10): Quarterly (20 quarters)

---

## T3 · OUTPUT SHAPE

### Primary Output Interfaces

| Interface | File:Line | Grain | Cadence |
|-----------|-----------|-------|---------|
| `TrafficPrediction` | `trafficPredictionEngine.ts:215` | `property_id` | `prediction_week` + `prediction_year` |
| `TrafficPredictionV2` | `trafficPredictionEngine.ts:107` | `property_id` | Same + 7-metric funnel |

### Address-Level: ❌ NOT SUPPORTED

The finest grain is `property_id` (UUID). The `address` field is a plain string, not a structural key. No address disaggregation, no building-level sub-id, no entrance-level id.

### Per-Month Native: ❌ NOT SUPPORTED

The engine's native cadence is **weekly**. Monthly output exists only in `MultifamilyTrafficService` (`multifamilyTrafficService.ts:86-97`), which is a **separate service** with no shared output contract.

### Land-Case: ❌ BLOCKED

| Evidence | Finding |
|----------|---------|
| `trafficPredictionEngine.ts:~2043` | `loadProperty()` throws if no `properties` row exists |
| `trafficPredictionEngine.ts:290` | `deal_mode` enum: `'STABILIZED' \| 'LEASE_UP' \| 'REDEVELOPMENT'` — no land mode |
| `trafficPredictionEngine.ts:537-918` | `loadDataSourceSignals()` queries property-scoped tables; land has none |

### Comp-Projection: ⚠️ Separate Service, Disconnected

`CompTrafficService` (`comp-traffic.service.ts:85`) exists with comp query + snapshot + pattern extraction. However, there is **no code path** that feeds comp patterns into `TrafficPredictionEngine.predictTraffic()` or `predictTrafficV2()`. The comp traffic service and the traffic prediction engine are **disconnected** at the service layer.

---

## T4 · CONVERSION GAP

### Verdict: Fragmented, Not Unified

The traffic→leases conversion concept **already exists** across 5+ backend services and multiple DB tables. However, there is **NO unified "Absorption Engine"** as a named service or spec implementation.

### Existing Conversion Implementations

| Service | File | What It Computes |
|---------|------|-----------------|
| MultifamilyTrafficService | `multifamilyTrafficService.ts:28-29,190-195` | `visit_to_tour_ratio = 0.50`, `closing_ratio = 0.207`; two-stage funnel |
| TrafficPredictionEngine v2 | `trafficPredictionEngine.ts:107-138` | `in_person_tours`, `applications`, `net_leases`, `closing_ratio` |
| TrafficLearningService | `trafficLearningService.ts:56-76,492-538` | EMA recalibration of `tour_rate`, `app_rate`, `lease_rate` from actuals |
| TrafficToProFormaService | `trafficToProFormaService.ts:30-42,366-375` | M07→M09 bridge: `tours = baseTraffic × tourRate`, etc. |
| LeaseVelocityEngine | `lease-velocity-engine.ts:12,133,148,168` | Forward leasing velocity with funnel conversion |

### DB Tables with Funnel Data

| Table | Evidence |
|-------|----------|
| `deal_traffic_snapshots` | `jedire-patches/migrations/105_deal_traffic_snapshots.sql:12` |
| `leasing_weekly_observations` | `20260710_highlands_ingestion_tables.sql:7-13` |
| `traffic_learned_rates` | `trafficLearningService.ts:259,653` |
| `traffic_predictions` | `trafficLearningService.ts:429-436` |

### What Is Missing

| Expected | Actual |
|----------|--------|
| Unified `AbsorptionEngine` service | **Not found** — no file, class, or route by that name |
| Single source of truth for conversion rates | **Fragmented** — rates live in 5+ services with different defaults |
| `absorption_rates` or `traffic_conversion_engine` table | **Not found** |

---

## T5 · REUSABILITY PER CASE

| Case | Verdict | Rationale |
|------|---------|-----------|
| **Existing / Stabilized** | ✅ **Feeds as-is** | `STABILIZED` mode exists. `StartingStateService.buildStabilizedState()` (`starting-state.service.ts:95-123`) carries all fields needed. `TrafficToProFormaService` (`trafficToProFormaService.ts:446-562`) translates to proforma assumptions today. |
| **Lease-Up** | ⚡ **Feeds with wiring** | `LEASE_UP` mode exists. `LeaseUpState` (`traffic-calibration.types.ts:139-149`) has absorption curves. `TenYearProjectionService` computes lease-up timeline (`tenYearProjectionService.ts:436-453`). Gap: property stub data must be present for pre-delivery assets. |
| **Land / Ground-Up** | 🔧 **Requires real modeling work** | No `LAND` or `GROUND_UP` mode in type system (`traffic-calibration.types.ts:103`). `loadProperty()` throws without property row. No construction timeline, entitlement period, or pre-leasing logic exists. |

---

## RULINGS REQUIRED FOR PHASE 1 DESIGN

### Ruling 1: Grain Resolution
**Question:** Is address-level precision (distinguishing two comps in the same submarket) a P0 requirement, or can Phase 1 ship at property_id-level?

**Consequence:** If address-level is P0, the engine needs a new geocoding/address-resolution layer before any absorption work begins. If property_id-level is acceptable for Phase 1, the comp-projection frontier (Layer 1's fourth lens) is deferred.

### Ruling 2: Time Resolution
**Question:** Does absorption need native monthly output, or can it down-sample from weekly?

**Consequence:** If monthly is required natively, `TrafficPrediction` interface needs a new monthly field or a monthly variant. If weekly→monthly aggregation is acceptable, the existing `TenYearProjectionService` decay model can be adapted.

### Ruling 3: Land Case Scope
**Question:** Is land/ground-up in Phase 1, or deferred to Phase 2?

**Consequence:** If land is Phase 1, the type system needs a new deal mode, a new starting-state branch, synthetic property data loading, and pre-leasing logic. This is the largest scope expansion. If deferred, the engine can focus on existing + lease-up.

### Ruling 4: Conversion Unification
**Question:** Does Phase 1 consolidate the 5+ fragmented conversion services into a single AbsorptionEngine, or wire the existing services together first?

**Consequence:** Consolidation is cleaner but larger. Wiring-first is faster but leaves technical debt. The spec's Layer 2 (conversion ratio) design depends on this ruling.

### Ruling 5: Comp-Projection Bridge
**Question:** Does Phase 1 build the bridge from `CompTrafficService` into `TrafficPredictionEngine`, or leave comp traffic as a separate consumer?

**Consequence:** The bridge is required for the fourth lens (traffic-normalized comps). Without it, comp projection remains a separate surface that does not feed absorption.

---

## AUDIT CHECKLIST

- [x] T1 — Inputs enumerated (61 DB tables, 4 APIs wired, 1 stubbed, 5 static stubs)
- [x] T2 — Formula traced (3 engines, property grain, weekly native, 10-yr projection)
- [x] T3 — Output shape documented (2 interfaces, no address-level, no monthly native, land blocked, comp disconnected)
- [x] T4 — Conversion gap assessed (5+ fragmented services, 0 unified engine)
- [x] T5 — Reusability per case (existing=as-is, lease-up=wiring, land=real work)
- [x] Scope verdict delivered: **build deal-level traffic modeling**
- [x] Rulings required listed (5 rulings)

**STOP. No fixes. This audit sizes the absorption arc.**
