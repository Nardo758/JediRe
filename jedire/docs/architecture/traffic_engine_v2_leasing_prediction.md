# JEDI RE — Traffic Engine v2: Leasing Prediction Engine

**Purpose:** Predict the metrics that lead to leases being signed, projected 10 years forward, getting smarter with every week of real data.

**Source Calibration:** Highlands at Berewick (290 units, 240+ weeks of actuals from July 2021 – Feb 2026)

---

## 1. THE CRITICAL PATH

Out of 32 columns in the Highlands weekly report, only 7 metrics form the chain that leads to a signed lease:

```
Traffic → In-Person Tours → Applications → Net Leases → Occupancy → Effective Rent → Revenue
   (C)          (D)              (E)          (H)          (Y)          (AE)         (AC)
```

Everything else is either derived from these 7 or is operational detail (cancellations, denials, transfers, model units, on-notice breakdown) that the platform doesn't need to predict — the user provides those as actuals.

### The 7 Key Outputs

| # | Metric | Highlands Col | What It Tells You | Why It Matters |
|---|--------|--------------|-------------------|----------------|
| 1 | **Weekly Traffic** | C | How many prospects show up | Top of funnel — everything flows from this |
| 2 | **In-Person Tours** | D | How many actually tour the property | Conversion quality signal |
| 3 | **Applications Submitted** | E | How many apply to lease | Demand commitment signal |
| 4 | **Net Leases Signed** | H | Apps minus cancellations minus denials | THE key output — signed deals |
| 5 | **Occupancy %** | Y | End-of-week occupied / total units | Revenue driver, investor metric #1 |
| 6 | **Effective Rent** | AE | Actual rent collected per unit (after concessions) | Revenue driver, investor metric #2 |
| 7 | **Closing Ratio** | I | Net leases / traffic | Operational efficiency — how well the property converts |

### 3 Derived Metrics the Engine Also Produces

| # | Metric | Formula | Why |
|---|--------|---------|-----|
| 8 | **Implied Annual Leases** | Net Leases × 52 (seasonally adjusted) | Feeds ProForma absorption assumptions |
| 9 | **Gross Potential Revenue** | Total Units × Avg Market Rent × 12 | Ceiling for revenue projections |
| 10 | **Effective Rent Growth Rate** | (Current AE / AE 52 weeks ago) - 1 | Trend for 10-year rent projection |

---

## 2. FORMULA GAP ANALYSIS: v1 → v2

### What v1 (Current Engine) Does

The existing `trafficPredictionEngine.ts` (668 lines) calculates T-01 (weekly walk-ins) using:

```
T-01 = DOT_ADT × capture_rate × property_factors × seasonal_adjustment
```

Where capture_rate is based on: frontage, corner position, setback, visibility, entrance count.

Then `multifamilyTrafficService.ts` (555 lines) converts walk-ins to leases using:

```
T-05 = walk_ins × tour_conversion × app_conversion × approval_rate × acceptance_rate
```

**Problem:** These are static multipliers. The Highlands data shows conversion rates vary wildly week to week (closing ratio ranges from -100% to 222%). Static multipliers produce smooth predictions that miss seasonal swings, lease-up dynamics, and market shifts.

### What v2 Needs to Do

Instead of DOT data → static multipliers → single prediction, v2 uses a **pattern-matching model calibrated by real weekly data:**

```
For any property P at week W:

1. TRAFFIC(P, W) = f(seasonality, market_demand, property_age, comp_supply, trend)
2. TOURS(P, W) = TRAFFIC × tour_rate(season, property_class, occupancy_level)  
3. APPS(P, W) = TOURS × app_rate(season, market_tightness, rent_competitiveness)
4. NET_LEASES(P, W) = APPS × approval_rate × (1 - cancellation_rate)
5. OCCUPANCY(P, W) = prev_occupancy + (move_ins - move_outs) / total_units
6. EFF_RENT(P, W) = market_rent × (1 - concession_factor) × occupancy_pressure
7. CLOSING_RATIO(P, W) = NET_LEASES / TRAFFIC
```

**Key difference:** Every conversion rate is a FUNCTION of conditions, not a constant. The Highlands data trains these functions.

---

## 3. WHAT THE HIGHLANDS DATA TEACHES US

### Seasonal Patterns (from 240 weeks of actuals)

