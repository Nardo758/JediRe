# Demand Signal - Quick Reference

**Week 2 Implementation - JEDI RE Phase 1**

## Setup (5 minutes)

```bash
# 1. Run migrations
psql $DATABASE_URL -f backend/src/database/migrations/023_demand_signals.sql
psql $DATABASE_URL -f backend/src/database/migrations/024_seed_atlanta_demand_events.sql

# 2. Test API
./test-demand-signal.sh

# 3. Start server (if not running)
npm run dev
```

## Core Formula

```
Housing Units = People × Rate × (1 - Remote%) × Concentration
```

## Conversion Rates

| Type | Rate |
|------|------|
| Standard employee | 0.35-0.40 |
| High-income (tech) | 0.50-0.60 |
| University student | 0.25-0.30 |
| Military | 0.60-0.70 |

## API Quick Test

```bash
# List events
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/demand/events?msa_id=1"

# Calculate demand
curl -X POST http://localhost:4000/api/v1/demand/calculate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "newsEventId": "uuid",
    "headline": "Company hiring 1000",
    "category": "employment",
    "eventType": "job_creation",
    "peopleCount": 1000,
    "incomeTier": "standard",
    "publishedAt": "2026-02-11T12:00:00Z",
    "msaId": 1
  }'

# Get trade area forecast
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/demand/trade-area/1?start_quarter=2028-Q1"
```

## Database Quick Checks

```sql
-- View all demand events
SELECT headline, people_count, total_units, confidence_score
FROM demand_events
ORDER BY published_at DESC;

-- View projections
SELECT de.headline, dp.quarter, dp.units_projected
FROM demand_projections dp
JOIN demand_events de ON de.id = dp.demand_event_id
ORDER BY de.headline, dp.quarter;

-- View trade area forecast
SELECT * FROM trade_area_demand_forecast
WHERE quarter = '2028-Q1';
```

## Service Usage (TypeScript)

```typescript
import { demandSignalService } from './services/demand-signal.service';

// Create demand event
const demand = await demandSignalService.createDemandEvent({
  newsEventId: 'uuid',
  headline: 'Amazon hiring 4500',
  category: 'employment',
  eventType: 'job_creation',
  peopleCount: 4500,
  incomeTier: 'standard',
  publishedAt: new Date(),
  msaId: 1
});

// Get forecast
const forecast = await demandSignalService.getTradeAreaForecast(
  1, // tradeAreaId
  '2028-Q1',
  '2028-Q4'
);

// List events
const events = await demandSignalService.getDemandEvents({
  msaId: 1,
  category: 'employment',
  limit: 50
});
```

## Event Types

```sql
SELECT category, event_type, demand_direction, default_conversion_rate
FROM demand_event_types
ORDER BY category, event_type;
```

**Categories:** employment, university, military, migration

**Directions:** positive, negative, neutral

## Income Stratification

| Income Tier | Affordable % | Workforce % | Luxury % |
|-------------|--------------|-------------|----------|
| Low | 60 | 35 | 5 |
| Standard | 20 | 70 | 10 |
| High | 5 | 40 | 55 |
| Luxury | 0 | 20 | 80 |

## Quarterly Phasing (Standard)

```
Q1: 25% | Q2: 40% | Q3: 25% | Q4: 10%
```

## Confidence Scoring

| Factor | Weight | Scoring |
|--------|--------|---------|
| Source reliability | 30% | WSJ/Bloomberg=90, Other=70 |
| Data completeness | 30% | Has MSA/submarket=high |
| Geographic specificity | 20% | Pin-drop=90, Metro=50 |
| Time freshness | 20% | <7days=90, >90days=50 |

## Integration Points

**Week 1 (Geographic Assignment):**
- Uses MSA/Submarket/Trade Area hierarchy
- Links to `trade_area_event_impacts`

**Week 3 (JEDI Score):**
- Supply pressure component
- Market momentum component
- Absorption risk

**News Agent:**
```typescript
if (event.category === 'employment' && event.employeeCount) {
  await demandSignalService.createDemandEvent({...});
}
```

## Test Data Summary

| Event | Units | Type |
|-------|-------|------|
| Amazon Gwinnett | 1,613 | Employment+ |
| Microsoft Sandy Springs | 871 | Employment+ |
| Georgia Tech | 392 | University+ |
| Delta Layoffs | -280 | Employment- |
| Google Midtown | 436 | Employment+ |
| Emory | 207 | University+ |
| Siemens | 177 | Employment+ |
| Netflix | 160 | Employment+ |

**Total Net:** 3,576 units

## Common Issues

**No projections?**
```sql
SELECT * FROM demand_phasing_templates;
-- If empty, re-run migration 023
```

**Trade area forecast empty?**
```bash
curl -X POST http://localhost:4000/api/v1/demand/aggregate/1 \
  -d '{"quarter": "2028-Q1"}'
```

**Calculations off?**
```sql
SELECT 
  people_count * conversion_rate * (1 - remote_work_pct/100) * geographic_concentration as expected,
  total_units as actual
FROM demand_events;
```

## Files

- **Service:** `backend/src/services/demand-signal.service.ts`
- **Routes:** `backend/src/api/rest/demand.routes.ts`
- **Migration:** `backend/src/database/migrations/023_demand_signals.sql`
- **Seed:** `backend/src/database/migrations/024_seed_atlanta_demand_events.sql`
- **Docs:** `DEMAND_SIGNAL_IMPLEMENTATION.md`
- **Test:** `./test-demand-signal.sh`

## Next Steps (Week 3)

1. **JEDI Score Integration** - Use demand projections in scoring
2. **Supply Pressure Dashboard** - Real-time absorption monitoring
3. **Alert System** - Notify on critical supply pressure
4. **News Agent Hooks** - Auto-create demand events from news

---

**Status:** ✅ Week 2 Complete | Ready for Production
