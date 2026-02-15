# Market Research Engine V2 - User-Driven Risk Assessment

## Problem with V1
- Abstract scores (0-100) impose our judgment
- "Future Supply Risk: 60/100" - what does that mean?
- Users can't set their own thresholds
- Hard to compare across deals
- Missing employment impact analysis

## Solution: Show Real Metrics + Jobs Impact ⭐
Instead of scores, show actual numbers and let users decide:

### ✨ What's New in V2

**1. Real Unit Counts (not scores)**
- Show actual buildable units: "1,911 units" not "Risk: 60/100"
- Future supply ratio: "212%" not "Supply Balance: 65/100"
- Let users decide what's too risky

**2. Per Capita Metrics**
- Units per 1,000 people (18.0 → 64.7)
- Units per 100 households (4.9 → 17.5)
- National benchmarks for context
- Rent-to-income ratio (affordability)

**3. Jobs-to-Housing Analysis ⭐ NEW**
- **Jobs per unit:** 31.7 → 8.8 (market balance)
- **Employment news integration:** "Microsoft +5,000 jobs" → "+2,250 units demand"
- **Demand vs supply:** Job growth demand / Future supply = 164%
- **Configurable multiplier:** User sets jobs-to-units ratio (0.40-0.50)
- **Aggregate impact:** All employment news → Total units demand
- **Positive/negative events:** Hiring AND layoffs tracked

**4. User-Defined Thresholds**
- Set your own limits (not ours)
- Alerts when deals exceed YOUR criteria
- Different thresholds for different strategies

**5. Market Comparison Tool**
- Side-by-side deal comparison
- See which market is healthier
- Jobs metrics change risk assessment

---

## 📊 New Report Structure

### **Supply Analysis** (What Really Matters)

```typescript
supply_analysis: {
  // Current Market
  existing_properties: 18,
  existing_total_units: 900,
  available_units_now: 50,
  availability_rate: 5.5%, // 50/900
  
  // Near-term Pipeline (0-24 months)
  units_under_construction: 245,
  units_permitted: 180,
  near_term_pipeline_total: 425,
  pipeline_ratio: 47%, // 425/900 = 47% new supply
  
  // Future Supply (2-5 years) - from Zoning Intelligence
  vacant_parcels: 45,
  underutilized_parcels: 12,
  developable_acres: 78,
  
  realistic_buildable_units: 1911, // ⭐ KEY METRIC
  theoretical_max_units: 2730,
  
  future_supply_ratio: 212%, // 1911/900 = 212% potential future supply!
  
  // Timeline
  estimated_years_to_buildout: 9.5,
  annual_absorption_rate: 201, // 1911/9.5 years
  
  // Context
  development_probability: 75%, // 0-100, how likely is this to happen
  rezoning_likelihood: 'MEDIUM'
}
```

### **Demand Indicators** (Market Health)

```typescript
demand_indicators: {
  // Occupancy
  avg_occupancy_rate: 94.5%,
  occupancy_trend: 'STABLE', // UP/STABLE/DOWN
  
  // Pricing
  avg_rent_1br: $1,850,
  avg_rent_2br: $2,450,
  rent_growth_6mo: 2.8%,
  rent_growth_12mo: 5.2%,
  rent_growth_trend: 'ACCELERATING', // ACCELERATING/STABLE/DECLINING
  
  // Competition
  properties_in_market: 18,
  competitive_pressure: 'HIGH', // LOW/MEDIUM/HIGH
  
  // Concessions (weakness signal)
  properties_with_concessions: 3,
  concession_rate: 16.7%, // 3/18
  avg_concession_value: $500,
  
  // Market Stress Signals
  stress_signals: [
    'High concession rate (16.7%)',
    'Aggressive rent growth may not be sustainable'
  ]
}
```

### **Market Capacity** (Can Market Absorb?)

