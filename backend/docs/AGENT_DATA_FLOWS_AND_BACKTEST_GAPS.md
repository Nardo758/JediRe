# Agent Data Flows & Backtest Gap Analysis

## Agent → Data Matrix

Each agent consumes specific data layers to perform its function. Here's what each agent needs access to:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        AGENT → DATA MATRIX                                              │
├─────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────────────┤
│     AGENT       │Property │  Rent   │  Sales  │ Traffic │  Macro  │  News   │ Archive │   PROXIMITY     │
│                 │  Info   │  Data   │  Comps  │Occupancy│  Econ   │ Signals │Benchmark│     DATA        │
├─────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────────────┤
│ JEDI (Router)   │    ○    │    ○    │    ○    │    ○    │    ○    │    ○    │    ○    │       ○         │
│ Strategy        │    ●    │    ●    │    ●    │    ●    │    ●    │    ●    │    ●    │       ●         │
│ CFO             │    ●    │    ●    │    ◐    │    ○    │    ●    │    ○    │    ●    │       ○         │
│ Acquisitions    │    ●    │    ●    │    ●    │    ●    │    ●    │    ●    │    ●    │       ●         │
│ Asset Manager   │    ●    │    ●    │    ○    │    ●    │    ○    │    ○    │    ●    │       ◐         │
│ Research        │    ●    │    ●    │    ●    │    ●    │    ●    │    ●    │    ●    │       ●         │
│ Revenue Mgmt    │    ○    │    ●    │    ○    │    ●    │    ○    │    ○    │    ●    │       ●         │
│ Construction    │    ●    │    ○    │    ○    │    ○    │    ●    │    ○    │    ○    │       ●         │
│ Zoning          │    ●    │    ○    │    ○    │    ○    │    ○    │    ●    │    ○    │       ●         │
│ Legal           │    ◐    │    ○    │    ●    │    ○    │    ○    │    ●    │    ○    │       ○         │
│ Tax Advisor     │    ●    │    ○    │    ●    │    ○    │    ●    │    ○    │    ●    │       ○         │
│ Lender          │    ●    │    ●    │    ●    │    ●    │    ●    │    ○    │    ●    │       ◐         │
│ Compliance      │    ●    │    ○    │    ○    │    ○    │    ○    │    ●    │    ○    │       ○         │
│ ESG             │    ●    │    ○    │    ○    │    ○    │    ●    │    ●    │    ○    │       ●         │
│ IR (Investor)   │    ◐    │    ●    │    ○    │    ●    │    ●    │    ●    │    ●    │       ○         │
│ Leasing         │    ○    │    ●    │    ○    │    ●    │    ○    │    ○    │    ●    │       ●         │
└─────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────────────┘

