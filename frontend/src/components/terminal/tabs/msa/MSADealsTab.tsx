/**
 * MSADealsTab - Deal pipeline and opportunity finder
 * Integrated from pre-Bloomberg DealsTab (35KB)
 * Features: Pipeline Kanban, Quadrant filter, Featured deals, Lifecycle phases
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { CardSection, DataTable } from '../../TerminalLayouts';
import {
  QUADRANT_STYLES,
  Quadrant,
  LIFECYCLE_STYLES,
  LifecyclePhase,
  TRAFFIC_QUAL_STYLES,
  TrafficQualification,
  scoreColor,
} from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary } from '../../commentary';

interface MSADealsTabProps {
  msaId: string;
  msa: any;
  onSelectDeal?: (dealId: string) => void;
}

// Movement indicator
type Movement = 'up' | 'down' | 'neutral';
const MOVEMENT_DISPLAY: Record<Movement, { arrow: string; color: string }> = {
  up: { arrow: '▲', color: '#22c55e' },
  down: { arrow: '▼', color: '#ef4444' },
  neutral: { arrow: '▬', color: '#6b7280' },
};

// Mock featured deal data
const FEATURED_DEAL = {
  rank: 1,
  name: 'PINES AT MIDTOWN',
  units: 180,
  year: 1992,
  class: 'B',
  submarket: 'Midtown',
  jedi: 92,
  strategy: 'Value-Add Flip',
  arbSpread: '+7.4%',
  lossToLease: '$220/unit',
  ltlPct: '14.8%',
  sellerMotivation: 78,
  holdYears: 6.9,
  walkIns: '1,840/week',
  captureRate: '12.4%',
  trafficShare: '8.2%',
  pcsRank: 3,
  pcsMovement: 'up' as Movement,
  pcsMovementDelta: 2,
  quadrant: 'Hidden Gem' as Quadrant,
  targetScore: 91,
  physicalScore: 76,
  digitalScore: 34,
  lifecyclePhase: 'Acceleration' as LifecyclePhase,
  trajectory: '+19.1%',
  tar: 1.28,
  trafficQualified: 'Qualified' as TrafficQualification,
  managementCompany: 'Peachtree Residential',
  managementPcsPercentile: 31,
  debtMaturity: 'Q3 2026',
  isTripleTrigger: true,
};

// Mock compact deals
const COMPACT_DEALS = [
  { rank: 2, name: 'BROOKHAVEN TERRACE', units: 240, year: 1998, class: 'B+', submarket: 'Brookhaven', jedi: 87, strategy: 'Core-Plus Hold', ltl: '$180/unit', walkIns: '2,100/wk', trafficShare: '6.8%', pcsRank: 7, pcsMovement: 'up' as Movement, pcsMovementDelta: 3, quadrant: 'Validated Winner' as Quadrant, lifecyclePhase: 'Maturation' as LifecyclePhase, trajectory: '+4.2%', trafficQualified: 'Qualified' as TrafficQualification, tar: 1.12 },
  { rank: 3, name: 'DECATUR STATION', units: 156, year: 1985, class: 'C+', submarket: 'Decatur', jedi: 84, strategy: 'Heavy Value-Add', ltl: '$290/unit', walkIns: '1,420/wk', trafficShare: '9.1%', pcsRank: 12, pcsMovement: 'down' as Movement, pcsMovementDelta: 4, quadrant: 'Hype Risk' as Quadrant, lifecyclePhase: 'Acceleration' as LifecyclePhase, trajectory: '-8.2%', trafficQualified: 'Marginal' as TrafficQualification, tar: 0.91 },
  { rank: 4, name: 'SANDY SPRINGS CROSSING', units: 312, year: 2001, class: 'B+', submarket: 'Sandy Springs', jedi: 81, strategy: 'Value-Add Flip', ltl: '$155/unit', walkIns: '2,680/wk', trafficShare: '5.4%', pcsRank: 15, pcsMovement: 'neutral' as Movement, pcsMovementDelta: 0, quadrant: 'Dead Weight' as Quadrant, lifecyclePhase: 'Contraction' as LifecyclePhase, trajectory: '-2.1%', trafficQualified: 'Disqualified' as TrafficQualification, tar: 0.74 },
  { rank: 5, name: 'EAST ATLANTA GARDENS', units: 128, year: 1988, class: 'B-', submarket: 'East Atlanta', jedi: 79, strategy: 'Value-Add Flip', ltl: '$245/unit', walkIns: '980/wk', trafficShare: '11.2%', pcsRank: 8, pcsMovement: 'up' as Movement, pcsMovementDelta: 5, quadrant: 'Hidden Gem' as Quadrant, lifecyclePhase: 'Emergence' as LifecyclePhase, trajectory: '+24.8%', trafficQualified: 'Qualified' as TrafficQualification, tar: 1.34 },
];

// Mock kanban pipeline
const KANBAN_COLUMNS = [
  {
    stage: 'INTAKE', count: 3, color: '#6b7280', headerBg: 'rgba(107,114,128,0.2)',
    deals: [
      { name: 'Midtown 440', units: 220, class: 'A-', jedi: 74, days: '3d' },
      { name: 'Buckhead Place', units: 180, class: 'B+', jedi: 71, days: '5d' },
      { name: 'Westside Lofts', units: 96, class: 'B', jedi: 68, days: '1d' },
    ],
  },
  {
    stage: 'SCREENING', count: 2, color: '#3b82f6', headerBg: 'rgba(59,130,246,0.2)',
    deals: [
      { name: 'Peachtree Walk', units: 310, class: 'B+', jedi: 82, days: '12d' },
      { name: 'Cascade Heights', units: 144, class: 'C+', jedi: 76, days: '8d' },
    ],
  },
  {
    stage: 'ANALYSIS', count: 1, color: '#f59e0b', headerBg: 'rgba(245,158,11,0.2)',
    deals: [
      { name: 'Heritage Oaks', units: 280, class: 'B', jedi: 85, days: '22d', omVariance: '-8.2%' },
    ],
  },
  {
    stage: 'EXECUTION', count: 1, color: '#22c55e', headerBg: 'rgba(34,197,94,0.2)',
    deals: [
      { name: 'Summit Creek', units: 196, class: 'B+', jedi: 88, days: '45d' },
    ],
  },
];

const ALL_QUADRANTS: Quadrant[] = ['Hidden Gem', 'Validated Winner', 'Hype Risk', 'Dead Weight'];

export const MSADealsTab: React.FC<MSADealsTabProps> = ({ msaId, msa, onSelectDeal }) => {
  const [activeQuadrants, setActiveQuadrants] = useState<Set<Quadrant>>(new Set());
  const [expandedPipeline, setExpandedPipeline] = useState(false);
  const [showPcsBreakdown, setShowPcsBreakdown] = useState(false);
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);

  const toggleQuadrant = (q: Quadrant) => {
    setActiveQuadrants(prev => {
      const next = new Set(prev);
      if (next.has(q)) {
        next.delete(q);
      } else {
        next.add(q);
      }
      return next;
    });
  };

  // Filter deals by quadrant
  const allDeals = [{ ...FEATURED_DEAL, isFeatured: true }, ...COMPACT_DEALS.map(d => ({ ...d, isFeatured: false }))];
  const filteredDeals = activeQuadrants.size === 0
    ? allDeals
    : allDeals.filter(d => activeQuadrants.has(d.quadrant));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Deal Pipeline & Opportunities
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            {allDeals.length} opportunities · {KANBAN_COLUMNS.reduce((sum, c) => sum + c.count, 0)} in pipeline
          </span>
        </div>
      </div>

      {/* Quadrant Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ALL_QUADRANTS.map(q => {
          const style = QUADRANT_STYLES[q];
          const isActive = activeQuadrants.has(q);
          return (
            <button
              key={q}
              onClick={() => toggleQuadrant(q)}
              style={{
                padding: '8px 16px',
                background: isActive ? style.btBg : BT.bg.elevated,
                color: isActive ? style.btText : BT.text.secondary,
                border: isActive ? `2px solid ${style.btText}` : `1px solid ${BT.border.subtle}`,
                borderRadius: 0,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {q}
            </button>
          );
        })}
        {activeQuadrants.size > 0 && (
          <button
            onClick={() => setActiveQuadrants(new Set())}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: BT.text.muted,
              border: `1px dashed ${BT.border.subtle}`,
              borderRadius: 0,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Pipeline Kanban */}
      <div style={{ ...terminalStyles.card, padding: 20 }}>
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setExpandedPipeline(!expandedPipeline)}
        >
          <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
            Deal Pipeline
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {KANBAN_COLUMNS.map(col => (
                <div key={col.stage} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4,
                  padding: '4px 8px',
                  background: col.headerBg,
                  borderRadius: 0,
                }}>
                  <span style={{ fontSize: 10, color: col.color, fontWeight: 600 }}>{col.stage}</span>
                  <span style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: col.color,
                    background: 'rgba(255,255,255,0.1)',
                    padding: '1px 6px',
                    borderRadius: 0,
                  }}>
                    {col.count}
                  </span>
                </div>
              ))}
            </div>
            <span style={{ color: BT.text.muted, fontSize: 12 }}>
              {expandedPipeline ? '▼' : '▶'}
            </span>
          </div>
        </div>

        {expandedPipeline && (
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginTop: 16,
            overflowX: 'auto',
            paddingBottom: 8,
          }}>
            {KANBAN_COLUMNS.map(col => (
              <div key={col.stage} style={{ 
                flex: '0 0 240px',
                background: BT.bg.elevated,
                borderRadius: 0,
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 12px',
                  background: col.headerBg,
                  borderBottom: `2px solid ${col.color}`,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: col.color }}>
                    {col.stage} ({col.count})
                  </span>
                </div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.deals.map((deal, i) => (
                    <div key={i} style={{
                      padding: 10,
                      background: BT.bg.card,
                      borderRadius: 0,
                      border: `1px solid ${BT.border.subtle}`,
                      cursor: 'pointer',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, marginBottom: 4 }}>
                        {deal.name}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: BT.text.muted }}>
                        <span>{deal.units} units</span>
                        <span>Class {deal.class}</span>
                        <span style={{ color: scoreColor(deal.jedi).btText }}>JEDI {deal.jedi}</span>
                      </div>
                      <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 4 }}>
                        {deal.days} in stage
                        {(deal as any).omVariance && (
                          <span style={{ marginLeft: 8, color: BT.accent.amber }}>
                            OM Var: {(deal as any).omVariance}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Featured Deal */}
      {filteredDeals.some(d => d.isFeatured) && (
        <div style={{ 
          ...terminalStyles.card, 
          padding: 20,
          borderLeft: `4px solid ${QUADRANT_STYLES[FEATURED_DEAL.quadrant].btText}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  padding: '2px 8px',
                  background: BT.accent.blue,
                  color: '#fff',
                  borderRadius: 0,
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  #1 OPPORTUNITY
                </span>
                <span style={{
                  padding: '4px 10px',
                  background: QUADRANT_STYLES[FEATURED_DEAL.quadrant].btBg,
                  color: QUADRANT_STYLES[FEATURED_DEAL.quadrant].btText,
                  borderRadius: 0,
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {FEATURED_DEAL.quadrant}
                </span>
                <span style={{
                  padding: '4px 10px',
                  background: LIFECYCLE_STYLES[FEATURED_DEAL.lifecyclePhase].btBg,
                  color: LIFECYCLE_STYLES[FEATURED_DEAL.lifecyclePhase].btText,
                  borderRadius: 0,
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {LIFECYCLE_STYLES[FEATURED_DEAL.lifecyclePhase].icon} {FEATURED_DEAL.lifecyclePhase}
                </span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: BT.text.primary, marginTop: 8 }}>
                {FEATURED_DEAL.name}
              </h3>
              <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12, color: BT.text.muted }}>
                <span>{FEATURED_DEAL.units} units</span>
                <span>Built {FEATURED_DEAL.year}</span>
                <span>Class {FEATURED_DEAL.class}</span>
                <span>{FEATURED_DEAL.submarket}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                color: scoreColor(FEATURED_DEAL.jedi).btText,
              }}>
                {FEATURED_DEAL.jedi}
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>JEDI Score</div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Arb Spread</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.green }}>{FEATURED_DEAL.arbSpread}</div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Loss-to-Lease</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>{FEATURED_DEAL.lossToLease}</div>
              <div style={{ fontSize: 10, color: BT.accent.amber }}>{FEATURED_DEAL.ltlPct}</div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Motivation</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: FEATURED_DEAL.sellerMotivation > 70 ? BT.text.green : BT.accent.amber }}>
                {FEATURED_DEAL.sellerMotivation}
              </div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Walk-Ins</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>{FEATURED_DEAL.walkIns}</div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Traffic Share</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.cyan }}>{FEATURED_DEAL.trafficShare}</div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>TAR</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: FEATURED_DEAL.tar > 1 ? BT.text.green : BT.accent.red }}>
                {FEATURED_DEAL.tar.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Triple Trigger Alert */}
          {FEATURED_DEAL.isTripleTrigger && (
            <div style={{
              padding: 12,
              background: 'rgba(34,197,94,0.1)',
              borderLeft: `3px solid ${BT.text.green}`,
              borderRadius: 0,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BT.text.green }}>
                ⚡ TRIPLE TRIGGER CANDIDATE
              </div>
              <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
                Hold period ({FEATURED_DEAL.holdYears}yr) + Debt maturity ({FEATURED_DEAL.debtMaturity}) + 
                High motivation ({FEATURED_DEAL.sellerMotivation}) = Off-market opportunity
              </div>
            </div>
          )}

          <button
            onClick={() => onSelectDeal?.('featured')}
            style={{
              padding: '12px 24px',
              background: BT.accent.blue,
              color: '#fff',
              border: 'none',
              borderRadius: 0,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View Full Analysis →
          </button>
        </div>
      )}

      {/* Compact Deal List */}
      <CardSection title="Opportunity Rankings">
        <DataTable>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center', width: 50 }}>#</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Property</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Quadrant</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Lifecycle</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>JEDI</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Loss-to-Lease</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Traffic</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>TAR</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeals.filter(d => !d.isFeatured).map((deal, i) => {
              const quadrantStyle = QUADRANT_STYLES[deal.quadrant];
              const lifecycleStyle = LIFECYCLE_STYLES[deal.lifecyclePhase];
              const trafficStyle = TRAFFIC_QUAL_STYLES[deal.trafficQualified];
              const movement = MOVEMENT_DISPLAY[deal.pcsMovement];
              
              return (
                <tr key={i} style={{ 
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  cursor: 'pointer',
                }}
                onClick={() => onSelectDeal?.(deal.name)}
                >
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center', fontWeight: 700 }}>
                    {deal.rank}
                  </td>
                  <td style={{ ...terminalStyles.tableCell }}>
                    <div style={{ fontWeight: 600 }}>{deal.name}</div>
                    <div style={{ fontSize: 10, color: BT.text.muted }}>
                      {deal.units} units · {deal.submarket} · Class {deal.class}
                    </div>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 8px',
                      background: quadrantStyle.btBg,
                      color: quadrantStyle.btText,
                      borderRadius: 0,
                      fontSize: 10,
                      fontWeight: 600,
                    }}>
                      {deal.quadrant}
                    </span>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 8px',
                      background: lifecycleStyle.btBg,
                      color: lifecycleStyle.btText,
                      borderRadius: 0,
                      fontSize: 10,
                      fontWeight: 600,
                    }}>
                      {lifecycleStyle.icon} {deal.lifecyclePhase}
                    </span>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: scoreColor(deal.jedi).btBg,
                      color: scoreColor(deal.jedi).btText,
                      borderRadius: 0,
                      fontSize: 12,
                      fontWeight: 700,
                    }}>
                      {deal.jedi}
                    </span>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontWeight: 600 }}>
                    {deal.ltl}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                    <span style={{ color: trafficStyle.btText }}>{trafficStyle.icon}</span>
                    <span style={{ marginLeft: 4 }}>{deal.walkIns}</span>
                  </td>
                  <td style={{ 
                    ...terminalStyles.tableCell, 
                    textAlign: 'right',
                    color: deal.tar > 1 ? BT.text.green : BT.accent.red,
                    fontWeight: 600,
                  }}>
                    {deal.tar.toFixed(2)}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <button style={{
                      padding: '4px 10px',
                      background: BT.accent.blue,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 0,
                      fontSize: 10,
                      cursor: 'pointer',
                    }}>
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </CardSection>

      {commentary?.signalCommentary?.momentum && (
        <div style={{ ...terminalStyles.card, padding: 16 }}>
          <SignalCommentary signalKey="momentum" commentary={commentary.signalCommentary.momentum} />
        </div>
      )}
    </div>
  );
};

export default MSADealsTab;
