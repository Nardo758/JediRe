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
 * TODO: Integrate with Qwen API in Phase 2
 */
export const useAIImageToTerrain = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const generateTerrain = useCallback(
    async (request: AIImageToTerrainRequest): Promise<AIImageToTerrainResponse | null> => {
      setLoading(true);
      setError(null);
      
      try {
        // TODO: Phase 2 - Send to Qwen API
        // const response = await fetch('/api/ai/image-to-terrain', {
        //   method: 'POST',
        //   body: formData,
        // });
        // const data = await response.json();
        // return data;
        
        // Placeholder: Return mock response
        console.warn('AI Image-to-Terrain: Not yet implemented. Using mock data.');
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
        
        return {
          terrainMesh: null,
          contours: [],
          elevationData: [],
          confidence: 0.85,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
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
 * TODO: Integrate with Qwen API in Phase 2
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
        // TODO: Phase 2 - Send to Qwen API
        // const response = await fetch('/api/ai/generate-design', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(request),
        // });
        // const data = await response.json();
        // return data;
        
        // Placeholder: Use algorithmic generation
        console.warn('AI Design Generation: Not yet implemented. Using algorithmic fallback.');
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call
        
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
