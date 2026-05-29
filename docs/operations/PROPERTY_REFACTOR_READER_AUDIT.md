# PROPERTY REFACTOR — READER AUDIT

**Phase:** 3 — Reader Migration  
**Status:** IN PROGRESS — Wave 1 started  
**Produced:** 2026-05-29  
**Last updated:** 2026-05-29

---

## Purpose

Every reader of the old property tables is catalogued here before any migration
begins. For each reader: which old tables it touches, which new tables/services
it should use after migration, the feature flag name, and current migration status.

Flag default: **OFF** (new code path inactive). Shadow comparison must log
cleanly for ≥ 1 week before flag is promoted to 10% canary, then 100%.
Old code path is NOT removed until the reader has been at 100% for ≥ 30 days.

---

## Old table inventory (targets for deprecation in Phase 4)

| Table | Row count (approx) | Phase 4 fate |
|---|---|---|
| `properties` (time-varying cols only) | 1,596 | Time-varying cols dropped; identity cols kept |
| `property_records` | 249K | Dropped |
| `property_info_cache` | 290K | **Kept** — canonical assessor layer |
| `market_sale_comps` | 343K | Dropped |
| `market_rent_comps` | — | Dropped |
| `comp_properties` | — | Dropped |
| `recorded_transactions` | 12 | Dropped |
| `deal_properties` | 27 | Dropped |

---

## Notation

| Column | Values |
|---|---|
| Status | `NOT STARTED` / `IN PROGRESS` / `SHADOW` / `CANARY` / `COMPLETE` |
| Flag default | Always OFF when created |
| Wave | 1-5 as defined in the implementation map |

---

## WAVE 1 — Foundation Readers

These readers resolve the deal→property relationship and feed the Cashflow Agent.
They are the highest-priority Wave 1 targets because every downstream reader
depends on property identity being correct.

---

### R-001 — DealService deal→property resolution

**Status:** IN PROGRESS (Wave 1)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_DEAL_RESOLVE`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — `SELECT property_id FROM deal_properties WHERE deal_id = $1`
- `properties` — JOIN to get address/city/state/lat/lng for deal context

**Files:** `backend/src/deals/deals.service.ts`  
**Old paths:**
- `deals.service.ts:200` — `LEFT JOIN deal_properties dp ON d.id = dp.deal_id`
- `deals.service.ts:451` — `LEFT JOIN deal_properties dp ON dp.deal_id = d.id AND dp.property_id = p.id`
- `deals.service.ts:361` — `FROM deal_properties dp LEFT JOIN properties p`

**New path:** `DealPropertyLinkService.resolveDealProperty(dealId)` — reads
`deals.property_id` first (new FK), falls back to `deal_properties` only if null.
After Phase 2 backfill completes (all 32 deals have `deals.property_id` populated),
the fallback leg will never trigger.

**New tables:** `deals.property_id` → `properties` (identity cols only)

**Verification (Layer 1):** Same `propertyId` returned for 50 sample deals  
**Verification (Layer 2):** `DealPropertyLinkService.getUnlinkedDeals()` returns 0

**Shadow comparison:** Log `{dealId, oldPropertyId, newPropertyId, match}` per
resolution. Divergences → `property_reader_shadow_log` with `reader_id = 'deal_resolve'`.

---

### R-002 — Cashflow Agent property context

**Status:** IN PROGRESS (Wave 1)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_CASHFLOW_AGENT`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — resolve property from deal_id
- `properties` — `property_type`, lat, lng, city, state

**Files:**
- `backend/src/agents/cashflow.inngest.ts` — lines 225, 770 (LEFT JOIN deal_properties + properties)
- `backend/src/agents/cashflow.config.ts` — line 444 (LEFT JOIN properties p ON p.deal_id = d.id)

**New path:**
1. `DealPropertyLinkService.resolveDealProperty(dealId)` → property_id
2. `PropertyCharacteristicsService.getCurrent(propertyId)` → unit_count, building_class, condition
3. Property identity (address/city/state/lat/lng) from `properties` identity cols (not being deprecated)

