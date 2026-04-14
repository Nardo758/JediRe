/**
 * PortfolioEventFeedPage — /portfolio/events
 * Shows M35 events affecting the user's owned portfolio assets.
 * Each event row: property name, event name, scope, magnitude, IRR delta estimate,
 * and quick-link to the Event Detail page.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { EventDensityStrip } from '../../components/m35/EventDensityStrip';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };
const BG = '#0B0E1A';
const PANEL = '#131929';
const BORDER = '#1E2538';
const TEXT = { primary: '#E2E8F0', muted: '#6B7A8D', sub: '#A0ABBE' };
const C = { green: '#10B981', cyan: '#0891B2', amber: '#D97706', red: '#EF4444' };
const SCOPE_COLORS: Record<string, string> = { msa: '#6B7280', submarket: '#0891B2', property: '#D97706' };

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioEventRow {
  eventId: string;
  eventName: string;
  category: string;
  scope: string;
  magnitude: 1 | 2 | 3 | 4 | 5;
  irrDelta: number;
  rentGrowthDelta: number;
  propertyId: string;
  propertyName: string;
  submarket: string;
  msa: string;
  status: 'AHEAD' | 'ON PACE' | 'BEHIND' | 'PRE-EVENT';
  triggerAt: string;
  peakAt: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_ROWS: PortfolioEventRow[] = [
  {
    eventId: 'ev-01', eventName: 'Amazon HQ2 — Tampa', category: 'employment', scope: 'submarket', magnitude: 4,
    irrDelta: 2.1, rentGrowthDelta: 2.4, propertyId: 'p-01', propertyName: 'Westshore Heights', submarket: 'Westshore', msa: 'Tampa', status: 'AHEAD', triggerAt: '2024-Q3', peakAt: '2026-Q2',
  },
  {
    eventId: 'ev-02', eventName: 'BRT Phase 1 — Denver', category: 'infrastructure', scope: 'submarket', magnitude: 3,
    irrDelta: 1.4, rentGrowthDelta: 1.8, propertyId: 'p-02', propertyName: 'LoDo Commons', submarket: 'Lower Downtown', msa: 'Denver', status: 'ON PACE', triggerAt: '2025-Q1', peakAt: '2026-Q4',
  },
  {
    eventId: 'ev-03', eventName: 'FL Insurance Rate Shock', category: 'policy', scope: 'msa', magnitude: 2,
    irrDelta: -0.8, rentGrowthDelta: -0.4, propertyId: 'p-01', propertyName: 'Westshore Heights', submarket: 'Westshore', msa: 'Tampa', status: 'PRE-EVENT', triggerAt: '2026-Q3', peakAt: '2027-Q1',
  },
  {
    eventId: 'ev-04', eventName: 'Midtown Upzone — Atlanta', category: 'policy', scope: 'submarket', magnitude: 2,
    irrDelta: 0.6, rentGrowthDelta: 0.8, propertyId: 'p-03', propertyName: 'Midtown Tower', submarket: 'Midtown', msa: 'Atlanta', status: 'ON PACE', triggerAt: '2025-Q4', peakAt: '2027-Q2',
  },
  {
    eventId: 'ev-05', eventName: 'Tesla Gigafactory — Austin', category: 'employment', scope: 'msa', magnitude: 5,
    irrDelta: 3.4, rentGrowthDelta: 4.2, propertyId: 'p-04', propertyName: 'East Austin Lofts', submarket: 'East Austin', msa: 'Austin', status: 'AHEAD', triggerAt: '2023-Q4', peakAt: '2025-Q3',
  },
  {
    eventId: 'ev-06', eventName: 'Supply Wave — Denver Q3', category: 'supply', scope: 'submarket', magnitude: 3,
    irrDelta: -1.1, rentGrowthDelta: -1.6, propertyId: 'p-02', propertyName: 'LoDo Commons', submarket: 'Lower Downtown', msa: 'Denver', status: 'BEHIND', triggerAt: '2026-Q1', peakAt: '2026-Q3',
  },
];

// ─── IRR delta badge ──────────────────────────────────────────────────────────

function IrrBadge({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {positive ? <TrendingUp size={12} color={C.green} /> : <TrendingDown size={12} color={C.red} />}
      <span style={{ fontSize: 11, fontWeight: 700, color: positive ? C.green : C.red, ...mono }}>
        {positive ? '+' : ''}{delta.toFixed(1)}pp
      </span>
    </div>
  );
}

// ─── Magnitude bars ───────────────────────────────────────────────────────────

function MagnitudeBars({ value }: { value: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: 4, height: 4 + i * 2,
            background: i <= value ? C.cyan : `${TEXT.muted}33`,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

// ─── Portfolio summary bar ────────────────────────────────────────────────────

function PortfolioSummary({ rows }: { rows: PortfolioEventRow[] }) {
  const active = rows.filter(r => r.status !== 'PRE-EVENT');
  const positiveIrr = rows.filter(r => r.irrDelta > 0).reduce((s, r) => s + r.irrDelta, 0);
  const negativeIrr = rows.filter(r => r.irrDelta < 0).reduce((s, r) => s + r.irrDelta, 0);
  const msas = Array.from(new Set(rows.map(r => r.msa)));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, marginBottom: 20 }}>
      {[
        { label: 'ACTIVE EVENTS', value: String(active.length), color: C.cyan },
        { label: 'PRE-EVENT', value: String(rows.filter(r => r.status === 'PRE-EVENT').length), color: TEXT.muted },
        { label: 'IRR TAILWINDS', value: `+${positiveIrr.toFixed(1)}pp`, color: C.green },
        { label: 'IRR HEADWINDS', value: `${negativeIrr.toFixed(1)}pp`, color: C.red },
        { label: 'IMPACTED MSAs', value: msas.join(', '), color: TEXT.sub },
      ].map(kpi => (
        <div key={kpi.label} style={{ padding: '12px 16px', background: PANEL, borderRight: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: TEXT.muted, ...mono, marginBottom: 4 }}>{kpi.label}</div>
          <div style={{ fontSize: kpi.label === 'IMPACTED MSAs' ? 9 : 18, fontWeight: 700, color: kpi.color, ...mono }}>{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PortfolioEventFeedPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PortfolioEventRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'ahead' | 'behind' | 'pre'>('all');
  const [sortKey, setSortKey] = useState<'irrDelta' | 'magnitude' | 'triggerAt'>('irrDelta');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/m35/portfolio/events');
      if (res.ok) { setRows(await res.json()); setLoading(false); return; }
    } catch {}
    setRows(DEMO_ROWS);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const STATUS_COLORS: Record<string, string> = {
    AHEAD: C.green, 'ON PACE': C.cyan, BEHIND: C.red, 'PRE-EVENT': TEXT.muted,
  };

  const filtered = rows
    .filter(r => {
      if (filter === 'ahead') return r.status === 'AHEAD' || r.status === 'ON PACE';
      if (filter === 'behind') return r.status === 'BEHIND';
      if (filter === 'pre') return r.status === 'PRE-EVENT';
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'irrDelta') return Math.abs(b.irrDelta) - Math.abs(a.irrDelta);
      if (sortKey === 'magnitude') return b.magnitude - a.magnitude;
      return b.triggerAt.localeCompare(a.triggerAt);
    });

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT.primary, padding: '20px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: TEXT.muted, background: 'none', border: 'none', cursor: 'pointer', ...mono }}
        >
          <ArrowLeft size={14} /> Portfolio / Event Feed
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT.primary, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              PORTFOLIO EVENT IMPACT FEED
            </h1>
            <div style={{ fontSize: 11, color: TEXT.muted, marginTop: 4, ...mono }}>
              M35 key events affecting owned assets · sorted by absolute IRR delta
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/playbooks')}
              style={{ padding: '6px 14px', fontSize: 9, background: `${C.cyan}18`, border: `1px solid ${C.cyan}44`, color: C.cyan, cursor: 'pointer', ...mono }}
            >
              PLAYBOOK LIBRARY
            </button>
          </div>
        </div>

        {/* KPI bar */}
        {!loading && <PortfolioSummary rows={rows} />}

        {/* Event density across MSAs */}
        <div style={{ border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ padding: '6px 12px', background: PANEL, borderBottom: `1px solid ${BORDER}`, fontSize: 9, fontWeight: 700, color: TEXT.muted, ...mono }}>
            EVENT DENSITY — PORTFOLIO MSAs
          </div>
          <div style={{ padding: '8px 12px' }}>
            <EventDensityStrip msaId="portfolio" height={24} />
          </div>
        </div>

        {/* Filter + sort controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {[
              { id: 'all', label: 'ALL EVENTS' },
              { id: 'ahead', label: 'AHEAD / ON PACE' },
              { id: 'behind', label: 'BEHIND' },
              { id: 'pre', label: 'PRE-EVENT' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as typeof filter)}
                style={{
                  padding: '4px 12px', fontSize: 9, fontWeight: 700, ...mono,
                  background: filter === f.id ? C.cyan : 'transparent',
                  border: `1px solid ${filter === f.id ? C.cyan : BORDER}`,
                  color: filter === f.id ? '#0B0E1A' : TEXT.muted, cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: TEXT.muted, ...mono }}>
            <span>SORT:</span>
            {[
              { id: 'irrDelta', label: 'IRR Δ' },
              { id: 'magnitude', label: 'MAGNITUDE' },
              { id: 'triggerAt', label: 'DATE' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setSortKey(s.id as typeof sortKey)}
                style={{
                  padding: '2px 8px', fontSize: 9, background: sortKey === s.id ? `${C.cyan}18` : 'transparent',
                  border: `1px solid ${sortKey === s.id ? C.cyan : BORDER}`, color: sortKey === s.id ? C.cyan : TEXT.muted, cursor: 'pointer', ...mono,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event feed table */}
        <div style={{ border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <div style={{ background: '#0B0E1A', borderBottom: `1px solid ${BORDER}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['PROPERTY', 'EVENT', 'SCOPE / MSA', 'MAGNITUDE', 'STATUS', 'IRR Δ', 'RENT GROWTH Δ', 'TRIGGER', 'PEAK', ''].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: TEXT.muted, ...mono, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', fontSize: 11, color: TEXT.muted, ...mono }}>
              <Activity size={20} color={TEXT.muted} style={{ display: 'block', margin: '0 auto 8px' }} />
              Loading portfolio events...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', fontSize: 11, color: TEXT.muted, ...mono }}>No events match the current filter</div>
          ) : (
            <div>
              {filtered.map((row, i) => {
                const statusColor = STATUS_COLORS[row.status] ?? TEXT.muted;
                const irrPositive = row.irrDelta >= 0;
                return (
                  <div
                    key={`${row.eventId}-${row.propertyId}`}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${BORDER}` : 'none' }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr style={{
                          background: 'transparent',
                          borderLeft: `3px solid ${irrPositive ? C.green : C.red}`,
                          transition: 'background 0.1s',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${C.cyan}06`)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Property */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: TEXT.primary }}>{row.propertyName}</div>
                            <div style={{ fontSize: 9, color: TEXT.muted, ...mono, marginTop: 1 }}>{row.submarket}</div>
                          </td>
                          {/* Event */}
                          <td style={{ padding: '10px 12px', maxWidth: 220 }}>
                            <div
                              onClick={() => navigate(`/events/${row.eventId}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div style={{ fontSize: 11, fontWeight: 600, color: TEXT.primary, marginBottom: 2 }}>{row.eventName}</div>
                              <span style={{ fontSize: 8, padding: '1px 6px', ...mono, borderRadius: 2, background: `${C.cyan}18`, border: `1px solid ${C.cyan}44`, color: C.cyan, textTransform: 'uppercase' }}>
                                {row.category}
                              </span>
                            </div>
                          </td>
                          {/* Scope / MSA */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                              <span style={{ fontSize: 8, padding: '1px 5px', background: `${SCOPE_COLORS[row.scope] ?? TEXT.muted}22`, border: `1px solid ${SCOPE_COLORS[row.scope] ?? TEXT.muted}55`, color: SCOPE_COLORS[row.scope] ?? TEXT.muted, ...mono, borderRadius: 2 }}>
                                {row.scope.toUpperCase()}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: TEXT.sub, ...mono }}>{row.msa}</div>
                          </td>
                          {/* Magnitude */}
                          <td style={{ padding: '10px 12px' }}>
                            <MagnitudeBars value={row.magnitude} />
                            <div style={{ fontSize: 8, color: TEXT.muted, ...mono, marginTop: 3 }}>Lvl {row.magnitude}/5</div>
                          </td>
                          {/* Status */}
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', background: `${statusColor}18`, border: `1px solid ${statusColor}55`, color: statusColor, ...mono }}>
                              {row.status}
                            </span>
                          </td>
                          {/* IRR delta */}
                          <td style={{ padding: '10px 12px' }}>
                            <IrrBadge delta={row.irrDelta} />
                          </td>
                          {/* Rent growth delta */}
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: row.rentGrowthDelta >= 0 ? C.green : C.red, ...mono }}>
                              {row.rentGrowthDelta >= 0 ? '+' : ''}{row.rentGrowthDelta.toFixed(1)}pp
                            </span>
                          </td>
                          {/* Trigger */}
                          <td style={{ padding: '10px 12px', fontSize: 10, color: TEXT.sub, ...mono }}>{row.triggerAt}</td>
                          {/* Peak */}
                          <td style={{ padding: '10px 12px', fontSize: 10, color: TEXT.muted, ...mono }}>{row.peakAt}</td>
                          {/* CTA */}
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              onClick={() => navigate(`/events/${row.eventId}`)}
                              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', fontSize: 9, background: `${C.cyan}18`, border: `1px solid ${C.cyan}44`, color: C.cyan, cursor: 'pointer', ...mono }}
                            >
                              DETAIL <ArrowUpRight size={9} />
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 24, marginTop: 12, padding: '8px 0', fontSize: 9, color: TEXT.muted, ...mono, borderTop: `1px solid ${BORDER}` }}>
          <span>{filtered.length} events shown</span>
          <span>Net IRR delta: <strong style={{ color: rows.reduce((s,r) => s+r.irrDelta, 0) >= 0 ? C.green : C.red }}>
            {rows.reduce((s,r) => s+r.irrDelta, 0) >= 0 ? '+' : ''}{rows.reduce((s,r) => s+r.irrDelta, 0).toFixed(1)}pp
          </strong></span>
          <span style={{ marginLeft: 'auto' }}>Last M35 run: 2026-04-14 03:00 UTC</span>
        </div>

      </div>
    </div>
  );
};

export default PortfolioEventFeedPage;
