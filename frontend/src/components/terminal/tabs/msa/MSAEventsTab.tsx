/**
 * MSAEventsTab — M35 Event Impact Engine overlay for MSA Terminal
 *
 * Connects to live M35 event data and the new causality analysis engine.
 * The causality panel answers: "Did this event drive the market uptick,
 * or did the market uptick attract this event?"
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Activity, ChevronDown, RefreshCw, AlertCircle, ArrowUpRight } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { MSAData } from '../../MSATerminal';
import { EventForecastPanel } from './EventForecastPanel';
import { EventDensityStrip } from '../../../m35/EventDensityStrip';

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
  pipelineEvents: PipelineEvent[];
  horizonMonths: number;
}

interface PipelineEvent {
  id: string;
  name: string;
  category: string;
  timeToImpactMonths?: number;
}

interface FullEventRecord {
  id: string;
  name: string;
  category: string;
  status: string;
  scope: string;
  magnitudeScore: number;
  confidence: number;
  announcedDate: string | null;
  materializationDate: string | null;
  description: string | null;
  submarket: string | null;
  msaId: string | null;
  connectorSource: string | null;
  proFormaLinked: boolean;
  forecastStatus: 'ahead' | 'behind' | 'on_pace' | 'no_data' | null;
  forecastSummary: string | null;
  playbookName: string | null;
  relatedEvents: RelatedEventRef[];
}

interface RelatedEventRef {
  id: string;
  name: string;
  category: string;
  relationship: string;
}

interface EventCausalityDetail {
  eventId: string;
  eventName: string;
  overallDirection: string;
  overallVerdictText: string;
  dominantLeadLagMonths: number;
  metrics: MetricCausality[];
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
  const navigate = useNavigate();

  interface PlaybookDetail {
    instanceCount: number;
    confidence: number;
    status: 'preliminary' | 'publishable';
    lagStructure: Record<string, Record<string, unknown>> | null;
  }

  const [causality, setCausality] = useState<MSACausalityReport | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [pipelineSignal, setPipelineSignal] = useState<PipelineSignal | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<EventCausalityDetail | null>(null);
  const [fullEvent, setFullEvent] = useState<FullEventRecord | null>(null);
  const [playbookDetail, setPlaybookDetail] = useState<PlaybookDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'detail' | 'causality' | 'forecast'>('detail');
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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
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

  // ── Load full event record + causality when event selected ────────────────
  useEffect(() => {
    if (!selectedEventId) {
      setEventDetail(null);
      setFullEvent(null);
      setDetailTab('detail');
      return;
    }
    const fetchAll = async () => {
      const [evRes, causalRes, fcRes, relRes] = await Promise.all([
        fetch(`/api/v1/m35/events/${selectedEventId}`),
        fetch(`/api/v1/m35/events/${selectedEventId}/causality`),
        fetch(`/api/v1/m35/events/${selectedEventId}/forecast`),
        fetch(`/api/v1/m35/events/${selectedEventId}/related`),
      ]);
      if (evRes.ok) {
        const evData = await evRes.json();
        const raw = evData.event ?? evData;

        let forecastStatus: FullEventRecord['forecastStatus'] = null;
        let forecastSummary: string | null = null;
        let proFormaLinked = false;

        if (fcRes.ok) {
          const fcData = await fcRes.json();
          const fc = fcData.forecast ?? fcData;
          if (fc?.actuals && Array.isArray(fc.actuals) && fc.actuals.length > 0) {
            const statuses: string[] = fc.actuals.map((a: { statusLabel: string }) => a.statusLabel).filter(Boolean);
            const aheadCount  = statuses.filter(s => s === 'ahead').length;
            const behindCount = statuses.filter(s => s === 'behind').length;
            if (aheadCount > behindCount) forecastStatus = 'ahead';
            else if (behindCount > aheadCount) forecastStatus = 'behind';
            else if (statuses.length > 0) forecastStatus = 'on_pace';
            const diverged = fc.actuals.filter((a: { divergencePct: number | null }) => a.divergencePct != null && Math.abs(a.divergencePct) > 0.10);
            if (diverged.length > 0) {
              const d = diverged[0];
              forecastSummary = `${d.metricKey ?? 'Metric'} divergence: ${d.divergencePct > 0 ? '+' : ''}${(d.divergencePct * 100).toFixed(1)}% vs forecast`;
            }
          }
          if (fc?.playbookStatus && fc.playbookStatus !== 'preliminary') {
            proFormaLinked = true;
          }
        }

        let relatedEvents: RelatedEventRef[] = [];
        if (relRes.ok) {
          const relData = await relRes.json();
          relatedEvents = (relData.items ?? []).map((r: {
            id: string; name: string; category: string; relationship: string;
          }) => ({ id: r.id, name: r.name, category: r.category, relationship: r.relationship }));
        }

        setFullEvent({
          id:                  raw.id,
          name:                raw.name,
          category:            raw.category,
          status:              raw.status,
          scope:               raw.scope,
          magnitudeScore:      raw.magnitudeScore ?? 2,
          confidence:          raw.confidence ?? 0.5,
          announcedDate:       raw.announcedDate ?? null,
          materializationDate: raw.materializationDate ?? null,
          description:         raw.description ?? null,
          submarket:           raw.submarketName ?? null,
          msaId:               raw.msaId ?? null,
          connectorSource:     raw.ingestionSource ?? raw.sourceUrl ?? null,
          proFormaLinked,
          forecastStatus,
          forecastSummary,
          playbookName:        raw.subtype ?? null,
          relatedEvents,
        });
      }
      if (causalRes.ok) {
        setEventDetail(await causalRes.json());
      }
    };
    fetchAll();
  }, [selectedEventId]);

  useEffect(() => {
    if (!fullEvent?.playbookName) { setPlaybookDetail(null); return; }
    fetch(`/api/v1/m35/playbooks/${encodeURIComponent(fullEvent.playbookName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.playbook) return;
        const p = d.playbook;
        setPlaybookDetail({
          instanceCount: p.instanceCount ?? 0,
          confidence: p.confidence ?? 0,
          status: p.status ?? 'preliminary',
          lagStructure: p.lagStructure ?? null,
        });
      })
      .catch(() => {});
  }, [fullEvent?.playbookName]);

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
          <div style={{ width: 1, height: 32, background: BT.border.subtle }} />
          <button
            onClick={() => navigate('/playbooks')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, ...mono,
              padding: '4px 10px', background: `${BT.accent.blue}18`, border: `1px solid ${BT.accent.blue}44`,
              color: BT.accent.blue, cursor: 'pointer',
            }}
          >
            PLAYBOOKS <ArrowUpRight size={9} />
          </button>
        </div>
      </div>

      {/* ── Event Density Strip ───────────────────────────────────────────────── */}
      <div style={{ ...terminalStyles.card, padding: '8px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em', marginBottom: 5 }}>
          EVENT DENSITY TIMELINE
        </div>
        <EventDensityStrip msaId={msaId} height={20} />
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
            {pipelineSignal.pipelineEvents.slice(0, 3).map((ev: PipelineEvent, i: number) => (
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

        {/* Right: Event Detail Panel ─────────────────────────────────────────── */}
        {selectedEventId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Panel header with tabs + close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {(['detail', 'causality', 'forecast'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    style={{
                      padding: '4px 10px', fontSize: 9, fontWeight: 700, cursor: 'pointer',
                      fontFamily: "'JetBrains Mono','Fira Code',monospace",
                      background: detailTab === tab ? BT.accent.blue : BT.bg.elevated,
                      color: detailTab === tab ? '#0A0F14' : BT.text.muted,
                      border: `1px solid ${detailTab === tab ? BT.accent.blue : BT.border.subtle}`,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSelectedEventId(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.dim, fontSize: 12 }}
              >
                ✕
              </button>
            </div>

            {/* ── DETAIL tab — full event metadata ──────────────────────────── */}
            {detailTab === 'detail' && (() => {
              const liveEv = liveEvents.find(e => e.id === selectedEventId);
              const ev = fullEvent ?? liveEv;
              if (!ev) return (
                <div style={{ ...terminalStyles.card, padding: 24, textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
                  Loading event data…
                </div>
              );
              const catEmoji = CATEGORY_EMOJI[ev.category] || '📌';
              const statusColor =
                ev.status === 'active' || ev.status === 'materialized' ? '#10B981' :
                ev.status === 'announced' ? BT.accent.amber :
                ev.status === 'in_progress' ? BT.accent.blue :
                BT.text.muted;
              const fcStatus = fullEvent?.forecastStatus ?? null;
              const fcStatusColors: Record<string, string> = {
                ahead: '#10B981', behind: '#EF4444', on_pace: BT.accent.blue, no_data: BT.text.dim,
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Header card */}
                  <div style={{ ...terminalStyles.card, padding: '12px 16px', borderLeft: `3px solid ${statusColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{catEmoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: BT.text.primary, marginBottom: 4, lineHeight: 1.3 }}>
                          {ev.name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{
                            ...mono, fontSize: 8, fontWeight: 700, padding: '1px 5px',
                            color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}44`,
                          }}>
                            {ev.status.replace('_', ' ').toUpperCase()}
                          </span>
                          <span style={{ ...mono, fontSize: 8, color: BT.text.muted }}>
                            {ev.category.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span style={{ ...mono, fontSize: 8, color: BT.text.dim }}>
                            {ev.scope.toUpperCase()}
                          </span>
                          {(() => {
                            const isVerified = ev.status === 'active' || ev.status === 'in_progress' || ev.status === 'completed';
                            const vColor = isVerified ? '#10B981' : BT.accent.amber;
                            return (
                              <span style={{ ...mono, fontSize: 7, fontWeight: 700, padding: '1px 5px', color: vColor, background: `${vColor}18`, border: `1px solid ${vColor}44` }}>
                                {isVerified ? '✓ VERIFIED' : '◌ ANNOUNCED'}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ProForma attribution badge */}
                  {fullEvent?.proFormaLinked && (
                    <div style={{
                      padding: '6px 12px', background: `${BT.accent.blue}12`,
                      border: `1px solid ${BT.accent.blue}44`, borderLeft: `3px solid ${BT.accent.blue}`,
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 9,
                    }}>
                      <span style={{ ...mono, fontWeight: 700, color: BT.accent.blue }}>📊 PRO FORMA LINKED</span>
                      <span style={{ color: BT.text.muted }}>This event's forecast is integrated into deal-level underwriting</span>
                    </div>
                  )}

                  {/* Forecast verdict + Causality verdict side-by-side */}
                  {(fcStatus || eventDetail?.overallDirection) && (
                    <div style={{ display: 'grid', gridTemplateColumns: fcStatus && eventDetail?.overallDirection ? '1fr 1fr' : '1fr', gap: 6 }}>
                      {fcStatus && (
                        <div style={{
                          padding: '6px 10px', background: `${fcStatusColors[fcStatus] ?? BT.text.dim}12`,
                          border: `1px solid ${fcStatusColors[fcStatus] ?? BT.text.dim}44`,
                          borderLeft: `3px solid ${fcStatusColors[fcStatus] ?? BT.text.dim}`,
                        }}>
                          <div style={{ ...mono, fontSize: 7, color: BT.text.dim, marginBottom: 2 }}>FORECAST</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, ...mono, fontSize: 9 }}>
                            <span style={{ fontWeight: 700, color: fcStatusColors[fcStatus] }}>
                              {fcStatus.replace('_', ' ').toUpperCase()}
                            </span>
                            {fullEvent?.forecastSummary && (
                              <span style={{ color: BT.text.muted, fontSize: 8 }}>{fullEvent.forecastSummary}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {eventDetail?.overallDirection && (() => {
                        const dir = eventDetail.overallDirection as string;
                        const dirMeta = DIRECTION_META[dir as keyof typeof DIRECTION_META];
                        if (!dirMeta) return null;
                        return (
                          <div style={{
                            padding: '6px 10px', background: dirMeta.bg,
                            border: `1px solid ${dirMeta.color}44`,
                            borderLeft: `3px solid ${dirMeta.color}`,
                          }}>
                            <div style={{ ...mono, fontSize: 7, color: BT.text.dim, marginBottom: 2 }}>CAUSALITY</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, ...mono, fontSize: 9 }}>
                              <span style={{ fontWeight: 700, color: dirMeta.color }}>{dirMeta.shortLabel}</span>
                              {eventDetail.dominantLeadLagMonths && (
                                <span style={{ color: BT.text.muted, fontSize: 8 }}>lag {eventDetail.dominantLeadLagMonths}mo</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Key metrics grid */}
                  <div style={{ ...terminalStyles.card, padding: '10px 14px' }}>
                    <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: BT.text.dim, letterSpacing: '0.08em', marginBottom: 8 }}>
                      EVENT METADATA
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                      {[
                        { label: 'Magnitude', value: `${ev.magnitudeScore.toFixed(1)} / 5.0`, url: null },
                        { label: 'Confidence', value: `${Math.round(ev.confidence * 100)}%`, url: null },
                        { label: 'Announced', value: ev.announcedDate ? new Date(ev.announcedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—', url: null },
                        { label: 'Materialized', value: ev.materializationDate ? new Date(ev.materializationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending', url: null },
                        { label: 'Submarket', value: fullEvent?.submarket ?? '—', url: null },
                        { label: 'Source', value: fullEvent?.connectorSource ?? 'Manual', url: fullEvent?.connectorSource?.startsWith('http') ? fullEvent.connectorSource : null },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', flexDirection: 'column', padding: '3px 0', borderBottom: `1px solid ${BT.border.subtle}20` }}>
                          <span style={{ ...mono, fontSize: 8, color: BT.text.dim }}>{row.label}</span>
                          {row.url ? (
                            <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ ...mono, fontSize: 10, color: BT.accent.blue, fontWeight: 600, textDecoration: 'none' }}>
                              {row.value} ↗
                            </a>
                          ) : (
                            <span style={{ ...mono, fontSize: 10, color: BT.text.secondary, fontWeight: 600 }}>{row.value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Playbook citation */}
                  {fullEvent?.playbookName && (
                    <div style={{ ...terminalStyles.card, padding: '10px 12px', borderLeft: `3px solid ${BT.accent.blue}` }}>
                      <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: BT.text.dim, marginBottom: 6, letterSpacing: '0.08em' }}>PLAYBOOK CITATION</div>
                      <div style={{ fontSize: 11, color: BT.text.primary, fontWeight: 700, marginBottom: 6 }}>
                        {fullEvent.playbookName.replace(/_/g, ' ').toUpperCase()}
                      </div>
                      {playbookDetail ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ ...mono, fontSize: 7, color: BT.text.dim }}>INSTANCES</span>
                              <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: BT.text.primary }}>{playbookDetail.instanceCount}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ ...mono, fontSize: 7, color: BT.text.dim }}>CONFIDENCE</span>
                              <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: playbookDetail.confidence >= 0.8 ? '#10B981' : playbookDetail.confidence >= 0.6 ? BT.accent.amber : '#EF4444' }}>
                                {Math.round(playbookDetail.confidence * 100)}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ ...mono, fontSize: 7, color: BT.text.dim }}>STATUS</span>
                              <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: playbookDetail.status === 'publishable' ? '#10B981' : BT.accent.amber }}>
                                {playbookDetail.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          {playbookDetail.lagStructure && Object.keys(playbookDetail.lagStructure).length > 0 && (
                            <div style={{ marginTop: 4, padding: '4px 8px', background: `${BT.accent.blue}10`, borderRadius: 2 }}>
                              <div style={{ ...mono, fontSize: 7, color: BT.text.dim, marginBottom: 2 }}>LAG STRUCTURE</div>
                              <div style={{ fontSize: 9, color: BT.text.secondary, ...mono }}>
                                Peak effect at T+{Object.keys(playbookDetail.lagStructure)[0] ?? '24'} months
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ ...mono, fontSize: 8, color: BT.text.dim }}>Loading playbook data...</div>
                      )}
                      <button
                        onClick={() => navigate('/playbooks')}
                        style={{ ...mono, fontSize: 8, color: BT.accent.blue, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: 8 }}
                      >
                        Open Playbook Library ↗
                      </button>
                    </div>
                  )}

                  {/* Description */}
                  {fullEvent?.description && (
                    <div style={{ ...terminalStyles.card, padding: '10px 14px' }}>
                      <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: BT.text.dim, letterSpacing: '0.08em', marginBottom: 6 }}>DESCRIPTION</div>
                      <div style={{ fontSize: 10, color: BT.text.secondary, lineHeight: 1.6 }}>{fullEvent.description}</div>
                    </div>
                  )}

                  {/* Related events */}
                  {fullEvent?.relatedEvents && fullEvent.relatedEvents.length > 0 && (
                    <div style={{ ...terminalStyles.card, padding: '10px 14px' }}>
                      <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: BT.text.dim, letterSpacing: '0.08em', marginBottom: 8 }}>
                        RELATED EVENTS ({fullEvent.relatedEvents.length})
                      </div>
                      {fullEvent.relatedEvents.map(rel => (
                        <div
                          key={rel.id}
                          onClick={() => setSelectedEventId(rel.id)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '5px 0', borderBottom: `1px solid ${BT.border.subtle}20`, cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 10 }}>{CATEGORY_EMOJI[rel.category] ?? '📌'}</span>
                            <span style={{ fontSize: 10, color: BT.text.secondary }}>{rel.name}</span>
                          </div>
                          <span style={{ ...mono, fontSize: 8, color: BT.text.muted }}>
                            {rel.relationship.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actual-vs-forecast chart embedded in DETAIL tab */}
                  <div style={{ ...terminalStyles.card, padding: 0, overflow: 'hidden', borderLeft: `3px solid ${BT.accent.blue}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: BT.text.dim, letterSpacing: '0.08em' }}>
                        ACTUAL vs FORECAST
                      </div>
                      <button
                        onClick={() => setDetailTab('forecast')}
                        style={{ ...mono, fontSize: 8, color: BT.accent.cyan, background: `${BT.accent.cyan}12`, border: `1px solid ${BT.accent.cyan}44`, padding: '2px 8px', cursor: 'pointer' }}
                      >
                        EXPAND →
                      </button>
                    </div>
                    <div style={{ maxHeight: 280, overflow: 'auto' }}>
                      <EventForecastPanel
                        eventId={selectedEventId!}
                        eventName={fullEvent?.name}
                      />
                    </div>
                  </div>

                  {/* Quick nav to full page */}
                  <button
                    onClick={() => navigate(`/events/${selectedEventId}`)}
                    style={{
                      ...mono, fontSize: 9, padding: '6px 12px', cursor: 'pointer',
                      background: `${BT.accent.blue}12`, color: BT.accent.blue,
                      border: `1px solid ${BT.accent.blue}44`,
                    }}
                  >
                    OPEN FULL EVENT PAGE ↗
                  </button>
                </div>
              );
            })()}

            {/* ── FORECAST tab ──────────────────────────────────────────────── */}
            {detailTab === 'forecast' && (
              <EventForecastPanel
                eventId={selectedEventId}
                eventName={liveEvents.find(e => e.id === selectedEventId)?.name}
              />
            )}

            {/* ── CAUSALITY tab ─────────────────────────────────────────────── */}
            {detailTab === 'causality' && !eventDetail && (
              <div style={{ ...terminalStyles.card, padding: 32, textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
                Loading causality analysis...
              </div>
            )}

            {detailTab === 'causality' && eventDetail && (
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

                      {/* Lead-lag sweep bar */}
                      <div style={{ position: 'relative', height: 28, background: BT.bg.elevated, marginBottom: 8 }}>
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: BT.border.subtle }} />
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

                <button
                  onClick={async () => {
                    setEventDetail(null);
                    const res = await fetch(`/api/v1/m35/events/${selectedEventId}/causality`, { method: 'POST' });
                    if (res.ok) setEventDetail(await res.json() as EventCausalityDetail);
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
