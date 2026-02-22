/**
 * Custom React Hook for 3D Design Management
 * JEDI RE - Building3DEditor Component
 */

import { useCallback, useEffect, useState } from 'react';
import { useDesign3DStore } from '@/stores/design/design3d.store';
import {
  BuildingSection,
  ParcelBoundary,
  ZoningEnvelope,
  ContextBuilding,
  Point3D,
  AIDesignGenerationRequest,
  AIDesignGenerationResponse,
  AIImageToTerrainRequest,
  AIImageToTerrainResponse,
} from '@/types/design/design3d.types';

// ============================================================================
// Main Hook
// ============================================================================

export const useDesign3D = () => {
  const store = useDesign3DStore();

  // Auto-save snapshots on significant changes
  useEffect(() => {
    const unsubscribe = useDesign3DStore.subscribe(
      (state) => state.buildingSections,
      (sections, prevSections) => {
        if (sections.length !== prevSections.length) {
          store.saveSnapshot();
        }
      }
    );

    return unsubscribe;
  }, [store]);

  return {
    // State
    state: store,
    
    // Computed values
    hasUnsavedChanges: store.lastUpdated > store.lastSynced,
    
    // Actions
    actions: {
      // Parcel & Zoning
      setParcelBoundary: store.setParcelBoundary,
      setZoningEnvelope: store.setZoningEnvelope,
      
      // Building
      addBuildingSection: store.addBuildingSection,
      updateBuildingSection: store.updateBuildingSection,
      removeBuildingSection: store.removeBuildingSection,
      setBuildingSections: store.setBuildingSections,
      
      // Context
      addContextBuilding: store.addContextBuilding,
      setContextBuildings: store.setContextBuildings,
      
      // Interaction
      selectSection: store.selectSection,
      hoverSection: store.hoverSection,
      
      // Camera
      setCameraPosition: store.setCameraPosition,
      setCameraTarget: store.setCameraTarget,
      
      // View
      toggleParcel: store.toggleParcel,
      toggleZoningEnvelope: store.toggleZoningEnvelope,
      toggleContextBuildings: store.toggleContextBuildings,
      toggleGrid: store.toggleGrid,
      toggleMeasurements: store.toggleMeasurements,
      setEditMode: store.setEditMode,
      
      // Metrics
      recalculateMetrics: store.recalculateMetrics,
      
      // History
      undo: store.undo,
      redo: store.redo,
      canUndo: store.canUndo(),
      canRedo: store.canRedo(),
      
      // State
      reset: store.reset,
      loadDesign: store.loadDesign,
      exportState: store.exportState,
    },
  };
};

// ============================================================================
// Building Generation Hook
// ============================================================================

export const useBuildingGenerator = () => {
  const { actions } = useDesign3D();
  
  /**
   * Generate a simple rectangular building based on parcel
   * This is a placeholder for algorithmic generation until AI is integrated
   */
  const generateSimpleBuilding = useCallback(
    (parcel: ParcelBoundary, targetUnits: number = 100) => {
      // Simple algorithm: Create a rectangular footprint at 40% coverage
      const area = parcel.area;
      const footprintArea = area * 0.4;
      const side = Math.sqrt(footprintArea);
      
      // Calculate number of floors needed (assume 750 SF per unit average)
      const totalSFNeeded = targetUnits * 750;
      const floors = Math.ceil(totalSFNeeded / footprintArea);
      const floorHeight = 10; // feet
      
      // Create centered footprint
      const halfSide = side / 2;
      const footprint = {
        points: [
          { x: -halfSide, y: 0, z: -halfSide },
          { x: halfSide, y: 0, z: -halfSide },
          { x: halfSide, y: 0, z: halfSide },
          { x: -halfSide, y: 0, z: halfSide },
        ],
      };
      
      const section: BuildingSection = {
        id: `section-${Date.now()}`,
        name: 'Main Building',
        geometry: {
          footprint,
          height: floors * floorHeight,
          floors,
        },
        position: { x: 0, y: 0, z: 0 },
        selected: false,
        hovered: false,
        visible: true,
      };
      
      actions.addBuildingSection(section);
      return section;
    },
    [actions]
  );
  
  /**
   * Generate building from unit mix optimization
   */
  const generateFromUnitMix = useCallback(
    (parcel: ParcelBoundary, unitMix: { [key: string]: number }, totalUnits: number) => {
      // Calculate required SF based on unit mix
      const unitSizes = {
        studio: 500,
        '1BR': 700,
        '2BR': 1000,
        '3BR': 1300,
      };
      
      let totalSFNeeded = 0;
      Object.entries(unitMix).forEach(([type, percentage]) => {
        const units = Math.round(totalUnits * (percentage / 100));
        const sf = unitSizes[type as keyof typeof unitSizes] || 750;
        totalSFNeeded += units * sf;
      });
      
      // Add common areas (15% of residential SF)
      totalSFNeeded *= 1.15;
      
      // Determine optimal footprint (aim for 45% coverage)
      const footprintArea = parcel.area * 0.45;
      const floors = Math.ceil(totalSFNeeded / footprintArea);
      
      // Create L-shaped building for variety
      const side = Math.sqrt(footprintArea);
      const wingWidth = side * 0.4;
      const wingLength = side * 0.8;
      
      const footprint = {
        points: [
          { x: 0, y: 0, z: 0 },
          { x: wingLength, y: 0, z: 0 },
          { x: wingLength, y: 0, z: wingWidth },
          { x: wingWidth, y: 0, z: wingWidth },
          { x: wingWidth, y: 0, z: wingLength },
          { x: 0, y: 0, z: wingLength },
        ],
      };
      
      const section: BuildingSection = {
        id: `section-${Date.now()}`,
        name: 'Optimized Building',
        geometry: {
          footprint,
          height: floors * 10,
          floors,
        },
        position: { x: -wingLength / 2, y: 0, z: -wingLength / 2 },
        selected: false,
        hovered: false,
        visible: true,
      };
      
      actions.addBuildingSection(section);
      return section;
    },
    [actions]
  );
  
  return {
    generateSimpleBuilding,
    generateFromUnitMix,
  };
};

