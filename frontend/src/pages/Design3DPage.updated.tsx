import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building3DEditor } from '../components/design';
import { useDealStore } from '../stores/dealStore';
import { useDealDataStore } from '../stores/dealData.store';
import { useAutoSaveWithGuard } from '../hooks/useAutoSave';
import { useDealModule } from '../contexts/DealModuleContext';
import { DesignAIChat } from '../components/design/DesignAIChat';
import type { Design3D } from '../types/financial.types';

export const Design3DPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { fetchDealById, selectedDeal } = useDealStore();

  const {
    marketIntelligence,
    activeScenario,
    updateDesign3D: updateDesign3DContext,
    emitEvent,
  } = useDealModule();
  
  const {
    design3D,
    updateDesign3D,
    currentDeal,
    error: storeError,
  } = useDealDataStore();
  
  const {
    hasUnsavedChanges,
    isSaving,
    error: saveError,
    manualSave,
  } = useAutoSaveWithGuard({
    dealId: dealId || '',
    enabled: true,
    onSaveSuccess: () => {
      console.log('✅ Design auto-saved');
    },
    onSaveError: (error) => {
      console.error('❌ Auto-save failed:', error);
    },
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'metrics' | 'ai'>('metrics');

  const hasMarketMix = !!(marketIntelligence?.recommendedMix && (marketIntelligence.lastUpdated ?? 0) > 0);
  const hasZoningConstraints = !!(activeScenario && (activeScenario.lastUpdated ?? 0) > 0);

  const zoningConstraints = hasZoningConstraints ? {
    maxGba: activeScenario!.maxGba ?? undefined,
    maxUnits: activeScenario!.maxUnits ?? undefined,
    maxStories: activeScenario!.maxStories ?? undefined,
    parkingRequired: activeScenario!.parkingRequired ?? undefined,
    appliedFar: activeScenario!.appliedFar ?? undefined,
  } : undefined;

  const handleApplyMarketMix = useCallback(() => {
    if (!marketIntelligence?.recommendedMix || !design3D) return;
    const mix = marketIntelligence.recommendedMix;
    const total = design3D.totalUnits || 100;
    const updatedDesign: Design3D = {
      ...design3D,
      unitMix: {
        studio: Math.round(total * mix.studio),
        oneBed: Math.round(total * mix.oneBR),
        twoBed: Math.round(total * mix.twoBR),
        threeBed: Math.round(total * mix.threeBR),
      },
      lastModified: new Date().toISOString(),
    };
    updateDesign3D(updatedDesign);
    updateDesign3DContext({
      totalUnits: updatedDesign.totalUnits,
      unitMix: updatedDesign.unitMix,
      rentableSF: updatedDesign.rentableSF,
      parkingSpaces: updatedDesign.parkingSpaces,
      amenitySF: updatedDesign.amenitySF,
      floors: updatedDesign.stories,
      efficiency: updatedDesign.efficiency,
    });
    emitEvent({ source: 'Design3DPage', type: 'design-updated', payload: { dealId, source: 'market-mix-applied' } });
  }, [marketIntelligence, design3D, updateDesign3D, updateDesign3DContext, emitEvent, dealId]);

  // Load deal data on mount
  useEffect(() => {
    const loadDealData = async () => {
      if (!dealId) return;
      
      try {
        setIsLoading(true);
        
        // Load deal if not in store
        if (!selectedDeal || selectedDeal.id !== dealId) {
          await fetchDealById(dealId);
        }
        
        // Data is automatically loaded by useDealDataStore via useAutoSave hook
      } catch (err) {
        console.error('Failed to load deal/design:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDealData();
  }, [dealId, selectedDeal, fetchDealById]);

  const handleMetricsChange = (metrics: any) => {
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
      farMax: zoningConstraints?.appliedFar ?? metrics.farMax,
      lastModified: new Date().toISOString(),
    };

    updateDesign3D(updatedDesign);

    updateDesign3DContext({
      totalUnits: updatedDesign.totalUnits,
      unitMix: updatedDesign.unitMix,
      rentableSF: updatedDesign.rentableSF,
      parkingSpaces: updatedDesign.parkingSpaces,
      amenitySF: updatedDesign.amenitySF,
      floors: updatedDesign.stories,
      efficiency: updatedDesign.efficiency,
    });

    emitEvent({ source: 'Design3DPage', type: 'design-updated', payload: { dealId } });
  };

  const handleExport = async () => {
    if (!design3D) return;
    
    try {
      // Export design data as JSON
      const dataStr = JSON.stringify(design3D, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `design-${dealId}-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export design:', err);
    }
  };

  const handleNavigation = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Do you want to save before leaving?'
      );
      if (confirmLeave) {
        manualSave();
      }
    }
    navigate(`/deals/${dealId}`);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-600">Loading 3D design editor...</p>
        </div>
      </div>
    );
  }

  if (!currentDeal && !selectedDeal) {
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

  const deal = currentDeal || selectedDeal;

  const zoningPillLabel = hasZoningConstraints
    ? `Zoning: ${[
        activeScenario!.maxStories != null ? `${activeScenario!.maxStories} stories` : '',
        activeScenario!.maxUnits != null ? `${activeScenario!.maxUnits} units` : '',
        activeScenario!.appliedFar != null ? `FAR ${activeScenario!.appliedFar}` : '',
      ].filter(Boolean).join(' / ')}`
    : '';

  const marketPillLabel = hasMarketMix
    ? `Mix: ${Math.round(marketIntelligence!.recommendedMix.studio * 100)}% St / ${Math.round(marketIntelligence!.recommendedMix.oneBR * 100)}% 1BR / ${Math.round(marketIntelligence!.recommendedMix.twoBR * 100)}% 2BR / ${Math.round(marketIntelligence!.recommendedMix.threeBR * 100)}% 3BR`
    : '';

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col">
      <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleNavigation}
            className="text-gray-500 hover:text-gray-900 transition flex-shrink-0"
            title="Back to Deal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900 truncate text-sm">{deal?.name}</span>
        </div>

        <div className="flex items-center gap-2">
          {hasMarketMix && (
            <button
              onClick={handleApplyMarketMix}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
              title={marketPillLabel}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Apply Market Mix
            </button>
          )}

          {hasZoningConstraints && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
              title={`Max GBA: ${activeScenario!.maxGba != null ? activeScenario!.maxGba.toLocaleString() + ' SF' : 'N/A'}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {zoningPillLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSaving ? (
            <span className="text-xs text-blue-600 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
              Saving
            </span>
          ) : hasUnsavedChanges ? (
            <span className="text-xs text-orange-600 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
              Unsaved
            </span>
          ) : (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Saved
            </span>
          )}

          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
            title={showMetrics ? 'Hide metrics panel' : 'Show metrics panel'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </button>

          <button
            onClick={handleExport}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
            title="Export design"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>

          <button
            onClick={() => manualSave()}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3D Editor */}
        <div className="flex-1 bg-white">
          <Building3DEditor
            dealId={dealId}
            parcelGeometry={deal?.boundary}
            onMetricsChange={handleMetricsChange}
            onSave={() => manualSave()}
            fullScreen={true}
            showMetricsPanel={false}
            zoningConstraints={zoningConstraints}
            onToggleAIChat={() => {
              setSidebarTab('ai');
              setShowMetrics(true);
            }}
          />
        </div>

        {/* Sidebar: Metrics / AI Chat */}
        {showMetrics && (
          <div className="w-72 bg-gray-50 border-l border-gray-200 flex flex-col">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setSidebarTab('metrics')}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition ${
                  sidebarTab === 'metrics'
                    ? 'text-gray-900 border-b-2 border-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                Metrics
              </button>
              <button
                onClick={() => setSidebarTab('ai')}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition ${
                  sidebarTab === 'ai'
                    ? 'text-indigo-700 border-b-2 border-indigo-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                AI Chat
              </button>
            </div>

            {sidebarTab === 'ai' && (
              <DesignAIChat
                dealId={dealId || ''}
                design3D={design3D}
                dealName={deal?.name}
                zoningConstraints={zoningConstraints}
                marketIntelligence={marketIntelligence ? {
                  recommendedMix: marketIntelligence.recommendedMix,
                  demandPool: marketIntelligence.demandPool,
                  captureRate: marketIntelligence.captureRate,
                  targetDemographic: marketIntelligence.targetDemographic,
                  lastUpdated: marketIntelligence.lastUpdated,
                } : undefined}
                onApplyUpdate={handleMetricsChange}
              />
            )}

            {sidebarTab === 'metrics' && design3D && (
            <div className="flex-1 overflow-y-auto p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Design Metrics</h2>

              {/* Quick Config Presets */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Config</h3>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: 'Garden 3', stories: 3, units: 120, parking: 1.5 },
                    { label: 'Mid-Rise 5', stories: 5, units: 280, parking: 1.25 },
                    { label: 'High-Rise 20+', stories: 22, units: 400, parking: 1.0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        const totalUnits = preset.units;
                        const parkingSpaces = Math.round(totalUnits * preset.parking);
                        const avgUnitSF = preset.stories <= 3 ? 950 : preset.stories <= 8 ? 850 : 750;
                        const efficiency = preset.stories <= 3 ? 0.92 : preset.stories <= 8 ? 0.87 : 0.82;
                        const rentableSF = totalUnits * avgUnitSF;
                        const grossSF = Math.round(rentableSF / efficiency);
                        handleMetricsChange({
                          ...design3D,
                          stories: preset.stories,
                          totalUnits,
                          parkingSpaces,
                          efficiency,
                          rentableSF,
                          grossSF,
                          unitMix: {
                            studio: Math.round(totalUnits * 0.15),
                            oneBed: Math.round(totalUnits * 0.40),
                            twoBed: Math.round(totalUnits * 0.30),
                            threeBed: Math.round(totalUnits * 0.15),
                          },
                          farUtilized: design3D.farMax ? +(grossSF / ((design3D.farMax > 0 ? grossSF / design3D.farMax : grossSF) || 1)).toFixed(2) : design3D.farUtilized,
                        });
                      }}
                      className="px-1 py-1.5 text-[10px] font-medium rounded bg-white border border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition truncate"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit Mix - Editable */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Unit Mix</h3>
                <div className="space-y-1.5">
                  {([
                    { key: 'studio', label: 'Studio' },
                    { key: 'oneBed', label: '1 BR' },
                    { key: 'twoBed', label: '2 BR' },
                    { key: 'threeBed', label: '3 BR' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{label}</span>
                      <input
                        type="number"
                        min={0}
                        value={design3D.unitMix[key]}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const newMix = { ...design3D.unitMix, [key]: val };
                          const totalUnits = newMix.studio + newMix.oneBed + newMix.twoBed + newMix.threeBed;
                          handleMetricsChange({ ...design3D, unitMix: newMix, totalUnits });
                        }}
                        className="w-16 px-1.5 py-0.5 text-xs text-right font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Total Units</span>
                    <span className="text-xs font-bold text-gray-900">{design3D.totalUnits}</span>
                  </div>
                </div>
                {hasMarketMix && (
                  <button
                    onClick={handleApplyMarketMix}
                    className="mt-2 w-full px-2 py-1 text-[10px] font-medium rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition"
                  >
                    Apply Market Mix ({Math.round((marketIntelligence!.recommendedMix.studio) * 100)}/{Math.round((marketIntelligence!.recommendedMix.oneBR) * 100)}/{Math.round((marketIntelligence!.recommendedMix.twoBR) * 100)}/{Math.round((marketIntelligence!.recommendedMix.threeBR) * 100)})
                  </button>
                )}
              </div>

              {/* Building Params - Editable */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Building</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Stories</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={design3D.stories}
                      onChange={(e) => {
                        const stories = Math.max(1, parseInt(e.target.value) || 1);
                        handleMetricsChange({ ...design3D, stories });
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs text-right font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Efficiency</span>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        min={50}
                        max={99}
                        step={1}
                        value={Math.round(design3D.efficiency * 100)}
                        onChange={(e) => {
                          const pct = Math.min(99, Math.max(50, parseInt(e.target.value) || 85));
                          const efficiency = pct / 100;
                          const grossSF = design3D.rentableSF > 0 ? Math.round(design3D.rentableSF / efficiency) : design3D.grossSF;
                          handleMetricsChange({ ...design3D, efficiency, grossSF });
                        }}
                        className="w-12 px-1.5 py-0.5 text-xs text-right font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Rentable SF</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={design3D.rentableSF}
                      onChange={(e) => {
                        const rentableSF = Math.max(0, parseInt(e.target.value) || 0);
                        const grossSF = design3D.efficiency > 0 ? Math.round(rentableSF / design3D.efficiency) : rentableSF;
                        handleMetricsChange({ ...design3D, rentableSF, grossSF });
                      }}
                      className="w-20 px-1.5 py-0.5 text-xs text-right font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Gross SF</span>
                    <span className="text-xs font-medium text-gray-700">{design3D.grossSF.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">FAR Utilized</span>
                    <span className="text-xs font-medium text-gray-700">{design3D.farUtilized.toFixed(2)}</span>
                  </div>
                  {design3D.farMax && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">FAR Max</span>
                      <span className="text-xs font-medium text-gray-700">{design3D.farMax.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Parking - Editable */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Parking</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Spaces</span>
                    <input
                      type="number"
                      min={0}
                      value={design3D.parkingSpaces}
                      onChange={(e) => {
                        const parkingSpaces = Math.max(0, parseInt(e.target.value) || 0);
                        handleMetricsChange({ ...design3D, parkingSpaces });
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs text-right font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Type</span>
                    <select
                      value={design3D.parkingType}
                      onChange={(e) => {
                        handleMetricsChange({ ...design3D, parkingType: e.target.value });
                      }}
                      className="w-24 px-1.5 py-0.5 text-xs font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white"
                    >
                      <option value="surface">Surface</option>
                      <option value="structured">Structured</option>
                      <option value="underground">Underground</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Ratio</span>
                    <span className="text-xs font-medium text-gray-700">
                      {design3D.totalUnits > 0
                        ? (design3D.parkingSpaces / design3D.totalUnits).toFixed(2)
                        : '0.00'} /unit
                    </span>
                  </div>
                </div>
              </div>

              {/* Amenities - Editable */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Amenities</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Total SF</span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={design3D.amenitySF}
                      onChange={(e) => {
                        const amenitySF = Math.max(0, parseInt(e.target.value) || 0);
                        handleMetricsChange({ ...design3D, amenitySF });
                      }}
                      className="w-20 px-1.5 py-0.5 text-xs text-right font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Per Unit</span>
                    <span className="text-xs font-medium text-gray-700">
                      {design3D.totalUnits > 0
                        ? Math.round(design3D.amenitySF / design3D.totalUnits)
                        : '0'} SF
                    </span>
                  </div>
                </div>
              </div>

              {/* Last Modified */}
              <div className="pt-3 border-t border-gray-200">
                <p className="text-[10px] text-gray-400">
                  Modified: {new Date(design3D.lastModified).toLocaleString()}
                </p>
              </div>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Error Messages */}
      {(storeError || saveError) && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{storeError || saveError}</p>
          <button
            onClick={() => {
              // Clear error in store if needed
            }}
            className="absolute top-2 right-2 text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
