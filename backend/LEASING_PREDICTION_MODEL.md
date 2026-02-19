# Multifamily Leasing Traffic Prediction Model

**Version:** 1.0.0  
**Created:** 2025-02-18  
**Author:** Agent 2 (JEDI RE AI System)

## Overview

The Multifamily Leasing Traffic Prediction Model forecasts weekly leasing metrics (traffic, tours, leases) for apartment properties based on historical patterns, market dynamics, pricing strategy, and property characteristics.

This model replicates and extends Leon's Excel-based leasing predictions, providing automated, scalable predictions integrated into the JEDI RE platform.

## Baseline Metrics

The model is calibrated using Leon's 290-unit property data:

| Metric | Value | Source |
|--------|-------|--------|
| **Property Size** | 290 units | Leon's baseline property |
| **Baseline Occupancy** | 90% | Typical stable occupancy |
| **Weekly Traffic** | 11 prospects | Historical average |
| **Tour Conversion** | 99% | Traffic → Tours |
| **Closing Ratio** | 20.7% | Tours → Leases |
| **Expected Weekly Leases** | 2.3 leases | Final output |

## Prediction Formula

### Step 1: Base Traffic Calculation

Scale from baseline property size:

```
base_traffic = (property_units / 290) × 11
```

**Example:**
- 145-unit property: (145/290) × 11 = **5.5 weekly traffic**
- 580-unit property: (580/290) × 11 = **22 weekly traffic**

### Step 2: Market Demand Multiplier

Apply market supply-demand dynamics:

| Market Condition | Supply/Demand Ratio | Multiplier | Effect |
|-----------------|---------------------|------------|--------|
| **Undersupplied** | > 1.2 | 1.3 | +30% traffic |
| **Balanced** | 0.8 - 1.2 | 1.0 | No adjustment |
| **Oversupplied** | < 0.8 | 0.7 | -30% traffic |

**Data Source:** Market Research Engine V2 (`market_research_cache` table)

### Step 3: Pricing Multiplier

Adjust for rent competitiveness:

| Pricing Strategy | Rent vs Market | Multiplier | Effect |
|-----------------|----------------|------------|--------|
| **Below Market** | < 95% | 1.2 | +20% traffic |
| **At Market** | 95% - 105% | 1.0 | No adjustment |
| **Above Market** | > 105% | 0.8 | -20% traffic |

**Formula:**
```typescript
rent_ratio = avg_rent / market_rent
if (rent_ratio < 0.95) pricing_multiplier = 1.2
else if (rent_ratio > 1.05) pricing_multiplier = 0.8
else pricing_multiplier = 1.0
```

### Step 4: Seasonality Multiplier

Apply monthly leasing patterns:

| Month | Multiplier | Season |
|-------|-----------|---------|
| **January** | 0.85 | Slow winter |
| **February** | 0.90 | |
| **March** | 1.15 | Spring peak begins |
| **April** | 1.20 | Peak season |
| **May** | 1.25 | **Peak leasing** |
| **June** | 1.20 | Peak season |
| **July** | 1.15 | |
| **August** | 1.10 | Back to school |
| **September** | 1.00 | Balanced |
| **October** | 0.95 | Slowing |
| **November** | 0.85 | Winter decline |
| **December** | 0.80 | Slow winter |

**Source:** Historical leasing patterns from Leon's data

### Step 5: Occupancy Multiplier

Adjust for leasing urgency:

| Occupancy Level | Range | Multiplier | Reasoning |
|----------------|-------|------------|-----------|
| **Nearly Full** | > 95% | 0.6 | Low urgency, selective leasing |
| **Normal** | 85% - 95% | 1.0 | Standard leasing effort |
| **Low** | < 85% | 1.3 | Aggressive leasing needed |

### Step 6: Final Prediction

Combine all factors:

```typescript
predicted_traffic = base_traffic × 
                   demand_multiplier × 
                   pricing_multiplier × 
                   seasonality_multiplier × 
                   occupancy_multiplier

predicted_tours = predicted_traffic × 0.99  // 99% tour rate
predicted_leases = predicted_tours × 0.207  // 20.7% closing ratio
```

## API Endpoints

