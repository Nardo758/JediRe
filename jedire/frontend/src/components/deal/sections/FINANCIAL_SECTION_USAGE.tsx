/**
 * Financial Section - Usage Examples
 * Demonstrates how to integrate the Financial Section in different contexts
 */

import React from 'react';
import { FinancialSection } from './FinancialSection';
import { Deal } from '../../../types/deal';

// ==================== EXAMPLE 1: Pipeline Deal (Acquisition Mode) ====================

export const AcquisitionModeExample: React.FC = () => {
  const pipelineDeal: Deal = {
    id: 'deal-001',
    name: 'Buckhead Tower Development',
    projectType: 'Multifamily',
    tier: 'premium',
    status: 'pipeline', // This triggers Acquisition mode
    budget: 45000000,
    boundary: null,
    acres: 5.2,
    propertyCount: 1,
    pendingTasks: 12,
    createdAt: new Date().toISOString(),
    address: '3350 Peachtree Road NE, Atlanta, GA 30326',
    propertyAddress: '3350 Peachtree Road NE, Atlanta, GA 30326',
    dealType: 'acquisition',
    dealValue: 45000000,
    stage: 'Due Diligence',
    priority: 'high',
    expectedCloseDate: '2024-09-15'
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Acquisition Mode Example</h2>
      <p className="text-gray-600 mb-6">
        This example shows the Financial Section in Acquisition mode for a pipeline deal.
        It displays pro forma projections, return metrics, and sensitivity analysis.
      </p>
      <FinancialSection deal={pipelineDeal} />
    </div>
  );
};

// ==================== EXAMPLE 2: Owned Asset (Performance Mode) ====================

export const PerformanceModeExample: React.FC = () => {
  const ownedDeal: Deal = {
    id: 'deal-002',
    name: 'Midtown Plaza',
    projectType: 'Multifamily',
    tier: 'premium',
    status: 'owned', // This triggers Performance mode
    budget: 38500000,
    boundary: null,
    acres: 4.8,
    propertyCount: 1,
    pendingTasks: 3,
    createdAt: '2022-08-15T00:00:00Z',
    actualCloseDate: '2022-08-15T00:00:00Z',
    address: '1080 Peachtree Street NE, Atlanta, GA 30309',
    propertyAddress: '1080 Peachtree Street NE, Atlanta, GA 30309',
    dealType: 'acquisition',
    dealValue: 38500000,
    stage: 'Post-Close',
    priority: 'medium'
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Performance Mode Example</h2>
      <p className="text-gray-600 mb-6">
        This example shows the Financial Section in Performance mode for an owned asset.
        It displays actual performance, variance analysis, and performance tracking.
      </p>
      <FinancialSection deal={ownedDeal} />
    </div>
  );
};

// ==================== EXAMPLE 3: In Deal Detail Page ====================

