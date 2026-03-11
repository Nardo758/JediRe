/**
 * Multifamily Leasing Traffic Prediction Service
 * 
 * Predicts weekly leasing metrics (traffic, tours, leases) for apartment properties
 * Based on Leon's 290-unit property baseline data and market dynamics
 * 
 * Baseline Metrics (290 units, ~90% occupancy):
 * - Weekly Traffic: ~11 prospects
 * - Tour Conversion: 99%
 * - Closing Ratio: 20.7%
 * - Expected Weekly Leases: ~2.3
 * 
 * @version 1.0.0
 * @date 2025-02-18
 */

import { Pool } from 'pg';

// Baseline data from Leon's 290-unit property analysis
const BASELINE_DATA = {
  units: 290,
  baseline_occupancy: 0.90,
  baseline_weekly_traffic: 11,
  tour_conversion_rate: 0.99,  // 99% of traffic becomes tours
  closing_ratio: 0.207,         // 20.7% of tours become leases
  
  // Seasonality multipliers (calibrated from 243 weeks of Highlands actuals, Jul 2021 – Mar 2026)
  seasonality: {
    1: 1.09,   // January - stronger than expected (winter leasing activity)
    2: 1.12,   // February - pre-spring uptick
    3: 1.19,   // March - spring ramp
    4: 1.09,   // April - moderate
    5: 0.97,   // May - below average (contrary to industry assumption)
    6: 1.50,   // June - actual peak month (move-out driven demand)
    7: 1.26,   // July - strong summer
    8: 0.97,   // August - back to school slowdown
    9: 0.59,   // September - sharp drop (post-summer dead zone)
    10: 0.95,  // October - slight recovery
    11: 0.97,  // November - stable
    12: 0.49   // December - annual low (holiday dead zone)
  } as Record<number, number>,

  holiday_weeks: [
    { month: 9, dayRange: [1, 7], multiplier: 0.20, name: 'Labor Day' },
    { month: 12, dayRange: [23, 31], multiplier: 0.15, name: 'Christmas' },
    { month: 1, dayRange: [1, 3], multiplier: 0.30, name: 'New Year' },
    { month: 7, dayRange: [1, 7], multiplier: 0.50, name: 'July 4th' },
    { month: 11, dayRange: [22, 28], multiplier: 0.40, name: 'Thanksgiving' },
  ] as Array<{ month: number; dayRange: [number, number]; multiplier: number; name: string }>
};

export interface PropertyLeasingInput {
  units: number;
  occupancy: number;
  submarket_id: string;
  avg_rent: number;
  market_rent: number;
}

export interface LeasingPrediction {
  weekly_traffic: number;
  weekly_tours: number;
  expected_leases: number;
  closing_ratio: number;
  tour_conversion: number;
  confidence: number;
  breakdown: {
    base_traffic: number;
    demand_multiplier: number;
    pricing_multiplier: number;
    seasonality_multiplier: number;
    occupancy_multiplier: number;
  };
  market_context?: {
    supply_demand_ratio: number;
    market_condition: string;
  };
}

export interface MonthlyAbsorptionForecast {
  month: number;
  year: number;
  weeks: Array<{
    week_number: number;
    traffic: number;
    tours: number;
    expected_leases: number;
  }>;
  monthly_total_leases: number;
  monthly_total_traffic: number;
}

export interface LeaseUpTimeline {
  property_id: string;
  total_units: number;
  start_occupancy: number;
  target_occupancy: number;
  units_to_lease: number;
  estimated_weeks: number;
  estimated_completion_date: Date;
  weekly_projections: Array<{
    week: number;
    traffic: number;
    leases: number;
    cumulative_leases: number;
    occupancy: number;
  }>;
}

export interface RentOptimizationResult {
  property_id: string;
  current_rent: number;
  market_rent: number;
  scenarios: Array<{
    rent_level: number;
    rent_vs_market: string;
    pricing_multiplier: number;
    weekly_traffic: number;
    weekly_leases: number;
    weekly_revenue: number;
    months_to_stabilization: number;
    total_revenue_impact: string;
  }>;
  recommended_rent: number;
  recommendation_reason: string;
}

export class MultifamilyTrafficService {
  constructor(private pool: Pool) {}

