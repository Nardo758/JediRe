/**
 * Geographic Assignment Service
 * Assigns news events to the correct geographic resolution (Trade Area → Submarket → MSA)
 * Implements 3-tier assignment logic with impact decay calculations
 */

import { query } from '../database/connection';
import { geocodingService, GeocodingResult } from './geocoding.service';
import { logger } from '../utils/logger';

export interface EventLocation {
  address?: string;
  lat?: number;
  lng?: number;
  locationRaw: string;
  locationSpecificity?: 'address' | 'neighborhood' | 'city' | 'metro' | 'state';
}

export interface GeographicAssignment {
  tier: 'pin_drop' | 'area' | 'metro';
  msa_id: number | null;
  msa_name?: string;
  submarket_id: number | null;
  submarket_name?: string;
  trade_area_ids: string[];
  trade_area_impacts?: TradeAreaImpact[];
  geocoded?: GeocodingResult;
}

export interface TradeAreaImpact {
  trade_area_id: string;
  trade_area_name: string;
  impact_type: 'direct' | 'proximity' | 'sector' | 'metro';
  distance_miles: number;
  decay_score: number; // 0-100
  impact_score: number; // Event magnitude × decay score
  decay_factors: DecayFactors;
}

export interface DecayFactors {
  proximity_score: number; // 30% weight
  sector_score: number; // 30% weight
  absorption_score: number; // 25% weight
  temporal_score: number; // 15% weight
}

export interface EventMagnitude {
  category: string;
  type: string;
  magnitude: number; // Base magnitude 0-100
  sector?: string; // multifamily, office, retail, etc.
  unit_count?: number;
  employee_count?: number;
  sqft?: number;
}

class GeographicAssignmentService {
  /**
   * Main entry point: Assign event to geographic hierarchy
   */
  async assignEvent(
    location: EventLocation,
    magnitude: EventMagnitude,
    publishedAt?: Date
  ): Promise<GeographicAssignment> {
    // Step 1: Geocode if needed
    let geocoded: GeocodingResult | null = null;
    let lat: number | undefined;
    let lng: number | undefined;
    
    if (location.lat && location.lng) {
      lat = location.lat;
      lng = location.lng;
    } else if (location.address || location.locationRaw) {
      geocoded = await geocodingService.geocode(location.address || location.locationRaw);
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
      }
    }
    
    // Step 2: Determine tier based on location specificity
    const tier = this.determineTier(location, geocoded);
    
