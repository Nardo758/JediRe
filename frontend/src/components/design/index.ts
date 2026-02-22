/**
 * Design Components - Export Index
 * Centralizes exports for easy importing
 */

export { Building3DEditor, default } from './Building3DEditor';

// Re-export hooks for convenience
export { 
  useDesign3D, 
  useBuildingGenerator,
  useAIDesignGeneration,
  useAIImageToTerrain,
  useDesign3DKeyboardShortcuts
} from '@/hooks/design/useDesign3D';

// Re-export store
export { useDesign3DStore } from '@/stores/design/design3d.store';

// Re-export types
export type {
  Design3DState,
  BuildingSection,
  BuildingMetrics,
  ParcelBoundary,
  ZoningEnvelope,
  ContextBuilding,
  EditMode,
  Point3D,
  Polygon2D,
  UnitMix,
  UnitType,
} from '@/types/design/design3d.types';
