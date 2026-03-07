/**
 * Supply Agent
 * Analyzes market inventory and supply trends using property_records and apartment_market_snapshots
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

export class SupplyAgent {
  async execute(inputData: any, userId: string): Promise<any> {
    logger.info('Supply agent executing...', { inputData });

    try {
      const { city, stateCode, propertyType, marketArea } = inputData;
      const searchCity = city || marketArea || 'Atlanta';
      const searchState = stateCode || 'GA';

      const propertyStats = await query(
        `SELECT 
          count(*) as total_properties,
          coalesce(sum(units), 0) as total_units,
          round(avg(units)::numeric) as avg_units,
          count(CASE WHEN units > 0 THEN 1 END) as properties_with_units,
          round(avg(CASE WHEN building_sqft > 0 THEN building_sqft END)::numeric) as avg_building_sqft,
          round(avg(CASE WHEN year_built ~ '^[0-9]+$' AND year_built::int > 0 THEN year_built::int END)::numeric) as avg_year_built,
          min(year_built::int) FILTER (WHERE year_built ~ '^[0-9]+$' AND year_built::int > 1900) as oldest_built,
          max(year_built::int) FILTER (WHERE year_built ~ '^[0-9]+$' AND year_built::int > 1900) as newest_built,
          round(avg(CASE WHEN assessed_value > 0 THEN assessed_value END)::numeric) as avg_assessed_value
        FROM property_records
        WHERE city ILIKE $1 AND state ILIKE $2`,
        [searchCity, searchState]
      );

      const marketSnapshot = await query(
        `SELECT 
          total_properties, total_units, avg_occupancy,
          class_a_count, class_b_count, class_c_count,
          avg_rent_studio, avg_rent_1br, avg_rent_2br, avg_rent_3br,
          rent_growth_90d, rent_growth_180d,
          concession_rate, avg_concession_value,
          avg_days_to_lease, monthly_absorption_rate,
          supply_pressure, market_grade, snapshot_date,
          avg_rent, total_listings, available_units
        FROM apartment_market_snapshots
        WHERE city ILIKE $1 AND state ILIKE $2
        ORDER BY snapshot_date DESC
        LIMIT 1`,
        [searchCity, searchState]
      );

      const unitDistribution = await query(
        `SELECT 
          CASE 
            WHEN units <= 50 THEN 'Small (1-50)'
            WHEN units <= 150 THEN 'Mid-size (51-150)'
            WHEN units <= 300 THEN 'Large (151-300)'
            ELSE 'Institutional (300+)'
          END as size_category,
          count(*) as property_count,
          sum(units) as total_units
        FROM property_records
        WHERE city ILIKE $1 AND state ILIKE $2 AND units > 0
        GROUP BY 1
        ORDER BY min(units)`,
        [searchCity, searchState]
      );

      const stats = propertyStats.rows[0] || {};
      const snapshot = marketSnapshot.rows[0] || {};
      const distribution = unitDistribution.rows;

      const sf = (v: any) => this.safeFloat(v);
      const si = (v: any) => { const n = sf(v); return n !== null ? Math.round(n) : null; };

      const occ = sf(snapshot.avg_occupancy);
      const vacancyRate = occ !== null ? (100 - occ) : null;
      const avgRent = sf(snapshot.avg_rent) ?? sf(snapshot.avg_rent_2br);

      return {
        status: 'success',
        market: `${searchCity}, ${searchState}`,
        propertyType: propertyType || 'multifamily',

        totalProperties: si(stats.total_properties) || 0,
        totalUnits: si(stats.total_units) || 0,
        avgUnitsPerProperty: si(stats.avg_units) || 0,
        avgBuildingSqft: si(stats.avg_building_sqft) || 0,
        avgYearBuilt: si(stats.avg_year_built) || 0,
        oldestBuilt: si(stats.oldest_built),
        newestBuilt: si(stats.newest_built),
        avgAssessedValue: si(stats.avg_assessed_value) || 0,

        vacantUnits: si(snapshot.available_units),
        vacancyRate,
        avgRent,
        avgRentStudio: sf(snapshot.avg_rent_studio),
        avgRent1br: sf(snapshot.avg_rent_1br),
        avgRent2br: sf(snapshot.avg_rent_2br),
        avgRent3br: sf(snapshot.avg_rent_3br),
        rentGrowth90d: sf(snapshot.rent_growth_90d),
        rentGrowth180d: sf(snapshot.rent_growth_180d),
        monthlyAbsorption: sf(snapshot.monthly_absorption_rate),
        avgDaysToLease: si(snapshot.avg_days_to_lease),
        concessionRate: sf(snapshot.concession_rate),
        supplyPressure: snapshot.supply_pressure,
        marketGrade: snapshot.market_grade,
        classBreakdown: {
          classA: si(snapshot.class_a_count),
          classB: si(snapshot.class_b_count),
          classC: si(snapshot.class_c_count),
        },

        unitDistribution: distribution.map((d: any) => ({
          category: d.size_category,
          count: parseInt(d.property_count),
          units: parseInt(d.total_units),
        })),

        opportunityScore: this.calculateOpportunityScore(stats, snapshot),
      };
    } catch (error: any) {
      logger.error('Supply agent execution failed:', error);
      throw error;
    }
  }

  private safeFloat(val: any): number | null {
    if (val === null || val === undefined) return null;
    const n = parseFloat(String(val));
    return isNaN(n) ? null : n;
  }

  private calculateOpportunityScore(stats: any, snapshot: any): number {
    let score = 50;

    const occ = this.safeFloat(snapshot.avg_occupancy);
    if (occ !== null) {
      const vacancy = 100 - occ;
      if (vacancy < 5) score += 15;
      else if (vacancy < 8) score += 10;
      else if (vacancy > 12) score -= 10;
    }

    const absorption = this.safeFloat(snapshot.monthly_absorption_rate);
    if (absorption !== null) {
      if (absorption > 20) score += 15;
      else if (absorption > 10) score += 10;
    }

    const dom = this.safeFloat(snapshot.avg_days_to_lease);
    if (dom !== null) {
      if (dom < 30) score += 10;
      else if (dom > 60) score -= 10;
    }

    const rentGrowth = this.safeFloat(snapshot.rent_growth_90d);
    if (rentGrowth !== null) {
      if (rentGrowth > 5) score += 10;
      else if (rentGrowth > 2) score += 5;
      else if (rentGrowth < 0) score -= 10;
    }

    return Math.min(100, Math.max(0, score));
  }
}
