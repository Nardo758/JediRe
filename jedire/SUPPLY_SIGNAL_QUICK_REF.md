# Supply Signal Quick Reference

**Purpose:** Track construction pipeline and calculate supply risk.

## Core Concept

```
Supply Event → Weighted Units → Supply Risk Score
```

**Weight Factors:**
- Permit: 0.60 (60% probability)
- Construction: 0.90 (90% probability)
- Delivered: 1.00 (100% on market)

## Key Formulas

### Supply Risk Score
```
(Pipeline Units ÷ Existing Units) × 100

Low: <10% | Medium: 10-20% | High: 20-35% | Critical: >35%
```

### Months to Absorb
```
Pipeline Units ÷ (Existing Units × 0.015)

Low: <12mo | Medium: 12-24mo | High: 24-36mo | Critical: >36mo
```

### Competitive Impact
```
<1 mile: Direct (100% weight)
1-2 miles: Moderate (50% weight)
2-3 miles: Weak (25% weight)
```

## Quick API Calls

### Get Supply Pipeline
```bash
curl http://localhost:4000/api/v1/supply/trade-area/1
```

### Calculate Risk
```bash
curl http://localhost:4000/api/v1/supply/trade-area/1/risk?quarter=2028-Q1
```

### List Events
```bash
curl http://localhost:4000/api/v1/supply/events?status=permitted
```

### Competitive Analysis
```bash
curl http://localhost:4000/api/v1/supply/competitive/:dealId?max_distance=3.0
```

### Market Dynamics (Demand+Supply)
```bash
curl http://localhost:4000/api/v1/supply/market-dynamics/1?quarter=2028-Q1
```

## Database Tables

- **supply_events** - Construction projects
- **supply_pipeline** - Aggregated pipeline by trade area
- **supply_risk_scores** - Risk scores by quarter
- **competitive_projects** - Competitor analysis
- **supply_delivery_timeline** - Quarterly phasing

## Test Data

10 Atlanta projects seeded:
- 5 permitted (1,580 units)
- 3 under construction (815 units)
- 2 delivered (514 units)

**Total Pipeline:** 2,395 units (1,681.5 weighted)

## Frontend Component

```tsx
import SupplyPipeline from '@/components/deal/SupplyPipeline';

<SupplyPipeline
  dealId="uuid"
  tradeAreaId={1}
  dealLatitude={33.7490}
  dealLongitude={-84.3880}
/>
```

**Views:**
- Map (competitive radius)
- Risk Analysis (gauge + metrics)
- Timeline (quarterly deliveries)
- Table (project details)

## Common Queries

### Pipeline by Status
```sql
SELECT status, COUNT(*), SUM(units), SUM(weighted_units)
FROM supply_events
WHERE msa_id = 1
GROUP BY status;
```

### Upcoming Deliveries
```sql
SELECT project_name, units, expected_delivery_date
FROM supply_events
WHERE status = 'under_construction'
  AND expected_delivery_date BETWEEN '2027-01-01' AND '2027-12-31'
ORDER BY expected_delivery_date;
```

### Supply Risk Trend
```sql
SELECT quarter, supply_risk_score, risk_level
FROM supply_risk_scores
WHERE trade_area_id = 1
ORDER BY quarter;
```

## Risk Interpretation

| Score | Level | Meaning |
|-------|-------|---------|
| <10% | Low | Healthy replacement rate |
| 10-20% | Medium | Manageable growth |
| 20-35% | High | Oversupply risk |
| >35% | Critical | Severe oversupply |

## Integration Points

**Demand Signal:**
```typescript
const demandUnits = await demandSignalService.getTradeAreaForecast(1, '2028-Q1');
const supplyRisk = await supplySignalService.calculateSupplyRisk(1, '2028-Q1', demandUnits);
// Returns: demand-supply gap, net market pressure
```

**JEDI Score:**
```typescript
const supplyRisk = await supplySignalService.calculateSupplyRisk(1, '2028-Q1');
// Feed supplyRiskScore into JEDI calculation (25% weight)
```

## Testing

```bash
./test-supply-signal.sh
```

**Expected:**
- ✓ 10 Atlanta projects loaded
- ✓ Supply risk: 16.82% (HIGH)
- ✓ Absorption: 11.21 months (MEDIUM)
- ✓ Demand-supply gap: -789.2 (OVERSUPPLY)

## Files

- **Migration:** `026_supply_signals.sql`
- **Seed Data:** `027_seed_atlanta_supply_events.sql`
- **Service:** `backend/src/services/supply-signal.service.ts`
- **Routes:** `backend/src/api/rest/supply.routes.ts`
- **Component:** `frontend/src/components/deal/SupplyPipeline.tsx`
- **Docs:** `SUPPLY_SIGNAL_IMPLEMENTATION.md`
- **Test:** `test-supply-signal.sh`

## Next Steps

1. Run migrations
2. Test API endpoints
3. Build frontend component
4. Integrate with JEDI Score
5. Connect to CoStar API (future)
