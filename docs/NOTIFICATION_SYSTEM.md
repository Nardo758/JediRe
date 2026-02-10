# Notification & Decision Point System

## Overview

The notification system ensures users are only interrupted when **decisions are needed** or **important milestones are reached**. It prevents notification fatigue by focusing on actionable items rather than status updates.

## Philosophy

**Don't overwhelm → Only notify when action is required**

- ✅ **DO** notify when a decision is needed
- ✅ **DO** notify when a major milestone is reached
- ✅ **DO** notify when something requires immediate attention
- ❌ **DON'T** notify for every status change
- ❌ **DON'T** notify for background processing updates
- ❌ **DON'T** spam with progress bars

---

## Decision Points (High Priority)

These notifications require user action and are marked as HIGH priority.

### 1. TRIAGE Complete → `decision_triage_complete`

**When:** Initial property analysis completes
**Message:** "Initial analysis done, review and decide"
**Action:** User reviews AI-generated insights and decides:
  - ✅ Proceed to intelligence gathering
  - ⏸️ Pause (needs more info)
  - ❌ Pass (not viable)

**Trigger Code:**
```typescript
await notificationService.sendDecisionRequired({
  dealId: deal.id,
  dealName: deal.name,
  stage: 'triage',
  message: 'Initial analysis complete. AI Score: 78/100. Review findings and decide next steps.',
  context: {
    aiScore: 78,
    keyInsights: ['Strong zoning potential', 'Undervalued by 15%'],
  },
});
```

---

### 2. INTELLIGENCE_ASSEMBLY Complete → `decision_intelligence_complete`

**When:** Research/due diligence phase completes
**Message:** "Research done, review findings"
**Action:** User reviews:
  - Market comps
  - Zoning analysis
  - Supply/demand data
  - News intelligence

Then decides:
  - ✅ Proceed to underwriting
  - 🔄 Request more research
  - ❌ Pass

**Trigger Code:**
```typescript
await notificationService.sendDecisionRequired({
  dealId: deal.id,
  dealName: deal.name,
  stage: 'intelligence_assembly',
  message: 'Research complete: 47 comps analyzed, zoning verified, market strong.',
  context: {
    compsAnalyzed: 47,
    zoningVerified: true,
    marketScore: 'strong',
  },
});
```

---

### 3. UNDERWRITING Complete → `decision_underwriting_complete`

**When:** Financial model and returns analysis completes
**Message:** "Financial model ready, review returns"
**Action:** User reviews:
  - Pro forma cash flows
  - IRR/CoC projections
  - Sensitivity analysis
  - Risk factors

Then decides:
  - ✅ Make offer
  - 🔄 Adjust assumptions
  - ❌ Pass

**Trigger Code:**
```typescript
await notificationService.sendDecisionRequired({
  dealId: deal.id,
  dealName: deal.name,
  stage: 'underwriting',
  message: 'Financial model complete. Projected IRR: 18.5%, CoC: 12.3%. Ready for offer?',
  context: {
    irr: 18.5,
    coc: 12.3,
    capRate: 6.2,
    riskScore: 'medium',
  },
});
```

---

### 4. Deal STALLED → `decision_deal_stalled`

**When:** Deal has been idle for X days (default: 7 days)
**Message:** "Deal needs attention, been idle X days"
**Action:** User prompted to:
  - ⏩ Take action (move forward)
  - 📝 Add notes/update status
  - 🗄️ Archive (if no longer relevant)

**Automatic Detection:**
```typescript
// Runs via cron job every 6 hours
const stalledCount = await notificationService.checkStalledDeals();
// Automatically detects deals with no activity >= threshold
```

**Manual Trigger:**
```typescript
await notificationService.sendStallAlert({
  dealId: deal.id,
  dealName: deal.name,
  daysStalled: 10,
  lastActivity: new Date('2024-01-29'),
  currentStage: 'underwriting',
});
```

---

## Milestones (Medium Priority)

Informational notifications celebrating progress.

### Deal Created → `milestone_deal_created`
```typescript
await notificationService.sendMilestoneReached({
  dealId: deal.id,
  dealName: deal.name,
  milestone: 'deal_created',
  details: 'New deal created: 123 Main St, 24 units, $2.4M budget',
});
```

