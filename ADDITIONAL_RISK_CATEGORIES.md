# Additional Risk Categories - Implementation Guide

**Phase 3, Component 1: Regulatory, Market, Execution, and Climate/Physical Risk**

## Overview

This implementation completes the 6-category comprehensive risk framework for JEDI RE. Building on Phase 2's Supply and Demand Risk, we now add 4 additional risk categories that together provide a holistic view of investment risk.

### Risk Framework Weights

| Category | Weight | Description |
|----------|--------|-------------|
| **Supply Risk** | 35% | Pipeline units, absorption capacity |
| **Demand Risk** | 35% | Employer concentration, demand drivers |
| **Regulatory Risk** | 10% | Legislation, policy changes, zoning |
| **Market Risk** | 10% | Interest rates, cap rates, liquidity |
| **Execution Risk** | 5% | Construction costs, labor, delays |
| **Climate Risk** | 5% | Flood, wildfire, natural disasters |

### Composite Risk Formula

```
Composite Score = (Highest × 0.40) + (Second Highest × 0.25) + (Avg of Remaining × 0.35)
```

This formula ensures that severe risk in one category isn't diluted by low scores in others, while still accounting for overall risk profile.

---

## 1. Regulatory Risk (10%)

### Definition
Probability that government action restricts operations, increases costs, or limits exit options.

### Data Sources
- Legislative tracking databases
- City council meeting minutes
- County commission agendas
- Policy announcements
- News intelligence

### Risk Scoring

#### Base Score Calculation
```
Base Score = 50 (neutral) + Sum(Active Events × Stage Probability)
```

#### Stage Probability Weighting

| Legislation Stage | Probability | Description |
|-------------------|-------------|-------------|
| **Proposed** | 25% | Bill introduced, no committee action |
| **Committee** | 50% | In committee, under review |
| **Vote Pending** | 75% | Scheduled for vote |
| **Enacted** | 100% | Passed into law |
| **Rejected** | 0% | Failed, no longer active |

### Event Types and Impacts

#### 1. Rent Control
- **Impact:** HIGH (15-40 points)
- **Escalation Trigger:** Proposed 5% annual cap
- **Score Impact:** +15 points at committee stage (50% probability)
- **Escalation:** +30 points if enacted (100% probability)
- **Example:** Fulton County Rent Stabilization Act (committee, 50% × +15 = +7.5)

#### 2. Short-Term Rental (STR) Restrictions
- **Impact:** MODERATE-HIGH (10-25 points)
- **Escalation Trigger:** Permit cap, owner-occupancy requirements
- **Score Impact:** +10 points at vote pending (75% probability)
- **Affected Units:** Properties in STR-eligible zones
- **Income Impact:** 25-50% discount to STR income potential

#### 3. Zoning Changes
- **Upzone Impact:** OPPORTUNITY (-5 to -15 points, reduces risk)
- **Downzone Impact:** RISK (+8 to +20 points, increases risk)
- **Examples:**
  - Upzone MR-3 → MR-5: -5 points (opportunity for higher density)
  - Downzone C-2 → C-1: +8 points (reduced development potential)

#### 4. Tax Policy
- **Impact:** MODERATE (3-10 points)
- **Triggers:**
  - Millage rate increases
  - Assessment methodology changes
  - New transfer taxes
  - Special assessments
- **Example:** +5.66% millage rate + 3% assessment = +3 points

#### 5. Inclusionary Zoning
- **Impact:** LOW-MODERATE (5-10 points)
- **Trigger:** Affordable housing mandates (e.g., 15% at 60% AMI)
- **Proforma Impact:** 5-8% reduction in returns
- **Score Impact:** +5 points at proposed stage

### API Endpoints

```
GET /api/v1/risk/trade-area/:id/regulatory
```

**Response:**
```json
{
  "success": true,
  "data": {
    "regulatoryRisk": {
      "baseScore": 57.5,
      "finalScore": 57.5,
      "activeEvents": 3,
      "totalRiskImpact": 7.5,
      "events": [
        {
          "id": "uuid",
          "name": "Fulton County Rent Stabilization Act",
          "type": "rent_control",
          "stage": "committee",
          "stageProbability": 50,
          "impact": 15.0,
          "severity": "high",
          "effectiveDate": "2025-07-01"
        }
      ]
    },
    "zoningChanges": [...],
    "taxPolicyChanges": [...]
  }
}
```

