## Supply Signal Implementation - JEDI RE Phase 2, Component 2

**Status:** ✅ Complete  
**Date:** February 11, 2026  
**Version:** 1.0

## Overview

The **Supply Signal System** tracks construction pipeline (permits, starts, completions) and calculates supply risk for trade areas. This completes the demand-supply dynamics analysis for the JEDI RE platform.

### What It Does

1. **Tracks Construction Pipeline** (permits, groundbreaking, completions)
2. **Calculates Supply Risk** using pipeline-to-existing-units ratio
3. **Phases Supply Deliveries** over time (quarterly projections)
4. **Identifies Competitive Projects** within radius of deals
5. **Integrates with Demand Signal** for demand-supply gap analysis

### Architecture

```
Supply Event → Weighted Units → Delivery Timeline → Supply Risk Score → Demand-Supply Gap
```

**Example Flow:**
```
"385-unit luxury tower permit filed in Midtown"
  ↓
Weighted Units: 385 × 0.60 (permit probability) = 231 units
  ↓
Delivery Timeline: Q3 2027 (20 months from permit)
  ↓
Supply Risk Score: (1,681 pipeline ÷ 10,000 existing) × 100 = 16.8% (HIGH RISK)
  ↓
Demand-Supply Gap: 892 demand units - 1,681 supply units = -789 (OVERSUPPLY)
```

---

## Core Formulas

### Weighted Units Calculation

```
Weighted Units = Units × Weight Factor

Weight Factors:
- Permit Filed: 0.60 (60% probability of delivery)
- Under Construction: 0.90 (90% probability)
- Delivered: 1.00 (100% - units on market)
```

**Rationale:** Not all permitted projects get built. Weight factors account for probability.

### Supply Risk Score

```
Supply Risk Score (0-100) = (Pipeline Units ÷ Existing Units) × 100

Risk Levels:
- Low: <10% (healthy replacement rate)
- Medium: 10-20% (manageable growth)
- High: 20-35% (oversupply risk)
- Critical: >35% (severe oversupply)
```

### Absorption Analysis

```
Months to Absorb = Pipeline Units ÷ Historical Monthly Absorption

Historical Monthly Absorption = Existing Units × 0.015 (1.5% per month)

Absorption Risk:
- Low: <12 months
- Medium: 12-24 months
- High: 24-36 months
- Critical: >36 months
```

### Competitive Impact Weighting

```
Distance-Based Impact:
- < 1 mile: Direct competition (100% impact weight)
- 1-2 miles: Moderate competition (50% impact weight)
- 2-3 miles: Weak competition (25% impact weight)
```

---

## Database Schema

### Tables

#### **`supply_event_types`**
Pre-defined supply event categories.

| Column | Type | Description |
|--------|------|-------------|
| category | VARCHAR | permit, construction, completion, demolition, policy |
| event_type | VARCHAR | multifamily_permit_filed, under_construction, delivery, etc. |
| supply_direction | VARCHAR | positive (adds units), negative (removes units) |
| weight_factor | DECIMAL | Probability weight (0.6-1.0) |
| typical_timeline_months | INTEGER | Expected months until delivery |

**Examples:**
```sql
SELECT * FROM supply_event_types WHERE category = 'permit';
-- Returns: multifamily_permit_filed (0.60 weight, 12 months)
```

#### **`supply_events`**
Individual construction pipeline events.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| supply_event_type_id | INTEGER | Foreign key to supply_event_types |
| project_name | VARCHAR | "The Meridian", "West Midtown Square", etc. |
| developer | VARCHAR | "Mill Creek Residential", "JPI", etc. |
| units | INTEGER | Total units (positive or negative) |
| weighted_units | DECIMAL | units × weight_factor |
| price_tier | VARCHAR | affordable, workforce, market_rate, luxury |
| event_date | DATE | Permit date, groundbreaking date, etc. |
| expected_delivery_date | DATE | Estimated completion |
| actual_delivery_date | DATE | Actual completion (for delivered projects) |
| status | VARCHAR | permitted, under_construction, delivered, cancelled |
| latitude/longitude | DECIMAL | Project location |
| msa_id/submarket_id | INTEGER | Geographic assignment |

