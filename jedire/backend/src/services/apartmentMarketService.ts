/**
 * Apartment Market Service
 * Integrates JEDI RE with Apartment Locator AI via API
 * Fetches market data and calculates metrics for deals
 */

import axios from 'axios';
import { pool } from '../database';

// Apartment Locator AI API base URL
const APARTMENT_API_BASE = process.env.APARTMENT_LOCATOR_API_URL || 'http://localhost:3000/api';

interface ApartmentProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  min_price: number;
  max_price: number;
  bedrooms_min: number;
  bedrooms_max: number;
  square_feet_min: number;
  square_feet_max: number;
  amenities: string[];
  occupancy_rate?: number;
  year_built?: number;
}

interface TradeAreaMetrics {
  properties_count: number;
  avg_rent_studio?: number;
  avg_rent_1br?: number;
  avg_rent_2br?: number;
  avg_rent_3br?: number;
  avg_occupancy_rate?: number;
  total_units: number;
  available_units: number;
  market_saturation?: number;
}

export class ApartmentMarketService {
  
  /**
   * Fetch properties near a deal location
   */
  async fetchPropertiesNearDeal(
    dealId: string, 
    latitude: number, 
    longitude: number, 
    radiusMiles: number = 3
  ): Promise<ApartmentProperty[]> {
    try {
      const response = await axios.get(`${APARTMENT_API_BASE}/properties/search`, {
        params: {
          latitude,
          longitude,
          radius: radiusMiles,
          limit: 50
        }
      });
      
      // Log sync
      await this.logSync(dealId, 'comps', 'success', response.data.length, `/properties/search`);
      
      return response.data;
    } catch (error: any) {
      await this.logSync(dealId, 'comps', 'failed', 0, `/properties/search`, error.message);
      throw error;
    }
  }

  /**
   * Link comparable properties to a deal
   */
  async linkComparablesToDeal(dealId: string, latitude: number, longitude: number): Promise<void> {
    const properties = await this.fetchPropertiesNearDeal(dealId, latitude, longitude);
    
    for (const prop of properties) {
      const distance = this.calculateDistance(latitude, longitude, prop.latitude, prop.longitude);
      const relevance = this.calculateRelevanceScore(prop, distance);
      
      await pool.query(`
        INSERT INTO deal_comparable_properties (
          deal_id, apartment_property_id, apartment_property_name, 
          apartment_property_address, distance_miles, relevance_score,
          price_per_sqft, occupancy_rate, within_trade_area
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (deal_id, apartment_property_id) 
        DO UPDATE SET 
          distance_miles = EXCLUDED.distance_miles,
          relevance_score = EXCLUDED.relevance_score,
          last_synced = NOW()
      `, [
        dealId,
        prop.id,
        prop.name,
        prop.address,
        distance,
        relevance,
        this.calculatePricePerSqft(prop),
        prop.occupancy_rate || null,
        distance <= 3  // Within 3 miles = trade area
      ]);
    }
  }

  /**
   * Calculate market metrics for a trade area
   */
  async calculateTradeAreaMetrics(dealId: string, tradeAreaId: number): Promise<TradeAreaMetrics> {
    // Get trade area geometry
    const tradeAreaResult = await pool.query(
      'SELECT geometry FROM trade_areas WHERE id = $1',
      [tradeAreaId]
    );
    
    if (tradeAreaResult.rows.length === 0) {
      throw new Error(`Trade area ${tradeAreaId} not found`);
    }
    
    // Get center point of trade area
    const centerResult = await pool.query(`
      SELECT 
        ST_Y(ST_Centroid(geometry::geometry)) as latitude,
        ST_X(ST_Centroid(geometry::geometry)) as longitude
      FROM trade_areas WHERE id = $1
    `, [tradeAreaId]);
    
    const { latitude, longitude } = centerResult.rows[0];
    
    // Fetch properties in trade area (5 mile radius for broader context)
    const properties = await this.fetchPropertiesNearDeal(dealId, latitude, longitude, 5);
    
    // Calculate metrics
    const metrics = this.aggregateMetrics(properties);
    
    // Calculate market trends (if historical data available)
    const trends = await this.calculateRentTrends(tradeAreaId);
    
    // Save to database
    await pool.query(`
      INSERT INTO trade_area_market_metrics (
        deal_id, trade_area_id, properties_count,
        avg_rent_studio, avg_rent_1br, avg_rent_2br, avg_rent_3br,
        avg_occupancy_rate, total_units, available_units,
        rent_growth_12mo, market_saturation, competition_intensity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (deal_id, trade_area_id)
      DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        avg_rent_studio = EXCLUDED.avg_rent_studio,
        avg_rent_1br = EXCLUDED.avg_rent_1br,
        avg_rent_2br = EXCLUDED.avg_rent_2br,
        avg_rent_3br = EXCLUDED.avg_rent_3br,
        avg_occupancy_rate = EXCLUDED.avg_occupancy_rate,
        total_units = EXCLUDED.total_units,
        available_units = EXCLUDED.available_units,
        rent_growth_12mo = EXCLUDED.rent_growth_12mo,
        market_saturation = EXCLUDED.market_saturation,
        competition_intensity = EXCLUDED.competition_intensity,
        calculated_at = NOW()
    `, [
      dealId,
      tradeAreaId,
      metrics.properties_count,
      metrics.avg_rent_studio,
      metrics.avg_rent_1br,
      metrics.avg_rent_2br,
      metrics.avg_rent_3br,
      metrics.avg_occupancy_rate,
      metrics.total_units,
      metrics.available_units,
      trends.growth_12mo,
      metrics.market_saturation,
      this.determineCompetitionIntensity(metrics.properties_count)
    ]);
    
    // Save historical snapshot
    await this.saveHistoricalSnapshot(tradeAreaId, metrics);
    
    return metrics;
  }

