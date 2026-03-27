/**
 * MSACompareTab - Compare to peer MSAs
 */

import React, { useMemo, useState } from 'react';
import { BarChart3, ArrowUpDown } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { MSAData } from '../../MSATerminal';

interface MSACompareTabProps {
  msaId: string;
  msa: MSAData;
}

interface PeerMSA {
  id: string;
  name: string;
  state: string;
  population: number;
  avgRent: number;
  rentGrowth: number;
  occupancy: number;
  capRate: number;
  pipelinePercent: number;
  healthScore: number;
  rank: number;
  isCurrent?: boolean;
}

export const MSACompareTab: React.FC<MSACompareTabProps> = ({ msaId, msa }) => {
  const [sortBy, setSortBy] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const peers: PeerMSA[] = useMemo(() => [
    { id: msaId, name: msa.name, state: msa.state, population: msa.population, avgRent: msa.avgRent, rentGrowth: msa.rentGrowth, occupancy: msa.occupancy, capRate: msa.avgCapRate, pipelinePercent: (msa.pipelineUnits / msa.totalUnits) * 100, healthScore: msa.healthScore, rank: msa.rank, isCurrent: true },
    { id: '2', name: 'Charlotte', state: 'NC', population: 2700000, avgRent: 1580, rentGrowth: 5.1, occupancy: 94.5, capRate: 5.0, pipelinePercent: 7.2, healthScore: 86, rank: 3 },
    { id: '3', name: 'Dallas', state: 'TX', population: 7900000, avgRent: 1620, rentGrowth: 3.8, occupancy: 93.2, capRate: 5.2, pipelinePercent: 8.5, healthScore: 80, rank: 6 },
    { id: '4', name: 'Austin', state: 'TX', population: 2400000, avgRent: 1750, rentGrowth: 2.5, occupancy: 91.8, capRate: 4.9, pipelinePercent: 10.2, healthScore: 75, rank: 8 },
    { id: '5', name: 'Nashville', state: 'TN', population: 2000000, avgRent: 1720, rentGrowth: 4.8, occupancy: 94.1, capRate: 5.1, pipelinePercent: 6.8, healthScore: 84, rank: 4 },
    { id: '6', name: 'Raleigh', state: 'NC', population: 1500000, avgRent: 1580, rentGrowth: 5.5, occupancy: 95.2, capRate: 4.8, pipelinePercent: 5.5, healthScore: 90, rank: 2 },
    { id: '7', name: 'Tampa', state: 'FL', population: 3200000, avgRent: 1780, rentGrowth: 4.2, occupancy: 93.8, capRate: 5.3, pipelinePercent: 7.8, healthScore: 79, rank: 7 },
    { id: '8', name: 'Phoenix', state: 'AZ', population: 5000000, avgRent: 1620, rentGrowth: 3.5, occupancy: 93.5, capRate: 5.4, pipelinePercent: 6.5, healthScore: 78, rank: 9 },
    { id: '9', name: 'Denver', state: 'CO', population: 2900000, avgRent: 1850, rentGrowth: 2.8, occupancy: 94.2, capRate: 5.0, pipelinePercent: 5.2, healthScore: 82, rank: 5 },
    { id: '10', name: 'Orlando', state: 'FL', population: 2700000, avgRent: 1720, rentGrowth: 4.5, occupancy: 94.0, capRate: 5.2, pipelinePercent: 7.5, healthScore: 81, rank: 6 },
  ], [msaId, msa]);

  const sortedPeers = useMemo(() => {
    return [...peers].sort((a, b) => {
      const aVal = a[sortBy as keyof PeerMSA] || 0;
      const bVal = b[sortBy as keyof PeerMSA] || 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [peers, sortBy, sortDir]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return BT.text.green;
    if (score >= 65) return BT.text.amber;
    return BT.text.red;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current Position */}
      <div style={{
        background: `linear-gradient(135deg, ${BT.text.amber}15 0%, ${BT.bg.card} 100%)`,
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${BT.text.amber}44`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: BT.text.amber, fontWeight: 600, marginBottom: 4 }}>CURRENT POSITION</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.primary }}>
              {msa.name} ranks #{msa.rank} of {msa.totalRank}
            </div>
            <div style={{ fontSize: 12, color: BT.text.secondary, marginTop: 4 }}>
              among top U.S. multifamily markets
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Rent Growth Rank</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.green }}>#4</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Job Growth Rank</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.cyan }}>#3</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Supply Risk Rank</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.amber }}>#6</div>
            </div>
          </div>
        </div>
      </div>

      {/* Peer Comparison Table */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <BarChart3 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Peer Market Comparison
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th onClick={() => handleSort('rank')} style={{ ...terminalStyles.th, textAlign: 'center', cursor: 'pointer', width: 50 }}>
                Rank {sortBy === 'rank' && <ArrowUpDown size={10} />}
              </th>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Market</th>
              <th onClick={() => handleSort('healthScore')} style={{ ...terminalStyles.th, textAlign: 'center', cursor: 'pointer' }}>
                Health {sortBy === 'healthScore' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('population')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Pop {sortBy === 'population' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('avgRent')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Rent {sortBy === 'avgRent' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('rentGrowth')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Growth {sortBy === 'rentGrowth' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('occupancy')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Occ {sortBy === 'occupancy' && <ArrowUpDown size={10} />}
              </th>
              <th onClick={() => handleSort('capRate')} style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}>
                Cap {sortBy === 'capRate' && <ArrowUpDown size={10} />}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPeers.map((peer) => (
              <tr key={peer.id} style={{ 
                borderBottom: `1px solid ${BT.border.subtle}`,
                background: peer.isCurrent ? `${BT.text.amber}10` : 'transparent',
              }}>
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
                  <span style={{ fontWeight: peer.isCurrent ? 700 : 500, color: peer.isCurrent ? BT.text.amber : BT.text.primary }}>
                    {peer.name}, {peer.state}
                    {peer.isCurrent && <span style={{ marginLeft: 8, fontSize: 9, padding: '2px 6px', background: BT.text.amber, color: BT.bg.terminal, borderRadius: 3, fontWeight: 700 }}>CURRENT</span>}
                  </span>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  <span style={{ color: getHealthColor(peer.healthScore), fontWeight: 700, fontFamily: "'JetBrains Mono'" }}>
                    {peer.healthScore}
                  </span>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  {(peer.population / 1000000).toFixed(1)}M
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono'", color: BT.text.green, fontWeight: 600 }}>
                  ${peer.avgRent.toLocaleString()}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: peer.rentGrowth >= msa.rentGrowth ? BT.text.green : BT.text.red, fontWeight: 600 }}>
                  {peer.rentGrowth >= 0 ? '+' : ''}{peer.rentGrowth}%
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono'", color: peer.occupancy >= 94 ? BT.text.green : BT.text.amber }}>
                  {peer.occupancy.toFixed(1)}%
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono'", color: BT.text.cyan }}>
                  {peer.capRate.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MSACompareTab;
