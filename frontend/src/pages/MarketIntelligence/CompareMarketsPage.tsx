import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIGNAL_GROUPS } from './signalGroups';
import { BT } from '@/components/deal/bloomberg-ui';

interface MarketForComparison {
  id: string;
  name: string;
  state: string;
  selected: boolean;
}

const MARKETS: MarketForComparison[] = [
  { id: 'atlanta', name: 'Atlanta', state: 'GA', selected: true },
  { id: 'charlotte', name: 'Charlotte', state: 'NC', selected: true },
  { id: 'nashville', name: 'Nashville', state: 'TN', selected: true },
  { id: 'tampa', name: 'Tampa', state: 'FL', selected: false },
];

type MarketId = 'atlanta' | 'charlotte' | 'nashville' | 'tampa';

const MOCK_DATA: Record<string, Record<MarketId, { value: string; raw: number }>> = {
  'D-01 Jobs/Apt': { atlanta: { value: '3.8', raw: 3.8 }, charlotte: { value: '3.5', raw: 3.5 }, nashville: { value: '3.2', raw: 3.2 }, tampa: { value: '2.9', raw: 2.9 } },
  'D-02 New Jobs/Unit': { atlanta: { value: '2.4', raw: 2.4 }, charlotte: { value: '2.1', raw: 2.1 }, nashville: { value: '1.8', raw: 1.8 }, tampa: { value: '1.5', raw: 1.5 } },
  'D-03 Migration': { atlanta: { value: '+48K', raw: 48 }, charlotte: { value: '+32K', raw: 32 }, nashville: { value: '+28K', raw: 28 }, tampa: { value: '+52K', raw: 52 } },
  'D-09 Momentum': { atlanta: { value: '82', raw: 82 }, charlotte: { value: '78', raw: 78 }, nashville: { value: '71', raw: 71 }, tampa: { value: '74', raw: 74 } },
  'D-10 Gravity': { atlanta: { value: '76', raw: 76 }, charlotte: { value: '68', raw: 68 }, nashville: { value: '72', raw: 72 }, tampa: { value: '64', raw: 64 } },
  'D-11 Rent-Mort': { atlanta: { value: '-18%', raw: 18 }, charlotte: { value: '-22%', raw: 22 }, nashville: { value: '-15%', raw: 15 }, tampa: { value: '-20%', raw: 20 } },
  'S-04 Absorption': { atlanta: { value: '28.4mo', raw: 28.4 }, charlotte: { value: '22.1mo', raw: 22.1 }, nashville: { value: '34.8mo', raw: 34.8 }, tampa: { value: '18.2mo', raw: 18.2 } },
  'S-05 Clusters': { atlanta: { value: '3 zones', raw: 3 }, charlotte: { value: '2 zones', raw: 2 }, nashville: { value: '4 zones', raw: 4 }, tampa: { value: '1 zone', raw: 1 } },
  'S-06 Permit Mom': { atlanta: { value: '+8%', raw: 8 }, charlotte: { value: '-4%', raw: -4 }, nashville: { value: '+22%', raw: 22 }, tampa: { value: '-12%', raw: -12 } },
  'S-08 Saturation': { atlanta: { value: '6.2%', raw: 6.2 }, charlotte: { value: '5.4%', raw: 5.4 }, nashville: { value: '8.1%', raw: 8.1 }, tampa: { value: '4.8%', raw: 4.8 } },
  'M-01 Avg Rent': { atlanta: { value: '$1,680', raw: 1680 }, charlotte: { value: '$1,540', raw: 1540 }, nashville: { value: '$1,720', raw: 1720 }, tampa: { value: '$1,620', raw: 1620 } },
  'M-02 Rent Accel': { atlanta: { value: '+0.8%', raw: 0.8 }, charlotte: { value: '+1.2%', raw: 1.2 }, nashville: { value: '-0.4%', raw: -0.4 }, tampa: { value: '+0.6%', raw: 0.6 } },
  'M-05 Rent vs Wage': { atlanta: { value: '+1.2%', raw: 1.2 }, charlotte: { value: '+0.8%', raw: 0.8 }, nashville: { value: '-0.6%', raw: -0.6 }, tampa: { value: '+0.4%', raw: 0.4 } },
  'M-06 Occupancy': { atlanta: { value: '94.2%', raw: 94.2 }, charlotte: { value: '95.1%', raw: 95.1 }, nashville: { value: '92.8%', raw: 92.8 }, tampa: { value: '94.8%', raw: 94.8 } },
  'DC-01 Capacity': { atlanta: { value: '32%', raw: 32 }, charlotte: { value: '28%', raw: 28 }, nashville: { value: '48%', raw: 48 }, tampa: { value: '18%', raw: 18 } },
  'DC-02 Buildout': { atlanta: { value: '8.6yr', raw: 8.6 }, charlotte: { value: '6.2yr', raw: 6.2 }, nashville: { value: '14.8yr', raw: 14.8 }, tampa: { value: '4.2yr', raw: 4.2 } },
  'DC-03 Constraint': { atlanta: { value: '58', raw: 58 }, charlotte: { value: '62', raw: 62 }, nashville: { value: '38', raw: 38 }, tampa: { value: '74', raw: 74 } },
  'DC-04 Overhang': { atlanta: { value: '22%', raw: 22 }, charlotte: { value: '18%', raw: 18 }, nashville: { value: '34%', raw: 34 }, tampa: { value: '12%', raw: 12 } },
  'DC-07 Pricing Power': { atlanta: { value: '72', raw: 72 }, charlotte: { value: '68', raw: 68 }, nashville: { value: '52', raw: 52 }, tampa: { value: '78', raw: 78 } },
  'DC-08 Supply Wave': { atlanta: { value: 'BUILDING', raw: 2 }, charlotte: { value: 'PAST PEAK', raw: 3 }, nashville: { value: 'PEAKING', raw: 1 }, tampa: { value: 'TROUGH', raw: 4 } },
  'DC-11 Adj Rent': { atlanta: { value: '+4.6%', raw: 4.6 }, charlotte: { value: '+4.2%', raw: 4.2 }, nashville: { value: '+2.4%', raw: 2.4 }, tampa: { value: '+5.1%', raw: 5.1 } },
  'T-02 Physical avg': { atlanta: { value: '68', raw: 68 }, charlotte: { value: '62', raw: 62 }, nashville: { value: '58', raw: 58 }, tampa: { value: '72', raw: 72 } },
  'T-03 Digital avg': { atlanta: { value: '74', raw: 74 }, charlotte: { value: '70', raw: 70 }, nashville: { value: '66', raw: 66 }, tampa: { value: '68', raw: 68 } },
  'R-01 Affordability': { atlanta: { value: '32%', raw: 32 }, charlotte: { value: '28%', raw: 28 }, nashville: { value: '35%', raw: 35 }, tampa: { value: '38%', raw: 38 } },
  'R-03 Concession Drag': { atlanta: { value: '2.4%', raw: 2.4 }, charlotte: { value: '1.8%', raw: 1.8 }, nashville: { value: '4.2%', raw: 4.2 }, tampa: { value: '1.2%', raw: 1.2 } },
};

