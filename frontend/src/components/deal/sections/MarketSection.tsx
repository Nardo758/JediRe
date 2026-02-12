/**
 * Market Section - Dual-Mode (Acquisition & Performance)
 * Comprehensive market analysis with demographics, trends, SWOT, and sentiment
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionDemographics,
  acquisitionMarketTrends,
  acquisitionSwot,
  acquisitionSubmarkets,
  acquisitionSentiment,
  performanceDemographics,
  performanceMarketTrends,
  performanceSwot,
  performanceSubmarkets,
  performanceSentiment,
  DemographicStat,
  MarketTrend,
  SwotItem,
  SubmarketComparison,
  MarketSentiment
} from '../../../data/marketMockData';

interface MarketSectionProps {
  deal: Deal;
}

export const MarketSection: React.FC<MarketSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);

  // Select data based on mode
  const demographics = isPipeline ? acquisitionDemographics : performanceDemographics;
  const trends = isPipeline ? acquisitionMarketTrends : performanceMarketTrends;
  const swot = isPipeline ? acquisitionSwot : performanceSwot;
  const submarkets = isPipeline ? acquisitionSubmarkets : performanceSubmarkets;
  const sentiment = isPipeline ? acquisitionSentiment : performanceSentiment;

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPipeline 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {isPipeline ? '🎯 Acquisition Mode: Market Opportunity' : '🏢 Performance Mode: Market Position'}
        </div>
        
        <MarketSentimentBadge sentiment={sentiment} />
      </div>

      {/* Demographics Snapshot */}
      <DemographicsCard demographics={demographics} mode={mode} />

      {/* Market Trends Charts */}
      <MarketTrendsCard trends={trends} mode={mode} />

      {/* SWOT Analysis */}
      <SwotAnalysisCard swot={swot} mode={mode} />

      {/* Submarket Comparison */}
      <SubmarketComparisonCard submarkets={submarkets} mode={mode} />

      {/* Detailed Sentiment Analysis */}
      <SentimentDetailCard sentiment={sentiment} mode={mode} />

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface MarketSentimentBadgeProps {
  sentiment: MarketSentiment;
}

const MarketSentimentBadge: React.FC<MarketSentimentBadgeProps> = ({ sentiment }) => {
  const getSentimentConfig = (level: string) => {
    const configs = {
      hot: { bg: 'bg-red-100', text: 'text-red-700', icon: '🔥', label: 'HOT' },
      warm: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '☀️', label: 'WARM' },
      neutral: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '➖', label: 'NEUTRAL' },
      cool: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '❄️', label: 'COOL' },
      cold: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '🧊', label: 'COLD' }
    };
    return configs[level as keyof typeof configs] || configs.neutral;
  };

  const config = getSentimentConfig(sentiment.overall);

  return (
    <div className={`${config.bg} ${config.text} px-4 py-2 rounded-lg flex items-center gap-2`}>
      <span className="text-lg">{config.icon}</span>
      <div>
        <div className="text-xs font-semibold">MARKET SENTIMENT</div>
        <div className="text-sm font-bold">{config.label} ({sentiment.score}/100)</div>
      </div>
    </div>
  );
};

interface DemographicsCardProps {
  demographics: DemographicStat[];
  mode: 'acquisition' | 'performance';
}

