/**
 * Investment Strategy Section - Unified Module
 * Consolidates Strategy + Exit into comprehensive investment view
 * Entry → Value Creation → Exit progression
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  getInvestmentStrategyOverview,
  getStrategyTimeline,
  getAcquisitionStrategy,
  getValueCreationPlan,
  getExitStrategy,
  getRiskFactors,
  getInvestmentStrategyQuickStats,
  InvestmentStrategyOverview,
  StrategyTimeline,
  ValueCreationInitiative,
  ExitScenario,
  BrokerRecommendation,
  RiskFactor
} from '../../../data/investmentStrategyMockData';

interface InvestmentStrategySectionProps {
  deal: Deal;
}

export const InvestmentStrategySection: React.FC<InvestmentStrategySectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [activeSubSection, setActiveSubSection] = useState<'acquisition' | 'value-creation' | 'exit'>('acquisition');
  const [selectedExitScenario, setSelectedExitScenario] = useState<string>('base-sale');

  const overview = getInvestmentStrategyOverview(deal);
  const timeline = getStrategyTimeline(deal);
  const quickStats = getInvestmentStrategyQuickStats(deal);
  const acquisitionStrategy = getAcquisitionStrategy(deal);
  const valueCreationPlan = getValueCreationPlan(deal);
  const exitStrategy = getExitStrategy(deal);
  const riskFactors = getRiskFactors(deal);

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
            {isPipeline ? '🎯 Investment Planning' : '📊 Investment Execution'}
          </div>
          {isOwned && overview.acquisitionDate && (
            <div className="text-xs text-gray-500">
              Acquired: {new Date(overview.acquisitionDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={quickStats} />

      {/* Investment Strategy Timeline (Entry → Value → Exit) */}
      <InvestmentTimelineVisualization 
        timeline={timeline} 
        currentPhase={overview.currentPhase}
      />

      {/* Sub-Section Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubSection('acquisition')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
              activeSubSection === 'acquisition'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="text-lg mb-1">🎯</div>
            <div className="text-sm">Acquisition Strategy</div>
          </button>
          <button
            onClick={() => setActiveSubSection('value-creation')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
              activeSubSection === 'value-creation'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="text-lg mb-1">🚀</div>
            <div className="text-sm">Value Creation Plan</div>
          </button>
          <button
            onClick={() => setActiveSubSection('exit')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
              activeSubSection === 'exit'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="text-lg mb-1">🏆</div>
            <div className="text-sm">Exit Strategy</div>
          </button>
        </div>
      </div>

      {/* Sub-Section Content */}
      {activeSubSection === 'acquisition' && (
        <AcquisitionStrategySubSection 
          strategy={acquisitionStrategy}
          isPipeline={isPipeline}
        />
      )}

      {activeSubSection === 'value-creation' && (
        <ValueCreationPlanSubSection 
          plan={valueCreationPlan}
          isPipeline={isPipeline}
        />
      )}

      {activeSubSection === 'exit' && (
        <ExitStrategySubSection 
          exitStrategy={exitStrategy}
          selectedScenario={selectedExitScenario}
          onSelectScenario={setSelectedExitScenario}
          isPipeline={isPipeline}
        />
      )}

      {/* Risk Assessment (always visible) */}
      <RiskAssessmentSection risks={riskFactors} />

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: any[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  const formatValue = (stat: any): string => {
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
      case 'text':
        return stat.value;
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

interface InvestmentTimelineVisualizationProps {
  timeline: StrategyTimeline[];
  currentPhase: string;
}

const InvestmentTimelineVisualization: React.FC<InvestmentTimelineVisualizationProps> = ({ 
  timeline,
  currentPhase 
}) => {
  const getPhaseColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500';
      case 'upcoming': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  const getPhaseIcon = (phase: string, status: string) => {
    if (status === 'completed') return '✅';
    if (status === 'active') return '🔄';
    
    switch (phase) {
      case 'Entry': return '🎯';
      case 'Value Creation': return '🚀';
      case 'Exit': return '🏆';
      default: return '⏳';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        🗺️ Investment Lifecycle Timeline
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Track progress from acquisition through value creation to exit
      </p>

      {/* Visual Timeline Bar */}
      <div className="mb-8 relative h-16 bg-gray-100 rounded-lg overflow-hidden">
        {timeline.map((phase, idx) => {
          const widthPercent = 100 / timeline.length;
          const leftPercent = idx * widthPercent;
          
          return (
            <div
              key={idx}
              className={`absolute top-0 h-full ${getPhaseColor(phase.status)} opacity-90 flex flex-col items-center justify-center transition-all`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
            >
              <span className="text-2xl mb-1">{getPhaseIcon(phase.phase, phase.status)}</span>
              <span className="text-xs font-semibold text-white text-center px-1">
                {phase.phase}
              </span>
            </div>
          );
        })}
      </div>

      {/* Phase Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {timeline.map((phase, idx) => (
          <div
            key={idx}
            className={`rounded-lg border-2 p-4 ${
              phase.status === 'active' 
                ? 'border-blue-400 bg-blue-50'
                : phase.status === 'completed'
                ? 'border-green-400 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{getPhaseIcon(phase.phase, phase.status)}</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                phase.status === 'active' 
                  ? 'bg-blue-100 text-blue-700'
                  : phase.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {phase.status.toUpperCase()}
              </span>
            </div>
            
            <h4 className="font-bold text-gray-900 mb-2">{phase.phase}</h4>
            
            <div className="text-xs text-gray-600 mb-3">
              {new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              {' → '}
              {new Date(phase.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
            
            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Progress</span>
                <span className="text-xs font-semibold text-gray-900">{phase.progress}%</span>
              </div>
              <div className="w-full bg-white rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getPhaseColor(phase.status)}`}
                  style={{ width: `${phase.progress}%` }}
                ></div>
              </div>
            </div>
            
            {/* Key Milestones */}
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-2">Key Milestones:</div>
              <ul className="space-y-1">
                {phase.keyMilestones.map((milestone, mIdx) => (
                  <li key={mIdx} className="text-xs text-gray-600 flex items-start">
                    <span className="mr-1">•</span>
                    <span>{milestone}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface AcquisitionStrategySubSectionProps {
  strategy: any;
  isPipeline: boolean;
}

const AcquisitionStrategySubSection: React.FC<AcquisitionStrategySubSectionProps> = ({ 
  strategy,
  isPipeline 
}) => {
  return (
    <div className="space-y-6">
      
      {/* Strategy Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          🎯 {isPipeline ? 'Acquisition Strategy' : 'Acquisition Thesis (Executed)'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-gray-600 mb-1">Strategy Type</div>
            <div className="text-xl font-bold text-blue-700">{strategy.strategyType}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-gray-600 mb-1">Target IRR</div>
            <div className="text-xl font-bold text-green-700">{strategy.targetIRR}%</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-sm text-gray-600 mb-1">Time to Stabilize</div>
            <div className="text-xl font-bold text-purple-700">{strategy.timeToStabilize}</div>
          </div>
        </div>
        
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">Investment Thesis</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{strategy.investmentThesis}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">🚀 Key Value Drivers</h4>
            <ul className="space-y-2">
              {strategy.keyValueDrivers.map((driver: string, idx: number) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>{driver}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">💪 Competitive Advantages</h4>
            <ul className="space-y-2">
              {strategy.competitiveAdvantage.map((advantage: string, idx: number) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start">
                  <span className="text-blue-600 mr-2">★</span>
                  <span>{advantage}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Capital Deployment */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          💰 Capital Deployment Plan
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-600">Total Capex Budget</div>
              <div className="text-2xl font-bold text-gray-900">
                ${(strategy.capexBudget / 1000000).toFixed(2)}M
              </div>
            </div>
            <div className="text-4xl">💵</div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Unit Renovations</div>
              <div className="text-lg font-bold text-gray-900">$2.1M</div>
              <div className="text-xs text-gray-500 mt-1">65% of budget</div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Common Areas</div>
              <div className="text-lg font-bold text-gray-900">$750K</div>
              <div className="text-xs text-gray-500 mt-1">23% of budget</div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Contingency</div>
              <div className="text-lg font-bold text-gray-900">$400K</div>
              <div className="text-xs text-gray-500 mt-1">12% reserve</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

interface ValueCreationPlanSubSectionProps {
  plan: any;
  isPipeline: boolean;
}

const ValueCreationPlanSubSection: React.FC<ValueCreationPlanSubSectionProps> = ({ 
  plan,
  isPipeline 
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'planned': return '📋';
      default: return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200';
      case 'in-progress': return 'bg-blue-50 border-blue-200';
      case 'planned': return 'bg-gray-50 border-gray-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Revenue': return 'bg-green-100 text-green-700';
      case 'Operations': return 'bg-blue-100 text-blue-700';
      case 'Capex': return 'bg-purple-100 text-purple-700';
      case 'Positioning': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const totalCompleted = plan.implementationStatus.completed;
  const totalInProgress = plan.implementationStatus.inProgress;
  const totalPlanned = plan.implementationStatus.planned;
  const totalItems = totalCompleted + totalInProgress + totalPlanned;
  const completionPercent = (totalCompleted / totalItems) * 100;

  return (
    <div className="space-y-6">
      
      {/* Progress Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          🚀 {isPipeline ? 'Planned Value Creation' : 'Value Creation Progress'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-gray-600 mb-1">Total NOI Lift</div>
            <div className="text-xl font-bold text-green-700">
              +${(plan.totalProjectedLift / 1000000).toFixed(2)}M
            </div>
            <div className="text-xs text-gray-500 mt-1">Annual projection</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-gray-600 mb-1">Completed</div>
            <div className="text-xl font-bold text-green-700">{totalCompleted}</div>
            <div className="text-xs text-gray-500 mt-1">Initiatives</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-gray-600 mb-1">In Progress</div>
            <div className="text-xl font-bold text-blue-700">{totalInProgress}</div>
            <div className="text-xs text-gray-500 mt-1">Initiatives</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Planned</div>
            <div className="text-xl font-bold text-gray-700">{totalPlanned}</div>
            <div className="text-xs text-gray-500 mt-1">Initiatives</div>
          </div>
        </div>

        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Overall Implementation Progress</span>
            <span className="text-sm font-semibold text-gray-900">{completionPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Initiatives List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          📋 Value Creation Initiatives
        </h3>
        
        <div className="space-y-3">
          {plan.initiatives.map((initiative: ValueCreationInitiative) => (
            <div
              key={initiative.id}
              className={`rounded-lg border p-4 ${getStatusColor(initiative.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-xl">{getStatusIcon(initiative.status)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getCategoryColor(initiative.category)}`}>
                        {initiative.category}
                      </span>
                      <span className="font-semibold text-gray-900">{initiative.action}</span>
                    </div>
                    <div className="text-sm text-gray-700 mb-2">{initiative.impact}</div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>📅 {initiative.timeline}</span>
                      {initiative.annualImpact && (
                        <span className="font-semibold text-green-600">
                          +${(initiative.annualImpact / 1000).toFixed(0)}K annual
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

interface ExitStrategySubSectionProps {
  exitStrategy: any;
  selectedScenario: string;
  onSelectScenario: (id: string) => void;
  isPipeline: boolean;
}

const ExitStrategySubSection: React.FC<ExitStrategySubSectionProps> = ({ 
  exitStrategy,
  selectedScenario,
  onSelectScenario,
  isPipeline 
}) => {
  const getProbabilityBadge = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const averageReadiness = isPipeline ? 30 :
    (exitStrategy.preparationStatus.property + 
     exitStrategy.preparationStatus.financials + 
     exitStrategy.preparationStatus.marketing + 
     exitStrategy.preparationStatus.legal) / 4;

  return (
    <div className="space-y-6">
      
      {/* Exit Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          🏆 Exit Strategy Overview
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-sm text-gray-600 mb-1">Target Exit Date</div>
            <div className="text-lg font-bold text-purple-700">
              {new Date(exitStrategy.targetTiming).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-gray-600 mb-1">Market Readiness</div>
            <div className="text-2xl font-bold text-blue-700">{exitStrategy.marketReadiness}%</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-gray-600 mb-1">Exit Readiness</div>
            <div className="text-2xl font-bold text-green-700">{averageReadiness.toFixed(0)}%</div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Exit Vehicles</h4>
          <div className="flex flex-wrap gap-2">
            {exitStrategy.exitVehicles.map((vehicle: string, idx: number) => (
              <span
                key={idx}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
              >
                {vehicle}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Exit Scenarios */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          🎯 Exit Scenarios
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Compare different exit strategies and timing options
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {exitStrategy.scenarios.map((scenario: ExitScenario) => (
            <div
              key={scenario.id}
              onClick={() => onSelectScenario(scenario.id)}
              className={`rounded-lg border-2 p-5 cursor-pointer transition ${
                selectedScenario === scenario.id
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-1">{scenario.name}</h4>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${getProbabilityBadge(scenario.probability)}`}>
                    {scenario.probability.toUpperCase()} PROBABILITY
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 mb-4">{scenario.description}</p>
              
              <div className="space-y-2 text-sm mb-4">
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
                
                {scenario.type === 'sale' && scenario.salePrice && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sale Price:</span>
                    <span className="font-semibold text-gray-900">
                      ${(scenario.salePrice / 1000000).toFixed(1)}M
                    </span>
                  </div>
                )}
                
                {scenario.type === 'refinance' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cash Out:</span>
                    <span className="font-semibold text-green-600">
                      ${(scenario.cashOut! / 1000000).toFixed(1)}M
                    </span>
                  </div>
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
            </div>
          ))}
        </div>
      </div>

      {/* Exit Readiness Preparation (Performance Mode) */}
      {!isPipeline && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            📊 Exit Preparation Status
          </h3>
          
          <div className="space-y-4">
            {Object.entries(exitStrategy.preparationStatus).map(([key, value]: [string, any]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 capitalize">{key}</span>
                  <span className="text-sm font-semibold text-gray-900">{value}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-blue-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Broker Recommendations (Performance Mode) */}
      {!isPipeline && exitStrategy.recommendedBrokers && exitStrategy.recommendedBrokers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            🏆 Recommended Brokers
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Top brokers for multifamily exit based on track record and market expertise
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {exitStrategy.recommendedBrokers.map((broker: BrokerRecommendation) => (
              <div key={broker.id} className="rounded-lg border-2 border-gray-200 p-4 hover:border-blue-300 transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-gray-900">{broker.brokerName}</h4>
                    <div className="text-sm text-gray-600">{broker.firm}</div>
                    <div className="text-xs text-gray-500 mt-1">{broker.specialty}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl">{'⭐'.repeat(Math.floor(broker.rating))}</div>
                    <div className="text-xs text-gray-600">{broker.rating.toFixed(1)}/5.0</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded">
                  <div className="text-center">
                    <div className="text-sm font-bold text-gray-900">{broker.recentSales}</div>
                    <div className="text-xs text-gray-600">Sales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-gray-900">{broker.avgDaysOnMarket}</div>
                    <div className="text-xs text-gray-600">Days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-green-600">+{broker.avgPricePremium}%</div>
                    <div className="text-xs text-gray-600">Premium</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-semibold text-green-700 mb-1">✓ Strengths:</div>
                    <ul className="space-y-1">
                      {broker.pros.slice(0, 2).map((pro, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-start">
                          <span className="mr-1">•</span>
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

interface RiskAssessmentSectionProps {
  risks: RiskFactor[];
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
        Key risks and mitigation strategies across the investment lifecycle
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
          {' '}Moderate risk profile with comprehensive mitigation strategies in place. Regular monitoring and proactive management recommended throughout the investment lifecycle.
        </div>
      </div>
    </div>
  );
};

export default InvestmentStrategySection;
