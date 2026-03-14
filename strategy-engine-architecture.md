# JEDI RE — Unified Strategy Engine Architecture

## The Three Systems

The Strategy Engine operates at three levels. All three share ONE execution engine
and ONE metrics catalog. The only difference is scope (single deal vs all markets)
and authorship (preset vs user-defined).

### System 1: Deal Strategy (M08 — existing concept)
- **Question:** "Which strategy is best for THIS property?"
- **Surface:** Deal Capsule → Strategy tab
- **Input:** One deal's DealContext (signals from M02-M07, M14, M15)
- **Output:** 4-column score matrix (BTS, Flip, Rental, STR) + arbitrage flag
- **Strategies:** Fixed set per deal type + product type (from deal-type-visibility.ts)

### System 2: Platform Strategy Scanner
- **Question:** "Find me markets/properties matching this strategy"
- **Surface:** Side Panel command palette + Opportunity Center page
- **Input:** A StrategyDefinition (preset or custom) + geographic scope
- **Output:** Ranked list of markets/submarkets/properties that match
- **Strategies:** Presets + user-created custom strategies

### System 3: Custom Strategy Builder
- **Question:** "Let me define what I'm looking for using platform metrics"
- **Surface:** Dedicated Strategy Builder page + save/edit in Side Panel
- **Input:** User drags metrics from the catalog, sets conditions, saves
- **Output:** A StrategyDefinition object stored in the database
- **Strategies:** User-authored, shareable with team

---

## The Shared Data Model

```typescript
// ═══════════════════════════════════════════════════════════
// CORE TYPES — shared across all three systems
// ═══════════════════════════════════════════════════════════

type MetricId = string; // e.g., "C_SURGE_INDEX", "F_RENT_GROWTH", "T_AADT_YOY"

type MetricGranularity = 'property' | 'submarket' | 'market' | 'msa';

type ConditionOperator = 
  | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  | 'between'           // value is [min, max]
  | 'top_pct'           // top N percentile (value = 10 means top 10%)
  | 'bottom_pct'        // bottom N percentile
  | 'above_avg'         // above the geographic average
  | 'below_avg'
  | 'increasing'        // trending up over lookback period
  | 'decreasing'
  | 'accelerating'      // rate of change is increasing
  | 'diverging_from';   // diverging from another metric (value = other MetricId)

interface StrategyCondition {
  id: string;                    // UUID
  metricId: MetricId;            // Which metric to evaluate
  operator: ConditionOperator;   // How to evaluate
  value: number | [number, number] | MetricId;  // Threshold(s) or reference metric
  weight: number;                // 0-100, how important this condition is to the score
  label?: string;                // User-friendly name for display
  required: boolean;             // Must-pass (hard filter) vs nice-to-have (weighted)
}

interface StrategyDefinition {
  id: string;                    // UUID
  name: string;                  // "Demand Surge + Low Rent"
  description: string;           // "Markets where traffic is surging but rents haven't caught up"
  type: 'preset' | 'custom';    // System-provided vs user-created
  author: string;                // userId or 'system'
  scope: MetricGranularity;      // What level to scan at
  
  // The conditions that define this strategy
  conditions: StrategyCondition[];
  combinator: 'AND' | 'OR';     // How conditions combine (AND = all must pass, OR = any)
  
  // For deal-level scoring (System 1)
  signalWeights?: {
    demand: number;    // 0-100
    supply: number;
    momentum: number;
    position: number;
    risk: number;
    traffic?: number;  // optional 6th signal
  };
  
  // For market scanning (System 2)
  sortBy?: MetricId;             // Primary sort for results
  sortDirection?: 'asc' | 'desc';
  maxResults?: number;           // Cap the result set
  
  // Metadata
  assetClasses: ProductFamily[]; // Which product types this applies to
  dealTypes: DealType[];         // existing | development | redevelopment
  tags: string[];                // User-defined categorization
  createdAt: string;
  updatedAt: string;
  runCount: number;              // How many times this has been executed
  lastRunAt: string | null;
}

// The result of running a strategy against a target
interface StrategyResult {
  targetId: string;              // dealId, submarketId, or marketId
  targetName: string;
  targetType: MetricGranularity;
  overallScore: number;          // 0-100 composite
  conditionResults: {
    conditionId: string;
    metricId: MetricId;
    actualValue: number;
    passed: boolean;
    score: number;               // 0-100 for this condition
    percentile: number;          // Where this target ranks for this metric
  }[];
  rank: number;                  // Position in the result set
  arbitrageFlag?: boolean;       // For deal-level: does this strategy dominate?
  arbitrageDelta?: number;       // Score gap vs next-best strategy
}
```

