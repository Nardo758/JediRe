/**
 * Financial Section - Dual-Mode (Acquisition & Performance)
 * Comprehensive financial analysis with pro forma, projections, and sensitivity analysis
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionFinancialStats,
  acquisitionProForma,
  acquisitionReturnMetrics,
  acquisitionProjections,
  sensitivityAnalysis,
  waterfallDistribution,
  performanceFinancialStats,
  performanceActuals,
  performanceMetrics,
  varianceAnalysis,
  performanceProjections,
  quarterlyForecasts,
  QuickStat,
  IncomeStatementLine,
  ProjectionData,
  SensitivityScenario,
  WaterfallTier,
  VarianceItem
} from '../../../data/financialMockData';

interface FinancialSectionProps {
  deal: Deal;
}

export const FinancialSection: React.FC<FinancialSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'projections' | 'analysis'>('overview');

  // Select data based on mode
  const stats = isPipeline ? acquisitionFinancialStats : performanceFinancialStats;
  const incomeStatement = isPipeline ? acquisitionProForma : performanceActuals;
  const projections = isPipeline ? acquisitionProjections : performanceProjections;

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPipeline 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {isPipeline ? '🎯 Acquisition Analysis' : '🏢 Performance Tracking'}
          </div>
          {isOwned && (
            <div className="text-xs text-gray-500">
              Owned for {performanceMetrics.holdPeriod} years
            </div>
          )}
        </div>
        
        {/* Export/Actions */}
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            📊 Export Report
          </button>
          <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <QuickStatsGrid stats={stats} />

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {['overview', 'projections', 'analysis'].map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <OverviewTab 
          mode={mode}
          incomeStatement={incomeStatement}
          isPipeline={isPipeline}
        />
      )}

      {selectedTab === 'projections' && (
        <ProjectionsTab 
          projections={projections}
          isPipeline={isPipeline}
        />
      )}

      {selectedTab === 'analysis' && (
        <AnalysisTab 
          mode={mode}
          isPipeline={isPipeline}
        />
      )}

    </div>
  );
};

// ==================== QUICK STATS GRID ====================

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
      case 'number':
        return stat.value.toLocaleString();
      default:
        return stat.value.toString();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <div 
          key={index}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs font-medium">{stat.label}</span>
            <span className="text-2xl">{stat.icon}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatValue(stat)}
          </div>
          {stat.subtext && (
            <div className="text-xs text-gray-500">{stat.subtext}</div>
          )}
          {stat.trend && (
            <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${
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
  );
};

// ==================== OVERVIEW TAB ====================

interface OverviewTabProps {
  mode: 'acquisition' | 'performance';
  incomeStatement: IncomeStatementLine[];
  isPipeline: boolean;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ mode, incomeStatement, isPipeline }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Income Statement */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">
            {isPipeline ? 'Pro Forma Income Statement' : 'Actual Income Statement (TTM)'}
          </h3>
        </div>
        <div className="p-4">
          <IncomeStatementTable lines={incomeStatement} />
        </div>
      </div>

      {/* Return Metrics / Variance Analysis */}
      {isPipeline ? (
        <ReturnMetricsCard />
      ) : (
        <VarianceAnalysisCard />
      )}

    </div>
  );
};

interface IncomeStatementTableProps {
  lines: IncomeStatementLine[];
}

