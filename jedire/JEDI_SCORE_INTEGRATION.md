# JEDI Score Integration & Alert System

**Phase 1, Week 3 - Complete Implementation Guide**  
**Version:** 1.0.0  
**Date:** February 11, 2026  
**Status:** ✅ Production Ready

---

## Overview

The JEDI Score Integration connects news-derived **Demand signals** into a comprehensive scoring system for real estate deals. This is the final piece of Phase 1, completing the News Intelligence Framework.

### What It Does

1. **Calculates JEDI Scores** for deals based on 5 market signals
2. **Tracks score history** over time for trending analysis
3. **Generates automatic alerts** when significant events occur
4. **Quantifies impact** of news events on deal viability
5. **Provides actionable insights** for investment decisions

### Formula

```
JEDI Score = (Demand × 0.30) + (Supply × 0.25) + (Momentum × 0.20) + (Position × 0.15) + (Risk × 0.10)
```

- **Demand (30%):** Employment events, population growth, economic indicators
- **Supply (25%):** Pipeline units, absorption rates, vacancy trends
- **Momentum (20%):** Rent growth, transaction velocity, market sentiment
- **Position (15%):** Submarket strength, proximity to amenities, competitive position
- **Risk (10%):** Market volatility, political/regulatory risk, concentration risk

---

## Architecture

### Database Schema

#### Tables Created (Migration 024)

**`jedi_score_history`**
- Stores all JEDI Score calculations over time
- Tracks which events triggered score changes
- Includes full breakdown of all 5 signals
- Enables trending and historical analysis

**`deal_alerts`**
- Enhanced alert system integrated with JEDI Scores
- Three severity levels: Green (positive), Yellow (caution), Red (negative)
- Links to news events and trade areas
- Tracks read/dismissed/archived state

**`alert_configurations`**
- User-specific alert preferences
- Configurable thresholds and sensitivities
- Delivery preferences (email, push, in-app)

**`demand_signal_weights`**
- Configurable weights for different event types
- Confidence multipliers (high/medium/low)
- Maximum JEDI impact caps per event type

#### Key Indexes

```sql
-- Fast score lookups
idx_jedi_score_history_deal ON jedi_score_history(deal_id)
idx_jedi_score_history_score ON jedi_score_history(total_score DESC)

-- Alert queries
idx_deal_alerts_unread ON deal_alerts(user_id, is_read) WHERE is_read = FALSE
idx_deal_alerts_score_change ON deal_alerts(ABS(jedi_score_change) DESC)
```

#### Views

**`deal_jedi_summary`**
```sql
SELECT d.id, d.name, latest.total_score, latest.demand_score, ...
```
Quick access to current scores and alert counts per deal.

**`active_deal_alerts`**
```sql
SELECT * FROM deal_alerts WHERE is_read = FALSE AND is_dismissed = FALSE
```
Real-time active alerts dashboard.

### Backend Services

#### `jedi-score.service.ts`

**Core Methods:**
- `calculateScore(context)` - Computes JEDI Score from signals
- `calculateDemandScore(dealId)` - Demand signal integration (Phase 1 complete)
- `calculateSupplyScore(dealId)` - Baseline implementation (Phase 2 planned)
- `calculateMomentumScore(dealId)` - Baseline implementation (Phase 2 planned)
- `calculatePositionScore(dealId)` - Baseline implementation (Phase 2 planned)
- `calculateRiskScore(dealId)` - Baseline implementation (Phase 2 planned)
- `saveScore(context, score)` - Persist to history
- `getLatestScore(dealId)` - Retrieve current score
- `getScoreHistory(dealId, options)` - Historical data
- `getImpactingEvents(dealId)` - Events affecting this deal
- `recalculateAllScores()` - Batch processing

**Signal Weighting Logic:**
```typescript
// High confidence employment event: full weight
const confidenceMultiplier = { high: 1.0, medium: 0.8, low: 0.5 };

// Convert jobs to housing demand
const housingDemand = employeeCount × 0.65 (occupancy) × 0.67 (household);

// Apply proximity decay (from geographic assignment)
const finalImpact = impactMagnitude × confidenceMultiplier × proximityFactor;

// Cap at max impact (±15 JEDI points)
const cappedImpact = Math.max(-15, Math.min(15, finalImpact));

// Baseline 50, +/- 15 range
const demandScore = 50 + cappedImpact;
```

