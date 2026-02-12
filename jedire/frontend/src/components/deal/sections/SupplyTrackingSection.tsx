import React from 'react';
import { Deal } from '../../../types/deal';

interface SupplyTrackingSectionProps {
  deal: Deal;
  isPremium?: boolean;
}

export const SupplyTrackingSection: React.FC<SupplyTrackingSectionProps> = ({ deal, isPremium }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-indigo-50 rounded-lg p-4">
          <div className="text-sm font-medium text-indigo-600 mb-1">Pipeline Units</div>
          <div className="text-2xl font-bold text-indigo-900">—</div>
        </div>
        <div className="bg-cyan-50 rounded-lg p-4">
          <div className="text-sm font-medium text-cyan-600 mb-1">Under Construction</div>
          <div className="text-2xl font-bold text-cyan-900">—</div>
        </div>
        <div className="bg-teal-50 rounded-lg p-4">
          <div className="text-sm font-medium text-teal-600 mb-1">Planned Projects</div>
          <div className="text-2xl font-bold text-teal-900">—</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-3">Supply Pipeline</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">New Construction Monitoring</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Permit Activity Tracking</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Delivery Timeline Forecast</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Impact on Existing Supply</span>
            <span className="text-sm font-medium text-gray-400">Coming Soon</span>
          </div>
        </div>
      </div>

      {!isPremium && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
          <p className="text-sm text-indigo-700">Upgrade to Pro for real-time supply pipeline monitoring and impact analysis</p>
        </div>
      )}
    </div>
  );
};