| Season | Avg Weekly Traffic | Avg Closing Ratio | Avg Net Leases | Pattern |
|--------|-------------------|-------------------|----------------|---------|
| **Summer (Jun-Aug)** | 15-28 | 25-40% | 4-11 | Peak leasing season. High traffic, high conversion. |
| **Spring (Mar-May)** | 3-19 | 20-50% | 0-4 | Ramp-up. Traffic building, conversion improving. |
| **Fall (Sep-Nov)** | 1-9 | 0-30% | 0-2 | Decline. Traffic drops, harder to fill. |
| **Winter (Dec-Feb)** | 2-13 | 15-50% | 0-5 | Low traffic but motivated prospects convert well. |

### Lease-Up vs Stabilized Behavior

The Highlands data shows TWO distinct operating modes:

**Lease-Up Phase (Jul-Dec 2021):** Occupancy climbed 83% → 97%. Traffic was 4-27/week, net leases 0-7/week. Conversion was erratic — many weeks of 0 leases despite traffic, then bursts of 5-7.

**Stabilized Phase (2022-2026):** Occupancy 92-98%. Traffic 1-28/week (seasonal), net leases 0-11/week. Renewal-driven economics dominate over new leases.

**Implication:** The engine must detect which phase a property is in and apply different conversion models for each.

### Rent Growth Trajectory

Effective rent: $1,577 (Jul 2021) → $1,808 (Jul 2022) → continues climbing. That's +14.6% in Year 1, then moderating. The engine learns the rent growth curve shape from actuals and extrapolates.

---

## 4. 10-YEAR PROJECTION MODEL

### How It Works

**Years 1-2: Weekly granularity.**
Predict all 7 key metrics for each of the next 104 weeks. This is where the model is most accurate — close enough to current conditions that seasonal patterns and conversion rates are reliable.

**Years 3-5: Monthly granularity.**
Aggregate to monthly predictions. Wider confidence bands. Market-level trends (demand growth, supply pipeline, rent growth) become more influential than property-level patterns.

**Years 6-10: Quarterly granularity.**
Broad trajectory predictions. The engine produces ranges (optimistic / base / conservative) rather than point estimates. These feed the ProForma's long-term assumptions.

### Projection Formulas

**Traffic Projection:**
```
traffic(week) = baseline_traffic 
  × seasonal_factor(week_of_year)     -- learned from actuals
  × market_demand_trend(year)          -- from M06 demand signals
  × supply_adjustment(year)            -- new comp deliveries suppress traffic
  × property_age_decay(years_since_built)  -- older properties get less walk-in traffic
```

**Net Leases Projection:**
```
net_leases(week) = traffic(week) 
  × closing_ratio(season, occupancy_level, market_tightness)
  
Where:
  closing_ratio = base_rate × occupancy_modifier × market_modifier

  -- When occupancy < 90%: more aggressive leasing, higher conversion
  -- When occupancy > 96%: few vacancies, each prospect more likely to lease
  -- When market is tight (low submarket vacancy): higher conversion
  -- When market is loose (high vacancy + concessions): lower conversion
```

**Occupancy Projection:**
```
occupancy(month) = stabilized_occupancy 
  - seasonal_vacancy_swing(month)       -- Feb dip, Aug peak
  + demand_trend_adjustment(year)       -- growing market lifts occupancy
  - supply_impact(year)                 -- new deliveries temporarily suppress

Bounded: min 85%, max 98%
```

**Effective Rent Projection:**
```
eff_rent(month) = current_eff_rent 
  × (1 + annual_rent_growth) ^ (months / 12)
  × concession_factor(occupancy_level)

Where:
  annual_rent_growth = learned_growth_rate (from actuals)
    + market_rent_growth_adjustment (from M05)
    - supply_pressure_discount (from M04)
    
  concession_factor:
    occupancy > 95%: 1.00 (no concessions needed)
    occupancy 90-95%: 0.97 (light concessions)
    occupancy < 90%: 0.92 (heavy concessions / free months)
```

**Revenue Projection:**
```
gross_revenue(month) = total_units × occupancy(month) × eff_rent(month)
```

---

## 5. THE LEARNING LOOP

*Integrates: Traffic_Validation_Excel_Supplement.md — expanded from walk-ins-only validation to full 7-metric funnel recalibration.*

### How the Engine Gets Smarter

Each weekly upload triggers a 4-step recalibration cycle:

