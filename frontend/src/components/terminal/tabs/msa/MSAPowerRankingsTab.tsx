/**
 * MSAPowerRankingsTab - Property leaderboard with PCS scoring
 * Integrated from pre-Bloomberg PowerRankingsTab (24KB)
 * Features: PCS score with 5 components, filters, expandable rows
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { DataTable } from '../../TerminalLayouts';
import { PCSComponents, calculatePCS, scoreColor } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary, PeerContext } from '../../commentary';

interface MSAPowerRankingsTabProps {
  msaId: string;
  msa: any;
  onSelectProperty?: (propertyId: string) => void;
}

interface PropertyRanking {
  id: string;
  name: string;
  address?: string;
  submarket: string;
  units: number;
  yearBuilt: number;
  class: string;
  owner?: string;
  pcsScore: number;
  rank: number;
  movement: number;
  components: PCSComponents;
}

// Filter options
const CLASS_OPTIONS = ['All', 'A', 'B+', 'B', 'B-', 'C+', 'C'];
const VINTAGE_OPTIONS = ['All', '2020s', '2010s', '2000s', '1990s', '1980s', 'Pre-1980'];
const SIZE_OPTIONS = ['All', '< 150', '150-250', '250-350', '350+'];

// Mock rankings data
const MOCK_RANKINGS: PropertyRanking[] = [
  { id: '1', name: 'The Vue at Midtown', submarket: 'Midtown', units: 196, yearBuilt: 2018, class: 'A', pcsScore: 94, rank: 1, movement: 2, components: { trafficPerformance: 96, revenueStrength: 92, operationalQuality: 95, assetCondition: 93, marketPosition: 94 } },
  { id: '2', name: 'Buckhead Grand', submarket: 'Buckhead', units: 320, yearBuilt: 2020, class: 'A', pcsScore: 91, rank: 2, movement: 0, components: { trafficPerformance: 90, revenueStrength: 94, operationalQuality: 88, assetCondition: 96, marketPosition: 87 } },
  { id: '3', name: 'Pines at Midtown', submarket: 'Midtown', units: 180, yearBuilt: 1992, class: 'B', pcsScore: 88, rank: 3, movement: 3, components: { trafficPerformance: 92, revenueStrength: 85, operationalQuality: 84, assetCondition: 78, marketPosition: 91 } },
  { id: '4', name: 'Brookhaven Terrace', submarket: 'Brookhaven', units: 240, yearBuilt: 1998, class: 'B+', pcsScore: 86, rank: 4, movement: -1, components: { trafficPerformance: 88, revenueStrength: 82, operationalQuality: 86, assetCondition: 84, marketPosition: 90 } },
  { id: '5', name: 'Peachtree Walk', submarket: 'Midtown', units: 310, yearBuilt: 2015, class: 'B+', pcsScore: 85, rank: 5, movement: 1, components: { trafficPerformance: 84, revenueStrength: 88, operationalQuality: 82, assetCondition: 86, marketPosition: 85 } },
  { id: '6', name: 'Decatur Station', submarket: 'Decatur', units: 156, yearBuilt: 1985, class: 'C+', pcsScore: 83, rank: 6, movement: 4, components: { trafficPerformance: 86, revenueStrength: 78, operationalQuality: 80, assetCondition: 72, marketPosition: 89 } },
  { id: '7', name: 'Sandy Springs Crossing', submarket: 'Sandy Springs', units: 312, yearBuilt: 2001, class: 'B+', pcsScore: 81, rank: 7, movement: -2, components: { trafficPerformance: 78, revenueStrength: 84, operationalQuality: 82, assetCondition: 80, marketPosition: 81 } },
  { id: '8', name: 'East Atlanta Gardens', submarket: 'East Atlanta', units: 128, yearBuilt: 1988, class: 'B-', pcsScore: 79, rank: 8, movement: 5, components: { trafficPerformance: 82, revenueStrength: 74, operationalQuality: 76, assetCondition: 70, marketPosition: 88 } },
  { id: '9', name: 'Cascade Heights', submarket: 'Cascade', units: 144, yearBuilt: 1995, class: 'C+', pcsScore: 76, rank: 9, movement: 0, components: { trafficPerformance: 74, revenueStrength: 72, operationalQuality: 78, assetCondition: 68, marketPosition: 82 } },
  { id: '10', name: 'Westside Lofts', submarket: 'Westside', units: 96, yearBuilt: 2008, class: 'B', pcsScore: 74, rank: 10, movement: -3, components: { trafficPerformance: 72, revenueStrength: 78, operationalQuality: 74, assetCondition: 76, marketPosition: 70 } },
];

// PCS component labels
const PCS_COMPONENTS = [
  { key: 'trafficPerformance', label: 'Traffic', short: 'T' },
  { key: 'revenueStrength', label: 'Revenue', short: 'R' },
  { key: 'operationalQuality', label: 'Ops', short: 'O' },
  { key: 'assetCondition', label: 'Asset', short: 'A' },
  { key: 'marketPosition', label: 'Market', short: 'M' },
];

function getVintageDecade(year: number): string {
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  return 'Pre-1980';
}

function matchesSize(units: number, filter: string): boolean {
  if (filter === 'All') return true;
  if (filter === '< 150') return units < 150;
  if (filter === '150-250') return units >= 150 && units <= 250;
  if (filter === '250-350') return units > 250 && units <= 350;
  if (filter === '350+') return units > 350;
  return true;
}

export const MSAPowerRankingsTab: React.FC<MSAPowerRankingsTabProps> = ({ msaId, msa, onSelectProperty }) => {
  const [classFilter, setClassFilter] = useState('All');
  const [vintageFilter, setVintageFilter] = useState('All');
  const [sizeFilter, setSizeFilter] = useState('All');
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'rank' | 'pcsScore' | 'movement'>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  // Filter and sort
  const filteredRankings = useMemo(() => {
    let result = MOCK_RANKINGS.filter(p => {
      if (classFilter !== 'All' && p.class !== classFilter) return false;
      if (vintageFilter !== 'All' && getVintageDecade(p.yearBuilt) !== vintageFilter) return false;
      if (!matchesSize(p.units, sizeFilter)) return false;
      return true;
    });

    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      return sortAsc ? (aVal - bVal) : (bVal - aVal);
    });

    return result;
  }, [classFilter, vintageFilter, sizeFilter, sortKey, sortAsc]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Power Rankings
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            {filteredRankings.length} properties · Click to expand PCS breakdown
          </span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Class:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {CLASS_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setClassFilter(opt)}
                style={{
                  padding: '4px 10px',
                  background: classFilter === opt ? BT.accent.blue : BT.bg.elevated,
                  color: classFilter === opt ? '#fff' : BT.text.secondary,
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Vintage:</span>
          <select
            value={vintageFilter}
            onChange={(e) => setVintageFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              background: BT.bg.elevated,
              color: BT.text.primary,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 0,
              fontSize: 11,
            }}
          >
            {VINTAGE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Size:</span>
          <select
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              background: BT.bg.elevated,
              color: BT.text.primary,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 0,
              fontSize: 11,
            }}
          >
            {SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rankings Table */}
      <div style={{ ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
        <DataTable>
          <thead>
            <tr style={{ background: BT.bg.elevated }}>
              <th 
                style={{ ...terminalStyles.tableHeader, textAlign: 'center', width: 60, cursor: 'pointer' }}
                onClick={() => handleSort('rank')}
              >
                Rank {sortKey === 'rank' && (sortAsc ? '▲' : '▼')}
              </th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', minWidth: 200 }}>
                Property
              </th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Submarket</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Class</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Year</th>
              <th 
                style={{ ...terminalStyles.tableHeader, textAlign: 'center', cursor: 'pointer' }}
                onClick={() => handleSort('pcsScore')}
              >
                PCS {sortKey === 'pcsScore' && (sortAsc ? '▲' : '▼')}
              </th>
              <th 
                style={{ ...terminalStyles.tableHeader, textAlign: 'center', cursor: 'pointer' }}
                onClick={() => handleSort('movement')}
              >
                Δ {sortKey === 'movement' && (sortAsc ? '▲' : '▼')}
              </th>
              {/* Mini component bars */}
              {PCS_COMPONENTS.map(c => (
                <th key={c.key} style={{ ...terminalStyles.tableHeader, textAlign: 'center', width: 40 }}>
                  <span style={{ fontSize: 9 }}>{c.short}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRankings.map((prop) => {
              const pcsColors = scoreColor(prop.pcsScore);
              const isExpanded = expandedRow === prop.id;
              
              return (
                <React.Fragment key={prop.id}>
                  <tr 
                    style={{ 
                      borderBottom: `1px solid ${BT.border.subtle}`,
                      cursor: 'pointer',
                      background: isExpanded ? BT.bg.elevated : 'transparent',
                    }}
                    onClick={() => setExpandedRow(isExpanded ? null : prop.id)}
                  >
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        background: prop.rank <= 3 ? BT.accent.blue : BT.bg.elevated,
                        color: prop.rank <= 3 ? '#fff' : BT.text.primary,
                        borderRadius: '50%',
                        fontSize: 12,
                        fontWeight: 700,
                      }}>
                        {prop.rank}
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.tableCell }}>
                      <div style={{ fontWeight: 600 }}>{prop.name}</div>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted }}>
                      {prop.submarket}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                      {prop.units}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: BT.bg.elevated,
                        borderRadius: 0,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {prop.class}
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted }}>
                      {prop.yearBuilt}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        background: pcsColors.btBg,
                        color: pcsColors.btText,
                        borderRadius: 0,
                        fontSize: 14,
                        fontWeight: 700,
                      }}>
                        {prop.pcsScore}
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <span style={{
                        color: prop.movement > 0 ? BT.text.green : prop.movement < 0 ? BT.accent.red : BT.text.muted,
                        fontWeight: 600,
                      }}>
                        {prop.movement > 0 ? `▲${prop.movement}` : prop.movement < 0 ? `▼${Math.abs(prop.movement)}` : '—'}
                      </span>
                    </td>
                    {/* Mini component bars */}
                    {PCS_COMPONENTS.map(c => {
                      const val = (prop.components as any)[c.key];
                      const colors = scoreColor(val);
                      return (
                        <td key={c.key} style={{ ...terminalStyles.tableCell, padding: '8px 4px' }}>
                          <div style={{
                            width: '100%',
                            height: 16,
                            background: BT.bg.elevated,
                            borderRadius: 0,
                            overflow: 'hidden',
                            position: 'relative',
                          }}>
                            <div style={{
                              width: `${val}%`,
                              height: '100%',
                              background: colors.btText,
                              borderRadius: 0,
                            }} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Expanded Row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={13} style={{ padding: 0 }}>
                        <div style={{
                          padding: 20,
                          background: BT.bg.card,
                          borderBottom: `2px solid ${BT.accent.blue}`,
                        }}>
                          <div style={{ display: 'flex', gap: 24 }}>
                            {/* PCS Breakdown */}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, marginBottom: 12 }}>
                                PCS Component Breakdown
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {PCS_COMPONENTS.map(c => {
                                  const val = (prop.components as any)[c.key];
                                  const colors = scoreColor(val);
                                  return (
                                    <div key={c.key}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, color: BT.text.secondary }}>{c.label}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: colors.btText }}>{val}</span>
                                      </div>
                                      <div style={{
                                        height: 8,
                                        background: BT.bg.elevated,
                                        borderRadius: 0,
                                        overflow: 'hidden',
                                      }}>
                                        <div style={{
                                          width: `${val}%`,
                                          height: '100%',
                                          background: colors.btText,
                                          borderRadius: 0,
                                        }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Performance Summary */}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, marginBottom: 12 }}>
                                Performance Summary
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0 }}>
                                  <div style={{ fontSize: 10, color: BT.text.muted }}>vs Submarket Avg</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.green }}>
                                    +{(prop.pcsScore - 72).toFixed(0)} pts
                                  </div>
                                </div>
                                <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0 }}>
                                  <div style={{ fontSize: 10, color: BT.text.muted }}>Percentile</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>
                                    Top {Math.round((prop.rank / MOCK_RANKINGS.length) * 100)}%
                                  </div>
                                </div>
                                <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0 }}>
                                  <div style={{ fontSize: 10, color: BT.text.muted }}>Strongest</div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.cyan }}>
                                    {PCS_COMPONENTS.reduce((best, c) => {
                                      const val = (prop.components as any)[c.key];
                                      return val > (prop.components as any)[best.key] ? c : best;
                                    }, PCS_COMPONENTS[0]).label}
                                  </div>
                                </div>
                                <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 0 }}>
                                  <div style={{ fontSize: 10, color: BT.text.muted }}>Weakest</div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: BT.accent.amber }}>
                                    {PCS_COMPONENTS.reduce((worst, c) => {
                                      const val = (prop.components as any)[c.key];
                                      return val < (prop.components as any)[worst.key] ? c : worst;
                                    }, PCS_COMPONENTS[0]).label}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectProperty?.(prop.id);
                                }}
                                style={{
                                  padding: '10px 20px',
                                  background: BT.accent.blue,
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 0,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                View Property →
                              </button>
                              <button style={{
                                padding: '10px 20px',
                                background: 'transparent',
                                color: BT.text.secondary,
                                border: `1px solid ${BT.border.subtle}`,
                                borderRadius: 0,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}>
                                Add to Compare
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </DataTable>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 24,
        padding: '12px 16px',
        background: BT.bg.card,
        borderRadius: 0,
        border: `1px solid ${BT.border.subtle}`,
      }}>
        <div>
          <span style={{ fontSize: 11, color: BT.text.muted, marginRight: 8 }}>PCS Components:</span>
          {PCS_COMPONENTS.map((c, i) => (
            <span key={c.key} style={{ fontSize: 11, color: BT.text.secondary }}>
              <span style={{ fontWeight: 600 }}>{c.short}</span>={c.label}
              {i < PCS_COMPONENTS.length - 1 && ' · '}
            </span>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: BT.text.muted }}>
          Updated: Real-time via Traffic Engine
        </div>
      </div>

      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.position && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="position" commentary={commentary.signalCommentary.position} />
            </div>
          )}
          {commentary.peerContext && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <PeerContext
                summary={commentary.peerContext.summary}
                peerRank={commentary.peerContext.peerRank}
                peerTotal={commentary.peerContext.peerTotal}
                topPeers={commentary.peerContext.topPeers}
                currentScore={commentary.jediScore}
                compact
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MSAPowerRankingsTab;
