# 🚶 Traffic Prediction Interface - UI/UX Design Spec

**Purpose:** Display property-level foot traffic predictions with validation data  
**Users:** Acquisition teams, leasing managers, retail analysts  
**Context:** Property evaluation, tenant mix planning, revenue modeling

---

## 📊 Interface Layout

### **Card-Based Dashboard** (Embedded in Property/Deal Page)

```
┌─────────────────────────────────────────────────────────────────┐
│  FOOT TRAFFIC PREDICTION - 123 Main St, Austin                 │
│  Last Updated: Feb 15, 2026 | Confidence: HIGH (78%)           │
│  [🔄 Update Prediction] [📥 Export] [📊 View History]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────┐      │
│   │         HERO METRIC (Large, Center)                 │      │
│   │                                                      │      │
│   │              2,847 WALK-INS/WEEK                    │      │
│   │                                                      │      │
│   │     Daily Avg: 407  |  Peak Hour: 41  |  78% conf. │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                  │
│   ┌──────────────────┬──────────────────┬──────────────────┐   │
│   │   BREAKDOWN      │   TEMPORAL       │   VALIDATION     │   │
│   │   Physical: 60%  │   Weekday: 446   │   Last: 2,650    │   │
│   │   Demand: 40%    │   Weekend: 356   │   Error: 7.4% ✅ │   │
│   └──────────────────┴──────────────────┴──────────────────┘   │
│                                                                  │
│   [TAB 1: Overview]  [TAB 2: Breakdown]  [TAB 3: Revenue]      │
│   [TAB 4: Validation]  [TAB 5: Comps]                          │
│                                                                  │
│   [Content based on active tab]                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 1: Overview

### **Hero Prediction Card**
```
┌──────────────────────────────────────────────────────────┐
│               🚶 WEEKLY FOOT TRAFFIC                     │
│                                                           │
│                    2,847 walk-ins                        │
│                                                           │
│  Daily Average: 407      Peak Hour: 41 (Fri 12-1pm)     │
│  Confidence: 78% (High)  Model: v1.0.0                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Mon   Tue   Wed   Thu   Fri   Sat   Sun         │  │
│  │  ███   ███   ███   ███   ████  ██    ██          │  │
│  │  420   425   440   455   480   380   340         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Peak Day: Friday (480 walk-ins)                         │
│  Peak Hour: 12:00 PM - 1:00 PM (lunch rush)             │
└──────────────────────────────────────────────────────────┘
```

### **Quick Stats Grid**
```
┌────────────────┬────────────────┬────────────────┬────────────────┐
│ PHYSICAL       │ MARKET DEMAND  │ SUPPLY IMPACT  │ CALIBRATED     │
│                │                │                │                │
│   1,680        │   1,520        │   +12%         │   2,847        │
│   Base traffic │   From growth  │   Adjustment   │   Final pred.  │
│   60% weight   │   40% weight   │   x1.12        │   ✅ Applied   │
└────────────────┴────────────────┴────────────────┴────────────────┘
```

### **Confidence Breakdown**
```
┌──────────────────────────────────────────────────────────┐
│ CONFIDENCE: 78% (High) ✅                                │
├──────────────────────────────────────────────────────────┤
│ Validation Data:     ████████████████░░  80%            │
│ Market Research:     ██████████████████  90%            │
│ Data Completeness:   █████████████░░░░░  65%            │
├──────────────────────────────────────────────────────────┤
│ What affects confidence:                                 │
│ ✅ 5 similar properties validated                       │
│ ✅ High-quality market research (90%)                   │
│ ⚠️ Missing transit ridership data                       │
│                                                           │
│ 💡 Add transit data to improve to 85% confidence        │
└──────────────────────────────────────────────────────────┘
```

### **Location Context**
```
┌──────────────────────────────────────────────────────────┐
│ PROPERTY CONTEXT                                         │
├──────────────────────────────────────────────────────────┤
│ Type:           Corner Retail                            │
│ Street Traffic: 22,500 ADT (arterial road)              │
│ Frontage:       120 feet                                 │
│ Corner:         ✅ Yes (captures 2 streets)              │
│                                                           │
│ Nearby:                                                  │
│ • 1,200 residential units (¼ mile)                      │
│ • 3,500 workers (¼ mile)                                │
│ • Bus stop: 300 feet (500 riders/day)                   │
│ • 12 competing properties (½ mile)                      │
│                                                           │
│ Market:         Downtown Austin, TX                      │
│ Submarket:      Strong demand, 8.8 jobs/unit            │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 2: Breakdown

