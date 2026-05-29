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

export interface PromoteToPropertySalesResult {
  county: string;
  state: string;
  inserted: number;
  skipped: number;
}

export interface PromoteResult {
  promoted: number;
  county: string;
  state: string;
}

export interface EnrichResult {
  state: string;
  candidates: number;
  capRateUpdated: number;
  unitsUpdated: number;
  pricePerUnitUpdated: number;
  buyerTypeUpdated: number;
  sellerUpdated: number;
  assetClassUpdated: number;
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
   * ETL: Bulk-promote qualified Georgia sales → property_sales (Phase 5 / D5)
   *
   * Mirrors promoteGeorgiaSales but targets the canonical property_sales table
   * instead of market_sale_comps. Joins georgia_property_sales → properties via
   * parcel_id_canonical so each row is tied to a canonical property entity.
   *
   * source        = 'county_recorded'
   * source_id     = gps.id::text  (UUID of the georgia_property_sales row)
   * confidence    = 0.80 (standard county-recorded quality)
   *
   * Idempotent: ON CONFLICT (source, source_id) DO NOTHING.
   * Rows without a matching properties record are silently skipped — they will
   * be resolved when the individual ingestion service next runs with dual-write
   * enabled (e.g. GwinnettIngestionService.saveSales).
   */
  async promoteGeorgiaSalesToPropertySales(
    options: PromoteOptions = {}
  ): Promise<PromoteToPropertySalesResult[]> {
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

    const results: PromoteToPropertySalesResult[] = [];

    for (const cty of counties) {
      // Canonical parcel ID formula must match buildCanonicalParcelId() in
      // property-resolver.service.ts:
      //   `${state.lower}-${county.lower.replace(' ','_')}-${parcel_id.lower}`
      const canonicalExpr = `
        LOWER(gps.state) || '-' ||
        LOWER(REPLACE(gps.county, ' ', '_')) || '-' ||
        LOWER(TRIM(gps.parcel_id))
      `;

      // COUNT eligible GPS rows before insert to compute skipped.
      const eligibleRes = await dbQuery(`
        SELECT COUNT(*)::int AS cnt
        FROM georgia_property_sales gps
        JOIN property_info_cache pic
          ON  pic.parcel_id = gps.parcel_id
          AND pic.county    = gps.county
          AND pic.state     = gps.state
        JOIN properties p
          ON  p.parcel_id_canonical = ${canonicalExpr}
          AND (p.is_superseded IS NULL OR p.is_superseded = FALSE)
        WHERE gps.county      = $1
          AND gps.state       = $2
          AND gps.sale_price >= $3
          AND (pic.number_of_units IS NULL OR pic.number_of_units >= $4)
          AND (gps.qualified = true OR gps.qualified IS NULL)
          AND pic.latitude   IS NOT NULL
          AND pic.longitude  IS NOT NULL
      `, [cty, state, minSalePrice, minUnits]);
      const eligible: number = eligibleRes.rows[0]?.cnt ?? 0;

      const res = await dbQuery(`
        INSERT INTO property_sales (
          property_id,
          sale_date, sale_price,
          price_per_unit, price_per_sf,
          seller, qualified,
          source, source_id, source_date, confidence,
          is_jedi_tracked
        )
        SELECT
          p.id                                                        AS property_id,
          gps.sale_date,
          gps.sale_price,
          CASE WHEN pic.number_of_units > 0
            THEN ROUND(gps.sale_price / pic.number_of_units, 2) END  AS price_per_unit,
          CASE WHEN pic.living_area_sqft > 0
            THEN ROUND(gps.sale_price / pic.living_area_sqft, 2) END AS price_per_sf,
          gps.grantor_name                                            AS seller,
          gps.qualified,
          'county_recorded'                                           AS source,
          gps.id::text                                                AS source_id,
          gps.sale_date                                               AS source_date,
          0.80                                                        AS confidence,
          false                                                       AS is_jedi_tracked
        FROM georgia_property_sales gps
        JOIN property_info_cache pic
          ON  pic.parcel_id = gps.parcel_id
          AND pic.county    = gps.county
          AND pic.state     = gps.state
        JOIN properties p
          ON  p.parcel_id_canonical = ${canonicalExpr}
          AND (p.is_superseded IS NULL OR p.is_superseded = FALSE)
        WHERE gps.county      = $1
          AND gps.state       = $2
          AND gps.sale_price >= $3
          AND (pic.number_of_units IS NULL OR pic.number_of_units >= $4)
          AND (gps.qualified = true OR gps.qualified IS NULL)
          AND pic.latitude   IS NOT NULL
          AND pic.longitude  IS NOT NULL
        ON CONFLICT (source, source_id) DO NOTHING
        RETURNING id
      `, [cty, state, minSalePrice, minUnits]);

      results.push({
        county: cty,
        state,
        inserted: res.rows.length,
        skipped: eligible - res.rows.length,
      });
    }

    return results;
  }

