import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface AgentRun {
  id: string;
  agent_id: string;
  trigger_event: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  deal_name?: string;
  deal_id?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  duration_seconds?: number;
}

interface InsightEvent {
  id: string;
  event_type: string;
  payload: any;
  created_at: string;
}

const AGENT_EMOJIS: Record<string, string> = {
  acquisitions: '🎯',
  research: '🔬',
  cfo: '💰',
  strategy: '🧠',
  orchestrator: '⚡',
  lender: '🏦',
  asset_manager: '📊',
  leasing: '📋',
  legal: '⚖️',
  compliance: '✅',
};

const STATUS_COLORS: Record<string, string> = {
  running: '#3b82f6',
  pending: '#6b7280',
  completed: '#22c55e',
  failed: '#ef4444',
};

function formatTimeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function eventEmoji(eventType: string): string {
  if (eventType.includes('document')) return '📄';
  if (eventType.includes('email')) return '📧';
  if (eventType.includes('deal')) return '🏗️';
  if (eventType.includes('financial')) return '💰';
  if (eventType.includes('market')) return '📊';
  if (eventType.includes('news')) return '📰';
  if (eventType.includes('threshold')) return '⚠️';
  if (eventType.includes('task')) return '✅';
  return '📌';
}

export default function NeuralNetworkHub() {
  const [runs, setRuns] = useState<{ running: AgentRun[]; recent: AgentRun[] }>({
    running: [],
    recent: [],
  });
  const [events, setEvents] = useState<InsightEvent[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ text: string; sources?: string[] } | null>(null);
  const [answering, setAnswering] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/api/v1/agents/status');
      setRuns({ running: data.running || [], recent: data.recent || [] });
      setEvents(data.events || []);
    } catch {
      // silent
    }
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
      setAnswer({ text: data.text || data.error || 'No response', sources: data.sources });
    } catch (err: any) {
      setAnswer({ text: `Error: ${err.message}`, sources: [] });
    }
    setAnswering(false);
  };

  const running = runs.running.slice(0, 6);
  const recent = runs.recent.slice(0, 4);
  const insightEvents = events.slice(0, 6);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto', padding: 3 }}>
      {/* ── AGENT STATUS ── */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: 1,
          padding: '2px 4px',
        }}
      >
        Agent Status
      </div>
      {running.length === 0 && recent.length === 0 ? (
        <div
          style={{
            fontSize: 10,
            color: '#9ca3af',
            padding: '10px 8px',
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: 3,
          }}
        >
          No agent activity yet — upload a document or create a deal to trigger agents
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {running.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#f9fafb',
                borderRadius: 3,
                padding: '4px 6px',
                borderLeft: `2px solid ${STATUS_COLORS.running}`,
              }}
            >
              <span style={{ fontSize: 11 }}>{AGENT_EMOJIS[r.agent_id] || '🤖'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600 }}>{r.agent_id}</div>
                {r.deal_name && (
                  <div style={{ fontSize: 8, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.deal_name}
                  </div>
                )}
                <div style={{ fontSize: 8, color: '#9ca3af' }}>
                  {r.trigger_event}
                </div>
              </div>
              {r.started_at && (
                <span style={{ fontSize: 8, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {Math.floor((Date.now() - new Date(r.started_at).getTime()) / 1000)}s
                </span>
              )}
              <span style={{ fontSize: 8, color: STATUS_COLORS[r.status], fontWeight: 600 }}>●</span>
            </div>
          ))}
          {recent.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#f9fafb',
                borderRadius: 3,
                padding: '3px 6px',
                opacity: 0.65,
              }}
            >
              <span style={{ fontSize: 9, color: r.status === 'completed' ? '#22c55e' : '#ef4444' }}>
                {r.status === 'completed' ? '✓' : '✗'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 500, color: '#374151' }}>{r.agent_id}</div>
              </div>
              <span style={{ fontSize: 8, color: '#6b7280', whiteSpace: 'nowrap' }}>
                {r.completed_at ? formatTimeAgo(r.completed_at) : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── INSIGHT FEED ── */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: 1,
          padding: '2px 4px',
          marginTop: 6,
        }}
      >
        Recent Events
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {insightEvents.length === 0 ? (
          <div
            style={{
              fontSize: 10,
              color: '#9ca3af',
              padding: '8px',
              textAlign: 'center',
              background: '#f9fafb',
              borderRadius: 3,
            }}
          >
            No events yet
          </div>
        ) : (
          insightEvents.map(ev => (
            <div
              key={ev.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 4,
                fontSize: 9,
                color: '#374151',
                padding: '2px 4px',
                background: '#f9fafb',
                borderRadius: 2,
              }}
            >
              <span style={{ fontSize: 10 }}>{eventEmoji(ev.event_type)}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.event_type}
              </span>
              <span style={{ color: '#9ca3af', whiteSpace: 'nowrap', fontSize: 8 }}>
                {formatTimeAgo(ev.created_at)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── ASK THE NETWORK ── */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: 1,
          padding: '2px 4px',
          marginTop: 6,
        }}
      >
        Ask the Network
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askNetwork()}
          placeholder="e.g. What's the supply risk in Atlanta?"
          style={{
            flex: 1,
            fontSize: 10,
            padding: '3px 6px',
            border: '1px solid #d1d5db',
            borderRadius: 3,
            outline: 'none',
            background: '#fff',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={askNetwork}
          disabled={answering || !question.trim()}
          style={{
            fontSize: 9,
            padding: '3px 8px',
            background: answering || !question.trim() ? '#9ca3af' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: answering || !question.trim() ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
            fontWeight: 600,
          }}
        >
          {answering ? '…' : 'Ask'}
        </button>
      </div>
      {answer && (
        <div
          style={{
            fontSize: 9,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 3,
            padding: '5px 6px',
            color: '#1e40af',
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {answer.text}
          {answer.sources && answer.sources.length > 0 && (
            <div style={{ marginTop: 3, fontSize: 8, color: '#6b7280' }}>
              Sources: {answer.sources.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
