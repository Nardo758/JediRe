/**
 * Strategy Section - Dual-Mode (Acquisition & Performance)
 * Investment strategy planning and execution tracking
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionStats,
  performanceStats,
  strategyCards,
  acquisitionImplementationTasks,
  performanceImplementationTasks,
  acquisitionTimeline,
  performanceStrategyProgress,
  roiProjections,
  riskFactors,
  performanceRiskFactors,
  performanceOptimizations,
  exitScenarios,
  QuickStat,
  StrategyCard,
  ImplementationTask,
  TimelinePhase,
  StrategyProgress
} from '../../../data/strategyMockData';

interface StrategySectionProps {
  deal: Deal;
}

export const StrategySection: React.FC<StrategySectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('value-add');

  // Select data based on mode
  const stats = isPipeline ? acquisitionStats : performanceStats;
  const tasks = isPipeline ? acquisitionImplementationTasks : performanceImplementationTasks;
  const risks = isPipeline ? riskFactors : performanceRiskFactors;

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
            {isPipeline ? '🎯 Strategy Planning' : '📊 Strategy Execution'}
          </div>
          {isOwned && (
            <div className="text-xs text-gray-500">
              Acquired: {new Date(deal.actualCloseDate || deal.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={stats} />

      {/* Strategy Cards - Only show in Acquisition Mode */}
      {isPipeline && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              📋 Strategy Options
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Compare different investment strategies for this opportunity
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategyCards.map((strategy) => (
                <StrategyCardComponent
                  key={strategy.id}
                  strategy={strategy}
                  isSelected={selectedStrategy === strategy.id}
                  onSelect={() => setSelectedStrategy(strategy.id)}
                />
              ))}
            </div>
          </div>

          {/* ROI Comparison Chart */}
          <ROIComparisonChart projections={roiProjections} />

          {/* Implementation Timeline */}
          <TimelineVisualization timeline={acquisitionTimeline} />
        </>
      )}

      {/* Performance Mode - Progress Tracking */}
      {isOwned && (
        <>
          <StrategyProgressSection progress={performanceStrategyProgress} />
          
          <OptimizationsSection optimizations={performanceOptimizations} />
          
          <ExitScenariosSection scenarios={exitScenarios} />
        </>
      )}

      {/* Implementation Checklist */}
      <ImplementationChecklist tasks={tasks} mode={mode} />

      {/* Risk Assessment */}
      <RiskAssessmentSection risks={risks} />

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: QuickStat[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  const formatValue = (stat: QuickStat): string => {
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

interface StrategyCardComponentProps {
  strategy: StrategyCard;
  isSelected: boolean;
  onSelect: () => void;
}

const StrategyCardComponent: React.FC<StrategyCardComponentProps> = ({
  strategy,
  isSelected,
  onSelect
}) => {
  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'very-high': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`${strategy.bgColor} rounded-lg p-5 border-2 cursor-pointer transition ${
        isSelected ? strategy.borderColor : 'border-transparent'
      } hover:shadow-md`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{strategy.icon}</span>
          <div>
            <h4 className={`font-bold ${strategy.color} text-lg`}>{strategy.name}</h4>
            <div className={`text-xs font-semibold px-2 py-1 rounded mt-1 inline-block ${getRiskBadgeColor(strategy.riskLevel)}`}>
              {strategy.riskLevel.toUpperCase()} RISK
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-4">{strategy.description}</p>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Target IRR:</span>
          <span className="font-semibold text-gray-900">{strategy.targetIRR}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Hold Period:</span>
          <span className="font-semibold text-gray-900">{strategy.holdPeriod}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Capex Required:</span>
          <span className="font-semibold text-gray-900">
            ${(strategy.capexRequired / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Stabilization:</span>
          <span className="font-semibold text-gray-900">{strategy.timeToStabilize}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Key Features:</div>
        <ul className="space-y-1">
          {strategy.keyFeatures.map((feature, idx) => (
            <li key={idx} className="text-xs text-gray-600 flex items-start">
              <span className="mr-1">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Exit Strategies:</div>
        <div className="flex flex-wrap gap-1">
          {strategy.exitStrategy.map((exit, idx) => (
            <span
              key={idx}
              className="text-xs bg-white px-2 py-1 rounded border border-gray-300"
            >
              {exit}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ROIComparisonChartProps {
  projections: any[];
}

const ROIComparisonChart: React.FC<ROIComparisonChartProps> = ({ projections }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        📊 ROI Comparison by Strategy
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Projected returns across different timeframes
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Strategy</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Year 1</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Year 3</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Year 5</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">At Exit</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Return</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((proj, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{proj.strategy}</td>
                <td className={`text-right py-3 px-4 ${proj.year1 < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {proj.year1.toFixed(1)}%
                </td>
                <td className={`text-right py-3 px-4 ${proj.year3 < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {proj.year3.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-4 text-green-600">
                  {proj.year5.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-4 text-green-600 font-semibold">
                  {proj.exit.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-4 text-green-700 font-bold">
                  {proj.totalReturn.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-xs text-blue-900">
          💡 <span className="font-semibold">Note:</span> Negative returns in early years reflect capital deployment phase. Returns accelerate during stabilization and exit.
        </div>
      </div>
    </div>
  );
};

interface TimelineVisualizationProps {
  timeline: TimelinePhase[];
}

const TimelineVisualization: React.FC<TimelineVisualizationProps> = ({ timeline }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        📅 Implementation Timeline
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        5-7 year value-add strategy execution plan
      </p>

      <div className="space-y-4">
        {timeline.map((phase, idx) => (
          <div key={idx} className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${phase.color}`}></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{phase.name}</span>
                  <span className="text-sm text-gray-600">{phase.duration}</span>
                </div>
              </div>
            </div>
            
            <div className="ml-6 pl-3 border-l-2 border-gray-200 pb-2">
              <ul className="space-y-1">
                {phase.tasks.map((task, taskIdx) => (
                  <li key={taskIdx} className="text-sm text-gray-600 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Visual timeline bar */}
      <div className="mt-6 relative h-12 bg-gray-100 rounded-lg overflow-hidden">
        {timeline.map((phase, idx) => {
          const totalMonths = 72;
          const widthPercent = (phase.durationMonths / totalMonths) * 100;
          const leftPercent = (phase.startMonth / totalMonths) * 100;
          
          return (
            <div
              key={idx}
              className={`absolute top-0 h-full ${phase.color} opacity-80 flex items-center justify-center`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
            >
              <span className="text-xs font-semibold text-white text-center px-1">
                {phase.name.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Month 0</span>
        <span>Month 36</span>
        <span>Month 72</span>
      </div>
    </div>
  );
};

interface ImplementationChecklistProps {
  tasks: ImplementationTask[];
  mode: string;
}

const ImplementationChecklist: React.FC<ImplementationChecklistProps> = ({ tasks, mode }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'pending': return '⏳';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200';
      case 'in-progress': return 'bg-blue-50 border-blue-200';
      case 'pending': return 'bg-gray-50 border-gray-200';
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

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const completionPercent = (completedTasks / totalTasks) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          ✅ Implementation Checklist
        </h3>
        <div className="text-sm font-semibold text-gray-700">
          {completedTasks} / {totalTasks} Complete ({completionPercent.toFixed(0)}%)
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
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-lg border p-4 ${getStatusColor(task.status)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-xl">{getStatusIcon(task.status)}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{task.task}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    {task.assignee && (
                      <span>👤 {task.assignee}</span>
                    )}
                    {task.dueDate && (
                      <span>📅 {new Date(task.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${getPriorityBadge(task.priority)}`}>
                {task.priority.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RiskAssessmentSectionProps {
  risks: any[];
}

const RiskAssessmentSection: React.FC<RiskAssessmentSectionProps> = ({ risks }) => {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-700 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        ⚠️ Risk Assessment
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Key risks and mitigation strategies
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {risks.map((risk, idx) => (
          <div
            key={idx}
            className={`rounded-lg border-2 p-4 ${getRiskColor(risk.level)}`}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{getRiskIcon(risk.level)}</span>
              <div>
                <h4 className="font-bold text-gray-900">{risk.category}</h4>
                <span className={`text-xs font-semibold px-2 py-1 rounded mt-1 inline-block ${getRiskColor(risk.level)}`}>
                  {risk.level.toUpperCase()} RISK
                </span>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-gray-700">Risk:</span>
                <p className="text-gray-600 mt-1">{risk.description}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Mitigation:</span>
                <p className="text-gray-600 mt-1">{risk.mitigation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">Overall Risk Profile:</span>
          {' '}Moderate risk with strong mitigation strategies in place. Regular monitoring and proactive management recommended.
        </div>
      </div>
    </div>
  );
};

interface StrategyProgressSectionProps {
  progress: StrategyProgress[];
}

const StrategyProgressSection: React.FC<StrategyProgressSectionProps> = ({ progress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500';
      case 'upcoming': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'upcoming': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        📊 Strategy Progress Tracker
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Track execution across major strategy phases
      </p>

      <div className="space-y-4">
        {progress.map((phase, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">{phase.phase}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(phase.status)}`}>
                  {phase.status.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {phase.completedTasks} / {phase.totalTasks} tasks
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${getStatusColor(phase.status)}`}
                    style={{ width: `${phase.percentage}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                {phase.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface OptimizationsSectionProps {
  optimizations: any[];
}

const OptimizationsSection: React.FC<OptimizationsSectionProps> = ({ optimizations }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'implemented': return '✅';
      case 'in-progress': return '🔄';
      case 'planned': return '📋';
      default: return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented': return 'bg-green-50 border-green-200';
      case 'in-progress': return 'bg-blue-50 border-blue-200';
      case 'planned': return 'bg-gray-50 border-gray-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const totalSavings = optimizations
    .filter(opt => opt.annualSavings && opt.status === 'implemented')
    .reduce((sum, opt) => sum + opt.annualSavings, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          💡 Active Optimizations
        </h3>
        <div className="text-right">
          <div className="text-sm text-gray-600">Annual Impact (Implemented)</div>
          <div className="text-2xl font-bold text-green-600">
            +${(totalSavings / 1000).toFixed(0)}K
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {optimizations.map((opt, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-4 ${getStatusColor(opt.status)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{getStatusIcon(opt.status)}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{opt.action}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    opt.category === 'Revenue' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {opt.category}
                  </span>
                </div>
                <div className="text-sm text-gray-700 font-medium">{opt.impact}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ExitScenariosSectionProps {
  scenarios: any[];
}

const ExitScenariosSection: React.FC<ExitScenariosSectionProps> = ({ scenarios }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        🎯 Exit Scenario Analysis
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Projected returns under different exit timing and market conditions
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((scenario, idx) => (
          <div
            key={idx}
            className={`rounded-lg border-2 p-5 ${
              scenario.name === 'Base Case' 
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <h4 className="font-bold text-gray-900 text-lg mb-3">{scenario.name}</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Timing:</span>
                <span className="font-semibold text-gray-900">{scenario.timing}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Exit Cap:</span>
                <span className="font-semibold text-gray-900">{scenario.exitCap}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Proj. NOI:</span>
                <span className="font-semibold text-gray-900">
                  ${(scenario.projectedNOI / 1000000).toFixed(2)}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sale Price:</span>
                <span className="font-semibold text-gray-900">
                  ${(scenario.salePrice / 1000000).toFixed(1)}M
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Equity Multiple:</span>
                <span className="text-xl font-bold text-green-600">{scenario.equityMultiple}x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">IRR:</span>
                <span className="text-xl font-bold text-green-600">{scenario.irr}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          💡 <span className="font-semibold">Recommendation:</span> Base case provides balanced risk/return profile. Monitor market conditions for opportunistic early exit if cap rates compress further.
        </div>
      </div>
    </div>
  );
};

export default StrategySection;