**New tables:** `deals.property_id`, `property_characteristics`

**Verification:** Same deal produces equivalent property context (unit count, class, location) on 50 sample deals  
**Shadow comparison:** Log `{dealId, field, oldValue, newValue}` per field divergence

---

### R-003 — Document extraction data-router deal→property

**Status:** NOT STARTED (Wave 1 extension)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_DATA_ROUTER`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1` (line 40, 1629)

**Files:** `backend/src/services/document-extraction/data-router.ts`

**New path:** `DealPropertyLinkService.resolveDealProperty(dealId)` — use `.propertyId`

**Note:** This is a read-through for property_id; low migration risk. Migration
deferred until after R-001 shadow period confirms consistent property_id resolution.

---

### R-004 — Leasing/traffic routes deal→property

**Status:** NOT STARTED (Wave 1 extension)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_LEASING_TRAFFIC`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1` (lines 603, 709)
- `properties` — city, state_code, lat, lng lookups (lines 63, 164, 334, 566, 609, 715, 875, 1029)

**Files:** `backend/src/api/rest/leasing-traffic.routes.ts`

**New path:**
- Property_id: `DealPropertyLinkService.resolveDealProperty(dealId).propertyId`
- Location: `properties` identity cols (not deprecated — lat/lng/city/state stay)

---

### R-005 — Operations routes deal→property

**Status:** NOT STARTED (Wave 1 extension)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_OPERATIONS`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — `SELECT property_id FROM deal_properties WHERE deal_id = $1 ORDER BY created_at LIMIT 1` (line 788)

**Files:** `backend/src/api/rest/operations.routes.ts`

**New path:** `DealPropertyLinkService.resolveDealProperty(dealId).propertyId`

---

### R-006 — Agent inngest runners deal→property

**Status:** NOT STARTED (Wave 1 extension)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_AGENT_RUNNERS`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — LEFT JOIN in cashflow.inngest, zoning.inngest, research.inngest, supply.inngest, commentary.inngest

**Files:**
- `backend/src/agents/cashflow.inngest.ts`
- `backend/src/agents/zoning.inngest.ts`
- `backend/src/agents/research.inngest.ts`
- `backend/src/agents/supply.inngest.ts`
- `backend/src/agents/commentary.inngest.ts`

**New path:** `DealPropertyLinkService.resolveDealProperty(dealId).propertyId` to get property_id,
then JOIN `properties` identity cols (not deprecated). These are query enrichment joins,
not property-data reads, so the migration is low-risk.

---

### R-007 — Inline-deals listing deal→property

**Status:** NOT STARTED (Wave 1 extension)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_INLINE_DEALS`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — property count subquery (lines 158, 215, 230)
- `properties` — linked property row (line 1199)

**Files:** `backend/src/api/rest/inline-deals.routes.ts`

**New path:** `deals.property_id IS NOT NULL` replaces count subquery from `deal_properties`

---

## WAVE 2 — Valuation Readers

These readers drive the Valuation Grid and comp services. Wave 2's comp-side
migration is the largest behavioral change: comps shift from `market_sale_comps`
scoped to a deal to `property_sales` drawn from the full inventory.
**Do not begin Wave 2 until Wave 1 shadow comparison is clean for ≥ 7 days.**

---

### R-008 — Valuation Grid subject side

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_VALUATION_SUBJECT`  
**Flag default:** OFF

**Old tables read:**
- `properties` — building_class, unit_count, year_built, lat, lng for subject property

**Files:** `backend/src/services/valuation/valuation-grid.service.ts`

**New path:** `PropertyCharacteristicsService.getCurrent(propertyId)` for time-varying fields;
`properties` identity cols for lat/lng/address (identity cols are not being deprecated)

**Shadow comparison:** Log divergences in unit_count, building_class, year_built per deal

---