```
STEP 1: PARSE & VALIDATE (from validation supplement)
  - Excel ingested via ExcelTrafficValidator class
  - Structure check: required columns present?
  - Data cleaning: normalize dates, strip whitespace, coerce numbers
  - Row validation: property exists in DB, dates are 7-day span, values in range
  - Quality checks: consistency (weekday×5 + weekend×2 ≈ total), 
    outlier detection (z-score > 2.5), temporal continuity (no week gaps)

STEP 2: COMPARE TO PREDICTIONS (per-metric, not just walk-ins)
  For each of the 7 key metrics:
    error(metric) = |predicted - actual| / actual
  
  Overall MAPE = mean(error across all reported metrics)
  
  Per-conversion-rate error:
    tour_rate_error = |predicted_tour_rate - (actual_tours / actual_traffic)|
    app_rate_error = |predicted_app_rate - (actual_apps / actual_tours)|
    lease_rate_error = |predicted_lease_rate - (actual_leases / actual_apps)|

STEP 3: RECALIBRATE CONVERSION RATES (EMA)
  new_rate = α × actual_rate + (1 - α) × old_rate
  
  Where:
    α = 0.15 (standard — converges in ~15 uploads)
    α = 0.05 (when |actual - predicted| > 3σ — dampen anomalies)
    
  Rates recalibrated:
    - tour_rate: only when tours AND traffic both reported
    - app_rate: only when apps AND tours both reported  
    - lease_rate: only when net_leases AND apps both reported
    - seasonal_index[week]: updated per upload, outlier-protected
    - occupancy_trend: exponential smoothing on occupancy series
    - rent_growth_rate: exponential smoothing on effective rent series

  Minimum data before overriding v1 defaults:
    - 4 weeks → start blending learned rates with v1 defaults
    - 13 weeks → fully replace v1 defaults with learned rates
    - 52 weeks → high-confidence seasonal model

STEP 4: DETECT BIAS & APPLY CORRECTIONS (from validation supplement)
  If > 75% of last 4+ uploads show same-direction error:
    → Systematic bias detected
    → Apply global adjustment: multiplier = 1 - (avg_error × 0.5)
    → Log to calibration_factors table with reason
  
  If occupancy error > 1% for 3+ consecutive weeks:
    → Occupancy model drift detected
    → Trigger full occupancy model recalibration
```

### Upload Schema (v2 — expanded from validation supplement)

The validation supplement defined a walk-ins-only upload format. v2 expands to the full leasing funnel:

**Required Fields (5):**

| Field | Type | Example | Why |
|-------|------|---------|-----|
| Week Ending | date | 2026-02-23 | Sunday date — time series anchor |
| Traffic | int | 16 | Total walk-ins — top of funnel |
| Net Leases | int | 3 | Signed leases — the key output |
| Occupancy % | float | 95.2 | Revenue driver #1 |
| Effective Rent | float | 1838 | Revenue driver #2 |

**Optional Fields (7) — Enable Better Learning:**

| Field | Type | What It Enables |
|-------|------|-----------------|
| In-Person Tours | int | Tour rate calibration (the biggest v1 error) |
| Applications | int | App rate calibration |
| Move-Ins | int | Occupancy dynamics modeling |
| Move-Outs | int | Turnover prediction |
| Concessions | float | Rent pressure signal — when concessions rise, market is softening |
| Market Rent | float | Loss-to-lease calculation (market vs effective) |
| Notes | text | Context for outlier detection ("street fair weekend") |

**Minimum viable upload:** 5 required fields. System can still learn traffic trends, occupancy trajectory, and rent growth. Cannot calibrate conversion rates between funnel stages.

**Full upload (Highlands format):** All 12 fields including renewal data. Enables complete conversion rate learning, seasonal index calibration, and renewal vs new lease split modeling.

### Confidence Scoring

| Data Available | Confidence Level | Prediction Quality |
|----------------|-----------------|-------------------|
| 0 weeks of actuals (new property) | Low (40-55%) | DOT-based cold-start + market comps only |
| 4-8 weeks | Moderate (55-70%) | Seasonal patterns emerging, blending with v1 defaults |
| 13-26 weeks | Good (70-85%) | One season learned, v1 defaults fully replaced |
| 52+ weeks | High (85-95%) | Full annual cycle, reliable seasonal model |
| 104+ weeks (like Highlands) | Very High (90-97%) | Multi-year trends, highly reliable |

### Cross-Property Learning

When Property A in Buckhead submits actuals, the engine learns patterns that help predict Property B in Buckhead even if B has never submitted data. Anonymized learning:
- Submarket seasonal patterns improve
- Property-class conversion baselines improve
- Rent growth trajectories calibrate to actual market data

### Validation Pipeline (from supplement — adapted)