### Stage Changed → `milestone_stage_changed`
```typescript
await notificationService.sendMilestoneReached({
  dealId: deal.id,
  dealName: deal.name,
  milestone: 'stage_changed',
  details: 'Deal moved from Triage → Intelligence Assembly',
  metrics: { fromStage: 'triage', toStage: 'intelligence_assembly' },
});
```

### Analysis Complete → `milestone_analysis_complete`
```typescript
await notificationService.sendMilestoneReached({
  dealId: deal.id,
  dealName: deal.name,
  milestone: 'analysis_complete',
  details: 'JEDI Score analysis complete: 82/100',
  metrics: { jediScore: 82, verdict: 'strong' },
});
```

---

## Alerts (High Priority)

Warning notifications for risks or issues.

### Risk Detected → `alert_risk_detected`
### Budget Exceeded → `alert_budget_exceeded`
### Timeline Delayed → `alert_timeline_delayed`

```typescript
await notificationService.createNotification({
  userId: deal.userId,
  dealId: deal.id,
  type: NotificationType.ALERT_RISK_DETECTED,
  title: '⚠️ Risk Alert: Market Shift',
  message: 'Competing supply increased 40% in target submarket',
  actionUrl: `/deals/${deal.id}/risks`,
  actionLabel: 'Review Risks',
  metadata: { riskType: 'supply', severity: 'high' },
});
```

---

## System Info (Low Priority)

Background system notifications.

- `info_collaborator_added`
- `info_comment_mention`
- `info_task_assigned`

These can be batched into daily digests.

---

## Notification Channels

### In-App (Default)
- Shown in NotificationCenter dropdown
- Badge counter on bell icon
- Links directly to relevant pages

### Email (Optional)
- High-priority decisions sent immediately
- Low-priority batched into daily digest
- Can be disabled per category

### Push (Future)
- Mobile/desktop push notifications
- Only for urgent/high-priority
- Requires user opt-in

---

## User Preferences

Users can customize their notification experience:

```typescript
// Default preferences
{
  enableInApp: true,
  enableEmail: true,
  enablePush: false,
  
  // Category toggles
  decisionPointsEnabled: true,
  milestonesEnabled: true,
  alertsEnabled: true,
  infoEnabled: true,
  
  // Digest settings
  enableDailyDigest: false,
  dailyDigestTime: '09:00:00',
  
  // Quiet hours
  quietHoursEnabled: false,
  quietHoursStart: '22:00:00',
  quietHoursEnd: '08:00:00',
}
```

**API Endpoint:**
```bash
GET /api/notifications/preferences
PUT /api/notifications/preferences
```

---

## State Tracking

The system automatically tracks deal state to detect stalls:

```sql
CREATE TABLE deal_state_tracking (
  deal_id UUID PRIMARY KEY,
  current_stage VARCHAR(50),
  stage_entered_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  days_since_activity INTEGER (auto-calculated),
  is_stalled BOOLEAN,
  stall_threshold_days INTEGER DEFAULT 7
);
```

**Activity triggers:**
- User views deal
- User makes a decision
- Stage changes
- Properties added
- Comments added
- Analysis runs

Each activity resets `last_activity_at` and `is_stalled = false`.

---

## Decision Log

All decisions are logged for analytics:

```sql
CREATE TABLE decision_log (
  id UUID PRIMARY KEY,
  deal_id UUID,
  user_id UUID,
  notification_id UUID,
  decision_point VARCHAR(100), -- 'triage_complete', etc.
  decision_made VARCHAR(100),  -- 'approved', 'rejected', 'needs_more_info'
  decision_notes TEXT,
  presented_at TIMESTAMP,
  decided_at TIMESTAMP,
  response_time_minutes INTEGER (auto-calculated)
);
```

This enables:
- Average response time per decision type
- Decision patterns (approve/reject rates)
- Bottleneck identification

---

## Integration Examples

### Trigger notification when agent completes work

```typescript
// In agents/orchestrator.ts
async function runTriageAgent(dealId: string) {
  const result = await triageAgent.analyze(dealId);
  
  // Save results
  await saveDealAnalysis(dealId, result);
  
  // Send decision notification
  const notificationService = new NotificationService(db);
  await notificationService.sendDecisionRequired({
    dealId,
    dealName: deal.name,
    stage: 'triage',
    message: `AI analysis complete. Score: ${result.score}/100. ${result.summary}`,
    context: result,
  });
}
```