**Query Example:**
```sql
SELECT project_name, units, weighted_units, status, expected_delivery_date
FROM supply_events
WHERE msa_id = 1 
  AND status IN ('permitted', 'under_construction')
ORDER BY expected_delivery_date;
```

#### **`supply_pipeline`**
Aggregated current pipeline state by trade area.

| Column | Type | Description |
|--------|------|-------------|
| trade_area_id | INTEGER | Foreign key to trade_areas |
| permitted_projects | INTEGER | Count of permitted projects |
| permitted_units | INTEGER | Total units in permits |
| permitted_weighted_units | DECIMAL | Probability-adjusted permitted units |
| construction_projects | INTEGER | Count of under-construction projects |
| construction_units | INTEGER | Total units under construction |
| construction_weighted_units | DECIMAL | Weighted construction units |
| delivered_12mo_projects | INTEGER | Delivered in last 12 months |
| delivered_12mo_units | INTEGER | Units delivered recently |
| total_pipeline_projects | INTEGER | All active projects |
| total_pipeline_units | INTEGER | All pipeline units |
| total_weighted_units | DECIMAL | Total weighted pipeline |
| existing_units | INTEGER | Current inventory (from trade area stats) |

**Query Example:**
```sql
SELECT * FROM supply_pipeline WHERE trade_area_id = 1;
-- Returns: Current pipeline summary for trade area
```

#### **`supply_risk_scores`**
Time-series supply risk scoring.

| Column | Type | Description |
|--------|------|-------------|
| trade_area_id | INTEGER | Foreign key |
| quarter | VARCHAR | "2028-Q1" |
| pipeline_units | DECIMAL | Total units in pipeline |
| weighted_pipeline_units | DECIMAL | Probability-adjusted |
| existing_units | INTEGER | Current inventory |
| supply_risk_score | DECIMAL | (pipeline ÷ existing) × 100 |
| risk_level | VARCHAR | low, medium, high, critical |
| months_to_absorb | DECIMAL | Pipeline ÷ monthly absorption |
| absorption_risk | VARCHAR | low, medium, high, critical |
| demand_units | DECIMAL | From demand_signal (optional) |
| demand_supply_gap | DECIMAL | demand - supply |
| net_market_pressure | DECIMAL | gap / existing × 100 |

**Query Example:**
```sql
SELECT * FROM supply_risk_scores
WHERE trade_area_id = 1
  AND quarter >= '2028-Q1'
ORDER BY quarter;
```

#### **`competitive_projects`**
Competitive project analysis for deals.

| Column | Type | Description |
|--------|------|-------------|
| deal_id | UUID | Reference to deals table |
| supply_event_id | UUID | Reference to supply_events |
| distance_miles | DECIMAL | Distance from deal |
| competitive_impact | VARCHAR | direct (<1mi), moderate (1-2mi), weak (2-3mi) |
| impact_weight | DECIMAL | 1.0, 0.5, or 0.25 |
| unit_count_difference | INTEGER | Competitor units - deal units |
| price_tier_match | BOOLEAN | Same price tier? |
| delivery_timing | VARCHAR | before_acquisition, concurrent, after_stabilization |

**Query Example:**
```sql
SELECT se.project_name, cp.distance_miles, cp.competitive_impact, cp.price_tier_match
FROM competitive_projects cp
JOIN supply_events se ON se.id = cp.supply_event_id
WHERE cp.deal_id = 'your-deal-uuid'
ORDER BY cp.distance_miles;
```

#### **`supply_delivery_timeline`**
Quarterly phasing of supply deliveries.

| Column | Type | Description |
|--------|------|-------------|
| supply_event_id | UUID | Foreign key |
| quarter | VARCHAR | "2028-Q1" |
| quarter_start/end | DATE | Quarter boundaries |
| units_delivered | DECIMAL | Units delivered this quarter |
| weighted_units_delivered | DECIMAL | Weighted units |

**Query Example:**
```sql
SELECT quarter, SUM(units_delivered) as total_units
FROM supply_delivery_timeline
WHERE quarter BETWEEN '2027-Q1' AND '2028-Q4'
GROUP BY quarter
ORDER BY quarter;
```

