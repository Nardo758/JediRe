/**
 * JEDI RE Traffic Prediction Engine
 * Property-Level Foot Traffic Predictions
 * 
 * Converts market-level demand (from Market Research Engine V2)
 * into property-specific weekly walk-ins predictions
 * 
 * Key Formula: 1 new job = 0.45 units housing demand = 15 retail trips/week
 */

import { pool } from '../database';
import marketResearchEngine from './marketResearchEngine';

interface Property {
  id: string;
  property_name: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  submarket_id: string;
  
  // Physical attributes
  adt?: number;  // Average Daily Traffic
  is_corner: boolean;
  frontage_feet?: number;
  setback_feet?: number;
  road_type?: string;  // 'arterial', 'collector', 'local', 'main_street'
  sidewalk_score?: number;  // 0-100
  signage_score?: number;  // 0-100
  entrance_score?: number;  // 0-100
  
  // Demographics (ring analysis)
  residential_units_400m?: number;  // Quarter mile
  residential_units_800m?: number;  // Half mile
  employment_count_400m?: number;   // Workers nearby
  
  // Transit access
  nearest_transit_distance_feet?: number;
  transit_daily_riders?: number;
  
  // Property type
  property_type?: string;
  has_retail: boolean;
  retail_sf?: number;
  suitable_for_restaurant: boolean;
  near_office_district: boolean;
  
  // Competitive context
  competitor_count_500m?: number;
}

interface TrafficPrediction {
  property_id: string;
  deal_id?: string;
  prediction_week: number;
  prediction_year: number;
  
  weekly_walk_ins: number;
  daily_average: number;
  peak_hour_estimate: number;
  
  breakdown: {
    physical_factors: number;
    market_demand_factors: number;
    supply_demand_adjustment: number;
    base_before_adjustment: number;
  };
  
  temporal_patterns: {
    weekday_avg: number;
    weekend_avg: number;
    weekday_total: number;
    weekend_total: number;
    peak_day: string;
    peak_hour: string;
  };
  
  confidence: {
    score: number;
    tier: 'High' | 'Medium' | 'Low';
    breakdown: Record<string, number>;
  };
  
  market_context: {
    submarket: string;
    market_condition: string;
    foot_traffic_index: number;
    supply_demand_ratio: number;
  };
  
  model_version: string;
  prediction_date: Date;
}

export class TrafficPredictionEngine {
  
  private readonly MODEL_VERSION = '1.0.0';
  private readonly JOBS_TO_UNITS_MULTIPLIER = 0.45;
  private readonly JOBS_TO_RETAIL_TRIPS = 15;  // 1 job = 15 weekly retail trips
  
