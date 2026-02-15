# 🏛️ Property Records & Comps Tab - UI/UX Design Spec

**Purpose:** Display public property records, comparable sales, and tax analysis  
**Data Source:** Municipal property assessor websites (scraped)  
**Users:** Deal underwriters needing comparable transaction data  
**Context:** Tab 7 in Market Research Dashboard

---

## 📊 Tab Layout

### **Hero Metrics** (Top Row)
```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ RECENT SALES     │ MEDIAN $/UNIT    │ CAP RATE TREND   │ AVG HOLD PERIOD │
│                  │                  │                  │                  │
│   12 sales       │   $185,000       │  5.2% → 4.8%     │   7.3 years     │
│   Last 12 mo     │   +8.2% YoY ✅   │  Compressing ⚠️   │   Institutional │
│   3mi radius     │   vs $171k '25   │  Buyer demand    │   dominated     │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### **Two-Column Layout**

```
┌─────────────────────────────────────────────────────────────────┐
│  LEFT COLUMN (60%)                 │  RIGHT COLUMN (40%)        │
├────────────────────────────────────┼────────────────────────────┤
│                                    │                            │
│  COMPARABLE SALES TABLE            │  SUBJECT PROPERTY CARD     │
│  (Interactive, sortable)           │  (Our target property)     │
│                                    │                            │
│  [Filters]                         │  Assessed Value: $45.2M    │
│  • Radius: [3mi ▼]                 │  Annual Taxes: $486,720    │
│  • Date: [12mo ▼]                  │  Tax Rate: 1.08%          │
│  • Type: [All ▼]                   │  Owner: ABC Properties LLC │
│  • Size: [100-300 units]           │  Owned Since: Jan 2018    │
│                                    │  Hold Period: 8.1 years   │
│  Property          Sale    Price   │                            │
│  Buckhead Apts     Jan'26  $42.5M  │  Last Sale: $38.5M (2018) │
│  Peachtree Place   Nov'25  $38.2M  │  Appreciation: +17.4%     │
│  Midtown Gardens   Sep'25  $51.0M  │  Annual: +2.0%            │
│  ...                               │                            │
│                                    │  ──────────────────────    │
│  [12 comparable properties]        │                            │
│                                    │  TAX BURDEN ANALYSIS       │
│  ──────────────────────────────    │  Subject: $2,840/unit/yr  │
│                                    │  Market:  $2,750/unit/yr  │
│  PRICE TREND CHART                 │  Delta: +3.3% above ⚠️     │
│  [Interactive line chart]          │                            │
│  $/Unit over 24 months             │  Next Reassess: 2027      │
│                                    │  Risk: MODERATE           │
│  ──────────────────────────────    │                            │
│                                    │  ──────────────────────    │
│  TAX COMPARISON TABLE              │                            │
│  [County-level tax analysis]       │  OWNERSHIP INSIGHTS        │
│                                    │  Type: LLC (Institutional) │
│  ──────────────────────────────    │  Location: Out-of-state   │
│                                    │  Portfolio: 12 properties │
│  TRANSACTION VELOCITY              │  Motive: Likely hold      │
│  [Quarterly sales volume chart]    │                            │
│                                    │                            │
└────────────────────────────────────┴────────────────────────────┘
```

---

## 🎯 Section 1: Comparable Sales Table

### **Interactive Table** (Default: sorted by date, descending)
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Property Name      │ Address              │ Sale Date │ Price    │ Units │ $/Unit  │ Cap Rate │ Taxes/Unit │ Hold │ View │
├────────────────────┼──────────────────────┼───────────┼──────────┼───────┼─────────┼──────────┼────────────┼──────┼──────┤
│ Buckhead Apts      │ 3400 Peachtree Rd    │ Jan 2026  │ $42.5M   │ 226   │ $188k ↑ │ 4.7%     │ $2,840     │ 8.2y │ [📍] │
│ Peachtree Place    │ 1850 Peachtree St    │ Nov 2025  │ $38.2M   │ 200   │ $191k ↑ │ 4.9%     │ $2,650     │ 5.1y │ [📍] │
│ Midtown Gardens    │ 950 W Peachtree St   │ Sep 2025  │ $51.0M   │ 300   │ $170k   │ 5.1%     │ $3,100     │ 12.4y│ [📍] │
│ Lenox Pointe       │ 3478 Lenox Rd        │ Aug 2025  │ $28.9M   │ 168   │ $172k   │ 5.0%     │ $2,590     │ 6.8y │ [📍] │
│ Piedmont Heights   │ 1820 Piedmont Ave    │ Jun 2025  │ $63.2M   │ 348   │ $182k ↑ │ 4.8%     │ $2,910     │ 9.3y │ [📍] │
│ Colony Square      │ 1197 Peachtree St    │ May 2025  │ $45.8M   │ 264   │ $173k   │ 5.2%     │ $2,720     │ 15.1y│ [📍] │
│ Ansley Park        │ 1545 Peachtree St    │ Apr 2025  │ $52.3M   │ 287   │ $182k ↑ │ 4.9%     │ $2,880     │ 7.6y │ [📍] │
│ Brookwood Hills    │ 2285 Peachtree Rd    │ Mar 2025  │ $41.7M   │ 234   │ $178k   │ 5.0%     │ $2,795     │ 11.2y│ [📍] │
│ Atlantic Station   │ 1380 Atlantic Dr     │ Feb 2025  │ $68.5M   │ 392   │ $175k   │ 5.1%     │ $2,650     │ 4.9y │ [📍] │
│ Lindbergh City Ctr │ 2330 Cheshire Br Rd  │ Feb 2025  │ $37.9M   │ 208   │ $182k ↑ │ 4.8%     │ $2,840     │ 8.7y │ [📍] │
│ Buckhead Village   │ 3060 Peachtree Rd    │ Jan 2025  │ $49.2M   │ 276   │ $178k   │ 5.0%     │ $2,910     │ 13.5y│ [📍] │
│ Terminus 100       │ 3344 Peachtree Rd    │ Jan 2025  │ $56.8M   │ 312   │ $182k ↑ │ 4.9%     │ $2,730     │ 6.4y │ [📍] │
├────────────────────┴──────────────────────┴───────────┴──────────┴───────┴─────────┴──────────┴────────────┴──────┴──────┤
│ MEDIAN:                                     8 months     $46.5M     268     $180k     5.0%      $2,800       8.0y         │
│ AVERAGE:                                    7.2 months   $48.0M     268     $179k     4.95%     $2,793       9.1y         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- ↑ arrows indicate above-average $/unit
- Click property name → expand for full details
- Click [📍] → zoom to property on map
- Sort by any column
- Export to CSV/Excel

### **Filters Panel** (Above table)
```
┌────────────────────────────────────────────────────────────────┐
│ FILTERS                                                        │
├────────────────────────────────────────────────────────────────┤
│ Radius:        [3 miles ▼]  (1mi / 3mi / 5mi / Custom)       │
│ Date Range:    [12 months ▼] (6mo / 12mo / 24mo / All time)  │
│ Property Type: [Multifamily ▼] (MF / Office / Retail / All)  │
│ Unit Count:    [100] to [300] units                           │
│ Price Range:   [$20M] to [$70M]                               │
│ Cap Rate:      [4.0%] to [6.0%]                               │
│                                                                │
│ [Apply Filters]  [Clear All]  [Save as Preset]                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Section 2: Subject Property Card (Right Column)