export const DealDetailPageExample: React.FC<{ dealId: string }> = ({ dealId }) => {
  // In a real app, you'd fetch the deal from an API or state management
  const [deal, setDeal] = React.useState<Deal | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate API call
    const fetchDeal = async () => {
      try {
        // Replace with actual API call
        // const response = await fetch(`/api/deals/${dealId}`);
        // const data = await response.json();
        
        // For demo purposes, use mock data
        const mockDeal: Deal = {
          id: dealId,
          name: 'Sample Deal',
          projectType: 'Multifamily',
          tier: 'premium',
          status: 'pipeline',
          budget: 45000000,
          boundary: null,
          acres: 5,
          propertyCount: 1,
          pendingTasks: 5,
          createdAt: new Date().toISOString()
        };
        
        setDeal(mockDeal);
      } catch (error) {
        console.error('Error fetching deal:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeal();
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading financial data...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Deal not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deal Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">{deal.name}</h1>
        <p className="text-gray-600 mt-1">{deal.address || deal.propertyAddress}</p>
      </div>

      {/* Tab Navigation (simplified) */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button className="border-b-2 border-blue-600 pb-4 px-1 text-sm font-medium text-blue-600">
            Financial
          </button>
          <button className="border-b-2 border-transparent pb-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700">
            Overview
          </button>
          <button className="border-b-2 border-transparent pb-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700">
            Market
          </button>
        </nav>
      </div>

      {/* Financial Section */}
      <FinancialSection deal={deal} />
    </div>
  );
};

// ==================== EXAMPLE 4: With Custom Actions ====================

export const CustomActionsExample: React.FC = () => {
  const deal: Deal = {
    id: 'deal-003',
    name: 'Custom Actions Example',
    projectType: 'Multifamily',
    tier: 'premium',
    status: 'pipeline',
    budget: 45000000,
    boundary: null,
    acres: 5,
    propertyCount: 1,
    pendingTasks: 5,
    createdAt: new Date().toISOString()
  };

  const handleExport = () => {
    console.log('Exporting financial report...');
    // Implement export logic
  };

  const handleRefresh = () => {
    console.log('Refreshing financial data...');
    // Implement refresh logic
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Financial Analysis</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            📊 Export Report
          </button>
          <button 
            onClick={handleRefresh}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>
      
      <FinancialSection deal={deal} />
    </div>
  );
};

// ==================== EXAMPLE 5: Mode Comparison Side-by-Side ====================

export const ModeComparisonExample: React.FC = () => {
  const pipelineDeal: Deal = {
    id: 'deal-pipeline',
    name: 'Pipeline Deal',
    projectType: 'Multifamily',
    tier: 'premium',
    status: 'pipeline',
    budget: 45000000,
    boundary: null,
    acres: 5,
    propertyCount: 1,
    pendingTasks: 5,
    createdAt: new Date().toISOString()
  };

  const ownedDeal: Deal = {
    ...pipelineDeal,
    id: 'deal-owned',
    name: 'Owned Asset',
    status: 'owned',
    actualCloseDate: '2022-08-15T00:00:00Z'
  };

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-3xl font-bold mb-6">Mode Comparison</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Acquisition Mode */}
        <div className="border border-gray-300 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-blue-600">Acquisition Mode</h3>
          <FinancialSection deal={pipelineDeal} />
        </div>

        {/* Performance Mode */}
        <div className="border border-gray-300 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-green-600">Performance Mode</h3>
          <FinancialSection deal={ownedDeal} />
        </div>
      </div>
    </div>
  );
};

// ==================== EXAMPLE 6: Responsive Layout ====================

export const ResponsiveExample: React.FC = () => {
  const deal: Deal = {
    id: 'deal-responsive',
    name: 'Responsive Example',
    projectType: 'Multifamily',
    tier: 'premium',
    status: 'pipeline',
    budget: 45000000,
    boundary: null,
    acres: 5,
    propertyCount: 1,
    pendingTasks: 5,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-friendly container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <FinancialSection deal={deal} />
      </div>
    </div>
  );
};

// ==================== EXAMPLE 7: Integration with State Management ====================

export const StateManagementExample: React.FC<{ dealId: string }> = ({ dealId }) => {
  // Example using React Context or Redux
  // const { deals } = useDealsContext();
  // const deal = deals.find(d => d.id === dealId);
  
  // For this example, we'll use local state
  const [deal] = React.useState<Deal>({
    id: dealId,
    name: 'State Management Example',
    projectType: 'Multifamily',
    tier: 'premium',
    status: 'pipeline',
    budget: 45000000,
    boundary: null,
    acres: 5,
    propertyCount: 1,
    pendingTasks: 5,
    createdAt: new Date().toISOString()
  });

  return (
    <div className="p-6">
      <FinancialSection deal={deal} />
    </div>
  );
};

// ==================== EXAMPLE 8: With Error Boundary ====================

class FinancialErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Financial Section Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Error Loading Financial Data
          </h3>
          <p className="text-red-600 text-sm">
            Something went wrong. Please refresh the page or contact support.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundaryExample: React.FC = () => {
  const deal: Deal = {
    id: 'deal-error',
    name: 'Error Boundary Example',
    projectType: 'Multifamily',
    tier: 'premium',
    status: 'pipeline',
    budget: 45000000,
    boundary: null,
    acres: 5,
    propertyCount: 1,
    pendingTasks: 5,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="p-6">
      <FinancialErrorBoundary>
        <FinancialSection deal={deal} />
      </FinancialErrorBoundary>
    </div>
  );
};