### R-009 — Valuation Grid comp side (largest behavioral change)

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_VALUATION_COMPS`  
**Flag default:** OFF

**Old tables read:**
- `market_sale_comps` — comp set generation (lines 673, 1112, 1912, 2069, 2105)

**Files:** `backend/src/services/valuation/valuation-grid.service.ts`

**New path:** `PropertySalesService.getSalesByCriteria()` — draws from `property_sales`
inventory (not scoped to a deal). **Comp counts will increase** for markets with rich
`property_sales` data. This is expected and desirable behavior.

**Backtest required:** After enabling this flag, run backtest against S1 deals
(Jacksonville + Atlanta ×2). Valuation accuracy must not regress.

**Shadow comparison:** Log `{dealId, oldCompCount, newCompCount, oldP50, newP50}` per
valuation grid request. Divergence > 20% in P50 cap rate → flag as material.

**Canary deferral status (updated 2026-05-29):**

Phase 5 shadow backtest (S1 Layer 1) confirmed 110bps divergence between Atlanta MF
deals is a **geography gap** (Cobb NW suburban vs. DeKalb/south Atlanta), not a
methodology defect. Canary promotion was deferred pending county expansion.

**Prior exit condition (superseded):** "Wait for DeKalb + Fulton ingest to complete."

**Updated exit condition:** Canary can proceed when:
1. Gwinnett re-ingest complete (endpoint live; run underway as of 2026-05-29)
2. Shadow backtest re-run against the Gwinnett-expanded comp pool — divergence
   expected to narrow when Gwinnett MF comps (geographically closer to Atlanta deals)
   join the Cobb pool
3. Time-series check (`synthesize-implied-cap-rates.ts --time-series`) confirms
   date preservation intact across the combined Gwinnett + Cobb corpus

**DeKalb / Fulton coverage gap — known, tracked (2026-05-29):**

Investigation confirmed no public ArcGIS sale endpoint exists for either county:
- DeKalb: `dcgis.dekalbcountyga.gov` — all layers probed, no sale fields
- Fulton: `gismaps.fultoncountyga.gov/arcgispub` — all folders probed, no sale data;
  former ArcGIS Online org (`jXZcOJp6qFkhsZyH`) is dead (HTTP 400)

`georgia_property_sales` has 0 rows for both counties. `promoteGeorgiaSales` produces
0 comps. This is a **data availability gap, not a code defect.**

Operator impact: Deals in DeKalb/Fulton submarkets currently rely on operator-uploaded
CoStar comps (existing path, unaffected). This continues until the comp acquisition
strategy decision (Option A/B/C/D) is made and implemented. Do not block canary on
DeKalb/Fulton coverage.

Future sources (not yet pursued — pending strategy decision):
- Option B: Georgia PT-61 / GSCCCA state-level transfer tax (one integration, all GA counties)
- Option C: Commercial aggregator (ATTOM, Reonomy, RCA)
- Option A: Per-county discovery continues (ArcGIS Hub, Tyler MUNIS per county)

**Gwinnett unit count gap — confirmed 2026-05-29 (separate from sales gap):**

Gwinnett DOES have sale prices (3,004 transactions ≥$5M; 9,154 ≥$1M; 25,265 rows in
`property_sales` source=county_recorded). However, `property_info_cache.number_of_units`
= 0 for 23,534 of ~24K Gwinnett parcels. Root cause: LAND_VALUE field `NUMDWLG`
("Number of Dwellings") = 0 for all commercial/MF parcels in Gwinnett's assessor data —
the field tracks residential dwelling units, not apartment unit counts.

Result: `price_per_unit = NULL` for all 25,265 rows → zero qualified MF comps from
Gwinnett despite 3,004 large transactions being present in the system.

STEP 4 `enrichCapitalMarkets` cannot help because it operates on `market_sale_comps`
(0 Gwinnett rows) rather than `property_sales`.

Fix path for Gwinnett specifically:
- Gwinnett Improvements table (Table 8, USECODE='APART') — has FINSIZE/YRBUILT/STORIES
  but no explicit unit count field. May need to join to a separate residential inventory.
- Or: apply enrichCapitalMarkets logic to `property_sales` source=county_recorded for
  Gwinnett's $5M+ transactions (back-solve units from sale_price ÷ typical PPU range).
- Or: same A/B/C/D strategy options above (PT-61, ATTOM, etc.) — Gwinnett would be
  covered by Option B (PT-61) or Option C.

**Summary of Georgia county data coverage (as of 2026-05-29):**

| County | Sale prices | Unit counts | Qualified MF comps |
|---|---|---|---|
| Cobb | ✅ via georgia_property_sales | ✅ via property_info_cache | ✅ 6,012 |
| Gwinnett | ✅ 25,265 in property_sales | ❌ NUMDWLG=0 for 97% | ❌ 0 |
| DeKalb | ❌ no ArcGIS sale endpoint | N/A | ❌ 0 |
| Fulton | ❌ no ArcGIS sale endpoint | N/A | ❌ 0 |

Canary promotion (Phase 5) is feasible on Cobb-only corpus. The 110bps divergence
noted in shadow backtest reflects Cobb geographic premium (NW suburban vs. south
Atlanta deals). Whether to treat this as acceptable divergence or a blocker is the
remaining canary promotion decision.

---

### R-010 — CompSet service (compSet.service.ts)

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_COMP_SET`  
**Flag default:** OFF

