import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OutputCard, { OutputSection } from './components/OutputCard';
import { SIGNAL_GROUPS } from './signalGroups';

const FutureSupplyPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMarket, setSelectedMarket] = useState('atlanta');

  const markets = [
    { id: 'atlanta', name: 'Atlanta', pipelineRisk: 'MEDIUM', capacityRisk: 'LOW', buildoutYears: 12.4 },
    { id: 'charlotte', name: 'Charlotte', pipelineRisk: 'LOW', capacityRisk: 'MODERATE', buildoutYears: 8.6 },
    { id: 'nashville', name: 'Nashville', pipelineRisk: 'HIGH', capacityRisk: 'LOW', buildoutYears: 6.2 },
    { id: 'tampa', name: 'Tampa', pipelineRisk: 'MEDIUM', capacityRisk: 'HIGH', buildoutYears: 18.9 },
  ];

  const scoreboardOutputs = ['S-02', 'S-03', 'S-04', 'S-05', 'S-06', 'DC-01', 'DC-03', 'DC-04'];
  const calendarOutputs = ['S-02', 'S-03', 'S-05', 'DC-06'];
  const waveOutputs = ['S-02', 'S-03', 'S-04', 'S-06', 'S-09', 'DC-08'];
  const buildEconOutputs = ['S-07', 'DC-03', 'DC-05'];
  const landBankOutputs = ['DC-09', 'DC-06', 'DC-10'];
  const mapOutputs = ['S-02', 'S-05', 'DC-01'];

  const mock10YearWave = [
    { year: 2026, pipeline: 400, capacity: 45, phase: 'CRESTING' },
    { year: 2027, pipeline: 200, capacity: 52, phase: 'TROUGH' },
    { year: 2028, pipeline: 0, capacity: 48, phase: 'TROUGH' },
    { year: 2029, pipeline: 0, capacity: 55, phase: 'TROUGH' },
    { year: 2030, pipeline: 0, capacity: 62, phase: 'BUILDING' },
    { year: 2031, pipeline: 0, capacity: 68, phase: 'BUILDING' },
    { year: 2032, pipeline: 0, capacity: 72, phase: 'BUILDING' },
    { year: 2033, pipeline: 0, capacity: 78, phase: 'BUILDING' },
    { year: 2034, pipeline: 0, capacity: 85, phase: 'BUILDING' },
    { year: 2035, pipeline: 0, capacity: 92, phase: 'BUILDING' },
  ];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MODERATE': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const phaseColor = (phase: string) => {
    switch (phase) {
      case 'PEAKING': return 'bg-red-100 text-red-800';
      case 'CRESTING': return 'bg-yellow-100 text-yellow-800';
      case 'TROUGH': return 'bg-green-100 text-green-800';
      case 'BUILDING': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
                <h1 className="text-2xl font-bold text-gray-900">Future Supply</h1>
                <p className="text-sm text-gray-500 mt-0.5">10-year supply risk — THE KILLER FEATURE</p>
              </div>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">21 outputs</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <OutputSection
          title="Supply Risk Scoreboard"
          description="Enhanced: Pipeline risk + Capacity risk per market"
          outputIds={scoreboardOutputs}
          groupHighlight="SUPPLY"
        >
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Market</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Pipeline Risk (S-02–S-06)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Capacity Risk (DC-01)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Constraint (DC-03)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Overhang (DC-04)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Buildout</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr
                    key={market.id}
                    onClick={() => setSelectedMarket(market.id)}
                    className={`border-t border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${selectedMarket === market.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{market.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getRiskColor(market.pipelineRisk)}`}>{market.pipelineRisk}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getRiskColor(market.capacityRisk)}`}>{market.capacityRisk}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${40 + Math.random() * 50}%` }}></div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${20 + Math.random() * 60}%` }}></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{market.buildoutYears} yrs</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-blue-600 text-xs hover:underline">Details →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OutputSection>

        <OutputSection
          title="Delivery Calendar (Gantt)"
          description="Project-level timeline with DC-06 probability-weighted ghost bars"
          outputIds={calendarOutputs}
        >
          <div className="space-y-3 mb-4">
            {[
              { name: 'Beltline Phase III', units: 320, start: 'Q1 2026', end: 'Q3 2027', progress: 65, isGhost: false },
              { name: 'Midtown Tower', units: 280, start: 'Q2 2026', end: 'Q4 2027', progress: 40, isGhost: false },
              { name: 'Decatur Station', units: 200, start: 'Q3 2026', end: 'Q1 2028', progress: 15, isGhost: false },
              { name: 'Buckhead Parcel A (DC-06)', units: 180, start: 'Q1 2028', end: 'Q4 2029', progress: 0, isGhost: true },
              { name: 'Sandy Springs Land (DC-06)', units: 240, start: 'Q3 2028', end: 'Q2 2030', progress: 0, isGhost: true },
            ].map((project, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-48 flex-shrink-0">
                  <p className={`text-sm font-medium ${project.isGhost ? 'text-gray-400 italic' : 'text-gray-800'}`}>{project.name}</p>
                  <p className="text-[11px] text-gray-400">{project.units} units · {project.start} – {project.end}</p>
                </div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                  {project.isGhost ? (
                    <div className="absolute inset-0 bg-orange-200/50 rounded-full border-2 border-dashed border-orange-300" style={{ width: '60%', marginLeft: '30%' }}></div>
                  ) : (
                    <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${project.progress}%` }}></div>
                  )}
                </div>
                <span className="w-12 text-xs text-right text-gray-500 flex-shrink-0">
                  {project.isGhost ? 'Ghost' : `${project.progress}%`}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-500 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Confirmed Pipeline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-orange-200 border-2 border-dashed border-orange-300 rounded"></div>
              <span>DC-06 Ghost Bars (probability-weighted)</span>
            </div>
          </div>
        </OutputSection>

        <OutputSection
          title="10-Year Supply Wave"
          description="THE KEY UPGRADE — Pipeline (solid red) + Capacity Conversion (gradient orange)"
          outputIds={waveOutputs}
          groupHighlight="DEV_CAPACITY"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Current Phase:</span>
              <span className={`px-3 py-1 rounded-lg font-medium text-sm ${phaseColor('CRESTING')}`}>CRESTING</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {['PEAKING', 'CRESTING', 'TROUGH', 'BUILDING'].map(p => (
                <span key={p} className={`px-2 py-0.5 rounded ${phaseColor(p)}`}>{p}</span>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 mb-6">
            {mock10YearWave.map((year, idx) => {
              const total = year.pipeline + year.capacity;
              const maxTotal = 500;
              const pipelineWidth = (year.pipeline / maxTotal) * 100;
              const capacityWidth = (year.capacity / maxTotal) * 100;

              return (
                <div key={idx} className="flex items-center">
                  <div className="w-14 text-sm text-gray-600 font-medium flex-shrink-0">{year.year}</div>
                  <div className="flex-1 flex items-center gap-1">
                    {year.pipeline > 0 && (
                      <div
                        className="h-7 bg-red-500 rounded flex items-center justify-center text-white text-[11px] font-medium"
                        style={{ width: `${pipelineWidth}%` }}
                      >
                        {year.pipeline > 50 && `${year.pipeline}`}
                      </div>
                    )}
                    <div
                      className="h-7 bg-gradient-to-r from-orange-400 to-orange-200 rounded flex items-center justify-center text-white text-[11px] font-medium"
                      style={{ width: `${capacityWidth}%` }}
                    >
                      {year.capacity > 30 && `${year.capacity}`}
                    </div>
                    <span className="ml-2 text-xs text-gray-400">{total} total</span>
                  </div>
                  <div className="w-24 text-right flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${phaseColor(year.phase)}`}>{year.phase}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Confirmed Pipeline (S-02, S-03)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gradient-to-r from-orange-400 to-orange-200 rounded"></div>
              <span>Capacity Conversion (DC-06 probability-weighted)</span>
            </div>
          </div>
        </OutputSection>

        <OutputSection
          title="Build Economics Monitor"
          description="YoC vs Cap Rate with constraint and last-mover analysis"
          outputIds={buildEconOutputs}
        >
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Market</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">New Build YoC (S-07)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Existing Cap Rate</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Spread</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Constraint (DC-03)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Last Mover (DC-05)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { market: 'Atlanta', yoc: '5.2%', cap: '5.8%', spread: '+60bps', constraint: 72, lastMover: false },
                  { market: 'Charlotte', yoc: '4.8%', cap: '5.5%', spread: '+70bps', constraint: 58, lastMover: true },
                  { market: 'Nashville', yoc: '4.5%', cap: '5.1%', spread: '+60bps', constraint: 45, lastMover: false },
                  { market: 'Tampa', yoc: '5.0%', cap: '5.4%', spread: '+40bps', constraint: 82, lastMover: true },
                ].map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.market}</td>
                    <td className="px-4 py-3 text-gray-600">{row.yoc}</td>
                    <td className="px-4 py-3 text-gray-600">{row.cap}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{row.spread}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${row.constraint}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-500">{row.constraint}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.lastMover ? (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">LAST MOVER</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OutputSection>

        <OutputSection
          title="Developer Land Bank"
          description="NEW — Who owns developable parcels across all markets"
          outputIds={landBankOutputs}
          groupHighlight="DEV_CAPACITY"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Owner</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Parcels</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Capacity</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Est. Start</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { owner: 'Greystone Capital', parcels: 3, capacity: '480 units', start: 'Q2 2028', status: 'Entitled' },
                    { owner: 'Mill Creek Res.', parcels: 2, capacity: '320 units', start: 'Q4 2028', status: 'Pre-zoning' },
                    { owner: 'Trammell Crow', parcels: 4, capacity: '650 units', start: 'Q1 2029', status: 'Land banked' },
                    { owner: 'Hines', parcels: 1, capacity: '200 units', start: 'Q3 2029', status: 'Under review' },
                  ].map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.owner}</td>
                      <td className="px-4 py-3 text-gray-600">{row.parcels}</td>
                      <td className="px-4 py-3 text-gray-600">{row.capacity}</td>
                      <td className="px-4 py-3 text-gray-600">{row.start}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center min-h-[220px]">
              <div className="text-center">
                <div className="text-3xl mb-2">🗺️</div>
                <p className="text-sm font-medium text-gray-500">Developable Parcels Map</p>
                <p className="text-xs text-gray-400 mt-1">Colored by DC-06 probability</p>
              </div>
            </div>
          </div>
        </OutputSection>

        <OutputSection
          title="Supply Risk Map"
          description="Dual-layer geospatial: inner = pipeline risk, outer = capacity risk"
          outputIds={mapOutputs}
        >
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 h-64 flex items-center justify-center mb-4">
            <div className="text-center">
              <div className="text-3xl mb-2">🌐</div>
              <p className="text-sm font-medium text-gray-500">Supply Risk Map (Mapbox)</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">Dual-layer circles: inner ring = pipeline risk (S-02, S-05), outer ring = capacity risk (DC-01)</p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-4 h-4 rounded-full bg-red-400 border-2 border-red-600"></div>
                  <span>Pipeline</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-6 h-6 rounded-full border-2 border-violet-400 bg-violet-100"></div>
                  <span>Capacity</span>
                </div>
              </div>
            </div>
          </div>
        </OutputSection>
      </div>
    </div>
  );
};

export default FutureSupplyPage;