● = Critical dependency   ◐ = Important   ○ = Helpful/Optional
```

---

## PROXIMITY DATA: The Missing Layer

### What's Missing

Your correlation engine has **time-series metrics** but lacks **spatial context**. Properties near key amenities perform differently.

| Proximity Factor | Impact on Deal | Lead Time |
|------------------|----------------|-----------|
| **Grocery (Whole Foods, Trader Joe's)** | +$50-150/unit rent premium | 6-12 mo before opening |
| **Transit (MARTA, BeltLine)** | +5-15% value; lower parking need | 2-5 years (planned routes) |
| **Employers (HQ, campuses)** | Demand driver, cycle risk | 6-18 mo (expansion announcements) |
| **Schools (A-rated)** | Family demographic, lower turnover | Stable |
| **New Development (competitor supply)** | -3-8% occupancy during lease-up | 18-24 mo (permit to delivery) |
| **Crime Hotspots** | -10-20% rent; higher turnover | Real-time |
| **Retail Corridors (Ponce, Buckhead)** | Walk score, lifestyle premium | Stable |
| **Parks / Greenspace** | Quality of life premium | Stable |
| **Hospital / Medical** | Healthcare worker demand | Stable |
| **Universities** | Student/young professional demand | Stable |

### Data Sources for Proximity

| Factor | Data Source | Update Frequency |
|--------|-------------|------------------|
| Grocery | OpenStreetMap, Google Places API | Monthly |
| Transit | MARTA GTFS, ARC transit plans | Quarterly |
| Employers | LinkedIn, SEC filings, news | Monthly |
| Schools | GA DOE ratings | Annually |
| Development | Building permits (we have this!) | Real-time |
| Crime | Atlanta PD open data | Weekly |
| Retail | Walk Score API, Yelp | Monthly |
| Parks | OpenStreetMap | Annually |

---

## Correlation Engine Gaps

### Current COR Metrics (20 correlations)

The engine computes COR-01 through COR-20, including:
- COR-01: Vacancy vs. Rent Growth
- COR-04: Income-to-Rent Ratio
- COR-06: Supply Pressure
- COR-13: Affordability Ceiling

### Missing Correlations for Backtesting

| ID | Correlation | Why It Matters |
|----|-------------|----------------|
| **COR-21** | Permit volume → Rent growth (18mo lag) | Predict supply pressure |
| **COR-22** | Job growth → Absorption (6mo lag) | Demand driver |
| **COR-23** | Transit proximity → Rent premium | Spatial value |
| **COR-24** | Crime rate change → Occupancy | Risk signal |
| **COR-25** | New grocery opening → Rent growth | Amenity catalyst |
| **COR-26** | Employer HQ move → Submarket absorption | Demand shock |
| **COR-27** | Interest rate → Cap rate (3mo lag) | Valuation driver |
| **COR-28** | Historical sale price/SF → Current asking | Market clearing |
| **COR-29** | Concession rate → Future vacancy | Leading indicator |
| **COR-30** | Renovation permits → Rent growth | Value-add signal |

### Historical Events Missing

The correlation engine needs **event anchors** to explain past market moves:

```sql
-- New table: market_events
CREATE TABLE market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identity
  event_type TEXT NOT NULL, -- 'employer_move', 'transit_opening', 'supply_delivery', 'economic_shock'
  event_name TEXT NOT NULL,
  event_description TEXT,
  
  -- Location
  geography_type TEXT NOT NULL, -- 'msa', 'submarket', 'zip', 'property'
  geography_id TEXT NOT NULL,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  radius_miles DECIMAL(5, 2), -- Impact radius
  
  -- Timing
  announced_date DATE,
  effective_date DATE NOT NULL,
  
  -- Impact
  expected_impact_direction TEXT, -- 'positive', 'negative', 'neutral'
  expected_impact_magnitude TEXT, -- 'minor', 'moderate', 'major'
  actual_impact_notes TEXT,
  
  -- Metrics affected
  affected_metrics TEXT[], -- ['rent_growth', 'occupancy', 'cap_rate']
  
  -- Source
  source_url TEXT,
  source_type TEXT, -- 'news', 'sec_filing', 'government', 'manual'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Example events to seed for Atlanta
INSERT INTO market_events (event_type, event_name, geography_type, geography_id, effective_date, expected_impact_direction, affected_metrics) VALUES
('employer_move', 'Microsoft Midtown Campus Announcement', 'submarket', 'midtown', '2021-08-01', 'positive', ARRAY['rent_growth', 'occupancy', 'absorption']),
('transit_opening', 'BeltLine Westside Trail Opening', 'submarket', 'west_end', '2017-09-01', 'positive', ARRAY['rent_growth', 'property_values']),
('supply_delivery', 'Alexan Buckhead Village (350 units)', 'submarket', 'buckhead', '2023-06-01', 'negative', ARRAY['occupancy', 'concessions']),
('economic_shock', 'COVID-19 Lockdown', 'msa', 'atlanta', '2020-03-15', 'negative', ARRAY['rent_growth', 'occupancy', 'collections']),
('employer_move', 'NCR HQ Relocation to Midtown', 'submarket', 'midtown', '2019-01-01', 'positive', ARRAY['absorption', 'rent_growth']),
('grocery_opening', 'Whole Foods Ponce City Market', 'zip', '30308', '2014-09-01', 'positive', ARRAY['rent_growth', 'property_values']);
```

---

## Agent-Specific Data Requirements

### 1. STRATEGY Agent

**Current Data**:
- Deal assumptions, market comps, JEDI score

**Missing**:
```typescript
interface StrategyContext {
  // Proximity analysis
  nearbyAmenities: {
    groceryStores: Array<{ name: string; distance: number; quality: string }>;
    transitStops: Array<{ type: string; distance: number; ridership: number }>;
    majorEmployers: Array<{ name: string; distance: number; employees: number }>;
  };
  
  // Event timeline
  upcomingEvents: Array<{
    type: string;
    name: string;
    date: Date;
    distance: number;
    expectedImpact: 'positive' | 'negative' | 'neutral';
  }>;
  