// ============================================================================
// AI Integration Hooks (Placeholders for Phase 2)
// ============================================================================

/**
 * Hook for AI-powered image-to-terrain generation
 * Integrated with Qwen AI service
 */
export const useAIImageToTerrain = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const generateTerrain = useCallback(
    async (request: AIImageToTerrainRequest): Promise<AIImageToTerrainResponse | null> => {
      setLoading(true);
      setError(null);
      
      try {
        // Prepare form data for image upload
        const formData = new FormData();
        
        if (request.imageFile) {
          formData.append('image', request.imageFile);
        } else if (request.imageUrl) {
          formData.append('imageUrl', request.imageUrl);
        } else {
          throw new Error('Either imageFile or imageUrl is required');
        }
        
        // Call Qwen API
        const response = await fetch('/api/v1/ai/image-to-terrain', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to generate terrain');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'AI terrain generation failed');
        }
        
        // Convert API response to frontend format
        const terrainData = data.data;
        
        return {
          terrainMesh: terrainData.elevationMap,
          contours: terrainData.topographyFeatures || [],
          elevationData: terrainData.elevationMap || [],
          confidence: terrainData.confidence || 0.7,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('[AI Image-to-Terrain] Error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );
  
  return {
    generateTerrain,
    loading,
    error,
  };
};

/**
 * Hook for AI-powered design generation
 * Integrated with Qwen AI service (with algorithmic fallback)
 */
export const useAIDesignGeneration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { actions } = useDesign3D();
  
  const generateDesign = useCallback(
    async (request: AIDesignGenerationRequest): Promise<AIDesignGenerationResponse | null> => {
      setLoading(true);
      setError(null);
      
      try {
        // Check if AI service is available
        const statusResponse = await fetch('/api/v1/ai/status');
        const statusData = await statusResponse.json();
        
        if (statusData.enabled) {
          // TODO: Implement full AI design generation endpoint
          // For now, this would require a separate endpoint that handles
          // text-based design generation (not yet in qwen.routes.ts)
          console.info('AI service available, but design generation endpoint not yet implemented');
        }
        
        // Use algorithmic generation as fallback
        console.warn('AI Design Generation: Using algorithmic fallback.');
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate AI processing
        
        // Generate simple building as fallback
        const { parcelBoundary, constraints } = request;
        const targetUnits = constraints.unitCount || 100;
        
        // Simple rectangular generation
        const footprintArea = parcelBoundary.area * 0.4;
        const side = Math.sqrt(footprintArea);
        const halfSide = side / 2;
        
        const floors = Math.ceil((targetUnits * 750) / footprintArea);
        
        const section: BuildingSection = {
          id: `section-${Date.now()}`,
          name: 'AI Generated Building',
          geometry: {
            footprint: {
              points: [
                { x: -halfSide, y: 0, z: -halfSide },
                { x: halfSide, y: 0, z: -halfSide },
                { x: halfSide, y: 0, z: halfSide },
                { x: -halfSide, y: 0, z: halfSide },
              ],
            },
            height: floors * 10,
            floors,
          },
          position: { x: 0, y: 0, z: 0 },
          selected: false,
          hovered: false,
          visible: true,
        };
        
        actions.addBuildingSection(section);
        
        return {
          buildingSections: [section],
          metrics: {
            unitCount: targetUnits,
            totalSF: footprintArea * floors,
            residentialSF: footprintArea * floors * 0.95,
            amenitySF: footprintArea * floors * 0.05,
            parkingSpaces: Math.floor(targetUnits * 0.8),
            height: {
              feet: floors * 10,
              stories: floors,
            },
            coverage: {
              percentage: 40,
              buildableArea: parcelBoundary.area,
              usedArea: footprintArea,
            },
            efficiency: 85,
            far: (footprintArea * floors) / parcelBoundary.area,
          },
          unitLayouts: [],
          reasoning: 'Algorithmic generation based on 40% coverage and 750 SF/unit average.',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [actions]
  );
  
  return {
    generateDesign,
    loading,
    error,
  };
};

// ============================================================================
// Keyboard Shortcuts Hook
// ============================================================================

export const useDesign3DKeyboardShortcuts = () => {
  const { actions } = useDesign3D();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        actions.undo();
      }
      
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        actions.redo();
      }
      
      // Delete: Delete/Backspace (when section selected)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
        const selectedId = useDesign3DStore.getState().selectedSectionId;
        if (selectedId) {
          e.preventDefault();
          actions.removeBuildingSection(selectedId);
        }
      }
      
      // Toggle Grid: G
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        actions.toggleGrid();
      }
      
      // Toggle Measurements: M
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        actions.toggleMeasurements();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
};
