/**
 * Exit Section - Dual-Mode (Acquisition & Performance)
 * Exit strategy planning and readiness tracking
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { useDealModule } from '../../../contexts/DealModuleContext';
import apiClient from '@/services/api.client';

// Type definitions
interface ExitQuickStat {
  label: string;
  value: number | string;
  format: 'currency' | 'percentage' | 'years' | 'months' | 'number';
  icon: string;
  trend?: { direction: 'up' | 'down' | 'stable'; value: string };
  subtext?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
}

interface ExitScenario {
  id: string;
  name: string;
  icon: string;
  type: 'sale' | 'refinance' | 'hold';
  description: string;
  timing: string;
  exitCap: number;
  projectedNOI: number;
  probability: 'high' | 'medium' | 'low';
  salePrice?: number;
  refinanceAmount?: number;
  cashOut?: number;
  equityMultiple?: number;
  irr: number;
  keyFeatures: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

interface ExitTimelineEvent {
  id: string;
  name: string;
  date: string;
  category: 'preparation' | 'marketing' | 'transaction' | 'closing';
  status: 'completed' | 'upcoming' | 'future';
  description: string;
  monthsFromNow?: number;
}

interface ValueProjection {
  year: number;
  noi: number;
  capRate: number;
  propertyValue: number;
  equity: number;
  irr: number;
}

interface MarketReadinessIndicator {
  category: string;
  score: number;
  status: 'ready' | 'needs-attention' | 'not-ready';
  description: string;
  actionItems?: string[];
}

interface BrokerRecommendation {
  id: string;
  brokerName: string;
  firm: string;
  specialty: string;
  rating: number;
  recentSales: number;
  avgDaysOnMarket: number;
  avgPricePremium: number;
  pros: string[];
  cons: string[];
}

interface ExitReadinessChecklistItem {
  id: string;
  item: string;
  status: 'completed' | 'in-progress' | 'not-started';
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  dueDate?: string;
}

interface ExitStrategyData {
  stats?: ExitQuickStat[];
  scenarios?: ExitScenario[];
  timeline?: ExitTimelineEvent[];
  valueProjections?: ValueProjection[];
  marketReadiness?: MarketReadinessIndicator[];
  brokerRecommendations?: BrokerRecommendation[];
  readinessChecklist?: ExitReadinessChecklistItem[];
}

interface ExitSectionProps {
  deal: Deal;
}

export const ExitSection: React.FC<ExitSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [selectedScenario, setSelectedScenario] = useState<string>(isPipeline ? 'base-sale' : 'perf-base-sale');
  const { capitalStructure } = useDealModule();

  const [liveData, setLiveData] = useState<ExitStrategyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);

  const loadExitData = useCallback(async () => {
    if (!deal?.id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/api/v1/deals/${deal.id}/state`);
      const stateData = response.data;

      if (stateData?.success) {
        const exitData = stateData.timeline_data?.exit_strategy || stateData.exit_strategy;
        if (exitData && Object.keys(exitData).length > 0) {
          setLiveData(exitData);
          setIsLiveData(true);
        }
      }
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  }, [deal?.id]);

  useEffect(() => {
    loadExitData();
  }, [loadExitData]);

  const saveExitData = useCallback(async (dataToSave: ExitStrategyData) => {
    if (!deal?.id) return;
    try {
      setIsSaving(true);
      let existingTimelineData: Record<string, unknown> = {};
      try {
        const stateRes = await apiClient.get(`/api/v1/deals/${deal.id}/state`);
        if (stateRes.data?.success && stateRes.data.timeline_data) {
          existingTimelineData = typeof stateRes.data.timeline_data === 'string'
            ? JSON.parse(stateRes.data.timeline_data)
            : stateRes.data.timeline_data;
        }
      } catch (_) {}

      await apiClient.post(`/api/v1/deals/${deal.id}/state`, {
        timeline_data: {
          ...existingTimelineData,
          exit_strategy: dataToSave,
        },
      });

      setLiveData(dataToSave);
      setIsLiveData(true);
    } catch (err) {
    } finally {
      setIsSaving(false);
    }
  }, [deal?.id]);

  // M11+ → M12: Calculate net sale proceeds after debt payoff using Capital Structure data
  const debtPayoffAtExit = useMemo(() => {
    if (!capitalStructure) return null;
    const totalDebt = capitalStructure.ltv > 0
      ? (capitalStructure.annualDebtService / ((capitalStructure.dscr || 1) > 0 ? 1 : 1)) * 15
      : 0;
    return {
      outstandingBalance: totalDebt,
      prepaymentPenalty: capitalStructure.prepaymentPenalty,
      totalPayoff: totalDebt + capitalStructure.prepaymentPenalty,
    };
  }, [capitalStructure]);

  const stats = (isLiveData && liveData?.stats) ? liveData.stats : getDefaultExitStats(isPipeline);
  const scenarios = (isLiveData && liveData?.scenarios) ? liveData.scenarios : getDefaultExitScenarios(isPipeline);
  const timeline = (isLiveData && liveData?.timeline) ? liveData.timeline : getDefaultExitTimeline(isPipeline);
  const valueProjections = (isLiveData && liveData?.valueProjections) ? liveData.valueProjections : getDefaultValueProjections(isPipeline);
  const readinessIndicators = (isLiveData && liveData?.marketReadiness) ? liveData.marketReadiness : getDefaultMarketReadiness(isPipeline);
  const readinessChecklist = (isLiveData && liveData?.readinessChecklist) ? liveData.readinessChecklist : getDefaultExitReadiness(isPipeline);
  const brokerRecommendations = (isLiveData && liveData?.brokerRecommendations) ? liveData.brokerRecommendations : getDefaultBrokerRecommendations();

  const handleSaveCurrentData = useCallback(() => {
    const currentData: ExitStrategyData = {
      stats,
      scenarios,
      timeline,
      valueProjections,
      marketReadiness: readinessIndicators,
      brokerRecommendations: isOwned ? performanceBrokerRecommendations : undefined,
      readinessChecklist: readinessChecklist,
    };
    saveExitData(currentData);
  }, [stats, scenarios, timeline, valueProjections, readinessIndicators, readinessChecklist, isOwned, saveExitData]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-500">Loading exit strategy data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPipeline 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {isPipeline ? '🎯 Exit Planning' : '📊 Exit Execution'}
          </div>
          {isLiveData && (
            <div className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
              LIVE DATA
            </div>
          )}
          {!isLiveData && (
            <div className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
              SAMPLE DATA
            </div>
          )}
          {isOwned && (
            <div className="text-xs text-gray-500">
              Holding Period: {new Date(deal.actualCloseDate || deal.createdAt).toLocaleDateString()} - Present
            </div>
          )}
        </div>
        <button
          onClick={handleSaveCurrentData}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSaving ? 'Saving...' : 'Save Exit Strategy'}
        </button>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={stats} />

      {/* Exit Scenario Cards */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          🎯 Exit Scenarios
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {isPipeline 
            ? 'Compare potential exit strategies for this acquisition'
            : 'Evaluate exit timing and strategy options based on current position'
          }
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scenarios.map((scenario) => (
            <ExitScenarioCard
              key={scenario.id}
              scenario={scenario}
              isSelected={selectedScenario === scenario.id}
              onSelect={() => setSelectedScenario(scenario.id)}
            />
          ))}
        </div>
      </div>

      {/* Timeline to Exit */}
      <ExitTimelineVisualization timeline={timeline} isPipeline={isPipeline} />

      {/* Value Projection Chart */}
      <ValueProjectionChart projections={valueProjections} />

      {/* Market Readiness Score - Performance Mode Only */}
      {isOwned && (
        <>
          <MarketReadinessSection indicators={readinessIndicators} />
          
          <BrokerRecommendationsSection brokers={brokerRecommendations} />
        </>
      )}

      {/* Exit Readiness Checklist */}
      <ExitReadinessChecklist items={readinessChecklist} mode={mode} />

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: ExitQuickStat[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  const formatValue = (stat: ExitQuickStat): string => {
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
      case 'years':
        return `${stat.value} years`;
      case 'months':
        return `${stat.value} months`;
      case 'number':
        return stat.value.toString();
      default:
        return stat.value.toString();
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{stat.icon}</span>
            {stat.trend && (
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                stat.trend.direction === 'up' 
                  ? 'bg-green-100 text-green-700'
                  : stat.trend.direction === 'down'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {stat.trend.value}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
          <div className="text-2xl font-bold text-gray-900">{formatValue(stat)}</div>
          {stat.subtext && (
            <div className="text-xs text-gray-500 mt-1">{stat.subtext}</div>
          )}
        </div>
      ))}
    </div>
  );
};