### **Property Summary**
```
┌────────────────────────────────────────────────────────────┐
│ SUBJECT PROPERTY                                           │
│ Buckhead Heights                                           │
│ 3500 Peachtree Road NE, Atlanta, GA 30326                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 📊 ASSESSED VALUE                                          │
│ Land:              $12,400,000                             │
│ Improvements:      $32,800,000                             │
│ ──────────────────────────────────                         │
│ TOTAL:             $45,200,000                             │
│                                                            │
│ Market Value:      ~$52,000,000 (est. from sale)          │
│ Assessment Ratio:  87% of market value ✅                  │
│                                                            │
│ ──────────────────────────────────────────────             │
│                                                            │
│ 💰 TAX BURDEN                                              │
│ Annual Taxes:      $486,720                                │
│ Tax Rate:          1.08%                                   │
│ Per Unit:          $2,840/year                             │
│                                                            │
│ vs Market Median:  +$90/unit (+3.3%) ⚠️                    │
│                                                            │
│ Breakdown:                                                 │
│ • Fulton County:   $340,704 (70%)                         │
│ • City of Atlanta: $97,344 (20%)                          │
│ • School District: $48,672 (10%)                          │
│                                                            │
│ Next Reassessment: January 2027 (24 months)               │
│                                                            │
│ ──────────────────────────────────────────────             │
│                                                            │
│ 🏢 OWNERSHIP                                               │
│ Current Owner:     ABC Properties LLC                      │
│ Mailing Address:   Dallas, TX (out-of-state)              │
│ Owned Since:       January 2018 (8.1 years)               │
│                                                            │
│ Purchase Price:    $38,500,000                             │
│ Appreciation:      +$13,500,000 (+35.1%)                  │
│ Annual Return:     +3.7% (excl. NOI)                       │
│                                                            │
│ Likely Motive:     HOLD (institutional owner, long hold)   │
│                                                            │
│ ──────────────────────────────────────────────             │
│                                                            │
│ 📜 PROPERTY DETAILS                                        │
│ Parcel ID:         14-0089-0001-067-3                      │
│ Legal:             Lot 3, Block 67, Buckhead District      │
│ Zoning:            MR-5 (High-Density Residential)         │
│ Lot Size:          2.8 acres (121,968 sqft)               │
│ Building:          196,000 sqft (built 2010)               │
│ Stories:           6 floors                                │
│                                                            │
│ [View Full Tax Record] [View Deed History]                │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Section 3: Tax Burden Analysis

### **Comparative Tax Table**
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ TAX COMPARISON - Properties within 3 miles                                           │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Property              │ County      │ Tax Rate │ Annual Taxes │ Per Unit │ vs Market │
├───────────────────────┼─────────────┼──────────┼──────────────┼──────────┼───────────┤
│ Buckhead Heights (*)  │ Fulton      │ 1.08%    │ $486,720     │ $2,840   │ +3.3% ⚠️  │
│ Buckhead Apts         │ Fulton      │ 1.05%    │ $446,250     │ $1,975   │ -28.1% ✅ │
│ Peachtree Place       │ Fulton      │ 1.10%    │ $420,200     │ $2,101   │ -23.5% ✅ │
│ Midtown Gardens       │ Fulton      │ 1.12%    │ $571,200     │ $1,904   │ -32.9% ✅ │
│ Lenox Pointe          │ DeKalb      │ 1.25%    │ $361,250     │ $2,150   │ -24.3% ✅ │
│ Piedmont Heights      │ Fulton      │ 1.09%    │ $689,088     │ $1,980   │ -30.3% ✅ │
│ Colony Square         │ Fulton      │ 1.08%    │ $494,640     │ $1,874   │ -34.0% ✅ │
│ Ansley Park           │ Fulton      │ 1.07%    │ $559,610     │ $1,950   │ -31.3% ✅ │
│ Brookwood Hills       │ Fulton      │ 1.10%    │ $458,700     │ $1,960   │ -31.0% ✅ │
│ Atlantic Station      │ Fulton      │ 1.06%    │ $726,100     │ $1,853   │ -34.7% ✅ │
│ Lindbergh City Ctr    │ DeKalb      │ 1.22%    │ $462,380     │ $2,223   │ -21.7% ✅ │
│ Buckhead Village      │ Fulton      │ 1.09%    │ $536,280     │ $1,943   │ -31.6% ✅ │
│ Terminus 100          │ Fulton      │ 1.07%    │ $607,760     │ $1,948   │ -31.4% ✅ │
├───────────────────────┴─────────────┴──────────┴──────────────┴──────────┴───────────┤
│ MEDIAN:                                 1.09%      $494,640      $1,960     -31.0%    │
│ AVERAGE:                                1.10%      $526,348      $2,055     -27.6%    │
└──────────────────────────────────────────────────────────────────────────────────────┘

(*) Subject property shows ABOVE-AVERAGE tax burden per unit
```

