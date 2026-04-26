/**
 * Neural Network Hub Widget
 * ============================================================================
 * Live status of the agent layer (running runs, recent runs, recent platform
 * events) plus a free-form "Ask the network" input that hits the
 * knowledge-graph + LLM backed `POST /api/v1/context/query` endpoint.
 *
 * Polling cadence is 15s per the task spec (out of scope: real-time WS/SSE).
 * Theme tokens are passed in as a `T` prop so this component can be hosted
 * inside `TerminalPage.tsx` without re-deriving the theme map.
 */

import React from 'react';

// ---- types -----------------------------------------------------------------

export type ThemeTokens = {
  bg: Record<string, string>;
  text: Record<string, string>;
  border: Record<string, string>;
  font: Record<string, string>;
};

type RunRow = {
  id: string;
  agent_id: string;
  trigger_event: string;
  deal_id: string | null;
  user_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  status?: string;
  error?: string | null;
};

type EventRow = {
  id: string;
  event_type: string;
  deal_id: string | null;
  user_id: string | null;
  created_at: string;
};

type Source = { id: string; type: string; name: string; score: number };

interface Props {
  T: ThemeTokens;
}

// ---- component -------------------------------------------------------------

export default function NeuralNetworkHubWidget({ T }: Props) {
  const [running, setRunning] = React.useState<RunRow[]>([]);
  const [recent, setRecent] = React.useState<RunRow[]>([]);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [statusErr, setStatusErr] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<'live' | 'recent' | 'events' | 'ask'>('live');

  const [question, setQuestion] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [answer, setAnswer] = React.useState<{ text: string; sources: Source[]; matched: number } | null>(null);
  const [askErr, setAskErr] = React.useState<string | null>(null);

  const fmtTime = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = Date.now();
    const ms = now - d.getTime();
    if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  };

  const loadStatus = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const r = await fetch('/api/v1/agents/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) {
        setStatusErr(`HTTP ${r.status}`);
        return;
      }
      const d = await r.json();
      setRunning(d.running || []);
      setRecent(d.recent || []);
      setEvents(d.events || []);
      setStatusErr(null);
    } catch (e: any) {
      setStatusErr(e?.message || 'fetch failed');
    }
  }, []);

  React.useEffect(() => {
    loadStatus();
    // Per task spec: poll every 15s (out of scope: real-time WS/SSE).
    const t = setInterval(loadStatus, 15000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const ask = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskErr(null);
    setAnswer(null);
    try {
      const token = localStorage.getItem('auth_token');
      const r = await fetch('/api/v1/context/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setAskErr(d?.error || `HTTP ${r.status}`);
      } else {
        setAnswer({ text: d.text, sources: d.sources || [], matched: d.matched || 0 });
      }
    } catch (e: any) {
      setAskErr(e?.message || 'ask failed');
    } finally {
      setAsking(false);
    }
  };

  const tabs: Array<{ key: typeof tab; label: string; count?: number }> = [
    { key: 'live', label: 'LIVE', count: running.length },
    { key: 'recent', label: 'RECENT', count: recent.length },
    { key: 'events', label: 'EVENTS', count: events.length },
    { key: 'ask', label: 'ASK' },
  ];

  const statusColor = (s?: string) =>
    s === 'completed' ? T.text.green :
    s === 'failed'    ? T.text.red   :
    s === 'running'   ? T.text.cyan  :
    s === 'pending'   ? T.text.amber : T.text.muted;

  const RunLine = ({ r, showStatus }: { r: RunRow; showStatus?: boolean }) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1fr 80px 70px',
      gap: 6, padding: '4px 8px', borderBottom: `1px solid ${T.border.subtle}`,
      fontFamily: T.font.mono, fontSize: 10, alignItems: 'center',
    }}>
      <span style={{ color: T.text.purple, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.agent_id}</span>
      <span style={{ color: T.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.error || r.trigger_event}>
        {r.trigger_event}{r.error ? ` — ${r.error.slice(0, 60)}` : ''}
      </span>
      {showStatus
        ? <span style={{ color: statusColor(r.status), letterSpacing: 0.5 }}>{(r.status || '').toUpperCase()}</span>
        : <span style={{ color: T.text.muted }}>{r.deal_id ? r.deal_id.slice(0, 8) : '—'}</span>}
      <span style={{ color: T.text.muted, textAlign: 'right' }}>
        {fmtTime(r.completed_at || r.started_at || r.created_at)}
      </span>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.15s' }}>
      {/* Tab strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
        background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`,
        flexShrink: 0,
      }}>
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              fontFamily: T.font.mono, fontSize: 9, fontWeight: 700,
              padding: '2px 8px', cursor: 'pointer', letterSpacing: 0.6,
              background: tab === tb.key ? T.text.purple : 'transparent',
              color: tab === tb.key ? T.bg.terminal : T.text.muted,
              border: `1px solid ${tab === tb.key ? T.text.purple : T.border.subtle}`,
            }}
          >
            {tb.label}{typeof tb.count === 'number' ? ` ${tb.count}` : ''}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {statusErr && <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.red }}>err: {statusErr}</span>}
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: statusErr ? T.text.red : T.text.green,
          animation: statusErr ? undefined : 'pulse 1.4s infinite',
        }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {tab === 'live' && (
          running.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
              No agents running.
            </div>
          ) : running.map(r => <RunLine key={r.id} r={r} showStatus />)
        )}

        {tab === 'recent' && (
          recent.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
              No recent runs yet — trigger an event to see activity.
            </div>
          ) : recent.map(r => <RunLine key={r.id} r={r} showStatus />)
        )}

        {tab === 'events' && (
          events.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
              No platform events captured yet.
            </div>
          ) : events.map(ev => (
            <div key={ev.id} style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr 70px',
              gap: 6, padding: '4px 8px', borderBottom: `1px solid ${T.border.subtle}`,
              fontFamily: T.font.mono, fontSize: 10, alignItems: 'center',
            }}>
              <span style={{ color: T.text.cyan, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.event_type}</span>
              <span style={{ color: T.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.deal_id ? `deal ${ev.deal_id.slice(0, 8)}` : 'system'}
              </span>
              <span style={{ color: T.text.muted, textAlign: 'right' }}>{fmtTime(ev.created_at)}</span>
            </div>
          ))
        )}

        {tab === 'ask' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: 8, borderBottom: `1px solid ${T.border.subtle}`, display: 'flex', gap: 6 }}>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask(); }}
                placeholder="Ask the network… e.g. 'What deals are most at risk from Q3 supply?'  (⌘/Ctrl+Enter)"
                rows={2}
                style={{
                  flex: 1, fontFamily: T.font.mono, fontSize: 11, padding: 6,
                  background: T.bg.input, color: T.text.white,
                  border: `1px solid ${T.border.subtle}`, resize: 'vertical', minHeight: 36,
                }}
              />
              <button
                onClick={ask}
                disabled={asking || !question.trim()}
                style={{
                  fontFamily: T.font.mono, fontSize: 10, fontWeight: 700,
                  padding: '4px 12px', cursor: asking || !question.trim() ? 'not-allowed' : 'pointer',
                  background: asking ? T.bg.input : T.text.purple,
                  color: asking ? T.text.muted : T.bg.terminal,
                  border: `1px solid ${T.text.purple}`, letterSpacing: 0.6,
                  alignSelf: 'flex-start',
                }}
              >
                {asking ? 'ASKING…' : 'ASK'}
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 10, fontFamily: T.font.mono, fontSize: 11 }}>
              {askErr && <div style={{ color: T.text.red, marginBottom: 8 }}>error: {askErr}</div>}
              {!answer && !askErr && !asking && (
                <div style={{ color: T.text.muted }}>
                  The network will search the knowledge graph and synthesize an answer
                  grounded in the entities it finds. Sources are listed below the answer.
                </div>
              )}
              {asking && <div style={{ color: T.text.cyan }}>Thinking…</div>}
              {answer && (
                <>
                  <div style={{ color: T.text.white, whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 10 }}>
                    {answer.text}
                  </div>
                  {answer.sources.length > 0 && (
                    <>
                      <div style={{ color: T.text.muted, fontSize: 9, letterSpacing: 0.6, marginBottom: 4 }}>
                        SOURCES ({answer.matched})
                      </div>
                      {answer.sources.map((s, i) => (
                        <div key={s.id} style={{
                          display: 'grid', gridTemplateColumns: '24px 80px 1fr 60px',
                          gap: 6, padding: '2px 0', fontSize: 10, color: T.text.secondary,
                        }}>
                          <span style={{ color: T.text.muted }}>[{i + 1}]</span>
                          <span style={{ color: T.text.cyan }}>{s.type}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                          <span style={{ color: T.text.muted, textAlign: 'right' }}>{s.score.toFixed(3)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
