/**
 * Market Section - Dual-Mode (Acquisition & Performance)
 * Comprehensive market analysis with demographics, trends, SWOT, and sentiment
 */

import React, { useState, useEffect } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';

// Type definitions (moved from mock data)
interface DemographicStat {
  label: string;
  value: number | string;
  format: 'currency' | 'percentage' | 'number' | 'text';
  icon: string;
  trend?: { direction: 'up' | 'down' | 'stable'; value: string };
}

interface MarketTrend {
  label: string;
  current: number;
  historical: number[];
  format: 'currency' | 'percentage' | 'number';
  unit: string;
}

interface SwotItem {
  id: string;
  category: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

interface SubmarketComparison {
  name: string;
  rentGrowth: number;
  vacancy: number;
  avgRent: number;
  population: number;
  isTarget: boolean;
}

interface MarketSentiment {
  overall: 'hot' | 'warm' | 'neutral' | 'cool' | 'cold';
  score: number;
  factors: {
    demandSupply: number;
    priceGrowth: number;
    economicHealth: number;
    investorInterest: number;
  };
}

interface MarketSectionProps {
  deal: Deal;
}

export const MarketSection: React.FC<MarketSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);

  // API state
  const [demographics, setDemographics] = useState<DemographicStat[]>([]);
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [submarkets, setSubmarkets] = useState<SubmarketComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch market data from API
  useEffect(() => {
    const fetchMarketData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Extract city and state from deal address
        const addressParts = deal.address?.split(',').map(s => s.trim()) || [];
        const city = addressParts[0] || 'Austin';
        const state = addressParts[1]?.split(' ')[0] || 'TX';
        
        const response = await fetch(`/api/v1/market/trends/${city}/${state}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch market data');
        }
        
        const data = await response.json();
        
        // Transform trends data
        const transformedTrends: MarketTrend[] = (data.trends || []).map((trend: any) => ({
          label: trend.property_type || 'Market',
          current: trend.avg_price || 0,
          historical: [
            trend.avg_price * 0.85,
            trend.avg_price * 0.90,
            trend.avg_price * 0.95,
            trend.avg_price * 0.97,
            trend.avg_price * 0.99,
            trend.avg_price
          ],
          format: 'currency' as const,
          unit: 'USD'
        }));
        
        setTrends(transformedTrends.length > 0 ? transformedTrends : [
          {
            label: 'Avg Rent',
            current: 1800,
            historical: [1500, 1600, 1650, 1700, 1750, 1800],
            format: 'currency' as const,
            unit: 'USD'
          }
        ]);

        // Set default demographics
        setDemographics([
          { label: 'Population', value: '250K', format: 'text', icon: '👥' },
          { label: 'Median Income', value: 75000, format: 'currency', icon: '💰' },
          { label: 'Employment Rate', value: 95, format: 'percentage', icon: '💼' },
          { label: 'Avg Age', value: '32', format: 'text', icon: '📊' },
          { label: 'College Educated', value: 65, format: 'percentage', icon: '🎓' }
        ]);

        // Set default submarkets
        setSubmarkets([
          { name: 'Downtown', rentGrowth: 5.2, vacancy: 4.1, avgRent: 2100, population: 45000, isTarget: true },
          { name: 'Midtown', rentGrowth: 4.8, vacancy: 5.3, avgRent: 1850, population: 38000, isTarget: false },
          { name: 'Eastside', rentGrowth: 6.1, vacancy: 3.2, avgRent: 1650, population: 52000, isTarget: false }
        ]);
        
      } catch (err) {
        console.error('Error fetching market data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load market data');
        
        // Set minimal fallback data
        setDemographics([]);
        setTrends([]);
        setSubmarkets([]);
      } finally {
        setLoading(false);
      }
    };

    if (deal.id) {
      fetchMarketData();
    }
  }, [deal.id, deal.address]);

  // Mock SWOT and sentiment data (TODO: fetch from API or calculate)
  const swot: SwotItem[] = [
    { id: '1', category: 'strength', title: 'Strong demographics', description: 'High-income area with growing population', impact: 'high' },
    { id: '2', category: 'opportunity', title: 'Limited supply', description: 'Few new developments planned', impact: 'high' },
    { id: '3', category: 'weakness', title: 'High competition', description: 'Several established properties nearby', impact: 'medium' },
    { id: '4', category: 'threat', title: 'Economic uncertainty', description: 'Potential recession impact', impact: 'low' }
  ];

  const sentiment: MarketSentiment = {
    overall: 'warm',
    score: 72,
    factors: {
      demandSupply: 75,
      priceGrowth: 80,
      economicHealth: 68,
      investorInterest: 65
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-[#9EA8B4]">Loading market data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-[#1c0a0a] border border-red-800/50 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-2">⚠️ Error loading market data</p>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPipeline 
            ? 'bg-[#0d1e3d] text-blue-400' 
            : 'bg-[#022c22] text-green-400'
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
      hot: { bg: 'bg-[#1c0a0a]', text: 'text-red-400', icon: '🔥', label: 'HOT' },
      warm: { bg: 'bg-[#1a0d00]', text: 'text-orange-700', icon: '☀️', label: 'WARM' },
      neutral: { bg: 'bg-[#131920]', text: 'text-[#9EA8B4]', icon: '➖', label: 'NEUTRAL' },
      cool: { bg: 'bg-[#0d1e3d]', text: 'text-blue-400', icon: '❄️', label: 'COOL' },
      cold: { bg: 'bg-[#1a0d3d]', text: 'text-purple-400', icon: '🧊', label: 'COLD' }
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
    <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8E6E1]">
          {mode === 'acquisition' ? '📊 Market Demographics' : '📍 Trade Area Demographics'}
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {demographics.map((stat, index) => (
          <div 
            key={index}
            className="bg-gradient-to-br from-gray-50 to-white border border-[#1e2a3d] rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#9EA8B4] text-xs font-medium">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-[#E8E6E1] mb-1">
              {formatValue(stat)}
            </div>
            {stat.trend && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                stat.trend.direction === 'up' 
                  ? 'text-green-600' 
                  : stat.trend.direction === 'down'
                    ? 'text-red-400'
                    : 'text-[#9EA8B4]'
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
    if (last < first * 0.9) return 'text-red-400';
    return 'text-blue-600';
  };

  return (
    <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8E6E1]">
          {mode === 'acquisition' ? '📈 Market Trends' : '📊 Market Trend Monitoring'}
        </h3>
        <span className="text-xs text-[#6B7585]">Last 6 periods</span>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {trends.map((trend, index) => (
          <div key={index} className="border border-[#1e2a3d] rounded-lg p-4 bg-gradient-to-br from-white to-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[#9EA8B4]">{trend.label}</h4>
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
            
            <div className="mt-2 text-xs text-[#6B7585] text-center">
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
        bg: 'bg-[#022c22]', 
        border: 'border-green-800/50',
        text: 'text-green-400',
        accent: 'bg-green-500'
      },
      weakness: { 
        icon: '⚠️', 
        label: 'Weaknesses', 
        bg: 'bg-[#1a1200]', 
        border: 'border-yellow-200',
        text: 'text-yellow-700',
        accent: 'bg-yellow-500'
      },
      opportunity: { 
        icon: '🎯', 
        label: 'Opportunities', 
        bg: 'bg-[#0d1e3d]', 
        border: 'border-blue-900/50',
        text: 'text-blue-400',
        accent: 'bg-blue-500'
      },
      threat: { 
        icon: '⚡', 
        label: 'Threats', 
        bg: 'bg-[#1c0a0a]', 
        border: 'border-red-800/50',
        text: 'text-red-400',
        accent: 'bg-red-500'
      }
    };
    return configs[category as keyof typeof configs];
  };

  const getImpactBadge = (impact: string) => {
    const badges = {
      high: { label: 'HIGH', color: 'bg-[#1c0a0a] text-red-400' },
      medium: { label: 'MED', color: 'bg-yellow-100 text-yellow-700' },
      low: { label: 'LOW', color: 'bg-[#131920] text-[#9EA8B4]' }
    };
    return badges[impact as keyof typeof badges] || badges.low;
  };

  const categories: Array<'strength' | 'weakness' | 'opportunity' | 'threat'> = 
    ['strength', 'weakness', 'opportunity', 'threat'];

  return (
    <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8E6E1]">
          {mode === 'acquisition' ? '🔍 SWOT Analysis' : '📋 Market Position SWOT'}
        </h3>
        <button 
          onClick={() => setExpandedItems(expandedItems.size === swot.length ? new Set() : new Set(swot.map(s => s.id)))}
          className="text-xs text-blue-600 hover:text-blue-400 font-medium"
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
                <span className="text-xs text-[#6B7585]">({items.length})</span>
              </div>
              
              <div className="space-y-2">
                {items.map(item => {
                  const isExpanded = expandedItems.has(item.id);
                  const impactBadge = getImpactBadge(item.impact);
                  
                  return (
                    <div 
                      key={item.id}
                      className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => toggleItem(item.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${config.accent}`}></span>
                            <span className="text-sm font-semibold text-[#E8E6E1]">{item.title}</span>
                          </div>
                          {isExpanded && (
                            <p className="text-xs text-[#9EA8B4] mt-2 ml-4">
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
    <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8E6E1]">
          {mode === 'acquisition' ? '🗺️ Submarket Comparison' : '📍 Competitive Submarket Analysis'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('rentGrowth')}
            className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
              sortBy === 'rentGrowth' 
                ? 'bg-blue-600 text-white' 
                : 'bg-[#131920] text-[#9EA8B4] hover:bg-[#1e2a3d]'
            }`}
          >
            Rent Growth
          </button>
          <button
            onClick={() => setSortBy('vacancy')}
            className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
              sortBy === 'vacancy' 
                ? 'bg-blue-600 text-white' 
                : 'bg-[#131920] text-[#9EA8B4] hover:bg-[#1e2a3d]'
            }`}
          >
            Vacancy
          </button>
          <button
            onClick={() => setSortBy('avgRent')}
            className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
              sortBy === 'avgRent' 
                ? 'bg-blue-600 text-white' 
                : 'bg-[#131920] text-[#9EA8B4] hover:bg-[#1e2a3d]'
            }`}
          >
            Avg Rent
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e2a3d]">
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9EA8B4] uppercase">Submarket</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#9EA8B4] uppercase">Rent Growth</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#9EA8B4] uppercase">Vacancy</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#9EA8B4] uppercase">Avg Rent</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#9EA8B4] uppercase">Population</th>
            </tr>
          </thead>
          <tbody>
            {sortedSubmarkets.map((submarket, index) => (
              <tr 
                key={index}
                className={`border-b border-[#1e2a3d] hover:bg-[#0F1319] transition-colors ${
                  submarket.isTarget ? 'bg-[#0d1e3d] font-semibold' : ''
                }`}
              >
                <td className="py-3 px-4 text-sm text-[#E8E6E1]">
                  <div className="flex items-center gap-2">
                    {submarket.isTarget && <span className="text-blue-600">📍</span>}
                    {submarket.name}
                  </div>
                </td>
                <td className="text-right py-3 px-4 text-sm">
                  <span className={`${
                    submarket.rentGrowth >= 5 ? 'text-green-600' : 
                    submarket.rentGrowth >= 3 ? 'text-yellow-600' : 
                    'text-[#9EA8B4]'
                  } font-medium`}>
                    {submarket.rentGrowth}%
                  </span>
                </td>
                <td className="text-right py-3 px-4 text-sm">
                  <span className={`${
                    submarket.vacancy <= 4 ? 'text-green-600' : 
                    submarket.vacancy <= 6 ? 'text-yellow-600' : 
                    'text-red-400'
                  } font-medium`}>
                    {submarket.vacancy}%
                  </span>
                </td>
                <td className="text-right py-3 px-4 text-sm font-medium text-[#E8E6E1]">
                  ${submarket.avgRent.toLocaleString()}
                </td>
                <td className="text-right py-3 px-4 text-sm text-[#9EA8B4]">
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
    return 'text-red-400';
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8E6E1]">
          {mode === 'acquisition' ? '🎯 Investment Opportunity Gauge' : '📊 Exit Timing Indicator'}
        </h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Score */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-900/50 rounded-lg p-6 flex flex-col items-center justify-center">
          <div className="text-sm font-semibold text-[#9EA8B4] uppercase tracking-wide mb-2">
            Overall Market Score
          </div>
          <div className={`text-6xl font-bold mb-2 ${getScoreColor(sentiment.score)}`}>
            {sentiment.score}
          </div>
          <div className="text-sm text-[#9EA8B4]">out of 100</div>
          <div className="mt-4 w-full bg-[#1e2a3d] rounded-full h-3 overflow-hidden">
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
                    <span className="text-sm font-medium text-[#9EA8B4]">{factor.label}</span>
                    <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                      {score}/100
                    </span>
                  </div>
                  <div className="w-full bg-[#1e2a3d] rounded-full h-2 overflow-hidden">
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
      <div className="mt-6 pt-6 border-t border-[#1e2a3d]">
        <div className="bg-[#0d1e3d] border border-blue-900/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-300 mb-1">Interpretation</h4>
              <p className="text-xs text-blue-400">
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
