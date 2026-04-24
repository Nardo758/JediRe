/**
 * Proximity Service
 * 
 * Computes proximity scores for properties based on nearby amenities,
 * transit, employers, schools, and other points of interest.
 */

import { Pool } from 'pg';
import { ProximityScores, NearbyPOI, PointOfInterest, POIType } from './types';

// Distance thresholds for different POI types (in miles)
const PROXIMITY_THRESHOLDS = {
  transit: { excellent: 0.25, good: 0.5, fair: 1.0 },
  grocery: { excellent: 0.25, good: 0.5, fair: 1.0 },
  employer: { radius: 5.0 },
  hospital: { radius: 5.0 },
  school: { radius: 2.0 },
  park: { radius: 1.0 },
};

// Rent premium estimates by proximity factor
const PREMIUM_ESTIMATES = {
  transitExcellent: 0.08,  // 8% premium for transit within 0.25mi
  transitGood: 0.04,       // 4% for transit within 0.5mi
  groceryPremium: 0.05,    // 5% for premium grocery within 0.5mi
  schoolExcellent: 0.06,   // 6% for 8+ rated schools
  beltline: 0.10,          // 10% for BeltLine adjacency
  lowCrime: 0.05,          // 5% for crime index < 80
};

export class ProximityService {
  constructor(private pool: Pool) {}
  