---

## The Metrics Catalog

The catalog is the shared menu from which all strategies (preset and custom) draw.
It already exists in the correlation-metrics-engine — we formalize it here.

```typescript
interface MetricDefinition {
  id: MetricId;
  name: string;                  // "Traffic Surge Index"
  category: MetricCategory;      // TRAFFIC_PHYSICAL, TRAFFIC_DIGITAL, FINANCIAL, etc.
  formula: string;               // Human-readable formula
  unit: string;                  // "ratio", "%", "$/unit", "score 0-100"
  granularity: MetricGranularity[];  // Which levels this metric is available at
  source: string;                // "M07 Fusion Engine", "M05 Market Intel", etc.
  updateFrequency: string;       // "daily", "weekly", "monthly", "quarterly"
  higherIsBetter: boolean;       // For scoring: true = high value = good
  
  // For the builder UI
  description: string;           // What this metric tells you
  exampleValue: string;          // "+0.35 (35% above baseline)"
  investmentSignal: string;      // "High = demand building before rents catch up"
}

type MetricCategory =
  | 'traffic_physical'    // AADT, walk-ins, physical score
  | 'traffic_digital'     // Search volume, momentum, digital share
  | 'traffic_composite'   // Surge index, digital-physical gap, TPI
  | 'financial'           // Cap rate, rent growth, NOI margin, price/unit
  | 'supply'              // Pipeline units, months of supply, permit velocity
  | 'demand'              // Employment growth, wage growth, population inflow
  | 'market'              // Vacancy, absorption, submarket rank
  | 'risk'                // Risk scores by category
  | 'competition'         // Google rating, review sentiment, amenity gap
  | 'ownership'           // Debt maturity, hold duration, entity type
  | 'computed';           // User-created computed metrics (formulas)

// The full catalog — 35+ metrics organized by category
const METRICS_CATALOG: MetricDefinition[] = [
  // Traffic — Physical
  { id: 'T_AADT', name: 'AADT', category: 'traffic_physical', ... },
  { id: 'T_AADT_YOY', name: 'AADT Growth YoY', category: 'traffic_physical', ... },
  { id: 'T_EFFECTIVE_ADT', name: 'Effective ADT', category: 'traffic_physical', ... },
  { id: 'T_WALKINS', name: 'Predicted Walk-Ins', category: 'traffic_physical', ... },
  { id: 'T_PHYSICAL_SCORE', name: 'Physical Traffic Score', category: 'traffic_physical', ... },
  
  // Traffic — Digital
  { id: 'D_SEARCH_VOL', name: 'Search Volume', category: 'traffic_digital', ... },
  { id: 'D_SEARCH_MOMENTUM', name: 'Search Momentum QoQ', category: 'traffic_digital', ... },
  { id: 'D_DIGITAL_SHARE', name: 'Digital Traffic Share', category: 'traffic_digital', ... },
  { id: 'D_DIGITAL_SCORE', name: 'Digital Traffic Score', category: 'traffic_digital', ... },
  { id: 'D_OUT_OF_STATE', name: 'Out-of-State Search %', category: 'traffic_digital', ... },
  
  // Traffic — Composite
  { id: 'C_SURGE_INDEX', name: 'Traffic Surge Index', category: 'traffic_composite',
    formula: '(google_realtime - DOT_baseline) / DOT_baseline',
    description: 'Positive = more traffic than DOT baseline predicts. The real-time demand pulse.',
    investmentSignal: 'Sustained positive = market growing beyond what historical data captured',
    higherIsBetter: true, ... },
  { id: 'C_DIGITAL_PHYSICAL_GAP', name: 'Digital-Physical Divergence', category: 'traffic_composite',
    formula: 'D_SEARCH_MOMENTUM - T_AADT_YOY',
    description: 'When digital surges ahead of physical, demand is building but hasn\'t manifested',
    investmentSignal: 'THE key leading indicator. Positive gap = buy window.',
    higherIsBetter: true, ... },
  { id: 'C_TPI', name: 'Traffic Position Index', category: 'traffic_composite', ... },
  { id: 'C_TVS', name: 'Traffic Velocity Score', category: 'traffic_composite', ... },
  
  // Financial
  { id: 'F_CAP_RATE', name: 'Cap Rate', category: 'financial', higherIsBetter: false, ... },
  { id: 'F_RENT_GROWTH', name: 'Rent Growth YoY', category: 'financial', higherIsBetter: true, ... },
  { id: 'F_NOI_MARGIN', name: 'NOI Margin', category: 'financial', ... },
  { id: 'F_PRICE_PER_UNIT', name: 'Price per Unit', category: 'financial', ... },
  { id: 'F_RENT_TO_INCOME', name: 'Rent-to-Income Ratio', category: 'financial', higherIsBetter: false, ... },
  
  // Supply
  { id: 'S_PIPELINE_UNITS', name: 'Pipeline Units', category: 'supply', higherIsBetter: false, ... },
  { id: 'S_MONTHS_OF_SUPPLY', name: 'Months of Supply', category: 'supply', higherIsBetter: false, ... },
  { id: 'S_PIPELINE_TO_STOCK', name: 'Pipeline-to-Stock Ratio', category: 'supply', higherIsBetter: false, ... },
  { id: 'S_PERMIT_VELOCITY', name: 'Permit Filing Velocity', category: 'supply', ... },
  
  // Demand
  { id: 'E_EMPLOYMENT_GROWTH', name: 'Employment Growth', category: 'demand', higherIsBetter: true, ... },
  { id: 'E_WAGE_GROWTH', name: 'Wage Growth YoY', category: 'demand', higherIsBetter: true, ... },
  { id: 'E_POPULATION_GROWTH', name: 'Population Growth', category: 'demand', ... },
  { id: 'E_BIZ_FORMATIONS', name: 'Business Formations', category: 'demand', ... },
  
  // Market
  { id: 'M_VACANCY', name: 'Vacancy Rate', category: 'market', higherIsBetter: false, ... },
  { id: 'M_ABSORPTION', name: 'Net Absorption', category: 'market', higherIsBetter: true, ... },
  { id: 'M_SUBMARKET_RANK', name: 'Submarket Rank Percentile', category: 'market', ... },
  { id: 'M_LEASE_VELOCITY', name: 'Lease Velocity', category: 'market', ... },
  
  // Risk
  { id: 'R_SUPPLY_RISK', name: 'Supply Risk Score', category: 'risk', higherIsBetter: false, ... },
  { id: 'R_CLIMATE_RISK', name: 'Climate Risk Score', category: 'risk', higherIsBetter: false, ... },
  { id: 'R_REGULATORY_RISK', name: 'Regulatory Risk Score', category: 'risk', higherIsBetter: false, ... },
  
  // Competition
  { id: 'K_GOOGLE_RATING', name: 'Google Rating', category: 'competition', ... },
  { id: 'K_REVIEW_SENTIMENT', name: 'Review Sentiment Score', category: 'competition', ... },
  
  // Ownership
  { id: 'O_DEBT_MATURITY_MO', name: 'Months to Debt Maturity', category: 'ownership', ... },
  { id: 'O_HOLD_DURATION', name: 'Current Hold Duration', category: 'ownership', ... },
];
```

