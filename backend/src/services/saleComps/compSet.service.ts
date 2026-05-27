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
  created_at: string;
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
  source?: string;
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

    // 3. Build query filters against market_sale_comps
    //    market_sale_comps uses: sale_date, asset_class, sale_price, price_per_unit,
    //    price_per_sqft, cap_rate, buyer, buyer_type, qualified, latitude, longitude
    const filters = [
      `t.property_type = 'multifamily'`,
      `t.sale_date >= $3`,
      `t.units >= $4`,
      `t.units <= $5`,
      `t.sale_price > 0`
    ];

    if (arms_length_only) {
      filters.push(`(t.qualified IS NULL OR t.qualified = true)`);
    }

    // exclude_distress: no distress flag in market_sale_comps — low price per unit is a proxy
    if (exclude_distress) {
      filters.push(`(t.price_per_unit IS NULL OR t.price_per_unit > 20000)`);
    }

    if (property_classes.length > 0) {
      filters.push(`(t.asset_class = ANY($6) OR t.asset_class IS NULL)`);
    }

    if (vintage_range) {
      filters.push(`t.year_built >= $7 AND t.year_built <= $8`);
    }

    // 4. Spatial query for comps within radius using market_sale_comps
    const compsResult = await pool.query(`
      SELECT
        t.id,
        t.sale_date                       AS recording_date,
        t.address                         AS property_address,
        t.units,
        t.sqft                            AS building_sf,
        t.year_built,
        COALESCE(t.asset_class, 'B')      AS property_class,
        t.sale_price                      AS derived_sale_price,
        COALESCE(t.price_per_unit, 0)     AS price_per_unit,
        COALESCE(t.price_per_sqft, 0)     AS price_per_sf,
        t.cap_rate                        AS implied_cap_rate,
        t.buyer                           AS grantee_name,
        t.buyer_type,
        NULL::integer                     AS holding_period_months,
        t.source,
        ROUND((
          point(t.longitude::float, t.latitude::float)
          <@> point($2::float, $1::float)
        )::numeric, 3)                    AS distance_miles
      FROM market_sale_comps t
      WHERE ${filters.join(' AND ')}
        AND t.latitude  IS NOT NULL
        AND t.longitude IS NOT NULL
        AND (
          point(t.longitude::float, t.latitude::float)
          <@> point($2::float, $1::float)
        ) <= ${ radius_miles }
      ORDER BY
        (point(t.longitude::float, t.latitude::float) <@> point($2::float, $1::float)) ASC,
        t.sale_date DESC
      LIMIT 30
    `, [
      deal.latitude,
      deal.longitude,
      cutoffDate,
      min_units,
      max_units,
      property_classes,
      ...(vintage_range || [])
    ]);

    const comps: CompTransaction[] = compsResult.rows.map((row: any) => ({
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
      grantee_name: row.grantee_name ?? '',
      buyer_type: row.buyer_type ?? '',
      holding_period_months: null,
      distance_miles: parseFloat(row.distance_miles),
      source: row.source,
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

    // 7. Store comp set (using actual sale_comp_sets schema + migrated columns)
    const compSetResult = await pool.query(`
      INSERT INTO sale_comp_sets (
        deal_id, name, status, comp_type, selection_criteria,
        comp_count, median_price_per_unit, avg_price_per_unit,
        min_price_per_unit, max_price_per_unit, std_dev_price_per_unit,
        median_price_per_sf, median_implied_cap_rate, avg_implied_cap_rate,
        subject_price_per_unit, subject_vs_median_pct, subject_percentile,
        median_cap_rate, metadata
      ) VALUES (
        $1::uuid, $2, 'active', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      RETURNING id, created_at
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
      subjectPercentile,
      medianCapRate,
      JSON.stringify({ sources: [...new Set(comps.map(c => c.source))] })
    ]);

    const compSetId = compSetResult.rows[0].id;
    const compSetCreatedAt: string = compSetResult.rows[0].created_at instanceof Date
      ? compSetResult.rows[0].created_at.toISOString()
      : String(compSetResult.rows[0].created_at);

    // 8. Insert comp set members — Georgia comps use market_comp_id (not transaction_id FK)
    for (let i = 0; i < comps.length; i++) {
      const comp = comps[i];
      const isMarketComp = comp.source === 'georgia_county' || comp.source?.startsWith('georgia');
      await pool.query(`
        INSERT INTO sale_comp_set_members (
          comp_set_id, ${isMarketComp ? 'market_comp_id' : 'transaction_id'}, sort_order
        ) VALUES ($1::uuid, $2::uuid, $3)
        ON CONFLICT DO NOTHING
      `, [compSetId, comp.id, i + 1]);
    }

    return {
      id: compSetId,
      deal_id,
      created_at: compSetCreatedAt,
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

    // Get comp members — supports both market_sale_comps (Georgia) and recorded_transactions
    const compsResult = await pool.query(`
      SELECT
        COALESCE(mc.id, rt.id)                           AS id,
        COALESCE(mc.sale_date, rt.recording_date)        AS recording_date,
        COALESCE(mc.address, rt.property_address)        AS property_address,
        COALESCE(mc.units, rt.units)                     AS units,
        COALESCE(mc.sqft, rt.building_sf)                AS building_sf,
        COALESCE(mc.year_built, rt.year_built)           AS year_built,
        COALESCE(mc.asset_class, rt.property_class, 'B') AS property_class,
        COALESCE(mc.sale_price, rt.derived_sale_price)   AS derived_sale_price,
        COALESCE(mc.price_per_unit, rt.price_per_unit, 0) AS price_per_unit,
        COALESCE(mc.price_per_sqft, rt.price_per_sf, 0)  AS price_per_sf,
        COALESCE(mc.cap_rate, rt.implied_cap_rate)       AS implied_cap_rate,
        COALESCE(mc.buyer, rt.buyer_name)                AS grantee_name,
        COALESCE(mc.buyer_type, rt.buyer_type)           AS buyer_type,
        mc.source,
        scm.sort_order,
        0                                                AS distance_miles
      FROM sale_comp_set_members scm
      LEFT JOIN market_sale_comps    mc ON mc.id = scm.market_comp_id
      LEFT JOIN recorded_transactions rt ON rt.id = scm.transaction_id
      WHERE scm.comp_set_id = $1::uuid
        AND (mc.id IS NOT NULL OR rt.id IS NOT NULL)
      ORDER BY scm.sort_order
    `, [compSet.id]);

    const comps: CompTransaction[] = compsResult.rows.map((row: any) => ({
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
      grantee_name: row.grantee_name ?? '',
      buyer_type: row.buyer_type ?? '',
      holding_period_months: null,
      distance_miles: parseFloat(row.distance_miles),
      source: row.source,
    }));

    return {
      id: compSet.id,
      deal_id: compSet.deal_id,
      created_at: compSet.created_at instanceof Date
        ? compSet.created_at.toISOString()
        : String(compSet.created_at),
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
  async deleteCompFromSet(dealId: string, compId: string): Promise<{ deleted: boolean; updatedSet: CompSetResult | null }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const compSetResult = await client.query(`
        SELECT id FROM sale_comp_sets
        WHERE deal_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `, [dealId]);

      if (compSetResult.rows.length === 0) {
        throw new Error('Comp set not found');
      }

      const compSetId = compSetResult.rows[0].id;

      const deleteResult = await client.query(`
        DELETE FROM sale_comp_set_members
        WHERE comp_set_id = $1::uuid
          AND (transaction_id = $2::uuid OR market_comp_id = $2::uuid)
      `, [compSetId, compId]);

      if (deleteResult.rowCount === 0) {
        throw new Error('Comp not found');
      }

      const remainingComps = await client.query(`
        SELECT
          COALESCE(mc.id, rt.id)                            AS id,
          COALESCE(mc.sale_date, rt.recording_date)         AS recording_date,
          COALESCE(mc.address, rt.property_address)         AS property_address,
          COALESCE(mc.units, rt.units)                      AS units,
          COALESCE(mc.sqft, rt.building_sf)                 AS building_sf,
          COALESCE(mc.year_built, rt.year_built)            AS year_built,
          COALESCE(mc.asset_class, rt.property_class, 'B')  AS property_class,
          COALESCE(mc.sale_price, rt.derived_sale_price)    AS derived_sale_price,
          COALESCE(mc.price_per_unit, rt.price_per_unit, 0) AS price_per_unit,
          COALESCE(mc.price_per_sqft, rt.price_per_sf, 0)   AS price_per_sf,
          COALESCE(mc.cap_rate, rt.implied_cap_rate)        AS implied_cap_rate,
          COALESCE(mc.buyer, rt.buyer_name)                 AS grantee_name,
          COALESCE(mc.buyer_type, rt.buyer_type)            AS buyer_type,
          scm.sort_order,
          0                                                 AS distance_miles
        FROM sale_comp_set_members scm
        LEFT JOIN market_sale_comps    mc ON mc.id = scm.market_comp_id
        LEFT JOIN recorded_transactions rt ON rt.id = scm.transaction_id
        WHERE scm.comp_set_id = $1::uuid
          AND (mc.id IS NOT NULL OR rt.id IS NOT NULL)
        ORDER BY scm.sort_order
      `, [compSetId]);

      const comps: CompTransaction[] = remainingComps.rows.map((row: any) => ({
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
        grantee_name: row.grantee_name ?? '',
        buyer_type: row.buyer_type ?? '',
        holding_period_months: null,
        distance_miles: parseFloat(row.distance_miles),
      }));

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
        return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length);
      };

      const avgPpu = avg(pricesPerUnit);
      const medPpu = median(pricesPerUnit);

      const subjectRow = await client.query(`
        SELECT p.units, d.derived_sale_price
        FROM deals d LEFT JOIN properties p ON p.deal_id = d.id
        WHERE d.id = $1::uuid LIMIT 1
      `, [dealId]);
      const subj = subjectRow.rows[0];
      const subjectPpu = subj?.units && subj?.derived_sale_price ? subj.derived_sale_price / subj.units : null;
      const subjectVsMedianPct = subjectPpu && medPpu > 0 ? (subjectPpu - medPpu) / medPpu : null;
      const subjectPercentile = subjectPpu && pricesPerUnit.length > 0
        ? Math.round((pricesPerUnit.filter(p => p <= subjectPpu).length / pricesPerUnit.length) * 100)
        : null;

      await client.query(`
        UPDATE sale_comp_sets SET
          comp_count = $2,
          median_price_per_unit = $3,
          avg_price_per_unit = $4,
          min_price_per_unit = $5,
          max_price_per_unit = $6,
          std_dev_price_per_unit = $7,
          median_price_per_sf = $8,
          median_implied_cap_rate = $9,
          avg_implied_cap_rate = $10,
          subject_vs_median_pct = $11,
          subject_percentile = $12
        WHERE id = $1::uuid
      `, [
        compSetId,
        comps.length,
        medPpu,
        avgPpu,
        pricesPerUnit[0] || 0,
        pricesPerUnit[pricesPerUnit.length - 1] || 0,
        stdDev(pricesPerUnit, avgPpu),
        median(pricesPerSf),
        capRates.length > 0 ? median(capRates) : null,
        capRates.length > 0 ? avg(capRates) : null,
        subjectVsMedianPct,
        subjectPercentile,
      ]);

      await client.query('COMMIT');

      const updatedSet = await this.getCompSetByDeal(dealId);
      return { deleted: true, updatedSet };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const compSetService = new CompSetService();
