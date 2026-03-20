/**
 * Spatial Analysis Utilities
 * 
 * PostGIS-powered geometry calculations for neighboring property analysis
 */

import { PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { NeighborProperty, PropertyCoordinates } from './neighboringPropertyEngine';

// ============================================================================
// Spatial Query Helpers
// ============================================================================

/**
 * Find all parcels adjacent to the primary parcel
 * Uses PostGIS ST_Touches for true boundary adjacency
 */
export async function findAdjacentParcels(
  client: PoolClient,
  primaryParcel: PropertyCoordinates
): Promise<NeighborProperty[]> {
  
  const query = `
    WITH primary AS (
      SELECT 
        parcel_id,
        ST_GeomFromGeoJSON($1::text) as geom
    )
    SELECT 
      pr.parcel_id,
      pr.address,
      pr.owner_name,
      pr.units,
      pr.land_acres,
      pr.year_built,
      pr.assessed_value,
      pr.appraised_value,
      pr.land_use_code,
      ST_Length(
        ST_Intersection(
          pr.parcel_geometry,
          p.geom
        )::geography
      ) * 3.28084 as shared_boundary_feet,
      ST_Distance(
        ST_Centroid(pr.parcel_geometry),
        ST_Centroid(p.geom)
      ) as distance
    FROM property_records pr
    CROSS JOIN primary p
    WHERE 
      pr.parcel_id != p.parcel_id
      AND ST_Touches(pr.parcel_geometry, p.geom)
    ORDER BY shared_boundary_feet DESC
  `;

  try {
    const result = await client.query(query, [JSON.stringify(primaryParcel.geometry)]);
    
    return result.rows.map(row => ({
      parcelId: row.parcel_id,
      address: row.address,
      ownerName: row.owner_name,
      ownerType: detectOwnerType(row.owner_name),
      units: row.units,
      landAcres: row.land_acres,
      yearBuilt: row.year_built,
      assessedValue: row.assessed_value,
      appraisedValue: row.appraised_value,
      landUseCode: row.land_use_code,
      sharedBoundaryFeet: parseFloat(row.shared_boundary_feet || 0),
      distance: parseFloat(row.distance || 0)
    }));
  } catch (error) {
    logger.error('Error finding adjacent parcels', { error, parcelId: primaryParcel.parcelId });
    throw error;
  }
}

/**
 * Calculate shared boundary length between two parcels
 */
export async function calculateSharedBoundaryLength(
  client: PoolClient,
  parcelId1: string,
  parcelId2: string
): Promise<number> {
  
  const query = `
    SELECT 
      ST_Length(
        ST_Intersection(
          p1.parcel_geometry,
          p2.parcel_geometry
        )::geography
      ) * 3.28084 as shared_boundary_feet
    FROM property_records p1
    CROSS JOIN property_records p2
    WHERE p1.parcel_id = $1
      AND p2.parcel_id = $2
  `;

  const result = await client.query(query, [parcelId1, parcelId2]);
  return parseFloat(result.rows[0]?.shared_boundary_feet || 0);
}

/**
 * Generate combined parcel geometry for assemblage visualization
 */
export async function calculateCombinedParcelGeometry(
  client: PoolClient,
  primaryParcelId: string,
  neighborParcelId: string
): Promise<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  
  const query = `
    SELECT 
      ST_AsGeoJSON(
        ST_Union(p1.parcel_geometry, p2.parcel_geometry)
      )::json as combined_geometry
    FROM property_records p1
    CROSS JOIN property_records p2
    WHERE p1.parcel_id = $1
      AND p2.parcel_id = $2
  `;

  const result = await client.query(query, [primaryParcelId, neighborParcelId]);
  
  if (result.rows.length === 0) {
    throw new Error('Failed to calculate combined geometry');
  }

  return result.rows[0].combined_geometry;
}

/**
 * Analyze spatial benefits of assemblage
 */
export async function analyzeSpatialBenefits(
  client: PoolClient,
  primaryGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  neighbor: NeighborProperty
): Promise<{
  sharedBoundaryFeet: number;
  gainedBuildableArea: number;
  efficiencyGain: number;
}> {
  
  // Get neighbor geometry
  const neighborGeomResult = await client.query(
    `SELECT ST_AsGeoJSON(parcel_geometry)::json as geometry
     FROM property_records
     WHERE parcel_id = $1`,
    [neighbor.parcelId]
  );

  if (neighborGeomResult.rows.length === 0) {
    throw new Error(`Neighbor parcel not found: ${neighbor.parcelId}`);
  }

  const neighborGeometry = neighborGeomResult.rows[0].geometry;

  // Calculate spatial metrics
  const query = `
    WITH 
      primary_geom AS (
        SELECT ST_GeomFromGeoJSON($1::text) as geom
      ),
      neighbor_geom AS (
        SELECT ST_GeomFromGeoJSON($2::text) as geom
      ),
      combined AS (
        SELECT ST_Union(p.geom, n.geom) as geom
        FROM primary_geom p, neighbor_geom n
      ),
      setbacks AS (
        -- Calculate setback buffers (assume 25ft setback)
        SELECT 
          ST_Buffer(p.geom::geography, -7.62)::geometry as primary_buildable,
          ST_Buffer(n.geom::geography, -7.62)::geometry as neighbor_buildable,
          ST_Buffer(c.geom::geography, -7.62)::geometry as combined_buildable
        FROM primary_geom p, neighbor_geom n, combined c
      )
    SELECT 
      ST_Length(
        ST_Intersection(p.geom, n.geom)::geography
      ) * 3.28084 as shared_boundary_feet,
      ST_Area(
        ST_Difference(
          s.combined_buildable::geography,
          ST_Union(s.primary_buildable::geography, s.neighbor_buildable::geography)
        )
      ) * 10.7639 as gained_buildable_sqft,
      ST_Area(s.combined_buildable::geography) * 10.7639 as total_buildable_sqft,
      ST_Area(
        ST_Union(s.primary_buildable::geography, s.neighbor_buildable::geography)
      ) * 10.7639 as separate_buildable_sqft
    FROM primary_geom p, neighbor_geom n, setbacks s
  `;

  const result = await client.query(query, [
    JSON.stringify(primaryGeometry),
    JSON.stringify(neighborGeometry)
  ]);

  const row = result.rows[0];
  const sharedBoundaryFeet = parseFloat(row.shared_boundary_feet || 0);
  const gainedBuildableArea = parseFloat(row.gained_buildable_sqft || 0);
  const totalBuildable = parseFloat(row.total_buildable_sqft || 0);
  const separateBuildable = parseFloat(row.separate_buildable_sqft || 0);

  const efficiencyGain = separateBuildable > 0 
    ? ((totalBuildable - separateBuildable) / separateBuildable) * 100 
    : 0;

  return {
    sharedBoundaryFeet,
    gainedBuildableArea,
    efficiencyGain
  };
}

