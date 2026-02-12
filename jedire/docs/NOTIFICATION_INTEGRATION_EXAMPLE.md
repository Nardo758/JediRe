# Notification System Integration Examples

## How to integrate notifications into your existing workflow

---

## 1. Trigger Notification When Deal Analysis Completes

### In `agents/orchestrator.ts`

```typescript
import { NotificationService } from '../services/NotificationService';
import { NotificationType } from '../types/notification.types';

export class AgentOrchestrator {
  private notificationService: NotificationService;

  constructor(private db: Pool) {
    this.notificationService = new NotificationService(db);
  }

  async runTriageAnalysis(dealId: string): Promise<void> {
    try {
      // Run agent analysis
      const result = await this.triageAgent.analyze(dealId);
      
      // Save results to database
      await this.db.query(
        `INSERT INTO analysis_results (deal_id, agent_type, results, score)
         VALUES ($1, 'triage', $2, $3)`,
        [dealId, JSON.stringify(result), result.score]
      );

      // Get deal info
      const dealResult = await this.db.query(
        'SELECT id, name, user_id FROM deals WHERE id = $1',
        [dealId]
      );
      const deal = dealResult.rows[0];

      // 🔔 SEND DECISION NOTIFICATION
      await this.notificationService.sendDecisionRequired({
        dealId: deal.id,
        dealName: deal.name,
        stage: 'triage',
        message: `Initial analysis complete. AI Score: ${result.score}/100. ${result.summary}`,
        context: {
          score: result.score,
          verdict: result.verdict,
          keyInsights: result.insights,
        },
      });

      logger.info('Triage analysis complete, notification sent', { dealId });

    } catch (error) {
      logger.error('Error in triage analysis:', error);
      
      // Optionally: Send error notification
      await this.notificationService.createNotification({
        userId: deal.user_id,
        dealId: deal.id,
        type: NotificationType.ALERT_RISK_DETECTED,
        title: '❌ Analysis Failed',
        message: 'Triage analysis encountered an error. Please try again.',
        actionUrl: `/deals/${deal.id}`,
        actionLabel: 'View Deal',
      });
    }
  }

  async runIntelligenceAssembly(dealId: string): Promise<void> {
    // Similar pattern for intelligence gathering
    const result = await this.intelligenceAgent.gather(dealId);
    
    // Save results...
    
    // 🔔 SEND DECISION NOTIFICATION
    await this.notificationService.sendDecisionRequired({
      dealId,
      dealName: deal.name,
      stage: 'intelligence_assembly',
      message: `Research complete: ${result.compsCount} comps analyzed, zoning verified, market analysis ready.`,
      context: result,
    });
  }

  async runUnderwriting(dealId: string): Promise<void> {
    // Financial analysis
    const result = await this.underwritingAgent.analyze(dealId);
    
    // Save results...
    
    // 🔔 SEND DECISION NOTIFICATION
    await this.notificationService.sendDecisionRequired({
      dealId,
      dealName: deal.name,
      stage: 'underwriting',
      message: `Financial model complete. Projected IRR: ${result.irr}%, CoC: ${result.coc}%. Ready to make offer?`,
      context: {
        irr: result.irr,
        coc: result.coc,
        npv: result.npv,
        risks: result.risks,
      },
    });
  }
}
```

---

## 2. Send Milestone Notification When Stage Changes

### In `deals/deals.service.ts`

