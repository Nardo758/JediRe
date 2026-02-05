# JEDI RE - Data Sources

**Last Updated:** 2026-02-05  
**Status:** Phase 1 - 3 sources active, 1 ready, 6 planned

---

## 📊 Active Data Sources

### 1. CoStar (Institutional Market Data)

**Status:** ✅ Active  
**Type:** Historical timeseries + Property snapshots  
**Integration:** `parse_costar.py`, `parse_costar_timeseries.py`  
**Update Frequency:** Quarterly (CoStar standard)  
**Cost:** Institutional pricing ($$$$)

**Data Provided:**
- 26 years of rent history (2000-2026, monthly)
- 6 years complete dataset (rent + vacancy + inventory)
- 359 Atlanta properties (building-level)
- 90 submarkets
- 120,432 total units tracked

**Files:**
- Input: Excel files from CoStar exports
- Output: `costar_submarkets.json`, `costar_market_timeseries.json`
- Wrapper: `costar_signal_wrapper.py`

**Engines Using:**
- Signal Processing Engine (26-year trends)
- Carrying Capacity Engine (existing supply)
- Imbalance Detector (vacancy + rent growth)

**Integration Guide:** `backend/data/costar/INTEGRATION_SUMMARY.md`

---

### 2. ApartmentIQ (Real-Time Property Intelligence)

**Status:** ✅ Ready (API pending deployment)  
**Type:** Real-time property data + Consumer intelligence  
**Integration:** `apartmentiq-client.ts`, `data-aggregator.ts`, `apartmentiq_wrapper.py`  
**Update Frequency:** Daily (scraped)  
**Cost:** $0 (internal integration between products)

**Data Provided:**
- Property listings (units, rents, vacancy)
- Negotiation intelligence (opportunity scores, success rates)
- Consumer demand signals (search activity, concessions)
- Market pressure indicators
- Days on market
- Building quality (Class A/B/C)
- Unit mix percentages
- Amenities

**API Endpoints:**
- `GET /api/jedi/market-data?city={city}&submarket={submarket}`
- `GET /api/jedi/trends?submarket={submarket}&period={period}`
- `GET /api/jedi/submarkets?city={city}`

**Engines Using:**
- Signal Processing Engine (weekly trends)
- Carrying Capacity Engine (supply counts)
- Imbalance Detector (opportunity scores + concessions)

**Integration Guide:** `backend/APARTMENTIQ_INTEGRATION.md`

**Unique Value:**
- Real-time vs CoStar's quarterly lag
- Negotiation intelligence (proprietary)
- Consumer demand signals
- Property-level granularity

---

### 3. Parcel Data (Development Capacity)

**Status:** ✅ Active (171K parcels available)  
**Type:** GIS parcels + Zoning rules  
**Integration:** `load_parcels.py`, `zoning-rules/`  
**Update Frequency:** Annually (county records)  
**Cost:** Free (public data)

**Data Provided:**
- 171,000 Fulton County parcels
- Lot size, current zoning, current units
- Zoning rule engine (245 Atlanta codes)
- Development capacity analysis

**Files:**
- Input: GIS shapefiles (parcels + zoning)
- Output: PostgreSQL/PostGIS database
- Engine: `carrying_capacity.py`

**Engines Using:**
- Carrying Capacity Engine (development potential)

**Integration Guide:** `backend/python-services/DEVELOPMENT_CAPACITY.md`

---

## 🔄 Planned Data Sources

### 4. Census Bureau API (Demographics)

**Status:** ❌ Planned (Phase 1, Week 5)  
**Type:** Demographics + Economic indicators  
**Update Frequency:** Annually (with monthly estimates)  
**Cost:** Free (public API)

**Data Needed:**
- Population trends (by submarket)
- Median income
- Employment statistics
- Net migration
- Household formation

**API:** https://api.census.gov/data/  
**Implementation:** `backend/data/census/census_api_client.py`

