/**
 * M27: Comp Set Service
 * Auto-generates comparable sale sets for deals
 */

import { getPool } from '../../database/connection';

const pool = getPool();

export interface CompSetCriteria {
  deal_id: string;
  radius_miles?: number;
  date_range_months?: number;
  min_units?: number;
  max_units?: number;
  property_classes?: string[];
  vintage_range?: [number, number];
  exclude_distress?: boolean;
  arms_length_only?: boolean;
}

export interface CompSetResult {
  id: string;
  deal_id: string;
  comp_count: number;
  median_price_per_unit: number;
  avg_price_per_unit: number;
  min_price_per_unit: number;
  max_price_per_unit: number;
  std_dev_price_per_unit: number;
  median_price_per_sf: number;
  median_implied_cap_rate: number | null;
  avg_implied_cap_rate: number | null;
  comps: CompTransaction[];
}

export interface CompTransaction {
  id: string;
  recording_date: Date;
  property_address: string;
  units: number;
  building_sf: number;
  year_built: number;
  property_class: string;
  derived_sale_price: number;
  price_per_unit: number;
  price_per_sf: number;
  implied_cap_rate: number | null;
  grantee_name: string;
  buyer_type: string;
  holding_period_months: number | null;
  distance_miles: number;
}

export class CompSetService {
  /**
   * Auto-generate comp set for a deal
   */
  async generateCompSet(criteria: CompSetCriteria): Promise<CompSetResult> {
    const {
      deal_id,
      radius_miles = 3.0,
      date_range_months = 24,
      min_units = 50,
      max_units = 500,
      property_classes = ['A', 'B', 'C'],
      vintage_range,
      exclude_distress = true,
      arms_length_only = true
    } = criteria;

    // 1. Get subject property location
    const dealResult = await pool.query(`
      SELECT d.id, d.address, p.latitude, p.longitude, p.units, p.building_sf, p.year_built
      FROM deals d
      LEFT JOIN properties p ON p.deal_id = d.id
      WHERE d.id = $1::uuid
      LIMIT 1
    `, [deal_id]);

    if (dealResult.rows.length === 0) {
      throw new Error('Deal not found');
    }

    const deal = dealResult.rows[0];

    if (!deal.latitude || !deal.longitude) {
      throw new Error('Deal property must have coordinates for comp selection');
    }

    // 2. Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - date_range_months);

    // 3. Build query filters
    const filters = [
      `t.property_type = 'multifamily'`,
      `t.recording_date >= $3`,
      `t.units >= $4`,
      `t.units <= $5`,
      `t.derived_sale_price > 0`
    ];

    if (arms_length_only) {
      filters.push(`t.is_arms_length = true`);
    }

    if (exclude_distress) {
      filters.push(`t.is_distress = false`);
    }

    if (property_classes.length > 0) {
      filters.push(`t.property_class = ANY($6)`);
    }

    if (vintage_range) {
      filters.push(`t.year_built >= $7 AND t.year_built <= $8`);
    }

    // 4. Spatial query for comps within radius
    const compsResult = await pool.query(`
      SELECT 
        t.*,
        ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(t.longitude, t.latitude), 4326)::geography
        ) / 1609.34 as distance_miles
      FROM recorded_transactions t
      WHERE ${filters.join(' AND ')}
        AND t.latitude IS NOT NULL
        AND t.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(t.longitude, t.latitude), 4326)::geography,
          ${radius_miles * 1609.34}
        )
      ORDER BY 
        ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(t.longitude, t.latitude), 4326)::geography
        ),
        t.recording_date DESC
      LIMIT 30
    `, [
      deal.longitude,
      deal.latitude,
      cutoffDate,
      min_units,
      max_units,
      property_classes,
      ...(vintage_range || [])
    ]);

    const comps: CompTransaction[] = compsResult.rows.map(row => ({
      id: row.id,
      recording_date: row.recording_date,
      property_address: row.property_address,
      units: row.units,
      building_sf: row.building_sf,
      year_built: row.year_built,
      property_class: row.property_class,
      derived_sale_price: parseFloat(row.derived_sale_price),
      price_per_unit: parseFloat(row.price_per_unit),
      price_per_sf: parseFloat(row.price_per_sf),
      implied_cap_rate: row.implied_cap_rate ? parseFloat(row.implied_cap_rate) : null,
      grantee_name: row.grantee_name,
      buyer_type: row.buyer_type,
      holding_period_months: row.holding_period_months,
      distance_miles: parseFloat(row.distance_miles)
    }));

    // 5. Calculate aggregated metrics
    const pricesPerUnit = comps.map(c => c.price_per_unit).sort((a, b) => a - b);
    const pricesPerSf = comps.map(c => c.price_per_sf).filter(p => p > 0).sort((a, b) => a - b);
    const capRates = comps.map(c => c.implied_cap_rate).filter(c => c !== null) as number[];

    const median = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
    };

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const stdDev = (arr: number[], mean: number) => {
      if (arr.length === 0) return 0;
      const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
      return Math.sqrt(variance);
    };