---

## Preset Strategies (ship with the platform)

These are the strategies that come built-in. Users can clone and modify them.

```typescript
const PRESET_STRATEGIES: StrategyDefinition[] = [
  // ── DEAL-LEVEL PRESETS (System 1 — M08 tab) ──────────────
  {
    id: 'preset-bts',
    name: 'Build-to-Sell',
    type: 'preset',
    scope: 'property',
    conditions: [
      { metricId: 'S_PIPELINE_TO_STOCK', operator: 'lt', value: 5, weight: 25, required: true },
      { metricId: 'E_EMPLOYMENT_GROWTH', operator: 'gt', value: 2.0, weight: 20, required: false },
      { metricId: 'M_ABSORPTION', operator: 'gt', value: 200, weight: 20, required: false },
    ],
    signalWeights: { demand: 30, supply: 25, momentum: 20, position: 15, risk: 10 },
    assetClasses: ['multifamily', 'single_family'],
    dealTypes: ['development'],
    ...
  },
  {
    id: 'preset-flip',
    name: 'Fix & Flip / Value-Add',
    type: 'preset',
    scope: 'property',
    conditions: [
      { metricId: 'F_CAP_RATE', operator: 'gt', value: 6.0, weight: 20, required: false },
      { metricId: 'F_RENT_GROWTH', operator: 'gt', value: 2.0, weight: 15, required: false },
    ],
    signalWeights: { demand: 15, supply: 20, momentum: 30, position: 20, risk: 15 },
    assetClasses: ['multifamily', 'single_family', 'retail', 'office'],
    dealTypes: ['existing', 'redevelopment'],
    ...
  },
  {
    id: 'preset-rental',
    name: 'Stabilized Rental / Hold',
    type: 'preset',
    scope: 'property',
    signalWeights: { demand: 30, supply: 25, momentum: 20, position: 15, risk: 10 },
    assetClasses: ['multifamily', 'single_family', 'industrial'],
    dealTypes: ['existing'],
    ...
  },
  {
    id: 'preset-str',
    name: 'Short-Term Rental / Airbnb',
    type: 'preset',
    scope: 'property',
    signalWeights: { demand: 25, supply: 20, momentum: 25, position: 20, risk: 10 },
    assetClasses: ['single_family', 'hospitality'],
    dealTypes: ['existing'],
    ...
  },

  // ── MARKET-LEVEL PRESETS (System 2 — Scanner) ─────────────
  {
    id: 'preset-demand-surge',
    name: 'Demand Surge Detector',
    description: 'Markets where digital demand is surging but physical traffic and rents haven\'t caught up yet. The buy window.',
    type: 'preset',
    scope: 'submarket',
    conditions: [
      { metricId: 'C_SURGE_INDEX', operator: 'gt', value: 0.20, weight: 35, required: true,
        label: 'Traffic surge above 20% baseline' },
      { metricId: 'F_RENT_GROWTH', operator: 'lt', value: 2.5, weight: 25, required: false,
        label: 'Rent growth still low (hasn\'t repriced yet)' },
      { metricId: 'D_SEARCH_MOMENTUM', operator: 'gt', value: 15, weight: 20, required: false,
        label: 'Search demand accelerating' },
      { metricId: 'S_PIPELINE_TO_STOCK', operator: 'lt', value: 6, weight: 20, required: false,
        label: 'Supply not flooding in yet' },
    ],
    combinator: 'AND',
    sortBy: 'C_SURGE_INDEX',
    sortDirection: 'desc',
    assetClasses: ['multifamily', 'single_family', 'industrial'],
    dealTypes: ['existing', 'development'],
    tags: ['leading-indicator', 'buy-signal', 'demand'],
    ...
  },
  {
    id: 'preset-wage-rent-gap',
    name: 'Rent Runway Detector',
    description: 'Markets where wages are growing faster than rents — rent increases are sustainable and there\'s room to push.',
    type: 'preset',
    scope: 'submarket',
    conditions: [
      { metricId: 'E_WAGE_GROWTH', operator: 'gt', value: 3.0, weight: 40, required: true },
      { metricId: 'F_RENT_GROWTH', operator: 'lt', value: 2.5, weight: 30, required: false },
      { metricId: 'M_VACANCY', operator: 'lt', value: 6.0, weight: 30, required: false },
    ],
    combinator: 'AND',
    sortBy: 'E_WAGE_GROWTH',
    tags: ['income-growth', 'rent-upside', 'fundamental'],
    ...
  },
  {
    id: 'preset-supply-cliff',
    name: 'Supply Cliff Opportunity',
    description: 'Markets where the construction pipeline is drying up — permits declining, deliveries peaking. Future supply tightness = pricing power.',
    type: 'preset',
    scope: 'submarket',
    conditions: [
      { metricId: 'S_PERMIT_VELOCITY', operator: 'decreasing', value: null, weight: 40, required: true },
      { metricId: 'S_PIPELINE_UNITS', operator: 'top_pct', value: 30, weight: 30, required: false,
        label: 'Still heavy pipeline now (deliveries peaking)' },
      { metricId: 'M_ABSORPTION', operator: 'gt', value: 150, weight: 30, required: false },
    ],
    tags: ['supply-constrained', 'contrarian', 'medium-term'],
    ...
  },
  {
    id: 'preset-hidden-gem',
    name: 'Hidden Gem Finder',
    description: 'Properties with strong physical traffic but low digital presence — institutional buyers haven\'t found them yet.',
    type: 'preset',
    scope: 'property',
    conditions: [
      { metricId: 'T_PHYSICAL_SCORE', operator: 'gte', value: 70, weight: 40, required: true },
      { metricId: 'D_DIGITAL_SCORE', operator: 'lt', value: 40, weight: 30, required: true },
      { metricId: 'K_GOOGLE_RATING', operator: 'lt', value: 3.8, weight: 30, required: false,
        label: 'Operational issues = value-add opportunity' },
    ],
    tags: ['acquisition-target', 'value-add', 'early-signal'],
    ...
  },
  {
    id: 'preset-distress-signal',
    name: 'Distress Signal Scanner',
    description: 'Properties approaching debt maturity with operational underperformance — potential forced sellers.',
    type: 'preset',
    scope: 'property',
    conditions: [
      { metricId: 'O_DEBT_MATURITY_MO', operator: 'lt', value: 18, weight: 35, required: true },
      { metricId: 'K_GOOGLE_RATING', operator: 'lt', value: 3.5, weight: 25, required: false },
      { metricId: 'O_HOLD_DURATION', operator: 'gt', value: 5, weight: 20, required: false,
        label: 'Long hold = likely wants to exit' },
      { metricId: 'F_CAP_RATE', operator: 'gt', value: 5.5, weight: 20, required: false },
    ],
    tags: ['distressed', 'acquisition-target', 'off-market'],
    ...
  },
];
```

