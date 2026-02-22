# Derived Metrics Integration Plan
**Created:** 2026-02-21 04:32 EST  
**Purpose:** Integrate 55 proprietary derived metrics into Market Research/Intelligence

---

## 📊 Current Market Intelligence Structure

We just built (Phases 1-4):

```
/markets → My Markets Overview
  ↓
/markets/:marketId → Market Deep Dive
  ├─ Overview Tab (Market vitals, coverage, deals)
  ├─ Market Data Tab (1,028 research properties)
  ├─ Submarkets Tab (Supply/demand comparison)
  ├─ Trends Tab (12-year historical data)
  └─ Deals Tab (Your portfolio)
```

---

## 🎯 Integration Strategy: Where Each Metric Type Goes

### OPTION 1: Integrate into Existing Tabs

#### **Overview Tab Enhancement**
**Add: Market Intelligence Dashboard section**

**Metrics to Display:**
- **D×S-1:** Jobs-to-Apartments Ratio (e.g., "8.2 jobs per unit - Severe Shortage")
- **D×S-3:** Migration-to-Supply Ratio (e.g., "4.5 people per pipeline unit - Undersupplied")
- **R-1:** Rent vs Wage Growth Spread (e.g., "+2.3% spread - Pricing power")
- **L-1:** Employment Gravity Score (e.g., "92 - High concentration")

**UI Design:**
```
┌─────────────────────────────────────────────┐
│ 🧠 PROPRIETARY INTELLIGENCE                 │
├─────────────────────────────────────────────┤
│                                             │
│ 📊 DEMAND × SUPPLY RATIOS                   │
│ ┌──────────────────┐  ┌──────────────────┐ │
│ │ Jobs-to-Apts     │  │ Migration Ratio  │ │
│ │                  │  │                  │ │
│ │    8.2           │  │    4.5           │ │
│ │ jobs/unit        │  │ people/pipeline  │ │
│ │                  │  │                  │ │
│ │ 🔥 SEVERE        │  │ ⚠️ UNDERSUPPLIED │ │
│ │    SHORTAGE      │  │                  │ │
│ └──────────────────┘  └──────────────────┘ │
│                                             │
│ 💰 RENT INTELLIGENCE                        │
│ Rent Growth: +4.2% | Wage Growth: +1.9%    │
│ Spread: +2.3% → Strong pricing power        │
│                                             │
│ 📈 MOMENTUM SIGNALS                         │
│ Rent Acceleration: +0.8% (accelerating)    │
│ Demand Score: 87/100 (Very Strong)         │
└─────────────────────────────────────────────┘
```

---

#### **Submarkets Tab Enhancement**
**Add: Derived Ratio Columns**

**Current Table:**
```
Submarket | Supply | Demand | Balance | Score
Buckhead  | High   | V.High | +30%    | 92
```

**Enhanced Table:**
```
Submarket | Supply | Demand | Balance | Jobs/Apt | Migration | Absorption | Score
Buckhead  | High   | V.High | +30%    | 9.2      | 5.1       | 14 mo     | 92
Midtown   | Medium | High   | +15%    | 7.8      | 3.8       | 22 mo     | 85
```

**Metrics to Add:**
- **D×S-1:** Jobs-to-Apartments Ratio (per submarket)
- **D×S-3:** Migration-to-Supply Ratio (per submarket)
- **D×S-5:** Absorption Runway (months of supply)
- **T-1:** Real-Time Traffic Growth (if available per submarket)

---

#### **Trends Tab Enhancement**
**Add: Momentum & Velocity Metrics**

**New Section: "Leading Indicators"**
```
┌─────────────────────────────────────────────┐
│ 🚀 LEADING INDICATORS (8-12 week lead)      │
├─────────────────────────────────────────────┤
│                                             │
│ Google Search Volume → Occupancy Predictor  │
│ Current Trend: ↗️ +23% searches (2 months)  │
│ Predicted Occupancy: 95.2% (3 months out)  │
│                                             │
│ Rent Acceleration (R-6)                     │
│ Current: +0.8%/month (accelerating)        │
│ 12-month trajectory: +5.4% → +7.2%         │
└─────────────────────────────────────────────┘
```

**Metrics to Add:**
- **R-6:** Rent Acceleration (velocity of rent growth)
- **N-1:** Concession Velocity (how fast concessions change)
- **P-1:** Search → Occupancy Predictor (Google Trends)
- **P-4:** Demand Momentum Score
- **D×S-2:** New Jobs per New Unit (flow ratio)

---

#### **Market Data Tab Enhancement**
**Add: Property-Level Intelligence Columns**

**Current Columns:**
```
Property | Address | Units | Owner | Year | Value
```

**Enhanced with Derived Metrics:**
```
Property | Units | Owner | Year | Value | Vintage Score | Affordability | Arbitrage Signals
```

**Property-Level Metrics:**
- **R-4:** Vintage Convergence (is old property catching up to new?)
- **R-2:** Affordability Threshold (% of renters who can afford)
- **A-1:** Condo Conversion Spread (can it be converted profitably?)
- **A-2:** STR Hybrid Uplift (Airbnb potential)
- **L-2:** Amenity Index Score (school, transit, retail access)

