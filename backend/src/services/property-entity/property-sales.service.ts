/**
 * PropertySalesService
 * Phase 1 + Phase 5 — Property Plumbing Refactor
 *
 * Canonical transaction history. Phase 5 activates:
 *   - getSalesByCriteria() — strategy-aware comp selection
 *   - bulkIngestSales()    — batch ETL for CoStar exports
 *   - synthesizeImpliedCapRates() — derive implied cap rates from property_operating_data
 */

import { query } from '../../database/connection';
import type { PropertySale, CreatePropertySaleInput, SaleSource } from './types';
import { logger } from '../../utils/logger';

// ── Strategy filter matrix ────────────────────────────────────────────────────

export type InvestmentStrategy =
  | 'stabilized'
  | 'core_plus'
  | 'value_add'
  | 'opportunistic'
  | 'development';

interface StrategyProfile {
  buildingClasses: string[];      // preferred; empty = all
  maxAgeMonths: number;           // sale date lookback
  minSalePrice: number | null;    // filter trivial/non-MF sales
}

const STRATEGY_PROFILES: Record<InvestmentStrategy, StrategyProfile> = {
  stabilized:   { buildingClasses: ['A', 'B'],       maxAgeMonths: 36, minSalePrice: 1_000_000 },
  core_plus:    { buildingClasses: ['A', 'B', 'C'],  maxAgeMonths: 48, minSalePrice: 1_000_000 },
  value_add:    { buildingClasses: ['B', 'C', 'D'],  maxAgeMonths: 60, minSalePrice: null },
  opportunistic:{ buildingClasses: [],               maxAgeMonths: 60, minSalePrice: null },
  development:  { buildingClasses: [],               maxAgeMonths: 60, minSalePrice: null },
};

// ── Return type with joined property fields ───────────────────────────────────

export interface PropertySaleWithProperty extends PropertySale {
  address: string | null;
  city: string | null;
  stateCode: string | null;
  lat: number | null;
  lng: number | null;
  units: number | null;
  yearBuilt: number | null;
  buildingClass: string | null;
  distanceMiles: number | null;
}

// ── Bulk ingest result ────────────────────────────────────────────────────────

export interface BulkIngestResult {
  inserted: number;
  skipped: number;
  errors: number;
  errorMessages: string[];
}

