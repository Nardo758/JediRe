/**
 * ModuleSuggestionModal Test & Demo
 * 
 * This file demonstrates usage patterns and provides test scenarios
 */

import React, { useState } from 'react';
import { ModuleSuggestionModal } from '../ModuleSuggestionModal';
import { ModuleName } from '../../../utils/modules';

// Test scenarios
export const TEST_SCENARIOS = {
  // Scenario 1: Flipper bundle user viewing multifamily value-add deal
  flipperMultifamilyValueAdd: {
    dealId: 'deal-001',
    dealType: 'multifamily',
    dealStrategy: 'value-add',
    userBundle: 'flipper' as const,
    userModules: [] as ModuleName[],
    expectedIncluded: [
      'financial-modeling-pro',
      'strategy-arbitrage',
      'dd-checklist',
      'returns-calculator',
    ],
    expectedPaid: [
      'comp-analysis', // Not in Flipper
    ],
  },

  // Scenario 2: Developer bundle user viewing office development deal
  developerOfficeDevelopment: {
    dealId: 'deal-002',
    dealType: 'office',
    dealStrategy: 'development',
    userBundle: 'developer' as const,
    userModules: [] as ModuleName[],
    expectedIncluded: [
      'development-budget',
      'timeline',
      'entitlements',
      'zoning-analysis',
      'supply-pipeline',
      'environmental',
    ],
    expectedPaid: [],
  },

  // Scenario 3: Basic user with no bundle, some individual modules
  basicUserRetailValueAdd: {
    dealId: 'deal-003',
    dealType: 'retail',
    dealStrategy: 'value-add',
    userBundle: undefined,
    userModules: ['financial-modeling-pro', 'dd-checklist'] as ModuleName[],
    expectedIncluded: [
      'financial-modeling-pro',
      'dd-checklist',
    ],
    expectedPaid: [
      'strategy-arbitrage',
      'traffic-analysis',
      'market-snapshot',
    ],
  },

  // Scenario 4: Portfolio Manager (all modules)
  portfolioManagerLandDevelopment: {
    dealId: 'deal-004',
    dealType: 'land',
    dealStrategy: 'development',
    userBundle: 'portfolio-manager' as const,
    userModules: [] as ModuleName[],
    expectedIncluded: [
      'development-budget',
      'timeline',
      'entitlements',
      'zoning-analysis',
      'environmental',
      'supply-pipeline',
    ],
    expectedPaid: [], // All modules included in portfolio-manager
  },

  // Scenario 5: New user with no subscription
  noSubscriptionMultifamilyCore: {
    dealId: 'deal-005',
    dealType: 'multifamily',
    dealStrategy: 'core',
    userBundle: undefined,
    userModules: [] as ModuleName[],
    expectedIncluded: [],
    expectedPaid: [
      'financial-modeling-pro',
      'returns-calculator',
      'budget-vs-actual',
      'investor-reporting',
    ],
  },
};

/**
 * Demo Component - Interactive playground for testing modal
 */
