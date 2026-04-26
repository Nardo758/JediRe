# Neural Network Control Hub — Dashboard Widget

## Priority: After OM → KG fan-out is verified working

## Overview

Build a dedicated dashboard widget that gives the user visibility into what the neural network and agents are doing, plus a way to ask questions directly. This makes the NN/agent layer visible and interactive instead of a black box.

## Architecture

```
┌─── NeuralNetworkHub Widget (F1 Dashboard) ────────────────────┐
│                                                                │
│  ┌─ AGENT STATUS (polled every 15s) ────────────────────────┐  │
│  │ • Live agent cards showing: agent name, status           │  │
│  │   (running/idle/completed/failed), current action,       │  │
│  │   time elapsed, messages processed                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ INSIGHT FEED (from ContextIndicator data) ──────────────┐  │
│  │ • Intelligent observations (💡)                           │  │
│  │ • Data gaps detected (⚡)                                 │  │
│  │ • System events (✅)                                      │  │
│  │ • Click to expand / dismiss                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ ASK THE NETWORK ───────────────────────────────────────┐   │
│  │ │ "What's the supply risk in Atlanta-Marietta?"      │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │ [Ask]        Response appears inline below                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ RECENT COMPLETIONS ─────────────────────────────────────┐  │
│  │ • Agent workflow runs that completed in last 24h          │  │
│  │ • ✓ agent_name — action description (X min ago)           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Task 1: Wire agent_workflow_runs Writing

### 1a. Update event-dispatcher.ts

When processing events, insert a workflow run record:

```typescript
// In processQueue(), after logEvent():
private async logEvent(payload: EventPayload): Promise<void> {
  const client = await getPool().connect();
  try {
    const eventResult = await client.query(
      `INSERT INTO agent_events (event_type, deal_id, user_id, payload, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [payload.event, payload.dealId, payload.userId, JSON.stringify(payload.data)]
    );
    const eventId = eventResult.rows[0]?.id;

    // Create workflow run for each triggered agent
    if (eventId) {
      const agents = getTriggeredAgents(payload.event);
      for (const agentId of agents) {
        await client.query(
          `INSERT INTO agent_workflow_runs
             (agent_id, event_id, deal_id, user_id, trigger_event, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
          [agentId, eventId, payload.dealId, payload.userId, payload.event]
        );
      }
    }
  } catch (err) {
    logger.warn('Failed to log event/workflow to database', { err });
  } finally {
    client.release();
  }
}
```

### 1b. Create getTriggeredAgents() helper

```typescript
const EVENT_AGENT_MAP: Record<string, string[]> = {
  'document_uploaded': ['acquisitions', 'research', 'orchestrator'],
  'email_received': ['acquisitions', 'research'],
  'deal_created': ['strategy', 'acquisitions', 'lender', 'orchestrator'],
  'deal_status_changed': ['orchestrator'],
  'financials_updated': ['cfo', 'asset_manager'],
  'market_data_changed': ['research', 'strategy', 'lender'],
  'news_alert': ['research', 'strategy'],
  'threshold_breach': ['cfo', 'asset_manager', 'orchestrator'],
  'task_due': ['orchestrator'],
};

function getTriggeredAgents(event: string): string[] {
  return EVENT_AGENT_MAP[event] || ['orchestrator'];
}
```

### 1c. Update agent-orchestrator.ts to update workflow run status

When orchestrator processes an event, mark the run as running/complete:

```typescript
// In dispatchEvent(), after starting agent processing:
async markRun(runId: string, status: string, result?: any, error?: string): Promise<void> {
  try {
    const setClause = status === 'running'
      ? `SET status='running', started_at=NOW()`
      : `SET status=$1, completed_at=NOW(), result=$2, error=$3`;
    const params = status === 'running'
      ? [runId]
      : [status, result, error, runId];
    await query(
      `UPDATE agent_workflow_runs ${setClause} WHERE id=$4`,
      params
    );
  } catch { /* non-fatal */ }
}
```

## Task 2: Agent Status Endpoint

### New route: `backend/src/api/rest/agent-status.routes.ts`

```typescript
import { Router } from 'express';
const router = Router();
import { getPool } from '../../database/connection';

