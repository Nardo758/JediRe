# JEDI RE — Historical Data Requirements for the Correlation & Strategy Engine

## The Core Problem

The strategy builder needs three things to work:
1. **Current values** — what's the metric RIGHT NOW (for screening)
2. **Historical time series** — what did the metric do over the past 5-10 years (for correlations)
3. **Geographic resolution** — at what level can you get #1 and #2

Most metrics are available at MSA and county level with good history.
Submarket level is available for rent/vacancy/supply but not economic data.
Property level is available for rent and traffic but not demographics.
ZIP code sits in between — better than MSA, worse than property.

Your user's example ("highest immigration + highest home values by zip code")
requires IRS migration data (county level, needs zip estimation) crossed with
home value data (zip level from Zillow/ATTOM). This IS achievable.

---

## DATA LAYER 1: ECONOMIC & DEMOGRAPHIC (Demand Side)

These metrics tell you WHERE demand is building.

### 1.1 Employment & Wages
| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| Employment count | BLS QCEW | County, MSA | 20yr+ | Quarterly | FREE | api.bls.gov |
| Employment growth YoY | BLS QCEW | County, MSA | 20yr+ | Quarterly | FREE | api.bls.gov |
| Avg weekly wage | BLS QCEW | County, MSA, NAICS | 20yr+ | Quarterly | FREE | api.bls.gov |
| Wage growth YoY | BLS QCEW | County, MSA | 20yr+ | Quarterly | FREE | Derived |
| Unemployment rate | BLS LAUS | County, MSA | 20yr+ | Monthly | FREE | api.bls.gov |
| Job openings (JOLTS) | BLS JOLTS | MSA (limited) | 10yr | Monthly | FREE | api.bls.gov |
| Employer by NAICS | BLS QCEW | County | 20yr+ | Quarterly | FREE | api.bls.gov |

**Key insight:** QCEW is the gold standard for employment data. It's a CENSUS, not a survey — covers 95% of all jobs. Quarterly lag (Q1 data available ~6 months later). Available at county × NAICS 2-digit, so you can see "healthcare employment in Martin County grew 8% while retail shrank 2%."

**ZIP level gap:** BLS doesn't publish zip-level employment. Workaround: use Census LODES (Longitudinal Employer-Household Dynamics) which has workplace-area-characteristics at the census block level. Aggregate to zip.

### 1.2 Population & Migration
| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| Population | Census ACS | Tract, Zip, County, MSA | 10yr+ | Annual (5yr est) | FREE | api.census.gov |
| Population growth | Census ACS | Tract, Zip, County | 10yr+ | Annual | FREE | Derived |
| Median household income | Census ACS | Tract, Zip, County | 10yr+ | Annual | FREE | api.census.gov |
| Median home value | Census ACS | Tract, Zip, County | 10yr+ | Annual | FREE | api.census.gov |
| Renter % | Census ACS | Tract, Zip | 10yr+ | Annual | FREE | api.census.gov |
| Age distribution | Census ACS | Tract, Zip | 10yr+ | Annual | FREE | api.census.gov |
| Net domestic migration | IRS SOI | County | 10yr+ | Annual | FREE | irs.gov/statistics |
| Migration by income bracket | IRS SOI | County | 10yr+ | Annual | FREE | irs.gov/statistics |
| Foreign-born population | Census ACS | Tract, Zip, County | 10yr+ | Annual | FREE | api.census.gov |
| International migration | Census estimates | County | 5yr+ | Annual | FREE | census.gov |

**IRS SOI Migration Data:** This is the immigration dataset your user wants. It shows county-to-county migration flows WITH income brackets. "3,200 households moved from New York to Martin County FL, median AGI $78K." Available annually, ~18 month lag.

**ZIP-level migration:** IRS SOI is county-level only. To estimate zip-level immigration:
- Method 1: Weight county migration by zip population share (simple but imprecise)
- Method 2: Use Census ACS "year moved into current home" by zip (shows recency of moves)
- Method 3: Use USPS Change of Address data (if accessible via commercial provider)
- Method 4: ArcGIS GeoEnrichment "Movers" variables — gives zip-level household mobility