#### `deal-alert.service.ts`

**Core Methods:**
- `generateScoreChangeAlert(dealId, userId, scoreBefore, scoreAfter)` - Alert on score changes > threshold
- `generateNewsEventAlert(dealId, userId, eventId)` - Alert on high-impact events
- `checkDealsForAlerts(userId)` - Periodic check for all user's deals
- `getUserConfiguration(userId)` - Get/create alert preferences
- `updateUserConfiguration(userId, updates)` - Modify thresholds

**Alert Classification:**
```typescript
// Employment events
inbound/expansion/hiring → Green (demand_positive)
outbound/layoff/closure → Red (demand_negative)

// Development events
permit/groundbreaking → Yellow (supply_competition)

// Amenity events
transit/retail opening → Green (demand_positive)
```

### API Routes (`jedi.routes.ts`)

#### JEDI Score Endpoints

**`GET /api/v1/jedi/score/:dealId`**
Get current JEDI Score with breakdown.

Response:
```json
{
  "success": true,
  "data": {
    "score": {
      "totalScore": 68.5,
      "demandScore": 62.3,
      "supplyScore": 55.0,
      "momentumScore": 50.0,
      "positionScore": 52.0,
      "riskScore": 50.0,
      "demandContribution": 18.69,
      "supplyContribution": 13.75,
      "...": "..."
    },
    "trend": {
      "direction": "up",
      "change": 3.2,
      "dataPoints": 15
    },
    "breakdown": {
      "demand": { "score": 62.3, "contribution": 18.69, "weight": 0.30 },
      "...": "..."
    }
  }
}
```

**`POST /api/v1/jedi/score/:dealId/recalculate`**
Manually trigger score recalculation (generates alert if change > threshold).

**`GET /api/v1/jedi/history/:dealId`**
Get score history with statistics.

Query params: `limit`, `offset`, `days`

**`GET /api/v1/jedi/impact/:dealId`**
Get news events affecting this deal's JEDI Score.

#### Alert Endpoints

**`GET /api/v1/jedi/alerts`**
Get user's active alerts.

Query params: `unread_only=true/false`, `limit`, `offset`

Response:
```json
{
  "success": true,
  "data": {
    "alerts": [...],
    "grouped": {
      "green": [...],
      "yellow": [...],
      "red": [...]
    },
    "counts": {
      "total": 12,
      "unread": 5,
      "green": 4,
      "yellow": 3,
      "red": 5
    }
  }
}
```

**`POST /api/v1/jedi/alerts/:id/read`**
Mark alert as read.

**`POST /api/v1/jedi/alerts/:id/dismiss`**
Dismiss an alert.

**`GET /api/v1/jedi/alerts/settings`**
Get user's alert configuration.

**`PATCH /api/v1/jedi/alerts/settings`**
Update alert preferences.

Body:
```json
{
  "scoreChangeThreshold": 2.5,
  "demandSensitivity": "high",
  "greenAlertsEnabled": true,
  "emailNotifications": false
}
```

**`POST /api/v1/jedi/alerts/check`**
Manually trigger alert check for user's deals.

### Frontend Components

#### `<AlertsPanel />`
**Location:** `frontend/src/components/jedi/AlertsPanel.tsx`

Displays active alerts with:
- Severity-based color coding (green/yellow/red)
- JEDI Score change indicators (↑/↓)
- Impact summaries ("State Farm campus adds +3.2 to JEDI Score")
- Suggested actions
- Mark as read / dismiss functionality
- Filtering by severity
- Unread-only toggle

**Props:**
```typescript
interface AlertsPanelProps {
  onAlertClick?: (alertId: string, dealId: string) => void;
}
```

**Usage:**
```tsx
import { AlertsPanel } from '@/components/jedi';

<AlertsPanel 
  onAlertClick={(alertId, dealId) => {
    // Navigate to deal page
    navigate(`/deals/${dealId}?alert=${alertId}`);
  }} 
/>
```