  // Backtest context
  similarDealsPerformance: Array<{
    dealId: string;
    projectedIRR: number;
    actualIRR: number;
    keyFactors: string[];
  }>;
}
```

### 2. ACQUISITIONS Agent

**Current Data**:
- Property info, financials, market data

**Missing**:
```typescript
interface AcquisitionsContext {
  // Supply pipeline
  competingDevelopments: Array<{
    name: string;
    units: number;
    expectedDelivery: Date;
    distance: number;
  }>;
  
  // Historical pricing
  submarketPriceTrends: {
    pricePerUnit: Array<{ quarter: string; value: number }>;
    pricePerSF: Array<{ quarter: string; value: number }>;
    capRates: Array<{ quarter: string; value: number }>;
  };
  
  // Comparable sales with outcomes
  recentSalesWithPerformance: Array<{
    propertyName: string;
    saleDate: Date;
    salePrice: number;
    pricePerUnit: number;
    subsequentPerformance?: {
      rentGrowth1Y: number;
      occupancyChange: number;
    };
  }>;
}
```

### 3. REVENUE MANAGEMENT Agent

**Current Data**:
- Rent data, traffic, occupancy

**Missing**:
```typescript
interface RevenueMgmtContext {
  // Comp set with real-time pricing
  compSetPricing: Array<{
    propertyId: string;
    propertyName: string;
    distance: number;
    unitMix: Array<{
      beds: number;
      currentRent: number;
      rentChange30d: number;
      availability: number;
    }>;
    concessions: string;
    occupancy: number;
  }>;
  
  // Demand signals
  demandIndicators: {
    searchVolume: number; // Apartments.com searches
    applicationVolume: number;
    tourRequests: number;
    avgDaysToLease: number;
  };
  
  // Seasonality factors
  seasonalityModel: {
    currentMonth: string;
    expectedDemandIndex: number; // 1.0 = average
    historicalRentChangeThisMonth: number;
  };
}
```

### 4. RESEARCH Agent

**Current Data**:
- Market metrics, news, trends

**Missing**:
```typescript
interface ResearchContext {
  // Full event timeline
  marketEventTimeline: Array<{
    date: Date;
    eventType: string;
    eventName: string;
    impactRadius: number;
    observedImpact?: {
      rentChange: number;
      occupancyChange: number;
      capRateChange: number;
    };
  }>;
  
  // Correlation insights
  leadingIndicators: Array<{
    indicatorMetric: string;
    outcomeMetric: string;
    correlationR: number;
    leadMonths: number;
    currentSignal: 'bullish' | 'bearish' | 'neutral';
  }>;
  
  // Geographic context
  submarketProximityScores: {
    transitAccessibility: number;
    employmentAccess: number;
    retailDensity: number;
    schoolQuality: number;
    crimeIndex: number;
  };
}
```

---

## Backtest Framework

### What We Need to Validate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKTEST FRAMEWORK                                │
└─────────────────────────────────────────────────────────────────────────────┘

                    INPUTS                         OUTPUTS
              ┌─────────────┐                 ┌─────────────┐
              │ Historical  │                 │  Predicted  │
              │   State     │───▶ MODEL ───▶  │   Outcome   │
              │ (T-n)       │                 │   (T-0)     │
              └─────────────┘                 └─────────────┘
                     │                              │
                     │                              │
                     ▼                              ▼
              ┌─────────────┐                 ┌─────────────┐
              │  Actual     │                 │   Actual    │
              │  State      │                 │   Outcome   │
              │  (T-n)      │ ◄─ COMPARE ─▶   │   (T-0)     │
              └─────────────┘                 └─────────────┘
```

### Backtest Dimensions

| Dimension | Question | Data Needed |
|-----------|----------|-------------|
| **Rent Growth** | Given conditions at T-12, what rent growth occurred? | Historical rent rolls, market rents |
| **Occupancy** | Given new supply, what happened to occupancy? | Permit data, absorption rates |
| **Cap Rates** | Given rate environment, how did caps move? | Historical sales, Fed funds |
| **IRR Accuracy** | How close were projected returns to actual? | Archive deals with actuals |
| **Event Impact** | How much did specific events move metrics? | Event database + time series |

### Backtest Data Requirements