### **Traffic Sources Chart**
```
Visual breakdown (stacked bar or pie chart):

TOTAL: 2,847 WEEKLY WALK-INS

Physical Traffic (1,680 walk-ins - 59%)
├─ Street Pedestrians: 850 walk-ins
│  └─ 22,500 ADT × 2% conversion × 7 days
│
├─ Residential: 720 walk-ins
│  └─ 1,200 units × 2.5 visits/week (¼ mi)
│     300 units × 0.8 visits/week (½ mi)
│
├─ Office Workers: 315 walk-ins
│  └─ 3,500 workers × 15% visit rate × 1.5 visits
│
└─ Transit: 135 walk-ins
   └─ 500 riders/day × 8% capture × 7 days

Market Demand (1,520 walk-ins - 41%)
├─ Employment Growth: 900 walk-ins
│  └─ +8,500 jobs → +127,500 retail trips
│     Your 3% share = 3,825 trips
│
├─ Population Growth: 420 walk-ins
│  └─ 50,000 pop × 3 trips × 3% share × 0.1
│
└─ Retail Demand: 200 walk-ins
   └─ New residents generating retail activity

Adjustments
└─ Supply-demand multiplier: +12% (undersupplied market)
```

### **Component Details Table**
```
┌──────────────────────────────┬────────┬─────────┬───────────────┐
│ Traffic Source               │ Weekly │ % Total │ Confidence    │
├──────────────────────────────┼────────┼─────────┼───────────────┤
│ PHYSICAL FACTORS             │ 1,680  │ 59%     │               │
│  └─ Street pedestrians       │   850  │ 30%     │ HIGH (ADT)    │
│  └─ Residential (¼ mi)       │   720  │ 25%     │ HIGH          │
│  └─ Office workers           │   315  │ 11%     │ MEDIUM        │
│  └─ Transit riders           │   135  │  5%     │ LOW (est.)    │
│                               │        │         │               │
│ MARKET DEMAND                │ 1,520  │ 41%     │               │
│  └─ Employment growth        │   900  │ 32%     │ HIGH          │
│  └─ Population growth        │   420  │ 15%     │ MEDIUM        │
│  └─ Retail demand            │   200  │  7%     │ MEDIUM        │
│                               │        │         │               │
│ BASE TOTAL                   │ 3,200  │ 112%    │               │
│ Supply-demand adjustment     │  ×1.12 │ +12%    │ HIGH          │
│ Calibration factors          │  ×0.94 │  -6%    │ Validated     │
│                               │        │         │               │
│ FINAL PREDICTION             │ 2,847  │ 100%    │ 78% (High)    │
└──────────────────────────────┴────────┴─────────┴───────────────┘
```

