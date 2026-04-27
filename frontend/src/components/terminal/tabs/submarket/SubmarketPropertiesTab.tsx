/**
 * SubmarketPropertiesTab - All properties in submarket with drill-down
 * Click a property row to navigate to PropertyTerminal
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Search, ArrowUpDown, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../../theme';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary } from '../../commentary';
import api from '../../../../services/api';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

interface PropertyApiRow {
  name: string;
  submarket: string;
  msa: string;
  jedi: number;
  units: number;
  rent: string;
  occ: string;
  capRate: string;
  vintage: number;
  owner: string;
}

const parsePct = (s: string): number => {
  const n = parseFloat((s || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const parseCurrency = (s: string): number => {
  const n = parseFloat((s || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const classFromVintage = (year: number): 'A' | 'B' | 'C' => {
  if (!year || year < 1800) return 'B';
  if (year >= 2015) return 'A';
  if (year >= 2000) return 'B';
  return 'C';
};

interface SubmarketPropertiesTabProps {
  submarketId: string;
  submarket: SubmarketData;
  onPropertySelect?: (propertyId: string, propertyName?: string) => void;
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
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);
  useEffect(() => { fetchCommentary('submarket', submarketId, submarket.name); }, [submarketId, submarket.name]);

  // Neural-network context analysis. Hook lives inside the component body
  // (not at module scope) so it sees submarketId on every render.
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'property_card', submarketId },
  );

  // Live property data from /api/v1/market-metrics/properties
  const [apiRows, setApiRows] = useState<PropertyApiRow[]>([]);
  const [propsLoading, setPropsLoading] = useState(true);
  const [propsError, setPropsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPropsLoading(true);
    setPropsError(null);
    const msaParam = submarket.msaId ? `?msaId=${encodeURIComponent(submarket.msaId)}` : '';
    api
      .get(`/market-metrics/properties${msaParam}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && Array.isArray(res.data.properties)) {
          setApiRows(res.data.properties as PropertyApiRow[]);
        } else {
          setApiRows([]);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setPropsError(err?.message || 'Failed to load properties');
        setApiRows([]);
      })
      .finally(() => {
        if (!cancelled) setPropsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submarket.msaId]);

  const properties: Property[] = useMemo(() => {
    return apiRows.map((r, i) => ({
      id: String(i + 1),
      name: r.name || `Property ${i + 1}`,
      address: r.submarket && r.submarket !== 'General' ? `${r.submarket} · ${r.msa}` : r.msa,
      units: r.units || 0,
      yearBuilt: r.vintage || 0,
      class: classFromVintage(r.vintage),
      avgRent: parseCurrency(r.rent),
      rentGrowth: 0,
      occupancy: parsePct(r.occ),
      capRate: parsePct(r.capRate) || undefined,
      owner: r.owner || undefined,
      inPortfolio: false,
    }));
  }, [apiRows]);

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
    avgRent: filteredProperties.length
      ? filteredProperties.reduce((sum, p) => sum + p.avgRent, 0) / filteredProperties.length
      : 0,
    avgOccupancy: filteredProperties.length
      ? filteredProperties.reduce((sum, p) => sum + p.occupancy, 0) / filteredProperties.length
      : 0,
  }), [filteredProperties]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
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
                onClick={() => onPropertySelect?.(property.id, property.name)}
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
        {propsLoading
          ? 'Loading properties from database…'
          : propsError
            ? `Error: ${propsError}`
            : properties.length === 0
              ? 'No properties returned for this MSA'
              : `Showing ${filteredProperties.length} of ${properties.length} properties (MSA-level) · Click a row to view details`}
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating property analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.segment_analysis && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="demand" commentary={commentary.signalCommentary.segment_analysis} />
            </div>
          )}
          {commentary.signalCommentary?.supply && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="supply" commentary={commentary.signalCommentary.supply} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmarketPropertiesTab;
