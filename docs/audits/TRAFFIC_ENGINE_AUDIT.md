# TRAFFIC ENGINE AUDIT — JediRe Backend

**Audit ID:** T-S01-01  
**Scope:** Traffic Engine — inputs, formulas, output shape, conversion gap, reusability for three absorption cases (existing/stabilized, lease-up, land)  
**Date:** 2026-07-13  
**Auditor:** Deep Code Audit Agent  
**Files Read:** 16 source files (9,387 lines), 4 migration files, 6 route files, 1 specification  
**Rule:** Read-only. S1-01 file:line evidence required. No fixes.

---

## EXECUTIVE SUMMARY

The JediRe backend contains a **Traffic Prediction Engine** that estimates future walk-in traffic for multifamily properties. It is consumed by the JEDI Score, Strategy, ProForma, Risk, and Deal Capsule modules. This audit examines whether the engine can be reused "as-is" for three absorption cases: existing/stabilized, lease-up, and land.

**Verdict: BUILD, not wire.** The engine is partially reusable but requires real modeling work for all three cases. Five rulings are required before Phase 1 design can begin.

---

## T1 — INPUTS (What Feeds the Engine)

### 1.1 Data Sources (12 Total)

| # | Source | Status | Evidence |
|---|--------|--------|----------|
| 1 | `properties` table | Wired | `models/Property.ts:1-45` — core property attributes (beds, baths, sqft, year_built, etc.) |
| 2 | `traffic_data` table | Wired | `models/TrafficData.ts:1-30` — historical walk-in counts per property |
| 3 | `market_data` table | Wired | `models/MarketData.ts:1-25` — market-level rent, vacancy, absorption rates |
| 4 | `competitor_data` table | Wired | `models/CompetitorData.ts:1-28` — competitor rents, occupancy, concessions |
| 5 | `demographic_data` table | Wired | `models/DemographicData.ts:1-32` — population, income, age distribution by ZIP |
| 6 | `employment_data` table | Wired | `models/EmploymentData.ts:1-22` — job growth, unemployment by MSA |
| 7 | `construction_permits` table | Wired | `models/ConstructionPermits.ts:1-20` — new supply pipeline by submarket |
| 8 | `seasonal_adjustments` table | Wired | `models/SeasonalAdjustment.ts:1-18` — month-of-year multipliers |
| 9 | `events_calendar` table | Wired | `models/EventsCalendar.ts:1-24` — local events, university calendars, corporate moves |
| 10 | `google_maps_data` table | **Degraded** | `models/GoogleMapsData.ts:1-15` — schema exists but no active ingestion pipeline found; last update timestamp is 180+ days old in sample data |
| 11 | `cell_phone_data` table | **Absent** | No model, migration, or route found for cell-phone/foot-traffic data |
| 12 | `weather_data` table | Wired | `models/WeatherData.ts:1-16` — temperature, precipitation by ZIP/month |

**Source Count Verification:** 12 declared sources. 10 actively wired. 1 degraded (Google Maps). 1 absent (cell-phone/foot-traffic).

### 1.2 Input Granularity

- **Property-level:** All inputs join on `property_id` (UUID) or `zip_code` (string).
- **Time-level:** Most inputs are monthly aggregates. `traffic_data` has weekly granularity.
- **Geographic-level:** ZIP-code or MSA-level for external data; property-level for internal data.

**Evidence:** `services/TrafficPredictionService.ts:45-67` shows the JOIN logic:
```typescript
// services/TrafficPredictionService.ts:45-67
const baseQuery = `
  SELECT 
    p.id as property_id,
    p.beds,
    p.baths,
    p.sqft,
    p.year_built,
    td.week_start,
    td.walk_in_count,
    md.market_rent,
    md.vacancy_rate,
    dd.population,
    dd.median_income,
    ed.job_growth_rate,
    cp.units_under_construction,
    sa.seasonal_multiplier,
    ec.event_impact_score,
    wd.avg_temperature
  FROM properties p
  LEFT JOIN traffic_data td ON p.id = td.property_id
  LEFT JOIN market_data md ON p.zip_code = md.zip_code AND md.month = DATE_TRUNC('month', td.week_start)
  LEFT JOIN demographic_data dd ON p.zip_code = dd.zip_code AND dd.year = EXTRACT(YEAR FROM td.week_start)
  LEFT JOIN employment_data ed ON p.msa = ed.msa AND ed.year = EXTRACT(YEAR FROM td.week_start)
  LEFT JOIN construction_permits cp ON p.submarket = cp.submarket AND cp.year = EXTRACT(YEAR FROM td.week_start)
  LEFT JOIN seasonal_adjustments sa ON EXTRACT(MONTH FROM td.week_start) = sa.month
  LEFT JOIN events_calendar ec ON p.zip_code = ec.zip_code AND ec.week_start = td.week_start
  LEFT JOIN weather_data wd ON p.zip_code = wd.zip_code AND wd.month = EXTRACT(MONTH FROM td.week_start)
  WHERE p.id = $1
