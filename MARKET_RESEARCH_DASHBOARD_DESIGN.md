# 🧠 Market Research Dashboard - UI/UX Design Spec

**Purpose:** Display Market Research Engine V2 output in actionable, visual format  
**Users:** Deal underwriters, analysts, portfolio managers  
**Context:** Viewed during deal evaluation, accessed from deal page

---

## 📊 Dashboard Layout

### **Three-Panel Layout** (Following JEDI RE standard)

```
┌─────────────────────────────────────────────────────────────────┐
│  MARKET RESEARCH - Buckhead Heights, Atlanta                    │
│  Generated: Feb 15, 2026 | Confidence: HIGH (4/5 sources)      │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                 │
│   LEFT PANEL   │              CENTER PANEL                      │
│   (25%)        │              (75%)                             │
│                │                                                 │
│  Quick Stats   │   [TAB 1: Supply Analysis]                     │
│  • Supply      │   [TAB 2: Demand Indicators]                   │
│  • Demand      │   [TAB 3: Per Capita Metrics]                  │
│  • Employment  │   [TAB 4: Employment Impact] ⭐ NEW            │
│  • Capacity    │   [TAB 5: Market Capacity]                     │
│                │   [TAB 6: Data Sources]                        │
│  Actions       │                                                 │
│  [Regenerate]  │   [Content based on active tab]               │
│  [Export PDF]  │                                                 │
│  [Share]       │                                                 │
│                │                                                 │
│  Related       │                                                 │
│  • JEDI Score  │                                                 │
│  • Traffic     │                                                 │
│  • Financial   │                                                 │
└────────────────┴────────────────────────────────────────────────┘
```

---

## 🎯 Tab 1: Supply Analysis

### **Hero Metrics** (Top Row)
```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ EXISTING MARKET  │ PIPELINE (0-2Y)  │ FUTURE (2-5Y)    │ SATURATION      │
│                  │                  │                  │                  │
│   900 units      │   425 units      │  1,911 units     │  2035           │
│   18 properties  │   47% ratio ⚠️    │  212% ratio 🚨   │  11.6 years     │
│   5.5% vacant    │   MEDIUM         │  HIGH RISK       │  to absorb      │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### **Visual: Supply Timeline**
```
Interactive timeline chart:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━→
NOW        2026         2028         2030         2035
│
├─ Current: 900 units
│
├─ Pipeline: +425 units (0-2 years)
│  │
│  └─ Under Construction: 245
│     Permitted: 180
│
└─ Future Supply: +1,911 units (2-5 years)
   │
   └─ Vacant parcels: 45
      Developable: 78 acres
      
   Saturation Point: 2035 ⚠️
```

### **Supply Breakdown Table**
```
┌─────────────────────────┬─────────┬──────────┬─────────────┐
│ Category                │ Units   │ % Exist. │ Timeline    │
├─────────────────────────┼─────────┼──────────┼─────────────┤
│ Current Market          │ 900     │ 100%     │ Now         │
│ Under Construction      │ 245     │ 27%      │ 6-12 mo     │
│ Permitted               │ 180     │ 20%      │ 12-24 mo    │
│ Vacant Parcels          │ 1,200   │ 133% ⚠️   │ 2-3 years   │
│ Underutilized           │ 711     │ 79%      │ 3-5 years   │
├─────────────────────────┼─────────┼──────────┼─────────────┤
│ TOTAL FUTURE SUPPLY     │ 2,336   │ 259% 🚨  │ By 2035     │
└─────────────────────────┴─────────┴──────────┴─────────────┘

⚠️ Future supply exceeds existing market by 2.6x
```

### **Key Insights Card**
```
┌────────────────────────────────────────────────────────────┐
│ 💡 SUPPLY INSIGHTS                                         │
├────────────────────────────────────────────────────────────┤
│ • Market is UNDERSUPPLIED today (5.5% vacancy)             │
│ • Pipeline adds 47% of existing market in 2 years          │
│ • Long-term: 1,911 buildable units = HIGH RISK             │
│ • Absorption rate: 201 units/year                          │
│ • Time to absorb all: 11.6 years                           │
│                                                             │
│ 🎯 RECOMMENDATION:                                          │
│ Current opportunity exists, but monitor future supply      │
│ carefully. Consider shorter hold period (5-7 years).       │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 2: Demand Indicators