  /**
   * Predict weekly leasing traffic and conversion metrics
   * 
   * This is the core prediction engine that combines:
   * 1. Property size scaling from baseline
   * 2. Market demand dynamics
   * 3. Pricing effects on traffic
   * 4. Seasonal patterns
   * 5. Occupancy-driven urgency
   */
  async predictWeeklyLeasingTraffic(
    property: PropertyLeasingInput,
    predictionDate?: Date
  ): Promise<LeasingPrediction> {
    try {
      // Step 1: Calculate base traffic scaled by property size
      const base_traffic = (property.units / BASELINE_DATA.units) * BASELINE_DATA.baseline_weekly_traffic;

      // Step 2: Get market demand multiplier
      const marketData = await this.getMarketDemand(property.submarket_id);
      const demand_multiplier = this.calculateDemandMultiplier(
        marketData?.supply_demand_ratio || 1.0
      );

      // Step 3: Calculate pricing multiplier
      const rent_ratio = property.avg_rent / property.market_rent;
      const pricing_multiplier = this.calculatePricingMultiplier(rent_ratio);

      // Step 4: Apply seasonality for the target date (defaults to current date)
      const targetDate = predictionDate || new Date();
      const current_month = targetDate.getMonth() + 1;
      const current_day = targetDate.getDate();
      const seasonality_multiplier = BASELINE_DATA.seasonality[current_month] || 1.0;

      // Step 4b: Apply holiday week adjustment (overrides seasonality if in a holiday window)
      const holiday_multiplier = this.getHolidayMultiplier(current_month, current_day);

      // Step 5: Apply occupancy factor (gradient-based)
      const occupancy_multiplier = this.calculateOccupancyMultiplier(property.occupancy);

      // Step 6: Calculate final prediction
      const effective_seasonality = holiday_multiplier !== null
        ? holiday_multiplier
        : seasonality_multiplier;

      const predicted_traffic = Math.round(
        base_traffic *
        demand_multiplier *
        pricing_multiplier *
        effective_seasonality *
        occupancy_multiplier
      );

      const predicted_tours = Math.round(predicted_traffic * BASELINE_DATA.tour_conversion_rate);
      const dynamic_closing_ratio = this.calculateClosingRatio(property.occupancy, current_month);
      const predicted_leases = Math.round(predicted_tours * dynamic_closing_ratio * 10) / 10;

      // Calculate confidence based on data availability
      const confidence = this.calculateConfidence(property, marketData);

      const prediction: LeasingPrediction = {
        weekly_traffic: predicted_traffic,
        weekly_tours: predicted_tours,
        expected_leases: predicted_leases,
        closing_ratio: dynamic_closing_ratio,
        tour_conversion: BASELINE_DATA.tour_conversion_rate,
        confidence,
        breakdown: {
          base_traffic: Math.round(base_traffic * 10) / 10,
          demand_multiplier,
          pricing_multiplier,
          seasonality_multiplier,
          occupancy_multiplier
        }
      };

      if (marketData) {
        prediction.market_context = {
          supply_demand_ratio: marketData.supply_demand_ratio,
          market_condition: marketData.market_condition
        };
      }

      return prediction;
    } catch (error) {
      console.error('[MultifamilyTrafficService] Error predicting traffic:', error);
      throw error;
    }
  }

