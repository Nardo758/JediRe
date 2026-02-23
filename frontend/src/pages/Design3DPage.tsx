import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building3DEditor } from '../components/design';
import { useDealStore } from '../stores/dealStore';
import { apiClient } from '../services/api.client';
import type { Design3D } from '../types/financial.types';
import { ThreeDErrorBoundary } from '../components/3DErrorBoundary';
import { Design3DError } from '../components/fallbacks/Design3DError';

export const Design3DPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { currentDeal, loadDeal } = useDealStore();
  
  const [design3D, setDesign3D] = useState<Design3D | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges || !design3D) return;
    
    const timer = setTimeout(() => {
      handleSave(true);
    }, 5000); // Auto-save after 5 seconds of inactivity
    
    return () => clearTimeout(timer);
  }, [design3D, hasUnsavedChanges, autoSaveEnabled]);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleMetricsChange = (metrics: any) => {
    // Update design3D state with metrics from editor
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
  };

  const handleSave = async (isAutoSave = false) => {
    if (!design3D || !dealId) return;
    
    try {
      setIsSaving(true);
      
      const response = await apiClient.post(`/api/v1/deals/${dealId}/design`, {
        design: design3D,
      });
      
      if (response.data.success) {
        setHasUnsavedChanges(false);
        
        if (!isAutoSave) {
          // Show success message for manual saves
          setError(null);
        }
      }
    } catch (err: any) {
      console.error('Failed to save design:', err);
      if (!isAutoSave) {
        setError(err.message || 'Failed to save design');
      }
    } finally {
      setIsSaving(false);
    }
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
      setError('Failed to export design');
    }
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

  return (
    <ThreeDErrorBoundary 
      dealId={dealId}
      onReset={() => window.location.reload()}
    >
      <div className="fixed inset-0 bg-gray-100 flex flex-col">
        {/* Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20">
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
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back to Deal</span>
          </button>
          
          <div className="border-l border-gray-300 pl-4">
            <h1 className="text-xl font-bold text-gray-900">
              3D Design: {currentDeal.name}
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
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            className={`text-sm px-3 py-1 rounded-lg transition ${
              autoSaveEnabled 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {autoSaveEnabled ? '✓ Auto-save ON' : 'Auto-save OFF'}
          </button>

          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="text-gray-600 hover:text-gray-900 transition"
            title={showMetrics ? 'Hide metrics panel' : 'Show metrics panel'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d={showMetrics 
                  ? "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                } 
              />
            </svg>
          </button>

          <button
            onClick={handleExport}
            className="text-gray-600 hover:text-gray-900 transition"
            title="Export design"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
              />
            </svg>
          </button>

          <button
            onClick={() => handleSave()}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {isSaving ? 'Saving...' : 'Save Design'}
          </button>
        </div>
      </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* 3D Editor with dedicated error boundary */}
          <div className="flex-1 bg-white">
            <ThreeDErrorBoundary dealId={dealId}>
              <Building3DEditor
                dealId={dealId}
                parcelGeometry={currentDeal.boundary}
                onMetricsChange={handleMetricsChange}
                onSave={() => handleSave()}
                fullScreen={true}
                showMetricsPanel={showMetrics}
              />
            </ThreeDErrorBoundary>
          </div>

        {/* Metrics Panel (Collapsible) */}
        {showMetrics && design3D && (
          <div className="w-96 bg-gray-50 border-l border-gray-200 overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Design Metrics</h2>
              
              {/* Unit Mix */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Unit Mix</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Studio</span>
                    <span className="font-medium">{design3D.unitMix.studio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">1 Bedroom</span>
                    <span className="font-medium">{design3D.unitMix.oneBed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">2 Bedroom</span>
                    <span className="font-medium">{design3D.unitMix.twoBed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">3 Bedroom</span>
                    <span className="font-medium">{design3D.unitMix.threeBed}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-700">Total Units</span>
                      <span className="text-gray-900">{design3D.totalUnits}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Square Footage */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Square Footage</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Rentable SF</span>
                    <span className="font-medium">{design3D.rentableSF.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Gross SF</span>
                    <span className="font-medium">{design3D.grossSF.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Efficiency</span>
                    <span className="font-medium">{(design3D.efficiency * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Building Details */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Building Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Stories</span>
                    <span className="font-medium">{design3D.stories}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">FAR Utilized</span>
                    <span className="font-medium">{design3D.farUtilized.toFixed(2)}</span>
                  </div>
                  {design3D.farMax && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">FAR Maximum</span>
                      <span className="font-medium">{design3D.farMax.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Parking */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Parking</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Spaces</span>
                    <span className="font-medium">{design3D.parkingSpaces}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Type</span>
                    <span className="font-medium capitalize">{design3D.parkingType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Ratio</span>
                    <span className="font-medium">
                      {design3D.totalUnits > 0 
                        ? (design3D.parkingSpaces / design3D.totalUnits).toFixed(2) 
                        : '0.00'} per unit
                    </span>
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Amenities</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total SF</span>
                    <span className="font-medium">{design3D.amenitySF.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Per Unit</span>
                    <span className="font-medium">
                      {design3D.totalUnits > 0 
                        ? Math.round(design3D.amenitySF / design3D.totalUnits) 
                        : '0'} SF
                    </span>
                  </div>
                </div>
              </div>

              {/* Last Modified */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Last modified: {new Date(design3D.lastModified).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Error Message */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-lg">
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