// GET /api/v1/agents/status
router.get('/', async (req, res) => {
  const pool = getPool();

  // Running agents
  const runningResult = await pool.query(`
    SELECT r.id, r.agent_id, r.trigger_event, r.status, r.started_at,
           r.created_at, d.name as deal_name,
           (SELECT COUNT(*) FROM agent_events e WHERE e.id = r.event_id) as event_count
    FROM agent_workflow_runs r
    LEFT JOIN deals d ON d.id = r.deal_id
    WHERE r.status IN ('pending', 'running')
    ORDER BY r.created_at DESC
    LIMIT 20
  `);

  // Recently completed
  const recentResult = await pool.query(`
    SELECT r.id, r.agent_id, r.trigger_event, r.status,
           r.started_at, r.completed_at,
           d.name as deal_name,
           EXTRACT(EPOCH FROM (COALESCE(r.completed_at, NOW()) - r.created_at))::int as duration_seconds
    FROM agent_workflow_runs r
    LEFT JOIN deals d ON d.id = r.deal_id
    WHERE r.status IN ('completed', 'failed')
      AND r.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY r.created_at DESC
    LIMIT 20
  `);

  // Recent events (insight feed source)
  const eventsResult = await pool.query(`
    SELECT e.id, e.event_type, e.payload, e.created_at
    FROM agent_events e
    ORDER BY e.created_at DESC
    LIMIT 10
  `);

  res.json({
    running: runningResult.rows,
    recent: recentResult.rows,
    events: eventsResult.rows,
  });
});
```

### Register in `index.ts`: `router.use('/agents/status', agentStatusRoutes);`

## Task 3: Context Query Endpoint

### New route or extend existing: `POST /api/v1/context/query`

This already exists conceptually in `context-awareness.service.ts`. Wire it:

```typescript
// POST /api/v1/context/query
router.post('/query', async (req, res) => {
  const { question, context } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });
  
  // Use context-awareness service to traverse KG and answer
  const result = await contextAwarenessService.answer(question, {
    contextType: context || 'general',
    userId: req.user?.userId,
  });
  
  res.json(result);
});
```

If `contextAwarenessService.answer()` doesn't exist, implement it by:
1. Breaking the question down into KG queries (extract entities, intent)
2. Traversing the graph for relevant nodes
3. Using an LLM call to synthesize the answer
4. Returning with citations/sources from the KG

## Task 4: NeuralNetworkHub Frontend Component

### New component: `frontend/src/components/dashboard/NeuralNetworkHub.tsx`

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface AgentRun {
  id: string;
  agent_id: string;
  trigger_event: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  deal_name?: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
}

interface InsightEvent {
  id: string;
  event_type: string;
  payload: any;
  created_at: string;
}

export default function NeuralNetworkHub() {
  const [runs, setRuns] = useState<{running: AgentRun[], recent: AgentRun[]}>({running: [], recent: []});
  const [events, setEvents] = useState<InsightEvent[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{text: string, sources?: string[]} | null>(null);
  const [answering, setAnswering] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/api/v1/agents/status');
      setRuns({ running: data.running || [], recent: data.recent || [] });
      setEvents(data.events || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const askNetwork = async () => {
    if (!question.trim() || answering) return;
    setAnswering(true);
    setAnswer(null);
    try {
      const { data } = await api.post('/api/v1/context/query', { question });
      setAnswer({ text: data.text, sources: data.sources });
    } catch (err: any) {
      setAnswer({ text: `Error: ${err.message}` });
    }
    setAnswering(false);
  };

  const AGENT_EMOJIS: Record<string, string> = {
    acquisitions: '🎯',
    research: '🔬',
    cfo: '💰',
    strategy: '🧠',
    orchestrator: '⚡',
    lender: '🏦',
    asset_manager: '📊',
  };

  const STATUS_COLORS: Record<string, string> = {
    running: '#3b82f6',
    pending: '#6b7280',
    completed: '#22c55e',
    failed: '#ef4444',
  };

  const formatTimeAgo = (dateStr: string) => {
    const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
    return `${Math.floor(secs/3600)}h ago`;
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',gap:4,overflow:'auto',padding:4}}>
      
      {/* ── AGENT STATUS ── */}
      <div style={{fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:1}}>
        Agent Status
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:2}}>
        {runs.running.length === 0 && runs.recent.length === 0 && (
          <div style={{fontSize:11,color:'#9ca3af',padding:'12px',textAlign:'center'}}>
            No agent activity yet — upload a document or create a deal to trigger agents
          </div>
        )}
        {runs.running.slice(0, 5).map(run => (
          <div key={run.id} style={{
            display:'flex',alignItems:'center',gap:6,background:'#f9fafb',borderRadius:4,
            padding:'4px 8px',borderLeft:`2px solid ${STATUS_COLORS.running}`
          }}>
            <span>{AGENT_EMOJIS[run.agent_id] || '🤖'}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:600}}>{run.agent_id}</div>
              {run.deal_name && <div style={{fontSize:9,color:'#6b7280'}}>{run.deal_name}</div>}
            </div>
            {run.started_at && (
              <span style={{fontSize:9,color:'#6b7280'}}>
                {Math.floor((Date.now() - new Date(run.started_at).getTime())/1000)}s
              </span>
            )}
            <span style={{fontSize:9,color:STATUS_COLORS[run.status],fontWeight:600}}>●</span>
          </div>
        ))}
        {runs.recent.slice(0, 3).map(run => (
          <div key={run.id} style={{
            display:'flex',alignItems:'center',gap:6,background:'#f9fafb',borderRadius:4,
            padding:'4px 8px',opacity:0.7
          }}>
            <span style={{fontSize:10}}>✓</span>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:500,color:'#374151'}}>{run.agent_id}</div>
            </div>
            <span style={{fontSize:9,color:'#6b7280'}}>
              {run.completed_at ? formatTimeAgo(run.completed_at) : ''}
            </span>
          </div>
        ))}
      </div>

      {/* ── INSIGHT FEED ── */}
      <div style={{fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:1,marginTop:8}}>
        Recent Events
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:2}}>
        {events.slice(0, 5).map(ev => (
          <div key={ev.id} style={{
            display:'flex',alignItems:'flex-start',gap:6,fontSize:10,color:'#374151',
            padding:'3px 6px',background:'#f9fafb',borderRadius:3
          }}>
            <span style={{fontSize:11}}>📌</span>
            <span style={{flex:1}}>{ev.event_type}: {JSON.stringify(ev.payload).slice(0, 80)}</span>
            <span style={{color:'#9ca3af',whiteSpace:'nowrap'}}>{formatTimeAgo(ev.created_at)}</span>
          </div>
        ))}
      </div>

      {/* ── ASK THE NETWORK ── */}
      <div style={{fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:1,marginTop:8}}>
        Ask the Network
      </div>
      <div style={{display:'flex',gap:4}}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askNetwork()}
          placeholder="e.g. What's the supply risk in Midtown Atlanta?"
          style={{
            flex:1,fontSize:10,padding:'4px 8px',border:'1px solid #d1d5db',
            borderRadius:4,outline:'none',background:'#fff'
          }}
        />
        <button
          onClick={askNetwork}
          disabled={answering || !question.trim()}
          style={{
            fontSize:10,padding:'4px 10px',background:answering?'#9ca3af':'#3b82f6',
            color:'#fff',border:'none',borderRadius:4,cursor:'pointer',whiteSpace:'nowrap'
          }}
        >
          {answering ? '…' : 'Ask'}
        </button>
      </div>
      {answer && (
        <div style={{
          fontSize:10,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:4,
          padding:'6px 8px',color:'#1e40af',marginTop:4
        }}>
          {answer.text}
          {answer.sources && answer.sources.length > 0 && (
            <div style={{marginTop:4,fontSize:9,color:'#6b7280'}}>
              Sources: {answer.sources.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Task 5: Register as Dashboard Widget

### In `TerminalPage.tsx`:

Add the widget to the widget map (around line 1200–1360):

```tsx
const WidgetNeuralHub = useCallback(() => (
  <NeuralNetworkHub />
), []);