**Old tables read:**
- `market_sale_comps` — primary comp source (line 233)
- `recorded_transactions` — transaction join (lines 521, 631)
- `properties` — building_class + address (lines 112, 117)

**Files:** `backend/src/services/saleComps/compSet.service.ts`

**New path:**
- Comps: `PropertySalesService.getSalesByCriteria()`
- Property details: `PropertyCharacteristicsService.getCurrent()`
- Transactions: embedded in `property_sales` (no separate join needed)

---

### R-011 — Comp-query service + CompQueryEngine

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_COMP_QUERY`  
**Flag default:** OFF

**Old tables read:**
- `properties` — id, property_type, year_built, lat, lng (comp-query.service.ts line 199)
- `properties` — id + JOIN comp set (compQueryEngine.ts lines 190, 206)

**Files:**
- `backend/src/services/comp-query.service.ts`
- `backend/src/services/compQueryEngine.ts`

**New path:** `PropertyCharacteristicsService.getCurrent(propertyId)` + identity cols from `properties`

---

### R-012 — Comp-set-discovery service

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_COMP_SET_DISCOVERY`  
**Flag default:** OFF

**Old tables read:**
- `comp_properties` — comp search (line 417)

**Files:** `backend/src/services/comp-set-discovery.service.ts`

**New path:** `property_characteristics` + `properties` identity — `comp_properties` is replaced
by the canonical property entity schema

---

### R-013 — Georgia sale comps service

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_GEORGIA_SALE_COMPS`  
**Flag default:** OFF

**Old tables read:**
- `market_sale_comps` — comp queries (lines 177, 323, 368, 436)
- `property_info_cache` — enrichment join (line 125)

**Files:** `backend/src/services/saleComps/georgia-sale-comps.service.ts`

**New path:** `PropertySalesService.getSalesByCriteria()` with county/city/state filters

---

### R-014 — Correlation engine sale comps

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_CORRELATION_COMPS`  
**Flag default:** OFF

**Old tables read:**
- `market_sale_comps` — correlation analysis (lines 2449, 2458, 2505, 2513)

**Files:** `backend/src/services/correlationEngine.service.ts`

**New path:** `PropertySalesService.getSalesByCriteria()`

---