**For single-family "highest home values by zip":**
- Zillow ZHVI (Zillow Home Value Index): zip-level, monthly, 10yr+ history, FREE download
- ATTOM: property-level, varies by subscription
- Census ACS: zip-level, annual, median home value
- Your SFR API: property-level current values

### 1.3 Business Formation
| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| New business applications | Census BFS | State, MSA | 5yr | Weekly | FREE | census.gov |
| Entity filings | sunbiz.org (FL) | County (from address) | 10yr+ | Daily | FREE | Scrape |
| SBA lending | SBA | County, Zip | 10yr+ | Quarterly | FREE | sba.gov |

---

## DATA LAYER 2: REAL ESTATE MARKET (Supply-Demand Equilibrium)

### 2.1 Multifamily Rent & Occupancy
| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| Effective rent (avg) | Apartments.com scraper | Property | 2-3yr (scraping) | Monthly | FREE* | Custom scraper |
| Effective rent | RentCast | Property, Zip | 5yr+ | Monthly | $$ | API |
| Effective rent | Apartment Locator AI | Property | Current | Monthly | $$ | API (active) |
| Asking rent (Zillow) | Zillow ZORI | Zip, Metro | 8yr+ | Monthly | FREE | Download |
| Vacancy rate | Apartments.com + CoStar | Submarket | 10yr+ | Quarterly | $$$ | CoStar API |
| Absorption | CoStar / RealPage | Submarket | 10yr+ | Quarterly | $$$ | CoStar API |
| Concession rate | CoStar / Apartments.com | Submarket | 5yr+ | Quarterly | $$$ | CoStar API |

**Submarket vs ZIP vs MSA for rent data:**
- Property level: Apartments.com scraper (free but limited history), RentCast (paid, 5yr), Apartment Locator AI (current)
- ZIP level: Zillow ZORI (free, 8yr monthly history — EXCELLENT for correlations)
- Submarket: CoStar (expensive but the institutional standard)
- MSA: FRED (free, tracks Zillow + CPI rent indices, 10yr+)

**Recommendation:** Start with Zillow ZORI at zip level (free, deep history) + Apartments.com scraper at property level (free, current data). This gives you historical depth for correlations AND current values for screening.

### 2.2 Single-Family Home Values & Sales
| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| Home value index | Zillow ZHVI | Zip, County, Metro | 10yr+ | Monthly | FREE | Download |
| Home value growth YoY | Zillow ZHVI | Zip, County, Metro | 10yr+ | Monthly | FREE | Derived |
| Median sale price | ATTOM / Redfin | Zip, County | 10yr+ | Monthly | $$ / FREE | API / Download |
| Sales volume | County records | County, Zip | 10yr+ | Monthly | FREE | County clerk |
| Days on market | Redfin / Zillow | Zip, Metro | 5yr+ | Monthly | FREE | Download |
| Price-to-rent ratio | Derived | Zip | 10yr+ | Monthly | FREE | ZHVI / ZORI |
| Inventory (listings) | Redfin / Zillow | Zip, Metro | 5yr+ | Monthly | FREE | Download |
| Cash buyer % | ATTOM | County, Zip | 5yr+ | Monthly | $$ | API |

**This is the dataset your SFR API adds.** Combined with Zillow ZHVI (free, zip-level, monthly, 10yr+), you get the "highest home values" side of your user's query.

### 2.3 Supply Pipeline
| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| Permit filings (MF) | Census Building Permits | County, Metro | 20yr+ | Monthly | FREE | census.gov |
| Permit filings (SF) | Census Building Permits | County, Metro | 20yr+ | Monthly | FREE | census.gov |
| Units under construction | CoStar / HUD | Submarket, Metro | 10yr+ | Quarterly | $$$ | CoStar |
| Pipeline-to-stock ratio | Derived | Submarket | 10yr+ | Quarterly | FREE | Derived |
| Certificate of occupancy | County records | Property | Varies | Daily | FREE | County scrape |

---