```sql
-- 1. Historical Snapshots (we need to capture state at each point)
CREATE TABLE market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  geography_type TEXT NOT NULL,
  geography_id TEXT NOT NULL,
  
  -- Market state
  avg_rent DECIMAL(10, 2),
  avg_occupancy DECIMAL(5, 2),
  total_units INT,
  available_units INT,
  avg_concession_pct DECIMAL(5, 2),
  avg_days_on_market INT,
  
  -- Supply state
  units_under_construction INT,
  units_permitted_12mo INT,
  units_delivered_12mo INT,
  
  -- Demand state
  job_growth_12mo DECIMAL(5, 2),
  population_growth_12mo DECIMAL(5, 2),
  
  -- Pricing state
  avg_price_per_unit DECIMAL(12, 2),
  avg_cap_rate DECIMAL(5, 2),
  
  -- Proximity scores (aggregated for geography)
  avg_transit_score DECIMAL(5, 2),
  avg_walk_score DECIMAL(5, 2),
  major_employer_count INT,
  grocery_store_count INT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(snapshot_date, geography_type, geography_id)
);

-- 2. Event Outcomes (track what actually happened after events)
CREATE TABLE event_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES market_events(id),
  
  -- Observed impact
  measurement_period TEXT, -- '3mo', '6mo', '12mo'
  measurement_date DATE,
  
  -- Impact metrics
  rent_change_pct DECIMAL(5, 2),
  occupancy_change_pct DECIMAL(5, 2),
  cap_rate_change_bps INT,
  absorption_units INT,
  
  -- Attribution confidence
  attribution_confidence DECIMAL(3, 2), -- 0.0 to 1.0
  confounding_factors TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Property Proximity Cache
CREATE TABLE property_proximity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID, -- or parcel_id
  parcel_id TEXT,
  county TEXT,
  state TEXT,
  
  -- Computed distances
  nearest_marta_station_miles DECIMAL(5, 2),
  nearest_marta_station_name TEXT,
  nearest_grocery_miles DECIMAL(5, 2),
  nearest_grocery_name TEXT,
  nearest_hospital_miles DECIMAL(5, 2),
  major_employers_within_5mi INT,
  
  -- Scores
  walk_score INT,
  transit_score INT,
  bike_score INT,
  
  -- School district
  elementary_school_rating INT, -- 1-10
  middle_school_rating INT,
  high_school_rating INT,
  
  -- Crime
  crime_index DECIMAL(5, 2), -- relative to city average
  violent_crime_index DECIMAL(5, 2),
  
  -- Computed at
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(parcel_id, county, state)
);
```

---

## Implementation Roadmap

### Phase 1: Proximity Data (Week 1)

1. **Create `property_proximity` table**
2. **Build proximity computation service**:
```typescript
// services/proximity/proximity-computation.service.ts
async computeProximityScores(parcelId: string, lat: number, lng: number) {
  const [transit, grocery, employers, schools, crime] = await Promise.all([
    this.findNearestTransit(lat, lng),
    this.findNearestGrocery(lat, lng),
    this.findNearbyEmployers(lat, lng, 5), // 5 mile radius
    this.getSchoolRatings(lat, lng),
    this.getCrimeIndex(lat, lng)
  ]);
  
  return { transit, grocery, employers, schools, crime };
}
```

3. **Data sources to integrate**:
   - MARTA GTFS feed: https://www.itsmarta.com/app-developer-resources.aspx
   - OpenStreetMap Overpass API for grocery/retail
   - Walk Score API (paid)
   - Atlanta Police open data

### Phase 2: Event Database (Week 2)

1. **Create `market_events` table**
2. **Seed historical events for Atlanta** (2015-present):
   - Major employer moves (Microsoft, NCR, Honeywell, Anthem)
   - BeltLine segment openings
   - MARTA expansions
   - Large supply deliveries (500+ unit projects)
   - COVID impact window

3. **Build event ingestion from news**:
```typescript
// In newsletter-parser or news.service
async extractMarketEvents(article: NewsArticle): Promise<MarketEvent[]> {
  const prompt = `Extract real estate market events from this article:
  - Employer relocations/expansions
  - New development announcements
  - Transit/infrastructure openings
  - Major retail openings
  Return structured JSON with: eventType, name, location, date, expectedImpact`;
  
  return this.llm.extract(article.content, prompt);
}
```

### Phase 3: Backtest Infrastructure (Week 3)

1. **Create `market_snapshots` table**
2. **Build snapshot capture job** (runs monthly):
```typescript
// services/backtest/snapshot-capture.service.ts
async captureMonthlySnapshots() {
  const submarkets = await this.getSubmarkets('atlanta');
  
  for (const submarket of submarkets) {
    const state = await this.aggregateMarketState(submarket);
    await this.saveSnapshot(submarket, state);
  }
}
```