### **Sensitivity Analysis**
```
┌──────────────────────────────────────────────────────────┐
│ WHAT IF SCENARIOS                                        │
├──────────────────────────────────────────────────────────┤
│ Base Case:        2,847 walk-ins/week                    │
│                                                           │
│ If street traffic +20%:    3,051 walk-ins (+7%)         │
│ If no Microsoft jobs:      2,610 walk-ins (-8%)         │
│ If transit improved:       3,015 walk-ins (+6%)         │
│ If rainy weather (25%):    2,135 walk-ins (-25%)        │
│                                                           │
│ Range: 2,135 - 3,051 walk-ins                           │
│ Confidence interval: ± 280 walk-ins (±10%)              │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 3: Revenue Impact

### **Revenue Calculator** (Interactive)
```
┌──────────────────────────────────────────────────────────┐
│ REVENUE MODELING FROM FOOT TRAFFIC                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Weekly Walk-ins:      2,847                              │
│ Conversion Rate:      [12%] ◄──── Adjustable slider     │
│ Avg Transaction:      [$45.00] ◄─ Input field           │
│                                                           │
│ ═══════════════════════════════════════════════════════  │
│                                                           │
│ Weekly Revenue:       $15,372                            │
│ Monthly Revenue:      $66,611                            │
│ Annual Revenue:       $799,332                           │
│                                                           │
│ Revenue per Walk-in:  $5.40                              │
│ Revenue per Sq Ft:    $178.74 (if 4,500 SF)             │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### **Tenant Type Scenarios**
```
┌────────────────────┬──────────┬───────────┬──────────────┐
│ Tenant Type        │ Conv. %  │ Avg Sale  │ Weekly Rev.  │
├────────────────────┼──────────┼───────────┼──────────────┤
│ Coffee Shop        │ 15%      │ $8.50     │ $3,630       │
│ Quick Service      │ 12%      │ $12.00    │ $4,098       │
│ Fast Casual        │ 10%      │ $18.00    │ $5,125       │
│ Retail (apparel)   │ 8%       │ $65.00    │ $14,805      │
│ Retail (grocery)   │ 18%      │ $45.00    │ $23,057      │
│ Pharmacy           │ 6%       │ $28.00    │ $4,783       │
└────────────────────┴──────────┴───────────┴──────────────┘

💡 Best fit: Retail grocery (high conv., high traffic capacity)
```

### **Lease Pricing Calculator**
```
┌──────────────────────────────────────────────────────────┐
│ DATA-DRIVEN LEASE PRICING                                │
├──────────────────────────────────────────────────────────┤
│ Weekly Walk-ins:            2,847                        │
│ Tenant Revenue (grocery):   $23,057/week                 │
│ Annual Revenue:             $1,199,000                   │
│                                                           │
│ Recommended Rent Models:                                 │
│                                                           │
│ Fixed Rent (10% of revenue):                            │
│  → $119,900/year                                         │
│  → $26.64/SF/year (for 4,500 SF) ✅ MARKET RATE         │
│                                                           │
│ Percentage Rent (8% above $800K base):                  │
│  → Base: $800,000                                        │
│  → Overage: $399,000 × 8% = $31,920                     │
│  → Total: $831,920/year                                  │
│                                                           │
│ Walk-in-Based Rent ($4 per walk-in):                    │
│  → 2,847 × $4 × 52 weeks = $592,176/year                │
│  → $131.59/SF/year ⚠️ AGGRESSIVE                        │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 4: Validation Data

### **Validation Status**
```
┌──────────────────────────────────────────────────────────┐
│ PREDICTION VALIDATION                                    │
├──────────────────────────────────────────────────────────┤
│ Status:            📊 VALIDATION PROPERTY               │
│ Measurement:       Camera AI (95% confidence)           │
│ Data Points:       12 weeks                             │
│ Last Measured:     Feb 8-14, 2026                       │
└──────────────────────────────────────────────────────────┘
```

### **Prediction vs Actual Chart**
```
Line chart showing prediction accuracy over time:

Walk-ins
3,200 │
      │                          ━━━ Predicted
3,000 │     ━━━━━━━━━━━━━━━━━━━  ─── Actual
      │    ╱
2,800 │   ╱  ─ ─ ─ ─ ─ ─ ─ ─ ─
      │  ╱
2,600 │ ╱
      │╱
2,400 │
      └─────────────────────────────────────────►
       Week 1  Week 4  Week 8  Week 12

