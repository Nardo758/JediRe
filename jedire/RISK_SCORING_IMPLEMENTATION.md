# Risk Scoring System Implementation Guide
**JEDI RE Phase 2, Component 3**

## Overview

The Risk Scoring System provides comprehensive risk assessment for real estate deals through 6 risk categories (2 implemented, 4 future):

- ✅ **Supply Risk** (35% weight): Pipeline units, absorption rates, escalation/de-escalation
- ✅ **Demand Risk** (35% weight): Employer concentration, demand drivers, workforce events
- 🔮 **Regulatory Risk** (10% weight): Phase 3 placeholder
- 🔮 **Market Risk** (10% weight): Phase 3 placeholder
- 🔮 **Execution Risk** (5% weight): Phase 3 placeholder
- 🔮 **Climate Risk** (5% weight): Phase 3 placeholder

Risk Score contributes **10% to total JEDI Score** (inverse relationship: high risk = low score).

## Architecture

### Database Schema (Migration 027)

**Core Tables:**
- `risk_categories` - 6 risk categories with implementation status
- `risk_scores` - Time-series risk scores (0-100) per category per trade area
- `risk_events` - Events triggering score changes
- `risk_escalations` - Escalation/de-escalation log
- `risk_alert_thresholds` - User-configurable alert settings
- `composite_risk_profiles` - Pre-computed composite scores

**Supply Risk Tables:**
- `supply_pipeline_projects` - New construction projects tracking
- `supply_absorption_tracking` - Market absorption rate analysis

**Demand Risk Tables:**
- `employer_concentration` - Employer concentration metrics
- `demand_driver_events` - Events affecting demand drivers

### Service Layer

**`risk-scoring.service.ts`** - Core risk calculation engine:

```typescript
// Calculate Supply Risk
const supplyRisk = await riskScoringService.calculateSupplyRisk(tradeAreaId);

// Calculate Demand Risk  
const demandRisk = await riskScoringService.calculateDemandRisk(tradeAreaId);

// Calculate Composite Risk
const composite = await riskScoringService.calculateCompositeRisk(tradeAreaId);

// Apply Escalations
await riskScoringService.applySupplyEscalation(
  tradeAreaId, projectId, units, probability, deliveryMonths
);

// Apply De-escalations
await riskScoringService.applySupplyDeEscalation(
  tradeAreaId, projectId, 'cancelled'
);
```

### API Endpoints

**Base URL:** `/api/v1/risk`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/trade-area/:id` | Composite risk profile |
| GET | `/trade-area/:id/supply` | Supply risk details |
| GET | `/trade-area/:id/demand` | Demand risk details |
| GET | `/deal/:id` | Risk assessment for deal |
| GET | `/history/:tradeAreaId` | Risk score history |
| GET | `/events` | Recent risk events |
| GET | `/categories` | All risk categories |
| POST | `/threshold` | Configure alert thresholds |
| POST | `/calculate/:tradeAreaId` | Force recalculation |
| POST | `/escalation/supply` | Trigger supply escalation |
| POST | `/escalation/demand` | Trigger demand escalation |
| POST | `/de-escalation/supply` | Trigger supply de-escalation |
| POST | `/de-escalation/demand` | Trigger demand de-escalation |

### Frontend Components

**`RiskDashboard.tsx`** - Risk heatmap and composite scores
```tsx
import { RiskDashboard } from '@/components/risk';

<RiskDashboard dealId="deal-123" />
// or
<RiskDashboard tradeAreaIds={['ta-1', 'ta-2']} />
```

**`RiskBreakdown.tsx`** - Detailed category breakdown
```tsx
import { RiskBreakdown } from '@/components/risk';

<RiskBreakdown 
  tradeAreaId="ta-123" 
  tradeAreaName="Lawrenceville" 
/>
```

**`RiskTimeline.tsx`** - Historical risk score trending
```tsx
import { RiskTimeline } from '@/components/risk';

<RiskTimeline 
  tradeAreaId="ta-123" 
  tradeAreaName="Lawrenceville" 
/>
```

## Supply Risk Calculation

### Formula

```
Supply Risk Score = (Pipeline Units ÷ Existing Units) × 100 × Absorption Factor