### Detect stalled deals (cron job)

```typescript
// Schedule: Every 6 hours
import { NotificationService } from './services/NotificationService';

async function checkStalledDeals() {
  const notificationService = new NotificationService(db);
  const count = await notificationService.checkStalledDeals();
  
  logger.info(`Checked for stalled deals: ${count} notifications sent`);
}
```

### Log decision when user acts

```typescript
// In frontend: DealDecisionPage.tsx
async function handleDecision(decision: 'approve' | 'reject' | 'more_info') {
  await fetch(`/api/deals/${dealId}/decide`, {
    method: 'POST',
    body: JSON.stringify({
      decisionPoint: 'triage_complete',
      decision,
      notes: userNotes,
    }),
  });
  
  // Backend logs to decision_log table
  // and updates deal_state_tracking.last_activity_at
}
```

---

## Frontend Usage

### Add NotificationCenter to layout

```tsx
// In App.tsx or MainLayout.tsx
import { NotificationCenter } from './components/shared/NotificationCenter';

function MainLayout() {
  return (
    <div>
      <header>
        <nav>
          {/* ... other nav items ... */}
          <NotificationCenter />
        </nav>
      </header>
      {/* ... */}
    </div>
  );
}
```

### Link notifications to decision pages

Notifications automatically link to decision pages via `actionUrl`:
- `/deals/:id/decide` → Decision review page
- `/deals/:id` → Deal detail page
- `/deals/:id/risks` → Risk management page

Create these pages to handle user decisions.

---

## API Reference

### Get Notifications
```bash
GET /api/notifications
Query params:
  - unreadOnly: boolean
  - limit: number (default: 50)
  - offset: number (default: 0)
  - type: NotificationType (optional filter)

Response:
{
  success: true,
  notifications: [...],
  count: 15
}
```

### Get Counts
```bash
GET /api/notifications/counts

Response:
{
  totalUnread: 5,
  decisionsUnread: 2,
  alertsUnread: 1,
  milestonesUnread: 2,
  infoUnread: 0
}
```

### Mark as Read
```bash
PUT /api/notifications/:id/read
```

### Mark All as Read
```bash
PUT /api/notifications/read-all
```

---

## Testing

### Test decision notification (development only)
```bash
POST /api/notifications/test-decision
Body:
{
  "dealId": "uuid",
  "stage": "triage",
  "message": "Test notification"
}
```

---

## Database Migration

Run the migration to create all necessary tables:
```bash
psql -U postgres -d jedire -f backend/src/database/migrations/017_notifications_system.sql
```

---

## Best Practices

1. **Keep messages actionable**
   - ✅ "Review findings and decide next steps"
   - ❌ "Analysis is running..."

2. **Always provide action URLs**
   - Link to the exact page where user can act
   - Include clear `actionLabel` ("Review & Decide")

3. **Respect quiet hours**
   - Check user preferences before sending
   - Batch low-priority into digests

4. **Track response times**
   - Use `decision_log` to measure how quickly users respond
   - Identify bottlenecks

5. **Don't notify for background work**
   - Agents running? Silent.
   - Only notify when results are ready for review.

6. **Test with real scenarios**
   - Use test endpoint to simulate notifications
   - Verify links work correctly

---

## Future Enhancements

- [ ] Email delivery integration (SendGrid/Mailgun)
- [ ] Push notification support (Firebase/OneSignal)
- [ ] SMS alerts for urgent items
- [ ] Daily digest emails
- [ ] Slack/Teams integration
- [ ] Notification analytics dashboard
- [ ] Smart batching (group similar notifications)
- [ ] Template system for notification content

---

## Summary

**Decision Points (notify immediately):**
1. Triage complete
2. Intelligence complete
3. Underwriting complete
4. Deal stalled

**Milestones (celebrate progress):**
- Deal created
- Stage changed
- Analysis done

**Alerts (warn about risks):**
- Risk detected
- Budget exceeded
- Timeline delayed

**The goal:** Keep users informed without overwhelming them. Only interrupt when a decision is needed.
