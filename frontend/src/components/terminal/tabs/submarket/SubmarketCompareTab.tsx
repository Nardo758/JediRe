/**
 * SubmarketCompareTab - Peer submarket comparison
 */

import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { PeerContext, SignalCommentary } from '../../commentary';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

interface SubmarketCompareTabProps {
  submarketId: string;
  submarket: SubmarketData;
}

interface PeerSubmarket {
  id: string;
  name: string;
  units: number;
  avgRent: number;
  rentGrowth: number;
  occupancy: number;
  capRate: number;
  pipelinePercent: number;
  rank: number;
  isCurrent?: boolean;
}

export const SubmarketCompareTab: React.FC<SubmarketCompareTabProps> = ({ submarketId, submarket }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'submarket_deep_dive', submarketId: submarketId }
  );

  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
  useEffect(() => { fetchCommentary('submarket', submarketId, submarket.name); }, [submarketId, submarket.name]);
  const [sortBy, setSortBy] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const peers: PeerSubmarket[] = useMemo(() => [
    { id: submarketId, name: submarket.name, units: submarket.totalUnits, avgRent: submarket.avgRent, rentGrowth: submarket.rentGrowth, occupancy: submarket.occupancy, capRate: submarket.avgCapRate, pipelinePercent: (submarket.pipelineUnits / submarket.totalUnits) * 100, rank: 3, isCurrent: true },
    { id: '2', name: 'Midtown', units: 42500, avgRent: 2150, rentGrowth: 5.8, occupancy: 95.2, capRate: 4.8, pipelinePercent: 9.2, rank: 1 },
    { id: '3', name: 'Downtown', units: 28200, avgRent: 1820, rentGrowth: 3.2, occupancy: 91.5, capRate: 5.4, pipelinePercent: 12.5, rank: 6 },
    { id: '4', name: 'Old Fourth Ward', units: 15800, avgRent: 1950, rentGrowth: 6.2, occupancy: 94.8, capRate: 4.9, pipelinePercent: 8.1, rank: 2 },
    { id: '5', name: 'West Midtown', units: 18500, avgRent: 1780, rentGrowth: 4.5, occupancy: 93.2, capRate: 5.1, pipelinePercent: 11.2, rank: 4 },
    { id: '6', name: 'Brookhaven', units: 22300, avgRent: 1720, rentGrowth: 3.8, occupancy: 94.1, capRate: 5.3, pipelinePercent: 6.5, rank: 5 },
    { id: '7', name: 'Sandy Springs', units: 31500, avgRent: 1650, rentGrowth: 2.8, occupancy: 93.8, capRate: 5.5, pipelinePercent: 5.2, rank: 7 },
    { id: '8', name: 'Decatur', units: 12400, avgRent: 1580, rentGrowth: 3.1, occupancy: 95.5, capRate: 5.2, pipelinePercent: 4.8, rank: 8 },
  ], [submarketId, submarket]);

  const sortedPeers = useMemo(() => {
    return [...peers].sort((a, b) => {
      const aVal = a[sortBy as keyof PeerSubmarket] || 0;
      const bVal = b[sortBy as keyof PeerSubmarket] || 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [peers, sortBy, sortDir]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const getMetricColor = (value: number, metric: string, isHigherBetter: boolean = true) => {
    const currentVal = submarket[metric as keyof SubmarketData] as number;
    if (value === currentVal) return BT.text.amber;
    if (isHigherBetter) {
      return value > currentVal ? BT.text.green : BT.text.red;
    }
    return value < currentVal ? BT.text.green : BT.text.red;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      {/* Current Submarket Position */}
      <div style={{
        background: `linear-gradient(135deg, ${BT.text.amber}15 0%, ${BT.bg.card} 100%)`,
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${BT.text.amber}44`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: BT.text.amber, fontWeight: 600, marginBottom: 4 }}>
              CURRENT POSITION
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.primary }}>
              {submarket.name} ranks #{peers.find(p => p.isCurrent)?.rank || 'N/A'} of {peers.length}
            </div>
            <div style={{ fontSize: 12, color: BT.text.secondary, marginTop: 4 }}>
              in {submarket.msaName} Metro submarkets
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Rent Growth Rank</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.green }}>#3</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Occupancy Rank</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.cyan }}>#4</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Supply Risk Rank</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.amber }}>#5</div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <BarChart3 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Peer Submarket Comparison
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th onClick={() => handleSort('rank')} style={{ ...terminalStyles.th, textAlign: 'center', cursor: 'pointer', width: 60 }}>
                Rank {sortBy === 'rank' && <ArrowUpDown size={10} />}
              </th>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Submarket</th>
              <th onClick={() => handleSort('units')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Units {sortBy === 'units' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('avgRent')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Avg Rent {sortBy === 'avgRent' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('rentGrowth')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Growth {sortBy === 'rentGrowth' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('occupancy')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Occ % {sortBy === 'occupancy' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('capRate')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Cap {sortBy === 'capRate' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('pipelinePercent')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Pipeline {sortBy === 'pipelinePercent' && <ArrowUpDown size={10} />}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPeers.map((peer) => (
              <tr 
                key={peer.id} 
                style={{ 
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  background: peer.isCurrent ? `${BT.text.amber}10` : 'transparent',
                }}
              >
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    width: 24,
                    height: 24,
                    lineHeight: '24px',
                    borderRadius: '50%',
                    background: peer.rank <= 3 ? `${BT.text.green}22` : BT.bg.cardHover,
                    color: peer.rank <= 3 ? BT.text.green : BT.text.muted,
                    fontWeight: 700,
                    fontSize: 11,
                  }}>
                    {peer.rank}
                  </span>
                </td>
                <td style={{ ...terminalStyles.td }}>
                  <span style={{ 
                    fontWeight: peer.isCurrent ? 700 : 600, 
                    color: peer.isCurrent ? BT.text.amber : BT.text.primary 
                  }}>
                    {peer.name}
                    {peer.isCurrent && (
                      <span style={{
                        marginLeft: 8,
                        fontSize: 9,
                        padding: '2px 6px',
                        background: BT.text.amber,
                        color: BT.bg.terminal,
                        borderRadius: 3,
                        fontWeight: 700,
                      }}>
                        CURRENT
                      </span>
                    )}
                  </span>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                  {peer.units.toLocaleString()}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: BT.text.green }}>
                  ${peer.avgRent.toLocaleString()}
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  color: peer.rentGrowth >= submarket.rentGrowth ? BT.text.green : BT.text.red,
                  fontWeight: 600,
                }}>
                  {peer.rentGrowth >= 0 ? '+' : ''}{peer.rentGrowth}%
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right', 
                  fontFamily: "'JetBrains Mono', monospace",
                  color: peer.occupancy >= 94 ? BT.text.green : BT.text.amber,
                }}>
                  {peer.occupancy.toFixed(1)}%
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: BT.text.cyan }}>
                  {peer.capRate.toFixed(1)}%
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  color: peer.pipelinePercent <= 8 ? BT.text.green : BT.text.amber,
                }}>
                  {peer.pipelinePercent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ 
        fontSize: 10, 
        color: BT.text.dim, 
        display: 'flex', 
        gap: 16,
        justifyContent: 'center',
      }}>
        <span><span style={{ color: BT.text.green }}>●</span> Better than {submarket.name}</span>
        <span><span style={{ color: BT.text.amber }}>●</span> Current submarket</span>
        <span><span style={{ color: BT.text.red }}>●</span> Worse than {submarket.name}</span>
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating competitive analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.peerContext && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <PeerContext
                summary={commentary.peerContext.summary}
                peerRank={commentary.peerContext.peerRank}
                peerTotal={commentary.peerContext.peerTotal}
                topPeers={commentary.peerContext.topPeers}
              />
            </div>
          )}
          {commentary.signalCommentary?.competitive_summary && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="position" commentary={commentary.signalCommentary.competitive_summary} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmarketCompareTab;