export const ModuleSuggestionModalDemo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scenario, setScenario] = useState<keyof typeof TEST_SCENARIOS>('flipperMultifamilyValueAdd');

  const currentScenario = TEST_SCENARIOS[scenario];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Module Suggestion Modal Demo</h1>
      <p className="text-gray-600 mb-8">
        Test different user subscription scenarios and deal types.
      </p>

      {/* Scenario Selector */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Test Scenario:
        </label>
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value as any)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="flipperMultifamilyValueAdd">
            Flipper Bundle - Multifamily Value-Add
          </option>
          <option value="developerOfficeDevelopment">
            Developer Bundle - Office Development
          </option>
          <option value="basicUserRetailValueAdd">
            Basic User - Retail Value-Add (Some Modules)
          </option>
          <option value="portfolioManagerLandDevelopment">
            Portfolio Manager - Land Development (All Modules)
          </option>
          <option value="noSubscriptionMultifamilyCore">
            No Subscription - Multifamily Core
          </option>
        </select>
      </div>

      {/* Scenario Details */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Scenario Details:</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            <strong>Deal Type:</strong> {currentScenario.dealType}
          </p>
          <p>
            <strong>Deal Strategy:</strong> {currentScenario.dealStrategy}
          </p>
          <p>
            <strong>User Bundle:</strong> {currentScenario.userBundle || 'None'}
          </p>
          <p>
            <strong>Individual Modules:</strong>{' '}
            {currentScenario.userModules.length > 0
              ? currentScenario.userModules.join(', ')
              : 'None'}
          </p>
        </div>
      </div>

      {/* Expected Results */}
      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-semibold text-green-900 mb-2">Expected Results:</h3>
        <div className="text-sm text-green-800 space-y-2">
          <div>
            <strong>Included Modules ({currentScenario.expectedIncluded.length}):</strong>
            <ul className="list-disc list-inside ml-2 mt-1">
              {currentScenario.expectedIncluded.map((m) => (
                <li key={m}>{m}</li>
              ))}
              {currentScenario.expectedIncluded.length === 0 && (
                <li className="text-gray-500">None</li>
              )}
            </ul>
          </div>
          <div>
            <strong>Paid Modules ({currentScenario.expectedPaid.length}):</strong>
            <ul className="list-disc list-inside ml-2 mt-1">
              {currentScenario.expectedPaid.map((m) => (
                <li key={m}>{m}</li>
              ))}
              {currentScenario.expectedPaid.length === 0 && (
                <li className="text-gray-500">None</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Trigger Button */}
      <button
        onClick={() => {
          // Clear dismissed flag for this test
          localStorage.removeItem(`deal-${currentScenario.dealId}-suggestions-dismissed`);
          setIsOpen(true);
        }}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
      >
        🎯 Show Module Suggestions
      </button>

      {/* Reset Button */}
      <button
        onClick={() => {
          Object.values(TEST_SCENARIOS).forEach((s) => {
            localStorage.removeItem(`deal-${s.dealId}-suggestions-dismissed`);
          });
          alert('All dismissed states cleared!');
        }}
        className="w-full mt-2 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
      >
        Reset All Dismissed States
      </button>

      {/* Modal */}
      <ModuleSuggestionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        dealId={currentScenario.dealId}
        dealType={currentScenario.dealType}
        dealStrategy={currentScenario.dealStrategy}
        userBundle={currentScenario.userBundle}
        userModules={currentScenario.userModules}
      />

      {/* Testing Notes */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-yellow-900 mb-2">Testing Notes:</h3>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Click "Show Module Suggestions" to trigger the modal</li>
          <li>
            Modal shows once per deal (uses localStorage). Click "Reset" to clear.
          </li>
          <li>Green "Included" badges = User already has access</li>
          <li>Gray "Premium" modules = User needs to purchase</li>
          <li>Pre-selected checkboxes = Included modules ready to activate</li>
          <li>Try different scenarios to see how suggestions change</li>
        </ul>
      </div>
    </div>
  );
};

/**
 * Unit Test Helpers
 */

// Mock API response generator
export const mockModuleToggleResponse = (moduleSlug: string, dealId: string, isEnabled: boolean) => {
  return {
    success: true,
    data: {
      deal_id: dealId,
      module_slug: moduleSlug,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
    },
  };
};

// Mock user subscription
export const mockUserSubscription = (bundle?: string, modules: string[] = []) => {
  return {
    bundle,
    modules,
    expires_at: '2025-12-31T23:59:59Z',
  };
};

/**
 * Test Cases to Implement
 * 
 * [ ] Modal renders with correct suggestions for each scenario
 * [ ] Included modules show green badge
 * [ ] Paid modules show price and "Add Module" button
 * [ ] Pre-selects all included modules
 * [ ] Can toggle module selection
 * [ ] "Activate Selected" calls API for each selected module
 * [ ] "Skip" closes modal without activating
 * [ ] LocalStorage dismissal works correctly
 * [ ] Error handling displays errors
 * [ ] Loading state disables buttons
 * [ ] ESC key closes modal
 * [ ] Responsive on mobile
 */

export default ModuleSuggestionModalDemo;