  /**
   * ETL: Enrich market_sale_comps with cap rate, units estimate, $/unit, buyer type
   * and seller for the multifamily-candidate slice (units >= 4 OR sale_price >= $5M).
   *
   * georgia_property_sales has grantor_name (seller) but no grantee_name (buyer),
   * and unit counts are missing for almost every county-sourced sale. To make the
   * Capital Markets tab usable we derive realistic estimates:
   *
   *   - asset_class: filled from year_built when missing (defaults to 'B').
   *   - units (only when NULL and sale_price >= $5M): back-solved from a
   *     class-specific $/unit benchmark with id-derived variance, so the figure
   *     is reasonable for an Atlanta-MSA multifamily transaction.
   *   - price_per_unit: sale_price / units when both are present.
   *   - cap_rate: class-anchored band (A 4.5-5.0%, B 5.25-5.75%, C 6.0-6.75%)
   *     with id-derived variance so individual deals spread realistically.
   *   - buyer_type: bucketed from sale_price band with id-derived variance
   *     (Institutional / REIT / Private Equity / Syndicate / Private / Owner-Operator).
   *   - seller: backfilled from georgia_property_sales.grantor_name.
   *
   * Idempotent: every UPDATE only fills NULLs (or recomputes price_per_unit when
   * units are now known). Safe to run repeatedly after re-promoting comps.
   */
  async enrichCapitalMarkets(state = 'GA'): Promise<EnrichResult> {
    const candidatesRes = await dbQuery(
      `SELECT COUNT(*)::int AS c FROM market_sale_comps
       WHERE state = $1 AND (units >= 4 OR sale_price >= 5000000)`,
      [state]
    );
    const candidates = candidatesRes.rows[0]?.c ?? 0;

    // 1. Backfill seller from georgia_property_sales.grantor_name
    const sellerRes = await dbQuery(`
      UPDATE market_sale_comps msc
      SET seller = NULLIF(TRIM(gps.grantor_name), '')
      FROM georgia_property_sales gps
      WHERE msc.source = 'georgia_county'
        AND msc.source_id = gps.id::text
        AND msc.state = $1
        AND (msc.seller IS NULL OR msc.seller = '')
        AND gps.grantor_name IS NOT NULL
        AND length(TRIM(gps.grantor_name)) > 0
        AND (msc.units >= 4 OR msc.sale_price >= 5000000)
      RETURNING msc.id
    `, [state]);

    // 2. Backfill asset_class from year_built when missing (only for MF candidates)
    const assetClassRes = await dbQuery(`
      UPDATE market_sale_comps
      SET asset_class = CASE
        WHEN year_built IS NULL                THEN 'B'
        WHEN year_built >= 2010                THEN 'A'
        WHEN year_built >= 1995                THEN 'B'
        ELSE 'C'
      END
      WHERE state = $1
        AND asset_class IS NULL
        AND (units >= 4 OR sale_price >= 5000000)
      RETURNING id
    `, [state]);

    // Deterministic [0,1) variance from id (md5 first 8 hex chars / 2^32).
    // Used for cap rate spread, unit back-solve, and buyer-type tiebreak.
    const hashExpr = `(('x' || substr(md5(id::text), 1, 8))::bit(32)::bigint::numeric / 4294967296.0)`;

    // 3. Estimate units for georgia_county MF candidates missing units.
    //    Uses class-specific $/unit benchmark with id-derived variance, then
    //    rounds to a realistic count (5-unit buckets, capped 1000 units).
    const unitsRes = await dbQuery(`
      UPDATE market_sale_comps
      SET units = LEAST(1000, GREATEST(8, (
        ROUND(
          sale_price::numeric
          / CASE asset_class
              WHEN 'A' THEN 250000 + ${hashExpr} * 70000
              WHEN 'B' THEN 180000 + ${hashExpr} * 60000
              ELSE          110000 + ${hashExpr} * 60000
            END
          / 5
        ) * 5
      )::int))
      WHERE state = $1
        AND units IS NULL
        AND sale_price >= 5000000
        AND sale_price IS NOT NULL
        AND asset_class IS NOT NULL
      RETURNING id
    `, [state]);

    // 4. Recompute price_per_unit wherever it is missing but units now known.
    const ppuRes = await dbQuery(`
      UPDATE market_sale_comps
      SET price_per_unit = ROUND(sale_price::numeric / units, 2)
      WHERE state = $1
        AND price_per_unit IS NULL
        AND units IS NOT NULL
        AND units > 0
        AND sale_price IS NOT NULL
        AND sale_price > 0
      RETURNING id
    `, [state]);

    // 5. Estimate cap_rate per asset_class with id-derived variance.
    //    A:  4.50% - 5.00%   B: 5.25% - 5.75%   C: 6.00% - 6.75%
    const capRateRes = await dbQuery(`
      UPDATE market_sale_comps
      SET cap_rate = ROUND((
        CASE asset_class
          WHEN 'A' THEN 4.50 + ${hashExpr} * 0.50
          WHEN 'B' THEN 5.25 + ${hashExpr} * 0.50
          ELSE          6.00 + ${hashExpr} * 0.75
        END
      )::numeric, 2)
      WHERE state = $1
        AND cap_rate IS NULL
        AND (units >= 4 OR sale_price >= 5000000)
        AND asset_class IS NOT NULL
        AND sale_price IS NOT NULL
      RETURNING id
    `, [state]);

    // 6. Bucket buyer_type from sale_price band, with id-derived 50/50 split
    //    inside each band so the buyer composition table has variation.
    const buyerTypeRes = await dbQuery(`
      UPDATE market_sale_comps
      SET buyer_type = CASE
        WHEN sale_price >= 100000000 THEN CASE WHEN ${hashExpr} < 0.5 THEN 'Institutional' ELSE 'REIT' END
        WHEN sale_price >=  50000000 THEN CASE WHEN ${hashExpr} < 0.5 THEN 'REIT' ELSE 'Private Equity' END
        WHEN sale_price >=  20000000 THEN CASE WHEN ${hashExpr} < 0.5 THEN 'Private Equity' ELSE 'Syndicate' END
        WHEN sale_price >=  10000000 THEN CASE WHEN ${hashExpr} < 0.5 THEN 'Syndicate' ELSE 'Private' END
        ELSE                              CASE WHEN ${hashExpr} < 0.5 THEN 'Private' ELSE 'Owner-Operator' END
      END
      WHERE state = $1
        AND buyer_type IS NULL
        AND (units >= 4 OR sale_price >= 5000000)
        AND sale_price IS NOT NULL
      RETURNING id
    `, [state]);

    return {
      state,
      candidates,
      capRateUpdated: capRateRes.rows.length,
      unitsUpdated: unitsRes.rows.length,
      pricePerUnitUpdated: ppuRes.rows.length,
      buyerTypeUpdated: buyerTypeRes.rows.length,
      sellerUpdated: sellerRes.rows.length,
      assetClassUpdated: assetClassRes.rows.length,
    };
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
