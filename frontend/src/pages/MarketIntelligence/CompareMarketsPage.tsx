import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OutputCard, { OutputSection } from './components/OutputCard';
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
  { id: 'nashville', name: 'Nashville', state: 'TN', selected: false },
  { id: 'tampa', name: 'Tampa', state: 'FL', selected: false },
];

const CompareMarketsPage: React.FC = () => {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState(MARKETS);
  const [activeChart, setActiveChart] = useState('Rent Growth');

  const selectedCount = markets.filter(m => m.selected).length;
  const selectedMarkets = markets.filter(m => m.selected);

  const toggleMarket = (id: string) => {
    setMarkets(markets.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  };

  const radarOutputs = ['D-09', 'DC-03', 'DC-07', 'T-02'];
  const metricsOutputs = [
    'D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07', 'D-08', 'D-09', 'D-10', 'D-11', 'D-12',
    'S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06', 'S-07', 'S-08', 'S-09', 'S-10',
    'M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06', 'M-07', 'M-08', 'M-09', 'M-10',
    'DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-07', 'DC-08', 'DC-11', 'T-02', 'T-03',
  ];
  const aiOutputs = ['DC-03', 'DC-07', 'DC-11', 'T-05'];
  const chartToggles = ['Rent Growth', 'Pipeline %', 'Cap Rates', 'JEDI', 'Traffic', 'Supply Wave', 'Pricing Power'];

  const radarAxes = [
    { label: 'Demand (D-09)', angle: 0 },
    { label: 'Supply', angle: 45 },
    { label: 'Momentum', angle: 90 },
    { label: 'Position', angle: 135 },
    { label: 'Risk', angle: 180 },
    { label: 'Constraint (DC-03)', angle: 225 },
    { label: 'Pricing (DC-07)', angle: 270 },
    { label: 'Traffic (T-02)', angle: 315 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/market-intelligence')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Compare Markets</h1>
                <p className="text-sm text-gray-500 mt-0.5">Cross-MSA allocation decisions</p>
              </div>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">39 outputs</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Market Selector</h3>
                <p className="text-sm text-gray-500 mt-0.5">Pick 2-4 MSAs to compare</p>
              </div>
              <span className="text-xs text-gray-400">{selectedCount} selected</span>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {markets.map((market) => (
                <button
                  key={market.id}
                  onClick={() => toggleMarket(market.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    market.selected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
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

        <OutputSection
          title="Radar Chart (8 Axes)"
          description="Multi-dimensional market comparison"
          outputIds={radarOutputs}
        >
          <div className="flex items-center justify-center py-8">
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
                  const labelX = 150 + 140 * Math.cos(angle);
                  const labelY = 150 + 140 * Math.sin(angle);
                  return (
                    <g key={idx}>
                      <line x1="150" y1="150" x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="1" />
                      <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="text-[8px] fill-gray-500">
                        {axis.label}
                      </text>
                    </g>
                  );
                })}
                {selectedMarkets.length >= 1 && (
                  <polygon
                    points={radarAxes.map((_, idx) => {
                      const angle = (idx * 45 - 90) * (Math.PI / 180);
                      const r = [85, 70, 90, 65, 80, 75, 88, 72][idx] * 1.2;
                      return `${150 + r * Math.cos(angle)},${150 + r * Math.sin(angle)}`;
                    }).join(' ')}
                    fill="rgba(59, 130, 246, 0.15)"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                )}
                {selectedMarkets.length >= 2 && (
                  <polygon
                    points={radarAxes.map((_, idx) => {
                      const angle = (idx * 45 - 90) * (Math.PI / 180);
                      const r = [75, 85, 60, 78, 70, 90, 65, 80][idx] * 1.2;
                      return `${150 + r * Math.cos(angle)},${150 + r * Math.sin(angle)}`;
                    }).join(' ')}
                    fill="rgba(239, 68, 68, 0.1)"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                )}
              </svg>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 pb-2">
            {selectedMarkets.slice(0, 2).map((m, i) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-700 font-medium">{m.name}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-4 mt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Radar Outputs ({radarOutputs.length} outputs)</p>
            <div className="flex flex-wrap gap-2">
              {radarOutputs.map(id => (
                <OutputCard key={id} outputId={id} compact />
              ))}
            </div>
          </div>
        </OutputSection>

        <OutputSection
          title="Side-by-Side Metrics Table"
          description="All D, S, M outputs at MSA level + Dev Capacity + Traffic"
          outputIds={metricsOutputs}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Output</th>
                  {selectedMarkets.map(m => (
                    <th key={m.id} className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">{m.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['D-09 Demand Momentum', 'S-04 Absorption Runway', 'M-02 Rent Acceleration', 'DC-01 Capacity Ratio', 'DC-03 Supply Constraint', 'DC-07 Pricing Power', 'DC-11 Supply-Adj Rent', 'T-02 Physical Traffic', 'T-03 Digital Traffic'].map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{row}</td>
                    {selectedMarkets.map(m => (
                      <td key={m.id} className="px-4 py-2.5">
                        <div className="h-4 bg-gray-100 rounded w-16 animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OutputSection>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Trend Comparison Charts</h3>
                <p className="text-sm text-gray-500 mt-0.5">Toggle between key metrics</p>
              </div>
              <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">7 views</span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2 mb-6">
              {chartToggles.map(label => (
                <button
                  key={label}
                  onClick={() => setActiveChart(label)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeChart === label
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                <p className="text-xs text-gray-400 mt-1">
                  {selectedMarkets.map(m => m.name).join(' vs ')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <OutputSection
          title="AI Investment Recommendation + Entry Point Calculator"
          description="Claude-powered narrative using constraint, pricing power, and traffic signals"
          outputIds={aiOutputs}
        >
          <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl border border-violet-200 p-6 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">🤖</span>
              <div>
                <h4 className="font-semibold text-gray-900">AI Investment Recommendation</h4>
                <p className="text-xs text-gray-500 mt-0.5">Powered by DC-03, DC-07, DC-11, T-05</p>
              </div>
            </div>
            <div className="space-y-3">
              {selectedMarkets.map(m => (
                <div key={m.id} className="bg-white/80 rounded-lg p-4 border border-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{m.name}, {m.state}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Confidence</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${60 + Math.random() * 30}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded w-full mb-1.5"></div>
                  <div className="h-3 bg-gray-100 rounded w-5/6 mb-1.5"></div>
                  <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">AI Outputs ({aiOutputs.length} outputs)</p>
            <div className="flex flex-wrap gap-2">
              {aiOutputs.map(id => (
                <OutputCard key={id} outputId={id} compact />
              ))}
            </div>
          </div>
        </OutputSection>
      </div>
    </div>
  );
};

export default CompareMarketsPage;