const DemographicsCard: React.FC<DemographicsCardProps> = ({ demographics, mode }) => {
  const formatValue = (stat: DemographicStat): string => {
    switch (stat.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(stat.value as number);
      case 'percentage':
        return `${stat.value}%`;
      case 'number':
        return stat.value.toLocaleString();
      default:
        return stat.value.toString();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === 'acquisition' ? '📊 Market Demographics' : '📍 Trade Area Demographics'}
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {demographics.map((stat, index) => (
          <div 
            key={index}
            className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-xs font-medium">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatValue(stat)}
            </div>
            {stat.trend && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                stat.trend.direction === 'up' 
                  ? 'text-green-600' 
                  : stat.trend.direction === 'down'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}>
                <span>{stat.trend.direction === 'up' ? '↗' : stat.trend.direction === 'down' ? '↘' : '→'}</span>
                <span>{stat.trend.value}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface MarketTrendsCardProps {
  trends: MarketTrend[];
  mode: 'acquisition' | 'performance';
}

const MarketTrendsCard: React.FC<MarketTrendsCardProps> = ({ trends, mode }) => {
  const formatValue = (trend: MarketTrend, value: number): string => {
    if (trend.format === 'currency') {
      return `$${value.toLocaleString()}`;
    }
    if (trend.format === 'percentage') {
      return `${value}%`;
    }
    return value.toLocaleString();
  };

  const getTrendColor = (historical: number[]) => {
    const first = historical[0];
    const last = historical[historical.length - 1];
    if (last > first * 1.1) return 'text-green-600';
    if (last < first * 0.9) return 'text-red-600';
    return 'text-blue-600';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === 'acquisition' ? '📈 Market Trends' : '📊 Market Trend Monitoring'}
        </h3>
        <span className="text-xs text-gray-500">Last 6 periods</span>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {trends.map((trend, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-white to-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">{trend.label}</h4>
              <div className={`text-2xl font-bold ${getTrendColor(trend.historical)}`}>
                {formatValue(trend, trend.current)}
              </div>
            </div>
            
            {/* Simple Line Chart Visualization */}
            <div className="relative h-24 flex items-end gap-1">
              {trend.historical.map((value, i) => {
                const max = Math.max(...trend.historical);
                const min = Math.min(...trend.historical);
                const range = max - min || 1;
                const heightPercent = ((value - min) / range) * 100;
                
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t hover:from-blue-600 hover:to-blue-400 transition-all cursor-pointer relative group"
                    style={{ height: `${Math.max(heightPercent, 10)}%` }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatValue(trend, value)}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-2 text-xs text-gray-500 text-center">
              {trend.historical[0]} → {trend.current} {trend.unit}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SwotAnalysisCardProps {
  swot: SwotItem[];
  mode: 'acquisition' | 'performance';
}

const SwotAnalysisCard: React.FC<SwotAnalysisCardProps> = ({ swot, mode }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getCategoryConfig = (category: string) => {
    const configs = {
      strength: { 
        icon: '💪', 
        label: 'Strengths', 
        bg: 'bg-green-50', 
        border: 'border-green-200',
        text: 'text-green-700',
        accent: 'bg-green-500'
      },
      weakness: { 
        icon: '⚠️', 
        label: 'Weaknesses', 
        bg: 'bg-yellow-50', 
        border: 'border-yellow-200',
        text: 'text-yellow-700',
        accent: 'bg-yellow-500'
      },
      opportunity: { 
        icon: '🎯', 
        label: 'Opportunities', 
        bg: 'bg-blue-50', 
        border: 'border-blue-200',
        text: 'text-blue-700',
        accent: 'bg-blue-500'
      },
      threat: { 
        icon: '⚡', 
        label: 'Threats', 
        bg: 'bg-red-50', 
        border: 'border-red-200',
        text: 'text-red-700',
        accent: 'bg-red-500'
      }
    };
    return configs[category as keyof typeof configs];
  };

  const getImpactBadge = (impact: string) => {
    const badges = {
      high: { label: 'HIGH', color: 'bg-red-100 text-red-700' },
      medium: { label: 'MED', color: 'bg-yellow-100 text-yellow-700' },
      low: { label: 'LOW', color: 'bg-gray-100 text-gray-700' }
    };
    return badges[impact as keyof typeof badges] || badges.low;
  };

  const categories: Array<'strength' | 'weakness' | 'opportunity' | 'threat'> = 
    ['strength', 'weakness', 'opportunity', 'threat'];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === 'acquisition' ? '🔍 SWOT Analysis' : '📋 Market Position SWOT'}
        </h3>
        <button 
          onClick={() => setExpandedItems(expandedItems.size === swot.length ? new Set() : new Set(swot.map(s => s.id)))}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {expandedItems.size === swot.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {categories.map(category => {
          const config = getCategoryConfig(category);
          const items = swot.filter(item => item.category === category);
          
          return (
            <div key={category} className={`${config.bg} ${config.border} border rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{config.icon}</span>
                <h4 className={`text-sm font-bold ${config.text} uppercase tracking-wide`}>
                  {config.label}
                </h4>
                <span className="text-xs text-gray-500">({items.length})</span>
              </div>
              
              <div className="space-y-2">
                {items.map(item => {
                  const isExpanded = expandedItems.has(item.id);
                  const impactBadge = getImpactBadge(item.impact);
                  
                  return (
                    <div 
                      key={item.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => toggleItem(item.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${config.accent}`}></span>
                            <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                          </div>
                          {isExpanded && (
                            <p className="text-xs text-gray-600 mt-2 ml-4">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${impactBadge.color}`}>
                            {impactBadge.label}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {isExpanded ? '−' : '+'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface SubmarketComparisonCardProps {
  submarkets: SubmarketComparison[];
  mode: 'acquisition' | 'performance';
}

const SubmarketComparisonCard: React.FC<SubmarketComparisonCardProps> = ({ submarkets, mode }) => {
  const [sortBy, setSortBy] = useState<'rentGrowth' | 'vacancy' | 'avgRent'>('rentGrowth');

  const sortedSubmarkets = [...submarkets].sort((a, b) => {
    if (sortBy === 'vacancy') return a[sortBy] - b[sortBy]; // Lower is better
    return b[sortBy] - a[sortBy]; // Higher is better
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === 'acquisition' ? '🗺️ Submarket Comparison' : '📍 Competitive Submarket Analysis'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('rentGrowth')}
            className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
              sortBy === 'rentGrowth' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Rent Growth
          </button>
          <button
            onClick={() => setSortBy('vacancy')}
            className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
              sortBy === 'vacancy' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Vacancy
          </button>
          <button
            onClick={() => setSortBy('avgRent')}
            className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
              sortBy === 'avgRent' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Avg Rent
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Submarket</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Rent Growth</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Vacancy</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Avg Rent</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Population</th>
            </tr>
          </thead>
          <tbody>
            {sortedSubmarkets.map((submarket, index) => (
              <tr 
                key={index}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  submarket.isTarget ? 'bg-blue-50 font-semibold' : ''
                }`}
              >
                <td className="py-3 px-4 text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    {submarket.isTarget && <span className="text-blue-600">📍</span>}
                    {submarket.name}
                  </div>
                </td>
                <td className="text-right py-3 px-4 text-sm">
                  <span className={`${
                    submarket.rentGrowth >= 5 ? 'text-green-600' : 
                    submarket.rentGrowth >= 3 ? 'text-yellow-600' : 
                    'text-gray-600'
                  } font-medium`}>
                    {submarket.rentGrowth}%
                  </span>
                </td>
                <td className="text-right py-3 px-4 text-sm">
                  <span className={`${
                    submarket.vacancy <= 4 ? 'text-green-600' : 
                    submarket.vacancy <= 6 ? 'text-yellow-600' : 
                    'text-red-600'
                  } font-medium`}>
                    {submarket.vacancy}%
                  </span>
                </td>
                <td className="text-right py-3 px-4 text-sm font-medium text-gray-900">
                  ${submarket.avgRent.toLocaleString()}
                </td>
                <td className="text-right py-3 px-4 text-sm text-gray-600">
                  {(submarket.population / 1000).toFixed(0)}k
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface SentimentDetailCardProps {
  sentiment: MarketSentiment;
  mode: 'acquisition' | 'performance';
}

const SentimentDetailCard: React.FC<SentimentDetailCardProps> = ({ sentiment, mode }) => {
  const factors = [
    { key: 'demandSupply', label: 'Demand vs Supply', icon: '⚖️' },
    { key: 'priceGrowth', label: 'Price Growth', icon: '📈' },
    { key: 'economicHealth', label: 'Economic Health', icon: '💼' },
    { key: 'investorInterest', label: 'Investor Interest', icon: '💰' }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === 'acquisition' ? '🎯 Investment Opportunity Gauge' : '📊 Exit Timing Indicator'}
        </h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Score */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 flex flex-col items-center justify-center">
          <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Overall Market Score
          </div>
          <div className={`text-6xl font-bold mb-2 ${getScoreColor(sentiment.score)}`}>
            {sentiment.score}
          </div>
          <div className="text-sm text-gray-600">out of 100</div>
          <div className="mt-4 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-full ${getBarColor(sentiment.score)} transition-all`}
              style={{ width: `${sentiment.score}%` }}
            />
          </div>
        </div>

        {/* Factor Breakdown */}
        <div className="space-y-4">
          {factors.map(factor => {
            const score = sentiment.factors[factor.key as keyof typeof sentiment.factors];
            return (
              <div key={factor.key} className="flex items-center gap-3">
                <span className="text-2xl">{factor.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{factor.label}</span>
                    <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                      {score}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full ${getBarColor(score)} transition-all`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interpretation */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Interpretation</h4>
              <p className="text-xs text-blue-700">
                {mode === 'acquisition' ? (
                  sentiment.score >= 70 
                    ? 'Strong acquisition opportunity. Market fundamentals are favorable with healthy demand-supply dynamics and growth trajectory.'
                    : sentiment.score >= 50
                      ? 'Moderate opportunity. Market shows potential but requires careful underwriting and risk assessment.'
                      : 'Proceed with caution. Market conditions present elevated risks. Consider waiting for improved fundamentals.'
                ) : (
                  sentiment.score >= 70
                    ? 'Favorable exit environment. Strong market conditions support premium valuations. Consider refinancing or disposition strategies.'
                    : sentiment.score >= 50
                      ? 'Stable hold period. Market is balanced. Continue value-add execution and monitor for exit window.'
                      : 'Hold and improve. Market headwinds suggest maintaining position while enhancing property performance.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketSection;
