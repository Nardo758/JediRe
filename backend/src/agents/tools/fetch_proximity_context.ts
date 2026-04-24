/**
 * Agent Tool: Fetch Proximity Context
 * 
 * Gets proximity scores for a property location including:
 * - Transit access (MARTA, BeltLine)
 * - Grocery stores (premium vs standard)
 * - Major employers
 * - Schools and ratings
 * - Parks and greenspace
 * - Safety/crime metrics
 */

import { z } from 'zod';
import type { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { getProximityService, ProximityScores } from '../../services/proximity';

export const fetchProximityContextSchema = z.object({
  latitude: z.number().describe('Property latitude'),
  longitude: z.number().describe('Property longitude'),
  address: z.string().optional().describe('Property address'),
  propertyId: z.string().optional().describe('Property ID for caching'),
  includeNearbyPOIs: z.boolean().optional().default(false).describe('Include list of nearby POIs')
});

export type FetchProximityContextParams = z.infer<typeof fetchProximityContextSchema>;

export interface ProximityContextResult {
  scores: ProximityScores;
  summary: {
    transitGrade: 'excellent' | 'good' | 'fair' | 'poor';
    groceryGrade: 'excellent' | 'good' | 'fair' | 'poor';
    schoolGrade: 'excellent' | 'good' | 'fair' | 'poor';
    safetyGrade: 'excellent' | 'good' | 'fair' | 'poor';
    estimatedRentPremium: string;
  };
  highlights: string[];
  concerns: string[];
  nearbyPOIs?: Array<{
    type: string;
    name: string;
    distanceMiles: number;
  }>;
}

export async function fetchProximityContext(
  params: FetchProximityContextParams,
  pool: Pool
): Promise<ProximityContextResult> {
  const service = getProximityService(pool);
  
  // Compute or retrieve cached scores
  const scores = await service.computeProximityScores(
    params.latitude,
    params.longitude,
    {
      address: params.address,
      propertyId: params.propertyId,
      saveToDb: true
    }
  );
  
  // Calculate grades
  const transitGrade = calculateGrade(scores.transit.nearestStationMiles, [0.25, 0.5, 1.0]);
  const groceryGrade = calculateGrade(scores.grocery.nearestMiles, [0.25, 0.5, 1.0]);
  const schoolGrade = calculateSchoolGrade(scores.schools.elementaryRating);
  const safetyGrade = calculateSafetyGrade(scores.safety.crimeIndex);
  
  // Generate highlights and concerns
  const highlights: string[] = [];
  const concerns: string[] = [];
  
  // Transit
  if (scores.transit.nearestStationMiles && scores.transit.nearestStationMiles <= 0.25) {
    highlights.push(`Excellent transit: ${scores.transit.nearestStationName} station just ${(scores.transit.nearestStationMiles * 5280).toFixed(0)} feet away`);
  } else if (scores.transit.nearestStationMiles && scores.transit.nearestStationMiles > 1.0) {
    concerns.push(`Limited transit access: nearest station is ${scores.transit.nearestStationMiles.toFixed(1)} miles away`);
  }
  
  // BeltLine
  if (scores.parks.beltlineMiles && scores.parks.beltlineMiles <= 0.25) {
    highlights.push(`BeltLine adjacent: ${(scores.parks.beltlineMiles * 5280).toFixed(0)} feet to trail access (+10% rent premium)`);
  }
  
  // Grocery
  if (scores.grocery.nearestType === 'premium' && scores.grocery.nearestMiles && scores.grocery.nearestMiles <= 0.5) {
    highlights.push(`Premium grocery nearby: ${scores.grocery.nearestName} within ${scores.grocery.nearestMiles.toFixed(1)} miles`);
  } else if (!scores.grocery.nearestMiles || scores.grocery.nearestMiles > 1.0) {
    concerns.push('No grocery stores within 1 mile');
  }
  
  // Employers
  if (scores.employers.majorWithin5Miles && scores.employers.majorWithin5Miles >= 5) {
    highlights.push(`Strong employment access: ${scores.employers.majorWithin5Miles} major employers within 5 miles (${scores.employers.totalJobsWithin5Miles?.toLocaleString()} jobs)`);
  }
  
  // Schools
  if (scores.schools.elementaryRating && scores.schools.elementaryRating >= 8) {
    highlights.push(`Excellent schools: ${scores.schools.elementaryName} rated ${scores.schools.elementaryRating}/10`);
  } else if (scores.schools.elementaryRating && scores.schools.elementaryRating <= 4) {
    concerns.push(`Lower school ratings: ${scores.schools.elementaryName} rated ${scores.schools.elementaryRating}/10`);
  }
  
  // Safety
  if (scores.safety.crimeIndex && scores.safety.crimeIndex > 120) {
    concerns.push(`Elevated crime: ${scores.safety.crimeIndex.toFixed(0)}% of city average`);
  } else if (scores.safety.crimeIndex && scores.safety.crimeIndex < 80) {
    highlights.push(`Low crime area: ${scores.safety.crimeIndex.toFixed(0)}% of city average`);
  }
  
  // Parks
  if (scores.parks.parksWithin1Mile && scores.parks.parksWithin1Mile >= 3) {
    highlights.push(`Green space access: ${scores.parks.parksWithin1Mile} parks within 1 mile`);
  }
  
  // Estimated premium
  const totalPremium = scores.estimatedPremiums.totalPremiumPct || 0;
  const estimatedRentPremium = totalPremium > 0 
    ? `+${(totalPremium * 100).toFixed(0)}% rent premium potential`
    : 'No significant location premium';
  
  const result: ProximityContextResult = {
    scores,
    summary: {
      transitGrade,
      groceryGrade,
      schoolGrade,
      safetyGrade,
      estimatedRentPremium
    },
    highlights,
    concerns
  };
  
  // Include nearby POIs if requested
  if (params.includeNearbyPOIs) {
    const allPOIs = await Promise.all([
      service.findNearbyPOIs(params.latitude, params.longitude, ['transit_station'], 1.0),
      service.findNearbyPOIs(params.latitude, params.longitude, ['grocery_premium', 'grocery_standard'], 1.0),
      service.findNearbyPOIs(params.latitude, params.longitude, ['employer_major', 'employer_tech'], 3.0)
    ]);
    
    result.nearbyPOIs = allPOIs.flat().map(poi => ({
      type: poi.poiType,
      name: poi.poiName,
      distanceMiles: poi.distanceMiles
    })).slice(0, 15);
  }
  
  return result;
}

function calculateGrade(
  distanceMiles: number | undefined,
  thresholds: [number, number, number]
): 'excellent' | 'good' | 'fair' | 'poor' {
  if (!distanceMiles) return 'poor';
  if (distanceMiles <= thresholds[0]) return 'excellent';
  if (distanceMiles <= thresholds[1]) return 'good';
  if (distanceMiles <= thresholds[2]) return 'fair';
  return 'poor';
}

function calculateSchoolGrade(rating: number | undefined): 'excellent' | 'good' | 'fair' | 'poor' {
  if (!rating) return 'fair';
  if (rating >= 8) return 'excellent';
  if (rating >= 6) return 'good';
  if (rating >= 4) return 'fair';
  return 'poor';
}

function calculateSafetyGrade(crimeIndex: number | undefined): 'excellent' | 'good' | 'fair' | 'poor' {
  if (!crimeIndex) return 'fair';
  if (crimeIndex < 80) return 'excellent';
  if (crimeIndex < 100) return 'good';
  if (crimeIndex < 120) return 'fair';
  return 'poor';
}

// Tool definition for agent registry
export const fetchProximityContextTool = {
  name: 'fetch_proximity_context',
  description: `Get proximity scores for a property location including transit access, 
grocery stores, major employers, schools, parks, and safety metrics. 
Returns grades (excellent/good/fair/poor) and estimated rent premiums.
Use this when analyzing a property's location value or competitive positioning.`,
  inputSchema: fetchProximityContextSchema,
  outputSchema: z.any(),
  execute: async (input, _ctx) => fetchProximityContext(input, getPool())
};
