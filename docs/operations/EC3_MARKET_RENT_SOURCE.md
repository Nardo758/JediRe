# EC3 Investigation — Market Rent Source

**Date:** 2026-05-27  
**Status:** INVESTIGATION COMPLETE  
**EC3 verdict:** YELLOW — small implementation needed (benchmark aggregation view from existing tables)  
**Prerequisite to Phase 2 Batch 6 (Revenue derivation)**

---

## 1. Executive Summary

Market rent infrastructure is substantially in place. The investigation found:

| Source | Availability | Granularity |
|---|---|---|
| Subject market rent (per floor plan) | **AVAILABLE** | Per unit type (floor plan), per deal |
| Comp-level market rent (comp sets) | **AVAILABLE** | Per comp set snapshot — asking + effective |
| ApartmentIQ city-level rent | **AVAILABLE** | By city/state × bedroom type (1BR/2BR/3BR) |
| ApartmentIQ class-level rent | **AVAILABLE** | By city/state × asset class (A/B/C) × date |
| Fine-grained cohort distribution (P25/P50/P75 by MSA × vintage × unit_type) | **MISSING** | — |
| RentCast | **REMOVED** | Previously integrated; removed from research agent |

**Path to EC3 SATISFIED:** Build a SQL view (`market_rent_benchmarks_v`) aggregating existing ApartmentIQ tables into P25/P50/P75 distribution by (city, asset_class, unit_type). No new data source ingestion needed. Estimated effort: **1 dispatch** (~1 migration + 1 new agent tool or fetch function extension).

**ApartmentIQ is the recommended primary cohort source** — it's the platform's proprietary moat, already integrated, and covers the key dimensions needed for validation.

---

## 2. Current Source Inventory

### 2.1 Subject Market Rent

**Source:** `fetch_unit_mix` tool → reads `unit_mix` table → per floor plan record  
**Fields:** `in_place_rent` (avg effective rent $/unit/month), `market_rent` (avg market rent $/unit/month)  
**DB columns:**
- `unit_mix.avg_effective_rent` → `in_place_rent`
- `unit_mix.avg_market_rent` → `market_rent` (nullable; falls back to null if not set)

**Override path:** `unit_mix_override:{idx}:market_rent` in `deal_assumptions.year1` JSONB (operator-editable)

**Usage in agent:** `existing.ts` cashflow prompt line 38:
> "Call `fetch_unit_mix` — per-floor-plan unit_count, in_place_rent, and market_rent"

And line 54:
> "`unit_mix[fp].market_rent` — from fetch_unit_mix, cross-checked against comp P50"

**Status:** AVAILABLE. Per floor plan, per deal. Fully wired into the cashflow agent.

**Additional columns (from migration 20260422_revenue_management_enhancements.sql):**
- `deal_monthly_actuals.avg_market_rent NUMERIC` — per-period market rent from actuals
- `proforma_projections.avg_market_rent NUMERIC` — projected market rent per period
- `unit_mix_actuals.avg_market_rent` — monthly actuals per unit type with LTL computation trigger

### 2.2 Comp-Level Market Rent

**Source:** `write_market_comps.ts` agent tool → writes to `market_rent_comps` table  
**Table:** `market_rent_comps` (migration: 20260420_disposition_and_debt_tracking.sql line 547)  
**Fields:** `avg_asking_rent`, `avg_effective_rent`, `rent_by_type` (JSONB — per bedroom type), `source_page`, `file_id`  
**Index:** `(state, msa, snapshot_date DESC)`  
**Written by:** Cashflow agent when processing comp packages from the broker OM  
**Read by:** `fetch_comp_set.ts` — returns `avg_asking_rent`, `avg_effective_rent`, trend series (current, 3mo, 6mo, 12mo) per comp set

**Usage:** Agent cross-checks subject market rent against comp P50 (existing.ts line 54). Also feeds Validation Grid sale comp GPR estimation (VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md Approach A).

**Status:** AVAILABLE. Comp-level rent by comp set snapshot. Populated whenever the agent processes a comp package.