Absorption Factor:
- <12 months:  0.5x (healthy)
- 12-24 months: 1.0x (normal)
- 24-36 months: 1.5x (concerning)
- >36 months:   2.0x (critical)
```

### Escalation Rules

| Severity | Trigger | Score Impact | Action |
|----------|---------|--------------|--------|
| **CRITICAL** | 500+ units confirmed, delivery <6mo | **+25 to +40** | Immediate alert, forced reunderwriting |
| **HIGH** | 200+ units, >50% probability | **+15 to +25** | Alert users, sensitivity analysis |
| **MODERATE** | 50+ units permitted, 20-50% probability | **+5 to +15** | Added to watchlist |
| **LOW** | Rumored project, <20% probability | **+1 to +5** | Logged in risk register |

### De-escalation Rules

| Event | Impact | Rationale |
|-------|--------|-----------|
| **Project Cancelled** | **-50%** of escalation | Risk decays slowly (units still possible) |
| **Project Delayed >12mo** | **-30%** of escalation | Deferred timeline reduces immediate pressure |
| **Project Converted** | **-80%** of escalation | Units no longer competitive supply |

### Example

**Scenario: Sandy Springs - 800 units in pipeline**

1. **Base Calculation:**
   - Existing units: 2,000
   - Pipeline units: 800
   - Absorption rate: 50 units/month
   - Months to absorb: 800 ÷ 50 = 16 months
   - Absorption factor: 1.0x (12-24 months)
   - Base score: (800 ÷ 2,000) × 100 × 1.0 = **40.0**

2. **Escalation:** 500 units confirmed for delivery in 5 months
   - Severity: CRITICAL
   - Score impact: +25 to +40
   - Calculated: +30 (500 units = baseline 25 + 5 bonus)

3. **Final Supply Risk Score: 40.0 + 30.0 = 70.0** (High Risk)

## Demand Risk Calculation

### Formula

```
Demand Risk Score = Employer Concentration Index × Dependency Factor

Employer Concentration Index (based on top employer %):
- <20%:   0-25  (low risk)
- 20-35%: 25-50 (medium risk)
- 35-50%: 50-75 (high risk)
- >50%:   75-100 (critical risk)

Dependency Factor:
- Single employer announced:        1.5x
- Employer not yet operational:     2.0x
- Employer with relocation history: 1.8x
```

### Escalation Rules

| Severity | Trigger | Score Impact | Action |
|----------|---------|--------------|--------|
| **CRITICAL** | Major employer exit confirmed | **+25 to +40** | Immediate alert, disposition analysis |
| **HIGH** | Layoff >20% of workforce | **+15 to +25** | Alert, stress test underwriting |
| **MODERATE** | Remote work policy shift | **+5 to +15** | Monitor, update assumptions |
| **LOW** | Workforce reduction <10% | **+1 to +5** | Log event |

### De-escalation Rules

| Event | Impact | Rationale |
|-------|--------|-----------|
| **Employer Confirms Commitment** | **-40%** of escalation | Reduces exit risk |
| **New Employer Enters Market** | **-20%** per employer | Diversification improvement |
| **Diversification Improves** | **-30%** (recalculate) | Lower concentration risk |

### Example

**Scenario: Lawrenceville - Amazon entry creates concentration**

1. **Base Calculation:**
   - Amazon employment: 5,000
   - Total trade area employment: 15,000
   - Top employer concentration: 33.3%
   - Concentration index: 25 + ((33.3 - 20) / 15) × 25 = **47.2**
   - Dependency factor: 1.5x (new employer, not operational)
   - Base score: 47.2 × 1.5 = **70.8**

2. **No active escalations** (employer operational, stable)

3. **Final Demand Risk Score: 70.8** (High Risk)

## Composite Risk Calculation

### Formula

```
Composite Risk = (Highest Category × 0.40) + (Second Highest × 0.25) + (Avg of Remaining × 0.35)
```

**Why this formula?**
- Ensures a single severe risk isn't diluted by low scores in other categories
- Weighted toward top risks (40% + 25% = 65% from top 2)
- Remaining categories still influence (35%)

### Example

**Scenario: Deal with mixed risk profile**

- Supply Risk: **85** (critical)
- Demand Risk: **30** (low)
- Regulatory Risk: **50** (neutral - Phase 3 placeholder)
- Market Risk: **50** (neutral - Phase 3 placeholder)
- Execution Risk: **50** (neutral - Phase 3 placeholder)
- Climate Risk: **50** (neutral - Phase 3 placeholder)

**Calculation:**
1. Sort scores: [85, 50, 50, 50, 50, 30]
2. Highest: 85 × 0.40 = **34.0**
3. Second: 50 × 0.25 = **12.5**
4. Remaining avg: (50 + 50 + 50 + 30) ÷ 4 = 45 × 0.35 = **15.75**
5. **Composite: 34.0 + 12.5 + 15.75 = 62.25** (Moderate-High Risk)

**Classification:**
- 0-39: Low Risk (Green)
- 40-59: Moderate Risk (Orange)
- 60-79: High Risk (Red)
- 80-100: Critical Risk (Dark Red)

## Integration with JEDI Score

Risk Score is **10% of total JEDI Score**, with **inverse relationship**:

```
JEDI Risk Score = 100 - Composite Risk Score

