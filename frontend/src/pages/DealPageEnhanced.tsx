/**
 * Enhanced Deal Page - JEDI RE
 * Complete deal page with 14 collapsible sections
 * SKELETON STRUCTURE ONLY - sections to be built individually
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DealSection } from '../components/deal/DealSection';
import {
  OverviewSection,
  MarketCompetitionSection,
  SupplyTrackingSection,
  DebtMarketSection,
  AIAgentSection,
  FinancialSection,
  StrategySection,
  DueDiligenceSection,
  PropertiesSection,
  MarketSection,
  DocumentsSection,
  TeamSection,
  ContextTrackerSection,
  NotesSection
} from '../components/deal/sections';
import { DEAL_SECTIONS } from '../types/deal-enhanced.types';
import { Deal } from '../types/deal';
import { apiClient } from '../services/api.client';

export const DealPageEnhanced: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock premium status - replace with real check later
  const [isPremium, setIsPremium] = useState(false);

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

  const handleBackToPipeline = () => {
    navigate('/deals');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading enhanced deal page...</p>
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
            ← Back to Deals
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            {/* Left: Back button + Deal info */}
            <div className="flex-1">
              <button
                onClick={handleBackToPipeline}
                className="text-sm text-blue-100 hover:text-white mb-2 flex items-center gap-1 transition-colors"
              >
                ← Back to Deals
              </button>
              <div>
                <h1 className="text-2xl font-bold">{deal.name}</h1>
                <div className="flex items-center gap-3 mt-2 text-sm text-blue-100">
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Type:</span> {deal.projectType || deal.dealType || 'N/A'}
                  </span>
                  <span className="text-blue-300">|</span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Stage:</span>
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                      {deal.stage || 'Active'}
                    </span>
                  </span>
                  <span className="text-blue-300">|</span>
                  <span className="flex items-center gap-1">
                    ✨ <span className="font-medium">Enhanced View</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/deals/${dealId}/view`)}
                className="px-4 py-2 text-sm font-medium text-white bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                Standard View
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                onClick={() => console.log('Export deal')}
              >
                📤 Export
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-white rounded-lg hover:bg-blue-50 transition-colors"
                onClick={() => console.log('Edit deal')}
              >
                ✏️ Edit Deal
              </button>
            </div>
          </div>
        </div>

        {/* Section Quick Navigation */}
        <div className="px-6 py-2 bg-black/10 overflow-x-auto">
          <div className="flex gap-2 text-xs text-blue-100">
            {DEAL_SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  const element = document.getElementById(`section-${section.id}`);
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1 hover:bg-white/20 rounded transition-colors whitespace-nowrap"
              >
                {section.icon} {section.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content with 14 sections */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-4">
          
          {/* 1. Overview Section */}
          <div id="section-overview">
            <DealSection
              id="overview"
              icon="📊"
              title="Overview"
              defaultExpanded={true}
            >
              <OverviewSection deal={deal} />
            </DealSection>
          </div>

          {/* 2. Market Competition */}
          <div id="section-market-competition">
            <DealSection
              id="market-competition"
              icon="🏆"
              title="Market Competition"
              isPremium={true}
            >
              <MarketCompetitionSection deal={deal} />
            </DealSection>
          </div>

          {/* 3. Supply Tracking */}
          <div id="section-supply-tracking">
            <DealSection
              id="supply-tracking"
              icon="📦"
              title="Supply Tracking"
              isPremium={true}
            >
              <SupplyTrackingSection deal={deal} />
            </DealSection>
          </div>

          {/* 4. Debt Market */}
          <div id="section-debt-market">
            <DealSection
              id="debt-market"
              icon="💳"
              title="Debt Market"
              isPremium={true}
            >
              <DebtMarketSection deal={deal} />
            </DealSection>
          </div>

          {/* 5. AI Agent (Opus) */}
          <div id="section-ai-agent">
            <DealSection
              id="ai-agent"
              icon="🤖"
              title="AI Agent (Opus)"
              isPremium={true}
            >
              <AIAgentSection deal={deal} />
            </DealSection>
          </div>

          {/* 6. Financial Analysis */}
          <div id="section-financial">
            <DealSection
              id="financial"
              icon="💰"
              title="Financial Analysis"
              isPremium={true}
            >
              <FinancialSection deal={deal} isPremium={isPremium} />
            </DealSection>
          </div>

          {/* 7. Strategy & Arbitrage */}
          <div id="section-strategy">
            <DealSection
              id="strategy"
              icon="🎯"
              title="Strategy & Arbitrage"
              isPremium={true}
            >
              <StrategySection deal={deal} isPremium={isPremium} />
            </DealSection>
          </div>

          {/* 8. Due Diligence */}
          <div id="section-due-diligence">
            <DealSection
              id="due-diligence"
              icon="✅"
              title="Due Diligence"
            >
              <DueDiligenceSection deal={deal} />
            </DealSection>
          </div>

          {/* 9. Properties */}
          <div id="section-properties">
            <DealSection
              id="properties"
              icon="🏢"
              title="Properties"
            >
              <PropertiesSection deal={deal} />
            </DealSection>
          </div>

          {/* 10. Market Analysis */}
          <div id="section-market">
            <DealSection
              id="market"
              icon="📈"
              title="Market Analysis"
              isPremium={true}
            >
              <MarketSection deal={deal} isPremium={isPremium} />
            </DealSection>
          </div>

          {/* 7. Documents */}
          <div id="section-documents">
            <DealSection
              id="documents"
              icon="📄"
              title="Documents"
            >
              <DocumentsSection deal={deal} />
            </DealSection>
          </div>

          {/* 8. Team & Communications */}
          <div id="section-team">
            <DealSection
              id="team"
              icon="👥"
              title="Team & Communications"
            >
              <TeamSection deal={deal} />
            </DealSection>
          </div>

          {/* 9. Deal Context Tracker */}
          <div id="section-context-tracker">
            <DealSection
              id="context-tracker"
              icon="🧭"
              title="Deal Context Tracker"
            >
              <ContextTrackerSection deal={deal} />
            </DealSection>
          </div>

          {/* 10. Notes & Comments */}
          <div id="section-notes">
            <DealSection
              id="notes"
              icon="💬"
              title="Notes & Comments"
            >
              <NotesSection deal={deal} />
            </DealSection>
          </div>

        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 flex items-center justify-center"
        title="Back to top"
      >
        ↑
      </button>
    </div>
  );
};

export default DealPageEnhanced;
