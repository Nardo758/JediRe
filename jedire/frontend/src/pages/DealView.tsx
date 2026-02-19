import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDealStore } from '../stores/dealStore';
import { DealSidebar } from '../components/deal/DealSidebar';
import { DealMapView } from '../components/deal/DealMapView';
import { DealProperties } from '../components/deal/DealProperties';
import { DealStrategy } from '../components/deal/DealStrategy';
import { DealPipeline } from '../components/deal/DealPipeline';
import { DealContextTracker } from '../components/deal/DealContextTracker';
import { GeographicScopeTabs } from '../components/trade-area';
import { useTradeAreaStore } from '../stores/tradeAreaStore';
import { Button } from '../components/shared/Button';
import { api } from '../services/api.client';
import {
  OverviewSection,
  FinancialSection,
  StrategySection,
  DueDiligenceSection,
  PropertiesSection,
  MarketIntelligenceSection,
  DebtMarketSection,
  AIAgentSection,
  TeamSection,
  ContextTrackerSection,
  NotesSection,
} from '../components/deal/sections';

export const DealView: React.FC = () => {
  const { id, module } = useParams<{ id: string; module?: string }>();
  const navigate = useNavigate();
  const { selectedDeal, fetchDealById, isLoading, error } = useDealStore();
  const { activeScope, setScope, loadTradeAreaForDeal } = useTradeAreaStore();
  const [currentModule, setCurrentModule] = useState(module || 'map');
  const [modules, setModules] = useState<any[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [geographicStats, setGeographicStats] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchDealById(id);
      fetchModules(id);
      loadTradeAreaForDeal(parseInt(id));
      fetchGeographicContext(id);
    }
  }, [id]);

  useEffect(() => {
    if (module) {
      setCurrentModule(module);
    }
  }, [module]);

  const fetchModules = async (dealId: string) => {
    setModulesLoading(true);
    setModulesError(null);
    
    try {
      const response = await api.deals.modules(dealId);
      const data = response.data;
      setModules(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to fetch modules';
      setModulesError(errorMsg);
      console.error('Failed to fetch modules:', err);
    } finally {
      setModulesLoading(false);
    }
  };

  const fetchGeographicContext = async (dealId: string) => {
    try {
      const response = await api.deals.geographicContext(dealId);
      const context = response.data.data;
      
      const stats: any = {};
      
      if (context.trade_area?.stats) {
        stats.trade_area = {
          occupancy: context.trade_area.stats.occupancy,
          avg_rent: context.trade_area.stats.avg_rent,
        };
      }
      
      if (context.submarket?.stats) {
        stats.submarket = {
          occupancy: context.submarket.stats.avg_occupancy,
          avg_rent: context.submarket.stats.avg_rent,
        };
      }
      
      if (context.msa?.stats) {
        stats.msa = {
          occupancy: context.msa.stats.avg_occupancy,
          avg_rent: context.msa.stats.avg_rent,
        };
      }
      
      setGeographicStats(stats);
    } catch (err) {
      console.error('Failed to fetch geographic context:', err);
      setGeographicStats(null);
    }
  };

  const handleModuleUpgrade = () => {
    navigate('/settings/modules');
  };

  const renderModule = () => {
    if (!selectedDeal) return null;

    switch (currentModule) {
      case 'map':
        return <DealMapView deal={selectedDeal} />;
      case 'overview':
        return (
          <div className="p-6">
            <OverviewSection deal={selectedDeal as any} />
          </div>
        );
      case 'properties':
        return (
          <div className="p-6">
            <PropertiesSection deal={selectedDeal as any} />
          </div>
        );
      case 'financial':
        return (
          <div className="p-6">
            <FinancialSection deal={selectedDeal as any} isPremium={false} />
          </div>
        );
      case 'strategy':
        return (
          <div className="p-6">
            <StrategySection deal={selectedDeal as any} enhanced={false} onToggleModule={handleModuleUpgrade} />
          </div>
        );
      case 'due-diligence':
        return (
          <div className="p-6">
            <DueDiligenceSection deal={selectedDeal as any} enhanced={false} onToggleModule={handleModuleUpgrade} />
          </div>
        );
      case 'market-intelligence':
        return (
          <div className="p-6">
            <MarketIntelligenceSection deal={selectedDeal as any} isPremium={false} />
          </div>
        );
      case 'debt-market':
        return (
          <div className="p-6">
            <DebtMarketSection deal={selectedDeal as any} isPremium={false} />
          </div>
        );
      case 'ai-agent':
        return (
          <div className="p-6">
            <AIAgentSection deal={selectedDeal as any} isPremium={false} />
          </div>
        );
      case 'files':
        return (
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Files Section</h3>
              <p className="text-gray-600">File management coming soon</p>
            </div>
          </div>
        );
      case 'team':
        return (
          <div className="p-6">
            <TeamSection deal={selectedDeal as any} />
          </div>
        );
      case 'context':
        return (
          <div className="p-6">
            <ContextTrackerSection deal={selectedDeal as any} />
          </div>
        );
      case 'notes':
        return (
          <div className="p-6">
            <NotesSection deal={selectedDeal as any} />
          </div>
        );
      case 'pipeline':
        return <DealPipeline dealId={selectedDeal.id} />;
      default:
        return <div className="p-6">Module not found</div>;
    }
  };

  if (isLoading && !selectedDeal) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (error && !selectedDeal) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-gray-900 font-semibold mb-2">Failed to load deal</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedDeal) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-900 font-semibold mb-2">Deal not found</p>
          <p className="text-gray-600 mb-4">This deal may have been deleted or you don't have access.</p>
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{selectedDeal.name}</h1>
                <span
                  className="px-3 py-1 text-xs font-semibold rounded-full"
                  style={{
                    backgroundColor: selectedDeal.tier === 'basic' ? '#fef3c7' :
                                    selectedDeal.tier === 'pro' ? '#dbeafe' : '#d1fae5',
                    color: selectedDeal.tier === 'basic' ? '#92400e' :
                           selectedDeal.tier === 'pro' ? '#1e40af' : '#065f46'
                  }}
                >
                  {(selectedDeal.tier || 'basic').toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedDeal.projectType || 'multifamily'} • {(selectedDeal.acres || 0).toFixed(1)} acres
                {selectedDeal.budget && ` • $${(selectedDeal.budget / 1000000).toFixed(1)}M budget`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {selectedDeal.pipelineStage && (
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">
                  {selectedDeal.pipelineStage.replace('_', ' ')}
                </div>
                <div className="text-xs text-gray-600">
                  {selectedDeal.daysInStage} days in stage
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Geographic Scope Tabs */}
      <div className="px-6 py-4 border-b border-gray-200">
        <GeographicScopeTabs
          activeScope={activeScope}
          onChange={setScope}
          tradeAreaEnabled={!!geographicStats?.trade_area}
          stats={geographicStats || {}}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <DealSidebar
          deal={selectedDeal}
          modules={modules}
          currentModule={currentModule}
          onModuleChange={setCurrentModule}
        />

        <div className="flex-1 overflow-auto bg-gray-50">
          {renderModule()}
        </div>
      </div>
    </div>
  );
};
