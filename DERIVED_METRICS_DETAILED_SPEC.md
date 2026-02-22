# Derived Metrics - Complete Technical Specification
**Created:** 2026-02-21 04:36 EST  
**Purpose:** Comprehensive implementation guide for 55 derived metrics

---

## TABLE OF CONTENTS
1. [Architecture Overview](#architecture-overview)
2. [Database Schema (Complete)](#database-schema)
3. [API Specification (All Endpoints)](#api-specification)
4. [Calculation Engine](#calculation-engine)
5. [Data Source Integrations](#data-sources)
6. [Frontend Components](#frontend-components)
7. [UI Integration Points (Detailed)](#ui-integration)
8. [Implementation Phases (Week-by-Week)](#implementation-phases)
9. [Testing Strategy](#testing)
10. [Performance & Caching](#performance)

---

## 1. ARCHITECTURE OVERVIEW

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    JEDI RE FRONTEND                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Overview    │  │  Submarkets  │  │ Intelligence │      │
│  │     Tab      │  │     Tab      │  │     Tab      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │   REST API LAYER        │
              │ /api/v1/intelligence/*  │
              └────────────┬────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │ Metrics │      │  Data   │      │  Cache  │
    │  Engine │◄─────┤ Sources │      │  Layer  │
    └─────────┘      └─────────┘      └─────────┘
         │                 │
         │            ┌────▼────────────────────┐
         │            │  External APIs:         │
         │            │  - BLS Employment       │
         │            │  - Census Migration     │
         │            │  - Google Traffic       │
         │            │  - Freddie Mac          │
         └────────────┤  - Apartments.com       │
                      │  - SpyFu/Web Traffic    │
                      └─────────────────────────┘
```

### Data Flow

1. **Scheduled Jobs** (daily/weekly)
   - Fetch data from external APIs
   - Store raw data in `external_data_sources` table
   - Trigger metric calculations

2. **Calculation Engine**
   - Reads metric definitions from `metric_definitions`
   - Fetches required source data
   - Applies formula
   - Stores result in `derived_metrics`
   - Updates `metric_alerts` if thresholds breached

3. **API Layer**
   - Serves cached metrics
   - Provides real-time calculation option
   - Returns historical trends
   - Aggregates by market/submarket

4. **Frontend**
   - Fetches metrics on page load
   - Displays in cards/tables/charts
   - Updates when new data available
   - Shows alerts for significant changes

---

## 2. DATABASE SCHEMA (COMPLETE)

### Core Tables

```sql
-- ============================================
-- METRIC DEFINITIONS (Static Configuration)
-- ============================================
CREATE TABLE metric_definitions (
  metric_code VARCHAR(10) PRIMARY KEY,
  metric_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  -- Categories: DEMAND_SUPPLY, RENT, TRAFFIC, OPERATIONAL, 
  --             PREDICTIVE, SUPPLY, NEIGHBORHOOD, ARBITRAGE
  
  formula TEXT NOT NULL,
  formula_explanation TEXT,
  
  -- Data sources needed
  source_a VARCHAR(100),
  source_a_field VARCHAR(100),
  source_b VARCHAR(100),
  source_b_field VARCHAR(100),
  source_c VARCHAR(100),
  source_c_field VARCHAR(100),
  
  -- Business logic
  what_it_reveals TEXT NOT NULL,
  signal_strengthens VARCHAR(100),
  
  -- Thresholds (JSON structure)
  threshold_rules JSONB NOT NULL,
  /* Example threshold_rules:
  {
    "type": "range",
    "ranges": [
      { "max": 3.0, "status": "OVERSUPPLIED", "color": "red" },
      { "min": 3.0, "max": 5.0, "status": "BALANCED", "color": "yellow" },
      { "min": 5.0, "max": 8.0, "status": "UNDERSUPPLIED", "color": "orange" },
      { "min": 8.0, "status": "SEVERE_SHORTAGE", "color": "red" }
    ]
  }
  */
  
  -- Metadata
  unit VARCHAR(50), -- e.g., "jobs/unit", "%", "months"
  competitive_moat_level VARCHAR(20), -- HIGH, VERY HIGH, MEDIUM
  mvp_priority VARCHAR(10), -- P0, P1, P2
  implementation_phase INTEGER, -- 1-6
  
  -- Display configuration
  display_format VARCHAR(50), -- e.g., "decimal_1", "percent", "currency"
  chart_type VARCHAR(50), -- e.g., "line", "bar", "gauge"
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metric_defs_category ON metric_definitions(category);
CREATE INDEX idx_metric_defs_phase ON metric_definitions(implementation_phase);
CREATE INDEX idx_metric_defs_priority ON metric_definitions(mvp_priority);


-- ============================================
-- DERIVED METRICS (Calculated Values)
-- ============================================
CREATE TABLE derived_metrics (
  id SERIAL PRIMARY KEY,
  metric_code VARCHAR(10) NOT NULL REFERENCES metric_definitions(metric_code),
  
  -- Scope
  market_id VARCHAR(100) NOT NULL,
  submarket_id VARCHAR(100), -- NULL for market-level metrics
  property_id INTEGER, -- NULL for market/submarket metrics
  
  -- Calculated value
  metric_value DECIMAL(12,4),
  status VARCHAR(50), -- e.g., "UNDERSUPPLIED", "STRONG", "WARNING"
  status_color VARCHAR(20), -- "red", "yellow", "green"
  interpretation TEXT, -- Human-readable interpretation
  
  -- Source data (for transparency & recalculation)
  source_data JSONB NOT NULL,
  /* Example source_data:
  {
    "source_a": { "name": "BLS Employment", "value": 500000, "date": "2026-02" },
    "source_b": { "name": "Property Count", "value": 60975, "date": "2026-02" },
    "calculation": {
      "formula": "500000 / 60975",
      "steps": ["Fetch jobs: 500000", "Fetch units: 60975", "Divide: 8.2"]
    }
  }
  */
  
  -- Timestamps
  calculation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_as_of_date DATE NOT NULL, -- When source data is from
  
  -- Historical comparison
  previous_value DECIMAL(12,4), -- Value from last calculation
  change_amount DECIMAL(12,4), -- Current - Previous
  change_percent DECIMAL(8,2), -- (Current - Previous) / Previous * 100
  
  -- Quality indicators
  confidence_score DECIMAL(3,2), -- 0.0 to 1.0 (data freshness/quality)
  data_quality VARCHAR(20), -- "EXCELLENT", "GOOD", "FAIR", "POOR"
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_derived_metrics_market ON derived_metrics(market_id);
CREATE INDEX idx_derived_metrics_submarket ON derived_metrics(submarket_id);
CREATE INDEX idx_derived_metrics_code ON derived_metrics(metric_code);
CREATE INDEX idx_derived_metrics_date ON derived_metrics(calculation_date DESC);
CREATE INDEX idx_derived_metrics_status ON derived_metrics(status);

-- Composite index for common queries
CREATE INDEX idx_derived_metrics_market_code_date 
  ON derived_metrics(market_id, metric_code, calculation_date DESC);


-- ============================================
-- EXTERNAL DATA SOURCES (Raw Data Cache)
-- ============================================
CREATE TABLE external_data_sources (
  id SERIAL PRIMARY KEY,
  source_name VARCHAR(100) NOT NULL,
  -- e.g., "BLS_EMPLOYMENT", "CENSUS_MIGRATION", "GOOGLE_TRAFFIC"
  
  -- Scope
  market_id VARCHAR(100),
  submarket_id VARCHAR(100),
  
  -- Data
  data_field VARCHAR(100) NOT NULL, -- e.g., "total_nonfarm_employment"
  data_value TEXT NOT NULL, -- Store as text, cast as needed
  data_type VARCHAR(20) NOT NULL, -- "INTEGER", "DECIMAL", "PERCENT", "TEXT"
  
  -- Metadata
  data_date DATE NOT NULL, -- When this data point is for
  fetch_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When we fetched it
  api_response JSONB, -- Full API response for debugging
  
  -- Quality
  is_estimated BOOLEAN DEFAULT false,
  confidence VARCHAR(20), -- "HIGH", "MEDIUM", "LOW"
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(source_name, market_id, submarket_id, data_field, data_date)
);

CREATE INDEX idx_ext_sources_name ON external_data_sources(source_name);
CREATE INDEX idx_ext_sources_market ON external_data_sources(market_id);
CREATE INDEX idx_ext_sources_date ON external_data_sources(data_date DESC);


-- ============================================
-- METRIC ALERTS (Threshold Breaches)
-- ============================================
CREATE TABLE metric_alerts (
  id SERIAL PRIMARY KEY,
  metric_code VARCHAR(10) NOT NULL REFERENCES metric_definitions(metric_code),
  derived_metric_id INTEGER REFERENCES derived_metrics(id),
  
  market_id VARCHAR(100) NOT NULL,
  submarket_id VARCHAR(100),
  
  -- Alert details
  alert_type VARCHAR(50) NOT NULL,
  -- e.g., "THRESHOLD_BREACHED", "RAPID_CHANGE", "DATA_ANOMALY"
  
  severity VARCHAR(20) NOT NULL, -- "LOW", "MEDIUM", "HIGH", "CRITICAL"
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Data
  current_value DECIMAL(12,4),
  previous_value DECIMAL(12,4),
  threshold_value DECIMAL(12,4),
  
  -- Status
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, ACKNOWLEDGED, RESOLVED
  acknowledged_by INTEGER REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_market ON metric_alerts(market_id);
CREATE INDEX idx_alerts_status ON metric_alerts(status);
CREATE INDEX idx_alerts_severity ON metric_alerts(severity);


-- ============================================
-- METRIC CALCULATION LOG (Audit Trail)
-- ============================================
CREATE TABLE metric_calculation_log (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(100) NOT NULL,
  metric_code VARCHAR(10),
  market_id VARCHAR(100),
  
  status VARCHAR(20) NOT NULL, -- SUCCESS, FAILED, SKIPPED
  metrics_calculated INTEGER DEFAULT 0,
  metrics_failed INTEGER DEFAULT 0,
  
  error_message TEXT,
  execution_time_ms INTEGER,
  
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calc_log_job ON metric_calculation_log(job_id);
CREATE INDEX idx_calc_log_status ON metric_calculation_log(status);
CREATE INDEX idx_calc_log_date ON metric_calculation_log(started_at DESC);
```

---

## 3. API SPECIFICATION (ALL ENDPOINTS)

### Base URL
```
/api/v1/intelligence
```

### Authentication
All endpoints require JWT token in Authorization header.

---

### Endpoint 1: Get Market Intelligence Overview
```http
GET /api/v1/intelligence/markets/:marketId

Query Parameters:
  ?categories=DEMAND_SUPPLY,RENT  (optional, comma-separated)
  ?phase=1                        (optional, filter by implementation phase)
  ?priority=P0                    (optional, filter by MVP priority)

Response 200:
{
  "market_id": "atlanta-metro",
  "market_name": "Atlanta Metro",
  "last_updated": "2026-02-21T04:00:00Z",
  "metrics_count": 12,
  "alerts_count": 3,
  
  "summary": {
    "overall_score": 87,
    "demand_supply_status": "UNDERSUPPLIED",
    "rent_momentum": "ACCELERATING",
    "traffic_trend": "GROWING"
  },
  
  "categories": [
    {
      "category": "DEMAND_SUPPLY",
      "metrics": [
        {
          "code": "D×S-1",
          "name": "Jobs-to-Apartments Ratio",
          "value": 8.2,
          "unit": "jobs/unit",
          "status": "SEVERE_SHORTAGE",
          "status_color": "red",
          "interpretation": "Market has 8.2 jobs per apartment unit, indicating severe shortage",
          "change_percent": +3.8,
          "trend": "up",
          "confidence_score": 0.95,
          "last_updated": "2026-02-21",
          "threshold": {
            "current_range": { "min": 8.0, "status": "SEVERE_SHORTAGE" },
            "next_threshold": { "min": 5.0, "status": "UNDERSUPPLIED" }
          }
        },
        // ... more metrics
      ]
    },
    // ... more categories
  ],
  
  "alerts": [
    {
      "id": 123,
      "severity": "HIGH",
      "title": "Jobs-to-Apartments Ratio Exceeded Critical Threshold",
      "message": "Ratio increased from 7.9 to 8.2, crossing into severe shortage territory",
      "metric_code": "D×S-1",
      "created_at": "2026-02-21T03:00:00Z"
    }
  ]
}
```

---

### Endpoint 2: Get Single Metric Detail with History
```http
GET /api/v1/intelligence/markets/:marketId/metrics/:metricCode

Query Parameters:
  ?history_months=12  (optional, default 6)
  ?include_sources=true  (optional, include source data)

Response 200:
{
  "metric": {
    "code": "D×S-1",
    "name": "Jobs-to-Apartments Ratio",
    "category": "DEMAND_SUPPLY",
    "current_value": 8.2,
    "unit": "jobs/unit",
    "status": "SEVERE_SHORTAGE",
    "interpretation": "Market has 8.2 jobs per apartment unit",
    
    "definition": {
      "formula": "Total nonfarm employment ÷ Total apartment units",
      "what_it_reveals": "Measures whether local economy generates enough demand...",
      "competitive_moat": "VERY HIGH"
    },
    
    "threshold_rules": {
      "ranges": [
        { "max": 3.0, "status": "OVERSUPPLIED" },
        { "min": 3.0, "max": 5.0, "status": "BALANCED" },
        { "min": 5.0, "max": 8.0, "status": "UNDERSUPPLIED" },
        { "min": 8.0, "status": "SEVERE_SHORTAGE" }
      ]
    },
    
    "sources": [
      {
        "name": "BLS Employment",
        "value": 500000,
        "date": "2026-02-01",
        "field": "total_nonfarm_employment"
      },
      {
        "name": "Property Count",
        "value": 60975,
        "date": "2026-02-01",
        "field": "total_apartment_units"
      }
    ],
    
    "history": [
      { "date": "2025-09-01", "value": 7.5, "status": "UNDERSUPPLIED" },
      { "date": "2025-10-01", "value": 7.7, "status": "UNDERSUPPLIED" },
      { "date": "2025-11-01", "value": 7.9, "status": "UNDERSUPPLIED" },
      { "date": "2025-12-01", "value": 8.0, "status": "SEVERE_SHORTAGE" },
      { "date": "2026-01-01", "value": 8.1, "status": "SEVERE_SHORTAGE" },
      { "date": "2026-02-01", "value": 8.2, "status": "SEVERE_SHORTAGE" }
    ],
    
    "statistics": {
      "mean": 7.8,
      "median": 7.9,
      "std_dev": 0.25,
      "min": 7.5,
      "max": 8.2,
      "trend": "increasing",
      "change_6mo": +0.7,
      "change_12mo": +1.1
    }
  }
}
```

---

### Endpoint 3: Get Submarket Metrics
```http
GET /api/v1/intelligence/markets/:marketId/submarkets

Query Parameters:
  ?metric_codes=D×S-1,D×S-3,R-1  (optional)

Response 200:
{
  "market_id": "atlanta-metro",
  "submarkets": [
    {
      "submarket_id": "buckhead",
      "submarket_name": "Buckhead",
      "metrics": [
        {
          "code": "D×S-1",
          "name": "Jobs-to-Apartments Ratio",
          "value": 9.2,
          "status": "SEVERE_SHORTAGE",
          "rank": 1  // Highest in market
        },
        {
          "code": "D×S-3",
          "name": "Migration-to-Supply Ratio",
          "value": 5.1,
          "status": "UNDERSUPPLIED",
          "rank": 2
        }
      ],
      "overall_score": 92
    },
    // ... more submarkets
  ],
  
  "ranking": {
    "by_overall_score": ["buckhead", "midtown", "sandy-springs", ...],
    "by_metric": {
      "D×S-1": ["buckhead", "sandy-springs", "midtown", ...]
    }
  }
}
```

---

### Endpoint 4: Calculate Metrics On-Demand
```http
POST /api/v1/intelligence/markets/:marketId/calculate

Body:
{
  "metric_codes": ["D×S-1", "R-6"],  // optional, default: all active
  "force_refresh": true,  // optional, bypass cache
  "submarkets": ["buckhead", "midtown"]  // optional
}

Response 200:
{
  "job_id": "calc_abc123",
  "status": "COMPLETED",
  "metrics_calculated": 8,
  "metrics_failed": 0,
  "execution_time_ms": 2340,
  "results": [
    {
      "metric_code": "D×S-1",
      "market_id": "atlanta-metro",
      "value": 8.2,
      "status": "SUCCESS"
    },
    // ... more results
  ]
}
```

---

### Endpoint 5: Get Metric Alerts
```http
GET /api/v1/intelligence/markets/:marketId/alerts

Query Parameters:
  ?status=ACTIVE  (optional: ACTIVE, ACKNOWLEDGED, RESOLVED)
  ?severity=HIGH,CRITICAL  (optional)
  ?limit=20

Response 200:
{
  "alerts": [
    {
      "id": 123,
      "metric_code": "D×S-1",
      "metric_name": "Jobs-to-Apartments Ratio",
      "alert_type": "THRESHOLD_BREACHED",
      "severity": "HIGH",
      "title": "Critical Threshold Exceeded",
      "message": "Jobs-to-Apartments ratio crossed 8.0 threshold...",
      "current_value": 8.2,
      "threshold_value": 8.0,
      "status": "ACTIVE",
      "created_at": "2026-02-21T03:00:00Z"
    }
  ],
  "summary": {
    "total": 12,
    "by_severity": {
      "CRITICAL": 1,
      "HIGH": 3,
      "MEDIUM": 5,
      "LOW": 3
    }
  }
}
```

---

### Endpoint 6: Acknowledge Alert
```http
POST /api/v1/intelligence/alerts/:alertId/acknowledge

Response 200:
{
  "alert_id": 123,
  "status": "ACKNOWLEDGED",
  "acknowledged_by": "Leon D",
  "acknowledged_at": "2026-02-21T04:30:00Z"
}
```

---

### Endpoint 7: Get Metric Definitions
```http
GET /api/v1/intelligence/definitions

Query Parameters:
  ?phase=1  (optional)
  ?category=DEMAND_SUPPLY  (optional)

Response 200:
{
  "definitions": [
    {
      "code": "D×S-1",
      "name": "Jobs-to-Apartments Ratio",
      "category": "DEMAND_SUPPLY",
      "formula": "Total jobs ÷ Total apartment units",
      "sources": ["BLS Employment", "Property Count"],
      "competitive_moat": "VERY HIGH",
      "mvp_priority": "P0",
      "phase": 1
    },
    // ... more definitions
  ]
}
```

---

### Endpoint 8: Export Market Intelligence Report
```http
GET /api/v1/intelligence/markets/:marketId/export

Query Parameters:
  ?format=pdf  (optional: pdf, excel, json)
  ?categories=DEMAND_SUPPLY,RENT

Response 200:
{
  "download_url": "https://..../reports/atlanta-metro-intelligence-2026-02-21.pdf",
  "expires_at": "2026-02-22T04:30:00Z"
}
```

---

## 4. CALCULATION ENGINE

### Engine Architecture

```typescript
// core/metrics/MetricsEngine.ts

interface MetricCalculation {
  code: string;
  marketId: string;
  submarketId?: string;
  calculate: (sources: SourceData) => Promise<MetricResult>;
}

interface SourceData {
  [key: string]: {
    value: number;
    date: Date;
    confidence: number;
  };
}

interface MetricResult {
  value: number;
  status: string;
  statusColor: string;
  interpretation: string;
  sources: SourceData;
  confidence: number;
}

class MetricsEngine {
  private calculators: Map<string, MetricCalculation>;
  
  constructor() {
    this.calculators = new Map();
    this.registerCalculators();
  }
  
  private registerCalculators() {
    // Phase 1 Metrics
    this.register(new JobsToApartmentsCalculator());
    this.register(new NewJobsPerUnitCalculator());
    this.register(new MigrationToSupplyCalculator());
    this.register(new RentVsWageSpreadCalculator());
    this.register(new RentToMortgageCalculator());
    this.register(new ConcessionDragCalculator());
  }
  
  async calculateMetric(
    code: string, 
    marketId: string,
    submarketId?: string
  ): Promise<MetricResult> {
    const calculator = this.calculators.get(code);
    if (!calculator) {
      throw new Error(`No calculator found for metric: ${code}`);
    }
    
    // Fetch source data
    const sources = await this.fetchSources(calculator, marketId, submarketId);
    
    // Calculate
    const result = await calculator.calculate(sources);
    
    // Store result
    await this.storeResult(code, marketId, submarketId, result);
    
    // Check thresholds & generate alerts
    await this.checkThresholds(code, marketId, result);
    
    return result;
  }
  
  private async fetchSources(
    calculator: MetricCalculation,
    marketId: string,
    submarketId?: string
  ): Promise<SourceData> {
    // Query external_data_sources table
    // Return latest data for each required source
  }
  
  private async storeResult(
    code: string,
    marketId: string,
    submarketId: string | undefined,
    result: MetricResult
  ): Promise<void> {
    // Insert into derived_metrics table
  }
  
  private async checkThresholds(
    code: string,
    marketId: string,
    result: MetricResult
  ): Promise<void> {
    // Fetch threshold rules
    // Check if thresholds breached
    // Create alerts if needed
  }
}
```

### Example Calculator: Jobs-to-Apartments

```typescript
// calculators/JobsToApartmentsCalculator.ts

class JobsToApartmentsCalculator implements MetricCalculation {
  code = 'D×S-1';
  marketId: string;
  
  async calculate(sources: SourceData): Promise<MetricResult> {
    const jobs = sources['BLS_EMPLOYMENT'].value;
    const units = sources['PROPERTY_COUNT'].value;
    
    const ratio = jobs / units;
    
    // Determine status based on thresholds
    let status: string;
    let statusColor: string;
    
    if (ratio < 3.0) {
      status = 'OVERSUPPLIED';
      statusColor = 'red';
    } else if (ratio >= 3.0 && ratio < 5.0) {
      status = 'BALANCED';
      statusColor = 'yellow';
    } else if (ratio >= 5.0 && ratio < 8.0) {
      status = 'UNDERSUPPLIED';
      statusColor = 'orange';
    } else {
      status = 'SEVERE_SHORTAGE';
      statusColor = 'red';
    }
    
    const interpretation = 
      `Market has ${ratio.toFixed(1)} jobs per apartment unit, indicating ${status.toLowerCase()}`;
    
    // Calculate confidence based on data freshness
    const jobsAge = Date.now() - sources['BLS_EMPLOYMENT'].date.getTime();
    const unitsAge = Date.now() - sources['PROPERTY_COUNT'].date.getTime();
    const avgAge = (jobsAge + unitsAge) / 2;
    const confidence = Math.max(0.5, 1.0 - (avgAge / (90 * 24 * 60 * 60 * 1000))); // Decay over 90 days
    
    return {
      value: ratio,
      status,
      statusColor,
      interpretation,
      sources,
      confidence
    };
  }
}
```

---

## 5. DATA SOURCE INTEGRATIONS

### Integration 1: BLS Employment API

**Endpoint:** `https://api.bls.gov/publicAPI/v2/timeseries/data/`

**Series Codes:**
- National: `CES0000000001`
- Metro Areas: `SMS{FIPS_CODE}000000000000001`
  - Atlanta: `SMS13124000000000001`

**Implementation:**
```typescript
// services/BLSService.ts

class BLSService {
  private apiKey = process.env.BLS_API_KEY; // Free, 500 queries/day
  
  async fetchEmployment(marketId: string): Promise<number> {
    const seriesId = this.getSeriesId(marketId);
    
    const response = await fetch(
      `https://api.bls.gov/publicAPI/v2/timeseries/data/${seriesId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesid: [seriesId],
          startyear: '2024',
          endyear: '2026',
          registrationkey: this.apiKey
        })
      }
    );
    
    const data = await response.json();
    const latestValue = data.Results.series[0].data[0].value;
    
    // Store in external_data_sources
    await this.storeData(marketId, 'BLS_EMPLOYMENT', 'total_nonfarm_employment', latestValue);
    
    return parseInt(latestValue);
  }
  
  private getSeriesId(marketId: string): string {
    const seriesMap = {
      'atlanta-metro': 'SMS13124000000000001',
      'austin': 'SMS48120000000000001',
      'tampa': 'SMS12458000000000001'
    };
    return seriesMap[marketId] || seriesMap['atlanta-metro'];
  }
}
```

**Schedule:** Daily at 6 AM EST

---

### Integration 2: Census Migration API

**Endpoint:** `https://api.census.gov/data/2022/acs/acs1`

**Variables:**
- Net Migration: `B07001_001E` (Geographic Mobility)

**Implementation:**
```typescript
// services/CensusService.ts

class CensusService {
  private apiKey = process.env.CENSUS_API_KEY; // Free
  
  async fetchMigration(marketId: string): Promise<number> {
    const fipsCode = this.getFipsCode(marketId);
    
    const response = await fetch(
      `https://api.census.gov/data/2022/acs/acs1?` +
      `get=B07001_001E&for=metropolitan%20statistical%20area:${fipsCode}&key=${this.apiKey}`
    );
    
    const data = await response.json();
    const migration = parseInt(data[1][0]);
    
    await this.storeData(marketId, 'CENSUS_MIGRATION', 'net_migration', migration);
    
    return migration;
  }
}
```

**Schedule:** Weekly on Monday

---

### Integration 3: Google Traffic API

**Endpoint:** `https://maps.googleapis.com/maps/api/directions/json`

**Implementation:**
```typescript
// services/GoogleTrafficService.ts

class GoogleTrafficService {
  private apiKey = process.env.GOOGLE_MAPS_API_KEY; // $200/mo for 10K requests
  
  async fetchTrafficGrowth(marketId: string): Promise<number> {
    // Define key routes in market
    const routes = this.getKeyRoutes(marketId);
    
    let totalGrowth = 0;
    
    for (const route of routes) {
      const currentDuration = await this.getTravelTime(
        route.origin,
        route.destination,
        'now'
      );
      
      const historicalDuration = await this.getDOTHistorical(
        route.roadSegmentId
      );
      
      const growth = ((currentDuration - historicalDuration) / historicalDuration) * 100;
      totalGrowth += growth;
    }
    
    const avgGrowth = totalGrowth / routes.length;
    
    await this.storeData(marketId, 'GOOGLE_TRAFFIC', 'real_time_growth_rate', avgGrowth);
    
    return avgGrowth;
  }
  
  private async getTravelTime(
    origin: string,
    destination: string,
    departureTime: string
  ): Promise<number> {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin}&destination=${destination}&departure_time=${departureTime}&key=${this.apiKey}`
    );
    
    const data = await response.json();
    return data.routes[0].legs[0].duration_in_traffic.value / 60; // minutes
  }
}
```

**Schedule:** Every 4 hours (peak/off-peak tracking)

---

## 6. FRONTEND COMPONENTS

### Component 1: MetricCard

```typescript
// components/intelligence/MetricCard.tsx

interface MetricCardProps {
  metric: {
    code: string;
    name: string;
    value: number;
    unit: string;
    status: string;
    statusColor: string;
    interpretation: string;
    trend?: 'up' | 'down' | 'stable';
    changePercent?: number;
  };
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({ metric, size = 'medium', onClick }) => {
  const getStatusIcon = () => {
    switch (metric.statusColor) {
      case 'red': return '🔥';
      case 'orange': return '⚠️';
      case 'yellow': return '⚖️';
      case 'green': return '✅';
      default: return '📊';
    }
  };
  
  const getTrendIcon = () => {
    if (!metric.trend) return null;
    switch (metric.trend) {
      case 'up': return <TrendingUp size={16} className="trend-up" />;
      case 'down': return <TrendingDown size={16} className="trend-down" />;
      case 'stable': return <Minus size={16} className="trend-stable" />;
    }
  };
  
  return (
    <div className={`metric-card ${size} ${metric.statusColor}`} onClick={onClick}>
      <div className="metric-header">
        <span className="metric-icon">{getStatusIcon()}</span>
        <span className="metric-name">{metric.name}</span>
      </div>
      
      <div className="metric-value-section">
        <span className="metric-value">
          {metric.value.toFixed(1)}
        </span>
        <span className="metric-unit">{metric.unit}</span>
        
        {metric.changePercent && (
          <span className="metric-change">
            {getTrendIcon()}
            {metric.changePercent > 0 ? '+' : ''}
            {metric.changePercent.toFixed(1)}%
          </span>
        )}
      </div>
      
      <div className="metric-status">
        <span className={`status-badge ${metric.statusColor}`}>
          {metric.status.replace(/_/g, ' ')}
        </span>
      </div>
      
      <p className="metric-interpretation">{metric.interpretation}</p>
      
      <style jsx>{`
        .metric-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          border-left: 4px solid;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .metric-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }
        
        .metric-card.red {
          border-left-color: #ef4444;
        }
        
        .metric-card.orange {
          border-left-color: #f59e0b;
        }
        
        .metric-card.yellow {
          border-left-color: #eab308;
        }
        
        .metric-card.green {
          border-left-color: #22c55e;
        }
        
        .metric-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .metric-icon {
          font-size: 24px;
        }
        
        .metric-name {
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
        }
        
        .metric-value-section {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .metric-value {
          font-size: 32px;
          font-weight: 700;
          color: #0f172a;
        }
        
        .metric-unit {
          font-size: 14px;
          color: #94a3b8;
        }
        
        .metric-change {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
          font-weight: 600;
        }
        
        .trend-up {
          color: #22c55e;
        }
        
        .trend-down {
          color: #ef4444;
        }
        
        .metric-status {
          margin-bottom: 12px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .status-badge.red {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .status-badge.orange {
          background: #ffedd5;
          color: #9a3412;
        }
        
        .status-badge.yellow {
          background: #fef3c7;
          color: #92400e;
        }
        
        .status-badge.green {
          background: #dcfce7;
          color: #15803d;
        }
        
        .metric-interpretation {
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
          margin: 0;
        }
      `}</style>
    </div>
  );
};
```

---

### Component 2: IntelligenceSection (for Overview Tab)

```typescript
// components/intelligence/IntelligenceSection.tsx

export const IntelligenceSection: React.FC<{ marketId: string }> = ({ marketId }) => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadMetrics();
  }, [marketId]);
  
  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/v1/intelligence/markets/${marketId}?phase=1&priority=P0`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      const data = await response.json();
      
      // Extract hero metrics
      const heroMetrics = data.categories
        .flatMap(cat => cat.metrics)
        .filter(m => ['D×S-1', 'D×S-3', 'R-1'].includes(m.code));
      
      setMetrics(heroMetrics);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="intelligence-loading">Loading intelligence...</div>;
  }
  
  return (
    <section className="intelligence-section">
      <div className="section-header">
        <h2>🧠 Proprietary Market Intelligence</h2>
        <p>Insights nobody else has - derived from cross-referencing data sources</p>
      </div>
      
      <div className="metrics-grid">
        {metrics.map(metric => (
          <MetricCard 
            key={metric.code}
            metric={metric}
            onClick={() => showMetricDetail(metric.code)}
          />
        ))}
      </div>
      
      <div className="section-footer">
        <button className="view-all-button" onClick={() => navigate(`/markets/${marketId}/intelligence`)}>
          View All Intelligence Metrics →
        </button>
      </div>
      
      <style jsx>{`
        .intelligence-section {
          background: #f8fafc;
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
        }
        
        .section-header {
          margin-bottom: 20px;
        }
        
        .section-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }
        
        .section-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .view-all-button {
          width: 100%;
          padding: 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          color: #3b82f6;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .view-all-button:hover {
          background: #3b82f6;
          color: white;
        }
      `}</style>
    </section>
  );
};
```

---

**Want me to continue with:**
- Component 3-7 (IntelligenceTab, MetricDetailModal, SubmarketMetricsTable, etc.)
- Section 7: Complete UI Integration mockups
- Section 8: Week-by-week implementation plan
- Section 9: Testing strategy
- Section 10: Performance & caching

**Or should I compile this into a complete PDF/document and push it to the repo?** 🚀