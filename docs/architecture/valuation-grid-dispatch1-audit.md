---
title: Valuation Grid — Dispatch 1: Comp Data Schema Audit
generated: 2026-05-28
task: "#1370"
---

# Valuation Grid — Dispatch 1: Comp Data Schema Audit

## Purpose

Inventory comp data fields currently available across the JEDI RE data layer.
Classify each valuation method by operational readiness for V0.1 and V1.0.
Map the field-coverage delta required to enable each inactive method.

---

## 1. Table Inventory

### 1.1 `market_sale_comps` (unified sale comp pool)

Source of truth for transaction-based price discovery. Populated from:
- Georgia county ETL (`georgia_property_sales` + `property_info_cache` via `georgia-sale-comps.service.ts`)
- Manual / API ingestion (source tag: `costar`, `attom`, `county_records`, `manual`)

| Column | Type | Populated? | Notes |
|---|---|---|---|
| `id` | UUID | ✅ always | PK |
| `property_name` | TEXT | ⚠️ sparse | Broker data only; county records rarely include |
| `address` | TEXT | ✅ always | Required NOT NULL |
| `city` | TEXT | ✅ always | |
| `state` | TEXT | ✅ always | |
| `zip` | TEXT | ⚠️ sparse | |
| `county` | TEXT | ⚠️ sparse | Present on GA county ETL path |
| `msa` | TEXT | ⚠️ sparse | Not populated by current ETL |
| `submarket` | TEXT | ❌ absent | No current ETL path assigns submarkets |
| `property_type` | TEXT | ✅ default `multifamily` | |
| `units` | INTEGER | ⚠️ partial | Present when joined from `property_info_cache` |
| `sqft` | INTEGER | ⚠️ partial | Present when `building_sf` available in cache |
| `year_built` | INTEGER | ⚠️ partial | From `property_info_cache` |
| `asset_class` | TEXT | ⚠️ sparse | Must be enriched from property class signals |
| `stories` | INTEGER | ❌ sparse | Rarely populated |
| `sale_date` | DATE | ✅ always | Required NOT NULL |
| `sale_price` | NUMERIC | ✅ always | Required NOT NULL |
| `price_per_unit` | NUMERIC | ⚠️ derived | Populated when `units` known; NULL otherwise |
| `price_per_sqft` | NUMERIC | ⚠️ derived | Populated when `sqft` known; NULL otherwise |
| `cap_rate` | NUMERIC | ❌ very sparse | Requires NOI data — almost never available at transaction recording |
| `buyer` | TEXT | ⚠️ partial | From county deed records |
| `buyer_type` | TEXT | ⚠️ sparse | Requires enrichment (REITs, PE, private) |
| `seller` | TEXT | ⚠️ partial | |
| `broker` | TEXT | ❌ absent | Not captured in current ingestion |
| `source` | TEXT | ✅ always | |
| `source_id` | TEXT | ✅ always (when source known) | Unique index on `(source, source_id)` |
| `latitude` | NUMERIC | ⚠️ partial | From property cache; required for spatial queries |
| `longitude` | NUMERIC | ⚠️ partial | Same |
| `qualified` | BOOLEAN | ✅ default true | Arms-length filter; added via `20260424_comp_wiring.sql` |

**Missing fields for V1.0 GRM/GIM methods:**
- `gross_rent_annual` — annual GRI/EGI at time of sale (not captured; broker OM data only)
- `gross_income_multiplier` — derived from `sale_price / gross_rent_annual` (not stored)
- `net_operating_income` — NOI at time of sale (not captured; cap_rate proxy only)

### 1.2 `archive_assumption_benchmarks` (platform deal archive)

Nightly aggregation of underwriting assumptions from closed platform deals.

| `assumption_name` value | Valuation use | Coverage |
|---|---|---|
| `price_per_unit` | Per-Unit Benchmark (Method 2) | ⚠️ sparse — typically n=5–30 per bucket |
| `cap_rate` | Cap Rate × NOI (Method 1) | ⚠️ partial — FL/TX/GA primary markets only |
| `exit_cap_rate` | Disposition cap rate comp | ⚠️ partial |
| `rent_growth_pct` | DCF inputs (V1.0) | ⚠️ partial |
| `vacancy_pct` | NOI inputs (Method 1) | ✅ moderate |
| `noi_margin` | Cap × NOI cross-check | ⚠️ sparse |

Key constraint: rows are bucketed by `(asset_class, deal_type, submarket_id, vintage_band, strategy)`. Submarket granularity is partial — many rows have `submarket_id = NULL` and fall back to city-level.

### 1.3 `sale_comp_sets` / `sale_comp_set_members` (deal-level comp sets)

Generated on-demand by `CompSetService.generateCompSet()`. Persists the comp selection and aggregate statistics per deal.