    const medianPricePerUnit = median(pricesPerUnit);
    const avgPricePerUnit = avg(pricesPerUnit);
    const minPricePerUnit = pricesPerUnit[0] || 0;
    const maxPricePerUnit = pricesPerUnit[pricesPerUnit.length - 1] || 0;
    const stdDevPricePerUnit = stdDev(pricesPerUnit, avgPricePerUnit);
    const medianPricePerSf = median(pricesPerSf);
    const medianCapRate = capRates.length > 0 ? median(capRates) : null;
    const avgCapRate = capRates.length > 0 ? avg(capRates) : null;

    // 6. Calculate subject positioning (if subject has price)
    const subjectPricePerUnit = deal.units && deal.derived_sale_price
      ? deal.derived_sale_price / deal.units
      : null;

    const subjectVsMedianPct = subjectPricePerUnit && medianPricePerUnit > 0
      ? (subjectPricePerUnit - medianPricePerUnit) / medianPricePerUnit
      : null;

    const subjectPercentile = subjectPricePerUnit
      ? Math.round((pricesPerUnit.filter(p => p <= subjectPricePerUnit).length / pricesPerUnit.length) * 100)
      : null;

    // 7. Store comp set
    const compSetResult = await pool.query(`
      INSERT INTO sale_comp_sets (
        deal_id, name, comp_type, selection_criteria,
        comp_count, median_price_per_unit, avg_price_per_unit,
        min_price_per_unit, max_price_per_unit, std_dev_price_per_unit,
        median_price_per_sf, median_implied_cap_rate, avg_implied_cap_rate,
        subject_price_per_unit, subject_vs_median_pct, subject_percentile
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING id
    `, [
      deal_id,
      'Auto-Generated Comp Set',
      'sale',
      JSON.stringify(criteria),
      comps.length,
      medianPricePerUnit,
      avgPricePerUnit,
      minPricePerUnit,
      maxPricePerUnit,
      stdDevPricePerUnit,
      medianPricePerSf,
      medianCapRate,
      avgCapRate,
      subjectPricePerUnit,
      subjectVsMedianPct,
      subjectPercentile
    ]);

    const compSetId = compSetResult.rows[0].id;

    // 8. Insert comp set members
    for (let i = 0; i < comps.length; i++) {
      await pool.query(`
        INSERT INTO sale_comp_set_members (
          comp_set_id, transaction_id, sort_order
        ) VALUES ($1::uuid, $2::uuid, $3)
      `, [compSetId, comps[i].id, i + 1]);
    }

    return {
      id: compSetId,
      deal_id,
      comp_count: comps.length,
      median_price_per_unit: medianPricePerUnit,
      avg_price_per_unit: avgPricePerUnit,
      min_price_per_unit: minPricePerUnit,
      max_price_per_unit: maxPricePerUnit,
      std_dev_price_per_unit: stdDevPricePerUnit,
      median_price_per_sf: medianPricePerSf,
      median_implied_cap_rate: medianCapRate,
      avg_implied_cap_rate: avgCapRate,
      comps
    };
  }

  /**
   * Get existing comp set for a deal
   */
  async getCompSetByDeal(deal_id: string): Promise<CompSetResult | null> {
    const compSetResult = await pool.query(`
      SELECT * FROM sale_comp_sets
      WHERE deal_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `, [deal_id]);

    if (compSetResult.rows.length === 0) {
      return null;
    }

    const compSet = compSetResult.rows[0];

    // Get comp members
    const compsResult = await pool.query(`
      SELECT t.*, scm.sort_order,
        0 as distance_miles
      FROM sale_comp_set_members scm
      JOIN recorded_transactions t ON t.id = scm.transaction_id
      WHERE scm.comp_set_id = $1::uuid
      ORDER BY scm.sort_order
    `, [compSet.id]);

    const comps: CompTransaction[] = compsResult.rows.map(row => ({
      id: row.id,
      recording_date: row.recording_date,
      property_address: row.property_address,
      units: row.units,
      building_sf: row.building_sf,
      year_built: row.year_built,
      property_class: row.property_class,
      derived_sale_price: parseFloat(row.derived_sale_price),
      price_per_unit: parseFloat(row.price_per_unit),
      price_per_sf: parseFloat(row.price_per_sf),
      implied_cap_rate: row.implied_cap_rate ? parseFloat(row.implied_cap_rate) : null,
      grantee_name: row.grantee_name,
      buyer_type: row.buyer_type,
      holding_period_months: row.holding_period_months,
      distance_miles: parseFloat(row.distance_miles)
    }));

    return {
      id: compSet.id,
      deal_id: compSet.deal_id,
      comp_count: compSet.comp_count,
      median_price_per_unit: parseFloat(compSet.median_price_per_unit),
      avg_price_per_unit: parseFloat(compSet.avg_price_per_unit),
      min_price_per_unit: parseFloat(compSet.min_price_per_unit),
      max_price_per_unit: parseFloat(compSet.max_price_per_unit),
      std_dev_price_per_unit: parseFloat(compSet.std_dev_price_per_unit),
      median_price_per_sf: parseFloat(compSet.median_price_per_sf),
      median_implied_cap_rate: compSet.median_implied_cap_rate ? parseFloat(compSet.median_implied_cap_rate) : null,
      avg_implied_cap_rate: compSet.avg_implied_cap_rate ? parseFloat(compSet.avg_implied_cap_rate) : null,
      comps
    };
  }
}

export const compSetService = new CompSetService();
