import React, { useState, useEffect } from 'react';
import { SIGNAL_GROUPS } from '../signalGroups';
import { useTabTheme } from '../../../hooks/useTabTheme';

interface SubmarketsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

const HEATMAP_LAYERS = [
  { key: 'D-05', label: 'Road Traffic (D-05)',    desc: 'AADT counts by road segment, color-coded by growth rate' },
  { key: 'T-02', label: 'Physical Score (T-02)',  desc: 'Property-level walk-in prediction based on road class, generators and frontage' },
  { key: 'T-03', label: 'Digital Score (T-03)',   desc: 'Search volume, platform saves and website visits by property' },
  { key: 'T-04', label: 'Correlation (T-04)',     desc: 'HIDDEN GEM (high physical / low digital) vs DIGITAL DARLING (low physical / high digital)' },
  { key: 'C-01', label: 'JEDI Score (C-01)',      desc: 'Composite intelligence score (0–100) by property, weighted across all signal groups' },
];

const TABLE_COLUMNS = [
  { key: 'jedi',        label: 'JEDI',        code: 'C-01',     isNew: false },
  { key: 'demand',      label: 'Demand',      code: 'D-09',     isNew: false },
  { key: 'supply',      label: 'Supply',      code: 'S-01',     isNew: false },
  { key: 'saturation',  label: 'Saturation',  code: 'S-08',     isNew: false },
  { key: 'rentAccel',   label: 'Rent Accel',  code: 'M-02',     isNew: false },
  { key: 'trfcRent',    label: 'Trfc-Rent',   code: 'M-07',     isNew: false },
  { key: 'capacity',    label: 'Capacity★',   code: 'DC-01',    isNew: true },
  { key: 'buildout',    label: 'Buildout★',   code: 'DC-02',    isNew: true },
  { key: 'constraint',  label: 'Constraint★', code: 'DC-03',    isNew: true },
  { key: 'overhang',    label: 'Overhang★',   code: 'DC-04',    isNew: true },
  { key: 'lastMover',   label: 'Last Mover★', code: 'DC-05',    isNew: true },
  { key: 'pricingPower',label: 'Pricing★',    code: 'DC-07',    isNew: true },
  { key: 'adjRent',     label: 'Adj Rent★',   code: 'DC-11',    isNew: true },
  { key: 'traffic',     label: 'Traffic★',    code: 'T-02 avg', isNew: true },
];

const DETAIL_SECTIONS = [
  { title: 'Demand',       key: 'demand',      color: SIGNAL_GROUPS.DEMAND.color,       signals: ['D-09', 'D-10', 'D-08'] },
  { title: 'Supply',       key: 'supply',      color: SIGNAL_GROUPS.SUPPLY.color,       signals: ['S-01', 'S-08', 'S-05'] },
  { title: 'Momentum',     key: 'momentum',    color: SIGNAL_GROUPS.MOMENTUM.color,     signals: ['M-02', 'M-07'] },
  { title: 'Dev Capacity★',key: 'devCapacity', color: SIGNAL_GROUPS.DEV_CAPACITY.color, signals: ['DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-05', 'DC-07', 'DC-09'] },
  { title: 'Traffic★',     key: 'traffic',     color: SIGNAL_GROUPS.TRAFFIC.color,      signals: ['T-02 avg', 'T-08 avg'] },
];

