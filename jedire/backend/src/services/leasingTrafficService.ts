/**
 * JEDI RE Leasing Traffic Prediction Service
 * Multifamily Property - Weekly Leasing Traffic Predictions
 * 
 * Predicts:
 * - Weekly inquiries/visitors
 * - Tours scheduled
 * - Net leases signed
 * - Closing ratios
 */

import { pool } from '../database';

interface LeasingTrafficPrediction {
  property_id: string;
  week_ending: string;
  
  // This week
  weekly_inquiries: number;
  weekly_tours: number;
  tours_conversion_rate: number;  // % of inquiries that become tours
  net_leases: number;
  closing_ratio: number;  // % of tours that lease
  
  // Context
  property_units: number;
  current_occupancy: number;
  baseline_type: string;  // e.g., "290-unit property baseline"
  
  // Confidence
  confidence: number;
  confidence_tier: 'High' | 'Medium' | 'Low';
}

interface LeasingForecast {
  property_id: string;
  weeks_forecast: number;
  
  weekly_data: Array<{
    week_ending: string;
    traffic: number;
    tours: number;
    net_leases: number;
    closing_pct: number;
    occupancy: number;
  }>;
  
  summary: {
    total_leases: string;  // e.g., "28-32"
    avg_per_week: number;
    annual_projection: number;
    turnover_rate: number;
  };
}

export class LeasingTrafficService {
  
  /**
   * Predict leasing traffic for current week
   * 
   * PLACEHOLDER IMPLEMENTATION:
   * Uses baseline multifamily metrics until ML model is trained
   */
  async predictCurrentWeek(propertyId: string): Promise<LeasingTrafficPrediction> {
    console.log(`📊 Predicting leasing traffic for property ${propertyId}`);
    
    // Load property data
    const property = await this.loadProperty(propertyId);
    
    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }
    
    // Get property size (units)
    const units = parseInt(property.units) || 290;
    
    // Calculate current week ending date (next Sunday)
    const now = new Date();
    const daysUntilSunday = 7 - now.getDay();
    const weekEnding = new Date(now);
    weekEnding.setDate(now.getDate() + daysUntilSunday);
    
    // BASELINE MULTIFAMILY METRICS (from industry standards)
    // Source: National Apartment Association, NMHC benchmarks
    
    // Base inquiries: ~3.8% of units per week for well-marketed properties
    const baseInquiryRate = 0.038;
    const weeklyInquiries = Math.round(units * baseInquiryRate);
    
    // Tours conversion: 95-99% (most inquiries schedule a tour)
    const toursConversionRate = 0.98;
    const weeklyTours = Math.round(weeklyInquiries * toursConversionRate);
    
    // Closing ratio: 20-25% (tours to signed leases)
    const closingRatio = 0.22 + (Math.random() * 0.05);  // 20-25% range
    const netLeases = Math.round(weeklyTours * closingRatio);
    
    // Occupancy (mock - should come from property data)
    const currentOccupancy = parseFloat(property.occupancy) || 0.91;
    
    const prediction: LeasingTrafficPrediction = {
      property_id: propertyId,
      week_ending: weekEnding.toISOString().split('T')[0],
      
      weekly_inquiries: weeklyInquiries,
      weekly_tours: weeklyTours,
      tours_conversion_rate: Math.round(toursConversionRate * 100),
      net_leases: netLeases,
      closing_ratio: Math.round(closingRatio * 100),
      
      property_units: units,
      current_occupancy: Math.round(currentOccupancy * 100),
      baseline_type: `${units}-unit property baseline`,
      
      confidence: 0.68,  // Medium - baseline model
      confidence_tier: 'Medium'
    };
    
    // Save prediction to database (optional)
    await this.savePrediction(prediction);
    
    console.log(`✅ Leasing prediction: ${prediction.weekly_inquiries} inquiries → ${prediction.net_leases} leases`);
    
