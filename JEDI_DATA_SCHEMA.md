# JEDI RE - Complete Data Schema
**Version:** 2.0  
**Date:** 2026-02-05  
**Purpose:** Unified data structure supporting all 8 method engines + JEDI Score

---

## 🎯 Design Principles

1. **Progressive Disclosure** - Simple input → Complex analysis
2. **Engine-Agnostic** - One schema works for all 8 engines
3. **Extensible** - Easy to add new data sources/signals
4. **Real-World Ready** - Handles CoStar, scrapers, Census, etc.
5. **Time-Aware** - Supports both snapshot and timeseries data

---

## 📊 Core Data Models

### 1. Submarket (Geographic Unit)

The fundamental unit of analysis in JEDI RE.

```typescript
interface Submarket {
  // Identity
  id: string;                      // UUID
  name: string;                    // "Buckhead", "Central Midtown"
  city: string;                    // "Atlanta"
  state: string;                   // "GA"
  
  // Geography
  geometry?: GeoJSON;              // Boundary polygon
  center_lat?: number;
  center_lng?: number;
  zip_codes?: string[];
  
  // Metadata
  data_sources: string[];          // ["costar", "census", "scraper"]
  last_updated: timestamp;
  data_quality_score: number;      // 0-1 confidence in data
}
```

---

### 2. MarketSnapshot (Point-in-Time State)

Current state of a submarket.

```typescript
interface MarketSnapshot {
  // Identity
  submarket_id: string;
  snapshot_date: timestamp;
  
  // Supply Metrics
  existing_units: number;
  pipeline_units: number;          // Under construction
  permitted_units: number;         // Approved but not started
  total_supply: number;            // Sum of above
  
  // Demand Metrics
  population: number;
  population_growth_rate: number;  // Annual % (e.g. 0.021 = 2.1%)
  net_migration_annual: number;    // Net people moving in
  employment: number;
  employment_growth_rate: number;
  median_income: number;
  
  // Market Performance
  avg_rent: RentByUnitType;       // See below
  vacancy_rate: number;            // 0-1 (e.g. 0.05 = 5%)
  absorption_rate: number;         // Units/month
  concessions_pct: number;         // 0-1 (e.g. 0.03 = 3%)
  
  // Quality Indicators
  building_class_mix: {            // % of inventory
    A: number;
    B: number;
    C: number;
  };
  avg_building_age: number;        // Years
  amenity_score: number;           // 0-10 composite
  
  // Data Provenance
  data_sources: DataSource[];      // See below
  confidence: number;              // 0-1 overall data quality
}
```

---

### 3. MarketTimeseries (Historical Trends)

Historical data for signal processing.

```typescript
interface MarketTimeseries {
  submarket_id: string;
  observations: TimeseriesObservation[];
}

interface TimeseriesObservation {
  timestamp: timestamp;            // ISO 8601
  
  // Rent Metrics (primary signal)
  avg_rent: RentByUnitType;
  rent_growth_qoq: number;         // Quarter-over-quarter
  rent_growth_yoy: number;         // Year-over-year
  
  // Supply/Demand
  inventory_units: number;
  vacancy_rate: number;
  absorption_units: number;        // Units absorbed this period
  deliveries_units: number;        // New units delivered
  under_construction_units: number;
  
  // Economic Context
  employment?: number;
  median_income?: number;
  search_interest?: number;        // Google Trends index
}
```

---

### 4. PropertyInventory (Building-Level Data)

Individual properties in a submarket (from scrapers/CoStar).

