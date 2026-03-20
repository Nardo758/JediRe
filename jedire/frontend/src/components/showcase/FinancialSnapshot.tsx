import React from 'react';
import type { FinancialSnapshot } from '../../types/showcase.types';

interface Props {
  financials: FinancialSnapshot;
}

export function FinancialSnapshotComponent({ financials }: Props) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const metrics = [
    { label: 'Purchase Price', value: formatCurrency(financials.purchasePrice), icon: '💰' },
    { label: 'Total Investment', value: formatCurrency(financials.totalInvestment), icon: '📊' },
    { label: 'Current NOI', value: formatCurrency(financials.currentNOI), icon: '💵' },
    { label: 'Projected NOI', value: formatCurrency(financials.projectedNOI), icon: '📈' },
    { label: 'Current Cap Rate', value: formatPercent(financials.currentCapRate), icon: '📉' },
    { label: 'Projected Cap Rate', value: formatPercent(financials.projectedCapRate), icon: '🎯' },
    { label: 'Cash-on-Cash', value: formatPercent(financials.currentCashOnCash), icon: '💸' },
    { label: 'IRR', value: formatPercent(financials.irr), icon: '📊' },
    { label: 'LTV', value: formatPercent(financials.ltv), icon: '🏦' },
    { label: 'DSCR', value: financials.dscr.toFixed(2), icon: '🔢' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map(metric => (
          <div key={metric.label} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{metric.icon}</span>
              <span className="text-xs text-gray-600">{metric.label}</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-3">Capital Structure</h4>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-sm text-blue-700 mb-1">Equity</div>
            <div className="text-xl font-bold text-blue-900">{formatCurrency(financials.equity)}</div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-blue-700 mb-1">Debt</div>
            <div className="text-xl font-bold text-blue-900">{formatCurrency(financials.debt)}</div>
          </div>
        </div>
        <div className="mt-3 h-3 bg-white rounded-full overflow-hidden flex">
          <div
            className="bg-blue-600"
            style={{ width: `${(financials.equity / financials.totalInvestment) * 100}%` }}
          />
          <div
            className="bg-blue-400"
            style={{ width: `${(financials.debt / financials.totalInvestment) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Recent Changes</h4>
        <div className="space-y-2">
          {financials.changes.slice(0, 5).map((change, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">{change.metric}</div>
                <div className="text-xs text-gray-500">{new Date(change.date).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  {formatCurrency(change.previousValue)} → {formatCurrency(change.newValue)}
                </div>
                <div className={`text-xs font-semibold ${getVarianceColor(change.variance)}`}>
                  {change.variance > 0 ? '+' : ''}{change.variance.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