    return prediction;
  }
  
  /**
   * Generate 12-week leasing forecast
   */
  async forecast(propertyId: string, weeks: number = 12): Promise<LeasingForecast> {
    console.log(`📈 Generating ${weeks}-week leasing forecast for property ${propertyId}`);
    
    const property = await this.loadProperty(propertyId);
    
    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }
    
    const units = parseInt(property.units) || 290;
    let currentOccupancy = parseFloat(property.occupancy) || 0.91;
    
    const weeklyData = [];
    let totalLeases = 0;
    
    // Generate forecast for each week
    for (let week = 0; week < weeks; week++) {
      const weekEnding = new Date();
      weekEnding.setDate(weekEnding.getDate() + (7 * week) + (7 - weekEnding.getDay()));
      
      // Seasonal variation (slight)
      const seasonalFactor = 1.0 + (Math.sin(week / 52 * 2 * Math.PI) * 0.1);
      
      // Base metrics with variation
      const baseInquiries = Math.round((units * 0.038) * seasonalFactor);
      const traffic = baseInquiries + Math.round((Math.random() - 0.5) * 4);
      const tours = Math.round(traffic * 0.98);
      const closingPct = 20 + Math.round(Math.random() * 6);  // 20-26%
      const netLeases = Math.round(tours * (closingPct / 100));
      
      // Update occupancy
      currentOccupancy = Math.min(0.98, currentOccupancy + (netLeases / units));
      
      weeklyData.push({
        week_ending: weekEnding.toISOString().split('T')[0],
        traffic,
        tours,
        net_leases: netLeases,
        closing_pct: closingPct,
        occupancy: Math.round(currentOccupancy * 1000) / 10  // 91.2%
      });
      
      totalLeases += netLeases;
    }
    
    // Calculate annual projection
    const avgPerWeek = totalLeases / weeks;
    const annualLeases = Math.round(avgPerWeek * 52);
    const turnoverRate = Math.round((annualLeases / units) * 100);
    
    return {
      property_id: propertyId,
      weeks_forecast: weeks,
      weekly_data: weeklyData,
      summary: {
        total_leases: `${totalLeases - 2}-${totalLeases + 2}`,  // Range
        avg_per_week: Math.round(avgPerWeek * 10) / 10,
        annual_projection: annualLeases,
        turnover_rate: turnoverRate
      }
    };
  }
  
  /**
   * Load property data
   */
  private async loadProperty(propertyId: string): Promise<any> {
    const result = await pool.query(`
      SELECT 
        id,
        address_line1,
        city,
        state_code,
        lat,
        lng,
        property_type,
        building_class,
        units,
        current_occupancy AS occupancy,
        avg_rent,
        market_rent,
        submarket_id,
        year_built,
        sqft
      FROM properties
      WHERE id = $1
    `, [propertyId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }
  
  /**
   * Save prediction to database (placeholder - table needs migration)
   */
  private async savePrediction(prediction: LeasingTrafficPrediction): Promise<void> {
    try {
      // Check if table exists first
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'leasing_traffic_predictions'
        );
      `);
      
      if (!tableExists.rows[0].exists) {
        console.log('⚠️  leasing_traffic_predictions table not created yet - skipping save');
        return;
      }
      
      await pool.query(`
        INSERT INTO leasing_traffic_predictions (
          property_id,
          week_ending,
          weekly_inquiries,
          weekly_tours,
          tours_conversion_rate,
          net_leases,
          closing_ratio,
          property_units,
          current_occupancy,
          baseline_type,
          confidence_score,
          confidence_tier,
          prediction_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (property_id, week_ending)
        DO UPDATE SET
          weekly_inquiries = EXCLUDED.weekly_inquiries,
          net_leases = EXCLUDED.net_leases,
          updated_at = NOW()
      `, [
        prediction.property_id,
        prediction.week_ending,
        prediction.weekly_inquiries,
        prediction.weekly_tours,
        prediction.tours_conversion_rate,
        prediction.net_leases,
        prediction.closing_ratio,
        prediction.property_units,
        prediction.current_occupancy,
        prediction.baseline_type,
        prediction.confidence,
        prediction.confidence_tier,
        JSON.stringify(prediction)
      ]);
      
    } catch (error) {
      console.log('ℹ️  Could not save leasing prediction (table may not exist):', error.message);
    }
  }
}

export default new LeasingTrafficService();
