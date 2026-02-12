# Demand Signal Implementation - JEDI RE Phase 1, Week 2

**Status:** ✅ Complete  
**Date:** February 11, 2026  
**Version:** 1.0

## Overview

The **Demand Signal System** converts news events (employment, university enrollment, military base changes) into **quantified housing demand projections**. This is Phase 1, Week 2 of the JEDI RE News Intelligence Framework.

### What It Does

1. **Extracts Demand Events** from news (job creation, layoffs, student enrollment, etc.)
2. **Calculates Housing Demand** using conversion factors (employees → housing units needed)
3. **Phases Demand Over Time** (quarterly projections: Q1 2028, Q2 2028, etc.)
4. **Stratifies by Income** (% affordable, workforce, luxury housing)
5. **Aggregates by Trade Area** (supply pressure analysis, absorption risk)

### Architecture

```
News Event → Demand Event → Quarterly Projections → Trade Area Forecast
```

**Example Flow:**
```
"Amazon hiring 4,500 employees in Gwinnett"
  ↓
Demand Event: 4,500 × 0.40 conversion × 0.95 non-remote × 0.85 concentration = 1,613 units
  ↓
Projections: Q1 2028: 403 units | Q2 2028: 645 units | Q3 2028: 403 units | Q4 2028: 161 units
  ↓
Trade Area Forecast: Aggregated demand across all events affecting trade area
```

---

## Core Formulas

### Housing Units Calculation

```
Housing Units Needed = People × Conversion Rate × (1 - Remote Work %) × Geographic Concentration
```

**Parameters:**
- **People:** Number of employees, students, military personnel
- **Conversion Rate:** Housing units per person (varies by type)
- **Remote Work %:** Percent of jobs that are remote (reduces local demand)
- **Geographic Concentration:** How much of demand stays in area (0-1)

### Conversion Rates (Base)

| Category | Type | Conversion Rate | Rationale |
|----------|------|----------------|-----------|
| **Employment** | Standard employee | 0.35-0.40 | Average household formation rate |
| | High-income (tech/finance) | 0.50-0.60 | Higher housing formation, luxury demand |
| | Low-income | 0.30-0.35 | Lower housing formation |
| **University** | Student | 0.25-0.30 | Roommates, dorms reduce per-capita demand |
| **Military** | Personnel | 0.60-0.70 | Family housing + barracks equivalent |

### Quarterly Phasing (Standard Hiring)

```
Q1: 25% | Q2: 40% | Q3: 25% | Q4: 10%
```

**Rationale:** Hiring ramps up in Q2, tapers in Q4. Customizable templates available.

---

## Database Schema

### Tables

#### **`demand_event_types`**
Pre-defined event categories and conversion rates.

| Column | Type | Description |
|--------|------|-------------|
| category | VARCHAR | employment, university, military, migration |
| event_type | VARCHAR | job_creation, layoffs, enrollment_increase, etc. |
| demand_direction | VARCHAR | positive, negative, neutral |
| default_conversion_rate | DECIMAL | Base conversion rate (units per person) |

**Examples:**
```sql
SELECT * FROM demand_event_types WHERE category = 'employment';
```

#### **`demand_events`**
Individual demand-generating events extracted from news.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| news_event_id | UUID | Link to news_events table |
| demand_event_type_id | INTEGER | Foreign key to demand_event_types |
| people_count | INTEGER | Employees, students, military |
| income_tier | VARCHAR | low, standard, high, luxury |
| remote_work_pct | DECIMAL | % of jobs that are remote |
| conversion_rate | DECIMAL | Calculated conversion rate |
| geographic_concentration | DECIMAL | 0-1, how localized the demand is |
| total_units | DECIMAL | Calculated housing units needed |
| affordable_pct | DECIMAL | % affordable housing |
| workforce_pct | DECIMAL | % workforce housing |
| luxury_pct | DECIMAL | % luxury housing |
| confidence_score | DECIMAL | 0-100 (data quality) |
| msa_id | INTEGER | Geographic assignment |
| submarket_id | INTEGER | Geographic assignment |

**Query Example:**
```sql
SELECT * FROM demand_events 
WHERE msa_id = 1 
  AND published_at > NOW() - INTERVAL '6 months'
ORDER BY total_units DESC;
```

#### **`demand_projections`**
Quarterly phased demand forecasts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| demand_event_id | UUID | Foreign key to demand_events |
| quarter | VARCHAR | Format: "2028-Q1" |
| quarter_start | DATE | Start of quarter |
| quarter_end | DATE | End of quarter |
| units_projected | DECIMAL | Portion of total demand in this quarter |
| phase_pct | DECIMAL | % of total demand |
| affordable_units | DECIMAL | Affordable housing units |
| workforce_units | DECIMAL | Workforce housing units |
| luxury_units | DECIMAL | Luxury housing units |