const METRIC_SECTIONS = [
  { label: 'Demand', rows: ['D-01 Jobs/Apt', 'D-02 New Jobs/Unit', 'D-03 Migration', 'D-09 Momentum', 'D-10 Gravity', 'D-11 Rent-Mort'], higherBetter: [true, true, true, true, true, true] },
  { label: 'Supply', rows: ['S-04 Absorption', 'S-05 Clusters', 'S-06 Permit Mom', 'S-08 Saturation'], higherBetter: [false, false, false, false] },
  { label: 'Momentum', rows: ['M-01 Avg Rent', 'M-02 Rent Accel', 'M-05 Rent vs Wage', 'M-06 Occupancy'], higherBetter: [true, true, true, true] },
  { label: 'Dev Capacity ★', rows: ['DC-01 Capacity', 'DC-02 Buildout', 'DC-03 Constraint', 'DC-04 Overhang', 'DC-07 Pricing Power', 'DC-08 Supply Wave', 'DC-11 Adj Rent'], higherBetter: [false, false, true, false, true, true, true] },
  { label: 'Traffic ★', rows: ['T-02 Physical avg', 'T-03 Digital avg'], higherBetter: [true, true] },
  { label: 'Risk', rows: ['R-01 Affordability', 'R-03 Concession Drag'], higherBetter: [false, false] },
];

