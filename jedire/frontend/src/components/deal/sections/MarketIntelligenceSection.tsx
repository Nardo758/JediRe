/**
 * Market Intelligence Section - Deal Page
 * Consolidated view of Market Analysis, Competition, and Supply Tracking
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { PlaceholderContent } from '../PlaceholderContent';
import { ModuleToggle } from '../ModuleToggle';

interface MarketIntelligenceSectionProps {
  deal: Deal;
  isPremium?: boolean;
}

type SubTab = 'analysis' | 'competition' | 'supply';

export const MarketIntelligenceSection: React.FC<MarketIntelligenceSectionProps> = ({ 
  deal, 
  isPremium = false 
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('analysis');
  const [mode, setMode] = useState<'basic' | 'enhanced'>('basic');

  const tabs = [
    { id: 'analysis' as SubTab, label: 'Market Analysis', icon: '📈' },
    { id: 'competition' as SubTab, label: 'Competition', icon: '🏆' },
    { id: 'supply' as SubTab, label: 'Supply Tracking', icon: '📦' },
  ];

  const renderAnalysisTab = () => {
    const wireframe = `
┌────────────────────────────────────────────────────┐
│  Market Overview: Atlanta, GA - Buckhead           │
├────────────────────────────────────────────────────┤
│  📊 Key Metrics                                    │
│  • Median Rent: $1,850/mo (+5.2% YoY)             │
│  • Vacancy Rate: 4.2% (↓ from 5.1%)               │
│  • Population Growth: +2.8% annually               │
│  • Median Income: $68,500 (+3.1% YoY)             │
├────────────────────────────────────────────────────┤
│  Supply & Demand                                   │
│  [Chart: New supply vs absorption]                 │
│  • Units Delivered (12mo): 1,245                   │
│  • Units Absorbed: 1,580                           │
│  • Pipeline: 890 units                             │
├────────────────────────────────────────────────────┤
│  Competitive Set (5 properties within 1 mi)        │
│  [List of comparable properties]                   │
└────────────────────────────────────────────────────┘
    `.trim();

    return (
      <PlaceholderContent
        title="Market Analysis"
        description="Comprehensive market trends, demographics, and competitive analysis"
        status="to-be-built"
        icon="📈"
        wireframe={wireframe}
      >
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <strong>Basic Features:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Market summary (rent, vacancy, growth)</li>
              <li>Basic demographics</li>
              <li>Competitive properties list</li>
              <li>Supply/demand overview</li>
            </ul>
          </div>
          <div>
            <strong>Enhanced Features (Premium):</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Deep demographic analysis (income, age, education)</li>
              <li>5-year market forecasts</li>
              <li>Employment trends by sector</li>
              <li>Transit and infrastructure impact analysis</li>
              <li>Submarket comparison</li>
              <li>Migration patterns</li>
              <li>Competitive set benchmarking</li>
            </ul>
          </div>
        </div>
      </PlaceholderContent>
    );
  };

  const renderCompetitionTab = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm font-medium text-orange-600 mb-1">Competing Properties</div>
            <div className="text-2xl font-bold text-orange-900">—</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm font-medium text-red-600 mb-1">Avg Competitor Rent</div>
            <div className="text-2xl font-bold text-red-900">—</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-sm font-medium text-yellow-600 mb-1">Market Position</div>
            <div className="text-2xl font-bold text-yellow-900">—</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-3">Competitive Landscape</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Comparable Properties</span>
              <span className="text-sm font-medium text-gray-400">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Market Positioning Analysis</span>
              <span className="text-sm font-medium text-gray-400">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Rent Comparison Matrix</span>
              <span className="text-sm font-medium text-gray-400">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Amenity Gap Analysis</span>
              <span className="text-sm font-medium text-gray-400">Coming Soon</span>
            </div>
          </div>
        </div>

        {!isPremium && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <p className="text-sm text-orange-700">Upgrade to Pro for full competitive analysis with real-time market data</p>
          </div>
        )}
      </div>
    );
  };

  const renderSupplyTab = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-indigo-50 rounded-lg p-4">
            <div className="text-sm font-medium text-indigo-600 mb-1">Pipeline Units</div>
            <div className="text-2xl font-bold text-indigo-900">—</div>
          </div>
          <div className="bg-cyan-50 rounded-lg p-4">
            <div className="text-sm font-medium text-cyan-600 mb-1">Under Construction</div>
            <div className="text-2xl font-bold text-cyan-900">—</div>
          </div>
          <div className="bg-teal-50 rounded-lg p-4">
            <div className="text-sm font-medium text-teal-600 mb-1">Planned Projects</div>
            <div className="text-2xl font-bold text-teal-900">—</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-3">Supply Pipeline</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">New Construction Monitoring</span>
              <span className="text-sm font-medium text-gray-400">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Permit Activity Tracking</span>
              <span className="text-sm font-medium text-gray-400">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Delivery Timeline Forecast</span>
              <span className="text-sm font-medium text-gray-400">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Impact on Existing Supply</span>
              <span className="text-sm font-medium text-gray-400">Coming Soon</span>
            </div>
          </div>
        </div>

        {!isPremium && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
            <p className="text-sm text-indigo-700">Upgrade to Pro for real-time supply pipeline monitoring and impact analysis</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Module Toggle */}
      <div className="flex justify-center">
        <ModuleToggle
          mode={mode}
          onModeChange={setMode}
          isPremium={isPremium}
        />
      </div>

      {/* Sub-tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'analysis' && renderAnalysisTab()}
          {activeTab === 'competition' && renderCompetitionTab()}
          {activeTab === 'supply' && renderSupplyTab()}
        </div>
      </div>
    </div>
  );
};

export default MarketIntelligenceSection;
