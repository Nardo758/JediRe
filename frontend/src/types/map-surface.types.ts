/**
 * ═══════════════════════════════════════════════════════════════════
 * MAP SURFACE TYPES — JediRe Property Surface (F7)
 * ═══════════════════════════════════════════════════════════════════
 */

export interface MapViewport {
  center: [number, number];
  zoom: number;
  bounds: [number, number, number, number];
}

export interface ParcelRecord {
  parcelId: string;
  address: string;
  ownerName: string;
  ownerMailingAddress?: string;
  landUse: string;
  lotSizeSqft: number;
  assessedLandValue: number;
  assessedImprovementValue: number;
  totalAppraisedValue: number;
  lastAssessmentDate: string;
  geometry: GeoJSON.Polygon;
  county: string;
  state: string;
  rawAssessorData?: Record<string, unknown>;
}

export interface OwnershipRecord {
  id: string;
  ownerName: string;
  saleDate: string;
  salePrice: number;
}

export interface TrafficCount {
  roadSegmentId: string;
  aadt: number;
  year: number;
  source: string;
  geometry: GeoJSON.LineString;
}

export interface LayerConfig {
  id: string;
  name: string;
  visible: boolean;
  type: 'parcel' | 'traffic' | 'zoning' | 'listing' | 'demographics' | 'custom';
  source?: string;
  style?: Record<string, unknown>;
}

export interface CustomOverlay {
  id: string;
  name: string;
  sourceType: 'geojson' | 'csv' | 'sql';
  sourceData: unknown;
  styling?: Record<string, unknown>;
  isPublic: boolean;
}

export interface MapAgentContext {
  viewport: MapViewport;
  visibleLayers: string[];
  selectedParcel?: ParcelRecord;
  nearbyParcels: ParcelSummary[];
  trafficOnSegment: TrafficCount[];
  listingsInView: unknown[];
  compsInRadius: unknown[];
  zoningDistrict?: unknown;
  demographics?: unknown;
}

export interface ParcelSummary {
  parcelId: string;
  address: string;
  ownerName: string;
  landUse: string;
  totalAppraisedValue: number;
  center: [number, number];
}

export type SurfaceMode = '2d' | '3d' | 'split' | 'ai-generate';