  /**
   * Compute full proximity scores for a location
   */
  async computeProximityScores(
    latitude: number,
    longitude: number,
    options: {
      address?: string;
      propertyId?: string;
      parcelId?: string;
      saveToDb?: boolean;
    } = {}
  ): Promise<ProximityScores> {
    const startTime = Date.now();
    const dataSources: string[] = [];
    
    // Fetch all nearby POIs in parallel
    const [
      transitPOIs,
      groceryPOIs,
      employerPOIs,
      healthcarePOIs,
      schoolPOIs,
      parkPOIs,
      retailPOIs
    ] = await Promise.all([
      this.findNearbyPOIs(latitude, longitude, ['transit_station', 'bus_stop', 'transit_hub'], 2.0),
      this.findNearbyPOIs(latitude, longitude, ['grocery_premium', 'grocery_standard', 'grocery_discount'], 2.0),
      this.findNearbyPOIs(latitude, longitude, ['employer_major', 'employer_tech', 'employer_healthcare', 'employer_finance'], 5.0),
      this.findNearbyPOIs(latitude, longitude, ['hospital', 'urgent_care', 'medical_campus'], 5.0),
      this.findNearbyPOIs(latitude, longitude, ['school_elementary', 'school_middle', 'school_high', 'university'], 3.0),
      this.findNearbyPOIs(latitude, longitude, ['park', 'trail', 'beltline', 'greenspace'], 2.0),
      this.findNearbyPOIs(latitude, longitude, ['mall', 'retail_center', 'restaurant_cluster'], 3.0)
    ]);
    
    dataSources.push('poi_database');
    
    // Compute transit scores
    const nearestTransit = transitPOIs.find(p => p.poiType === 'transit_station');
    const nearestBusStop = transitPOIs.find(p => p.poiType === 'bus_stop');
    const transitScore = this.computeTransitScore(nearestTransit, nearestBusStop, transitPOIs);
    
    // Compute grocery scores
    const premiumGroceries = groceryPOIs.filter(p => p.poiType === 'grocery_premium');
    const nearestGrocery = groceryPOIs[0];
    
    // Compute employer scores
    const within3Miles = employerPOIs.filter(p => p.distanceMiles <= 3);
    const within5Miles = employerPOIs.filter(p => p.distanceMiles <= 5);
    const nearestMajorEmployer = employerPOIs[0];
    const totalJobs = within5Miles.reduce((sum, e) => sum + (e.employeeCount || 0), 0);
    
    // Compute school scores
    const nearestElementary = schoolPOIs.find(p => p.poiType === 'school_elementary');
    const nearestMiddle = schoolPOIs.find(p => p.poiType === 'school_middle');
    const nearestHigh = schoolPOIs.find(p => p.poiType === 'school_high');
    const universities = schoolPOIs.filter(p => p.poiType === 'university' && p.distanceMiles <= 5);
    
    // Compute park scores
    const nearestPark = parkPOIs.find(p => ['park', 'greenspace'].includes(p.poiType));
    const parksWithin1Mile = parkPOIs.filter(p => p.distanceMiles <= 1);
    const beltlineAccess = parkPOIs.find(p => p.poiType === 'beltline');
    
    // Compute healthcare scores
    const nearestHospital = healthcarePOIs.find(p => p.poiType === 'hospital');
    const urgentCares = healthcarePOIs.filter(p => p.poiType === 'urgent_care' && p.distanceMiles <= 3);
    
    // Build scores object
    const scores: ProximityScores = {
      propertyId: options.propertyId,
      parcelId: options.parcelId,
      address: options.address || '',
      latitude,
      longitude,
      
      transit: {
        nearestStationName: nearestTransit?.poiName,
        nearestStationType: nearestTransit?.poiSubtype,
        nearestStationMiles: nearestTransit?.distanceMiles,
        nearestBusStopMiles: nearestBusStop?.distanceMiles,
        routesWithinQuarterMile: transitPOIs.filter(p => p.distanceMiles <= 0.25).length,
        transitScore: transitScore,
      },
      
      grocery: {
        nearestName: nearestGrocery?.poiName,
        nearestType: nearestGrocery?.poiType.replace('grocery_', '') as any,
        nearestMiles: nearestGrocery?.distanceMiles,
        countWithin1Mile: groceryPOIs.filter(p => p.distanceMiles <= 1).length,
        premiumCountWithin2Miles: premiumGroceries.filter(p => p.distanceMiles <= 2).length,
      },
      
      employers: {
        majorWithin3Miles: within3Miles.length,
        majorWithin5Miles: within5Miles.length,
        nearestMajorName: nearestMajorEmployer?.poiName,
        nearestMajorMiles: nearestMajorEmployer?.distanceMiles,
        totalJobsWithin5Miles: totalJobs,
      },
      
      retail: {
        restaurantsWithinHalfMile: retailPOIs.filter(p => 
          p.poiType === 'restaurant_cluster' && p.distanceMiles <= 0.5
        ).length * 10, // Estimate
        retailSqftWithin1Mile: undefined, // Would need additional data
        nearestMallMiles: retailPOIs.find(p => p.poiType === 'mall')?.distanceMiles,
      },
      
      healthcare: {
        nearestHospitalName: nearestHospital?.poiName,
        nearestHospitalMiles: nearestHospital?.distanceMiles,
        urgentCaresWithin3Miles: urgentCares.length,
      },
      
      schools: {
        elementaryName: nearestElementary?.poiName,
        elementaryRating: nearestElementary?.schoolRating,
        middleName: nearestMiddle?.poiName,
        middleRating: nearestMiddle?.schoolRating,
        highName: nearestHigh?.poiName,
        highRating: nearestHigh?.schoolRating,
        districtName: nearestElementary?.schoolDistrict,
        districtRating: undefined, // Would need district data
        universitiesWithin5Miles: universities.length,
      },
      
      parks: {
        nearestParkMiles: nearestPark?.distanceMiles,
        parksWithin1Mile: parksWithin1Mile.length,
        greenspaceAcresWithin1Mile: undefined, // Would need GIS data
        beltlineMiles: beltlineAccess?.distanceMiles,
      },
      
      safety: {
        crimeIndex: undefined, // Would need crime API
        violentCrimeIndex: undefined,
        propertyCrimeIndex: undefined,
        crimeTrend: undefined,
      },
      
      scores: {
        walkScore: undefined, // Would need Walk Score API
        transitScore: transitScore,
        bikeScore: undefined,
      },
      
      estimatedPremiums: this.estimatePremiums({
        transitDistance: nearestTransit?.distanceMiles,
        groceryType: nearestGrocery?.poiType,
        groceryDistance: nearestGrocery?.distanceMiles,
        schoolRating: nearestElementary?.schoolRating,
        beltlineDistance: beltlineAccess?.distanceMiles,
        crimeIndex: undefined,
      }),
      
      computedAt: new Date(),
      dataSources,
    };
    
    // Save to database if requested
    if (options.saveToDb) {
      await this.saveProximityScores(scores);
    }
    
    console.log(`[Proximity] Computed scores in ${Date.now() - startTime}ms`);
    return scores;
  }
  
