/**
 * Supply Section - Integration Example
 * Shows how to integrate SupplySection into deal page
 */

import React from 'react';
import { Deal } from '../../../types/deal';
import { DealSection } from '../DealSection';
import { SupplySection } from './SupplySection';

// ==================== EXAMPLE 1: Basic Usage in Deal Page ====================

export const DealPageWithSupplyExample: React.FC<{ deal: Deal }> = ({ deal }) => {
  return (
    <div className="space-y-4">
      {/* Other sections... */}
      
      <DealSection
        id="supply"
        icon="🏗️"
        title="Supply Pipeline"
        defaultExpanded={true}
      >
        <SupplySection deal={deal} />
      </DealSection>
      
      {/* Other sections... */}
    </div>
  );
};

// ==================== EXAMPLE 2: With Tab Navigation ====================

export const DealTabsWithSupplyExample: React.FC<{ deal: Deal }> = ({ deal }) => {
  const [activeTab, setActiveTab] = React.useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'financial', label: 'Financial', icon: '💰' },
    { id: 'market', label: 'Market', icon: '📊' },
    { id: 'supply', label: 'Supply', icon: '🏗️' },
    { id: 'debt', label: 'Debt', icon: '🏦' }
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[#1e2a3d] mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-[#9EA8B4] hover:text-[#E8E6E1]'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'supply' && <SupplySection deal={deal} />}
        {/* Other tab content... */}
      </div>
    </div>
  );
};

// ==================== EXAMPLE 3: With Loading State ====================

export const SupplyWithLoadingExample: React.FC<{ deal: Deal }> = ({ deal }) => {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate loading real data
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-[#9EA8B4]">Loading pipeline data...</p>
        </div>
      </div>
    );
  }

  return <SupplySection deal={deal} />;
};

// ==================== EXAMPLE 4: Deal Page with All Sections ====================

export const CompleteDealPageExample: React.FC<{ deal: Deal }> = ({ deal }) => {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      
      {/* Deal Header */}
      <div className="bg-[#0F1319] rounded-lg shadow p-6 mb-6">
        <h1 className="text-3xl font-bold text-[#E8E6E1] mb-2">{deal.name}</h1>
        <p className="text-[#9EA8B4]">{deal.address || deal.propertyAddress}</p>
        <div className="flex gap-4 mt-4">
          <span className="px-3 py-1 bg-[#0d1e3d] text-blue-400 rounded-full text-sm font-medium">
            {deal.dealType || deal.projectType}
          </span>
          <span className="px-3 py-1 bg-[#131920] text-[#9EA8B4] rounded-full text-sm font-medium">
            {deal.status}
          </span>
        </div>
      </div>

      {/* Overview Section */}
      <DealSection
        id="overview"
        icon="📋"
        title="Overview"
        defaultExpanded={true}
      >
        {/* OverviewSection component */}
      </DealSection>

      {/* Financial Section */}
      <DealSection
        id="financial"
        icon="💰"
        title="Financial Analysis"
        defaultExpanded={false}
      >
        {/* FinancialSection component */}
      </DealSection>

      {/* Market Section */}
      <DealSection
        id="market"
        icon="📊"
        title="Market Analysis"
        defaultExpanded={false}
      >
        {/* MarketSection component */}
      </DealSection>

      {/* Supply Section - The Focus of This Example */}
      <DealSection
        id="supply"
        icon="🏗️"
        title="Supply Pipeline"
        defaultExpanded={true}
      >
        <SupplySection deal={deal} />
      </DealSection>

      {/* Competition Section */}
      <DealSection
        id="competition"
        icon="🎯"
        title="Competition"
        defaultExpanded={false}
      >
        {/* CompetitionSection component */}
      </DealSection>

      {/* Debt & Financing Section */}
      <DealSection
        id="debt"
        icon="🏦"
        title="Debt & Financing"
        defaultExpanded={false}
      >
        {/* DebtSection component */}
      </DealSection>

      {/* Strategy Section */}
      <DealSection
        id="strategy"
        icon="🎲"
        title="Strategy & Scenarios"
        defaultExpanded={false}
      >
        {/* StrategySection component */}
      </DealSection>

      {/* Due Diligence Section */}
      <DealSection
        id="due-diligence"
        icon="📋"
        title="Due Diligence"
        defaultExpanded={false}
      >
        {/* DueDiligenceSection component */}
      </DealSection>
    </div>
  );
};

