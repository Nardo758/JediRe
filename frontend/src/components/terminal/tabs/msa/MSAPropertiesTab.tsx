/**
 * MSAPropertiesTab - Full property database with export
 * Integrated from pre-Bloomberg PropertyDataTab (42KB)
 * Features: Full property details, filters, heatmap mode, export (CSV/Excel/Clipboard)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { DataTable } from '../../TerminalLayouts';
import { scoreColor, BT_SIGNAL_COLORS } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { apiClient } from '../../../../api/client';
import { SignalCommentary } from '../../commentary';

interface GeorgiaPropertyApiItem {
  id?: string;
  property: string;
  address?: string;
  submarket?: string;
  units?: number;
  rent?: string;
  occ?: string;
  concessions?: string;
}

interface MSAPropertiesTabProps {
  msaId: string;
  msa: any;
  onSelectProperty?: (propertyId: string, propertyName?: string) => void;
}

interface PropertyRow {
  id: string;
  property: string;
  submarket: string;
  units: number;
  year: number;
  class: string;
  rent: string;
  occ: string;
  jedi: number;
  address: string;
  stories: number;
  acres: number;
  owner: string;
  purchaseDate: string;
  purchasePrice: string;
  pricePerUnit: string;
  holdPeriod: string;
  sellerMotivation: number;
  taxAssessed: string;
  stepUpRisk: string;
  zoning: string;
  zoningCapacity: string;
  askingRent: string;
  marketRent: string;
  lossToLease: string;
  lossToLeasePct: string;
  concessions: string;
}

// Heatmap modes
const HEATMAP_MODES = [
  { key: 'none', label: 'None' },
  { key: 'jedi', label: 'JEDI Score', code: 'C-01' },
  { key: 'motivation', label: 'Seller Motivation', code: 'P-05' },
  { key: 'ltl', label: 'Loss-to-Lease', code: 'P-03' },
  { key: 'hold', label: 'Hold Period', code: 'P-04' },
];

// Mock property data

// Table columns
const COLUMNS = [
  { key: 'property', label: 'Property', width: 160, align: 'left' as const },
  { key: 'submarket', label: 'Submarket', width: 100, align: 'left' as const },
  { key: 'units', label: 'Units', width: 60, align: 'right' as const },
  { key: 'year', label: 'Year', width: 50, align: 'center' as const },
  { key: 'class', label: 'Class', width: 50, align: 'center' as const },
  { key: 'rent', label: 'Rent', width: 70, align: 'right' as const },
  { key: 'occ', label: 'Occ', width: 55, align: 'right' as const },
  { key: 'jedi', label: 'JEDI', width: 50, align: 'center' as const },
  { key: 'owner', label: 'Owner', width: 120, align: 'left' as const },
  { key: 'holdPeriod', label: 'Hold', width: 55, align: 'right' as const },
  { key: 'sellerMotivation', label: 'Motiv', width: 50, align: 'center' as const },
  { key: 'lossToLease', label: 'LTL', width: 80, align: 'right' as const },
  { key: 'pricePerUnit', label: '$/Unit', width: 70, align: 'right' as const },
];

export const MSAPropertiesTab: React.FC<MSAPropertiesTabProps> = ({ msaId, msa, onSelectProperty }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [submarketFilter, setSubmarketFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const [vintageFilter, setVintageFilter] = useState('All');
  const [sizeFilter, setSizeFilter] = useState('All');
  const [liveProperties, setLiveProperties] = useState<PropertyRow[]>([]);
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);
  const [heatmapMode, setHeatmapMode] = useState('none');
  const [sortKey, setSortKey] = useState<string>('units');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    apiClient.get('/georgia/properties?state=GA&limit=100&minUnits=4')
      .then((data: { success: boolean; properties: GeorgiaPropertyApiItem[] }) => {
        if (data.success && Array.isArray(data.properties) && data.properties.length > 0) {
          const mapped: PropertyRow[] = data.properties.map((p: GeorgiaPropertyApiItem, i: number) => ({
            id: p.id || String(i + 1),
            property: p.property,
            submarket: p.submarket || 'Atlanta',
            units: p.units || 0,
            year: 0,
            class: '—',
            rent: p.rent || '—',
            occ: p.occ || '—',
            jedi: 0,
            address: p.address || '',
            stories: 0,
            acres: 0,
            owner: '—',
            purchaseDate: '—',
            purchasePrice: '—',
            pricePerUnit: '—',
            holdPeriod: '—',
            sellerMotivation: 0,
            taxAssessed: '—',
            stepUpRisk: '—',
            zoning: '—',
            zoningCapacity: '—',
            askingRent: p.rent || '—',
            marketRent: '—',
            lossToLease: '—',
            lossToLeasePct: '0%',
            concessions: p.concessions || '—',
          }));
          setLiveProperties(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const allProperties = liveProperties;

  // Get unique values for filters
  const submarkets = ['All', ...Array.from(new Set(allProperties.map(p => p.submarket)))];
  const classes = ['All', 'A', 'B+', 'B', 'B-', 'C+', 'C'];
  const vintages = ['All', 'Pre-1980', '1980s', '1990s', '2000s', '2010s', '2020s'];
  const sizes = ['All', '< 150', '150-250', '250-350', '350+'];

  // Filter and sort
  const filteredProperties = useMemo(() => {
    let result = allProperties.filter(p => {
      if (searchQuery && !p.property.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !p.address.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (submarketFilter !== 'All' && p.submarket !== submarketFilter) return false;
      if (classFilter !== 'All' && p.class !== classFilter) return false;
      if (vintageFilter !== 'All') {
        if (vintageFilter === 'Pre-1980' && p.year >= 1980) return false;
        if (vintageFilter === '1980s' && (p.year < 1980 || p.year >= 1990)) return false;
        if (vintageFilter === '1990s' && (p.year < 1990 || p.year >= 2000)) return false;
        if (vintageFilter === '2000s' && (p.year < 2000 || p.year >= 2010)) return false;
        if (vintageFilter === '2010s' && (p.year < 2010 || p.year >= 2020)) return false;
        if (vintageFilter === '2020s' && p.year < 2020) return false;
      }
      if (sizeFilter !== 'All') {
        if (sizeFilter === '< 150' && p.units >= 150) return false;
        if (sizeFilter === '150-250' && (p.units < 150 || p.units > 250)) return false;
        if (sizeFilter === '250-350' && (p.units < 250 || p.units > 350)) return false;
        if (sizeFilter === '350+' && p.units < 350) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let aVal = (a as any)[sortKey];
      let bVal = (b as any)[sortKey];
      if (typeof aVal === 'string') aVal = aVal.replace(/[$,%K]/g, '');
      if (typeof bVal === 'string') bVal = bVal.replace(/[$,%K]/g, '');
      const aNum = parseFloat(aVal) || 0;
      const bNum = parseFloat(bVal) || 0;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return result;
  }, [searchQuery, submarketFilter, classFilter, vintageFilter, sizeFilter, sortKey, sortDir, allProperties]);

  // Heatmap color calculation
  const getHeatmapColor = (property: PropertyRow) => {
    if (heatmapMode === 'none') return 'transparent';
    
    let value = 0;
    let max = 100;
    
    switch (heatmapMode) {
      case 'jedi':
        value = property.jedi;
        break;
      case 'motivation':
        value = property.sellerMotivation;
        break;
      case 'ltl':
        value = parseFloat(property.lossToLeasePct);
        max = 25;
        break;
      case 'hold':
        value = parseFloat(property.holdPeriod);
        max = 10;
        break;
    }
    
    const intensity = Math.min(value / max, 1);
    const hue = heatmapMode === 'jedi' ? 120 : heatmapMode === 'motivation' ? 0 : heatmapMode === 'ltl' ? 45 : 200;
    return `hsla(${hue}, 70%, 50%, ${intensity * 0.25})`;
  };

  // Export functions
  const handleExportCSV = () => {
    setExportLoading(true);
    const headers = COLUMNS.map(c => c.label).join(',');
    const rows = filteredProperties.map(p => 
      COLUMNS.map(c => `"${(p as any)[c.key]}"`).join(',')
    ).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${msaName}_properties_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  };

  const handleCopyToClipboard = async () => {
    const headers = COLUMNS.map(c => c.label).join('\t');
    const rows = filteredProperties.map(p => 
      COLUMNS.map(c => (p as any)[c.key]).join('\t')
    ).join('\n');
    const text = `${headers}\n${rows}`;
    
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredProperties.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredProperties.map(p => p.id)));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ ...terminalStyles.sectionTitle }}>
              {msaName} — Property Database
            </h2>
            {liveProperties.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green, background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>LIVE · APT LOCATOR</span>
            )}
          </div>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            {filteredProperties.length} of {allProperties.length} properties · Click row to expand
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCopyToClipboard}
            style={{
              padding: '8px 16px',
              background: copySuccess ? BT.text.green : BT.bg.elevated,
              color: copySuccess ? '#fff' : BT.text.secondary,
              border: 'none',
              borderRadius: 0,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {copySuccess ? '✓ Copied!' : '📋 Copy'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exportLoading}
            style={{
              padding: '8px 16px',
              background: BT.accent.blue,
              color: '#fff',
              border: 'none',
              borderRadius: 0,
              fontSize: 11,
              cursor: 'pointer',
              opacity: exportLoading ? 0.7 : 1,
            }}
          >
            {exportLoading ? 'Exporting...' : '📥 Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ flex: '0 0 200px' }}>
          <input
            type="text"
            placeholder="Search property or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: BT.bg.elevated,
              color: BT.text.primary,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 0,
              fontSize: 12,
            }}
          />
        </div>

        {/* Submarket */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Submarket:</span>
          <select
            value={submarketFilter}
            onChange={(e) => setSubmarketFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              background: BT.bg.elevated,
              color: BT.text.primary,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 0,
              fontSize: 11,
            }}
          >
            {submarkets.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Class */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Class:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {classes.map(c => (
              <button
                key={c}
                onClick={() => setClassFilter(c)}
                style={{
                  padding: '4px 10px',
                  background: classFilter === c ? BT.accent.blue : BT.bg.elevated,
                  color: classFilter === c ? '#fff' : BT.text.secondary,
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Vintage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Vintage:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {vintages.map(v => (
              <button
                key={v}
                onClick={() => setVintageFilter(v)}
                style={{
                  padding: '4px 10px',
                  background: vintageFilter === v ? BT.accent.blue : BT.bg.elevated,
                  color: vintageFilter === v ? '#fff' : BT.text.secondary,
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Size:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {sizes.map(s => (
              <button
                key={s}
                onClick={() => setSizeFilter(s)}
                style={{
                  padding: '4px 10px',
                  background: sizeFilter === s ? BT.accent.blue : BT.bg.elevated,
                  color: sizeFilter === s ? '#fff' : BT.text.secondary,
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Heatmap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Heatmap:</span>
          <select
            value={heatmapMode}
            onChange={(e) => setHeatmapMode(e.target.value)}
            style={{
              padding: '6px 12px',
              background: BT.bg.elevated,
              color: BT.text.primary,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 0,
              fontSize: 11,
            }}
          >
            {HEATMAP_MODES.map(m => (
              <option key={m.key} value={m.key}>
                {m.label} {m.code ? `(${m.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content: Table LEFT | Commentary RIGHT */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Data Table */}
      <div style={{ ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <DataTable style={{ minWidth: 1200 }}>
            <thead>
              <tr style={{ background: BT.bg.elevated }}>
                <th style={{ ...terminalStyles.tableHeader, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredProperties.length && filteredProperties.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      ...terminalStyles.tableHeader,
                      textAlign: col.align,
                      width: col.width,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span style={{ marginLeft: 4, fontSize: 10 }}>
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allProperties.length === 0 && (
                <tr><td colSpan={13} style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted, padding: '32px 0' }}>
                  No properties loaded — run the Atlanta Apartment Locator sync to populate the property database.
                </td></tr>
              )}
              {filteredProperties.length === 0 && allProperties.length > 0 && (
                <tr><td colSpan={13} style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted, padding: '20px 0' }}>
                  No properties match the current filters.
                </td></tr>
              )}
              {filteredProperties.map((prop) => {
                const isSelected = selectedRows.has(prop.id);
                const heatBg = getHeatmapColor(prop);
                const jediColors = scoreColor(prop.jedi);
                const motivColors = scoreColor(prop.sellerMotivation);

                return (
                  <React.Fragment key={prop.id}>
                    <tr
                      style={{
                        borderBottom: `1px solid ${BT.border.subtle}`,
                        cursor: 'pointer',
                        background: heatBg,
                      }}
                      onClick={() => onSelectProperty?.(prop.property.toLowerCase().replace(/\s+/g, '-'), prop.property)}
                    >
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            const next = new Set(selectedRows);
                            if (isSelected) {
                              next.delete(prop.id);
                            } else {
                              next.add(prop.id);
                            }
                            setSelectedRows(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ ...terminalStyles.tableCell, fontWeight: 600 }}>{prop.property}</td>
                      <td style={{ ...terminalStyles.tableCell, color: BT.text.muted }}>{prop.submarket}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{prop.units}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>{prop.year}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 6px',
                          background: BT.bg.elevated,
                          borderRadius: 0,
                          fontSize: 11,
                        }}>
                          {prop.class}
                        </span>
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{prop.rent}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{prop.occ}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          background: jediColors.btBg,
                          color: jediColors.btText,
                          borderRadius: 0,
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {prop.jedi}
                        </span>
                      </td>
                      <td style={{ ...terminalStyles.tableCell, color: BT.text.muted, fontSize: 11 }}>{prop.owner}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{prop.holdPeriod}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 6px',
                          background: motivColors.btBg,
                          color: motivColors.btText,
                          borderRadius: 0,
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {prop.sellerMotivation}
                        </span>
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.accent.amber }}>{prop.lossToLease}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{prop.pricePerUnit}</td>
                    </tr>

                  </React.Fragment>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      </div>

      {/* Footer Stats */}
      <div style={{
        display: 'flex',
        gap: 24,
        padding: '12px 16px',
        background: BT.bg.card,
        borderRadius: 0,
        border: `1px solid ${BT.border.subtle}`,
        fontSize: 11,
      }}>
        <div>
          <span style={{ color: BT.text.muted }}>Total Units: </span>
          <span style={{ fontWeight: 600 }}>{filteredProperties.reduce((sum, p) => sum + p.units, 0).toLocaleString()}</span>
        </div>
        <div>
          <span style={{ color: BT.text.muted }}>Avg JEDI: </span>
          <span style={{ fontWeight: 600, color: BT.text.green }}>
            {Math.round(filteredProperties.reduce((sum, p) => sum + p.jedi, 0) / filteredProperties.length || 0)}
          </span>
        </div>
        <div>
          <span style={{ color: BT.text.muted }}>Avg LTL: </span>
          <span style={{ fontWeight: 600, color: BT.accent.amber }}>
            {(filteredProperties.reduce((sum, p) => sum + parseFloat(p.lossToLeasePct), 0) / filteredProperties.length || 0).toFixed(1)}%
          </span>
        </div>
        <div style={{ marginLeft: 'auto', color: BT.text.cyan }}>
          {selectedRows.size > 0 && `${selectedRows.size} selected · `}
          Export includes all filtered properties
        </div>
      </div>

      </div>

      {/* Right Side Panel — Commentary */}
      <div style={{
        width: 322,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
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
          <>
            {commentary.signalCommentary?.segment_analysis && (
              <div style={{ ...terminalStyles.card, padding: 16 }}>
                <SignalCommentary signalKey="demand" commentary={commentary.signalCommentary.segment_analysis} compact />
              </div>
            )}
            {commentary.signalCommentary?.supply && (
              <div style={{ ...terminalStyles.card, padding: 16 }}>
                <SignalCommentary signalKey="supply" commentary={commentary.signalCommentary.supply} compact />
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default MSAPropertiesTab;