---

## Leon's Example: Demand Surge + Low Rent

The user's example: "Find me Markets where the growth indicator
((Google Traffic - Average DOT) / DOT) + low rent growth"

This translates to:

```typescript
const userStrategy: StrategyDefinition = {
  id: 'custom-leon-surge-lowrent',
  name: 'Demand Surge + Low Rent Growth',
  description: 'Markets where real-time traffic exceeds baseline (demand building) but rents are still flat (haven\'t repriced). This is the buy window — 2-6 months before rents catch up.',
  type: 'custom',
  author: 'leon',
  scope: 'submarket',
  conditions: [
    {
      id: 'cond-1',
      metricId: 'C_SURGE_INDEX',    // (Google - DOT) / DOT
      operator: 'gt',
      value: 0.15,                   // 15% above baseline
      weight: 50,
      required: true,
      label: 'Traffic surge: real-time > DOT baseline by 15%+',
    },
    {
      id: 'cond-2',
      metricId: 'F_RENT_GROWTH',
      operator: 'lt',
      value: 2.5,                    // Low rent growth
      weight: 30,
      required: true,
      label: 'Rent growth below 2.5% (hasn\'t repriced)',
    },
    {
      id: 'cond-3',
      metricId: 'D_SEARCH_MOMENTUM',
      operator: 'gt',
      value: 10,                     // Search also accelerating
      weight: 20,
      required: false,
      label: 'Bonus: search demand also accelerating',
    },
  ],
  combinator: 'AND',
  sortBy: 'C_SURGE_INDEX',
  sortDirection: 'desc',
  maxResults: 25,
  assetClasses: ['multifamily', 'single_family', 'industrial'],
  dealTypes: ['existing', 'development'],
  tags: ['leading-indicator', 'buy-window', 'traffic-based'],
};
```