**Query Example:**
```sql
SELECT quarter, SUM(units_projected) as total_demand
FROM demand_projections dp
JOIN demand_events de ON de.id = dp.demand_event_id
WHERE de.msa_id = 1
  AND quarter BETWEEN '2028-Q1' AND '2028-Q4'
GROUP BY quarter
ORDER BY quarter;
```

#### **`trade_area_demand_forecast`**
Aggregated demand by trade area and quarter.

| Column | Type | Description |
|--------|------|-------------|
| trade_area_id | INTEGER | Foreign key to trade_areas |
| quarter | VARCHAR | "2028-Q1" |
| total_units_projected | DECIMAL | Sum of all demand events |
| event_count | INTEGER | Number of contributing events |
| positive_units | DECIMAL | New demand |
| negative_units | DECIMAL | Lost demand (layoffs) |
| net_units | DECIMAL | positive - negative |
| existing_units | INTEGER | Current inventory |
| supply_pressure_score | DECIMAL | net_units / existing_units × 100 |
| absorption_risk | VARCHAR | low, medium, high, critical |

**Query Example:**
```sql
SELECT * FROM trade_area_demand_forecast
WHERE trade_area_id = 1
  AND quarter >= '2028-Q1'
ORDER BY quarter;
```

---

## API Reference

Base URL: `/api/v1/demand`

### **GET /trade-area/:id**
Get demand forecast for a trade area.

**Query Params:**
- `start_quarter` (optional): "2028-Q1"
- `end_quarter` (optional): "2028-Q4"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "tradeAreaId": 1,
      "tradeAreaName": "Midtown 3-Mile Radius",
      "quarter": "2028-Q1",
      "totalUnitsProjected": 234.5,
      "eventCount": 3,
      "affordableUnits": 47.2,
      "workforceUnits": 152.8,
      "luxuryUnits": 34.5,
      "positiveUnits": 234.5,
      "negativeUnits": 0.0,
      "netUnits": 234.5,
      "supplyPressureScore": 2.35,
      "absorptionRisk": "low"
    }
  ]
}
```

**cURL Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/demand/trade-area/1?start_quarter=2028-Q1&end_quarter=2028-Q4"
```

---

### **GET /submarket/:id**
Get aggregated demand for a submarket (all trade areas within it).

**Response:**
```json
{
  "success": true,
  "data": {
    "submarketId": 1,
    "tradeAreaCount": 5,
    "aggregated": [
      {
        "quarter": "2028-Q1",
        "totalUnitsProjected": 892.3,
        "eventCount": 8,
        "netUnits": 892.3
      }
    ]
  }
}
```

---

### **GET /events**
List demand-generating events.

**Query Params:**
- `msa_id` (optional): Filter by MSA
- `submarket_id` (optional): Filter by submarket
- `category` (optional): employment, university, military
- `start_date` (optional): ISO 8601
- `end_date` (optional): ISO 8601
- `limit` (optional): Default 50

**Response:**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "uuid",
      "headline": "Amazon to Open Mega Fulfillment Center in Gwinnett, Hiring 4,500",
      "peopleCount": 4500,
      "incomeTier": "standard",
      "totalUnits": 1613.25,
      "confidenceScore": 82.00,
      "publishedAt": "2026-02-01T09:00:00Z"
    }
  ]
}
```

---

### **POST /calculate**
Calculate demand for a news event.

**Request Body:**
```json
{
  "newsEventId": "uuid",
  "headline": "Amazon hiring 4,500 employees...",
  "publishedAt": "2026-02-01T12:00:00Z",
  "category": "employment",
  "eventType": "job_creation",
  "peopleCount": 4500,
  "incomeTier": "standard",
  "remoteWorkPct": 5.0,
  "msaId": 1,
  "submarketId": 5,
  "geographicTier": "area",
  "geographicConcentration": 0.85
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "demandEvent": {
      "id": "uuid",
      "totalUnits": 1613.25,
      "affordablePct": 20.0,
      "workforcePct": 70.0,
      "luxuryPct": 10.0
    },
    "projections": [
      { "quarter": "2028-Q1", "unitsProjected": 403.31 },
      { "quarter": "2028-Q2", "unitsProjected": 645.30 },
      { "quarter": "2028-Q3", "unitsProjected": 403.31 },
      { "quarter": "2028-Q4", "unitsProjected": 161.33 }
    ]
  }
}
```

---

### **GET /impact/:dealId**
Show demand impact on a specific deal.

**Query Params:**
- `start_quarter` (optional)
- `end_quarter` (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "dealId": "uuid",
    "dealName": "Midtown Gardens Acquisition",
    "tradeAreaId": 1,
    "tradeAreaName": "Midtown 3-Mile Radius",
    "forecast": [
      {
        "quarter": "2028-Q1",
        "netUnits": 234.5,
        "supplyPressureScore": 2.35,
        "absorptionRisk": "low"
      }
    ],
    "contributingEvents": [
      {
        "headline": "Google Opens Office in Midtown, 1,200 Jobs",
        "totalUnits": 435.6
      }
    ]
  }
}
```

