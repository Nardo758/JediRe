/**
 * Exit Section - Dual-Mode (Acquisition & Performance)
 * Exit strategy planning and readiness tracking
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionExitStats,
  performanceExitStats,
  acquisitionExitScenarios,
  performanceExitScenarios,
  acquisitionExitTimeline,
  performanceExitTimeline,
  acquisitionValueProjections,
  performanceValueProjections,
  acquisitionMarketReadiness,
  performanceMarketReadiness,
  performanceBrokerRecommendations,
  acquisitionExitReadiness,
  performanceExitReadiness,
  ExitQuickStat,
  ExitScenario,
  ExitTimelineEvent,
  ValueProjection,
  MarketReadinessIndicator,
  BrokerRecommendation,
  ExitReadinessChecklistItem
} from '../../../data/exitMockData';

interface ExitSectionProps {
  deal: Deal;
}

export const ExitSection: React.FC<ExitSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [selectedScenario, setSelectedScenario] = useState<string>(isPipeline ? 'base-sale' : 'perf-base-sale');

  // Select data based on mode
  const stats = isPipeline ? acquisitionExitStats : performanceExitStats;
  const scenarios = isPipeline ? acquisitionExitScenarios : performanceExitScenarios;
  const timeline = isPipeline ? acquisitionExitTimeline : performanceExitTimeline;
  const valueProjections = isPipeline ? acquisitionValueProjections : performanceValueProjections;
  const readinessIndicators = isPipeline ? acquisitionMarketReadiness : performanceMarketReadiness;
  const readinessChecklist = isPipeline ? acquisitionExitReadiness : performanceExitReadiness;

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
          {isOwned && (
            <div className="text-xs text-gray-500">
              Holding Period: {new Date(deal.actualCloseDate || deal.createdAt).toLocaleDateString()} - Present
            </div>
          )}
        </div>
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
          
          <BrokerRecommendationsSection brokers={performanceBrokerRecommendations} />
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

export default ExitSection;