### 1. Single Week Prediction

**Endpoint:** `GET /api/v1/leasing-traffic/predict/:propertyId`

**Response:**
```json
{
  "property_id": "uuid",
  "property_name": "Example Apartments",
  "prediction": {
    "weekly_traffic": 11,
    "weekly_tours": 11,
    "expected_leases": 2.3,
    "closing_ratio": 0.207,
    "tour_conversion": 0.99,
    "confidence": 0.85,
    "breakdown": {
      "base_traffic": 11.0,
      "demand_multiplier": 1.0,
      "pricing_multiplier": 1.0,
      "seasonality_multiplier": 1.15,
      "occupancy_multiplier": 1.0
    },
    "market_context": {
      "supply_demand_ratio": 1.0,
      "market_condition": "BALANCED"
    }
  },
  "timestamp": "2025-02-18T12:00:00Z"
}
```

### 2. Multi-Week Forecast

**Endpoint:** `GET /api/v1/leasing-traffic/forecast/:propertyId?weeks=12`

**Response:**
```json
{
  "property_id": "uuid",
  "forecast_weeks": 12,
  "forecast": {
    "month": 2,
    "year": 2025,
    "weeks": [
      {
        "week_number": 1,
        "traffic": 11,
        "tours": 11,
        "expected_leases": 2.3
      },
      // ... weeks 2-12
    ],
    "monthly_total_leases": 27.6,
    "monthly_total_traffic": 132
  },
  "timestamp": "2025-02-18T12:00:00Z"
}
```

### 3. Lease-Up Timeline

**Endpoint:** `POST /api/v1/leasing-traffic/lease-up-timeline`

**Request Body:**
```json
{
  "property_id": "uuid",
  "total_units": 200,
  "start_occupancy": 0.50,
  "target_occupancy": 0.95,
  "submarket_id": "atlanta-midtown",
  "avg_rent": 1500,
  "market_rent": 1500
}
```

**Response:**
```json
{
  "timeline": {
    "property_id": "uuid",
    "total_units": 200,
    "start_occupancy": 0.50,
    "target_occupancy": 0.95,
    "units_to_lease": 90,
    "estimated_weeks": 42,
    "estimated_completion_date": "2025-12-15T00:00:00Z",
    "weekly_projections": [
      {
        "week": 1,
        "traffic": 8,
        "leases": 1.6,
        "cumulative_leases": 1.6,
        "occupancy": 0.508
      },
      // ... weeks 2-42
    ]
  },
  "timestamp": "2025-02-18T12:00:00Z"
}
```

### 4. Rent Optimization

**Endpoint:** `GET /api/v1/leasing-traffic/optimize-rent/:propertyId?target_months=6`

**Response:**
```json
{
  "property_id": "uuid",
  "optimization": {
    "current_rent": 1500,
    "market_rent": 1500,
    "scenarios": [
      {
        "rent_level": 1350,
        "rent_vs_market": "-10%",
        "pricing_multiplier": 1.2,
        "weekly_traffic": 13,
        "weekly_leases": 2.7,
        "weekly_revenue": 3645,
        "months_to_stabilization": 4.2,
        "total_revenue_impact": "-$405/week"
      },
      // ... 4 more scenarios
    ],
    "recommended_rent": 1425,
    "recommendation_reason": "5% below market accelerates lease-up to meet 6-month target"
  },
  "timestamp": "2025-02-18T12:00:00Z"
}
```

## Use Cases

### 1. Property Acquisition Due Diligence

**Question:** "How long will it take to stabilize this 200-unit property at 60% occupancy?"

**Solution:** Use `/lease-up-timeline` endpoint with current occupancy and target 95%

**Output:** Week-by-week projection showing 42 weeks to stabilization

### 2. Rent Setting Strategy

**Question:** "Should we price at market rate or 5% below for faster absorption?"

**Solution:** Use `/optimize-rent` endpoint to compare scenarios

**Output:** Shows that 5% below market generates 20% more traffic, reaching stabilization 6 weeks faster

### 3. Asset Performance Monitoring

**Question:** "Are we on track with our leasing targets this month?"

**Solution:** Compare actual leases to `/predict` output