---

## Usage Examples

### Example 1: News Agent Integration

When the News Agent processes an employment event:

```typescript
import { demandSignalService } from '../services/demand-signal.service';

// After geographic assignment
const demandEvent = await demandSignalService.createDemandEvent({
  newsEventId: newsEvent.id,
  headline: newsEvent.headline,
  sourceUrl: newsEvent.source_url,
  publishedAt: newsEvent.published_at,
  
  category: 'employment',
  eventType: 'job_creation_high_income', // Microsoft tech jobs
  
  peopleCount: 2200,
  incomeTier: 'high',
  remoteWorkPct: 20.0,
  
  msaId: assignment.msa_id,
  submarketId: assignment.submarket_id,
  geographicTier: assignment.tier,
  geographicConcentration: 0.90
});

console.log(`Demand created: ${demandEvent.totalUnits} units`);
```

### Example 2: Deal Analysis

Get demand impact for a deal's trade area:

```typescript
const response = await fetch(
  `http://localhost:4000/api/v1/demand/impact/${dealId}?start_quarter=2028-Q1&end_quarter=2028-Q4`,
  { headers: { Authorization: `Bearer ${token}` } }
);

const { data } = await response.json();

console.log(`Deal: ${data.dealName}`);
console.log(`Q1 2028 Net Demand: ${data.forecast[0].netUnits} units`);
console.log(`Supply Pressure: ${data.forecast[0].supplyPressureScore}%`);
console.log(`Absorption Risk: ${data.forecast[0].absorptionRisk}`);
```

### Example 3: Market Dashboard

Get total demand for Atlanta MSA by quarter:

```sql
SELECT 
  dp.quarter,
  SUM(dp.units_projected) as total_demand,
  COUNT(DISTINCT de.id) as event_count
FROM demand_projections dp
JOIN demand_events de ON de.id = dp.demand_event_id
WHERE de.msa_id = 1  -- Atlanta
  AND dp.quarter BETWEEN '2028-Q1' AND '2028-Q4'
GROUP BY dp.quarter
ORDER BY dp.quarter;
```

### Example 4: Negative Demand (Layoffs)

```typescript
// Delta layoffs - creates NEGATIVE demand
await demandSignalService.createDemandEvent({
  newsEventId: newsEvent.id,
  headline: 'Delta Air Lines Announces 800 Job Cuts',
  publishedAt: new Date('2026-02-05'),
  
  category: 'employment',
  eventType: 'layoffs', // direction = 'negative' in demand_event_types
  
  peopleCount: 800,
  incomeTier: 'standard',
  remoteWorkPct: 0,
  
  msaId: 1,
  geographicTier: 'metro'
});

// Result: -280 units (negative demand)
```

---

## Test Data: Atlanta

### Seed Events

Run migrations:
```bash
psql $DATABASE_URL -f backend/src/database/migrations/023_demand_signals.sql
psql $DATABASE_URL -f backend/src/database/migrations/024_seed_atlanta_demand_events.sql
```

### Events Included

| Event | People | Total Units | Income Tier | Category |
|-------|--------|-------------|-------------|----------|
| Amazon Gwinnett | 4,500 | 1,613.25 | Standard | Employment |
| Microsoft Sandy Springs | 2,200 | 871.20 | High | Employment |
| Georgia Tech Midtown | 1,500 | 391.88 | Standard | University |
| Delta Layoffs | 800 | -280.00 | Standard | Employment (Negative) |
| Google Midtown | 1,200 | 435.60 | High | Employment |
| Emory Decatur | 900 | 207.00 | Standard | University |
| Siemens Cumberland | 650 | 176.96 | Standard | Employment |
| Netflix West Midtown | 400 | 159.98 | High | Employment |

**Total Net Demand:** 3,575.87 units (positive) - 280.00 units (negative) = **3,295.87 units**

---

## Testing

### Test API Endpoints

**1. List Events:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/demand/events?msa_id=1&limit=10"
```

**2. Calculate New Demand:**
```bash
curl -X POST http://localhost:4000/api/v1/demand/calculate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "newsEventId": "test-uuid",
    "headline": "Test Company Hiring 1000",
    "publishedAt": "2026-02-11T12:00:00Z",
    "category": "employment",
    "eventType": "job_creation",
    "peopleCount": 1000,
    "incomeTier": "standard",
    "remoteWorkPct": 10,
    "msaId": 1,
    "geographicTier": "metro"
  }'
```

