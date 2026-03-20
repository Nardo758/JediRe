/**
 * Market Intelligence Section - Unified Module
 * Consolidates Competition, Supply, and Market Analysis into one comprehensive view
 * Context-aware behavior for Pipeline vs Portfolio deals
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { CompetitionSection } from './CompetitionSection';
import { SupplySection } from './SupplySection';
import { MarketSection } from './MarketSection';

interface MarketIntelligenceSectionProps {
  deal: Deal;
  isPremium?: boolean;
}

export const MarketIntelligenceSection: React.FC<MarketIntelligenceSectionProps> = ({ 
  deal, 
  isPremium = false 
}) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [activeTab, setActiveTab] = useState<'overview' | 'competition' | 'supply' | 'market'>('overview');

  return (
    <div className="space-y-6">
      
      {/* Overview Dashboard - Key Metrics from all 3 areas */}
      <MarketIntelligenceOverview deal={deal} mode={mode} />

      {/* Tab Navigation */}
      <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg overflow-hidden">
        <div className="border-b border-[#1e2a3d]">
          <nav className="flex -mb-px">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon="📊"
              label="Overview"
            />
            <TabButton
              active={activeTab === 'competition'}
              onClick={() => setActiveTab('competition')}
              icon="🏆"
              label="Competition Analysis"
            />
            <TabButton
              active={activeTab === 'supply'}
              onClick={() => setActiveTab('supply')}
              icon="🏗️"
              label="Supply Pipeline"
            />
            <TabButton
              active={activeTab === 'market'}
              onClick={() => setActiveTab('market')}
              icon="📈"
              label="Market Trends & Demographics"
            />
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab deal={deal} mode={mode} />}
          {activeTab === 'competition' && <CompetitionSection deal={deal} />}
          {activeTab === 'supply' && <SupplySection deal={deal} />}
          {activeTab === 'market' && <MarketSection deal={deal} />}
        </div>
      </div>

    </div>
  );
};

// ==================== TAB BUTTON COMPONENT ====================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600 bg-[#0d1e3d]'
          : 'border-transparent text-[#9EA8B4] hover:text-[#E8E6E1] hover:bg-[#0F1319]'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  );
};

// ==================== OVERVIEW DASHBOARD ====================

interface MarketIntelligenceOverviewProps {
  deal: Deal;
  mode: 'acquisition' | 'performance';
}

