/**
 * Future Supply Page - Horizontal View
 * 21 outputs total (12 original + 9 new from v2.0)
 * Supply risk dashboard across ALL tracked markets
 * 
 * KEY FEATURE: 10-Year Supply Wave (DC-08) 🔥
 * This is the killer feature that extends analysis from 2 years to 10 years
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FutureSupplyPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMarket, setSelectedMarket] = useState('atlanta');

  const markets = [
    { id: 'atlanta', name: 'Atlanta', pipelineRisk: 'MEDIUM', capacityRisk: 'LOW', buildoutYears: 12.4 },
    { id: 'charlotte', name: 'Charlotte', pipelineRisk: 'LOW', capacityRisk: 'MODERATE', buildoutYears: 8.6 },
    { id: 'nashville', name: 'Nashville', pipelineRisk: 'HIGH', capacityRisk: 'LOW', buildoutYears: 6.2 },
    { id: 'tampa', name: 'Tampa', pipelineRisk: 'MEDIUM', capacityRisk: 'HIGH', buildoutYears: 18.9 },
  ];

  const outputSections = [
    {
      title: 'Supply Risk Scoreboard (Enhanced) ★',
      description: 'Risk classification now uses BOTH pipeline AND capacity',
      outputs: [
        'S-02, S-03, S-04, S-05, S-06 per market (original)',
        'DC-01: Capacity Ratio (long-term risk) ★ NEW COLUMN',
        'DC-03: Supply Constraint Score ★ NEW COLUMN',
        'DC-04: Supply Overhang Risk ★ NEW COLUMN',
        'Shows: Confirmed pipeline AS solid bars + Capacity conversion AS dotted/transparent bars',
      ],
    },
    {
      title: 'Delivery Calendar (Gantt Timeline)',
      description: 'Project-level visibility with probability-weighted capacity',
      outputs: [
        'S-02, S-03, S-05 project-level (original)',
        'DC-06: Probability-weighted vacant land as "ghost bars" ★ NEW',
        'Cluster alerts flag geographic + temporal clustering',
      ],
    },
    {
      title: '10-Year Supply Wave Analysis ★ 🔥 KEY UPGRADE',
      description: 'Extends from 2-year to 10-year horizon - THE KILLER FEATURE',
      outputs: [
        'S-02, S-03, S-04, S-06, S-09 (original: 2-year view)',
        'DC-08: EXTENDS TO 10 YEARS ★ THE DIFFERENTIATOR',
        'Year-by-year: Pipeline (solid) + Capacity Conversion (gradient)',
        'Phase labels per market: PEAKING → CRESTING → TROUGH → BUILDING',
        'DC-02: Buildout timeline annotation ("8.6 years to practical buildout in Decatur")',
        'DC-05: Last Mover flags on specific submarkets',
      ],
    },
    {
      title: 'Build Economics Monitor (Enhanced) ★',
      description: 'Why is new construction feasible or not?',
      outputs: [
        'S-07 per market: new build YoC vs existing cap (original)',
        'DC-03: Supply constraint explains WHY building is uneconomic ★ NEW',
        'DC-05: Last mover advantage - where is it still worth building? ★ NEW',
      ],
    },
    {
      title: 'Developer Land Bank ★ NEW SECTION',
      description: 'Who owns developable parcels across all markets',
      outputs: [
        'DC-09: Who owns developable parcels ★ NEW',
        'DC-06: Development probability per parcel ★ NEW',
        'DC-10: Assemblage opportunity scores ★ NEW',
        'Table: Owner | Parcels | Capacity | Est. Start | Status',
        'Map: Developable parcels colored by probability',
      ],
    },
    {
      title: 'Supply Risk Map (Enhanced) ★',
      description: 'Geospatial visualization with dual risk layers',
      outputs: [
        'S-02, S-05 geospatial (original)',
        'DC-01: Capacity ratio colors the "long-term" risk ring ★ NEW',
        'Market circles: inner = pipeline risk, outer = capacity risk',
      ],
    },
  ];

  // Mock 10-year supply wave data for visualization
  const mock10YearWave = {
    atlanta: [
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
    ],
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MODERATE': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const selectedMarketData = markets.find(m => m.id === selectedMarket);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                <h1 className="text-3xl font-bold text-gray-900">Future Supply</h1>
                <p className="text-gray-600 mt-1">10-year supply risk • 21 outputs • 9 NEW 🔥</p>
              </div>
            </div>
            <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-lg">
              🚧 Phase 1: Skeleton
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Market Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Supply Risk Scoreboard</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Market</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Pipeline Risk</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Capacity Risk ★</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Buildout Timeline ★</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr 
                    key={market.id}
                    onClick={() => setSelectedMarket(market.id)}
                    className={`border-t border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                      selectedMarket === market.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{market.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(market.pipelineRisk)}`}>
                        {market.pipelineRisk}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(market.capacityRisk)}`}>
                        {market.capacityRisk}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{market.buildoutYears} years</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-blue-600 text-sm hover:underline">View Details →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 10-Year Supply Wave Visualization (Mock) */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">10-Year Supply Wave 🔥</h2>
              <p className="text-sm text-gray-600">DC-08: Extended forecast showing pipeline + capacity conversion</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Current Phase:</span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg font-medium text-sm">
                CRESTING
              </span>
            </div>
          </div>

          {/* Bar Chart Placeholder */}
          <div className="space-y-3">
            {mock10YearWave.atlanta.map((year, idx) => {
              const total = year.pipeline + year.capacity;
              const maxTotal = 500;
              const pipelineWidth = (year.pipeline / maxTotal) * 100;
              const capacityWidth = (year.capacity / maxTotal) * 100;
              
              return (
                <div key={idx} className="flex items-center">
                  <div className="w-16 text-sm text-gray-600 font-medium">{year.year}</div>
                  <div className="flex-1 flex items-center space-x-1">
                    {/* Pipeline (solid) */}
                    {year.pipeline > 0 && (
                      <div 
                        className="h-8 bg-red-500 rounded flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${pipelineWidth}%` }}
                      >
                        {year.pipeline > 50 && `${year.pipeline} pipeline`}
                      </div>
                    )}
                    {/* Capacity (gradient) */}
                    <div 
                      className="h-8 bg-gradient-to-r from-orange-400 to-orange-200 rounded flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${capacityWidth}%` }}
                    >
                      {year.capacity > 30 && `${year.capacity} capacity`}
                    </div>
                    <span className="ml-3 text-sm text-gray-600">{total} total</span>
                  </div>
                  <div className="w-24 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      year.phase === 'CRESTING' ? 'bg-yellow-100 text-yellow-800' :
                      year.phase === 'TROUGH' ? 'bg-green-100 text-green-800' :
                      year.phase === 'BUILDING' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {year.phase}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
              <span className="text-gray-600">Confirmed Pipeline (S-02, S-03)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gradient-to-r from-orange-400 to-orange-200 rounded mr-2"></div>
              <span className="text-gray-600">Capacity Conversion (DC-06 probability-weighted)</span>
            </div>
          </div>
        </div>

        {/* Output Sections */}
        {outputSections.map((section, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{section.description}</p>
            <div className="space-y-2">
              {section.outputs.map((output, outputIdx) => (
                <div key={outputIdx} className="flex items-start p-3 bg-gray-50 rounded-lg">
                  <span className="text-blue-600 mr-2">•</span>
                  <span className="text-sm text-gray-700">{output}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Key Insight */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-3">🔥 The 10-Year Advantage</h3>
          <div className="text-sm text-purple-900 space-y-2">
            <p><strong>Industry Standard:</strong> Sees 2 years of pipeline (S-02 + S-03)</p>
            <p><strong>JEDI RE:</strong> Sees 10+ years by analyzing zoning capacity, vacant land, and development probability</p>
            <p className="pt-2 font-medium">This fundamentally changes risk assessment:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Charlotte shows "safe" with 12% pipeline, but DC-08 reveals 4+ years of hidden capacity → Medium long-term risk</li>
              <li>Nashville looks "risky" with 18% pipeline, but DC-01 shows 95% built out → Actually protected from future supply</li>
              <li>Atlanta appears "moderate" but DC-08 shows declining wave through 2029 → Perfect 3-5 year hold timing</li>
            </ul>
          </div>
        </div>

        {/* Phase 2 Components */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold mb-3">🚧 Phase 2: Components to Build</h3>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
            <li><strong>Interactive 10-Year Wave Chart:</strong> Recharts or D3.js with hover details, phase annotations</li>
            <li><strong>Delivery Calendar (Gantt):</strong> Project timeline with probability-weighted capacity overlays</li>
            <li><strong>Build Economics Table:</strong> YoC vs Cap Rate with DC-03/DC-05 explanations</li>
            <li><strong>Developer Land Bank Section:</strong> Table + map showing DC-09 parcels colored by DC-06 probability</li>
            <li><strong>Supply Risk Map:</strong> Mapbox with dual-layer circles (inner = pipeline, outer = capacity)</li>
            <li><strong>Market Phase Tracker:</strong> Visual timeline showing which markets are in which phase</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FutureSupplyPage;
