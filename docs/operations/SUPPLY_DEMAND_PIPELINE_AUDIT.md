# Supply/Demand Pipeline — Investigation Audit

**Date:** 2026-05-25
**Scope:** Audit only — no code changes. Investigates existing supply/demand data ingest, gaps vs. what M07 and market analytics need, and recommended dispatch sequence.

---

## Part 1 — Current State by Data Source Category

### 1A. Municipal Planning Data (Permits)

#### County Assessor / ArcGIS — LIVE (on-demand)
`backend/src/services/municipal-enrichment/index.ts` — `MunicipalEnrichmentService`

Routes property enrichment requests to county-specific ArcGIS FeatureServer adapters:

| State | Counties / APIs | Status |
|-------|----------------|--------|
| GA | Fulton (`Tax_Parcels_2025`), DeKalb, Cobb, Gwinnett, Cherokee, Clayton | LIVE |
| GA | Henry | STUB (ArcGIS restricted) |
| NC | Mecklenburg (Charlotte) | LIVE |
| TN | Davidson (Nashville) | LIVE |
| TX | Dallas (DCAD), Harris (HCAD) | LIVE |
| FL | Duval (Jacksonville COJ) | LIVE |

**Pre-processor:** US Census Geocoder resolves lat/lng and FIPS codes for GA addresses before routing to county adapter.

**Data landing:** On-demand — not persisted in a central permits table. Returns a `MunicipalLookupResult` object with `parcel_id`, `assessed_value`, `appraised_value`, `land_acres`, `land_use_code`, `units`, `geometry_area_sqft`.

**Cadence:** Just-in-time (triggered during property intake or analysis). No scheduled pull.

#### Zoning (Atlanta DPCD GIS) — LIVE (on-demand)
`backend/src/services/regulatory/m02-zoning/index.ts`

Queries two City of Atlanta DPCD GIS layers:
- Primary: `LotsWithZoning`
- Fallback: `OpenDataService1` Zoning District layer 22

Zone codes cross-referenced against `backend/src/services/regulatory/zoning-codes/city-of-atlanta.json`. Returns `zone_code`, `permitted_uses`, `far_max`, `density_max_units_per_acre`, `height_max_feet`, `setback_*`, `parking_min_per_unit`, `entitlement_risk`.

**Cadence:** On-demand only.

#### Census Building Permits API — STUB (not implemented)
`backend/src/services/ingestion/census-permits-ingest.service.ts`

```ts
export async function ingestBuildingPermits(_apiKey: string): Promise<IngestResult> {
  throw new Error('Census building permits ingestion service not yet implemented');
}
```

The function signature and result interface exist but the body throws immediately. No building permit data flows into the platform. **This is the highest-impact gap for forward supply signals from a structured public source.**

---

### 1B. Federal Data Integrations

#### FRED (Rates, GDP, CPI) — LIVE
- **Script:** `backend/src/scripts/ingest-rate-data.ts`
- **Inngest cron:** `backend/src/inngest/functions/rateSheetStaleness.cron.ts`
- **Series tracked:** `FEDFUNDS`, `SOFR`, `DGS10`, `MORTGAGE30US`, `M2SL`, `GDP`, `CPIAUCSL`
- **Landing table:** `m28_rate_environment` — daily snapshots
- **Note:** The `historical_observations` corpus query service flags FRED as "Awaiting ingestion Phase 4" — the raw FRED pipeline is live in `m28_rate_environment` but the signal has not yet been wired into the `historical_observations` aggregation substrate that M35/M36/M37/M38 consume.

#### Census ACS (Demographics) — LIVE
- **Script:** `backend/src/scripts/ingest-acs-demographics.ts`
- **Vintage:** 2022 ACS 5-year estimates
- **Fields:** Population, Median Household Income, Median Gross Rent — at MSA level
- **Landing table:** `msas` (columns directly on the MSA record)
- **Cadence:** Annual. Manual script execution.