### **Hero Metrics**
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ OCCUPANCY       │ RENT GROWTH     │ CONCESSIONS     │ COMPETITION     │
│                 │                 │                 │                 │
│   94.5% ✅      │   +5.2% YoY ✅  │   16.7% 😐      │   HIGH ⚠️       │
│   STRONG        │   ACCELERATING  │   3/18 props    │   18 props      │
│   DEMAND        │   HEALTHY       │   avg $500      │   in market     │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### **Rent Trend Chart**
```
Interactive line chart showing:
- 12-month rent history by bedroom type
- Growth rate trend line
- Benchmark comparison (submarket avg)
- Projected 6-month trend

Studio:  $1,350 → $1,425 (+5.6%)
1BR:     $1,850 → $1,947 (+5.2%) ━━━━━━━━━━━━━→
2BR:     $2,450 → $2,573 (+5.0%)
3BR:     $3,100 → $3,255 (+5.0%)
```

### **Market Health Score**
```
┌──────────────────────────────────────────────────────────┐
│ MARKET HEALTH: 82/100 ✅                                 │
├──────────────────────────────────────────────────────────┤
│ Occupancy:        ████████████████░░  94.5%   +20 pts   │
│ Rent Growth:      ██████████████░░░░  70%      +15 pts   │
│ Low Concessions:  ████████░░░░░░░░░░  40%      +10 pts   │
│ Demand Signals:   ██████████████████  100%     +20 pts   │
├──────────────────────────────────────────────────────────┤
│ Stress Signals: 2 detected                               │
│ • High concession rate (16.7%)                           │
│ • Aggressive rent growth may not be sustainable          │
└──────────────────────────────────────────────────────────┘
```

### **Rent Comparables**
```
┌────────────────────────────┬──────┬─────────┬──────────┬─────────┐
│ Property                    │ 1BR  │ 2BR     │ Occ %    │ Dist.   │
├────────────────────────────┼──────┼─────────┼──────────┼─────────┤
│ ⭐ This Deal               │ TBD  │ TBD     │ TBD      │ -       │
│ Elora at Buckhead          │ 1,950│ 2,650   │ 97%      │ 0.8 mi  │
│ Buckhead Grand             │ 1,825│ 2,550   │ 93%      │ 1.2 mi  │
│ Terminus Heights           │ 2,100│ 2,850   │ 96%      │ 0.5 mi  │
├────────────────────────────┼──────┼─────────┼──────────┼─────────┤
│ Market Average             │ 1,850│ 2,450   │ 94.5%    │ -       │
└────────────────────────────┴──────┴─────────┴──────────┴─────────┘
```

---

## 🎯 Tab 3: Per Capita Metrics

### **Hero Metrics**
```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│ CURRENT DENSITY      │ FUTURE DENSITY       │ AFFORDABILITY        │
│                      │                      │                      │
│  18.0 units/1000     │  64.7 units/1000 ⚠️  │  26.1% ✅            │
│  -49% vs benchmark ✅ │  +82% vs benchmark 🚨│  AFFORDABLE          │
│  UNDERSUPPLIED       │  OVERSUPPLIED        │  Median: $85K        │
└──────────────────────┴──────────────────────┴──────────────────────┘
```

### **Density Progression Chart**
```
Visual progression bar:

CURRENT STATE (Today)
Units per 1,000 people: 18.0
├─────────────────────────────────────────────────────────────┐
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 18.0       │
└─────────────────────────────────────────────────────────────┘
                                ↑ Benchmark: 28.3
                                
WITH PIPELINE (2 years)
Units per 1,000: 26.5
├─────────────────────────────────────────────────────────────┐
│ ████████████████████████████░░░░░░░░░░░░░░░░░░ 26.5 ✅     │
└─────────────────────────────────────────────────────────────┘

FULLY BUILT (5 years)
Units per 1,000: 64.7
├─────────────────────────────────────────────────────────────┐
│ ████████████████████████████████████████████████████ 64.7 🚨│
└─────────────────────────────────────────────────────────────┘
```

### **Per Capita Comparison Table**
```
┌────────────────────────┬─────────┬──────────┬───────────────┐
│ Metric                 │ Current │ Future   │ vs Benchmark  │
├────────────────────────┼─────────┼──────────┼───────────────┤
│ Units/1000 people      │ 18.0    │ 64.7     │ +82% 🚨       │
│ Units/100 households   │ 4.9     │ 17.5     │ +90% 🚨       │
│ Rent/Income ratio      │ 26.1%   │ TBD      │ Affordable ✅  │
│                        │         │          │               │
│ Population             │ 50,000  │ 52,500*  │ +5% growth    │
│ Households             │ 18,500  │ 19,400*  │               │
│ Median Income          │ $85,000 │ $89,000* │               │
└────────────────────────┴─────────┴──────────┴───────────────┘
* Projected
```

