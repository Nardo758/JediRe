/**
 * Market Intelligence - Main Entry Page
 * Shows market selector grid, routes to My Markets or horizontal views
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Market {
  id: string;
  name: string;
  state: string;
  jediScore: number;
  dataStatus: 'REAL' | 'PARTIAL' | 'MOCK';
  properties: number;
  coverage: number; // percentage
}

// Markets we're tracking (Atlanta has real data)
const TRACKED_MARKETS: Market[] = [
  {
    id: 'atlanta',
    name: 'Atlanta',
    state: 'GA',
    jediScore: 78,
    dataStatus: 'REAL',
    properties: 1028,
    coverage: 60,
  },
  {
    id: 'charlotte',
    name: 'Charlotte',
    state: 'NC',
    jediScore: 82,
    dataStatus: 'MOCK',
    properties: 0,
    coverage: 0,
  },
  {
    id: 'nashville',
    name: 'Nashville',
    state: 'TN',
    jediScore: 74,
    dataStatus: 'MOCK',
    properties: 0,
    coverage: 0,
  },
  {
    id: 'tampa',
    name: 'Tampa',
    state: 'FL',
    jediScore: 76,
    dataStatus: 'MOCK',
    properties: 0,
    coverage: 0,
  },
];

const MarketIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'jediScore' | 'name'>('jediScore');

  const sortedMarkets = [...TRACKED_MARKETS].sort((a, b) => {
    if (sortBy === 'jediScore') return b.jediScore - a.jediScore;
    return a.name.localeCompare(b.name);
  });

  const getStatusBadge = (status: Market['dataStatus']) => {
    switch (status) {
      case 'REAL':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">🟢 REAL DATA</span>;
      case 'PARTIAL':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">🟡 PARTIAL</span>;
      case 'MOCK':
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">⚪ MOCK DATA</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Market Intelligence</h1>
              <p className="text-gray-600 mt-1">89 research outputs across 8 signal groups</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/market-intelligence/compare')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ⚖️ Compare Markets
              </button>
              <button
                onClick={() => navigate('/market-intelligence/owners')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                👥 Active Owners
              </button>
              <button
                onClick={() => navigate('/market-intelligence/supply')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                🏗️ Future Supply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Market Selector */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Sort Controls */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">My Markets</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <button
              onClick={() => setSortBy('jediScore')}
              className={`px-3 py-1 rounded ${
                sortBy === 'jediScore'
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              JEDI Score
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1 rounded ${
                sortBy === 'name'
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Name
            </button>
          </div>
        </div>

        {/* Market Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sortedMarkets.map((market) => (
            <div
              key={market.id}
              onClick={() => navigate(`/market-intelligence/markets/${market.id}`)}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">{market.name}</h3>
                  <p className="text-sm text-gray-600">{market.state}</p>
                </div>
                {getStatusBadge(market.dataStatus)}
              </div>

              {/* JEDI Score */}
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">JEDI Score</div>
                <div className={`text-4xl font-bold ${getScoreColor(market.jediScore)}`}>
                  {market.jediScore}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Properties:</span>
                  <span className="font-medium">
                    {market.properties > 0 ? market.properties.toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Coverage:</span>
                  <span className="font-medium">
                    {market.coverage > 0 ? `${market.coverage}%` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Coverage Bar */}
              {market.coverage > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        market.dataStatus === 'REAL' ? 'bg-green-500' :
                        market.dataStatus === 'PARTIAL' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`}
                      style={{ width: `${market.coverage}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Click indicator */}
              <div className="mt-4 text-xs text-gray-400 text-center">
                Click to explore →
              </div>
            </div>
          ))}
        </div>

        {/* Add Market Button */}
        <div className="mt-6">
          <button className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors">
            + Add New Market
          </button>
        </div>

        {/* Data Status Legend */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Data Status Legend:</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <span className="w-24 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded mr-3">🟢 REAL DATA</span>
              <span className="text-gray-700">Using actual municipal property records and market data</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded mr-3">🟡 PARTIAL</span>
              <span className="text-gray-700">Some data sources active, others pending</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded mr-3">⚪ MOCK DATA</span>
              <span className="text-gray-700">Placeholder data for demonstration purposes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketIntelligencePage;
