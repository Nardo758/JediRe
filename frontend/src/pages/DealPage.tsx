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
import { BT } from '../components/deal/bloomberg-ui';
import { ExtractionAccuracyPanel } from '../components/deal/sections/ExtractionAccuracyPanel';

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
      <div className="flex items-center justify-center h-screen" style={{ background: BT.bg.terminal }}>
        <div className="text-center">
          <div className="inline-block animate-spin h-12 w-12 mb-4" style={{ borderRadius: '50%', border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}` }}></div>
          <p style={{ color: BT.text.secondary }}>Loading deal...</p>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: BT.bg.terminal }}>
        <div className="text-center">
          <div className="text-5xl mb-4" style={{ color: BT.text.red }}>⚠️</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: BT.text.primary }}>{error || 'Deal not found'}</h2>
          <p className="mb-6" style={{ color: BT.text.secondary }}>The requested deal could not be loaded.</p>
          <button
            onClick={handleBackToPipeline}
            className="px-4 py-2 transition-colors"
            style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
          >
            ← Back to Pipeline
          </button>
        </div>
      </div>
    );
  }

  const pipelineStage = deal.stage?.toLowerCase().replace(/\s+/g, '_') || 'lead';

  const getTierStyle = () => {
    if (deal.tier === 'pro') return { background: BT.bg.active, color: BT.text.cyan };
    if (deal.tier === 'enterprise') return { background: BT.bg.active, color: BT.text.green };
    return { background: BT.bg.active, color: BT.text.amber };
  };

  const getStageStyle = () => {
    if (pipelineStage === 'closed') return { background: BT.bg.active, color: BT.text.green };
    if (pipelineStage === 'due_diligence') return { background: BT.bg.active, color: BT.text.cyan };
    return { background: BT.bg.active, color: BT.text.amber };
  };

  return (
    <div className="h-full flex flex-col" style={{ background: BT.bg.terminal }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center justify-between">
          {/* Left: Back button + Deal info */}
          <div className="flex-1">
            <button
              onClick={handleBackToPipeline}
              className="text-sm mb-2 flex items-center gap-1 transition-colors"
              style={{ color: BT.text.secondary }}
            >
              ← Back to Pipeline (Grid)
            </button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: BT.text.primary }}>{deal.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: BT.text.secondary }}>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Type:</span> {deal.projectType || deal.dealType || 'N/A'}
                  </span>
                  <span style={{ color: BT.text.muted }}>|</span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Tier:</span>
                    <span className="px-2 py-0.5 text-xs font-medium" style={{ borderRadius: 2, ...getTierStyle() }}>
                      {(deal.tier || 'basic').toUpperCase()}
                    </span>
                  </span>
                  <span style={{ color: BT.text.muted }}>|</span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Stage:</span>
                    <span className="px-2 py-0.5 text-xs font-medium" style={{ borderRadius: 2, ...getStageStyle() }}>
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
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: BT.text.purple, background: BT.bg.hover, border: `1px solid ${BT.border.subtle}`, borderRadius: 2 }}
              onClick={() => navigate(`/deals/${dealId}/enhanced`)}
            >
              ✨ Enhanced View
            </button>
            <button
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: BT.text.primary, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 2 }}
              onClick={() => console.log('Export deal')}
            >
              📤 Export
            </button>
            <button
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: BT.bg.terminal, background: BT.text.cyan, borderRadius: 2 }}
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
                <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                  <div className="text-sm font-medium mb-1" style={{ color: BT.text.cyan }}>Properties</div>
                  <div className="text-2xl font-bold" style={{ color: BT.text.primary }}>{deal.propertyCount || 0}</div>
                </div>
                <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                  <div className="text-sm font-medium mb-1" style={{ color: BT.text.green }}>Est. Budget</div>
                  <div className="text-2xl font-bold" style={{ color: BT.text.primary }}>
                    ${(deal.budget || deal.dealValue || 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                  <div className="text-sm font-medium mb-1" style={{ color: BT.text.purple }}>Acres</div>
                  <div className="text-2xl font-bold" style={{ color: BT.text.primary }}>{deal.acres || '-'}</div>
                </div>
              </div>

              {/* Map placeholder */}
              <div className="h-64 flex items-center justify-center" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div className="text-center">
                  <div className="text-4xl mb-2">🗺️</div>
                  <p className="font-medium" style={{ color: BT.text.secondary }}>Deal Map View</p>
                  <p className="text-sm" style={{ color: BT.text.muted }}>Shows deal boundary and properties</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ color: BT.text.cyan, background: BT.bg.hover, borderRadius: 2 }}>
                  🔍 Find Properties
                </button>
                <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ color: BT.text.green, background: BT.bg.hover, borderRadius: 2 }}>
                  🎯 Run Analysis
                </button>
                <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ color: BT.text.purple, background: BT.bg.hover, borderRadius: 2 }}>
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
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: BT.text.primary }}>
                  <span>📊</span> Market Research
                </h3>
                <MarketResearchSection deal={deal} />
              </div>

              {/* Traffic Analysis */}
              <div className="pt-6" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: BT.text.primary }}>
                  <span>🚦</span> Traffic Analysis
                </h3>
                <TrafficAnalysisSection
                  deal={deal}
                  propertyId={deal.propertyId || deal.properties?.[0]?.id}
                />
              </div>

              {/* Leasing Traffic (Multifamily Only) */}
              {deal.projectType?.toLowerCase() === 'multifamily' && deal.propertyId && (
                <div className="pt-6" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: BT.text.primary }}>
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
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <ExtractionAccuracyPanel dealId={dealId!} />
            </div>
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
