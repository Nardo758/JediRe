import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDealStore } from '../stores/dealStore';
import { DealSidebar } from '../components/deal/DealSidebar';
import { DealMapView } from '../components/deal/DealMapView';
import { DealContextTracker } from '../components/deal/DealContextTracker';
import { ActionStatusPanel } from '../components/deal/ActionStatusPanel';
import { StrategyAnalysisResults } from '../components/deal/StrategyAnalysisResults';
import { GeographicScopeTabs } from '../components/trade-area';
import { useTradeAreaStore } from '../stores/tradeAreaStore';
import { Button } from '../components/shared/Button';
import { Badge } from '../components/shared/Badge';
import { api } from '../services/api.client';
import { 
  dealAnalysisService, 
  AnalysisStatus,
  StrategyAnalysisResult,
  ZoningAnalysisResult,
} from '../services/dealAnalysis.service';
import { OverviewSection } from '../components/deal/sections/OverviewSection';
import { AIAgentSection } from '../components/deal/sections/AIAgentSection';
import { CompetitionSection } from '../components/deal/sections/CompetitionSection';
import { SupplySection } from '../components/deal/sections/SupplySection';
import { DebtSection } from '../components/deal/sections/DebtSection';
import { FinancialSection } from '../components/deal/sections/FinancialSection';
import { MarketSection } from '../components/deal/sections/MarketSection';
import { StrategySection } from '../components/deal/sections/StrategySection';
import { DueDiligenceSection } from '../components/deal/sections/DueDiligenceSection';
import { TeamSection } from '../components/deal/sections/TeamSection';
import { DocumentsSection } from '../components/deal/sections/DocumentsSection';
import { NotesSection } from '../components/deal/sections/NotesSection';
import { TimelineSection } from '../components/deal/sections/TimelineSection';
import { FilesSection } from '../components/deal/sections/FilesSection';
import { ExitSection } from '../components/deal/sections/ExitSection';


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
  
  // Analysis state
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [strategyResults, setStrategyResults] = useState<StrategyAnalysisResult | null>(null);
  const [zoningResults, setZoningResults] = useState<ZoningAnalysisResult | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [showActionPanel, setShowActionPanel] = useState(true);

  useEffect(() => {
    if (id) {
      fetchDealById(id);
      fetchModules(id);
      loadTradeAreaForDeal(id);
      fetchGeographicContext(id);
      startDealAnalysis(id);
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

  const startDealAnalysis = async (dealId: string) => {
    try {
      // Start the analysis
      await dealAnalysisService.startAnalysis(dealId);
      
      // Start polling for updates
      const pollInterval = setInterval(async () => {
        try {
          const status = await dealAnalysisService.getAnalysisStatus(dealId);
          setAnalysisStatus(status);
          
          // Check if all tasks are complete
          const allComplete = 
            status.zoningAnalysis.status === 'complete' &&
            status.comparables.status === 'complete' &&
            status.strategies.status === 'complete' &&
            status.financialModels.status === 'complete';
          
          if (allComplete) {
            clearInterval(pollInterval);
            setAnalysisComplete(true);
            
            // Load strategy results for existing properties
            if (selectedDeal?.development_type === 'existing' || selectedDeal?.property_type_key === 'existing') {
              try {
                const strategyData = await dealAnalysisService.getStrategyAnalysis(
                  dealId,
                  selectedDeal?.purchase_price || 1000000,
                  4 // Default existing units
                );
                setStrategyResults(strategyData);
              } catch (err) {
                console.error('Failed to load strategy results:', err);
              }
            }
            
            // Load zoning results for new development
            if (selectedDeal?.development_type === 'new' || selectedDeal?.development_type === 'land') {
              try {
                const zoningData = await dealAnalysisService.getZoningAnalysis(dealId);
                setZoningResults(zoningData);
              } catch (err) {
                console.error('Failed to load zoning results:', err);
              }
            }
            
            // Auto-hide panel after 10 seconds
            setTimeout(() => {
              setShowActionPanel(false);
            }, 10000);
          }
        } catch (err) {
          console.error('Failed to poll analysis status:', err);
        }
      }, 2000); // Poll every 2 seconds
      
      // Clear interval on unmount
      return () => clearInterval(pollInterval);
    } catch (err) {
      console.error('Failed to start deal analysis:', err);
    }
  };

  const handleSkipSetup = () => {
    setAnalysisComplete(true);
    setShowActionPanel(false);
    setCurrentModule('overview');
  };

  const handleChooseStrategy = (physicalOptionId: string, strategyId: string) => {
    console.log('Chosen strategy:', { physicalOptionId, strategyId });
    // Navigate to financial section to build the model
    setCurrentModule('financial');
    setShowActionPanel(false);
  };

  const isOwned = selectedDeal?.dealCategory === 'portfolio' || selectedDeal?.state === 'POST_CLOSE';
  const dealMode = isOwned ? 'performance' : 'acquisition';
  
  const isExistingProperty = selectedDeal?.development_type === 'existing' || selectedDeal?.property_type_key === 'existing';

  const renderModule = () => {
    if (!selectedDeal) return null;
    const deal = selectedDeal as any;

    switch (currentModule) {
      case 'map':
        return <DealMapView deal={selectedDeal} />;
      case 'overview':
        return (
          <div className="p-6">
            <OverviewSection deal={deal} />
          </div>
        );
      case 'ai-agent':
        return (
          <div className="p-6">
            <AIAgentSection deal={deal} useMockData={true} />
          </div>
        );
      case 'competition':
        return (
          <div className="p-6">
            <CompetitionSection deal={deal} />
          </div>
        );
      case 'supply':
        return (
          <div className="p-6">
            <SupplySection deal={deal} />
          </div>
        );
      case 'debt':
        return (
          <div className="p-6">
            <DebtSection deal={deal} />
          </div>
        );
      case 'financial':
        return (
          <div className="p-6">
            <FinancialSection deal={deal} />
          </div>
        );
      case 'market':
        return (
          <div className="p-6">
            <MarketSection deal={deal} />
          </div>
        );
      case 'strategy':
        return (
          <div className="p-6">
            <StrategySection deal={deal} />
          </div>
        );
      case 'due-diligence':
        return (
          <div className="p-6">
            <DueDiligenceSection deal={deal} />
          </div>
        );
      case 'team':
        return (
          <div className="p-6">
            <TeamSection deal={deal} />
          </div>
        );
      case 'documents':
        return (
          <div className="p-6">
            <DocumentsSection deal={deal} />
          </div>
        );
      case 'notes':
        return (
          <div className="p-6">
            <NotesSection deal={deal} />
          </div>
        );
      case 'timeline':
        return (
          <div className="p-6">
            <TimelineSection deal={deal} />
          </div>
        );
      case 'files':
        return (
          <div className="p-6">
            <FilesSection deal={deal} />
          </div>
        );
      case 'exit':
        return (
          <div className="p-6">
            <ExitSection deal={deal} />
          </div>
        );
      case 'context':
        return <DealContextTracker dealId={selectedDeal.id} />;
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
          <div className="text-6xl mb-4">&#9888;&#65039;</div>
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
          <div className="text-6xl mb-4">&#128269;</div>
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
                {isOwned && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    OWNED
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedDeal.projectType || 'multifamily'} &bull; {(selectedDeal.acres || 0).toFixed(1)} acres
                {selectedDeal.budget && ` \u2022 $${(selectedDeal.budget / 1000000).toFixed(1)}M budget`}
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

      <div className="px-6 py-4 border-b border-gray-200">
        <GeographicScopeTabs
          activeScope={activeScope}
          onChange={setScope}
          tradeAreaEnabled={!!geographicStats?.trade_area}
          stats={geographicStats || {}}
        />
      </div>

      {/* Action Status Panel - shows during analysis */}
      {!analysisComplete && showActionPanel && analysisStatus && (
        <ActionStatusPanel
          status={analysisStatus}
          dealType={selectedDeal?.development_type || 'existing'}
          propertyType={selectedDeal?.property_type_key}
          onSkipSetup={handleSkipSetup}
        />
      )}

      {/* Strategy Analysis Results - shows when analysis complete */}
      {analysisComplete && (strategyResults || zoningResults) && (
        <StrategyAnalysisResults
          results={strategyResults || undefined}
          zoningResults={zoningResults || undefined}
          dealType={selectedDeal?.development_type || 'existing'}
          onChooseStrategy={handleChooseStrategy}
          onViewDetailed={() => setCurrentModule('strategy')}
          onCompareAll={() => setCurrentModule('strategy')}
          onStartDesign={() => setCurrentModule('overview')}
          onViewZoning={() => setCurrentModule('overview')}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <DealSidebar
          deal={selectedDeal}
          modules={modules}
          currentModule={currentModule}
          onModuleChange={setCurrentModule}
          analysisStatus={analysisStatus}
          strategyResultsReady={!!strategyResults || !!zoningResults}
        />

        <div className="flex-1 overflow-auto bg-gray-50">
          {renderModule()}
        </div>
      </div>
    </div>
  );
};