**Coverage gap:** `market_rent_comps` is deal-driven (only populated when a comp package is processed for a specific deal's comp set). It is NOT a platform-wide benchmark table — it represents agent-written intelligence per comp analysis, not a systematic market-wide rent survey.

### 2.3 ApartmentIQ Market Economics

**Source:** `oppgrid.routes.ts` POST `/oppgrid/sync-economics` endpoint — receives data from Leon's ApartmentIQ PC  
**Table:** `oppgrid_market_economics`  
**Fields:** `city, state, avg_rent_1br, avg_rent_2br, avg_rent_3br, median_rent, vacancy_rate, rent_trend, yoy_change, sample_size, updated_at`  
**Unique key:** `(city, state)` with UPSERT  
**Freshness:** Updated manually via sync push from ApartmentIQ system

**Status:** AVAILABLE. City-level market rent by bedroom type. This is the closest thing to a systematic market rent benchmark currently in the platform.

**Limitation:** City-level granularity only (no submarket or vintage stratification). No P25/P50/P75 distribution — only averages.

### 2.4 ApartmentIQ Property-Level Data

**Source:** `apartment_locator_properties` table (populated via apartment-locator.routes.ts sync)  
**Relevant field:** `avg_asking_rent` per property  
**Asset class derivation:** `year_built >= 2010` → Class A, `year_built >= 1995` → Class B, else Class C

**Queryable as rent benchmark:**
```sql
-- Per georgia-ingestion.routes.ts line 518
SELECT
  CASE WHEN year_built >= 2010 THEN 'A'
       WHEN year_built >= 1995 THEN 'B'
       ELSE 'C' END AS asset_class,
  COUNT(*) AS property_count,
  ROUND(AVG(avg_asking_rent), 0) AS avg_rent,
  ROUND(MIN(avg_asking_rent), 0) AS min_rent,
  ROUND(MAX(avg_asking_rent), 0) AS max_rent
FROM apartment_locator_properties
WHERE city ILIKE $1 AND state = $2
  AND avg_asking_rent IS NOT NULL AND avg_asking_rent > 0
GROUP BY asset_class
```

**Status:** AVAILABLE as a queryable distribution source. Property-count dependent — coverage varies by city (Atlanta is well-covered; other markets may be sparse).

### 2.5 ApartmentIQ Class Rent Snapshots

**Source:** `apartment_class_rent_snapshots` table  
**Fields:** `snapshot_date, city, state, asset_class, property_count, avg_rent, min_rent, max_rent`  
**Purpose:** Historical series of class-level rents for trend analysis and YoY comparison  
**Updated by:** Scheduled snapshot process from `apartment_locator_properties`

**Status:** AVAILABLE. Class-level rent with historical series. Supports trend detection and period-over-period comparison.

### 2.6 Rent Scrape Pipeline

**Source:** `rent_scrape_targets` + `rent_scrape_jobs` tables  
**Purpose:** Web-scraped asking rents from competitor/comp properties; feeds `market_rent_comps`  
**Admin routes:** `rent-scraper-admin.routes.ts`  
**Coverage:** Properties explicitly added to `rent_scrape_targets`; not systematic market-wide coverage

**Status:** AVAILABLE as a targeted scraping pipeline. Limited to properties added to the scrape list. Not suitable as a systematic benchmark source.

### 2.7 RentCast

**Status: REMOVED**

`research.agent.ts` line 7: "Previous implementation: directly queried external APIs (ArcGIS, RentCast, ...)". RentCast was removed when the research agent was refactored. No active RentCast API key or integration exists in the current codebase.

---

## 3. Gap Analysis

### What Phase 2 Revenue Derivation Needs

| Need | Source | Status |
|---|---|---|
| Subject market rent per floor plan | `fetch_unit_mix` → `unit_mix.avg_market_rent` | ✓ AVAILABLE |
| Comp market rent for GPR estimation on sale comps | `market_rent_comps` via `fetch_comp_set` | ✓ AVAILABLE (deal-driven) |
| City-level rent context by bedroom type | `oppgrid_market_economics` | ✓ AVAILABLE |
| Cohort benchmark rent by asset class (for validation) | `apartment_class_rent_snapshots` / `apartment_locator_properties` | ✓ AVAILABLE (queryable, not yet a tool) |
| P25/P50/P75 distribution by (MSA × class × vintage × unit_type) | No table | ✗ MISSING |
| Rent growth rate for projections | `oppgrid_market_economics.yoy_change` | ✓ AVAILABLE (city-level; vintage stratification missing) |

### The Actual Gap

The Validation Grid investigation (VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md, Open Q1) identified: "Market rent by comp profile — requires market rent estimates for each comp by MSA × asset_class × vintage."

The current gap is specifically: **there is no pre-computed benchmark table that exposes rent distribution bands (P25/P50/P75) by (city/MSA, asset_class, unit_type/bedroom_type)** analogous to how `line_item_benchmarks` exposes OpEx distributions.

However, all the underlying data to build such a table EXISTS in `apartment_locator_properties` + `apartment_class_rent_snapshots` + `oppgrid_market_economics`. The gap is an **aggregation layer**, not a missing data source.

### What Is NOT a Gap

- Subject market rent: fully wired
- Comp-level rent for deal analysis: available via comp sets
- City-level market context: available via ApartmentIQ economics sync
- Rent trend direction: available via `yoy_change` + `apartment_class_rent_snapshots` history

---

## 4. RentCast vs ApartmentIQ Assessment

### RentCast

| Dimension | Assessment |
|---|---|
| Current integration | NONE (removed) |
| Data coverage | National; zip-code level rental estimates |
| Granularity | Property-level asking/effective rent, bedroom type distribution |
| API cost | Per-call billing; national coverage = high cost for platform-wide benchmarks |
| Freshness | Near-real-time (proprietary scraping) |
| Reintegration effort | ORANGE — new API key, cost management, freshness scheduling, storage schema |

**Recommendation: DO NOT reintegrate.** The data ApartmentIQ provides is equivalent for the platform's needs and is already wired in. Reintegrating RentCast adds API cost and operational complexity for no clear incremental benefit over ApartmentIQ.

### ApartmentIQ

| Dimension | Assessment |
|---|---|
| Current integration | LIVE — sync endpoint + two storage tables + historical snapshots |
| Data coverage | Property-level in ApartmentIQ's dataset (Atlanta well-covered; other markets vary) |
| Granularity | Property-level asking rent → aggregated to city × class level |
| API cost | Zero marginal cost — Leon's PC pushes data; no per-call billing |
| Freshness | Sync-driven; updated when Leon runs the sync push |
| Missing | No P25/P75 distribution; no vintage × unit_type stratification |

**Recommendation: ApartmentIQ is the right primary cohort source.** It is the platform's proprietary moat (Leon's data advantage), already integrated at zero marginal cost, and covers the key dimensions needed for cohort validation.