```typescript
market_capacity: {
  // Current Market Size
  current_market_units: 900,
  
  // Total Potential Supply
  total_future_supply: 2336, // pipeline (425) + future (1911)
  
  // Absorption Analysis
  current_absorption_rate: 201, // units per year
  years_to_absorb_pipeline: 2.1, // 425 / 201
  years_to_absorb_all: 11.6, // 2336 / 201
  
  // Saturation Risk
  market_size_multiplier: 3.6x, // (900 + 2336) / 900
  saturation_year: 2035, // Today + 11.6 years
  
  // Per Capita Analysis ⭐ NEW
  per_capita: {
    // Population Context
    population: 50000,
    household_count: 18500,
    avg_household_size: 2.7,
    
    // Current Density
    units_per_1000_people: 18.0,        // 900 / 50,000 * 1000
    units_per_100_households: 4.9,      // 900 / 18,500 * 100
    
    // With Pipeline (0-2 years)
    units_per_1000_with_pipeline: 26.5,      // 1,325 / 50,000 * 1000
    units_per_100_hh_with_pipeline: 7.2,     // 1,325 / 18,500 * 100
    
    // With All Future Supply (2-5 years)
    units_per_1000_fully_built: 64.7,        // 3,236 / 50,000 * 1000  ⚠️
    units_per_100_hh_fully_built: 17.5,      // 3,236 / 18,500 * 100  ⚠️
    
    // National Benchmarks (for comparison)
    benchmarks: {
      national_avg: 35.5,        // units per 1000 people
      urban_markets: 45.2,       // dense cities
      suburban_markets: 28.3,    // suburbs
      this_market_category: 'suburban'
    },
    
    // Capacity Assessment
    current_vs_benchmark: -49%,  // 18.0 vs 35.5 = undersupplied ✅
    future_vs_benchmark: +82%,   // 64.7 vs 35.5 = oversupplied ⚠️
    
    // Affordability Context
    median_income: 85000,
    avg_rent_annual: 22200,      // $1,850/mo * 12
    rent_to_income_ratio: 26.1%, // 22,200 / 85,000
    affordable_rent_30pct: 25500, // 30% of $85k income
    market_affordability: 'AFFORDABLE' // <30% is good
  },
  
  // Jobs-to-Housing Analysis ⭐ NEW
  employment_impact: {
    // Current Employment
    total_jobs_in_market: 28500,        // from BLS or news intelligence
    labor_force_participation: 57%,     // 28,500 / 50,000
    
    // Jobs-to-Housing Ratios
    jobs_per_unit: 31.7,                // 28,500 / 900 units
    units_per_100_jobs: 3.16,           // 900 / 28,500 * 100
    
    // With Future Supply
    jobs_per_unit_fully_built: 8.8,     // 28,500 / 3,236 units ⚠️
    units_per_100_jobs_fully_built: 11.4, // 3,236 / 28,500 * 100
    
    // Housing Demand from Employment
    jobs_to_units_multiplier: 0.45,     // Industry avg: 1 job = 0.45 units demand
    // Breakdown: 1 worker = 0.45 units (some share, some remote, some own)
    
    // National Benchmarks
    benchmarks: {
      balanced_jobs_per_unit: 1.5,      // Standard balance
      jobs_rich_market: 2.5,            // More jobs than housing (tight)
      housing_rich_market: 1.0          // More housing than jobs (soft)
    },
    
    // News Impact Calculator
    recent_employment_changes: [
      {
        event: 'Microsoft Atlanta expansion',
        date: '2024-11-15',
        jobs_added: 5000,
        units_demand_generated: 2250,   // 5,000 * 0.45
        timeline: '12-18 months',
        source: 'News Intelligence'
      },
      {
        event: 'NCR HQ relocation',
        date: '2024-08-20',
        jobs_added: 3500,
        units_demand_generated: 1575,   // 3,500 * 0.45
        timeline: '6-12 months',
        source: 'News Intelligence'
      }
    ],
    
    // Aggregate Impact
    total_jobs_from_news: 8500,
    total_units_demand_from_news: 3825,  // 8,500 * 0.45
    demand_absorption_vs_pipeline: 900%, // 3,825 / 425 = 900% ✅ STRONG
    demand_absorption_vs_future: 164%,   // 3,825 / 2,336 = 164% ✅ GOOD
    
    // Verdict
    employment_verdict: 'STRONG DEMAND - New jobs (8,500) generate 3,825 units demand, exceeds pipeline',
    demand_supply_balance: 'FAVORABLE' // Demand > Supply
  }
  
  // Verdict
  capacity_assessment: 'HIGH RISK - Future supply (64.7 units/1000) exceeds benchmark by 82%',
  undersupplied_today: true,    // 18.0 vs 35.5 benchmark
  oversupplied_future: true     // 64.7 vs 35.5 benchmark
}
```

