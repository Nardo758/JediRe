/**
 * ═══════════════════════════════════════════════════════════════════
 * BUILDING ENGINE TYPES — Procedural 3D Building from Parcel Polygon
 * ═══════════════════════════════════════════════════════════════════
 */

export type FacadeType = 'brick' | 'glass' | 'concrete' | 'wood_panel' | 'stucco' | 'mixed';
export type RoofType = 'flat' | 'pitched' | 'terraced';
export type TimeOfDay = 'golden_hour' | 'midday' | 'dusk' | 'overcast';

export interface BuildingParameters {
  /** Number of floors */
  levels: number;
  /** Floor-to-floor height in feet */
  floorHeight: number;
  /** Primary facade material */
  facade: FacadeType;
  /** Roof style */
  roofType: RoofType;
  /** Front setback from parcel edge in feet */
  setbackFront: number;
  /** Rear setback from parcel edge in feet */
  setbackRear: number;
  /** Side setback from parcel edge in feet */
  setbackSide: number;
  /** Percentage of facade covered by windows (0-1) */
  windowRatio: number;
  /** Balcony depth in feet (0 = no balconies) */
  balconyDepth: number;
  /** Time of day for lighting */
  timeOfDay: TimeOfDay;
}

export const DEFAULT_BUILDING_PARAMS: BuildingParameters = {
  levels: 4,
  floorHeight: 12,
  facade: 'brick',
  roofType: 'flat',
  setbackFront: 10,
  setbackRear: 10,
  setbackSide: 5,
  windowRatio: 0.35,
  balconyDepth: 0,
  timeOfDay: 'golden_hour',
};

/** Raw GeoJSON polygon from assessor API */
export type ParcelPolygon = GeoJSON.Polygon;

/** Converted local-coordinate polygon ready for Three.js */
export interface LocalPolygon {
  /** Vertices in local meters from centroid, clockwise */
  vertices: [number, number][];
  /** Centroid in [lng, lat] */
  centroid: [number, number];
  /** Area in square feet */
  areaSqft: number;
  /** Bounding box in local meters: [minX, minY, maxX, maxY] */
  bbox: [number, number, number, number];
}
