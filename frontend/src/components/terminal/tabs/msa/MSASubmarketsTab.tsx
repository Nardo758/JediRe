/**
 * MSASubmarketsTab - Comprehensive submarket matrix with drill-down
 * Integrated from pre-Bloomberg SubmarketsTab (30KB)
 * Features: 14-column matrix, Dev Capacity signals, Compare mode, Signal sections
 */

import React, { useState, useMemo } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { 
  SIGNAL_GROUPS, 
  SignalGroupId, 
  BT_SIGNAL_COLORS, 
  scoreColor,
  ALL_OUTPUTS 
} from '../../signalGroups';

interface MSASubmarketsTabProps {
  msaId: string;
  msa: any;
  onSelectSubmarket?: (submarketId: string) => void;
}

// Column definitions matching pre-Bloomberg
const TABLE_COLUMNS = [
  { key: 'jedi', label: 'JEDI', code: 'C-01', isNew: false },
  { key: 'demand', label: 'Demand', code: 'D-09', isNew: false },
  { key: 'supply', label: 'Supply', code: 'S-01', isNew: false },
  { key: 'saturation', label: 'Satur.', code: 'S-08', isNew: false },
  { key: 'rentAccel', label: 'Rent Acc', code: 'M-02', isNew: false },
  { key: 'trfcRent', label: 'Trfc-Rent', code: 'M-07', isNew: false },
  { key: 'capacity', label: 'Capacity★', code: 'DC-01', isNew: true },
  { key: 'buildout', label: 'Buildout★', code: 'DC-02', isNew: true },
  { key: 'constraint', label: 'Constr.★', code: 'DC-03', isNew: true },
  { key: 'overhang', label: 'Overh.★', code: 'DC-04', isNew: true },
  { key: 'lastMover', label: 'Last M.★', code: 'DC-05', isNew: true },
  { key: 'pricingPower', label: 'Pricing★', code: 'DC-07', isNew: true },
  { key: 'traffic', label: 'Traffic★', code: 'T-02', isNew: true },
];

// Map layers for choropleth
const MAP_LAYERS = [
  { key: 'JEDI', label: 'JEDI', isNew: false },
  { key: 'Demand', label: 'Demand', isNew: false },
  { key: 'Supply Risk', label: 'Supply Risk', isNew: false },
  { key: 'Rent Growth', label: 'Rent Growth', isNew: false },
  { key: 'Cap Rate', label: 'Cap Rate', isNew: false },
  { key: 'Pricing Power', label: 'Pricing Power ★', isNew: true },
  { key: 'Constraint', label: 'Constraint ★', isNew: true },
];

// Detail section definitions
const DETAIL_SECTIONS: { title: string; key: string; groupId: SignalGroupId; signals: string[] }[] = [
  { title: 'Demand', key: 'demand', groupId: 'DEMAND', signals: ['D-09', 'D-10', 'D-08'] },
  { title: 'Supply', key: 'supply', groupId: 'SUPPLY', signals: ['S-01', 'S-08', 'S-05'] },
  { title: 'Momentum', key: 'momentum', groupId: 'MOMENTUM', signals: ['M-02', 'M-07'] },
  { title: 'Dev Capacity★', key: 'devCapacity', groupId: 'DEV_CAPACITY', signals: ['DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-05', 'DC-07', 'DC-09'] },
  { title: 'Traffic★', key: 'traffic', groupId: 'TRAFFIC', signals: ['T-02', 'T-08'] },
];