#### `<JEDIScoreBreakdown />`
**Location:** `frontend/src/components/jedi/JEDIScoreBreakdown.tsx`

Displays JEDI Score with:
- Large score display with color coding
- 30-day trend indicator (↑ +3.2)
- Progress bar (0-100)
- Signal breakdown with contributions
- Individual signal bars
- Recalculate button
- Tooltips explaining each signal

**Props:**
```typescript
interface JEDIScoreBreakdownProps {
  dealId: string;
  compact?: boolean;
}
```

**Modes:**
- **Full mode:** Detailed breakdown with all signals
- **Compact mode:** Just score + trend (for dashboard widgets)

**Usage:**
```tsx
import { JEDIScoreBreakdown } from '@/components/jedi';

// Full view (Deal Detail Page)
<JEDIScoreBreakdown dealId={dealId} />

// Compact view (Dashboard)
<JEDIScoreBreakdown dealId={dealId} compact />
```

#### `<EventTimeline />`
**Location:** `frontend/src/components/jedi/EventTimeline.tsx`

Displays chronological events affecting deal:
- Timeline view with visual dots
- Event category badges (Employment, Development, Amenities)
- Impact indicators (High/Medium/Low)
- Distance from property
- Impact and decay scores
- Filtering by category
- Links to source articles

**Props:**
```typescript
interface EventTimelineProps {
  dealId: string;
  limit?: number;
  compact?: boolean;
}
```

**Usage:**
```tsx
import { EventTimeline } from '@/components/jedi';

<EventTimeline dealId={dealId} limit={20} />
```

---

## Integration Points

### 1. Geographic Assignment Engine (Week 1)
- Events are assigned to trade areas with impact scores
- Proximity decay already calculated
- Geographic hierarchy (MSA → Submarket → Trade Area)

**Data Flow:**
```
News Event → Geographic Assignment → Trade Area Event Impacts → Demand Score Calculation
```

### 2. News Intelligence System (Weeks 1-2)
- News events table with structured extraction
- Event categorization and confidence scoring
- Corroboration tracking

**Used Tables:**
- `news_events`
- `news_event_geo_impacts`
- `trade_area_event_impacts`

### 3. Deal Management
- Links to `deals` table
- Filters active deals only (prospect, uw, loi, psa, closing)
- Per-user deal ownership

---

## Usage Examples

### Example 1: Dashboard Integration

Add JEDI Score widget to dashboard:

```tsx
// dashboard/DashboardPage.tsx
import { JEDIScoreBreakdown, AlertsPanel } from '@/components/jedi';

export const DashboardPage = () => {
  const activeDeals = useActiveDeals();
  
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Active Deals */}
      <div className="col-span-2">
        {activeDeals.map(deal => (
          <div key={deal.id} className="mb-4">
            <JEDIScoreBreakdown dealId={deal.id} compact />
          </div>
        ))}
      </div>
      
      {/* Alerts Sidebar */}
      <div className="col-span-1">
        <AlertsPanel />
      </div>
    </div>
  );
};
```

### Example 2: Deal Detail Page

Full JEDI Score analysis on deal page:

```tsx
// deals/DealDetailPage.tsx
import { JEDIScoreBreakdown, EventTimeline, AlertsPanel } from '@/components/jedi';

export const DealDetailPage = ({ dealId }) => {
  return (
    <div className="space-y-6">
      {/* JEDI Score */}
      <JEDIScoreBreakdown dealId={dealId} />
      
      {/* Event Timeline */}
      <EventTimeline dealId={dealId} limit={50} />
      
      {/* Deal-Specific Alerts */}
      <AlertsPanel onAlertClick={(alertId, dealId) => {
        // Already on this deal's page, scroll to relevant section
        document.getElementById('jedi-score')?.scrollIntoView();
      }} />
    </div>
  );
};
```

### Example 3: Periodic Score Updates

Set up background job to recalculate scores:

```typescript
// scripts/recalculate-scores.ts
import { jediScoreService } from './services/jedi-score.service';
import { dealAlertService } from './services/deal-alert.service';

async function recalculateAllScores() {
  console.log('Starting JEDI Score recalculation...');
  
  const count = await jediScoreService.recalculateAllScores();
  console.log(`Recalculated ${count} deals`);
  
  // Check for alerts
  const users = await query('SELECT DISTINCT user_id FROM deals WHERE stage IN (...)');
  
  for (const user of users.rows) {
    const alertsGenerated = await dealAlertService.checkDealsForAlerts(user.user_id);
    console.log(`Generated ${alertsGenerated} alerts for user ${user.user_id}`);
  }
}

// Run daily at 6 AM
cron.schedule('0 6 * * *', recalculateAllScores);
```

### Example 4: Manual Recalculation

Allow users to manually recalculate:

```tsx
const handleRecalculate = async () => {
  const response = await fetch(`/api/v1/jedi/score/${dealId}/recalculate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  
  if (data.success) {
    toast.success(`JEDI Score updated to ${data.data.totalScore.toFixed(1)}`);
    
    if (data.data.scoreDelta && Math.abs(data.data.scoreDelta) >= 2.0) {
      toast.info('New alert generated due to significant score change');
    }
  }
};
```

---

## Test Scenarios

### Scenario 1: Major Employer Announcement → JEDI Score Increase

**Setup:**
```sql
-- Insert employment event (State Farm announces 2,000 new jobs)
INSERT INTO news_events (
  event_category, event_type, location_raw, 
  extraction_confidence, extracted_data, published_at
) VALUES (
  'employment', 
  'company_expansion',
  '1 State Farm Plaza, Bloomington, IL',
  0.95,
  '{"company_name": "State Farm", "employee_count": 2000}'::jsonb,
  NOW()
);

-- Assign to trade area (via geographic assignment service)
-- Calculate impact score based on proximity and decay factors
```

**Expected Result:**
- Demand Score increases by ~8-12 points
- Total JEDI Score increases by ~2.4-3.6 points (30% weight)
- Green alert generated: "🎉 Major JEDI Score Increase"
- Impact summary: "State Farm expansion adds +3.2 to JEDI Score"

### Scenario 2: Layoff Event → JEDI Score Decrease

**Setup:**
```sql
-- Insert layoff event
INSERT INTO news_events (
  event_category, event_type, location_raw,
  extraction_confidence, extracted_data, published_at
) VALUES (
  'employment',
  'layoff_announcement',
  'Tech Campus, Austin, TX',
  0.88,
  '{"company_name": "TechCorp", "employee_count": 1500}'::jsonb,
  NOW()
);
```

**Expected Result:**
- Demand Score decreases by ~6-10 points
- Total JEDI Score decreases by ~1.8-3.0 points
- Red alert generated: "⚠️ Major JEDI Score Decline"
- Suggested action: "Review deal assumptions and consider updating underwriting model"

### Scenario 3: Supply Competition (New Development)

**Setup:**
```sql
-- Insert development permit
INSERT INTO news_events (
  event_category, event_type, location_raw,
  extraction_confidence, extracted_data, published_at
) VALUES (
  'development',
  'multifamily_permit_approval',
  '456 Main St, Denver, CO',
  0.92,
  '{"unit_count": 350, "project_name": "Riverside Apartments"}'::jsonb,
  NOW()
);
```

**Expected Result:**
- Supply Score decreases by ~3-5 points (more competition)
- Total JEDI Score decreases by ~0.75-1.25 points (25% weight)
- Yellow alert generated: "⚠️ Development Event in Trade Area"
- Suggested action: "Monitor competitive supply pipeline and adjust rent assumptions"

### Scenario 4: Score History Tracking

**Test:**
```bash
curl -X POST http://localhost:4000/api/v1/jedi/score/{dealId}/recalculate
# Wait 1 hour
curl -X POST http://localhost:4000/api/v1/jedi/score/{dealId}/recalculate
# Wait 1 day
curl -X POST http://localhost:4000/api/v1/jedi/score/{dealId}/recalculate