### **Affordability Analysis**
```
┌──────────────────────────────────────────────────────────┐
│ AFFORDABILITY BREAKDOWN                                   │
├──────────────────────────────────────────────────────────┤
│ Median Income:           $85,000/year                    │
│ Affordable Rent (30%):   $2,125/month                    │
│                                                           │
│ Market Average Rents:                                    │
│ • Studio: $1,350  ✅ (64% of affordable)                │
│ • 1BR:    $1,850  ✅ (87% of affordable)                │
│ • 2BR:    $2,450  ⚠️ (115% of affordable)               │
│ • 3BR:    $3,100  ❌ (146% of affordable)               │
│                                                           │
│ 💡 1BR units are at the sweet spot for median income    │
│    2BR+ may require dual incomes or higher earners       │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 4: Employment Impact ⭐ NEW

### **Hero Metrics**
```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│ JOBS PER UNIT        │ NEW JOBS (NEWS)      │ HOUSING DEMAND       │
│                      │                      │                      │
│  31.7 → 8.8 ✅       │  +8,500 jobs         │  +3,825 units        │
│  JOBS-RICH MARKET    │  Strong Growth       │  164% of supply ✅   │
│  Well above balanced │  12 months           │  STRONG DEMAND       │
└──────────────────────┴──────────────────────┴──────────────────────┘
```

### **Employment News Timeline**
```
Interactive timeline of employment events:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━→
PAST                    NOW                    FUTURE
│
├─ Nov 2024: Microsoft expansion
│  📈 +5,000 jobs → +2,250 units demand
│  Timeline: 12-18 months
│  Impact: STRONG
│
├─ Aug 2024: NCR HQ relocation  
│  📈 +3,500 jobs → +1,575 units demand
│  Timeline: 6-12 months
│  Impact: MODERATE
│
└─ TOTAL: +8,500 jobs → +3,825 units demand
```

### **Demand vs Supply Chart**
```
Bar chart comparison:

HOUSING DEMAND FROM EMPLOYMENT
████████████████████████████████  3,825 units

YOUR PIPELINE SUPPLY
████████████░░░░░░░░░░░░░░░░░░░░    425 units (11% of demand) ⚠️

YOUR TOTAL FUTURE SUPPLY
████████████████████████████░░░░  2,336 units (61% of demand) ✅

────────────────────────────────────────────────────────
COVERAGE:  164% (demand exceeds your full buildout)

💡 Employment growth validates development plan
```

### **Jobs-to-Housing Balance**
```
┌──────────────────────────────────────────────────────────┐
│ JOBS-TO-HOUSING RATIO ANALYSIS                           │
├──────────────────────────────────────────────────────────┤
│ Total Jobs in Market:     28,500                         │
│ Current Housing Units:    900                            │
│ Jobs per Unit (Current):  31.7 ✅ JOBS-RICH             │
│                                                           │
│ With Full Buildout:                                      │
│ Future Housing Units:     3,236 (900 + 2,336)          │
│ Jobs per Unit (Future):   8.8 ✅ Still above balanced   │
│                                                           │
│ Benchmark:                1.5 (balanced market)          │
│ Status:                   STRONG EMPLOYMENT SUPPORT      │
│                                                           │
│ 📊 Chart:                                                │
│ Current:  ████████████████████████████████████ 31.7     │
│ Future:   ████████████░░░░░░░░░░░░░░░░░░░░░░░ 8.8      │
│ Balanced: ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 1.5      │
└──────────────────────────────────────────────────────────┘
```

### **Employment Verdict**
```
┌──────────────────────────────────────────────────────────┐
│ 🎯 EMPLOYMENT IMPACT VERDICT                             │
├──────────────────────────────────────────────────────────┤
│ Demand/Supply Balance:  FAVORABLE ✅                     │
│                                                           │
│ Key Findings:                                            │
│ ✅ Strong job growth (8,500 new jobs in 12 months)      │
│ ✅ Generated housing demand (3,825 units) exceeds       │
│    your future supply (2,336 units) by 64%              │
│ ✅ Market remains jobs-rich even after full buildout    │
│                                                           │
│ Conclusion:                                              │
│ Employment growth STRONGLY SUPPORTS development.         │
│ Job-to-housing ratio validates supply expansion.         │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 5: Market Capacity