#### BLS QCEW + CES/LAUS (Employment, Wages) — LIVE
- **Scripts:**
  - `backend/src/scripts/ingest-bls-qcew.ts` — annual flat-file download (avg weekly wages, establishment count by NAICS/CES supersector)
  - `backend/src/scripts/ingest-msa-economic-data.ts` — monthly CES employment levels and LAUS unemployment
- **Landing table:** `msa_economic_snapshot` — partitioned by MSA + NAICS/CES supersector
- **Cadence:** Annual (QCEW), monthly (CES/LAUS). Manual script execution; no Inngest cron.

#### LODES (Commute) — PLANNED (Phase 4)
- **Schema:** `commute_shed_workers` and `commute_shed_wage_pct` columns exist in `historical_observations` (migration `20260511_historical_observations.sql`)
- **Corpus query service flag (line 291):** `'Awaiting ingestion Phase 4'`
- **Integration state:** Schema-only. No ingestion script, no API client, no data flowing.

#### Veraset (Mobility) — PLANNED (subscription required)
- **Schema:** `mobility_unique_visitors` column exists in `historical_observations`
- **Corpus query service flag (line 295):** `'Awaiting subscription'`
- **Integration state:** Schema-only. Blocked on commercial data subscription.

#### Zillow ZHVI / ZORI (Home Values, Rent Index) — PARTIAL (manual CSV)
- **Scripts:** `backend/src/services/ingestion/zillow-zhvi-ingest.service.ts`, `zillow-zori-ingest.service.ts`
- **Method:** Reads a CSV file path passed as argument — not an API call
- **Landing table:** `metric_time_series` (source tagged `'zillow_zhvi'` / `'zillow_zori'`)
- **Cadence:** Ad-hoc / manual. No scheduled pull. Zillow does not offer a free API; CSV download requires a Zillow account.

---

### 1C. CoStar

CoStar is the most integrated commercial data source in the platform.

#### Agent Tools — LIVE
| Tool | File | What it fetches |
|------|------|----------------|
| `fetch_costar_pipeline` | `backend/src/agents/tools/fetch_costar_pipeline.ts` | Units under construction, planned, permitted; 12/24-month deliveries; pipeline as % of stock; months of supply; absorption rate |
| `fetch_costar_metrics` | `backend/src/agents/tools/fetch_costar_metrics.ts` | Vacancy, effective rent, absorption, cap rates, price/unit — submarket level |

#### Data Tables — LIVE
| Table | Key Fields |
|-------|-----------|
| `costar_market_metrics` | `avg_asking_rent`, `avg_occupancy_pct`, `vacancy_rate`, `net_absorption_units`, `units_under_construction`, `new_supply_trailing_12mo` |
| `development_projects` | `construction_status` (planned/permitted/under_construction/delivered), `units`, `expected_delivery`, `groundbreaking_date`, `developer`, `data_source = 'costar'` |
| `supply_pipeline_aggregates` | `planned_units`, `under_construction_units`, `units_by_quarter` (JSONB quarterly phasing) |
| `data_library_assets` | Property-level data from CoStar PDF parser (unit mix, amenities, contacts, walk/transit scores) |

#### Freshness Rule
Migration `20260424_013`: CoStar data takes precedence over apartment locator fallbacks when data is **< 45 days old**. No automated refresh cron — data goes stale after 45 days with no auto-correction.

#### PDF Parser — LIVE
`backend/src/services/document-extraction/parsers/costar-parser.ts` — Extracts structured property-level data from uploaded CoStar PDF Property Summaries.

#### Submarket / MSA Coverage
CoStar data is deal-triggered (agent runs on a specific deal) or pulled via `/market/inventory/:city/:state`. There is no platform-wide scheduled CoStar market sweep covering all tracked submarkets.

---

### 1D. SEC Filings