    // Step 3: Assign to geographic levels based on tier
    switch (tier) {
      case 'pin_drop':
        return await this.assignPinDropEvent(lat!, lng!, magnitude, publishedAt, geocoded || undefined);
      
      case 'area':
        return await this.assignAreaEvent(location.locationRaw, lat, lng, magnitude, publishedAt, geocoded || undefined);
      
      case 'metro':
        return await this.assignMetroEvent(location.locationRaw, lat, lng, magnitude, publishedAt, geocoded || undefined);
      
      default:
        throw new Error(`Unknown tier: ${tier}`);
    }
  }
  
  /**
   * Tier 1: Pin-Drop Events (exact address)
   * Uses polygon containment for trade area matching
   */
  private async assignPinDropEvent(
    lat: number,
    lng: number,
    magnitude: EventMagnitude,
    publishedAt?: Date,
    geocoded?: GeocodingResult
  ): Promise<GeographicAssignment> {
    // Find submarket
    const submarketResult = await query(
      `SELECT * FROM find_submarket_for_point($1, $2)`,
      [lat, lng]
    );
    
    const submarket = submarketResult.rows[0] || null;
    
    // Find MSA
    const msaResult = await query(
      `SELECT * FROM find_msa_for_point($1, $2)`,
      [lat, lng]
    );
    
    const msa = msaResult.rows[0] || null;
    
    // Find all trade areas containing this point
    const tradeAreasResult = await query(
      `SELECT * FROM find_trade_areas_for_point($1, $2)`,
      [lat, lng]
    );
    
    const tradeAreaIds = tradeAreasResult.rows.map(ta => ta.trade_area_id);
    
    // Calculate impact for each trade area
    const tradeAreaImpacts: TradeAreaImpact[] = [];
    
    for (const ta of tradeAreasResult.rows) {
      const impact = await this.calculateTradeAreaImpact(
        ta.trade_area_id,
        ta.trade_area_name,
        { lat, lng },
        ta.distance_miles,
        magnitude,
        publishedAt
      );
      tradeAreaImpacts.push(impact);
    }
    
    return {
      tier: 'pin_drop',
      msa_id: msa?.msa_id || null,
      msa_name: msa?.msa_name,
      submarket_id: submarket?.submarket_id || null,
      submarket_name: submarket?.submarket_name,
      trade_area_ids: tradeAreaIds,
      trade_area_impacts: tradeAreaImpacts,
      geocoded,
    };
  }
  
  /**
   * Tier 2: Area Events (named area like "Buckhead" or "Midtown")
   * Uses submarket matching with proportional distribution
   */
  private async assignAreaEvent(
    locationRaw: string,
    lat: number | undefined,
    lng: number | undefined,
    magnitude: EventMagnitude,
    publishedAt?: Date,
    geocoded?: GeocodingResult
  ): Promise<GeographicAssignment> {
    // Try to find submarket by name match
    const submarketNameResult = await query(
      `SELECT s.id, s.name, s.msa_id, m.name as msa_name, ST_X(s.centroid) as lng, ST_Y(s.centroid) as lat
       FROM submarkets s
       JOIN msas m ON s.msa_id = m.id
       WHERE LOWER(s.name) LIKE LOWER($1) OR LOWER($1) LIKE '%' || LOWER(s.name) || '%'
       LIMIT 1`,
      [locationRaw]
    );
    
    let submarket = submarketNameResult.rows[0] || null;
    let msa = null;
    
    // Fallback to geocoded point if name match failed
    if (!submarket && lat && lng) {
      const submarketResult = await query(
        `SELECT * FROM find_submarket_for_point($1, $2)`,
        [lat, lng]
      );
      submarket = submarketResult.rows[0] || null;
    }
    
    if (submarket) {
      // Get MSA
      msa = { msa_id: submarket.msa_id, msa_name: submarket.msa_name };
      
      // Find all trade areas that overlap with this submarket
      const tradeAreasResult = await query(
        `SELECT DISTINCT ta.id, ta.name, 
          ST_Distance(
            ta.centroid::geography,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
          ) / 1609.34 as distance_miles
         FROM trade_areas ta
         JOIN geographic_relationships gr ON gr.trade_area_id = ta.id
         WHERE gr.submarket_id = $1
         ORDER BY distance_miles`,
        [submarket.id, submarket.lng, submarket.lat]
      );
      
      const tradeAreaIds = tradeAreasResult.rows.map(ta => ta.id);
      
      // Calculate impacts (proportional distribution)
      const tradeAreaImpacts: TradeAreaImpact[] = [];
      
      for (const ta of tradeAreasResult.rows) {
        const impact = await this.calculateTradeAreaImpact(
          ta.id,
          ta.name,
          { lat: submarket.lat, lng: submarket.lng },
          ta.distance_miles,
          magnitude,
          publishedAt,
          'area'
        );
        tradeAreaImpacts.push(impact);
      }
      
      return {
        tier: 'area',
        msa_id: msa.msa_id,
        msa_name: msa.msa_name,
        submarket_id: submarket.id,
        submarket_name: submarket.name,
        trade_area_ids: tradeAreaIds,
        trade_area_impacts: tradeAreaImpacts,
        geocoded,
      };
    }
    
    // If no submarket found, escalate to metro
    return this.assignMetroEvent(locationRaw, lat, lng, magnitude, publishedAt, geocoded);
  }
  
  /**
   * Tier 3: Metro Events (MSA-level)
   * Cascades down with impact decay
   */
  private async assignMetroEvent(
    locationRaw: string,
    lat: number | undefined,
    lng: number | undefined,
    magnitude: EventMagnitude,
    publishedAt?: Date,
    geocoded?: GeocodingResult
  ): Promise<GeographicAssignment> {
    let msa = null;
    
    // Try to find MSA by name match
    const msaNameResult = await query(
      `SELECT id, name, cbsa_code, ST_X(centroid) as lng, ST_Y(centroid) as lat
       FROM msas
       WHERE LOWER(name) LIKE LOWER($1) OR LOWER($1) LIKE '%' || LOWER(name) || '%'
       LIMIT 1`,
      [locationRaw]
    );
    
    msa = msaNameResult.rows[0] || null;
    
    // Fallback to geocoded point
    if (!msa && lat && lng) {
      const msaResult = await query(
        `SELECT * FROM find_msa_for_point($1, $2)`,
        [lat, lng]
      );
      msa = msaResult.rows[0] ? { id: msaResult.rows[0].msa_id, name: msaResult.rows[0].msa_name } : null;
    }
    
    if (msa) {
      // Get all trade areas in this MSA
      const tradeAreasResult = await query(
        `SELECT DISTINCT ta.id, ta.name,
          ST_Distance(
            ta.centroid::geography,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
          ) / 1609.34 as distance_miles
         FROM trade_areas ta
         JOIN geographic_relationships gr ON gr.trade_area_id = ta.id
         WHERE gr.msa_id = $1
         ORDER BY distance_miles
         LIMIT 50`,
        [msa.id, msa.lng, msa.lat]
      );
      
      const tradeAreaIds = tradeAreasResult.rows.map(ta => ta.id);
      
      // Calculate impacts with metro-level decay
      const tradeAreaImpacts: TradeAreaImpact[] = [];
      
      for (const ta of tradeAreasResult.rows) {
        const impact = await this.calculateTradeAreaImpact(
          ta.id,
          ta.name,
          { lat: msa.lat, lng: msa.lng },
          ta.distance_miles,
          magnitude,
          publishedAt,
          'metro'
        );
        
        // Only include if impact is significant enough
        if (impact.impact_score > 5) {
          tradeAreaImpacts.push(impact);
        }
      }
      
      return {
        tier: 'metro',
        msa_id: msa.id,
        msa_name: msa.name,
        submarket_id: null,
        submarket_name: undefined,
        trade_area_ids: tradeAreaIds,
        trade_area_impacts: tradeAreaImpacts,
        geocoded,
      };
    }
    
    // Could not assign to any geography
    logger.warn('Could not assign event to any geography', { locationRaw, lat, lng });
    
    return {
      tier: 'metro',
      msa_id: null,
      submarket_id: null,
      trade_area_ids: [],
      geocoded,
    };
  }
  
  /**
   * Calculate 4-factor decay score and impact for a trade area
   * Factors: Proximity (30%), Sector (30%), Absorption (25%), Temporal (15%)
   */
  private async calculateTradeAreaImpact(
    tradeAreaId: string,
    tradeAreaName: string,
    eventLocation: { lat: number; lng: number },
    distanceMiles: number,
    magnitude: EventMagnitude,
    publishedAt?: Date,
    impactType: 'direct' | 'area' | 'metro' = 'direct'
  ): Promise<TradeAreaImpact> {
    // Get trade area details for context
    const taResult = await query(
      `SELECT stats_snapshot FROM trade_areas WHERE id = $1`,
      [tradeAreaId]
    );
    
    const tradeArea = taResult.rows[0];
    const stats = tradeArea?.stats_snapshot || {};
    
    // Calculate decay factors
    const decayFactors = this.calculateDecayFactors(
      distanceMiles,
      magnitude,
      stats,
      publishedAt,
      impactType
    );
    
    // Weighted composite: Proximity 30%, Sector 30%, Absorption 25%, Temporal 15%
    const decayScore =
      decayFactors.proximity_score * 0.30 +
      decayFactors.sector_score * 0.30 +
      decayFactors.absorption_score * 0.25 +
      decayFactors.temporal_score * 0.15;
    
    // Final impact = Event Magnitude × Decay Score
    const impactScore = (magnitude.magnitude / 100) * decayScore;
    
    return {
      trade_area_id: tradeAreaId,
      trade_area_name: tradeAreaName,
      impact_type: impactType === 'direct' ? 'direct' : impactType === 'area' ? 'proximity' : 'metro',
      distance_miles: distanceMiles,
      decay_score: Math.round(decayScore * 100) / 100,
      impact_score: Math.round(impactScore * 100) / 100,
      decay_factors: decayFactors,
    };
  }
  
  /**
   * Calculate 4-factor decay scores
   */
  private calculateDecayFactors(
    distanceMiles: number,
    magnitude: EventMagnitude,
    tradeAreaStats: any,
    publishedAt?: Date,
    impactType: string = 'direct'
  ): DecayFactors {
    // 1. Proximity Score (30% weight) - exponential decay with distance
    let proximityScore = 100;
    if (impactType === 'direct') {
      proximityScore = 100; // Inside trade area = full score
    } else if (distanceMiles <= 1) {
      proximityScore = 90;
    } else if (distanceMiles <= 3) {
      proximityScore = 70 - (distanceMiles - 1) * 10;
    } else if (distanceMiles <= 5) {
      proximityScore = 50 - (distanceMiles - 3) * 10;
    } else if (distanceMiles <= 10) {
      proximityScore = 30 - (distanceMiles - 5) * 4;
    } else {
      proximityScore = Math.max(0, 10 - distanceMiles);
    }
    
    // 2. Sector Score (30% weight) - alignment between event and trade area sector
    let sectorScore = 50; // Default neutral
    
    if (magnitude.category === 'employment') {
      sectorScore = 80; // Employment broadly impacts multifamily
    } else if (magnitude.category === 'development') {
      if (magnitude.sector === 'multifamily') {
        sectorScore = 100; // Direct competition
      } else {
        sectorScore = 40; // Other sectors have less impact
      }
    } else if (magnitude.category === 'transactions') {
      sectorScore = 70; // Market comp signal
    } else if (magnitude.category === 'amenities') {
      sectorScore = 60; // Quality of life impact
    }
    
    // 3. Absorption Score (25% weight) - market capacity to absorb impact
    let absorptionScore = 50; // Default neutral
    
    const existingUnits = tradeAreaStats.existing_units || 10000;
    const pipelineUnits = tradeAreaStats.pipeline_units || 0;
    const avgOccupancy = tradeAreaStats.occupancy || 90;
    
    if (magnitude.unit_count) {
      // Higher supply pressure = higher impact
      const supplyPressure = (magnitude.unit_count / existingUnits) * 100;
      
      if (supplyPressure > 10) {
        absorptionScore = 90; // Major impact
      } else if (supplyPressure > 5) {
        absorptionScore = 70;
      } else if (supplyPressure > 2) {
        absorptionScore = 50;
      } else {
        absorptionScore = 30;
      }
      
      // Adjust for current market tightness
      if (avgOccupancy > 95) {
        absorptionScore *= 1.2; // Tight market = higher impact
      } else if (avgOccupancy < 85) {
        absorptionScore *= 0.8; // Soft market = lower impact
      }
    }
    
    absorptionScore = Math.min(100, Math.max(0, absorptionScore));
    
    // 4. Temporal Score (15% weight) - time decay
    let temporalScore = 100; // Default recent
    
    if (publishedAt) {
      const daysSincePublished = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSincePublished <= 7) {
        temporalScore = 100;
      } else if (daysSincePublished <= 30) {
        temporalScore = 90;
      } else if (daysSincePublished <= 90) {
        temporalScore = 70;
      } else if (daysSincePublished <= 180) {
        temporalScore = 50;
      } else if (daysSincePublished <= 365) {
        temporalScore = 30;
      } else {
        temporalScore = 10;
      }
    }
    
    return {
      proximity_score: Math.round(proximityScore * 100) / 100,
      sector_score: Math.round(sectorScore * 100) / 100,
      absorption_score: Math.round(absorptionScore * 100) / 100,
      temporal_score: Math.round(temporalScore * 100) / 100,
    };
  }
  
  /**
   * Determine event tier based on location specificity
   */
  private determineTier(
    location: EventLocation,
    geocoded: GeocodingResult | null
  ): 'pin_drop' | 'area' | 'metro' {
    // Explicit coordinates or specific address
    if (location.lat && location.lng) {
      return 'pin_drop';
    }
    
    if (geocoded) {
      if (geocodingService.isAddressSpecific(geocoded)) {
        return 'pin_drop';
      }
      
      if (geocoded.placeType === 'neighborhood' || geocoded.placeType === 'place') {
        return 'area';
      }
    }
    
    // Check location_specificity if provided
    if (location.locationSpecificity) {
      if (location.locationSpecificity === 'address') {
        return 'pin_drop';
      } else if (location.locationSpecificity === 'neighborhood' || location.locationSpecificity === 'city') {
        return 'area';
      } else {
        return 'metro';
      }
    }
    
    // Named area keywords
    const areaKeywords = ['midtown', 'buckhead', 'downtown', 'uptown', 'district', 'neighborhood'];
    const locationLower = location.locationRaw.toLowerCase();
    
    for (const keyword of areaKeywords) {
      if (locationLower.includes(keyword)) {
        return 'area';
      }
    }
    
    // Default to metro if uncertain
    return 'metro';
  }
  
  /**
   * Persist event assignments to database
   */
  async saveEventAssignment(eventId: string, assignment: GeographicAssignment): Promise<void> {
    // Update news_events table
    await query(
      `UPDATE news_events
       SET msa_id = $1,
           submarket_id = $2,
           geographic_tier = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [assignment.msa_id, assignment.submarket_id, assignment.tier, eventId]
    );
    
    // Save trade area impacts
    if (assignment.trade_area_impacts && assignment.trade_area_impacts.length > 0) {
      for (const impact of assignment.trade_area_impacts) {
        await query(
          `INSERT INTO trade_area_event_impacts (
            trade_area_id, event_id, impact_type, distance_miles,
            proximity_score, sector_score, absorption_score, temporal_score,
            decay_score, impact_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (trade_area_id, event_id) DO UPDATE SET
            impact_type = EXCLUDED.impact_type,
            distance_miles = EXCLUDED.distance_miles,
            proximity_score = EXCLUDED.proximity_score,
            sector_score = EXCLUDED.sector_score,
            absorption_score = EXCLUDED.absorption_score,
            temporal_score = EXCLUDED.temporal_score,
            decay_score = EXCLUDED.decay_score,
            impact_score = EXCLUDED.impact_score`,
          [
            impact.trade_area_id,
            eventId,
            impact.impact_type,
            impact.distance_miles,
            impact.decay_factors.proximity_score,
            impact.decay_factors.sector_score,
            impact.decay_factors.absorption_score,
            impact.decay_factors.temporal_score,
            impact.decay_score,
            impact.impact_score,
          ]
        );
      }
    }
    
    logger.info('Event geographic assignment saved', { eventId, tier: assignment.tier });
  }
}

export const geographicAssignmentService = new GeographicAssignmentService();