### **Tax Insights Card**
```
┌────────────────────────────────────────────────────────────┐
│ 💡 TAX BURDEN INSIGHTS                                     │
├────────────────────────────────────────────────────────────┤
│ • Subject property has 38% HIGHER taxes per unit           │
│ • Likely due to recent assessment (2024 reassessment)     │
│ • Comparables show older assessments = lower burden       │
│                                                            │
│ 🎯 IMPACT ON NOI:                                          │
│ • $880/unit above market median                           │
│ • 171 units × $880 = -$150,480/year vs comps              │
│ • Cap at 5%: -$3.0M in value                              │
│                                                            │
│ ⚠️ RISKS:                                                  │
│ • Next reassessment: Jan 2027 (24 months)                 │
│ • If acquired at $52M: expect +15% assessment             │
│ • Potential increase: +$72,960/year (+$427/unit)          │
│                                                            │
│ 💰 PRO FORMA ADJUSTMENT:                                   │
│ Budget $3,313/unit/year for taxes (current + 2027 bump)   │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Section 4: Price Trend Chart

### **Interactive Line Chart** (24-month history)
```
Price per Unit ($000)
   195k │                                          ●
        │                                     ●  ↗
   190k │                                ●   ╱
        │                           ●   ╱
   185k │                      ●   ╱
        │                 ●   ╱
   180k │            ●   ╱        ← Median: $180k
        │       ●   ╱
   175k │  ●   ╱
        │ ╱
   170k │●
        │
   165k │
        └─────────────────────────────────────────────────→
         Jan'24    Jul'24    Jan'25    Jul'25    Jan'26

         Trend: +$25k/unit (+14.7%) over 24 months
         Rate:  +7.3% annual appreciation
         Recent acceleration: Last 6mo = +4.2%
