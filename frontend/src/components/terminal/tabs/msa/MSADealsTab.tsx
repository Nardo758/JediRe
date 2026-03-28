import React, { useState, useMemo, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { CardSection, DataTable } from '../../TerminalLayouts';
import {
  QUADRANT_STYLES,
  Quadrant,
  scoreColor,
} from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { useOpportunityStore, OpportunityScore, OpportunitySignal } from '../../../../stores/opportunityStore';
import { SignalCommentary, InvestmentThesis } from '../../commentary';

interface MSADealsTabProps {
  msaId: string;
  msa: any;
  onSelectDeal?: (dealId: string) => void;
}

const SIGNAL_DIRECTION_COLORS: Record<string, { color: string; icon: string }> = {
  bullish: { color: '#22c55e', icon: '▲' },
  bearish: { color: '#ef4444', icon: '▼' },
  neutral: { color: '#6b7280', icon: '▬' },
};

const STRATEGY_DISPLAY: Record<string, { label: string; color: string }> = {
  renovate: { label: 'Renovate', color: '#f59e0b' },
  rebrand: { label: 'Rebrand', color: '#3b82f6' },
  reposition: { label: 'Reposition', color: '#a855f7' },
  acquire: { label: 'Acquire', color: '#22c55e' },
};

function deriveQuadrant(opp: OpportunityScore): Quadrant {
  const highMarket = opp.marketScore >= 60;
  const highProperty = opp.propertyScore >= 50;
  if (highMarket && !highProperty) return 'Hidden Gem';
  if (highMarket && highProperty) return 'Validated Winner';
  if (!highMarket && highProperty) return 'Hype Risk';
  return 'Dead Weight';
}

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
  const msaName = msa?.name || msaId || 'Atlanta';
  const city = msa?.city || msa?.name || 'Atlanta';

  const { fetchCommentary, getCommentary, isLoading: isCommentaryLoading, getError: getCommentaryError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const commentaryLoading = isCommentaryLoading('msa', msaId);
  const commentaryError = getCommentaryError('msa', msaId);

  const { fetchOpportunities, getOpportunities, isLoading: isOppLoading, getError: getOppError, hasFetched: hasOppFetched } = useOpportunityStore();
  const oppData = getOpportunities(city);
  const oppLoading = isOppLoading(city);
  const oppError = getOppError(city);
  const oppFetched = hasOppFetched(city);

  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);
  useEffect(() => { fetchOpportunities(city); }, [city]);

  const opportunities = oppData?.opportunities || [];
  const marketSummary = oppData?.marketSummary;
  const featured = opportunities.length > 0 ? opportunities[0] : null;
  const remainingOpps = opportunities.slice(1);

  const allOppsWithQuadrant = useMemo(() => {
    return opportunities.map(opp => ({
      ...opp,
      quadrant: deriveQuadrant(opp),
    }));
  }, [opportunities]);

  const filteredOpps = useMemo(() => {
    if (activeQuadrants.size === 0) return allOppsWithQuadrant;
    return allOppsWithQuadrant.filter(o => activeQuadrants.has(o.quadrant));
  }, [allOppsWithQuadrant, activeQuadrants]);

  const featuredOpp = filteredOpps.length > 0 ? filteredOpps[0] : null;
  const listOpps = filteredOpps.slice(1);

  const toggleQuadrant = (q: Quadrant) => {
    setActiveQuadrants(prev => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };

  const renderSignalBadge = (signal: OpportunitySignal) => {
    const dir = SIGNAL_DIRECTION_COLORS[signal.direction];
    return (
      <span
        key={`${signal.type}-${signal.label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          background: `${dir.color}15`,
          border: `1px solid ${dir.color}30`,
          fontSize: 10,
          color: dir.color,
          fontWeight: 600,
          marginRight: 4,
          marginBottom: 4,
        }}
      >
        {dir.icon} {signal.label}: {signal.value}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Deal Pipeline & Opportunities
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            {oppLoading ? 'Loading opportunities...' : (
              <>
                {opportunities.length} opportunities
                {marketSummary ? ` · Avg upside ${marketSummary.avgUpsidePercent}%` : ''}
                {' · '}{KANBAN_COLUMNS.reduce((sum, c) => sum + c.count, 0)} in pipeline
              </>
            )}
          </span>
        </div>
        {marketSummary && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: BT.text.muted }}>MARKET SCORE</div>
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              color: scoreColor(marketSummary.avgMarketScore).btText,
            }}>
              {marketSummary.avgMarketScore}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ALL_QUADRANTS.map(q => {
          const style = QUADRANT_STYLES[q];
          const isActive = activeQuadrants.has(q);
          const count = allOppsWithQuadrant.filter(o => o.quadrant === q).length;
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
              {q} ({count})
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

      {oppLoading && (
        <div style={{ ...terminalStyles.card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: BT.accent.amber, fontWeight: 600, marginBottom: 8 }}>
            ◌ SCANNING OPPORTUNITIES
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>
            Analyzing submarkets in {city}...
          </div>
        </div>
      )}

      {oppError && !oppLoading && (
        <div style={{
          ...terminalStyles.card,
          padding: 20,
          borderLeft: `4px solid ${BT.accent.red}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: BT.accent.red, marginBottom: 4 }}>
            OPPORTUNITY ENGINE ERROR
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>{oppError}</div>
        </div>
      )}

      {!oppLoading && !oppError && oppFetched && opportunities.length === 0 && (
        <div style={{ ...terminalStyles.card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: BT.text.muted, fontWeight: 600, marginBottom: 8 }}>
            NO OPPORTUNITIES DETECTED
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>
            No submarket data available for {city}. Ensure market data has been synced.
          </div>
        </div>
      )}

      {featuredOpp && (
        <div style={{
          ...terminalStyles.card,
          padding: 20,
          borderLeft: `4px solid ${QUADRANT_STYLES[featuredOpp.quadrant].btText}`,
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
                  {activeQuadrants.size > 0 ? 'TOP FILTERED' : `#${featuredOpp.rank}`} OPPORTUNITY
                </span>
                <span style={{
                  padding: '4px 10px',
                  background: QUADRANT_STYLES[featuredOpp.quadrant].btBg,
                  color: QUADRANT_STYLES[featuredOpp.quadrant].btText,
                  borderRadius: 0,
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {featuredOpp.quadrant}
                </span>
                {(() => {
                  const strat = STRATEGY_DISPLAY[featuredOpp.strategy];
                  return (
                    <span style={{
                      padding: '4px 10px',
                      background: `${strat.color}20`,
                      color: strat.color,
                      borderRadius: 0,
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {strat.label}
                    </span>
                  );
                })()}
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: BT.text.primary, marginTop: 8 }}>
                {featuredOpp.submarketName}
              </h3>
              <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12, color: BT.text.muted }}>
                <span>{featuredOpp.city}</span>
                <span>Q{featuredOpp.quartile}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                color: scoreColor(featuredOpp.opportunityScore).btText,
              }}>
                {featuredOpp.opportunityScore}
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Opportunity Score</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Est. Upside</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.green }}>+{featuredOpp.estimatedUpsidePercent}%</div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Upside $</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>{fmt.currency(featuredOpp.estimatedUpsideDollar)}</div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Market Score</div>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: scoreColor(featuredOpp.marketScore).btText,
              }}>
                {featuredOpp.marketScore}
              </div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Property Score</div>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: scoreColor(featuredOpp.propertyScore).btText,
              }}>
                {featuredOpp.propertyScore}
              </div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Strategy</div>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: STRATEGY_DISPLAY[featuredOpp.strategy].color,
              }}>
                {STRATEGY_DISPLAY[featuredOpp.strategy].label}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em' }}>
              SIGNALS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {featuredOpp.signals.map(renderSignalBadge)}
            </div>
          </div>

          <div style={{
            padding: 12,
            background: 'rgba(59,130,246,0.08)',
            borderLeft: `3px solid ${BT.accent.blue}`,
            borderRadius: 0,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.accent.blue, marginBottom: 4 }}>
              STRATEGY RATIONALE
            </div>
            <div style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.5 }}>
              {featuredOpp.strategyRationale}
            </div>
          </div>

          <button
            onClick={() => onSelectDeal?.(featuredOpp.submarketName)}
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

      {listOpps.length > 0 && (
        <CardSection title="Opportunity Rankings">
          <DataTable>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'center', width: 50 }}>#</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Submarket</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Quadrant</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Strategy</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>OPP</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Upside</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Mkt Score</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Prop Score</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Signals</th>
              </tr>
            </thead>
            <tbody>
              {listOpps.map((opp, i) => {
                const quadrantStyle = QUADRANT_STYLES[opp.quadrant];
                const strat = STRATEGY_DISPLAY[opp.strategy];
                const bullishCount = opp.signals.filter(s => s.direction === 'bullish').length;
                const bearishCount = opp.signals.filter(s => s.direction === 'bearish').length;

                return (
                  <tr key={i} style={{
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => onSelectDeal?.(opp.submarketName)}
                  >
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center', fontWeight: 700 }}>
                      {opp.rank}
                    </td>
                    <td style={{ ...terminalStyles.tableCell }}>
                      <div style={{ fontWeight: 600 }}>{opp.submarketName}</div>
                      <div style={{ fontSize: 10, color: BT.text.muted }}>
                        {opp.city} · Q{opp.quartile}
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
                        {opp.quadrant}
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        background: `${strat.color}20`,
                        color: strat.color,
                        borderRadius: 0,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {strat.label}
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: scoreColor(opp.opportunityScore).btBg,
                        color: scoreColor(opp.opportunityScore).btText,
                        borderRadius: 0,
                        fontSize: 12,
                        fontWeight: 700,
                      }}>
                        {opp.opportunityScore}
                      </span>
                    </td>
                    <td style={{
                      ...terminalStyles.tableCell,
                      textAlign: 'right',
                      fontWeight: 600,
                      color: BT.text.green,
                    }}>
                      +{opp.estimatedUpsidePercent}%
                    </td>
                    <td style={{
                      ...terminalStyles.tableCell,
                      textAlign: 'right',
                      color: scoreColor(opp.marketScore).btText,
                      fontWeight: 600,
                    }}>
                      {opp.marketScore}
                    </td>
                    <td style={{
                      ...terminalStyles.tableCell,
                      textAlign: 'right',
                      color: scoreColor(opp.propertyScore).btText,
                      fontWeight: 600,
                    }}>
                      {opp.propertyScore}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <span style={{ color: '#22c55e', fontSize: 10 }}>▲{bullishCount}</span>
                      <span style={{ color: '#6b7280', margin: '0 4px', fontSize: 10 }}>·</span>
                      <span style={{ color: '#ef4444', fontSize: 10 }}>▼{bearishCount}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </CardSection>
      )}

      {commentaryLoading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating deal analysis...</span>
        </div>
      )}
      {commentaryError && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.investmentThesis && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <InvestmentThesis
                recommendation={commentary.investmentThesis.recommendation}
                points={commentary.investmentThesis.points}
              />
            </div>
          )}
          {commentary.signalCommentary?.capital_sentiment && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="position" commentary={commentary.signalCommentary.capital_sentiment} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MSADealsTab;