3. **Wire to correlation engine**:
```typescript
// Extend correlationEngine.service.ts
async computeEventCorrelations(eventId: string) {
  const event = await this.getEvent(eventId);
  const beforeSnapshot = await this.getSnapshot(event.geography_id, event.effective_date, -12);
  const afterSnapshot = await this.getSnapshot(event.geography_id, event.effective_date, +12);
  
  // Compute impact
  const rentImpact = afterSnapshot.avg_rent - beforeSnapshot.avg_rent;
  const occupancyImpact = afterSnapshot.avg_occupancy - beforeSnapshot.avg_occupancy;
  
  // Store outcome
  await this.saveEventOutcome(eventId, { rentImpact, occupancyImpact });
}
```

### Phase 4: Agent Wiring (Week 4)

Wire each agent to consume the new data:

```typescript
// In agent tools
const fetch_proximity_context = {
  name: 'fetch_proximity_context',
  description: 'Get proximity scores for a property (transit, grocery, employers, schools, crime)',
  parameters: { parcelId: 'string', lat: 'number', lng: 'number' },
  execute: async (params) => {
    return proximityService.getProximityScores(params.parcelId);
  }
};

const fetch_market_events = {
  name: 'fetch_market_events',
  description: 'Get upcoming and recent market events that may impact a property',
  parameters: { lat: 'number', lng: 'number', radiusMiles: 'number' },
  execute: async (params) => {
    return eventService.getEventsNearLocation(params.lat, params.lng, params.radiusMiles);
  }
};

const fetch_backtest_context = {
  name: 'fetch_backtest_context',
  description: 'Get historical performance of similar deals for validation',
  parameters: { dealType: 'string', submarket: 'string', vintage: 'number' },
  execute: async (params) => {
    return backtestService.getSimilarDealOutcomes(params);
  }
};
```

---

## Summary: The Complete Picture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FULLY CONNECTED PLATFORM                             │
└─────────────────────────────────────────────────────────────────────────────┘

              ┌─────────────────────────────────────────────┐
              │                 DECISIONS                    │
              │  "Buy at $42M, expect 16% IRR, key risk:    │
              │   800 units delivering in 18mo at 0.3mi"    │
              └─────────────────────┬───────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
  ┌─────▼─────┐             ┌───────▼───────┐           ┌───────▼───────┐
  │  AGENTS   │             │   SYNTHESIS   │           │   BACKTEST    │
  │           │             │               │           │   VALIDATION  │
  │ Strategy  │◄───────────►│ Proforma      │◄─────────►│ "Similar      │
  │ CFO       │             │ Risk Score    │           │  deals avg    │
  │ Acquis.   │             │ JEDI Score    │           │  14.2% IRR"   │
  │ Research  │             │               │           │               │
  └─────┬─────┘             └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
  ┌─────────────────────────────────┼─────────────────────────────────────┐
  │                                 │                                     │
┌─▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│PROP │ │ RENT  │ │SALES  │ │SUPPLY │ │EVENTS │ │PROX-  │ │ MACRO │ │ARCHIVE│
│INFO │ │ DATA  │ │COMPS  │ │PIPE   │ │       │ │IMITY  │ │       │ │       │
│     │ │       │ │       │ │       │ │       │ │       │ │       │ │       │
│Year │ │$1,450 │ │$125K  │ │800    │ │MSFT   │ │MARTA: │ │Jobs:  │ │Sim.   │
│2005 │ │Occ:   │ │/unit  │ │units  │ │Campus │ │0.4mi  │ │+2.1%  │ │deals: │
│240u │ │94%    │ │       │ │18mo   │ │2026   │ │WF:    │ │       │ │14.2%  │
│     │ │       │ │       │ │       │ │       │ │0.2mi  │ │       │ │IRR    │
└─────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘
  │         │         │         │         │         │         │         │
  │         │         │         │         │         │         │         │
  ▼         ▼         ▼         ▼         ▼         ▼         ▼         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORRELATION ENGINE                                │
│                                                                             │
│  COR-21: Permits → Rent (r=0.72, lag=18mo)     NEW                         │
│  COR-22: Jobs → Absorption (r=0.81, lag=6mo)   NEW                         │
│  COR-23: Transit proximity → Rent premium      NEW                         │
│  COR-24: Crime change → Occupancy              NEW                         │
│  COR-25: Grocery opening → Rent growth         NEW                         │
│  COR-26: Employer HQ → Submarket absorption    NEW                         │
│  ...                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

Every input flows through correlations → synthesis → agents → decisions. And every decision can be backtested against history.