```

**Features:**
- Hover over points → see property details
- Click point → jump to that sale in table
- Toggle trend line ON/OFF
- Compare to submarket average
- Show cap rate overlay (secondary Y-axis)

---

## 🎯 Section 5: Transaction Velocity

### **Quarterly Sales Volume Chart**
```
Sales Count per Quarter
   8 │
     │     ██
   6 │ ██  ██
     │ ██  ██  ██
   4 │ ██  ██  ██  ██
     │ ██  ██  ██  ██
   2 │ ██  ██  ██  ██  ██
     │ ██  ██  ██  ██  ██  ██
   0 │─────────────────────────────→
       Q1   Q2   Q3   Q4   Q1   Q2
      2025 2025 2025 2025 2026 2026

Total Sales (24mo): 47 properties
Average: 5.9 sales per quarter
Trend: STABLE (no slowdown)
```

### **Velocity Insights**
```
┌────────────────────────────────────────────────────────────┐
│ 📈 MARKET VELOCITY                                         │
├────────────────────────────────────────────────────────────┤
│ • Transaction volume: HEALTHY                              │
│ • 47 sales in 24 months (vs 52 in prior period)           │
│ • Average days on market: 87 days                          │
│ • Buyer competition: STRONG (multiple offers common)       │
│                                                            │
│ 💡 INSIGHTS:                                               │
│ • Institutional buyers: 68% of transactions                │
│ • All-cash deals: 34%                                      │
│ • Average hold period: 9.1 years (long-term plays)        │
│                                                            │
│ 🎯 MARKET CONDITION:                                        │
│ SELLER'S MARKET - High demand, fast sales, rising prices   │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Section 6: Ownership Intelligence