---

## 2. Market Risk (10%)

### Definition
Probability that macroeconomic conditions shift unfavorably during the hold period.

### Data Sources
- Federal Reserve data (interest rates)
- Treasury yields
- CoStar capital markets data
- Recession indicators (yield curve, unemployment)
- DSCR modeling

### Risk Scoring

#### Base Score Components

1. **Cap Rate Sensitivity** (40%)
   - Formula: `+100 bps interest rate = +50-75 bps cap expansion`
   - Current: 4.50% 10-yr → 5.25% cap rate
   - Stress: 5.50% 10-yr → 5.85% cap rate (+60 bps)
   - Impact: 10.5% value decline

2. **DSCR Stress Test** (30%)
   - Current DSCR: 1.45
   - +200 bps scenario: 1.15 DSCR
   - Buffer to covenant breach: 0.30
   - Risk Score: Higher stress = higher score

3. **Liquidity Risk** (20%)
   - Transaction volume index (100 = baseline)
   - Current: 85 (below baseline = less liquid)
   - Days on market: 120 days (vs 90 baseline)
   - Buyer pool depth: Moderate

4. **Credit Availability** (10%)
   - Max LTV: 65% (vs 75% baseline)
   - Debt yield requirement: 9.5%
   - Lending standards: Normal (not tight or frozen)

### Interest Rate Scenarios

| Scenario | Rate Change | Cap Impact | Value Impact | DSCR | Probability | Risk Score |
|----------|-------------|------------|--------------|------|-------------|------------|
| Baseline | 0 bps | 0 bps | 0% | 1.45 | 60% | 0 |
| +100 bps | +100 bps | +60 bps | -10.5% | 1.25 | 25% | +5 |
| +200 bps (Recession) | +200 bps | +120 bps | -22% | 1.15 | 15% | +12 |

### API Endpoints

```
GET /api/v1/risk/trade-area/:id/market
```

**Response:**
```json
{
  "success": true,
  "data": {
    "marketRisk": {
      "baseScore": 55.0,
      "finalScore": 55.0,
      "hasData": true,
      "asOfDate": "2025-01-15",
      "indicators": {
        "current10YrTreasury": 4.50,
        "currentCapRate": 5.25,
        "capRateExpansionBps": 50,
        "currentDSCR": 1.45,
        "stressedDSCR": 1.15,
        "dscrBuffer": 0.30,
        "transactionVolumeIndex": 85,
        "recessionProbability": 25.0
      },
      "scenarios": [...]
    }
  }
}
```

---

## 3. Execution Risk (5%)

### Definition
Probability that construction or renovation encounters cost or timeline overruns.

### Data Sources
- Construction cost indices (RSMeans, Turner, etc.)
- Labor market data (BLS)
- Material price tracking
- Historical overrun data by jurisdiction
- Contractor availability surveys

### Risk Scoring

#### Base Score Components

1. **Cost Contingency Adequacy** (30%)
   - 10%+ contingency: Low risk (20-30 points)
   - 8-10% contingency: Moderate risk (40-50 points)
   - 5-8% contingency: High risk (60-75 points)
   - <5% contingency: Critical risk (80-95 points)

2. **Historical Overrun Rates** (25%)
   - By jurisdiction (Atlanta avg: 12% cost, 30 days schedule)
   - By project type (renovation vs new construction)
   - Contractor track record

3. **Labor Market Conditions** (20%)
   - Labor availability: Abundant/Adequate/Tight/Critical
   - Contractor availability
   - Wage inflation: +5.5% YoY = moderate risk
   - Skilled labor shortage: Boolean flag

4. **Material Supply** (15%)
   - Lead times: 45 days avg (baseline 30)
   - Price volatility: Moderate/High/Extreme
   - Supply chain disruption risk
   - Tariff exposure (steel, aluminum)

5. **Cost Inflation** (10%)
   - Construction cost index: 112.5 (12.5% above baseline)
   - YoY inflation: +8% = high risk
   - Trend: Accelerating/Stable/Decelerating

### Escalation Rules