```typescript
import { NotificationService } from '../services/NotificationService';

async updatePipelineStage(dealId: string, userId: string, stage: string) {
  await this.verifyOwnership(dealId, userId);

  // Get current stage
  const current = await this.db.query(
    'SELECT stage, stage_history FROM deal_pipeline WHERE deal_id = $1',
    [dealId]
  );

  const history = current.rows[0]?.stage_history || [];
  const previousStage = current.rows[0]?.stage;

  history.push({
    stage,
    timestamp: new Date().toISOString(),
  });

  // Update stage in database
  await this.db.query(
    `UPDATE deal_pipeline 
     SET stage = $1, entered_stage_at = NOW(), stage_history = $2
     WHERE deal_id = $3`,
    [stage, JSON.stringify(history), dealId]
  );

  // Log activity
  await this.logActivity(dealId, userId, 'pipeline_stage_changed', `Stage changed to ${stage}`);

  // Get deal name
  const dealResult = await this.db.query(
    'SELECT name FROM deals WHERE id = $1',
    [dealId]
  );
  const dealName = dealResult.rows[0].name;

  // 🔔 SEND MILESTONE NOTIFICATION
  const notificationService = new NotificationService(this.db);
  await notificationService.sendMilestoneReached({
    dealId,
    dealName,
    milestone: 'stage_changed',
    details: `Deal progressed from ${previousStage} to ${stage}`,
    metrics: {
      fromStage: previousStage,
      toStage: stage,
      timestamp: new Date().toISOString(),
    },
  });

  return { success: true, stage };
}
```

---

## 3. Track Deal Activity to Prevent Stalls

### Add activity tracking to key actions

```typescript
// In deals.service.ts

async linkProperty(dealId: string, userId: string, propertyId: string) {
  // ... existing logic ...

  // 🔔 UPDATE ACTIVITY TRACKING (automatic via trigger)
  // The deal_activity insert will trigger update_deal_activity() function
  await this.logActivity(
    dealId,
    userId,
    'property_linked',
    `Property linked to deal`
  );
  
  // This automatically updates deal_state_tracking.last_activity_at
  // and resets is_stalled = false
}

async addComment(dealId: string, userId: string, comment: string) {
  // Insert comment...
  
  // 🔔 UPDATE ACTIVITY
  await this.logActivity(dealId, userId, 'comment_added', 'User added comment');
  
  // Stall detection will see this activity
}

async makeDecision(dealId: string, userId: string, decision: string) {
  // Process decision...
  
  // 🔔 UPDATE ACTIVITY
  await this.logActivity(dealId, userId, 'decision_made', `Decision: ${decision}`);
}
```

---

## 4. Setup Backend Initialization

### In `index.ts` (main server file)

```typescript
import { setupNotificationRoutes } from './api/notifications.controller';
import { setupNotificationTasks } from './tasks/notificationTasks';

// After setting up other routes...

// Setup notification routes
setupNotificationRoutes(app, db, authMiddleware);

// Setup scheduled tasks
setupNotificationTasks(db);

// Server ready
logger.info('Server started with notification system enabled');
```

---

## 5. Frontend Integration

### Add NotificationCenter to Main Layout