const IncomeStatementTable: React.FC<IncomeStatementTableProps> = ({ lines }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(value));
  };

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'noi':
        return 'font-bold text-green-700 bg-green-50 border-t-2 border-green-200';
      case 'subtotal':
        return 'font-semibold text-gray-900 bg-gray-50 border-t border-gray-200';
      case 'revenue':
        return 'text-gray-700';
      case 'expense':
        return 'text-gray-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="space-y-1">
      {lines.map((line, index) => (
        <div 
          key={index}
          className={`flex justify-between py-2 px-2 rounded text-sm ${getCategoryStyle(line.category)}`}
          style={{ paddingLeft: `${(line.indent || 0) * 16 + 8}px` }}
        >
          <span>{line.label}</span>
          <span className={line.value < 0 ? 'text-red-600' : ''}>
            {line.value < 0 ? '-' : ''}{formatCurrency(line.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const ReturnMetricsCard: React.FC = () => {
  const metrics = acquisitionReturnMetrics;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Return Metrics</h3>
      </div>
      <div className="p-4 space-y-4">
        
        {/* Purchase Summary */}
        <div className="pb-4 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-1">Purchase Price</div>
              <div className="font-semibold text-gray-900">{formatCurrency(metrics.purchasePrice)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Down Payment (30%)</div>
              <div className="font-semibold text-gray-900">{formatCurrency(metrics.downPayment)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Loan Amount</div>
              <div className="font-semibold text-gray-900">{formatCurrency(metrics.loanAmount)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Interest Rate</div>
              <div className="font-semibold text-gray-900">{metrics.interestRate}%</div>
            </div>
          </div>
        </div>

        {/* Key Returns */}
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">IRR (10-year)</span>
            <span className="text-xl font-bold text-blue-700">{metrics.irr}%</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Equity Multiple</span>
            <span className="text-xl font-bold text-green-700">{metrics.equityMultiple}x</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Cash-on-Cash (Y1)</span>
            <span className="text-xl font-bold text-purple-700">{metrics.cashOnCash}%</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Entry Cap Rate</span>
            <span className="text-xl font-bold text-orange-700">{metrics.entryCapRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const VarianceAnalysisCard: React.FC = () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(value));
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Budget vs Actual</h3>
        <span className="text-xs text-gray-500">Trailing 12 Months</span>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {varianceAnalysis.map((item, index) => (
            <div 
              key={index}
              className={`p-3 rounded-lg ${
                item.category === 'Net Operating Income' 
                  ? 'bg-blue-50 border border-blue-200' 
                  : 'bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{item.category}</span>
                <span className={`text-sm font-bold ${getVarianceColor(item.variance)}`}>
                  {item.variance > 0 ? '+' : ''}{formatCurrency(item.variance)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span>Budget: {formatCurrency(item.budget)}</span>
                <span>•</span>
                <span>Actual: {formatCurrency(item.actual)}</span>
                <span>•</span>
                <span className={getVarianceColor(item.variance)}>
                  {item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    item.variance >= 0 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Math.abs((item.actual / item.budget) * 100), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== PROJECTIONS TAB ====================

interface ProjectionsTabProps {
  projections: ProjectionData[];
  isPipeline: boolean;
}

const ProjectionsTab: React.FC<ProjectionsTabProps> = ({ projections, isPipeline }) => {
  return (
    <div className="space-y-6">
      
      {/* Projection Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectionChart 
          data={projections}
          dataKey="noi"
          title="NOI Projection"
          color="blue"
        />
        <ProjectionChart 
          data={projections}
          dataKey="cashFlow"
          title="Cash Flow Projection"
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectionChart 
          data={projections}
          dataKey="equityValue"
          title="Equity Growth"
          color="purple"
        />
        <ProjectionChart 
          data={projections}
          dataKey="occupancy"
          title="Occupancy Projection"
          color="orange"
          isPercentage
        />
      </div>

      {/* Projection Table */}
      <ProjectionTable projections={projections} />

    </div>
  );
};

interface ProjectionChartProps {
  data: ProjectionData[];
  dataKey: keyof ProjectionData;
  title: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  isPercentage?: boolean;
}

const ProjectionChart: React.FC<ProjectionChartProps> = ({ 
  data, 
  dataKey, 
  title, 
  color,
  isPercentage = false 
}) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600'
  };

  const maxValue = Math.max(...data.map(d => d[dataKey] as number));
  const minValue = Math.min(...data.map(d => d[dataKey] as number));
  const range = maxValue - minValue;

  const formatValue = (value: number) => {
    if (isPercentage) return `${value}%`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4">
        <div className="h-48 flex items-end justify-between gap-2">
          {data.map((item, index) => {
            const value = item[dataKey] as number;
            const heightPercent = ((value - minValue) / range) * 100;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs font-medium text-gray-700 mb-1">
                    {formatValue(value)}
                  </span>
                  <div 
                    className={`w-full bg-gradient-to-t ${colorClasses[color]} rounded-t transition-all hover:opacity-80`}
                    style={{ height: `${Math.max(heightPercent, 10)}%`, maxHeight: '180px' }}
                  />
                </div>
                <span className="text-xs text-gray-500">Y{item.year}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface ProjectionTableProps {
  projections: ProjectionData[];
}

const ProjectionTable: React.FC<ProjectionTableProps> = ({ projections }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">10-Year Financial Projections</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Year</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">NOI</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Cash Flow</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Equity Value</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((proj, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">Year {proj.year}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(proj.noi)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(proj.cashFlow)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(proj.equityValue)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{proj.occupancy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==================== ANALYSIS TAB ====================

interface AnalysisTabProps {
  mode: 'acquisition' | 'performance';
  isPipeline: boolean;
}

const AnalysisTab: React.FC<AnalysisTabProps> = ({ mode, isPipeline }) => {
  return (
    <div className="space-y-6">
      
      {isPipeline ? (
        <>
          {/* Sensitivity Analysis */}
          <SensitivityAnalysisCard />
          
          {/* Waterfall Distribution */}
          <WaterfallDistributionCard />
        </>
      ) : (
        <>
          {/* Performance vs Pro Forma */}
          <PerformanceComparisonCard />
          
          {/* Quarterly Forecasts */}
          <QuarterlyForecastCard />
        </>
      )}

    </div>
  );
};

const SensitivityAnalysisCard: React.FC = () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getIRRColor = (irr: number, baseIRR: number) => {
    if (irr >= baseIRR * 1.1) return 'bg-green-500 text-white';
    if (irr >= baseIRR * 0.95) return 'bg-blue-500 text-white';
    if (irr >= baseIRR * 0.8) return 'bg-yellow-500 text-white';
    return 'bg-red-500 text-white';
  };

  const baseIRR = sensitivityAnalysis[0].irrImpact;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Sensitivity Analysis</h3>
        <p className="text-xs text-gray-500 mt-1">Impact of key assumptions on IRR and NOI</p>
      </div>
      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Scenario</th>
                <th className="px-4 py-2 text-center font-semibold text-gray-700">Rent Δ</th>
                <th className="px-4 py-2 text-center font-semibold text-gray-700">Vacancy Δ</th>
                <th className="px-4 py-2 text-center font-semibold text-gray-700">Cap Rate Δ</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">IRR Impact</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">NOI Impact</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityAnalysis.map((scenario, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{scenario.label}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      scenario.rentChange > 0 ? 'bg-green-100 text-green-700' :
                      scenario.rentChange < 0 ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {scenario.rentChange > 0 ? '+' : ''}{scenario.rentChange}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      scenario.vacancyChange > 0 ? 'bg-red-100 text-red-700' :
                      scenario.vacancyChange < 0 ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {scenario.vacancyChange > 0 ? '+' : ''}{scenario.vacancyChange}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      scenario.capRateChange > 0 ? 'bg-red-100 text-red-700' :
                      scenario.capRateChange < 0 ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {scenario.capRateChange > 0 ? '+' : ''}{scenario.capRateChange} bps
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getIRRColor(scenario.irrImpact, baseIRR)}`}>
                      {scenario.irrImpact.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {formatCurrency(scenario.noiImpact)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const WaterfallDistributionCard: React.FC = () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const totalDistribution = waterfallDistribution.reduce((sum, tier) => sum + tier.distribution, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Waterfall Distribution</h3>
        <p className="text-xs text-gray-500 mt-1">Total Distribution: {formatCurrency(totalDistribution)}</p>
      </div>
      <div className="p-4 space-y-4">
        {waterfallDistribution.map((tier, index) => {
          const percentage = (tier.distribution / totalDistribution) * 100;
          
          return (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-900">{tier.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{tier.split}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(tier.distribution)}</div>
                  <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PerformanceComparisonCard: React.FC = () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const metrics = performanceMetrics;
  const comparison = [
    {
      metric: 'Purchase Price',
      proForma: metrics.purchasePrice,
      actual: metrics.purchasePrice,
      variance: 0
    },
    {
      metric: 'Current Value',
      proForma: 47000000,
      actual: metrics.currentValue,
      variance: metrics.unrealizedGain
    },
    {
      metric: 'IRR (Annualized)',
      proForma: 18.5,
      actual: metrics.currentIRR,
      variance: metrics.currentIRR - 18.5,
      isPercentage: true
    },
    {
      metric: 'Current Occupancy',
      proForma: 96,
      actual: metrics.currentOccupancy,
      variance: metrics.currentOccupancy - 96,
      isPercentage: true
    }
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Performance vs Pro Forma</h3>
      </div>
      <div className="p-4">
        <div className="space-y-4">
          {comparison.map((item, index) => (
            <div key={index} className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-900">{item.metric}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  item.variance > 0 ? 'bg-green-100 text-green-700' :
                  item.variance < 0 ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {item.variance > 0 ? '+' : ''}{item.isPercentage ? `${item.variance.toFixed(1)}%` : formatCurrency(item.variance)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Pro Forma</div>
                  <div className="font-semibold text-gray-900">
                    {item.isPercentage ? `${item.proForma}%` : formatCurrency(item.proForma)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Actual</div>
                  <div className="font-semibold text-gray-900">
                    {item.isPercentage ? `${item.actual}%` : formatCurrency(item.actual)}
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

const QuarterlyForecastCard: React.FC = () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">2024 Quarterly Forecast</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Quarter</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">NOI Actual</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">NOI Budget</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Variance</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {quarterlyForecasts.map((qtr, index) => {
              const variance = qtr.noiActual ? qtr.noiActual - qtr.noiBudget : 0;
              const variancePercent = qtr.noiActual ? ((variance / qtr.noiBudget) * 100) : 0;
              
              return (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{qtr.quarter}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {qtr.noiActual ? formatCurrency(qtr.noiActual) : <span className="text-gray-400">Forecast</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(qtr.noiBudget)}</td>
                  <td className="px-4 py-3 text-right">
                    {qtr.noiActual ? (
                      <span className={`font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance > 0 ? '+' : ''}{formatCurrency(variance)} ({variancePercent.toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      qtr.occupancy >= 95 ? 'bg-green-100 text-green-700' :
                      qtr.occupancy >= 90 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {qtr.occupancy}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FinancialSection;