---

## 5. Recommendation + Effort Estimate

### Recommended Path to EC3 SATISFIED

**Step 1 — Create `market_rent_benchmarks_v` database view**

```sql
-- Aggregates apartment_locator_properties into a distribution table
-- analogous to line_item_benchmarks for OpEx
CREATE OR REPLACE VIEW market_rent_benchmarks_v AS
SELECT
  city,
  state,
  CASE WHEN year_built >= 2010 THEN 'A'
       WHEN year_built >= 1995 THEN 'B'
       ELSE 'C' END AS asset_class,
  bedroom_type,  -- from unit_mix decomposition if available, else null
  COUNT(*) AS sample_size,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_asking_rent) AS p25_rent,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_asking_rent) AS p50_rent,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_asking_rent) AS p75_rent,
  AVG(avg_asking_rent) AS avg_rent,
  MAX(snapshot_date) AS as_of
FROM apartment_locator_properties
WHERE avg_asking_rent IS NOT NULL AND avg_asking_rent > 0
GROUP BY city, state, asset_class, bedroom_type
HAVING COUNT(*) >= 3;  -- minimum sample for statistical validity
```

**Step 2 — Add `fetch_market_rent_benchmark` agent tool** (or extend `fetch_comp_set`)

Tool takes `(city, state, asset_class, bedroom_type?)` and returns:
```json
{
  "p25": 1150,
  "p50": 1380,
  "p75": 1620,
  "sample_size": 47,
  "as_of": "2026-05-01"
}
```

