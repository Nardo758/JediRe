# Additional Risk Categories - Quick Reference

## 🚀 Quick Start

### 1. Apply Database Migration
```bash
cd backend
npm run db:migrate
npm run db:seed
```

### 2. Test API Endpoints
```bash
cd /home/leon/clawd/jedire
./test-additional-risk-categories.sh
```

### 3. Access Frontend Components
```typescript
import {
  RegulatoryRiskPanel,
  MarketRiskPanel,
  ExecutionRiskPanel,
  ClimateRiskPanel
} from '@/components/risk';

// Use in your component
<RegulatoryRiskPanel tradeAreaId="uuid" />
```

---

## 📊 Risk Categories Overview

| Category | Weight | Score Range | Key Factors |
|----------|--------|-------------|-------------|
| **Regulatory** | 10% | 0-100 | Legislation stage, rent control, STR restrictions, zoning, taxes |
| **Market** | 10% | 0-100 | Interest rates, cap rate expansion, DSCR, liquidity, recession |
| **Execution** | 5% | 0-100 | Contingency %, cost inflation, labor market, overrun history |
| **Climate** | 5% | 0-100 | FEMA zones, wildfire, hurricane, insurance, disasters |

---

## 🔑 Key API Endpoints

### Get Individual Category Risk
```bash
GET /api/v1/risk/trade-area/:id/regulatory
GET /api/v1/risk/trade-area/:id/market
GET /api/v1/risk/trade-area/:id/execution
GET /api/v1/risk/trade-area/:id/climate
```

### Get Comprehensive Risk (All 6 Categories)
```bash
GET /api/v1/risk/comprehensive/:dealId
GET /api/v1/risk/trade-area/:id  # Composite risk profile
```

### Force Recalculation
```bash
POST /api/v1/risk/calculate/:tradeAreaId
```

---

## 📐 Scoring Formulas

### Regulatory Risk
```
Base Score = 50 (neutral)
+ Sum(Active Events × Stage Probability)

Stage Probability:
- Proposed: 25%
- Committee: 50%
- Vote Pending: 75%
- Enacted: 100%
```

### Market Risk
```
Components:
- Cap Rate Sensitivity (40%)
  +100 bps IR = +50-75 bps cap expansion
  
- DSCR Stress Test (30%)
  Current vs +200 bps scenario
  
- Liquidity Risk (20%)
  Transaction volume index
  
- Credit Availability (10%)
  Lending standards, LTV max
```

### Execution Risk
```
Components:
- Cost Contingency (30%)
  10%+ = low risk
  8-10% = moderate
  5-8% = high
  <5% = critical
  
- Historical Overruns (25%)
  By jurisdiction and type
  
- Labor Market (20%)
  Availability, wage inflation
  
- Material Supply (15%)
  Lead times, price volatility
  
- Cost Inflation (10%)
  Construction cost index
```

### Climate Risk
```
Components:
- FEMA Flood Zone
  X = +5 (low)
  A/AE = +25 (high)
  V/VE = +40 (very high)
  
- Wildfire Hazard
  Low = +5
  Moderate = +10
  High = +15
  Extreme = +35
  
- Hurricane Zone
  Zone 1 = +5
  Zone 5 = +30
  
- Insurance Multiplier
  Readily Available = 1.0x
  Difficult = 1.6x
  Unavailable = 2.0x
```

### Composite Risk (All 6)
```
Composite = (Highest × 0.40) 
          + (Second Highest × 0.25) 
          + (Avg of Remaining × 0.35)
```

---

## 🎨 Frontend Component Props

### RegulatoryRiskPanel
```typescript
interface Props {
  tradeAreaId: string;
}

// Displays:
// - Active regulatory events
// - Legislative stage tracking
// - Zoning changes
// - Tax policy impacts
```

### MarketRiskPanel
```typescript
interface Props {
  tradeAreaId: string;
}

// Displays:
// - Interest rate indicators
// - Cap rate sensitivity
// - DSCR stress test
// - Liquidity metrics
// - Recession indicators
// - Interest rate scenarios
```