| Factor | Low Risk | Moderate Risk | High Risk | Critical Risk |
|--------|----------|---------------|-----------|---------------|
| **Contingency** | 10%+ | 8-10% | 5-8% | <5% |
| **Cost Inflation** | <3% | 3-6% | 6-10% | >10% |
| **Labor Market** | Abundant | Adequate | Tight | Critical |
| **Overrun History** | <5% | 5-10% | 10-20% | >20% |

### API Endpoints

```
GET /api/v1/risk/trade-area/:id/execution
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionRisk": {
      "baseScore": 58.0,
      "finalScore": 58.0,
      "hasData": true,
      "factors": {
        "contingencyPct": 8.0,
        "costInflationYoY": 8.0,
        "laborAvailability": "adequate",
        "contractorAvailability": "adequate",
        "wageInflationYoY": 5.5,
        "historicalCostOverrunPct": 12.0,
        "historicalScheduleOverrunDays": 30
      },
      "costTrends": [...]
    }
  }
}
```

---

## 4. Climate/Physical Risk (5%)

### Definition
Probability of physical damage or long-term value impairment from environmental hazards.

### Data Sources
- FEMA flood maps
- NOAA climate data
- Wildfire perimeter data (CAL FIRE, etc.)
- Hurricane tracking (NOAA)
- Insurance carrier data
- Climate projection models

### Risk Scoring

#### FEMA Flood Zone Classification

| Zone | Risk Level | Score Impact | Description |
|------|------------|--------------|-------------|
| **A, AE, AO, AH** | High | +25 | 1% annual flood chance |
| **V, VE** | Very High | +40 | Coastal high velocity wave action |
| **X (shaded)** | Moderate | +15 | 0.2% annual flood chance |
| **X (unshaded)** | Low | +5 | Minimal flood risk |
| **D** | Undetermined | +15 | Flood risk not determined |

#### Wildfire Hazard Zones

| Zone | Risk Level | Score Impact |
|------|------------|--------------|
| **Extreme** | Extreme | +35 |
| **Very High** | Very High | +25 |
| **High** | High | +15 |
| **Moderate** | Moderate | +10 |
| **Low** | Low | +5 |
| **Non-WUI** | Minimal | 0 |

#### Hurricane/Wind Risk

| Zone | Wind Speed | Score Impact |
|------|------------|--------------|
| **Zone 5** | >155 mph | +30 |
| **Zone 4** | 130-155 mph | +20 |
| **Zone 3** | 111-129 mph | +15 |
| **Zone 2** | 96-110 mph | +10 |
| **Zone 1** | 74-95 mph | +5 |

#### Insurance Impact Multiplier

| Insurance Availability | Premium Trend | Multiplier |
|------------------------|---------------|------------|
| Readily Available | Stable | 1.0x |
| Limited | Increasing Moderate | 1.3x |
| Difficult | Increasing High | 1.6x |
| Unavailable | Spiking | 2.0x |

### 30-Year Climate Projection

Key factors assessed:
- Sea level rise (coastal properties)
- Temperature extremes (HVAC, energy costs)
- Precipitation patterns (flooding frequency)
- Wildfire frequency (expanding WUI)
- Insurance market stability

### API Endpoints

```
GET /api/v1/risk/trade-area/:id/climate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "climateRisk": {
      "baseScore": 35.0,
      "finalScore": 35.0,
      "hasData": true,
      "floodRisk": {
        "femaZone": "X",
        "riskLevel": "low",
        "elevationBuffer": 25.0
      },
      "wildfireRisk": {
        "hazardZone": "Low",
        "riskLevel": "minimal"
      },
      "hurricaneRisk": {
        "zone": 1,
        "windDesignSpeed": 90
      },
      "insurance": {
        "availability": "readily_available",
        "premiumTrend": "stable",
        "estimatedAnnualPremium": 15000.00
      },
      "disasterHistory": [...]
    }
  }
}
```

---

## Integration with JEDI Score

### Risk Component Contribution

Risk Score contributes **10%** to total JEDI Score:

```
JEDI Score = 
  (Income × 15%) + 
  (Expense × 15%) + 
  (Location × 30%) + 
  (Market × 30%) + 
  (RISK × 10%)
```

### Risk Score Inversion

**High risk = Low JEDI contribution**

```
JEDI Risk Component = 100 - Composite Risk Score
```