// Mock submarket data
const MOCK_SUBMARKETS = [
  { 
    id: 'midtown', name: 'Midtown', 
    jedi: 82, demand: 78, supply: 18400, saturation: 0.85, 
    rentAccel: '+5.2%', trfcRent: 0.92,
    capacity: '28%', buildout: '6.8yr', constraint: 72, overhang: 'LOW', 
    lastMover: false, pricingPower: 78, traffic: 76,
    entryPrice: '$185K/unit',
    detail: {
      demand: { 'D-09': 78, 'D-10': 74, 'D-08': 82 },
      supply: { 'S-01': 18400, 'S-08': 0.85, 'S-05': 'Moderate' },
      momentum: { 'M-02': '+5.2%', 'M-07': 0.92 },
      devCapacity: { 'DC-01': '28%', 'DC-02': '6.8yr', 'DC-03': 72, 'DC-04': 'LOW', 'DC-05': 'No', 'DC-07': 78, 'DC-09': 24 },
      traffic: { 'T-02': 76, 'T-08': 68 },
    }
  },
  { 
    id: 'buckhead', name: 'Buckhead', 
    jedi: 78, demand: 72, supply: 24200, saturation: 1.02, 
    rentAccel: '+3.8%', trfcRent: 0.84,
    capacity: '22%', buildout: '5.4yr', constraint: 68, overhang: 'MOD', 
    lastMover: false, pricingPower: 72, traffic: 81,
    entryPrice: '$245K/unit',
    detail: {
      demand: { 'D-09': 72, 'D-10': 70, 'D-08': 74 },
      supply: { 'S-01': 24200, 'S-08': 1.02, 'S-05': 'High' },
      momentum: { 'M-02': '+3.8%', 'M-07': 0.84 },
      devCapacity: { 'DC-01': '22%', 'DC-02': '5.4yr', 'DC-03': 68, 'DC-04': 'MOD', 'DC-05': 'No', 'DC-07': 72, 'DC-09': 18 },
      traffic: { 'T-02': 81, 'T-08': 74 },
    }
  },
  { 
    id: 'ofw', name: 'Old Fourth Ward', 
    jedi: 86, demand: 84, supply: 8900, saturation: 0.72, 
    rentAccel: '+6.1%', trfcRent: 0.96,
    capacity: '42%', buildout: '9.2yr', constraint: 58, overhang: 'LOW', 
    lastMover: true, pricingPower: 82, traffic: 68,
    entryPrice: '$165K/unit',
    detail: {
      demand: { 'D-09': 84, 'D-10': 80, 'D-08': 88 },
      supply: { 'S-01': 8900, 'S-08': 0.72, 'S-05': 'Sparse' },
      momentum: { 'M-02': '+6.1%', 'M-07': 0.96 },
      devCapacity: { 'DC-01': '42%', 'DC-02': '9.2yr', 'DC-03': 58, 'DC-04': 'LOW', 'DC-05': 'Yes★', 'DC-07': 82, 'DC-09': 38 },
      traffic: { 'T-02': 68, 'T-08': 62 },
    }
  },
  { 
    id: 'decatur', name: 'Decatur', 
    jedi: 74, demand: 68, supply: 12100, saturation: 0.88, 
    rentAccel: '+4.2%', trfcRent: 0.78,
    capacity: '35%', buildout: '7.6yr', constraint: 62, overhang: 'MOD', 
    lastMover: false, pricingPower: 68, traffic: 58,
    entryPrice: '$142K/unit',
    detail: {
      demand: { 'D-09': 68, 'D-10': 64, 'D-08': 72 },
      supply: { 'S-01': 12100, 'S-08': 0.88, 'S-05': 'Moderate' },
      momentum: { 'M-02': '+4.2%', 'M-07': 0.78 },
      devCapacity: { 'DC-01': '35%', 'DC-02': '7.6yr', 'DC-03': 62, 'DC-04': 'MOD', 'DC-05': 'No', 'DC-07': 68, 'DC-09': 28 },
      traffic: { 'T-02': 58, 'T-08': 52 },
    }
  },
  { 
    id: 'sandy-springs', name: 'Sandy Springs', 
    jedi: 71, demand: 64, supply: 15600, saturation: 0.94, 
    rentAccel: '+2.9%', trfcRent: 0.72,
    capacity: '18%', buildout: '4.8yr', constraint: 76, overhang: 'LOW', 
    lastMover: false, pricingPower: 74, traffic: 72,
    entryPrice: '$178K/unit',
    detail: {
      demand: { 'D-09': 64, 'D-10': 62, 'D-08': 66 },
      supply: { 'S-01': 15600, 'S-08': 0.94, 'S-05': 'Low' },
      momentum: { 'M-02': '+2.9%', 'M-07': 0.72 },
      devCapacity: { 'DC-01': '18%', 'DC-02': '4.8yr', 'DC-03': 76, 'DC-04': 'LOW', 'DC-05': 'No', 'DC-07': 74, 'DC-09': 12 },
      traffic: { 'T-02': 72, 'T-08': 68 },
    }
  },
  { 
    id: 'east-atlanta', name: 'East Atlanta', 
    jedi: 79, demand: 76, supply: 6200, saturation: 0.68, 
    rentAccel: '+5.8%', trfcRent: 0.88,
    capacity: '52%', buildout: '11.4yr', constraint: 48, overhang: 'LOW', 
    lastMover: true, pricingPower: 76, traffic: 54,
    entryPrice: '$128K/unit',
    detail: {
      demand: { 'D-09': 76, 'D-10': 72, 'D-08': 80 },
      supply: { 'S-01': 6200, 'S-08': 0.68, 'S-05': 'Sparse' },
      momentum: { 'M-02': '+5.8%', 'M-07': 0.88 },
      devCapacity: { 'DC-01': '52%', 'DC-02': '11.4yr', 'DC-03': 48, 'DC-04': 'LOW', 'DC-05': 'Yes★', 'DC-07': 76, 'DC-09': 42 },
      traffic: { 'T-02': 54, 'T-08': 48 },
    }
  },
];

