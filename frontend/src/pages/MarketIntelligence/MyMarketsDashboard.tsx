/**
 * My Markets Dashboard - 5 Tab Navigation
 * Vertical deep-dive into ONE market
 * Shows which outputs are REAL vs MOCK with status badges
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BT } from '@/components/deal/bloomberg-ui';

// Placeholder tab components (will be enhanced in Phase 2)
import OverviewTab from './tabs/OverviewTab';
import PropertyDataTab from './tabs/PropertyDataTab';
import SubmarketsTab from './tabs/SubmarketsTab';
import PowerRankingsTab from './tabs/PowerRankingsTab';
import TrendsTab from './tabs/TrendsTab';
import DealsTab from './tabs/DealsTab';

type TabId = 'overview' | 'marketData' | 'submarkets' | 'powerRankings' | 'trends' | 'deals';

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
  outputs: number;
  realOutputs: number; // How many outputs use real data
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: '✦', outputs: 25, realOutputs: 8 },
  { id: 'submarkets', label: 'Submarkets', icon: '🏘', outputs: 36, realOutputs: 6 },
  { id: 'powerRankings', label: 'Power Rankings', icon: '🏆', outputs: 18, realOutputs: 14 },
  { id: 'marketData', label: 'Property Data', icon: '📋', outputs: 44, realOutputs: 12 },
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
    <div className="min-h-screen" style={{ background: BT.bg.terminal }}>
      {/* Header */}
      <div style={{ background: BT.bg.header, color: BT.text.primary }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/terminal', { state: { fkey: 'F4' } })}
                className="p-2 hover:opacity-80 transition-colors"
                style={{ borderRadius: 0 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: BT.text.primary }}>{getMarketName()}</h1>
                <p className="text-sm mt-1" style={{ color: BT.text.secondary }}>Market Intelligence Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isRealData ? (
                <span className="px-3 py-1.5 border text-sm font-medium" style={{ background: BT.text.green + '22', borderColor: BT.text.green + '55', color: BT.text.primary, borderRadius: 0 }}>
                  Real Data: 1,028 Properties
                </span>
              ) : (
                <span className="px-3 py-1.5 border text-sm font-medium" style={{ background: BT.bg.active, borderColor: BT.border.medium, color: BT.text.primary, borderRadius: 0 }}>
                  Mock Data
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b sticky top-0 z-10" style={{ background: BT.bg.panel, borderColor: BT.border.subtle }}>
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const dataPercentage = Math.round((tab.realOutputs / tab.outputs) * 100);

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative py-4 px-2 border-b-2 font-medium text-sm transition-colors"
                  style={
                    isActive
                      ? { borderBottomColor: BT.text.cyan, color: BT.text.cyan }
                      : { borderBottomColor: 'transparent', color: BT.text.secondary }
                  }
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs" style={{ color: BT.text.secondary }}>{tab.outputs} outputs</span>
                    {isRealData && (
                      <span className="text-xs font-medium" style={{
                        color: dataPercentage >= 50 ? BT.text.green :
                        dataPercentage >= 25 ? BT.text.amber :
                        BT.text.secondary
                      }}>
                        {dataPercentage}% real
                      </span>
                    )}
                  </div>
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: BT.text.cyan }}></div>
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
        {activeTab === 'marketData' && <PropertyDataTab marketId={marketId || 'atlanta'} />}
        {activeTab === 'submarkets' && <SubmarketsTab marketId={marketId || 'atlanta'} />}
        {activeTab === 'powerRankings' && <PowerRankingsTab marketId={marketId || 'atlanta'} />}
        {activeTab === 'trends' && <TrendsTab marketId={marketId || 'atlanta'} />}
        {activeTab === 'deals' && <DealsTab marketId={marketId || 'atlanta'} />}
      </div>
    </div>
  );
};

export default MyMarketsDashboard;
