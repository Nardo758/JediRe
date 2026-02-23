# Data Insights → Module Integration Map

**Purpose:** Define which data insights feed which JEDI RE modules  
**Date:** February 22, 2026

---

## 🎯 Overview: Data Flow Architecture

```
Atlanta Properties (1,028 records)
    ↓
Property Intelligence Layer
    ↓
JEDI RE Modules (25 modules across 6 stages)
    ↓
Financial Model + 3D Design Module
```

---

## 📋 STAGE 1: OVERVIEW & SETUP (4 modules)

### 1.1 Deal Overview
**Data Inputs:**
- Property basics (address, units, year built)
- **JEDI Score** (composite from all modules)
- Owner information (from Atlanta data)
- Quick stats dashboard

**Data Insights to Display:**
- Owner Seller Propensity Score (if Atlanta property)
- Value-Add Property Score (0-100)
- Submarket position (where does this property rank?)
- Tax burden vs neighborhood median

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Deal Overview Dashboard                 │
├─────────────────────────────────────────┤
│ Property: 123 Main St, Atlanta          │
│ Owner: ABC Properties (Portfolio: 5)    │
│ Seller Likelihood: 72/100 🎯 HIGH       │
│                                          │
│ JEDI Score: 85/100                       │
│ ├─ Market: 90 (Strong submarket)        │
│ ├─ Value-Add: 75 (Good upside)          │
│ ├─ Owner: 72 (Likely seller)            │
│ └─ Financial: 88 (Attractive returns)   │
│                                          │
│ Quick Stats:                             │
│ • Value/Unit: $155k (vs $143k median)   │
│ • Density: 32 units/acre (60th %ile)    │
│ • Tax Burden: 1.8% (vs 2.1% median)     │
└─────────────────────────────────────────┘
```

---

### 1.2 Zoning & Entitlements
**Data Inputs:**
- Current density (units/acre)
- **Low-Density Redevelopment Score** (from analysis)
- Neighborhood density benchmarks
- Zoning maximums (if available)

**Data Insights to Display:**
- Current density vs neighborhood avg/max
- Redevelopment potential (can we 2-3x units?)
- Comparable properties that redeveloped
- Zoning utilization % (actual vs max allowed)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Zoning & Density Analysis               │
├─────────────────────────────────────────┤
│ Current Configuration:                  │
│ • 243 units on 8.2 acres = 29.6 u/acre  │
│                                          │
│ Neighborhood Benchmarks:                 │
│ • Average: 35 u/acre (you're LOW ⚠️)    │
│ • Top Quartile: 55 u/acre               │
│ • Max Observed: 87 u/acre               │
│                                          │
│ Redevelopment Potential: HIGH 🚀         │
│ • Could build: 450-700 units (2-3x)     │
│ • Similar redevelopments nearby: 3      │
│                                          │
│ [View Density Heatmap] [Zoning Details] │
└─────────────────────────────────────────┘
```

**Push to 3D Design Module:**
- Current density (units/acre)
- Neighborhood density benchmarks (target range)
- Max density examples (aspirational)

---

### 1.3 Context Tracker
**Data Inputs:**
- Deal activity timeline
- Owner contact history
- Market changes affecting this deal