---

## Surface Integration

### Surface 1: Deal Capsule → Strategy Tab (M08)

The existing strategy tab in the Deal Capsule becomes:

```
┌─────────────────────────────────────────────────────┐
│ SUB-TABS:                                           │
│ [Score Matrix] [Signal Heatmap] [Custom Screen]     │
│                                                     │
│ Score Matrix: 4-column comparison (existing design) │
│   BTS | Flip | Rental | STR                         │
│   Each scored 0-100 using signalWeights             │
│   Arbitrage flag when delta > 15pts                 │
│                                                     │
│ Signal Heatmap: 5×4 grid (existing design)          │
│   Demand×BTS | Demand×Flip | ...                    │
│                                                     │
│ Custom Screen: NEW — run user's saved strategies    │
│   against THIS deal. Shows which custom strategies  │
│   this deal matches and its score for each.         │
│   "This deal matches 3 of your 7 strategies"        │
└─────────────────────────────────────────────────────┘
```

### Surface 2: Side Panel / Command Palette

The side panel gets a "Run Strategy" command:

```
┌──────────────────────────┐
│ ⌘K: "run strategy"       │
│                          │
│ YOUR STRATEGIES:         │
│ ⚡ Demand Surge + Low    │
│    Rent (custom)         │
│    Last run: 2 days ago  │
│    23 markets matched    │
│                          │
│ 📊 Supply Cliff          │
│    (preset)              │
│    Last run: 1 week ago  │
│    8 markets matched     │
│                          │
│ 💎 Hidden Gem Finder     │
│    (preset)              │
│    14 properties matched │
│                          │
│ [+ Create New Strategy]  │
│ [View All Strategies]    │
└──────────────────────────┘
```

