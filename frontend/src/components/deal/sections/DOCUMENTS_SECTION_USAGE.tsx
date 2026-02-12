/**
 * Documents Section - Usage Examples
 * Shows how to integrate DocumentsSection into your deal page
 */

import React from 'react';
import { DealSection } from '../../DealSection';
import { DocumentsSection } from './DocumentsSection';
import { Deal } from '../../../types/deal';

// ==================== BASIC USAGE ====================

/**
 * Example 1: Basic Integration in Deal Page
 */
export const BasicDocumentsExample: React.FC = () => {
  const deal: Deal = {
    id: 'deal-001',
    name: 'Buckhead Tower Development',
    status: 'pipeline', // Will show Acquisition Mode
    address: '3350 Peachtree Road NE, Atlanta, GA 30326',
    createdAt: '2024-01-15T00:00:00Z'
  } as Deal;

  return (
    <DealSection
      id="documents"
      icon="📄"
      title="Documents"
      defaultExpanded={false}
    >
      <DocumentsSection deal={deal} />
    </DealSection>
  );
};

// ==================== ACQUISITION MODE ====================

/**
 * Example 2: Acquisition Mode (Pipeline Deal)
 * Automatically shows due diligence docs, contracts, financial reports
 */
export const AcquisitionModeExample: React.FC = () => {
  const pipelineDeal: Deal = {
    id: 'deal-002',
    name: 'Downtown Office Complex',
    status: 'pipeline', // ← Key: Pipeline status triggers Acquisition Mode
    address: '100 Peachtree Street, Atlanta, GA',
    type: 'Office',
    targetPrice: 85000000,
    createdAt: '2024-02-01T00:00:00Z'
  } as Deal;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Acquisition Deal Page</h2>
      
      {/* Other sections... */}
      
      <DealSection
        id="documents"
        icon="📄"
        title="Documents"
        defaultExpanded={true} // Start expanded for active deals
      >
        <DocumentsSection deal={pipelineDeal} />
      </DealSection>
      
      {/* More sections... */}
    </div>
  );
};

// ==================== PERFORMANCE MODE ====================

/**
 * Example 3: Performance Mode (Owned Asset)
 * Automatically shows operational docs, leases, maintenance records
 */
export const PerformanceModeExample: React.FC = () => {
  const ownedDeal: Deal = {
    id: 'deal-003',
    name: 'Midtown Plaza',
    status: 'owned', // ← Key: Owned status triggers Performance Mode
    address: '1080 Peachtree Street NE, Atlanta, GA',
    type: 'Multifamily',
    acquisitionPrice: 38500000,
    actualCloseDate: '2022-08-15T00:00:00Z',
    createdAt: '2022-08-15T00:00:00Z'
  } as Deal;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Asset Performance Page</h2>
      
      {/* Other sections... */}
      
      <DealSection
        id="documents"
        icon="📋"
        title="Property Documents"
        defaultExpanded={false}
      >
        <DocumentsSection deal={ownedDeal} />
      </DealSection>
      
      {/* More sections... */}
    </div>
  );
};

// ==================== FULL DEAL PAGE INTEGRATION ====================

/**
 * Example 4: Complete Deal Page with Multiple Sections
 * Shows Documents section in context with other deal sections
 */
export const FullDealPageExample: React.FC<{ dealId: string }> = ({ dealId }) => {
  // In real app, fetch deal from API/state
  const deal: Deal = {
    id: dealId,
    name: 'Sample Property',
    status: 'pipeline',
    address: '123 Main St, Atlanta, GA',
    createdAt: new Date().toISOString()
  } as Deal;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      
      {/* Deal Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold">{deal.name}</h1>
        <p className="text-gray-600">{deal.address}</p>
      </div>

      {/* Overview Section */}
      <DealSection
        id="overview"
        icon="🏢"
        title="Overview"
        defaultExpanded={true}
      >
        {/* OverviewSection component */}
        <div className="p-4 text-gray-600">Overview content...</div>
      </DealSection>

      {/* Financial Section */}
      <DealSection
        id="financial"
        icon="💰"
        title="Financial Analysis"
        defaultExpanded={true}
      >
        {/* FinancialSection component */}
        <div className="p-4 text-gray-600">Financial content...</div>
      </DealSection>

      {/* Documents Section - Our New Component! */}
      <DealSection
        id="documents"
        icon="📄"
        title="Documents"
        defaultExpanded={false}
      >
        <DocumentsSection deal={deal} />
      </DealSection>

      {/* Due Diligence Section */}
      <DealSection
        id="due-diligence"
        icon="🔍"
        title="Due Diligence"
        defaultExpanded={false}
      >
        {/* DueDiligenceSection component */}
        <div className="p-4 text-gray-600">Due diligence content...</div>
      </DealSection>

      {/* Team Section */}
      <DealSection
        id="team"
        icon="👥"
        title="Team"
        defaultExpanded={false}
      >
        {/* TeamSection component */}
        <div className="p-4 text-gray-600">Team content...</div>
      </DealSection>

    </div>
  );
};

