/**
 * JEDI RE: Comp Query Engine
 * ===========================
 * Place in: backend/src/services/compQueryEngine.ts
 *
 * Turns deal_monthly_actuals into searchable comps.
 * Queries the v_comp_search view for T12 financial averages.
 *
 * Feeds: M05 Market Intelligence, M15 Competition Analysis,
 *        M09 ProForma baseline, F26 Submarket Rank, F27 Rent Comp Analysis
 */

import { sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// =============================================================================
// Types
// =============================================================================

export interface CompSearchParams {
  // Geographic filters
  msaId?: string;
  submarketId?: string;
  state?: string;
  city?: string;
  // Property filters
  propertyType?: string;
  productType?: string;
  minUnits?: number;
  maxUnits?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  // Financial filters (T12 averages)
  minRent?: number;
  maxRent?: number;
  minOccupancy?: number;
  minNoiPerUnit?: number;
  maxOpexRatio?: number;
  // Exclude subject property
  excludePropertyId?: string;
  // Sort + pagination
  sortBy?: CompSortField;
  sortDesc?: boolean;
  limit?: number;
  offset?: number;
}

export type CompSortField =
  | 't12_avg_rent'
  | 't12_total_noi'
  | 't12_avg_noi_per_unit'
  | 't12_avg_occupancy'
  | 't12_avg_opex_ratio'
  | 'total_units'
  | 'year_built';

export interface CompResult {
  propertyId: string;
  name: string;
  city: string;
  state: string;
  propertyType: string | null;
  productType: string | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  submarketName: string | null;
  msaName: string | null;
  t12AvgRent: number | null;
  t12AvgOccupancy: number | null;
  t12AvgMonthlyNoi: number | null;
  t12TotalNoi: number | null;
  t12AvgOpexRatio: number | null;
  t12AvgNoiPerUnit: number | null;
  latestMonth: string | null;
  monthsOfData: number;
}

export interface CompStats {
  count: number;
  avgRent: number | null;
  medianRent: number | null;
  avgOccupancy: number | null;
  avgNoiPerUnit: number | null;
  avgOpexRatio: number | null;
  rentRange: { min: number; max: number } | null;
  noiRange: { min: number; max: number } | null;
}

export interface CompSearchResponse {
  results: CompResult[];
  totalCount: number;
  stats: CompStats | null;
  filtersApplied: Record<string, unknown>;
}

export interface RentCompResult extends CompResult {
  distanceMiles: number;
  rentPremiumPct: number | null;
}

// =============================================================================
// Query Builder
// =============================================================================

function buildWhereClause(params: CompSearchParams): string {
  const conditions: string[] = ['months_of_data >= 3'];

  if (params.msaId) conditions.push(`msa_id = '${params.msaId}'`);
  if (params.submarketId) conditions.push(`submarket_id = '${params.submarketId}'`);
  if (params.state) conditions.push(`state = '${params.state.toUpperCase()}'`);
  if (params.city) conditions.push(`LOWER(city) = LOWER('${params.city}')`);
  if (params.propertyType) conditions.push(`property_type = '${params.propertyType}'`);
  if (params.productType) conditions.push(`product_type = '${params.productType}'`);
  if (params.minUnits != null) conditions.push(`total_units >= ${params.minUnits}`);
  if (params.maxUnits != null) conditions.push(`total_units <= ${params.maxUnits}`);
  if (params.minYearBuilt != null) conditions.push(`year_built >= ${params.minYearBuilt}`);
  if (params.maxYearBuilt != null) conditions.push(`year_built <= ${params.maxYearBuilt}`);
  if (params.minRent != null) conditions.push(`t12_avg_rent >= ${params.minRent}`);
  if (params.maxRent != null) conditions.push(`t12_avg_rent <= ${params.maxRent}`);
  if (params.minOccupancy != null) conditions.push(`t12_avg_occupancy >= ${params.minOccupancy}`);
  if (params.minNoiPerUnit != null) conditions.push(`t12_avg_noi_per_unit >= ${params.minNoiPerUnit}`);
  if (params.maxOpexRatio != null) conditions.push(`t12_avg_opex_ratio <= ${params.maxOpexRatio}`);
  if (params.excludePropertyId) conditions.push(`property_id != '${params.excludePropertyId}'`);

  return conditions.join(' AND ');
}

// =============================================================================
// Core Query Functions
// =============================================================================

/**
 * Search comps with geographic + property + financial filters.
 * Returns paginated results + aggregate stats across the full filtered set.
 */
export async function searchComps(
  db: NodePgDatabase<any>,
  params: CompSearchParams,
): Promise<CompSearchResponse> {
  const where = buildWhereClause(params);
  const sortBy = params.sortBy ?? 't12_avg_noi_per_unit';
  const sortDir = params.sortDesc !== false ? 'DESC' : 'ASC';
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  // Data query
  const dataQuery = sql.raw(`
    SELECT * FROM v_comp_search
    WHERE ${where}
    ORDER BY ${sortBy} ${sortDir} NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `);

  // Count query
  const countQuery = sql.raw(`
    SELECT COUNT(*)::int AS total FROM v_comp_search
    WHERE ${where}
  `);

  // Stats query
  const statsQuery = sql.raw(`
    SELECT
      COUNT(*)::int AS count,
      AVG(t12_avg_rent)::numeric(10,2) AS avg_rent,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY t12_avg_rent)::numeric(10,2) AS median_rent,
      AVG(t12_avg_occupancy)::numeric(5,3) AS avg_occupancy,
      AVG(t12_avg_noi_per_unit)::numeric(10,2) AS avg_noi_per_unit,
      AVG(t12_avg_opex_ratio)::numeric(5,3) AS avg_opex_ratio,
      MIN(t12_avg_rent)::numeric(10,2) AS min_rent,
      MAX(t12_avg_rent)::numeric(10,2) AS max_rent,
      MIN(t12_total_noi)::numeric(14,2) AS min_noi,
      MAX(t12_total_noi)::numeric(14,2) AS max_noi
    FROM v_comp_search
    WHERE ${where}
  `);

  const [dataRows, countRows, statsRows] = await Promise.all([
    db.execute(dataQuery),
    db.execute(countQuery),
    db.execute(statsQuery),
  ]);

  const results: CompResult[] = (dataRows.rows as any[]).map(mapRowToCompResult);

  const totalCount = (countRows.rows[0] as any)?.total ?? 0;

  const statsRow = statsRows.rows[0] as any;
  const stats: CompStats | null = statsRow
    ? {
        count: statsRow.count,
        avgRent: statsRow.avg_rent ? Number(statsRow.avg_rent) : null,
        medianRent: statsRow.median_rent ? Number(statsRow.median_rent) : null,
        avgOccupancy: statsRow.avg_occupancy ? Number(statsRow.avg_occupancy) : null,
        avgNoiPerUnit: statsRow.avg_noi_per_unit ? Number(statsRow.avg_noi_per_unit) : null,
        avgOpexRatio: statsRow.avg_opex_ratio ? Number(statsRow.avg_opex_ratio) : null,
        rentRange:
          statsRow.min_rent != null
            ? { min: Number(statsRow.min_rent), max: Number(statsRow.max_rent) }
            : null,
        noiRange:
          statsRow.min_noi != null
            ? { min: Number(statsRow.min_noi), max: Number(statsRow.max_noi) }
            : null,
      }
    : null;

  // Record which filters were applied for transparency
  const filtersApplied: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(params)) {
    if (val != null && key !== 'limit' && key !== 'offset') {
      filtersApplied[key] = val;
    }
  }

  return { results, totalCount, stats, filtersApplied };
}