**Engines Using:**
- Signal Processing Engine (demand signals)
- Imbalance Detector (demographic pressure)

---

### 5. Google Trends (Search Demand)

**Status:** ❌ Planned (Phase 1, Week 6)  
**Type:** Search interest by location  
**Update Frequency:** Daily  
**Cost:** Free (via pytrends library)

**Data Needed:**
- Search volume for "{city} apartments"
- Search volume for "{neighborhood} rent"
- Trending related queries
- Geographic interest over time

**Implementation:** `backend/data/trends/google_trends_tracker.py`

**Engines Using:**
- Signal Processing Engine (demand indicators)
- Imbalance Detector (consumer interest)

---

### 6. Zillow API / Scraper (Comparable Rents)

**Status:** ❌ Planned (Phase 1, Week 7)  
**Type:** Rental listings + Zestimate data  
**Update Frequency:** Daily  
**Cost:** Free tier (rate limited) or scraping

**Data Needed:**
- Rental listings with asking rents
- Price history
- Days on market
- Zestimate trends

**Implementation:** `backend/data/scrapers/zillow_scraper.py`

**Engines Using:**
- Signal Processing Engine (rent trends)
- Carrying Capacity Engine (supply)

---

### 7. Building Permits (Pipeline Tracking)

**Status:** ❌ Planned (Phase 1, Week 8)  
**Type:** Construction permits  
**Update Frequency:** Weekly  
**Cost:** Free (public records)

**Data Needed:**
- New construction permits
- Estimated unit counts
- Estimated completion dates
- Developer names
- Project locations

**Source:** County/city permit portals  
**Implementation:** `backend/data/permits/permit_scraper.py`

**Engines Using:**
- Carrying Capacity Engine (future supply)
- Imbalance Detector (pipeline pressure)

---

### 8. Transaction Data (Sales Activity)

**Status:** ❌ Planned (Phase 2)  
**Type:** Property sales + ownership  
**Update Frequency:** Monthly  
**Cost:** Free (public records) or paid (faster updates)

**Data Needed:**
- Property sale prices
- Sale dates
- Buyer/seller names
- Ownership changes
- Cap rates (implied)

**Source:** County deed records  
**Implementation:** `backend/data/transactions/transaction_scraper.py`

**Engines Using:**
- Network Science Engine (ownership networks)
- Capital Flow Engine (institutional activity)

---

### 9. News & Social Media (Sentiment)

**Status:** ❌ Planned (Phase 3)  
**Type:** News articles + social sentiment  
**Update Frequency:** Daily  
**Cost:** News API paid, Twitter API varies

**Data Needed:**
- Local news about developments
- Social media sentiment
- Market commentary
- Policy changes
- Economic indicators

**Implementation:** `backend/data/sentiment/news_scraper.py`

**Engines Using:**
- Behavioral Economics Engine (sentiment analysis)
- Contagion Model (narrative spread)

---

## 📈 Data Source Priority Matrix

| Source | Phase | Priority | Cost | Effort | Value |
|--------|-------|----------|------|--------|-------|
| **CoStar** | 1 | ✅ Active | $$$$ | LOW (done) | HIGH |
| **ApartmentIQ** | 1 | ✅ Ready | $0 | LOW (done) | HIGH |
| **Parcels** | 1 | ✅ Active | $0 | LOW (done) | HIGH |
| **Census** | 1 | Week 5 | $0 | MED | MED |
| **Google Trends** | 1 | Week 6 | $0 | LOW | MED |
| **Zillow** | 1 | Week 7 | $0 | MED | MED |
| **Permits** | 1 | Week 8 | $0 | HIGH | HIGH |
| **Transactions** | 2 | Month 4 | $ | HIGH | MED |
| **Sentiment** | 3 | Month 7 | $$ | HIGH | LOW |

---