Example:
- Composite Risk: 62.25 → JEDI Risk Score: 37.75
- Contribution to JEDI: 37.75 × 0.10 = 3.775 points
```

This means:
- **Low risk (0-39)** → High JEDI contribution (61-100 points)
- **Critical risk (80-100)** → Low JEDI contribution (0-20 points)

## Alert System

### Configurable Thresholds

```typescript
POST /api/v1/risk/threshold
{
  "userId": "user-123",
  "riskCategoryId": 1, // null = all categories
  "scoreThreshold": 70.0,
  "changeThreshold": 5.0,
  "alertOnEscalation": true,
  "alertOnCriticalOnly": false,
  "notificationEnabled": true,
  "notificationChannel": "email"
}
```

### Alert Triggers

1. **Score exceeds threshold** (e.g., risk >70)
2. **Score changes by threshold** (e.g., +5 or more)
3. **Escalation event** (configurable)
4. **Critical severity only** (optional filter)

## Testing Guide

### Test Scenarios

**1. Sandy Springs - High Supply Risk**

```bash
# Add pipeline project (800 units)
POST /api/v1/risk/escalation/supply
{
  "tradeAreaId": "sandy-springs",
  "projectId": "project-123",
  "units": 800,
  "probability": 0.8,
  "deliveryMonths": 12
}

# Expected: Supply Risk increases to 60-70 range
```

**2. Lawrenceville - High Demand Risk (Amazon)**

```bash
# Add employer concentration
INSERT INTO employer_concentration (
  trade_area_id, employer_name, employee_count, 
  total_employment_in_area, concentration_pct, dependency_factor
) VALUES (
  'lawrenceville', 'Amazon', 5000, 15000, 33.33, 1.5
);

# Calculate demand risk
GET /api/v1/risk/trade-area/lawrenceville/demand

# Expected: Demand Risk increases to 70+ range
```

**3. Buckhead - Stable Low Risk**

```bash
# Calculate composite
GET /api/v1/risk/trade-area/buckhead

# Expected: 
# - Supply Risk: 30-40 (low pipeline)
# - Demand Risk: 20-30 (diversified employers)
# - Composite: 35-45 (Low Risk)
```

### Manual Testing Checklist

- [ ] Supply risk calculates correctly with pipeline data
- [ ] Demand risk calculates correctly with employer concentration
- [ ] Escalations increase risk scores appropriately
- [ ] De-escalations decrease risk scores appropriately
- [ ] Composite risk uses weighted formula correctly
- [ ] Risk level classification correct (low/moderate/high/critical)
- [ ] Risk history tracking over time
- [ ] Risk events log properly
- [ ] Alert thresholds trigger correctly
- [ ] Frontend components display data accurately

## SQL Queries for Analysis

### Current Risk Scores by Trade Area

```sql
SELECT * FROM current_risk_scores
ORDER BY trade_area_name, category_name;
```

### Active Risk Events

```sql
SELECT * FROM active_risk_events
ORDER BY event_date DESC, severity DESC;
```

### Supply Pipeline Summary

```sql
SELECT * FROM supply_pipeline_summary
ORDER BY total_pipeline_units DESC;
```

### Employer Concentration Summary

```sql
SELECT * FROM employer_concentration_summary
ORDER BY top_employer_pct DESC;
```

### Risk Score History for Trade Area

```sql
SELECT 
  rs.calculated_at,
  rc.category_name,
  rs.risk_score,
  rs.base_score,
  rs.escalation_adjustment,
  rs.risk_level