// ==================== CUSTOM STYLING ====================

/**
 * Example 5: Custom Wrapper with Additional Context
 */
export const CustomStyledExample: React.FC = () => {
  const deal: Deal = {
    id: 'deal-004',
    name: 'Premium Office Tower',
    status: 'pipeline',
    address: '500 W Peachtree St, Atlanta, GA',
    createdAt: '2024-02-10T00:00:00Z'
  } as Deal;

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Custom Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {deal.name}
          </h1>
          <p className="text-lg text-gray-600">Document Center</p>
        </div>

        {/* Documents Section with Custom Styling */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-xl p-8">
          <DocumentsSection deal={deal} />
        </div>

        {/* Additional Context Below */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Upload all due diligence documents before the 
            site visit on March 1st.
          </p>
        </div>

      </div>
    </div>
  );
};

// ==================== CONDITIONAL RENDERING ====================

/**
 * Example 6: Conditional Features Based on Deal Status
 */
export const ConditionalFeaturesExample: React.FC = () => {
  const deal: Deal = {
    id: 'deal-005',
    name: 'Retail Shopping Center',
    status: 'pipeline',
    address: '200 Mall Blvd, Atlanta, GA',
    createdAt: '2024-02-05T00:00:00Z'
  } as Deal;

  const isPipeline = deal.status === 'pipeline';
  const isOwned = deal.status === 'owned';

  return (
    <div className="space-y-6">
      
      {/* Contextual Banner */}
      {isPipeline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Due Diligence Active:</strong> Please ensure all required 
            documents are uploaded before the contingency period ends.
          </p>
        </div>
      )}

      {isOwned && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            ✅ <strong>Asset Owned:</strong> Access operational documents, leases, 
            and maintenance records.
          </p>
        </div>
      )}

      {/* Documents Section */}
      <DealSection
        id="documents"
        icon={isPipeline ? "📄" : "📋"}
        title={isPipeline ? "Due Diligence Documents" : "Property Documents"}
        defaultExpanded={true}
      >
        <DocumentsSection deal={deal} />
      </DealSection>

    </div>
  );
};

// ==================== WITH LOADING STATE ====================

/**
 * Example 7: With Loading and Error States
 */
export const WithLoadingStateExample: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [deal, setDeal] = React.useState<Deal | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setDeal({
        id: dealId,
        name: 'Loaded Deal',
        status: 'pipeline',
        address: '123 Example St',
        createdAt: new Date().toISOString()
      } as Deal);
      setLoading(false);
    }, 1000);
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-4xl mb-4">❌</div>
        <p className="text-red-800 font-semibold">{error}</p>
      </div>
    );
  }

  if (!deal) {
    return null;
  }

  return (
    <DealSection
      id="documents"
      icon="📄"
      title="Documents"
      defaultExpanded={true}
    >
      <DocumentsSection deal={deal} />
    </DealSection>
  );
};

// ==================== EXPORT ALL EXAMPLES ====================

export const DocumentsSectionExamples = {
  Basic: BasicDocumentsExample,
  AcquisitionMode: AcquisitionModeExample,
  PerformanceMode: PerformanceModeExample,
  FullDealPage: FullDealPageExample,
  CustomStyled: CustomStyledExample,
  ConditionalFeatures: ConditionalFeaturesExample,
  WithLoadingState: WithLoadingStateExample
};

export default DocumentsSectionExamples;