## 🔀 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   EXTERNAL SOURCES                      │
│  CoStar | ApartmentIQ | Census | Trends | Zillow       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│                  DATA INGESTION LAYER                   │
│  - API Clients (TypeScript)                            │
│  - Scrapers (Python)                                   │
│  - ETL Pipelines                                       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│                   DATA STORAGE                          │
│  - PostgreSQL (structured data)                        │
│  - PostGIS (spatial data)                              │
│  - JSON files (cached snapshots)                       │
│  - TimescaleDB (timeseries)                            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              DATA TRANSFORMATION LAYER                  │
│  - Aggregators (property → submarket)                  │
│  - Normalizers (different formats → JEDI schema)       │
│  - Quality scorers (confidence metrics)                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│                   ANALYSIS ENGINES                      │
│  Phase 1: Signal Processing, Carrying Capacity,        │
│           Imbalance Detector                           │
│  Phase 2: Game Theory, Network Science                 │
│  Phase 3: Contagion, Monte Carlo                       │
│  Phase 4: Behavioral Economics, Capital Flow           │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Data Quality & Governance

### Confidence Scoring

Every data point includes confidence score (0-1):

**Factors:**
- Data freshness (age in days)
- Sample size (number of properties/observations)
- Source reliability (CoStar = 0.95, scraped = 0.70-0.90)
- Completeness (% of fields populated)

**Formula:**
```python
confidence = (
    freshness_score * 0.3 +
    sample_size_score * 0.3 +
    source_reliability * 0.2 +
    completeness_score * 0.2
)
```

### Data Validation

**Automated checks:**
- Range validation (e.g., rent $500-$5000)
- Trend validation (no >50% month-over-month changes)
- Cross-source validation (compare CoStar vs ApartmentIQ)
- Outlier detection (flag suspicious data)

### Data Retention

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Timeseries | 10 years | Historical trends |
| Property snapshots | 2 years | Recent comparables |
| Analysis results | 5 years | Backtesting |
| Raw scraped data | 90 days | Debugging |
| Logs | 30 days | Troubleshooting |

---

## 🔄 Update Schedule

### Daily (Automated)
- ApartmentIQ API fetch (6:00 AM)
- Google Trends update (7:00 AM)
- Zillow scraper (8:00 AM)
- Signal recalculation (9:00 AM)

### Weekly
- Building permits check (Monday 6:00 AM)
- Data quality report (Sunday 8:00 PM)

### Monthly
- Census data refresh (1st of month)
- Transaction data import (5th of month)

### Quarterly
- CoStar data update (when available)
- Full data validation audit

### Annually
- Parcel data refresh (January)
- Zoning rule updates (as needed)

---

## 📊 Monitoring & Alerts

**Data quality alerts:**
- Confidence score drops below 0.70
- Missing data for >24 hours
- Suspicious trends detected
- API rate limits hit
- Scraper failures

**Dashboard metrics:**
- Total properties tracked
- Data freshness (average age)
- Confidence scores by source
- API call volumes
- Storage usage

---

## 🛠️ Adding New Data Sources

**Checklist:**
1. Create adapter/client in `backend/data/{source}/`
2. Update `JEDI_DATA_SCHEMA.md` with new fields
3. Add to this `DATA_SOURCES.md` file
4. Create database migration (if needed)
5. Update relevant engine wrappers
6. Add automated job (if recurring)
7. Document integration guide
8. Add to monitoring dashboard

**Template files:**
- `backend/data/template/source_adapter.py`
- `backend/data/template/api_client.ts`

---

## 📞 Data Source Contacts

**CoStar:**
- Contact: (institutional account)
- Renewal: Annually
- Support: support@costar.com

**ApartmentIQ:**
- Contact: Internal (Leon)
- API Docs: See APARTMENTIQ_INTEGRATION.md
- Status: Beta integration

**Census Bureau:**
- API Key: Not required (public)
- Docs: https://www.census.gov/data/developers.html

---

**Next Review:** 2026-02-12  
**Owner:** Data Engineering Lead
