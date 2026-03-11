/**
 * Deal Triage Service
 * 
 * Automatically triages deals after creation:
 * 1. Geocodes address (if needed)
 * 2. Looks up property data
 * 3. Assigns to trade area/submarket
 * 4. Calculates quick metrics (0-50 score range)
 * 5. Flags risks and recommends strategies
 * 6. Assigns status: Hot/Warm/Watch/Pass
 */

import { Pool } from 'pg';
import { GeocodingService } from './geocoding';

export interface TriageResult {
  dealId: string;
  score: number; // 0-50 range (NOT 0-100)
  status: 'Hot' | 'Warm' | 'Watch' | 'Pass';
  metrics: {
    locationSignals: {
      score: number; // 0-15
      tradeArea: string | null;
      marketStrength: number; // 0-1
      proximityScore: number; // 0-1
    };
    marketSignals: {
      score: number; // 0-15
      rentGrowth: number;
      populationGrowth: number;
      jobGrowth: number;
      trendVerdict: string;
    };
    propertySignals: {
      score: number; // 0-20
      propertyCount: number;
      avgRent: number;
      avgOccupancy: number;
      qualityScore: number; // 0-1
    };
  };
  strategies: string[];
  risks: string[];
  recommendations: string[];
  tradeAreaId: string | null;
  geocoded: {
    lat: number | null;
    lng: number | null;
    municipality: string | null;
    state: string | null;
  };
  triagedAt: string;
}

export class DealTriageService {
  private geocodingService: GeocodingService;

  constructor(private readonly db: Pool) {
    this.geocodingService = new GeocodingService();
  }