### **Hero Metrics**
```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│ ABSORPTION RATE      │ TIME TO SATURATE     │ MARKET MULTIPLIER    │
│                      │                      │                      │
│  201 units/year      │  11.6 years          │  3.6x ⚠️             │
│  Historical average  │  Saturation: 2035    │  Current → Future    │
│  Steady demand       │  Medium-term         │  HIGH GROWTH         │
└──────────────────────┴──────────────────────┴──────────────────────┘
```

### **Capacity Analysis**
```
┌──────────────────────────────────────────────────────────┐
│ CAN THE MARKET ABSORB THIS SUPPLY?                       │
├──────────────────────────────────────────────────────────┤
│ Current Market Size:     900 units                       │
│ Total Future Supply:     2,336 units                     │
│ Final Market Size:       3,236 units (3.6x growth) ⚠️    │
│                                                           │
│ Absorption Analysis:                                     │
│ • Current Rate:          201 units/year                  │
│ • Pipeline (425):        2.1 years to absorb ✅          │
│ • All Future (2,336):    11.6 years to absorb 😐         │
│                                                           │
│ Per Capita Check:                                        │
│ • Today:  18.0 units/1000  (UNDERSUPPLIED) ✅           │
│ • Future: 64.7 units/1000  (OVERSUPPLIED)  🚨           │
│ • Benchmark: 28.3 units/1000                            │
│                                                           │
│ Employment Support:                                      │
│ • Job Growth Demand: 3,825 units ✅                     │
│ • Your Future Supply: 2,336 units                       │
│ • Coverage: 164% (demand exceeds supply) ✅              │
└──────────────────────────────────────────────────────────┘
```

### **Capacity Verdict**
```
┌──────────────────────────────────────────────────────────┐
│ 📊 CAPACITY ASSESSMENT                                   │
├──────────────────────────────────────────────────────────┤
│ Status: MODERATE RISK 😐                                │
│                                                           │
│ Positive Factors:                                        │
│ ✅ Currently undersupplied (18 vs 28 benchmark)         │
│ ✅ Strong employment growth generates demand            │
│ ✅ Pipeline (2 years) well-supported                    │
│                                                           │
│ Risk Factors:                                            │
│ ⚠️ Long-term: 3.6x market growth is aggressive          │
│ ⚠️ Future density (64.7) exceeds benchmark by 82%       │
│ ⚠️ 11.6 years to full absorption is lengthy             │
│                                                           │
│ 💡 RECOMMENDATION:                                       │
│ Current opportunity exists due to undersupply.           │
│ Consider phased approach or shorter hold period          │
│ (5-7 years) to capitalize on near-term demand           │
│ while avoiding long-term oversupply risk.               │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 6: Data Sources

### **Source Status**
```
┌────────────────────────────┬──────────┬────────────┬─────────────┐
│ Data Source                │ Status   │ Records    │ Confidence  │
├────────────────────────────┼──────────┼────────────┼─────────────┤
│ 🏢 Apartment Locator AI    │ ✅ Active│ 18 props   │ HIGH (0.95) │
│ 🗺️ Zoning Intelligence     │ ✅ Active│ 45 parcels │ HIGH (0.90) │
│ 📰 News Intelligence        │ ✅ Active│ 12 events  │ MED (0.75)  │
│ 📊 Census API              │ ⏸️ Mock  │ Mock data  │ LOW (0.50)  │
│ 🏗️ Building Permits        │ ⏸️ Mock  │ Mock data  │ LOW (0.50)  │
└────────────────────────────┴──────────┴────────────┴─────────────┘

