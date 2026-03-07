/**
 * Traffic Comp Adjustment Service
 * For new developments (no website yet), derive traffic projections from comparable properties
 * adjusted by location/visibility advantages
 */

import { pool } from '../database';
import { logger } from '../utils/logger';

export interface VisibilityFactors {
  // 7-factor visibility assessment (0-100 each)
  positional: number;        // Corner lot, main road, etc.
  sightline: number;         // Clear view from street
  setback: number;           // Proximity to road
  signage: number;           // Signage quality/placement
  transparency: number;      // Glass/openness
  entrance: number;          // Prominence of entrance
  obstruction_penalty: number; // Trees, buildings blocking
  total_score: number;       // Weighted average
}

export interface CompProperty {
  id: string;
  name: string;
  address: string;
  units: number;
  distance_miles: number;
  weekly_traffic: number | null;      // From SpyFu or reports
  visibility_score: number | null;    // If assessed
  avg_rent: number;
  occupancy: number;
}

export interface LocationAdjustment {
  comp_id: string;
  comp_name: string;
  comp_visibility: number;
  subject_visibility: number;
  delta: number;  // +/- points difference
  multiplier: number;  // Traffic adjustment (0.8x - 1.3x)
  reasoning: string;
}

export class TrafficCompAdjustmentService {
  
  /**
   * Get comparable properties from Market Intelligence competitive set
   * Uses the comps already identified in M05 instead of arbitrary radius
   */
  async getComparableProperties(dealId: string): Promise<CompProperty[]> {
    try {
      // First, try to get comps from Market Intelligence supply context
      const marketIntelResult = await pool.query(`
        SELECT 
          deal_data->'market_intelligence'->'data'->'supplyContext'->'competingProperties' as comps
        FROM deals
        WHERE id = $1
      `, [dealId]);

      if (marketIntelResult.rows.length > 0 && marketIntelResult.rows[0].comps) {
        const comps = marketIntelResult.rows[0].comps;
        if (Array.isArray(comps) && comps.length > 0) {
          logger.info(`Found ${comps.length} comps from Market Intelligence for deal ${dealId}`);
          
          // Map Market Intel comp data to CompProperty format
          return comps.map((c: any) => ({
            id: c.id || c.property_id || `comp-${Math.random()}`,
            name: c.name || c.property_name || 'Unknown Property',
            address: c.address || '',
            units: c.units || c.total_units || 0,
            distance_miles: c.distance_miles || c.distance || 0,
            weekly_traffic: c.weekly_traffic || null,
            visibility_score: c.visibility_score || null,
            avg_rent: c.avg_rent || c.rent || 0,
            occupancy: c.occupancy || c.occupancy_rate || 0.90
          })).filter((c: CompProperty) => c.units > 0);
        }
      }

      // Fallback: If no comps in Market Intel, use spatial query (legacy)
      logger.warn(`No comps in Market Intelligence for deal ${dealId}, falling back to spatial query`);
      
      const result = await pool.query(`
        WITH subject AS (
          SELECT 
            ST_Centroid(d.boundary) as location,
            d.target_units,
            d.project_type
          FROM deals d
          WHERE d.id = $1
        )
        SELECT 
          p.id,
          p.name,
          p.address,
          p.units,
          ST_Distance(p.location::geography, subject.location::geography) / 1609.34 as distance_miles,
          p.weekly_traffic,
          p.visibility_score,
          p.avg_rent,
          p.occupancy
        FROM properties p, subject
        WHERE 
          p.property_type = subject.project_type
          AND p.units BETWEEN subject.target_units * 0.5 AND subject.target_units * 1.5
          AND ST_DWithin(p.location::geography, subject.location::geography, 3 * 1609.34) -- 3 mile fallback
        ORDER BY distance_miles ASC
        LIMIT 10
      `, [dealId]);

      return result.rows.map(r => ({
        id: r.id,
        name: r.name,
        address: r.address,
        units: r.units,
        distance_miles: parseFloat(r.distance_miles),
        weekly_traffic: r.weekly_traffic,
        visibility_score: r.visibility_score,
        avg_rent: r.avg_rent,
        occupancy: r.occupancy
      }));
    } catch (err) {
      logger.error('Error fetching comps for traffic adjustment:', err);
      return [];
    }
  }

