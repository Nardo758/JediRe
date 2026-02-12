import React from 'react';
import { Deal } from '../../../types/deal';

interface DebtMarketSectionProps {
  deal: Deal;
  isPremium?: boolean;
}

export const DebtMarketSection: React.FC<DebtMarketSectionProps> = ({ deal, isPremium }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-lg p-4">
          <div className="text-sm font-medium text-emerald-600 mb-1">Current Rates</div>
          <div className="text-2xl font-bold text-emerald-900">—</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-600 mb-1">Lending Climate</div>
          <div className="text-2xl font-bold text-blue-900">—</div>
        </div>
        <div className="bg-violet-50 rounded-lg p-4">
          <div className="text-sm font-medium text-violet-600 mb-1">Financing Options</div>
          <div className="text-2xl font-bold text-violet-900">—</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-3">Debt Market Intelligence</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Interest Rate Trends</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Lender Comparison</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Loan Structure Options</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Refinance Analysis</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
        </div>
      </div>

      {!isPremium && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
          <p className="text-sm text-emerald-700">Upgrade to Pro for real-time debt market intelligence and lender matching</p>
        </div>
      )}
    </div>
  );
};
