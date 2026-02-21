/**
 * Compare Markets Page - Horizontal View
 * 39 outputs total (28 original + 11 new from v2.0)
 * Cross-MSA allocation decisions
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const selectedCount = markets.filter(m => m.selected).length;

  const toggleMarket = (id: string) => {
    setMarkets(markets.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  };

  const outputGroups = [
    {
      title: 'Original Outputs (28)',
      outputs: [
        'All D outputs at MSA level',
        'All S outputs at MSA level',  
        'All M outputs at MSA level',
        'P-avg outputs (position averages)',
        'R composite outputs (risk)',
      ],
    },
    {
      title: 'New Dev Capacity Outputs (7) ★',
      outputs: [
        'DC-01: Capacity Ratio per market',
        'DC-02: Buildout Timeline per market',
        'DC-03: Supply Constraint per market',
        'DC-04: Supply Overhang Risk per market',
        'DC-07: Pricing Power per market',
        'DC-08: 10yr Wave Summary per market',
        'DC-11: Supply-Adj Rent Forecast per market',
      ],
    },
    {
      title: 'New Traffic Outputs (2) ★',
      outputs: [
        'T-02 avg: Physical Traffic per market',
        'T-03 avg: Digital Traffic per market',
      ],
    },
    {
      title: 'AI Investment Recommendation (Enhanced) ★',
      outputs: [
        'Claude narrative using all outputs including:',
        '- DC-03 (constraint)',
        '- DC-07 (pricing power)',
        '- DC-08 (supply wave phase)',
        'Confidence scores per market',
      ],
    },
  ];

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
                <h1 className="text-3xl font-bold text-gray-900">Compare Markets</h1>
                <p className="text-gray-600 mt-1">Cross-MSA allocation decisions • 39 outputs</p>
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
          <h2 className="text-lg font-semibold mb-4">Select Markets to Compare (2-4)</h2>
          <div className="grid grid-cols-4 gap-4">
            {markets.map((market) => (
              <button
                key={market.id}
                onClick={() => toggleMarket(market.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  market.selected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{market.name}</span>
                  {market.selected && <span className="text-blue-600">✓</span>}
                </div>
                <div className="text-sm text-gray-600">{market.state}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {selectedCount} of 4 markets selected
            {selectedCount < 2 && ' (select at least 2)'}
            {selectedCount > 4 && ' (max 4 allowed)'}
          </div>
        </div>

        {/* Output Groups */}
        {outputGroups.map((group, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">{group.title}</h3>
            <div className="space-y-2">
              {group.outputs.map((output, outputIdx) => (
                <div key={outputIdx} className="flex items-start p-3 bg-gray-50 rounded-lg">
                  <span className="text-blue-600 mr-2">•</span>
                  <span className="text-sm text-gray-700">{output}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Phase 2 Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold mb-3">🚧 Phase 2: Components to Build</h3>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
            <li><strong>Radar Chart (8 axes):</strong> 5 original + 3 new (DC-03, DC-07, T-02 avg)</li>
            <li><strong>Side-by-Side Metrics Table:</strong> All 39 outputs in sortable columns</li>
            <li><strong>Trend Comparison Charts:</strong> Toggle between rent growth, pipeline %, cap rates, JEDI, traffic, supply wave, pricing power</li>
            <li><strong>AI Investment Recommendation:</strong> Claude narrative analyzing all outputs with confidence scores</li>
            <li><strong>Entry Point Calculator:</strong> Uses DC-11 (supply-adjusted rent forecast), DC-07 (pricing power), T-05 (traffic-to-lease)</li>
          </ul>
        </div>

        {/* User Journey Context */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold mb-3">💡 User Journey: "$50M to deploy in Southeast"</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>Phase 1:</strong> Compare Atlanta, Charlotte, Nashville, Tampa</p>
            <p><strong>Result:</strong> Radar chart shows Charlotte = best risk-adjusted. AI says: "Charlotte and Tampa are past-peak supply. Nashville avoid."</p>
            <p><strong>Decision:</strong> Focus on Charlotte, explore Atlanta</p>
            <p><strong>Next:</strong> Navigate to "My Markets → Charlotte → Submarkets" for deep-dive</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareMarketsPage;
