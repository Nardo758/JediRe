import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building3DEditor,
  SubjectPropertyPanel,
  CompetitionPanel,
  TrafficPanel,
  ResearchPanel,
  MapLayerControls,
  MapModeSelector,
  FinancialSummaryPanel,
  MapView,
  CollapsiblePanel,
  BottomPanel,
  CompetitionTable,
  TrafficDataTable,
  MarketTrendsTable
} from '../components/design';
import { useDealStore } from '../stores/dealStore';
import { useDesignDashboardStore } from '../stores/DesignDashboardStore';
import { apiClient } from '../services/api.client';
import type { Design3D } from '../types/financial.types';
import { ThreeDErrorBoundary } from '../components/3DErrorBoundary';
import { 
  Layers, 
  Building, 
  Car, 
  Search,
  DollarSign,
  ChevronLeft,
  Save,
  Settings,
  Download
} from 'lucide-react';

export const Design3DPageEnhanced: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { selectedDeal: currentDeal, fetchDealById: loadDeal } = useDealStore();
  
  const {
    mapMode,
    activePanel,
    leftSidebarOpen,
    rightSidebarOpen,
    bottomPanelOpen,
    designMetrics,
    setActivePanel,
    toggleLeftSidebar,
    toggleRightSidebar,
    toggleBottomPanel,
    updateDesignMetrics,
  } = useDesignDashboardStore();
  
  const [design3D, setDesign3D] = useState<Design3D | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [bottomTab, setBottomTab] = useState<'competition' | 'traffic' | 'trends'>('competition');

  // Load deal data on mount
  useEffect(() => {
    const loadDealData = async () => {
      if (!dealId) return;
      
      try {
        setIsLoading(true);
        
        // Load deal if not in store
        if (!currentDeal || currentDeal.id !== dealId) {
          await loadDeal(dealId);
        }
        
        // Load existing design if available
        const response = await apiClient.get(`/api/v1/deals/${dealId}/design`);
        if (response.data.success && response.data.data) {
          setDesign3D(response.data.data);
          
          // Update dashboard metrics
          const design = response.data.data;
          updateDesignMetrics({
            units: design.totalUnits,
            totalSF: design.grossSF,
            rentableSF: design.rentableSF,
            efficiency: design.efficiency,
            parkingSpaces: design.parkingSpaces,
            parkingRatio: design.parkingSpaces / (design.totalUnits || 1),
            far: design.farUtilized,
            buildingHeight: design.stories * 12, // Assume 12ft per story
            stories: design.stories,
          });
        }
      } catch (err) {
        console.error('Failed to load deal/design:', err);
        setError('Failed to load deal data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDealData();
  }, [dealId, currentDeal, loadDeal]);

  const handleMetricsChange = (metrics: any) => {
    // Update both local state and dashboard store
    const updatedDesign: Design3D = {
      id: design3D?.id || `${dealId}-design`,
      dealId: dealId!,
      totalUnits: metrics.totalUnits || 0,
      unitMix: metrics.unitMix || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0 },
      rentableSF: metrics.rentableSF || 0,
      grossSF: metrics.grossSF || 0,
      efficiency: metrics.efficiency || 0.85,
      parkingSpaces: metrics.parkingSpaces || 0,
      parkingType: metrics.parkingType || 'surface',
      amenitySF: metrics.amenitySF || 0,
      stories: metrics.stories || 1,
      farUtilized: metrics.farUtilized || 0,
      farMax: metrics.farMax,
      lastModified: new Date().toISOString(),
    };
    
    setDesign3D(updatedDesign);
    setHasUnsavedChanges(true);
    
    // Update dashboard metrics
    updateDesignMetrics({
      units: metrics.totalUnits || 0,
      totalSF: metrics.grossSF || 0,
      rentableSF: metrics.rentableSF || 0,
      efficiency: metrics.efficiency || 0.85,
      parkingSpaces: metrics.parkingSpaces || 0,
      parkingRatio: (metrics.parkingSpaces || 0) / (metrics.totalUnits || 1),
      far: metrics.farUtilized || 0,
      buildingHeight: (metrics.stories || 1) * 12,
      stories: metrics.stories || 1,
    });
  };

  const handleSave = async () => {
    if (!design3D || !dealId) return;
    
    try {
      setIsSaving(true);
      
      const response = await apiClient.post(`/api/v1/deals/${dealId}/design`, {
        design: design3D,
      });
      
      if (response.data.success) {
        setHasUnsavedChanges(false);
        setError(null);
      }
    } catch (err: any) {
      console.error('Failed to save design:', err);
      setError(err.message || 'Failed to save design');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-600">Loading design workspace...</p>
        </div>
      </div>
    );
  }

  if (!currentDeal) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-gray-600 mb-4">Deal not found</p>
          <Link to="/deals" className="text-blue-600 hover:text-blue-700">
            Back to Deals
          </Link>
        </div>
      </div>
    );
  }

  const renderCenterView = () => {
    switch (mapMode) {
      case '2d':
      case 'satellite':
        return (
          <div className="relative w-full h-full">
            <MapView />
            <MapLayerControls />
          </div>
        );
      case '3d':
        return (
          <Building3DEditor
            dealId={dealId}
            onMetricsChange={handleMetricsChange}
            onSave={handleSave}
          />
        );
      case 'split':
        return (
          <div className="flex w-full h-full">
            <div className="w-1/2 h-full border-r">
              <MapView />
            </div>
            <div className="w-1/2 h-full">
              <Building3DEditor
                dealId={dealId}
                onMetricsChange={handleMetricsChange}
                onSave={handleSave}
              />
            </div>
          </div>
        );
    }
  };

  const renderLeftPanel = () => {
    switch (activePanel) {
      case 'subject':
        return <SubjectPropertyPanel />;
      case 'competition':
        return <CompetitionPanel />;
      case 'traffic':
        return <TrafficPanel />;
      case 'research':
        return <ResearchPanel />;
      default:
        return (
          <div className="p-4 text-center text-gray-500">
            <p className="mb-4">Select a panel to view</p>
            <div className="space-y-2">
              <button
                onClick={() => setActivePanel('subject')}
                className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Subject Property
              </button>
              <button
                onClick={() => setActivePanel('competition')}
                className="w-full px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Competition
              </button>
              <button
                onClick={() => setActivePanel('traffic')}
                className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Traffic Analysis
              </button>
              <button
                onClick={() => setActivePanel('research')}
                className="w-full px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Research
              </button>
            </div>
          </div>
        );
    }
  };

  const renderBottomPanel = () => {
    switch (bottomTab) {
      case 'competition':
        return <CompetitionTable />;
      case 'traffic':
        return <TrafficDataTable />;
      case 'trends':
        return <MarketTrendsTable />;
    }
  };

  return (
    <ThreeDErrorBoundary 
      dealId={dealId}
      onReset={() => window.location.reload()}
    >
      <div className="fixed inset-0 bg-gray-100 flex flex-col">
        {/* Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (hasUnsavedChanges) {
                  if (confirm('You have unsaved changes. Do you want to save before leaving?')) {
                    handleSave();
                  }
                }
                navigate(`/deals`);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="font-medium">Back to Deals</span>
            </button>
            
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-xl font-bold text-gray-900">
                Design Workspace: {currentDeal.name}
              </h1>
              <p className="text-sm text-gray-600">{currentDeal.address}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse" />
                Unsaved changes
              </span>
            )}
            
            <button
              onClick={() => {/* TODO: Export functionality */}}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <button
              onClick={() => {/* TODO: Settings modal */}}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar */}
          <CollapsiblePanel
            title="Property & Analysis"
            isOpen={leftSidebarOpen}
            onToggle={toggleLeftSidebar}
            position="left"
            icon={<Layers className="w-5 h-5" />}
          >
            {/* Panel Tabs */}
            <div className="flex border-b bg-gray-50">
              <button
                onClick={() => setActivePanel('subject')}
                className={`flex-1 p-2 text-xs font-medium transition-colors ${
                  activePanel === 'subject' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Subject Property"
              >
                Property
              </button>
              <button
                onClick={() => setActivePanel('competition')}
                className={`flex-1 p-2 text-xs font-medium transition-colors ${
                  activePanel === 'competition' ? 'bg-white text-red-600 border-b-2 border-red-600' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Competition"
              >
                Competition
              </button>
              <button
                onClick={() => setActivePanel('traffic')}
                className={`flex-1 p-2 text-xs font-medium transition-colors ${
                  activePanel === 'traffic' ? 'bg-white text-green-600 border-b-2 border-green-600' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Traffic"
              >
                Traffic
              </button>
              <button
                onClick={() => setActivePanel('research')}
                className={`flex-1 p-2 text-xs font-medium transition-colors ${
                  activePanel === 'research' ? 'bg-white text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Research"
              >
                Research
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderLeftPanel()}
            </div>
          </CollapsiblePanel>

          {/* Center View (Map/3D) */}
          <div className="flex-1 relative bg-white">
            {renderCenterView()}
            <MapModeSelector />
          </div>

          {/* Right Sidebar */}
          <CollapsiblePanel
            title="Design & Financials"
            isOpen={rightSidebarOpen}
            onToggle={toggleRightSidebar}
            position="right"
            icon={<DollarSign className="w-5 h-5" />}
          >
            <div className="h-full flex flex-col">
              {/* 3D Design Controls */}
              <div className="p-4 border-b">
                <h3 className="font-semibold mb-3">3D Design Controls</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Unit Mix</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <input
                        type="number"
                        placeholder="Studio"
                        className="px-2 py-1 text-sm border rounded"
                      />
                      <input
                        type="number"
                        placeholder="1BR"
                        className="px-2 py-1 text-sm border rounded"
                      />
                      <input
                        type="number"
                        placeholder="2BR"
                        className="px-2 py-1 text-sm border rounded"
                      />
                      <input
                        type="number"
                        placeholder="3BR"
                        className="px-2 py-1 text-sm border rounded"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Building Height</label>
                    <input
                      type="range"
                      min="1"
                      max="40"
                      value={designMetrics.stories}
                      onChange={(e) => updateDesignMetrics({ stories: parseInt(e.target.value) })}
                      className="w-full mt-1"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>1 story</span>
                      <span>{designMetrics.stories} stories</span>
                      <span>40 stories</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Parking</label>
                      <input
                        type="number"
                        value={designMetrics.parkingSpaces}
                        onChange={(e) => updateDesignMetrics({ parkingSpaces: parseInt(e.target.value) })}
                        className="w-full px-2 py-1 text-sm border rounded mt-1"
                        placeholder="Spaces"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Type</label>
                      <select className="w-full px-2 py-1 text-sm border rounded mt-1">
                        <option>Surface</option>
                        <option>Garage</option>
                        <option>Underground</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Real-time Metrics */}
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold mb-2">Real-time Metrics</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white p-2 rounded border">
                    <div className="text-gray-600 text-xs">Units</div>
                    <div className="font-semibold">{designMetrics.units}</div>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <div className="text-gray-600 text-xs">Total SF</div>
                    <div className="font-semibold">{designMetrics.totalSF.toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <div className="text-gray-600 text-xs">FAR</div>
                    <div className="font-semibold">{designMetrics.far.toFixed(2)}</div>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <div className="text-gray-600 text-xs">Efficiency</div>
                    <div className="font-semibold">{(designMetrics.efficiency * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
              
              {/* Financial Summary */}
              <div className="flex-1 overflow-y-auto">
                <FinancialSummaryPanel design3D={design3D!} />
              </div>
            </div>
          </CollapsiblePanel>
        </div>

        {/* Bottom Panel */}
        <BottomPanel
          isOpen={bottomPanelOpen}
          onToggle={toggleBottomPanel}
          activeTab={bottomTab}
          onTabChange={setBottomTab}
        >
          {renderBottomPanel()}
        </BottomPanel>

        {/* Bottom Panel Toggle (when closed) */}
        {!bottomPanelOpen && (
          <button
            onClick={toggleBottomPanel}
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-t-lg px-4 py-1 shadow-lg hover:shadow-xl transition-shadow"
          >
            <ChevronLeft className="w-5 h-5 -rotate-90" />
          </button>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-lg z-50">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="absolute top-2 right-2 text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </ThreeDErrorBoundary>
  );
};