/**
 * MarketSection - Usage Example
 * Copy this into your deal page to use the Market Tab
 */

import React from 'react';
import { MarketSection } from './MarketSection';
import { Deal } from '../../../types/deal';

// Example 1: Acquisition Mode (Pipeline Deal)
export function AcquisitionModeExample() {
  const pipelineDeal: Deal = {
    id: 'deal-001',
    name: 'Buckhead Tower Development',
    projectType: 'Multifamily',
    tier: 'A',
    status: 'pipeline', // 👈 This triggers Acquisition Mode
    budget: 45000000,
    boundary: null,
    acres: 2.5,
    propertyCount: 1,
    pendingTasks: 12,
    createdAt: '2024-01-15T00:00:00Z',
    address: '3350 Peachtree Road NE, Atlanta, GA 30326'
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Market Analysis - Acquisition Mode</h1>
      <MarketSection deal={pipelineDeal} />
    </div>
  );
}

// Example 2: Performance Mode (Owned Asset)
export function PerformanceModeExample() {
  const ownedDeal: Deal = {
    id: 'deal-002',
    name: 'Midtown Plaza',
    projectType: 'Multifamily',
    tier: 'A',
    status: 'owned', // 👈 This triggers Performance Mode
    budget: 38500000,
    boundary: null,
    acres: 1.8,
    propertyCount: 1,
    pendingTasks: 5,
    createdAt: '2022-08-15T00:00:00Z',
    actualCloseDate: '2022-08-15T00:00:00Z',
    address: '1080 Peachtree Street NE, Atlanta, GA 30309'
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Market Analysis - Performance Mode</h1>
      <MarketSection deal={ownedDeal} />
    </div>
  );
}

// Example 3: Dynamic Mode Switching
export function DynamicModeExample() {
  const [dealStatus, setDealStatus] = React.useState<'pipeline' | 'owned'>('pipeline');

  const deal: Deal = {
    id: 'deal-003',
    name: 'Sample Property',
    projectType: 'Multifamily',
    tier: 'B+',
    status: dealStatus, // 👈 Dynamic mode switching
    budget: 25000000,
    boundary: null,
    acres: 1.2,
    propertyCount: 1,
    pendingTasks: 8,
    createdAt: '2024-01-01T00:00:00Z',
    address: '123 Main Street, Atlanta, GA 30303'
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex gap-4">
        <h1 className="text-2xl font-bold flex-1">Market Analysis - Dynamic Mode</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDealStatus('pipeline')}
            className={`px-4 py-2 rounded font-medium ${
              dealStatus === 'pipeline'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Acquisition Mode
          </button>
          <button
            onClick={() => setDealStatus('owned')}
            className={`px-4 py-2 rounded font-medium ${
              dealStatus === 'owned'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Performance Mode
          </button>
        </div>
      </div>
      <MarketSection deal={deal} />
    </div>
  );
}

// Example 4: Integration into Deal Page (Typical Usage)
export function DealPageIntegration({ deal }: { deal: Deal }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Deal Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{deal.name}</h1>
        <p className="text-gray-600">{deal.address}</p>
      </div>

      {/* Tab Navigation (simplified) */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <button className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            Overview
          </button>
          <button className="px-3 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            Market
          </button>
          <button className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            Financials
          </button>
          <button className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            Team
          </button>
        </nav>
      </div>

      {/* Market Section */}
      <MarketSection deal={deal} />
    </div>
  );
}

/**
 * QUICK START GUIDE
 * 
 * 1. Import the component:
 *    import { MarketSection } from '@/components/deal/sections';
 * 
 * 2. Pass a deal object with status property:
 *    <MarketSection deal={deal} />
 * 
 * 3. Mode is determined automatically:
 *    - deal.status === 'pipeline' → Acquisition Mode
 *    - deal.status === 'owned' → Performance Mode
 * 
 * 4. That's it! The component handles everything else.
 * 
 * MINIMAL DEAL OBJECT REQUIRED:
 * {
 *   id: string,
 *   name: string,
 *   status: 'pipeline' | 'owned',
 *   // ... other Deal type properties
 * }
 */