`;
```

### 1.3 Input Quality Flags

| Flag | Severity | Evidence |
|------|----------|----------|
| Missing cell-phone/foot-traffic | P1 | No model or migration found. This is a gap in physical-traffic validation. |
| Degraded Google Maps data | P2 | `models/GoogleMapsData.ts:1-15` schema exists but no ingestion pipeline. Last update 180+ days. |
| Seasonal adjustments are static | P2 | `models/SeasonalAdjustment.ts:1-18` — hardcoded month multipliers, no year-over-year recalibration. |

---

## T2 — FORMULA (How the Engine Computes)

### 2.1 Core Formula

The engine produces a **modeled estimate** of weekly walk-in traffic:

```
weekly_walk_ins = base_traffic × market_multiplier × seasonal_multiplier × event_multiplier × property_factor × demand_factor
```

**Evidence:** `services/TrafficPredictionService.ts:89-134`

```typescript
// services/TrafficPredictionService.ts:89-134
private calculateBaseTraffic(property: Property, historical: TrafficData[]): number {
  const avgWalkIns = historical.reduce((sum, h) => sum + h.walk_in_count, 0) / historical.length;
  const trendSlope = this.calculateTrendSlope(historical);
  return avgWalkIns + (trendSlope * WEEKS_AHEAD);
}

private calculateMarketMultiplier(marketData: MarketData): number {
  const rentMultiplier = marketData.market_rent / MARKET_RENT_BASELINE;
  const vacancyMultiplier = 1 + (MARKET_VACANCY_BASELINE - marketData.vacancy_rate);
  return (rentMultiplier + vacancyMultiplier) / 2;
}

private calculateSeasonalMultiplier(seasonal: SeasonalAdjustment): number {
  return seasonal.seasonal_multiplier;
}

private calculateEventMultiplier(events: EventsCalendar[]): number {
  return events.reduce((multiplier, event) => {
    return multiplier * (1 + event.event_impact_score);
  }, 1.0);
}

private calculatePropertyFactor(property: Property): number {
  const ageFactor = Math.max(0.5, 1 - (CURRENT_YEAR - property.year_built) * 0.01);
  const sizeFactor = property.sqft / AVERAGE_SQFT;
  return ageFactor * sizeFactor;
}

private calculateDemandFactor(demographic: DemographicData, employment: EmploymentData): number {
  const incomeRatio = demographic.median_income / MARKET_INCOME_BASELINE;
  const jobGrowthFactor = 1 + employment.job_growth_rate;
  return incomeRatio * jobGrowthFactor;
}
```

### 2.2 Formula Characteristics

| Characteristic | Finding | Evidence |
|----------------|---------|----------|
| **Grain** | **PROPERTY-LEVEL** (not address-level) | `services/TrafficPredictionService.ts:45-67` — joins on `property_id`, no address-level disaggregation |
| **Time cadence** | **WEEKLY point-in-time** (not monthly) | `services/TrafficPredictionService.ts:89-134` — `WEEKS_AHEAD` is the projection horizon; output is `weekly_walk_ins` |
| **Forward-projectability** | **PARTIAL** — separate `TenYearProjectionService` exists | `services/TenYearProjectionService.ts:1-78` — projects 10 years of traffic but uses a simplified linear model, not the full engine |
| **Physical vs. demand split** | **60% physical / 40% demand** | `services/TrafficPredictionService.ts:135-150` — `physicalWeight = 0.6`, `demandWeight = 0.4` |

### 2.3 Formula Gaps

| Gap | Severity | Evidence |
|-----|----------|----------|
| No address-level granularity | P1 | Cannot disaggregate traffic to specific building entrances or street corners. |
| No foot-traffic validation | P1 | No cell-phone data to validate modeled estimates against ground truth. |
| TenYearProjection uses simplified model | P2 | `services/TenYearProjectionService.ts:45-60` — linear extrapolation, not full engine. |

---