---

## 🎯 User Experience

### Dashboard Display

```
┌─────────────────────────────────────────────────────┐
│ SUPPLY ANALYSIS - Buckhead Heights                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Current Market:        900 units                     │
│ Available Now:          50 units (5.5%)              │
│                                                      │
│ ⚠️ PIPELINE (0-2 years):   425 units                │
│   • Under Construction:   245 units                  │
│   • Permitted:            180 units                  │
│   • Pipeline Ratio:       47% of existing market     │
│                                                      │
│ 🚨 FUTURE SUPPLY (2-5 years): 1,911 units          │
│   • Vacant Parcels:       45 parcels                 │
│   • Developable Acres:    78 acres                   │
│   • Development Chance:   75%                        │
│   • Future Supply Ratio:  212% of existing market ⚠️  │
│                                                      │
│ 📊 TOTAL POTENTIAL:  2,336 new units (3.6x market)  │
│                                                      │
│ ─────────────────────────────────────────────────── │
│ PER CAPITA ANALYSIS (Population: 50,000)             │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Units per 1,000 People:                              │
│   Current:        18.0 ✅ (Undersupplied -49%)       │
│   With Pipeline:  26.5 ✅ (Below benchmark)          │
│   Fully Built:    64.7 ⚠️ (Oversupplied +82%)        │
│                                                      │
│   Benchmark:      35.5 (suburban market avg)         │
│                                                      │
│ Units per 100 Households:                            │
│   Current:         4.9                               │
│   With Pipeline:   7.2                               │
│   Fully Built:    17.5 ⚠️                             │
│                                                      │
│ Affordability:                                       │
│   Median Income:      $85,000                        │
│   Avg Rent (1BR):     $1,850/mo                      │
│   Rent/Income Ratio:  26.1% ✅ (Affordable)          │
│                                                      │
│ ─────────────────────────────────────────────────── │
│ EMPLOYMENT IMPACT (Jobs: 28,500)                     │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Jobs per Unit:                                       │
│   Current:        31.7 jobs/unit ✅ (Jobs-rich)      │
│   Fully Built:     8.8 jobs/unit ✅ (Above balanced) │
│   Benchmark:       1.5 jobs/unit (balanced market)   │
│                                                      │
│ Recent Employment News:                              │
│   • Microsoft expansion:  +5,000 jobs               │
│     → Housing demand:     +2,250 units ✅            │
│   • NCR HQ relocation:    +3,500 jobs               │
│     → Housing demand:     +1,575 units ✅            │
│                                                      │
│   Total jobs added:       +8,500                     │
│   Total units demand:     +3,825 units               │
│                                                      │
│ Demand vs Supply:                                    │
│   Demand / Pipeline:      900% ✅ (Strong demand!)   │
│   Demand / All Future:    164% ✅ (Demand exceeds)   │
│                                                      │
│ 💡 Employment growth supports 3,825 units demand     │
│    Future supply (2,336) = 61% of demand ✅          │
│                                                      │
│ ─────────────────────────────────────────────────── │
│ ABSORPTION ANALYSIS                                  │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ • Current Rate:       201 units/year                 │
│ • Years to Absorb:    11.6 years                     │
│ • Market Saturation:  ~2035                          │
│                                                      │
│ ⚠️ USER ASSESSMENT NEEDED                            │
│ Set your risk threshold:                             │
│   Max units/1000 people: [____] (default: 45)       │
│   Max future supply: [_____] units                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Configurable Thresholds

```typescript
user_risk_preferences: {
  // Supply Thresholds
  max_acceptable_pipeline_ratio: 30%, // Default 30%
  max_acceptable_future_supply: 1000, // units
  min_years_to_saturation: 5, // years
  
  // Density Thresholds
  max_units_per_1000_people: 45, // Above this = oversupplied
  min_jobs_per_unit: 2.0, // Below this = jobs-poor market
  
  // Employment Thresholds ⭐ NEW
  jobs_to_units_multiplier: 0.45, // User can adjust (0.40-0.50)
  min_demand_coverage: 50%, // Demand must cover at least 50% of supply
  
  // System compares
  alerts: [
    {
      metric: 'pipeline_ratio',
      value: 47%,
      threshold: 30%,
      status: 'EXCEEDED', // ⚠️
      message: 'Pipeline ratio (47%) exceeds your threshold (30%)'
    },
    {
      metric: 'future_buildable_units',
      value: 1911,
      threshold: 1000,
      status: 'EXCEEDED', // ⚠️
      message: 'Future supply (1,911 units) exceeds your limit (1,000 units)'
    },
    {
      metric: 'jobs_demand_coverage',
      value: 164%,
      threshold: 50%,
      status: 'OK', // ✅
      message: 'Job growth demand (164%) exceeds minimum coverage (50%)'
    },
    {
      metric: 'jobs_per_unit',
      value: 8.8,
      threshold: 2.0,
      status: 'OK', // ✅
      message: 'Jobs per unit (8.8) exceeds minimum (2.0) - jobs-rich market'
    }
  ]
}
```

**Market-Specific Multipliers:**
```typescript
jobs_to_units_multiplier_by_market: {
  'tech_hub': 0.50,        // High income, more rentals (SF, Austin, Seattle)
  'suburban': 0.45,        // Standard (Atlanta, Charlotte, Dallas)
  'university': 0.55,      // Student + young professionals (Chapel Hill, Madison)
  'retirement': 0.30,      // Fewer workers per unit (Florida, Arizona)
  'industrial': 0.40,      // Lower income, more homeownership (Rust Belt)
  
  // User can override with local knowledge
  'custom': 0.48           // User-defined based on market research
}
```

---

## 🔄 Comparison: Old vs New

### Old Approach (V1)
```json
{
  "market_score": {
    "future_supply_risk": 60,  // ❌ What does 60 mean?
    "supply_balance": 65,      // ❌ Relative to what?
    "overall_opportunity": 75  // ❌ Based on whose criteria?
  }
}
```

### New Approach (V2)
```json
{
  "supply_analysis": {
    "existing_total_units": 900,          // ✅ Clear
    "realistic_buildable_units": 1911,    // ✅ Clear
    "future_supply_ratio": 2.12,          // ✅ Clear (212%)
    "years_to_buildout": 9.5,             // ✅ Clear
    "market_size_multiplier": 3.6         // ✅ Clear (3.6x growth)
  },
  "user_thresholds": {
    "your_limit": 1000,                   // ✅ User's choice
    "exceeds_limit": true,                // ✅ Clear alert
    "units_over": 911                     // ✅ By how much
  }
}
```

---

## 🛠️ Implementation Plan

### Phase 1: Refactor Data Structure ✅
1. Keep raw metrics (units, ratios, percentages)
2. Remove or de-emphasize 0-100 scores
3. Add calculated insights (capacity, absorption, saturation)

### Phase 2: User Thresholds 🔄
1. Add `user_risk_preferences` table
2. Let users set their own limits
3. Generate alerts when thresholds exceeded

### Phase 3: Frontend Display 📊
1. Big, clear numbers (not tiny scores)
2. Visual indicators (⚠️ when over threshold)
3. Comparison tool (Deal A vs Deal B)

### Phase 4: Learning System 🧠
1. Track user decisions (approved deals with X future supply)
2. Suggest personalized thresholds
3. "Deals like this one you approved had 800 units future supply"

---

## 📝 Example Use Cases

### Deal Underwriter Perspective
> "I don't care about your scores. Just tell me:
> - How many units are coming?
> - When are they coming?
> - Can the market absorb them?
> 
> I'll decide if that's risky."

**V2 Answer:**
- 425 units in 2 years (pipeline)
- 1,911 units in 5-10 years (zoning potential)
- Market absorbs ~200 units/year
- 11.6 years to absorb everything
- **You decide:** Is 1,911 units too much for a 900-unit market?

### Conservative Investor
**Their Thresholds:**
- Max pipeline: 20% of market
- Max future supply: 500 units
- Min saturation time: 10 years

**System Alert:**
```
⚠️ 3 thresholds exceeded:
- Pipeline: 47% (limit: 20%)
- Future supply: 1,911 units (limit: 500)
- Saturation: 11.6 years (acceptable: 10+) ✅

