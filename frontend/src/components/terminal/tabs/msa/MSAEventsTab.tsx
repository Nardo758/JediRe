/**
 * MSAEventsTab — M35 Event Impact Engine overlay for MSA Terminal
 *
 * Connects to live M35 event data and the new causality analysis engine.
 * The causality panel answers: "Did this event drive the market uptick,
 * or did the market uptick attract this event?"
 */
import React, { useState, useEffect } from 'react';
import { ArrowRight, Activity, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { MSAData } from '../../MSATerminal';

interface MSAEventsTabProps {
  msaId: string;
  msa: MSAData | null;
}

// ─── API Types (mirrors backend) ─────────────────────────────────────────────

type CausalityDirection =
  | 'event_drives_market'
  | 'market_attracts_event'
  | 'simultaneous'
  | 'bidirectional'
  | 'insufficient_data';

interface MetricCausality {
  metricKey: string;
  metricLabel: string;
  direction: CausalityDirection;
  leadLagMonths: number;
  r: number;
  pValue: number | null;
  sampleSize: number;
  preEventAccelerating: boolean;
  postEventDeltaPct: number;
  confidence: 'high' | 'medium' | 'low';
  verdictText: string;
}

interface EventCausalitySummary {
  eventId: string;
  eventName: string;
  eventCategory: string;
  direction: CausalityDirection;
  leadLagMonths: number;
  confidence: 'high' | 'medium' | 'low';
  keyMetric: string;
  verdictText: string;
  announcedDate: string | null;
}

interface MSACausalityReport {
  msaId: string;
  events: EventCausalitySummary[];
  summary: {
    totalEvents: number;
    eventsDriveMarket: number;
    marketAttractsEvents: number;
    simultaneous: number;
    insufficientData: number;
    avgLeadLagMonths: number;
    dominantPattern: string;
  };
  computedAt: string;
}

interface LiveEvent {
  id: string;
  name: string;
  category: string;
  status: string;
  scope: string;
  magnitudeScore: number;
  announcedDate: string | null;
  materializationDate: string | null;
  confidence: number;
}

interface PipelineSignal {
  signal: number;
  pipelineEvents: any[];
  horizonMonths: number;
}

// ─── Direction display config ─────────────────────────────────────────────────

const DIRECTION_META: Record<CausalityDirection, {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  icon: string;
  description: string;
}> = {
  event_drives_market: {
    label: 'Event Drives Market',
    shortLabel: 'CATALYST',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    icon: '⚡',
    description: 'Event announcement preceded the market uptick — this is a leading demand catalyst',
  },
  market_attracts_event: {
    label: 'Market Attracts Event',
    shortLabel: 'TRAILING',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    icon: '📈',
    description: 'Market was already strengthening before the event was announced — the event may be a lagging confirmation',
  },
  simultaneous: {
    label: 'Simultaneous',
    shortLabel: 'CONCURRENT',
    color: '#6B7A8D',
    bg: 'rgba(107,122,141,0.12)',
    icon: '↔',
    description: 'Event and market movement are largely contemporaneous — common driver likely',
  },
  bidirectional: {
    label: 'Bidirectional',
    shortLabel: 'MUTUAL',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    icon: '⇄',
    description: 'Self-reinforcing dynamic — market strength attracts events, events reinforce market',
  },
  insufficient_data: {
    label: 'Insufficient Data',
    shortLabel: 'NO DATA',
    color: '#4B5563',
    bg: 'rgba(75,85,99,0.12)',
    icon: '—',
    description: 'Not enough time-series data to determine causality',
  },
};

const CATEGORY_EMOJI: Record<string, string> = {
  employer_opening: '🏢',
  employer_closure: '⚠️',
  disaster: '🌀',
  infrastructure_pos: '🚆',
  infrastructure_neg: '🚧',
  demand_gen_open: '🏟️',
  demand_gen_close: '📉',
  regulatory: '📜',
  redevelopment_catalyst: '🏗️',
  employment: '💼',
  infrastructure: '🚆',
};

const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono','Fira Code',monospace",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MSAEventsTab: React.FC<MSAEventsTabProps> = ({ msaId, msa }) => {
  const msaName = msa?.name || msaId || 'MSA';

  const [causality, setCausality] = useState<MSACausalityReport | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [pipelineSignal, setPipelineSignal] = useState<PipelineSignal | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [causalityLoading, setCausalityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricFilter, setMetricFilter] = useState('rent');
  const [refreshing, setRefreshing] = useState(false);

  // ── Load live events & pipeline signal ────────────────────────────────────
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const [evRes, sigRes] = await Promise.all([
          fetch(`/api/v1/m35/events?msaId=${encodeURIComponent(msaId)}&limit=15`),
          fetch(`/api/v1/m35/msa/${encodeURIComponent(msaId)}/pipeline-signal`),
        ]);

        if (evRes.ok) {
          const data = await evRes.json();
          setLiveEvents((data.items || data.events || []).slice(0, 8));
        }
        if (sigRes.ok) {
          setPipelineSignal(await sigRes.json());
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [msaId]);

  // ── Load causality report ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchCausality = async () => {
      try {
        setCausalityLoading(true);
        const res = await fetch(`/api/v1/m35/msa/${encodeURIComponent(msaId)}/causality`);
        if (res.ok) setCausality(await res.json());
      } catch (err) {
        // causality may not have data yet — non-fatal
      } finally {
        setCausalityLoading(false);
      }
    };
    fetchCausality();
  }, [msaId]);

  // ── Load event detail (when user clicks an event) ──────────────────────────
  useEffect(() => {
    if (!selectedEventId) { setEventDetail(null); return; }
    const fetchDetail = async () => {
      const res = await fetch(`/api/v1/m35/events/${selectedEventId}/causality`);
      if (res.ok) setEventDetail(await res.json());
    };
    fetchDetail();
  }, [selectedEventId]);

  const handleRefreshCausality = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/v1/m35/msa/${encodeURIComponent(msaId)}/causality`);
      if (res.ok) setCausality(await res.json());
    } finally {
      setRefreshing(false);
    }
  };

  // Merge live events with causality data
  const eventsWithCausality = liveEvents.map(ev => ({
    ...ev,
    causality: causality?.events.find(c => c.eventId === ev.id) || null,
  }));

  const sig = causality?.summary;
  const pipelineScore = pipelineSignal?.signal ?? null;
  const pipelineColor = pipelineScore === null ? BT.text.muted
    : pipelineScore > 0.2 ? '#10B981'
    : pipelineScore < -0.2 ? '#EF4444'
    : BT.text.muted;

  return (
    <div style={{ color: BT.text.primary, ...mono }}>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${BT.border.subtle}`, paddingBottom: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle, marginBottom: 4 }}>
            {msaName.toUpperCase()} — EVENT IMPACT ENGINE
          </h2>
          <div style={{ fontSize: 11, color: BT.text.muted, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>M35 Structured Events</span>
            <span style={{ color: BT.border.subtle }}>·</span>
            <span>Causality Engine</span>
            <span style={{ color: BT.border.subtle }}>·</span>
            <span>T-07 Trajectory Integration</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', ...mono, fontSize: 11, padding: '8px 16px', background: BT.bg.elevated, border: `1px solid ${BT.border.subtle}` }}>
          <div>
            <div style={{ color: BT.text.muted, fontSize: 9, marginBottom: 2 }}>JEDI SCORE</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: BT.text.primary }}>{msa?.healthScore ?? '—'}</div>
          </div>
          <div style={{ width: 1, height: 32, background: BT.border.subtle }} />
          <div>
            <div style={{ color: BT.text.muted, fontSize: 9, marginBottom: 2 }}>EVENT PIPELINE</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: pipelineColor }}>
              {pipelineScore !== null
                ? `${pipelineScore >= 0 ? '+' : ''}${(pipelineScore * 100).toFixed(0)}%`
                : '—'}
            </div>
          </div>
          <div style={{ width: 1, height: 32, background: BT.border.subtle }} />
          <div>
            <div style={{ color: BT.text.muted, fontSize: 9, marginBottom: 2 }}>LIVE EVENTS</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: BT.accent.blue }}>{liveEvents.length}</div>
          </div>
        </div>
      </div>

      {/* ── Causality Summary Bar ─────────────────────────────────────────────── */}
      {sig && (
        <div style={{ ...terminalStyles.card, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: BT.text.secondary, flexShrink: 0 }}>CAUSALITY BREAKDOWN</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flex: 1 }}>
            {[
              { count: sig.eventsDriveMarket, label: 'Events Drive Market', dir: 'event_drives_market' as CausalityDirection },
              { count: sig.marketAttractsEvents, label: 'Market Attracts Events', dir: 'market_attracts_event' as CausalityDirection },
              { count: sig.simultaneous, label: 'Simultaneous', dir: 'simultaneous' as CausalityDirection },
              { count: sig.insufficientData, label: 'Insufficient Data', dir: 'insufficient_data' as CausalityDirection },
            ].map(({ count, label, dir }) => {
              const meta = DIRECTION_META[dir];
              return (
                <div key={dir} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 18, color: meta.color }}>{count}</span>
                  <span style={{ fontSize: 10, color: BT.text.muted }}>{label}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted, maxWidth: 260, flexShrink: 0 }}>
            {sig.dominantPattern}
            {sig.avgLeadLagMonths !== 0 && (
              <span style={{ color: BT.text.secondary, marginLeft: 6 }}>
                · avg lead/lag: {sig.avgLeadLagMonths > 0 ? '+' : ''}{sig.avgLeadLagMonths}mo
              </span>
            )}
          </div>
          <button
            onClick={handleRefreshCausality}
            title="Refresh causality analysis"
            disabled={refreshing}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.dim, padding: 4 }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      )}

      {/* ── T-07 Pipeline Signal Banner ───────────────────────────────────────── */}
      {pipelineSignal && pipelineSignal.pipelineEvents.length > 0 && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center',
          background: pipelineScore! > 0 ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
          border: `1px solid ${pipelineScore! > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          borderLeft: `3px solid ${pipelineColor}`,
        }}>
          <span style={{ fontSize: 13, color: pipelineColor, fontWeight: 700 }}>T-07</span>
          <span style={{ fontSize: 11, color: BT.text.secondary }}>
            {pipelineSignal.pipelineEvents.length} pipeline event{pipelineSignal.pipelineEvents.length !== 1 ? 's' : ''}
            {' '}contributing a{' '}
            <span style={{ color: pipelineColor, fontWeight: 700 }}>
              {pipelineScore! >= 0 ? '+' : ''}{((pipelineScore || 0) * 100).toFixed(1)}%
            </span>
            {' '}trajectory signal over the next {pipelineSignal.horizonMonths} months
          </span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {pipelineSignal.pipelineEvents.slice(0, 3).map((ev: any, i: number) => (
              <span key={i} style={{ fontSize: 9, padding: '2px 6px', background: BT.bg.elevated, border: `1px solid ${BT.border.subtle}`, color: BT.text.muted }}>
                {CATEGORY_EMOJI[ev.category] || '📌'} {ev.name?.substring(0, 20)}
                {ev.timeToImpactMonths !== undefined && <span style={{ color: BT.text.dim }}> T+{ev.timeToImpactMonths}mo</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Layout: Event Cards + Detail Panel ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedEventId ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* Left: Event Cards + Causality Badges */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.1em' }}>
              ACTIVE EVENT PROFILES
            </span>
            {causalityLoading && (
              <span style={{ fontSize: 9, color: BT.text.dim }}>
                computing causality...
              </span>
            )}
          </div>

          {loading && (
            <div style={{ ...terminalStyles.card, padding: 32, textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
              Loading events...
            </div>
          )}

          {!loading && eventsWithCausality.length === 0 && (
            <div style={{ ...terminalStyles.card, padding: 32, textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
              No active events for this MSA yet.
              <div style={{ marginTop: 8, fontSize: 10 }}>
                Events are ingested via news signals and analyst review.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {eventsWithCausality.map(ev => {
              const causal = ev.causality;
              const meta = causal ? DIRECTION_META[causal.direction] : null;
              const isSelected = selectedEventId === ev.id;
              const emoji = CATEGORY_EMOJI[ev.category] || '📌';
              const statusColor =
                ev.status === 'materialized' ? '#10B981' :
                ev.status === 'announced' ? BT.accent.amber :
                ev.status === 'in_progress' ? BT.accent.blue :
                BT.text.muted;

              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(isSelected ? null : ev.id)}
                  style={{
                    ...terminalStyles.card,
                    padding: 0,
                    cursor: 'pointer',
                    borderLeft: `3px solid ${meta?.color || statusColor}`,
                    background: isSelected ? BT.bg.active : BT.bg.card,
                    outline: isSelected ? `1px solid ${BT.accent.blue}44` : 'none',
                  }}
                >
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: BT.bg.elevated, flexShrink: 0 }}>
                          {emoji}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: BT.text.primary }}>{ev.name}</div>
                          <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 2, display: 'flex', gap: 8 }}>
                            <span style={{ color: statusColor, textTransform: 'uppercase', fontWeight: 700 }}>{ev.status}</span>
                            <span>{ev.category?.replace(/_/g, ' ')}</span>
                            {ev.announcedDate && (
                              <span>· {new Date(ev.announcedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Causality Badge */}
                      {meta ? (
                        <div style={{
                          padding: '3px 10px', fontSize: 10, fontWeight: 700,
                          color: meta.color, background: meta.bg,
                          border: `1px solid ${meta.color}33`,
                          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                        }}>
                          <span>{meta.icon}</span>
                          <span>{meta.shortLabel}</span>
                        </div>
                      ) : causalityLoading ? (
                        <span style={{ fontSize: 9, color: BT.text.dim }}>…</span>
                      ) : null}
                    </div>

                    {/* Causality one-liner */}
                    {causal && causal.direction !== 'insufficient_data' && (
                      <div style={{
                        padding: '8px 10px',
                        background: BT.bg.elevated,
                        borderLeft: `2px solid ${meta?.color || BT.border.subtle}`,
                        fontSize: 10,
                        color: BT.text.secondary,
                        lineHeight: 1.5,
                      }}>
                        {causal.verdictText.length > 180
                          ? causal.verdictText.substring(0, 177) + '…'
                          : causal.verdictText}
                      </div>
                    )}

                    {/* Lead-lag indicator */}
                    {causal && causal.direction !== 'insufficient_data' && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 9, color: BT.text.muted }}>
                        <span>
                          Lead/Lag:{' '}
                          <span style={{ color: causal.leadLagMonths > 0 ? '#10B981' : causal.leadLagMonths < 0 ? BT.accent.amber : BT.text.muted, fontWeight: 700 }}>
                            {causal.leadLagMonths > 0 ? '+' : ''}{causal.leadLagMonths}mo
                          </span>
                        </span>
                        <span>
                          Signal:{' '}
                          <span style={{ color: BT.text.secondary }}>{causal.keyMetric}</span>
                        </span>
                        <span>
                          Confidence:{' '}
                          <span style={{
                            color: causal.confidence === 'high' ? '#10B981' :
                                   causal.confidence === 'medium' ? BT.accent.amber : BT.text.dim,
                            fontWeight: 700, textTransform: 'uppercase',
                          }}>{causal.confidence}</span>
                        </span>
                        <span style={{ marginLeft: 'auto', color: BT.accent.blue, cursor: 'pointer' }}>
                          {isSelected ? '↑ collapse' : '↓ details'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Event Detail + Per-Metric Causality ─────────────────────────── */}
        {selectedEventId && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.1em' }}>
                CAUSALITY DETAIL
              </span>
              <button
                onClick={() => setSelectedEventId(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.dim, fontSize: 12 }}
              >
                ✕
              </button>
            </div>

            {!eventDetail && (
              <div style={{ ...terminalStyles.card, padding: 32, textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
                Loading causality analysis...
              </div>
            )}

            {eventDetail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Overall verdict */}
                {(() => {
                  const meta = DIRECTION_META[eventDetail.overallDirection as CausalityDirection];
                  return (
                    <div style={{ ...terminalStyles.card, padding: 16, borderLeft: `3px solid ${meta.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>{meta.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: meta.color }}>{meta.label}</div>
                          <div style={{ fontSize: 9, color: BT.text.muted }}>Overall verdict · {eventDetail.eventName}</div>
                        </div>
                        <span style={{
                          marginLeft: 'auto', fontSize: 9, padding: '3px 8px',
                          background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33`,
                          fontWeight: 700,
                        }}>
                          {eventDetail.dominantLeadLagMonths > 0 ? '+' : ''}{eventDetail.dominantLeadLagMonths}mo
                        </span>
                      </div>
                      <p style={{ fontSize: 10, color: BT.text.secondary, lineHeight: 1.6, margin: 0 }}>
                        {eventDetail.overallVerdictText}
                      </p>
                    </div>
                  );
                })()}

                {/* Per-metric breakdown */}
                <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em', marginTop: 4 }}>
                  PER-METRIC LEAD-LAG ANALYSIS
                </div>

                {eventDetail.metrics?.map((m: MetricCausality) => {
                  const meta = DIRECTION_META[m.direction];
                  return (
                    <div key={m.metricKey} style={{ ...terminalStyles.card, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.primary }}>{m.metricLabel}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: meta.color, fontWeight: 700 }}>{meta.shortLabel}</span>
                          <span style={{ fontSize: 9, color: BT.text.muted }}>
                            {m.leadLagMonths > 0 ? '+' : ''}{m.leadLagMonths}mo
                          </span>
                        </div>
                      </div>

                      {/* Mini bar chart: lag sweep visualization */}
                      <div style={{ position: 'relative', height: 28, background: BT.bg.elevated, marginBottom: 8 }}>
                        {/* Center line = T0 */}
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: BT.border.subtle }} />
                        {/* Best-lag marker */}
                        {m.direction !== 'insufficient_data' && (
                          <div style={{
                            position: 'absolute',
                            left: `${50 + (m.leadLagMonths / 12) * 50}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 8, height: 8,
                            background: meta.color,
                            borderRadius: '50%',
                          }} />
                        )}
                        {/* Labels */}
                        <div style={{ position: 'absolute', left: 4, bottom: 2, fontSize: 8, color: BT.text.dim }}>-12mo</div>
                        <div style={{ position: 'absolute', left: '50%', bottom: 2, fontSize: 8, color: BT.text.dim, transform: 'translateX(-50%)' }}>T0</div>
                        <div style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 8, color: BT.text.dim }}>+12mo</div>
                      </div>

                      <div style={{ display: 'flex', gap: 16, fontSize: 9, color: BT.text.muted, flexWrap: 'wrap' }}>
                        <span>r = <span style={{ color: Math.abs(m.r) >= 0.5 ? '#10B981' : BT.text.secondary }}>{m.r.toFixed(2)}</span></span>
                        {m.pValue !== null && <span>p = {m.pValue.toFixed(3)}</span>}
                        <span>n = {m.sampleSize}mo</span>
                        {m.postEventDeltaPct !== 0 && (
                          <span>T+12 delta: <span style={{ color: m.postEventDeltaPct > 0 ? '#10B981' : '#EF4444' }}>
                            {m.postEventDeltaPct > 0 ? '+' : ''}{m.postEventDeltaPct.toFixed(1)}%
                          </span></span>
                        )}
                        {m.preEventAccelerating && (
                          <span style={{ color: BT.accent.amber }}>↑ pre-event acceleration</span>
                        )}
                      </div>

                      {m.direction !== 'insufficient_data' && m.verdictText && (
                        <div style={{ marginTop: 6, fontSize: 9, color: BT.text.secondary, lineHeight: 1.5, borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 6 }}>
                          {m.verdictText.substring(0, 200)}{m.verdictText.length > 200 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Re-run causality */}
                <button
                  onClick={async () => {
                    setEventDetail(null);
                    const res = await fetch(`/api/v1/m35/events/${selectedEventId}/causality`, { method: 'POST' });
                    if (res.ok) setEventDetail(await res.json());
                  }}
                  style={{
                    ...mono, fontSize: 9, padding: '6px 12px',
                    background: 'transparent', color: BT.text.muted,
                    border: `1px dashed ${BT.border.subtle}`, cursor: 'pointer',
                  }}
                >
                  ↺ Re-compute causality (bypass cache)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Trajectory Chart (static skeleton with event markers) ───────────── */}
      <div style={{ ...terminalStyles.card, padding: 16, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: BT.text.secondary, margin: 0 }}>MSA TRAJECTORY OVERLAY</h3>
          <div style={{ display: 'flex', background: BT.bg.elevated, border: `1px solid ${BT.border.subtle}`, overflow: 'hidden' }}>
            {[
              { key: 'rent', label: 'Rent Growth' },
              { key: 'absorption', label: 'Absorption' },
              { key: 'traffic', label: 'Traffic' },
              { key: 'search', label: 'Search' },
            ].map((m, i, arr) => (
              <button
                key={m.key}
                onClick={() => setMetricFilter(m.key)}
                style={{
                  ...mono, padding: '4px 10px', fontSize: 10, cursor: 'pointer',
                  background: metricFilter === m.key ? BT.bg.active : 'transparent',
                  color: metricFilter === m.key ? BT.text.primary : BT.text.muted,
                  border: 'none',
                  borderRight: i < arr.length - 1 ? `1px solid ${BT.border.subtle}` : 'none',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart + event vertical markers */}
        <div style={{ position: 'relative', height: 200, background: BT.bg.primary, border: `1px solid ${BT.border.subtle}`, overflow: 'hidden' }}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 25}%`, height: 1, background: `${BT.border.subtle}44` }} />
          ))}

          {/* SVG path */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none" viewBox="0 0 1000 200">
            <path d="M0,140 C80,130 160,148 240,120 C320,92 400,100 480,72 L500,80"
              fill="none" stroke={BT.text.secondary} strokeWidth="2" />
            <path d="M500,80 C600,55 700,48 1000,35 L1000,100 C700,100 600,108 500,80 Z"
              fill={BT.accent.blue} fillOpacity="0.08" />
            <path d="M500,80 C600,72 700,65 1000,52"
              fill="none" stroke={BT.accent.blue} strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="500" y1="0" x2="500" y2="200" stroke={BT.text.secondary} strokeWidth="2" />
            <rect x="468" y="182" width="64" height="14" fill={BT.text.secondary} rx="1" />
            <text x="500" y="193" fill="#0B0E1A" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">TODAY</text>

            {/* Event markers from live causality data */}
            {causality?.events.slice(0, 4).map((ev, i) => {
              const meta = DIRECTION_META[ev.direction];
              const xPos = 150 + i * 80;
              return (
                <g key={ev.eventId}>
                  <line x1={xPos} y1="0" x2={xPos} y2="200" stroke={meta.color} strokeWidth="1.5"
                    strokeDasharray={ev.direction === 'event_drives_market' ? 'none' : '4 4'} />
                  <text x={xPos + 4} y="14" fill={meta.color} fontSize="9" fontFamily="monospace">
                    {CATEGORY_EMOJI[ev.eventCategory] || '📌'} {ev.eventName.substring(0, 14)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Y-axis labels */}
          <div style={{ position: 'absolute', left: 4, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBlock: 4, fontSize: 9, color: BT.text.dim }}>
            <span>+6%</span><span>+4%</span><span>+2%</span><span>0%</span><span>-2%</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 9, color: BT.text.dim }}>
          {['T-24m', 'T-18m', 'T-12m', 'T-6m', 'T0', 'T+6m', 'T+12m', 'T+18m', 'T+24m'].map(l => (
            <span key={l} style={l === 'T0' ? { color: BT.text.primary, fontWeight: 700 } : {}}>{l}</span>
          ))}
        </div>
      </div>

      {/* ── Direction Legend ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, marginTop: 16, padding: '10px 14px', background: BT.bg.elevated, border: `1px solid ${BT.border.subtle}`, fontSize: 9, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: BT.text.muted }}>CAUSALITY LEGEND:</span>
        {Object.entries(DIRECTION_META).map(([key, meta]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: meta.color }}>{meta.icon}</span>
            <span style={{ fontWeight: 700, color: meta.color }}>{meta.shortLabel}</span>
            <span style={{ color: BT.text.dim }}>—</span>
            <span style={{ color: BT.text.muted }}>{meta.description.substring(0, 55)}…</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MSAEventsTab;