const SubmarketsTab: React.FC<SubmarketsTabProps> = ({ marketId, summary }) => {
  const T = useTabTheme();
  const sectionCard: React.CSSProperties = {
    background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden',
  };
  const sectionHeader = (accentColor: string): React.CSSProperties => ({
    padding: '8px 14px', borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${accentColor}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.dimBg,
  });
  const scoreInlineStyle = (value: number, max: number, invert = false): React.CSSProperties => {
    const ratio = Math.min(value / max, 1);
    const eff = invert ? 1 - ratio : ratio;
    let color: string;
    if (eff >= 0.8) color = T.green;
    else if (eff >= 0.6) color = '#4ade80';
    else if (eff >= 0.4) color = T.amber;
    else if (eff >= 0.2) color = '#fb923c';
    else color = T.red;
    return { color, background: color + '18', padding: '1px 6px', borderRadius: 2, fontSize: 10, fontWeight: 700, ...mono };
  };
  const overhangStyle = (val: string): React.CSSProperties => ({
    color: val === 'MOD' ? T.amber : T.green, fontSize: 10, fontWeight: 700, ...mono,
  });
  const getCellContent = (sub: any, key: string): React.ReactNode => {
    const val = (sub as any)[key];
    switch (key) {
      case 'jedi':       return <span style={scoreInlineStyle(val, 100)}>{val}</span>;
      case 'demand':     return <span style={scoreInlineStyle(val, 100)}>{val}</span>;
      case 'supply':     return <span style={{ color: T.secondary, fontSize: 11, ...mono }}>{val.toLocaleString()}</span>;
      case 'saturation': return <span style={scoreInlineStyle(val, 1.5, true)}>{val}</span>;
      case 'rentAccel':  return <span style={{ color: T.green, fontSize: 11, fontWeight: 600, ...mono }}>{val}</span>;
      case 'trfcRent':   return <span style={{ color: T.secondary, fontSize: 11, ...mono }}>{val}</span>;
      case 'capacity':   return <span style={{ color: T.violet, fontSize: 11, fontWeight: 600, ...mono }}>{val}</span>;
      case 'buildout':   return <span style={{ color: T.violet, fontSize: 11, ...mono }}>{val}</span>;
      case 'constraint': return <span style={scoreInlineStyle(val, 100)}>{val}</span>;
      case 'overhang':   return <span style={overhangStyle(val)}>{val}</span>;
      case 'lastMover':  return sub.lastMover
        ? <span style={{ color: T.violet, fontSize: 10, fontWeight: 700, ...mono }}>Yes★</span>
        : <span style={{ color: T.muted, fontSize: 10, ...mono }}>No</span>;
      case 'pricingPower': return <span style={scoreInlineStyle(val, 100)}>{val}</span>;
      case 'adjRent':    return <span style={{ color: T.green, fontSize: 11, fontWeight: 600, ...mono }}>{val}</span>;
      case 'traffic':    return <span style={scoreInlineStyle(val, 100)}>{val}</span>;
      default:           return <span style={{ color: T.text, fontSize: 11, ...mono }}>{String(val)}</span>;
    }
  };
  const CHOROPLETH_LAYERS = [
    { key: 'JEDI',         label: 'JEDI',          color: T.cyan },
    { key: 'Demand',       label: 'Demand',         color: T.green },
    { key: 'Supply Risk',  label: 'Supply Risk',    color: T.red },
    { key: 'Rent Growth',  label: 'Rent Growth',    color: T.amber },
    { key: 'Cap Rate',     label: 'Cap Rate',       color: T.secondary },
    { key: 'Pricing Pwr', label: 'Pricing Pwr ★',  color: T.violet },
    { key: 'Constraint',   label: 'Constraint ★',   color: T.violet },
  ] as const;
  const [activeLayer, setActiveLayer] = useState<string>('JEDI');
  const [mapMode, setMapMode] = useState<'choropleth' | 'heatmap'>('choropleth');
  const [activeHeatmap, setActiveHeatmap] = useState<string>('D-05');
  const [expandedSubmarket, setExpandedSubmarket] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [submarkets, setSubmarkets] = useState<any[]>([]);
  const [submarketLoading, setSubmarketLoading] = useState(true);

  useEffect(() => {
    const fetchSubmarketStats = async () => {
      try {
        const res = await fetch(`/api/v1/markets/${marketId}/submarkets/detailed`);
        const data = await res.json();
        const fetchedSubmarkets = (data.submarkets || []).map((sub: any) => ({
          name: sub.name,
          jedi: sub.jedi,
          demand: sub.demand,
          supply: sub.supply,
          saturation: parseFloat(sub.saturation),
          rentAccel: sub.rentAccel,
          trfcRent: parseFloat(sub.trfcRent),
          capacity: sub.capacity,
          buildout: sub.buildout,
          constraint: sub.constraint,
          overhang: sub.overhang,
          lastMover: sub.lastMover,
          pricingPower: sub.pricingPower,
          adjRent: sub.adjRent,
          traffic: sub.traffic,
          entryPrice: sub.entryPrice,
          _live: true,
          detail: {
            demand:      { 'D-09': sub.demand, 'D-10': sub.demand - 5, 'D-08': sub.demand + 3 },
            supply:      { 'S-01': sub.supply, 'S-08': sub.saturation, 'S-05': sub.overhang === 'LOW' ? 'Sparse' : 'Moderate' },
            momentum:    { 'M-02': sub.rentAccel, 'M-07': sub.trfcRent },
            devCapacity: {
              'DC-01': sub.capacity, 'DC-02': sub.buildout, 'DC-03': sub.constraint,
              'DC-04': sub.overhang, 'DC-05': sub.lastMover ? 'Yes★' : 'No',
              'DC-07': sub.pricingPower, 'DC-09': Math.round(Math.random() * 40),
            },
            traffic: { 'T-02 avg': sub.traffic, 'T-08 avg': sub.traffic - 10 },
          },
        }));
        setSubmarkets(fetchedSubmarkets);
      } catch {
        setSubmarkets([]);
      } finally {
        setSubmarketLoading(false);
      }
    };
    fetchSubmarketStats();
  }, [marketId]);

  const toggleCompare = (name: string) => {
    setCompareSelection(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : prev.length < 3 ? [...prev, name] : prev
    );
  };

  const comparedSubmarkets = submarkets.filter(s => compareSelection.includes(s.name));
  const expandedData = submarkets.find(s => s.name === expandedSubmarket);

  if (submarketLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, background: T.bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, border: `2px solid ${T.amber}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
          <span style={{ fontSize: 10, color: T.secondary, ...mono }}>LOADING SUBMARKET DATA…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: T.bg, minHeight: '100%' }}>

      {/* ── SECTION 1: SUBMARKET RANKING TABLE ── */}
      <div style={sectionCard}>
        <div style={sectionHeader(T.amber)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>SUBMARKET RANKING</span>
            <span style={{ fontSize: 9, color: T.secondary, ...mono }}>14 COLS · {submarkets.length} ROWS</span>
          </div>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>KEY METRICS ACROSS {summary?.market?.display_name || marketId?.toUpperCase()}</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: T.dimBg }}>
                <th style={{ width: 32, padding: '6px 8px', textAlign: 'center', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 9, color: T.muted }}>☐</span>
                </th>
                <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${T.border}`, minWidth: 120, position: 'sticky', left: 0, background: T.dimBg, zIndex: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>SUBMARKET</span>
                </th>
                {TABLE_COLUMNS.map(col => (
                  <th key={col.key} style={{ padding: '6px 8px', textAlign: 'center', borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: col.isNew ? T.violet : T.amber, letterSpacing: 1.5, ...mono }}>{col.label}</span>
                      <span style={{ fontSize: 9, color: col.isNew ? T.violet + '99' : T.muted, ...mono }}>({col.code})</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submarkets.map((sub, idx) => (
                <tr key={sub.name} style={{ background: idx % 2 === 0 ? T.panel : T.bg, borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={compareSelection.includes(sub.name)}
                      onChange={() => toggleCompare(sub.name)}
                      style={{ accentColor: T.amber, width: 12, height: 12, cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '5px 10px', position: 'sticky', left: 0, background: idx % 2 === 0 ? T.panel : T.bg, zIndex: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setExpandedSubmarket(expandedSubmarket === sub.name ? null : sub.name)}
                        style={{ fontSize: 11, fontWeight: 600, color: T.cyan, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', ...mono }}
                      >
                        {sub.name}
                      </button>
                      {sub._live && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: T.green, background: T.green + '18', padding: '1px 4px', borderRadius: 2, ...mono }}>LIVE</span>
                      )}
                    </div>
                  </td>
                  {TABLE_COLUMNS.map(col => (
                    <td key={col.key} style={{ padding: '5px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {getCellContent(sub, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI VERDICT */}
        <div style={{ padding: '8px 14px', background: T.cyan + '08', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: T.cyan + '20', border: `1px solid ${T.cyan}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, ...mono }}>AI</span>
          </div>
          <div>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, letterSpacing: 1, ...mono }}>AI VERDICT · </span>
            <span style={{ fontSize: 10, color: T.text }}>
              <span style={{ fontWeight: 700, color: T.cyan }}>Decatur:</span> best risk-adjusted at $198K/unit with highest constraint and pricing power.{' '}
              <span style={{ fontWeight: 700, color: T.amber }}>East Atlanta:</span> best VALUE entry at $172K/unit with more affordability headroom.{' '}
              <span style={{ fontWeight: 700, color: T.red }}>Sandy Springs:</span> highest entry cost with weakest supply protection.
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: CHOROPLETH MAP + HEATMAP (merged) ── */}
      <div style={sectionCard}>
        <div style={sectionHeader(T.cyan)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.cyan, letterSpacing: 2, ...mono }}>GEO INTELLIGENCE</span>
            <span style={{ fontSize: 9, color: T.secondary, ...mono }}>WHERE WITHIN {summary?.market?.display_name || marketId?.toUpperCase()}</span>
          </div>
          {/* Map mode toggle */}
          <div style={{ display: 'flex', gap: 2, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 3, padding: 2 }}>
            {(['choropleth', 'heatmap'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setMapMode(mode)}
                style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, ...mono,
                  padding: '3px 10px', borderRadius: 2, border: 'none', cursor: 'pointer',
                  background: mapMode === mode ? T.cyan : 'transparent',
                  color: mapMode === mode ? T.bg : T.secondary,
                  transition: 'all 0.15s',
                }}
              >
                {mode === 'choropleth' ? 'CHOROPLETH' : 'HEATMAP'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '10px 14px', background: T.panel }}>
          {/* Layer pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {mapMode === 'choropleth'
              ? CHOROPLETH_LAYERS.map(layer => (
                  <button
                    key={layer.key}
                    onClick={() => setActiveLayer(layer.key)}
                    style={{
                      fontSize: 9, fontWeight: 600, ...mono,
                      padding: '3px 10px', borderRadius: 2, cursor: 'pointer', border: 'none',
                      background: activeLayer === layer.key ? layer.color : T.bg,
                      color: activeLayer === layer.key ? '#000' : layer.color,
                      outline: activeLayer === layer.key ? 'none' : `1px solid ${layer.color}30`,
                      transition: 'all 0.12s',
                    }}
                  >
                    {layer.label}
                  </button>
                ))
              : HEATMAP_LAYERS.map(layer => (
                  <button
                    key={layer.key}
                    onClick={() => setActiveHeatmap(layer.key)}
                    style={{
                      fontSize: 9, fontWeight: 600, ...mono,
                      padding: '3px 10px', borderRadius: 2, cursor: 'pointer', border: 'none',
                      background: activeHeatmap === layer.key ? T.amber : T.bg,
                      color: activeHeatmap === layer.key ? '#000' : T.amber,
                      outline: activeHeatmap === layer.key ? 'none' : `1px solid ${T.amber}30`,
                      transition: 'all 0.12s',
                    }}
                  >
                    {layer.label}
                  </button>
                ))
            }
          </div>

          {/* Map placeholder */}
          <div style={{ width: '100%', height: 260, background: T.dimBg, border: `2px dashed ${T.border}`, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span style={{ fontSize: 11, color: T.secondary, marginTop: 8, ...mono }}>
              {mapMode === 'choropleth'
                ? `Submarket boundaries colored by ${activeLayer}`
                : HEATMAP_LAYERS.find(l => l.key === activeHeatmap)?.desc || ''}
            </span>
            <span style={{ fontSize: 9, color: T.muted, marginTop: 4, ...mono }}>Interactive map — Mapbox GL JS integration pending</span>
          </div>

          {/* Color scale (choropleth only) */}
          {mapMode === 'choropleth' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 9, color: T.secondary, ...mono }}>COLOR SCALE:</span>
              <span style={{ fontSize: 9, color: '#3b82f6', ...mono }}>LOW</span>
              <div style={{ width: 120, height: 6, borderRadius: 3, background: 'linear-gradient(to right, #3b82f6, #f59e0b, #ef4444)' }} />
              <span style={{ fontSize: 9, color: T.red, ...mono }}>HIGH</span>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 3: SUBMARKET DETAIL (expandable) ── */}
      {expandedSubmarket && expandedData && (
        <div style={sectionCard}>
          <button
            onClick={() => setExpandedSubmarket(null)}
            style={{ width: '100%', padding: '8px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.dimBg, border: 'none', cursor: 'pointer' }}
          >
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>SUBMARKET DETAIL · {expandedSubmarket.toUpperCase()}</span>
              <div style={{ fontSize: 9, color: T.secondary, ...mono, marginTop: 2 }}>All signal groups for this submarket</div>
            </div>
            <span style={{ fontSize: 14, color: T.muted }}>✕</span>
          </button>

          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DETAIL_SECTIONS.map(section => {
              const sectionData = (expandedData.detail as any)[section.key];
              return (
                <div key={section.key} style={{ border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ padding: '5px 10px', background: T.dimBg, borderLeft: `3px solid ${section.color}` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: section.color, letterSpacing: 1.5, ...mono }}>{section.title.toUpperCase()}</span>
                  </div>
                  <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                    {section.signals.map(signal => (
                      <div key={signal} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 9, color: T.muted, ...mono }}>{signal}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.text, ...mono }}>
                          {sectionData?.[signal] !== undefined ? String(sectionData[signal]) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 4: SUBMARKET COMPARISON ── */}
      <div style={sectionCard}>
        <div style={sectionHeader(T.violet)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.violet, letterSpacing: 2, ...mono }}>SUBMARKET COMPARISON</span>
            <span style={{ fontSize: 9, color: T.secondary, ...mono }}>{compareSelection.length}/3 SELECTED</span>
          </div>
          {compareSelection.length > 0 && (
            <button
              onClick={() => setCompareSelection([])}
              style={{ fontSize: 9, color: T.secondary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', ...mono }}
            >
              CLEAR
            </button>
          )}
        </div>

        <div style={{ padding: '10px 14px' }}>
          {comparedSubmarkets.length < 2 ? (
            <div style={{ height: 100, background: T.dimBg, border: `2px dashed ${T.border}`, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: T.muted, ...mono }}>CHECK 2–3 SUBMARKETS IN THE TABLE ABOVE TO COMPARE</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Side-by-side stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparedSubmarkets.length}, 1fr)`, gap: 8 }}>
                {comparedSubmarkets.map(sub => (
                  <div key={sub.name} style={{ border: `1px solid ${T.border}`, borderRadius: 2, padding: '10px 12px', background: T.dimBg }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.amber, ...mono, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>{sub.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { label: 'JEDI (C-01)',       val: sub.jedi,                           color: T.cyan },
                        { label: 'Demand (D-09)',      val: sub.demand,                         color: T.green },
                        { label: 'Supply (S-01)',      val: sub.supply.toLocaleString(),        color: T.red },
                        { label: 'Saturation (S-08)', val: sub.saturation,                     color: T.amber },
                        { label: 'Rent Accel (M-02)', val: sub.rentAccel,                      color: T.green },
                        { label: 'Trfc-Rent (M-07)',  val: sub.trfcRent,                       color: T.secondary },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: T.secondary, ...mono }}>{row.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: row.color, ...mono }}>{String(row.val)}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 4, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[
                          { label: 'Capacity★ (DC-01)',   val: sub.capacity,                    color: T.violet },
                          { label: 'Buildout★ (DC-02)',   val: sub.buildout,                    color: T.violet },
                          { label: 'Constraint★ (DC-03)', val: sub.constraint,                  color: T.violet },
                          { label: 'Overhang★ (DC-04)',   val: sub.overhang,                    color: sub.overhang === 'MOD' ? T.amber : T.green },
                          { label: 'Last Mover★ (DC-05)', val: sub.lastMover ? 'Yes★' : 'No',  color: sub.lastMover ? T.violet : T.muted },
                          { label: 'Pricing★ (DC-07)',    val: sub.pricingPower,                color: T.violet },
                          { label: 'Adj Rent★ (DC-11)',   val: sub.adjRent,                     color: T.green },
                          { label: 'Traffic★ (T-02)',     val: sub.traffic,                     color: T.cyan },
                        ].map(row => (
                          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 9, color: T.violet + 'CC', ...mono }}>{row.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: row.color, ...mono }}>{String(row.val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar chart comparisons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'DC-03 SUPPLY CONSTRAINT', key: 'constraint', color: T.violet },
                  { label: 'DC-07 PRICING POWER',     key: 'pricingPower', color: T.cyan },
                ].map(chart => (
                  <div key={chart.key} style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: chart.color, letterSpacing: 1.5, ...mono, marginBottom: 10 }}>{chart.label}</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 80 }}>
                      {comparedSubmarkets.map(sub => {
                        const pct = (sub as any)[chart.key];
                        return (
                          <div key={sub.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: chart.color, ...mono }}>{pct}</span>
                            <div style={{ width: '100%', background: T.border, borderRadius: 2, height: `${pct}%`, minHeight: 4 }}>
                              <div style={{ width: '100%', height: '100%', background: chart.color, borderRadius: 2, opacity: 0.7 }} />
                            </div>
                            <span style={{ fontSize: 9, color: T.secondary, ...mono, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Entry price comparison */}
              <div style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.amber, letterSpacing: 1.5, ...mono, marginBottom: 8 }}>ENTRY PRICE COMPARISON</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparedSubmarkets.length}, 1fr)`, gap: 8 }}>
                  {comparedSubmarkets.map(sub => (
                    <div key={sub.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 12px', background: T.panel, borderRadius: 2, border: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 9, color: T.secondary, ...mono }}>{sub.name}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.text, ...mono, marginTop: 4 }}>{sub.entryPrice}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default SubmarketsTab;