```typescript
interface Property {
  // Identity
  id: string;
  name: string;
  address: string;
  submarket_id: string;
  
  // Physical
  units: number;
  year_built: number;
  year_renovated?: number;
  building_class: 'A' | 'B' | 'C';
  stories: number;
  
  // Market Performance
  current_rent: RentByUnitType;
  occupancy_rate: number;
  concessions?: string;            // "1 month free", "$500 off"
  
  // Amenities
  amenities: string[];             // ["pool", "gym", "parking"]
  unit_mix: UnitMix;               // See below
  
  // Ownership
  owner_name?: string;
  owner_type?: 'institutional' | 'private' | 'reit';
  last_sale_date?: timestamp;
  last_sale_price?: number;
  
  // Data
  data_source: 'costar' | 'scraper' | 'manual';
  last_scraped: timestamp;
}
```

---

### 5. DevelopmentPipeline (Future Supply)

Projects under construction or permitted.

```typescript
interface PipelineProject {
  id: string;
  name: string;
  address: string;
  submarket_id: string;
  
  // Project Details
  units: number;
  status: 'permitted' | 'under_construction' | 'delivered';
  estimated_delivery: timestamp;
  actual_delivery?: timestamp;
  
  // Financial
  estimated_cost?: number;
  developer_name?: string;
  
  // Physical
  building_class: 'A' | 'B' | 'C';
  unit_mix?: UnitMix;
  
  // Data
  data_source: 'costar' | 'permit_data' | 'news' | 'manual';
  confidence: number;              // 0-1 likelihood of completion
}
```

---

## 🔧 Supporting Types

### RentByUnitType

```typescript
interface RentByUnitType {
  studio?: number;
  one_bed?: number;
  two_bed?: number;
  three_bed?: number;
  four_bed_plus?: number;
  average: number;                 // Weighted average
}
```

### UnitMix

```typescript
interface UnitMix {
  studio_pct: number;
  one_bed_pct: number;
  two_bed_pct: number;
  three_bed_pct: number;
  four_bed_plus_pct: number;
  // Sum should equal 100
}
```

### DataSource

```typescript
interface DataSource {
  name: string;                    // "costar", "census", "scraper_apartments_com"
  type: 'api' | 'scraper' | 'manual' | 'calculated';
  last_updated: timestamp;
  confidence: number;              // 0-1
  coverage_pct: number;            // % of data from this source
}
```

---

## 🧮 Engine Input/Output Schemas

### Phase 1 Engines

#### Signal Processing Engine

**Input:**
```typescript
interface SignalProcessingInput {
  submarket_id: string;
  timeseries: MarketTimeseries;
  sampling_rate: 'weekly' | 'monthly' | 'quarterly';
}
```

**Output:**
```typescript
interface SignalProcessingOutput {
  submarket_id: string;
  analysis_date: timestamp;
  
  // Processed Signals
  cleaned_trend: number[];         // Kalman-filtered rent trend
  seasonal_component: number[];    // FFT seasonality
  noise_level: number;             // Signal quality metric
  
  // Growth Metrics
  rent_growth_rate: number;        // Annualized %
  momentum: 'accelerating' | 'stable' | 'decelerating';
  confidence: number;              // 0-1
  
  // Demand Classification
  demand_strength: 'strong' | 'moderate' | 'weak';
  demand_score: number;            // 0-100
  
  // Context
  data_points_used: number;
  time_span_months: number;
  last_rent_value: number;
}
```

---

#### Carrying Capacity Engine

**Input:**
```typescript
interface CarryingCapacityInput {
  submarket_id: string;
  snapshot: MarketSnapshot;        // Current state
  pipeline?: DevelopmentPipeline[];
}
```

**Output:**
```typescript
interface CarryingCapacityOutput {
  submarket_id: string;
  analysis_date: timestamp;
  
  // Demand Capacity
  sustainable_demand: number;      // Units submarket can support
  demand_drivers: {
    population_based: number;
    employment_based: number;
    income_based: number;
  };
  annual_demand_growth: number;    // Units/year
  
  // Supply Analysis
  current_supply: number;
  future_supply: number;           // Including pipeline
  total_supply: number;
  
  // Saturation Analysis
  saturation_pct: number;          // >100% = oversupplied
  equilibrium_quarters: number;    // Time to absorb excess
  verdict: 'critically_undersupplied' | 'undersupplied' | 
           'balanced' | 'oversupplied' | 'critically_oversupplied';
  
  // Confidence
  confidence: number;              // 0-1
  limiting_factors: string[];      // What's constraining capacity
  opportunities: string[];         // Favorable conditions
}
```