  /**
   * Predict weekly foot traffic for a property
   */
  async predictTraffic(propertyId: string, targetWeek?: number): Promise<TrafficPrediction> {
    console.log(`🚶 Predicting traffic for property ${propertyId}`);
    
    const startTime = Date.now();
    
    // Step 1: Load property data
    const property = await this.loadProperty(propertyId);
    
    // Step 2: Load market research
    const marketResearch = await marketResearchEngine.getCachedReport(propertyId, 24);
    
    if (!marketResearch) {
      throw new Error('Market research required for traffic prediction. Generate market report first.');
    }
    
    // Step 3: Calculate physical traffic component
    const physicalTraffic = this.calculatePhysicalTraffic(property);
    
    // Step 4: Translate market demand to property traffic
    const demandTraffic = this.translateDemandToTraffic(property, marketResearch);
    
    // Step 5: Combine components (60% physical, 40% demand)
    const baseTraffic = (physicalTraffic * 0.60) + (demandTraffic * 0.40);
    
    // Step 6: Apply supply-demand dynamics
    const adjusted = this.applySupplyDemandAdjustment(
      baseTraffic,
      marketResearch.supply_analysis,
      marketResearch.employment_impact
    );
    
    // Step 7: Apply calibration factors
    const calibrated = await this.applyCalibrations(
      adjusted.traffic,
      property,
      marketResearch
    );
    
    // Step 8: Calculate temporal patterns
    const temporal = this.calculateTemporalSplit(calibrated, property);
    
    // Step 9: Calculate confidence
    const confidence = await this.calculateConfidence(property, marketResearch);
    
    // Step 10: Get current week/year
    const { week, year } = targetWeek 
      ? { week: targetWeek, year: new Date().getFullYear() }
      : this.getCurrentWeek();
    
    // Step 11: Build prediction object
    const prediction: TrafficPrediction = {
      property_id: propertyId,
      prediction_week: week,
      prediction_year: year,
      
      weekly_walk_ins: Math.round(calibrated),
      daily_average: Math.round(calibrated / 7),
      peak_hour_estimate: Math.round(calibrated / 7 / 10),  // Assume 10 active hours/day
      
      breakdown: {
        physical_factors: Math.round(physicalTraffic),
        market_demand_factors: Math.round(demandTraffic),
        supply_demand_adjustment: adjusted.multiplier,
        base_before_adjustment: Math.round(baseTraffic)
      },
      
      temporal_patterns: temporal,
      
      confidence,
      
      market_context: {
        submarket: marketResearch.submarket_name,
        market_condition: adjusted.condition,
        foot_traffic_index: marketResearch.demand_indicators?.properties_in_market || 100,
        supply_demand_ratio: marketResearch.supply_analysis?.future_supply_ratio || 1.0
      },
      
      model_version: this.MODEL_VERSION,
      prediction_date: new Date()
    };
    
    // Step 12: Save prediction to database
    await this.savePrediction(prediction);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Traffic prediction generated in ${duration}ms: ${prediction.weekly_walk_ins} weekly walk-ins`);
    
    return prediction;
  }
  
  /**
   * Calculate traffic from physical location attributes
   */
  private calculatePhysicalTraffic(property: Property): number {
    // Component 1: Street pedestrian volume
    const streetPedestrians = this.calculateStreetPedestrians(property);
    
    // Component 2: Capture rate (what % of pedestrians enter)
    const captureRate = this.calculateCaptureRate(property);
    
    // Component 3: Traffic from nearby generators
    const generatorTraffic = (
      this.calculateResidentialWalkins(property) +
      this.calculateWorkerWalkins(property) +
      this.calculateTransitWalkins(property)
    );
    
    // Total physical traffic
    const total = (streetPedestrians * captureRate) + generatorTraffic;
    
    return Math.max(0, total);
  }
  
  private calculateStreetPedestrians(property: Property): number {
    if (!property.adt) return 0;
    
    // Conversion rates: vehicles → pedestrians
    const conversionRates: Record<string, number> = {
      'arterial': 0.02,
      'collector': 0.05,
      'local': 0.08,
      'main_street': 0.15
    };
    
    const baseRate = conversionRates[property.road_type || 'collector'] || 0.03;
    
    // Adjust for sidewalk quality
    const sidewalkMultiplier = 0.5 + ((property.sidewalk_score || 50) / 100) * 1.5;
    
    const dailyPedestrians = property.adt * baseRate * sidewalkMultiplier;
    return dailyPedestrians * 7;  // Weekly
  }
  
  private calculateCaptureRate(property: Property): number {
    const baseRate = 0.05;  // 5% of pedestrians enter
    
    // Frontage bonus (wider = more visible)
    const frontageMultiplier = 1.0 + Math.min((property.frontage_feet || 50) / 100, 1.0);
    
    // Corner premium
    const cornerMultiplier = property.is_corner ? 1.4 : 1.0;
    
    // Setback penalty
    const setbackPenalty = Math.max(0.5, 1.0 - ((property.setback_feet || 10) / 50));
    
    // Signage and entrance factors
    const visibilityMultiplier = 0.7 + ((property.signage_score || 50) / 100) * 0.6;
    const entranceMultiplier = 0.8 + ((property.entrance_score || 50) / 100) * 0.4;
    
    const captureRate = (
      baseRate *
      frontageMultiplier *
      cornerMultiplier *
      setbackPenalty *
      visibilityMultiplier *
      entranceMultiplier
    );
    
    return Math.min(captureRate, 0.25);  // Cap at 25%
  }
  
  private calculateResidentialWalkins(property: Property): number {
    const unitsQuarterMile = property.residential_units_400m || 0;
    const unitsHalfMile = property.residential_units_800m || 0;
    
    // Closer residents visit more often
    const weeklyTrips = {
      quarter_mile: 2.5,
      half_mile: 0.8
    };
    
    return (
      unitsQuarterMile * weeklyTrips.quarter_mile +
      unitsHalfMile * weeklyTrips.half_mile
    );
  }
  
  private calculateWorkerWalkins(property: Property): number {
    const workers = property.employment_count_400m || 0;
    const visitRate = 0.15;  // 15% of workers visit weekly
    const visitsPerWorker = 1.5;
    
    return workers * visitRate * visitsPerWorker;
  }
  
  private calculateTransitWalkins(property: Property): number {
    if (!property.nearest_transit_distance_feet || property.nearest_transit_distance_feet > 2000) {
      return 0;  // Too far
    }
    
    const dailyRiders = property.transit_daily_riders || 0;
    const distanceDecay = Math.max(0, 1 - (property.nearest_transit_distance_feet / 2000));
    const captureRate = 0.08 * distanceDecay;
    
    return dailyRiders * 7 * captureRate;
  }
  
  /**
   * Translate market demand to property traffic
   * Uses Market Research Engine V2 output
   */
  private translateDemandToTraffic(property: Property, marketResearch: any): number {
    // Component 1: Employment-driven traffic
    const employmentTraffic = this.calculateEmploymentTraffic(
      marketResearch.employment_impact,
      property
    );
    
    // Component 2: Population growth traffic
    const populationTraffic = this.calculatePopulationTraffic(
      marketResearch.per_capita,
      property
    );
    
    // Component 3: Retail demand traffic
    const retailTraffic = this.calculateRetailDemandTraffic(
      marketResearch.supply_analysis,
      property
    );
    
    // Component 4: Market traffic multiplier
    const marketMultiplier = (marketResearch.demand_indicators?.properties_in_market || 100) / 100;
    
    const totalDemandTraffic = (
      employmentTraffic +
      populationTraffic +
      retailTraffic
    ) * marketMultiplier;
    
    return Math.max(0, totalDemandTraffic);
  }
  
  private calculateEmploymentTraffic(employmentImpact: any, property: Property): number {
    if (!employmentImpact) return 0;
    
    // From Market Research V2: total units demand from news
    const totalJobsAdded = employmentImpact.total_jobs_from_news || 0;
    
    if (totalJobsAdded <= 0) return 0;
    
    // Convert jobs to retail trips
    // 1 job = 15 weekly retail trips (lunch, shopping, after-work)
    const totalRetailTrips = totalJobsAdded * this.JOBS_TO_RETAIL_TRIPS;
    
    // This property's share of submarket traffic
    const propertyShare = this.calculatePropertyShare(property);
    
    return totalRetailTrips * propertyShare;
  }
  
  private calculatePopulationTraffic(perCapita: any, property: Property): number {
    if (!perCapita) return 0;
    
    const population = perCapita.population || 0;
    
    // Assume each person makes 3 weekly retail trips
    const weeklyTripsPerPerson = 3.0;
    const totalTrips = population * weeklyTripsPerPerson;
    
    // This property's share
    const propertyShare = this.calculatePropertyShare(property);
    
    return totalTrips * propertyShare * 0.1;  // Only 10% of population shops in this specific area
  }
  
  private calculateRetailDemandTraffic(supplyAnalysis: any, property: Property): number {
    if (!property.has_retail || !supplyAnalysis) return 0;
    
    // More available units = more people moving in = more retail traffic
    const availableUnits = supplyAnalysis.available_units_now || 0;
    
    // Each occupied unit generates ~10 weekly retail trips
    const tripsPerUnit = 10;
    const newRetailTraffic = availableUnits * tripsPerUnit;
    
    const propertyShare = this.calculatePropertyShare(property);
    
    return newRetailTraffic * propertyShare;
  }
  
  private calculatePropertyShare(property: Property): number {
    // Simple model: assume property captures 2-5% of submarket traffic
    // This should be enhanced with actual competitive analysis
    
    let baseShare = 0.03;  // 3% default
    
    // Corner properties capture more
    if (property.is_corner) baseShare *= 1.5;
    
    // Larger frontage = more capture
    if (property.frontage_feet && property.frontage_feet > 100) {
      baseShare *= 1.3;
    }
    
    // Fewer competitors = higher share
    if (property.competitor_count_500m && property.competitor_count_500m < 5) {
      baseShare *= 1.4;
    }
    
    return Math.min(baseShare, 0.10);  // Cap at 10%
  }
  
  /**
   * Apply supply-demand dynamics
   */
  private applySupplyDemandAdjustment(
    baseTraffic: number,
    supplyAnalysis: any,
    employmentImpact: any
  ): { traffic: number; multiplier: number; condition: string } {
    
    // Factor 1: Supply-demand ratio from zoning
    const futureSupplyRatio = supplyAnalysis?.future_supply_ratio || 100;
    
    // Undersupplied market = traffic premium
    let scarcityMultiplier = 1.0;
    if (futureSupplyRatio < 150) {  // Less than 150% future supply
      scarcityMultiplier = 1.2;  // 20% boost
    } else if (futureSupplyRatio > 250) {  // More than 250% future supply
      scarcityMultiplier = 0.85;  // 15% reduction
    }
    
    // Factor 2: Employment demand coverage
    const demandCoverage = employmentImpact?.demand_absorption_vs_future || 0;
    
    // Strong employment demand boosts traffic
    let demandMultiplier = 1.0;
    if (demandCoverage > 150) {  // Demand exceeds supply by 50%+
      demandMultiplier = 1.15;
    } else if (demandCoverage < 50) {  // Weak demand
      demandMultiplier = 0.90;
    }
    
    const finalMultiplier = scarcityMultiplier * demandMultiplier;
    const adjustedTraffic = baseTraffic * finalMultiplier;
    
    const condition = 
      finalMultiplier > 1.15 ? 'STRONG DEMAND' :
      finalMultiplier < 0.95 ? 'WEAK DEMAND' : 'BALANCED';
    
    return {
      traffic: adjustedTraffic,
      multiplier: Math.round(finalMultiplier * 100) / 100,
      condition
    };
  }
  
  /**
   * Apply calibration factors from validation
   */
  private async applyCalibrations(
    baseTraffic: number,
    property: Property,
    marketResearch: any
  ): Promise<number> {
    
    // Load active calibration factors
    const factors = await pool.query(`
      SELECT factor_type, factor_key, multiplier
      FROM traffic_calibration_factors
      WHERE is_active = TRUE
      AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
    `);
    
    let calibrated = baseTraffic;
    
    for (const factor of factors.rows) {
      // Apply relevant factors
      if (factor.factor_type === 'global') {
        calibrated *= factor.multiplier;
      }
      else if (factor.factor_type === 'property_type' && factor.factor_key === property.property_type) {
        calibrated *= factor.multiplier;
      }
      else if (factor.factor_type === 'submarket' && factor.factor_key === property.submarket_id) {
        calibrated *= factor.multiplier;
      }
    }
    
    return calibrated;
  }
  
  /**
   * Calculate temporal patterns
   */
  private calculateTemporalSplit(
    weeklyTotal: number,
    property: Property
  ): TrafficPrediction['temporal_patterns'] {
    
    // Weekday vs weekend split by property type
    const weekdayPct = property.property_type === 'office' ? 0.80 :
                       property.property_type === 'restaurant' ? 0.60 :
                       property.property_type === 'retail' ? 0.65 : 0.70;
    
    const weekdayTotal = weeklyTotal * weekdayPct;
    const weekendTotal = weeklyTotal * (1 - weekdayPct);
    
    const weekdayAvg = weekdayTotal / 5;
    const weekendAvg = weekendTotal / 2;
    
    // Peak patterns
    const peakDay = property.property_type === 'restaurant' ? 'Saturday' : 'Friday';
    const peakHour = property.property_type === 'restaurant' ? '7:00 PM - 8:00 PM' : '12:00 PM - 1:00 PM';
    
    return {
      weekday_avg: Math.round(weekdayAvg),
      weekend_avg: Math.round(weekendAvg),
      weekday_total: Math.round(weekdayTotal),
      weekend_total: Math.round(weekendTotal),
      peak_day: peakDay,
      peak_hour: peakHour
    };
  }
  
  /**
   * Calculate prediction confidence
   */
  private async calculateConfidence(
    property: Property,
    marketResearch: any
  ): Promise<TrafficPrediction['confidence']> {
    
    // Factor 1: Do we have validation data for similar properties?
    const validationCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM validation_properties vp
      JOIN properties p ON vp.property_id = p.id
      WHERE p.submarket_id = $1
      AND vp.is_active = TRUE
    `, [property.submarket_id]);
    