**3. Get Trade Area Forecast:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/demand/trade-area/1?start_quarter=2028-Q1"
```

### Validate Calculations

```sql
-- Check demand event calculations
SELECT 
  headline,
  people_count,
  conversion_rate,
  remote_work_pct,
  geographic_concentration,
  total_units,
  -- Verify formula: people × rate × (1 - remote%) × concentration
  people_count * conversion_rate * (1 - remote_work_pct/100) * geographic_concentration as calculated_units
FROM demand_events;
```

---

## Configuration

### Environment Variables

```env
# No additional env vars required
# Uses existing DATABASE_URL
```

### Phasing Templates

Custom phasing templates can be added:

```sql
INSERT INTO demand_phasing_templates (name, description, phase_distribution, applicable_categories)
VALUES (
  'rapid_tech_hiring',
  'Fast hiring for tech startups',
  '{"Q1": 45, "Q2": 35, "Q3": 15, "Q4": 5}'::jsonb,
  ARRAY['employment']
);
```

Then use in API:
```json
{
  "phasingTemplate": "rapid_tech_hiring"
}
```

---

## Integration Points

### With Geographic Assignment (Week 1)

Demand Signal Service uses `geographicAssignmentService` to:
- Assign events to MSA/Submarket/Trade Area
- Link demand projections to trade areas via `trade_area_event_impacts`

### With News Intelligence (Future)

When News Agent detects employment events:
```typescript
if (eventCategory === 'employment' && employeeCount > 0) {
  await demandSignalService.createDemandEvent({...});
}
```

### With JEDI Score (Week 3)

Demand projections will feed into JEDI Score calculation:
- Supply pressure component
- Market momentum component
- Absorption risk adjustment

### Kafka Events (Future)

Publish demand updates:
```typescript
kafka.publish('signals.demand.updated', {
  demandEventId: event.id,
  totalUnits: event.totalUnits,
  quarter: 'Q1-2028',
  msaId: event.msaId
});
```

---

## Performance Considerations

### Indexes

All critical columns indexed:
- `demand_events(news_event_id)`
- `demand_events(msa_id, submarket_id)`
- `demand_projections(demand_event_id, quarter)`
- `trade_area_demand_forecast(trade_area_id, quarter)`

### Aggregation Strategy

Trade area forecasts are **pre-aggregated** and cached in `trade_area_demand_forecast`. Recalculate when:
- New demand event added
- Manual trigger via API: `POST /demand/aggregate/:tradeAreaId`

### Scaling

- **< 10,000 events:** Current implementation sufficient
- **> 10,000 events:** Consider materialized views for MSA/Submarket aggregations

---

## Confidence Scoring

Each demand event has a confidence score (0-100) based on:

| Factor | Weight | Criteria |
|--------|--------|----------|
| Source Reliability | 30% | WSJ/Bloomberg = 90, Others = 70 |
| Data Completeness | 30% | Has people_count, MSA, submarket |
| Geographic Specificity | 20% | Pin-drop = 90, Area = 70, Metro = 50 |
| Time Freshness | 20% | <7 days = 90, <30 days = 70, <90 days = 50 |

**Use Cases:**
- Filter low-confidence events: `WHERE confidence_score >= 70`
- Weight events in JEDI Score calculation
- Display uncertainty in UI

---

## Future Enhancements

### Phase 2 (Weeks 3-4)
- **JEDI Score Integration:** Use demand projections in overall market scoring
- **Supply Pressure Dashboard:** Real-time absorption risk monitoring
- **Alert System:** Notify users when critical supply pressure detected

### Phase 3 (Future)
- **Machine Learning:** Predict conversion rates from historical data
- **Competitive Analysis:** Compare demand across competing properties
- **Migration Patterns:** Track population inflows/outflows at zip code level

---

## Troubleshooting

### Issue: Projections Not Generating

**Check:**
```sql
SELECT * FROM demand_phasing_templates WHERE name = 'standard_hiring';
```

If empty, re-run migration 023.

### Issue: Trade Area Forecast Empty

**Solution:** Manually trigger aggregation:
```bash
curl -X POST http://localhost:4000/api/v1/demand/aggregate/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"quarter": "2028-Q1"}'
```

### Issue: Negative Units Not Showing

**Check:**
```sql
SELECT demand_direction FROM demand_event_types WHERE event_type = 'layoffs';
-- Should be 'negative'
```

Negative units are calculated in projections generation.

---

## License

Proprietary - JEDI RE Platform © 2026

---

## Support

- **Documentation:** This file + API_REFERENCE.md
- **Logs:** `backend/logs/app.log`
- **Database:** Enable query logging in PostgreSQL
- **Contact:** Development team

---

**Status:** ✅ Production-ready | Week 2 Complete | Ready for Week 3 JEDI Score Integration
