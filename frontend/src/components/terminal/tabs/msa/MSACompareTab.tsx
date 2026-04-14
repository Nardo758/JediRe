/**
 * MSACompareTab - Full market comparison matrix
 * Integrated from pre-Bloomberg CompareMarketsPage (24KB)
 * Features: 24 metrics across 6 categories, signal groups, heat mapping
 * Metrics are driven by the column catalog — add/remove via the gear picker.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { DataTable } from '../../TerminalLayouts';
import { SIGNAL_GROUPS, BT_SIGNAL_COLORS, SignalGroupId } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { PeerContext, SignalCommentary } from '../../commentary';
import { useColumnPreferences } from '../../../../hooks/useColumnPreferences';
import { ColumnPicker } from '../../ColumnPicker';

interface MSACompareTabProps {
  msaId: string;
  msa: any;
}

interface MarketData {
  id: string;
  name: string;
  state: string;
  selected: boolean;
}

type MetricValue = { value: string; raw: number };

// Markets to compare
const MARKETS: MarketData[] = [
  { id: 'atlanta', name: 'Atlanta', state: 'GA', selected: true },
  { id: 'charlotte', name: 'Charlotte', state: 'NC', selected: true },
  { id: 'nashville', name: 'Nashville', state: 'TN', selected: true },
  { id: 'tampa', name: 'Tampa', state: 'FL', selected: false },
  { id: 'raleigh', name: 'Raleigh', state: 'NC', selected: false },
  { id: 'dallas', name: 'Dallas', state: 'TX', selected: false },
];

// Metric data by market — keyed by metric catalog ID
const MOCK_DATA: Record<string, Record<string, MetricValue>> = {
  'D-01 Jobs/Apt':       { atlanta: { value: '3.8', raw: 3.8 }, charlotte: { value: '3.5', raw: 3.5 }, nashville: { value: '3.2', raw: 3.2 }, tampa: { value: '2.9', raw: 2.9 }, raleigh: { value: '4.1', raw: 4.1 }, dallas: { value: '3.4', raw: 3.4 } },
  'D-02 New Jobs/Unit':  { atlanta: { value: '2.4', raw: 2.4 }, charlotte: { value: '2.1', raw: 2.1 }, nashville: { value: '1.8', raw: 1.8 }, tampa: { value: '1.5', raw: 1.5 }, raleigh: { value: '2.6', raw: 2.6 }, dallas: { value: '2.0', raw: 2.0 } },
  'D-03 Migration':      { atlanta: { value: '+48K', raw: 48 }, charlotte: { value: '+32K', raw: 32 }, nashville: { value: '+28K', raw: 28 }, tampa: { value: '+52K', raw: 52 }, raleigh: { value: '+22K', raw: 22 }, dallas: { value: '+65K', raw: 65 } },
  'D-09 Momentum':       { atlanta: { value: '82', raw: 82 }, charlotte: { value: '78', raw: 78 }, nashville: { value: '71', raw: 71 }, tampa: { value: '74', raw: 74 }, raleigh: { value: '76', raw: 76 }, dallas: { value: '69', raw: 69 } },
  'D-10 Gravity':        { atlanta: { value: '76', raw: 76 }, charlotte: { value: '68', raw: 68 }, nashville: { value: '72', raw: 72 }, tampa: { value: '64', raw: 64 }, raleigh: { value: '71', raw: 71 }, dallas: { value: '74', raw: 74 } },
  'D-11 Rent-Mort':      { atlanta: { value: '-18%', raw: 18 }, charlotte: { value: '-22%', raw: 22 }, nashville: { value: '-15%', raw: 15 }, tampa: { value: '-20%', raw: 20 }, raleigh: { value: '-24%', raw: 24 }, dallas: { value: '-19%', raw: 19 } },
  'S-04 Absorption':     { atlanta: { value: '28.4mo', raw: 28.4 }, charlotte: { value: '22.1mo', raw: 22.1 }, nashville: { value: '34.8mo', raw: 34.8 }, tampa: { value: '18.2mo', raw: 18.2 }, raleigh: { value: '16.4mo', raw: 16.4 }, dallas: { value: '30.2mo', raw: 30.2 } },
  'S-05 Clusters':       { atlanta: { value: '3 zones', raw: 3 }, charlotte: { value: '2 zones', raw: 2 }, nashville: { value: '4 zones', raw: 4 }, tampa: { value: '1 zone', raw: 1 }, raleigh: { value: '1 zone', raw: 1 }, dallas: { value: '3 zones', raw: 3 } },
  'S-06 Permit Mom':     { atlanta: { value: '+8%', raw: 8 }, charlotte: { value: '-4%', raw: -4 }, nashville: { value: '+22%', raw: 22 }, tampa: { value: '-12%', raw: -12 }, raleigh: { value: '-8%', raw: -8 }, dallas: { value: '+12%', raw: 12 } },
  'S-08 Saturation':     { atlanta: { value: '6.2%', raw: 6.2 }, charlotte: { value: '5.4%', raw: 5.4 }, nashville: { value: '8.1%', raw: 8.1 }, tampa: { value: '4.8%', raw: 4.8 }, raleigh: { value: '3.8%', raw: 3.8 }, dallas: { value: '7.2%', raw: 7.2 } },
  'M-01 Avg Rent':       { atlanta: { value: '$1,680', raw: 1680 }, charlotte: { value: '$1,540', raw: 1540 }, nashville: { value: '$1,720', raw: 1720 }, tampa: { value: '$1,620', raw: 1620 }, raleigh: { value: '$1,480', raw: 1480 }, dallas: { value: '$1,580', raw: 1580 } },
  'M-02 Rent Accel':     { atlanta: { value: '+0.8%', raw: 0.8 }, charlotte: { value: '+1.2%', raw: 1.2 }, nashville: { value: '-0.4%', raw: -0.4 }, tampa: { value: '+0.6%', raw: 0.6 }, raleigh: { value: '+1.4%', raw: 1.4 }, dallas: { value: '-0.2%', raw: -0.2 } },
  'M-05 Rent vs Wage':   { atlanta: { value: '+1.2%', raw: 1.2 }, charlotte: { value: '+0.8%', raw: 0.8 }, nashville: { value: '-0.6%', raw: -0.6 }, tampa: { value: '+0.4%', raw: 0.4 }, raleigh: { value: '+1.0%', raw: 1.0 }, dallas: { value: '-0.3%', raw: -0.3 } },
  'M-06 Occupancy':      { atlanta: { value: '94.2%', raw: 94.2 }, charlotte: { value: '95.1%', raw: 95.1 }, nashville: { value: '92.8%', raw: 92.8 }, tampa: { value: '94.8%', raw: 94.8 }, raleigh: { value: '95.4%', raw: 95.4 }, dallas: { value: '93.6%', raw: 93.6 } },
  'DC-01 Capacity':      { atlanta: { value: '32%', raw: 32 }, charlotte: { value: '28%', raw: 28 }, nashville: { value: '48%', raw: 48 }, tampa: { value: '18%', raw: 18 }, raleigh: { value: '22%', raw: 22 }, dallas: { value: '42%', raw: 42 } },
  'DC-02 Buildout':      { atlanta: { value: '8.6yr', raw: 8.6 }, charlotte: { value: '6.2yr', raw: 6.2 }, nashville: { value: '14.8yr', raw: 14.8 }, tampa: { value: '4.2yr', raw: 4.2 }, raleigh: { value: '5.8yr', raw: 5.8 }, dallas: { value: '12.4yr', raw: 12.4 } },
  'DC-03 Constraint':    { atlanta: { value: '58', raw: 58 }, charlotte: { value: '62', raw: 62 }, nashville: { value: '38', raw: 38 }, tampa: { value: '74', raw: 74 }, raleigh: { value: '68', raw: 68 }, dallas: { value: '44', raw: 44 } },
  'DC-04 Overhang':      { atlanta: { value: '22%', raw: 22 }, charlotte: { value: '18%', raw: 18 }, nashville: { value: '34%', raw: 34 }, tampa: { value: '12%', raw: 12 }, raleigh: { value: '14%', raw: 14 }, dallas: { value: '28%', raw: 28 } },
  'DC-07 Pricing Power': { atlanta: { value: '72', raw: 72 }, charlotte: { value: '68', raw: 68 }, nashville: { value: '52', raw: 52 }, tampa: { value: '78', raw: 78 }, raleigh: { value: '74', raw: 74 }, dallas: { value: '58', raw: 58 } },
  'DC-08 Supply Wave':   { atlanta: { value: 'BUILDING', raw: 2 }, charlotte: { value: 'PAST PEAK', raw: 3 }, nashville: { value: 'PEAKING', raw: 1 }, tampa: { value: 'TROUGH', raw: 4 }, raleigh: { value: 'TROUGH', raw: 4 }, dallas: { value: 'PEAKING', raw: 1 } },
  'DC-11 Adj Rent':      { atlanta: { value: '+4.6%', raw: 4.6 }, charlotte: { value: '+4.2%', raw: 4.2 }, nashville: { value: '+2.4%', raw: 2.4 }, tampa: { value: '+5.1%', raw: 5.1 }, raleigh: { value: '+5.4%', raw: 5.4 }, dallas: { value: '+3.2%', raw: 3.2 } },
  'T-02 Physical avg':   { atlanta: { value: '68', raw: 68 }, charlotte: { value: '62', raw: 62 }, nashville: { value: '58', raw: 58 }, tampa: { value: '72', raw: 72 }, raleigh: { value: '64', raw: 64 }, dallas: { value: '66', raw: 66 } },
  'T-03 Digital avg':    { atlanta: { value: '74', raw: 74 }, charlotte: { value: '70', raw: 70 }, nashville: { value: '66', raw: 66 }, tampa: { value: '68', raw: 68 }, raleigh: { value: '72', raw: 72 }, dallas: { value: '64', raw: 64 } },
  'R-01 Affordability':  { atlanta: { value: '32%', raw: 32 }, charlotte: { value: '28%', raw: 28 }, nashville: { value: '35%', raw: 35 }, tampa: { value: '38%', raw: 38 }, raleigh: { value: '26%', raw: 26 }, dallas: { value: '30%', raw: 30 } },
  'R-03 Concession Drag': { atlanta: { value: '2.4%', raw: 2.4 }, charlotte: { value: '1.8%', raw: 1.8 }, nashville: { value: '4.2%', raw: 4.2 }, tampa: { value: '1.2%', raw: 1.2 }, raleigh: { value: '1.4%', raw: 1.4 }, dallas: { value: '3.6%', raw: 3.6 } },
};

// Full metric sections — rows are metric catalog IDs
const METRIC_SECTIONS: { label: string; groupId: SignalGroupId; rows: string[]; higherBetter: boolean[] }[] = [
  { label: 'Demand',        groupId: 'DEMAND',       rows: ['D-01 Jobs/Apt', 'D-02 New Jobs/Unit', 'D-03 Migration', 'D-09 Momentum', 'D-10 Gravity', 'D-11 Rent-Mort'], higherBetter: [true, true, true, true, true, true] },
  { label: 'Supply',        groupId: 'SUPPLY',       rows: ['S-04 Absorption', 'S-05 Clusters', 'S-06 Permit Mom', 'S-08 Saturation'],                                 higherBetter: [false, false, false, false] },
  { label: 'Momentum',      groupId: 'MOMENTUM',     rows: ['M-01 Avg Rent', 'M-02 Rent Accel', 'M-05 Rent vs Wage', 'M-06 Occupancy'],                                higherBetter: [true, true, true, true] },
  { label: 'Dev Capacity ★',groupId: 'DEV_CAPACITY', rows: ['DC-01 Capacity', 'DC-02 Buildout', 'DC-03 Constraint', 'DC-04 Overhang', 'DC-07 Pricing Power', 'DC-08 Supply Wave', 'DC-11 Adj Rent'], higherBetter: [false, false, true, false, true, true, true] },
  { label: 'Traffic ★',     groupId: 'TRAFFIC',      rows: ['T-02 Physical avg', 'T-03 Digital avg'],                                                                  higherBetter: [true, true] },
  { label: 'Risk',          groupId: 'RISK',         rows: ['R-01 Affordability', 'R-03 Concession Drag'],                                                             higherBetter: [false, false] },
];

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };

export const MSACompareTab: React.FC<MSACompareTabProps> = ({ msaId, msa }) => {
  const [markets, setMarkets] = useState(MARKETS);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const msaName = msa?.name || msaId || 'Atlanta';

  // ── Column / metric preferences ──────────────────────────────────────────
  const { columns: activeMetrics, toggleColumn, reorderColumns, resetToDefaults, isDefault } = useColumnPreferences('msa_compare');
  const activeSet = useMemo(() => new Set(activeMetrics), [activeMetrics]);

  // ── Commentary ───────────────────────────────────────────────────────────
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);

  const selectedMarkets = markets.filter(m => m.selected);

  const toggleMarket = (id: string) => {
    setMarkets(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  };

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  // Build visible sections — only include rows that are in activeMetrics
  const visibleSections = useMemo(() => {
    return METRIC_SECTIONS.map(section => {
      const visibleIdxs: number[] = [];
      const visibleRows: string[] = [];
      const visibleHB: boolean[] = [];
      section.rows.forEach((row, i) => {
        if (activeSet.has(row)) {
          visibleIdxs.push(i);
          visibleRows.push(row);
          visibleHB.push(section.higherBetter[i]);
        }
      });
      return { ...section, rows: visibleRows, higherBetter: visibleHB };
    }).filter(s => s.rows.length > 0);
  }, [activeSet]);

  const totalVisible = useMemo(() => visibleSections.reduce((s, sec) => s + sec.rows.length, 0), [visibleSections]);

  // Best/worst per metric across selected markets
  const getBestWorst = (metric: string, higherBetter: boolean) => {
    const values = selectedMarkets.map(m => ({ id: m.id, raw: MOCK_DATA[metric]?.[m.id]?.raw || 0 }));
    const sorted = [...values].sort((a, b) => higherBetter ? b.raw - a.raw : a.raw - b.raw);
    return { best: sorted[0]?.id, worst: sorted[sorted.length - 1]?.id };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>Market Comparison Matrix</h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            {selectedMarkets.length} markets · {totalVisible} metrics across {visibleSections.length} signal groups
            {!isDefault && <span style={{ color: BT.accent.amber, marginLeft: 8 }}>· custom</span>}
          </span>
        </div>

        {/* Metric Picker Gear */}
        <button
          onClick={() => setPickerOpen(v => !v)}
          title="Add / remove metrics"
          style={{
            ...mono,
            fontSize: 10,
            padding: '4px 12px',
            background: pickerOpen ? BT.bg.active : 'transparent',
            color: pickerOpen ? BT.accent.amber : BT.text.muted,
            border: `1px solid ${pickerOpen ? BT.accent.amber + '44' : BT.border.subtle}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <span>⚙</span>
          <span>METRICS</span>
          <span style={{ color: BT.text.dim, fontSize: 9 }}>({totalVisible}/{Object.keys(MOCK_DATA).length})</span>
        </button>
      </div>

      {/* Inline Metric Picker */}
      {pickerOpen && (
        <div style={{ position: 'relative', zIndex: 100 }}>
          <ColumnPicker
            viewId="msa_compare"
            activeColumns={activeMetrics}
            onToggle={toggleColumn}
            onReorder={reorderColumns}
            onReset={resetToDefaults}
            onClose={() => setPickerOpen(false)}
            isDefault={isDefault}
          />
        </div>
      )}

      {/* Market Selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {markets.map(m => (
          <button
            key={m.id}
            onClick={() => toggleMarket(m.id)}
            style={{
              padding: '8px 16px',
              background: m.selected ? BT.accent.blue : BT.bg.elevated,
              color: m.selected ? '#fff' : BT.text.secondary,
              border: 'none',
              borderRadius: 0,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {m.name}, {m.state}
          </button>
        ))}
      </div>

      {/* No metrics selected state */}
      {totalVisible === 0 && (
        <div style={{ ...terminalStyles.card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: BT.text.muted, marginBottom: 12 }}>No metrics selected</div>
          <button
            onClick={() => setPickerOpen(true)}
            style={{ ...mono, fontSize: 10, padding: '6px 18px', background: BT.accent.amber + '22', color: BT.accent.amber, border: `1px solid ${BT.accent.amber}44`, cursor: 'pointer' }}
          >
            ⚙ Open Metric Picker
          </button>
        </div>
      )}

      {/* Comparison Table */}
      {totalVisible > 0 && (
        <div style={{ ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <DataTable style={{ minWidth: 600 }}>
              <thead>
                <tr style={{ background: BT.bg.elevated }}>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', minWidth: 200, position: 'sticky', left: 0, background: BT.bg.elevated, zIndex: 1 }}>
                    Metric
                    <span style={{ ...mono, fontSize: 8, color: BT.text.dim, marginLeft: 6, fontWeight: 400 }}>click section to collapse</span>
                  </th>
                  {selectedMarkets.map(m => (
                    <th key={m.id} style={{ ...terminalStyles.tableHeader, textAlign: 'center', minWidth: 100 }}>
                      <div style={{ fontWeight: 700 }}>{m.name}</div>
                      <div style={{ fontSize: 10, fontWeight: 400, color: BT.text.muted }}>{m.state}</div>
                    </th>
                  ))}
                  <th style={{ ...terminalStyles.tableHeader, width: 28, padding: '0 4px' }} />
                </tr>
              </thead>
              <tbody>
                {visibleSections.map(section => {
                  const btColor = BT_SIGNAL_COLORS[section.groupId];
                  const isCollapsed = collapsedSections.has(section.label);
                  return (
                    <React.Fragment key={section.label}>
                      {/* Section Header */}
                      <tr style={{ background: btColor.bg, cursor: 'pointer' }} onClick={() => toggleSection(section.label)}>
                        <td colSpan={selectedMarkets.length + 2} style={{ padding: '10px 12px', position: 'sticky', left: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: BT.text.muted, fontSize: 12 }}>{isCollapsed ? '▶' : '▼'}</span>
                            <span style={{ fontWeight: 700, color: btColor.primary, fontSize: 12 }}>{section.label}</span>
                            <span style={{ fontSize: 10, color: BT.text.muted }}>{section.rows.length} metrics</span>
                          </div>
                        </td>
                      </tr>

                      {/* Metric Rows */}
                      {!isCollapsed && section.rows.map((metric, rowIdx) => {
                        const { best, worst } = getBestWorst(metric, section.higherBetter[rowIdx]);
                        return (
                          <tr key={metric} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                            <td style={{ ...terminalStyles.tableCell, position: 'sticky', left: 0, background: BT.bg.primary, fontSize: 11 }}>
                              <span style={{ color: BT.text.cyan, fontFamily: 'monospace', marginRight: 8 }}>
                                {metric.split(' ')[0]}
                              </span>
                              <span style={{ color: BT.text.secondary }}>
                                {metric.split(' ').slice(1).join(' ')}
                              </span>
                            </td>
                            {selectedMarkets.map(m => {
                              const data = MOCK_DATA[metric]?.[m.id];
                              const isBest = m.id === best;
                              const isWorst = m.id === worst && selectedMarkets.length > 1;
                              return (
                                <td key={m.id} style={{ ...terminalStyles.tableCell, textAlign: 'center', background: isBest ? 'rgba(34,197,94,0.1)' : isWorst ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                                  <span style={{ fontWeight: isBest ? 700 : 500, color: isBest ? BT.text.green : isWorst ? BT.accent.red : BT.text.primary }}>
                                    {data?.value || '—'}
                                  </span>
                                  {isBest && selectedMarkets.length > 1 && (
                                    <span style={{ marginLeft: 4, fontSize: 10, color: BT.text.green }}>★</span>
                                  )}
                                </td>
                              );
                            })}
                            {/* Remove button */}
                            <td style={{ ...terminalStyles.tableCell, textAlign: 'center', padding: '0 4px', width: 28 }}>
                              <button
                                onClick={() => toggleColumn(metric)}
                                title="Remove this metric"
                                style={{ background: 'transparent', border: 'none', color: BT.text.dim, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '2px 4px' }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {/* Add metric CTA when some are hidden */}
      {totalVisible < Object.keys(MOCK_DATA).length && totalVisible > 0 && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setPickerOpen(true)}
            style={{ ...mono, fontSize: 9, padding: '4px 14px', background: 'transparent', color: BT.text.muted, border: `1px dashed ${BT.border.subtle}`, cursor: 'pointer' }}
          >
            + Add metrics ({Object.keys(MOCK_DATA).length - totalVisible} hidden)
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {totalVisible > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selectedMarkets.length, 6)}, 1fr)`, gap: 12 }}>
          {selectedMarkets.map(m => {
            let wins = 0;
            visibleSections.forEach(section => {
              section.rows.forEach((metric, idx) => {
                const { best } = getBestWorst(metric, section.higherBetter[idx]);
                if (best === m.id) wins++;
              });
            });
            return (
              <div key={m.id} style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary }}>{m.name}</div>
                <div style={{ fontSize: 10, color: BT.text.muted }}>{m.state}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: wins > 8 ? BT.text.green : wins > 4 ? BT.accent.amber : BT.text.muted, marginTop: 8 }}>
                  {wins}
                </div>
                <div style={{ fontSize: 11, color: BT.text.muted }}>metrics won</div>
                <div style={{ marginTop: 8, padding: '4px 8px', background: wins > 8 ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', borderRadius: 0, fontSize: 10, color: wins > 8 ? BT.text.green : BT.text.muted }}>
                  {wins > 8 ? 'Strong performer' : wins > 4 ? 'Moderate' : 'Lagging'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section Legend */}
      {totalVisible > 0 && (
        <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: BT.bg.card, borderRadius: 0, border: `1px solid ${BT.border.subtle}`, fontSize: 11, flexWrap: 'wrap' }}>
          {METRIC_SECTIONS.map(section => {
            const btColor = BT_SIGNAL_COLORS[section.groupId];
            const visibleCount = section.rows.filter(r => activeSet.has(r)).length;
            return (
              <div key={section.label} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: visibleCount === 0 ? 0.35 : 1 }}>
                <span style={{ width: 10, height: 10, background: btColor.primary, borderRadius: 0, display: 'inline-block' }} />
                <span style={{ color: BT.text.muted }}>{section.label}</span>
                <span style={{ color: BT.text.dim, fontSize: 9 }}>({visibleCount}/{section.rows.length})</span>
              </div>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <span style={{ color: BT.text.green }}>★ Best</span>
            <span style={{ color: BT.text.muted }}>· × to remove row</span>
          </div>
        </div>
      )}

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
                currentScore={commentary.jediScore}
              />
            </div>
          )}
          {commentary.signalCommentary?.competitive_summary && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="demand" commentary={commentary.signalCommentary.competitive_summary} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MSACompareTab;