---

## API Reference

Base URL: `/api/v1/supply`

### **GET /trade-area/:id**
Get supply pipeline for a trade area.

**Response:**
```json
{
  "success": true,
  "data": {
    "tradeAreaId": 1,
    "permittedProjects": 5,
    "permittedUnits": 1580,
    "permittedWeightedUnits": 948.0,
    "constructionProjects": 3,
    "constructionUnits": 815,
    "constructionWeightedUnits": 733.5,
    "delivered12moProjects": 2,
    "delivered12moUnits": 514,
    "totalPipelineProjects": 10,
    "totalPipelineUnits": 2395,
    "totalWeightedUnits": 1681.5,
    "existingUnits": 10000,
    "lastUpdated": "2026-02-11T12:00:00Z"
  }
}
```

---

### **GET /trade-area/:id/risk**
Get supply risk score for a trade area.

**Query Params:**
- `quarter` (optional): Default "2028-Q1"

**Response:**
```json
{
  "success": true,
  "data": {
    "tradeAreaId": 1,
    "quarter": "2028-Q1",
    "pipelineUnits": 2395,
    "weightedPipelineUnits": 1681.5,
    "existingUnits": 10000,
    "supplyRiskScore": 16.82,
    "riskLevel": "high",
    "monthsToAbsorb": 11.21,
    "absorptionRisk": "medium",
    "demandUnits": 892.3,
    "demandSupplyGap": -789.2,
    "netMarketPressure": -7.89
  }
}
```

**Risk Interpretation:**
- **supplyRiskScore: 16.82%** - HIGH RISK (exceeds 10% threshold)
- **monthsToAbsorb: 11.21 months** - MEDIUM RISK (under 12 months is acceptable)
- **demandSupplyGap: -789** - OVERSUPPLY (789 more units than demand)
- **netMarketPressure: -7.89%** - Negative pressure (oversupply)

---

### **GET /events**
List supply events (permits, starts, completions).

**Query Params:**
- `msa_id` (optional)
- `submarket_id` (optional)
- `status` (optional): permitted, under_construction, delivered
- `category` (optional): permit, construction, completion
- `start_date` (optional): ISO 8601
- `end_date` (optional): ISO 8601
- `limit` (optional): Default 50

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "uuid",
      "projectName": "The Meridian",
      "developer": "Mill Creek Residential",
      "units": 385,
      "weightedUnits": 231.0,
      "status": "permitted",
      "eventDate": "2026-01-15",
      "expectedDeliveryDate": "2027-09-01",
      "priceTier": "luxury",
      "latitude": 33.7849,
      "longitude": -84.3850
    }
  ]
}
```

---

### **POST /event**
Create a supply event (for testing or manual entry).

**Request Body:**
```json
{
  "projectName": "Test Tower",
  "developer": "Test Developer LLC",
  "address": "123 Test St, Atlanta, GA",
  "category": "permit",
  "eventType": "multifamily_permit_filed",
  "units": 250,
  "oneBedUnits": 125,
  "twoBedUnits": 100,
  "threeBedUnits": 25,
  "avgRent": 2000.00,
  "priceTier": "market_rate",
  "eventDate": "2026-02-11T00:00:00Z",
  "expectedDeliveryDate": "2027-12-01T00:00:00Z",
  "status": "permitted",
  "latitude": 33.7490,
  "longitude": -84.3880,
  "msaId": 1,
  "sourceType": "manual",
  "dataSourceConfidence": 75.0,
  "notes": "Test project"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectName": "Test Tower",
    "units": 250,
    "weightedUnits": 150.0,
    "status": "permitted"
  }
}
```

---

### **PUT /event/:id/status**
Update supply event status (permit → construction → delivered).

**Request Body:**
```json
{
  "status": "under_construction",
  "actualDeliveryDate": "2027-12-01T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Supply event status updated"
}
```

---

### **GET /competitive/:dealId**
Get competitive projects near a deal.

**Query Params:**
- `max_distance` (optional): Default 3.0 miles

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "dealId": "uuid",
      "supplyEventId": "uuid",
      "projectName": "West Midtown Square",
      "units": 275,
      "distanceMiles": 0.85,
      "competitiveImpact": "direct",
      "impactWeight": 1.0,
      "priceTierMatch": true,
      "deliveryTiming": "concurrent",
      "expectedDeliveryDate": "2027-03-15"
    }
  ]
}
```