---

### OPTION 2: Add New "Intelligence" Tab

**Create 6th tab in Market Deep Dive:**

```
Tabs:
1. Overview
2. Market Data
3. Submarkets
4. Trends
5. Deals
6. 🧠 INTELLIGENCE (NEW) ← All 55 derived metrics here
```

**Intelligence Tab Structure:**

```
┌─────────────────────────────────────────────┐
│ 🧠 PROPRIETARY MARKET INTELLIGENCE          │
├─────────────────────────────────────────────┤
│                                             │
│ [Filter by category: All | Demand/Supply | │
│  Rent | Traffic | Predictive | Arbitrage]  │
│                                             │
│ ▼ DEMAND × SUPPLY RATIOS                    │
│   ┌───────────────────────────────────────┐ │
│   │ D×S-1: Jobs-to-Apartments Ratio       │ │
│   │ Value: 8.2 jobs/unit                  │ │
│   │ Threshold: > 8.0 = Severe Shortage   │ │
│   │ Status: 🔥 UNDERSUPPLIED              │ │
│   │ [View Calculation] [View Trend]      │ │
│   └───────────────────────────────────────┘ │
│                                             │
│   ┌───────────────────────────────────────┐ │
│   │ D×S-2: New Jobs per New Unit          │ │
│   │ Value: 7.3 jobs/unit                  │ │
│   │ Threshold: > 5 = Strong Demand        │ │
│   │ Status: ✅ STRONG                      │ │
│   └───────────────────────────────────────┘ │
│                                             │
│ ▼ RENT INTELLIGENCE                         │
│   [Similar cards for R-1 through R-6]      │
│                                             │
│ ▼ TRAFFIC SIGNALS                           │
│   [T-1 through T-7]                        │
│                                             │
│ ▼ PREDICTIVE MODELS                         │
│   [P-1 through P-5]                        │
└─────────────────────────────────────────────┘
```

**Pros:**
- Clean separation of basic vs advanced intelligence
- All 55 metrics in one place
- Easy to add new metrics
- Doesn't clutter existing tabs

**Cons:**
- One more tab to navigate
- Might hide valuable insights

---

## 🗄️ Database Schema for Derived Metrics

```sql
-- New table: derived_metrics
CREATE TABLE derived_metrics (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(100) NOT NULL,
  submarket_id VARCHAR(100), -- NULL if market-level
  metric_code VARCHAR(10) NOT NULL, -- e.g., 'D×S-1', 'R-6', 'T-1'
  metric_name VARCHAR(255) NOT NULL,
  metric_value DECIMAL(10,2),
  threshold_interpretation TEXT, -- e.g., "Severe Shortage"
  status VARCHAR(50), -- e.g., "UNDERSUPPLIED", "STRONG", "WARNING"
  calculation_date TIMESTAMPTZ DEFAULT NOW(),
  source_a_value DECIMAL(10,2), -- For transparency
  source_b_value DECIMAL(10,2),
  formula_used TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_derived_metrics_market ON derived_metrics(market_id);
CREATE INDEX idx_derived_metrics_code ON derived_metrics(metric_code);
CREATE INDEX idx_derived_metrics_date ON derived_metrics(calculation_date DESC);

-- New table: metric_definitions
CREATE TABLE metric_definitions (
  metric_code VARCHAR(10) PRIMARY KEY,
  metric_name VARCHAR(255) NOT NULL,
  category VARCHAR(50), -- 'DEMAND_SUPPLY', 'RENT', 'TRAFFIC', etc.
  formula TEXT NOT NULL,
  source_a VARCHAR(100),
  source_b VARCHAR(100),
  source_c VARCHAR(100),
  what_it_reveals TEXT,
  threshold_rules JSONB,
  competitive_moat_level VARCHAR(20), -- 'HIGH', 'VERY HIGH', 'MEDIUM'
  mvp_priority VARCHAR(10), -- 'P0', 'P1', 'P2'
  phase INTEGER, -- 1-6 from implementation roadmap
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Phase 1 metrics
INSERT INTO metric_definitions (metric_code, metric_name, category, formula, mvp_priority, phase) VALUES
  ('D×S-1', 'Jobs-to-Apartments Ratio', 'DEMAND_SUPPLY', 'Total jobs ÷ Total apartment units', 'P0', 1),
  ('D×S-2', 'New Jobs per New Unit', 'DEMAND_SUPPLY', 'New jobs (12mo) ÷ New units delivered (12mo)', 'P0', 1),
  ('D×S-3', 'Migration-to-Supply Ratio', 'DEMAND_SUPPLY', 'Net migration ÷ Pipeline units', 'P0', 1),
  ('R-1', 'Rent vs Wage Growth Spread', 'RENT', 'Rent growth % - Wage growth %', 'P0', 1),
  ('R-3', 'Rent-to-Mortgage Discount', 'RENT', '(Monthly rent × 12) ÷ (Median home price × 0.06)', 'P0', 1),
  ('R-5', 'Concession Drag', 'RENT', 'Effective rent - Face rent', 'P0', 1);
```

---

## 📡 API Endpoints