Clicking a strategy runs it and shows results inline in the panel,
or expands to the Opportunity Center page for full exploration.

### Surface 3: Strategy Builder Page

Full-page strategy editor:

```
┌─────────────────────────────────────────────────────┐
│ STRATEGY: Demand Surge + Low Rent Growth            │
│ Scope: [Submarket ▼]  Asset: [Multifamily ▼]       │
│                                                     │
│ CONDITIONS:                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 1. Traffic Surge Index  [>]  [0.15]  Wt: [50]  │ │
│ │    REQUIRED ☑  "real-time traffic exceeds base" │ │
│ ├─────────────────────────────────────────────────┤ │
│ │                    AND                          │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ 2. Rent Growth YoY     [<]  [2.5%]  Wt: [30]  │ │
│ │    REQUIRED ☑  "rents haven't repriced"         │ │
│ ├─────────────────────────────────────────────────┤ │
│ │                    AND                          │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ 3. Search Momentum     [>]  [10%]   Wt: [20]  │ │
│ │    REQUIRED ☐  "bonus signal"                   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [+ Add Condition]  [+ Add Computed Metric]          │
│                                                     │
│ SORT BY: [Traffic Surge Index ▼] [Descending ▼]    │
│ MAX RESULTS: [25]                                   │
│                                                     │
│ ┌─ PREVIEW (live) ──────────────────────────────┐   │
│ │ 23 submarkets match across 4 MSAs             │   │
│ │                                               │   │
│ │ 1. West Melbourne, FL  Surge: +0.42  Rent: 1.8% │
│ │ 2. Nocatee, FL         Surge: +0.38  Rent: 2.1% │
│ │ 3. Plant City, FL      Surge: +0.35  Rent: 1.5% │
│ │ ...                                           │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Save Strategy]  [Run Full Scan]  [Share with Team] │
└─────────────────────────────────────────────────────┘
```

