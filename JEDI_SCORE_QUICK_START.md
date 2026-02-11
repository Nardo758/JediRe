# JEDI Score Quick Start Guide

**5-Minute Setup for Week 3 Integration**

---

## 1. Apply Database Migration

```bash
cd /home/leon/clawd/jedire
psql $DATABASE_URL -f backend/src/database/migrations/024_jedi_alerts.sql
```

**What it creates:**
- ✅ `jedi_score_history` - Score tracking
- ✅ `deal_alerts` - Alert system
- ✅ `alert_configurations` - User preferences
- ✅ `demand_signal_weights` - Signal weighting (pre-seeded)

---

## 2. Test Backend Services

```bash
# Start backend server
cd backend
npm install
npm run dev
```

**Test endpoints:**

```bash
TOKEN="your_auth_token_here"
DEAL_ID="your_deal_id_here"

# Calculate JEDI Score
curl -X POST "http://localhost:4000/api/v1/jedi/score/$DEAL_ID/recalculate" \
  -H "Authorization: Bearer $TOKEN"

# Get current score
curl "http://localhost:4000/api/v1/jedi/score/$DEAL_ID" \
  -H "Authorization: Bearer $TOKEN"

# Get alerts
curl "http://localhost:4000/api/v1/jedi/alerts" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Add Frontend Components

### Dashboard Integration

```tsx
// src/pages/DashboardPage.tsx
import { AlertsPanel, JEDIScoreBreakdown } from '@/components/jedi';

export const DashboardPage = () => {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Active Deals with Scores */}
      <div className="col-span-2">
        {activeDeals.map(deal => (
          <JEDIScoreBreakdown key={deal.id} dealId={deal.id} compact />
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

### Deal Detail Page

```tsx
// src/pages/DealDetailPage.tsx
import { JEDIScoreBreakdown, EventTimeline } from '@/components/jedi';

export const DealDetailPage = ({ dealId }) => {
  return (
    <>
      <JEDIScoreBreakdown dealId={dealId} />
      <EventTimeline dealId={dealId} limit={50} />
    </>
  );
};
```

---

## 4. Configure Alert Settings

Users can customize alerts at `/api/v1/jedi/alerts/settings`:

```bash
curl -X PATCH "http://localhost:4000/api/v1/jedi/alerts/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scoreChangeThreshold": 2.5,
    "demandSensitivity": "high",
    "greenAlertsEnabled": true,
    "yellowAlertsEnabled": true,
    "redAlertsEnabled": true,
    "minImpactScore": 50.0
  }'
```

---

## 5. Test Complete Flow

### Scenario: Major Employment Event

```sql
-- 1. Insert employment event
INSERT INTO news_events (
  event_category, event_type, location_raw,
  extraction_confidence, extracted_data, published_at
) VALUES (
  'employment', 'company_expansion', 'Downtown Dallas',
  0.95, '{"company_name": "State Farm", "employee_count": 2000}'::jsonb,
  NOW()
) RETURNING id;

-- 2. Assign to geographic hierarchy (via API or service)
-- POST /api/v1/geography/assign-event

-- 3. Recalculate JEDI Score
-- POST /api/v1/jedi/score/{dealId}/recalculate

-- 4. Check for generated alerts
-- GET /api/v1/jedi/alerts?unread_only=true
```

**Expected:**
- ✅ Demand Score increases by ~8-12 points
- ✅ Total JEDI Score increases by ~2.4-3.6 points
- ✅ Green alert generated: "Major JEDI Score Increase"
- ✅ Impact summary: "State Farm expansion adds +3.2 to JEDI Score"

---

## 6. Schedule Periodic Recalculation

```typescript
// backend/scripts/recalculate-scores.ts
import { jediScoreService } from '../services/jedi-score.service';
import { dealAlertService } from '../services/deal-alert.service';
import cron from 'node-cron';

// Run daily at 6 AM
cron.schedule('0 6 * * *', async () => {
  console.log('Starting JEDI Score recalculation...');
  
  // Recalculate all active deals
  const count = await jediScoreService.recalculateAllScores();
  console.log(`Recalculated ${count} deals`);
  
  // Check for new alerts
  const users = await getActiveUsers();
  for (const user of users) {
    await dealAlertService.checkDealsForAlerts(user.id);
  }
});
```

---

## Key Endpoints Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/jedi/score/:dealId` | Get current JEDI Score |
| POST | `/api/v1/jedi/score/:dealId/recalculate` | Recalculate score |
| GET | `/api/v1/jedi/history/:dealId` | Score history |
| GET | `/api/v1/jedi/impact/:dealId` | Events affecting deal |
| GET | `/api/v1/jedi/alerts` | User's alerts |
| POST | `/api/v1/jedi/alerts/:id/dismiss` | Dismiss alert |
| PATCH | `/api/v1/jedi/alerts/settings` | Update preferences |

---

## Component Props Quick Reference

### AlertsPanel

```tsx
<AlertsPanel 
  onAlertClick={(alertId, dealId) => navigate(`/deals/${dealId}`)} 
/>
```

### JEDIScoreBreakdown

```tsx
// Full view
<JEDIScoreBreakdown dealId={dealId} />

// Compact view (dashboard widget)
<JEDIScoreBreakdown dealId={dealId} compact />
```

### EventTimeline

```tsx
<EventTimeline dealId={dealId} limit={20} />
```

---

## Troubleshooting

### No score displaying?

```sql
-- Check if deal has trade area
SELECT d.id, p.id, ta.id 
FROM deals d 
LEFT JOIN properties p ON p.deal_id = d.id
LEFT JOIN trade_areas ta ON ta.property_id = p.id
WHERE d.id = '{dealId}';
```

### No alerts generating?

```sql
-- Check score changes
SELECT * FROM jedi_score_history 
WHERE deal_id = '{dealId}' 
ORDER BY created_at DESC LIMIT 5;

-- Check alert threshold
SELECT score_change_threshold FROM alert_configurations 
WHERE user_id = '{userId}';
```

### Frontend not loading?

```bash
# Check API response
curl "http://localhost:4000/api/v1/jedi/score/$DEAL_ID" \
  -H "Authorization: Bearer $TOKEN"

# Check browser console for errors
# Verify token in localStorage
console.log(localStorage.getItem('token'));
```

---

## Next Steps

1. **Test with real data** - Add employment events, see scores change
2. **Customize alert thresholds** - Adjust per user preferences
3. **Monitor performance** - Check database query times
4. **Plan Phase 2** - Full implementation of Supply, Momentum, Position, Risk signals

---

**Complete documentation:** See `JEDI_SCORE_INTEGRATION.md` for detailed implementation guide.
