import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIGNAL_GROUPS } from './signalGroups';

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

  const selectedMarkets = markets.filter(m => m.selected);
  const selectedCount = selectedMarkets.length;

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

  const getCellColor = (metricKey: string, marketId: string) => {
    const row = MOCK_DATA[metricKey];
    if (!row) return '';
    const selectedIds = selectedMarkets.map(m => m.id as MarketId);
    const values = selectedIds.map(id => row[id]?.raw ?? 0);
    const current = row[marketId as MarketId]?.raw ?? 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (values.length < 2 || max === min) return '';
    if (current === max) return 'text-green-700 bg-green-50 font-bold';
    if (current === min) return 'text-red-700 bg-red-50 font-bold';
    return '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/market-intelligence')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Compare Markets</h1>
                <p className="text-sm text-gray-500 mt-0.5">Cross-MSA allocation decisions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Market Selector</h3>
            <p className="text-sm text-gray-500 mt-0.5">Pick 2-4 MSAs to compare · {selectedCount} selected</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {markets.map((market) => (
                <button
                  key={market.id}
                  onClick={() => toggleMarket(market.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    market.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900">{market.name}</span>
                    {market.selected && (
                      <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{market.state}</span>
                </button>
              ))}
            </div>
            {selectedCount < 2 && (
              <p className="text-xs text-amber-600 mt-3">Select at least 2 markets to compare</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Radar Chart (8 Axes)</h3>
            <p className="text-sm text-gray-500 mt-0.5">Multi-dimensional market comparison</p>
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
                  <span className="text-gray-700 font-medium">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Side-by-Side Metrics Table</h3>
            <p className="text-sm text-gray-500 mt-0.5">All D, S, M outputs + Dev Capacity + Traffic</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs w-48">Output</th>
                  {selectedMarkets.map(m => (
                    <th key={m.id} className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">{m.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_SECTIONS.map((section) => (
                  <React.Fragment key={section.label}>
                    <tr>
                      <td colSpan={selectedMarkets.length + 1} className="px-4 py-2 bg-gray-100 font-bold text-xs text-gray-600 uppercase tracking-wider">{section.label}</td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 text-gray-700 font-medium text-xs">{row}</td>
                        {selectedMarkets.map(m => (
                          <td key={m.id} className={`px-4 py-2.5 text-sm ${getCellColor(row, m.id)}`}>
                            {MOCK_DATA[row]?.[m.id as MarketId]?.value ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Trend Comparison Charts</h3>
            <p className="text-sm text-gray-500 mt-0.5">Toggle between key metrics</p>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2 mb-6">
              {chartToggles.map(label => (
                <button
                  key={label}
                  onClick={() => setActiveChart(label)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeChart === label ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2">📈</div>
                <p className="text-sm font-medium text-gray-500">{activeChart} — Trend Comparison</p>
                <p className="text-xs text-gray-400 mt-1">{selectedMarkets.map(m => m.name).join(' vs ')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">AI Investment Recommendation + Entry Point Calculator</h3>
            <p className="text-sm text-gray-500 mt-0.5">Powered by DC-03, DC-07, DC-11, T-05</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl border border-violet-200 p-5">
                <div className="flex items-start gap-2 mb-4">
                  <span className="text-xl">🤖</span>
                  <h4 className="font-semibold text-gray-900">AI Investment Recommendation</h4>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/80 rounded-lg p-4 border border-white">
                    <p className="font-semibold text-gray-900 mb-1">Atlanta, GA</p>
                    <p className="text-sm text-gray-700">Strong demand fundamentals with D-09: 82. Supply building but DC-03: 58 provides moderate constraint. Pricing power intact at 72. <span className="font-bold text-green-700">VERDICT: ACCUMULATE B/B+ value-add in Midtown, Buckhead.</span></p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-4 border border-white">
                    <p className="font-semibold text-gray-900 mb-1">Charlotte, NC</p>
                    <p className="text-sm text-gray-700">Supply wave past peak — deliveries declining. DC-11 adjusted rent forecast +4.2% suggests recovery. Strong absorption at T-05. <span className="font-bold text-green-700">VERDICT: BUY NOW — optimal entry window before rent recovery.</span></p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-4 border border-white">
                    <p className="font-semibold text-gray-900 mb-1">Nashville, TN</p>
                    <p className="text-sm text-gray-700">Supply peaking Q1-Q2 2026 with DC-01: 48% capacity = more can come. Pricing power weak at 52. Concession drag 4.2%. <span className="font-bold text-amber-700">VERDICT: WAIT — monitor for supply wave peak confirmation.</span></p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Entry Point Calculator</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs">Metric</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">Atlanta</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">Charlotte</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">Nashville</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entryPointData.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-3 py-2.5 text-gray-700 font-medium text-xs">{row.metric}</td>
                          <td className={`px-3 py-2.5 text-sm ${row.metric === 'DC-07 Pricing Push' && row.atlanta === 'STRONG' ? 'text-green-700 font-bold' : ''}`}>{row.atlanta}</td>
                          <td className={`px-3 py-2.5 text-sm ${row.metric === 'Est. 5-Yr IRR' ? 'text-green-700 font-bold' : ''} ${row.metric === 'DC-07 Pricing Push' && row.charlotte === 'STRONG' ? 'text-green-700 font-bold' : ''}`}>{row.charlotte}</td>
                          <td className={`px-3 py-2.5 text-sm ${row.metric === 'DC-07 Pricing Push' && row.nashville === 'WEAK' ? 'text-red-700 font-bold' : ''}`}>{row.nashville}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">Charlotte's IRR improved from 14.2% → 14.8% when using supply-adjusted forecast (DC-11)</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-100">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Export Comparison Report</button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Share with Partners</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareMarketsPage;