```tsx
// In App.tsx or MainLayout.tsx
import { NotificationCenter } from './components/shared/NotificationCenter';

function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          
          <nav className="flex items-center gap-4">
            <Link to="/deals">Deals</Link>
            <Link to="/properties">Properties</Link>
            
            {/* 🔔 NOTIFICATION CENTER */}
            <NotificationCenter />
            
            <UserMenu />
          </nav>
        </div>
      </header>
      
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

---

## 6. Create Deal Decision Page

### Frontend: `DealDecisionPage.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export const DealDecisionPage: React.FC = () => {
  const { dealId } = useParams();
  const navigate = useNavigate();
  
  const [deal, setDeal] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchDealAndAnalysis();
  }, [dealId]);

  const fetchDealAndAnalysis = async () => {
    const [dealRes, analysisRes] = await Promise.all([
      fetch(`/api/deals/${dealId}`),
      fetch(`/api/deals/${dealId}/analysis`),
    ]);
    
    setDeal(await dealRes.json());
    setAnalysis(await analysisRes.json());
  };

  const handleDecision = async (decision: 'approve' | 'reject' | 'more_info') => {
    try {
      await fetch(`/api/deals/${dealId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionPoint: analysis.stage || 'triage',
          decision,
          notes,
        }),
      });

      // Navigate back to deal or pipeline
      navigate(`/deals/${dealId}`);
      
    } catch (error) {
      console.error('Error making decision:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Review & Decide</h1>
      
      {deal && (
        <>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">{deal.name}</h2>
            
            {/* Analysis results */}
            {analysis && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">AI Score</h3>
                  <div className="text-3xl font-bold text-blue-600">
                    {analysis.score}/100
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Key Insights</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {analysis.insights?.map((insight: string, i: number) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Decision notes */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <label className="block mb-2 font-semibold">Decision Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded p-3"
              rows={4}
              placeholder="Add any notes about your decision..."
            />
          </div>

          {/* Decision buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => handleDecision('approve')}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
            >
              ✅ Approve & Continue
            </button>
            
            <button
              onClick={() => handleDecision('more_info')}
              className="flex-1 bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700"
            >
              🔄 Need More Info
            </button>
            
            <button
              onClick={() => handleDecision('reject')}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700"
            >
              ❌ Pass on Deal
            </button>
          </div>
        </>
      )}
    </div>
  );
};
```

---

## 7. Backend Decision Endpoint

### In `deals/deals.controller.ts`

```typescript
import { NotificationService } from '../services/NotificationService';

export class DealsController {
  /**
   * POST /api/deals/:id/decide
   * User makes a decision on a deal stage
   */
  async makeDecision(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { id: dealId } = req.params;
      const { decisionPoint, decision, notes } = req.body;

      // Verify ownership
      const dealResult = await this.db.query(
        'SELECT user_id FROM deals WHERE id = $1',
        [dealId]
      );

      if (dealResult.rows[0]?.user_id !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Log the decision
      await this.db.query(
        `INSERT INTO decision_log (
          deal_id, user_id, decision_point, decision_made, decision_notes, presented_at, decided_at
        ) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '1 hour', NOW())`,
        [dealId, userId, decisionPoint, decision, notes]
      );

      // Update deal state (activity tracking)
      await this.db.query(
        `INSERT INTO deal_activity (deal_id, user_id, action_type, description)
         VALUES ($1, $2, 'decision_made', $3)`,
        [dealId, userId, `Decision: ${decision} on ${decisionPoint}`]
      );

      // Take action based on decision
      if (decision === 'approve') {
        // Move to next stage
        const nextStageMap: Record<string, string> = {
          triage: 'intelligence_assembly',
          intelligence_assembly: 'underwriting',
          underwriting: 'offer',
        };
        
        const nextStage = nextStageMap[decisionPoint] || 'active';
        
        await this.db.query(
          'UPDATE deal_pipeline SET stage = $1 WHERE deal_id = $2',
          [nextStage, dealId]
        );
      } else if (decision === 'reject') {
        // Mark deal as passed
        await this.db.query(
          'UPDATE deals SET status = $1 WHERE id = $2',
          ['passed', dealId]
        );
      }

      res.json({ success: true, decision });

    } catch (error) {
      logger.error('Error in makeDecision:', error);
      res.status(500).json({ error: 'Failed to process decision' });
    }
  }
}
```

---

## 8. Testing Workflow

### Test the full flow

```bash
# 1. Run database migration
psql -U postgres -d jedire -f backend/src/database/migrations/017_notifications_system.sql

# 2. Start server
npm run dev

# 3. Create a test deal
curl -X POST http://localhost:3000/api/deals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Deal - 123 Main St",
    "boundary": {...},
    "projectType": "multifamily"
  }'

# 4. Trigger test notification (development only)
curl -X POST http://localhost:3000/api/notifications/test-decision \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": "DEAL_UUID",
    "stage": "triage",
    "message": "Test triage analysis complete. Score: 85/100"
  }'

# 5. Check notifications in frontend
# - Bell icon should show badge (1)
# - Click bell to see notification
# - Click notification to navigate to decision page
# - Make decision
# - Verify decision logged in decision_log table
```

---

## Summary

**Integration Checklist:**

- ✅ Import `NotificationService` where you run agents
- ✅ Call `sendDecisionRequired()` when analysis completes
- ✅ Call `sendMilestoneReached()` when stages change
- ✅ Call `sendStallAlert()` or rely on automatic detection
- ✅ Add `NotificationCenter` component to main layout
- ✅ Create `/deals/:id/decide` page for user decisions
- ✅ Add backend endpoint to log decisions
- ✅ Setup scheduled tasks (`setupNotificationTasks()`)
- ✅ Run database migration
- ✅ Test with real workflow

The system is now ready to keep users informed without overwhelming them!