  /**
   * Assess visibility for a new development site
   * 7-factor weighted scoring (0-100)
   */
  async assessVisibility(
    dealId: string,
    manualFactors?: Partial<VisibilityFactors>
  ): Promise<VisibilityFactors> {
    try {
      // Check if already assessed
      const existing = await pool.query(`
        SELECT visibility_score, visibility_factors
        FROM deal_properties dp
        JOIN properties p ON p.id = dp.property_id
        WHERE dp.deal_id = $1
        LIMIT 1
      `, [dealId]);

      if (existing.rows.length > 0 && existing.rows[0].visibility_factors) {
        return existing.rows[0].visibility_factors;
      }

      // If manual factors provided, use those
      if (manualFactors) {
        const factors: VisibilityFactors = {
          positional: manualFactors.positional ?? 70,
          sightline: manualFactors.sightline ?? 70,
          setback: manualFactors.setback ?? 70,
          signage: manualFactors.signage ?? 70,
          transparency: manualFactors.transparency ?? 70,
          entrance: manualFactors.entrance ?? 70,
          obstruction_penalty: manualFactors.obstruction_penalty ?? 0,
          total_score: 0
        };

        // Weighted average (Position 25%, Sightline 20%, others 10-15% each)
        factors.total_score = Math.round(
          factors.positional * 0.25 +
          factors.sightline * 0.20 +
          factors.setback * 0.15 +
          factors.signage * 0.15 +
          factors.transparency * 0.10 +
          factors.entrance * 0.10 +
          (100 - factors.obstruction_penalty) * 0.05
        );

        // Save for future use
        await pool.query(`
          UPDATE properties p
          SET 
            visibility_score = $1,
            visibility_factors = $2
          FROM deal_properties dp
          WHERE dp.deal_id = $3 AND dp.property_id = p.id
        `, [factors.total_score, JSON.stringify(factors), dealId]);

        return factors;
      }

      // Auto-assess based on available data (limited accuracy)
      const dealData = await pool.query(`
        SELECT 
          d.address,
          ST_AsGeoJSON(d.boundary)::json as boundary,
          dzp.zoning_code
        FROM deals d
        LEFT JOIN deal_zoning_profiles dzp ON dzp.deal_id = d.id
        WHERE d.id = $1
      `, [dealId]);

      if (dealData.rows.length === 0) {
        throw new Error('Deal not found');
      }

      // Basic heuristics (requires refinement with actual site visit)
      const defaultFactors: VisibilityFactors = {
        positional: 70,        // Assume average location
        sightline: 70,         // Assume decent visibility
        setback: 65,           // Typical urban setback
        signage: 75,           // New construction = good signage potential
        transparency: 80,      // Modern design = more glass
        entrance: 70,          // Average prominence
        obstruction_penalty: 10, // Some obstruction likely
        total_score: 0
      };

      defaultFactors.total_score = Math.round(
        defaultFactors.positional * 0.25 +
        defaultFactors.sightline * 0.20 +
        defaultFactors.setback * 0.15 +
        defaultFactors.signage * 0.15 +
        defaultFactors.transparency * 0.10 +
        defaultFactors.entrance * 0.10 +
        (100 - defaultFactors.obstruction_penalty) * 0.05
      );

      return defaultFactors;

    } catch (err) {
      logger.error('Error assessing visibility:', err);
      // Return conservative defaults
      return {
        positional: 70,
        sightline: 70,
        setback: 65,
        signage: 70,
        transparency: 70,
        entrance: 70,
        obstruction_penalty: 10,
        total_score: 69
      };
    }
  }

