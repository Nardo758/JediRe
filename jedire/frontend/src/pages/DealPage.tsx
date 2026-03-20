import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SectionCard } from '../components/deal/SectionCard';
import { ModuleSuggestionModal } from '../components/deal/ModuleSuggestionModal';
import { CollaborationSection, ActivityFeedSection } from '../components/deal/sections';
import { DocumentsFilesSection } from '../components/deal/sections/DocumentsFilesSection';
import { Deal } from '../types/deal';
import { apiClient } from '../services/api.client';
import { useModuleCheck, invalidateModuleCache } from '../utils/modules';
import { FinancialAnalysisSection } from '../components/deal/sections/FinancialAnalysisSection';
import { InvestmentStrategySection } from '../components/deal/sections/InvestmentStrategySection';
import { ProjectManagementSection } from '../components/deal/sections/ProjectManagementSection';
import { MarketResearchSection } from '../components/deal/sections/MarketResearchSection';
import { TrafficAnalysisSection } from '../components/deal/sections/TrafficAnalysisSection';
import LeasingTrafficCard from '../components/analytics/LeasingTrafficCard';

export const DealPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModuleSuggestions, setShowModuleSuggestions] = useState(false);

  const { loading: financialModuleLoading, enabled: hasFinancialPro } = useModuleCheck('financial-modeling-pro');

  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
      
      // Check if we should show module suggestions
      const dismissed = localStorage.getItem(`deal-${dealId}-suggestions-dismissed`);
      if (!dismissed) {
        // Wait for deal to load before showing modal
        setTimeout(() => {
          setShowModuleSuggestions(true);
        }, 800);
      }
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

  const handleBackToPipeline = () => {
    navigate('/pipeline/grid');
  };

  const handleModuleUpgrade = () => {
    navigate('/settings/modules');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Deal not found'}</h2>
          <p className="text-gray-600 mb-6">The requested deal could not be loaded.</p>
          <button
            onClick={handleBackToPipeline}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Pipeline
          </button>
        </div>
      </div>
    );
  }

  const pipelineStage = deal.stage?.toLowerCase().replace(/\s+/g, '_') || 'lead';

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Back button + Deal info */}
          <div className="flex-1">
            <button
              onClick={handleBackToPipeline}
              className="text-sm text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-1 transition-colors"
            >
              ← Back to Pipeline (Grid)
            </button>
            <div className="flex items-start justify-between">
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
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors"
              onClick={() => navigate(`/deals/${dealId}/enhanced`)}
            >
              ✨ Enhanced View
            </button>
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => console.log('Export deal')}
            >
              📤 Export
            </button>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => console.log('Edit deal')}
            >
              ✏️ Edit Deal
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-4">
          {/* 1. Overview - Expanded by default */}
          <SectionCard id="overview" icon="📊" title="Overview" dealId={dealId} defaultExpanded={true}>
            <div className="space-y-6">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-600 mb-1">Properties</div>
                  <div className="text-2xl font-bold text-blue-900">{deal.propertyCount || 0}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-600 mb-1">Est. Budget</div>
                  <div className="text-2xl font-bold text-green-900">
                    ${(deal.budget || deal.dealValue || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-purple-600 mb-1">Acres</div>
                  <div className="text-2xl font-bold text-purple-900">{deal.acres || '-'}</div>
                </div>
              </div>

              {/* Map placeholder */}
              <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">🗺️</div>
                  <p className="text-gray-600 font-medium">Deal Map View</p>
                  <p className="text-sm text-gray-500">Shows deal boundary and properties</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  🔍 Find Properties
                </button>
                <button className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                  🎯 Run Analysis
                </button>
                <button className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  📊 Generate Report
                </button>
              </div>
            </div>
          </SectionCard>

          {/* 2. Properties */}
          <SectionCard id="properties" icon="🏢" title="Properties" dealId={dealId}>
            {null}
          </SectionCard>

          {/* 3. Financial Analysis */}
          <SectionCard id="financial" icon="💰" title="Financial Analysis" dealId={dealId}>
            <FinancialAnalysisSection
              deal={deal}
              enhanced={hasFinancialPro}
              onToggleModule={handleModuleUpgrade}
            />
          </SectionCard>

          {/* 4. Investment Strategy (Unified: Acquisition → Value Creation → Exit) */}
          <SectionCard id="investment-strategy" icon="🎯" title="Investment Strategy" dealId={dealId}>
            <InvestmentStrategySection deal={deal} />
          </SectionCard>

          {/* 6. Project Management (Unified Timeline + Due Diligence) */}
          <SectionCard id="project-management" icon="📋" title="Project Management" dealId={dealId}>
            <ProjectManagementSection deal={deal} />
          </SectionCard>

          {/* 7. Market Research & Traffic Analysis */}
          <SectionCard id="market" icon="📈" title="Market Intelligence" dealId={dealId}>
            <div className="space-y-8">
              {/* Market Research */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>📊</span> Market Research
                </h3>
                <MarketResearchSection deal={deal} />
              </div>

              {/* Traffic Analysis */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🚦</span> Traffic Analysis
                </h3>
                <TrafficAnalysisSection 
                  deal={deal} 
                  propertyId={deal.propertyId || deal.properties?.[0]?.id} 
                />
              </div>

              {/* Leasing Traffic (Multifamily Only) */}
              {deal.projectType?.toLowerCase() === 'multifamily' && deal.propertyId && (
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>🏢</span> Leasing Traffic
                  </h3>
                  <LeasingTrafficCard 
                    propertyId={deal.propertyId || deal.properties?.[0]?.id}
                    showForecast={true}
                  />
                </div>
              )}
            </div>
          </SectionCard>

          {/* 8. Development (conditional) */}
          {deal.isDevelopment && (
            <SectionCard id="development" icon="🏗️" title="Development" dealId={dealId}>
              {null}
            </SectionCard>
          )}

          {/* 9. Documents & Files (Unified) */}
          <SectionCard id="documents" icon="📁" title="Documents & Files" dealId={dealId}>
            <DocumentsFilesSection deal={deal} />
          </SectionCard>

          {/* 10. Collaboration */}
          <SectionCard id="collaboration" icon="👥" title="Collaboration" dealId={dealId}>
            <CollaborationSection deal={deal} />
          </SectionCard>

          {/* 11. Activity Feed */}
          <SectionCard id="activity-feed" icon="📝" title="Activity Feed" dealId={dealId}>
            <ActivityFeedSection deal={deal} />
          </SectionCard>
        </div>
      </div>

      {/* Module Suggestion Modal */}
      {showModuleSuggestions && (
        <ModuleSuggestionModal
          isOpen={showModuleSuggestions}
          onClose={() => {
            setShowModuleSuggestions(false);
            invalidateModuleCache();
            localStorage.setItem(`deal-${dealId}-suggestions-dismissed`, 'true');
          }}
          dealId={dealId!}
          dealType={(deal as any).dealCategory || (deal as any).deal_category || 'multifamily'}
          dealStrategy={(deal as any).developmentType || (deal as any).development_type || 'value-add'}
        />
      )}
    </div>
  );
};

export default DealPage;
