import React, { useState } from 'react';
import { SIGNAL_GROUPS } from '../signalGroups';

interface TrendsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

const TIME_RANGES = ['3M', '6M', '1Y', '3Y', '5Y', 'Max'] as const;
const SUBMARKETS = ['All', 'Buckhead', 'Midtown', 'Decatur', 'Sandy Springs', 'East Atlanta'];

const SUPPLY_WAVE_DATA = [
  { year: '2026', confirmed: 8200, capacity: 1200 },
  { year: '2027', confirmed: 6400, capacity: 1400 },
  { year: '2028', confirmed: 3800, capacity: 1600 },
  { year: '2029', confirmed: 1200, capacity: 1800 },
  { year: '2030', confirmed: 400, capacity: 1600 },
  { year: '2031', confirmed: 0, capacity: 1200 },
  { year: '2032', confirmed: 0, capacity: 800 },
  { year: '2033', confirmed: 0, capacity: 600 },
  { year: '2034', confirmed: 0, capacity: 400 },
];

const TrendsTab: React.FC<TrendsTabProps> = ({ marketId, summary }) => {
  const [timeRange, setTimeRange] = useState<string>('1Y');
  const [submarketFilter, setSubmarketFilter] = useState('All');
  const [supplyView, setSupplyView] = useState<'2yr' | '10yr'>('2yr');

  const maxSupplyVal = Math.max(...SUPPLY_WAVE_DATA.map(d => d.confirmed + d.capacity));

  return (
    <div className="flex flex-col gap-6">
      {/* TIME RANGE SELECTOR */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 mr-2">Time Range:</span>
            {TIME_RANGES.map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Submarket:</span>
            <select
              value={submarketFilter}
              onChange={e => setSubmarketFilter(e.target.value)}
              className="rounded-lg border border-gray-300 text-sm px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              {SUBMARKETS.map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All ▼' : s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 1: RENT TRENDS BY VINTAGE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Rent Trends by Vintage</h3>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">★ ENHANCED</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Sources: M-01, M-02, R-02 + DC-11</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">4 outputs</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="w-full h-56 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4">
            <span className="text-gray-400 text-sm font-medium mb-2">Multi-line Rent Trend Chart</span>
            <div className="flex flex-wrap justify-center gap-3 mb-2">
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-indigo-600 inline-block rounded" /> A+ Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> A Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> B+ Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> B Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" /> C Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-violet-500 inline-block rounded border-dashed" /> DC-11 Forecast</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
              <span className="border-r border-gray-300 pr-4">← NOW</span>
              <span>FORECAST →</span>
            </div>
            <span className="text-gray-300 text-xs mt-2">DC-11 dotted forecast line extends 12 months forward</span>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-lg p-3">
            <p className="text-sm text-teal-800">
              <span className="font-semibold">Insight:</span> B/C vintages outpacing A by 2x. DC-11 forecast shows B accelerating further due to supply constraint in value-add corridors.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: SUPPLY PIPELINE TIMELINE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.SUPPLY.color }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Supply Pipeline Timeline</h3>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">★ ENHANCED</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Sources: S-02, S-03, S-04, S-05, S-06 + DC-08</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">6 outputs</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setSupplyView('2yr')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                supplyView === '2yr' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              2-Year Pipeline
            </button>
            <button
              onClick={() => setSupplyView('10yr')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                supplyView === '10yr' ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'
              }`}
            >
              10-Year Supply Wave ★
            </button>
          </div>

          {supplyView === '2yr' ? (
            <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-sm font-medium">Stacked Bar Chart — Quarterly Pipeline</span>
              <span className="text-gray-300 text-xs mt-1">S-02 Under Construction + S-03 Permitted by Quarter</span>
              <div className="flex gap-3 mt-2">
                <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-3 h-3 bg-red-500 rounded inline-block" /> Under Construction</span>
                <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-3 h-3 bg-amber-400 rounded inline-block" /> Permitted</span>
              </div>
            </div>
          ) : (
            <div className="w-full bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600">10-Year Supply Wave Forecast (DC-08)</span>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 bg-red-500 rounded inline-block" /> Confirmed Pipeline</span>
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 bg-orange-300 rounded inline-block" /> Capacity Conversion</span>
                </div>
              </div>
              <svg viewBox="0 0 450 160" className="w-full h-auto">
                {SUPPLY_WAVE_DATA.map((d, i) => {
                  const barWidth = 35;
                  const gap = 50;
                  const x = i * gap + 15;
                  const confirmedH = (d.confirmed / maxSupplyVal) * 120;
                  const capacityH = (d.capacity / maxSupplyVal) * 120;
                  return (
                    <g key={d.year}>
                      <rect x={x} y={140 - confirmedH - capacityH} width={barWidth} height={capacityH} rx={2} className="fill-orange-300" />
                      <rect x={x} y={140 - confirmedH} width={barWidth} height={confirmedH} rx={2} className="fill-red-500" />
                      <text x={x + barWidth / 2} y={155} textAnchor="middle" className="fill-gray-500 text-[10px]">{d.year}</text>
                      {d.confirmed > 0 && (
                        <text x={x + barWidth / 2} y={140 - confirmedH - capacityH - 4} textAnchor="middle" className="fill-gray-500 text-[8px]">
                          {((d.confirmed + d.capacity) / 1000).toFixed(1)}k
                        </text>
                      )}
                    </g>
                  );
                })}
                <line x1="0" y1="140" x2="450" y2="140" className="stroke-gray-300" strokeWidth={1} />
              </svg>
            </div>
          )}

          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Insight:</span> Peak year: 2026 (8,200u). Pipeline exhaustion: 2029. Capacity conversion tapers to ~800u/yr by 2032.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: DEMAND SIGNAL TRENDS */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.DEMAND.color }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Demand Signal Trends</h3>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">★ ENHANCED</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Sources: D-05, D-06, D-07, D-08, D-09 + T-02, T-03, T-07</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">8 outputs</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4">
            <span className="text-gray-400 text-sm font-medium mb-2">Dual-Axis Demand Chart</span>
            <div className="grid grid-cols-2 gap-6 text-xs text-gray-400">
              <div className="text-center">
                <p className="font-medium text-gray-500 mb-1">Left Axis (Physical)</p>
                <p>D-05 Traffic Growth</p>
                <p>T-02 avg Physical Score</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-500 mb-1">Right Axis (Digital)</p>
                <p>D-08 Search Interest</p>
                <p>T-03 avg Digital Score</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Insight:</span> Digital leads physical by 8-12 weeks. T-03 uptick in Decatur Q4 2025 → T-02 uptick Q1 2026.
            </p>
          </div>
        </div>
      </div>

      {/* SECTIONS 4 & 5: TRANSACTION & CONCESSION (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* SECTION 4: TRANSACTION & CAP RATES (60%) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Transaction & Cap Rates</h3>
              <p className="text-sm text-gray-500 mt-0.5">Sources: M-08, M-09, P-07</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-sm font-medium mb-1">Scatter Plot</span>
              <span className="text-gray-300 text-xs">X = Time · Y = $/unit · Size = unit count · Color = cap rate</span>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                <span className="font-semibold">Cap rates:</span> 5.1% → 5.5% expanding
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 5: CONCESSION & OCCUPANCY (40%) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Concession & Occupancy</h3>
              <p className="text-sm text-gray-500 mt-0.5">Sources: M-03, M-04, M-06, R-03</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-sm font-medium mb-1">Area Chart</span>
              <span className="text-gray-300 text-xs">Concession as % GPR over time</span>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 space-y-1">
              <p className="text-sm text-orange-800">
                <span className="font-semibold">Concession as % GPR:</span> 4.8% → 3.2% (declining)
              </p>
              <p className="text-sm text-orange-700">Availability declining</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: JEDI SCORE HISTORY */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.COMPOSITE.color }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">JEDI Score History</h3>
              <p className="text-sm text-gray-500 mt-0.5">Source: C-01 time series</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">1 output</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4">
            <span className="text-gray-400 text-sm font-medium mb-2">Line Chart with Signal Decomposition</span>
            <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-teal-600 inline-block rounded" /> JEDI Composite</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Demand Component</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Supply Component</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> Momentum Component</span>
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 space-y-1">
            <p className="text-sm text-teal-800">
              <span className="font-semibold">Score trajectory:</span> 58 → 72 → 81 → 87 over 24 months
            </p>
            <p className="text-sm text-teal-700">
              <span className="font-semibold">Primary driver:</span> Demand acceleration (D-09: 55 → 82)
            </p>
            <p className="text-sm text-teal-700">
              <span className="font-semibold">Drag factor:</span> Supply risk (S-composite: stable at 64)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendsTab;