FROM risk_scores rs
JOIN risk_categories rc ON rc.id = rs.risk_category_id
WHERE rs.trade_area_id = 'lawrenceville'
  AND rs.calculated_at >= NOW() - INTERVAL '30 days'
ORDER BY rs.calculated_at DESC, rc.category_name;
```

## Deployment

### Migration

```bash
cd /home/leon/clawd/jedire
psql -U postgres -d jedire_db -f backend/src/database/migrations/027_risk_scoring.sql
```

### Seed Test Data (Optional)

```sql
-- Add test pipeline project
INSERT INTO supply_pipeline_projects (
  trade_area_id, project_name, developer, total_units, 
  project_status, probability, expected_delivery_date
) VALUES (
  (SELECT id FROM trade_areas WHERE name = 'Sandy Springs' LIMIT 1),
  'The Luxe at Sandy Springs',
  'Trammell Crow',
  800,
  'under_construction',
  0.90,
  '2027-06-01'
);

-- Add test employer concentration
INSERT INTO employer_concentration (
  trade_area_id, employer_name, industry, employee_count, 
  total_employment_in_area, concentration_pct, dependency_factor, as_of_date
) VALUES (
  (SELECT id FROM trade_areas WHERE name = 'Lawrenceville' LIMIT 1),
  'Amazon Fulfillment',
  'Logistics',
  5000,
  15000,
  33.33,
  1.5,
  CURRENT_DATE
);
```

### Calculate Initial Risk Scores

```bash
# For each trade area
for TRADE_AREA_ID in $(psql -U postgres -d jedire_db -t -c "SELECT id FROM trade_areas LIMIT 10"); do
  curl -X POST http://localhost:3000/api/v1/risk/calculate/$TRADE_AREA_ID
done
```

## Future Enhancements (Phase 3)

### Regulatory Risk
- Rent control probability modeling
- Zoning change tracking
- Policy shift indicators

### Market Risk
- Market cycle positioning
- Volatility metrics
- Economic indicator integration

### Execution Risk
- Construction delay probability
- Budget overrun risk
- Operational complexity scoring

### Climate Risk
- Flood zone exposure
- Hurricane/natural disaster risk
- Climate change impact modeling

## Troubleshooting

### Risk score not calculating
**Issue:** Service returns 50.0 (neutral)
**Solution:** 
- Check trade area has properties linked
- Verify pipeline projects or employer data exists
- Review database constraints

### Escalations not applying
**Issue:** Score doesn't change after escalation
**Solution:**
- Verify event created in `risk_events` table
- Check escalation record in `risk_escalations`
- Ensure event is `is_active = TRUE`

### Frontend components not displaying
**Issue:** API calls failing or data not showing
**Solution:**
- Check API routes registered in `backend/src/api/rest/index.ts`
- Verify axios base URL configured correctly
- Check browser console for errors

## Performance Considerations

- **Composite risk profiles** are pre-computed and cached
- **Risk history** queries are indexed on `calculated_at`
- **Escalation lookups** use index on `is_active` and `trade_area_id`
- Recommend **recalculating risk scores daily** via cron job
- **Real-time escalations** trigger immediate recalculation

## Maintenance

### Weekly Tasks
- Review active escalations
- Verify pipeline project status updates
- Check employer concentration data freshness

### Monthly Tasks
- Archive resolved risk events (>90 days old)
- Recalculate all risk scores from base
- Update absorption tracking data

### Quarterly Tasks
- Review escalation/de-escalation rules effectiveness
- Adjust score thresholds based on market feedback
- Plan Phase 3 category implementations

## Support

For questions or issues:
- Review migration file: `027_risk_scoring.sql`
- Check service implementation: `risk-scoring.service.ts`
- Review API routes: `risk.routes.ts`
- Test with provided scenarios

---

**Implementation Date:** 2026-02-11
**Version:** 1.0.0
**Status:** Phase 2 Complete (Supply Risk + Demand Risk)