Overall Confidence: HIGH (3/5 sources active)
```

### **Data Freshness**
```
┌──────────────────────────────────────────────────────────┐
│ REPORT FRESHNESS                                         │
├──────────────────────────────────────────────────────────┤
│ Generated:        Feb 15, 2026 at 7:15 AM               │
│ Age:              2 hours ago ✅                         │
│ Expires:          Feb 16, 2026 at 7:15 AM (22h)         │
│ Cache Duration:   24 hours                              │
│                                                           │
│ Last Market Change: Feb 14, 2026 (Microsoft news)       │
│ Status: UP TO DATE ✅                                   │
└──────────────────────────────────────────────────────────┘
```

### **Actions**
```
┌─────────────────────────────────────────────┐
│ [🔄 Regenerate Report] Force refresh now    │
│                                              │
│ [📥 Download PDF] Export full report        │
│                                              │
│ [📊 View Raw Data] See source responses     │
│                                              │
│ [⚙️ Configure Sources] Enable/disable APIs  │
└─────────────────────────────────────────────┘
```

---

## 🎨 Design Tokens

### **Colors**
```
Risk Levels:
- 🚨 HIGH RISK:    #DC2626 (red-600)
- ⚠️ MEDIUM RISK:   #F59E0B (amber-500)
- 😐 MODERATE:      #6B7280 (gray-500)
- ✅ LOW RISK:      #10B981 (emerald-500)

Status:
- Active:  #10B981 (green)
- Warning: #F59E0B (amber)
- Error:   #DC2626 (red)
- Info:    #3B82F6 (blue)
```

### **Typography**
```
Hero Numbers: 32px, Bold, Tabular
Labels: 12px, Medium, Uppercase, Gray-500
Body: 14px, Regular
Insights: 14px, Medium, with emoji prefixes
```

### **Components**
```
- Metric Cards: Shadow-sm, rounded-lg, p-6
- Charts: Recharts library, responsive
- Tables: Striped rows, hover states
- Alerts: Colored left border, icon, dismissible
```

---

## 🔄 Interactions

### **Regenerate Report**
```
Action: Click "Regenerate Report" button
Effect:
1. Show loading spinner overlay
2. POST /api/market-research/generate/:dealId?force=true
3. Stream progress updates (optional)
4. Reload dashboard with fresh data
5. Show toast: "Market research updated successfully"
```

### **Export PDF**
```
Action: Click "Download PDF"
Effect:
1. Generate PDF with all 6 tabs
2. Include charts as images
3. Add metadata (date, confidence, sources)
4. Download: "Market_Research_Buckhead_Heights_2026-02-15.pdf"
```

### **Drill-Down**
```
Action: Click metric card (e.g., "1,911 units")
Effect:
1. Expand inline detail panel
2. Show calculation breakdown
3. Display related insights
4. Link to source data
```

---

## 📱 Responsive Behavior

### **Desktop (>1024px)**
- Full three-panel layout
- All charts visible
- Side-by-side comparisons

### **Tablet (768-1024px)**
- Two-panel layout (collapse left panel to accordion)
- Charts stack vertically
- Touch-friendly hit targets

### **Mobile (<768px)**
- Single column
- Hero metrics as swipeable cards
- Tabs as bottom navigation
- Simplified charts

---

## 🔗 Integration Points

### **From Deal Page**
```
Deal Details Page
  └─ [Market Research] button
       ↓
     Opens Market Research Dashboard (modal or full page)
```

### **To Financial Model**
```
Market Research Dashboard
  └─ [Use in Financial Model] button
       ↓
     Auto-populates:
     - Rent assumptions (from demand indicators)
     - Occupancy assumptions (from market health)
     - Growth rates (from trends)
     - Risk factors (from capacity analysis)
```

### **To JEDI Score**
```
Market Research data automatically feeds:
- Supply risk component
- Demand strength component
- Employment validation
- Per capita health check
```

---

## 🎯 User Stories

### **Story 1: Deal Underwriter**
```
As a deal underwriter,
I want to see if a market can absorb new supply,
So I can assess development feasibility.

Acceptance:
✅ View current vs future supply ratios
✅ See absorption timeline
✅ Understand per capita density
✅ Get clear risk assessment
```

### **Story 2: Portfolio Manager**
```
As a portfolio manager,
I want to compare markets across my pipeline,
So I can prioritize acquisitions.

Acceptance:
✅ Export report as PDF
✅ See confidence scores
✅ Compare employment growth
✅ Identify highest opportunity markets
```

### **Story 3: Financial Analyst**
```
As a financial analyst,
I want market data to feed into pro formas,
So I can model realistic scenarios.

Acceptance:
✅ See rent growth trends
✅ Understand occupancy dynamics
✅ Export data to Excel
✅ One-click import to financial model
```

---

**Next:** Traffic Prediction Interface Design

Status: ✅ Complete market research dashboard design  
Ready for: Frontend implementation  
Estimated build: 2-3 days for full dashboard
