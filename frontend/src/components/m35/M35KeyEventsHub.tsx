/**
 * M35KeyEventsHub — context-aware key events panel
 * Three variants:
 *   'portfolio' — events affecting your pipeline deals (DealsPage)
 *   'markets'   — events affecting tracked MSAs (F4MarketsView)
 *   'capsule'   — events affecting this specific deal (CapsuleDetailPage)
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ArrowRight, Activity, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

export type HubVariant = 'portfolio' | 'markets' | 'capsule';

type StatusFilter = 'ALL' | 'FIRED' | 'PENDING' | 'STAGED' | 'WATCH';

const SCOPE_COLORS: Record<string, string> = {
  MSA: '#6B7280',
  Submarket: '#0891B2',
  State: '#A855F7',
  National: '#64748B',
};

const STATUS_COLORS: Record<string, string> = {
  FIRED: '#10B981',
  PENDING: '#F59E0B',
  STAGED: '#0891B2',
  WATCH: '#EF4444',
  TRACKING: '#10B981',
};

// ── Portfolio events ─────────────────────────────────────────────────────────
const PORTFOLIO_EVENTS = [
  {
    id: 'pev-1', name: 'Amazon HQ2 Tampa', category: 'EMPLOYMENT', scope: 'MSA', status: 'FIRED',
    affectedDeals: 4, affectedNames: ['3820 W Kennedy', '1005 DT Meridian', 'Ybor Lofts', 'Channel Dist.'],
    portfolioIRR: '+1.8pp', rentDelta: '+3.2pp', elapsed: 'T+8MO', tracking: 'AHEAD', forecast: '+2.1% actual vs +1.3% fcst',
    playbook: 'MF Value-Add › Employment Anchor',
  },
  {
    id: 'pev-2', name: 'FL Insurance Rate Cap', category: 'REGULATORY', scope: 'State', status: 'PENDING',
    affectedDeals: 7, affectedNames: ['All FL assets'],
    portfolioIRR: '+0.4pp proj', rentDelta: '−4% expense', elapsed: 'T−2MO', tracking: null, forecast: null,
    playbook: 'Portfolio-wide expense tailwind',
  },
  {
    id: 'pev-3', name: 'Tampa BRT Phase 2', category: 'INFRASTRUCTURE', scope: 'Submarket', status: 'PENDING',
    affectedDeals: 2, affectedNames: ['3820 W Kennedy', '1005 DT Meridian'],
    portfolioIRR: '+0.6pp proj', rentDelta: '+$85/unit', elapsed: 'T−4MO', tracking: null, forecast: null,
    playbook: 'Transit proximity premium',
  },
  {
    id: 'pev-4', name: 'Westshore Supply Wave', category: 'SUPPLY', scope: 'Submarket', status: 'WATCH',
    affectedDeals: 3, affectedNames: ['3820 W Kennedy', 'Channel Dist.', 'Bayshore Apts'],
    portfolioIRR: '−0.4pp', rentDelta: '−0.3pp', elapsed: 'T+6MO', tracking: 'BEHIND', forecast: null,
    playbook: 'Supply headwind — absorption watch',
  },
  {
    id: 'pev-5', name: 'Atlanta BeltLine Rezoning', category: 'REGULATORY', scope: 'Submarket', status: 'STAGED',
    affectedDeals: 1, affectedNames: ['Westside Lofts ATL'],
    portfolioIRR: '+0.9pp proj', rentDelta: '+1.1pp proj', elapsed: 'conf 72%', tracking: null, forecast: null,
    playbook: 'Regulatory density uplift',
  },
];

// ── Markets events ────────────────────────────────────────────────────────────
const MARKETS_EVENTS = [
  {
    id: 'mev-1', name: 'Amazon HQ2 Tampa', category: 'EMPLOYMENT', msa: 'TPA', msaName: 'Tampa, FL', scope: 'MSA', status: 'FIRED',
    rentDelta: '+3.2pp', absorptionDelta: '+4.8pp', vacancyDelta: '−1.1pp', timing: 'T+8MO',
    trackedDeals: 4, jediImpact: '+5pts', detail: 'Amazon selecting Westshore submarket as primary campus site. 25K jobs confirmed Q4 2024.',
  },
  {
    id: 'mev-2', name: 'Atlanta BeltLine Rezoning', category: 'REGULATORY', msa: 'ATL', msaName: 'Atlanta, GA', scope: 'Submarket', status: 'PENDING',
    rentDelta: '+1.1pp proj', absorptionDelta: '+2.1pp proj', vacancyDelta: '−0.6pp proj', timing: 'T−2MO',
    trackedDeals: 1, jediImpact: '+3pts', detail: 'City council approved Tier 2 rezoning along NW BeltLine corridor. +15 du/acre density.',
  },
  {
    id: 'mev-3', name: 'Raleigh Apple Campus', category: 'EMPLOYMENT', msa: 'RDU', msaName: 'Raleigh, NC', scope: 'MSA', status: 'STAGED',
    rentDelta: '+2.8pp proj', absorptionDelta: '+3.6pp proj', vacancyDelta: '−1.4pp proj', timing: 'conf 74%',
    trackedDeals: 2, jediImpact: '+7pts proj', detail: 'Sources indicate Apple selecting Research Triangle for 3K-person engineering campus.',
  },
  {
    id: 'mev-4', name: 'Chicago Supply Oversupply', category: 'SUPPLY', msa: 'CHI', msaName: 'Chicago, IL', scope: 'MSA', status: 'WATCH',
    rentDelta: '−0.8pp', absorptionDelta: '−1.2pp', vacancyDelta: '+0.9pp', timing: 'T+3MO',
    trackedDeals: 0, jediImpact: '−4pts', detail: '12,000 units delivered in 2024. Absorption lagging by 34%. Vacancy rising.',
  },
  {
    id: 'mev-5', name: 'FL Insurance Reform', category: 'REGULATORY', msa: 'FL', msaName: 'All Florida MSAs', scope: 'State', status: 'PENDING',
    rentDelta: 'Neutral', absorptionDelta: 'Neutral', vacancyDelta: 'Neutral', timing: 'T−2MO',
    trackedDeals: 7, jediImpact: 'Expense −4%', detail: 'Senate bill SB 2D rate cap reform. Reduces property insurance premiums for MF assets.',
  },
];

// ── Capsule events ────────────────────────────────────────────────────────────
const CAPSULE_EVENTS = [
  {
    id: 'cev-1', name: 'Amazon HQ2 Tampa', category: 'EMPLOYMENT', scope: 'MSA', status: 'FIRED',
    proximity: 0.74, proxNote: '2.1mi from campus', irrImpact: '+1.8pp by Y2', rentImpact: '+1.4pp at T+12',
    elapsed: 'T+8MO', tracking: 'AHEAD', trackNote: '+0.8pp above playbook median', conf: '87%',
    playbook: 'MF Value-Add › Employment Anchor · 3 analogs · median +22% search lift',
    forecastStatus: 'AHEAD — actual +2.1% vs +1.3% forecast',
  },
  {
    id: 'cev-2', name: 'Tampa BRT Phase 2', category: 'INFRASTRUCTURE', scope: 'Submarket', status: 'PENDING',
    proximity: 0.94, proxNote: 'adjacent corridor', irrImpact: '+0.6pp proj', rentImpact: '+$85/unit at Y2',
    elapsed: 'T−4MO', tracking: null, trackNote: null, conf: '71%',
    playbook: 'Transit proximity premium · Route within 0.4mi',
    forecastStatus: null,
  },
  {
    id: 'cev-3', name: 'FL Insurance Rate Cap', category: 'REGULATORY', scope: 'State', status: 'PENDING',
    proximity: null, proxNote: 'state-wide', irrImpact: '+0.3pp proj', rentImpact: '−4% expense vs baseline',
    elapsed: 'T−2MO', tracking: null, trackNote: null, conf: '85%',
    playbook: 'FL SB 2D — insurance expense tailwind for all FL MF assets',
    forecastStatus: null,
  },
  {
    id: 'cev-4', name: 'Westshore Supply Wave', category: 'SUPPLY', scope: 'Submarket', status: 'WATCH',
    proximity: 0.61, proxNote: '1,200 units in pipeline', irrImpact: '−0.4pp', rentImpact: '−0.3pp',
    elapsed: 'T+6MO', tracking: 'BEHIND', trackNote: '1.4pp below absorption forecast', conf: '92%',
    playbook: 'Supply headwind — absorption tracking below model',
    forecastStatus: 'BEHIND — absorption −1.4pp vs forecast',
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: string }) {
  const color = SCOPE_COLORS[scope] ?? '#6B7A8D';
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 2, padding: '1px 5px', letterSpacing: '0.04em', whiteSpace: 'nowrap' as const }}>
      {scope.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#6B7A8D';
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 2, padding: '2px 6px', letterSpacing: '0.06em', whiteSpace: 'nowrap' as const }}>
      {status}
    </span>
  );
}

function ImpactVal({ val }: { val: string }) {
  const color = val.startsWith('+') ? '#10B981' : val.startsWith('−') || val.startsWith('-') ? '#EF4444' : '#A0ABBE';
  return <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color }}>{val}</span>;
}

function CatBadge({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    EMPLOYMENT: '#0891B2', REGULATORY: '#A855F7', INFRASTRUCTURE: '#F59E0B',
    SUPPLY: '#EF4444', DEMAND: '#10B981',
  };
  const color = map[cat] ?? '#6B7A8D';
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 8, color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 2, padding: '1px 4px', letterSpacing: '0.05em', whiteSpace: 'nowrap' as const }}>
      {cat}
    </span>
  );
}

// ── Portfolio Hub ─────────────────────────────────────────────────────────────

function PortfolioHub({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = filter === 'ALL' ? PORTFOLIO_EVENTS : PORTFOLIO_EVENTS.filter(e => e.status === filter);
  const firedCount = PORTFOLIO_EVENTS.filter(e => e.status === 'FIRED').length;
  const pendingCount = PORTFOLIO_EVENTS.filter(e => e.status === 'PENDING').length;
  const watchCount = PORTFOLIO_EVENTS.filter(e => e.status === 'WATCH').length;
  const totalDeals = new Set(PORTFOLIO_EVENTS.flatMap(e => e.affectedNames)).size;

  return (
    <div style={{ borderTop: '1px solid #1E2538', flexShrink: 0 }}>
      {/* Header / toggle bar */}
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#0F1320', border: 'none', cursor: 'pointer', textAlign: 'left' as const, borderBottom: isCollapsed ? 'none' : '1px solid #1E2538' }}
      >
        <Activity size={12} color="#0891B2" />
        <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#0891B2', letterSpacing: '0.08em' }}>
          ⚡ KEY EVENTS — YOUR PORTFOLIO
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', background: '#10B98118', border: '1px solid #10B98140', borderRadius: 2, color: '#10B981' }}>{firedCount} FIRED</span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', background: '#F59E0B18', border: '1px solid #F59E0B40', borderRadius: 2, color: '#F59E0B' }}>{pendingCount} PENDING</span>
        {watchCount > 0 && <span style={{ fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', background: '#EF444418', border: '1px solid #EF444440', borderRadius: 2, color: '#EF4444' }}>{watchCount} WATCH</span>}
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6B7A8D', marginLeft: 4 }}>{totalDeals} deals exposed · Net IRR: <span style={{ color: '#10B981' }}>+2.7pp</span></span>
        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, color: '#6B7A8D' }}>{isCollapsed ? '▼ EXPAND' : '▲ COLLAPSE'}</span>
      </button>

      {!isCollapsed && (
        <div style={{ background: '#0B0E1A', maxHeight: 340, overflowY: 'auto' as const }}>
          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 14px', borderBottom: '1px solid #1E253820', background: '#0F1320' }}>
            {(['ALL', 'FIRED', 'PENDING', 'STAGED', 'WATCH'] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', border: 'none', background: filter === f ? '#1E2538' : 'transparent', color: filter === f ? '#E2E8F0' : '#6B7A8D', letterSpacing: '0.05em' }}
              >
                {f}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, color: '#6B7A8D' }}>
              Most Exposed: <span style={{ color: '#F59E0B' }}>3820 W Kennedy</span> · 3 events · +1.8pp IRR
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#0d1120' }}>
                {['Event', 'Category', 'Scope', 'Status', 'Deals', 'Portfolio IRR Δ', 'Rent Δ', 'Elapsed'].map(h => (
                  <th key={h} style={{ fontFamily: 'monospace', textAlign: 'left' as const, padding: '5px 12px', color: '#6B7A8D', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', borderBottom: '1px solid #1E2538' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((ev, i) => (
                <React.Fragment key={ev.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    style={{ background: expandedId === ev.id ? '#0891B210' : i % 2 === 0 ? '#0B0E1A' : '#0d1120', borderTop: '1px solid #1E253820', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 12px', color: '#E2E8F0', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {expandedId === ev.id ? <ChevronDown size={10} color="#6B7A8D" /> : <ChevronRight size={10} color="#6B7A8D" />}
                        {ev.name}
                      </div>
                    </td>
                    <td style={{ padding: '6px 12px' }}><CatBadge cat={ev.category} /></td>
                    <td style={{ padding: '6px 12px' }}><ScopeBadge scope={ev.scope} /></td>
                    <td style={{ padding: '6px 12px' }}><StatusBadge status={ev.status} /></td>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#0891B2', fontWeight: 700 }}>{ev.affectedDeals}</td>
                    <td style={{ padding: '6px 12px' }}><ImpactVal val={ev.portfolioIRR} /></td>
                    <td style={{ padding: '6px 12px' }}><ImpactVal val={ev.rentDelta} /></td>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#6B7A8D', fontSize: 10 }}>{ev.elapsed}</td>
                  </tr>
                  {expandedId === ev.id && (
                    <tr style={{ background: '#0891B208' }}>
                      <td colSpan={8} style={{ padding: '8px 32px 10px', borderBottom: '1px solid #1E253840' }}>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const, fontSize: 10 }}>
                          <div>
                            <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 3 }}>AFFECTED DEALS</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                              {ev.affectedNames.map(n => (
                                <span key={n} style={{ fontFamily: 'monospace', color: '#E2E8F0', background: '#1E2538', padding: '1px 6px', borderRadius: 2, fontSize: 9 }}>{n}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 3 }}>PLAYBOOK</div>
                            <span style={{ color: '#0891B2', fontSize: 10 }}>{ev.playbook}</span>
                          </div>
                          {ev.tracking && (
                            <div>
                              <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 3 }}>TRACKING</div>
                              <span style={{ color: ev.tracking === 'AHEAD' ? '#10B981' : '#EF4444', fontWeight: 700, fontFamily: 'monospace', fontSize: 10 }}>{ev.tracking}</span>
                              {ev.forecast && <span style={{ color: '#A0ABBE', fontSize: 9, marginLeft: 8 }}>{ev.forecast}</span>}
                            </div>
                          )}
                          <div style={{ marginLeft: 'auto' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#0891B2', cursor: 'pointer', textDecoration: 'underline' }}>View Event Detail →</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '5px 14px', borderTop: '1px solid #1E2538', background: '#0F1320' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6B7A8D' }}>NEXT:</span>
            {[
              { name: 'FL Insurance Reform', timing: '~2mo', color: '#10B981' },
              { name: 'BRT Phase 2', timing: '~4mo', color: '#F59E0B' },
              { name: 'Apple Campus (RDU)', timing: '~8mo', color: '#0891B2' },
            ].map(m => (
              <span key={m.name} style={{ fontFamily: 'monospace', fontSize: 9, color: '#A0ABBE' }}>
                <span style={{ color: m.color }}>◆</span> {m.name} <span style={{ color: '#6B7A8D' }}>({m.timing})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Markets Hub ───────────────────────────────────────────────────────────────

function MarketsHub({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) {
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = filter === 'ALL' ? MARKETS_EVENTS : MARKETS_EVENTS.filter(e => e.status === filter);

  return (
    <div style={{ borderBottom: '1px solid #1E2538', flexShrink: 0 }}>
      {/* Compact strip — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#0F1320', overflowX: 'auto' as const }}>
        <button
          onClick={onToggle}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderRight: '1px solid #1E2538', flexShrink: 0 }}
        >
          <Activity size={11} color="#0891B2" />
          <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: '#0891B2', letterSpacing: '0.08em', whiteSpace: 'nowrap' as const }}>⚡ KEY EVENTS</span>
          {isExpanded ? <ChevronUp size={10} color="#6B7A8D" /> : <ChevronDown size={10} color="#6B7A8D" />}
        </button>

        {/* Scrolling pill strip */}
        {!isExpanded && MARKETS_EVENTS.map((ev, i) => {
          const statusColor = STATUS_COLORS[ev.status] ?? '#6B7A8D';
          const scopeColor = SCOPE_COLORS[ev.scope] ?? '#6B7A8D';
          const metricColor = ev.rentDelta.startsWith('+') ? '#10B981' : ev.rentDelta.startsWith('−') ? '#EF4444' : '#A0ABBE';
          return (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRight: '1px solid #1E253850', cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, color: '#A0ABBE', background: '#1E2538', padding: '1px 4px', borderRadius: 1 }}>{ev.msa}</span>
              <span style={{ fontSize: 10, color: '#E2E8F0' }}>{ev.name}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, color: statusColor, background: `${statusColor}15`, padding: '1px 4px', borderRadius: 1 }}>{ev.status}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: metricColor }}>{ev.rentDelta}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#6B7A8D' }}>{ev.timing}</span>
            </div>
          );
        })}

        <div style={{ marginLeft: 'auto', padding: '5px 12px', flexShrink: 0 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#6B7A8D' }}>{MARKETS_EVENTS.length} events across tracked markets</span>
        </div>
      </div>

      {/* Expanded hub panel */}
      {isExpanded && (
        <div style={{ background: '#0B0E1A' }}>
          {/* Filter row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderBottom: '1px solid #1E253820', background: '#0d1120' }}>
            {(['ALL', 'FIRED', 'PENDING', 'STAGED', 'WATCH'] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', border: 'none', background: filter === f ? '#1E2538' : 'transparent', color: filter === f ? '#E2E8F0' : '#6B7A8D' }}
              >
                {f}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, color: '#6B7A8D' }}>
              {visible.length} events · {MARKETS_EVENTS.filter(e => e.trackedDeals > 0).length} affect your tracked deals
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#0d1120' }}>
                {['Event', 'Category', 'MSA', 'Scope', 'Status', 'Rent Δ', 'Absorption Δ', 'Vacancy Δ', 'Timing', 'Your Deals'].map(h => (
                  <th key={h} style={{ fontFamily: 'monospace', textAlign: 'left' as const, padding: '5px 10px', color: '#6B7A8D', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', borderBottom: '1px solid #1E2538', whiteSpace: 'nowrap' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((ev, i) => (
                <React.Fragment key={ev.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    style={{ background: expandedId === ev.id ? '#0891B210' : i % 2 === 0 ? '#0B0E1A' : '#0d1120', borderTop: '1px solid #1E253820', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 10px', color: '#E2E8F0', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {expandedId === ev.id ? <ChevronDown size={10} color="#6B7A8D" /> : <ChevronRight size={10} color="#6B7A8D" />}
                        {ev.name}
                      </div>
                    </td>
                    <td style={{ padding: '6px 10px' }}><CatBadge cat={ev.category} /></td>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#A0ABBE', fontSize: 10, fontWeight: 700 }}>{ev.msa}</td>
                    <td style={{ padding: '6px 10px' }}><ScopeBadge scope={ev.scope} /></td>
                    <td style={{ padding: '6px 10px' }}><StatusBadge status={ev.status} /></td>
                    <td style={{ padding: '6px 10px' }}><ImpactVal val={ev.rentDelta} /></td>
                    <td style={{ padding: '6px 10px' }}><ImpactVal val={ev.absorptionDelta} /></td>
                    <td style={{ padding: '6px 10px' }}><ImpactVal val={ev.vacancyDelta} /></td>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#6B7A8D', fontSize: 10 }}>{ev.timing}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: ev.trackedDeals > 0 ? '#0891B2' : '#6B7A8D', fontWeight: 700, fontSize: 11 }}>
                      {ev.trackedDeals > 0 ? ev.trackedDeals : '—'}
                    </td>
                  </tr>
                  {expandedId === ev.id && (
                    <tr style={{ background: '#0891B208' }}>
                      <td colSpan={10} style={{ padding: '8px 28px 10px', borderBottom: '1px solid #1E253840' }}>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', fontSize: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 3 }}>MARKET CONTEXT</div>
                            <div style={{ color: '#A0ABBE' }}>{ev.detail}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 3 }}>JEDI IMPACT</div>
                            <ImpactVal val={ev.jediImpact} />
                          </div>
                          <div>
                            <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 3 }}>MSA FULL NAME</div>
                            <span style={{ color: '#E2E8F0', fontSize: 10 }}>{ev.msaName}</span>
                          </div>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#0891B2', cursor: 'pointer', textDecoration: 'underline' }}>View Event Detail →</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Capsule Hub ───────────────────────────────────────────────────────────────

function CapsuleHub() {
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>('cev-1');

  const visible = filter === 'ALL' ? CAPSULE_EVENTS : CAPSULE_EVENTS.filter(e => e.status === filter);
  const totalIRR = '+2.7pp';
  const firedCount = CAPSULE_EVENTS.filter(e => e.status === 'FIRED').length;
  const pendingCount = CAPSULE_EVENTS.filter(e => e.status === 'PENDING').length;
  const watchCount = CAPSULE_EVENTS.filter(e => e.status === 'WATCH').length;

  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#1E2538' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#131929', borderBottom: '1px solid #1E2538', borderLeft: '2px solid #0891B2' }}>
        <Activity size={13} color="#0891B2" />
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#0891B2', letterSpacing: '0.08em' }}>
          ⚡ KEY EVENTS — THIS DEAL
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', background: '#10B98118', border: '1px solid #10B98140', borderRadius: 2, color: '#10B981' }}>{firedCount} FIRED</span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', background: '#F59E0B18', border: '1px solid #F59E0B40', borderRadius: 2, color: '#F59E0B' }}>{pendingCount} PENDING</span>
        {watchCount > 0 && <span style={{ fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', background: '#EF444418', border: '1px solid #EF444440', borderRadius: 2, color: '#EF4444' }}>{watchCount} WATCH</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#A0ABBE' }}>
            Net IRR from events: <span style={{ color: '#10B981', fontWeight: 700 }}>{totalIRR}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 9, color: '#EF4444', background: '#EF444410', border: '1px solid #EF444430', borderRadius: 2, padding: '2px 6px' }}>
            <AlertTriangle size={10} /> SENSITIVITY: HIGH
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: '#0d1120', borderBottom: '1px solid #1E253820' }}>
        {(['ALL', 'FIRED', 'PENDING', 'STAGED', 'WATCH'] as StatusFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', border: 'none', background: filter === f ? '#1E2538' : 'transparent', color: filter === f ? '#E2E8F0' : '#6B7A8D' }}
          >
            {f}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, color: '#6B7A8D' }}>
          Sorted by proximity · <span style={{ color: '#0891B2' }}>Westshore submarket</span>
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, background: '#0B0E1A' }}>
        <thead>
          <tr style={{ background: '#0d1120' }}>
            {['Event', 'Category', 'Scope', 'Status', 'Proximity', 'IRR Impact', 'Rent Impact', 'Elapsed'].map(h => (
              <th key={h} style={{ fontFamily: 'monospace', textAlign: 'left' as const, padding: '6px 12px', color: '#6B7A8D', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', borderBottom: '1px solid #1E2538', whiteSpace: 'nowrap' as const }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((ev, i) => (
            <React.Fragment key={ev.id}>
              <tr
                onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                style={{ background: expandedId === ev.id ? '#0891B210' : i % 2 === 0 ? '#0B0E1A' : '#0d1120', borderTop: '1px solid #1E253820', cursor: 'pointer' }}
              >
                <td style={{ padding: '7px 12px', color: '#E2E8F0', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {expandedId === ev.id ? <ChevronDown size={10} color="#6B7A8D" /> : <ChevronRight size={10} color="#6B7A8D" />}
                    {ev.name}
                  </div>
                </td>
                <td style={{ padding: '7px 12px' }}><CatBadge cat={ev.category} /></td>
                <td style={{ padding: '7px 12px' }}><ScopeBadge scope={ev.scope} /></td>
                <td style={{ padding: '7px 12px' }}><StatusBadge status={ev.status} /></td>
                <td style={{ padding: '7px 12px' }}>
                  {ev.proximity ? (
                    <div>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: ev.proximity >= 0.7 ? '#10B981' : ev.proximity >= 0.5 ? '#0891B2' : '#A0ABBE', fontSize: 12 }}>
                        {ev.proximity.toFixed(2)}
                      </span>
                      <span style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, marginLeft: 5 }}>{ev.proxNote}</span>
                    </div>
                  ) : (
                    <span style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9 }}>{ev.proxNote}</span>
                  )}
                </td>
                <td style={{ padding: '7px 12px' }}><ImpactVal val={ev.irrImpact} /></td>
                <td style={{ padding: '7px 12px' }}><ImpactVal val={ev.rentImpact} /></td>
                <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#6B7A8D', fontSize: 10 }}>{ev.elapsed}</td>
              </tr>
              {expandedId === ev.id && (
                <tr style={{ background: '#0891B208' }}>
                  <td colSpan={8} style={{ padding: '8px 32px 12px', borderBottom: '1px solid #1E253840' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 10 }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 4 }}>PLAYBOOK MATCH</div>
                        <div style={{ color: '#0891B2' }}>{ev.playbook}</div>
                      </div>
                      {ev.tracking && (
                        <div>
                          <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 4 }}>TRACKING vs FORECAST</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {ev.tracking === 'AHEAD' ? <CheckCircle size={11} color="#10B981" /> : <AlertTriangle size={11} color="#EF4444" />}
                            <span style={{ color: ev.tracking === 'AHEAD' ? '#10B981' : '#EF4444', fontWeight: 700, fontFamily: 'monospace' }}>{ev.tracking}</span>
                          </div>
                          {ev.forecastStatus && <div style={{ color: '#A0ABBE', fontSize: 9, marginTop: 3 }}>{ev.forecastStatus}</div>}
                          {ev.trackNote && <div style={{ color: '#A0ABBE', fontSize: 9 }}>{ev.trackNote}</div>}
                        </div>
                      )}
                      <div>
                        <div style={{ fontFamily: 'monospace', color: '#6B7A8D', fontSize: 9, fontWeight: 700, marginBottom: 4 }}>CONFIDENCE</div>
                        <div style={{ fontFamily: 'monospace', color: '#E2E8F0', fontWeight: 700, fontSize: 13 }}>{ev.conf}</div>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#0891B2', cursor: 'pointer', textDecoration: 'underline' }}>View Full Event →</span>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Footer summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px', background: '#131929', borderTop: '1px solid #1E2538' }}>
        <TrendingUp size={11} color="#10B981" />
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#A0ABBE' }}>
          Events drive <span style={{ color: '#10B981', fontWeight: 700 }}>42%</span> of projected IRR uplift
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6B7A8D' }}>·</span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#A0ABBE' }}>
          Highest proximity: <span style={{ color: '#E2E8F0' }}>BRT Phase 2</span> (0.94 — adjacent)
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, color: '#0891B2', cursor: 'pointer', textDecoration: 'underline' }}>
          View All Events for this MSA →
        </span>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface M35KeyEventsHubProps {
  variant: HubVariant;
  isCollapsed?: boolean;
  onToggle?: () => void;
  isExpanded?: boolean;
}

export const M35KeyEventsHub: React.FC<M35KeyEventsHubProps> = ({ variant, isCollapsed = true, onToggle, isExpanded = false }) => {
  if (variant === 'portfolio') {
    return <PortfolioHub isCollapsed={isCollapsed} onToggle={onToggle ?? (() => {})} />;
  }
  if (variant === 'markets') {
    return <MarketsHub isExpanded={isExpanded} onToggle={onToggle ?? (() => {})} />;
  }
  return <CapsuleHub />;
};