### R-015 — Comp-dedup + comp-cascade services

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_COMP_DEDUP`  
**Flag default:** OFF

**Old tables read:**
- `market_sale_comps` — comp records (comp-dedup.service.ts lines 179, 205, 228, 302)
- `market_sale_comps` — cascade operations (comp-cascade.service.ts line 174)

**Files:**
- `backend/src/services/valuation/comp-dedup.service.ts`
- `backend/src/services/valuation/comp-cascade.service.ts`

**New path:** `PropertySalesService` methods

---

### R-016 — Backtest snapshot capture

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_BACKTEST_SNAPSHOT`  
**Flag default:** OFF

**Old tables read:**
- `market_sale_comps` — snapshot capture (lines 261, 278)

**Files:** `backend/src/services/backtest/snapshot-capture.service.ts`

**New path:** `PropertySalesService.getSalesByCriteria()` with matching criteria

---

### R-017 — Georgia ingestion capital tab (read-side)

**Status:** NOT STARTED (Wave 2)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_GEORGIA_CAPITAL_TAB`  
**Flag default:** OFF

**Old tables read:**
- `market_sale_comps` — transaction summary, buyer activity (lines 1185-1246, 1412-1434)

**Files:** `backend/src/api/rest/georgia-ingestion.routes.ts`

**New path:** `PropertySalesService.getSalesByCriteria()` with county/date filters

---

## WAVE 3 — Analytical Readers

These readers power F3 Markets, F4 Supply, F6 Traffic, and F8 Debt.
Lower coupling to property data; lower risk. Begin after Wave 2 is stable.

---

### R-018 — F3 Markets / property grid (property_records)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_PROPERTY_GRID`  
**Flag default:** OFF

**Old tables read:**
- `property_records` — full grid display, filtering, sorting (grid.routes.ts lines 77-419)
- `property_records` — market intelligence queries (market-intelligence.routes.ts lines 626-1074)
- `property_records` — enhanced market intel (market-intelligence-enhanced.routes.ts lines 39-290)

**Files:**
- `backend/src/api/rest/grid.routes.ts`
- `backend/src/api/rest/market-intelligence.routes.ts`
- `backend/src/api/rest/market-intelligence-enhanced.routes.ts`

**New path:** `property_characteristics` (time-varying) + `properties` identity cols

**Note:** `property_records` has 249K rows. The characteristics backfill (Phase 2,
Backfill 2) must be verified complete before this reader is migrated.

---

### R-019 — Competition module (property_records)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_COMPETITION`  
**Flag default:** OFF

**Old tables read:**
- `property_records` — competition analysis, spatial queries (competition.routes.ts lines 127-985)
- `comp_properties` — comp matching (competition.routes.ts line 918)

**Files:** `backend/src/api/rest/competition.routes.ts`

**New path:** `property_characteristics` + `properties` identity; `comp_properties` replaced by `property_characteristics`

---

### R-020 — Property rankings (property_records)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_RANKINGS`  
**Flag default:** OFF

**Old tables read:**
- `property_records` — ranking queries (rankings.routes.ts lines 131, 210, 288, 482)
- `deal_properties` — deal-linked rankings (rankings.routes.ts line 324)

**Files:** `backend/src/api/rest/rankings.routes.ts`

**New path:** `property_characteristics` for time-varying metrics, `properties` identity for location

---

### R-021 — PropertyMetrics service (property_records)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_PROPERTY_METRICS`  
**Flag default:** OFF

**Old tables read:**
- `property_records` — parcel metrics, neighborhood metrics (propertyMetrics.service.ts lines 107-362)

**Files:** `backend/src/services/propertyMetrics.service.ts`

**New path:** `property_characteristics` + `properties` identity

---

### R-022 — PropertyScoring service (property_records)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_PROPERTY_SCORING`  
**Flag default:** OFF

**Old tables read:**
- `property_records` — owner concentration, neighborhood scoring (propertyScoring.service.ts lines 100-737)

**Files:** `backend/src/services/propertyScoring.service.ts`

**New path:** `property_characteristics` + `properties` identity; owner data from `properties.owner_name`

---

### R-023 — Spatial analysis (property_records)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_SPATIAL`  
**Flag default:** OFF