// ── mapRow helpers ────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): PropertySale {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    saleDate: (row.sale_date as string) ?? null,
    salePrice: row.sale_price != null ? parseFloat(row.sale_price as string) : null,
    pricePerUnit: row.price_per_unit != null ? parseFloat(row.price_per_unit as string) : null,
    pricePerSf: row.price_per_sf != null ? parseFloat(row.price_per_sf as string) : null,
    buyer: (row.buyer as string) ?? null,
    seller: (row.seller as string) ?? null,
    buyerOperatorId: (row.buyer_operator_id as string) ?? null,
    sellerOperatorId: (row.seller_operator_id as string) ?? null,
    deedType: (row.deed_type as string) ?? null,
    deedBookPage: (row.deed_book_page as string) ?? null,
    financingType: (row.financing_type as string) ?? null,
    loanAmount: row.loan_amount != null ? parseFloat(row.loan_amount as string) : null,
    loanTerms: (row.loan_terms as Record<string, unknown>) ?? null,
    impliedCapRate: row.implied_cap_rate != null ? parseFloat(row.implied_cap_rate as string) : null,
    relatedOperatingDataId: (row.related_operating_data_id as string) ?? null,
    source: row.source as SaleSource,
    sourceId: (row.source_id as string) ?? null,
    sourceDate: (row.source_date as string) ?? null,
    confidence: row.confidence != null ? parseFloat(row.confidence as string) : null,
    isJediTracked: Boolean(row.is_jedi_tracked),
    qualified: row.qualified != null ? Boolean(row.qualified) : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRowWithProperty(row: Record<string, unknown>): PropertySaleWithProperty {
  const base = mapRow(row);
  return {
    ...base,
    address: (row.address_line1 as string) ?? null,
    city: (row.city as string) ?? null,
    stateCode: (row.state_code as string) ?? null,
    lat: row.lat != null ? parseFloat(row.lat as string) : null,
    lng: row.lng != null ? parseFloat(row.lng as string) : null,
    units: row.units != null ? parseInt(row.units as string, 10) : null,
    yearBuilt: row.year_built != null ? parseInt(row.year_built as string, 10) : null,
    buildingClass: (row.building_class as string) ?? null,
    distanceMiles: row.distance_miles != null ? parseFloat(row.distance_miles as string) : null,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class PropertySalesService {
  /**
   * Get all sales for a property, newest first.
   */
  async getByProperty(propertyId: string): Promise<PropertySale[]> {
    const result = await query(
      `SELECT * FROM property_sales
       WHERE property_id = $1
       ORDER BY sale_date DESC NULLS LAST`,
      [propertyId]
    );
    return result.rows.map(mapRow);
  }

  /**
   * Get the most recent sale for a property.
   */
  async getLastSale(propertyId: string): Promise<PropertySale | null> {
    const result = await query(
      `SELECT * FROM property_sales
       WHERE property_id = $1
       ORDER BY sale_date DESC NULLS LAST
       LIMIT 1`,
      [propertyId]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  /**
   * Phase 5 — Strategy-aware comp selection.
   *
   * Queries property_sales joined to properties for spatial, temporal, and
   * attribute-based filtering. Applies strategy-specific defaults unless the
   * caller explicitly overrides them.
   *
   * Strategy matrix:
   *   stabilized   → Class A/B,      ≤36 months, ≥$1M
   *   core_plus    → Class A/B/C,    ≤48 months, ≥$1M
   *   value_add    → Class B/C/D,    ≤60 months
   *   opportunistic→ all classes,    ≤60 months
   *   development  → all classes,    ≤60 months
   */
  async getSalesByCriteria(opts: {
    lat: number;
    lng: number;
    radiusMiles: number;
    monthsBack?: number;
    minUnits?: number;
    maxUnits?: number;
    minYearBuilt?: number;
    maxYearBuilt?: number;
    buildingClasses?: string[];
    strategy?: InvestmentStrategy;
    minSalePrice?: number | null;
    sources?: SaleSource[];
    qualifiedOnly?: boolean;
    limit?: number;
  }): Promise<PropertySaleWithProperty[]> {
    const {
      lat,
      lng,
      radiusMiles,
      strategy,
      qualifiedOnly = true,
      limit = 200,
    } = opts;

    const profile = strategy ? STRATEGY_PROFILES[strategy] : null;
    const monthsBack    = opts.monthsBack    ?? profile?.maxAgeMonths ?? 60;
    const buildingClasses = opts.buildingClasses ?? (profile?.buildingClasses?.length ? profile.buildingClasses : []);
    const minSalePrice  = opts.minSalePrice  !== undefined ? opts.minSalePrice : (profile?.minSalePrice ?? null);

    const params: unknown[] = [lat, lng, radiusMiles * 1609.34, monthsBack];
    let idx = 5;

    const conditions: string[] = [
      `ps.sale_date >= NOW() - ($4 || ' months')::interval`,
      `ST_DWithin(
         ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         $3
       )`,
    ];

    if (qualifiedOnly) {
      conditions.push(`ps.qualified = TRUE`);
    }

    if (opts.minUnits != null) {
      params.push(opts.minUnits);
      conditions.push(`(pc.unit_count >= $${idx} OR p.units >= $${idx})`);
      idx++;
    }
    if (opts.maxUnits != null) {
      params.push(opts.maxUnits);
      conditions.push(`(pc.unit_count <= $${idx} OR p.units <= $${idx})`);
      idx++;
    }
    if (opts.minYearBuilt != null) {
      params.push(opts.minYearBuilt);
      conditions.push(`p.year_built >= $${idx}`);
      idx++;
    }
    if (opts.maxYearBuilt != null) {
      params.push(opts.maxYearBuilt);
      conditions.push(`p.year_built <= $${idx}`);
      idx++;
    }
    if (buildingClasses.length > 0) {
      params.push(buildingClasses);
      conditions.push(
        `(UPPER(COALESCE(pc.current_building_class, p.building_class)) = ANY($${idx}::text[]))`
      );
      idx++;
    }
    if (minSalePrice != null) {
      params.push(minSalePrice);
      conditions.push(`ps.sale_price >= $${idx}`);
      idx++;
    }
    if (opts.sources && opts.sources.length > 0) {
      params.push(opts.sources);
      conditions.push(`ps.source = ANY($${idx}::text[])`);
      idx++;
    }

    params.push(limit);

    const sql = `
      SELECT
        ps.*,
        p.address_line1,
        p.city,
        p.state_code,
        p.lat,
        p.lng,
        p.year_built,
        p.building_class,
        COALESCE(pc.unit_count, p.units) AS units,
        ROUND(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
          ) / 1609.34, 3
        ) AS distance_miles
      FROM property_sales ps
      JOIN properties p ON ps.property_id = p.id
      LEFT JOIN LATERAL (
        SELECT current_building_class, unit_count
        FROM property_characteristics
        WHERE property_id = ps.property_id AND effective_to IS NULL
        ORDER BY effective_from DESC
        LIMIT 1
      ) pc ON TRUE
      WHERE ${conditions.join(' AND ')}
      ORDER BY ps.sale_date DESC NULLS LAST
      LIMIT $${idx}
    `;

    const result = await query(sql, params);
    return result.rows.map(mapRowWithProperty);
  }

  /**
   * Get qualified sale comps within radius and time window.
   * Phase 1 spatial query. For strategy-aware selection use getSalesByCriteria.
   */
  async getCompSet(
    centerLat: number,
    centerLng: number,
    radiusMiles: number,
    monthsBack: number
  ): Promise<PropertySale[]> {
    const result = await query(
      `SELECT ps.*
       FROM property_sales ps
       JOIN properties p ON ps.property_id = p.id
       WHERE ps.qualified = TRUE
         AND ps.sale_date >= NOW() - ($4 || ' months')::interval
         AND ST_DWithin(
           ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
           $3 * 1609.34
         )
       ORDER BY ps.sale_date DESC`,
      [centerLat, centerLng, radiusMiles, monthsBack]
    );
    return result.rows.map(mapRow);
  }

  /**
   * Create a new sale record.
   */
  async create(input: CreatePropertySaleInput): Promise<PropertySale> {
    const result = await query(
      `INSERT INTO property_sales (
        property_id, sale_date, sale_price, price_per_unit, price_per_sf,
        buyer, seller, buyer_operator_id, seller_operator_id,
        deed_type, deed_book_page, financing_type, loan_amount, loan_terms,
        implied_cap_rate, related_operating_data_id,
        source, source_id, source_date, confidence,
        is_jedi_tracked, qualified
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [
        input.propertyId,
        input.saleDate ?? null,
        input.salePrice ?? null,
        input.pricePerUnit ?? null,
        input.pricePerSf ?? null,
        input.buyer ?? null,
        input.seller ?? null,
        input.buyerOperatorId ?? null,
        input.sellerOperatorId ?? null,
        input.deedType ?? null,
        input.deedBookPage ?? null,
        input.financingType ?? null,
        input.loanAmount ?? null,
        input.loanTerms ? JSON.stringify(input.loanTerms) : null,
        input.impliedCapRate ?? null,
        input.relatedOperatingDataId ?? null,
        input.source,
        input.sourceId ?? null,
        input.sourceDate ?? null,
        input.confidence ?? null,
        input.isJediTracked ?? false,
        input.qualified ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  }

  /**
   * Upsert by source + source_id — idempotent for ETL pipelines.
   */
  async upsertBySourceId(input: CreatePropertySaleInput): Promise<PropertySale> {
    if (!input.sourceId) return this.create(input);

    const result = await query(
      `INSERT INTO property_sales (
        property_id, sale_date, sale_price, price_per_unit, price_per_sf,
        buyer, seller, source, source_id, source_date, confidence,
        is_jedi_tracked, qualified
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (source, source_id) DO UPDATE SET
        sale_date        = EXCLUDED.sale_date,
        sale_price       = EXCLUDED.sale_price,
        price_per_unit   = EXCLUDED.price_per_unit,
        price_per_sf     = EXCLUDED.price_per_sf,
        buyer            = EXCLUDED.buyer,
        seller           = EXCLUDED.seller,
        confidence       = EXCLUDED.confidence,
        qualified        = EXCLUDED.qualified,
        updated_at       = NOW()
      RETURNING *`,
      [
        input.propertyId,
        input.saleDate ?? null,
        input.salePrice ?? null,
        input.pricePerUnit ?? null,
        input.pricePerSf ?? null,
        input.buyer ?? null,
        input.seller ?? null,
        input.source,
        input.sourceId,
        input.sourceDate ?? null,
        input.confidence ?? null,
        input.isJediTracked ?? false,
        input.qualified ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  }

  /**
   * Phase 5 — Bulk ingest sale comps.
   *
   * Used by ETL pipelines (CoStar exports, Cobb/Gwinnett backfill, research agent).
   * Each record is upserted via upsertBySourceId for idempotency.
   * Errors on individual records are captured and returned — never fatal to the batch.
   */
  async bulkIngestSales(sales: CreatePropertySaleInput[]): Promise<BulkIngestResult> {
    const result: BulkIngestResult = { inserted: 0, skipped: 0, errors: 0, errorMessages: [] };

    for (const sale of sales) {
      try {
        const row = await this.upsertBySourceId(sale);
        // xmax = 0 means inserted (new row). Without raw xmax access, we count
        // inserted vs skipped by checking if updated_at ≈ created_at (< 1s).
        const created = new Date(row.createdAt).getTime();
        const updated = new Date(row.updatedAt).getTime();
        if (updated - created < 1000) {
          result.inserted++;
        } else {
          result.skipped++;
        }
      } catch (err) {
        result.errors++;
        const msg = err instanceof Error ? err.message : String(err);
        result.errorMessages.push(msg);
        logger.warn('[PropertySalesService.bulkIngestSales] Record failed', {
          sourceId: sale.sourceId,
          error: msg,
        });
      }
    }

    logger.info('[PropertySalesService.bulkIngestSales] Complete', {
      total: sales.length,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
    });

    return result;
  }

  /**
   * Phase 5 — Synthesize and persist implied cap rates.
   *
   * For each property_sales row where:
   *   - implied_cap_rate IS NULL
   *   - sale_price IS NOT NULL
   *
   * Looks up a matching property_operating_data row (TTM period, within 12 months
   * of the sale date) and computes:
   *   implied_cap_rate = noi / sale_price
   *
   * Writes the result back to property_sales.implied_cap_rate.
   * Safe to re-run: skips rows that already have an implied_cap_rate.
   *
   * Returns count of rows updated and skipped.
   */
  async synthesizeImpliedCapRates(opts: {
    limit?: number;
    dryRun?: boolean;
  } = {}): Promise<{ updated: number; skipped: number; insufficient: number }> {
    const { limit = 5000, dryRun = false } = opts;

    const candidatesResult = await query(
      `SELECT ps.id, ps.property_id, ps.sale_date, ps.sale_price
       FROM property_sales ps
       WHERE ps.implied_cap_rate IS NULL
         AND ps.sale_price IS NOT NULL
         AND ps.sale_price > 0
         AND ps.sale_date IS NOT NULL
       ORDER BY ps.sale_date DESC
       LIMIT $1`,
      [limit]
    );

    let updated = 0;
    let skipped = 0;
    let insufficient = 0;

    for (const row of candidatesResult.rows) {
      const { id: saleId, property_id, sale_date, sale_price } = row;
      const salePriceNum = parseFloat(sale_price);

      const operatingResult = await query(
        `SELECT noi FROM property_operating_data
         WHERE property_id = $1
           AND period_type = 'ttm'
           AND noi IS NOT NULL
           AND noi > 0
           AND ABS(period_end - $2::date) <= 365
         ORDER BY ABS(period_end - $2::date)
         LIMIT 1`,
        [property_id, sale_date]
      );

      if (operatingResult.rows.length === 0) {
        insufficient++;
        continue;
      }

      const noi = parseFloat(operatingResult.rows[0].noi);
      const impliedCapRate = noi / salePriceNum;

      if (impliedCapRate < 0.01 || impliedCapRate > 0.25) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        await query(
          `UPDATE property_sales
           SET implied_cap_rate = $1, updated_at = NOW()
           WHERE id = $2`,
          [impliedCapRate, saleId]
        );
      }

      updated++;
    }

    logger.info('[PropertySalesService.synthesizeImpliedCapRates] Complete', {
      updated, skipped, insufficient, dryRun,
    });

    return { updated, skipped, insufficient };
  }

  /**
   * Market cap rate distribution (P25/P50/P75) from property_sales implied cap rates.
   *
   * Used by Phase 5 comp-anchored cap rate synthesis in the valuation grid.
   * Returns null if fewer than 3 data points exist.
   */
  async getMarketCapRateDistribution(opts: {
    lat: number;
    lng: number;
    radiusMiles: number;
    monthsBack: number;
    strategy?: InvestmentStrategy;
    minUnits?: number;
    maxUnits?: number;
  }): Promise<{
    p25: number;
    p50: number;
    p75: number;
    n: number;
    sources: Array<{ saleId: string; impliedCapRate: number; saleDate: string; distanceMiles: number }>;
  } | null> {
    const comps = await this.getSalesByCriteria({
      lat: opts.lat,
      lng: opts.lng,
      radiusMiles: opts.radiusMiles,
      monthsBack: opts.monthsBack,
      strategy: opts.strategy,
      minUnits: opts.minUnits,
      maxUnits: opts.maxUnits,
      qualifiedOnly: true,
      limit: 500,
    });

    const withCap = comps.filter(c => c.impliedCapRate != null && c.impliedCapRate > 0.01 && c.impliedCapRate < 0.25);
    if (withCap.length < 3) return null;

    const rates = withCap.map(c => c.impliedCapRate!).sort((a, b) => a - b);
    const p25 = rates[Math.floor(rates.length * 0.25)];
    const p50 = rates[Math.floor(rates.length * 0.50)];
    const p75 = rates[Math.floor(rates.length * 0.75)];

    return {
      p25, p50, p75,
      n: withCap.length,
      sources: withCap.slice(0, 20).map(c => ({
        saleId: c.id,
        impliedCapRate: c.impliedCapRate!,
        saleDate: c.saleDate ?? '',
        distanceMiles: c.distanceMiles ?? 0,
      })),
    };
  }
}

export const propertySalesService = new PropertySalesService();
