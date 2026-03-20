/**
 * Debt Section - Dual-Mode Debt/Financing Tab
 * Acquisition Mode: Financing options, lender quotes, debt structure
 * Performance Mode: Refi opportunities, rate monitoring, debt service tracking
 */

import React, { useState } from 'react';
import { ModuleToggle } from '../ModuleToggle';
import {
  acquisitionStats,
  acquisitionLenderQuotes,
  performanceStats,
  refinanceOpportunities,
  performanceLenderQuotes,
  currentDebtProfile,
  currentRateEnvironment,
  rateTrends,
  rateAlerts,
  marketInsights,
  sampleAmortizationSchedule,
  LenderQuote,
  QuickStat,
  RefinanceOpportunity,
  AmortizationScheduleRow
} from '../../../data/debtMockData';

interface DebtSectionProps {
  deal: any;
  isPremium?: boolean;
  dealStatus?: 'pipeline' | 'owned'; // Determines acquisition vs performance mode
}

export const DebtSection: React.FC<DebtSectionProps> = ({ 
  deal, 
  isPremium = false,
  dealStatus = 'pipeline'
}) => {
  const [mode, setMode] = useState<'basic' | 'enhanced'>('basic');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'lenders' | 'calculator' | 'schedule'>('overview');
  const [showAmortization, setShowAmortization] = useState(false);

  const isAcquisitionMode = dealStatus === 'pipeline';
  const stats = isAcquisitionMode ? acquisitionStats : performanceStats;
  const lenderQuotes = isAcquisitionMode ? acquisitionLenderQuotes : performanceLenderQuotes;

  // Helper function to format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Helper function to format percentage
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Render quick stats
  const renderQuickStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <div 
          key={index}
          className={`bg-white rounded-lg border-2 p-4 ${
            stat.status === 'good' ? 'border-green-200' :
            stat.status === 'warning' ? 'border-yellow-200' :
            stat.status === 'critical' ? 'border-red-200' :
            'border-gray-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-2xl">{stat.icon}</span>
            {stat.trend && (
              <span className={`text-xs px-2 py-1 rounded ${
                stat.trend.direction === 'up' ? 'bg-green-100 text-green-700' :
                stat.trend.direction === 'down' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {stat.trend.value}
              </span>
            )}
          </div>
          <div className="mt-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</div>
            <div className="text-2xl font-bold mt-1">
              {stat.format === 'currency' ? formatCurrency(Number(stat.value)) :
               stat.format === 'percentage' ? formatPercentage(Number(stat.value)) :
               stat.value}
            </div>
            {stat.subtext && (
              <div className="text-xs text-gray-500 mt-1">{stat.subtext}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Render rate environment
  const renderRateEnvironment = () => (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          📊 Current Rate Environment
        </h3>
        <span className="text-xs text-gray-500">
          Updated: {currentRateEnvironment.lastUpdated}
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase">Fed Funds</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {formatPercentage(currentRateEnvironment.fedFunds)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase">10Y Treasury</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {formatPercentage(currentRateEnvironment.treasury10Y)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase">SOFR</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {formatPercentage(currentRateEnvironment.sofr)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase">Prime Rate</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {formatPercentage(currentRateEnvironment.prime)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase">Typical Spread</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">
            {currentRateEnvironment.spread} bps
          </div>
        </div>
      </div>

      {/* Rate Alerts */}
      <div className="mt-4 space-y-2">
        {rateAlerts.map((alert) => (
          <div 
            key={alert.id}
            className={`p-3 rounded-lg text-sm ${
              alert.type === 'warning' ? 'bg-yellow-100 border border-yellow-300' :
              alert.type === 'positive' ? 'bg-green-100 border border-green-300' :
              'bg-blue-100 border border-blue-300'
            }`}
          >
            <div className="font-semibold">{alert.message}</div>
            <div className="text-xs mt-1 text-gray-600">
              💡 {alert.recommendation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render lender comparison table
  const renderLenderTable = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          🏦 {isAcquisitionMode ? 'Lender Quotes Comparison' : 'Refinance Options'}
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Lender</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rate</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">LTV</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Loan Amount</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Monthly Payment</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">DSCR</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Term</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lenderQuotes.map((quote) => (
              <tr 
                key={quote.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-4">
                  <div className="font-semibold text-gray-900">{quote.lenderName}</div>
                  <div className="text-xs text-gray-500">{quote.recourse}</div>
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    quote.lenderType === 'Agency' ? 'bg-blue-100 text-blue-700' :
                    quote.lenderType === 'Bank' ? 'bg-green-100 text-green-700' :
                    quote.lenderType === 'CMBS' ? 'bg-purple-100 text-purple-700' :
                    quote.lenderType === 'Life Company' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {quote.lenderType}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="font-semibold text-gray-900">
                    {formatPercentage(quote.interestRate)}
                  </div>
                </td>
                <td className="px-4 py-4 text-right text-gray-700">
                  {quote.ltv}%
                </td>
                <td className="px-4 py-4 text-right text-gray-700">
                  {formatCurrency(quote.loanAmount)}
                </td>
                <td className="px-4 py-4 text-right text-gray-700">
                  {formatCurrency(quote.monthlyPayment)}
                </td>
                <td className="px-4 py-4 text-right">
                  <span className={`font-semibold ${
                    quote.dscr >= 1.4 ? 'text-green-600' :
                    quote.dscr >= 1.25 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {quote.dscr.toFixed(2)}x
                  </span>
                </td>
                <td className="px-4 py-4 text-right text-gray-700">
                  {quote.term}yr / {quote.amortization}yr
                </td>
                <td className="px-4 py-4 text-center">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full font-bold text-sm ${
                    quote.score >= 90 ? 'bg-green-100 text-green-700' :
                    quote.score >= 80 ? 'bg-blue-100 text-blue-700' :
                    quote.score >= 70 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {quote.score}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lender details section */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          💡 Click on any lender to view detailed terms, fees, and special conditions
        </div>
      </div>
    </div>
  );

  // Render refinance opportunities (Performance Mode)
  const renderRefinanceOpportunities = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        💡 Refinance Opportunities
      </h3>
      
      <div className="space-y-4">
        {refinanceOpportunities.map((opp) => (
          <div 
            key={opp.id}
            className={`p-4 rounded-lg border-2 ${
              opp.urgency === 'high' ? 'border-red-300 bg-red-50' :
              opp.urgency === 'medium' ? 'border-yellow-300 bg-yellow-50' :
              'border-blue-300 bg-blue-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{opp.icon}</span>
                <div>
                  <h4 className="font-semibold text-gray-900">{opp.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{opp.description}</p>
                </div>
              </div>
              <div className="text-right">
                {opp.potentialSavings > 0 && (
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(opp.potentialSavings)}
                  </div>
                )}
                <span className={`text-xs px-2 py-1 rounded-full uppercase font-semibold ${
                  opp.urgency === 'high' ? 'bg-red-200 text-red-700' :
                  opp.urgency === 'medium' ? 'bg-yellow-200 text-yellow-700' :
                  'bg-blue-200 text-blue-700'
                }`}>
                  {opp.urgency}
                </span>
              </div>
            </div>
            <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              {opp.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // Render current debt profile (Performance Mode)
  const renderCurrentDebtProfile = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        📋 Current Debt Profile
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase">Lender</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {currentDebtProfile.lender}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Loan Type</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {currentDebtProfile.loanType}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Original Amount</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {formatCurrency(currentDebtProfile.originalAmount)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Current Balance</div>
          <div className="text-lg font-semibold text-green-600 mt-1">
            {formatCurrency(currentDebtProfile.currentBalance)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Interest Rate</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {formatPercentage(currentDebtProfile.interestRate)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Monthly Payment</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {formatCurrency(currentDebtProfile.monthlyPayment)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Origination Date</div>
          <div className="text-sm text-gray-700 mt-1">
            {currentDebtProfile.originationDate}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Maturity Date</div>
          <div className="text-sm text-gray-700 mt-1">
            {currentDebtProfile.maturityDate}
          </div>
        </div>
      </div>

      {/* Prepayment Penalty */}
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Prepayment Penalty: {currentDebtProfile.prepaymentPenalty}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Current penalty if refinanced today
            </div>
          </div>
          <div className="text-xl font-bold text-orange-600">
            {formatCurrency(currentDebtProfile.prepaymentPenaltyAmount)}
          </div>
        </div>
      </div>

      {/* Covenants */}
      <div className="mt-4">
        <div className="text-sm font-semibold text-gray-900 mb-3">Loan Covenants</div>
        <div className="space-y-2">
          {currentDebtProfile.covenants.map((covenant, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <div className="text-sm font-medium text-gray-900">{covenant.type}</div>
                <div className="text-xs text-gray-600">{covenant.requirement}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {typeof covenant.current === 'number' ? 
                      (covenant.type === 'Reserves' ? formatCurrency(covenant.current) : 
                       covenant.current) : 
                      covenant.current}
                  </div>
                  <div className="text-xs text-gray-500">Current</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  covenant.status === 'compliant' ? 
                    'bg-green-100 text-green-700' : 
                    'bg-red-100 text-red-700'
                }`}>
                  {covenant.status === 'compliant' ? '✓ Compliant' : '✗ Non-Compliant'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render rate trend chart (simplified visualization)
  const renderRateTrendChart = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        📈 Rate Trends (Last 6 Months)
      </h3>
      
      <div className="space-y-3">
        {rateTrends.map((trend, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className="w-20 text-sm text-gray-600 font-medium">
              {trend.date}
            </div>
            <div className="flex-1 grid grid-cols-4 gap-2">
              <div>
                <div className="text-xs text-gray-500">Treasury</div>
                <div className="text-sm font-semibold text-purple-600">
                  {formatPercentage(trend.treasury10Y)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">SOFR</div>
                <div className="text-sm font-semibold text-indigo-600">
                  {formatPercentage(trend.sofr)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">CMBS</div>
                <div className="text-sm font-semibold text-orange-600">
                  {formatPercentage(trend.cmbs)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Agency</div>
                <div className="text-sm font-semibold text-blue-600">
                  {formatPercentage(trend.agency)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm font-semibold text-gray-900">Market Insight</div>
        <div className="text-sm text-gray-700 mt-2">
          <strong>Sentiment:</strong> {marketInsights.sentiment} | 
          <strong className="ml-2">Environment:</strong> {marketInsights.lendingEnvironment}
        </div>
        <div className="text-sm text-gray-700 mt-2">
          💡 <strong>Recommendation:</strong> {marketInsights.recommendation}
        </div>
      </div>
    </div>
  );

  // Render amortization schedule
  const renderAmortizationSchedule = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          📊 Amortization Schedule (First 60 Months)
        </h3>
        <button
          onClick={() => setShowAmortization(!showAmortization)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showAmortization ? 'Hide' : 'Show'} Schedule
        </button>
      </div>
      
      {showAmortization && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Month</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Principal</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Interest</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sampleAmortizationSchedule.map((row) => (
                <tr key={row.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{row.month}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatCurrency(row.payment)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                    {formatCurrency(row.principal)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-red-600">
                    {formatCurrency(row.interest)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 font-semibold">
                    {formatCurrency(row.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Render DSCR Calculator
  const renderDSCRCalculator = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        🧮 DSCR Calculator
      </h3>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Net Operating Income (NOI)
            </label>
            <input 
              type="text"
              defaultValue="$3,300,000"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Annual Debt Service
            </label>
            <input 
              type="text"
              defaultValue="$2,326,296"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-gray-500 uppercase mb-2">Debt Service Coverage Ratio</div>
            <div className={`text-6xl font-bold ${
              1.42 >= 1.4 ? 'text-green-600' :
              1.42 >= 1.25 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              1.42x
            </div>
            <div className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
              ✓ Above 1.25x Minimum
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm text-gray-700">
          <strong>Formula:</strong> DSCR = Net Operating Income / Annual Debt Service
        </div>
        <div className="text-sm text-gray-700 mt-2">
          <strong>Interpretation:</strong> 1.42x means the property generates $1.42 of NOI for every $1.00 of debt service.
          Most lenders require a minimum of 1.25x DSCR.
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-center">
        <ModuleToggle
          mode={mode}
          onModeChange={setMode}
          isPremium={isPremium}
        />
      </div>

      {/* Quick Stats */}
      {renderQuickStats()}

      {/* Rate Environment */}
      {renderRateEnvironment()}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        {['overview', 'lenders', 'calculator', 'schedule'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'lenders' && '🏦 Lenders'}
            {tab === 'calculator' && '🧮 Calculator'}
            {tab === 'schedule' && '📅 Schedule'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          {!isAcquisitionMode && renderCurrentDebtProfile()}
          {!isAcquisitionMode && renderRefinanceOpportunities()}
          {renderRateTrendChart()}
        </div>
      )}

      {selectedTab === 'lenders' && (
        <div className="space-y-6">
          {renderLenderTable()}
        </div>
      )}

      {selectedTab === 'calculator' && (
        <div className="space-y-6">
          {renderDSCRCalculator()}
        </div>
      )}

      {selectedTab === 'schedule' && (
        <div className="space-y-6">
          {renderAmortizationSchedule()}
        </div>
      )}

      {/* Premium Upsell for Basic Mode */}
      {mode === 'basic' && !isPremium && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">✨</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Unlock Enhanced Debt Analysis
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Get access to advanced features including:
              </p>
              <ul className="text-sm text-gray-700 space-y-1 mb-4">
                <li>• Real-time rate monitoring and alerts</li>
                <li>• Advanced debt structure optimization</li>
                <li>• Custom amortization scenarios</li>
                <li>• Automated refinance opportunity tracking</li>
                <li>• Integration with lender APIs for instant quotes</li>
              </ul>
              <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium">
                Upgrade to Premium
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtSection;