```python
# The validation supplement's ExcelValidationRunner, adapted for v2:

class V2ValidationRunner:
    """
    v2 changes from supplement:
    1. Validates 7 metrics, not just walk-ins
    2. Calculates per-conversion-rate errors
    3. Recalibrates rates with EMA, not just global multiplier
    4. Tracks forecast horizon accuracy (4-week-ago pred vs actual)
    """
    
    def validate_week(self, week_data):
        # Step 1: Per-metric comparison (supplement did walk-ins only)
        errors = {}
        for metric in ['traffic', 'tours', 'apps', 'net_leases', 'occ', 'eff_rent']:
            if metric in week_data.actual:
                errors[metric] = abs(week_data.predicted[metric] - week_data.actual[metric]) / week_data.actual[metric]
        
        # Step 2: Conversion rate errors (NEW in v2)
        if 'tours' in week_data.actual and 'traffic' in week_data.actual:
            actual_tour_rate = week_data.actual['tours'] / week_data.actual['traffic']
            self.recalibrate('tour_rate', actual_tour_rate)
        
        if 'apps' in week_data.actual and 'tours' in week_data.actual:
            actual_app_rate = week_data.actual['apps'] / week_data.actual['tours']
            self.recalibrate('app_rate', actual_app_rate)
        
        # Step 3: Bias detection (from supplement, unchanged)
        self.check_bias(errors)
        
        # Step 4: Retroactive forecast validation (NEW in v2)
        self.validate_forecast_horizon(week_data)
    
    def recalibrate(self, rate_name, actual_rate):
        """EMA recalibration — replaces supplement's global multiplier approach"""
        alpha = 0.15
        if self.is_outlier(actual_rate, rate_name):
            alpha = 0.05  # Dampen anomalies
        old_rate = self.get_current_rate(rate_name)
        new_rate = alpha * actual_rate + (1 - alpha) * old_rate
        self.save_rate(rate_name, new_rate)
```

---

## 6. WHAT CHANGES FROM v1 OUTPUT SPEC

### Outputs Being Replaced

| v1 Output | Status | v2 Replacement |
|-----------|--------|----------------|
| T-01 Weekly Walk-Ins | **Kept, enhanced** | Now includes seasonal decomposition + confidence band |
| T-02 Physical Score (0-100) | **Kept** | Still useful as a normalized comparison metric |
| T-03 Digital Score (0-100) | **Kept** | Feeds into the correlation matrix |
| T-04 2×2 Correlation Matrix | **Kept** | Hidden Gem / Validated / Hype / Dead Zone |
| T-05 Traffic-to-Lease | **Replaced** | Now a full 4-stage funnel prediction, not a single number |
| T-06 Capture Rate | **Kept** | Renamed: Competitive Capture Rate |
| T-07 Trajectory (8-week) | **Enhanced** | Now projects 10 years, not 8 weeks |
| T-08 Generator Proximity | **Folded in** | Becomes an input to traffic prediction, not a separate output |
| T-09 Competitive Share | **Kept** | Property's share of trade area traffic |
| T-10 Validation Confidence | **Enhanced** | Now multi-dimensional: per-metric confidence, not one number |

### New Outputs (v2 additions)

| New Output | What It Is | Feeds |
|------------|-----------|-------|
| **Net Leases Forecast (weekly)** | Predicted signed leases per week for next 104 weeks | ProForma absorption, Strategy Arbitrage |
| **Occupancy Trajectory (10yr)** | Occupancy % projected monthly for 10 years | ProForma vacancy assumption |
| **Effective Rent Trajectory (10yr)** | $/unit projected monthly for 10 years | ProForma rent growth assumption |
| **Revenue Forecast (10yr)** | Units × Occupancy × Rent projected quarterly | ProForma gross revenue |
| **Lease-Up Timeline** | Weeks to reach 90%, 93%, 95% occupancy (dev deals) | Development Capsule, Strategy Arbitrage |
| **Seasonal Risk Windows** | Weeks where occupancy is predicted to dip below threshold | Risk Module (M14), alerts |
| **Model Confidence Per Metric** | Separate confidence for traffic, leases, occupancy, rent | Displayed per metric in wireframe |

---

## 7. CROSS-MODULE WIRING (Updated for v2)

### → M25 JEDI Score
```
Position signal adjustment:
  - Net leases > 3/week AND accelerating → +5 Position
  - Net leases < 1/week AND decelerating → -5 Position, -3 Risk
  - Occupancy > 96% → +3 Position  
  - Occupancy < 90% → -5 Position, -5 Risk
```