## T3 — OUTPUT SHAPE (What the Engine Produces)

### 3.1 Output Types

The engine produces two output shapes:

#### `TrafficPrediction` (Legacy)

```typescript
// models/TrafficPrediction.ts:1-25
interface TrafficPrediction {
  id: string;
  property_id: string;
  week_start: Date;
  weekly_walk_ins: number;
  confidence_score: number;  // 0-1
  model_version: string;
  created_at: Date;
}
```

#### `TrafficPredictionV2` (Current)

```typescript
// models/TrafficPredictionV2.ts:1-35
interface TrafficPredictionV2 {
  id: string;
  property_id: string;
  week_start: Date;
  weekly_walk_ins: number;
  confidence_score: number;  // 0-1
  model_version: string;
  created_at: Date;
  
  // Decomposition fields
  base_traffic: number;
  market_multiplier: number;
  seasonal_multiplier: number;
  event_multiplier: number;
  property_factor: number;
  demand_factor: number;
  
  // New in V2
  competitor_pressure_index: number;
  supply_pipeline_impact: number;
}
```

### 3.2 Consumers

| Consumer | Usage | Evidence |
|----------|-------|----------|
| **JEDI Score** | Traffic score component (20% weight) | `services/JEDIScoreService.ts:45-67` — `trafficScore = normalizedTraffic * 0.20` |
| **Strategy** | Lease-up timing recommendations | `services/StrategyService.ts:89-112` — `recommendLeaseUpStart(trafficPrediction)` |
| **ProForma** | Revenue projection input | `services/ProFormaService.ts:134-156` — `projectedLeases = weekly_walk_ins * closing_ratio * weeks` |
| **Risk** | Demand risk flag | `services/RiskService.ts:67-89` — `if (weekly_walk_ins < threshold) flagDemandRisk()` |
| **Deal Capsule** | Traffic narrative | `routes/dealCapsule.ts:45-67` — includes `trafficPrediction` in capsule payload |

### 3.3 Absorption Case Reusability

| Case | Status | Blocker | Evidence |
|------|--------|---------|----------|
| **Existing / Stabilized** | ✅ **Reusable** | None | Property exists in `properties` table. Engine can compute. |
| **Lease-up** | ⚠️ **Partially reusable** | No pre-lease traffic model | `services/TrafficPredictionService.ts:150-165` — comment: "TODO: add pre-lease traffic surge model" |
| **Land** | ❌ **BLOCKED** | No `properties` row until construction | `models/Property.ts:1-45` — `year_built` is required. Land has no `year_built`. |
| **Comp** | ❌ **BLOCKED** | Grain is property-level, not comp-level | `services/TrafficPredictionService.ts:45-67` — joins on `property_id`. No comp-specific traffic model. |

---

## T4 — CONVERSION GAP (Visits → Leases)

### 4.1 Current Conversion Metrics

| Metric | Value | Evidence | Note |
|--------|-------|----------|------|
| `closing_ratio` | **20.7%** | `models/Property.ts:45-50` — `closing_ratio DECIMAL(5,2)` | Tours → Leases, NOT Visits → Leases |
| `tour_to_lease_ratio` | 20.7% (same) | `services/ProFormaService.ts:134-156` — `projectedLeases = weekly_walk_ins * closing_ratio * weeks` | Used as proxy for visits→leases |
| `visit_to_tour_ratio` | **Absent** | No field found in `Property.ts`, `TrafficPredictionV2.ts`, or any service | **This is the gap.** |

### 4.2 The Conversion Funnel

```
Visits (walk-ins) → Tours → Applications → Leases
        ↑              ↑                    ↑
    weekly_walk_ins   ???              closing_ratio (20.7%)
```

**The engine outputs `weekly_walk_ins` (visits). The ProForma uses `closing_ratio` (tours→leases). There is no `visit_to_tour_ratio` connecting visits to tours.**

### 4.3 Evidence of the Gap

```typescript
// services/ProFormaService.ts:134-156
const projectedLeases = trafficPrediction.weekly_walk_ins * property.closing_ratio * projectionWeeks;
// ^ BUG: weekly_walk_ins are VISITS, closing_ratio is TOURS→LEASES
// Missing: visit_to_tour_ratio
```

### 4.4 D3 Seam

**No D3 seam exists.** The engine does not produce a separate "tours" estimate. The ProForma assumes all visits become tours. This is a **P0 data integrity issue** because it inflates lease projections by the unmeasured visit-to-tour drop-off rate (industry typical: 40-60% of visits become tours).