```typescript
// Get all derived metrics for a market
GET /api/v1/markets/:marketId/intelligence
Response: {
  market_id: "atlanta-metro",
  metrics: [
    {
      code: "D×S-1",
      name: "Jobs-to-Apartments Ratio",
      value: 8.2,
      interpretation: "Severe Shortage",
      status: "UNDERSUPPLIED",
      calculation_date: "2026-02-21",
      sources: {
        jobs: 500000,
        units: 60975
      }
    },
    // ... more metrics
  ]
}

// Get specific metric with historical trend
GET /api/v1/markets/:marketId/intelligence/:metricCode
Response: {
  code: "D×S-1",
  current_value: 8.2,
  historical: [
    { date: "2026-01", value: 7.9 },
    { date: "2026-02", value: 8.2 },
  ],
  threshold: { min: 3.0, balanced: 5.0, severe: 8.0 },
  status: "UNDERSUPPLIED"
}

// Calculate metrics on-demand (for testing)
POST /api/v1/markets/:marketId/intelligence/calculate
Body: { metric_codes: ["D×S-1", "R-6"] }
```

---

## 🎨 UI Components Needed

### 1. Metric Card Component
```typescript
interface MetricCardProps {
  code: string;        // "D×S-1"
  name: string;        // "Jobs-to-Apartments Ratio"
  value: number;       // 8.2
  unit: string;        // "jobs/unit"
  status: string;      // "UNDERSUPPLIED"
  statusColor: string; // "red", "yellow", "green"
  interpretation: string; // "Severe Shortage"
  trend?: "up" | "down" | "stable";
  onViewDetails?: () => void;
}
```

### 2. Metric Detail Modal
- Shows formula
- Shows source data
- Shows historical trend chart
- Explains what it means
- Links to related metrics

### 3. Intelligence Dashboard
- Grid of metric cards
- Filter by category
- Sort by priority/status
- Export capabilities

---

## 🚀 Implementation Phases

### PHASE 1: Foundation (Week 1)
**Backend:**
- Create database tables (derived_metrics, metric_definitions)
- Seed Phase 1 metric definitions (6 metrics)
- Build calculation engine for Phase 1 metrics
- Create API endpoints

**Frontend:**
- Metric Card component
- Intelligence section in Overview tab (start here)
- Basic metric display (value + status)

**Deliverable:** 6 Phase 1 metrics calculating and displaying

---

### PHASE 2: Data Integration (Week 2)
**Data Sources:**
- BLS Employment API integration (free)
- Census Migration API (free)
- Freddie Mac mortgage data (free)
- Store historical scraper data (already collecting)

**Calculations:**
- D×S-1: Jobs-to-Apartments (need BLS + property count)
- D×S-2: New Jobs per New Unit (need BLS YoY + deliveries)
- D×S-3: Migration-to-Supply (need Census + permits)
- R-1: Rent vs Wage (scraper + BLS)
- R-3: Rent-to-Mortgage (scraper + Freddie Mac)
- R-5: Concession Drag (scraper time series)

**Deliverable:** All 6 Phase 1 metrics calculating with real data

---

### PHASE 3: UI Enhancement (Week 3)
**Frontend:**
- Add Intelligence tab (Option 2)
- OR enhance existing tabs (Option 1)
- Metric detail modals
- Historical trend charts
- Status indicators with colors
- Filter/sort capabilities

**Deliverable:** Full UI for Phase 1 metrics

---

### PHASE 4: Phase 2 Metrics (Week 4-5)
- Add time series metrics (R-6, N-1, P-4, D×S-5, S-5)
- Requires historical data accumulation
- Build momentum/velocity calculators

---

### PHASE 5: Traffic Intelligence (Week 6-9)
- Google Maps Traffic API integration
- DOT data matching
- Build all 7 traffic metrics (T-1 through T-7)
- **This is THE MOAT**

---

## 🎯 Recommendation: START HERE

**My Recommendation: OPTION 1 + Gradual Rollout**

1. **Week 1: Add Intelligence Section to Overview Tab**
   - Start with 3-4 hero metrics
   - D×S-1 (Jobs-to-Apartments)
   - D×S-3 (Migration-to-Supply)
   - R-1 (Rent vs Wage Spread)
   - Keep it simple, high impact

2. **Week 2: Enhance Submarkets Tab**
   - Add derived ratio columns
   - Jobs/Apt, Migration Ratio per submarket

3. **Week 3: Add Intelligence Tab**
   - Once we have 10+ metrics
   - Full dashboard view
   - All 55 metrics eventually

4. **Week 4+: Roll out Phase 2-6**
   - Add metrics as they're built
   - Keep enhancing the Intelligence tab

---

## 💡 Quick Win: Mock Intelligence Section

Want me to build a **mock Intelligence section** in the Overview tab right now with sample data? This would show:
- How the metrics look
- Where they fit
- What the UX feels like

Then we can decide on the database schema and start building the calculation engine.

---

**Next Steps:**
1. Build mock UI to visualize the metrics?
2. Create database schema and API endpoints?
3. Start Phase 1 metric calculations?
4. All of the above?

Your call! 🚀