  /**
   * Find nearby POIs of specified types
   */
  async findNearbyPOIs(
    latitude: number,
    longitude: number,
    poiTypes: POIType[],
    radiusMiles: number
  ): Promise<NearbyPOI[]> {
    // Convert miles to degrees (approximate)
    const radiusDegrees = radiusMiles / 69.0;
    
    const result = await this.pool.query(`
      SELECT 
        poi.*,
        ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography
        ) / 1609.34 AS distance_miles
      FROM points_of_interest poi
      WHERE poi.poi_type = ANY($3)
        AND poi.status = 'active'
        AND poi.latitude BETWEEN $2 - $4 AND $2 + $4
        AND poi.longitude BETWEEN $1 - $4 AND $1 + $4
      ORDER BY distance_miles
      LIMIT 50
    `, [longitude, latitude, poiTypes, radiusDegrees]);
    
    return result.rows.map(row => ({
      id: row.id,
      poiType: row.poi_type,
      poiName: row.poi_name,
      poiSubtype: row.poi_subtype,
      address: row.address,
      city: row.city,
      state: row.state,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      transitLines: row.transit_lines,
      transitAgency: row.transit_agency,
      dailyRidership: row.daily_ridership,
      schoolRating: row.school_rating,
      schoolDistrict: row.school_district,
      employerIndustry: row.employer_industry,
      employeeCount: row.employee_count,
      status: row.status,
      source: row.source,
      distanceMiles: parseFloat(row.distance_miles),
    }));
  }
  
