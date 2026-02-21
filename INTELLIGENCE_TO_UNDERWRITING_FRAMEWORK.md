# JEDI RE — Intelligence-to-Underwriting Integration Framework
## How Derived Metrics Flow Into Market Research & Financial Projections

**Created:** 2026-02-21 04:36 EST  
**Source:** Leon's complete framework  
**Purpose:** The COMPLETE secret sauce - how intelligence becomes underwriting

---

## THE CORE CONCEPT

Every pro forma has assumptions. Every assumption is traditionally a gut call or a broker's claim. 

**Jedi RE replaces gut calls with computed intelligence** — but the key is understanding that derived metrics don't just sit in a dashboard. They overwrite specific cells in the pro forma and generate the scenarios for your sensitivity analysis.

### The Pipeline:

```
RAW DATA SOURCES
    ↓
DERIVED METRICS (the cross-referenced intelligence)
    ↓
MARKET RESEARCH LAYER (contextualizes the property within its submarket)
    ↓
ASSUMPTION ENGINE (translates intelligence into specific pro forma inputs)
    ↓
PRO FORMA LINE ITEMS (the actual cells in your financial model)
    ↓
SENSITIVITY SCENARIOS (AI-generated bull/base/bear cases with confidence scores)
    ↓
BROKER OM COMPARISON (AI projections vs. broker claims, with $ gap)
```

---

## PHASE 1: MARKET RESEARCH INTEGRATION

### How Derived Metrics Feed the Market Research Report

When a user selects a property or submarket, the Market Intelligence Agent runs the derived metrics and organizes them into a structured research output. 

This is the **"Section 3: Market Analysis"** of the Deal Deck.

---

### 1.1 Demand Assessment Module

| Derived Metric | What It Tells the Research Report | Confidence Tag |
|---|---|---|
| Jobs-to-Apartments Ratio (D×S-1) | "This submarket has 5.8 jobs per apartment unit — significantly above the 4.0 metro average, indicating structural undersupply" | HIGH — BLS + CoStar |
| New Jobs per New Unit (D×S-2) | "Over the last 12 months, the submarket added 7.2 new jobs for every new apartment delivered — demand is outpacing supply at the flow level" | HIGH |
| Real-Time Traffic Growth (T-1) | "Google traffic on adjacent roads is running 18% above the DOT's annual baseline — this corridor is growing faster than official data reflects" | MEDIUM — Depends on road segment matching |
| Traffic Acceleration (T-2) | "3-month traffic growth (22%) exceeds 12-month growth (14%) — demand is accelerating, not just growing" | MEDIUM |
| Digital-to-Physical Divergence (T-3) | "Website traffic for properties in this area is growing 35% while road traffic is growing 14% — significant out-of-market search interest suggests migration-driven demand" | HIGH — Strong migration signal |
| Demand Momentum Score (P-4) | "Composite score: 78/100 — traffic rising, search interest rising, job growth above 2%. All three demand vectors are positive" | HIGH — Triple confirmation |
| Rent-to-Mortgage Discount (R-3) | "Renting is 34% cheaper than buying equivalent housing — structural renter demand is locked in at current interest rate levels" | HIGH — Freddie Mac + Zillow |

**Research Report Output Example:**

> **DEMAND VERDICT: STRONG (Confidence: 82%)**
> 
> This submarket exhibits robust demand fundamentals across all measured vectors. The jobs-to-apartments ratio of 5.8x (vs. 4.0x metro avg) indicates structural undersupply. Real-time traffic is running 18% above DOT baselines and accelerating (+22% vs +14% on a 3mo/12mo basis). Digital search interest from outside the market is growing at 2.5x the rate of local physical traffic, suggesting meaningful inbound migration not yet reflected in Census data.
> 
> Renting remains 34% cheaper than buying, providing a structural floor under rental demand. Combined Demand Momentum Score: 78/100.

---

### 1.2 Supply Risk Assessment Module