  /**
   * Predict monthly absorption (4-week forecast)
   * 
   * Returns week-by-week projections for the next 4 weeks
   */
  async predictMonthlyAbsorption(
    property: PropertyLeasingInput,
    weeks: number = 4
  ): Promise<MonthlyAbsorptionForecast> {
    try {
      const current_date = new Date();
      const weekly_projections: MonthlyAbsorptionForecast['weeks'] = [];
      let total_leases = 0;
      let total_traffic = 0;

      for (let i = 0; i < weeks; i++) {
        // Project future date
        const future_date = new Date(current_date);
        future_date.setDate(future_date.getDate() + (i * 7));
        
        // Get month/day for seasonality and holiday checks
        const month = future_date.getMonth() + 1;
        const day = future_date.getDate();
        const seasonality_multiplier = BASELINE_DATA.seasonality[month] || 1.0;
        const holiday_multiplier = this.getHolidayMultiplier(month, day);
        const effective_seasonality = holiday_multiplier !== null ? holiday_multiplier : seasonality_multiplier;

        // Calculate base prediction
        const base_traffic = (property.units / BASELINE_DATA.units) * BASELINE_DATA.baseline_weekly_traffic;
        
        // Get market multipliers (same as main prediction)
        const marketData = await this.getMarketDemand(property.submarket_id);
        const demand_multiplier = this.calculateDemandMultiplier(marketData?.supply_demand_ratio || 1.0);
        const rent_ratio = property.avg_rent / property.market_rent;
        const pricing_multiplier = this.calculatePricingMultiplier(rent_ratio);
        const occupancy_multiplier = this.calculateOccupancyMultiplier(property.occupancy);

        // Calculate week prediction
        const traffic = Math.round(
          base_traffic *
          demand_multiplier *
          pricing_multiplier *
          effective_seasonality *
          occupancy_multiplier
        );

        const tours = Math.round(traffic * BASELINE_DATA.tour_conversion_rate);
        const dynamic_closing_ratio = this.calculateClosingRatio(property.occupancy, month);
        const leases = Math.round(tours * dynamic_closing_ratio * 10) / 10;

        weekly_projections.push({
          week_number: i + 1,
          traffic,
          tours,
          expected_leases: leases
        });

        total_leases += leases;
        total_traffic += traffic;
      }

      return {
        month: current_date.getMonth() + 1,
        year: current_date.getFullYear(),
        weeks: weekly_projections,
        monthly_total_leases: Math.round(total_leases * 10) / 10,
        monthly_total_traffic: total_traffic
      };
    } catch (error) {
      console.error('[MultifamilyTrafficService] Error predicting monthly absorption:', error);
      throw error;
    }
  }

  /**
   * Calculate lease-up timeline for new construction or major renovation
   * 
   * Projects how long it will take to reach target occupancy
   */
  async calculateLeaseUpTimeline(
    propertyId: string,
    totalUnits: number,
    startOccupancy: number,
    targetOccupancy: number,
    submarketId: string,
    avgRent: number,
    marketRent: number
  ): Promise<LeaseUpTimeline> {
    try {
      const units_to_lease = Math.ceil(totalUnits * (targetOccupancy - startOccupancy));
      
      const property: PropertyLeasingInput = {
        units: totalUnits,
        occupancy: startOccupancy,
        submarket_id: submarketId,
        avg_rent: avgRent,
        market_rent: marketRent
      };

      const weekly_projections: LeaseUpTimeline['weekly_projections'] = [];
      let cumulative_leases = 0;
      let current_occupancy = startOccupancy;
      let week = 0;

      const startDate = new Date();

      while (current_occupancy < targetOccupancy && week < 104) { // Max 2 years
        week++;

        // Update property occupancy for prediction
        property.occupancy = current_occupancy;

        // Calculate the future date for this week's prediction
        const futureDate = new Date(startDate);
        futureDate.setDate(futureDate.getDate() + (week * 7));

        // Get prediction for this week using the projected date for correct seasonality
        const prediction = await this.predictWeeklyLeasingTraffic(property, futureDate);

        cumulative_leases += prediction.expected_leases;
        current_occupancy = startOccupancy + (cumulative_leases / totalUnits);

        weekly_projections.push({
          week,
          traffic: prediction.weekly_traffic,
          leases: prediction.expected_leases,
          cumulative_leases: Math.round(cumulative_leases * 10) / 10,
          occupancy: Math.round(current_occupancy * 1000) / 1000
        });

        if (current_occupancy >= targetOccupancy) break;
      }

      const completion_date = new Date();
      completion_date.setDate(completion_date.getDate() + (week * 7));

      return {
        property_id: propertyId,
        total_units: totalUnits,
        start_occupancy: startOccupancy,
        target_occupancy: targetOccupancy,
        units_to_lease,
        estimated_weeks: week,
        estimated_completion_date: completion_date,
        weekly_projections
      };
    } catch (error) {
      console.error('[MultifamilyTrafficService] Error calculating lease-up timeline:', error);
      throw error;
    }
  }

