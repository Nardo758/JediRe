# Scenario Generation - Quick Reference

**JEDI RE Phase 3, Component 2: Evidence-Based Scenario Generation**

## 🎯 What It Does

Generates Bull/Base/Bear/Stress scenarios from actual news events and market intelligence. No more generic +/- 10% stress tests!

## 🚀 Quick Start

### 1. Run Migration
```bash
psql $DATABASE_URL -f backend/src/database/migrations/030_scenario_generation.sql
```

### 2. Generate Scenarios
```bash
# Via API
curl -X POST http://localhost:3001/api/v1/scenarios/generate/{dealId}

# Via Service
const scenarios = await scenarioGenerationService.generateScenariosForDeal({
  dealId: 'deal-uuid',
  trigger: 'manual',
});
```

### 3. View Comparison
```bash
# Via API
curl http://localhost:3001/api/v1/scenarios/{dealId}/comparison

# Via Frontend Component
import { ScenarioComparison } from '@/components/scenarios';
<ScenarioComparison dealId={dealId} />
```

## 📊 Scenario Rules

| Scenario | Demand | Supply | Risk | Impact |
|----------|--------|--------|------|--------|
| **Bull** | 100% positive | 0% new | 0 | Best case |
| **Base** | 80% positive | 80% all | 0 | Expected |
| **Bear** | 50% positive | 120% all | 1 | Pessimistic |
| **Stress** | 0% positive | 150% all | 2+ | Crisis |

## 🔌 API Endpoints

```typescript
// Generate all 4 scenarios
POST /api/v1/scenarios/generate/:dealId

// Get side-by-side comparison
GET /api/v1/scenarios/:dealId/comparison

// Get full scenario details
GET /api/v1/scenarios/:scenarioId/details

// Recalculate after event updates
PUT /api/v1/scenarios/:scenarioId/recalculate

// Create custom scenario
POST /api/v1/scenarios/custom
{
  "dealId": "uuid",
  "scenarioName": "Conservative",
  "selectedEventIds": ["event1", "event2"],
  "assumptionOverrides": {
    "rentGrowth": 0.02,
    "vacancy": 0.08
  }
}

// Get available events for builder
GET /api/v1/scenarios/:dealId/events
```

## 💻 Frontend Components

### ScenarioComparison
```tsx
import { ScenarioComparison } from '@/components/scenarios';

<ScenarioComparison 
  dealId={dealId}
  onScenarioClick={(type) => console.log(`Clicked ${type}`)}
/>
```

**Features**:
- Side-by-side table of all scenarios
- Color-coded metrics (green = good, red = bad)
- Click to see full event details
- Auto-generate button if none exist

### ScenarioBuilder
```tsx
import { ScenarioBuilder } from '@/components/scenarios';

<ScenarioBuilder 
  dealId={dealId}
  onSave={(scenarioId) => console.log(`Saved ${scenarioId}`)}
/>
```

**Features**:
- Checkbox event selection
- Manual assumption overrides
- Save custom scenarios
- Event categorization

## 🔍 Testing

```bash
# Run test script
./test-scenario-generation.sh

# Manual tests
curl -X POST http://localhost:3001/api/v1/scenarios/generate/{dealId}
curl http://localhost:3001/api/v1/scenarios/{dealId}/comparison
```

## 📁 Files

### Backend
- `migrations/030_scenario_generation.sql` - Database schema
- `services/scenario-generation.service.ts` - Core logic
- `api/rest/scenarios.routes.ts` - API endpoints

### Frontend
- `components/scenarios/ScenarioComparison.tsx` - Comparison view
- `components/scenarios/ScenarioBuilder.tsx` - Custom builder
- `components/scenarios/index.ts` - Exports

### Documentation
- `SCENARIO_GENERATION.md` - Full implementation guide
- `SCENARIO_GENERATION_QUICK_REF.md` - This file
- `test-scenario-generation.sh` - Test script

## 🎨 Example Output

```
Deal: Lawrenceville Multifamily

              BULL    BASE    BEAR    STRESS
IRR           21.3%   17.8%   12.4%   6.2%
CoC Year 5    2.8x    2.2x    1.6x    0.9x
NPV           $3.2M   $2.1M   $0.8M   -$0.5M

Assumptions:
- Bull: Amazon 4,500 jobs on time, no competition
- Base: Amazon delayed 12mo, 400 units deliver
- Bear: Amazon 2,250 jobs, 600 units surprise
- Stress: Amazon cancels, 1,200 units, rent control
```

## 🔗 Integration Points

### Phase 1 Systems
- **News Intelligence** → Events source
- **Demand Signals** → Job/housing demand
- **Supply Pipeline** → Competitive supply

### Phase 2 Systems
- **Pro Forma Adjustments** → Baseline assumptions
- **Risk Scoring** → Risk events
- **Audit Trail** → Change tracking

## ⚠️ Common Issues

### No Scenarios Generated
**Cause**: Deal has no trade area assigned

**Fix**: 
```bash
curl -X POST /api/v1/geography/assign-trade-area \
  -d '{"dealId": "...", "address": "..."}'
```

### Empty Event Lists
**Cause**: No events in trade area

**Fix**: Verify news extraction and demand/supply signals are running

### Scenarios Not Updating
**Cause**: Need manual recalculation

**Fix**:
```bash
curl -X PUT /api/v1/scenarios/{scenarioId}/recalculate
```

## 🎯 Key Metrics

Each scenario calculates:
- **IRR**: Internal rate of return
- **CoC**: Cash-on-cash return (Year 5)
- **NPV**: Net present value
- **Cash Flow**: Annual cash flows

With assumptions:
- **Rent Growth**: Annual rent appreciation
- **Vacancy**: Stabilized vacancy rate
- **Exit Cap**: Cap rate at disposition
- **OpEx Growth**: Operating expense growth
- **Absorption**: Time to stabilization (months)

## 📈 Status

✅ Database schema
✅ Scenario generation service
✅ API endpoints (6 routes)
✅ Frontend components (2 components)
✅ Documentation
✅ Test script

## 🚀 Next Steps

1. Integrate into deal detail page
2. Connect to real pro forma engine
3. Auto-regenerate on event updates
4. Add Monte Carlo simulation (optional)
5. Create scenario templates library

---

**Questions?** Check `SCENARIO_GENERATION.md` for full documentation.