| Derived Metric | What It Tells the Research Report |
|---|---|
| Migration-to-Supply Ratio (D×S-3) | "3.2 net migrants per pipeline unit — inbound migration exceeds housing construction" |
| Absorption Runway (D×S-5) | "At current absorption velocity (180 units/month), the 3,200-unit pipeline represents 17.8 months of supply — moderate but manageable" |
| Supply Delivery Clustering (S-1) | "WARNING: 3 projects (1,400 total units) are scheduled to deliver within the same 6-month window in Q3-Q4 2026. Temporary supply pressure expected" |
| Concession Drag Rate (R-5) | "Current concession drag is 3.8% of GPR — market is tighter than it appears based on concession-adjusted occupancy" |
| Concession Velocity (N-1) | "Concession values have peaked and are declining at -$12/month over the last 3 months — market is recovering" |
| Permit Momentum (S-5) | "Permit filings in trailing 3 months are at 0.65x the 12-month rate — developers are pulling back, which is bullish for existing properties over a 24-36 month horizon" |
| Construction Cost vs. Rent Yield (S-3) | "New construction yield on cost is 5.2% vs. existing cap rate of 5.8% — building is less attractive than buying, which suppresses future supply" |

**Research Report Output:**

> **SUPPLY VERDICT: MODERATE RISK (Confidence: 75%)**
> 
> The pipeline of 3,200 units represents 17.8 months at current absorption. However, two mitigating factors: (1) permit momentum has declined to 0.65x, indicating developer pullback, and (2) new construction yields (5.2%) are below existing acquisition cap rates (5.8%), making new development less attractive. A near-term risk exists in Q3-Q4 2026 when 1,400 units deliver simultaneously within a 3-mile radius. Concession drag is moderate at 3.8% but declining — market is recovering from peak softness.

---

### 1.3 Pricing Power Assessment Module

| Derived Metric | What It Tells the Research Report |
|---|---|
| Rent Growth vs. Wage Growth Spread (R-1) | "Wages are growing 4.2% while rents are growing 3.1% — organic pricing power exists without affordability erosion" |
| Affordability Absorption Threshold (R-2) | "Median renter can afford $1,520/mo (at 30% of income). Current avg rent is $1,340. Headroom: $180/unit before hitting affordability ceiling" |
| Vintage Convergence Rate (R-4) | "Class A-to-C spread is widening (now 52% premium vs. 47% a year ago) — value-add renovations are capturing increasing premiums" |
| Traffic-to-Rent Elasticity (T-4) | "Elasticity of 2.3 — each 1% increase in area traffic is associated with only 0.43% rent growth. Rents haven't caught up to traffic growth — embedded pricing power" |
| Rent Acceleration (R-6) | "Rent growth is accelerating: Q4 was +3.1% annualized vs. Q3 at +2.4%. Positive inflection underway" |

---

## PHASE 2: THE ASSUMPTION ENGINE

**This is where intelligence becomes underwriting.**

Each derived metric maps to a specific pro forma assumption cell, replacing the traditional approach of "broker says 3% rent growth, so I'll use 3%."

---

### 2.1 Rent Growth Assumption

**Traditional approach:** Broker OM says 3.5% annual rent growth. You use 3.5% or haircut to 3%.

**Jedi RE approach:** The AI synthesizes multiple signals into a data-driven rent growth projection with a confidence-bounded range.

```
RENT GROWTH ASSUMPTION ENGINE
═══════════════════════════════

Inputs:
├── R-1: Rent vs. Wage Spread → +1.1% headroom (wages > rents)
├── R-2: Affordability Threshold → $180/unit headroom (11.8% below ceiling)
├── R-6: Rent Acceleration → Positive (accelerating from 2.4% → 3.1%)
├── T-1: Traffic Growth Rate → +18% (strong demand growth)
├── T-4: Traffic-to-Rent Elasticity → 2.3 (rents haven't caught up)
├── R-4: Vintage Convergence → Widening (value-add premiums growing)
├── D×S-2: New Jobs per New Unit → 7.2 (demand outpacing supply)
├── P-3: Regression Forecast → 3.4% ± 0.8% (model output)
└── D×S-5: Absorption Runway → 17.8 months (moderate supply)

Synthesis Logic:
├── Base factors all positive → UPWARD bias
├── Absorption runway moderate → TEMPER slightly
├── Affordability headroom exists → NO ceiling constraint
├── Traffic elasticity high → LAGGED pricing power to capture
└── Acceleration positive → TREND strengthening

AI OUTPUT:
┌────────────────────────────────────────────────────────┐
│                                                        │
│  RENT GROWTH PROJECTION                                │
│                                                        │
│  Year 1: 3.5%  (confidence: 78%)                      │
│  Year 2: 3.8%  (traffic catch-up + value-add ramp)    │
│  Year 3: 3.2%  (supply delivery drag from S-1)        │
│  Year 4: 3.5%  (supply absorbed, normal trajectory)   │
│  Year 5: 3.0%  (revert toward long-term mean)         │
│                                                        │
│  vs. BROKER OM: 3.5% flat all 5 years                 │
│  vs. AI: 3.5% → 3.8% → 3.2% → 3.5% → 3.0%            │
│                                                        │
│  KEY DIFFERENCE: AI projects a supply dip in Year 3   │
│  when 1,400 units deliver. Broker ignores this.       │
│                                                        │
│  CONFIDENCE: 78% (high data coverage, model validated │
│  on 3 prior submarket cycles)                         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Pro Forma Impact:**

This flows directly into the **Revenue line** of the pro forma. Each year's rent growth assumption is an editable cell that the AI pre-fills but the user can override.

---

### 2.2 Occupancy Assumption

```
OCCUPANCY ASSUMPTION ENGINE
═══════════════════════════════