#### 10-K / 10-Q (REIT Financials) — LIVE
- **Client:** `backend/src/utils/sec-api.client.ts` — uses SEC-API.io (Query API + XBRL-to-JSON API)
- **Fields extracted:** Revenue, Operating Income, Operating Margin
- **REIT coverage:** `SEC_COMP_TICKERS` map covers major public REITs across apartment, office, retail, industrial, self-storage, hotel, healthcare, senior/student housing sectors (EQR, PSA, BXP, PLD, WELL, etc.)
- **Data use:** Real-time fetch for frontend CompareHub tab (`frontend/src/pages/development/financial-engine/CompareHubTab.tsx`). **Not persisted to a table** — fetched on-demand per session.
- **Gap:** No historical SEC snapshot storage. Each page load re-fetches. No sector-wide REIT pipeline/supply analysis from 10-K development pipeline disclosures.

#### 8-K (Event Filings) — PARTIAL
- **Source:** `backend/src/services/discovery/sources/cre-rss.ts` — subscribes to SEC EDGAR REIT 8-K Atom feed (`forms=8-K`, keyword `"REIT"`)
- **Integration state:** 8-K feeds flow into the news discovery engine but are treated as news articles, not parsed for structured deal/supply data.

---

### 1E. Trade Press / News

#### News Providers — LIVE
`backend/src/services/news/news.service.ts` with provider adapters in `backend/src/services/news/providers/`:

| Category | Sources |
|----------|---------|
| CRE Trade Press | Bisnow, GlobeSt, HousingWire |
| CRE Discovery RSS | GlobeSt, Bisnow (national + regional), Connect CRE, REJournals, Multifamily Executive, Multi-Housing News, BiggerPockets, Reddit (`r/CommercialRealEstate`, `r/multifamily`) |
| Financial Press | Bloomberg, Reuters, WSJ, FT, NYT, CNBC, MarketWatch, The Guardian |
| SEC Filings | EDGAR REIT 8-K Atom feed |

#### SSRF Protection — LIVE
`backend/src/services/news-connections/ssrf-guard.ts` — `safeFetchText()` performs DNS resolution validation (blocks 10.x, 127.x, 169.254.x, loopback), handles redirects securely. Used by `rss-feeds.ts` for user-provided RSS feeds.

#### Structured Extraction from Articles — PARTIAL
`backend/src/services/demand-signal.service.ts` — `DemandSignalService`

Converts news events into quantified housing demand projections. Supports categories: `employment`, `university`, `military`, `migration`. Calculates `peopleCount → totalUnits` via conversion factors, phases demand by quarter, stratifies by income tier (affordable/workforce/market/luxury).

**Gap:** Classification of news events is **not automated**. The service has the math but requires a structured `DemandEventInput` object — someone or something must extract the event from the article. There is no pipeline wiring `news_provider → NLP extraction → DemandEventInput → DemandSignalService`.

**Landing tables:** `demand_events`, `demand_projections`

#### Rent Scraper — LIVE
`backend/src/services/rent-scraper.service.ts`
- Method: Cloudflare Browser Rendering API to bypass bot protections, then AI-driven JSON extraction of floor plans
- Landing tables: `rent_scrape_targets` (URLs), `rent_scrape_jobs` (log), `scraped_rents` (structured output)

---

### 1F. Forward Supply Infrastructure (WS-3) — LIVE

`backend/src/services/forward-supply.service.ts` — **`ForwardSupplyService`**

Three-layer PostGIS radius sweep computing local forward supply capacity:
- **Layer 1 (`RadiusSweepService`):** Sweeps MF-zoned parcels within 3mi and 5mi rings; classifies as VACANT / UNDERBUILT / DEVELOPED
- **Layer 2 (`BatchFeasibilityService`):** Computes building-envelope capacity (`allowedUnits`) per parcel using FAR, height, density rules
- **Layer 3 (`RezoneTrendService`):** Assigns rezone probability to non-MF parcels; calculates `trendWeightedCapacityUnits = Σ(theoreticalMFCapacity × rezoneProbability)`