interface ExitScenarioCardProps {
  scenario: ExitScenario;
  isSelected: boolean;
  onSelect: () => void;
}

const ExitScenarioCard: React.FC<ExitScenarioCardProps> = ({
  scenario,
  isSelected,
  onSelect
}) => {
  const getProbabilityBadge = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`${scenario.bgColor} rounded-lg p-5 border-2 cursor-pointer transition ${
        isSelected ? scenario.borderColor : 'border-transparent'
      } hover:shadow-md`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{scenario.icon}</span>
          <div>
            <h4 className={`font-bold ${scenario.color} text-lg`}>{scenario.name}</h4>
            <div className={`text-xs font-semibold px-2 py-1 rounded mt-1 inline-block ${getProbabilityBadge(scenario.probability)}`}>
              {scenario.probability.toUpperCase()} PROBABILITY
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-4">{scenario.description}</p>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Timing:</span>
          <span className="font-semibold text-gray-900">{scenario.timing}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Exit Cap Rate:</span>
          <span className="font-semibold text-gray-900">{scenario.exitCap}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Projected NOI:</span>
          <span className="font-semibold text-gray-900">
            ${(scenario.projectedNOI / 1000000).toFixed(2)}M
          </span>
        </div>
        
        {scenario.type === 'sale' && scenario.salePrice && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sale Price:</span>
            <span className="font-semibold text-gray-900">
              ${(scenario.salePrice / 1000000).toFixed(1)}M
            </span>
          </div>
        )}
        
        {scenario.type === 'refinance' && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Refi Amount:</span>
              <span className="font-semibold text-gray-900">
                ${(scenario.refinanceAmount! / 1000000).toFixed(1)}M
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cash Out:</span>
              <span className="font-semibold text-green-600">
                ${(scenario.cashOut! / 1000000).toFixed(1)}M
              </span>
            </div>
          </>
        )}
      </div>

      <div className="pt-3 border-t border-gray-300 space-y-2">
        {scenario.equityMultiple && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Equity Multiple:</span>
            <span className="text-xl font-bold text-green-600">{scenario.equityMultiple}x</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">IRR:</span>
          <span className="text-xl font-bold text-green-600">{scenario.irr}%</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Key Features:</div>
        <ul className="space-y-1">
          {scenario.keyFeatures.map((feature, idx) => (
            <li key={idx} className="text-xs text-gray-600 flex items-start">
              <span className="mr-1">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

interface ExitTimelineVisualizationProps {
  timeline: ExitTimelineEvent[];
  isPipeline: boolean;
}

const ExitTimelineVisualization: React.FC<ExitTimelineVisualizationProps> = ({ timeline, isPipeline }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'upcoming': return '🔄';
      case 'future': return '⏳';
      default: return '⏳';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'preparation': return 'bg-blue-500';
      case 'marketing': return 'bg-purple-500';
      case 'transaction': return 'bg-orange-500';
      case 'closing': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        📅 Timeline to Exit
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        {isPipeline 
          ? 'Key milestones from acquisition to planned exit'
          : 'Critical path to successful exit in target timeframe'
        }
      </p>

      <div className="space-y-4">
        {timeline.map((event, idx) => (
          <div key={event.id} className="relative">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${getCategoryColor(event.category)}`}></div>
                {idx < timeline.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                )}
              </div>
              
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getStatusIcon(event.status)}</span>
                    <span className="font-semibold text-gray-900">{event.name}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="text-sm text-gray-600 ml-8">{event.description}</div>
                {event.monthsFromNow && (
                  <div className="text-xs text-gray-500 ml-8 mt-1">
                    {event.monthsFromNow} months from now
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ValueProjectionChartProps {
  projections: ValueProjection[];
}

const ValueProjectionChart: React.FC<ValueProjectionChartProps> = ({ projections }) => {
  const maxValue = Math.max(...projections.map(p => p.propertyValue));
  const scaleHeight = (value: number) => (value / maxValue) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        📊 Value Projection Over Time
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Property value, equity growth, and IRR progression
      </p>

      {/* Bar Chart Visualization */}
      <div className="mb-8">
        <div className="flex items-end justify-between h-64 gap-2">
          {projections.map((proj, idx) => {
            const valueHeight = scaleHeight(proj.propertyValue);
            const equityHeight = scaleHeight(proj.equity);
            
            return (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="relative w-full" style={{ height: `${valueHeight}%` }}>
                  {/* Property Value Bar */}
                  <div className="absolute bottom-0 w-full bg-blue-400 rounded-t-lg" style={{ height: '100%' }}></div>
                  {/* Equity Overlay */}
                  <div 
                    className="absolute bottom-0 w-full bg-green-500 rounded-t-lg" 
                    style={{ height: `${(equityHeight / valueHeight) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-600 mt-2">Y{proj.year}</div>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-400 rounded"></div>
            <span className="text-xs text-gray-600">Property Value</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-xs text-gray-600">Equity Value</span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Year</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">NOI</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Cap Rate</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Prop. Value</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Equity</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">IRR</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((proj, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">Year {proj.year}</td>
                <td className="text-right py-3 px-4">
                  ${(proj.noi / 1000000).toFixed(2)}M
                </td>
                <td className="text-right py-3 px-4">
                  {proj.capRate.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-4">
                  ${(proj.propertyValue / 1000000).toFixed(1)}M
                </td>
                <td className="text-right py-3 px-4 text-green-600 font-semibold">
                  ${(proj.equity / 1000000).toFixed(1)}M
                </td>
                <td className={`text-right py-3 px-4 font-semibold ${
                  proj.irr >= 15 ? 'text-green-600' : proj.irr > 0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {proj.irr.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-xs text-blue-900">
          💡 <span className="font-semibold">Note:</span> Projections assume base case renovation timeline, stabilization, and market conditions. Year 5 represents optimal exit timing per business plan.
        </div>
      </div>
    </div>
  );
};

interface MarketReadinessSectionProps {
  indicators: MarketReadinessIndicator[];
}

const MarketReadinessSection: React.FC<MarketReadinessSectionProps> = ({ indicators }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-100 border-green-300 text-green-700';
      case 'needs-attention': return 'bg-yellow-100 border-yellow-300 text-yellow-700';
      case 'not-ready': return 'bg-red-100 border-red-300 text-red-700';
      default: return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return '✅';
      case 'needs-attention': return '⚠️';
      case 'not-ready': return '🔴';
      default: return '⚪';
    }
  };

  const averageScore = indicators.reduce((sum, ind) => sum + ind.score, 0) / indicators.length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          📊 Market Readiness Score
        </h3>
        <div className="text-right">
          <div className="text-sm text-gray-600">Overall Readiness</div>
          <div className={`text-3xl font-bold ${
            averageScore >= 80 ? 'text-green-600' : averageScore >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {averageScore.toFixed(0)}/100
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Key factors determining exit readiness and market appeal
      </p>

      <div className="space-y-4">
        {indicators.map((indicator, idx) => (
          <div key={idx} className={`rounded-lg border-2 p-4 ${getStatusColor(indicator.status)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStatusIcon(indicator.status)}</span>
                <div>
                  <h4 className="font-bold text-gray-900">{indicator.category}</h4>
                  <p className="text-sm text-gray-700 mt-1">{indicator.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{indicator.score}</div>
                <div className="text-xs text-gray-600">/ 100</div>
              </div>
            </div>

            {indicator.actionItems && indicator.actionItems.length > 0 && (
              <div className="mt-3 pl-11">
                <div className="text-xs font-semibold text-gray-700 mb-2">Action Items:</div>
                <ul className="space-y-1">
                  {indicator.actionItems.map((item, itemIdx) => (
                    <li key={itemIdx} className="text-xs text-gray-600 flex items-start">
                      <span className="mr-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-3">
              <div className="w-full bg-white rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    indicator.status === 'ready' 
                      ? 'bg-green-500' 
                      : indicator.status === 'needs-attention'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${indicator.score}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface BrokerRecommendationsSectionProps {
  brokers: BrokerRecommendation[];
}

const BrokerRecommendationsSection: React.FC<BrokerRecommendationsSectionProps> = ({ brokers }) => {
  const renderStars = (rating: number) => {
    return '⭐'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        🏆 Broker Recommendations
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Top brokers for multifamily exit based on track record and market expertise
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {brokers.map((broker) => (
          <div key={broker.id} className="rounded-lg border-2 border-gray-200 p-5 hover:border-blue-300 transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-bold text-gray-900 text-lg">{broker.brokerName}</h4>
                <div className="text-sm text-gray-600">{broker.firm}</div>
                <div className="text-xs text-gray-500 mt-1">{broker.specialty}</div>
              </div>
              <div className="text-right">
                <div className="text-xl">{renderStars(broker.rating)}</div>
                <div className="text-xs text-gray-600">{broker.rating.toFixed(1)}/5.0</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 rounded">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{broker.recentSales}</div>
                <div className="text-xs text-gray-600">Sales (12mo)</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{broker.avgDaysOnMarket}</div>
                <div className="text-xs text-gray-600">Avg Days</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">+{broker.avgPricePremium}%</div>
                <div className="text-xs text-gray-600">Avg Premium</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-green-700 mb-1">✓ Strengths:</div>
                <ul className="space-y-1">
                  {broker.pros.map((pro, idx) => (
                    <li key={idx} className="text-xs text-gray-600 flex items-start">
                      <span className="mr-1">•</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-orange-700 mb-1">⚠ Considerations:</div>
                <ul className="space-y-1">
                  {broker.cons.map((con, idx) => (
                    <li key={idx} className="text-xs text-gray-600 flex items-start">
                      <span className="mr-1">•</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          💡 <span className="font-semibold">Recommendation:</span> Interview top 2-3 brokers and evaluate marketing strategies, buyer networks, and fee structures. Consider co-listing for maximum market coverage.
        </div>
      </div>
    </div>
  );
};

interface ExitReadinessChecklistProps {
  items: ExitReadinessChecklistItem[];
  mode: string;
}

const ExitReadinessChecklist: React.FC<ExitReadinessChecklistProps> = ({ items, mode }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'not-started': return '⏳';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200';
      case 'in-progress': return 'bg-blue-50 border-blue-200';
      case 'not-started': return 'bg-gray-50 border-gray-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const completedItems = items.filter(i => i.status === 'completed').length;
  const totalItems = items.length;
  const completionPercent = (completedItems / totalItems) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          ✅ Exit Readiness Checklist
        </h3>
        <div className="text-sm font-semibold text-gray-700">
          {completedItems} / {totalItems} Complete ({completionPercent.toFixed(0)}%)
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border p-4 ${getStatusColor(item.status)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-xl">{getStatusIcon(item.status)}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.item}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    {item.assignee && (
                      <span>👤 {item.assignee}</span>
                    )}
                    {item.dueDate && (
                      <span>📅 {new Date(item.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${getPriorityBadge(item.priority)}`}>
                {item.priority.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== DEFAULT DATA FUNCTIONS ====================

function getDefaultExitStats(isPipeline: boolean): ExitQuickStat[] {
  if (isPipeline) {
    return [
      { label: 'Target Exit Date', value: 'Q1 2028', format: 'number', icon: '📅', status: 'info' },
      { label: 'Projected IRR', value: 18.5, format: 'percentage', icon: '📈', trend: { direction: 'up', value: '+2.1%' } },
      { label: 'Equity Multiple', value: '2.4x', format: 'number', icon: '💰', status: 'success' },
      { label: 'Exit Cap Rate', value: 5.25, format: 'percentage', icon: '🎯' },
      { label: 'Projected Sale Price', value: 54285714, format: 'currency', icon: '💵' }
    ];
  } else {
    return [
      { label: 'Days Since Acquisition', value: 487, format: 'number', icon: '📅' },
      { label: 'Current IRR', value: 16.8, format: 'percentage', icon: '📈', trend: { direction: 'up', value: '+1.2%' } },
      { label: 'Equity Multiple', value: '2.1x', format: 'number', icon: '💰' },
      { label: 'Market Readiness', value: 75, format: 'percentage', icon: '📊', status: 'success' },
      { label: 'Projected Exit Value', value: 56000000, format: 'currency', icon: '💵' }
    ];
  }
}

function getDefaultExitScenarios(isPipeline: boolean): ExitScenario[] {
  const baseScenarios: ExitScenario[] = [
    {
      id: isPipeline ? 'base-sale' : 'perf-base-sale',
      name: 'Base Case Sale',
      icon: '🏆',
      type: 'sale',
      description: 'Standard sale at stabilization with market-rate cap rate',
      timing: isPipeline ? 'Year 5 (Q1 2028)' : 'Q4 2024',
      exitCap: 5.25,
      projectedNOI: 2850000,
      probability: 'high',
      salePrice: 54285714,
      equityMultiple: 2.4,
      irr: 18.5,
      keyFeatures: ['Market cap rate', 'Full stabilization', 'Standard marketing period'],
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-300'
    },
    {
      id: isPipeline ? 'upside-sale' : 'perf-upside-sale',
      name: 'Upside Sale',
      icon: '🚀',
      type: 'sale',
      description: 'Premium sale with compressed cap rate due to strong performance',
      timing: isPipeline ? 'Year 5 (Q1 2028)' : 'Q4 2024',
      exitCap: 4.95,
      projectedNOI: 2950000,
      probability: 'medium',
      salePrice: 59595960,
      equityMultiple: 2.8,
      irr: 21.2,
      keyFeatures: ['Below-market cap', 'Premium positioning', 'Strong buyer competition'],
      color: 'text-purple-700',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-300'
    },
    {
      id: isPipeline ? 'refinance' : 'perf-refinance',
      name: 'Refinance & Hold',
      icon: '♻️',
      type: 'refinance',
      description: 'Cash-out refinance at stabilization, continue operations',
      timing: isPipeline ? 'Year 4 (Q4 2027)' : 'Q2 2024',
      exitCap: 5.5,
      projectedNOI: 2750000,
      probability: 'medium',
      refinanceAmount: 40000000,
      cashOut: 18500000,
      irr: 16.8,
      keyFeatures: ['Tax-efficient', 'Preserve upside', 'Return capital to investors'],
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300'
    }
  ];

  return baseScenarios;
}

function getDefaultExitTimeline(isPipeline: boolean): ExitTimelineEvent[] {
  if (isPipeline) {
    return [
      {
        id: '1',
        name: 'Acquisition Close',
        date: '2024-03-01',
        category: 'preparation',
        status: 'upcoming',
        description: 'Complete acquisition and take ownership',
        monthsFromNow: 2
      },
      {
        id: '2',
        name: 'Renovations Complete',
        date: '2025-12-01',
        category: 'preparation',
        status: 'future',
        description: 'Finish all unit and common area improvements',
        monthsFromNow: 22
      },
      {
        id: '3',
        name: 'Property Stabilized',
        date: '2026-06-01',
        category: 'preparation',
        status: 'future',
        description: 'Achieve 95%+ occupancy at target rents',
        monthsFromNow: 28
      },
      {
        id: '4',
        name: 'Broker Engagement',
        date: '2027-09-01',
        category: 'marketing',
        status: 'future',
        description: 'Interview and select listing brokers',
        monthsFromNow: 43
      },
      {
        id: '5',
        name: 'Marketing Launch',
        date: '2027-11-01',
        category: 'marketing',
        status: 'future',
        description: 'Begin property marketing and buyer outreach',
        monthsFromNow: 45
      },
      {
        id: '6',
        name: 'Target Exit',
        date: '2028-01-15',
        category: 'closing',
        status: 'future',
        description: 'Close sale transaction',
        monthsFromNow: 48
      }
    ];
  } else {
    return [
      {
        id: '1',
        name: 'Property Stabilized',
        date: '2024-01-01',
        category: 'preparation',
        status: 'completed',
        description: 'Achieved 95%+ occupancy at target rents',
        monthsFromNow: -2
      },
      {
        id: '2',
        name: 'Financial Audit',
        date: '2024-03-01',
        category: 'preparation',
        status: 'upcoming',
        description: 'Complete financial statement audit',
        monthsFromNow: 1
      },
      {
        id: '3',
        name: 'Broker Engagement',
        date: '2024-04-01',
        category: 'marketing',
        status: 'upcoming',
        description: 'Interview and select listing brokers',
        monthsFromNow: 2
      },
      {
        id: '4',
        name: 'Marketing Launch',
        date: '2024-06-01',
        category: 'marketing',
        status: 'future',
        description: 'Begin property marketing and buyer outreach',
        monthsFromNow: 4
      },
      {
        id: '5',
        name: 'Offers & Negotiations',
        date: '2024-08-01',
        category: 'transaction',
        status: 'future',
        description: 'Review offers and negotiate terms',
        monthsFromNow: 6
      },
      {
        id: '6',
        name: 'Target Exit',
        date: '2024-10-01',
        category: 'closing',
        status: 'future',
        description: 'Close sale transaction',
        monthsFromNow: 8
      }
    ];
  }
}

function getDefaultValueProjections(isPipeline: boolean): ValueProjection[] {
  const baseYear = isPipeline ? 2024 : 2023;
  
  return [
    {
      year: 1,
      noi: 2200000,
      capRate: 5.8,
      propertyValue: 37931034,
      equity: 11793103,
      irr: -12.5
    },
    {
      year: 2,
      noi: 2450000,
      capRate: 5.6,
      propertyValue: 43750000,
      equity: 17750000,
      irr: 8.2
    },
    {
      year: 3,
      noi: 2650000,
      capRate: 5.4,
      propertyValue: 49074074,
      equity: 23074074,
      irr: 14.8
    },
    {
      year: 4,
      noi: 2750000,
      capRate: 5.3,
      propertyValue: 51886792,
      equity: 25886792,
      irr: 16.5
    },
    {
      year: 5,
      noi: 2850000,
      capRate: 5.25,
      propertyValue: 54285714,
      equity: 28285714,
      irr: 18.5
    }
  ];
}

function getDefaultMarketReadiness(isPipeline: boolean): MarketReadinessIndicator[] {
  if (isPipeline) {
    return [
      {
        category: 'Property Condition',
        score: 30,
        status: 'not-ready',
        description: 'Property requires renovation program',
        actionItems: ['Complete unit renovations', 'Upgrade common areas', 'Address deferred maintenance']
      },
      {
        category: 'Financial Performance',
        score: 40,
        status: 'needs-attention',
        description: 'Performance below market, needs stabilization',
        actionItems: ['Increase occupancy to 95%+', 'Achieve target rents', 'Stabilize operating expenses']
      },
      {
        category: 'Market Conditions',
        score: 75,
        status: 'ready',
        description: 'Strong buyer demand in submarket',
        actionItems: []
      }
    ];
  } else {
    return [
      {
        category: 'Property Condition',
        score: 95,
        status: 'ready',
        description: 'Property in excellent condition with recent renovations',
        actionItems: []
      },
      {
        category: 'Financial Performance',
        score: 90,
        status: 'ready',
        description: 'Strong NOI growth and occupancy',
        actionItems: ['Maintain occupancy momentum', 'Continue expense management']
      },
      {
        category: 'Market Conditions',
        score: 85,
        status: 'ready',
        description: 'Active buyer market with strong cap rate compression',
        actionItems: []
      },
      {
        category: 'Documentation',
        score: 70,
        status: 'needs-attention',
        description: 'Financial records need final audit',
        actionItems: ['Complete financial statement audit', 'Update rent roll', 'Compile marketing materials']
      }
    ];
  }
}

function getDefaultExitReadiness(isPipeline: boolean): ExitReadinessChecklistItem[] {
  if (isPipeline) {
    return [
      {
        id: '1',
        item: 'Complete property renovations',
        status: 'not-started',
        priority: 'high',
        assignee: 'Construction Team',
        dueDate: '2025-12-01'
      },
      {
        id: '2',
        item: 'Achieve occupancy stabilization (95%+)',
        status: 'not-started',
        priority: 'high',
        assignee: 'Property Manager',
        dueDate: '2026-06-01'
      },
      {
        id: '3',
        item: 'Financial audit and reporting',
        status: 'not-started',
        priority: 'medium',
        assignee: 'Accounting',
        dueDate: '2027-08-01'
      },
      {
        id: '4',
        item: 'Marketing materials preparation',
        status: 'not-started',
        priority: 'medium',
        assignee: 'Marketing',
        dueDate: '2027-09-01'
      },
      {
        id: '5',
        item: 'Broker selection and engagement',
        status: 'not-started',
        priority: 'high',
        assignee: 'Acquisitions',
        dueDate: '2027-09-01'
      }
    ];
  } else {
    return [
      {
        id: '1',
        item: 'Financial statement audit',
        status: 'in-progress',
        priority: 'high',
        assignee: 'Accounting',
        dueDate: '2024-03-01'
      },
      {
        id: '2',
        item: 'Update rent roll and tenant files',
        status: 'in-progress',
        priority: 'high',
        assignee: 'Property Manager',
        dueDate: '2024-03-15'
      },
      {
        id: '3',
        item: 'Property marketing materials',
        status: 'in-progress',
        priority: 'medium',
        assignee: 'Marketing',
        dueDate: '2024-04-01'
      },
      {
        id: '4',
        item: 'Broker interviews and selection',
        status: 'not-started',
        priority: 'high',
        assignee: 'Acquisitions',
        dueDate: '2024-04-01'
      },
      {
        id: '5',
        item: 'Legal review and documentation',
        status: 'completed',
        priority: 'high',
        assignee: 'Legal',
        dueDate: '2024-02-15'
      }
    ];
  }
}

function getDefaultBrokerRecommendations(): BrokerRecommendation[] {
  return [
    {
      id: '1',
      brokerName: 'Marcus & Millichap',
      firm: 'Marcus & Millichap',
      specialty: 'Multifamily Investment Sales',
      rating: 4.8,
      recentSales: 47,
      avgDaysOnMarket: 82,
      avgPricePremium: 3.2,
      pros: [
        'Extensive buyer network in multifamily sector',
        'Strong track record with value-add properties',
        'National marketing reach'
      ],
      cons: [
        'Higher commission structure',
        'Less focused on single assets'
      ]
    },
    {
      id: '2',
      brokerName: 'CBRE Multifamily',
      firm: 'CBRE',
      specialty: 'Multifamily Capital Markets',
      rating: 4.7,
      recentSales: 38,
      avgDaysOnMarket: 75,
      avgPricePremium: 4.1,
      pros: [
        'Premium buyer network and institutional relationships',
        'Strong marketing and analytics capabilities',
        'Excellent market intelligence'
      ],
      cons: [
        'Selective on property types and size',
        'Premium pricing'
      ]
    }
  ];
}

export default ExitSection;
