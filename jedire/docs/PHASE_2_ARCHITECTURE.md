# Phase 2: Market Intelligence Architecture

**Status:** Design Phase  
**Dependencies:** Phase 1A Complete (parcel database loaded)  
**Timeline:** Weeks 3-8 (6 weeks)  
**Goal:** Real-time market intelligence feeding optimization recommendations

---

## Executive Summary

Phase 2 connects JEDI RE to the real world:
- **Phase 1** tells us what CAN be built (zoning capacity)
- **Phase 2** tells us what SHOULD be built (market demand)
- **Phase 3** tells us HOW to build it (optimal configuration)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2: MARKET INTELLIGENCE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DATA SOURCES (External)                                            │   │
│  │  ───────────────────────────────────────────────────────────────    │   │
│  │                                                                     │   │
│  │  1. OppGrid Scrapers (Leon's existing infrastructure)              │   │
│  │     • apartments.com scraper                                        │   │
│  │     • apartmentguide.com scraper                                    │   │
│  │     • forrent.com scraper                                           │   │
│  │     • Real-time rent data                                           │   │
│  │     • Unit availability                                             │   │
│  │     • Amenities, photos                                             │   │
│  │                                                                     │   │
│  │  2. CoStar API (pending access)                                     │   │
│  │     • Pipeline projects                                             │   │
│  │     • Historical rent trends                                        │   │
│  │     • Absorption rates                                              │   │
│  │     • Cap rates by market                                           │   │
│  │                                                                     │   │
│  │  3. Census Bureau API (free)                                        │   │
│  │     • Population growth                                             │   │
│  │     • Household income                                              │   │
│  │     • Employment data                                               │   │
│  │     • Migration patterns                                            │   │
│  │                                                                     │   │
│  │  4. Google Trends API                                               │   │
│  │     • Search volume for "apartments [city]"                         │   │
│  │     • Demand proxy signals                                          │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  INGESTION LAYER (ETL)                                              │   │
│  │  ───────────────────────────────────────────────────────────────    │   │
│  │                                                                     │   │
│  │  Scraper Adapter                                                    │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • Connect to Leon's scraper DBs or APIs                            │   │
│  │  • Normalize data formats                                           │   │
│  │  • Deduplicate properties                                           │   │
│  │  • Geocode addresses → link to parcels                              │   │
│  │  • Schedule: Every 24 hours (or real-time if webhook available)     │   │
│  │                                                                     │   │
│  │  CoStar Adapter                                                     │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • OAuth authentication                                             │   │
│  │  • Rate limit handling (CoStar is strict)                           │   │
│  │  • Pipeline projects enrichment                                     │   │
│  │  • Schedule: Weekly (CoStar updates slowly)                         │   │
│  │                                                                     │   │
│  │  Demographic Adapter                                                │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • Census API calls                                                 │   │
│  │  • Map to submarkets                                                │   │
│  │  • Schedule: Monthly (demographic data changes slowly)              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STORAGE LAYER (PostgreSQL + TimescaleDB)                           │   │
│  │  ───────────────────────────────────────────────────────────────    │   │
│  │                                                                     │   │
│  │  properties (from scrapers)                                         │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • property_id, name, address, submarket_id                         │   │
│  │  • units, year_built, amenities                                     │   │
│  │  • last_scraped_at, data_source                                     │   │
│  │                                                                     │   │
│  │  rent_observations (TimescaleDB hypertable)                         │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • observed_at (timestamp), property_id                             │   │
│  │  • unit_type (studio, 1br, 2br, 3br)                                │   │
│  │  • asking_rent, sqft, availability                                  │   │
│  │  • Auto-partitioned by time for fast queries                        │   │
│  │                                                                     │   │
│  │  pipeline_projects                                                  │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • project_id, name, address, submarket_id                          │   │
│  │  • units, estimated_delivery, status                                │   │
│  │  • data_source (CoStar, scraper, manual)                            │   │
│  │                                                                     │   │
│  │  submarket_demographics                                             │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • submarket_id, year                                               │   │
│  │  • population, households, median_income                            │   │
│  │  • employment_count, unemployment_rate                              │   │
│  │                                                                     │   │
│  │  market_signals (calculated metrics)                                │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • submarket_id, calculated_at                                      │   │
│  │  • avg_rent_1br, avg_rent_2br, avg_rent_3br                         │   │
│  │  • rent_growth_3mo, rent_growth_12mo                                │   │
│  │  • vacancy_rate, absorption_rate                                    │   │
│  │  • supply_demand_ratio                                              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ANALYSIS LAYER (Existing Engines from Phase 1)                     │   │
│  │  ───────────────────────────────────────────────────────────────    │   │
│  │                                                                     │   │
│  │  Signal Processing Engine ✅ (code complete)                        │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • Kalman filter for rent noise reduction                           │   │
│  │  • Fourier decomposition for seasonality                            │   │
│  │  • Detect true trends vs market noise                               │   │
│  │  • Input: rent_observations                                         │   │
│  │  • Output: smoothed_rent, trend_direction, confidence               │   │
│  │                                                                     │   │
│  │  Carrying Capacity Engine ✅ (code complete)                        │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • Ecological saturation model                                      │   │
│  │  • Calculate when submarket hits equilibrium                        │   │
│  │  • Input: existing inventory + pipeline + demographics              │   │
│  │  • Output: saturation_level, years_to_equilibrium                   │   │
│  │                                                                     │   │
│  │  Imbalance Detector ✅ (code complete)                              │   │
│  │  ──────────────────────────────────────────────────────────────     │   │
│  │  • Synthesizes Signal + Capacity engines                            │   │
│  │  • Verdict: STRONG_OPPORTUNITY → AVOID                              │   │
│  │  • Input: all market signals                                        │   │
│  │  • Output: verdict, confidence, recommendations                     │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  API LAYER (New - connects to Phase 3)                              │   │
│  │  ───────────────────────────────────────────────────────────────    │   │
│  │                                                                     │   │
│  │  GET /api/v1/submarkets                                             │   │
│  │    → List all submarkets with basic stats                           │   │
│  │                                                                     │   │
│  │  GET /api/v1/submarkets/{id}                                        │   │
│  │    → Detailed submarket profile                                     │   │
│  │    → Rent trends, demographics, pipeline                            │   │
│  │                                                                     │   │
│  │  GET /api/v1/submarkets/{id}/analysis                               │   │
│  │    → Full supply-demand analysis                                    │   │
│  │    → Verdict: STRONG_OPPORTUNITY (78/100)                           │   │
│  │    → Reasoning: "Undersupplied, strong rent growth..."              │   │
│  │                                                                     │   │
│  │  GET /api/v1/properties                                             │   │
│  │    → List properties (filter by submarket, rent range, etc.)        │   │
│  │                                                                     │   │
│  │  GET /api/v1/properties/{id}/rent-history                           │   │
│  │    → Time series of rent observations                               │   │
│  │    → Chart-ready data                                               │   │
│  │                                                                     │   │
│  │  POST /api/v1/parcels/{id}/market-fit                               │   │
│  │    → Given a parcel, what does market data say?                     │   │
│  │    → Combines Phase 1 (capacity) + Phase 2 (market)                 │   │
│  │    → Returns: optimal unit mix, target rents, absorption estimate   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration with Leon's Scrapers

### Current State (OppGrid)

Leon already has apartment scrapers collecting:
- Property listings
- Rents by unit type
- Availability
- Amenities
- Photos, floor plans

**Questions for Leon:**
1. Where is this data stored? (Database? Files? API?)
2. Update frequency? (Real-time? Daily?)
3. Geographic coverage? (Atlanta only? Multiple cities?)
4. Access method? (Direct DB access? API? Export files?)

### Integration Strategy

**Option 1: Direct Database Connection** (Fastest)
```python
# If Leon's scrapers write to PostgreSQL/MySQL
from scrapers_db import get_connection

conn = get_connection(leon_scraper_db)
properties = conn.execute("""
    SELECT property_id, name, address, rent_1br, rent_2br
    FROM apartments
    WHERE city = 'Atlanta'
    AND last_scraped > NOW() - INTERVAL '7 days'
""")

# Transform and load into JEDI RE
for prop in properties:
    load_into_jedire(prop)
```

**Option 2: API Integration** (If Leon exposes scrapers via API)
```python
import requests

response = requests.get("https://oppgrid.api/properties", params={
    "city": "Atlanta",
    "updated_since": "2026-01-01"
})

for prop in response.json():
    load_into_jedire(prop)
```

**Option 3: File Export/Import** (Simplest)
```python
# Leon exports to CSV/JSON daily
# JEDI RE imports on schedule

import pandas as pd

df = pd.read_csv("/path/to/oppgrid/export/atlanta_properties.csv")
# Geocode addresses
# Link to parcels
# Load into rent_observations table
```

---

## Data Flow: Scrapers → JEDI RE

### Step 1: Property Matching

**Challenge:** Scraper has "123 Peachtree St", we need to link to parcel in database

**Solution: Geocoding + Spatial Join**
```python
from geopy.geocoders import Nominatim
import geopandas as gpd

# Geocode property address
geolocator = Nominatim(user_agent="jedire")
location = geolocator.geocode("123 Peachtree St, Atlanta, GA")
lat, lon = location.latitude, location.longitude

# Find matching parcel
property_point = Point(lon, lat)
parcel = parcels_gdf[parcels_gdf.geometry.contains(property_point)]

if parcel:
    # Link property to parcel
    link_property_to_parcel(property_id, parcel.parcel_id)
```

### Step 2: Rent Time Series Storage

**Schema:**
```sql
CREATE TABLE rent_observations (
    observed_at TIMESTAMPTZ NOT NULL,
    property_id INTEGER NOT NULL,
    unit_type TEXT NOT NULL,  -- 'studio', '1br', '2br', '3br'
    asking_rent NUMERIC(10,2),
    sqft INTEGER,
    available_units INTEGER,
    data_source TEXT,  -- 'apartments.com', 'costar', etc.
    
    PRIMARY KEY (observed_at, property_id, unit_type)
);

-- Convert to TimescaleDB hypertable for fast time-series queries
SELECT create_hypertable('rent_observations', 'observed_at');
```

**Fast Queries:**
```sql
-- Get rent trend for Buckhead 2BRs over last 12 months
SELECT 
    time_bucket('1 month', observed_at) as month,
    AVG(asking_rent) as avg_rent,
    COUNT(*) as observations
FROM rent_observations ro
JOIN properties p ON ro.property_id = p.property_id
WHERE p.submarket_id = 'buckhead'
AND ro.unit_type = '2br'
AND ro.observed_at > NOW() - INTERVAL '12 months'
GROUP BY month
ORDER BY month;
```

### Step 3: Submarket Aggregation

**Automatically calculate submarket-level metrics:**
```python
class SubmarketAnalyzer:
    def calculate_metrics(self, submarket_id, as_of_date):
        """
        Calculate all metrics for a submarket as of a specific date
        """
        # 1. Average rents by unit type
        rents = self.get_avg_rents(submarket_id, as_of_date)
        
        # 2. Rent growth (3mo, 12mo)
        growth_3mo = self.calculate_rent_growth(submarket_id, months=3)
        growth_12mo = self.calculate_rent_growth(submarket_id, months=12)
        
        # 3. Vacancy rate (if scraper captures this)
        vacancy = self.calculate_vacancy(submarket_id, as_of_date)
        
        # 4. Supply count
        existing_units = self.count_existing_units(submarket_id)
        pipeline_units = self.count_pipeline_units(submarket_id)
        
        # 5. Demand proxy (population growth × household formation rate)
        demand = self.estimate_demand(submarket_id)
        
        # Store results
        return {
            "submarket_id": submarket_id,
            "calculated_at": as_of_date,
            "avg_rent_1br": rents['1br'],
            "avg_rent_2br": rents['2br'],
            "rent_growth_3mo": growth_3mo,
            "rent_growth_12mo": growth_12mo,
            "vacancy_rate": vacancy,
            "existing_units": existing_units,
            "pipeline_units": pipeline_units,
            "estimated_annual_demand": demand,
            "supply_demand_ratio": (existing_units + pipeline_units) / demand
        }
```

---

## Phase 2 Implementation Timeline

### Week 3: Scraper Integration
- [ ] Meet with Leon to understand scraper architecture
- [ ] Design adapter layer (DB, API, or file-based)
- [ ] Build geocoding pipeline (address → lat/lon → parcel)
- [ ] Create property matching algorithm
- [ ] Test with 100 properties

### Week 4: Data Pipeline Build
- [ ] Create `rent_observations` table (TimescaleDB)
- [ ] Build ETL scripts (scrapers → JEDI RE)
- [ ] Schedule automated imports (daily/weekly)
- [ ] Validate data quality (nulls, outliers, duplicates)
- [ ] Accumulate 4 weeks of rent data

### Week 5: CoStar Integration
- [ ] Get CoStar API credentials from Leon
- [ ] Build CoStar adapter (OAuth, rate limits)
- [ ] Import pipeline projects
- [ ] Link pipeline to submarkets
- [ ] Validate against known projects

### Week 6: Demographic Data
- [ ] Integrate Census Bureau API
- [ ] Map demographic data to submarkets
- [ ] Calculate demand proxies
- [ ] Store in `submarket_demographics` table

### Week 7: Analysis Integration
- [ ] Connect Signal Processing Engine to real data
- [ ] Connect Carrying Capacity Engine
- [ ] Run Imbalance Detector on real submarkets
- [ ] Validate verdicts against market reality

### Week 8: API Layer
- [ ] Build FastAPI endpoints
- [ ] Document API with Swagger
- [ ] Create Phase 1 ↔ Phase 2 integration
- [ ] Test end-to-end: Parcel → Capacity → Market Fit

---

## Success Metrics

### Data Quality
- [ ] 90%+ property geocoding success rate
- [ ] <5% missing rent observations
- [ ] <2% duplicate properties
- [ ] Daily data freshness (scrapers → DB within 24h)

### Analysis Accuracy
- [ ] Rent trend predictions within ±5% of actual
- [ ] Supply-demand verdicts match developer intuition 80%+
- [ ] Absorption rate estimates within ±20%

### Performance
- [ ] Submarket analysis completes in <5 seconds
- [ ] Full Atlanta market analysis in <60 seconds
- [ ] API response time <500ms (p95)

---

## Risk Mitigation

### Risk 1: Scraper Data Quality
**Mitigation:**
- Cross-validate with multiple sources (apartments.com + CoStar)
- Flag outliers for manual review
- Use median instead of mean (robust to bad data)

### Risk 2: CoStar API Access Delays
**Mitigation:**
- Start with scraper data only (we can function without CoStar)
- Manual data entry for critical pipeline projects
- Parallel path: web scraping CoStar publicly available data

### Risk 3: Geocoding Accuracy
**Mitigation:**
- Use multiple geocoding services (Google, Nominatim, Mapbox)
- Manual review for properties that don't match parcels
- Build address normalization layer

---

## Next Steps (Immediate)

1. **Leon Input Required:**
   - How to access OppGrid scraper data?
   - CoStar credentials available?
   - Priority submarkets for initial testing?

2. **Technical Prep:**
   - Extend database schema (properties, rent_observations tables)
   - Build geocoding module
   - Create scraper adapter framework

3. **Data Collection:**
   - Start accumulating rent observations (need 12 weeks for trends)
   - Import existing scraper history if available
   - Identify 5-10 test properties for validation

---

**Last Updated:** 2026-02-03  
**Status:** Architecture design complete, awaiting Phase 1A completion + Leon's scraper details  
**Next Review:** After Phase 1A pipeline runs successfully
