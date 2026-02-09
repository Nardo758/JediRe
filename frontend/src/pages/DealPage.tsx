/**
 * DealPage - Deal detail page with expandable accordion sections
 * 
 * Route: /deals/:dealId
 * 
 * Features:
 * - Deal header with name, type, strategy, stage, and back button
 * - 10 expandable sections (accordion):
 *   1. Overview (expanded by default)
 *   2. Properties
 *   3. Financial Analysis
 *   4. Strategy
 *   5. Due Diligence
 *   6. Market Analysis
 *   7. Development (conditional)
 *   8. Documents
 *   9. Collaboration
 *   10. Activity Feed
 * - LocalStorage persistence for section states
 * - Mobile-friendly layout
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SectionCard } from '../components/deal/SectionCard';

// Mock deal interface - replace with actual type
interface Deal {
  id: string;
  name: string;
  type: string;
  strategy: string;
  stage: string;
  isDevelopment?: boolean;
}

export const DealPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
    }
  }, [dealId]);

  const loadDeal = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data - Replace with actual API call
      // const response = await apiClient.get(`/api/v1/deals/${id}`);
      // setDeal(response.data);
      
      // Mock deal data for now
      setTimeout(() => {
        setDeal({
          id,
          name: 'Riverside Apartments',
          type: 'Multifamily',
          strategy: 'Value-Add',
          stage: 'Due Diligence',
          isDevelopment: false,
        });
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error('Failed to load deal:', err);
      setError('Failed to load deal details');
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/deals');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-gray-900 font-semibold mb-2">
            {error || 'Deal not found'}
          </p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Deals
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back button and Deal info */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Back to deals"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{deal.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Type:</span> {deal.type}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Strategy:</span> {deal.strategy}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Stage:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        deal.stage === 'Closed'
                          ? 'bg-green-100 text-green-700'
                          : deal.stage === 'Due Diligence'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {deal.stage}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm">
                Export
              </button>
              <button className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium text-sm">
                Edit Deal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Accordion Sections */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="space-y-4">
          {/* 1. Overview - Expanded by default */}
          <SectionCard
            id="overview"
            icon="📊"
            title="Overview"
            dealId={dealId}
            defaultExpanded={true}
          >
            {/* Placeholder content - replace with actual components */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Total Investment</div>
                  <div className="text-xl font-bold text-gray-900">$2.5M</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Expected Return</div>
                  <div className="text-xl font-bold text-green-600">18.5%</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Timeline</div>
                  <div className="text-xl font-bold text-gray-900">24 months</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Risk Level</div>
                  <div className="text-xl font-bold text-yellow-600">Medium</div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* 2. Properties */}
          <SectionCard
            id="properties"
            icon="🏢"
            title="Properties"
            dealId={dealId}
          >
            {null}
          </SectionCard>

          {/* 3. Financial Analysis */}
          <SectionCard
            id="financial-analysis"
            icon="💰"
            title="Financial Analysis"
            dealId={dealId}
          >
            {null}
          </SectionCard>

          {/* 4. Strategy */}
          <SectionCard
            id="strategy"
            icon="🎯"
            title="Strategy"
            dealId={dealId}
          >
            {null}
          </SectionCard>

          {/* 5. Due Diligence */}
          <SectionCard
            id="due-diligence"
            icon="✅"
            title="Due Diligence"
            dealId={dealId}
          >
            {null}
          </SectionCard>

          {/* 6. Market Analysis */}
          <SectionCard
            id="market-analysis"
            icon="📈"
            title="Market Analysis"
            dealId={dealId}
          >
            {null}
          </SectionCard>

          {/* 7. Development (conditional) */}
          {deal.isDevelopment && (
            <SectionCard
              id="development"
              icon="🏗️"
              title="Development"
              dealId={dealId}
            >
              {null}
            </SectionCard>
          )}

          {/* 8. Documents */}
          <SectionCard
            id="documents"
            icon="📄"
            title="Documents"
            dealId={dealId}
          >
            {null}
          </SectionCard>

          {/* 9. Collaboration */}
          <SectionCard
            id="collaboration"
            icon="👥"
            title="Collaboration"
            dealId={dealId}
          >
            {null}
          </SectionCard>

          {/* 10. Activity Feed */}
          <SectionCard
            id="activity-feed"
            icon="📝"
            title="Activity Feed"
            dealId={dealId}
          >
            {null}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default DealPage;
