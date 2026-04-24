/**
 * Georgia Sale Comps ETL Service
 * Bridges georgia_property_sales + property_info_cache → market_sale_comps
 *
 * Pipeline:
 *   georgia_property_sales (raw county sales)
 *   + property_info_cache  (units, sqft, year_built, lat/lon)
 *   → market_sale_comps    (unified sale comp pool queried by CompSetService)
 */

import { query as dbQuery } from '../../database/connection';

export interface PromoteOptions {
  county?: string;
  state?: string;
  minSalePrice?: number;
  minUnits?: number;
}

export interface PromoteResult {
  promoted: number;
  county: string;
  state: string;
}

export interface SaleCompStats {
  county: string;
  state: string;
  total_comps: number;
  earliest_sale: string | null;
  latest_sale: string | null;
  median_price_per_unit: number | null;
  avg_price_per_unit: number | null;
  min_price_per_unit: number | null;
  max_price_per_unit: number | null;
}

export interface PriceTrend {
  county: string;
  state: string;
  sale_year: number;
  sale_count: number;
  median_price: number;
  avg_price: number;
  median_price_per_unit: number | null;
  avg_price_per_unit: number | null;
  yoy_change_pct: number | null;
}

class GeorgiaSaleCompsService {

  /**
   * ETL: Promote qualified Georgia multifamily sales → market_sale_comps
   * Joins property_info_cache to enrich with units/sqft/lat/lon.
   * UPSERT-safe via unique index on (source, source_id).
   */
  async promoteGeorgiaSales(options: PromoteOptions = {}): Promise<PromoteResult[]> {
    const {
      county,
      state = 'GA',
      minSalePrice = 200_000,
      minUnits = 4,
    } = options;

    const counties = county
      ? [county]
      : (await dbQuery(
          `SELECT DISTINCT county FROM georgia_property_sales WHERE state = $1 ORDER BY county`,
          [state]
        )).rows.map((r: any) => r.county);

    const results: PromoteResult[] = [];

    for (const cty of counties) {
      const res = await dbQuery(`
        INSERT INTO market_sale_comps (
          address, city, state, county, msa,
          property_type, units, sqft, year_built, asset_class, stories,
          sale_date, sale_price, price_per_unit, price_per_sqft,
          buyer, seller,
          source, source_id, qualified,
          latitude, longitude
        )
        SELECT
          pic.address,
          COALESCE(pic.city, $4)                              AS city,
          gps.state,
          gps.county,
          'Atlanta-Sandy Springs-Roswell, GA'                AS msa,
          'multifamily'                                      AS property_type,
          pic.number_of_units::integer,
          pic.living_area_sqft::integer,
          pic.year_built::integer,
          CASE
            WHEN pic.year_built::integer >= 2010 THEN 'A'
            WHEN pic.year_built::integer >= 1995 THEN 'B'
            ELSE 'C'
          END                                                AS asset_class,
          pic.stories::integer,
          gps.sale_date,
          gps.sale_price,
          CASE WHEN pic.number_of_units > 0
            THEN ROUND(gps.sale_price / pic.number_of_units, 2) END AS price_per_unit,
          CASE WHEN pic.living_area_sqft > 0
            THEN ROUND(gps.sale_price / pic.living_area_sqft, 2) END AS price_per_sqft,
          gps.grantee_name                                   AS buyer,
          gps.grantor_name                                   AS seller,
          'georgia_county'                                   AS source,
          gps.id::text                                       AS source_id,
          gps.qualified,
          pic.latitude,
          pic.longitude
        FROM georgia_property_sales gps
        JOIN property_info_cache pic
          ON  pic.parcel_id = gps.parcel_id
          AND pic.county    = gps.county
          AND pic.state     = gps.state
        WHERE gps.county       = $1
          AND gps.state        = $2
          AND gps.sale_price  >= $3
          AND (pic.number_of_units IS NULL OR pic.number_of_units >= $5)
          AND (gps.qualified = true OR gps.qualified IS NULL)
          AND pic.latitude    IS NOT NULL
          AND pic.longitude   IS NOT NULL
        ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL
        DO UPDATE SET
          sale_price      = EXCLUDED.sale_price,
          price_per_unit  = EXCLUDED.price_per_unit,
          units           = EXCLUDED.units,
          year_built      = EXCLUDED.year_built,
          latitude        = EXCLUDED.latitude,
          longitude       = EXCLUDED.longitude
        RETURNING id
      `, [cty, state, minSalePrice, cty, minUnits]);

      results.push({ county: cty, state, promoted: res.rows.length });
    }

    return results;
  }