    const validationConfidence = Math.min(validationCount.rows[0].count / 5, 1.0);
    
    // Factor 2: Market research confidence
    const marketConfidence = marketResearch.data_quality?.confidence_level === 'HIGH' ? 0.9 :
                             marketResearch.data_quality?.confidence_level === 'MEDIUM' ? 0.7 : 0.5;
    
    // Factor 3: Data completeness
    const hasADT = property.adt && property.adt > 0;
    const hasDemographics = property.residential_units_400m && property.residential_units_400m > 0;
    const dataCompleteness = ((hasADT ? 0.5 : 0) + (hasDemographics ? 0.5 : 0));
    
    // Combined confidence
    const overallConfidence = (
      validationConfidence * 0.40 +
      marketConfidence * 0.35 +
      dataCompleteness * 0.25
    );
    
    const tier = overallConfidence >= 0.75 ? 'High' :
                 overallConfidence >= 0.50 ? 'Medium' : 'Low';
    
    return {
      score: Math.round(overallConfidence * 100) / 100,
      tier,
      breakdown: {
        validation_data: Math.round(validationConfidence * 100) / 100,
        market_research: Math.round(marketConfidence * 100) / 100,
        data_completeness: Math.round(dataCompleteness * 100) / 100
      }
    };
  }
  
  /**
   * Save prediction to database
   */
  private async savePrediction(prediction: TrafficPrediction): Promise<void> {
    await pool.query(`
      INSERT INTO traffic_predictions (
        property_id,
        deal_id,
        prediction_week,
        prediction_year,
        weekly_walk_ins,
        daily_average,
        peak_hour_estimate,
        physical_traffic_component,
        demand_traffic_component,
        supply_demand_multiplier,
        base_before_adjustment,
        weekday_avg,
        weekend_avg,
        weekday_total,
        weekend_total,
        peak_day,
        peak_hour,
        confidence_score,
        confidence_tier,
        confidence_breakdown,
        submarket_id,
        foot_traffic_index,
        supply_demand_ratio,
        model_version,
        prediction_details
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
      ON CONFLICT (property_id, prediction_week, prediction_year)
      DO UPDATE SET
        weekly_walk_ins = EXCLUDED.weekly_walk_ins,
        daily_average = EXCLUDED.daily_average,
        confidence_score = EXCLUDED.confidence_score,
        updated_at = NOW()
    `, [
      prediction.property_id,
      prediction.deal_id || null,
      prediction.prediction_week,
      prediction.prediction_year,
      prediction.weekly_walk_ins,
      prediction.daily_average,
      prediction.peak_hour_estimate,
      prediction.breakdown.physical_factors,
      prediction.breakdown.market_demand_factors,
      prediction.breakdown.supply_demand_adjustment,
      prediction.breakdown.base_before_adjustment,
      prediction.temporal_patterns.weekday_avg,
      prediction.temporal_patterns.weekend_avg,
      prediction.temporal_patterns.weekday_total,
      prediction.temporal_patterns.weekend_total,
      prediction.temporal_patterns.peak_day,
      prediction.temporal_patterns.peak_hour,
      prediction.confidence.score,
      prediction.confidence.tier,
      JSON.stringify(prediction.confidence.breakdown),
      prediction.market_context.submarket,
      prediction.market_context.foot_traffic_index,
      prediction.market_context.supply_demand_ratio,
      prediction.model_version,
      JSON.stringify(prediction)
    ]);
  }
  
  /**
   * Load property data
   */
  private async loadProperty(propertyId: string): Promise<Property> {
    const result = await pool.query(`
      SELECT * FROM properties WHERE id = $1
    `, [propertyId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Property ${propertyId} not found`);
    }
    
    return result.rows[0];
  }
  
  /**
   * Get current week number
   */
  private getCurrentWeek(): { week: number; year: number } {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const week = Math.ceil(diff / oneWeek);
    
    return { week, year: now.getFullYear() };
  }
}

export default new TrafficPredictionEngine();