**Output shape:**
```ts
ForwardSupplyRing {
  radiusMiles: 3 | 5,
  staticCapacityUnits: number,     // MF-zoned allowedUnits
  vacantUnits: number,
  underbuiltUnits: number,
  trendWeighted: { trendWeightedCapacityUnits, probableRezoneParcels }
}
```

**Gap:** This service computes theoretical zoning capacity — not actual pipeline (permitted + under construction + planned projects). It does not consume or output to the `development_projects` or `supply_pipeline_aggregates` tables. The CoStar pipeline and WS-3 are parallel, unmerged supply signals.

---

### 1G. Demand Signal Infrastructure (M35) — PARTIAL

`backend/src/agents/tools/fetch_m35_event_forecast.ts` — reads `key_events LEFT JOIN event_forecasts` (after W-01 fix; legacy `demand_events` table is empty).

M35 gracefully stubs when `key_events` has no rows for a deal's location. The agent tool outputs:
```ts
{ events: EventImpact[], net_occupancy_lift: number, net_rent_premium: number, m35_available: boolean }
```

M35 contributes a **15% weighted signal** to M07's forward demand model. However:
- `key_events` table population depends on news discovery → structured classification → event creation — this pipeline has the individual pieces but no fully automated end-to-end wiring
- The `historical_observations` corpus query service still flags M35 events as "Awaiting ingestion Phase 4" (lines 294, 320) for the empirical calibration substrate

---

## Part 2 — Gap Analysis (Prioritized by Traffic Engine Impact)

### Priority Tier 1 — High M07 Impact, Structured Public Source Available

| Gap | What we want | Source | Integration state | Estimated effort |
|-----|-------------|--------|------------------|-----------------|
| **Census Building Permits** | Forward supply signal: permitted residential units by metro/county, quarterly cadence | US Census Building Permits Survey (API: `api.census.gov/data/timeseries/bpermits`) | STUB — function body is `throw new Error(...)` | S (1–2 days): implement `ingestBuildingPermits`, land in new `building_permits_census` table, schedule via Inngest |
| **CoStar automated refresh** | Prevent market metrics going stale (>45 days); all tracked submarkets swept, not just deal-triggered | CoStar API (already integrated) | On-demand only; no scheduled sweep | M (2–3 days): Inngest cron that sweeps `costar_market_metrics` by market_id; surface staleness badge in UI |
| **LODES commute-shed data** | Workers commuting into each submarket — demand proxy | US Census LEHD LODES (free, public) | Schema only; "Phase 4" | M (2–3 days): HTTP client to LODES API, ingest `commute_shed_workers` + `commute_shed_wage_pct` into `historical_observations` |

### Priority Tier 2 — Medium M07 Impact, Structured Source Available

| Gap | What we want | Source | Integration state | Estimated effort |
|-----|-------------|--------|------------------|-----------------|
| **WS-3 ↔ CoStar merge** | Unified forward supply view combining CoStar permitted/under-construction pipeline with WS-3 theoretical capacity | Internal — join `development_projects` + WS-3 ring output | Not wired | S (1 day): new `ForwardSupplyEnricher` that overlays CoStar `development_projects` into WS-3 ring aggregates |
| **News → demand auto-extraction** | Auto-classify employment/infrastructure news events into `DemandEventInput` for `DemandSignalService` | Internal LLM extraction against existing news providers | Pieces exist; no wiring | M (2–3 days): Inngest function that runs Claude against new `user_news_items` → classifies → creates `demand_events`; M35 `key_events` already wired |
| **Zillow ZORI/ZHVI automated pull** | Monthly rent index and home value trend at MSA level | Zillow Research (CSV download — requires account) | Manual CSV only | L (1 week+): Depends on whether Zillow grants API access or if FRED RENT series / ACS can substitute |
| **SEC 10-K pipeline disclosures** | Major REIT development pipelines (planned starts, total pipeline GLA, geographic concentration) from annual filings | SEC-API.io (already integrated) | 10-K fetched on-demand, not stored or mined for supply data | S (1 day): extend `sec-api.client.ts` to extract `developmentPipelineUnits` from REIT 10-K XBRL, persist to `reit_pipeline_snapshots` |

