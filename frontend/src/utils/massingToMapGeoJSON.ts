/**
 * massingToMapGeoJSON — Converts massing tool sections + parcel coordinates
 * into GeoJSON polygons at real lat/lng positions, ready for Mapbox extrusions.
 *
 * The parcel polygon establishes the coordinate system. Each building section
 * defines a width/depth/position in "section-space" (feet, relative to parcel
 * centroid). We convert these to real lat/lng offsets using Mercator projection.
 */

import type { MassingSection } from '../hooks/useDesignMassing';
import type { MapBuildingSection } from '../components/design/MapBuildingView';

// ─── Mercator helper: offset a lat/lng by feet (approx) ─────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Convert feet offset to approximate lat/lng delta.
 * At ~40°N: 1° lat ≈ 364,000 ft, 1° lng ≈ 278,000 ft (cos(40°) factor)
 */
function feetToLatOffset(feet: number, latitude: number): number {
  return feet / 364000; // ~111km per degree
}

function feetToLngOffset(feet: number, latitude: number): number {
  const latRad = (latitude * Math.PI) / 180;
  return feet / (364000 * Math.cos(latRad));
}

// ─── Site boundary from parcel coordinates ─────────────────────────────────

export interface SiteInfo {
  center: LatLng;
  /** First coordinate of the parcel (origin for section-space) */
  origin: LatLng;
  /** Parcel bounding box in feet */
  boundingBox: { north: number; south: number; east: number; west: number };
  /** Parcel polygon in [lng, lat][] for Mapbox */
  polygon: [number, number][];
}

/**
 * Calculate site info from a parcel's lat/lng coordinates.
 */
export function getSiteInfo(coordinates: LatLng[]): SiteInfo | null {
  if (!coordinates?.length) return null;

  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  return {
    center: { lat: centerLat, lng: centerLng },
    origin: coordinates[0],
    boundingBox: {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
    },
    polygon: coordinates.map(c => [c.lng, c.lat] as [number, number]),
  };
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const WING_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
];

// ─── Convert massing sections to map extrusions ─────────────────────────────

export interface ConversionOpts {
  /** Massing tool output sections */
  sections: MassingSection[];
  /** Parcel coordinates (from ParcelBoundary or store) */
  parcelCoordinates: LatLng[];
  /** Base color scheme (defaults to wing colors) */
  colorScheme?: string[];
}

/**
 * Convert massing sections to MapBuildingSection array.
 * Section-space origin is at the parcel centroid.
 */
/**
 * Convert store BuildingSection[] (flat shape: width, depth, floors, position)
 * into MapBuildingSection[] for the map. Works with both MassingSection results
 * and the store's buildingSections array.
 */
export function buildingSectionsToMapBuildings(
  sections: Array<{ id: string; name: string; width?: number; depth?: number; floors?: number; totalStories?: number; position?: { x: number; y: number }; hasRetail?: boolean; units?: any; color?: string; height?: number }>,
  parcelCoordinates: LatLng[],
): MapBuildingSection[] {
  const site = getSiteInfo(parcelCoordinates);
  if (!site || !sections.length) return [];

  const { center, origin } = site;

  return sections.map((sec, i) => {
    const ftX = sec.position?.x || 0;
    const ftY = sec.position?.y || 0;
    const offsetLat = feetToLatOffset(ftY, center.lat);
    const offsetLng = feetToLngOffset(ftX, center.lng);
    const baseLat = origin.lat + offsetLat;
    const baseLng = origin.lng + offsetLng;

    const w = sec.width || 50;
    const d = sec.depth || 50;
    const widthLat = feetToLatOffset(d, center.lat);
    const widthLng = feetToLngOffset(w, center.lng);

    const polygon: [number, number][] = [
      [baseLng, baseLat],
      [baseLng + widthLng, baseLat],
      [baseLng + widthLng, baseLat + widthLat],
      [baseLng, baseLat + widthLat],
      [baseLng, baseLat],
    ];

    const height = sec.height || (sec.totalStories || sec.floors || 8) * 12;
    const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

    return {
      id: sec.id,
      name: sec.name,
      polygon,
      height,
      baseHeight: 0,
      units: typeof sec.units?.total === 'number' ? sec.units.total : 0,
      color: (sec as any).color || colors[i % colors.length],
      hasRetail: sec.hasRetail,
    };
  });
}

export function massingSectionsToMapBuildings(
  opts: ConversionOpts,
): MapBuildingSection[] {
  const { sections, parcelCoordinates, colorScheme = WING_COLORS } = opts;
  const site = getSiteInfo(parcelCoordinates);
  if (!site || !sections.length) return [];

  const { center, origin } = site;

  return sections.map((sec, i) => {
    // Position in feet relative to origin
    const ftX = sec.position?.x || 0;
    const ftY = sec.position?.y || 0;

    // Convert to lat/lng offset from origin
    const offsetLat = feetToLatOffset(ftY, center.lat);
    const offsetLng = feetToLngOffset(ftX, center.lng);

    // Corner of the building section in real lat/lng
    const baseLat = origin.lat + offsetLat;
    const baseLng = origin.lng + offsetLng;

    // Section dimensions in lat/lng
    const widthLat = feetToLatOffset(sec.depth, center.lat);   // depth is along the y-axis in section-space → lat
    const widthLng = feetToLngOffset(sec.width, center.lng);   // width is along the x-axis → lng

    // Build polygon ring (counter-clockwise for Mapbox)
    const polygon: [number, number][] = [
      [baseLng, baseLat],
      [baseLng + widthLng, baseLat],
      [baseLng + widthLng, baseLat + widthLat],
      [baseLng, baseLat + widthLat],
      [baseLng, baseLat],
    ];
    // Rotate if the section has a rotation
    // (simplified — assumes rotation around center, for basic usage we skip
    //  the full matrix math and just offset by rotation)
    const height = sec.totalStories * 12; // 12ft per story
    const color = colorScheme[i % colorScheme.length];

    return {
      id: sec.id,
      name: sec.name,
      polygon,
      height,
      baseHeight: 0,
      units: sec.units?.total || 0,
      color: sec.hasRetail ? '#06b6d4' : color,
      hasRetail: sec.hasRetail,
    };
  });
}

// ─── Simple polygon offset with rotation ────────────────────────────────────

function rotatePoint(
  cx: number,
  cy: number,
  x: number,
  y: number,
  angleDeg: number,
): { x: number; y: number } {
  if (!angleDeg) return { x, y };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}
