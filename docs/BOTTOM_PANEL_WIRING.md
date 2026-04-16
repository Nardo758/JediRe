# Bottom Panel Wiring - Apply Instructions

Wire up ALERTS, NEWS, TASKS, MEDIA tabs + all 18 agents + Global Task Coordinator.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BOTTOM PANEL                                 │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│  AGENTS  │  ALERTS  │   NEWS   │  EMAIL   │  TASKS   │   MEDIA     │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴─────────────┘
     │          │          │          │          │
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐
│ Agent   │ │ Agent   │ │ RSS     │ │ Gmail   │ │ Task            │
│ Bus     │ │ Alert   │ │ Feeds   │ │ OAuth   │ │ Coordinator     │
│ (18)    │ │ Service │ │         │ │         │ │                 │
└────┬────┘ └────┬────┘ └─────────┘ └────┬────┘ └────────┬────────┘
     │          │                        │               │
     └──────────┼────────────────────────┼───────────────┘
                │                        │
                ▼                        ▼
         ┌─────────────────────────────────────┐
         │           deal_alerts               │
         │           tasks                     │
         │           emails                    │
         └─────────────────────────────────────┘
```

## Files to Apply

| File | Action | Target |
|------|--------|--------|
| `001_news_feed_endpoint.patch.ts` | ADD routes | `backend/src/api/rest/news.routes.ts` |
| `002_tasks_db_migration.sql` | RUN | PostgreSQL |
| `003_tasks_routes_db.ts` | REPLACE | `backend/src/api/rest/tasks.routes.ts` |
| `004_alerts_agent_integration.ts` | Reference | Shows pattern for existing service |
| `005_agent_alert_service.ts` | CREATE | `backend/src/services/agent-alert.service.ts` |
| `006_task_coordinator_service.ts` | CREATE | `backend/src/services/task-coordinator.service.ts` |
| `007_alerts_migration.sql` | RUN | PostgreSQL |

---

## Step 1: Install Dependencies

```bash
cd backend
npm install rss-parser
npm install -D @types/rss-parser
```

---

## Step 2: Run Database Migrations

```bash
# In Replit terminal
psql $DATABASE_URL < 002_tasks_db_migration.sql
psql $DATABASE_URL < 007_alerts_migration.sql
```

---

## Step 3: Create Services

### Agent Alert Service
Copy `005_agent_alert_service.ts` to:
```
backend/src/services/agent-alert.service.ts
```

### Task Coordinator Service
Copy `006_task_coordinator_service.ts` to:
```
backend/src/services/task-coordinator.service.ts
```

---

## Step 4: Update Routes

### News Routes
Add code from `001_news_feed_endpoint.patch.ts` to `backend/src/api/rest/news.routes.ts`

### Tasks Routes
Replace `backend/src/api/rest/tasks.routes.ts` with `003_tasks_routes_db.ts`

### JEDI Routes - Add agent alert endpoint
Add to `backend/src/api/rest/jedi.routes.ts`:

```typescript
import { agentAlertService } from '../../services/agent-alert.service';