  /**
   * Compute transit score based on nearby transit options
   */
  private computeTransitScore(
    nearestStation?: NearbyPOI,
    nearestBusStop?: NearbyPOI,
    allTransit?: NearbyPOI[]
  ): number {
    let score = 0;
    
    // Heavy rail station proximity (max 50 points)
    if (nearestStation) {
      if (nearestStation.distanceMiles <= 0.25) score += 50;
      else if (nearestStation.distanceMiles <= 0.5) score += 40;
      else if (nearestStation.distanceMiles <= 1.0) score += 25;
      else if (nearestStation.distanceMiles <= 1.5) score += 15;
    }
    
    // Bus stop proximity (max 30 points)
    if (nearestBusStop) {
      if (nearestBusStop.distanceMiles <= 0.1) score += 30;
      else if (nearestBusStop.distanceMiles <= 0.25) score += 20;
      else if (nearestBusStop.distanceMiles <= 0.5) score += 10;
    }
    
    // Route diversity bonus (max 20 points)
    if (allTransit) {
      const uniqueLines = new Set(allTransit.flatMap(t => t.transitLines || []));
      score += Math.min(uniqueLines.size * 4, 20);
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Estimate rent premiums based on proximity factors
   */
  private estimatePremiums(factors: {
    transitDistance?: number;
    groceryType?: string;
    groceryDistance?: number;
    schoolRating?: number;
    beltlineDistance?: number;
    crimeIndex?: number;
  }): ProximityScores['estimatedPremiums'] {
    let transitPremium = 0;
    let amenityPremium = 0;
    let schoolPremium = 0;
    
    // Transit premium
    if (factors.transitDistance !== undefined) {
      if (factors.transitDistance <= 0.25) {
        transitPremium = PREMIUM_ESTIMATES.transitExcellent;
      } else if (factors.transitDistance <= 0.5) {
        transitPremium = PREMIUM_ESTIMATES.transitGood;
      }
    }
    
    // BeltLine premium (Atlanta specific)
    if (factors.beltlineDistance !== undefined && factors.beltlineDistance <= 0.25) {
      transitPremium += PREMIUM_ESTIMATES.beltline;
    }
    
    // Grocery premium
    if (factors.groceryType === 'grocery_premium' && factors.groceryDistance && factors.groceryDistance <= 0.5) {
      amenityPremium += PREMIUM_ESTIMATES.groceryPremium;
    }
    
    // School premium
    if (factors.schoolRating && factors.schoolRating >= 8) {
      schoolPremium = PREMIUM_ESTIMATES.schoolExcellent;
    }
    
    // Crime discount/premium
    if (factors.crimeIndex !== undefined && factors.crimeIndex < 80) {
      amenityPremium += PREMIUM_ESTIMATES.lowCrime;
    }
    
    const totalPremium = transitPremium + amenityPremium + schoolPremium;
    
    return {
      transitPremiumPct: Math.round(transitPremium * 100) / 100,
      amenityPremiumPct: Math.round(amenityPremium * 100) / 100,
      schoolPremiumPct: Math.round(schoolPremium * 100) / 100,
      totalPremiumPct: Math.round(totalPremium * 100) / 100,
    };
  }
  
  /**
   * Save proximity scores to database
   */
  private async saveProximityScores(scores: ProximityScores): Promise<void> {
    await this.pool.query(`
      INSERT INTO property_proximity (
        property_id, parcel_id, address, latitude, longitude,
        nearest_rail_station_name, nearest_rail_station_type, nearest_rail_station_miles,
        nearest_bus_stop_miles, transit_routes_within_quarter_mile,
        nearest_grocery_name, nearest_grocery_type, nearest_grocery_miles,
        groceries_within_1_mile, premium_groceries_within_2_miles,
        major_employers_within_3_miles, major_employers_within_5_miles,
        nearest_major_employer_name, nearest_major_employer_miles, total_jobs_within_5_miles,
        nearest_hospital_name, nearest_hospital_miles, urgent_cares_within_3_miles,
        nearest_elementary_school, nearest_elementary_rating,
        nearest_middle_school, nearest_middle_rating,
        nearest_high_school, nearest_high_rating,
        school_district, universities_within_5_miles,
        nearest_park_miles, parks_within_1_mile, beltline_miles,
        transit_score,
        estimated_transit_premium_pct, estimated_amenity_premium_pct, estimated_school_premium_pct,
        computed_at, data_sources
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23,
        $24, $25, $26, $27, $28, $29, $30, $31,
        $32, $33, $34,
        $35,
        $36, $37, $38,
        $39, $40
      )
      ON CONFLICT (property_id) DO UPDATE SET
        address = EXCLUDED.address,
        nearest_rail_station_name = EXCLUDED.nearest_rail_station_name,
        nearest_rail_station_miles = EXCLUDED.nearest_rail_station_miles,
        nearest_grocery_name = EXCLUDED.nearest_grocery_name,
        nearest_grocery_miles = EXCLUDED.nearest_grocery_miles,
        major_employers_within_5_miles = EXCLUDED.major_employers_within_5_miles,
        transit_score = EXCLUDED.transit_score,
        estimated_transit_premium_pct = EXCLUDED.estimated_transit_premium_pct,
        computed_at = EXCLUDED.computed_at,
        updated_at = NOW()
    `, [
      scores.propertyId, scores.parcelId, scores.address, scores.latitude, scores.longitude,
      scores.transit.nearestStationName, scores.transit.nearestStationType, scores.transit.nearestStationMiles,
      scores.transit.nearestBusStopMiles, scores.transit.routesWithinQuarterMile,
      scores.grocery.nearestName, scores.grocery.nearestType, scores.grocery.nearestMiles,
      scores.grocery.countWithin1Mile, scores.grocery.premiumCountWithin2Miles,
      scores.employers.majorWithin3Miles, scores.employers.majorWithin5Miles,
      scores.employers.nearestMajorName, scores.employers.nearestMajorMiles, scores.employers.totalJobsWithin5Miles,
      scores.healthcare.nearestHospitalName, scores.healthcare.nearestHospitalMiles, scores.healthcare.urgentCaresWithin3Miles,
      scores.schools.elementaryName, scores.schools.elementaryRating,
      scores.schools.middleName, scores.schools.middleRating,
      scores.schools.highName, scores.schools.highRating,
      scores.schools.districtName, scores.schools.universitiesWithin5Miles,
      scores.parks.nearestParkMiles, scores.parks.parksWithin1Mile, scores.parks.beltlineMiles,
      scores.scores.transitScore,
      scores.estimatedPremiums.transitPremiumPct, scores.estimatedPremiums.amenityPremiumPct, scores.estimatedPremiums.schoolPremiumPct,
      scores.computedAt, scores.dataSources
    ]);
  }
  
  /**
   * Get cached proximity scores for a property
   */
  async getCachedProximityScores(
    propertyId?: string,
    parcelId?: string,
    county?: string,
    state?: string
  ): Promise<ProximityScores | null> {
    let query: string;
    let params: (string | undefined)[];
    
    if (propertyId) {
      query = 'SELECT * FROM property_proximity WHERE property_id = $1';
      params = [propertyId];
    } else if (parcelId && county && state) {
      query = 'SELECT * FROM property_proximity WHERE parcel_id = $1 AND county = $2 AND state = $3';
      params = [parcelId, county, state];
    } else {
      return null;
    }
    
    const result = await this.pool.query(query, params);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return this.mapRowToProximityScores(row);
  }
  
  /**
   * Map database row to ProximityScores
   */
  private mapRowToProximityScores(row: any): ProximityScores {
    return {
      propertyId: row.property_id,
      parcelId: row.parcel_id,
      address: row.address,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      
      transit: {
        nearestStationName: row.nearest_rail_station_name,
        nearestStationType: row.nearest_rail_station_type,
        nearestStationMiles: row.nearest_rail_station_miles ? parseFloat(row.nearest_rail_station_miles) : undefined,
        nearestBusStopMiles: row.nearest_bus_stop_miles ? parseFloat(row.nearest_bus_stop_miles) : undefined,
        routesWithinQuarterMile: row.transit_routes_within_quarter_mile,
        transitScore: row.transit_score,
      },
      
      grocery: {
        nearestName: row.nearest_grocery_name,
        nearestType: row.nearest_grocery_type,
        nearestMiles: row.nearest_grocery_miles ? parseFloat(row.nearest_grocery_miles) : undefined,
        countWithin1Mile: row.groceries_within_1_mile,
        premiumCountWithin2Miles: row.premium_groceries_within_2_miles,
      },
      
      employers: {
        majorWithin3Miles: row.major_employers_within_3_miles,
        majorWithin5Miles: row.major_employers_within_5_miles,
        nearestMajorName: row.nearest_major_employer_name,
        nearestMajorMiles: row.nearest_major_employer_miles ? parseFloat(row.nearest_major_employer_miles) : undefined,
        totalJobsWithin5Miles: row.total_jobs_within_5_miles,
      },
      
      retail: {
        restaurantsWithinHalfMile: row.restaurants_within_half_mile,
        retailSqftWithin1Mile: row.retail_sqft_within_1_mile,
        nearestMallMiles: row.nearest_mall_miles ? parseFloat(row.nearest_mall_miles) : undefined,
      },
      
      healthcare: {
        nearestHospitalName: row.nearest_hospital_name,
        nearestHospitalMiles: row.nearest_hospital_miles ? parseFloat(row.nearest_hospital_miles) : undefined,
        urgentCaresWithin3Miles: row.urgent_cares_within_3_miles,
      },
      
      schools: {
        elementaryName: row.nearest_elementary_school,
        elementaryRating: row.nearest_elementary_rating,
        middleName: row.nearest_middle_school,
        middleRating: row.nearest_middle_rating,
        highName: row.nearest_high_school,
        highRating: row.nearest_high_rating,
        districtName: row.school_district,
        districtRating: row.school_district_rating,
        universitiesWithin5Miles: row.universities_within_5_miles,
      },
      
      parks: {
        nearestParkMiles: row.nearest_park_miles ? parseFloat(row.nearest_park_miles) : undefined,
        parksWithin1Mile: row.parks_within_1_mile,
        greenspaceAcresWithin1Mile: row.greenspace_acres_within_1_mile ? parseFloat(row.greenspace_acres_within_1_mile) : undefined,
        beltlineMiles: row.beltline_miles ? parseFloat(row.beltline_miles) : undefined,
      },
      
      safety: {
        crimeIndex: row.crime_index ? parseFloat(row.crime_index) : undefined,
        violentCrimeIndex: row.violent_crime_index ? parseFloat(row.violent_crime_index) : undefined,
        propertyCrimeIndex: row.property_crime_index ? parseFloat(row.property_crime_index) : undefined,
        crimeTrend: row.crime_trend,
      },
      
      scores: {
        walkScore: row.walk_score,
        transitScore: row.transit_score,
        bikeScore: row.bike_score,
      },
      
      estimatedPremiums: {
        transitPremiumPct: row.estimated_transit_premium_pct ? parseFloat(row.estimated_transit_premium_pct) : undefined,
        amenityPremiumPct: row.estimated_amenity_premium_pct ? parseFloat(row.estimated_amenity_premium_pct) : undefined,
        schoolPremiumPct: row.estimated_school_premium_pct ? parseFloat(row.estimated_school_premium_pct) : undefined,
        totalPremiumPct: undefined,
      },
      
      computedAt: new Date(row.computed_at),
      dataSources: row.data_sources || [],
    };
  }
  
  /**
   * Batch compute proximity for multiple properties
   */
  async batchComputeProximity(
    properties: Array<{ id: string; latitude: number; longitude: number; address?: string }>
  ): Promise<Map<string, ProximityScores>> {
    const results = new Map<string, ProximityScores>();
    
    for (const prop of properties) {
      try {
        const scores = await this.computeProximityScores(
          prop.latitude,
          prop.longitude,
          { propertyId: prop.id, address: prop.address, saveToDb: true }
        );
        results.set(prop.id, scores);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[Proximity] Error computing for ${prop.id}:`, error);
      }
    }
    
    return results;
  }
}

// Singleton factory
let proximityServiceInstance: ProximityService | null = null;

export function getProximityService(pool: Pool): ProximityService {
  if (!proximityServiceInstance) {
    proximityServiceInstance = new ProximityService(pool);
  }
  return proximityServiceInstance;
}
