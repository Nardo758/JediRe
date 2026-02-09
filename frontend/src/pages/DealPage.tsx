import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SectionCard } from '../components/deal/SectionCard';
import { apiClient } from '../services/api.client';
import { useModuleCheck, invalidateModuleCache } from '../utils/modules';
import { FinancialAnalysisSection } from '../components/deal/sections/FinancialAnalysisSection';
import { Deal } from '../types/deal';

export const DealPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { loading: financialModuleLoading, enabled: hasFinancialPro } = useModuleCheck('financial-modeling-pro');

  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
    }
  }, [dealId]);

  const loadDeal = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(`/api/v1/deals/${id}`);
      const data = response.data;
      const dealData = data.deal || data.data || data;
      setDeal(dealData);
    } catch (err: any) {
      console.error('Failed to load deal:', err);
      if (err.response?.status === 404) {
        setError('Deal not found');
      } else {
        setError('Failed to load deal details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const formatCurrency = (value: number | undefined): string => {
    if (!value) return '$0';
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">{error === 'Deal not found' ? '🔍' : '⚠️'}</div>
          <p className="text-gray-900 font-semibold mb-2">
            {error || 'Deal not found'}
          </p>
          <p className="text-gray-600 mb-4 text-sm">
            {error === 'Deal not found'
              ? 'This deal may have been deleted or you don\'t have access.'
              : 'Please try again later.'}
          </p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isDevelopment = deal.projectType === 'development' || deal.projectType === 'ground-up';
  const pipelineStage = deal.pipelineStage || deal.stage || 'Prospecting';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Back to dashboard"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{deal.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Type:</span> {deal.projectType || deal.dealType || 'N/A'}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Tier:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      deal.tier === 'pro' ? 'bg-blue-100 text-blue-700'
                        : deal.tier === 'enterprise' ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {(deal.tier || 'basic').toUpperCase()}
                    </span>
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Stage:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      pipelineStage === 'closed' ? 'bg-green-100 text-green-700'
                        : pipelineStage === 'due_diligence' ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {pipelineStage.replace(/_/g, ' ')}
                    </span>
                  </span>
                </div>
              </div>
            </div>

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

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="space-y-4">
          <SectionCard
            id="overview"
            icon="📊"
            title="Overview"
            dealId={dealId}
            defaultExpanded={true}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Budget</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(Number(deal.budget))}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Properties</div>
                  <div className="text-xl font-bold text-blue-600">{Number(deal.propertyCount) || 0}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Acres</div>
                  <div className="text-xl font-bold text-gray-900">{Number(deal.acres || 0).toFixed(1)}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Tasks</div>
                  <div className="text-xl font-bold text-gray-900">
                    {Number(deal.pendingTasks) || 0} / {Number(deal.taskCount) || 0}
                  </div>
                </div>
              </div>
              {deal.description && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Description</div>
                  <p className="text-gray-900">{deal.description}</p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard id="properties" icon="🏢" title="Properties" dealId={dealId}>
            {null}
          </SectionCard>

          <SectionCard
            id="financial-analysis"
            icon="💰"
            title={`Financial Analysis${hasFinancialPro ? ' (Pro)' : ''}`}
            dealId={dealId}
          >
            {financialModuleLoading ? (
              <div className="animate-pulse py-8">
                <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
              </div>
            ) : (
              <FinancialAnalysisSection
                deal={deal}
                enhanced={hasFinancialPro}
                onToggleModule={() => navigate('/settings/modules')}
              />
            )}
          </SectionCard>

          <SectionCard id="strategy" icon="🎯" title="Strategy" dealId={dealId}>
            {null}
          </SectionCard>

          <SectionCard id="due-diligence" icon="✅" title="Due Diligence" dealId={dealId}>
            {null}
          </SectionCard>

          <SectionCard id="market-analysis" icon="📈" title="Market Analysis" dealId={dealId}>
            {null}
          </SectionCard>

          {isDevelopment && (
            <SectionCard id="development" icon="🏗️" title="Development" dealId={dealId}>
              {null}
            </SectionCard>
          )}

          <SectionCard id="documents" icon="📄" title="Documents" dealId={dealId}>
            {null}
          </SectionCard>

          <SectionCard id="collaboration" icon="👥" title="Collaboration" dealId={dealId}>
            {null}
          </SectionCard>

          <SectionCard id="activity-feed" icon="📝" title="Activity Feed" dealId={dealId}>
            {null}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default DealPage;
