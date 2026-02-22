/**
 * My Markets Dashboard - 5 Tab Navigation
 * Vertical deep-dive into ONE market
 * Shows which outputs are REAL vs MOCK with status badges
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Placeholder tab components (will be enhanced in Phase 2)
import OverviewTab from './tabs/OverviewTab';
import MarketDataTab from './tabs/MarketDataTab';
import SubmarketsTab from './tabs/SubmarketsTab';
import TrendsTab from './tabs/TrendsTab';
import DealsTab from './tabs/DealsTab';

type TabId = 'overview' | 'marketData' | 'submarkets' | 'trends' | 'deals';

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
  outputs: number;
  realOutputs: number; // How many outputs use real data
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: '✦', outputs: 25, realOutputs: 8 },
  { id: 'marketData', label: 'Market Data', icon: '📋', outputs: 44, realOutputs: 12 },
  { id: 'submarkets', label: 'Submarkets', icon: '🏘', outputs: 36, realOutputs: 6 },
  { id: 'trends', label: 'Trends', icon: '📈', outputs: 23, realOutputs: 4 },
  { id: 'deals', label: 'Deals', icon: '💼', outputs: 26, realOutputs: 8 },
];

const MyMarketsDashboard: React.FC = () => {
  const { marketId } = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Get market name from ID
  const getMarketName = () => {
    const names: Record<string, string> = {
      atlanta: 'Atlanta, GA',
      charlotte: 'Charlotte, NC',
      nashville: 'Nashville, TN',
      tampa: 'Tampa, FL',
    };
    return names[marketId || 'atlanta'] || 'Unknown Market';
  };

  const isRealData = marketId === 'atlanta';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/market-intelligence')}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold">{getMarketName()}</h1>
                <p className="text-blue-100 text-sm mt-1">Market Intelligence Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isRealData ? (
                <span className="px-3 py-1.5 bg-green-500 bg-opacity-30 border border-green-300 text-white text-sm font-medium rounded-lg">
                  🟢 Real Data: 1,028 Properties
                </span>
              ) : (
                <span className="px-3 py-1.5 bg-gray-500 bg-opacity-30 border border-gray-300 text-white text-sm font-medium rounded-lg">
                  ⚪ Mock Data
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const dataPercentage = Math.round((tab.realOutputs / tab.outputs) * 100);
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500">{tab.outputs} outputs</span>
                    {isRealData && (
                      <span className={`text-xs font-medium ${
                        dataPercentage >= 50 ? 'text-green-600' :
                        dataPercentage >= 25 ? 'text-yellow-600' :
                        'text-gray-600'
                      }`}>
                        {dataPercentage}% real
                      </span>
                    )}
                  </div>
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab marketId={marketId || 'atlanta'} />}
        {activeTab === 'marketData' && <MarketDataTab marketId={marketId || 'atlanta'} />}
        {activeTab === 'submarkets' && <SubmarketsTab marketId={marketId || 'atlanta'} />}
        {activeTab === 'trends' && <TrendsTab marketId={marketId || 'atlanta'} />}
        {activeTab === 'deals' && <DealsTab marketId={marketId || 'atlanta'} />}
      </div>
    </div>
  );
};

export default MyMarketsDashboard;