**Old tables read:**
- `property_records` — proximity + cluster analysis (spatialAnalysis.ts lines 50-295)

**Files:** `backend/src/services/spatialAnalysis.ts`

**New path:** `properties` identity (lat/lng stay on `properties`; not deprecated)

---

### R-024 — Neighboring property engine (property_records)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_NEIGHBORING`  
**Flag default:** OFF

**Old tables read:**
- `property_records` — neighboring search, owner joins (neighboringPropertyEngine.ts lines 213-498)

**Files:** `backend/src/services/neighboringPropertyEngine.ts`

**New path:** `property_characteristics` + `properties` identity + PostGIS spatial on `properties.lat/lng`

---

### R-025 — F4 Supply module (market_rent_comps)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_SUPPLY`  
**Flag default:** OFF

**Old tables read:**
- `market_rent_comps` — supply analysis (supply.routes.ts line 851)

**Files:** `backend/src/api/rest/supply.routes.ts`

**New path:** `property_operating_data` — rent comps migrate to operating data records

---

### R-026 — F6 Traffic module subject location

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_TRAFFIC`  
**Flag default:** OFF

**Old tables read:**
- `properties` — lat/lng for traffic lookups (traffic-data-sources.service.ts lines 296, 495, 586)
- `properties` — city/state for traffic correlation (traffic-correlation.service.ts lines 125, 210, 431)
- `properties` — location for traffic learning (trafficLearningService.ts line 361)

**Files:**
- `backend/src/services/traffic-data-sources.service.ts`
- `backend/src/services/traffic-correlation.service.ts`
- `backend/src/services/trafficLearningService.ts`

**New path:** `properties` identity cols (lat/lng/city/state are NOT being deprecated — they stay on `properties`).
This migration is about routing through `DealPropertyLinkService` to resolve property_id cleanly,
not about changing which columns are read.

---

### R-027 — Neural network data matrix (property_info_cache)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_NEURAL_MATRIX`  
**Flag default:** OFF

**Old tables read:**
- `property_info_cache` — ML feature matrix (data-matrix.service.ts lines 489, 528, 601)

**Files:** `backend/src/services/neural-network/data-matrix.service.ts`

**New path:** `property_characteristics` (time-varying features) + `properties` identity

---

### R-028 — Inflation engine (property_info_cache)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_INFLATION`  
**Flag default:** OFF

**Old tables read:**
- `property_info_cache` — AV/JV for inflation analysis (inflation-engine.service.ts line 620)

**Files:** `backend/src/services/inflation/inflation-engine.service.ts`

**New path:** `property_characteristics` — assessed_value / just_value fields

---

### R-029 — Deal-market-intelligence routes (property_records, comp_properties)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_DEAL_MARKET_INTEL`  
**Flag default:** OFF

**Old tables read:**
- `property_records` — deal-level market intel (deal-market-intelligence.routes.ts line 131)
- `comp_properties` — comp join (deal-market-intelligence.routes.ts line 158)

**Files:** `backend/src/api/rest/deal-market-intelligence.routes.ts`

**New path:** `property_characteristics` + `property_sales`

---

### R-030 — JEDI score service (deal_properties)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_JEDI_SCORE`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — multiple JOIN paths for JEDI scoring (jedi-score.service.ts lines 279, 289, 376, 435, 509, 735, 797)

**Files:** `backend/src/services/jedi-score.service.ts`

**New path:** `deals.property_id` direct FK replaces `deal_properties` joins once Wave 1 backfill is confirmed

---

### R-031 — Unit mix intelligence (comp_properties)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_UNIT_MIX`  
**Flag default:** OFF

**Old tables read:**
- `comp_properties` — unit mix data (unitMixIntelligence.service.ts lines 43, 81, 89)

**Files:** `backend/src/services/unitMixIntelligence.service.ts`

**New path:** `property_characteristics.unit_mix` JSONB field

---

### R-032 — Tax comp analysis (recorded_transactions)