**Data Insights to Display:**
- Recent comparable sales (Atlanta data)
- Owner portfolio changes (bought/sold properties)
- Neighborhood trends (values up/down)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Context Tracker - Activity Timeline     │
├─────────────────────────────────────────┤
│ Feb 22: Owner ABC sold 2 other properties│
│         → Portfolio liquidation? 🎯      │
│                                          │
│ Feb 15: Comparable sale 0.3mi away      │
│         $165k/unit (+8% vs this deal)   │
│                                          │
│ Feb 10: Submarket rents up 3.2% YoY     │
│         → Improving fundamentals         │
└─────────────────────────────────────────┘
```

---

### 1.4 Team & Collaborators
**Data Inputs:**
- Deal team members
- Owner contact information (from Atlanta data)
- External partners (brokers, lenders, etc.)

**Data Insights to Display:**
- Owner mailing address (for outreach)
- Owner portfolio (other properties to discuss)
- Recommended team structure by deal size

---

## 🔍 STAGE 2: MARKET RESEARCH (5 modules)

### 2.1 Market Intelligence
**Data Inputs:**
- **Submarket Valuation Benchmarks** (from Atlanta data)
- **Owner Portfolio Mapping** (who owns what)
- **Tax Burden Analysis** (by neighborhood)
- **Vintage Cohort Performance** (by decade built)

**Data Insights to Display:**
- Submarket comparison table (value/unit, density, tax rates)
- Owner concentration (who dominates this submarket?)
- Vintage performance (how do 1980s buildings perform here?)
- Market share pie chart (institutional vs mom-and-pop)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Market Intelligence - Buckhead          │
├─────────────────────────────────────────┤
│ Submarket Overview:                     │
│ • 127 properties, 31,450 units          │
│ • Avg Value: $158k/unit                 │
│ • Avg Density: 42 units/acre            │
│ • Avg Tax Burden: 2.1%                  │
│                                          │
│ Top Owners (by market share):           │
│ 1. Big REIT (18% - 5,661 units)         │
│ 2. Local Operator (12% - 3,774 units)   │
│ 3. Out-of-State LLC (8% - 2,516 units)  │
│                                          │
│ Vintage Performance:                     │
│ • 2010s: $185k/unit, 55 u/acre          │
│ • 2000s: $165k/unit, 45 u/acre          │
│ • 1990s: $142k/unit, 38 u/acre ⚠️       │
│ • 1980s: $128k/unit, 32 u/acre 🎯       │
│   → Value-add opportunity!              │
│                                          │
│ [View Full Benchmarks] [Owner Map]      │
└─────────────────────────────────────────┘
```

**Push to Financial Module:**
- Submarket cap rate estimates
- Value/unit benchmarks (for comps-based valuation)
- Tax burden % (for operating expenses)

---

### 2.2 Competition Analysis
**Data Inputs:**
- **Competitive Rent Positioning Matrix** (from rent comps)
- **Hidden Gem Detection** (high performers)
- **Property Overlap Analysis** (direct competitors)
- **Marketing Effectiveness Score** (ad spend ROI)