## DATA LAYER 3: TRAFFIC & DIGITAL (Leading Indicators)

### 3.1 Physical Traffic
| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| AADT | FDOT (FL), state DOTs | Station (near property) | 20yr+ | Annual published | FREE | Open data |
| Continuous count data | FDOT permanent stations | Station | 10yr+ | Hourly | FREE | Open data |
| Real-time traffic | Google Routes API | Road segment | Current | On-demand | $ | API |

### 3.2 Digital Search
| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| Search volume | SpyFu | Keyword (market-level) | 5yr+ | Monthly | $$ | API (active) |
| Search trends | Google Trends | DMA / State | 5yr+ | Weekly | FREE | pytrends |
| Out-of-state search % | Google Trends | DMA | 5yr+ | Weekly | FREE | pytrends |
| Domain organic traffic | SpyFu | Property domain | 5yr+ | Monthly | $$ | API (active) |

---

## DATA LAYER 4: FINANCIAL & MACRO

| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| SOFR / Fed Funds rate | FRED | National | 30yr+ | Daily | FREE | fred.stlouisfed.org |
| 10Y Treasury yield | FRED | National | 30yr+ | Daily | FREE | fred.stlouisfed.org |
| 30Y mortgage rate | FRED (Freddie Mac PMMS) | National | 30yr+ | Weekly | FREE | fred.stlouisfed.org |
| Cap rate (MF) | NCREIF / RCA | MSA | 20yr+ | Quarterly | $$$ | Subscription |
| CPI (rent component) | BLS CPI | MSA (top 20) | 20yr+ | Monthly | FREE | api.bls.gov |
| CPI (all items) | BLS CPI | MSA | 20yr+ | Monthly | FREE | api.bls.gov |
| Case-Shiller HPI | S&P / FRED | MSA (top 20) | 20yr+ | Monthly | FREE | fred.stlouisfed.org |
| Construction cost index | RSMeans / Turner | National + regional | 10yr+ | Quarterly | $$ | Subscription |
| Insurance cost index | NAIC / FHCF (FL) | State / County | 10yr+ | Annual | FREE | State filings |

---

## DATA LAYER 5: COMPETITION & SENTIMENT

| Metric | Source | Granularity | History | Frequency | Cost | API |
|--------|--------|-------------|---------|-----------|------|-----|
| Google rating | Google Places API | Property | Current + trend | On-demand | $ | API |
| Review count | Google Places API | Property | Current | On-demand | $ | API |
| Review sentiment | NLP on review text | Property | 2-3yr (scrape history) | Monthly | $ | Custom |
| Amenity comparison | Apartments.com scraper | Property | Current | Monthly | FREE | Scraper |

---

## HOW THE CORRELATION ENGINE USES HISTORICAL DATA

The correlation engine needs TIME SERIES at matching granularities to compute
rolling correlations. Here's the minimum viable dataset:

### Correlation Tier 1 (MSA level — easiest, deepest history)
```
Time series needed (all monthly or quarterly, 5yr minimum):
  - Rent growth (Zillow ZORI) .................. FREE, monthly, 8yr
  - Home value growth (Zillow ZHVI) ............ FREE, monthly, 10yr
  - Employment growth (BLS QCEW) ............... FREE, quarterly, 20yr
  - Wage growth (BLS QCEW) .................... FREE, quarterly, 20yr
  - Population growth (Census) ................. FREE, annual, 10yr
  - Permit filings (Census) ................... FREE, monthly, 20yr
  - Mortgage rate (FRED PMMS) ................. FREE, weekly, 30yr
  - CPI rent (BLS) ........................... FREE, monthly, 20yr
  - Unemployment rate (BLS LAUS) .............. FREE, monthly, 20yr

Computation:
  For each pair (A, B):
    rolling_correlation = pearson_r(A[t-12:t], B[t-12:t])  // 12-month rolling window
    lead_lag = argmax(cross_correlation(A, B, lags=-12..+12))
    
  This produces the correlation matrix and identifies which metrics LEAD others.
```