# Get history
curl http://localhost:4000/api/v1/jedi/history/{dealId}?days=30
```

**Verify:**
- Multiple score entries in `jedi_score_history`
- `score_delta` calculated correctly
- Trend direction identified (up/down/flat)
- Statistics computed (min, max, avg, volatility)

---

## Configuration

### Alert Thresholds

Default values (can be customized per user):

```typescript
{
  scoreChangeThreshold: 2.0,      // Alert if JEDI Score changes by ±2 points
  demandSensitivity: 'medium',    // low/medium/high
  supplySensitivity: 'medium',    
  minImpactScore: 50.0,           // Ignore events with impact score < 50
  alertFrequency: 'realtime',     // realtime/daily_digest/weekly_digest
  greenAlertsEnabled: true,
  yellowAlertsEnabled: true,
  redAlertsEnabled: true,
  emailNotifications: true,
  pushNotifications: false,
  inAppOnly: false,
  activeDealsOnly: true
}
```

### Signal Weights

Configured in `demand_signal_weights` table:

| Event Type | Base Weight | Confidence Multiplier | Max JEDI Impact | Housing Conversion |
|------------|-------------|----------------------|-----------------|-------------------|
| company_relocation_inbound | 1.0 | H:1.0, M:0.8, L:0.5 | ±15.0 | 0.65 × 0.67 |
| company_expansion | 0.9 | H:1.0, M:0.8, L:0.5 | ±12.0 | 0.65 × 0.67 |
| layoff_announcement | -0.9 | H:1.0, M:0.8, L:0.5 | -12.0 | 0.65 × 0.67 |
| multifamily_permit_approval | -0.7 | H:1.0, M:0.8, L:0.6 | -10.0 | N/A |
| transit_station_opening | 0.6 | H:1.0, M:0.8, L:0.5 | +8.0 | N/A |

**Modify weights:**
```sql
UPDATE demand_signal_weights
SET base_weight = 1.2, max_jedi_impact = 18.0
WHERE event_category = 'employment' 
  AND event_type = 'company_relocation_inbound';
```

---

## Performance Considerations

### Caching Strategy

1. **Latest Score:** Cache in memory for 1 hour
2. **Score History:** Cache frequently accessed deals
3. **Alert Counts:** Cache per user with 5-minute TTL

### Batch Processing

For nightly recalculation:

```typescript
// Process in batches of 50 deals
const BATCH_SIZE = 50;
const deals = await query('SELECT id FROM deals WHERE ...');

