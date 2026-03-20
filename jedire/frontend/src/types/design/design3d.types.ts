/**
 * Type definitions for 3D Building Design System
 * JEDI RE - Building3DEditor Component
 */

import { Vector3 } from 'three';

// ============================================================================
// Core 3D Geometry Types
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Polygon2D {
  points: Point3D[];
  holes?: Point3D[][];
}

// ============================================================================
// Parcel & Zoning
// ============================================================================

export interface ParcelBoundary {
  id: string;
  coordinates: Coordinates[];
  area: number; // square feet
  extrusionHeight: number; // for 3D visualization
  color?: string;
  opacity?: number;
}

export interface ZoningEnvelope {
  id: string;
  maxHeight: number; // feet
  setbacks: {
    front: number;
    rear: number;
    side: number;
  };
  floorAreaRatio: number; // FAR
  buildableArea: number; // square feet
  wireframe: boolean;
  color?: string;
}

// ============================================================================
// Building Components
// ============================================================================

export interface BuildingSection {
  id: string;
  name: string;
  geometry: {
    footprint: Polygon2D;
    height: number;
    floors: number;
  };
  position: Point3D;
  selected: boolean;
  hovered: boolean;
  visible: boolean;
}

export interface Floor {
  id: string;
  level: number;
  height: number; // feet (typically 10-12)
  area: number; // square feet
  units: Unit[];
  amenities?: string[];
}

export interface Unit {
  id: string;
  type: UnitType;
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  position: Point3D;
  hasBalcony?: boolean;
}

export type UnitType = 'studio' | '1BR' | '2BR' | '3BR' | '3BR+Den' | 'penthouse';

export interface UnitMix {
  studio: number; // percentage
  oneBR: number;
  twoBR: number;
  threeBR: number;
  penthouse?: number;
}

// ============================================================================
// Context Buildings
// ============================================================================

export interface ContextBuilding {
  id: string;
  name: string;
  position: Point3D;
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  stories: number;
  color: string;
  opacity: number;
  type: 'residential' | 'commercial' | 'mixed' | 'unknown';
}

// ============================================================================
// Design Metrics
// ============================================================================

export interface BuildingMetrics {
  unitCount: number;
  totalSF: number;
  residentialSF: number;
  amenitySF: number;
  parkingSpaces: number;
  height: {
    feet: number;
    stories: number;
  };
  coverage: {
    percentage: number;
    buildableArea: number;
    usedArea: number;
  };
  efficiency: number; // percentage (rentable / gross)
  far: number; // floor area ratio
}

// ============================================================================
// 3D Editor State
// ============================================================================

export interface Design3DState {
  // Scene elements
  parcelBoundary: ParcelBoundary | null;
  zoningEnvelope: ZoningEnvelope | null;
  buildingSections: BuildingSection[];
  contextBuildings: ContextBuilding[];
  
  // Metrics
  metrics: BuildingMetrics;
  
  // Selection & Interaction
  selectedSectionId: string | null;
  hoveredSectionId: string | null;
  
  // Camera
  cameraPosition: Point3D;
  cameraTarget: Point3D;
  
  // View settings
  showParcel: boolean;
  showZoningEnvelope: boolean;
  showContextBuildings: boolean;
  showGrid: boolean;
  showMeasurements: boolean;
  
  // Edit mode
  editMode: EditMode;
  
  // History for undo/redo
  history: Design3DSnapshot[];
  historyIndex: number;
  
  // Metadata
  lastUpdated: number;
  lastSynced: number;
}

export type EditMode = 'view' | 'edit' | 'measure' | 'section';

export interface Design3DSnapshot {
  timestamp: number;
  buildingSections: BuildingSection[];
  metrics: BuildingMetrics;
}

// ============================================================================
// AI Integration Hooks (Placeholders for Phase 2)
// ============================================================================

export interface AIImageToTerrainRequest {
  image: File;
  parcelId: string;
  options?: {
    enhanceDetail?: boolean;
    extractContours?: boolean;
  };
}

export interface AIImageToTerrainResponse {
  terrainMesh: any; // Three.js mesh data
  contours: Polygon2D[];
  elevationData: number[][];
  confidence: number;
}

export interface AIDesignGenerationRequest {
  prompt: string;
  constraints: {
    unitCount?: number;
    unitMix?: Partial<UnitMix>;
    maxHeight?: number;
    minEfficiency?: number;
    amenities?: string[];
  };
  parcelBoundary: ParcelBoundary;
  zoningEnvelope: ZoningEnvelope;
}

export interface AIDesignGenerationResponse {
  buildingSections: BuildingSection[];
  metrics: BuildingMetrics;
  unitLayouts: Unit[];
  reasoning: string;
  alternatives?: {
    variant: string;
    sections: BuildingSection[];
    metrics: BuildingMetrics;
  }[];
}

// ============================================================================
// Measurement Overlay Types
// ============================================================================

export interface Measurement {
  id: string;
  type: 'linear' | 'area' | 'height' | 'angle';
  points: Point3D[];
  value: number;
  unit: string;
  label: string;
  visible: boolean;
}

// ============================================================================
// Material & Appearance
// ============================================================================

export interface BuildingMaterial {
  id: string;
  name: string;
  type: 'concrete' | 'glass' | 'metal' | 'brick' | 'other';
  color: string;
  opacity: number;
  metalness?: number;
  roughness?: number;
}

// ============================================================================
// Export Types
// ============================================================================

export interface Design3DExport {
  format: 'gltf' | 'obj' | 'stl' | 'ifc';
  includeMetadata: boolean;
  includeContext: boolean;
  scale: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface Design3DApiResponse {
  success: boolean;
  data?: Design3DState;
  error?: string;
  timestamp: number;
}

export interface SaveDesignRequest {
  dealId: string;
  design: Partial<Design3DState>;
  autoSync?: boolean;
}

export interface LoadDesignRequest {
  dealId: string;
  version?: number;
}