### ExecutionRiskPanel
```typescript
interface Props {
  tradeAreaId: string;
}

// Displays:
// - Cost contingency adequacy
// - Construction cost trends
// - Labor market conditions
// - Material supply metrics
// - Historical overrun rates
```

### ClimateRiskPanel
```typescript
interface Props {
  tradeAreaId: string;
}

// Displays:
// - FEMA flood zone
// - Wildfire hazard
// - Hurricane exposure
// - Insurance availability
// - Historical disasters
```

---

## 🔧 Database Tables

### Regulatory Risk
- `regulatory_risk_events` - Legislation tracking
- `zoning_changes` - Upzone/downzone
- `tax_policy_changes` - Tax rates

### Market Risk
- `market_risk_indicators` - Interest rates, DSCR, liquidity
- `interest_rate_scenarios` - Stress test scenarios

### Execution Risk
- `execution_risk_factors` - Costs, labor, materials
- `construction_cost_tracking` - Cost trend time-series

### Climate Risk
- `climate_risk_assessments` - FEMA zones, hazards
- `natural_disaster_events` - Historical disasters

---

## 💡 Common Use Cases

### Check Regulatory Risk for Trade Area
```bash
curl http://localhost:3001/api/v1/risk/trade-area/{id}/regulatory
```

### Get Complete Risk Profile for Deal
```bash
curl http://localhost:3001/api/v1/risk/comprehensive/{dealId}
```

### Add New Regulatory Event
```sql
INSERT INTO regulatory_risk_events (
  trade_area_id,
  legislation_name,
  jurisdiction,
  jurisdiction_name,
  legislation_type,
  legislation_stage,
  stage_probability,
  headline,
  risk_score_impact,
  severity
) VALUES (
  '{trade_area_id}',
  'New Rent Control Ordinance',
  'City',
  'City of Atlanta',
  'rent_control',
  'committee',
  50.0,
  'City considering 5% annual rent cap',
  15.0,
  'high'
);
```

### Update Market Indicators
```sql
INSERT INTO market_risk_indicators (
  trade_area_id,
  as_of_date,
  current_10yr_treasury,
  current_cap_rate,
  current_dscr,
  recession_probability,
  base_market_risk_score
) VALUES (
  '{trade_area_id}',
  CURRENT_DATE,
  4.75,
  5.50,
  1.35,
  30.0,
  60.0
);
```

---

## 🐛 Troubleshooting

### No Risk Data Returned
1. Verify migration applied: `SELECT * FROM risk_categories WHERE is_implemented = TRUE;`
2. Check seed data: `SELECT COUNT(*) FROM regulatory_risk_events;`
3. Ensure trade area ID is valid: `SELECT id, name FROM trade_areas LIMIT 5;`

### Risk Score Always 50
- Base score is 50 (neutral)
- No active events or indicators = 50 score
- Add test data via seed file or API

### Frontend Component Not Loading
1. Check trade area ID prop
2. Verify API endpoint accessible
3. Check browser console for errors
4. Ensure backend running on port 3001

---

## 📚 Further Reading

- **Implementation Guide:** `ADDITIONAL_RISK_CATEGORIES.md`
- **Completion Report:** `PHASE3_COMPONENT1_COMPLETE.md`
- **Test Script:** `test-additional-risk-categories.sh`
- **Migration:** `backend/src/database/migrations/029_additional_risk_categories.sql`

---

## ✅ Checklist

- [ ] Database migration applied
- [ ] Seed data loaded
- [ ] Backend API running
- [ ] Test script executed successfully
- [ ] Frontend components imported
- [ ] Risk scores calculating correctly
- [ ] All 6 categories returning data
- [ ] Composite risk formula working
- [ ] Integration with JEDI Score verified

---

**Version:** Phase 3, Component 1  
**Status:** Production Ready ✅
