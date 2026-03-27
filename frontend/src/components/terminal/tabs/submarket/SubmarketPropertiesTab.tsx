/**
 * SubmarketPropertiesTab - All properties in submarket with drill-down
 * Click a property row to navigate to PropertyTerminal
 */

import React, { useState, useMemo } from 'react';
import { Building2, Search, ArrowUpDown, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../../theme';
import { SubmarketData } from '../../SubmarketTerminal';

interface SubmarketPropertiesTabProps {
  submarketId: string;
  submarket: SubmarketData;
  onPropertySelect?: (propertyId: string) => void;
}

interface Property {
  id: string;
  name: string;
  address: string;
  units: number;
  yearBuilt: number;
  class: 'A' | 'B' | 'C';
  avgRent: number;
  rentGrowth: number;
  occupancy: number;
  capRate?: number;
  owner?: string;
  lastSale?: number;
  saleDate?: string;
  inPortfolio?: boolean;
}

type SortKey = 'name' | 'units' | 'avgRent' | 'occupancy' | 'yearBuilt' | 'capRate';

export const SubmarketPropertiesTab: React.FC<SubmarketPropertiesTabProps> = ({ 
  submarketId, 
  submarket,
  onPropertySelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('units');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [classFilter, setClassFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');

  // Mock property data
  const properties: Property[] = useMemo(() => [
    { id: '1', name: 'The Metropolitan at Phipps', address: '3630 Peachtree Rd NE', units: 320, yearBuilt: 2019, class: 'A', avgRent: 2150, rentGrowth: 5.2, occupancy: 96.1, capRate: 4.8, owner: 'Greystar', inPortfolio: true },
    { id: '2', name: 'Hanover Buckhead Village', address: '3035 Peachtree Rd NE', units: 370, yearBuilt: 2020, class: 'A', avgRent: 2280, rentGrowth: 4.8, occupancy: 94.2, capRate: 5.2, owner: 'Hanover Co.' },
    { id: '3', name: 'Alexan Buckhead', address: '2850 Piedmont Rd NE', units: 290, yearBuilt: 2018, class: 'A', avgRent: 1950, rentGrowth: 3.9, occupancy: 95.0, capRate: 5.5, owner: 'Trammell Crow', lastSale: 62000000, saleDate: '2022-11' },
    { id: '4', name: 'The Residence Buckhead', address: '3195 Mathieson Dr NE', units: 245, yearBuilt: 2015, class: 'B', avgRent: 1780, rentGrowth: 4.1, occupancy: 93.2, capRate: 5.8, owner: 'AvalonBay' },
    { id: '5', name: 'Park at Buckhead', address: '3060 Pharr Ct North', units: 280, yearBuilt: 2016, class: 'B', avgRent: 1820, rentGrowth: 3.5, occupancy: 94.5, capRate: 5.6 },
    { id: '6', name: 'Gables Brookhaven', address: '686 Brookhaven Ave', units: 350, yearBuilt: 2017, class: 'B', avgRent: 1720, rentGrowth: 4.3, occupancy: 96.2, capRate: 5.4, owner: 'Gables Residential' },
    { id: '7', name: 'The Darcy', address: '3045 Peachtree Rd', units: 265, yearBuilt: 2021, class: 'A', avgRent: 2380, rentGrowth: 6.1, occupancy: 92.8, capRate: 4.6, owner: 'Lincoln Property' },
    { id: '8', name: 'Buckhead Village Lofts', address: '3107 Peachtree Rd', units: 180, yearBuilt: 2008, class: 'B', avgRent: 1580, rentGrowth: 2.8, occupancy: 94.8, capRate: 6.2 },
    { id: '9', name: 'Windsor Parkview', address: '3155 Mt Vernon Rd', units: 420, yearBuilt: 2014, class: 'B', avgRent: 1650, rentGrowth: 3.2, occupancy: 95.1, capRate: 5.9, owner: 'Windsor Communities' },
    { id: '10', name: 'Peachtree Hills Place', address: '2285 Peachtree Rd', units: 195, yearBuilt: 2005, class: 'C', avgRent: 1320, rentGrowth: 2.1, occupancy: 93.5, capRate: 6.8 },
    { id: '11', name: 'The Residence at Lenox', address: '3400 Lenox Rd NE', units: 310, yearBuilt: 2022, class: 'A', avgRent: 2450, rentGrowth: 5.8, occupancy: 91.5, capRate: 4.5, owner: 'Mill Creek' },
    { id: '12', name: 'Camden Buckhead', address: '3101 New Peachtree Rd', units: 385, yearBuilt: 2016, class: 'A', avgRent: 2020, rentGrowth: 4.0, occupancy: 95.8, capRate: 5.1, owner: 'Camden Property Trust' },
  ], []);

  // Filter and sort
  const filteredProperties = useMemo(() => {
    let result = [...properties];
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.address.toLowerCase().includes(q) ||
        (p.owner && p.owner.toLowerCase().includes(q))
      );
    }
    
    // Class filter
    if (classFilter !== 'all') {
      result = result.filter(p => p.class === classFilter);
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;
      if (typeof aVal === 'string') aVal = aVal.toLowerCase() as any;
      if (typeof bVal === 'string') bVal = bVal.toLowerCase() as any;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [properties, searchQuery, classFilter, sortBy, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const getClassColor = (cls: string) => {
    if (cls === 'A') return BT.text.green;
    if (cls === 'B') return BT.text.amber;
    return BT.text.red;
  };

  // Summary stats
  const stats = useMemo(() => ({
    total: filteredProperties.length,
    totalUnits: filteredProperties.reduce((sum, p) => sum + p.units, 0),
    avgRent: filteredProperties.reduce((sum, p) => sum + p.avgRent, 0) / filteredProperties.length,
    avgOccupancy: filteredProperties.reduce((sum, p) => sum + p.occupancy, 0) / filteredProperties.length,
  }), [filteredProperties]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search & Filters */}
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
            placeholder="Search properties..."
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
        
        {/* Class Filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'A', 'B', 'C'].map((cls) => (
            <button
              key={cls}
              onClick={() => setClassFilter(cls as any)}
              style={{
                padding: '6px 12px',
                background: classFilter === cls ? BT.bg.highlight : 'transparent',
                border: `1px solid ${classFilter === cls ? BT.text.amber : BT.border.subtle}`,
                borderRadius: 4,
                color: classFilter === cls ? BT.text.amber : BT.text.muted,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {cls === 'all' ? 'All' : `Class ${cls}`}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 11 }}>
          <span style={{ color: BT.text.muted }}>
            <strong style={{ color: BT.text.primary }}>{stats.total}</strong> properties
          </span>
          <span style={{ color: BT.text.muted }}>
            <strong style={{ color: BT.text.cyan }}>{stats.totalUnits.toLocaleString()}</strong> units
          </span>
          <span style={{ color: BT.text.muted }}>
            Avg Rent: <strong style={{ color: BT.text.green }}>${Math.round(stats.avgRent).toLocaleString()}</strong>
          </span>
          <span style={{ color: BT.text.muted }}>
            Avg Occ: <strong style={{ color: BT.text.green }}>{stats.avgOccupancy.toFixed(1)}%</strong>
          </span>
        </div>
      </div>

      {/* Properties Table */}
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
                onClick={() => handleSort('name')}
                style={{ ...terminalStyles.th, textAlign: 'left', cursor: 'pointer' }}
              >
                Property {sortBy === 'name' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th style={{ ...terminalStyles.th, textAlign: 'center', width: 60 }}>Class</th>
              <th 
                onClick={() => handleSort('units')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Units {sortBy === 'units' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('yearBuilt')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Built {sortBy === 'yearBuilt' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('avgRent')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Avg Rent {sortBy === 'avgRent' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Growth</th>
              <th 
                onClick={() => handleSort('occupancy')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Occ % {sortBy === 'occupancy' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th 
                onClick={() => handleSort('capRate')}
                style={{ ...terminalStyles.th, textAlign: 'right', cursor: 'pointer' }}
              >
                Cap {sortBy === 'capRate' && <ArrowUpDown size={10} style={{ marginLeft: 4 }} />}
              </th>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Owner</th>
              <th style={{ ...terminalStyles.th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredProperties.map((property) => (
              <tr 
                key={property.id}
                onClick={() => onPropertySelect?.(property.id)}
                style={{ 
                  cursor: 'pointer',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  background: property.inPortfolio ? `${BT.text.amber}08` : 'transparent',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = BT.bg.cardHover}
                onMouseOut={(e) => e.currentTarget.style.background = property.inPortfolio ? `${BT.text.amber}08` : 'transparent'}
              >
                <td style={{ ...terminalStyles.td }}>
                  <div style={{ fontWeight: 600, color: BT.text.primary, marginBottom: 2 }}>
                    {property.name}
                    {property.inPortfolio && (
                      <span style={{
                        marginLeft: 8,
                        fontSize: 9,
                        padding: '2px 6px',
                        background: BT.text.amber,
                        color: BT.bg.terminal,
                        borderRadius: 3,
                        fontWeight: 700,
                      }}>
                        IN PORTFOLIO
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: BT.text.muted }}>{property.address}</div>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${getClassColor(property.class)}22`,
                    color: getClassColor(property.class),
                    fontWeight: 700,
                    fontSize: 11,
                  }}>
                    {property.class}
                  </span>
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}>
                  {property.units}
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  color: BT.text.muted,
                }}>
                  {property.yearBuilt}
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  color: BT.text.green,
                }}>
                  ${property.avgRent.toLocaleString()}
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  color: property.rentGrowth >= 0 ? BT.text.green : BT.text.red,
                  fontSize: 11,
                }}>
                  {property.rentGrowth >= 0 ? <TrendingUp size={10} style={{ marginRight: 2 }} /> : <TrendingDown size={10} style={{ marginRight: 2 }} />}
                  {property.rentGrowth > 0 ? '+' : ''}{property.rentGrowth.toFixed(1)}%
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  color: property.occupancy >= 95 ? BT.text.green : 
                         property.occupancy >= 92 ? BT.text.amber : BT.text.red,
                }}>
                  {property.occupancy.toFixed(1)}%
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: BT.text.cyan,
                }}>
                  {property.capRate ? `${property.capRate.toFixed(1)}%` : '—'}
                </td>
                <td style={{ 
                  ...terminalStyles.td,
                  color: BT.text.secondary,
                  fontSize: 11,
                }}>
                  {property.owner || '—'}
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
        Showing {filteredProperties.length} of {properties.length} properties • Click a row to view details
      </div>
    </div>
  );
};

export default SubmarketPropertiesTab;