Inputs:
├── P-5: Occupancy Trajectory Model → Projects 93.2% → 94.8% over 18 months
├── D×S-5: Absorption Runway → 17.8 months
├── S-1: Delivery Clustering → Q3-Q4 2026 pressure (1,400 units)
├── R-5: Concession Drag → 3.8% (moderate, declining)
├── N-1: Concession Velocity → Declining (market recovering)
├── P-4: Demand Momentum Score → 78/100 (strong)
└── T-1: Traffic Growth Rate → +18% (corridor growing)

AI OUTPUT:
┌────────────────────────────────────────────────────────┐
│                                                        │
│  OCCUPANCY PROJECTION                                  │
│                                                        │
│  Year 1: 93.5%  (current trajectory + ramp-up)        │
│  Year 2: 92.0%  (supply delivery impact, Q3-Q4)       │
│  Year 3: 94.0%  (supply absorbed)                     │
│  Year 4: 95.0%  (stabilized)                          │
│  Year 5: 95.0%  (stabilized)                          │
│                                                        │
│  vs. BROKER OM: 95% from Month 1                      │
│  vs. AI: Dips in Year 2 from supply delivery          │
│                                                        │
│  $ IMPACT: Year 2 occupancy of 92% vs. broker's 95%   │
│  costs approximately $150K in NOI (200 units × $62.50/│
│  unit/month × 12 months × 3% delta)                   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

### 2.3 Expense Growth Assumptions

```
EXPENSE ASSUMPTION ENGINE
═══════════════════════════════

Insurance Growth:
├── Market trend data (FL/TX +20-40%) → Use 15% Year 1, 10% thereafter
├── R-1: Wage Growth (staffing proxy) → Payroll +4.5%/year
└── Property tax reassessment risk → Model step-up to acquisition price

Controllable Expenses:
├── O-2: Expense Efficiency Gap → Subject OER 47% vs comp median 42%
│        = $100K in recoverable NOI
├── O-4: Turnover Cost Impact → Turnover eating 8.5% of NOI
│        Retention program could save $40K/year
└── O-1: Revenue Conversion Efficiency → 87% vs. 92% comp median
         = 5 points of GPR leakage to capture

AI OUTPUT:
┌────────────────────────────────────────────────────────┐
│                                                        │
│  EXPENSE PROJECTIONS                                   │
│                                                        │
│  Payroll: +4.5%/year (wage growth driven)             │
│  Insurance: +15% Year 1, +10% Year 2, +8% ongoing     │
│  Taxes: Step-up Year 1 (+$450/unit), then +3%         │
│  R&M: -5% Year 2 (post-renovation reduction)          │
│  Marketing: -20% Year 2 (organic demand from traffic) │
│  Turnover: -15% Year 2 (retention program assumed)    │
│                                                        │
│  TOTAL OER TRAJECTORY:                                 │
│  Year 1: 47% → Year 3: 43% → Year 5: 41%             │
│                                                        │
│  vs. BROKER OM: 40% from Day 1                        │
│  vs. AI: Gradual improvement from 47% → 41%           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

### 2.4 Exit Cap Rate Assumption

```
EXIT CAP ASSUMPTION ENGINE
═══════════════════════════════

Inputs:
├── Cap Rate Spread to Treasuries → Currently 180 bps (moderate)
├── Investor Activity Index (N-4) → 6.2% turnover (active market)
├── D×S-1: Jobs-to-Apartments Ratio → 5.8 (strong fundamentals)
├── P-3: Rent Growth Forecast → 3.0-3.8% (above national avg)
├── S-5: Permit Momentum → Declining (supply slowing)
└── Interest rate forward curve → Fed projections + market forwards