// In the widget registry where other WidgetXxx are listed:
{ id: 'neural-hub', 
  label: 'Neural Network Hub', 
  render: WidgetNeuralHub,
  defaultSize: { w: 2, h: 2 },
  defaultPos: { x: 0, y: lastRow },
}
```

## Files to Modify/Create

| File | Action | Changes |
|------|--------|---------|
| `backend/src/services/agents/event-dispatcher.ts` | MODIFY | Insert agent_workflow_runs when events fire, add getTriggeredAgents() |
| `backend/src/services/agents/agent-orchestrator.ts` | MODIFY | Add markRun() to update workflow run status |
| `backend/src/api/rest/agent-status.routes.ts` | CREATE | GET /api/v1/agents/status endpoint |
| `backend/src/api/rest/index.ts` | MODIFY | Register agent-status routes |
| `backend/src/services/neural-network/context-awareness.service.ts` | MODIFY | Add answer() method if missing |
| `backend/src/api/rest/context-awareness.routes.ts` | MODIFY | Add POST /query endpoint |
| `frontend/src/components/dashboard/NeuralNetworkHub.tsx` | CREATE | Hub component |
| `frontend/src/pages/TerminalPage.tsx` | MODIFY | Register WidgetNeuralHub in widget list |

## Implementation Order

1. Backend: event-dispatcher writes agent_workflow_runs + orchestrator markRun()
2. Backend: GET /api/v1/agents/status + POST /api/v1/context/query
3. Frontend: NeuralNetworkHub component
4. Frontend: Register widget in TerminalPage
5. Test: trigger an event → see agent status update on dashboard