/**
 * F27: Rent comp analysis for a subject property.
 * Finds nearby comps using Haversine distance and calculates rent premium/discount.
 */
export async function getRentComps(
  db: NodePgDatabase<any>,
  propertyId: string,
  radiusMiles: number = 3.0,
): Promise<{ comps: RentCompResult[]; subjectRent: number | null; avgCompRent: number | null; rentPremiumPct: number | null }> {
  const query = sql.raw(`
    WITH subject AS (
      SELECT id, latitude, longitude, total_units, year_built, product_type, submarket_id
      FROM properties WHERE id = '${propertyId}'
    ),
    subject_rent AS (
      SELECT t12_avg_rent FROM v_comp_search WHERE property_id = '${propertyId}'
    ),
    nearby AS (
      SELECT
        cs.*,
        (3959 * ACOS(
          LEAST(1.0,
            COS(RADIANS(s.latitude)) * COS(RADIANS(p.latitude)) *
            COS(RADIANS(p.longitude) - RADIANS(s.longitude)) +
            SIN(RADIANS(s.latitude)) * SIN(RADIANS(p.latitude))
          )
        )) AS distance_miles
      FROM v_comp_search cs
      JOIN properties p ON p.id = cs.property_id
      CROSS JOIN subject s
      WHERE cs.property_id != s.id
        AND cs.months_of_data >= 3
        AND p.latitude IS NOT NULL
        AND s.latitude IS NOT NULL
    )
    SELECT
      n.*,
      n.distance_miles,
      CASE WHEN sr.t12_avg_rent > 0 AND n.t12_avg_rent > 0
        THEN ((sr.t12_avg_rent - n.t12_avg_rent) / n.t12_avg_rent * 100)::numeric(5,2)
        ELSE NULL
      END AS rent_premium_pct
    FROM nearby n
    CROSS JOIN subject_rent sr
    WHERE n.distance_miles <= ${radiusMiles}
    ORDER BY n.distance_miles ASC
    LIMIT 20
  `);

  const rows = await db.execute(query);

  const comps: RentCompResult[] = (rows.rows as any[]).map((row) => ({
    ...mapRowToCompResult(row),
    distanceMiles: Number(row.distance_miles),
    rentPremiumPct: row.rent_premium_pct != null ? Number(row.rent_premium_pct) : null,
  }));

  // Calculate aggregate
  const subjectRent = comps.length > 0 && (rows.rows[0] as any)?.rent_premium_pct != null
    ? null // fetch from subject_rent CTE
    : null;
  const compRents = comps.map((c) => c.t12AvgRent).filter(Boolean) as number[];
  const avgCompRent = compRents.length > 0
    ? compRents.reduce((a, b) => a + b, 0) / compRents.length
    : null;

  return {
    comps,
    subjectRent,
    avgCompRent,
    rentPremiumPct: comps.length > 0 ? (comps[0].rentPremiumPct ?? null) : null,
  };
}

