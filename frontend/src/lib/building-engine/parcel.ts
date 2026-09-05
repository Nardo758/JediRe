/**
 * ═══════════════════════════════════════════════════════════════════
 * PARCEL GEOMETRY — GeoJSON → Local Three.js coordinates
 * ═══════════════════════════════════════════════════════════════════
 *
 * Converts assessor parcel polygons into meter-scale local coordinates
 * suitable for Three.js extrusion.
 */

import * as turf from '@turf/turf';
import type { LocalPolygon, ParcelPolygon } from './types';

const SQ_METERS_TO_SQFT = 10.7639;
const DEG_TO_METERS_AT_EQUATOR = 111320;

/**
 * Convert a GeoJSON polygon to local meter coordinates.
 * Origin is the polygon centroid → (0, 0).
 */
export function geojsonToLocal(polygon: ParcelPolygon): LocalPolygon {
  const coords = polygon.coordinates[0]; // Outer ring only (ignore holes for now)
  const turfPolygon = turf.polygon([coords]);

  const centroid = turf.centroid(turfPolygon);
  const [centerLng, centerLat] = centroid.geometry.coordinates;

  // Convert degrees to meters using latitude-adjusted scale
  const metersPerDegLng = DEG_TO_METERS_AT_EQUATOR * Math.cos((centerLat * Math.PI) / 180);
  const metersPerDegLat = DEG_TO_METERS_AT_EQUATOR;

  const vertices: [number, number][] = coords.map(([lng, lat]) => [
    (lng - centerLng) * metersPerDegLng,
    (lat - centerLat) * metersPerDegLat,
  ]);

  // Compute area
  const area = turf.area(turfPolygon);
  const areaSqft = area * SQ_METERS_TO_SQFT;

  // Compute bounding box
  const xs = vertices.map((v) => v[0]);
  const ys = vertices.map((v) => v[1]);
  const bbox: [number, number, number, number] = [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];

  return { vertices, centroid: [centerLng, centerLat], areaSqft, bbox };
}

/**
 * Apply setbacks to a polygon by insetting each edge.
 * Simple approach: shrink bounding box by setback distances.
 * For true parcel-conforming setbacks, we'd need polygon offsetting.
 */
export function applySetbacks(
  polygon: LocalPolygon,
  frontFt: number,
  rearFt: number,
  sideFt: number
): [number, number][] {
  const FEET_TO_METERS = 0.3048;
  const frontM = frontFt * FEET_TO_METERS;
  const rearM = rearFt * FEET_TO_METERS;
  const sideM = sideFt * FEET_TO_METERS;

  const [minX, minY, maxX, maxY] = polygon.bbox;

  // Determine front/rear based on max Y (simplified: assume +Y is "front")
  return [
    [minX + sideM, minY + rearM],
    [maxX - sideM, minY + rearM],
    [maxX - sideM, maxY - frontM],
    [minX + sideM, maxY - frontM],
    [minX + sideM, minY + rearM], // close loop
  ];
}

/**
 * Compute building height in meters from parameters.
 */
export function buildingHeightMeters(levels: number, floorHeightFt: number): number {
  return levels * floorHeightFt * 0.3048;
}