Example:
- Composite Risk Score: 65 (moderate-high risk)
- JEDI Risk Component: 35 (65 inverted)
- JEDI Contribution: 35 × 10% = 3.5 points

### Risk Level Thresholds

| Composite Score | Risk Level | JEDI Risk Contribution | Impact |
|-----------------|------------|------------------------|--------|
| 0-39 | Low | 61-100 | Minimal impact on JEDI Score |
| 40-59 | Moderate | 41-60 | Moderate impact |
| 60-79 | High | 21-40 | Significant impact |
| 80-100 | Critical | 0-20 | Severe impact, may block deal |

---

## API Reference

### Core Endpoints

#### Get All Risk Categories
```
GET /api/v1/risk/categories
```

Returns all 6 risk categories with implementation status.

#### Get Composite Risk Profile
```
GET /api/v1/risk/trade-area/:id
```

Returns composite risk profile with all 6 categories calculated.

#### Get Category-Specific Risk Details

```
GET /api/v1/risk/trade-area/:id/supply
GET /api/v1/risk/trade-area/:id/demand
GET /api/v1/risk/trade-area/:id/regulatory
GET /api/v1/risk/trade-area/:id/market
GET /api/v1/risk/trade-area/:id/execution
GET /api/v1/risk/trade-area/:id/climate
```

#### Get Comprehensive Deal Risk (All 6 Categories)
```
GET /api/v1/risk/comprehensive/:dealId
```

Returns detailed risk breakdown for all trade areas in a deal.

#### Get Risk Score History
```
GET /api/v1/risk/history/:tradeAreaId?category=supply&limit=50
```

Returns time-series risk scores with escalation adjustments.

#### Get Recent Risk Events
```
GET /api/v1/risk/events?category=regulatory&severity=high&limit=20
```

Returns recent escalation/de-escalation events.

#### Force Recalculation
```
POST /api/v1/risk/calculate/:tradeAreaId
```

Forces immediate recalculation of all risk categories.

---

## Database Schema

### New Tables (Migration 029)

1. **regulatory_risk_events** - Legislation and policy tracking
2. **zoning_changes** - Upzone/downzone events
3. **tax_policy_changes** - Tax rate and assessment changes
4. **market_risk_indicators** - Interest rates, cap rates, DSCR
5. **interest_rate_scenarios** - Stress test scenarios
6. **execution_risk_factors** - Construction cost and labor data
7. **construction_cost_tracking** - Time-series cost indices
8. **climate_risk_assessments** - FEMA zones, natural hazards
9. **natural_disaster_events** - Historical disaster tracking

### Key Functions

- `calculate_regulatory_risk_score(trade_area_id)` - SQL function
- `calculate_market_risk_score(trade_area_id)` - SQL function
- `calculate_execution_risk_score(trade_area_id)` - SQL function
- `calculate_climate_risk_score(trade_area_id)` - SQL function
- `fema_zone_to_risk_score(fema_zone)` - FEMA zone mapper

---

## Testing

### Run Test Script
```bash
./test-additional-risk-categories.sh
```

### Expected Results

1. ✓ All 6 risk categories implemented and returning scores
2. ✓ Regulatory risk with stage-weighted probability
3. ✓ Market risk with interest rate sensitivity
4. ✓ Execution risk with cost inflation tracking
5. ✓ Climate risk with FEMA zone mapping
6. ✓ Composite risk calculation using weighted formula
7. ✓ Integration with JEDI Score

---

## Next Steps

1. **Frontend Components** (Phase 3, Component 2)
   - RegulatoryRiskPanel.tsx
   - MarketRiskPanel.tsx
   - ExecutionRiskPanel.tsx
   - ClimateRiskPanel.tsx
   - Update RiskDashboard.tsx to show all 6 categories

2. **Scenario Generation Integration**
   - Use comprehensive risk data for scenario modeling
   - Stress test across all 6 categories
   - Probability-weighted outcomes

3. **Alert System**
   - User-configurable thresholds
   - Real-time monitoring of regulatory events
   - Interest rate alerts
   - Climate event tracking

4. **Data Integration**
   - Connect to legislative tracking APIs
   - Automate interest rate updates
   - Integrate FEMA data feeds
   - Pull construction cost indices

---

## Support

For questions or issues:
- Review this documentation
- Check test script output
- Consult API reference above
- Review migration 029 for schema details