export const MSASubmarketsTab: React.FC<MSASubmarketsTabProps> = ({ msaId, msa, onSelectSubmarket }) => {
  const [activeLayer, setActiveLayer] = useState('JEDI');
  const [expandedSubmarket, setExpandedSubmarket] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState('jedi');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const msaName = msa?.name || msaId || 'Atlanta';

  // Sort submarkets
  const sortedSubmarkets = useMemo(() => {
    return [...MOCK_SUBMARKETS].sort((a, b) => {
      const aVal = (a as any)[sortCol];
      const bVal = (b as any)[sortCol];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [sortCol, sortDir]);

  const toggleCompare = (id: string) => {
    setCompareSelection(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  // Helper to render cell content
  const renderCell = (sub: typeof MOCK_SUBMARKETS[0], key: string) => {
    const val = (sub as any)[key];
    switch (key) {
      case 'jedi':
      case 'demand':
      case 'constraint':
      case 'pricingPower':
      case 'traffic': {
        const colors = scoreColor(val);
        return (
          <span style={{
            padding: '2px 8px',
            borderRadius: 0,
            background: colors.btBg,
            color: colors.btText,
            fontSize: 11,
            fontWeight: 700,
          }}>
            {val}
          </span>
        );
      }
      case 'supply':
        return <span style={{ color: BT.text.secondary }}>{val.toLocaleString()}</span>;
      case 'saturation':
        const satColors = val > 1 ? { bg: 'rgba(239,68,68,0.15)', text: BT.accent.red } : { bg: 'rgba(34,197,94,0.15)', text: BT.text.green };
        return (
          <span style={{
            padding: '2px 6px',
            borderRadius: 0,
            background: satColors.bg,
            color: satColors.text,
            fontSize: 11,
          }}>
            {val.toFixed(2)}
          </span>
        );
      case 'rentAccel':
        return <span style={{ color: BT.text.green, fontWeight: 600 }}>{val}</span>;
      case 'trfcRent':
        return <span style={{ color: BT.text.secondary }}>{val.toFixed(2)}</span>;
      case 'capacity':
      case 'buildout':
        return <span style={{ color: BT.text.violet, fontWeight: 500 }}>{val}</span>;
      case 'overhang':
        const ohColors = val === 'LOW' ? { bg: 'rgba(34,197,94,0.15)', text: BT.text.green } : { bg: 'rgba(245,158,11,0.15)', text: BT.accent.amber };
        return (
          <span style={{
            padding: '2px 6px',
            borderRadius: 0,
            background: ohColors.bg,
            color: ohColors.text,
            fontSize: 10,
            fontWeight: 600,
          }}>
            {val}
          </span>
        );
      case 'lastMover':
        return val 
          ? <span style={{ color: BT.text.violet, fontWeight: 700, fontSize: 11 }}>Yes★</span>
          : <span style={{ color: BT.text.muted, fontSize: 11 }}>No</span>;
      default:
        return <span>{String(val)}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Submarket Analysis
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            14 metrics · Click row to expand · Select up to 3 to compare
          </span>
        </div>
        {compareSelection.length > 0 && (
          <button style={{
            padding: '8px 16px',
            background: BT.accent.blue,
            color: '#fff',
            border: 'none',
            borderRadius: 0,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Compare ({compareSelection.length})
          </button>
        )}
      </div>

      {/* Map Layer Toggle */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MAP_LAYERS.map(layer => (
          <button
            key={layer.key}
            onClick={() => setActiveLayer(layer.key)}
            style={{
              padding: '6px 12px',
              background: activeLayer === layer.key ? BT.accent.blue : BT.bg.elevated,
              color: activeLayer === layer.key ? '#fff' : BT.text.secondary,
              border: 'none',
              borderRadius: 0,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {layer.label}
            {layer.isNew && <span style={{ marginLeft: 4, color: BT.text.violet }}>★</span>}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div style={{ ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead>
              <tr style={{ background: BT.bg.elevated }}>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'center', width: 40 }}>
                  <input type="checkbox" disabled style={{ opacity: 0.3 }} />
                </th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', minWidth: 120 }}>
                  Submarket
                </th>
                {TABLE_COLUMNS.map(col => (
                  <th 
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{ 
                      ...terminalStyles.tableHeader, 
                      textAlign: 'center',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {col.label}
                        {sortCol === col.key && (
                          <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </span>
                      <span style={{ 
                        fontSize: 9, 
                        color: col.isNew ? BT.text.violet : BT.text.cyan,
                        fontFamily: 'monospace',
                      }}>
                        {col.code}
                      </span>
                    </div>
                  </th>
                ))}
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right', minWidth: 80 }}>
                  Entry Price
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSubmarkets.map((sub, i) => (
                <React.Fragment key={sub.id}>
                  <tr 
                    style={{ 
                      borderBottom: `1px solid ${BT.border.subtle}`,
                      cursor: 'pointer',
                      background: expandedSubmarket === sub.id ? BT.bg.elevated : 'transparent',
                    }}
                    onClick={() => setExpandedSubmarket(expandedSubmarket === sub.id ? null : sub.id)}
                  >
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={compareSelection.includes(sub.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleCompare(sub.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ ...terminalStyles.tableCell, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {sub.name}
                        {sub.lastMover && (
                          <span style={{
                            fontSize: 9,
                            color: BT.text.violet,
                            background: 'rgba(139,92,246,0.15)',
                            padding: '1px 4px',
                            borderRadius: 0,
                          }}>
                            Last Mover
                          </span>
                        )}
                      </div>
                    </td>
                    {TABLE_COLUMNS.map(col => (
                      <td key={col.key} style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                        {renderCell(sub, col.key)}
                      </td>
                    ))}
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontWeight: 600 }}>
                      {sub.entryPrice}
                    </td>
                  </tr>
                  
                  {/* Expanded Detail Row */}
                  {expandedSubmarket === sub.id && (
                    <tr>
                      <td colSpan={TABLE_COLUMNS.length + 3} style={{ padding: 0 }}>
                        <div style={{ 
                          padding: 20, 
                          background: BT.bg.elevated,
                          borderBottom: `2px solid ${BT.accent.blue}`,
                        }}>
                          <div style={{ display: 'flex', gap: 20 }}>
                            {DETAIL_SECTIONS.map(section => {
                              const btColor = BT_SIGNAL_COLORS[section.groupId];
                              return (
                                <div key={section.key} style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontSize: 11, 
                                    fontWeight: 700, 
                                    color: btColor.primary,
                                    marginBottom: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}>
                                    {section.title}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {section.signals.map(sig => {
                                      const detailVal = (sub.detail as any)[section.key]?.[sig];
                                      return (
                                        <div key={sig} style={{ 
                                          display: 'flex', 
                                          justifyContent: 'space-between',
                                          fontSize: 11,
                                        }}>
                                          <span style={{ 
                                            color: BT.text.muted,
                                            fontFamily: 'monospace',
                                          }}>
                                            {sig}
                                          </span>
                                          <span style={{ color: BT.text.primary, fontWeight: 500 }}>
                                            {detailVal ?? '—'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {/* Action Buttons */}
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: 8,
                              justifyContent: 'center',
                            }}>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectSubmarket?.(sub.id);
                                }}
                                style={{
                                  padding: '8px 16px',
                                  background: BT.accent.blue,
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 0,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                View Terminal →
                              </button>
                              <button style={{
                                padding: '8px 16px',
                                background: 'transparent',
                                color: BT.text.secondary,
                                border: `1px solid ${BT.border.subtle}`,
                                borderRadius: 0,
                                fontSize: 11,
                                cursor: 'pointer',
                              }}>
                                View Properties
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ 
            fontSize: 10, 
            color: BT.text.violet,
            background: 'rgba(139,92,246,0.15)',
            padding: '2px 6px',
            borderRadius: 0,
            fontWeight: 600,
          }}>
            ★
          </span>
          <span style={{ fontSize: 11, color: BT.text.muted }}>
            Dev Capacity & Traffic Engine signals (new)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ 
            fontSize: 10, 
            color: BT.text.violet,
            fontWeight: 600,
          }}>
            Last Mover
          </span>
          <span style={{ fontSize: 11, color: BT.text.muted }}>
            Capacity &lt;15% + Active development = pricing power advantage
          </span>
        </div>
      </div>
    </div>
  );
};

export default MSASubmarketsTab;