---

#### Imbalance Detector (Synthesizer)

**Input:**
```typescript
interface ImbalanceDetectorInput {
  submarket_id: string;
  demand_signal: SignalProcessingOutput;
  supply_signal: CarryingCapacityOutput;
  
  // Optional enrichment
  search_trend_change?: number;    // YoY search interest change
  migration_data?: number;         // Annual net migration
}
```

**Output:**
```typescript
interface ImbalanceDetectorOutput {
  submarket_id: string;
  analysis_date: timestamp;
  
  // Master Verdict
  verdict: 'strong_opportunity' | 'moderate_opportunity' | 
           'neutral' | 'caution' | 'avoid';
  composite_score: number;         // 0-100
  confidence: number;              // 0-1
  
  // Component Scores
  demand_score: number;            // 0-100
  supply_score: number;            // 0-100
  momentum_score: number;          // 0-100
  
  // Recommendation
  recommendation: string;          // Natural language summary
  key_factors: KeyFactor[];        // See below
  risks: string[];                 // Downside factors
  opportunities: string[];         // Upside factors
  
  // Investment Guidance
  optimal_action: 'buy' | 'hold' | 'sell' | 'avoid';
  urgency: 'immediate' | 'near_term' | 'long_term';
  confidence_level: 'high' | 'medium' | 'low';
}

interface KeyFactor {
  factor: string;                  // "Strong rent growth"
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;                  // Contribution to score
  value: string;                   // "+6.1% annually"
}
```

---

### Phase 2 Engines (Future)

#### Game Theory Engine

**Input:**
```typescript
interface GameTheoryInput {
  submarket_id: string;
  competitive_properties: Property[];
  target_property?: Property;      // If analyzing specific property
}
```

**Output:**
```typescript
interface GameTheoryOutput {
  submarket_id: string;
  
  // Nash Equilibrium Analysis
  optimal_rent: RentByUnitType;
  optimal_concessions: number;
  competitive_position: 'leader' | 'follower' | 'niche';
  
  // Strategic Recommendations
  pricing_strategy: string;
  differentiation_opportunities: string[];
  competitive_threats: string[];
  
  confidence: number;
}
```

---

#### Network Science Engine

**Input:**
```typescript
interface NetworkScienceInput {
  submarket_id: string;
  ownership_data: Property[];      // Who owns what
  transaction_data?: Transaction[];
}
```

**Output:**
```typescript
interface NetworkScienceOutput {
  submarket_id: string;
  
  // Ownership Graph
  top_owners: OwnerNode[];
  concentration_index: number;     // Herfindahl index
  institutional_share: number;     // % owned by institutions
  
  // Accumulation Patterns
  accumulation_trend: 'buying' | 'holding' | 'selling';
  smart_money_signal: number;      // What institutions are doing
  
  // Strategic Intelligence
  likely_buyers: string[];         // Who might be interested
  partnership_opportunities: string[];
  
  confidence: number;
}
```

---

### Phase 3 Engines (Future)

#### Contagion Model Engine

**Input:**
```typescript
interface ContagionModelInput {
  submarket_id: string;
  timeseries: MarketTimeseries;
  neighboring_submarkets: string[];
}
```

**Output:**
```typescript
interface ContagionModelOutput {
  submarket_id: string;
  
  // Contagion Metrics
  r0_value: number;                // Reproduction number for rent increases
  contagion_direction: 'inbound' | 'outbound' | 'neutral';
  affected_radius_miles: number;
  
  // Predictions
  spread_timeline_months: number;
  peak_impact_date: timestamp;
  final_rent_range: {min: number, max: number};
  
  // Adjacent Effects
  source_submarkets: string[];     // Where contagion is coming from
  destination_submarkets: string[]; // Where it's spreading to
  
  confidence: number;
}
```