---

### **GET /timeline/:tradeAreaId**
Get supply delivery timeline for trade area.

**Query Params:**
- `start_quarter` (optional): "2027-Q1"
- `end_quarter` (optional): "2028-Q4"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "quarter": "2027-Q3",
      "quarterStart": "2027-07-01",
      "quarterEnd": "2027-09-30",
      "projects": [
        {
          "projectName": "The Meridian",
          "units": 385,
          "weightedUnits": 231.0,
          "status": "permitted"
        }
      ],
      "totalUnits": 385,
      "totalWeightedUnits": 231.0
    }
  ]
}
```

---

### **GET /market-dynamics/:tradeAreaId**
Get combined demand-supply analysis.

**Query Params:**
- `quarter` (optional): Default "2028-Q1"

**Response:**
```json
{
  "success": true,
  "data": {
    "tradeAreaId": 1,
    "quarter": "2028-Q1",
    "demand": {
      "totalUnitsProjected": 892.3,
      "netUnits": 892.3,
      "positiveUnits": 892.3,
      "negativeUnits": 0,
      "eventCount": 8
    },
    "supply": {
      "pipelineUnits": 2395,
      "weightedPipelineUnits": 1681.5,
      "permittedUnits": 1580,
      "constructionUnits": 815,
      "delivered12moUnits": 514
    },
    "risk": {
      "supplyRiskScore": 16.82,
      "riskLevel": "high",
      "monthsToAbsorb": 11.21,
      "absorptionRisk": "medium"
    },
    "marketBalance": {
      "demandSupplyGap": -789.2,
      "netMarketPressure": -7.89,
      "interpretation": "Oversupply risk - Demand significantly below supply"
    }
  }
}
```

---

## Test Data: 10 Atlanta Projects

### Seed Data Summary

Run migrations:
```bash
psql $DATABASE_URL -f backend/migrations/026_supply_signals.sql
psql $DATABASE_URL -f backend/migrations/027_seed_atlanta_supply_events.sql
```

### Projects Included

| Project | Status | Units | Weighted | Price Tier | Location | Delivery |
|---------|--------|-------|----------|------------|----------|----------|
| **The Meridian** | Permitted | 385 | 231 | Luxury | Midtown | Q3 2027 |
| **Gwinnett Station** | Permitted | 298 | 179 | Workforce | Gwinnett | Q2 2027 |
| **Cumberland Yards** | Permitted | 420 | 231 | Market Rate | Cumberland | Q1 2028 |
| **Decatur Station** | Permitted | 165 | 99 | Affordable | Decatur | Q2 2027 |
| **Sandy Springs UV** | Permitted | 312 | 187 | Market Rate | Sandy Springs | Q4 2027 |
| **West Midtown Square** | Construction | 275 | 248 | Luxury | West Midtown | Q1 2027 |
| **Perimeter Plaza** | Construction | 342 | 308 | Market Rate | Perimeter | Q4 2026 |
| **Old Fourth Ward** | Construction | 198 | 178 | Workforce | O4W | Q2 2027 |
| **Buckhead Heights** | Delivered | 225 | 225 | Luxury | Buckhead | Jun 2025 |
| **Alpharetta Station** | Delivered | 289 | 289 | Market Rate | Alpharetta | Aug 2025 |

**Totals:**
- **Pipeline:** 2,395 units (1,681.5 weighted)
- **Permitted:** 1,580 units (948 weighted)
- **Construction:** 815 units (733.5 weighted)
- **Delivered (12mo):** 514 units

**Risk Analysis:**
- **Supply Risk Score:** 16.82% (HIGH)
- **Absorption:** 11.21 months (MEDIUM)

---

## Frontend Component

### SupplyPipeline.tsx

**Location:** `frontend/src/components/deal/SupplyPipeline.tsx`

**Features:**
- **Map View:** Show competitive projects with distance circles (1mi, 2mi, 3mi)
- **Risk Analysis View:** Risk gauge, metrics grid, interpretation
- **Timeline View:** Bar chart of quarterly deliveries
- **Table View:** Sortable list of competitive projects

**Usage:**
```tsx
import SupplyPipeline from '@/components/deal/SupplyPipeline';