  /**
   * Get market data for JEDI analysis
   */
  async getMarketDataForAnalysis(dealId: string): Promise<any> {
    const result = await pool.query(`
      SELECT 
        tm.properties_count as existing_units,
        tm.avg_rent_1br,
        tm.avg_rent_2br,
        tm.avg_occupancy_rate,
        tm.rent_growth_12mo,
        tm.market_saturation
      FROM trade_area_market_metrics tm
      WHERE tm.deal_id = $1
      ORDER BY tm.calculated_at DESC
      LIMIT 1
    `, [dealId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const data = result.rows[0];
    
    // Format for JEDI analysis
    return {
      existing_units: data.existing_units,
      avg_rent: (data.avg_rent_1br + data.avg_rent_2br) / 2,
      occupancy: data.avg_occupancy_rate,
      rent_growth_rate: data.rent_growth_12mo,
      market_saturation: data.market_saturation
    };
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private aggregateMetrics(properties: ApartmentProperty[]): TradeAreaMetrics {
    const byBedrooms: { [key: number]: number[] } = {
      0: [], // Studio
      1: [],
      2: [],
      3: []
    };
    
    let totalUnits = 0;
    let totalOccupied = 0;
    
    for (const prop of properties) {
      // Group prices by bedroom count
      const avgPrice = (prop.min_price + prop.max_price) / 2;
      const bedrooms = prop.bedrooms_min || 0;
      
      if (byBedrooms[bedrooms]) {
        byBedrooms[bedrooms].push(avgPrice);
      }
      
      // Estimate units (rough estimate)
      totalUnits += 50; // Assume avg 50 units per property
      
      if (prop.occupancy_rate) {
        totalOccupied += 50 * (prop.occupancy_rate / 100);
      }
    }
    
    const avgOccupancy = totalUnits > 0 ? (totalOccupied / totalUnits) * 100 : null;
    const availableUnits = totalUnits - totalOccupied;
    
    return {
      properties_count: properties.length,
      avg_rent_studio: this.average(byBedrooms[0]),
      avg_rent_1br: this.average(byBedrooms[1]),
      avg_rent_2br: this.average(byBedrooms[2]),
      avg_rent_3br: this.average(byBedrooms[3]),
      avg_occupancy_rate: avgOccupancy,
      total_units: totalUnits,
      available_units: Math.max(0, availableUnits)
    };
  }

  private async calculateRentTrends(tradeAreaId: number): Promise<{ growth_12mo: number }> {
    const result = await pool.query(`
      SELECT avg_rent, snapshot_date
      FROM market_metric_history
      WHERE trade_area_id = $1
      AND snapshot_date >= NOW() - INTERVAL '12 months'
      ORDER BY snapshot_date ASC
    `, [tradeAreaId]);
    
    if (result.rows.length < 2) {
      return { growth_12mo: 0 };
    }
    
    const oldest = result.rows[0];
    const newest = result.rows[result.rows.length - 1];
    
    const growth = ((newest.avg_rent - oldest.avg_rent) / oldest.avg_rent) * 100;
    
    return { growth_12mo: growth };
  }

  private async saveHistoricalSnapshot(tradeAreaId: number, metrics: TradeAreaMetrics): Promise<void> {
    const avgRent = (
      (metrics.avg_rent_1br || 0) + 
      (metrics.avg_rent_2br || 0)
    ) / 2;
    
    await pool.query(`
      INSERT INTO market_metric_history (
        trade_area_id, snapshot_date, avg_rent, 
        avg_occupancy, properties_count, available_units
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
      ON CONFLICT (trade_area_id, snapshot_date) 
      DO UPDATE SET
        avg_rent = EXCLUDED.avg_rent,
        avg_occupancy = EXCLUDED.avg_occupancy,
        properties_count = EXCLUDED.properties_count,
        available_units = EXCLUDED.available_units
    `, [
      tradeAreaId,
      avgRent,
      metrics.avg_occupancy_rate,
      metrics.properties_count,
      metrics.available_units
    ]);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula
    const R = 3959; // Earth radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateRelevanceScore(prop: ApartmentProperty, distance: number): number {
    let score = 100;
    
    // Distance penalty (0-3 miles)
    score -= (distance / 3) * 30; // Max 30 point deduction
    
    // Recency bonus (newer = better comp)
    if (prop.year_built && prop.year_built >= 2020) {
      score += 10;
    }
    
    // Occupancy bonus
    if (prop.occupancy_rate && prop.occupancy_rate >= 90) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculatePricePerSqft(prop: ApartmentProperty): number | null {
    if (!prop.min_price || !prop.square_feet_min) return null;
    return prop.min_price / prop.square_feet_min;
  }

  private determineCompetitionIntensity(propertyCount: number): string {
    if (propertyCount < 5) return 'LOW';
    if (propertyCount < 15) return 'MEDIUM';
    return 'HIGH';
  }

  private average(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async logSync(
    dealId: string | null, 
    syncType: string, 
    status: string, 
    recordsSynced: number,
    endpoint: string,
    errorMessage?: string
  ): Promise<void> {
    await pool.query(`
      INSERT INTO apartment_api_sync_log (
        deal_id, sync_type, status, records_synced, 
        api_endpoint, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [dealId, syncType, status, recordsSynced, endpoint, errorMessage || null]);
  }
}

export default new ApartmentMarketService();
