import React from 'react';
import { Deal } from '../../../types/deal';

interface MarketCompetitionSectionProps {
  deal: Deal;
  isPremium?: boolean;
}

export const MarketCompetitionSection: React.FC<MarketCompetitionSectionProps> = ({ deal, isPremium }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-sm font-medium text-orange-600 mb-1">Competing Properties</div>
          <div className="text-2xl font-bold text-orange-900">—</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-sm font-medium text-red-600 mb-1">Avg Competitor Rent</div>
          <div className="text-2xl font-bold text-red-900">—</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-sm font-medium text-yellow-600 mb-1">Market Position</div>
          <div className="text-2xl font-bold text-yellow-900">—</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-3">Competitive Landscape</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Comparable Properties</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Market Positioning Analysis</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Rent Comparison Matrix</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Amenity Gap Analysis</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
        </div>
      </div>

      {!isPremium && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <p className="text-sm text-orange-700">Upgrade to Pro for full competitive analysis with real-time market data</p>
        </div>
      )}
    </div>
  );
};