  /**
   * Optimize rent for velocity - analyze rent vs absorption tradeoff
   * 
   * Tests different rent levels and shows impact on traffic, velocity, and revenue
   */
  async optimizeRentForVelocity(
    propertyId: string,
    property: PropertyLeasingInput,
    targetMonthsToStabilization?: number
  ): Promise<RentOptimizationResult> {
    try {
      const scenarios: RentOptimizationResult['scenarios'] = [];
      
      // Test 5 pricing scenarios: -10%, -5%, market, +5%, +10%
      const rent_scenarios = [
        { multiplier: 0.90, label: '-10%' },
        { multiplier: 0.95, label: '-5%' },
        { multiplier: 1.00, label: 'Market' },
        { multiplier: 1.05, label: '+5%' },
        { multiplier: 1.10, label: '+10%' }
      ];

      for (const scenario of rent_scenarios) {
        const test_rent = property.market_rent * scenario.multiplier;
        const test_property = {
          ...property,
          avg_rent: test_rent
        };

        // Get prediction for this pricing
        const prediction = await this.predictWeeklyLeasingTraffic(test_property);

        // Calculate time to stabilization (95% occupancy)
        const units_needed = Math.ceil(property.units * (0.95 - property.occupancy));
        const weeks_to_stabilize = Math.ceil(units_needed / prediction.expected_leases);
        const months_to_stabilize = Math.round(weeks_to_stabilize / 4.33 * 10) / 10;

        // Calculate weekly revenue impact
        const weekly_revenue = prediction.expected_leases * test_rent;
        const market_weekly_revenue = prediction.expected_leases * property.market_rent;
        const revenue_diff = weekly_revenue - market_weekly_revenue;
        const revenue_impact = revenue_diff >= 0 
          ? `+$${Math.round(revenue_diff).toLocaleString()}/week`
          : `-$${Math.round(Math.abs(revenue_diff)).toLocaleString()}/week`;

        scenarios.push({
          rent_level: test_rent,
          rent_vs_market: scenario.label,
          pricing_multiplier: prediction.breakdown.pricing_multiplier,
          weekly_traffic: prediction.weekly_traffic,
          weekly_leases: prediction.expected_leases,
          weekly_revenue: Math.round(weekly_revenue),
          months_to_stabilization: months_to_stabilize,
          total_revenue_impact: revenue_impact
        });
      }

      // Determine recommendation
      let recommended_rent = property.market_rent;
      let recommendation_reason = 'Market rate provides balanced velocity and revenue';

      if (targetMonthsToStabilization && targetMonthsToStabilization < 6) {
        // Aggressive lease-up needed
        recommended_rent = property.market_rent * 0.95;
        recommendation_reason = `5% below market accelerates lease-up to meet ${targetMonthsToStabilization}-month target`;
      } else if (property.occupancy > 0.92) {
        // High occupancy - can push rent
        recommended_rent = property.market_rent * 1.05;
        recommendation_reason = 'High occupancy allows 5% rent premium with minimal velocity impact';
      }

      return {
        property_id: propertyId,
        current_rent: property.avg_rent,
        market_rent: property.market_rent,
        scenarios,
        recommended_rent,
        recommendation_reason
      };
    } catch (error) {
      console.error('[MultifamilyTrafficService] Error optimizing rent:', error);
      throw error;
    }
  }