---

#### Monte Carlo Engine

**Input:**
```typescript
interface MonteCarloInput {
  submarket_id: string;
  development_scenario: DevelopmentScenario;
  market_conditions: MarketSnapshot;
  historical_volatility: MarketTimeseries;
}
```

**Output:**
```typescript
interface MonteCarloOutput {
  submarket_id: string;
  scenarios_run: number;           // e.g. 10,000
  
  // Probabilistic Outcomes
  irr_distribution: {
    p10: number;                   // 10th percentile IRR
    p25: number;
    p50: number;                   // Median
    p75: number;
    p90: number;                   // 90th percentile IRR
  };
  
  noi_distribution: {/* same structure */};
  exit_value_distribution: {/* same structure */};
  
  // Risk Metrics
  probability_of_loss: number;     // % chance IRR < 0
  tail_risk: number;               // Value at risk (95%)
  sharpe_ratio: number;
  
  // Sensitivity
  key_drivers: string[];           // What moves the needle most
  stress_scenarios: StressScenario[];
  
  confidence: number;
}
```

---

### Phase 4 Engines (Future)

#### Behavioral Economics Engine

**Input:**
```typescript
interface BehavioralInput {
  submarket_id: string;
  user_analysis: any;              // User's assumptions/model
  market_reality: MarketSnapshot;
}
```

**Output:**
```typescript
interface BehavioralOutput {
  submarket_id: string;
  
  // Bias Detection
  detected_biases: Bias[];
  anchoring_alert?: string;
  recency_bias_score: number;
  overconfidence_indicator: number;
  
  // Debiasing Recommendations
  adjustments: string[];
  reality_check: string;
  
  confidence: number;
}

interface Bias {
  type: string;                    // "anchoring", "recency", "confirmation"
  severity: 'high' | 'medium' | 'low';
  explanation: string;
  suggested_correction: string;
}
```

---

#### Capital Flow Engine

**Input:**
```typescript
interface CapitalFlowInput {
  submarket_id: string;
  transaction_data: Transaction[];
  institutional_activity: InstitutionalMove[];
}
```

**Output:**
```typescript
interface CapitalFlowOutput {
  submarket_id: string;
  
  // Flow Dynamics
  capital_velocity: number;        // Transactions/month
  flow_direction: 'inbound' | 'outbound' | 'neutral';
  institutional_interest: 'high' | 'medium' | 'low';
  
  // Pressure Gradients
  price_pressure: 'upward' | 'downward' | 'stable';
  cap_rate_compression: boolean;
  
  // Predictions
  next_12mo_activity: string;
  capital_sources: string[];       // Where money is coming from
  
  confidence: number;
}
```

---

## 🏆 The JEDI Score (Final Synthesis)

The ultimate output - combines all 8 engines.