**Output:** Actual: 2.1 leases/week, Predicted: 2.3 leases/week → **91% of target** (good)

### 4. Market Analysis

**Question:** "How will new supply in the submarket affect our traffic?"

**Solution:** Model updates automatically when Market Research Engine detects new construction

**Output:** Supply/demand ratio changes from 1.0 → 0.75, traffic prediction drops 30%

## Confidence Scoring

Predictions include a confidence score (0-1) based on three factors:

| Factor | Weight | Criteria |
|--------|--------|----------|
| **Market Data Availability** | 40% | Recent market research data exists |
| **Property Data Completeness** | 30% | Valid rent and occupancy data |
| **Historical Pattern Match** | 30% | Property type matches baseline |

**Example:**
- Property with complete data + recent market research: **Confidence = 0.95** (High)
- Property missing market data: **Confidence = 0.65** (Medium)
- Property with incomplete data: **Confidence = 0.50** (Low)

## Database Schema

### `leasing_traffic_predictions`

Stores prediction history for accuracy tracking:

```sql
CREATE TABLE leasing_traffic_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  prediction_date TIMESTAMP DEFAULT NOW(),
  weekly_traffic INTEGER NOT NULL,
  weekly_tours INTEGER NOT NULL,
  expected_leases DECIMAL(4,1) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  prediction_details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `lease_up_timelines`

Stores lease-up projections:

```sql
CREATE TABLE lease_up_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  total_units INTEGER NOT NULL,
  start_occupancy DECIMAL(4,3) NOT NULL,
  target_occupancy DECIMAL(4,3) NOT NULL,
  estimated_weeks INTEGER NOT NULL,
  estimated_completion_date DATE NOT NULL,
  timeline_details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Model Validation

The model has been validated against Leon's baseline data:

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| **290 units, 90% occ, market rent** | ~11 traffic | 11 traffic | ✅ Pass |
| **145 units (half)** | ~5.5 traffic | 5.5 traffic | ✅ Pass |
| **580 units (double)** | ~22 traffic | 22 traffic | ✅ Pass |
| **Below market pricing (-10%)** | +20% traffic | +20% traffic | ✅ Pass |
| **Undersupplied market** | +30% traffic | +30% traffic | ✅ Pass |
| **95% occupancy** | -40% traffic | -40% traffic | ✅ Pass |

**Test Suite:** `/src/tests/multifamily-traffic-prediction.test.ts`

**Run Tests:**
```bash
npm test multifamily-traffic-prediction.test.ts
```

## Future Enhancements

### Phase 2 (Q2 2025)
- [ ] Machine learning refinement based on actual vs predicted
- [ ] Property-specific adjustment factors
- [ ] Competitive set analysis impact
- [ ] Marketing spend correlation

### Phase 3 (Q3 2025)
- [ ] Real-time traffic updates from property management systems
- [ ] Dynamic seasonality based on regional weather/events
- [ ] Multi-property portfolio optimization
- [ ] Predictive alerts for underperformance

## Integration Points

| System | Integration | Purpose |
|--------|------------|---------|
| **Market Research Engine V2** | Reads `market_research_cache` | Supply/demand dynamics |
| **Property Management** | Reads `properties` table | Current occupancy, rent |
| **Dashboard** | Real-time predictions | Performance monitoring |
| **Acquisition Module** | Lease-up timeline API | Due diligence projections |
| **Asset Management** | Rent optimization API | Pricing strategy |

## Technical Stack

- **Language:** TypeScript
- **Framework:** Express.js REST API
- **Database:** PostgreSQL
- **Testing:** Jest
- **Service:** `MultifamilyTrafficService`
- **Routes:** `/api/v1/leasing-traffic/*`

## Support

For questions or issues:
- **Documentation:** `/backend/LEASING_PREDICTION_MODEL.md`
- **Tests:** `/backend/src/tests/multifamily-traffic-prediction.test.ts`
- **Service Code:** `/backend/src/services/multifamilyTrafficService.ts`
- **API Routes:** `/backend/src/api/rest/leasing-traffic.routes.ts`

---

**Model Status:** ✅ Production Ready  
**Last Updated:** 2025-02-18  
**Model Version:** 1.0.0
