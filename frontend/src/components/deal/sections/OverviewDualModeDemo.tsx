/**
 * Dual-Mode Overview Demo
 * Interactive demonstration of both acquisition and performance modes
 */

import React, { useState } from 'react';
import { OverviewSection } from './OverviewSection';
import { Deal } from '../../../types/deal';

export const OverviewDualModeDemo: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<'acquisition' | 'performance'>('acquisition');

  // Mock Pipeline Deal (Acquisition Mode)
  const pipelineDeal: Deal = {
    id: 'deal-001',
    name: 'Buckhead Tower Development',
    status: 'pipeline',
    projectType: 'Multifamily',
    tier: 'pro',
    budget: 45000000,
    acres: 2.5,
    propertyCount: 250,
    pendingTasks: 12,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-02-12T14:30:00Z',
    propertyAddress: '3350 Peachtree Road NE, Atlanta, GA 30326',
    stage: 'Due Diligence',
    description: 'Premium mixed-use development in Buckhead district',
    dealType: 'acquisition',
    targetUnits: 250,
    timelineStart: '2024-01-15',
    timelineEnd: '2025-07-15',
    userId: 'user-123'
  };

  // Mock Owned Deal (Performance Mode)
  const ownedDeal: Deal = {
    id: 'deal-002',
    name: 'Midtown Plaza',
    status: 'owned',
    projectType: 'Multifamily',
    tier: 'enterprise',
    budget: 38500000,
    acres: 1.8,
    propertyCount: 180,
    pendingTasks: 5,
    createdAt: '2022-08-15T09:00:00Z',
    updatedAt: '2024-02-12T11:20:00Z',
    actualCloseDate: '2022-08-15T09:00:00Z',
    propertyAddress: '1080 Peachtree Street NE, Atlanta, GA 30309',
    stage: 'Owned',
    description: 'Stabilized multifamily asset in Midtown Atlanta',
    dealType: 'acquisition',
    targetUnits: 180,
    userId: 'user-123'
  };

  const currentDeal = selectedMode === 'acquisition' ? pipelineDeal : ownedDeal;

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Demo Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Dual-Mode Overview Demo
              </h1>
              <p className="text-sm text-gray-600">
                Interactive demonstration of acquisition and performance modes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Mode:</span>
              <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setSelectedMode('acquisition')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    selectedMode === 'acquisition'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🎯 Acquisition
                </button>
                <button
                  onClick={() => setSelectedMode('performance')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    selectedMode === 'performance'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🏢 Performance
                </button>
              </div>
            </div>
          </div>

          {/* Current Deal Info */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentDeal.name}
              </h2>
              <p className="text-sm text-gray-600">
                {currentDeal.propertyAddress}
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {currentDeal.projectType}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Units:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {currentDeal.propertyCount}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${
                  currentDeal.status === 'owned'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {currentDeal.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Section Demo */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <OverviewSection deal={currentDeal} />
      </div>

      {/* Feature Comparison */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Mode Feature Comparison
          </h3>
          <div className="grid grid-cols-2 gap-6">
            
            {/* Acquisition Mode Features */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🎯</span>
                <h4 className="font-semibold text-gray-900">Acquisition Mode</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Target price and expected returns (IRR, Cap Rate)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Financing terms and deal structure</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Deal progress tracking (DD, Legal, Financing)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Actions: Run Analysis, Generate Report, Request Financing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Team: Lead Analyst, Financial Analyst, Broker, Legal</span>
                </li>
              </ul>
            </div>

            {/* Performance Mode Features */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🏢</span>
                <h4 className="font-semibold text-gray-900">Performance Mode</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Actual performance metrics (Occupancy, NOI, Cash Flow)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Days owned and acquisition date tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Performance vs Budget with color-coded status</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Actions: Performance Report, Refi Options, Market Analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Team: Property Manager, Asset Manager, Leasing, Facilities</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">
                How Mode Detection Works
              </h4>
              <p className="text-sm text-blue-800 mb-3">
                The Overview Section automatically detects the deal mode using the <code className="bg-blue-100 px-2 py-0.5 rounded">useDealMode</code> hook:
              </p>
              <div className="bg-white rounded border border-blue-200 p-3 font-mono text-xs text-gray-700">
                <div>const &#123; mode, isPipeline, isOwned &#125; = useDealMode(deal);</div>
                <div className="text-blue-600 mt-2">// Pipeline deal: status !== 'owned'</div>
                <div className="text-green-600">// Owned asset: status === 'owned'</div>
              </div>
              <p className="text-sm text-blue-800 mt-3">
                Simply change <code className="bg-blue-100 px-2 py-0.5 rounded">deal.status</code> to switch modes. The component handles the rest!
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default OverviewDualModeDemo;