  /**
   * Calculate location adjustment multiplier
   * Subject visibility vs comp visibility → traffic multiplier
   */
  calculateLocationAdjustment(
    subjectVisibility: number,
    compVisibility: number
  ): { multiplier: number; reasoning: string } {
    const delta = subjectVisibility - compVisibility;

    let multiplier = 1.0;
    let reasoning = '';

    if (delta >= 20) {
      multiplier = 1.25;
      reasoning = 'Significantly better location (+20+ visibility points): Corner lot, high-traffic road, excellent sightlines. Expect 25% more traffic.';
    } else if (delta >= 10) {
      multiplier = 1.15;
      reasoning = 'Better location (+10-19 visibility points): Superior positioning, better signage, or improved access. Expect 15% more traffic.';
    } else if (delta >= 5) {
      multiplier = 1.08;
      reasoning = 'Slightly better location (+5-9 visibility points): Minor advantages in sightlines or entrance prominence. Expect 8% more traffic.';
    } else if (delta >= -5) {
      multiplier = 1.0;
      reasoning = 'Comparable location (±5 visibility points): Similar visibility and access characteristics. Use comp traffic as-is.';
    } else if (delta >= -10) {
      multiplier = 0.92;
      reasoning = 'Slightly worse location (-5 to -9 visibility points): Minor disadvantages in positioning or obstructions. Expect 8% less traffic.';
    } else if (delta >= -20) {
      multiplier = 0.85;
      reasoning = 'Worse location (-10 to -19 visibility points): Interior lot, lower-traffic road, or sightline obstructions. Expect 15% less traffic.';
    } else {
      multiplier = 0.75;
      reasoning = 'Significantly worse location (-20+ visibility points): Poor positioning, major obstructions, or side-street access. Expect 25% less traffic.';
    }

    return { multiplier, reasoning };
  }

  /**
   * Generate traffic projection for new development using comp-based model
   */
  async generateCompBasedTraffic(
    dealId: string,
    subjectVisibility?: VisibilityFactors
  ): Promise<{
    baselineTraffic: number;
    adjustedTraffic: number;
    compsUsed: CompProperty[];
    adjustments: LocationAdjustment[];
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }> {
    try {
      // Get comparable properties from Market Intelligence
      const comps = await this.getComparableProperties(dealId);

      if (comps.length === 0) {
        throw new Error('No comparable properties found in Market Intelligence competitive set');
      }

      // Assess subject visibility (if not provided)
      const subjectVis = subjectVisibility ?? await this.assessVisibility(dealId);

      // Calculate adjustments for each comp
      const adjustments: LocationAdjustment[] = [];
      let totalAdjustedTraffic = 0;
      let compCount = 0;

      for (const comp of comps) {
        if (!comp.weekly_traffic) continue;

        const compVis = comp.visibility_score ?? 70; // Default if not assessed
        const adjustment = this.calculateLocationAdjustment(subjectVis.total_score, compVis);

        const adjustedTraffic = comp.weekly_traffic * adjustment.multiplier;
        totalAdjustedTraffic += adjustedTraffic;
        compCount++;

        adjustments.push({
          comp_id: comp.id,
          comp_name: comp.name,
          comp_visibility: compVis,
          subject_visibility: subjectVis.total_score,
          delta: subjectVis.total_score - compVis,
          multiplier: adjustment.multiplier,
          reasoning: adjustment.reasoning
        });
      }

      if (compCount === 0) {
        throw new Error('No comps with traffic data found');
      }

      // Average baseline from comps (unadjusted)
      const baselineTraffic = Math.round(
        comps.reduce((sum, c) => sum + (c.weekly_traffic || 0), 0) / compCount
      );

      // Average adjusted traffic (location-weighted)
      const adjustedTraffic = Math.round(totalAdjustedTraffic / compCount);

      // Confidence based on comp count and data quality
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
      if (compCount >= 5 && comps.every(c => c.visibility_score !== null)) {
        confidence = 'HIGH';
      } else if (compCount >= 3) {
        confidence = 'MEDIUM';
      } else {
        confidence = 'LOW';
      }

      logger.info(`Comp-based traffic for deal ${dealId}: ${adjustedTraffic}/week (${compCount} comps, ${confidence} confidence)`);

      return {
        baselineTraffic,
        adjustedTraffic,
        compsUsed: comps,
        adjustments,
        confidence
      };

    } catch (err) {
      logger.error('Error generating comp-based traffic:', err);
      throw err;
    }
  }

  /**
   * Convenience method: Get adjusted traffic for use in prediction engine
   */
  async getAdjustedWeeklyTraffic(dealId: string): Promise<number> {
    const result = await this.generateCompBasedTraffic(dealId);
    return result.adjustedTraffic;
  }
}

export const trafficCompAdjustmentService = new TrafficCompAdjustmentService();
