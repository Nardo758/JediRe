import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIGNAL_GROUPS } from './signalGroups';

const FutureSupplyPage: React.FC = () => {
  const navigate = useNavigate();
  const [ganttMarketFilter, setGanttMarketFilter] = useState('All Markets');
  const [showConfirmed, setShowConfirmed] = useState(true);
  const [showCapacity, setShowCapacity] = useState(true);

  const scoreboardRows = [
    { market: 'Atlanta', abbr: 'ATL', pipelinePct: '6.2%', absorb: '28.4mo', permitMom: '+8%', clusters: 3, capacity: '32%', constraint: 58, overhang: '22%', risk: 'MED' },
    { market: 'Charlotte', abbr: 'CLT', pipelinePct: '5.4%', absorb: '22.1mo', permitMom: '-4%', clusters: 2, capacity: '28%', constraint: 62, overhang: '18%', risk: 'LOW' },
    { market: 'Nashville', abbr: 'NSH', pipelinePct: '8.1%', absorb: '34.8mo', permitMom: '+22%', clusters: 4, capacity: '48%', constraint: 38, overhang: '34%', risk: 'HIGH' },
    { market: 'Dallas', abbr: 'DAL', pipelinePct: '7.2%', absorb: '30.2mo', permitMom: '+12%', clusters: 3, capacity: '42%', constraint: 44, overhang: '28%', risk: 'HIGH' },
    { market: 'Raleigh', abbr: 'RAL', pipelinePct: '3.8%', absorb: '16.4mo', permitMom: '-8%', clusters: 1, capacity: '22%', constraint: 68, overhang: '14%', risk: 'LOW' },
    { market: 'Tampa', abbr: 'TPA', pipelinePct: '3.2%', absorb: '14.2mo', permitMom: '-12%', clusters: 1, capacity: '18%', constraint: 74, overhang: '12%', risk: 'LOW' },
  ];

  const riskEmoji = (risk: string) => {
    switch (risk) {
      case 'HIGH': return '🔴';
      case 'MED': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  };

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH': return 'text-red-700 bg-red-100';
      case 'MED': return 'text-yellow-700 bg-yellow-100';
      case 'LOW': return 'text-green-700 bg-green-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const ganttProjects = [
    { market: 'ATL', color: 'bg-blue-500', name: 'Beltline Phase III', units: 320, start: 2, end: 7, type: 'confirmed' },
    { market: 'ATL', color: 'bg-blue-500', name: 'Midtown Tower', units: 280, start: 3, end: 8, type: 'confirmed' },
    { market: 'ATL', color: 'bg-blue-500', name: 'Decatur Station', units: 200, start: 5, end: 10, type: 'confirmed' },
    { market: 'ATL', color: 'bg-blue-200', name: 'Buckhead Parcel A', units: 180, start: 9, end: 14, type: 'capacity', probability: '72%' },
    { market: 'ATL', color: 'bg-blue-200', name: 'Sandy Springs Land', units: 240, start: 11, end: 16, type: 'capacity', probability: '58%' },
    { market: 'CLT', color: 'bg-green-500', name: 'SouthEnd Mixed', units: 350, start: 1, end: 6, type: 'confirmed' },
    { market: 'CLT', color: 'bg-green-500', name: 'NoDa Apartments', units: 180, start: 4, end: 9, type: 'confirmed' },
    { market: 'NSH', color: 'bg-orange-500', name: 'Gulch Tower A', units: 420, start: 1, end: 5, type: 'confirmed' },
    { market: 'NSH', color: 'bg-orange-500', name: 'East Nashville', units: 280, start: 2, end: 7, type: 'confirmed' },
    { market: 'NSH', color: 'bg-orange-500', name: 'Germantown II', units: 190, start: 3, end: 8, type: 'confirmed' },
    { market: 'NSH', color: 'bg-orange-500', name: '12South Phase B', units: 160, start: 5, end: 10, type: 'confirmed' },
    { market: 'NSH', color: 'bg-orange-200', name: 'WeHo Land Parcel', units: 300, start: 10, end: 15, type: 'capacity', probability: '64%' },
  ];

  const quarters = ['Q1 26', 'Q2 26', 'Q3 26', 'Q4 26', 'Q1 27', 'Q2 27', 'Q3 27', 'Q4 27', 'Q1 28', 'Q2 28', 'Q3 28', 'Q4 28', 'Q1 29', 'Q2 29', 'Q3 29', 'Q4 29'];

  const supplyWaveData = [
    { year: 2026, confirmed: 8200, capacity: 0 },
    { year: 2027, confirmed: 5400, capacity: 200 },
    { year: 2028, confirmed: 2800, capacity: 800 },
    { year: 2029, confirmed: 1000, capacity: 1200 },
    { year: 2030, confirmed: 200, capacity: 1400 },
    { year: 2031, confirmed: 0, capacity: 1600 },
    { year: 2032, confirmed: 0, capacity: 1800 },
    { year: 2033, confirmed: 0, capacity: 1600 },
    { year: 2034, confirmed: 0, capacity: 2000 },
    { year: 2035, confirmed: 0, capacity: 1800 },
  ];

  const maxSupply = Math.max(...supplyWaveData.map(d => d.confirmed + d.capacity));

  const supplyWavePhases = [
    { market: 'Nashville', phase: 'PEAKING', phaseColor: 'bg-red-100 text-red-800', detail: 'Q1-Q2 2026 max deliveries', buildout: '14.8yr', constrained: 'NOT constrained', window: '' },
    { market: 'Atlanta', phase: 'BUILDING', phaseColor: 'bg-blue-100 text-blue-800', detail: 'peak Q3-Q4 2026', buildout: '8.6yr', constrained: 'moderate', window: '' },
    { market: 'Charlotte', phase: 'PAST PEAK', phaseColor: 'bg-green-100 text-green-800', detail: 'deliveries declining', buildout: '6.2yr', constrained: '', window: '★ BUYING WINDOW NOW' },
    { market: 'Raleigh', phase: 'TROUGH', phaseColor: 'bg-emerald-100 text-emerald-800', detail: 'minimal new starts', buildout: '5.8yr', constrained: '', window: '' },
    { market: 'Tampa', phase: 'TROUGH', phaseColor: 'bg-emerald-100 text-emerald-800', detail: 'supply bottomed', buildout: '4.2yr', constrained: '', window: '★ BUYING WINDOW NOW' },
  ];

  const buildEconRows = [
    { market: 'Atlanta', costUnit: '$285K', avgRent: '$1,680', yoc: '5.2%', marketCap: '5.8%', spread: '+60bps', verdict: 'FEASIBLE — moderate margin' },
    { market: 'Charlotte', costUnit: '$265K', avgRent: '$1,540', yoc: '4.8%', marketCap: '5.5%', spread: '+70bps', verdict: 'FEASIBLE — improving' },
    { market: 'Nashville', costUnit: '$298K', avgRent: '$1,720', yoc: '4.5%', marketCap: '5.1%', spread: '+60bps', verdict: 'MARGINAL — tight spread' },
  ];

  const landBankRows = [
    { owner: 'Greystone Capital', parcels: 3, capacity: '480 units', estStart: 'Q2 2028', probability: '72%', status: 'Entitled' },
    { owner: 'Mill Creek Residential', parcels: 2, capacity: '320 units', estStart: 'Q4 2028', probability: '64%', status: 'Pre-zoning' },
    { owner: 'Trammell Crow', parcels: 4, capacity: '650 units', estStart: 'Q1 2029', probability: '58%', status: 'Land banked' },
    { owner: 'Hines', parcels: 1, capacity: '200 units', estStart: 'Q3 2029', probability: '48%', status: 'Under review' },
    { owner: 'Lincoln Property Co', parcels: 2, capacity: '380 units', estStart: 'Q1 2030', probability: '42%', status: 'Assemblage' },
  ];

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
                <h1 className="text-2xl font-bold text-gray-900">Future Supply</h1>
                <p className="text-sm text-gray-500 mt-0.5">10-year supply risk — THE KILLER FEATURE</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Across 6 markets | Pipeline: 148,200 units | Absorption: 32.4 months</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Supply Risk Scoreboard ★ Enhanced</h3>
            <p className="text-sm text-gray-500 mt-0.5">Pipeline risk + Capacity risk per market</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Market</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Pipe% (S)</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Absorb Rwy (S)</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Permit Mom (S)</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Clusters (S)</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Capacity★ (DC-01)</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Constraint★ (DC-03)</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Overhang★ (DC-04)</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 text-xs">Risk</th>
                </tr>
              </thead>
              <tbody>
                {scoreboardRows.map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 font-medium text-gray-900">{row.market}</td>
                    <td className="px-3 py-3 text-gray-600">{row.pipelinePct}</td>
                    <td className="px-3 py-3 text-gray-600">{row.absorb}</td>
                    <td className={`px-3 py-3 font-medium ${row.permitMom.startsWith('+') ? 'text-red-600' : 'text-green-600'}`}>{row.permitMom}</td>
                    <td className="px-3 py-3 text-gray-600">{row.clusters}</td>
                    <td className="px-3 py-3 font-medium text-violet-700">{row.capacity}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${row.constraint}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-500">{row.constraint}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{row.overhang}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${riskColor(row.risk)}`}>
                        {riskEmoji(row.risk)} {row.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2"><span className="font-bold">Risk formula:</span> HIGH = Pipeline% {'>'}7% AND Capacity {'>'}40% AND Constraint {'<'}45 | MED = Pipeline% {'>'}5% OR Capacity {'>'}30% | LOW = Pipeline% {'<'}5% AND Constraint {'>'}60</p>
            <p className="text-xs text-gray-700 italic">Nashville is HIGH not just because of pipeline, but because DC-01: 48% capacity means even after this wave, more supply CAN come. Tampa is LOW because DC-03: 74 constraint = hard to build more.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delivery Calendar ★ Enhanced (Gantt)</h3>
                <p className="text-sm text-gray-500 mt-0.5">Project-level timeline with capacity conversion overlays</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <select value={ganttMarketFilter} onChange={(e) => setGanttMarketFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                  <option>All Markets</option>
                  <option>ATL</option>
                  <option>CLT</option>
                  <option>NSH</option>
                </select>
                <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                  <option>All Submarkets</option>
                </select>
                <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                  <option>All Sizes</option>
                  <option>100-200u</option>
                  <option>200-400u</option>
                  <option>400+u</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={showConfirmed} onChange={() => setShowConfirmed(!showConfirmed)} className="rounded border-gray-300" />
                  Confirmed Pipeline
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={showCapacity} onChange={() => setShowCapacity(!showCapacity)} className="rounded border-gray-300" />
                  Capacity Conversion ★
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="flex border-b border-gray-200 mb-2">
                  <div className="w-48 flex-shrink-0"></div>
                  <div className="flex-1 flex">
                    {quarters.map((q, i) => (
                      <div key={i} className="flex-1 text-center text-[10px] text-gray-400 py-1">{q}</div>
                    ))}
                  </div>
                </div>

                {ganttProjects
                  .filter(p => (p.type === 'confirmed' && showConfirmed) || (p.type === 'capacity' && showCapacity))
                  .map((project, idx) => (
                    <div key={idx} className="flex items-center mb-1.5">
                      <div className="w-48 flex-shrink-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${project.type === 'confirmed' ? project.color : project.color.replace('200', '300')}`}></span>
                          <span className={`text-xs font-medium ${project.type === 'capacity' ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                            {project.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 ml-3.5">{project.market} · {project.units}u</span>
                      </div>
                      <div className="flex-1 relative h-6">
                        <div
                          className={`absolute top-0 h-full rounded ${project.type === 'confirmed' ? project.color : ''} ${project.type === 'capacity' ? 'border-2 border-dashed ' + project.color.replace('bg-', 'border-').replace('200', '400') + ' bg-opacity-30 ' + project.color : ''}`}
                          style={{
                            left: `${(project.start / quarters.length) * 100}%`,
                            width: `${((project.end - project.start) / quarters.length) * 100}%`,
                          }}
                        >
                          {project.type === 'capacity' && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-500">
                              {(project as any).probability}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-gray-500 mt-4 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>ATL Confirmed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>CLT Confirmed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span>NSH Confirmed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-dashed border-gray-400 rounded"></div>
                <span>Capacity Conversion (DC-06)</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <span className="text-sm">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-amber-800">CLUSTER ALERT: Nashville Q1-Q2 2026</p>
                  <p className="text-xs text-amber-600">4 projects (1,050 units) delivering within 2mi radius in Gulch/East Nashville. Absorption risk elevated.</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <span className="text-sm">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-amber-800">CLUSTER ALERT: Atlanta Q3 2026</p>
                  <p className="text-xs text-amber-600">3 projects (800 units) in Beltline/Midtown corridor. Monitor concession trends.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">10-Year Supply Wave ★ THE KILLER FEATURE</h3>
            <p className="text-sm text-gray-500 mt-0.5">Sources: S-02, S-03, S-04, S-06, S-09 + DC-08</p>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <svg viewBox="0 0 800 300" className="w-full h-64">
                {supplyWaveData.map((d, i) => {
                  const barWidth = 60;
                  const gap = 20;
                  const x = 40 + i * (barWidth + gap);
                  const confirmedHeight = (d.confirmed / maxSupply) * 220;
                  const capacityHeight = (d.capacity / maxSupply) * 220;
                  const totalHeight = confirmedHeight + capacityHeight;
                  const baseY = 260;

                  return (
                    <g key={i}>
                      {d.confirmed > 0 && (
                        <rect
                          x={x}
                          y={baseY - confirmedHeight - capacityHeight}
                          width={barWidth}
                          height={confirmedHeight}
                          fill="#ef4444"
                          rx="3"
                        />
                      )}
                      {d.capacity > 0 && (
                        <rect
                          x={x}
                          y={baseY - capacityHeight}
                          width={barWidth}
                          height={capacityHeight}
                          fill="#fdba74"
                          rx="3"
                          opacity="0.7"
                        />
                      )}
                      <text x={x + barWidth / 2} y={275} textAnchor="middle" className="text-[10px] fill-gray-500">{d.year}</text>
                      {(d.confirmed + d.capacity) > 0 && (
                        <text x={x + barWidth / 2} y={baseY - totalHeight - 5} textAnchor="middle" className="text-[9px] fill-gray-600 font-medium">
                          {((d.confirmed + d.capacity) / 1000).toFixed(1)}K
                        </text>
                      )}
                    </g>
                  );
                })}
                <line x1="30" y1="260" x2="830" y2="260" stroke="#e5e7eb" strokeWidth="1" />
              </svg>
            </div>

            <div className="flex items-center gap-6 text-xs text-gray-500 mb-6">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Confirmed Pipeline (S-02, S-03)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 bg-orange-300 rounded"></div>
                <span>Capacity Conversion (DC-06 probability-weighted)</span>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {[
                  { label: 'ATL', color: 'bg-blue-500' },
                  { label: 'CLT', color: 'bg-green-500' },
                  { label: 'NSH', color: 'bg-orange-500' },
                  { label: 'DAL', color: 'bg-purple-500' },
                  { label: 'RAL', color: 'bg-teal-500' },
                  { label: 'TPA', color: 'bg-pink-500' },
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${m.color}`}></div>
                    <span className="text-[10px]">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3">SUPPLY WAVE PHASE</h4>
              <div className="space-y-2">
                {supplyWavePhases.map((phase, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="font-semibold text-gray-900 w-24">{phase.market}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${phase.phaseColor}`}>{phase.phase}</span>
                    <span className="text-sm text-gray-600 flex-1">→ {phase.detail}, DC-02: {phase.buildout} {phase.constrained}</span>
                    {phase.window && (
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">{phase.window}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Build Economics Monitor</h3>
            <p className="text-sm text-gray-500 mt-0.5">YoC vs Cap Rate with constraint and last-mover analysis</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Market</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Cost/Unit (S-07)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Avg Rent (M-01)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">YoC</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Market Cap</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Spread</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {buildEconRows.map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.market}</td>
                    <td className="px-4 py-3 text-gray-600">{row.costUnit}</td>
                    <td className="px-4 py-3 text-gray-600">{row.avgRent}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.yoc}</td>
                    <td className="px-4 py-3 text-gray-600">{row.marketCap}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{row.spread}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${row.verdict.includes('MARGINAL') ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                        {row.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">DC-03: Higher constraint score = harder to build = better for existing owners. DC-05: Last Mover Advantage flagged when capacity {'<'}15% with active development nearby.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Developer Land Bank ★ NEW</h3>
            <p className="text-sm text-gray-500 mt-0.5">Who owns developable parcels across all markets (DC-09, DC-06)</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Owner</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Parcels</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Capacity</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Est. Start</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Prob (DC-06)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {landBankRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.owner}</td>
                      <td className="px-4 py-3 text-gray-600">{row.parcels}</td>
                      <td className="px-4 py-3 text-gray-600">{row.capacity}</td>
                      <td className="px-4 py-3 text-gray-600">{row.estStart}</td>
                      <td className="px-4 py-3 font-bold text-violet-700">{row.probability}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-center min-h-[250px] p-6">
              <div className="text-center">
                <div className="text-3xl mb-2">🗺️</div>
                <p className="text-sm font-medium text-gray-500">Developable Parcels Map</p>
                <p className="text-xs text-gray-400 mt-1">Pin map of developable parcels, color = DC-06 probability</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Supply Risk Map</h3>
            <p className="text-sm text-gray-500 mt-0.5">Dual-layer geospatial: pipeline risk + capacity risk</p>
          </div>
          <div className="p-6">
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2">🌐</div>
                <p className="text-sm font-medium text-gray-500">Supply Risk Map</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">Circle map: Inner circle = S-02 pipeline (red), Outer ring = DC-01 capacity (orange). Size = units. Larger gap between inner and outer = more future risk.</p>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-4 h-4 rounded-full bg-red-400 border-2 border-red-600"></div>
                    <span>Pipeline (S-02)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-6 h-6 rounded-full border-2 border-orange-400 bg-orange-100"></div>
                    <span>Capacity (DC-01)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FutureSupplyPage;
