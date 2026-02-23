import { DollarSign, TrendingUp, Percent } from 'lucide-react';
import { CashFlowInsight } from '@/types';
import { formatCurrency, formatPercent } from '@/utils';

interface CashFlowPanelProps {
  cashFlow: CashFlowInsight;
}

export default function CashFlowPanel({ cashFlow }: CashFlowPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-green-600" />
        <h3 className="text-lg font-bold text-gray-900">Cash Flow Analysis</h3>
      </div>

      {/* NOI */}
      <div className="card bg-green-50 border-green-200">
        <div className="text-sm text-gray-600 mb-1">Net Operating Income (NOI)</div>
        <div className="text-3xl font-bold text-green-600">
          {formatCurrency(cashFlow.netOperatingIncome)}
          <span className="text-sm text-gray-600 ml-2">/year</span>
        </div>
        <div className="mt-2 pt-2 border-t border-green-200 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">Rent: </span>
            <span className="font-semibold">{formatCurrency(cashFlow.estimatedRent)}</span>
          </div>
          <div>
            <span className="text-gray-600">OpEx: </span>
            <span className="font-semibold">{formatCurrency(cashFlow.operatingExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <div className="flex items-center gap-1 text-gray-600 text-xs mb-1">
            <Percent className="w-3 h-3" />
            <span>Cap Rate</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatPercent(cashFlow.capRate)}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-1 text-gray-600 text-xs mb-1">
            <TrendingUp className="w-3 h-3" />
            <span>CoC Return</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatPercent(cashFlow.cashOnCashReturn)}
          </div>
        </div>

        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Break Even</div>
          <div className="text-xl font-bold text-gray-900">
            {formatPercent(cashFlow.breakEvenOccupancy)}
          </div>
        </div>
      </div>

      {/* Scenarios */}
      {cashFlow.scenarios && cashFlow.scenarios.length > 0 && (
        <div className="card bg-purple-50 border-purple-200">
          <h4 className="font-semibold text-purple-900 mb-3">Financing Scenarios</h4>
          <div className="space-y-3">
            {cashFlow.scenarios.map((scenario, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-purple-200">
                <div className="font-semibold text-gray-900 mb-2">{scenario.name}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Purchase: </span>
                    <span className="font-medium">{formatCurrency(scenario.purchasePrice)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Down: </span>
                    <span className="font-medium">{formatCurrency(scenario.downPayment)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Rate: </span>
                    <span className="font-medium">{formatPercent(scenario.interestRate)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Payment: </span>
                    <span className="font-medium">{formatCurrency(scenario.monthlyPayment)}/mo</span>
                  </div>
                  <div className="col-span-2 mt-1 pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Cash Flow: </span>
                    <span className={`font-bold ${scenario.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(scenario.monthlyCashFlow)}/mo
                    </span>
                    <span className="text-gray-600 ml-2">({formatPercent(scenario.annualReturn)} return)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Reasoning */}
      {cashFlow.reasoning && (
        <div className="card bg-gray-50">
          <h4 className="font-semibold text-gray-900 mb-2 text-sm">Investment Analysis</h4>
          <p className="text-sm text-gray-700 leading-relaxed">
            {cashFlow.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