  /**
   * Main triage orchestrator
   */
  async triageDeal(dealId: string): Promise<TriageResult> {
    try {
      console.log(`[Triage] Starting triage for deal ${dealId}`);

      // Step 1: Get deal data
      const deal = await this.getDeal(dealId);
      if (!deal) {
        throw new Error('Deal not found');
      }

      // Step 2: Geocode address if not already done
      const geocoded = await this.geocodeAndLookup(dealId, deal);

      // Step 3: Assign to trade area/submarket
      const tradeAreaId = await this.assignTradeArea(dealId, geocoded);

      // Step 4: Calculate quick metrics
      const metrics = await this.calculateQuickMetrics(dealId, deal, tradeAreaId);

      // Step 5: Calculate score (0-50 range)
      const score = metrics.locationSignals.score + metrics.marketSignals.score + metrics.propertySignals.score;

      // Step 6: Determine status
      const status = this.determineStatus(score);

      // Step 7: Identify strategies
      const strategies = await this.assignStrategies(deal, metrics, score);

      // Step 8: Flag risks
      const risks = await this.flagRisks(deal, metrics, score);

      // Step 9: Generate recommendations
      const recommendations = this.generateRecommendations(metrics, strategies, risks, status);

      // Step 10: Build result
      const result: TriageResult = {
        dealId,
        score,
        status,
        metrics,
        strategies,
        risks,
        recommendations,
        tradeAreaId,
        geocoded,
        triagedAt: new Date().toISOString(),
      };

      // Step 11: Save to database
      await this.saveTriageResult(dealId, result);

      // Step 12: Log activity
      await this.logTriageActivity(dealId, result);

      console.log(`[Triage] Completed for deal ${dealId}: ${score}/50 (${status})`);

      return result;
    } catch (error) {
      console.error(`[Triage] Error triaging deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Step 1: Get deal data
   */
  private async getDeal(dealId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        id, name, address, project_type, project_intent,
        target_units, budget, tier, boundary,
        ST_Y(ST_Centroid(boundary)) AS lat,
        ST_X(ST_Centroid(boundary)) AS lng
      FROM deals WHERE id = $1`,
      [dealId]
    );

    return result.rows[0] || null;
  }

  /**
   * Step 2: Geocode address (if not done)
   */
  async geocodeAndLookup(dealId: string, deal: any): Promise<TriageResult['geocoded']> {
    // If we already have coordinates from boundary, use those
    if (deal.lat && deal.lng) {
      console.log(`[Triage] Using existing coordinates: ${deal.lat}, ${deal.lng}`);
      
      // Try reverse geocode to get municipality/state
      const reverseResult = await this.geocodingService.reverseGeocode(deal.lat, deal.lng);
      
      return {
        lat: deal.lat,
        lng: deal.lng,
        municipality: reverseResult?.municipality || null,
        state: reverseResult?.state || null,
      };
    }

    // Otherwise geocode the address
    if (!deal.address) {
      console.log(`[Triage] No address or coordinates available`);
      return {
        lat: null,
        lng: null,
        municipality: null,
        state: null,
      };
    }

    console.log(`[Triage] Geocoding address: ${deal.address}`);
    const geocodeResult = await this.geocodingService.geocode(deal.address);

    if (!geocodeResult) {
      console.warn(`[Triage] Geocoding failed for address: ${deal.address}`);
      return {
        lat: null,
        lng: null,
        municipality: null,
        state: null,
      };
    }

    return {
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
      municipality: geocodeResult.municipality || null,
      state: geocodeResult.state || null,
    };
  }

  /**
   * Step 3: Assign to trade area/submarket
   */
  private async assignTradeArea(dealId: string, geocoded: TriageResult['geocoded']): Promise<string | null> {
    if (!geocoded.lat || !geocoded.lng) {
      console.log(`[Triage] No coordinates, cannot assign trade area`);
      return null;
    }

    // Find trade area using database function
    const result = await this.db.query(
      `SELECT find_trade_area($1, $2) AS trade_area_id`,
      [geocoded.lat, geocoded.lng]
    );

    const tradeAreaId = result.rows[0]?.trade_area_id || null;

    if (tradeAreaId) {
      // Update deal with trade area
      await this.db.query(
        `UPDATE deals SET trade_area_id = $1 WHERE id = $2`,
        [tradeAreaId, dealId]
      );

      console.log(`[Triage] Assigned to trade area: ${tradeAreaId}`);
    } else {
      console.log(`[Triage] No trade area found for location`);
    }

    return tradeAreaId;
  }

  /**
   * Step 4: Calculate quick metrics
   */
  async calculateQuickMetrics(
    dealId: string,
    deal: any,
    tradeAreaId: string | null
  ): Promise<TriageResult['metrics']> {
    // Location signals (0-15 points)
    const locationSignals = await this.calculateLocationSignals(tradeAreaId);

    // Market signals (0-15 points)
    const marketSignals = await this.calculateMarketSignals(tradeAreaId);

    // Property signals (0-20 points)
    const propertySignals = await this.calculatePropertySignals(dealId, deal);

    return {
      locationSignals,
      marketSignals,
      propertySignals,
    };
  }

  /**
   * Calculate location signals (0-15 points)
   */
  private async calculateLocationSignals(tradeAreaId: string | null): Promise<TriageResult['metrics']['locationSignals']> {
    if (!tradeAreaId) {
      return {
        score: 5, // Default neutral score
        tradeArea: null,
        marketStrength: 0.5,
        proximityScore: 0.5,
      };
    }

    // Get trade area data
    const result = await this.db.query(
      `SELECT name, location_quality_score, market_strength_score
       FROM trade_areas WHERE id = $1`,
      [tradeAreaId]
    );

    const tradeArea = result.rows[0];
    if (!tradeArea) {
      return {
        score: 5,
        tradeArea: null,
        marketStrength: 0.5,
        proximityScore: 0.5,
      };
    }

    const locationQuality = tradeArea.location_quality_score || 0.5;
    const marketStrength = tradeArea.market_strength_score || 0.5;

    // Score: 0-15 points based on location quality and market strength
    const avgScore = (locationQuality + marketStrength) / 2;
    const score = Math.round(avgScore * 15);

    return {
      score,
      tradeArea: tradeArea.name,
      marketStrength,
      proximityScore: locationQuality,
    };
  }

  /**
   * Calculate market signals (0-15 points)
   */
  private async calculateMarketSignals(tradeAreaId: string | null): Promise<TriageResult['metrics']['marketSignals']> {
    if (!tradeAreaId) {
      return {
        score: 5,
        rentGrowth: 0.03,
        populationGrowth: 0.01,
        jobGrowth: 0.02,
        trendVerdict: 'Stable',
      };
    }

    // Get market data from trade area
    const result = await this.db.query(
      `SELECT avg_rent_growth, population_growth, job_growth
       FROM trade_areas WHERE id = $1`,
      [tradeAreaId]
    );

    const market = result.rows[0];
    if (!market) {
      return {
        score: 5,
        rentGrowth: 0.03,
        populationGrowth: 0.01,
        jobGrowth: 0.02,
        trendVerdict: 'Stable',
      };
    }

    const rentGrowth = market.avg_rent_growth || 0.03;
    const populationGrowth = market.population_growth || 0.01;
    const jobGrowth = market.job_growth || 0.02;

    // Calculate composite market score
    const avgGrowth = (rentGrowth + populationGrowth + jobGrowth) / 3;

    let score = 5; // baseline
    let trendVerdict = 'Stable';

    if (avgGrowth > 0.06) {
      score = 15;
      trendVerdict = 'Strong Growth';
    } else if (avgGrowth > 0.04) {
      score = 12;
      trendVerdict = 'Moderate Growth';
    } else if (avgGrowth > 0.02) {
      score = 8;
      trendVerdict = 'Stable';
    } else if (avgGrowth > 0) {
      score = 5;
      trendVerdict = 'Slow Growth';
    } else {
      score = 2;
      trendVerdict = 'Declining';
    }

    return {
      score,
      rentGrowth,
      populationGrowth,
      jobGrowth,
      trendVerdict,
    };
  }

  /**
   * Calculate property signals (0-20 points)
   */
  private async calculatePropertySignals(dealId: string, deal: any): Promise<TriageResult['metrics']['propertySignals']> {
    // Get properties within deal boundary
    const result = await this.db.query(
      `SELECT 
        COUNT(*) AS property_count,
        AVG(p.rent) AS avg_rent,
        AVG(CASE 
          WHEN p.lease_expiration_date IS NOT NULL 
            AND p.lease_expiration_date > NOW() 
          THEN 1.0 
          ELSE 0.7 
        END) AS avg_occupancy,
        AVG(CASE
          WHEN p.year_built >= 2010 THEN 0.9
          WHEN p.year_built >= 2000 THEN 0.7
          WHEN p.year_built >= 1990 THEN 0.5
          ELSE 0.3
        END) AS quality_score
      FROM properties p
      JOIN deals d ON d.id = $1
      WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat))`,
      [dealId]
    );

    const data = result.rows[0];
    const propertyCount = parseInt(data.property_count) || 0;
    const avgRent = parseFloat(data.avg_rent) || 0;
    const avgOccupancy = parseFloat(data.avg_occupancy) || 0.7;
    const qualityScore = parseFloat(data.quality_score) || 0.5;

    // Score calculation (0-20 points)
    let score = 0;

    // Property count factor (0-5 points)
    if (propertyCount >= 50) score += 5;
    else if (propertyCount >= 20) score += 4;
    else if (propertyCount >= 10) score += 3;
    else if (propertyCount >= 5) score += 2;
    else if (propertyCount > 0) score += 1;

    // Rent factor (0-8 points)
    if (avgRent >= 2500) score += 8;
    else if (avgRent >= 2000) score += 6;
    else if (avgRent >= 1500) score += 5;
    else if (avgRent >= 1000) score += 3;
    else if (avgRent > 0) score += 1;

    // Occupancy factor (0-4 points)
    score += Math.round(avgOccupancy * 4);

    // Quality factor (0-3 points)
    score += Math.round(qualityScore * 3);

    return {
      score,
      propertyCount,
      avgRent,
      avgOccupancy,
      qualityScore,
    };
  }

  /**
   * Step 5: Determine status from score
   */
  private determineStatus(score: number): 'Hot' | 'Warm' | 'Watch' | 'Pass' {
    if (score >= 35) return 'Hot';
    if (score >= 25) return 'Warm';
    if (score >= 15) return 'Watch';
    return 'Pass';
  }

  /**
   * Step 6: Identify recommended strategies
   */
  async assignStrategies(deal: any, metrics: TriageResult['metrics'], score: number): Promise<string[]> {
    const strategies: string[] = [];

    // High score strategies
    if (score >= 35) {
      strategies.push('Priority Acquisition - Fast-track due diligence');
      strategies.push('Aggressive Offer - Strong competition likely');
    } else if (score >= 25) {
      strategies.push('Standard Acquisition - Proceed with normal timeline');
      strategies.push('Negotiate Terms - Room for favorable conditions');
    } else if (score >= 15) {
      strategies.push('Watchlist - Monitor for changes');
      strategies.push('Alternative Uses - Explore creative strategies');
    } else {
      strategies.push('Pass or Creative - Significant challenges present');
    }

    // Project type specific
    if (deal.project_type === 'multifamily') {
      if (metrics.propertySignals.avgRent > 1800) {
        strategies.push('Premium Positioning - Target high-income renters');
      } else if (metrics.propertySignals.avgRent < 1200) {
        strategies.push('Affordable Housing - Explore tax credits and incentives');
      }
    } else if (deal.project_type === 'mixed_use') {
      strategies.push('Mixed-Use Development - Diversify revenue streams');
    }

    // Market-based strategies
    if (metrics.marketSignals.rentGrowth > 0.06) {
      strategies.push('Growth Play - Leverage strong rent appreciation');
    }

    return strategies;
  }

  /**
   * Step 7: Flag risks
   */
  async flagRisks(deal: any, metrics: TriageResult['metrics'], score: number): Promise<string[]> {
    const risks: string[] = [];

    // Low score = general risk
    if (score < 15) {
      risks.push('Low Overall Score - Multiple challenges identified');
    }

    // Market risks
    if (metrics.marketSignals.rentGrowth < 0.02) {
      risks.push('Weak Rent Growth - Limited pricing power');
    }

    if (metrics.marketSignals.populationGrowth < 0.01) {
      risks.push('Stagnant Population - Demand concerns');
    }

    // Property risks
    if (metrics.propertySignals.propertyCount < 5) {
      risks.push('Limited Comparable Data - Insufficient market intel');
    }

    if (metrics.propertySignals.avgOccupancy < 0.85) {
      risks.push('Low Occupancy - Soft market conditions');
    }

    if (metrics.propertySignals.qualityScore < 0.5) {
      risks.push('Older Building Stock - Higher renovation costs');
    }

    // Location risks
    if (metrics.locationSignals.marketStrength < 0.6) {
      risks.push('Weak Submarket - Below-average fundamentals');
    }

    // Budget risks
    if (deal.budget && deal.target_units) {
      const costPerUnit = deal.budget / deal.target_units;
      if (costPerUnit > 400000) {
        risks.push('High Cost Per Unit - Construction budget risk');
      } else if (costPerUnit < 150000) {
        risks.push('Low Cost Per Unit - Quality or feasibility concerns');
      }
    }

    if (risks.length === 0) {
      risks.push('No significant risks identified');
    }

    return risks;
  }

  /**
   * Step 8: Generate recommendations
   */
  private generateRecommendations(
    metrics: TriageResult['metrics'],
    strategies: string[],
    risks: string[],
    status: string
  ): string[] {
    const recommendations: string[] = [];

    if (status === 'Hot') {
      recommendations.push('Move quickly - strong opportunity with competitive interest likely');
      recommendations.push('Schedule site visit and preliminary analysis within 7 days');
    } else if (status === 'Warm') {
      recommendations.push('Conduct detailed market research and feasibility study');
      recommendations.push('Engage with key stakeholders and gather community feedback');
    } else if (status === 'Watch') {
      recommendations.push('Monitor market conditions and re-evaluate in 30-60 days');
      recommendations.push('Explore alternative strategies or value-add opportunities');
    } else {
      recommendations.push('Consider passing unless creative approach can mitigate risks');
      recommendations.push('Look for similar opportunities in stronger markets');
    }

    // Property-specific recommendations
    if (metrics.propertySignals.propertyCount < 10) {
      recommendations.push('Gather additional comparable data from adjacent areas');
    }

    // Market-specific recommendations
    if (metrics.marketSignals.trendVerdict === 'Strong Growth') {
      recommendations.push('Capitalize on strong market momentum with premium positioning');
    }

    return recommendations;
  }

  /**
   * Step 9: Save triage result to database
   */
  private async saveTriageResult(dealId: string, result: TriageResult): Promise<void> {
    await this.db.query(
      `UPDATE deals 
       SET triage_result = $1, 
           triage_status = $2, 
           triage_score = $3, 
           triaged_at = NOW()
       WHERE id = $4`,
      [JSON.stringify(result), result.status, result.score, dealId]
    );

    console.log(`[Triage] Saved result to database`);
  }

  /**
   * Step 10: Log activity
   */
  private async logTriageActivity(dealId: string, result: TriageResult): Promise<void> {
    // Get user ID from deal
    const dealResult = await this.db.query(
      'SELECT user_id FROM deals WHERE id = $1',
      [dealId]
    );

    const userId = dealResult.rows[0]?.user_id;

    await this.db.query(
      `INSERT INTO deal_activity (deal_id, user_id, action_type, description, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        dealId,
        userId,
        'triage_completed',
        `Auto-triage completed: ${result.score}/50 (${result.status})`,
        JSON.stringify({
          score: result.score,
          status: result.status,
          strategies: result.strategies.length,
          risks: result.risks.length,
        }),
      ]
    );

    console.log(`[Triage] Logged activity`);
  }
}
