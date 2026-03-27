/**
 * F4MarketsPage - Bloomberg-style Markets Landing Page
 * Shows all MSAs in a grid/table view with drill-down to MSATerminal
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Search, 
  Award, Users, Grid, List, Filter
} from 'lucide-react';
import { BT } from '../../components/terminal/theme';

interface MSACard {
  id: string;
  name: string;
  state: string;
  region: string;
  population: number;
  populationGrowth: number;
  submarketCount: number;
  propertyCount: number;
  totalUnits: number;
  avgRent: number;
  rentGrowth: number;
  occupancy: number;
  avgCapRate: number;
  pipelineUnits: number;
  healthScore: number;
  rank: number;
}

type ViewMode = 'grid' | 'table';
type SortKey = 'rank' | 'name' | 'avgRent' | 'rentGrowth' | 'healthScore' | 'population';

interface F4MarketsPageProps {
  onSelectMarket?: (marketId: string, marketName: string) => void;
  embedded?: boolean;
}

export const F4MarketsPage: React.FC<F4MarketsPageProps> = ({ onSelectMarket, embedded }) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // Mock MSA data
  const markets: MSACard[] = useMemo(() => [
    { id: 'atlanta-ga', name: 'Atlanta', state: 'GA', region: 'Southeast', population: 6200000, populationGrowth: 1.8, submarketCount: 24, propertyCount: 1847, totalUnits: 485000, avgRent: 1680, rentGrowth: 4.2, occupancy: 94.1, avgCapRate: 5.3, pipelineUnits: 28500, healthScore: 82, rank: 5 },
    { id: 'dallas-tx', name: 'Dallas', state: 'TX', region: 'Southwest', population: 7900000, populationGrowth: 2.1, submarketCount: 32, propertyCount: 2450, totalUnits: 620000, avgRent: 1620, rentGrowth: 3.8, occupancy: 93.2, avgCapRate: 5.2, pipelineUnits: 42000, healthScore: 80, rank: 6 },
    { id: 'phoenix-az', name: 'Phoenix', state: 'AZ', region: 'Southwest', population: 5000000, populationGrowth: 2.5, submarketCount: 18, propertyCount: 1320, totalUnits: 380000, avgRent: 1620, rentGrowth: 3.5, occupancy: 93.5, avgCapRate: 5.4, pipelineUnits: 24000, healthScore: 78, rank: 9 },
    { id: 'charlotte-nc', name: 'Charlotte', state: 'NC', region: 'Southeast', population: 2700000, populationGrowth: 2.2, submarketCount: 14, propertyCount: 980, totalUnits: 245000, avgRent: 1580, rentGrowth: 5.1, occupancy: 94.5, avgCapRate: 5.0, pipelineUnits: 18000, healthScore: 86, rank: 3 },
    { id: 'austin-tx', name: 'Austin', state: 'TX', region: 'Southwest', population: 2400000, populationGrowth: 2.8, submarketCount: 12, propertyCount: 720, totalUnits: 195000, avgRent: 1750, rentGrowth: 2.5, occupancy: 91.8, avgCapRate: 4.9, pipelineUnits: 22000, healthScore: 75, rank: 8 },
    { id: 'nashville-tn', name: 'Nashville', state: 'TN', region: 'Southeast', population: 2000000, populationGrowth: 1.9, submarketCount: 10, propertyCount: 620, totalUnits: 165000, avgRent: 1720, rentGrowth: 4.8, occupancy: 94.1, avgCapRate: 5.1, pipelineUnits: 12000, healthScore: 84, rank: 4 },
    { id: 'raleigh-nc', name: 'Raleigh', state: 'NC', region: 'Southeast', population: 1500000, populationGrowth: 2.4, submarketCount: 8, propertyCount: 480, totalUnits: 125000, avgRent: 1580, rentGrowth: 5.5, occupancy: 95.2, avgCapRate: 4.8, pipelineUnits: 8500, healthScore: 90, rank: 2 },
    { id: 'tampa-fl', name: 'Tampa', state: 'FL', region: 'Southeast', population: 3200000, populationGrowth: 1.6, submarketCount: 16, propertyCount: 1150, totalUnits: 295000, avgRent: 1780, rentGrowth: 4.2, occupancy: 93.8, avgCapRate: 5.3, pipelineUnits: 21000, healthScore: 79, rank: 7 },
    { id: 'denver-co', name: 'Denver', state: 'CO', region: 'Mountain', population: 2900000, populationGrowth: 1.2, submarketCount: 15, propertyCount: 890, totalUnits: 245000, avgRent: 1850, rentGrowth: 2.8, occupancy: 94.2, avgCapRate: 5.0, pipelineUnits: 15000, healthScore: 81, rank: 5 },
    { id: 'seattle-wa', name: 'Seattle', state: 'WA', region: 'Pacific', population: 4000000, populationGrowth: 1.1, submarketCount: 18, propertyCount: 1050, totalUnits: 285000, avgRent: 2150, rentGrowth: 3.2, occupancy: 94.5, avgCapRate: 4.6, pipelineUnits: 18000, healthScore: 83, rank: 4 },
    { id: 'miami-fl', name: 'Miami', state: 'FL', region: 'Southeast', population: 6200000, populationGrowth: 1.4, submarketCount: 22, propertyCount: 1680, totalUnits: 420000, avgRent: 2280, rentGrowth: 5.8, occupancy: 95.1, avgCapRate: 4.5, pipelineUnits: 32000, healthScore: 88, rank: 1 },
    { id: 'orlando-fl', name: 'Orlando', state: 'FL', region: 'Southeast', population: 2700000, populationGrowth: 1.8, submarketCount: 14, propertyCount: 920, totalUnits: 235000, avgRent: 1720, rentGrowth: 4.5, occupancy: 94.0, avgCapRate: 5.2, pipelineUnits: 17500, healthScore: 81, rank: 6 },
  ], []);

  const regions = useMemo(() => 
    ['all', ...new Set(markets.map(m => m.region))],
    [markets]
  );

  // Filter and sort
  const filteredMarkets = useMemo(() => {
    let result = [...markets];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(q) || 
        m.state.toLowerCase().includes(q)
      );
    }
    
    if (regionFilter !== 'all') {
      result = result.filter(m => m.region === regionFilter);
    }
    
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
  }, [markets, searchQuery, regionFilter, sortBy, sortDir]);

  const handleMarketClick = (market: MSACard) => {
    if (onSelectMarket) {
      onSelectMarket(market.id, market.name);
    } else {
      navigate(`/markets/${market.id}`);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 85) return BT.text.green;
    if (score >= 75) return BT.text.amber;
    return BT.text.red;
  };

  return (
    <div style={{
      minHeight: embedded ? 0 : '100vh',
      background: BT.bg.terminal,
      color: BT.text.primary,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 32px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, letterSpacing: '0.1em', marginBottom: 4 }}>
              F4 MARKETS
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: BT.text.primary }}>
              Market Intelligence
            </div>
            <div style={{ fontSize: 12, color: BT.text.secondary, marginTop: 4 }}>
              {markets.length} markets • {markets.reduce((sum, m) => sum + m.submarketCount, 0)} submarkets • {markets.reduce((sum, m) => sum + m.propertyCount, 0).toLocaleString()} properties
            </div>
          </div>
          
          {/* View Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: 8,
                background: viewMode === 'grid' ? BT.bg.active : 'transparent',
                border: `1px solid ${viewMode === 'grid' ? BT.text.amber : BT.border.subtle}`,
                borderRadius: 4,
                color: viewMode === 'grid' ? BT.text.amber : BT.text.muted,
                cursor: 'pointer',
              }}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: 8,
                background: viewMode === 'table' ? BT.bg.active : 'transparent',
                border: `1px solid ${viewMode === 'table' ? BT.text.amber : BT.border.subtle}`,
                borderRadius: 4,
                color: viewMode === 'table' ? BT.text.amber : BT.text.muted,
                cursor: 'pointer',
              }}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: BT.bg.input,
            borderRadius: 6,
            border: `1px solid ${BT.border.subtle}`,
            width: 280,
          }}>
            <Search size={14} color={BT.text.muted} />
            <input
              type="text"
              placeholder="Search markets..."
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
          
          {/* Region Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} color={BT.text.muted} />
            {regions.map((region) => (
              <button
                key={region}
                onClick={() => setRegionFilter(region)}
                style={{
                  padding: '6px 12px',
                  background: regionFilter === region ? BT.bg.active : 'transparent',
                  border: `1px solid ${regionFilter === region ? BT.text.amber : BT.border.subtle}`,
                  borderRadius: 4,
                  color: regionFilter === region ? BT.text.amber : BT.text.muted,
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {region === 'all' ? 'All Regions' : region}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: BT.text.muted }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              style={{
                padding: '6px 10px',
                background: BT.bg.input,
                border: `1px solid ${BT.border.subtle}`,
                borderRadius: 4,
                color: BT.text.primary,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <option value="rank">Rank</option>
              <option value="name">Name</option>
              <option value="healthScore">Health Score</option>
              <option value="avgRent">Avg Rent</option>
              <option value="rentGrowth">Rent Growth</option>
              <option value="population">Population</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 32 }}>
        {viewMode === 'grid' ? (
          /* Grid View */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {filteredMarkets.map((market) => (
              <div
                key={market.id}
                onClick={() => handleMarketClick(market)}
                style={{
                  background: BT.bg.panel,
                  borderRadius: 8,
                  border: `1px solid ${BT.border.subtle}`,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = BT.text.amber;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BT.border.subtle;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Card Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: BT.bg.header,
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: `${BT.text.amber}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <MapPin size={18} color={BT.text.amber} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>
                        {market.name}
                      </div>
                      <div style={{ fontSize: 10, color: BT.text.muted }}>
                        {market.state} • {market.region}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: `${getHealthColor(market.healthScore)}22`,
                    borderRadius: 4,
                    border: `1px solid ${getHealthColor(market.healthScore)}44`,
                  }}>
                    <Award size={14} color={getHealthColor(market.healthScore)} />
                    <span style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: getHealthColor(market.healthScore),
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {market.healthScore}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: 16 }}>
                  {/* Key Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>AVG RENT</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.green, fontFamily: "'JetBrains Mono'" }}>
                        ${market.avgRent.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: market.rentGrowth >= 0 ? BT.text.green : BT.text.red }}>
                        {market.rentGrowth > 0 ? '+' : ''}{market.rentGrowth}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>OCCUPANCY</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: market.occupancy >= 94 ? BT.text.green : BT.text.amber, fontFamily: "'JetBrains Mono'" }}>
                        {market.occupancy}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>CAP RATE</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.cyan, fontFamily: "'JetBrains Mono'" }}>
                        {market.avgCapRate}%
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderTop: `1px solid ${BT.border.subtle}`,
                    fontSize: 10,
                    color: BT.text.muted,
                  }}>
                    <span><strong style={{ color: BT.text.secondary }}>{market.submarketCount}</strong> submarkets</span>
                    <span><strong style={{ color: BT.text.secondary }}>{(market.totalUnits / 1000).toFixed(0)}K</strong> units</span>
                    <span>Pipeline <strong style={{ color: BT.text.amber }}>{(market.pipelineUnits / 1000).toFixed(0)}K</strong></span>
                  </div>
                </div>

                {/* Card Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 16px',
                  background: BT.bg.header,
                  borderTop: `1px solid ${BT.border.subtle}`,
                  fontSize: 10,
                }}>
                  <span style={{ color: BT.text.muted }}>
                    Rank <strong style={{ color: BT.text.amber }}>#{market.rank}</strong>
                  </span>
                  <span style={{ color: BT.text.muted }}>
                    <Users size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {(market.population / 1000000).toFixed(1)}M pop
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div style={{
            background: BT.bg.panel,
            borderRadius: 8,
            border: `1px solid ${BT.border.subtle}`,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: BT.bg.header }}>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: BT.text.muted, fontSize: 10, fontWeight: 500, width: 50 }}>RANK</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>MARKET</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>HEALTH</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>POP</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>UNITS</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>AVG RENT</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>GROWTH</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>OCC</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>CAP</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>PIPELINE</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarkets.map((market) => (
                  <tr
                    key={market.id}
                    onClick={() => handleMarketClick(market)}
                    style={{ 
                      borderBottom: `1px solid ${BT.border.subtle}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = BT.bg.cardHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        width: 24,
                        height: 24,
                        lineHeight: '24px',
                        borderRadius: '50%',
                        background: market.rank <= 3 ? `${BT.text.green}22` : BT.bg.cardHover,
                        color: market.rank <= 3 ? BT.text.green : BT.text.muted,
                        fontWeight: 700,
                        fontSize: 11,
                      }}>
                        {market.rank}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: BT.text.primary }}>{market.name}, {market.state}</div>
                      <div style={{ fontSize: 10, color: BT.text.muted }}>{market.region} • {market.submarketCount} submarkets</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ color: getHealthColor(market.healthScore), fontWeight: 700, fontFamily: "'JetBrains Mono'" }}>
                        {market.healthScore}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11 }}>
                      {(market.population / 1000000).toFixed(1)}M
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11 }}>
                      {(market.totalUnits / 1000).toFixed(0)}K
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11, color: BT.text.green, fontWeight: 600 }}>
                      ${market.avgRent.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, color: market.rentGrowth >= 0 ? BT.text.green : BT.text.red, fontWeight: 600 }}>
                      {market.rentGrowth > 0 ? '+' : ''}{market.rentGrowth}%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11, color: market.occupancy >= 94 ? BT.text.green : BT.text.amber }}>
                      {market.occupancy}%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11, color: BT.text.cyan }}>
                      {market.avgCapRate}%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11, color: BT.text.amber }}>
                      {(market.pipelineUnits / 1000).toFixed(0)}K
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!embedded && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 32px',
          background: BT.bg.header,
          borderTop: `1px solid ${BT.border.subtle}`,
          fontSize: 10,
          color: BT.text.dim,
          gap: 16,
        }}>
          <span style={{ color: BT.text.green }}>● {filteredMarkets.length} Markets</span>
          <span>|</span>
          <span>{filteredMarkets.reduce((sum, m) => sum + m.submarketCount, 0)} Submarkets</span>
          <span>|</span>
          <span>{filteredMarkets.reduce((sum, m) => sum + m.propertyCount, 0).toLocaleString()} Properties</span>
          <span>|</span>
          <span>{(filteredMarkets.reduce((sum, m) => sum + m.totalUnits, 0) / 1000000).toFixed(1)}M Units</span>
          <span style={{ marginLeft: 'auto' }}>Click a market to view details</span>
        </div>
      )}
    </div>
  );
};

export default F4MarketsPage;
