/**
 * SubmarketEventsTab — M35 Event Impact view for a Submarket Terminal
 *
 * Shows active and pipeline events scoped to the submarket or parent MSA,
 * with EventDensityStrip, ForecastTracker (selected event), and
 * quick-links to the /events/:id detail page.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Activity, AlertTriangle } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { EventDensityStrip } from '../../../m35/EventDensityStrip';
import { ForecastTracker } from '../../../m35/ForecastTracker';
import type { SubmarketData } from '../../SubmarketTerminal';

const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono','Fira Code',monospace",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LiveEvent {
  id: string;
  name: string;
  category: string;
  scope: string;
  status: string;
  magnitudeScore: number;
  confidence: number;
  announcedDate: string | null;
  materializationDate: string | null;
}

// ─── Scope chip ───────────────────────────────────────────────────────────────

const SCOPE_COLORS: Record<string, string> = {
  msa: '#6B7280',
  submarket: '#0891B2',
  property: '#D97706',
};

function ScopeChip({ scope }: { scope: string }) {
  const color = SCOPE_COLORS[scope] ?? BT.text.muted;
  return (
    <span style={{
      padding: '1px 5px', fontSize: 8, ...mono,
      background: `${color}22`, border: `1px solid ${color}55`, color,
      borderRadius: 2, textTransform: 'uppercase', letterSpacing: 0.3,
    }}>
      {scope}
    </span>
  );
}

// ─── Magnitude bars ───────────────────────────────────────────────────────────

function MagBars({ value }: { value: number }) {
  const v = Math.round(Math.min(5, Math.max(1, value)));
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: 3, height: 3 + i * 2, background: i <= v ? BT.accent.blue : `${BT.text.muted}33`, borderRadius: 1 }} />
      ))}
    </div>
  );
}

// ─── Category emojis ──────────────────────────────────────────────────────────

const CAT_EMOJI: Record<string, string> = {
  employment: '💼', infrastructure: '🚆', supply: '🏗️',
  policy: '📜', demographic: '📊', macro: '📈',
  disaster: '🌀', regulatory: '📋',
};

// ─── Demo fallback ────────────────────────────────────────────────────────────

function demoEvents(submarketId: string): LiveEvent[] {
  return [
    {
      id: 'ev-demo-01', name: `Major Employment Expansion — ${submarketId}`, category: 'employment',
      scope: 'submarket', status: 'in_progress', magnitudeScore: 4, confidence: 0.82,
      announcedDate: '2024-07-01', materializationDate: '2026-03-01',
    },
    {
      id: 'ev-demo-02', name: 'BRT Corridor Opening', category: 'infrastructure',
      scope: 'submarket', status: 'announced', magnitudeScore: 3, confidence: 0.71,
      announcedDate: '2025-02-15', materializationDate: '2026-09-01',
    },
    {
      id: 'ev-demo-03', name: 'New Supply Delivery Wave', category: 'supply',
      scope: 'submarket', status: 'in_progress', magnitudeScore: 3, confidence: 0.68,
      announcedDate: '2025-10-01', materializationDate: '2026-06-01',
    },
    {
      id: 'ev-demo-04', name: 'Statewide Insurance Rate Shock', category: 'policy',
      scope: 'msa', status: 'announced', magnitudeScore: 2, confidence: 0.55,
      announcedDate: '2026-01-10', materializationDate: '2026-08-01',
    },
  ];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubmarketEventsTabProps {
  submarketId: string;
  submarket: SubmarketData;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const SubmarketEventsTab: React.FC<SubmarketEventsTabProps> = ({ submarketId, submarket }) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [selected, setSelected] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/v1/m35/events?submarketId=${encodeURIComponent(submarketId)}&limit=12`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => mounted && setEvents((d.items || d.events || []).slice(0, 10)))
      .catch(() => mounted && setEvents(demoEvents(submarket.name)))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [submarketId, submarket.name]);

  const statusColor = (s: string) =>
    s === 'materialized' || s === 'in_progress' ? BT.text.green :
    s === 'announced' ? BT.accent.amber :
    BT.text.muted;

  return (
    <div style={{ color: BT.text.primary, ...mono }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${BT.border.subtle}`, paddingBottom: 14, marginBottom: 18 }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle, marginBottom: 4 }}>
            {submarket.name.toUpperCase()} — EVENT IMPACT ENGINE
          </h2>
          <div style={{ fontSize: 10, color: BT.text.muted, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span>M35 Structured Events</span>
            <span style={{ color: BT.border.subtle }}>·</span>
            <span>Submarket Scope</span>
            <span style={{ color: BT.border.subtle }}>·</span>
            <span>Forecast Tracker</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>ACTIVE EVENTS</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: BT.accent.blue }}>{events.length}</div>
          </div>
        </div>
      </div>

      {/* EventDensityStrip */}
      <div style={{ ...terminalStyles.card, padding: '8px 12px', marginBottom: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em', marginBottom: 6 }}>EVENT DENSITY — TIMELINE</div>
        <EventDensityStrip msaId={submarketId} height={22} />
      </div>

      {/* Event list + optional forecast panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>

        {/* Left: event list */}
        <div>
          {loading ? (
            <div style={{ ...terminalStyles.card, padding: 32, textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
              <Activity size={18} color={BT.text.muted} style={{ display: 'block', margin: '0 auto 8px' }} />
              Loading events…
            </div>
          ) : events.length === 0 ? (
            <div style={{ ...terminalStyles.card, padding: 32, textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
              No active events for this submarket.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map(ev => {
                const isActive = selected?.id === ev.id;
                const sColor = statusColor(ev.status);
                const emoji = CAT_EMOJI[ev.category] ?? '📌';
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelected(isActive ? null : ev)}
                    style={{
                      ...terminalStyles.card,
                      padding: 0, cursor: 'pointer',
                      borderLeft: `3px solid ${sColor}`,
                      background: isActive ? BT.bg.active : BT.bg.card,
                      outline: isActive ? `1px solid ${BT.accent.blue}44` : 'none',
                    }}
                  >
                    <div style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: BT.bg.elevated, flexShrink: 0 }}>
                            {emoji}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12, color: BT.text.primary }}>{ev.name}</div>
                            <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 2, display: 'flex', gap: 8 }}>
                              <span style={{ color: sColor, textTransform: 'uppercase', fontWeight: 700 }}>{ev.status.replace(/_/g,' ')}</span>
                              <ScopeChip scope={ev.scope} />
                              {ev.announcedDate && (
                                <span>· {new Date(ev.announcedDate).toLocaleDateString('en-US',{month:'short',year:'numeric'})}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <MagBars value={ev.magnitudeScore} />
                          <span style={{ fontSize: 8, color: BT.text.muted }}>
                            Conf: <span style={{ color: ev.confidence >= 0.7 ? BT.text.green : ev.confidence >= 0.5 ? BT.accent.amber : BT.text.muted, fontWeight: 700 }}>
                              {(ev.confidence * 100).toFixed(0)}%
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{
                      borderTop: `1px solid ${BT.border.subtle}`,
                      padding: '6px 14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 8, color: BT.text.muted }}>
                        {isActive ? '▲ hide forecast' : '▼ show forecast'}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/events/${ev.id}`); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '3px 8px', fontSize: 8,
                          background: `${BT.accent.blue}18`, border: `1px solid ${BT.accent.blue}44`, color: BT.accent.blue,
                          cursor: 'pointer', ...mono,
                        }}
                      >
                        FULL DETAIL <ArrowUpRight size={8} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: ForecastTracker for selected event */}
        {selected && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em' }}>FORECAST TRACKER</div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.dim, fontSize: 12 }}
              >
                ✕
              </button>
            </div>

            {/* ForecastTracker component */}
            <div style={{ marginBottom: 12 }}>
              <ForecastTracker
                eventId={selected.id}
                eventName={selected.name}
                metric="rent_growth_yoy"
                height={180}
              />
            </div>

            {/* Confidence detail */}
            <div style={{ ...terminalStyles.card, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, marginBottom: 8 }}>EVENT METADATA</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                <div>
                  <div style={{ fontSize: 8, color: BT.text.muted }}>CATEGORY</div>
                  <div style={{ color: BT.text.secondary, textTransform: 'capitalize' }}>{selected.category}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: BT.text.muted }}>CONFIDENCE</div>
                  <div style={{ color: selected.confidence >= 0.7 ? BT.text.green : BT.accent.amber, fontWeight: 700 }}>
                    {(selected.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: BT.text.muted }}>ANNOUNCED</div>
                  <div style={{ color: BT.text.secondary }}>{selected.announcedDate ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: BT.text.muted }}>MATERIALIZE</div>
                  <div style={{ color: BT.text.secondary }}>{selected.materializationDate ?? '—'}</div>
                </div>
              </div>
            </div>

            {/* Navigate to full detail */}
            <button
              onClick={() => navigate(`/events/${selected.id}`)}
              style={{
                marginTop: 10, width: '100%', padding: '8px 0', fontSize: 10, fontWeight: 700,
                background: `${BT.accent.blue}18`, border: `1px solid ${BT.accent.blue}44`, color: BT.accent.blue,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...mono,
              }}
            >
              OPEN FULL EVENT DETAIL <ArrowUpRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