/**
 * Calculate parcel area and perimeter
 */
export async function calculateParcelMetrics(
  client: PoolClient,
  parcelId: string
): Promise<{
  areaSqft: number;
  perimeterFeet: number;
  centroid: { lat: number; lng: number };
}> {
  
  const query = `
    SELECT 
      ST_Area(parcel_geometry::geography) * 10.7639 as area_sqft,
      ST_Perimeter(parcel_geometry::geography) * 3.28084 as perimeter_feet,
      ST_Y(ST_Centroid(parcel_geometry)) as lat,
      ST_X(ST_Centroid(parcel_geometry)) as lng
    FROM property_records
    WHERE parcel_id = $1
  `;

  const result = await client.query(query, [parcelId]);
  
  if (result.rows.length === 0) {
    throw new Error(`Parcel not found: ${parcelId}`);
  }

  const row = result.rows[0];
  
  return {
    areaSqft: parseFloat(row.area_sqft),
    perimeterFeet: parseFloat(row.perimeter_feet),
    centroid: {
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng)
    }
  };
}

/**
 * Find parcels within distance (not just adjacent)
 * Useful for broader assemblage analysis
 */
export async function findNearbyParcels(
  client: PoolClient,
  parcelId: string,
  maxDistanceFeet: number = 500
): Promise<NeighborProperty[]> {
  
  const query = `
    WITH primary AS (
      SELECT parcel_geometry as geom
      FROM property_records
      WHERE parcel_id = $1
    )
    SELECT 
      pr.parcel_id,
      pr.address,
      pr.owner_name,
      pr.units,
      pr.land_acres,
      pr.year_built,
      pr.assessed_value,
      pr.appraised_value,
      pr.land_use_code,
      0 as shared_boundary_feet,
      ST_Distance(
        ST_Centroid(pr.parcel_geometry),
        ST_Centroid(p.geom)
      )::geography as distance_feet
    FROM property_records pr
    CROSS JOIN primary p
    WHERE 
      pr.parcel_id != $1
      AND ST_DWithin(
        ST_Centroid(pr.parcel_geometry)::geography,
        ST_Centroid(p.geom)::geography,
        $2
      )
    ORDER BY distance_feet
  `;

  const distanceMeters = maxDistanceFeet * 0.3048;
  const result = await client.query(query, [parcelId, distanceMeters]);

  return result.rows.map(row => ({
    parcelId: row.parcel_id,
    address: row.address,
    ownerName: row.owner_name,
    ownerType: detectOwnerType(row.owner_name),
    units: row.units,
    landAcres: row.land_acres,
    yearBuilt: row.year_built,
    assessedValue: row.assessed_value,
    appraisedValue: row.appraised_value,
    landUseCode: row.land_use_code,
    sharedBoundaryFeet: 0,
    distance: parseFloat(row.distance_feet || 0)
  }));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect owner type from owner name
 * (Simple heuristic-based approach, can be enhanced with AI)
 */
function detectOwnerType(ownerName: string | null | undefined): string {
  if (!ownerName) return 'unknown';
  
  const name = ownerName.toLowerCase();
  
  if (name.includes('llc')) return 'llc';
  if (name.includes('trust')) return 'trust';
  if (name.includes('reit')) return 'reit';
  if (name.includes('inc') || name.includes('corp')) return 'corporation';
  if (name.includes('partnership') || name.includes('lp')) return 'partnership';
  
  // Check if it looks like a person's name (has comma or two words)
  if (name.includes(',') || name.split(' ').length === 2) return 'individual';
  
  return 'other';
}

/**
 * Calculate unit mix optimization for assemblage
 * (Future: AI-enhanced with market demand signals)
 */
export function calculateOptimalUnitMix(
  totalUnits: number,
  marketData?: {
    oneBrDemand: number;
    twoBrDemand: number;
    threeBrDemand: number;
  }
): {
  oneBr: number;
  twoBr: number;
  threeBr: number;
} {
  // Default mix if no market data
  if (!marketData) {
    return {
      oneBr: Math.round(totalUnits * 0.55),
      twoBr: Math.round(totalUnits * 0.35),
      threeBr: Math.round(totalUnits * 0.10)
    };
  }

  // Calculate proportional mix based on demand
  const totalDemand = marketData.oneBrDemand + marketData.twoBrDemand + marketData.threeBrDemand;
  
  return {
    oneBr: Math.round(totalUnits * (marketData.oneBrDemand / totalDemand)),
    twoBr: Math.round(totalUnits * (marketData.twoBrDemand / totalDemand)),
    threeBr: Math.round(totalUnits * (marketData.threeBrDemand / totalDemand))
  };
}
