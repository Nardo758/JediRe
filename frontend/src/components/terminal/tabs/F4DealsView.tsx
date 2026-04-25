/**
 * F4DealsView — Cross-market Deal Pipeline & Opportunities
 * Shows all active deals across a user's tracked markets in one place.
 * Kanban pipeline + opportunity matrix, filterable by market/class/stage.
 */

import React, { useState, useMemo, useEffect } from 'react';

  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'comp_analysis', dealId }
  );
import { BT } from '../theme';
import { scoreColor, QUADRANT_STYLES, Quadrant } from '../signalGroups';
import { useOpportunityStore } from '../../../stores/opportunityStore';
import { ContextIndicator } from '../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };

const C = {
  bg:      BT.bg.terminal,
  panel:   BT.bg.panel,
  elevated: BT.bg.elevated,
  card:    BT.bg.card,
  hover:   BT.bg.active,
  primary: BT.text.primary,
  secondary: BT.text.secondary,
  muted:   BT.text.muted,
  dim:     BT.text.dim,
  amber:   BT.text.amber,
  green:   BT.text.green,
  red:     BT.accent.red,
  cyan:    BT.text.cyan,
  blue:    BT.text.blue,
  borderS: BT.border.subtle,
  borderM: BT.border.medium,
};

// ── Types ──────────────────────────────────────────────────────────────────

interface DealCard {
  id: string;
  name: string;
  market: string;
  marketId: string;
  submarket: string;
  units: number;
  class: string;
  jedi: number;
  stage: Stage;
  daysInStage: number;
  seller?: string;
  askPrice?: string;
  capRate?: string;
  omVariance?: string;
}

type Stage = 'INTAKE' | 'SCREENING' | 'ANALYSIS' | 'EXECUTION';
const ALL_STAGES: Stage[] = ['INTAKE', 'SCREENING', 'ANALYSIS', 'EXECUTION'];

const STAGE_META: Record<Stage, { color: string; bg: string; order: number }> = {
  INTAKE:    { color: '#6b7280', bg: 'rgba(107,114,128,0.18)', order: 0 },
  SCREENING: { color: '#3b82f6', bg: 'rgba(59,130,246,0.18)',  order: 1 },
  ANALYSIS:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.18)',  order: 2 },
  EXECUTION: { color: '#22c55e', bg: 'rgba(34,197,94,0.18)',   order: 3 },
};

const ALL_QUADRANTS: Quadrant[] = ['Hidden Gem', 'Validated Winner', 'Hype Risk', 'Dead Weight'];

// ── Mock cross-market data ─────────────────────────────────────────────────