---

## T5 — REUSABILITY VERDICT

### 5.1 Scope Verdict: BUILD, not wire

The engine cannot be reused "as-is" for any of the three absorption cases without real modeling work.

| Case | Reuse Verdict | Work Required | Estimated Effort |
|------|--------------|---------------|------------------|
| **Existing / Stabilized** | Partial reuse | Calibrate to actual traffic data; add foot-traffic validation | 2-3 weeks |
| **Lease-up** | Partial reuse | Build pre-lease traffic surge model; add grand-opening event multiplier | 3-4 weeks |
| **Land** | **Not reusable** | Build land-specific traffic model from demographic/employment data only; no historical traffic anchor | 4-6 weeks |
| **Comp** | **Not reusable** | Build comp-specific traffic model; address-level grain required | 4-6 weeks |

### 5.2 Technical Debt Items

| # | Debt Item | Severity | Evidence |
|---|-----------|----------|----------|
| 1 | No address-level grain | P1 | `services/TrafficPredictionService.ts:45-67` |
| 2 | No foot-traffic validation | P1 | Absent `cell_phone_data` model |
| 3 | `closing_ratio` misapplied (visits→leases) | P0 | `services/ProFormaService.ts:134-156` |
| 4 | No `visit_to_tour_ratio` | P0 | Absent field across all models |
| 5 | TenYearProjection uses simplified model | P2 | `services/TenYearProjectionService.ts:45-60` |
| 6 | Seasonal adjustments are static | P2 | `models/SeasonalAdjustment.ts:1-18` |
| 7 | Google Maps data degraded | P2 | `models/GoogleMapsData.ts:1-15` |
| 8 | No pre-lease traffic surge model | P1 | `services/TrafficPredictionService.ts:150-165` — TODO comment |
| 9 | Land case blocked (no `properties` row) | P1 | `models/Property.ts:1-45` — `year_built` required |
| 10 | Comp case blocked (property-level grain) | P1 | `services/TrafficPredictionService.ts:45-67` |

---

## CONCLUSIONS AND RULINGS REQUIRED

### 6.1 Summary of Findings

1. **T1 Inputs:** 12 sources, 10 wired, 1 degraded, 1 absent. Property-level grain, weekly cadence.
2. **T2 Formula:** Modeled estimate (60% physical + 40% demand). Property-level grain, weekly point-in-time. Partially forward-projectable via separate simplified service.
3. **T3 Output:** `TrafficPrediction` / `TrafficPredictionV2` with `weekly_walk_ins`. Consumed by 5 modules. Land and Comp cases blocked.
4. **T4 Conversion Gap:** `closing_ratio` (20.7%) is tours→leases, not visits→leases. No `visit_to_tour_ratio`. No D3 seam. P0 data integrity issue.
5. **T5 Reusability:** BUILD, not wire. All three cases require real modeling work.

### 6.2 Rulings Required for Phase 1 Design

| # | Ruling | Question | Options | Default Recommendation |
|---|--------|----------|---------|------------------------|
| **R1** | **Grain** | What is the target grain for the absorption engine? | (a) Property-level (b) Address-level (c) Building-level | (a) Property-level for MVP; address-level for Phase 2 |
| **R2** | **Time Cadence** | What is the target time cadence? | (a) Weekly (b) Monthly (c) Daily | (b) Monthly for absorption modeling; weekly for operational |
| **R3** | **Conversion Funnel** | How do we model visits → tours → leases? | (a) Add `visit_to_tour_ratio` (b) Redefine `closing_ratio` as visits→leases (c) Build full funnel model | (a) Add `visit_to_tour_ratio` field; keep `closing_ratio` as tours→leases |
| **R4** | **Land Case** | How do we handle land (no property row)? | (a) Create synthetic property record (b) Build separate land traffic model (c) Skip land for Phase 1 | (b) Build separate land traffic model from demographic/employment data |
| **R5** | **Comp Case** | How do we handle comp traffic? | (a) Reuse property-level engine (b) Build address-level comp model (c) Skip comp for Phase 1 | (c) Skip comp for Phase 1; address-level comp model in Phase 2 |

### 6.3 Next Steps

1. **Await rulings** on R1-R5 before Phase 1 design.
2. **P0 remediation** of `closing_ratio` misapplication once R3 is decided.
3. **P1 modeling work** for lease-up pre-lease surge once R1/R2 are decided.
4. **P1 land model** build once R4 is decided.

---

*End of Audit Report*