### Priority Tier 3 — Lower M07 Impact or Blocked on Commercial Subscription

| Gap | What we want | Source | Integration state | Estimated effort |
|-----|-------------|--------|------------------|-----------------|
| **Veraset mobility** | Foot traffic / unique visitors at submarket level | Veraset (paid) | Schema only; blocked on subscription | XL — blocked on procurement |
| **FRED → historical_observations wiring** | Macro signals (rates, GDP, CPI) in empirical calibration substrate | Internal — already in `m28_rate_environment` | "Phase 4" flag in corpus query service | S (< 1 day): ETL from `m28_rate_environment` into `historical_observations` |
| **QCEW → historical_observations wiring** | Employment/wage signals in calibration substrate | Internal — already in `msa_economic_snapshot` | "Phase 4" flag | S (< 1 day): same ETL pattern as above |
| **CoStar construction starts cadence** | Alert when a development_project transitions to `under_construction` — supply pressure signal for M07 | Internal — `development_projects.groundbreaking_date` + status changes | No change-event mechanism | S (1 day): Inngest event on status change → `supply_pressure_changed` Kafka event → M07 re-calibration |

---

## Part 3 — Traffic Engine M07: Current Consumption vs. Designed

### 3A. What M07 Actually Consumes Today

| Signal | Table / Source | Status |
|--------|---------------|--------|
| Physical street traffic (ADT) | `adt_counts`, `property_traffic_context` | LIVE |
| Digital traffic (web sessions, domain strength) | `property_website_analytics` | LIVE |
| Leasing velocity (signing rates, conversion ratios) | `leasing_events`, `rent_roll_snapshots` | LIVE |
| Absorption rate / supply pressure | `costar_market_metrics` (`net_absorption_units`, vacancy, `new_supply_trailing_12mo`) | LIVE — subject to 45-day staleness |
| M35 event impact (demand from news) | `key_events LEFT JOIN event_forecasts` | PARTIAL — graceful stub when empty |
| Forward supply capacity (WS-3 rings) | `ForwardSupplyService` output | LIVE but not merged with CoStar pipeline |
| Peer max monthly pace (absorption ceiling) | M04 Supply Pipeline → `peer_max_monthly_pace` | LIVE (via M04 integration) |
| Seasonal / temporal profiles | Hardcoded FDOT seasonal factors + DOW/hourly coefficients | LIVE |
| Lease-up signing curve | `pre_lease_signing_curve` (sigmoid from delivery date) | LIVE in LEASE_UP mode |

### 3B. Signals That Would Meaningfully Improve M07 Forecast Accuracy

In order of estimated impact:

1. **Quarterly supply pipeline phasing** — `supply_pipeline_aggregates.units_by_quarter` (JSONB) is populated by CoStar but M07 reads a single `new_supply_trailing_12mo` scalar rather than the quarterly phasing array. Consuming `units_by_quarter` would let M07 dampen occupancy projections in specific delivery quarters.

2. **Census building permits (leading indicator)** — Currently M07 knows about projects already in CoStar. Permitted-but-not-yet-filed-in-CoStar supply represents an 18-24 month lead signal. Census permits API is the highest-leverage unbridged structured source.

3. **LODES commute-shed demand proxy** — Number of workers commuting into a submarket is a durable demand indicator that doesn't depend on news events. Currently absent.

4. **M35 event demand projections wired end-to-end** — The math is in `demand_projections` but the news → classification → event pipeline is not automated. When M35 is fully live, M07's 15% event-signal weight becomes meaningful.

5. **CoStar metrics scheduled refresh** — The 45-day staleness window means M07's vacancy/absorption inputs can be significantly outdated between agent runs on any given deal.

### 3C. Required Data Shape for Forward Pipeline in M07

M07 needs forward supply/demand data in this shape to replace the current single-scalar inputs:

```ts
interface ForwardPipelineSignal {
  submarket_id: string;
  as_of_date: string;  // ISO date of snapshot

  supply: {
    // Quarterly delivery schedule (CoStar + Census permits)
    quarterly_deliveries: Array<{
      quarter: string;          // e.g. "2026-Q3"
      units_under_construction: number;
      units_permitted: number;  // from Census permits (gap today)
      units_planned: number;
    }>;
    // WS-3 theoretical upside (probabilistic, 3yr horizon)
    theoretical_capacity_3mi: number;
    theoretical_capacity_5mi: number;
  };

  demand: {
    // M35 event-driven demand (quarterly phasing)
    event_demand_quarterly: Array<{
      quarter: string;
      units_projected: number;  // from demand_projections
      confidence: 'high' | 'medium' | 'low';
    }>;
    // Structural demand (LODES commute + ACS income — gap today)
    commute_shed_workers: number | null;
    median_household_income: number | null;
  };

  // Derived — for M07 direct consumption
  net_supply_demand_ratio: number;   // (supply_12mo - demand_12mo) / existing_stock
  supply_pressure_score: number;     // 0–100, already computed by DemandSignalService
}
```

**Today M07 receives:** Two scalars (`supply_demand_ratio`, `absorption_rate`) from `apartment_market_data` / `trade_area_demand_forecast` — effectively collapsing the quarterly phasing into a single number with no forward visibility.

---

## Part 4 — Recommended Dispatch Sequence

Ordered by M07 impact × implementation readiness (structured source first; news extraction only where structured source is absent).

### Dispatch 1 — Census Building Permits (High impact, low effort, fully public API)
**Source:** `api.census.gov/data/timeseries/bpermits` — free, no auth, JSON response
**Work:** Implement `ingestBuildingPermits()` in the existing stub file. Land data in a new `building_permits_census` table (`metro_id`, `county_fips`, `period`, `units_1`, `units_2_to_4`, `units_5_plus`). Add Inngest monthly cron. Wire `units_5_plus` into `supply_pipeline_aggregates` as a `source = 'census_permits'` row so M07 can see permitted (not yet CoStar-visible) pipeline.

### Dispatch 2 — CoStar Scheduled Refresh (High impact, zero new integration)
**Source:** CoStar API (already integrated)
**Work:** Add an Inngest weekly cron that iterates all distinct `market_id` values in `costar_market_metrics` and re-fetches metrics for any row where `updated_at < NOW() - INTERVAL '45 days'`. Eliminates the staleness risk without changing any M07 code.

### Dispatch 3 — FRED / QCEW → historical_observations ETL (Medium impact, near-zero effort)
**Source:** Internal tables (`m28_rate_environment`, `msa_economic_snapshot`)
**Work:** < 1 day. Remove the "Phase 4" stub in `CorpusQueryService` for FRED and QCEW. Write a nightly ETL that copies relevant columns into `historical_observations`. Immediately unblocks M35–M38 math engines from using macro and employment signals.

### Dispatch 4 — LODES Commute-Shed Ingestion (Medium impact, structured public source)
**Source:** US Census LEHD LODES API — free, no auth
**Work:** New ingestion script (`ingest-lodes-commute.ts`), API client for `api.census.gov/data/*/wac` (Workplace Area Characteristics) and `rac` (Residence Area Characteristics). Land into `historical_observations.commute_shed_workers`. Unblocks the LODES signal for M35–M38 calibration and provides M07 a structural demand proxy.

### Dispatch 5 — WS-3 ↔ CoStar Pipeline Merge (Medium impact, internal only)
**Source:** `development_projects` (CoStar) + `ForwardSupplyService` ring output (WS-3)
**Work:** New `ForwardSupplyEnricher` that injects CoStar `development_projects` rows (filtered to ring radius) into `ForwardSupplyRing.pipelineProjects[]`. M07 then sees both the theoretical capacity (WS-3) and the committed pipeline (CoStar) in one signal.