### Correlation Tier 2 (ZIP level — good for SFR, partial history)
```
Time series needed:
  - Home value (Zillow ZHVI) .................. FREE, monthly, 10yr
  - Rent index (Zillow ZORI) .................. FREE, monthly, 8yr  
  - Median income (Census ACS) ................ FREE, annual, 10yr
  - Population (Census ACS) ................... FREE, annual, 10yr
  - Net migration estimate (IRS SOI weighted) .. FREE, annual, 10yr
  - Permit filings (county, distributed to zip). FREE, monthly, 10yr
  - Sales volume (county records) .............. FREE, monthly, 10yr
  - Days on market (Redfin) ................... FREE, monthly, 5yr

Computation:
  Same rolling correlation as Tier 1, but annual metrics get interpolated
  to monthly using cubic splines before correlation computation.
  
  For the user's "immigration + home values" query:
    immigration = IRS_SOI_net_inflow (weighted to zip by ACS population)
    home_values = Zillow_ZHVI
    correlation = rolling_pearson(immigration, home_values, window=3yr)
    
  Strategy screen: rank zips by immigration × home_value_rank
```

### Correlation Tier 3 (Property level — limited to operational data)
```
Time series available:
  - Effective rent (Apartments.com scraper) .... FREE, monthly, 2-3yr
  - Google rating (Places API) ................. $, snapshot only
  - AADT (FDOT) ............................... FREE, annual, 10yr+
  - Digital traffic (SpyFu) ................... $$, monthly, 5yr
  
  Property-level correlations are sparse — you can correlate rent vs AADT
  but not rent vs wages (wages aren't property-level).
  
  Solution: JOIN property data with its zip/submarket metrics:
    SELECT p.rent_growth, z.wage_growth, z.home_value_growth
    FROM property_metrics p
    JOIN zip_metrics z ON p.zip_code = z.zip_code
    WHERE p.metric_date = z.metric_date
```

---

## THE FREE DATA STACK (MVP — covers 70% of metrics)

Priority order for ingestion. All free. This is what you ingest FIRST.

| # | Source | Data | Granularity | URL | Ingestion |
|---|--------|------|-------------|-----|-----------|
| 1 | Zillow ZHVI | Home values, monthly | Zip, County, Metro | data.zillow.com | CSV download, monthly |
| 2 | Zillow ZORI | Rent index, monthly | Zip, Metro | data.zillow.com | CSV download, monthly |
| 3 | FRED | SOFR, 10Y, mortgage rate, CPI | National, MSA | fred.stlouisfed.org/docs/api | REST API, daily |
| 4 | BLS QCEW | Employment, wages by NAICS | County, MSA | api.bls.gov | REST API, quarterly |
| 5 | BLS LAUS | Unemployment rate | County, MSA | api.bls.gov | REST API, monthly |
| 6 | Census ACS | Income, population, renter%, age | Tract, Zip, County | api.census.gov | REST API, annual |
| 7 | Census Building Permits | SF + MF permits | County, Metro | census.gov/construction | CSV download, monthly |
| 8 | IRS SOI | County-to-county migration + income | County | irs.gov/statistics/soi | CSV download, annual |
| 9 | Census BFS | Business formation applications | State, MSA | census.gov/econ/bfs | CSV download, weekly |
| 10 | FDOT | AADT, continuous count stations | Station | fdot.gov/statistics | Shapefile, annual |
| 11 | Google Trends | Search interest by keyword + geo | DMA, State | via pytrends | API, weekly |
| 12 | Redfin | Sales, DOM, inventory | Zip, Metro | redfin.com/news/data-center | CSV download, monthly |
| 13 | Case-Shiller | Home price index | Top 20 MSAs | fred.stlouisfed.org | FRED API, monthly |

Total cost: $0
Coverage: rent trends, home values, employment, wages, population, migration,
permits, business formation, rates, traffic (physical), search trends
Missing: digital traffic (SpyFu $$), MF vacancy/absorption (CoStar $$$),
property-level rents (RentCast $$), cap rates (NCREIF $$$)

---

## DATABASE SCHEMA FOR HISTORICAL TIME SERIES