const ALL_DEALS: DealCard[] = [
  // Atlanta
  { id: 'd1',  name: 'Midtown 440',          market: 'Atlanta, GA',      marketId: 'atlanta-ga',      submarket: 'Midtown',       units: 220, class: 'A-',  jedi: 74, stage: 'INTAKE',    daysInStage: 3,  seller: 'Greystone Capital',   askPrice: '$52M',   capRate: '5.1%' },
  { id: 'd2',  name: 'Buckhead Place',        market: 'Atlanta, GA',      marketId: 'atlanta-ga',      submarket: 'Buckhead',      units: 180, class: 'B+',  jedi: 71, stage: 'INTAKE',    daysInStage: 5 },
  { id: 'd3',  name: 'Westside Lofts',        market: 'Atlanta, GA',      marketId: 'atlanta-ga',      submarket: 'Westside',      units: 96,  class: 'B',   jedi: 68, stage: 'INTAKE',    daysInStage: 1 },
  { id: 'd4',  name: 'Peachtree Walk',        market: 'Atlanta, GA',      marketId: 'atlanta-ga',      submarket: 'Midtown',       units: 310, class: 'B+',  jedi: 82, stage: 'SCREENING', daysInStage: 12, seller: 'Cortland Partners',   askPrice: '$58M',   capRate: '5.0%' },
  { id: 'd5',  name: 'Heritage Oaks',         market: 'Atlanta, GA',      marketId: 'atlanta-ga',      submarket: 'Decatur',       units: 280, class: 'B',   jedi: 85, stage: 'ANALYSIS',  daysInStage: 22, omVariance: '-8.2%', askPrice: '$42M', capRate: '5.4%' },
  { id: 'd6',  name: 'Summit Creek',          market: 'Atlanta, GA',      marketId: 'atlanta-ga',      submarket: 'Sandy Springs', units: 196, class: 'B+',  jedi: 88, stage: 'EXECUTION', daysInStage: 45, askPrice: '$38M', capRate: '4.9%' },
  // Raleigh
  { id: 'd7',  name: 'North Hills Commons',   market: 'Raleigh, NC',      marketId: 'raleigh-nc',      submarket: 'North Hills',   units: 240, class: 'B+',  jedi: 84, stage: 'INTAKE',    daysInStage: 2 },
  { id: 'd8',  name: 'Brier Creek Flats',     market: 'Raleigh, NC',      marketId: 'raleigh-nc',      submarket: 'Brier Creek',   units: 180, class: 'B',   jedi: 79, stage: 'SCREENING', daysInStage: 9,  seller: 'Trammell Crow', askPrice: '$28M', capRate: '5.3%' },
  { id: 'd9',  name: 'Wake Forest View',      market: 'Raleigh, NC',      marketId: 'raleigh-nc',      submarket: 'Wake Forest',   units: 320, class: 'A',   jedi: 87, stage: 'ANALYSIS',  daysInStage: 31, omVariance: '+2.4%', askPrice: '$76M' },
  // Tampa
  { id: 'd10', name: 'Ybor Flats',            market: 'Tampa, FL',        marketId: 'tampa-fl',        submarket: 'Ybor City',     units: 156, class: 'B',   jedi: 78, stage: 'INTAKE',    daysInStage: 4 },
  { id: 'd11', name: 'Westchase Reserve',     market: 'Tampa, FL',        marketId: 'tampa-fl',        submarket: 'Westchase',     units: 288, class: 'B+',  jedi: 80, stage: 'SCREENING', daysInStage: 15, seller: 'Starwood Capital', askPrice: '$45M' },
  // Charlotte
  { id: 'd12', name: 'South End Studios',     market: 'Charlotte, NC',    marketId: 'charlotte-nc',    submarket: 'South End',     units: 200, class: 'A-',  jedi: 83, stage: 'INTAKE',    daysInStage: 6 },
  { id: 'd13', name: 'Dilworth Manor',        market: 'Charlotte, NC',    marketId: 'charlotte-nc',    submarket: 'Dilworth',      units: 164, class: 'B',   jedi: 77, stage: 'EXECUTION', daysInStage: 38, askPrice: '$22M', capRate: '5.5%' },
];

const TRACKED_MARKETS = [...new Set(ALL_DEALS.map(d => d.market))];

function deriveQuadrant(jedi: number, units: number): Quadrant {
  const highMarket = jedi >= 80;
  const highProp = units >= 200;
  if (highMarket && !highProp) return 'Hidden Gem';
  if (highMarket && highProp) return 'Validated Winner';
  if (!highMarket && highProp) return 'Hype Risk';
  return 'Dead Weight';
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  onSelectDeal?: (dealId: string) => void;
}