### Dispatch 6 — News → Demand Auto-Classification (Medium impact, after Dispatch 3–4)
**Source:** Existing news providers + Claude LLM
**Work:** Inngest function that runs on new `user_news_items` matching CRE demand keywords (employer, campus, military base, etc.), calls Claude to extract `DemandEventInput`, passes to `DemandSignalService.createDemandEvent()`. Fully automated news→`demand_events`→M35→M07 pipeline. Do **after** Dispatch 3–4 so the calibration substrate is ready to receive the signals.

### Dispatch 7 — SEC 10-K REIT Supply Pipeline (Low urgency, structured source)
**Source:** SEC-API.io (already integrated)
**Work:** Extend `sec-api.client.ts` to extract REIT development pipeline disclosures from 10-K XBRL (planned starts by metro, total pipeline GLA). Persist to `reit_pipeline_snapshots`. Wire into `supply_pipeline_aggregates` as `source = 'sec_reit'` rows. Useful for major metros where REIT construction is a dominant supply driver.

### Do NOT dispatch (yet)
- **Veraset mobility** — blocked on commercial subscription; schema is ready when procurement completes
- **News extraction before structured sources** — Dispatches 1–5 fill the highest-impact gaps with zero scraping risk; news extraction (Dispatch 6) follows once those are live
- **Zillow ZHVI/ZORI automation** — FRED RENT / ACS Median Gross Rent serve the same purpose at no cost; pursue Zillow API only if MSA-level granularity is insufficient

---

## Appendix — Data Source Inventory

| Source | Category | State | Primary Table(s) |
|--------|----------|-------|-----------------|
| CoStar API | CRE Market/Pipeline | LIVE (on-demand + agent tools) | `costar_market_metrics`, `development_projects`, `supply_pipeline_aggregates` |
| FRED API | Macro (rates, GDP, CPI) | LIVE in `m28_rate_environment`; PENDING in `historical_observations` | `m28_rate_environment` |
| Census ACS | Demographics | LIVE (annual) | `msas` |
| BLS CES/LAUS | Employment (monthly) | LIVE (monthly) | `msa_economic_snapshot` |
| BLS QCEW | Wages (annual) | LIVE (annual) | `msa_economic_snapshot` |
| Census Geocoder | Address resolution | LIVE (on-demand) | — (pass-through) |
| County ArcGIS | Property assessor | LIVE (on-demand, 10 counties) | — (pass-through) |
| Atlanta DPCD GIS | Zoning | LIVE (on-demand) | — (pass-through) |
| Census Building Permits | Forward supply | STUB | — |
| LODES | Commute demand | SCHEMA ONLY | `historical_observations` (unpopulated cols) |
| Veraset | Mobility | SCHEMA ONLY | `historical_observations` (unpopulated cols) |
| Zillow ZHVI | Home values | PARTIAL (manual CSV) | `metric_time_series` |
| Zillow ZORI | Rent index | PARTIAL (manual CSV) | `metric_time_series` |
| SEC-API.io (10-K/10-Q) | REIT financials | LIVE (on-demand, not persisted) | — |
| SEC EDGAR (8-K RSS) | REIT events | LIVE → news stream only | `user_news_items` |
| Bisnow, GlobeSt, HousingWire | CRE trade press | LIVE | `user_news_items` |
| Bloomberg, Reuters, WSJ, etc. | Financial press | LIVE | `user_news_items` |
| Rent scraper (AI + CBR) | Floor plan rents | LIVE | `scraped_rents` |
| DemandSignalService | News→demand | PARTIAL (math live, automation gap) | `demand_events`, `demand_projections` |
| WS-3 ForwardSupplyService | Theoretical supply capacity | LIVE (on-demand) | — (in-memory ring output) |
| M35 event forecast | Demand events | PARTIAL (tool live, pipeline gap) | `key_events`, `event_forecasts` |

*Audit complete — 2026-05-25. No code changes made.*