// GET /api/v1/jedi/alerts - Updated to use agentAlertService
router.get('/alerts', authMiddleware.requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { unread_only, deal_id, agent_code, limit = 50, offset = 0 } = req.query;

    const result = await agentAlertService.getAlerts(userId, {
      dealId: deal_id as string,
      agentCode: agent_code as any,
      unreadOnly: unread_only === 'true',
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: {
        alerts: result.alerts,
        counts: {
          total: result.total,
          unread: result.unread,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/jedi/alerts/from-agent
router.post('/alerts/from-agent', authMiddleware.requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { deal_id, agent_code, alert_type, severity, title, message, data, suggested_actions } = req.body;

    const result = await agentAlertService.createAlert({
      dealId: deal_id,
      userId,
      agentCode: agent_code,
      alertType: alert_type || 'info',
      severity: severity || 'medium',
      title,
      message,
      data,
      suggestedActions: suggested_actions,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/jedi/alerts/:id/read
router.post('/alerts/:id/read', authMiddleware.requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    await agentAlertService.markRead(req.params.id, userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/jedi/alerts/read-all
router.post('/alerts/read-all', authMiddleware.requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const count = await agentAlertService.markAllRead(userId, req.body.deal_id);
    res.json({ success: true, data: { marked: count } });
  } catch (error) {
    next(error);
  }
});
```

---

## Step 5: Wire Agents to Alert Service

Each agent should call `agentAlertService.createAlert()` when they find something.

### Example: Risk Agent (AN01 CFO)

```typescript
import { agentAlertService } from '../services/agent-alert.service';

// When CFO agent detects IRR below threshold
await agentAlertService.createAlert({
  dealId: deal.id,
  userId: currentUserId,
  agentCode: 'AN01',
  alertType: 'risk_flag',
  severity: 'high',
  title: 'IRR Below Target',
  message: `Deal "${deal.name}" IRR (14.2%) is below target threshold (15.0%)`,
  data: { 
    currentIRR: 14.2, 
    targetIRR: 15.0,
    shortfall: 0.8 
  },
  suggestedActions: [
    'Review purchase price assumptions',
    'Evaluate rent growth projections',
    'Consider exit timing adjustments'
  ],
});
```

### All 18 Agents Alert Patterns

| Agent | Code | Alert Types | Example Triggers |
|-------|------|-------------|------------------|
| JEDI Orchestrator | ORCHESTRATOR | info, action_required, deadline | Portfolio summary, coordination alerts |
| Strategy Engine | STRATEGY | opportunity, risk_flag | JEDI score changes, deal recommendations |
| CFO | AN01 | risk_flag, anomaly | IRR below target, risk metrics breach |
| Accountant | AN02 | deadline, compliance | Tax deadlines, GAAP issues |
| Marketing | AN03 | opportunity, info | Pricing opportunities, comp movements |
| Developer | AN04 | risk_flag, deadline | Construction delays, permit issues |
| Legal | AN05 | risk_flag, compliance | Contract issues, legal deadlines |
| Lender | AN06 | opportunity, risk_flag | Rate changes, covenant breach |
| Acquisitions | AN07 | opportunity, deadline | New deals, LOI deadlines |
| Asset Manager | AN08 | risk_flag, opportunity | NOI underperformance, expense anomalies |
| Property Manager | AN09 | action_required, risk_flag | Tenant issues, maintenance emergencies |
| Leasing Director | AN10 | risk_flag, deadline | Vacancy spikes, renewal expirations |
| Facilities Manager | AN11 | action_required, deadline | CapEx needs, equipment failures |
| Investment Analyst | AN12 | opportunity, risk_flag | Hold/sell triggers, market timing |
| ESG | AN13 | compliance, opportunity | ESG compliance, energy opportunities |
| Compliance | AN14 | compliance, deadline | Permit expirations, insurance gaps |
| Tax Strategist | AN15 | opportunity, deadline | Cost seg opportunities, 1031 deadlines |
| Researcher | AN16 | info, opportunity | Market insights, competitive intel |

---

## Step 6: Wire Task Coordinator to Emails

### In Email Processing Service

```typescript
import { taskCoordinatorService } from '../services/task-coordinator.service';

// After AI extracts action items from email
async function processEmail(email: Email, extractedTasks: ExtractedTask[]) {
  if (extractedTasks.length > 0) {
    await taskCoordinatorService.extractTasksFromEmail({
      emailId: email.id,
      threadId: email.threadId,
      dealId: email.dealId,
      subject: email.subject,
      from: email.from,
      tasks: extractedTasks,
    });
  }
}
```

### In Deal Stage Transition

```typescript
import { taskCoordinatorService } from '../services/task-coordinator.service';

// When deal moves to new stage
async function onDealStageChange(dealId: string, newStage: string, userId: string) {
  await taskCoordinatorService.onDealStageChange({
    dealId,
    newStage,
    userId,
  });
}
```

---

## Step 7: Test Everything

### Test Alerts
```bash
# Create agent alert
curl -X POST http://localhost:3000/api/v1/jedi/alerts/from-agent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deal_id": "uuid-here",
    "agent_code": "AN01",
    "alert_type": "risk_flag",
    "severity": "high",
    "title": "Test CFO Alert",
    "message": "IRR below threshold"
  }'

# Get alerts
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/jedi/alerts
```

### Test News
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/news/feed?limit=10
```

### Test Tasks
```bash
# Create agent task
curl -X POST http://localhost:3000/api/v1/tasks/from-agent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review rent roll",
    "category": "due_diligence",
    "agent_code": "AN01",
    "deal_id": "uuid-here"
  }'

# Generate stage tasks
curl -X POST http://localhost:3000/api/v1/tasks/generate-for-stage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deal_id": "uuid-here",
    "stage": "DUE_DILIGENCE"
  }'
```

---

## Data Flow Summary

```
EMAIL ARRIVES
    │
    ▼
┌────────────────┐
│ Email Intel    │──────┬──► Extract Tasks ──► TASKS tab
│ (AI)           │      │
└────────────────┘      └──► Link to Deal
                             
AGENT RUNS ANALYSIS
    │
    ▼
┌────────────────┐
│ Any of 18      │──────┬──► Create Alert ──► ALERTS tab
│ Agents         │      │
└────────────────┘      └──► Create Task ──► TASKS tab

DEAL STAGE CHANGES
    │
    ▼
┌────────────────┐
│ Task           │──────────► Generate Stage Tasks ──► TASKS tab
│ Coordinator    │
└────────────────┘
```

---

## Files Created/Modified

**New Services:**
- `backend/src/services/agent-alert.service.ts`
- `backend/src/services/task-coordinator.service.ts`

**Modified Routes:**
- `backend/src/api/rest/news.routes.ts` (add /feed, /rss)
- `backend/src/api/rest/tasks.routes.ts` (full replace)
- `backend/src/api/rest/jedi.routes.ts` (update /alerts endpoints)

**Database:**
- `tasks` table (with email/agent/stage columns)
- `stage_task_templates` table
- `deal_alerts` table (new columns)
- `agent_activity_log` table (optional)