<SupplyPipeline
  dealId="uuid"
  tradeAreaId={1}
  dealLatitude={33.7490}
  dealLongitude={-84.3880}
/>
```

**Dependencies:**
- react-leaflet (map visualization)
- recharts (charts)
- leaflet CSS

---

## Integration Points

### With Demand Signal (Phase 1, Week 2)

Supply Signal integrates with Demand Signal:
```typescript
// Get demand forecast
const demandForecast = await demandSignalService.getTradeAreaForecast(tradeAreaId, quarter);

// Calculate supply risk with demand data
const supplyRisk = await supplySignalService.calculateSupplyRisk(
  tradeAreaId,
  quarter,
  demandForecast.netUnits
);

// Result: demand-supply gap, net market pressure
console.log(`Demand-Supply Gap: ${supplyRisk.demandSupplyGap}`);
```

### With Geographic Assignment (Phase 1, Week 1)

Supply events linked to trade areas via `trade_area_event_impacts`:
```sql
SELECT se.project_name, se.units, ta.name
FROM supply_events se
JOIN trade_area_event_impacts taei ON taei.event_id = se.news_event_id
JOIN trade_areas ta ON ta.id = taei.trade_area_id
WHERE ta.id = 1;
```

### With JEDI Score (Phase 1, Week 3)

Supply risk feeds into JEDI Score:
```typescript
const supplyRisk = await supplySignalService.calculateSupplyRisk(tradeAreaId, quarter);

// JEDI Score incorporates supply risk (25% weight)
const jediScore = calculateJediScore({
  ...otherFactors,
  supplyRiskScore: supplyRisk.supplyRiskScore,
  riskLevel: supplyRisk.riskLevel
});
```

---

## Testing

### Test Script

**Run:**
```bash
./test-supply-signal.sh
```

**Tests:**
1. List all supply events
2. Filter by status (permitted, construction)
3. Get supply pipeline for trade area
4. Calculate supply risk score
5. Create new supply event
6. Update event status (permit → construction)
7. Get delivery timeline
8. Analyze market dynamics (demand-supply)
9. Get competitive projects for deal

**Expected Output:**
```
✓ Supply events listed
✓ Supply pipeline retrieved
✓ Supply risk calculated: 16.82% (HIGH RISK)
✓ Demand-supply gap: -789.2 (OVERSUPPLY)
✓ Competitive projects identified
```

---

## Performance Considerations

### Indexes

All critical queries indexed:
- `supply_events(msa_id, submarket_id)`
- `supply_events(status)`
- `supply_events(expected_delivery_date)`
- `supply_events(latitude, longitude)`
- `supply_pipeline(trade_area_id)`
- `supply_risk_scores(trade_area_id, quarter)`

### Caching Strategy

Supply pipeline is **pre-aggregated** in `supply_pipeline` table. Update triggers:
- New supply event created
- Event status changed
- Manual refresh: `SELECT update_supply_pipeline(1)`

### Scaling

- **< 10,000 supply events:** Current implementation sufficient
- **> 10,000 supply events:** Consider materialized views for MSA aggregations

---

## Future Enhancements

### Phase 3 (Future)
- **CoStar API Integration:** Live construction data
- **Permit Database Scrapers:** Automated permit tracking
- **News Intelligence Integration:** Extract supply events from news
- **Machine Learning:** Predict delivery timelines
- **Absorption Rate Modeling:** Historical absorption analysis

---

## License

Proprietary - JEDI RE Platform © 2026

---

## Support

- **Documentation:** This file + API_REFERENCE.md
- **Test Script:** `test-supply-signal.sh`
- **Logs:** `backend/logs/app.log`
- **Contact:** Development team

---

**Status:** ✅ Production-ready | Phase 2, Component 2 Complete | Ready for JEDI Score Integration