**Step 3 — Wire into cashflow agent validation**

The existing.ts prompt's "cross-check against comp P50" step (line 54) would use this tool to validate the unit_mix market_rent against the cohort distribution. Fire a V-flag if subject > P75 or < P25.

### Effort Classification: YELLOW

| Classification | Definition | This case |
|---|---|---|
| GREEN | Documentation only; all sources and patterns already wired | No — tool doesn't exist yet |
| **YELLOW** | Small implementation (view + tool + prompt wiring) | **Yes — ~1 dispatch** |
| ORANGE | Substantial implementation (new data source ingestion) | No |

**Estimated scope:** 1 dispatch (~1 migration for the view + 1 new tool or extension + 1 prompt addition). No new external data source. No new API key.

### Note on Vintage Stratification

The view above uses `year_built` proxy for asset class (A/B/C). True vintage stratification (e.g., 1980–1989, 1990–1999, 2000–2009, 2010+) is not supported by the current ApartmentIQ data shape. Phase 2 can proceed with class-level (A/B/C) granularity; vintage stratification is a Phase 3 refinement.

---

## 6. Open Questions

**OQ-1 — ApartmentIQ bedroom_type decomposition:** `apartment_locator_properties.avg_asking_rent` is a single property-level average (not per bedroom type). The `oppgrid_market_economics` table has `avg_rent_1br/2br/3br` but only at city level (not property level). For unit_type-level validation, the property-level data needs a bedroom_type column or the city-level 1BR/2BR/3BR data must be used. Decision: which to use for the benchmark view?

**OQ-2 — Market coverage outside Atlanta:** ApartmentIQ data is known to be well-populated for Atlanta. Coverage for Charlotte, Nashville, Tampa, etc. is unknown. The benchmark view includes a `HAVING COUNT(*) >= 3` gate, but for thin markets, the P50 may be unreliable. Flag for operator when `sample_size < 10`.

**OQ-3 — Update frequency for `market_rent_benchmarks_v`:** The view reads live from `apartment_locator_properties`. If the underlying table is not refreshed frequently, benchmarks will be stale. Consider a materialized view with scheduled refresh or use `apartment_class_rent_snapshots` (which already has snapshot history) as the base.

**OQ-4 — Interaction with Validation Grid (Open Q1):** The Validation Grid needs GPR estimates for sale comps that don't have market rent data. The `market_rent_benchmarks_v` view resolves Validation Grid Open Q1 (Approach A). This is a shared deliverable — the same dispatch that satisfies EC3 also closes Validation Grid Open Q1. Flag this dependency.

**OQ-5 — RentCast reintegration decision:** The investigation recommends NOT reintegrating RentCast. If Leon disagrees and wants national coverage, this becomes an ORANGE effort (new API key + cost management + storage). Do not proceed without explicit operator decision.

---

## 7. EC3 Status Update

**EC3 final status: YELLOW — one dispatch to SATISFIED**

The data infrastructure exists. ApartmentIQ is the right cohort source. The missing piece is a benchmark aggregation view and a new agent tool. This is a bounded, well-defined implementation with no new data source dependencies.

**Blocks Phase 2 Batch 6 (Revenue):** Yes. Revenue derivation (GPR, vacancy, concessions) requires cohort market rent benchmarks for validation. EC3 must be SATISFIED before Batch 6 dispatches.

**Does NOT block Batch 1–5:** OpEx, capital structure, growth assumptions, and exit cap derivation do not depend on market rent benchmarks. Batch 1–5 can proceed while EC3 is being implemented.