const MarketIntelligenceOverview: React.FC<MarketIntelligenceOverviewProps> = ({ deal, mode }) => {
  // Mock data - replace with real data from hooks/API
  const mockData = {
    competition: {
      avgCompPrice: 285000,
      totalComps: 12,
      similarityScore: 87,
      marketPosition: 'Above Market'
    },
    supply: {
      pipelineUnits: 2840,
      delivering12mo: 1250,
      directCompetitors: 8,
      avgDistance: 2.3
    },
    market: {
      rentGrowth: 5.2,
      vacancy: 3.8,
      marketScore: 82,
      sentiment: 'hot'
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-900/50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#E8E6E1] flex items-center gap-2">
            <span>📊</span>
            Market Intelligence Overview
          </h2>
          <p className="text-sm text-[#9EA8B4] mt-1">
            {mode === 'acquisition' 
              ? 'Comprehensive market assessment for acquisition decision-making'
              : 'Market monitoring and competitive positioning for asset management'}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-semibold ${
          mode === 'acquisition' 
            ? 'bg-[#0d1e3d] text-blue-400' 
            : 'bg-[#022c22] text-green-400'
        }`}>
          {mode === 'acquisition' ? '🎯 Acquisition Mode' : '🏆 Performance Mode'}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* Competition Card */}
        <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🏆</span>
            <h3 className="font-semibold text-[#E8E6E1]">Competition</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Avg Comp Price/Unit</span>
              <span className="text-sm font-bold text-[#E8E6E1]">
                ${mockData.competition.avgCompPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Total Comps</span>
              <span className="text-sm font-bold text-[#E8E6E1]">
                {mockData.competition.totalComps}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Similarity Score</span>
              <span className="text-sm font-bold text-green-600">
                {mockData.competition.similarityScore}%
              </span>
            </div>
            <div className="pt-2 border-t border-[#1e2a3d]">
              <span className="text-xs text-[#9EA8B4]">Market Position:</span>
              <span className="text-sm font-bold text-blue-600 ml-2">
                {mockData.competition.marketPosition}
              </span>
            </div>
          </div>
        </div>

        {/* Supply Card */}
        <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🏗️</span>
            <h3 className="font-semibold text-[#E8E6E1]">Supply Pipeline</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Pipeline Units</span>
              <span className="text-sm font-bold text-[#E8E6E1]">
                {mockData.supply.pipelineUnits.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Delivering in 12mo</span>
              <span className="text-sm font-bold text-orange-600">
                {mockData.supply.delivering12mo.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Direct Competitors</span>
              <span className="text-sm font-bold text-red-400">
                {mockData.supply.directCompetitors}
              </span>
            </div>
            <div className="pt-2 border-t border-[#1e2a3d]">
              <span className="text-xs text-[#9EA8B4]">Avg Distance:</span>
              <span className="text-sm font-bold text-[#E8E6E1] ml-2">
                {mockData.supply.avgDistance} mi
              </span>
            </div>
          </div>
        </div>

        {/* Market Card */}
        <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📈</span>
            <h3 className="font-semibold text-[#E8E6E1]">Market Dynamics</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Rent Growth (YoY)</span>
              <span className="text-sm font-bold text-green-600">
                {mockData.market.rentGrowth}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Vacancy Rate</span>
              <span className="text-sm font-bold text-green-600">
                {mockData.market.vacancy}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#9EA8B4]">Market Score</span>
              <span className="text-sm font-bold text-blue-600">
                {mockData.market.marketScore}/100
              </span>
            </div>
            <div className="pt-2 border-t border-[#1e2a3d]">
              <span className="text-xs text-[#9EA8B4]">Sentiment:</span>
              <span className={`text-sm font-bold ml-2 ${
                mockData.market.sentiment === 'hot' ? 'text-red-400' : 'text-blue-600'
              }`}>
                {mockData.market.sentiment === 'hot' ? '🔥 HOT' : '☀️ WARM'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-4">
        <h4 className="font-semibold text-[#E8E6E1] mb-3 flex items-center gap-2">
          <span>💡</span>
          Key Insights
        </h4>
        <div className="space-y-2">
          {mode === 'acquisition' ? (
            <>
              <InsightItem
                type="success"
                text="Strong market fundamentals with healthy rent growth and low vacancy"
              />
              <InsightItem
                type="warning"
                text="High supply pipeline: 1,250 units delivering within 12 months - monitor absorption"
              />
              <InsightItem
                type="info"
                text="Competitive positioning above market average with 87% similarity to top performers"
              />
            </>
          ) : (
            <>
              <InsightItem
                type="success"
                text="Property outperforming submarket averages in occupancy and rent growth"
              />
              <InsightItem
                type="warning"
                text="8 direct competitors within 3 miles - maintain differentiation strategy"
              />
              <InsightItem
                type="info"
                text="Market sentiment remains hot - favorable conditions for refinancing or disposition"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== OVERVIEW TAB CONTENT ====================

interface OverviewTabProps {
  deal: Deal;
  mode: 'acquisition' | 'performance';
}

const OverviewTab: React.FC<OverviewTabProps> = ({ deal, mode }) => {
  return (
    <div className="space-y-6">
      
      {/* Strategic Context */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-900/50 rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#E8E6E1] mb-4">
          {mode === 'acquisition' ? '🎯 Acquisition Strategy Context' : '🏢 Asset Management Focus'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Competition Focus */}
          <div className="bg-[#0F1319] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🏆</span>
              <h4 className="font-semibold text-[#E8E6E1]">Competition</h4>
            </div>
            <ul className="space-y-1 text-sm text-[#9EA8B4]">
              {mode === 'acquisition' ? (
                <>
                  <li>• Comparable property analysis</li>
                  <li>• Pricing position assessment</li>
                  <li>• Market velocity tracking</li>
                  <li>• Similarity scoring</li>
                </>
              ) : (
                <>
                  <li>• Competitive threat monitoring</li>
                  <li>• Market share tracking</li>
                  <li>• Positioning changes</li>
                  <li>• Retention strategy alerts</li>
                </>
              )}
            </ul>
          </div>

          {/* Supply Focus */}
          <div className="bg-[#0F1319] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🏗️</span>
              <h4 className="font-semibold text-[#E8E6E1]">Supply</h4>
            </div>
            <ul className="space-y-1 text-sm text-[#9EA8B4]">
              {mode === 'acquisition' ? (
                <>
                  <li>• Future supply impact analysis</li>
                  <li>• Delivery timeline tracking</li>
                  <li>• Absorption rate modeling</li>
                  <li>• Market saturation risk</li>
                </>
              ) : (
                <>
                  <li>• New competition tracking</li>
                  <li>• Lease-up velocity monitoring</li>
                  <li>• Concession package alerts</li>
                  <li>• Market pressure analysis</li>
                </>
              )}
            </ul>
          </div>

          {/* Market Focus */}
          <div className="bg-[#0F1319] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📈</span>
              <h4 className="font-semibold text-[#E8E6E1]">Market</h4>
            </div>
            <ul className="space-y-1 text-sm text-[#9EA8B4]">
              {mode === 'acquisition' ? (
                <>
                  <li>• Demographics & trends</li>
                  <li>• Market opportunity sizing</li>
                  <li>• SWOT analysis</li>
                  <li>• Investment sentiment gauge</li>
                </>
              ) : (
                <>
                  <li>• Market changes affecting value</li>
                  <li>• Submarket performance</li>
                  <li>• Exit timing indicators</li>
                  <li>• Value trend monitoring</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Cross-Section Analysis */}
      <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#E8E6E1] mb-4 flex items-center gap-2">
          <span>🔍</span>
          Cross-Section Analysis
        </h3>
        
        <div className="space-y-4">
          {/* Supply vs Competition */}
          <AnalysisCard
            title="Supply Impact on Competition"
            icon="⚖️"
            insights={[
              '1,250 units delivering in 12 months will increase competitive intensity',
              '3 projects are direct competitors targeting same renter profile',
              'Recommend accelerated lease-up timeline to capture demand ahead of deliveries'
            ]}
          />

          {/* Market vs Supply */}
          <AnalysisCard
            title="Market Absorption Capacity"
            icon="📊"
            insights={[
              'Current market velocity: 85 units/month (trailing 6mo average)',
              'Pipeline deliveries would require 110 units/month absorption',
              'Strong demographics support demand, but timing will be critical'
            ]}
          />

          {/* Competition vs Market */}
          <AnalysisCard
            title="Competitive Positioning in Market Context"
            icon="🎯"
            insights={[
              'Property positioned at 92nd percentile for rent growth potential',
              'Market fundamentals favor quality assets with modern amenities',
              'Competitive differentiation via amenity package strongly supported by demographics'
            ]}
          />
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-[#1a1200] border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#E8E6E1] mb-4 flex items-center gap-2">
          <span>✅</span>
          Recommended Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-[#E8E6E1] mb-2">Immediate (0-30 days)</h4>
            <ul className="space-y-1 text-sm text-[#9EA8B4]">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">•</span>
                <span>Review and finalize competitive amenity package</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">•</span>
                <span>Model conservative lease-up scenarios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">•</span>
                <span>Establish absorption rate monitoring system</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#E8E6E1] mb-2">Strategic (30-90 days)</h4>
            <ul className="space-y-1 text-sm text-[#9EA8B4]">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Monitor competitor lease-up velocity quarterly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Conduct phased delivery analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Update market positioning strategy as new supply delivers</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
};

// ==================== HELPER COMPONENTS ====================

interface InsightItemProps {
  type: 'success' | 'warning' | 'info';
  text: string;
}

const InsightItem: React.FC<InsightItemProps> = ({ type, text }) => {
  const config = {
    success: { icon: '✅', color: 'text-green-400', bg: 'bg-[#022c22]', border: 'border-green-800/50' },
    warning: { icon: '⚠️', color: 'text-yellow-700', bg: 'bg-[#1a1200]', border: 'border-yellow-200' },
    info: { icon: 'ℹ️', color: 'text-blue-400', bg: 'bg-[#0d1e3d]', border: 'border-blue-900/50' }
  };

  const style = config[type];

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border ${style.bg} ${style.border}`}>
      <span className="text-lg flex-shrink-0">{style.icon}</span>
      <p className={`text-sm ${style.color}`}>{text}</p>
    </div>
  );
};

interface AnalysisCardProps {
  title: string;
  icon: string;
  insights: string[];
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({ title, icon, insights }) => {
  return (
    <div className="border border-[#1e2a3d] rounded-lg p-4 hover:shadow-md transition-shadow">
      <h4 className="font-semibold text-[#E8E6E1] mb-3 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        {title}
      </h4>
      <ul className="space-y-2">
        {insights.map((insight, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-[#9EA8B4]">
            <span className="text-blue-600 font-bold mt-0.5">→</span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MarketIntelligenceSection;