AI OUTPUT:
┌────────────────────────────────────────────────────────┐
│                                                        │
│  EXIT CAP RATE PROJECTION (5-Year Hold)                │
│                                                        │
│  Base Case: 5.25%  (10 bps compression from 5.35%)    │
│  Bull Case: 4.90%  (rate cuts + demand acceleration)  │
│  Bear Case: 5.75%  (rates stay elevated)              │
│                                                        │
│  vs. BROKER OM: 5.0% exit cap                         │
│  vs. AI Base: 5.25% (adds ~$1.5M to purchase price    │
│               needed to hit same IRR target)           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

### 2.5 Value-Add Premium Assumption

```
VALUE-ADD ASSUMPTION ENGINE
═══════════════════════════════

Inputs:
├── R-4: Vintage Convergence Rate → A-to-C spread widening (value-add working)
├── Apartments.com: Renovated comp rents → $1,620 vs unrenovated $1,340 = $280 gap
├── R-2: Affordability Threshold → $180 headroom (ceiling check)
├── O-1: Revenue Conversion Efficiency → 87% (room to capture more GPR)
└── Actual renovation premiums from Jedi RE user network → $180-220/unit median

AI OUTPUT:
┌────────────────────────────────────────────────────────┐
│                                                        │
│  RENOVATION PREMIUM PROJECTION                         │
│                                                        │
│  Achievable premium: $175-225/unit/month               │
│  AI recommended: $200/unit (conservative)              │
│  Renovation cost: $18,000/unit                         │
│  Annualized ROI: 13.3% ($200 × 12 / $18K)             │
│                                                        │
│  NOTE: Affordability ceiling is $180 above current rent│
│  but renovation pushes into Class B+ territory where   │
│  the ceiling is higher ($1,620 achievable vs $1,520   │
│  affordability limit at current class)                 │
│                                                        │
│  vs. BROKER OM: $250/unit premium                     │
│  vs. AI: $200/unit (broker overstates by 25%)         │
│                                                        │
│  ANNUAL NOI DIFFERENCE: ($50 × 180 units × 12 months) │
│  = $108,000/year less NOI than broker projects        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## PHASE 3: PRO FORMA LINE ITEM MAPPING

**Here's the complete map of which derived metrics feed which pro forma line items:**

### Revenue Section

| Pro Forma Line | Traditional Input | Jedi RE Derived Input | Key Metrics Used |
|---|---|---|---|
| Gross Potential Rent | Broker OM asking rent × units | AI-verified market rent × units (scraper-validated, vintage-adjusted) | Apartments.com scraper, R-4 (vintage convergence) |
| Rent Growth (Year 1-5) | Broker says 3-4% flat | AI regression with supply-adjusted trajectory | P-3, R-1, R-6, T-1, T-4, D×S-2, D×S-5, S-1 |
| Vacancy Loss | Broker says 5% (95% occ) | AI occupancy trajectory with supply delivery timing | P-5, D×S-5, S-1, N-1, P-4 |
| Concession Loss | Broker says $0 (assumes burn-off) | AI concession trajectory based on supply timing and market momentum | R-5, N-1, S-1 |
| Loss-to-Lease | Broker says "below market" | AI-quantified gap with vintage-adjusted comps and affordability ceiling | Scraper, R-2, R-4 |
| Bad Debt | Broker says 1-2% | AI-adjusted for affordability stress and market employment health | R-2, D×S-1 (jobs ratio), BLS data |
| Other Income | Broker estimate | AI-validated against comp set other income per unit | User network benchmarks |
| Renovation Premium | Broker says $200-250/unit | AI-validated against achieved premiums, adjusted for affordability ceiling | R-4, R-2, O-1, user network data |

### Expense Section

| Pro Forma Line | Traditional Input | Jedi RE Derived Input | Key Metrics Used |
|---|---|---|---|
| Payroll Growth | 3% assumed | Wage growth in submarket from BLS + staffing ratio benchmarks | BLS CES, O-2, O-3 |
| Insurance Growth | 5% assumed | Actual market trend data (can be 20-40% in FL/TX/LA) | Insurance trend data, news intelligence |
| Property Tax Step-Up | Sometimes ignored | AI models reassessment to acquisition price + county millage rate | County assessor data, acquisition price |
| R&M Trajectory | Flat or +3% | Declines post-renovation, increases with deferred maintenance age | Building age, renovation status, O-2 |
| Marketing Spend | Flat | Decreases as traffic/demand grows; increases if supply delivers nearby | T-1, S-1, O-3 |
| Turnover Cost | Often ignored | Modeled as function of retention rate × turn cost per unit | O-4, lease renewal rate |
| Total OpEx / OER | Broker uses stabilized OER | AI models OER trajectory from current → optimized with timing | O-1, O-2, comp set benchmarks |

### Returns Section

| Pro Forma Line | Traditional Input | Jedi RE Derived Input | Key Metrics Used |
|---|---|---|---|
| Exit Cap Rate | Broker assumes compression | AI models based on interest rate forwards, market liquidity, fundamentals | Cap spread, N-4, D×S-1, rate curve |
| Exit Price | Stabilized NOI ÷ exit cap | AI-projected Year 5 NOI (with all above adjustments) ÷ AI exit cap | All of the above |
| IRR | Broker shows 18%+ | AI shows realistic IRR with data-backed assumptions | All combined |
| Cash-on-Cash | Based on broker NOI | Based on AI NOI trajectory | All combined |
| Equity Multiple | Based on broker exit | Based on AI exit with sensitivity ranges | All combined |

---

## PHASE 4: SENSITIVITY ANALYSIS (AI-GENERATED SCENARIOS)

**This is where the derived metrics generate scenarios automatically instead of the traditional "±5% on everything."**

### Scenario Generation Logic

Instead of arbitrary sensitivity ranges, Jedi RE generates scenarios based on **what could actually happen** according to the data:

```
BULL CASE (Probability: 20%)
Trigger: Traffic acceleration continues + permit pullback deepens
├── Rent Growth: +4.2% (traffic catch-up + limited new supply)
├── Occupancy: 95.5% (demand overwhelms supply)
├── Concessions: Eliminated by Month 8
├── Exit Cap: 4.90% (strong fundamentals attract institutional capital)
└── IRR: 17.2%