Accuracy improving over time ✅
Current MAPE: 7.4% (target: <20%)
```

### **Error Analysis**
```
┌──────────────────────────────────────────────────────────┐
│ VALIDATION RESULTS (Last 12 Weeks)                       │
├──────────────────────────────────────────────────────────┤
│ Average Error:          7.4% ✅ Excellent               │
│ Best Week:              2.1% (Week 10)                   │
│ Worst Week:             15.3% (Week 3, rainy)           │
│ Bias:                   BALANCED (3 over, 4 under)      │
│                                                           │
│ Recent Predictions:                                      │
│ Week 12: Pred 2,820 | Act 2,850 | Error +1.1% ✅       │
│ Week 11: Pred 2,875 | Act 2,780 | Error -3.3% ✅       │
│ Week 10: Pred 2,790 | Act 2,850 | Error +2.1% ✅       │
│ Week  9: Pred 2,900 | Act 2,695 | Error -7.1% ✅       │
│                                                           │
│ 💡 Model performing well. Continue validation.          │
└──────────────────────────────────────────────────────────┘
```

### **Calibration History**
```
┌──────────────────────────────────────────────────────────┐
│ MODEL IMPROVEMENTS                                       │
├──────────────────────────────────────────────────────────┤
│ Week 4:  Applied -8% global calibration                 │
│          (was overpredicting systematically)             │
│          MAPE: 18% → 12%                                │
│                                                           │
│ Week 8:  Applied -15% rain day adjustment               │
│          (rain reduces traffic more than expected)       │
│          Rain day MAPE: 25% → 8%                        │
│                                                           │
│ Week 12: Model performing at 7.4% MAPE ✅               │
│          No adjustments needed this week                 │
│                                                           │
│ Next retrain: March 1 (when 25+ weeks collected)        │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Tab 5: Comparable Properties

### **Traffic Comps Table**
```
┌────────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Property               │ Walk-ins │ Sq Ft    │ Per SF   │ Distance │
├────────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ ⭐ This Property       │ 2,847    │ 4,500    │ 0.63     │ -        │
│                         │          │          │          │          │
│ Similar Properties:    │          │          │          │          │
│ 234 Congress Ave       │ 3,200    │ 5,000    │ 0.64 ✅  │ 0.8 mi   │
│ (corner retail)        │          │          │          │          │
│                         │          │          │          │          │
│ 567 Guadalupe St       │ 2,100    │ 3,500    │ 0.60     │ 1.2 mi   │
│ (mid-block)            │          │          │          │          │
│                         │          │          │          │          │
│ 890 Lamar Blvd         │ 4,500    │ 8,000    │ 0.56     │ 2.1 mi   │
│ (strip center)         │          │          │          │          │
│                         │          │          │          │          │
│ Market Average         │ 3,267    │ 5,500    │ 0.60     │ -        │
└────────────────────────┴──────────┴──────────┴──────────┴──────────┘

💡 Your property is slightly above average per-SF traffic (0.63 vs 0.60)
```

### **Property Ranking**
```
┌──────────────────────────────────────────────────────────┐
│ TRAFFIC RANKING IN SUBMARKET                             │
├──────────────────────────────────────────────────────────┤
│ Your Property: #8 out of 23 properties                  │
│                                                           │
│ Percentile: 65th (better than 65% of properties)        │
│                                                           │
│ Above you:                                               │
│ #1: 890 Lamar (4,500) - Major strip center             │
│ #2: 101 Congress (4,200) - Corner + transit            │
│ ...                                                      │
│                                                           │
│ Below you:                                               │
│ #9: 456 Red River (2,600) - Mid-block                  │
│ #10: 789 Brazos (2,400) - Side street                  │
│ ...                                                      │
└──────────────────────────────────────────────────────────┘
```

---

## 🎨 Design Components

### **Color System**
```
Traffic Levels:
- 🟢 HIGH (>3,500):     #10B981 (emerald-500)
- 🟡 MEDIUM (2,000-3,500): #F59E0B (amber-500)
- 🔴 LOW (<2,000):      #DC2626 (red-600)

Confidence:
- High (>75%):  #10B981 (green)
- Medium (50-75%): #F59E0B (amber)
- Low (<50%):   #DC2626 (red)

Validation:
- Accurate (<10% error): #10B981
- Good (10-20%):  #3B82F6 (blue)
- Needs work (>20%): #DC2626
```

### **Interactive Elements**
```
Revenue Calculator:
- Range slider for conversion rate (0-30%)
- Number input for avg transaction ($5-$200)
- Auto-calculates on change
- Show sensitivity with ± indicators

What-If Scenarios:
- Dropdown to select scenario
- Instant calculation
- Show delta from base case
- Color code impact (green/red)
```