/**
 * Get aggregate stats for a submarket — feeds F26 Submarket Rank.
 */
export async function getSubmarketStats(
  db: NodePgDatabase<any>,
  submarketId: string,
): Promise<CompStats | null> {
  const result = await searchComps(db, { submarketId, limit: 1 });
  return result.stats;
}

// =============================================================================
// Helpers
// =============================================================================

function mapRowToCompResult(row: any): CompResult {
  return {
    propertyId: row.property_id,
    name: row.name,
    city: row.city,
    state: row.state,
    propertyType: row.property_type,
    productType: row.product_type,
    totalUnits: row.total_units != null ? Number(row.total_units) : null,
    yearBuilt: row.year_built != null ? Number(row.year_built) : null,
    submarketName: row.submarket_name,
    msaName: row.msa_name,
    t12AvgRent: row.t12_avg_rent != null ? Number(row.t12_avg_rent) : null,
    t12AvgOccupancy: row.t12_avg_occupancy != null ? Number(row.t12_avg_occupancy) : null,
    t12AvgMonthlyNoi: row.t12_avg_monthly_noi != null ? Number(row.t12_avg_monthly_noi) : null,
    t12TotalNoi: row.t12_total_noi != null ? Number(row.t12_total_noi) : null,
    t12AvgOpexRatio: row.t12_avg_opex_ratio != null ? Number(row.t12_avg_opex_ratio) : null,
    t12AvgNoiPerUnit: row.t12_avg_noi_per_unit != null ? Number(row.t12_avg_noi_per_unit) : null,
    latestMonth: row.latest_month ? String(row.latest_month) : null,
    monthsOfData: Number(row.months_of_data ?? 0),
  };
}