Recommendation: PASS on this deal
```

### Aggressive Developer
**Their Thresholds:**
- Max pipeline: 50% of market
- Max future supply: 2000 units
- Min saturation time: 5 years

**System Alert:**
```
✅ All thresholds within limits:
- Pipeline: 47% (limit: 50%) ✅
- Future supply: 1,911 units (limit: 2,000) ✅
- Saturation: 11.6 years (acceptable: 5+) ✅

Recommendation: PROCEED - meets your criteria
```

---

## 📊 Per Capita Metrics Explained

### Jobs per Unit (Employment Impact)
**Connect employment news to housing demand**

**Standard Formula:**
```
1 new job = 0.45 units housing demand

Why 0.45 and not 1.0?
- Some workers already own homes (don't need rentals)
- Some workers are remote/relocating from area
- Some workers double up (roommates, couples)
- Some workers commute from outside submarket

Industry standard: 0.40-0.50 depending on market
```

**Example:**
```
Microsoft announces: +5,000 jobs in Atlanta

Housing demand = 5,000 × 0.45 = 2,250 units needed
Pipeline supply = 425 units
Demand/Supply ratio = 2,250 / 425 = 530% ✅ STRONG

→ Employment growth exceeds supply by 5.3x = BULLISH
```

**Jobs-to-Housing Ratio:**
```
Current: 31.7 jobs per unit (28,500 jobs / 900 units)
→ Jobs-rich market ✅ (more jobs than housing = tight)

Fully Built: 8.8 jobs per unit (28,500 jobs / 3,236 units)
→ Still above balanced (1.5 benchmark) ✅

Benchmark:
- <1.0 = Housing-rich (soft market, oversupply)
- 1.5 = Balanced
- >2.5 = Jobs-rich (tight market, undersupply)
```

**Real-World Application:**
```
News Intelligence tracks:
- Microsoft: +5,000 jobs → +2,250 units demand
- NCR HQ: +3,500 jobs → +1,575 units demand
- Total: +8,500 jobs → +3,825 units demand

Compare to supply:
- Pipeline (425 units): Absorbs only 11% of demand ✅
- Future supply (2,336 units): Absorbs 61% of demand ✅

Verdict: STRONG EMPLOYMENT GROWTH supports development
```

**When to Use:**
- News article: "Company X adds 10,000 jobs" → Calculate housing impact
- Compare demand from jobs vs. planned supply
- Validate if market can support new development

**Automated News Intelligence Integration:**
```typescript
// When news article detected
{
  headline: "Microsoft expands Atlanta office, adds 5,000 jobs",
  event_type: "employment",
  jobs_impact: +5000,
  timeline: "12-18 months"
}

// System automatically calculates
housing_demand = 5000 × 0.45 = 2,250 units
comparison_to_pipeline = 2,250 / 425 = 530%

// Alert generated
"STRONG: Microsoft expansion generates 2,250 units demand. 
Pipeline (425) captures only 19% of demand. 
Future supply (2,336) captures 104% of demand."
```

**Multiple Events Aggregation:**
```
Microsoft: +5,000 jobs → +2,250 units
NCR HQ:    +3,500 jobs → +1,575 units
----------
Total:     +8,500 jobs → +3,825 units demand

Your pipeline:        425 units (11% of demand) ⚠️
Your future supply: 2,336 units (61% of demand) ✅

Verdict: Strong employment growth validates development plan.
Market can absorb 61% of planned supply from job growth alone.
```

**Negative Employment Events:**
```
Tech layoffs: -2,000 jobs → -900 units demand ⚠️

Adjusted demand: 3,825 - 900 = 2,925 units
Future supply: 2,336 units = 80% of adjusted demand ✅

System alert: "Layoffs reduce demand by 24%, but market 
still undersupplied relative to job growth."
```

---

### Units per 1,000 People
**Most important density metric for market saturation**

**National Benchmarks:**
- **Dense Urban (NYC, SF):** 60-80 units/1000
- **Urban Markets:** 40-50 units/1000
- **Suburban Markets:** 25-35 units/1000
- **Rural/Exurban:** 10-20 units/1000

**How to Use:**
```
Current: 18.0 units/1000
→ vs Suburban Benchmark (28.3) = -36% ✅ UNDERSUPPLIED

Fully Built: 64.7 units/1000
→ vs Suburban Benchmark (28.3) = +129% ⚠️ OVERSUPPLIED
```

**Interpretation:**
- **<20:** Severely undersupplied (opportunity!)
- **20-35:** Normal suburban density
- **35-50:** High density (urban feel)
- **>50:** Very high risk of oversupply

### Units per 100 Households
**Alternative view using household count**

**Why it matters:**
- More accurate than population (accounts for household size)
- Households = actual apartment demand
- Population includes children, multi-family homes

**Example:**
```
50,000 people / 2.7 avg household size = 18,500 households

Current: 4.9 units per 100 households
→ Only 4.9% of households have access to these apartments

Fully Built: 17.5 units per 100 households  
→ 17.5% of households could live in these apartments ⚠️
```

### Rent-to-Income Ratio
**Affordability indicator**

**Rule of Thumb:**
- **<25%:** Very affordable ✅
- **25-30%:** Affordable ✅
- **30-35%:** Stretched ⚠️
- **>35%:** Not affordable for median household ❌

**Example:**
```
Median Income: $85,000
Avg Rent: $1,850/mo = $22,200/year
Ratio: 26.1% ✅ AFFORDABLE

This means the median household CAN afford average rent.
```

---

## 🎯 Key Metrics to Show

### Priority 1: Supply Numbers
- `existing_total_units`
- `realistic_buildable_units`
- `units_under_construction`
- `units_permitted`

### Priority 2: Per Capita Metrics ⭐ NEW
- `units_per_1000_people` (current vs benchmarks)
- `units_per_1000_fully_built` (future state)
- `units_per_100_households`
- `jobs_per_unit` (employment balance)
- `rent_to_income_ratio` (affordability)

### Priority 3: Ratios (Context)
- `future_supply_ratio` (e.g., 212%)
- `pipeline_ratio` (e.g., 47%)
- `availability_rate` (e.g., 5.5%)
- `current_vs_benchmark` (e.g., -49% undersupplied)

### Priority 4: Timeline
- `years_to_buildout`
- `years_to_absorb_all`
- `estimated_saturation_year`

### Priority 5: Market Health
- `avg_occupancy_rate`
- `rent_growth_12mo`
- `concession_rate`

---

## 🚀 Next Steps

1. **Refactor TypeScript interfaces** - New data structure
2. **Update aggregation logic** - Calculate capacity metrics
3. **Add user preferences table** - Store thresholds
4. **Update API responses** - Prioritize metrics over scores
5. **Build threshold engine** - Compare deal metrics vs user limits
6. **Design new UI** - Big numbers, clear alerts

---

## 📊 Market Comparison Example

### Deal A: Buckhead Heights (Atlanta)
```
Population: 50,000
Current Units: 900
Future Supply: 1,911
Jobs: 28,500

Units per 1000:       18.0 → 64.7 (+259%)
Jobs per unit:        31.7 → 8.8 (still above 1.5 ✅)
Employment news:      +8,500 jobs → +3,825 units demand
Demand/Supply:        3,825 / 2,336 = 164% ✅
Rent/Income:          26.1% ✅
Future vs Benchmark:  +82% ⚠️

Assessment: UNDERSUPPLIED today, STRONG job growth supports development,
            but 3.6x supply growth still concerning
```

### Deal B: Midtown Crossing (Dallas)
```
Population: 75,000
Current Units: 2,400
Future Supply: 600
Jobs: 48,000

Units per 1000:       32.0 → 40.0 (+25%)
Jobs per unit:        20.0 → 15.0 (above balanced ✅)
Employment news:      +2,000 jobs → +900 units demand
Demand/Supply:        900 / 600 = 150% ✅
Rent/Income:          28.5% ✅
Future vs Benchmark:  +13% ✅

Assessment: BALANCED today, MODERATE growth, strong employment support
```

### Deal C: Suburban Oaks (Phoenix)
```
Population: 35,000
Current Units: 400
Future Supply: 150
Jobs: 18,000

Units per 1000:       11.4 → 15.7 (+38%)
Jobs per unit:        45.0 → 32.7 (extremely jobs-rich ✅✅)
Employment news:      +1,200 jobs → +540 units demand
Demand/Supply:        540 / 150 = 360% ✅✅
Rent/Income:          31.2% ⚠️
Future vs Benchmark:  -44% ✅

Assessment: SEVERELY UNDERSUPPLIED, extremely strong job market,
            opportunity despite affordability concerns
```

### Side-by-Side Decision Matrix

| Metric | Deal A | Deal B | Deal C | Winner |
|--------|--------|--------|--------|--------|
| **Current Density** | 18.0 | 32.0 | 11.4 | C (most undersupplied) |
| **Future Density** | 64.7 ⚠️ | 40.0 ✅ | 15.7 ✅ | B (balanced) |
| **Jobs per Unit** | 31.7 ✅ | 20.0 ✅ | 45.0 ✅✅ | C (jobs-richest) |
| **Job Growth Demand** | +3,825 units | +900 units | +540 units | A (strongest growth) |
| **Demand/Supply** | 164% ✅ | 150% ✅ | 360% ✅✅ | C (highest demand) |
| **Affordability** | 26.1% ✅ | 28.5% ✅ | 31.2% ⚠️ | A (most affordable) |
| **Supply Growth** | +259% ⚠️ | +25% ✅ | +38% ✅ | B (controlled growth) |
| **Risk Level** | MEDIUM | LOW | LOW-MEDIUM | B |

**Recommendation:**
- **Conservative investor:** Deal B (balanced, steady growth)
- **Value-add player:** Deal C (undersupplied, jobs-rich, strong demand)
- **Growth-focused:** Deal A (employment growth generates 3,825 units demand, can support 164% of future supply)

**Key Insight:** Adding jobs metrics changes Deal A from "Avoid" to "Consider" 
because employment growth (+8,500 jobs) generates enough demand to support 
61% of future supply, reducing risk.

---

**Philosophy:** 
> "Give users the data. Let them decide what's risky."

Not:
> "Trust our algorithm. Risk score: 60/100."

---

Want me to implement this refactor now?
