/**
 * M35 EventTimelineSection — Deal Capsule "EVENT TIMELINE" module screen
 *
 * Shows EventTimelineChart for 4 deal metrics + EventCard list.
 * Fetches from GET /api/v1/m35/deals/:dealId/events-context.
 * Wired as Deal Capsule tab "events" (M35, F-key: F12).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BT } from '../bloomberg-ui';
import { EventTimelineChart } from '../../m35/EventTimelineChart';
import { EventCard, EventCardEvent } from '../../m35/EventCard';
import { EventDependencyModal, EventDependency } from '../../m35/EventDependencyModal';
import { Plus, RefreshCw, Zap } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventsContextResponse {
  events: any[];
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  sensitivityScore: number;
  concentration: {
    topEventName: string;
    irrShare: number;
    isConcentrated: boolean;
  } | null;
  inlineAttributions: Record<string, any[]>;
  totalActiveEvents: number;
}

interface EventTimelineSectionProps {
  dealId: string;
  deal?: any;
  dealType?: string;
  onUpdate?: () => void;
}

// ─── Metric config ────────────────────────────────────────────────────────────

const CHART_METRICS = [
  { key: 'rent_growth_yoy', label: 'Rent Growth YoY',  baseline: 3.2 },
  { key: 'cap_rate',        label: 'Cap Rate',          baseline: 5.2 },
  { key: 'absorption',      label: 'Net Absorption',    baseline: 280 },
  { key: 'permits',         label: 'Permit Activity',   baseline: 450 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rawToEventCard(ev: any): EventCardEvent {
  return {
    id:                ev.id,
    name:              ev.name,
    category:          ev.category || 'EMPLOYMENT',
    subtype:           ev.subtype,
    scope:             ev.scope || 'msa',
    status:            ev.status || 'announced',
    magnitudeScore:    Number(ev.magnitude_score ?? ev.magnitudeScore ?? 2),
    confidence:        Number(ev.confidence ?? 0.55),
    announcedDate:     ev.announced_date ?? ev.announcedDate,
    materializationDate: ev.materialization_date ?? ev.materializationDate,
    forecastSummary:   [],
    proximityScore:    ev.proximity_score ?? ev.proximityScore,
  };
}

function buildDependencies(events: any[]): EventDependency[] {
  return events
    .filter(ev => !['cancelled', 'reversed'].includes(ev.status))
    .map(ev => ({
      eventId:     ev.id,
      eventName:   ev.name,
      eventStatus: ev.status,
      confidence:  Number(ev.confidence ?? 0.55),
      drives:      CHART_METRICS.slice(0, 3).map(m => `${m.label} T+12`),
      scope:       ev.scope || 'msa',
      magnitudeScore: Number(ev.magnitude_score ?? ev.magnitudeScore ?? 2),
    }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventTimelineSection({ dealId, deal, dealType, onUpdate }: EventTimelineSectionProps) {
  const mono = BT.font.mono;

  const [ctx, setCtx] = useState<EventsContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState(CHART_METRICS[0].key);
  const [showDepModal, setShowDepModal] = useState(false);
  const [depContext, setDepContext] = useState<'proforma' | 'strategy'>('proforma');

  const token = localStorage.getItem('auth_token') || '';

  const fetchContext = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/m35/deals/${dealId}/events-context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setCtx(await res.json());
    } catch (e: any) {
      setError(e.message);
      setCtx({ events: [], sensitivity: 'LOW', sensitivityScore: 0, concentration: null, inlineAttributions: {}, totalActiveEvents: 0 });
    } finally {
      setLoading(false);
    }
  }, [dealId, token]);

  useEffect(() => { fetchContext(); }, [fetchContext]);

  const events = ctx?.events || [];
  const topEvent = selectedEventId
    ? events.find(e => e.id === selectedEventId)
    : events[0];

  const eventCards: EventCardEvent[] = events.map(rawToEventCard);
  const dependencies = buildDependencies(events);
  const selectedMetricCfg = CHART_METRICS.find(m => m.key === activeMetric) || CHART_METRICS[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BT.bg.terminal, overflow: 'hidden' }}>

      {/* Sub-header */}
      <div style={{
        padding: '6px 12px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={11} style={{ color: BT.text.amber }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.primary, fontFamily: mono, letterSpacing: 0.6 }}>
            M35 · EVENT TIMELINE
          </span>
          {ctx && (
            <span style={{
              fontSize: 8, color: BT.text.muted, fontFamily: mono,
              background: BT.bg.panelAlt, padding: '1px 6px',
            }}>
              {ctx.totalActiveEvents || events.length} ACTIVE
            </span>
          )}
          {ctx?.sensitivity && ctx.sensitivity !== 'LOW' && (
            <span style={{
              fontSize: 8, fontWeight: 700, fontFamily: mono,
              color: ctx.sensitivity === 'HIGH' ? BT.text.red : BT.text.amber,
              border: `1px solid ${ctx.sensitivity === 'HIGH' ? BT.text.red : BT.text.amber}44`,
              padding: '1px 6px',
            }}>
              {ctx.sensitivity} SENSITIVITY
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={fetchContext}
            disabled={loading}
            style={{ background: 'transparent', border: `1px solid ${BT.border.medium}`, cursor: 'pointer', padding: '2px 8px', color: BT.text.muted, fontFamily: mono, fontSize: 8, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw size={9} className={loading ? 'animate-spin' : ''} /> REFRESH
          </button>
          <button
            onClick={() => { setDepContext('proforma'); setShowDepModal(true); }}
            style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.medium}`, cursor: 'pointer', padding: '2px 8px', color: BT.text.secondary, fontFamily: mono, fontSize: 8, fontWeight: 700 }}
          >
            APPLY TO PRO FORMA
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: Chart panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 12 }}>

          {/* Metric selector tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 8, flexShrink: 0 }}>
            {CHART_METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                style={{
                  padding: '4px 10px',
                  fontFamily: mono,
                  fontSize: 8,
                  fontWeight: 700,
                  background: activeMetric === m.key ? BT.bg.active : BT.bg.panelAlt,
                  border: `1px solid ${activeMetric === m.key ? BT.text.cyan : BT.border.subtle}`,
                  color: activeMetric === m.key ? BT.text.cyan : BT.text.muted,
                  cursor: 'pointer',
                  letterSpacing: 0.4,
                }}
              >
                {m.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {loading && !ctx ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: BT.text.muted, fontFamily: mono, fontSize: 9 }}>
                Loading event data…
              </div>
            ) : error ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 9 }}>No event data available</span>
                <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 8 }}>Create events for this deal's MSA to see timeline projections</span>
              </div>
            ) : (
              <EventTimelineChart
                eventId={topEvent?.id}
                eventName={topEvent?.name || 'MSA Events'}
                eventCategory={topEvent?.category || 'EMPLOYMENT'}
                eventScope={topEvent?.scope || 'msa'}
                metric={activeMetric}
                baselineValue={selectedMetricCfg.baseline}
                height={280}
                onEventClick={setSelectedEventId}
              />
            )}
          </div>

          {/* Add event button */}
          <div style={{ marginTop: 8, flexShrink: 0 }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('m35:open-event-creator', { detail: { dealId } }))}
              style={{
                width: '100%',
                padding: '6px 12px',
                background: 'transparent',
                border: `1px dashed ${BT.border.medium}`,
                cursor: 'pointer',
                fontFamily: mono,
                fontSize: 8,
                color: BT.text.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <Plus size={10} /> ADD EVENT TO TIMELINE
            </button>
          </div>
        </div>

        {/* Right: Event list */}
        <div style={{
          width: 300,
          borderLeft: `1px solid ${BT.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <div style={{ padding: '7px 10px', borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, fontFamily: mono, letterSpacing: 0.6 }}>
              ACTIVE EVENTS · {eventCards.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {eventCards.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: BT.text.muted, fontFamily: mono, fontSize: 8 }}>
                No active events found for this deal's market area.
              </div>
            ) : (
              eventCards.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  style={{
                    cursor: 'pointer',
                    outline: selectedEventId === ev.id ? `1px solid ${BT.text.cyan}44` : 'none',
                  }}
                >
                  <EventCard
                    event={ev}
                    onViewDetails={setSelectedEventId}
                    compact={false}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* EventDependencyModal */}
      <EventDependencyModal
        isOpen={showDepModal}
        onClose={() => setShowDepModal(false)}
        onProceed={() => {
          setShowDepModal(false);
          onUpdate?.();
        }}
        onRunWithoutEvents={() => {
          setShowDepModal(false);
          onUpdate?.();
        }}
        onCustomize={() => setShowDepModal(false)}
        dependencies={dependencies}
        context={depContext}
      />
    </div>
  );
}