```sql
-- Unified metric time series table
-- Every metric at every granularity goes here
CREATE TABLE metric_time_series (
  id BIGSERIAL PRIMARY KEY,
  metric_id VARCHAR(50) NOT NULL,        -- 'F_RENT_GROWTH', 'E_WAGE_GROWTH', etc.
  geography_type VARCHAR(20) NOT NULL,   -- 'msa', 'county', 'zip', 'submarket', 'property'
  geography_id VARCHAR(50) NOT NULL,     -- FIPS code, zip code, property_id, etc.
  geography_name VARCHAR(255),
  period_date DATE NOT NULL,             -- First day of the period
  period_type VARCHAR(10) NOT NULL,      -- 'monthly', 'quarterly', 'annual'
  value DOUBLE PRECISION NOT NULL,
  source VARCHAR(50) NOT NULL,           -- 'zillow_zhvi', 'bls_qcew', 'fred', etc.
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(metric_id, geography_type, geography_id, period_date)
);

-- Indexes for fast strategy scanning
CREATE INDEX idx_mts_metric_geo ON metric_time_series(metric_id, geography_type);
CREATE INDEX idx_mts_geo_period ON metric_time_series(geography_id, period_date);
CREATE INDEX idx_mts_latest ON metric_time_series(metric_id, geography_type, period_date DESC);

-- Pre-computed correlations (refreshed weekly)
CREATE TABLE metric_correlations (
  id BIGSERIAL PRIMARY KEY,
  metric_a VARCHAR(50) NOT NULL,
  metric_b VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  window_months INTEGER NOT NULL,        -- 12, 24, 36, 60
  correlation_r REAL NOT NULL,           -- -1.0 to 1.0
  lead_lag_months INTEGER,               -- Positive = A leads B
  p_value REAL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(metric_a, metric_b, geography_type, geography_id, window_months)
);

-- Geography reference table
CREATE TABLE geographies (
  id VARCHAR(50) PRIMARY KEY,            -- FIPS, zip, custom submarket ID
  type VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(50),                 -- zip → county → MSA hierarchy
  state VARCHAR(2),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geometry GEOMETRY(MultiPolygon, 4326)  -- For map rendering
);
```

---

## INGESTION PIPELINE

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Data Source  │────▶│  ETL Worker  │────▶│ metric_time_series│
│  (API/CSV)   │     │  (Kafka job) │     │     (Postgres)    │
└──────────────┘     └──────┬───────┘     └────────┬─────────┘
                            │                       │
                     ┌──────▼───────┐        ┌──────▼─────────┐
                     │  Normalize   │        │  Correlation   │
                     │  to MetricId │        │  Engine (cron) │
                     │  + GeoId     │        │  Weekly refresh │
                     └──────────────┘        └────────────────┘

ETL jobs (Kafka consumers):
  - zillow-ingest:     Monthly CSV → ZHVI + ZORI metrics
  - fred-ingest:       Daily API → rates, CPI, HPI metrics
  - bls-ingest:        Quarterly API → employment, wages, unemployment
  - census-ingest:     Annual API → demographics, income, population
  - irs-ingest:        Annual CSV → migration flows
  - permits-ingest:    Monthly CSV → building permits
  - redfin-ingest:     Monthly CSV → sales, DOM, inventory
  - fdot-ingest:       Annual shapefile → AADT stations
  - trends-ingest:     Weekly pytrends → search interest

Correlation engine (cron, weekly):
  For each geography:
    For each metric pair where both have 24+ data points:
      Compute rolling_pearson(A, B, window=12mo)
      Compute cross_correlation(A, B, lags=-12..+12)
      Store result in metric_correlations
      Flag any new divergences for the Opportunity Alert system