### → M08 Strategy Arbitrage
```
Strategy modifiers from v2 outputs:
  - High traffic + low occupancy → Value-Add signal (+6 VA, +4 Flip)
  - High traffic + high occupancy → Hold signal (+5 Rental, +3 STR)
  - HIDDEN_GEM (T-04) + strong leasing → Flip advantage (+8)
  - Lease-up timeline > 18 months → BTS penalty (-4), BTR penalty (-3)
  - Fast lease-up (< 8 months) → BTR boost (+5)
```

### → M09 ProForma (Direct Assumption Override)
```
The v2 engine directly populates ProForma assumptions:
  - Vacancy assumption ← 1 - occupancy_trajectory(year)
  - Rent growth ← effective_rent_growth_rate from trajectory
  - Absorption rate ← net_leases × 52 / available_units
  - Lease-up timeline ← weeks_to_stabilization (dev deals)
  - Concession budget ← concession_factor(occupancy) × gross_rent

These replace hardcoded ProForma inputs with intelligence-driven assumptions.
The user can still override, but the "Platform Adjusted" layer shows what the
Traffic Engine predicts versus what the user assumes.
```

---

## 8. WIREFRAME DATA STRUCTURE

The Traffic Engine tab in the Deal Capsule shows:

### Section 1: Leasing Funnel (Current Week)
```
Traffic: 15/week → Tours: 8 → Apps: 4 → Net Leases: 3
Closing Ratio: 20% | Occupancy: 95.2% | Eff Rent: $1,808
```
Each metric shows: current value, predicted value, variance, trend arrow.

### Section 2: 10-Year Projection Chart
```
X-axis: Time (weeks 1-104, then monthly, then quarterly)
Y-axis (left): Occupancy % (line)
Y-axis (right): Effective Rent (line)
Overlay: Net leases/week as bar chart
Confidence band: Shaded area widens over time
```
Toggle between: Occupancy view, Rent view, Revenue view, Leasing velocity view.

### Section 3: Seasonal Pattern
```
Heatmap: 52 weeks × metric intensity
Shows learned seasonal patterns: "Your peak leasing is weeks 22-34 (June-Aug)"
Highlights upcoming risk windows: "Expect traffic drop weeks 45-50 (Nov-Dec)"
```

### Section 4: Prediction vs Actual (Validation)
```
Table: Last 12 weeks of predicted vs actual for each metric
Chart: Prediction accuracy over time (getting tighter as more data comes in)
Confidence score per metric
"Upload This Week's Data" button → triggers model recalibration
```

### Section 5: Cross-Module Impact
```
Shows how traffic predictions are adjusting other modules:
- ProForma vacancy assumption: 4.8% (from traffic engine) vs 5.5% (market default)
- Strategy Arbitrage: +5 Position signal from strong leasing velocity
- JEDI Score: Traffic contributing +4 to Position sub-signal
```

---

## 9. IMPLEMENTATION PRIORITY

### Phase 1: Foundation + Validation Pipeline (Week 1-2)
- Parse Highlands Excel format as the canonical upload schema
- Build ExcelTrafficValidator (from supplement) expanded for 7-metric schema
- Implement data quality checks: consistency, outlier detection (z-score > 2.5), temporal continuity
- Build seasonal decomposition from 240 weeks of actuals
- Implement the 7 key metric prediction chain with learned conversion rates
- Database: extend traffic_predictions table with funnel columns + validation_results table

### Phase 2: Learning Loop (Week 3-4)
- Build trafficLearningService.ts: EMA recalibration (α=0.15, dampened α=0.05 for outliers)
- Per-conversion-rate learning: tour_rate, app_rate, lease_rate (only when both sides reported)
- Minimum data thresholds: 4 weeks blend, 13 weeks replace, 52 weeks high-confidence
- Bias detection: >75% same-direction error across 4+ consecutive uploads → systematic adjustment
- Upload UX: drag-drop Excel, parsing feedback, per-metric validation results inline

### Phase 3: 10-Year Projection (Week 5-6)  
- Weekly projections (104 weeks) with seasonal overlay
- Monthly aggregation for years 3-5
- Quarterly aggregation for years 6-10
- Confidence bands that widen over time
- Retroactive forecast validation: compare 4-week-ago prediction to actual

### Phase 4: Cross-Module Wiring (Week 7-8)
- Wire occupancy trajectory → ProForma vacancy assumption
- Wire rent trajectory → ProForma rent growth
- Wire leasing velocity → Strategy Arbitrage modifiers
- Wire seasonal risk windows → Risk Module alerts
- Cross-property anonymized learning (submarket calibration)