  /**
   * Get market demand data from Market Research Engine
   */
  private async getMarketDemand(submarketId: string): Promise<{
    supply_demand_ratio: number;
    market_condition: string;
  } | null> {
    try {
      // Query market research data
      const result = await this.pool.query(
        `SELECT 
          supply_demand_ratio,
          market_condition
         FROM market_research_cache
         WHERE submarket_id = $1
           AND created_at >= NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC
         LIMIT 1`,
        [submarketId]
      );

      if (result.rows.length === 0) {
        console.warn(`[MultifamilyTrafficService] No recent market data for submarket ${submarketId}`);
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.warn('[MultifamilyTrafficService] Error fetching market demand:', error);
      return null;
    }
  }

  /**
   * Calculate demand multiplier based on supply-demand ratio
   * 
   * Undersupplied market (ratio > 1.2) → +30% traffic
   * Balanced market (0.8-1.2) → No adjustment
   * Oversupplied market (ratio < 0.8) → -30% traffic
   */
  private calculateDemandMultiplier(supplyDemandRatio: number): number {
    if (supplyDemandRatio > 1.2) {
      // Undersupplied - more demand, more traffic
      return 1.3;
    } else if (supplyDemandRatio < 0.8) {
      // Oversupplied - less demand, less traffic
      return 0.7;
    }
    return 1.0;
  }

  /**
   * Calculate pricing multiplier
   * 
   * Below market (<0.95) → +20% traffic
   * At market (0.95-1.05) → No adjustment
   * Above market (>1.05) → -20% traffic
   */
  private calculatePricingMultiplier(rentRatio: number): number {
    if (rentRatio < 0.95) {
      // Priced below market - attracts more traffic
      return 1.2;
    } else if (rentRatio > 1.05) {
      // Priced above market - reduces traffic
      return 0.8;
    }
    return 1.0;
  }

  /**
   * Calculate occupancy multiplier using gradient interpolation
   * 
   * Calibrated from 243 weeks of actuals:
   *   <88% occ → 1.77x (avg traffic 20.0 vs 11.3 baseline)
   *   88-91%   → 1.71x
   *   91-94%   → 1.22x
   *   94-96%   → 0.96x (near baseline)
   *   >96%     → 0.78x
   * 
   * Uses linear interpolation between anchor points for smooth transitions
   */
  private calculateOccupancyMultiplier(occupancy: number): number {
    const anchors: [number, number][] = [
      [0.80, 1.60],
      [0.85, 1.40],
      [0.88, 1.25],
      [0.91, 1.10],
      [0.94, 1.00],
      [0.96, 0.88],
      [0.98, 0.78],
      [1.00, 0.70],
    ];

    if (occupancy <= anchors[0][0]) return anchors[0][1];
    if (occupancy >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];

    for (let i = 0; i < anchors.length - 1; i++) {
      const [occ1, mult1] = anchors[i];
      const [occ2, mult2] = anchors[i + 1];
      if (occupancy >= occ1 && occupancy <= occ2) {
        const t = (occupancy - occ1) / (occ2 - occ1);
        return mult1 + t * (mult2 - mult1);
      }
    }

    return 1.0;
  }

  /**
   * Get holiday week multiplier
   * 
   * Returns a replacement multiplier for weeks containing major holidays,
   * or null if the current date is not in a holiday window.
   * Calibrated from actual 0-2 traffic weeks in the data.
   */
  private getHolidayMultiplier(month: number, day: number): number | null {
    for (const holiday of BASELINE_DATA.holiday_weeks) {
      if (month === holiday.month && day >= holiday.dayRange[0] && day <= holiday.dayRange[1]) {
        return holiday.multiplier;
      }
    }
    return null;
  }

  /**
   * Calculate dynamic closing ratio based on occupancy and season
   * 
   * Calibrated from actuals:
   *   Base rate: 20.4% (overall average)
   *   Occupancy effect: low occ (<88%) pushes to ~31%, high occ (>96%) drops to ~25%
   *   Seasonal effect: June peaks at 40%, Sep-Oct dips to 16-30%
   * 
   * The closing ratio reflects both market urgency (occupancy) and
   * seasonal demand quality (month).
   */
  private calculateClosingRatio(occupancy: number, month: number): number {
    const BASE_CLOSE_RATE = 0.204;

    const occFactor = occupancy < 0.88 ? 1.30
      : occupancy < 0.91 ? 1.20
      : occupancy < 0.94 ? 1.10
      : occupancy < 0.96 ? 1.05
      : 1.00;

    const seasonalCloseRates: Record<number, number> = {
      1: 0.95,
      2: 1.05,
      3: 1.10,
      4: 1.30,
      5: 1.25,
      6: 1.50,
      7: 1.30,
      8: 0.95,
      9: 1.20,
      10: 0.85,
      11: 0.90,
      12: 0.95,
    };

    const seasonFactor = seasonalCloseRates[month] || 1.0;

    return Math.min(0.50, Math.max(0.08, BASE_CLOSE_RATE * occFactor * seasonFactor));
  }

  /**
   * Calculate prediction confidence score (0-1)
   * 
   * Based on:
   * - Market data availability (40%)
   * - Property data completeness (30%)
   * - Historical pattern match (30%)
   */
  private calculateConfidence(
    property: PropertyLeasingInput,
    marketData: { supply_demand_ratio: number; market_condition: string } | null
  ): number {
    let confidence = 0;

    // Market data component (0.4)
    if (marketData) {
      confidence += 0.4;
    } else {
      confidence += 0.2; // Partial credit for using defaults
    }

    // Property data completeness (0.3)
    const has_valid_rent = property.avg_rent > 0 && property.market_rent > 0;
    const has_reasonable_occupancy = property.occupancy >= 0.5 && property.occupancy <= 1.0;
    
    if (has_valid_rent && has_reasonable_occupancy) {
      confidence += 0.3;
    } else if (has_valid_rent || has_reasonable_occupancy) {
      confidence += 0.15;
    }

    // Historical pattern match (0.3)
    // For now, assume baseline patterns are reliable
    confidence += 0.3;

    return Math.round(confidence * 100) / 100;
  }
}

export default MultifamilyTrafficService;
