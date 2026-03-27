/**
 * MSASubmarketsTab - All submarkets with rankings and drill-down
 * Click a row to navigate to SubmarketTerminal
 */

import React, { useState, useMemo } from 'react';
import { Building2, Search, ArrowUpDown, ArrowRight, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { MSAData } from '../../MSATerminal';

interface MSASubmarketsTabProps {
  msaId: string;
  msa: MSAData;
  onSubmarketSelect?: (submarketId: string) => void;
}

interface Submarket {
  id: string;
  name: string;
  propertyCount: number;
  units: number;
  avgRent: number;
  rentGrowth: number;
  occupancy: number;
  occupancyChange: number;
  capRate: number;
  pipelineUnits: number;
  healthScore: number;
  rank: number;
}

type SortKey = 'rank' | 'name' | 'units' | 'avgRent' | 'rentGrowth' | 'occupancy' | 'healthScore';

export const MSASubmarketsTab: React.FC<MSASubmarketsTabProps> = ({ 
  msaId, 
  msa,
  onSubmarketSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Mock submarket data
  const submarkets: Submarket[] = useMemo(() => [
    { id: '1', name: 'Buckhead', propertyCount: 127, units: 38450, avgRent: 1895, rentGrowth: 5.2, occupancy: 94.3, occupancyChange: 0.8, capRate: 5.1, pipelineUnits: 2840, healthScore: 88, rank: 1 },
    { id: '2', name: 'Midtown', propertyCount: 156, units: 42500, avgRent: 2150, rentGrowth: 5.8, occupancy: 95.2, occupancyChange: 1.2, capRate: 4.8, pipelineUnits: 3200, healthScore: 92, rank: 2 },
    { id: '3', name: 'Old Fourth Ward', propertyCount: 68, units: 15800, avgRent: 1950, rentGrowth: 6.2, occupancy: 94.8, occupancyChange: 0.5, capRate: 4.9, pipelineUnits: 1450, healthScore: 85, rank: 3 },
    { id: '4', name: 'West Midtown', propertyCount: 82, units: 18500, avgRent: 1780, rentGrowth: 4.5, occupancy: 93.2, occupancyChange: -0.2, capRate: 5.2, pipelineUnits: 2100, healthScore: 78, rank: 4 },
    { id: '5', name: 'Brookhaven', propertyCount: 95, units: 22300, avgRent: 1720, rentGrowth: 3.8, occupancy: 94.1, occupancyChange: 0.3, capRate: 5.3, pipelineUnits: 1650, healthScore: 76, rank: 5 },
    { id: '6', name: 'Downtown', propertyCount: 112, units: 28200, avgRent: 1820, rentGrowth: 3.2, occupancy: 91.5, occupancyChange: -0.8, capRate: 5.4, pipelineUnits: 3800, healthScore: 68, rank: 6 },
    { id: '7', name: 'Sandy Springs', propertyCount: 134, units: 31500, avgRent: 1650, rentGrowth: 2.8, occupancy: 93.8, occupancyChange: 0.2, capRate: 5.5, pipelineUnits: 1800, healthScore: 72, rank: 7 },
    { id: '8', name: 'Decatur', propertyCount: 52, units: 12400, avgRent: 1580, rentGrowth: 3.1, occupancy: 95.5, occupancyChange: 0.6, capRate: 5.2, pipelineUnits: 680, healthScore: 74, rank: 8 },
    { id: '9', name: 'East Atlanta', propertyCount: 45, units: 9800, avgRent: 1420, rentGrowth: 4.8, occupancy: 93.5, occupancyChange: 0.4, capRate: 5.6, pipelineUnits: 920, healthScore: 71, rank: 9 },
    { id: '10', name: 'Vinings', propertyCount: 38, units: 8500, avgRent: 1750, rentGrowth: 2.5, occupancy: 94.2, occupancyChange: 0.1, capRate: 5.4, pipelineUnits: 450, healthScore: 70, rank: 10 },
    { id: '11', name: 'Perimeter Center', propertyCount: 89, units: 24600, avgRent: 1680, rentGrowth: 2.2, occupancy: 92.8, occupancyChange: -0.5, capRate: 5.6, pipelineUnits: 2400, healthScore: 65, rank: 11 },
    { id: '12', name: 'Cumberland/Galleria', propertyCount: 76, units: 19200, avgRent: 1590, rentGrowth: 1.8, occupancy: 93.1, occupancyChange: 0.0, capRate: 5.7, pipelineUnits: 1600, healthScore: 62, rank: 12 },
  ], []);

  // Filter and sort
  const filteredSubmarkets = useMemo(() => {
    let result = [...submarkets];
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q));
    }
    
    // Sort
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
    
    return result;
  }, [submarkets, searchQuery, sortBy, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir(key === 'rank' ? 'asc' : 'desc');
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return BT.text.green;
    if (score >= 65) return BT.text.amber;
    return BT.text.red;
  };

  // Summary stats
  const stats = useMemo(() => ({
    total: filteredSubmarkets.length,
    totalUnits: filteredSubmarkets.reduce((sum, s) => sum + s.units, 0),
    avgRent: filteredSubmarkets.reduce((sum, s) => sum + s.avgRent, 0) / filteredSubmarkets.length,
    avgOccupancy: filteredSubmarkets.reduce((sum, s) => sum + s.occupancy, 0) / filteredSubmarkets.length,
  }), [filteredSubmarkets]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search & Summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: BT.bg.cardHover,
          borderRadius: 6,
          border: `1px solid ${BT.border.subtle}`,
          flex: 1,
          maxWidth: 300,
        }}>
          <Search size={14} color={BT.text.muted} />
          <input
            type="text"
            placeholder="Search submarkets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: BT.text.primary,
              fontSize: 12,
              outline: 'none',
              flex: 1,
            }}
          />
        </div>

        {/* Summary */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 11 }}>
          <span style={{ color: BT.text.muted }}>
            <strong style={{ color: BT.text.primary }}>{stats.total}</strong> submarkets
          </span>
          <span style={{ color: BT.text.muted }}>
            <strong style={{ color: BT.text.cyan }}>{(stats.totalUnits / 1000).toFixed(0)}K</strong> units
          </span>
          <span style={{ color: BT.text.muted }}>
            Avg Rent: <strong style={{ color: BT.text.green }}>${Math.round(stats.avgRent).toLocaleString()}</strong>
          </span>
          <span style={{ color: BT.text.muted }}>
            Avg Occ: <strong style={{ color: BT.text.green }}>{stats.avgOccupancy.toFixed(1)}%</strong>
          </span>
        </div>
      </div>

      {/* Submarkets Table */}
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: BT.bg.header }}>
              <th 
                onClick={() => handleSort('rank')}
                style={{ ...terminalStyles.th, textAlign: 'center', width: 50, cursor: 'pointer' }}
              >
                Rank {sortBy === 'rank' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('name')}
                style={{ ...terminalStyles.th, textAlign: 'left', cursor: 'pointer' }}
              >
                Submarket {sortBy === 'name' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('healthScore')}
                style={{ ...terminalStyles.th, textAlign: 'center', cursor: 'pointer' }}
              >
                Health {sortBy === 'healthScore' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('units')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Units {sortBy === 'units' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('avgRent')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Avg Rent {sortBy === 'avgRent' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('rentGrowth')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Growth {sortBy === 'rentGrowth' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('occupancy')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Occ % {sortBy === 'occupancy' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Cap</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Pipeline</th>
              <th style={{ ...terminalStyles.th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredSubmarkets.map((submarket) => (
              <tr 
                key={submarket.id}
                onClick={() => onSubmarketSelect?.(submarket.id)}
                style={{ 
                  cursor: 'pointer',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}
                onMouseOver={(e) => e.currentTarget.style.background = BT.bg.cardHover}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: submarket.rank <= 3 ? `${BT.text.green}22` : BT.bg.cardHover,
                    color: submarket.rank <= 3 ? BT.text.green : BT.text.muted,
                    fontWeight: 700,
                    fontSize: 11,
                  }}>
                    {submarket.rank}
                  </span>
                </td>
                <td style={{ ...terminalStyles.td }}>
                  <div style={{ fontWeight: 600, color: BT.text.primary, marginBottom: 2 }}>
                    {submarket.name}
                  </div>
                  <div style={{ fontSize: 10, color: BT.text.muted }}>
                    {submarket.propertyCount} properties
                  </div>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${getHealthColor(submarket.healthScore)}22`,
                    color: getHealthColor(submarket.healthScore),
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {submarket.healthScore}
                  </span>
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {(submarket.units / 1000).toFixed(1)}K
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  color: BT.text.green,
                }}>
                  ${submarket.avgRent.toLocaleString()}
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  color: submarket.rentGrowth >= 0 ? BT.text.green : BT.text.red,
                  fontWeight: 600,
                }}>
                  {submarket.rentGrowth >= 0 ? '+' : ''}{submarket.rentGrowth.toFixed(1)}%
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: submarket.occupancy >= 94 ? BT.text.green : BT.text.amber,
                }}>
                  {submarket.occupancy.toFixed(1)}%
                  <span style={{
                    fontSize: 9,
                    marginLeft: 4,
                    color: submarket.occupancyChange >= 0 ? BT.text.green : BT.text.red,
                  }}>
                    {submarket.occupancyChange >= 0 ? '▲' : '▼'}
                  </span>
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: BT.text.cyan,
                }}>
                  {submarket.capRate.toFixed(1)}%
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  color: BT.text.amber,
                }}>
                  {(submarket.pipelineUnits / 1000).toFixed(1)}K
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  <ArrowRight size={14} color={BT.text.muted} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination hint */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: 11, 
        color: BT.text.dim,
        padding: 8,
      }}>
        Showing {filteredSubmarkets.length} of {submarkets.length} submarkets • Click a row to view details
      </div>
    </div>
  );
};

export default MSASubmarketsTab;