BASE CASE (Probability: 55%)
Trigger: Current trends continue, supply delivers on schedule
├── Rent Growth: +3.5% Year 1, dips Year 3 per supply model
├── Occupancy: 93.5% → 92% → 94% → 95% → 95%
├── Concessions: Burn off over 12 months, spike in Year 2 briefly
├── Exit Cap: 5.25%
└── IRR: 13.5%

BEAR CASE (Probability: 25%)
Trigger: Supply delivers faster + rates stay elevated + job growth slows
├── Rent Growth: +2.0% (affordability pressure + supply competition)
├── Occupancy: 91% Year 2 (heavy supply + demand slowdown)
├── Concessions: Persist at 4-6% of GPR through Year 3
├── Exit Cap: 5.75% (elevated rates compress values)
└── IRR: 8.8%

PROBABILITY-WEIGHTED IRR: 13.1%
```

### What Makes This Different From a Spreadsheet Sensitivity

**Traditional sensitivity:** "What if rent growth is 2% instead of 3%?" — no reason given.

**Jedi RE sensitivity:** "If the 1,400 units in the delivery cluster (S-1) absorb slower than the historical 180/month rate (D×S-5) AND job growth decelerates from 3.2% to 1.8% (BLS trend), THEN rent growth drops to 2% in Year 2-3 and occupancy dips to 91%." — every scenario has a data-backed narrative.

---

## PHASE 5: BROKER OM COMPARISON ENGINE

The final output is the side-by-side that already exists in your wireframes, but now powered by **computed intelligence** rather than manual analysis:

```
┌─────────────────────────────┬──────────────────────────────────────────┐
│ BROKER OM ASSUMPTION        │ JEDI RE AI PROJECTION                    │
├─────────────────────────────┼──────────────────────────────────────────┤
│                             │                                          │
│ Rent Growth: 3.5% flat      │ 3.5% → 3.8% → 3.2% → 3.5% → 3.0%       │
│                             │ ⚠️ Year 3 dip from supply delivery S-1   │
│                             │                                          │
│ Occupancy: 95% from Day 1   │ 93.5% → 92% → 94% → 95% → 95%          │
│                             │ ⚠️ Year 2 supply impact not in OM        │
│                             │                                          │
│ Reno Premium: $250/unit     │ $200/unit (ceiling: R-2, comps: scraper)│
│                             │ ⚠️ Broker overstates by $50/unit         │
│                             │                                          │
│ Exit Cap: 5.0%              │ Base: 5.25% | Range: 4.90-5.75%        │
│                             │ ⚠️ 25 bps difference = ~$2M on exit value│
│                             │                                          │
│ Pro Forma NOI (Yr 3): $2.8M │ AI NOI (Yr 3): $2.45M                   │
│                             │ ⚠️ $350K gap from occ + reno + expenses  │
│                             │                                          │
│ Projected IRR: 18%          │ AI Base Case IRR: 13.5%                 │
│                             │ AI Prob-Weighted IRR: 13.1%             │
│                             │                                          │
│ Asking Price: $45M          │ AI Fair Value: $38-40M                  │
│                             │ ✓ At $39M, deal works at 13.5% IRR      │
│                             │                                          │
└─────────────────────────────┴──────────────────────────────────────────┘