| Aggregated field | Status | Notes |
|---|---|---|
| `median_price_per_unit` | ✅ operational | Core V0.1 output |
| `avg_price_per_unit` | ✅ operational | |
| `min_price_per_unit` / `max_price_per_unit` | ✅ operational | P0/P100 proxies |
| `std_dev_price_per_unit` | ✅ operational | Used for P25/P75 estimates |
| `median_price_per_sf` | ✅ operational | Core V0.1 output |
| `median_implied_cap_rate` | ⚠️ sparse | Only when `cap_rate` present on comps |
| `avg_implied_cap_rate` | ⚠️ sparse | Same |
| `comp_count` | ✅ operational | Required for confidence scoring |
| `subject_vs_median_pct` | ✅ operational | Subject positioning vs comp pool |
| `subject_percentile` | ✅ operational | |

**PPU P25/P75 estimation:** Not stored as named percentiles — derived from `median ± (std_dev × 0.675)` for normal approximation. Adequate for V0.1; true percentiles require quantile SQL query.

### 1.4 `georgia_property_sales` (raw county deed records)

Source for Georgia ETL. Fields relevant to valuation:

| Column | Notes |
|---|---|
| `consideration` / `sale_price` | Raw deed consideration — promoted as `market_sale_comps.sale_price` |
| `units` | Only present when joined from `property_info_cache` |
| `building_sf` | From cache |
| No NOI, no GRI | County deeds do not carry income data — structural gap |

### 1.5 `inflation` service / Replacement Cost

`ReplacementCostServiceV2` (`backend/src/services/inflation/replacement-cost-v2.service.ts`):
- ✅ BLS PPI escalation (`PCU23622123622101` — multifamily construction)
- ✅ BLS Regional Price Parities (state-level location adjustment)
- ✅ Permit-derived baseline from `building_permits` table
- ✅ Data Library operator upload override
- ✅ Full LayeredValue provenance trail

**Status:** Replacement Cost Tier 1 (operator upload) = operational via Data Library.
Replacement Cost Tier 2 (platform default) = operational via `ReplacementCostServiceV2` — BLS PPI + permit regression is already wired.

---

## 2. Field Coverage Matrix by Valuation Method

| Method | V0.1 Status | Required fields | Coverage | Confidence ceiling |
|---|---|---|---|---|
| **M1 — Cap Rate × NOI** | ✅ OPERATIONAL | NOI (deal assumptions), cap rate (archive benchmarks) | NOI: operational; cap rate: partial | MEDIUM-HIGH (archive sparse for non-primary markets) |
| **M2 — Per-Unit Benchmark** | ✅ OPERATIONAL | `archive_assumption_benchmarks.price_per_unit` P25/P50/P75 | Sparse — n<5 shows LOW confidence | LOW-MEDIUM |
| **M3 — Sales Comp PPU** | ✅ OPERATIONAL | `market_sale_comps.price_per_unit`, spatial query | Available for GA; thin for non-GA markets | MEDIUM (sparse comp pools) |
| **M3b — Sales Comp PSF** | ⚠️ CONDITIONAL | `market_sale_comps.price_per_sqft` | Requires `sqft` on comps — ~60% null | LOW-MEDIUM |
| **M4 — Operator Override** | ✅ ALWAYS AVAILABLE | Manual operator input | N/A | HIGH (operator-asserted) |
| **M5 — Replacement Cost Tier 1** | ✅ OPERATIONAL | Operator upload via Data Library | On-demand | HIGH (when upload present) |
| **M5b — Replacement Cost Tier 2** | ✅ OPERATIONAL | `ReplacementCostServiceV2` (BLS PPI + permits) | GA permit data solid; expanding | MEDIUM (permit sample depends on market) |
| **M6 — GRM** | ❌ V1.0 BLOCKED | `gross_rent_annual` on comps | Not captured — structural gap | — |
| **M7 — GIM** | ❌ V1.0 BLOCKED | `gross_income_annual` on comps | Not captured — structural gap | — |
| **M8 — DCF** | ❌ V1.0 BLOCKED | Full rent/opex growth + terminal cap assumptions | Depends on Phase 2 Batches 3–7 | — |
| **M9 — Replacement Cost (full)** | see M5b | — | — | — |

---

## 3. Gap Analysis: V1.0 Field Coverage Requirements

### GRM / GIM (Methods 6–7)
**Gap:** `market_sale_comps` has no `gross_rent_annual` or `gross_income_annual` field.

**Options to fill (Dispatch 4):**
1. Operator entry at time of comp research — minimal pipeline change, high operator burden
2. OM/T12 document parsing — extract GRI from broker OMs in the Data Library when available
3. CoStar / ATTOM enrichment — commercial data subscription adds GRI to comp records
4. Cap rate × reverse-NOI proxy — if cap rate + NOI margin are known, back-calculate GRI: `GRI = NOI / NOI_margin`; then `GRM = sale_price / GRI`. Introduces two-layer inference risk.

**Recommended path:** Cap rate reverse-proxy (option 4) with explicit confidence flag `GRM_INFERRED_FROM_CAP_RATE` for V1.0; direct GRI field (option 2 or 3) for V2.0.