```typescript
interface JediScore {
  // Identity
  submarket_id: string;
  parcel_id?: string;              // If parcel-specific analysis
  analysis_date: timestamp;
  
  // Master Score
  jedi_score: number;              // 0-100
  jedi_grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  confidence: number;              // 0-1
  
  // Component Signals (Progressive Disclosure Level 1)
  demand_signal: 'strong' | 'moderate' | 'weak';
  supply_signal: 'undersupplied' | 'balanced' | 'oversupplied';
  position_signal: 'advantaged' | 'neutral' | 'disadvantaged';
  momentum_signal: 'accelerating' | 'stable' | 'decelerating';
  timing_signal: 'now' | 'near_term' | 'wait';
  
  // Master Verdict
  verdict: 'strong_buy' | 'buy' | 'hold' | 'caution' | 'avoid';
  
  // Investment Guidance
  recommendation: string;          // Natural language summary
  optimal_actions: string[];
  key_opportunities: string[];
  key_risks: string[];
  
  // Engine Breakdown (Progressive Disclosure Level 2)
  engines: {
    signal_processing: SignalProcessingOutput;
    carrying_capacity: CarryingCapacityOutput;
    imbalance_detector: ImbalanceDetectorOutput;
    game_theory?: GameTheoryOutput;
    network_science?: NetworkScienceOutput;
    contagion_model?: ContagionModelOutput;
    monte_carlo?: MonteCarloOutput;
    behavioral?: BehavioralOutput;
    capital_flow?: CapitalFlowOutput;
  };
  
  // Data Quality
  data_quality_score: number;      // 0-1
  data_sources_used: DataSource[];
  missing_data_impact: 'none' | 'low' | 'medium' | 'high';
  
  // Metadata
  calculation_time_ms: number;
  version: string;                 // JEDI RE version
}
```

---

## 🔗 API Endpoint Design

### Recommended REST API Structure

```
POST /api/v1/analysis/jedi-score
  ├─ Input: { submarket_id, options }
  └─ Output: JediScore (complete)

POST /api/v1/analysis/market-snapshot
  ├─ Input: { submarket_id }
  └─ Output: MarketSnapshot (current state)

POST /api/v1/analysis/signals
  ├─ Input: { submarket_id }
  └─ Output: { demand_signal, supply_signal, imbalance }

GET /api/v1/submarkets
  └─ Output: Submarket[] (list all available)

GET /api/v1/submarkets/:id/timeseries
  └─ Output: MarketTimeseries (historical data)

GET /api/v1/submarkets/:id/properties
  └─ Output: Property[] (inventory)

GET /api/v1/submarkets/:id/pipeline
  └─ Output: PipelineProject[] (future supply)
```

### GraphQL Alternative (Flexible Queries)

```graphql
query AnalyzeSubmarket($id: ID!) {
  submarket(id: $id) {
    name
    snapshot {
      avg_rent { average }
      vacancy_rate
    }
    jediScore {
      score
      verdict
      engines {
        signal_processing { demand_strength }
        carrying_capacity { saturation_pct }
      }
    }
  }
}
```

---

## 📝 Implementation Notes

### Data Flow

1. **Ingestion:** Scrapers/APIs → Raw data storage
2. **Normalization:** Raw → Standardized schemas (above)
3. **Analysis:** Engines consume standardized data
4. **Synthesis:** JEDI Score combines engine outputs
5. **Delivery:** API serves results to UI

### Versioning

- Schema version embedded in all outputs
- Backward compatibility for at least 2 versions
- Breaking changes = major version bump

### Data Freshness

- Timeseries: Updated daily (scrapers run nightly)
- Snapshots: Updated weekly
- Demographics: Updated monthly
- Pipeline: Updated weekly

### Caching Strategy

- Market snapshots: Cache 24h
- JEDI scores: Cache 1h (expensive to calculate)
- Timeseries: Cache 6h
- Property lists: Cache 12h

---

## 🎯 Progressive Disclosure Mapping

### Level 1: Traffic Light (Simple)
```json
{
  "submarket": "Buckhead",
  "verdict": "strong_opportunity",
  "score": 87,
  "color": "green"
}
```

### Level 2: Signal Breakdown (Moderate)
```json
{
  "submarket": "Buckhead",
  "demand": "strong",
  "supply": "undersupplied",
  "momentum": "accelerating",
  "position": "advantaged",
  "timing": "now"
}
```

### Level 3: Engine Details (Advanced)
Full engine outputs with metrics, charts, confidence intervals

### Level 4: Raw Data (Expert)
Complete MarketSnapshot, timeseries data, property-level details

---

**Status:** Schema v2.0 - Ready for Implementation  
**Next:** Update API endpoints to use this schema  
**Timeline:** 1-2 days to refactor existing code