```

---

## ANSWERING THE USER'S QUERY: "Highest immigration + highest home values by zip"

```typescript
// Strategy definition
const strategy: StrategyDefinition = {
  name: 'Immigration + High Home Values',
  scope: 'zip',
  conditions: [
    {
      metricId: 'DEMO_NET_MIGRATION',     // New metric: IRS SOI weighted to zip
      operator: 'top_pct',
      value: 20,                           // Top 20% of zips by immigration
      weight: 50,
      required: true,
    },
    {
      metricId: 'SFR_HOME_VALUE',          // New metric: Zillow ZHVI at zip level
      operator: 'top_pct',
      value: 20,                           // Top 20% by home value
      weight: 50,
      required: true,
    },
  ],
  combinator: 'AND',
  sortBy: 'DEMO_NET_MIGRATION',
  assetClasses: ['single_family'],
};

// Execution (backend):
SELECT 
  g.id as zip_code,
  g.name,
  mig.value as net_migration,
  hv.value as home_value
FROM geographies g
JOIN metric_time_series mig 
  ON mig.geography_id = g.id 
  AND mig.metric_id = 'DEMO_NET_MIGRATION'
  AND mig.period_date = (SELECT MAX(period_date) FROM metric_time_series WHERE metric_id = 'DEMO_NET_MIGRATION')
JOIN metric_time_series hv
  ON hv.geography_id = g.id
  AND hv.metric_id = 'SFR_HOME_VALUE'
  AND hv.period_date = (SELECT MAX(period_date) FROM metric_time_series WHERE metric_id = 'SFR_HOME_VALUE')
WHERE g.type = 'zip'
  AND mig.value > (SELECT PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY value) FROM metric_time_series WHERE metric_id = 'DEMO_NET_MIGRATION' AND geography_type = 'zip')
  AND hv.value > (SELECT PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY value) FROM metric_time_series WHERE metric_id = 'SFR_HOME_VALUE' AND geography_type = 'zip')
ORDER BY mig.value DESC
LIMIT 50;
```

---

## NEW METRICS FOR SINGLE-FAMILY (add to catalog)

```typescript
// SFR-specific metrics from your new API + Zillow + ATTOM
{ id: 'SFR_HOME_VALUE', name: 'Median Home Value', cat: 'sfr', granularity: ['zip','county','msa'] }
{ id: 'SFR_HOME_VALUE_GROWTH', name: 'Home Value Growth YoY', cat: 'sfr', granularity: ['zip','county','msa'] }
{ id: 'SFR_PRICE_TO_RENT', name: 'Price-to-Rent Ratio', cat: 'sfr', granularity: ['zip'] }
{ id: 'SFR_SALES_VOLUME', name: 'Monthly Sales Volume', cat: 'sfr', granularity: ['zip','county'] }
{ id: 'SFR_DOM', name: 'Days on Market', cat: 'sfr', granularity: ['zip','county'] }
{ id: 'SFR_INVENTORY', name: 'Active Listings', cat: 'sfr', granularity: ['zip','county'] }
{ id: 'SFR_CASH_BUYER_PCT', name: 'Cash Buyer Percentage', cat: 'sfr', granularity: ['zip','county'] }
{ id: 'SFR_INVESTOR_PCT', name: 'Investor Purchase Share', cat: 'sfr', granularity: ['zip','county'] }

// Demographic metrics for zip-level strategy building
{ id: 'DEMO_NET_MIGRATION', name: 'Net Migration (households/yr)', cat: 'demographic', granularity: ['county','zip_est'] }
{ id: 'DEMO_MIGRATION_INCOME', name: 'Migrant Median AGI', cat: 'demographic', granularity: ['county'] }
{ id: 'DEMO_FOREIGN_BORN_PCT', name: 'Foreign-Born Population %', cat: 'demographic', granularity: ['zip','tract'] }
{ id: 'DEMO_FOREIGN_BORN_GROWTH', name: 'Foreign-Born Growth Rate', cat: 'demographic', granularity: ['zip','tract'] }
{ id: 'DEMO_RENTER_PCT', name: 'Renter Household %', cat: 'demographic', granularity: ['zip','tract'] }
{ id: 'DEMO_MED_AGE', name: 'Median Age', cat: 'demographic', granularity: ['zip','tract'] }
{ id: 'DEMO_HH_GROWTH', name: 'Household Growth Rate', cat: 'demographic', granularity: ['zip','county'] }
```