### **Owner Analysis** (Bottom section)
```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ OWNERSHIP PATTERNS IN SUBMARKET                                                    │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ Owner Type Distribution (12 comparable properties)                                 │
│                                                                                     │
│ Institutional (REIT/Fund):  ████████████████████  58%  (7 properties)             │
│ Private LLC (Multi-prop):   ████████              25%  (3 properties)             │
│ Individual/Family:          ████                  17%  (2 properties)             │
│                                                                                     │
│ ────────────────────────────────────────────────────────────────────────────       │
│                                                                                     │
│ Ownership Duration                                                                 │
│                                                                                     │
│ Average Hold: 9.1 years (long-term investment behavior)                           │
│ Median Hold:  8.0 years                                                           │
│ Range:        4.9 - 15.1 years                                                     │
│                                                                                     │
│ ────────────────────────────────────────────────────────────────────────────       │
│                                                                                     │
│ Out-of-State Owners: 9 of 12 (75%)                                                │
│ Top States: Texas (3), California (2), New York (2)                               │
│                                                                                     │
│ ────────────────────────────────────────────────────────────────────────────       │
│                                                                                     │
│ 💡 COMPETITIVE LANDSCAPE:                                                          │
│ • Market dominated by institutional capital                                        │
│ • Long hold periods indicate strong fundamentals                                  │
│ • Out-of-state interest shows national appeal                                     │
│ • Limited distressed sales (no foreclosures in 24mo)                              │
│                                                                                     │
│ 🎯 ACQUISITION STRATEGY:                                                            │
│ • Expect multiple bidders (institutional competition)                             │
│ • Sellers expect 4.5-5.0% cap rates (market standard)                            │
│ • Off-market deals may be key to winning                                          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Color System

### **Performance Indicators**
- 🟢 **Green (Good):** Tax burden below market, high appreciation, strong cap rate
- 🟡 **Amber (Caution):** At market average, moderate risk
- 🔴 **Red (Alert):** Tax burden above market, cap compression, high risk

### **Arrows**
- ↑ **Up Arrow:** Above average (price, taxes)
- ↓ **Down Arrow:** Below average
- ✅ **Checkmark:** Favorable condition
- ⚠️ **Warning:** Unfavorable condition

---

## 📱 Responsive Behavior

### **Desktop (>1200px)**
- Two-column layout (60/40 split)
- Full table with all columns
- Charts display inline

### **Tablet (768-1200px)**
- Single column layout
- Table scrolls horizontally
- Charts stack vertically

### **Mobile (<768px)**
- Cards replace table rows
- Swipe between comparable properties
- Compact subject property card
- Charts: simplified mobile versions

---

## 🔗 Integration Points

### **Links to Other Tabs**
```
From Property Records → Navigate to:
• Financial Model (import tax data)
• JEDI Score (ownership insights)
• Deal Timeline (reassessment dates)
```

### **Map Integration**
- Click [📍] → zoom to property on map
- Show all comps as map markers
- Color-coded by $/unit (green=low, red=high)
- Radius circle overlay

### **Export Options**
```
[Export to Excel] → Comparable sales table
[Export to PDF]   → Full report with charts
[Share Link]      → Shareable URL with filters
[Add to Report]   → Include in deal package
```

---

## 🎯 User Workflows

### **1. Quick Comp Check**
1. Open Property Records tab
2. See 12 recent comps immediately
3. Review median $/unit
4. Compare to subject property
5. **Time: 30 seconds**

### **2. Deep Tax Analysis**
1. Expand subject property card
2. Review tax breakdown
3. Compare to comps table
4. Read tax insights
5. Adjust pro forma assumptions
6. **Time: 3 minutes**

### **3. Market Velocity Assessment**
1. Scroll to transaction velocity chart
2. Review quarterly trends
3. Read ownership patterns
4. Understand buyer competition
5. **Time: 2 minutes**

### **4. Export for Underwriting**
1. Filter comps (radius, date, size)
2. Sort by $/unit
3. Click "Export to Excel"
4. Use in financial model
5. **Time: 1 minute**

---

## 🚀 Technical Implementation

### **Data Sources**
- Municipal property records (scraped)
- County assessor databases
- Deed transfer records
- Tax payment history

### **Update Frequency**
- **Sales data:** Weekly scrape of recent transactions
- **Tax assessments:** Quarterly updates
- **Ownership changes:** Real-time when available

### **Performance**
- Table: Virtualized scrolling (handle 100+ comps)
- Charts: Lazy load (render on scroll)
- API: <500ms response time for comp queries

### **Caching**
- Comp queries cached 24 hours
- Subject property data cached 7 days
- Charts pre-rendered server-side

---

## 📊 Success Metrics

### **User Engagement**
- % of deals with Property Records viewed
- Average time spent in tab
- Export frequency

### **Data Quality**
- % of comps with complete tax data
- Scraping success rate (target: >95%)
- Data freshness (avg days since last update)

### **Business Impact**
- Deals with tax analysis vs without
- Accuracy of NOI estimates
- Acquisition decisions influenced by comp data

---

## 🎯 Future Enhancements

### **Phase 2** (Post-MVP)
- [ ] Permit history timeline
- [ ] Violation tracking
- [ ] Zoning change alerts
- [ ] Automated valuation model (AVM)

### **Phase 3** (Advanced)
- [ ] Predictive reassessment modeling
- [ ] Tax appeal opportunities
- [ ] Portfolio-level tax optimization
- [ ] Historical ownership chains

---

**Design Complete:** Property Records & Comps tab  
**Estimated Build:** 3-4 days  
**Dependencies:** Municipal scraper (Agent 2), Integration layer (Agent 3)  
**Status:** Ready for development