**Status:** NOT STARTED (Wave 3)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_TAX_COMPS`  
**Flag default:** OFF

**Old tables read:**
- `recorded_transactions` — tax comp join (taxCompAnalysis.service.ts line 133)
- `properties` — address match (taxCompAnalysis.service.ts lines 76, 134)

**Files:** `backend/src/services/tax/taxCompAnalysis.service.ts`

**New path:** `property_sales` (replaces `recorded_transactions`) + `properties` identity

---

## WAVE 4 — Strategy-aware Readers

Depends on Wave 2 being fully stable. Strategy-aware comp selection reads M15
output which depends on `PropertySalesService.getSalesByCriteria()`.

---

### R-033 — Strategy-aware comp selection

**Status:** NOT STARTED (Wave 4 — after Wave 2 stable)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_STRATEGY_COMPS`  
**Flag default:** OFF

**Old tables read:**
- `market_sale_comps` — strategy-filtered comp selection

**Files:** TBD — to be identified after Wave 2 reader inventory is confirmed

**New path:** `PropertySalesService.getSalesByCriteria()` with strategy filters

**Canary gate clarification (2026-05-29):**

The Phase 5 `valuation_comps` reader (R-032 / `USE_NEW_PROPERTY_SCHEMA_VALUATION_COMPS`) and R-033 are **separate gates** that must not be conflated:

| Gate | What it tests | Comp selection | Expected comp count |
|---|---|---|---|
| Phase 5 canary (`=canary`) | Data pipeline correctness: does `property_sales.implied_cap_rate` exist and spatial query return a number? | Broad market distribution — 25-mile radius, no class/strategy filter | ~200–500 |
| R-033 canary | Strategy-aware quality: do the right 5–8 comps drive the cap rate? | Filtered by strategy matrix (stabilized/core_plus/value_add/opportunistic/development) via `getSalesByCriteria` | 5–8 |

Promoting `USE_NEW_PROPERTY_SCHEMA_VALUATION_COMPS` to canary validates that the Phase 5 **data pipeline** works end-to-end. It does **not** validate that the algorithm narrows to the correct comp cohort — that is R-033's gate.

Reviewers encountering the Phase 5 canary cap rates (broad distribution P50) should expect them to differ from the final R-033 output (narrow strategy-aware P50). The divergence between Phase 5 canary and legacy path reflects both data geography and selection methodology differences. Do not treat Phase 5 canary divergence as a signal that the final methodology is better or worse than legacy until R-033 narrows the selection appropriately.

---

### R-034 — Strategy projection service

**Status:** NOT STARTED (Wave 4 — after Wave 2 stable)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_STRATEGY_PROJECTION`  
**Flag default:** OFF

**Old tables read:** TBD — depends on Wave 2 final state

**New path:** TBD

---

## WAVE 5 — Post-close and Capsule

---

### R-035 — M22 post-close intelligence

**Status:** NOT STARTED (Wave 5)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_M22_POST_CLOSE`  
**Flag default:** OFF

**Old tables read:**
- `deal_properties` — owned asset actuals (fetch_owned_asset_actuals.ts lines 206, 231, 233)
- `properties` — owned asset context (fetch_owned_asset_actuals.ts line 223)

**Files:**
- `backend/src/agents/tools/fetch_owned_asset_actuals.ts`
- `backend/src/services/portfolio/lifecycle-transition.service.ts`

**New path:**
- Property resolution: `DealPropertyLinkService.resolveDealProperty(dealId)`
- Owned data: `PropertyOperatingDataService` with `is_owned = TRUE`

---

### R-036 — Deal Capsule rendering