// ==================== EXAMPLE 5: Mobile-Responsive Layout ====================

export const MobileSupplyExample: React.FC<{ deal: Deal }> = ({ deal }) => {
  return (
    <div className="min-h-screen bg-[#0F1319]">
      {/* Mobile Header */}
      <div className="bg-[#0F1319] border-b border-[#1e2a3d] p-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#E8E6E1]">{deal.name}</h1>
        <p className="text-sm text-[#9EA8B4]">Supply Pipeline Analysis</p>
      </div>

      {/* Supply Section (mobile-optimized) */}
      <div className="p-4">
        <SupplySection deal={deal} />
      </div>
    </div>
  );
};

// ==================== EXAMPLE 6: Mock Deal Data for Testing ====================

export const mockAcquisitionDeal: Deal = {
  id: 'deal-acq-001',
  name: 'Buckhead Tower Development',
  address: '3350 Peachtree Road NE, Atlanta, GA 30326',
  projectType: 'Multifamily',
  tier: 'A',
  status: 'pipeline', // Triggers Acquisition Mode
  budget: 45000000,
  boundary: null,
  acres: 2.5,
  propertyCount: 1,
  pendingTasks: 8,
  createdAt: '2024-01-15T00:00:00Z',
  dealValue: 45000000,
  dealType: 'Acquisition',
  targetUnits: 250,
  userId: 'user-001'
};

export const mockPerformanceDeal: Deal = {
  id: 'deal-perf-001',
  name: 'Midtown Plaza',
  address: '1080 Peachtree Street NE, Atlanta, GA 30309',
  projectType: 'Multifamily',
  tier: 'A',
  status: 'owned', // Triggers Performance Mode
  budget: 38500000,
  boundary: null,
  acres: 1.8,
  propertyCount: 1,
  pendingTasks: 3,
  createdAt: '2022-08-15T00:00:00Z',
  actualCloseDate: '2022-08-15T00:00:00Z',
  dealValue: 38500000,
  dealType: 'Acquisition',
  targetUnits: 180,
  userId: 'user-001'
};

// ==================== EXAMPLE 7: Testing Component in Isolation ====================

export const SupplyTestWrapper: React.FC = () => {
  const [mode, setMode] = React.useState<'acquisition' | 'performance'>('acquisition');

  const deal = mode === 'acquisition' ? mockAcquisitionDeal : mockPerformanceDeal;

  return (
    <div className="p-6">
      {/* Mode Toggle for Testing */}
      <div className="bg-[#1a1200] border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-[#E8E6E1] mb-2">🧪 Testing Mode</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('acquisition')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'acquisition'
                ? 'bg-blue-600 text-white'
                : 'bg-[#1e2a3d] text-[#9EA8B4] hover:bg-gray-300'
            }`}
          >
            Acquisition Mode
          </button>
          <button
            onClick={() => setMode('performance')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'performance'
                ? 'bg-purple-600 text-white'
                : 'bg-[#1e2a3d] text-[#9EA8B4] hover:bg-gray-300'
            }`}
          >
            Performance Mode
          </button>
        </div>
        <p className="text-sm text-[#9EA8B4] mt-2">
          Current Deal Status: <strong>{deal.status}</strong>
        </p>
      </div>

      {/* Supply Section */}
      <SupplySection deal={deal} />
    </div>
  );
};

// ==================== HOW TO USE THESE EXAMPLES ====================

/**
 * 1. BASIC INTEGRATION:
 *    - Import { SupplySection } from './sections'
 *    - Pass a Deal object: <SupplySection deal={deal} />
 *    - Component automatically detects mode from deal.status
 * 
 * 2. IN PRODUCTION:
 *    - Replace mock data with real API calls
 *    - Add error handling and loading states
 *    - Implement data refresh mechanisms
 * 
 * 3. TESTING:
 *    - Use mockAcquisitionDeal for acquisition mode testing
 *    - Use mockPerformanceDeal for performance mode testing
 *    - Use SupplyTestWrapper for interactive testing
 * 
 * 4. CUSTOMIZATION:
 *    - Modify supplyMockData.ts for different scenarios
 *    - Adjust filters and thresholds in SupplySection.tsx
 *    - Update color schemes in Tailwind classes
 */