### **Validation Charts**
```
Prediction Accuracy:
- Dual-line chart (predicted vs actual)
- Error bars showing ±confidence
- Highlight weeks with >20% error
- Interactive hover for details
- Zoom/pan for time range selection
```

---

## 🔄 User Flows

### **Flow 1: Initial Prediction**
```
1. User views property/deal page
2. Click "Predict Traffic" button
3. System checks if market research exists
   └─ If no: "Generate market research first" (link)
   └─ If yes: Continue
4. POST /api/traffic/predict/:propertyId
5. Show loading state (estimated 3-5 seconds)
6. Display traffic prediction dashboard
7. Prompt to save prediction
```

### **Flow 2: Update Prediction**
```
1. User views existing prediction
2. Notice "Last updated 7 days ago" warning
3. Click "Update Prediction"
4. Confirm: "This will use updated market data"
5. Regenerate prediction
6. Show comparison: Old vs New
7. Explain changes (e.g., "Employment news increased demand")
```

### **Flow 3: Record Validation**
```
1. User clicks "Record Actual Traffic"
2. Form appears:
   ├─ Week selector
   ├─ Walk-in count input
   ├─ Measurement method dropdown
   ├─ Confidence slider
   └─ Notes textarea
3. Submit → POST /api/traffic/validation/record
4. System calculates error vs prediction
5. Show validation result card:
   ├─ Predicted: 2,847
   ├─ Actual: 2,650
   ├─ Error: 7.4% ✅
   └─ Status: "Excellent accuracy!"
6. Update validation tab with new data point
7. If error >20%: Flag for investigation
```

### **Flow 4: Use in Financial Model**
```
1. From traffic prediction dashboard
2. Click "Use in Financial Model"
3. Modal appears with export options:
   ├─ [Copy to Pro Forma]
   ├─ [Export to Excel]
   └─ [Create Revenue Scenario]
4. Select "Copy to Pro Forma"
5. Navigate to Financial Modeling tab
6. Data auto-populated:
   ├─ Traffic assumptions
   ├─ Conversion rates
   ├─ Revenue projections
   └─ Sensitivity ranges
7. User can adjust and model scenarios
```

---

## 📱 Responsive Design

### **Desktop (>1024px)**
- Full dashboard with all tabs
- Side-by-side comparisons
- Interactive charts

### **Tablet (768-1024px)**
- Stacked layout
- Hero metric stays prominent
- Charts optimize for touch

### **Mobile (<768px)**
- Hero metric + 2 key stats
- Swipeable cards for breakdown
- Simplified tables
- Bottom sheet for details

---

## 🔗 Integration Points

### **From Property Page**
```
Property Details
  └─ [Predict Foot Traffic] button
       ↓
     Traffic Prediction Interface (modal or inline)
```

### **From Deal Creation**
```
Create Deal Flow → Step 4: Market Analysis
  ├─ Generate Market Research
  └─ Generate Traffic Prediction
       ↓
     Both feed into Step 5: Financial Model
```

### **To Financial Model**
```
Traffic Prediction
  └─ [Use in Financial Model] button
       ↓
     Auto-populates:
     - Walk-in counts
     - Revenue scenarios (by tenant type)
     - Conversion assumptions
     - Sensitivity ranges
```

### **To JEDI Score**
```
Traffic data feeds into:
- Location quality component
- Revenue potential score
- Tenant mix feasibility
- Market positioning
```

---

## 🎯 Key Features Summary

✅ **Real-time prediction:** 2,847 walk-ins/week  
✅ **Component breakdown:** Physical vs demand  
✅ **Revenue modeling:** Interactive calculator  
✅ **Validation tracking:** Prediction vs actual  
✅ **Confidence scoring:** 78% with breakdown  
✅ **Comparable analysis:** Ranking vs market  
✅ **Export options:** PDF, Excel, API  
✅ **Financial integration:** One-click to pro forma  

---

**Status:** ✅ Complete interface design  
**Next:** Create Deal Integration Design  
**Estimated build:** 2-3 days for full interface
