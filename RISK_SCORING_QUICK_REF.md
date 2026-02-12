# Risk Scoring Quick Reference

## Formulas

### Supply Risk
```
Score = (Pipeline Units ÷ Existing Units) × 100 × Absorption Factor

Absorption Factor:
- <12mo: 0.5x   | 12-24mo: 1.0x
- 24-36mo: 1.5x | >36mo: 2.0x
```

### Demand Risk
```
Score = Concentration Index × Dependency Factor

Concentration Index (top employer %):
- <20%: 0-25    | 20-35%: 25-50
- 35-50%: 50-75 | >50%: 75-100

Dependency Factor:
- Announced: 1.5x | Not operational: 2.0x
- Relocation history: 1.8x
```

### Composite Risk
```
Composite = (Highest × 0.40) + (Second × 0.25) + (Avg Rest × 0.35)
```

### JEDI Integration
```
JEDI Risk Score = 100 - Composite Risk Score
JEDI Contribution = JEDI Risk Score × 0.10
```

## Escalation Rules

### Supply Risk
| Severity | Trigger | Impact | Action |
|----------|---------|--------|--------|
| CRITICAL | 500+ units, <6mo | +25-40 | Immediate alert, reunderwrite |
| HIGH | 200+ units, >50% prob | +15-25 | Alert, sensitivity analysis |
| MODERATE | 50+ units, 20-50% prob | +5-15 | Watchlist |
| LOW | Rumored, <20% prob | +1-5 | Log |

### Demand Risk
| Severity | Trigger | Impact | Action |
|----------|---------|--------|--------|
| CRITICAL | Employer exit | +25-40 | Alert, disposition analysis |
| HIGH | Layoff >20% | +15-25 | Alert, stress test |
| MODERATE | Remote policy shift | +5-15 | Monitor |
| LOW | Reduction <10% | +1-5 | Log |

## De-escalation Rules

### Supply
- **Cancelled:** -50% | **Delayed >12mo:** -30% | **Converted:** -80%

### Demand
- **Commitment:** -40% | **New employer:** -20% | **Diversification:** -30%

## API Quick Commands

```bash
# Get composite risk
curl http://localhost:3000/api/v1/risk/trade-area/{id}

# Get supply risk details
curl http://localhost:3000/api/v1/risk/trade-area/{id}/supply

# Get demand risk details
curl http://localhost:3000/api/v1/risk/trade-area/{id}/demand

# Get risk for deal
curl http://localhost:3000/api/v1/risk/deal/{dealId}

# Recalculate risk
curl -X POST http://localhost:3000/api/v1/risk/calculate/{id}

# Supply escalation
curl -X POST http://localhost:3000/api/v1/risk/escalation/supply \
  -H "Content-Type: application/json" \
  -d '{
    "tradeAreaId": "...",
    "projectId": "...",
    "units": 500,
    "probability": 0.8,
    "deliveryMonths": 6
  }'

# Demand escalation
curl -X POST http://localhost:3000/api/v1/risk/escalation/demand \
  -H "Content-Type: application/json" \
  -d '{
    "tradeAreaId": "...",
    "employerId": "...",
    "eventType": "employer_exit",
    "affectedEmployees": 1000,
    "totalEmployees": 5000
  }'
```

## React Components

```tsx
import { RiskDashboard, RiskBreakdown, RiskTimeline } from '@/components/risk';

// Dashboard for deal or multiple trade areas
<RiskDashboard dealId="deal-123" />
<RiskDashboard tradeAreaIds={['ta-1', 'ta-2']} />

// Detailed breakdown
<RiskBreakdown tradeAreaId="ta-123" tradeAreaName="Sandy Springs" />

// Historical trending
<RiskTimeline tradeAreaId="ta-123" tradeAreaName="Sandy Springs" />
```

## SQL Quick Queries

```sql
-- Current risk scores
SELECT * FROM current_risk_scores WHERE trade_area_name = 'Sandy Springs';

-- Active events
SELECT * FROM active_risk_events ORDER BY event_date DESC LIMIT 10;

-- Pipeline summary
SELECT * FROM supply_pipeline_summary ORDER BY total_pipeline_units DESC;

-- Employer concentration
SELECT * FROM employer_concentration_summary ORDER BY top_employer_pct DESC;

-- Risk history (last 30 days)
SELECT * FROM risk_scores 
WHERE calculated_at >= NOW() - INTERVAL '30 days'
ORDER BY calculated_at DESC;
```

## Risk Level Colors

- **Low (0-39):** 🟢 Green (#4caf50)
- **Moderate (40-59):** 🟠 Orange (#ff9800)
- **High (60-79):** 🔴 Red (#f44336)
- **Critical (80-100):** 🔴 Dark Red (#b71c1c)

## Common Tasks

### Add Pipeline Project
```sql
INSERT INTO supply_pipeline_projects (
  trade_area_id, project_name, total_units, 
  project_status, probability, expected_delivery_date
) VALUES (
  'ta-id', 'Project Name', 500, 
  'under_construction', 0.8, '2027-06-01'
);
```

### Add Employer
```sql
INSERT INTO employer_concentration (
  trade_area_id, employer_name, employee_count, 
  total_employment_in_area, concentration_pct, as_of_date
) VALUES (
  'ta-id', 'Amazon', 5000, 
  15000, 33.33, CURRENT_DATE
);
```

### Configure Alert
```bash
curl -X POST http://localhost:3000/api/v1/risk/threshold \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "scoreThreshold": 70.0,
    "changeThreshold": 5.0,
    "alertOnEscalation": true
  }'
```

## Troubleshooting

**Score stuck at 50.0?**
- Check trade area has linked properties
- Verify pipeline/employer data exists
- Check `is_active = TRUE` on events

**Escalation not applying?**
- Verify event created in `risk_events`
- Check `is_active = TRUE`
- Recalculate: `POST /risk/calculate/:id`

**Frontend not showing?**
- Check API routes in `rest/index.ts`
- Verify axios base URL
- Check browser console for errors

## Key Concepts

**Risk Score:** 0-100 (higher = more risk)
**JEDI Score:** Inverse relationship (high risk = low JEDI)
**Composite:** Weighted formula prevents dilution
**Escalation:** Event increases risk temporarily
**De-escalation:** Event reduces risk over time
**Time-Series:** Historical tracking for trending

## Files

- Migration: `027_risk_scoring.sql`
- Service: `risk-scoring.service.ts`
- Routes: `risk.routes.ts`
- Frontend: `components/risk/*`
- Docs: `RISK_SCORING_IMPLEMENTATION.md`