### Computed Metrics (advanced)

Users can create derived metrics by combining existing ones:

```
[+ Add Computed Metric]

Name: "Rent Affordability Runway"
Formula: E_WAGE_GROWTH - F_RENT_GROWTH
Description: "Gap between wage growth and rent growth. Positive = room to push rents."

This creates a new metric available in the builder:
  { id: 'USER_rent_runway', name: 'Rent Affordability Runway', ... }
```

---

## Database Schema

```sql
-- Strategy definitions
CREATE TABLE strategy_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'custom',  -- 'preset' | 'custom'
  scope VARCHAR(20) DEFAULT 'submarket',
  conditions JSONB NOT NULL,          -- StrategyCondition[]
  combinator VARCHAR(5) DEFAULT 'AND',
  signal_weights JSONB,               -- For deal-level scoring
  sort_by VARCHAR(50),
  sort_direction VARCHAR(4) DEFAULT 'desc',
  max_results INTEGER DEFAULT 50,
  asset_classes TEXT[] DEFAULT '{}',
  deal_types TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computed metrics (user-defined formulas)
CREATE TABLE computed_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  metric_id VARCHAR(100) NOT NULL,    -- USER_xxx format
  name VARCHAR(255) NOT NULL,
  formula TEXT NOT NULL,               -- e.g., "E_WAGE_GROWTH - F_RENT_GROWTH"
  description TEXT,
  unit VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy run results (cached for display)
CREATE TABLE strategy_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategy_definitions(id),
  user_id UUID REFERENCES users(id),
  scope VARCHAR(20),
  result_count INTEGER,
  results JSONB,                       -- StrategyResult[]
  execution_ms INTEGER,
  run_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy alerts (notify when new matches appear)
CREATE TABLE strategy_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategy_definitions(id),
  user_id UUID REFERENCES users(id),
  frequency VARCHAR(20) DEFAULT 'weekly',  -- 'daily' | 'weekly' | 'on_change'
  is_active BOOLEAN DEFAULT true,
  last_alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Backend API

```
POST   /api/v1/strategies                    — Create strategy
GET    /api/v1/strategies                    — List user's strategies
GET    /api/v1/strategies/:id               — Get strategy definition
PUT    /api/v1/strategies/:id               — Update strategy
DELETE /api/v1/strategies/:id               — Delete strategy
POST   /api/v1/strategies/:id/run           — Execute strategy scan
GET    /api/v1/strategies/:id/results       — Get cached results
POST   /api/v1/strategies/:id/alerts        — Set up alert

POST   /api/v1/strategies/score-deal/:dealId — Score a deal against all strategies
POST   /api/v1/strategies/preview            — Live preview (no save)

GET    /api/v1/metrics/catalog               — Get full metrics catalog
POST   /api/v1/metrics/computed              — Create computed metric
GET    /api/v1/metrics/:metricId/values      — Get metric values for a scope
```

---

## Implementation Priority

### Phase 1 (P0): Deal-Level Strategy with Presets
- Build the 4-column score matrix in the Deal Capsule Strategy tab
- Wire the 5 signal scores from actual module outputs
- Implement the arbitrage detection formula (F24)
- Ship with the 4 preset deal-level strategies (BTS, Flip, Rental, STR)
- No custom builder yet — just the existing designed M08 module

### Phase 2 (P1): Market-Level Presets + Side Panel
- Build the strategy execution engine (runs conditions against market data)
- Ship 5 preset market scanners (Demand Surge, Rent Runway, Supply Cliff, Hidden Gem, Distress)
- Add "Run Strategy" command to side panel
- Results link to Opportunity Center

### Phase 3 (P1): Custom Strategy Builder
- Build the Strategy Builder page with drag-and-drop metric conditions
- Live preview as conditions change
- Save/edit/delete custom strategies
- Clone preset → customize flow

### Phase 4 (P2): Computed Metrics + Alerts
- User-defined formula metrics
- Strategy alert subscriptions (notify when new matches appear)
- Strategy performance tracking (did the matches pan out?)
- Team sharing