**Status:** NOT STARTED (Wave 5)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_DEAL_CAPSULE`  
**Flag default:** OFF

**Old tables read:**
- Multiple old tables for capsule assembly

**Files:** TBD — Deal Capsule rendering code

**New path:** Assemble from `property_characteristics` + `property_sales` + `property_operating_data`

---

### R-037 — Freeze-on-share snapshot

**Status:** NOT STARTED (Wave 5)  
**Flag:** `USE_NEW_PROPERTY_SCHEMA_FREEZE_SNAPSHOT`  
**Flag default:** OFF

**Old tables read:** TBD — snapshot capture code

**New path:** Capture `property_characteristics` + `property_sales` snapshot at share time

---

## MISC / ADMIN READERS (low priority, migrate after Wave 3)

| Reader | File | Old table | Notes |
|---|---|---|---|
| Admin data coverage | `admin-data-coverage.routes.ts` | `property_records` | Admin-only; low risk |
| Admin property list | `admin.routes.ts` | `properties`, `property_records` | Admin dashboards |
| Market metrics aggregator | `market-metrics-aggregator.service.ts` | `property_records` | Batch aggregation |
| Atlanta URL discovery | `atlanta-url-discovery.service.ts` | `properties`, `property_records` | Research tool |
| Data library files | `data-library-files.routes.ts` | `properties` | File → parcel join |
| Agent runs listing | `agent-runs.routes.ts` | `deal_properties` | Agent run listing |
| Risk scoring | `risk.routes.ts`, `risk-scoring.service.ts` | `properties` | Risk assessment |
| GraphQL property resolvers | `property.resolvers.ts` | `properties` | General property API |
| Property REST CRUD | `property.routes.ts` | `properties` | CRUD endpoints |
| Proforma generator | `proforma-generator.service.ts` | `properties` | Proforma context |
| Clawdbot webhooks | `clawdbot-webhooks.routes.ts` | `properties`, `deal_properties` | CRM webhooks |
| Demand routes | `demand.routes.ts` | `properties` | Demand analysis |
| Forward supply | `forward-supply.routes.ts` | `properties` | Forward supply |
| Zoning service | `zoning.service.ts` | `properties` | Zoning lookup |
| Benchmark enrichment | `benchmark-enrichment.service.ts` | `properties` | Benchmarking |
| Deal alert service | `deal-alert.service.ts` | `properties`, `deal_properties` | Alert generation |
| Scenario generation | `scenario-generation.service.ts` | `properties`, `deal_properties` | Scenario modeling |
| Skills index | `skills/skills/index.ts` | `properties` | Agent skill context |
| Agent orchestrator | `agents/agent-orchestrator.ts` | `properties` | Orchestration |
| Discovery engine | `discovery/discovery-engine.ts` | `properties` | Deal discovery |

---

## Shadow comparison log schema

Divergences between old and new code paths are written to
`property_reader_shadow_log` (created by Phase 3 migration).

| Column | Purpose |
|---|---|
| `reader_id` | Which reader (e.g. `'deal_resolve'`, `'cashflow_agent'`) |
| `entity_id` | Deal ID or property ID being resolved |
| `field` | Which field diverged (e.g. `'propertyId'`, `'unitCount'`) |
| `old_value` | Value from old code path |
| `new_value` | Value from new code path |
| `match` | Whether values matched |
| `created_at` | Timestamp |

Shadow log must show **zero divergences** over 7 consecutive days before
any reader flag is promoted from shadow to 10% canary.

---

## Phase 3 acceptance criteria checklist

- [ ] All readers (R-001 through R-037) migrated, flag at 100%
- [ ] All flags stable at 100% for ≥ 30 days
- [ ] Old code paths removed; `grep` confirms zero reads from deprecated tables
- [ ] `property_reader_shadow_log` clean (zero divergences in final 30-day window)
- [ ] Backtest harness re-run against S1 deals (Jacksonville, Atlanta ×2); results equivalent or better
- [ ] Bishop end-to-end run equivalent or improved
- [ ] This document fully populated (no TBD entries)
- [ ] Phase 4 may begin only after all criteria above are checked

---

## Document history

| Date | Entry |
|---|---|
| 2026-05-29 | Reader inventory produced via comprehensive grep. 37 readers identified across 5 waves. Wave 1 (R-001, R-002) IN PROGRESS with feature flags. |
