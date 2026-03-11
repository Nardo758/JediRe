/**
 * Spatial Query Helpers - PostGIS utilities for Asset Map Intelligence
 * Handles radius queries, distance calculations, and geometry operations
 */

import { PoolClient } from 'pg';
import { Location, GeoJSONGeometry } from '../types/assetMapIntelligence.types';
import { logger } from './logger';

/**
 * Calculate distance between two points in miles
 */
export function calculateDistance(point1: Location, point2: Location): number {
  const lat1Rad = (point1.lat * Math.PI) / 180;
  const lat2Rad = (point2.lat * Math.PI) / 180;
  const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadiusMiles = 3958.8; // Earth's radius in miles

  return earthRadiusMiles * c;
}

/**
 * Convert Location to PostGIS point format
 */
export function locationToPostGIS(location: Location): string {
  return `ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography`;
}

/**
 * Convert GeoJSON geometry to PostGIS geometry
 */
export function geometryToPostGIS(geometry: GeoJSONGeometry): string {
  const geoJSON = JSON.stringify(geometry);
  return `ST_SetSRID(ST_GeomFromGeoJSON('${geoJSON}'), 4326)::geography`;
}

/**
 * Find assets within radius of a location
 */
export async function findAssetsWithinRadius(
  client: PoolClient,
  location: Location,
  radiusMiles: number
): Promise<Array<{ id: string; distanceMiles: number }>> {
  try {
    const radiusMeters = radiusMiles * 1609.34;
    const point = locationToPostGIS(location);

    const query = `
      SELECT 
        id,
        ROUND(ST_Distance(location::geography, ${point})::numeric / 1609.34, 2) as distance_miles
      FROM deals
      WHERE location IS NOT NULL
        AND ST_DWithin(location::geography, ${point}, $1)
      ORDER BY distance_miles ASC
    `;

    const result = await client.query(query, [radiusMeters]);
    return result.rows.map(row => ({
      id: row.id,
      distanceMiles: parseFloat(row.distance_miles),
    }));
  } catch (error) {
    logger.error('Error finding assets within radius:', error);
    throw new Error('Failed to execute spatial query');
  }
}

/**
 * Find news events within radius of an asset
 */
export async function findNewsEventsWithinRadius(
  client: PoolClient,
  assetId: string,
  radiusMiles: number
): Promise<Array<{ id: string; distanceMiles: number }>> {
  try {
    const radiusMeters = radiusMiles * 1609.34;

    const query = `
      SELECT 
        ne.id,
        ROUND(ST_Distance(ne.location::geography, d.location::geography)::numeric / 1609.34, 2) as distance_miles
      FROM news_events ne
      CROSS JOIN deals d
      WHERE d.id = $1
        AND ne.location IS NOT NULL
        AND d.location IS NOT NULL
        AND ST_DWithin(ne.location::geography, d.location::geography, $2)
      ORDER BY distance_miles ASC
    `;

    const result = await client.query(query, [assetId, radiusMeters]);
    return result.rows.map(row => ({
      id: row.id,
      distanceMiles: parseFloat(row.distance_miles),
    }));
  } catch (error) {
    logger.error('Error finding news events within radius:', error);
    throw new Error('Failed to execute spatial query');
  }
}

/**
 * Calculate impact score based on distance and event type
 * Closer events have higher scores (1-10 scale)
 */
export function calculateImpactScore(distanceMiles: number, eventType?: string): number {
  // Base score: inverse relationship with distance
  // 0-1 mile = 10, 1-2 miles = 8, 2-3 miles = 6, 3-4 miles = 4, 4-5 miles = 2, 5+ miles = 1
  let score = Math.max(1, Math.min(10, 10 - Math.floor(distanceMiles * 2)));

  // Adjust based on event type (if provided)
  if (eventType) {
    const highImpactTypes = ['employment', 'infrastructure', 'development'];
    const mediumImpactTypes = ['policy', 'economic'];
    const lowImpactTypes = ['community', 'other'];

    if (highImpactTypes.includes(eventType.toLowerCase())) {
      score = Math.min(10, score + 1);
    } else if (lowImpactTypes.includes(eventType.toLowerCase())) {
      score = Math.max(1, score - 1);
    }
  }

  return score;
}

/**
 * Check if a point is within a geometry
 */
export async function isPointWithinGeometry(
  client: PoolClient,
  point: Location,
  geometry: GeoJSONGeometry
): Promise<boolean> {
  try {
    const pointSQL = locationToPostGIS(point);
    const geometrySQL = geometryToPostGIS(geometry);

    const query = `SELECT ST_Within(${pointSQL}, ${geometrySQL}) as is_within`;
    const result = await client.query(query);
    return result.rows[0]?.is_within || false;
  } catch (error) {
    logger.error('Error checking point within geometry:', error);
    return false;
  }
}

/**
 * Validate location coordinates
 */
export function isValidLocation(location: Location): boolean {
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return false;
  }

  // Check valid ranges
  if (location.lat < -90 || location.lat > 90) {
    return false;
  }

  if (location.lng < -180 || location.lng > 180) {
    return false;
  }

  return true;
}

/**
 * Validate GeoJSON geometry
 */
export function isValidGeometry(geometry: GeoJSONGeometry): boolean {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    return false;
  }

  const validTypes = ['Point', 'Polygon', 'LineString', 'MultiPoint', 'MultiPolygon', 'MultiLineString'];
  if (!validTypes.includes(geometry.type)) {
    return false;
  }

  // Basic coordinate validation
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return false;
  }

  return true;
}

/**
 * Get bounding box for a set of locations
 */
export function getBoundingBox(locations: Location[]): {
  north: number;
  south: number;
  east: number;
  west: number;
} | null {
  if (!locations || locations.length === 0) {
    return null;
  }

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const loc of locations) {
    if (loc.lat > north) north = loc.lat;
    if (loc.lat < south) south = loc.lat;
    if (loc.lng > east) east = loc.lng;
    if (loc.lng < west) west = loc.lng;
  }

  return { north, south, east, west };
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} feet`;
  } else if (miles < 1) {
    return `${miles.toFixed(1)} miles`;
  } else {
    return `${miles.toFixed(2)} miles`;
  }
}