for (let i = 0; i < deals.rows.length; i += BATCH_SIZE) {
  const batch = deals.rows.slice(i, i + BATCH_SIZE);
  await Promise.all(
    batch.map(deal => jediScoreService.calculateAndSave({ dealId: deal.id }))
  );
  await sleep(1000); // Rate limiting
}
```

### Index Optimization

```sql
-- Ensure indexes exist
CREATE INDEX CONCURRENTLY idx_jedi_deal_created 
  ON jedi_score_history(deal_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_alerts_user_unread 
  ON deal_alerts(user_id, created_at DESC) 
  WHERE is_read = FALSE;
```

---

## Deployment Checklist

### Database Migration

```bash
# Apply migration
psql $DATABASE_URL -f backend/src/database/migrations/024_jedi_alerts.sql

# Verify tables created
psql $DATABASE_URL -c "\dt jedi_* deal_alerts alert_configurations"

# Verify functions created
psql $DATABASE_URL -c "\df get_latest_jedi_score get_jedi_score_trend"
```

### Backend Services

```bash
# Test TypeScript compilation
cd backend
npm run build

# Check service imports
node -e "const { jediScoreService } = require('./dist/services/jedi-score.service'); console.log('✓ JEDI Score Service');"
node -e "const { dealAlertService } = require('./dist/services/deal-alert.service'); console.log('✓ Deal Alert Service');"
```

### API Routes

```bash
# Register routes in index.ts
grep "jediRoutes" backend/src/api/rest/index.ts

# Test endpoints
curl http://localhost:4000/api/v1/jedi/score/{dealId} -H "Authorization: Bearer {token}"
curl http://localhost:4000/api/v1/jedi/alerts -H "Authorization: Bearer {token}"
```

### Frontend Components

```bash
# Test TypeScript compilation
cd frontend
npm run build

# Verify component exports
node -e "const { AlertsPanel, JEDIScoreBreakdown, EventTimeline } = require('./src/components/jedi'); console.log('✓ Components exported');"
```

---

## Phase 2 Enhancements (Planned)

### Supply Signal (Full Implementation)
- Real-time pipeline tracking from development permits
- Absorption rate calculations
- Vacancy trend analysis
- Market saturation metrics

### Momentum Signal (Full Implementation)
- Rent growth trends (YoY, MoM)
- Transaction velocity analysis
- Market sentiment scoring
- Cap rate compression tracking

### Position Signal (Full Implementation)
- Submarket strength index
- Amenity proximity scoring
- Walkability and transit access
- Competitive positioning analysis

### Risk Signal (Full Implementation)
- Market volatility measurements
- Political and regulatory risk factors
- Concentration risk analysis
- Economic indicator tracking

### Advanced Features
- **Predictive Modeling:** Machine learning for score forecasting
- **Comparative Analysis:** Benchmark against market averages
- **Scenario Modeling:** "What-if" analysis for different market conditions
- **Custom Signals:** User-defined signals and weightings

---

## Troubleshooting

### Issue: Scores not calculating

**Check:**
1. Deal has associated property
2. Property has trade area defined
3. Trade area has event impacts
4. Database connection healthy

```sql
-- Debug query
SELECT 
  d.id as deal_id,
  p.id as property_id,
  ta.id as trade_area_id,
  COUNT(taei.id) as event_count
FROM deals d
LEFT JOIN properties p ON p.deal_id = d.id
LEFT JOIN trade_areas ta ON ta.property_id = p.id
LEFT JOIN trade_area_event_impacts taei ON taei.trade_area_id = ta.id
WHERE d.id = '{dealId}'
GROUP BY d.id, p.id, ta.id;
```

### Issue: Alerts not generating

**Check:**
1. User has alert configuration (auto-created on first access)
2. Score change exceeds threshold (default 2.0)
3. Alert type enabled in user preferences
4. Impact score meets minimum threshold

```sql
-- Check configuration
SELECT * FROM alert_configurations WHERE user_id = '{userId}';

-- Check recent score changes
SELECT * FROM jedi_score_history 
WHERE deal_id = '{dealId}' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Issue: Frontend components not displaying

**Check:**
1. API routes registered correctly
2. Authentication token valid
3. CORS configured for frontend origin
4. Component props passed correctly

```tsx
// Debug component
useEffect(() => {
  console.log('DealId:', dealId);
  console.log('Token:', localStorage.getItem('token'));
}, [dealId]);
```

---

## API Testing

### Using curl

```bash
# Get JEDI Score
curl -X GET "http://localhost:4000/api/v1/jedi/score/DEAL_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Recalculate score
curl -X POST "http://localhost:4000/api/v1/jedi/score/DEAL_ID/recalculate" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get alerts
curl -X GET "http://localhost:4000/api/v1/jedi/alerts?unread_only=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update alert settings
curl -X PATCH "http://localhost:4000/api/v1/jedi/alerts/settings" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scoreChangeThreshold": 3.0, "greenAlertsEnabled": false}'
```

---

## Summary

### Delivered Features ✅

1. ✅ JEDI Score calculation with Demand signal integration (30% weight)
2. ✅ Score history tracking with trending analysis
3. ✅ Alert system with 3 severity levels
4. ✅ Impact quantification ("State Farm campus adds +3.2 to JEDI Score")
5. ✅ User-configurable alert thresholds
6. ✅ Full audit trail (event → demand → score change)
7. ✅ Frontend components (AlertsPanel, JEDIScoreBreakdown, EventTimeline)
8. ✅ Complete API routes and backend services
9. ✅ Database schema with indexes and views
10. ✅ Documentation and test scenarios

### Integration Status

- ✅ Geographic Assignment Engine (Week 1)
- ✅ News Intelligence System (Week 2)
- ✅ Demand Signal Processing (Week 2)
- ✅ Alert Generation Logic (Week 3)
- ✅ Frontend Dashboard Components (Week 3)

### Phase 1 Complete

All Week 1-3 deliverables shipped. System is production-ready for deployment.

**Next:** Phase 2 will enhance Supply, Momentum, Position, and Risk signals to full implementation.

---

**Questions or Issues?**
Review troubleshooting section or check `/backend/logs/app.log` for detailed error messages.