**Schema change required:**
```sql
ALTER TABLE market_sale_comps ADD COLUMN IF NOT EXISTS gross_rent_annual NUMERIC;
ALTER TABLE market_sale_comps ADD COLUMN IF NOT EXISTS net_operating_income NUMERIC;
```

### Cap Rate Density
**Gap:** `cap_rate` on `market_sale_comps` is near-absent — county deed records do not carry income data.

**Current workaround:** `archive_assumption_benchmarks` cap rate distribution by `(asset_class, deal_type, submarket_id)`.

**Coverage assessment:**
- FL primary markets (Tampa, Orlando, Miami, Jacksonville): n=15–40 per bucket — MEDIUM confidence
- GA (Atlanta): n=5–20 — LOW-MEDIUM
- TX (Dallas): n=5–15 — LOW
- Other markets: n<5 — INSUFFICIENT (shown with LOW badge + sparse warning)

### Submarket Assignment
**Gap:** `submarket` column on `market_sale_comps` is nearly always NULL.

**Impact:** Comp set queries fall back to city-level geography. Reduces comp set selectivity — may include comps from dissimilar submarkets.

**Fix:** Add reverse-geocode submarket assignment to the Georgia ETL promote step using the `submarket_boundaries` geometry table (if populated) or county-level proxy.

---

## 4. Comp Source Priority (when multiple available)

When both `recorded_transactions` (GA deed records) and `market_sale_comps` (market feed) are available for the same property, `CompSetService.getCompSetByDeal()` coalesces via:
```sql
COALESCE(mc.price_per_unit, rt.price_per_unit)
COALESCE(mc.price_per_sqft, rt.price_per_sf)
COALESCE(mc.cap_rate, rt.implied_cap_rate)
```

**Priority order:** `market_sale_comps` wins over `recorded_transactions` when both exist. This is correct because `market_sale_comps` represents enriched/verified data vs raw deed recordings.

---

## 5. Operational Status Classification

### V0.1 — Active Methods (ready now)
1. ✅ Cap Rate × NOI
2. ✅ Per-Unit Benchmark (archive)
3. ✅ Sales Comp PPU
4. ✅ Operator Override
5. ✅ Replacement Cost (both Tier 1 operator upload and Tier 2 platform via `ReplacementCostServiceV2`)

### V0.1 — Conditional / Degraded
- **Sales Comp PSF:** operational when `sqft` available on comps; degrades gracefully when not
- **Implied Cap Rate from comps:** available only when cap_rate present on comps (sparse); falls back to archive benchmarks

### V1.0 — Blocked on upstream work
- **GRM:** needs `gross_rent_annual` on comps (Dispatch 4 / Data integration)
- **GIM:** same as GRM
- **DCF:** needs Phase 2 Batches 3–7 full derivation logic

---

## 6. Confidence Scoring Rules (for engine design, Dispatch 2)

| Input | Confidence Contribution |
|---|---|
| Archive benchmark n ≥ 30 | +2 (HIGH) |
| Archive benchmark n = 10–29 | +1 (MEDIUM) |
| Archive benchmark n < 10 | 0 (LOW) |
| Comp set size ≥ 10 | HIGH |
| Comp set size 5–9 | MEDIUM |
| Comp set size < 5 | LOW |
| Operator upload present | HIGH (for that layer) |
| Market outside FL/TX/GA primary | Tier down one level |
| Subject property at extreme percentile (>P80 or <P20) | add CAUTION flag |

---

## 7. Navigation Placement Decision

**Recommendation:** F9 sub-tab (not standalone F-key) for V0.1.

**Rationale:**
- Valuation Grid is a per-deal analytical surface, not a market-wide module — same scope as RETURNS and SCENARIOS
- Adding a new F-key (F12) is a larger surface change and adds nav complexity
- The Deal Capsule overview panel is too compact for a 5-method grid with P25/P50/P75 ranges and gap analysis
- F9 sub-tab slot: insert after RETURNS (current position 5), before SCENARIOS

**Placement:** Tab index 6 in `BUILTIN_TAB_LABELS`, label `'⊡ VALUATION'`

---

## 8. Key Findings Summary

| Finding | Impact |
|---|---|
| Replacement Cost Tier 2 already wired in `ReplacementCostServiceV2` | Removes Dispatch 5 as a separate work item — wire into engine at Dispatch 2 |
| GRM/GIM blocked on `gross_rent_annual` — not captured in any current table | V1.0 dependency confirmed; placeholder UX required in V0.1 |
| `cap_rate` on comps near-absent — archive benchmarks are the cap rate source | Method 1 confidence bounded by archive depth per market |
| `submarket` null on most comps — city-level comp queries only | Comp set may include dissimilar-submarket transactions; flag in UX |
| `CompSetService` returns P25/P75 as `median ± 0.675 × stddev` (approximation) | Adequate for V0.1; log note in engine design |
| Spatial comp queries require `latitude` / `longitude` — ~partial coverage | Deals without lat/lon fall back to city-level filter |