export const F4DealsView: React.FC<Props> = ({ onSelectDeal }) => {
  const [marketFilter, setMarketFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState<Stage | 'All'>('All');
  const [classFilter, setClassFilter] = useState('All');
  const [activeQuadrants, setActiveQuadrants] = useState<Set<Quadrant>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const toggleQuadrant = (q: Quadrant) => {
    setActiveQuadrants(prev => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  };

  const allClasses = ['All', 'A', 'A-', 'B+', 'B', 'B-', 'C+'];

  const filtered = useMemo(() => {
    return ALL_DEALS.filter(d => {
      if (marketFilter !== 'All' && d.market !== marketFilter) return false;
      if (stageFilter !== 'All' && d.stage !== stageFilter) return false;
      if (classFilter !== 'All' && d.class !== classFilter) return false;
      if (activeQuadrants.size > 0 && !activeQuadrants.has(deriveQuadrant(d.jedi, d.units))) return false;
      return true;
    });
  }, [marketFilter, stageFilter, classFilter, activeQuadrants]);

  // KPIs
  const kpis = useMemo(() => ({
    total: ALL_DEALS.length,
    inAnalysis: ALL_DEALS.filter(d => d.stage === 'ANALYSIS').length,
    inExecution: ALL_DEALS.filter(d => d.stage === 'EXECUTION').length,
    marketCount: TRACKED_MARKETS.length,
    avgJedi: Math.round(ALL_DEALS.reduce((s, d) => s + d.jedi, 0) / ALL_DEALS.length),
  }), []);

  // Quadrant counts (from filtered deals)
  const quadrantCounts = useMemo(() => {
    const counts: Record<Quadrant, number> = { 'Hidden Gem': 0, 'Validated Winner': 0, 'Hype Risk': 0, 'Dead Weight': 0 };
    filtered.forEach(d => { counts[deriveQuadrant(d.jedi, d.units)]++; });
    return counts;
  }, [filtered]);

  const Chip: React.FC<{ label: string; active: boolean; color?: string; onClick: () => void }> = ({ label, active, color, onClick }) => (
    <button
      onClick={onClick}
      style={{
        ...mono, padding: '3px 10px', fontSize: 9, cursor: 'pointer', letterSpacing: '0.05em',
        background: active ? (color ? `${color}22` : C.hover) : 'transparent',
        color: active ? (color || C.amber) : C.secondary,
        border: `1px solid ${active ? (color || C.amber) : C.borderM}`,
        borderRadius: 2, fontWeight: active ? 700 : 400, transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg, color: C.primary }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}

      {/* ── KPI Strip ── */}
      <div style={{ display: 'flex', gap: 1, background: C.borderS, flexShrink: 0 }}>
        {[
          { label: 'TOTAL PIPELINE',  value: kpis.total,       color: C.primary },
          { label: 'IN ANALYSIS',     value: kpis.inAnalysis,   color: STAGE_META.ANALYSIS.color },
          { label: 'IN EXECUTION',    value: kpis.inExecution,  color: STAGE_META.EXECUTION.color },
          { label: 'MARKETS',         value: kpis.marketCount,  color: C.cyan },
          { label: 'AVG JEDI',        value: kpis.avgJedi,      color: kpis.avgJedi >= 80 ? C.green : C.amber },
        ].map(kpi => (
          <div key={kpi.label} style={{ flex: 1, padding: '8px 14px', background: C.panel, textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: '0.1em', marginBottom: 3 }}>{kpi.label}</div>
            <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', background: C.panel, borderBottom: `1px solid ${C.borderS}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ ...mono, fontSize: 9, color: C.muted }}>MARKET</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Chip label="All" active={marketFilter === 'All'} onClick={() => setMarketFilter('All')} />
          {TRACKED_MARKETS.map(m => (
            <Chip key={m} label={m.split(',')[0]} active={marketFilter === m} onClick={() => setMarketFilter(m)} />
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: C.borderM }} />
        <span style={{ ...mono, fontSize: 9, color: C.muted }}>STAGE</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Chip label="All" active={stageFilter === 'All'} onClick={() => setStageFilter('All')} />
          {ALL_STAGES.map(s => (
            <Chip key={s} label={s} color={STAGE_META[s].color} active={stageFilter === s} onClick={() => setStageFilter(s)} />
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: C.borderM }} />
        <span style={{ ...mono, fontSize: 9, color: C.muted }}>CLASS</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {allClasses.map(c => (
            <Chip key={c} label={c} active={classFilter === c} onClick={() => setClassFilter(c)} />
          ))}
        </div>

        <div style={{ marginLeft: 'auto', ...mono, fontSize: 9, color: C.muted }}>
          {filtered.length} deals
        </div>
      </div>

      {/* ── Quadrant Filter ── */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 12px', background: C.panel, borderBottom: `1px solid ${C.borderS}`, flexShrink: 0 }}>
        <span style={{ ...mono, fontSize: 9, color: C.muted, marginRight: 4, alignSelf: 'center' }}>QUADRANT</span>
        {ALL_QUADRANTS.map(q => {
          const qs = QUADRANT_STYLES[q];
          const isActive = activeQuadrants.has(q);
          return (
            <button key={q} onClick={() => toggleQuadrant(q)} style={{
              ...mono, fontSize: 9, padding: '3px 10px', cursor: 'pointer', fontWeight: isActive ? 700 : 400,
              background: isActive ? qs.btBg : 'transparent',
              color: isActive ? qs.btText : C.secondary,
              border: `1px solid ${isActive ? qs.btText : C.borderM}`,
              borderRadius: 2, transition: 'all 0.1s',
            }}>
              {q} ({quadrantCounts[q]})
            </button>
          );
        })}
        {activeQuadrants.size > 0 && (
          <button onClick={() => setActiveQuadrants(new Set())} style={{
            ...mono, fontSize: 9, padding: '3px 10px', cursor: 'pointer',
            background: 'transparent', color: C.muted, border: `1px dashed ${C.borderM}`, borderRadius: 2,
          }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Kanban ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ display: 'flex', gap: 10, minHeight: '100%', alignItems: 'flex-start' }}>
          {ALL_STAGES.map(stage => {
            const meta = STAGE_META[stage];
            const stageDeals = filtered.filter(d => d.stage === stage);
            return (
              <div key={stage} style={{ flex: '1 1 0', minWidth: 200, background: C.panel, border: `1px solid ${C.borderS}` }}>
                {/* Column Header */}
                <div style={{ padding: '8px 12px', background: meta.bg, borderBottom: `2px solid ${meta.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: '0.08em' }}>{stage}</span>
                  <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: meta.color, background: 'rgba(255,255,255,0.1)', padding: '1px 7px' }}>
                    {stageDeals.length}
                  </span>
                </div>

                {/* Deal Cards */}
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stageDeals.length === 0 ? (
                    <div style={{ ...mono, fontSize: 9, color: C.dim, textAlign: 'center', padding: '16px 0' }}>No deals</div>
                  ) : (
                    stageDeals.map(deal => {
                      const jediColor = scoreColor(deal.jedi);
                      const isHovered = hoveredId === deal.id;
                      const q = deriveQuadrant(deal.jedi, deal.units);
                      const qs = QUADRANT_STYLES[q];
                      return (
                        <div
                          key={deal.id}
                          onClick={() => onSelectDeal?.(deal.id)}
                          onMouseEnter={() => setHoveredId(deal.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          style={{
                            padding: '10px 12px',
                            background: isHovered ? C.hover : C.card,
                            border: `1px solid ${isHovered ? meta.color : C.borderS}`,
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                          }}
                        >
                          {/* Market tag */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <span style={{ ...mono, fontSize: 8, padding: '1px 5px', background: `${C.cyan}18`, color: C.cyan, fontWeight: 600 }}>
                              {deal.market.split(',')[0].toUpperCase()}
                            </span>
                            <span style={{ ...mono, fontSize: 8, padding: '1px 5px', background: qs.btBg, color: qs.btText }}>
                              {q}
                            </span>
                          </div>

                          {/* Deal name */}
                          <div style={{ ...mono, fontSize: 11, fontWeight: 600, color: C.primary, marginBottom: 4 }}>
                            {deal.name}
                          </div>

                          {/* Submarket + class */}
                          <div style={{ ...mono, fontSize: 9, color: C.muted, marginBottom: 5 }}>
                            {deal.submarket} · Class {deal.class} · {deal.units}u
                          </div>

                          {/* Scores row */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: jediColor.btText }}>
                              JEDI {deal.jedi}
                            </span>
                            {deal.askPrice && (
                              <span style={{ ...mono, fontSize: 9, color: C.green }}>{deal.askPrice}</span>
                            )}
                            {deal.capRate && (
                              <span style={{ ...mono, fontSize: 9, color: C.cyan }}>{deal.capRate}</span>
                            )}
                          </div>

                          {/* Footer */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ ...mono, fontSize: 8, color: C.dim }}>{deal.daysInStage}d in stage</span>
                            {deal.omVariance && (
                              <span style={{ ...mono, fontSize: 8, fontWeight: 700, color: deal.omVariance.startsWith('-') ? C.red : C.green }}>
                                OM {deal.omVariance}
                              </span>
                            )}
                            {deal.seller && (
                              <span style={{ ...mono, fontSize: 8, color: C.secondary }}>{deal.seller}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default F4DealsView;