NEGOTIATION LEVERAGE:
• Supply risk not disclosed in OM → $2-3M repricing justified
• NOI overstated by ~$350K → $5-6M at market cap rate
• Combined negotiation basis: $6-7M below ask
```

---

## IMPLEMENTATION: HOW THIS WORKS IN THE PLATFORM UI

### Step 1: User Selects Property

User clicks on a property or enters an address. The system identifies the trade area and pulls all available data.

### Step 2: Market Research Auto-Generates

The Market Intelligence Agent runs all derived metrics for that trade area. Results populate the **"Market Analysis"** section of the Deal Deck with confidence scores.

### Step 3: Pro Forma Pre-Fills

The Assumption Engine translates the market research into specific pro forma assumptions. Each assumption cell has **two values:**

- **AI Suggested:** The data-driven projection (blue text, editable)
- **Broker OM:** The broker's claim (gray text, for comparison)

The user can accept the AI suggestion, accept the broker's number, or enter their own — but they can always see the data backing the AI's recommendation by clicking the cell.

### Step 4: Scenarios Auto-Generate

Based on the derived metrics and their ranges/trajectories, the system generates Bull/Base/Bear scenarios with probabilities and narratives. The user can adjust scenario parameters.

### Step 5: Returns Calculate with Provenance

Every return metric (IRR, CoC, equity multiple) shows not just the number but **the key assumptions that drive it** and **which derived metrics informed those assumptions**.

Full data lineage from raw source to final IRR.

### Step 6: Broker Comparison Generates

The side-by-side comparison auto-populates, highlighting every assumption where the AI and the broker disagree, quantifying the dollar impact of each disagreement.

---

## THE USER EXPERIENCE IN ONE SENTENCE

**Instead of staring at a broker OM and guessing which assumptions are wrong, the user sees exactly which assumptions are wrong, why they're wrong, what the data says the right number is, and how that changes the deal price.**

---

## KEY TECHNICAL REQUIREMENTS

### Database

1. **Metric calculations** must be stored with timestamp + source data references
2. **Assumption provenance** - every pro forma cell needs to track which metrics influenced it
3. **Scenario definitions** - Bull/Base/Bear triggers stored as rules, not hardcoded
4. **Broker OM parsing** - OCR/AI to extract broker assumptions from PDFs

### API Layer

1. **Metric → Assumption translation** - Engine that takes metric values and produces assumption ranges
2. **Scenario generator** - Takes current metrics + ranges → produces 3 scenarios with probabilities
3. **Comparison API** - Side-by-side diff between broker assumptions and AI projections
4. **Provenance API** - "Show me why" endpoint for any assumption

### Frontend

1. **Editable pro forma** with AI suggestions visible inline
2. **Metric cards** that link to the pro forma cells they influence
3. **Scenario tabs** (Bull/Base/Bear) with narrative explanations
4. **Broker comparison view** with dollar gap highlighting
5. **Confidence indicators** on every assumption

---

## NEXT STEPS

1. **Expand database schema** to include assumption_engine tables
2. **Build assumption translation layer** (metrics → pro forma cells)
3. **Create scenario generation engine** with probability calculation
4. **Build broker OM comparison API**
5. **Design pro forma UI** with inline AI suggestions
6. **Implement data lineage tracking** (provenance)

This is the complete intelligence-to-underwriting pipeline. Every other feature in JEDI RE feeds into or builds upon this core flow.

---

**This is the moat. This is what nobody else has.**