const CompareMarketsPage: React.FC = () => {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState(MARKETS);
  const [activeChart, setActiveChart] = useState('Rent Growth');
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const selectedMarkets = markets.filter(m => m.selected);
  const selectedCount = selectedMarkets.length;

  useEffect(() => {
    const fetchMarketData = async () => {
      if (selectedMarkets.length === 0) return;
      
      setLoading(true);
      try {
        const marketIds = selectedMarkets.map(m => m.id).join(',');
        const res = await fetch(`/api/v1/markets/compare-data?markets=${marketIds}`);
        const data = await res.json();
        setMarketData(data.markets || {});
      } catch (err) {
        console.error('Failed to fetch market comparison data:', err);
        setMarketData({});
      } finally {
        setLoading(false);
      }
    };
    fetchMarketData();
  }, [selectedMarkets.map(m => m.id).join(',')]);

  const toggleMarket = (id: string) => {
    setMarkets(markets.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  };

  const radarAxes = [
    { label: 'Demand (D-09)', angle: 0 },
    { label: 'Supply', angle: 45 },
    { label: 'Momentum', angle: 90 },
    { label: 'Position', angle: 135 },
    { label: 'Risk', angle: 180 },
    { label: 'Constraint★ (DC-03)', angle: 225 },
    { label: 'Pricing★ (DC-07)', angle: 270 },
    { label: 'Traffic★ (T-02)', angle: 315 },
  ];

  const radarData: Record<string, number[]> = {
    atlanta: [85, 70, 90, 65, 80, 58, 72, 68],
    charlotte: [78, 85, 75, 72, 75, 62, 68, 62],
    nashville: [71, 55, 60, 68, 60, 38, 52, 58],
    tampa: [74, 82, 70, 60, 65, 74, 78, 72],
  };

  const radarColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];

  const chartToggles = ['Rent Growth', 'Pipeline %', 'Cap Rates', 'JEDI', 'Traffic ★', 'Supply Wave ★', 'Pricing Power ★'];

  const entryPointData = [
    { metric: 'Entry Price/Unit', atlanta: '$198K', charlotte: '$172K', nashville: '$148K' },
    { metric: 'Going-In Cap', atlanta: '5.6%', charlotte: '5.8%', nashville: '5.9%' },
    { metric: 'AI Rent Growth (Y1) — DC-11', atlanta: '+4.6%', charlotte: '+4.2%', nashville: '+2.4%' },
    { metric: 'DC-07 Pricing Push', atlanta: 'STRONG', charlotte: 'STRONG', nashville: 'WEAK' },
    { metric: 'T-05 Absorption', atlanta: '8.2 lease/mo', charlotte: '7.4', nashville: '5.8' },
    { metric: 'Est. 5-Yr IRR', atlanta: '14.2%', charlotte: '14.8%', nashville: '10.4%' },
    { metric: 'Est. Equity Multiple', atlanta: '1.88x', charlotte: '1.92x', nashville: '1.58x' },
  ];

  const getCellStyle = (metricKey: string, marketId: string): { className: string; style: React.CSSProperties } => {
    const dataToUse = Object.keys(marketData).length > 0 ? marketData : MOCK_DATA;
    const selectedIds = selectedMarkets.map(m => m.id as MarketId);
    const values = selectedIds
      .map(id => dataToUse[id]?.[metricKey]?.raw ?? 0)
      .filter(v => v !== 0);
    const current = dataToUse[marketId]?.[metricKey]?.raw ?? 0;

    if (values.length < 2 || current === 0) return { className: '', style: {} };
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max === min) return { className: '', style: {} };
    if (current === max) return { className: 'font-bold', style: { color: BT.text.green, background: `${BT.text.green}22` } };
    if (current === min) return { className: 'font-bold', style: { color: BT.text.red, background: `${BT.text.red}22` } };
    return { className: '', style: {} };
  };

  return (
    <div className="min-h-screen" style={{ background: BT.bg.terminal }}>
      <div style={{ background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/terminal', { state: { fkey: 'F4' } })} className="p-2 transition-colors" style={{ borderRadius: 0 }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: BT.text.primary }}>Compare Markets</h1>
                <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Cross-MSA allocation decisions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>Market Selector</h3>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Pick 2-4 MSAs to compare · {selectedCount} selected</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {markets.map((market) => (
                <button
                  key={market.id}
                  onClick={() => toggleMarket(market.id)}
                  className="p-4 transition-all text-left"
                  style={{
                    borderRadius: 0,
                    border: `2px solid ${market.selected ? BT.text.cyan : BT.border.subtle}`,
                    background: market.selected ? `${BT.text.cyan}22` : BT.bg.panel,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold" style={{ color: BT.text.primary }}>{market.name}</span>
                    {market.selected && (
                      <span className="w-5 h-5 flex items-center justify-center" style={{ background: BT.text.cyan, borderRadius: '50%' }}>
                        <svg className="w-3 h-3" style={{ color: BT.text.white }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: BT.text.secondary }}>{market.state}</span>
                </button>
              ))}
            </div>
            {selectedCount < 2 && (
              <p className="text-xs mt-3" style={{ color: BT.text.amber }}>Select at least 2 markets to compare</p>
            )}
          </div>
        </div>

        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>Radar Chart (8 Axes)</h3>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Multi-dimensional market comparison</p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-center py-4">
              <div className="relative w-80 h-80">
                <svg viewBox="0 0 300 300" className="w-full h-full">
                  {[1, 0.75, 0.5, 0.25].map((scale, i) => (
                    <polygon
                      key={i}
                      points={radarAxes.map((_, idx) => {
                        const angle = (idx * 45 - 90) * (Math.PI / 180);
                        const r = 120 * scale;
                        return `${150 + r * Math.cos(angle)},${150 + r * Math.sin(angle)}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                  {radarAxes.map((axis, idx) => {
                    const angle = (idx * 45 - 90) * (Math.PI / 180);
                    const x2 = 150 + 120 * Math.cos(angle);
                    const y2 = 150 + 120 * Math.sin(angle);
                    const labelX = 150 + 142 * Math.cos(angle);
                    const labelY = 150 + 142 * Math.sin(angle);
                    return (
                      <g key={idx}>
                        <line x1="150" y1="150" x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="1" />
                        <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="text-[7px] fill-gray-500">
                          {axis.label}
                        </text>
                      </g>
                    );
                  })}
                  {selectedMarkets.map((m, mIdx) => {
                    const data = radarData[m.id as MarketId] || [];
                    const color = radarColors[mIdx % radarColors.length];
                    return (
                      <polygon
                        key={m.id}
                        points={radarAxes.map((_, idx) => {
                          const angle = (idx * 45 - 90) * (Math.PI / 180);
                          const r = (data[idx] || 50) * 1.2;
                          return `${150 + r * Math.cos(angle)},${150 + r * Math.sin(angle)}`;
                        }).join(' ')}
                        fill={`${color}20`}
                        stroke={color}
                        strokeWidth="2"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 pb-2">
              {selectedMarkets.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: radarColors[i % radarColors.length] }}></div>
                  <span className="font-medium" style={{ color: BT.text.primary }}>{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>Side-by-Side Metrics Table</h3>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>All D, S, M outputs + Dev Capacity + Traffic</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: BT.bg.panelAlt }}>
                  <th className="px-4 py-3 text-left font-semibold text-xs w-48" style={{ color: BT.text.secondary }}>Output</th>
                  {selectedMarkets.map(m => (
                    <th key={m.id} className="px-4 py-3 text-left font-semibold text-xs" style={{ color: BT.text.primary }}>{m.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_SECTIONS.map((section) => (
                  <React.Fragment key={section.label}>
                    <tr>
                      <td colSpan={selectedMarkets.length + 1} className="px-4 py-2 font-bold text-xs uppercase tracking-wider" style={{ background: BT.bg.header, color: BT.text.secondary }}>{section.label}</td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row} style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                        <td className="px-4 py-2.5 font-medium text-xs" style={{ color: BT.text.primary }}>{row}</td>
                        {selectedMarkets.map(m => {
                          const dataToUse = Object.keys(marketData).length > 0 ? marketData : MOCK_DATA;
                          const value = dataToUse[m.id]?.[row]?.value ?? '—';
                          const cellStyle = getCellStyle(row, m.id);
                          return (
                            <td key={m.id} className={`px-4 py-2.5 text-sm ${cellStyle.className}`} style={cellStyle.style}>
                              {loading ? <span style={{ color: BT.text.muted }}>...</span> : value}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>Trend Comparison Charts</h3>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Toggle between key metrics</p>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2 mb-6">
              {chartToggles.map(label => (
                <button
                  key={label}
                  onClick={() => setActiveChart(label)}
                  className="px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    borderRadius: 0,
                    background: activeChart === label ? BT.text.cyan : BT.bg.header,
                    color: activeChart === label ? BT.text.white : BT.text.secondary,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="h-64 flex items-center justify-center" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px dashed ${BT.border.subtle}` }}>
              <div className="text-center">
                <div className="text-3xl mb-2">📈</div>
                <p className="text-sm font-medium" style={{ color: BT.text.secondary }}>{activeChart} — Trend Comparison</p>
                <p className="text-xs mt-1" style={{ color: BT.text.muted }}>{selectedMarkets.map(m => m.name).join(' vs ')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>AI Investment Recommendation + Entry Point Calculator</h3>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Powered by DC-03, DC-07, DC-11, T-05</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                <div className="flex items-start gap-2 mb-4">
                  <span className="text-xl">🤖</span>
                  <h4 className="font-semibold" style={{ color: BT.text.primary }}>AI Investment Recommendation</h4>
                </div>
                <div className="space-y-3">
                  <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                    <p className="font-semibold mb-1" style={{ color: BT.text.primary }}>Atlanta, GA</p>
                    <p className="text-sm" style={{ color: BT.text.primary }}>Strong demand fundamentals with D-09: 82. Supply building but DC-03: 58 provides moderate constraint. Pricing power intact at 72. <span className="font-bold" style={{ color: BT.text.green }}>VERDICT: ACCUMULATE B/B+ value-add in Midtown, Buckhead.</span></p>
                  </div>
                  <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                    <p className="font-semibold mb-1" style={{ color: BT.text.primary }}>Charlotte, NC</p>
                    <p className="text-sm" style={{ color: BT.text.primary }}>Supply wave past peak — deliveries declining. DC-11 adjusted rent forecast +4.2% suggests recovery. Strong absorption at T-05. <span className="font-bold" style={{ color: BT.text.green }}>VERDICT: BUY NOW — optimal entry window before rent recovery.</span></p>
                  </div>
                  <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                    <p className="font-semibold mb-1" style={{ color: BT.text.primary }}>Nashville, TN</p>
                    <p className="text-sm" style={{ color: BT.text.primary }}>Supply peaking Q1-Q2 2026 with DC-01: 48% capacity = more can come. Pricing power weak at 52. Concession drag 4.2%. <span className="font-bold" style={{ color: BT.text.amber }}>VERDICT: WAIT — monitor for supply wave peak confirmation.</span></p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3" style={{ color: BT.text.primary }}>Entry Point Calculator</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: BT.bg.panelAlt }}>
                        <th className="px-3 py-2 text-left font-semibold text-xs" style={{ color: BT.text.secondary }}>Metric</th>
                        <th className="px-3 py-2 text-left font-semibold text-xs" style={{ color: BT.text.primary }}>Atlanta</th>
                        <th className="px-3 py-2 text-left font-semibold text-xs" style={{ color: BT.text.primary }}>Charlotte</th>
                        <th className="px-3 py-2 text-left font-semibold text-xs" style={{ color: BT.text.primary }}>Nashville</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entryPointData.map((row, idx) => (
                        <tr key={idx} style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                          <td className="px-3 py-2.5 font-medium text-xs" style={{ color: BT.text.primary }}>{row.metric}</td>
                          <td className={`px-3 py-2.5 text-sm ${row.metric === 'DC-07 Pricing Push' && row.atlanta === 'STRONG' ? 'font-bold' : ''}`} style={row.metric === 'DC-07 Pricing Push' && row.atlanta === 'STRONG' ? { color: BT.text.green } : {}}>{row.atlanta}</td>
                          <td className={`px-3 py-2.5 text-sm ${row.metric === 'Est. 5-Yr IRR' ? 'font-bold' : ''} ${row.metric === 'DC-07 Pricing Push' && row.charlotte === 'STRONG' ? 'font-bold' : ''}`} style={row.metric === 'Est. 5-Yr IRR' || (row.metric === 'DC-07 Pricing Push' && row.charlotte === 'STRONG') ? { color: BT.text.green } : {}}>{row.charlotte}</td>
                          <td className={`px-3 py-2.5 text-sm ${row.metric === 'DC-07 Pricing Push' && row.nashville === 'WEAK' ? 'font-bold' : ''}`} style={row.metric === 'DC-07 Pricing Push' && row.nashville === 'WEAK' ? { color: BT.text.red } : {}}>{row.nashville}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-3" style={{ background: `${BT.text.cyan}22`, border: `1px solid ${BT.text.cyan}44`, borderRadius: 0 }}>
                  <p className="text-xs" style={{ color: BT.text.cyan }}>Charlotte's IRR improved from 14.2% → 14.8% when using supply-adjusted forecast (DC-11)</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-6 pt-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
              <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: BT.text.cyan, color: BT.text.white, borderRadius: 0 }}>Export Comparison Report</button>
              <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, borderRadius: 0 }}>Share with Partners</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareMarketsPage;
