/**
 * Debt Section Demo/Test Component
 * Use this to test the DebtSection in isolation
 */

import React, { useState } from 'react';
import { DebtSection } from './DebtSection';

// Mock deal data for testing
const mockAcquisitionDeal = {
  id: 'deal-001',
  name: 'Buckhead Tower Development',
  address: '3350 Peachtree Road NE, Atlanta, GA 30326',
  type: 'Multifamily',
  size: '250 units',
  targetPrice: 45000000,
  status: 'pipeline'
};

const mockPerformanceDeal = {
  id: 'deal-002',
  name: 'Midtown Plaza',
  address: '1080 Peachtree Street NE, Atlanta, GA 30309',
  type: 'Multifamily',
  size: '180 units',
  acquisitionPrice: 38500000,
  acquisitionDate: '2022-08-15',
  status: 'owned'
};

export const DebtSectionDemo: React.FC = () => {
  const [dealMode, setDealMode] = useState<'acquisition' | 'performance'>('acquisition');
  const [isPremium, setIsPremium] = useState(true);

  const currentDeal = dealMode === 'acquisition' ? mockAcquisitionDeal : mockPerformanceDeal;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Demo Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            💳 Debt Section Demo
          </h1>
          
          <div className="flex flex-wrap gap-4 items-center">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Deal Mode:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setDealMode('acquisition')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dealMode === 'acquisition'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  🎯 Acquisition
                </button>
                <button
                  onClick={() => setDealMode('performance')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dealMode === 'performance'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📈 Performance
                </button>
              </div>
            </div>

            {/* Premium Toggle */}
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm font-medium text-gray-700">Premium Access:</span>
              <button
                onClick={() => setIsPremium(!isPremium)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPremium ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPremium ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {isPremium ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Current Deal Info */}
            <div className="ml-auto bg-gray-100 px-4 py-2 rounded-lg">
              <div className="text-sm font-medium text-gray-900">{currentDeal.name}</div>
              <div className="text-xs text-gray-600">
                {currentDeal.size} | {currentDeal.type}
              </div>
            </div>
          </div>

          {/* Feature Checklist */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="font-semibold text-green-900 text-sm">✓ Quick Stats</div>
              <div className="text-xs text-green-700">5 key metrics</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="font-semibold text-green-900 text-sm">✓ Rate Environment</div>
              <div className="text-xs text-green-700">Live market data</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="font-semibold text-green-900 text-sm">✓ Lender Comparison</div>
              <div className="text-xs text-green-700">5 quotes</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="font-semibold text-green-900 text-sm">✓ Rate Trends</div>
              <div className="text-xs text-green-700">6 months history</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="font-semibold text-green-900 text-sm">✓ DSCR Calculator</div>
              <div className="text-xs text-green-700">Interactive</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="font-semibold text-green-900 text-sm">✓ Amortization</div>
              <div className="text-xs text-green-700">60 months</div>
            </div>
          </div>

          {/* Mode-Specific Features */}
          {dealMode === 'performance' && (
            <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="font-semibold text-blue-900 mb-2">
                📊 Performance Mode Features
              </div>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Current debt profile with covenant tracking</li>
                <li>✓ Prepayment penalty calculator</li>
                <li>✓ 3 refinance opportunities with savings analysis</li>
                <li>✓ Compliance dashboard</li>
              </ul>
            </div>
          )}
        </div>

        {/* Actual Component */}
        <div className="bg-white rounded-lg shadow-lg border-2 border-purple-200">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-t-lg">
            <h2 className="text-xl font-bold">💳 Debt & Financing Section</h2>
            <div className="text-sm text-purple-100 mt-1">
              Mode: {dealMode === 'acquisition' ? 'Acquisition' : 'Performance'} | 
              Premium: {isPremium ? 'Yes' : 'No'}
            </div>
          </div>
          
          <div className="p-6">
            <DebtSection
              deal={currentDeal}
              isPremium={isPremium}
              dealStatus={currentDeal.status as 'pipeline' | 'owned'}
            />
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-yellow-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            📝 Implementation Notes
          </h3>
          
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <strong>Files Created:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>DebtSection.tsx (27.9 KB)</li>
                <li>debtMockData.ts (12.4 KB)</li>
                <li>DEBT_SECTION_README.md (6.7 KB)</li>
              </ul>
            </div>
            
            <div>
              <strong>Features Implemented:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Dual-mode functionality (Acquisition vs Performance)</li>
                <li>5 quick stats with trends and status indicators</li>
                <li>Rate environment dashboard with alerts</li>
                <li>Lender comparison table with 5 quotes</li>
                <li>Rate trend chart (6 months)</li>
                <li>Interactive DSCR calculator</li>
                <li>Amortization schedule (60 months)</li>
                <li>Refinance opportunities (Performance mode)</li>
                <li>Current debt profile with covenants (Performance mode)</li>
                <li>Prepayment penalty tracker</li>
              </ul>
            </div>
            
            <div>
              <strong>Data Types:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>5 lender types: Agency, Bank, CMBS, Debt Fund, Life Company</li>
                <li>Rate environment: Fed Funds, 10Y Treasury, SOFR, Prime</li>
                <li>3 refinance opportunity types</li>
                <li>Covenant tracking (DSCR, Occupancy, Reserves)</li>
              </ul>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <strong className="text-green-900">✅ Status: COMPLETE</strong>
              <p className="text-green-800 mt-1">
                All deliverables implemented with full functionality and mock data.
                Ready for integration into JEDI RE platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebtSectionDemo;