  /**
   * Coverage stats per county
   */
  async getSaleCompStats(state = 'GA'): Promise<SaleCompStats[]> {
    const res = await dbQuery(`
      SELECT
        county,
        state,
        COUNT(*)                                       AS total_comps,
        MIN(sale_date)::text                           AS earliest_sale,
        MAX(sale_date)::text                           AS latest_sale,
        PERCENTILE_CONT(0.5) WITHIN GROUP
          (ORDER BY price_per_unit) FILTER (WHERE price_per_unit > 0)
                                                       AS median_price_per_unit,
        AVG(price_per_unit) FILTER (WHERE price_per_unit > 0)
                                                       AS avg_price_per_unit,
        MIN(price_per_unit) FILTER (WHERE price_per_unit > 0)
                                                       AS min_price_per_unit,
        MAX(price_per_unit) FILTER (WHERE price_per_unit > 0)
                                                       AS max_price_per_unit
      FROM market_sale_comps
      WHERE source = 'georgia_county'
        AND state  = $1
      GROUP BY county, state
      ORDER BY county
    `, [state]);

    return res.rows.map((r: any) => ({
      county: r.county,
      state: r.state,
      total_comps: parseInt(r.total_comps),
      earliest_sale: r.earliest_sale,
      latest_sale: r.latest_sale,
      median_price_per_unit: r.median_price_per_unit ? parseFloat(r.median_price_per_unit) : null,
      avg_price_per_unit: r.avg_price_per_unit ? parseFloat(r.avg_price_per_unit) : null,
      min_price_per_unit: r.min_price_per_unit ? parseFloat(r.min_price_per_unit) : null,
      max_price_per_unit: r.max_price_per_unit ? parseFloat(r.max_price_per_unit) : null,
    }));
  }

  /**
   * Price trend time-series by county and year
   * Includes YoY % change for the trending signal.
   */
  async getPriceTrends(options: { county?: string; state?: string } = {}): Promise<PriceTrend[]> {
    const { county, state = 'GA' } = options;

    const countyFilter = county ? `AND county = $2` : '';
    const params: any[] = [state];
    if (county) params.push(county);

    const res = await dbQuery(`
      WITH annual AS (
        SELECT
          county,
          state,
          EXTRACT(YEAR FROM sale_date)::integer  AS sale_year,
          COUNT(*)                               AS sale_count,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price)
                                               AS median_price,
          AVG(sale_price)                       AS avg_price,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_unit)
            FILTER (WHERE price_per_unit > 0)  AS median_price_per_unit,
          AVG(price_per_unit) FILTER (WHERE price_per_unit > 0)
                                               AS avg_price_per_unit
        FROM market_sale_comps
        WHERE source = 'georgia_county'
          AND state  = $1
          ${countyFilter}
          AND sale_date IS NOT NULL
        GROUP BY county, state, sale_year
      )
      SELECT
        a.*,
        CASE WHEN prev.median_price > 0
          THEN ROUND(((a.median_price - prev.median_price) / prev.median_price * 100)::numeric, 1)
        END AS yoy_change_pct
      FROM annual a
      LEFT JOIN annual prev
        ON  prev.county    = a.county
        AND prev.state     = a.state
        AND prev.sale_year = a.sale_year - 1
      ORDER BY county, sale_year
    `, params);

    return res.rows.map((r: any) => ({
      county: r.county,
      state: r.state,
      sale_year: r.sale_year,
      sale_count: parseInt(r.sale_count),
      median_price: parseFloat(r.median_price),
      avg_price: parseFloat(r.avg_price),
      median_price_per_unit: r.median_price_per_unit ? parseFloat(r.median_price_per_unit) : null,
      avg_price_per_unit: r.avg_price_per_unit ? parseFloat(r.avg_price_per_unit) : null,
      yoy_change_pct: r.yoy_change_pct ? parseFloat(r.yoy_change_pct) : null,
    }));
  }

  /**
   * Proximity comp lookup for a lat/lon point — used for ad-hoc comp discovery.
   * Returns comps within `radiusMiles`, filtered by units/vintage.
   */
  async getNearbyComps(options: {
    latitude: number;
    longitude: number;
    radiusMiles?: number;
    minUnits?: number;
    maxUnits?: number;
    monthsBack?: number;
    assetClasses?: string[];
    limit?: number;
  }) {
    const {
      latitude,
      longitude,
      radiusMiles = 3,
      minUnits = 20,
      maxUnits = 1000,
      monthsBack = 36,
      assetClasses = ['A', 'B', 'C'],
      limit = 25,
    } = options;

    const res = await dbQuery(`
      SELECT
        id, address, city, state, county,
        units, sqft, year_built, asset_class, stories,
        sale_date, sale_price, price_per_unit, price_per_sqft,
        cap_rate, buyer, seller, buyer_type,
        latitude, longitude,
        ROUND((
          point(longitude, latitude) <@> point($2, $1)
        )::numeric, 2) AS distance_miles
      FROM market_sale_comps
      WHERE latitude   IS NOT NULL
        AND longitude  IS NOT NULL
        AND units      BETWEEN $3 AND $4
        AND sale_date  >= CURRENT_DATE - ($5 || ' months')::interval
        AND asset_class = ANY($6)
        AND (
          point(longitude, latitude) <@> point($2, $1)
        ) <= $7
      ORDER BY distance_miles ASC, sale_date DESC
      LIMIT $8
    `, [latitude, longitude, minUnits, maxUnits, monthsBack, assetClasses, radiusMiles, limit]);

    return res.rows.map((r: any) => ({
      ...r,
      sale_price: parseFloat(r.sale_price),
      price_per_unit: r.price_per_unit ? parseFloat(r.price_per_unit) : null,
      price_per_sqft: r.price_per_sqft ? parseFloat(r.price_per_sqft) : null,
      cap_rate: r.cap_rate ? parseFloat(r.cap_rate) : null,
      distance_miles: parseFloat(r.distance_miles),
    }));
  }
}

export const georgiaSaleCompsService = new GeorgiaSaleCompsService();