**Data Insights to Display:**
- 2x2 matrix: Rent/SF vs Occupancy %
- Competitive positioning (are we overpriced? underpriced?)
- Hidden gems to study (who's winning without marketing?)
- Direct competitors (>50% overlap) vs distant (>20%)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Competition Analysis - Rent Positioning │
├─────────────────────────────────────────┤
│     HIGH RENT                            │
│      ↑                                   │
│ 100% │  [Leader A]    [Leader B]        │
│  Occ │                                   │
│  90% │  [You] 🎯      [Comp C]          │
│      │                                   │
│  85% │           [Comp D]  [Overpriced] │
│      │                                   │
│  80% │  [Distressed]                    │
│      └────────────────────────→          │
│      LOW RENT                            │
│                                          │
│ Your Position: Slightly Underpriced     │
│ • Current: $3.85/SF, 92% occ            │
│ • Opportunity: Raise to $4.10/SF        │
│ • Estimated Impact: +$156k annual NOI   │
│                                          │
│ Direct Competitors (>50% overlap):      │
│ 1. Leader A: $4.20/SF, 96% occ 🎯       │
│    → Study amenities, marketing         │
│ 2. Comp C: $4.05/SF, 89% occ            │
│ 3. Comp D: $3.95/SF, 87% occ            │
│                                          │
│ Hidden Gems (winning without marketing):│
│ • Leader A: High occ + Basic ad tier    │
│   → Secret: Location + word-of-mouth    │
│                                          │
│ [View Full Matrix] [Export to Financial]│
└─────────────────────────────────────────┘
```

**Push to Financial Module:**
- Current rent/SF (market position)
- Recommended rent/SF (opportunity)
- Occupancy expectations (based on competitive position)
- Rent growth assumptions (based on market trends)

---

### 2.3 Supply Pipeline
**Data Inputs:**
- New construction tracking (year built 2020+)
- Construction activity by submarket
- Absorption risk scoring

**Data Insights to Display:**
- New supply coming online (next 12-24 months)
- Historical absorption rates
- Saturation risk score

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Supply Pipeline - New Construction      │
├─────────────────────────────────────────┤
│ Buckhead Submarket:                     │
│ • Delivering in 2026: 1,450 units       │
│ • Delivering in 2027: 890 units         │
│ • Total New Supply: 2,340 units (+7.4%) │
│                                          │
│ Absorption Risk: MODERATE ⚠️            │
│ • Historical absorption: 150 units/qtr  │
│ • New supply: 585 units/qtr (4x pace)   │
│ • Risk: Rent compression, concessions   │
│                                          │
│ New Construction Impact:                 │
│ • Avg Rent Premium: +$0.75/SF (new)     │
│ • But... Higher concessions (5-8%)      │
│ • Net Effective Rent: Only +$0.25/SF    │
│                                          │
│ Strategy: Position as value alternative │
│ [View Pipeline Map] [Absorption Model]  │
└─────────────────────────────────────────┘
```

**Push to Financial Module:**
- Supply wave impact on rents (downward pressure?)
- Absorption timeline (lease-up speed)
- Concession expectations (based on competition)

---

### 2.4 Trends Analysis
**Data Inputs:**
- **Vintage Cohort Performance** (by decade)
- **Aging Curve Analysis** (rent depreciation over time)
- Assessed value growth rates (if multi-year data)

**Data Insights to Display:**
- Rent trends by property age
- Value appreciation by submarket
- Renovation ROI (rent bump from capex)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Trends Analysis - Vintage Performance   │
├─────────────────────────────────────────┤
│ Your Property: Built 1985 (39 years old)│
│                                          │
│ Aging Curve - Rent Depreciation:        │
│ • New (0-5 yrs): $5.00/SF (baseline)    │
│ • Modern (5-15 yrs): $4.50/SF (-10%)    │
│ • Mature (15-30 yrs): $4.00/SF (-20%)   │
│ • Aging (30-40 yrs): $3.50/SF (-30%) 🎯 │
│   → That's you! Value-add opportunity   │
│                                          │
│ Renovation Impact:                       │
│ • $15k/unit capex → +$0.50/SF rent      │
│ • ROI: 12-15% yield on renovation       │
│ • Comparable renovations: 5 nearby      │
│                                          │
│ Market Appreciation (Buckhead):         │
│ • 2020-2026: +18% value growth          │
│ • 2023-2026: +8% (slowing but positive) │
│                                          │
│ [View Aging Curve] [Renovation Comps]   │
└─────────────────────────────────────────┘
```

**Push to Financial Module:**
- Current rent/SF (based on age)
- Post-renovation rent/SF (if capex deployed)
- Rent growth % (market trend)
- Appreciation assumptions (for exit value)

---

### 2.5 Traffic Engine
**Data Inputs:**
- Leasing velocity predictions (existing)
- Occupancy trends
- Marketing effectiveness

**Data Insights to Display:**
- Predicted inquiries/tours/leases (12-week forecast)
- Seasonal patterns
- Marketing ROI (which ad tier?)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Traffic Engine - Leasing Forecast       │
├─────────────────────────────────────────┤
│ 12-Week Absorption Forecast:            │
│ • Projected Leases: 48 (baseline)       │
│ • Occupancy Target: 95% (from 92%)      │
│ • Weeks to Stabilization: 8 weeks       │
│                                          │
│ Marketing Recommendation: DIAMOND        │
│ • Platinum: 96% occ, $2,500/mo cost     │
│ • Diamond: 94% occ, $1,200/mo cost 🎯   │
│ • Basic: 89% occ, $400/mo cost          │
│ → Diamond = best ROI                    │
│                                          │
│ Hidden Gem Insight:                      │
│ • Competitor "Leader A" at 96% occ      │
│   with only Basic tier → Location wins  │
│ • Strategy: Invest in product, not ads  │
│                                          │
│ [View Forecast] [Marketing Analysis]    │
└─────────────────────────────────────────┘
```

---

## 🎨 STAGE 3: DEAL DESIGN (6 modules)

### 3.1 3D Building Design
**Data Inputs:**
- **Low-Density Redevelopment Score** (can we add units?)
- **Neighborhood Density Benchmarks** (what's achievable?)
- **Neighboring Property AI** (assemblage opportunities)
- Current parcel size, zoning constraints

**CRITICAL DATA PUSH FROM ANALYSIS:**

**From Atlanta Properties:**
1. **Current Density:** 29.6 units/acre (your property)
2. **Neighborhood Benchmarks:**
   - Average: 35 units/acre
   - Top Quartile: 55 units/acre
   - Maximum Observed: 87 units/acre
3. **Redevelopment Potential:** Can we 2-3x units?
4. **Comparable Redevelopments:** Properties that went from 30 → 60 u/acre

**From Rent Comps:**
5. **Optimal Unit Mix:** 60% 1BR, 30% 2BR, 10% Studio (based on market demand)
6. **Average Unit Sizes:** 
   - Studio: 550 SF
   - 1BR: 750 SF
   - 2BR: 1,100 SF
   - 3BR: 1,500 SF
7. **Story Count Premium:** High-rise (20+ stories) gets +$0.50/SF vs mid-rise

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ 3D Building Design - Optimization       │
├─────────────────────────────────────────┤
│ Current Configuration:                  │
│ • 243 units, 8.2 acres, 29.6 u/acre     │
│ • 4 stories, 180,000 SF building        │
│                                          │
│ Optimization Targets: 🎯                │
│ • Target Density: 55 u/acre (top qtile) │
│ • Target Units: 450 units (1.85x)       │
│ • Target Mix: 270 1BR, 135 2BR, 45 Std  │
│                                          │
│ Design Recommendations:                  │
│ 1. Add 2 stories (4 → 6 stories)        │
│    → +100 units, minimal site impact    │
│ 2. Increase FAR to 2.5 (from 2.0)       │
│    → +50 units, denser configuration    │
│ 3. Optimize unit mix to market demand   │
│    → +$250k annual NOI (better rents)   │
│                                          │
│ Neighboring Parcels (Assemblage):       │
│ • 8.1 acres adjacent (owner: Mom&Pop)   │
│ • Combined: 16.3 acres = 900 unit site! │
│ • Seller Likelihood: 78/100 🎯          │
│                                          │
│ [Launch 3D Editor] [Run Optimizer]      │
│ [View Assemblage Map]                   │
└─────────────────────────────────────────┘
```

**DATA FLOW TO 3D MODULE:**
```javascript
// Data structure pushed to 3D Design Module
const designInputs = {
  currentConfiguration: {
    units: 243,
    acres: 8.2,
    density: 29.6, // units/acre
    stories: 4,
    buildingSF: 180000,
    unitMix: {
      studio: 20,
      oneBed: 120,
      twoBed: 80,
      threeBed: 23
    }
  },
  benchmarks: {
    submarketAvgDensity: 35,
    topQuartileDensity: 55,
    maxObservedDensity: 87,
    comparableRedevelopments: [
      { from: 30, to: 62, cost: "$45M", timeline: "24 months" },
      { from: 28, to: 58, cost: "$38M", timeline: "20 months" }
    ]
  },
  optimalUnitMix: {
    studio: 0.10, // 10%
    oneBed: 0.60, // 60%
    twoBed: 0.30, // 30%
    threeBed: 0.00 // 0%
  },
  unitSizeBenchmarks: {
    studio: { min: 500, avg: 550, max: 650 },
    oneBed: { min: 700, avg: 750, max: 900 },
    twoBed: { min: 1000, avg: 1100, max: 1300 },
    threeBed: { min: 1400, avg: 1500, max: 1800 }
  },
  rentPremiums: {
    storyCountPremium: "+$0.50/SF for 20+ stories vs 4-5 stories",
    newConstructionPremium: "+$0.75/SF for <5 years old",
    renovationPremium: "+$0.50/SF for full renovation"
  },
  neighboringParcels: [
    {
      acres: 8.1,
      owner: "Mom & Pop LLC",
      sellerLikelihood: 78,
      currentUse: "Garden apartments, 120 units",
      assemblageValue: "Combined 16.3 acres = 900 unit site"
    }
  ]
};
```

---

### 3.2 Strategy
**Data Inputs:**
- **Value-Add Property Score** (from analysis)
- Property positioning (Class A/B/C)
- Investment thesis

**Data Insights to Display:**
- Value-add score breakdown (age, density, market, tax)
- Recommended strategy (renovate vs redevelop vs hold)
- Comparable value-add deals

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Strategy - Investment Thesis            │
├─────────────────────────────────────────┤
│ Recommended Strategy: VALUE-ADD 🎯       │
│                                          │
│ Value-Add Score: 82/100 (EXCELLENT)     │
│ ├─ Age: 90/100 (39 years old)           │
│ ├─ Density: 85/100 (29.6 vs 55 target)  │
│ ├─ Market: 75/100 (strong submarket)    │
│ └─ Tax: 80/100 (below-market burden)    │
│                                          │
│ Strategic Options:                       │
│ 1. Renovate & Reposition (RECOMMENDED)  │
│    • $15k/unit capex ($3.6M total)      │
│    • Rent increase: +$0.50/SF           │
│    • NOI increase: +$1.2M annually      │
│    • IRR: 18-22% (3-year hold)          │
│                                          │
│ 2. Redevelop (High Risk/Reward)         │
│    • Tear down, build 450 units         │
│    • Total cost: $85M                   │
│    • IRR: 22-28% (5-year hold)          │
│    • Risk: Construction, lease-up       │
│                                          │
│ 3. Hold & Harvest (Conservative)        │
│    • No capex, harvest cash flow        │
│    • IRR: 12-15% (10-year hold)         │
│                                          │
│ Comparable Value-Add Deals (Atlanta):   │
│ • 5 similar renovations nearby          │
│ • Avg capex: $14.2k/unit                │
│ • Avg rent bump: +$0.48/SF              │
│ • Avg hold period: 3.2 years            │
│                                          │
│ [View Full Analysis] [Export to Model]  │
└─────────────────────────────────────────┘
```

**Push to Financial Module:**
- Strategy type (value-add, core, redevelopment)
- Capex budget ($15k/unit)
- Rent increase assumptions (+$0.50/SF)
- Hold period (3 years)

---

### 3.3 Financial Model
**THIS IS THE MAIN RECIPIENT OF ALL DATA!**

**Data Inputs from ALL modules:**

**From Market Intelligence:**
- Submarket cap rate: 5.5%
- Value/unit benchmark: $158k/unit
- Tax burden: 2.1% of value
- Operating expense ratio: 45% of revenue

**From Competition Analysis:**
- Current market rent: $3.85/SF (your position)
- Recommended rent: $4.10/SF (opportunity)
- Occupancy: 92% current, 95% achievable
- Concessions: 2% (market average)

**From Supply Pipeline:**
- Rent growth: 3.2% annually (next 3 years)
- Lease-up time: 8 weeks to 95% occupancy
- Supply risk: Moderate (adjust rent growth to 2.5%)

**From Trends Analysis:**
- Current rent (1985 vintage): $3.50/SF
- Post-renovation rent: $4.00/SF (+$0.50)
- Appreciation: 8% over 3 years

**From 3D Design:**
- Current: 243 units
- Optimized: 450 units (if redevelop)
- Unit mix: 60% 1BR, 30% 2BR, 10% Studio
- Average unit size: 850 SF

**From Strategy:**
- Capex: $15k/unit × 243 = $3.6M
- Hold period: 3 years
- Exit cap rate: 5.75% (25bp higher)

**From Atlanta Property Data:**
- Purchase price: $155k/unit × 243 = $37.7M
- Current assessed value: $36.2M
- Tax savings opportunity: $45k/year (appeal)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Financial Model - Pro Forma              │
├─────────────────────────────────────────┤
│ ACQUISITION                              │
│ • Purchase Price: $37.7M ($155k/unit)   │
│ • Closing Costs: $1.1M (3%)             │
│ • Total Acquisition: $38.8M             │
│                                          │
│ RENOVATION (Year 1)                      │
│ • Capex: $3.6M ($15k/unit)              │
│ • Financing: 70% LTC debt               │
│ • Equity: $14.2M (30% + capex)          │
│                                          │
│ OPERATING PRO FORMA (Stabilized Yr 2)   │
│ Revenue:                                 │
│ • Units: 243 × 850 SF avg               │
│ • Rent/SF: $4.00 (post-renovation) 🎯   │
│   vs $3.50 current (+$0.50)             │
│ • Gross Rent: $9.9M annually            │
│ • Occupancy: 95% (vs 92% current)       │
│ • Effective Gross: $9.4M                │
│                                          │
│ Expenses:                                │
│ • Operating: $4.2M (45% of EGI)         │
│ • Taxes: $760k (2.1% of value) 💰       │
│   Note: $45k/year savings if appeal     │
│ • Total Expenses: $5.0M                 │
│                                          │
│ NOI: $4.4M (+$1.2M vs current)          │
│                                          │
│ EXIT (Year 3)                            │
│ • Exit NOI: $4.6M (3% growth)           │
│ • Exit Cap Rate: 5.75%                  │
│ • Exit Value: $80.0M                    │
│ • Gross Profit: $41.2M                  │
│                                          │
│ RETURNS                                  │
│ • Equity Multiple: 2.9x                 │
│ • IRR: 21.4%                            │
│ • Cash-on-Cash (Yr 2): 12.8%            │
│                                          │
│ DATA SOURCES:                            │
│ ✓ Rent: Competition Analysis            │
│ ✓ Cap Rate: Market Intelligence         │
│ ✓ Taxes: Atlanta Property Data          │
│ ✓ Capex: Strategy Module                │
│ ✓ Unit Mix: 3D Design Optimizer         │
│                                          │
│ [Sensitivity Analysis] [Export Report]  │
└─────────────────────────────────────────┘
```

**FULL DATA STRUCTURE PUSHED TO FINANCIAL MODEL:**
```javascript
const financialInputs = {
  acquisition: {
    purchasePrice: 37700000, // From Atlanta data: $155k/unit
    closingCosts: 0.03, // 3%
    purchasePricePerUnit: 155000,
    source: "Atlanta Property Database - Assessed Value"
  },
  property: {
    units: 243,
    averageUnitSize: 850, // From 3D Design + Rent Comps
    currentOccupancy: 0.92,
    targetOccupancy: 0.95, // From Competition Analysis
    currentRentPerSF: 3.50, // Current (1985 vintage)
    marketRentPerSF: 3.85, // Market average (Competition)
    targetRentPerSF: 4.00, // Post-renovation (Trends + Strategy)
    rentGrowthRate: 0.032 // From Supply Pipeline + Trends
  },
  capex: {
    renovationCostPerUnit: 15000, // From Strategy Module
    totalRenovation: 3600000,
    timeline: "12 months",
    rentBump: 0.50, // +$0.50/SF post-renovation
    source: "Comparable renovations in submarket"
  },
  expenses: {
    operatingExpenseRatio: 0.45, // 45% of EGI
    propertyTaxRate: 0.021, // From Atlanta Tax Data
    taxSavingsOpportunity: 45000, // Annual savings if appeal
    insurancePerUnit: 800,
    managementFee: 0.05,
    source: "Market Intelligence + Atlanta Tax Analysis"
  },
  financing: {
    loanToValue: 0.70, // 70% LTV
    interestRate: 0.06, // 6% rate
    term: 10, // years
    debtServiceCoverageRatio: 1.25
  },
  exit: {
    holdPeriod: 3, // years
    exitCapRate: 0.0575, // 5.75% (25bp spread)
    goingInCapRate: 0.055, // 5.5% from Market Intelligence
    appreciationRate: 0.08, // 8% over 3 years (from Trends)
    source: "Submarket Cap Rate Analysis"
  },
  sensitivities: {
    rentRange: { low: 3.75, base: 4.00, high: 4.25 },
    occupancyRange: { low: 0.90, base: 0.95, high: 0.97 },
    exitCapRange: { low: 0.055, base: 0.0575, high: 0.060 },
    capexRange: { low: 12000, base: 15000, high: 18000 }
  },
  comparables: {
    similarDeals: 5, // From Atlanta + Strategy analysis
    avgIRR: 0.19, // 19% IRR on comparable value-add deals
    avgHoldPeriod: 3.2 // years
  }
};
```

---

### 3.4 Capital Events
**Data Inputs:**
- Equity structure
- Refinancing opportunities
- Distribution waterfall

**Data Insights to Display:**
- Comparable deal structures (from market)
- Preferred equity vs common split
- Refinancing timing (when does cap rate support?)

---

### 3.5 Debt & Financing
**Data Inputs:**
- Loan sizing (from financial model)
- Debt market conditions
- Lender appetite

**Data Insights to Display:**
- Debt service coverage ratio
- Loan-to-value ratio
- Interest rate benchmarks

---

### 3.6 Exit Strategy
**Data Inputs:**
- **Cap rate trends** (from Market Intelligence)
- Exit value calculation
- Buyer appetite indicators

**Data Insights to Display:**
- Historical cap rate trends (are they compressing or expanding?)
- Exit multiples on comparable deals
- Buyer types active in market (REITs, local operators, institutions)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Exit Strategy - Disposition Plan        │
├─────────────────────────────────────────┤
│ Recommended Exit: Year 3 (2029)         │
│                                          │
│ Exit Valuation:                          │
│ • Stabilized NOI: $4.6M                 │
│ • Exit Cap Rate: 5.75% (conservative)   │
│ • Exit Value: $80.0M                    │
│ • Price/Unit: $329k (+112% from entry)  │
│                                          │
│ Cap Rate Analysis:                       │
│ • Going-In (2026): 5.50%                │
│ • Exit (2029): 5.75% (+25bp)            │
│ • Risk: Cap rate expansion              │
│ • Sensitivity: Every 25bp = -$2M value  │
│                                          │
│ Buyer Market (Atlanta Buckhead):        │
│ • Active Buyers: 8 (past 12 months)     │
│ • Buyer Types:                          │
│   - REITs: 40% (pay highest prices)     │
│   - Local Operators: 35%                │
│   - Institutions: 25%                   │
│ • Avg Days on Market: 120 days          │
│                                          │
│ Alternative Exit: Refinance & Hold      │
│ • Refinance at 70% LTV = $56M loan      │
│ • Return equity: $30M (2.1x return)     │
│ • Hold for cash flow (12% cash yield)   │
│                                          │
│ [View Exit Scenarios] [Buyer List]      │
└─────────────────────────────────────────┘
```

**Push to Financial Module:**
- Exit cap rate (5.75%)
- Cap rate sensitivity (-$2M per 25bp)
- Days on market (120 days)
- Buyer appetite score

---

## ✅ STAGE 4: DUE DILIGENCE (5 modules)

### 4.1 DD Checklist
**Data Inputs:**
- Standard DD items
- Property-specific risks

**Data Insights to Display:**
- Property age-specific DD items (1985 = environmental concerns)
- Owner portfolio issues (distressed properties elsewhere?)

---

### 4.2 Deal Lifecycle
**Data Inputs:**
- Milestone tracking
- Timeline vs plan

**Data Insights to Display:**
- Typical timeline for value-add deals (from comparables)
- Risk milestones (financing, entitlements, lease-up)

---

### 4.3 Risk Management
**Data Inputs:**
- **Market concentration risk** (owner concentration analysis)
- **Competitive risk** (supply pipeline)
- **Execution risk** (renovation timeline)

**Data Insights to Display:**
- Market risk score (supply saturation, cap rate risk)
- Owner risk (is this owner distressed elsewhere?)
- Execution risk (comparable project timelines)

**Wireframe Enhancement:**
```
┌─────────────────────────────────────────┐
│ Risk Management - Risk Matrix           │
├─────────────────────────────────────────┤
│ Overall Risk Score: MODERATE (5/10)     │
│                                          │
│ Market Risks:                            │
│ • Supply Pipeline: MODERATE ⚠️          │
│   - 2,340 units delivering (7.4% growth)│
│   - Mitigation: Position as value alt   │
│                                          │
│ • Cap Rate Expansion: LOW               │
│   - Historical: Stable 5.4-5.8%         │
│   - Mitigation: Short 3-year hold       │
│                                          │
│ Execution Risks:                         │
│ • Renovation Timing: LOW                │
│   - 5 comparable renovations nearby     │
│   - Avg timeline: 11 months (vs 12 plan)│
│                                          │
│ • Lease-Up Risk: LOW                    │
│   - Strong submarket fundamentals       │
│   - 8-week absorption expected          │
│                                          │
│ Owner Risks:                             │
│ • Owner Portfolio Health: GOOD          │
│   - Owner has 5 properties, all stable  │
│   - No distressed assets                │
│                                          │
│ [View Full Risk Assessment]             │
└─────────────────────────────────────────┘
```

---

### 4.4 Environmental & ESG
**Data Inputs:**
- Property age (environmental concerns for old buildings)
- ESG compliance checklist

**Data Insights to Display:**
- Typical issues for 1980s buildings (asbestos, lead paint)
- ESG certification opportunities (LEED, Energy Star)

---

### 4.5 Files & Assets
**Data Inputs:**
- Document repository
- Owner contact info (from Atlanta data)

**Data Insights to Display:**
- Owner mailing address (for outreach)
- Owner portfolio (other properties)

---

## 🚀 STAGE 5: EXECUTION (3 modules)

### 5.1 Project Timeline
**Data Inputs:**
- Renovation timeline (from comparable deals)
- Lease-up timeline (from Traffic Engine)

**Data Insights to Display:**
- Milestone schedule
- Comparable project timelines

---

### 5.2 Project Management
**Data Inputs:**
- Task tracking
- Budget vs actual

---

### 5.3 Construction Management
**Data Inputs:**
- Construction progress
- Quality control

---

## 🤖 STAGE 6: AI ASSISTANT (2 modules)

### 6.1 Opus AI Agent
**Data Inputs:**
- All deal data
- Market intelligence

**Data Insights to Display:**
- AI recommendations based on all data
- "What-if" scenario analysis

---

### 6.2 AI Recommendations
**Data Inputs:**
- Pattern matching across deals
- Best practices

**Data Insights to Display:**
- Similar successful deals
- Recommended actions

---

## 📊 SUMMARY: Data Flow Diagram

```
ATLANTA PROPERTIES (1,028 records)
    ↓
┌───────────────────────────────────┐
│ Property Intelligence Layer        │
├───────────────────────────────────┤
│ • Owner Seller Scoring            │
│ • Value-Add Scoring               │
│ • Density Analysis                │
│ • Submarket Benchmarks            │
│ • Tax Burden Analysis             │
│ • Vintage Cohort Performance      │
│ • Owner Portfolio Mapping         │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│ RENT COMPS (18 properties)        │
├───────────────────────────────────┤
│ • Competitive Rent Positioning    │
│ • Hidden Gem Detection            │
│ • Occupancy-Adjusted Rent         │
│ • Marketing Effectiveness         │
│ • Unit Mix Optimization           │
│ • Vintage Rent Premium            │
│ • Proximity-Adjusted Pricing      │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│ JEDI RE MODULES (25 modules)      │
├───────────────────────────────────┤
│ OVERVIEW & SETUP                  │
│ • Deal Overview: JEDI Score,      │
│   Seller Likelihood, Quick Stats  │
│ • Zoning: Density Analysis        │
│                                    │
│ MARKET RESEARCH                   │
│ • Market Intelligence: Benchmarks │
│ • Competition: Rent Matrix        │
│ • Supply: New Construction        │
│ • Trends: Vintage Performance     │
│                                    │
│ DEAL DESIGN                       │
│ • 3D Design: Density Optimization │
│ • Strategy: Value-Add Scoring     │
│ • Financial: PRO FORMA ⭐         │
│ • Exit: Cap Rate Trends           │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│ PRIMARY OUTPUTS                   │
├───────────────────────────────────┤
│ 1. Financial Model (Pro Forma)    │
│    • All data flows here          │
│    • IRR, Cash-on-Cash, Exit      │
│                                    │
│ 2. 3D Design Module               │
│    • Density targets              │
│    • Unit mix optimization        │
│    • Neighboring parcels          │
│                                    │
│ 3. Investment Decision            │
│    • BUY / PASS                   │
│    • Strategy recommendation      │
│    • Risk assessment              │
└───────────────────────────────────┘
```

---

## 🎯 IMPLEMENTATION PRIORITY

### Phase 1: Core Data Flows (Week 1)
1. **Market Intelligence → Financial Model**
   - Submarket benchmarks, cap rates, tax rates
   - **Impact:** Accurate underwriting

2. **Competition Analysis → Financial Model**
   - Rent positioning, occupancy, concessions
   - **Impact:** Revenue projections

3. **3D Design ← Density Analysis**
   - Current vs target density, unit mix
   - **Impact:** Development feasibility

### Phase 2: Strategic Enhancements (Week 2)
4. **Deal Overview ← All Modules**
   - JEDI Score composite
   - **Impact:** Quick deal screening

5. **Strategy Module ← Value-Add Scoring**
   - Investment thesis, comparable deals
   - **Impact:** Strategic decision-making

### Phase 3: Advanced Intelligence (Week 3-4)
6. **Risk Management ← Market Analysis**
   - Supply risk, cap rate risk, execution risk
   - **Impact:** Risk-adjusted returns

7. **Exit Strategy ← Cap Rate Trends**
   - Buyer market, timing, valuation
   - **Impact:** Exit planning

---

## ✅ NEXT STEPS

1. **Review this mapping with Leon** - Confirm data priorities
2. **Build Phase 1 data flows** - Financial + 3D modules first
3. **Create API layer** - Connect data sources to modules
4. **Update wireframes** - Implement enhanced designs
5. **Test end-to-end** - Verify data flows correctly

**Status:** Complete data-to-module mapping ready for implementation! 🚀
