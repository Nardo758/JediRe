import { query } from '../database/connection';

export interface CompSearchParams {
  msaId?: string;
  submarketId?: string;
  state?: string;
  city?: string;
  propertyType?: string;
  productType?: string;
  minUnits?: number;
  maxUnits?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minRent?: number;
  maxRent?: number;
  minOccupancy?: number;
  minNoiPerUnit?: number;
  maxOpexRatio?: number;
  excludePropertyId?: string;
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

const VALID_SORT_FIELDS = new Set<string>([
  't12_avg_rent', 't12_total_noi', 't12_avg_noi_per_unit',
  't12_avg_occupancy', 't12_avg_opex_ratio', 'total_units', 'year_built',
]);

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

function buildParameterizedWhere(params: CompSearchParams, startIdx: number = 1): { clause: string; values: any[]; nextIdx: number } {
  const conditions: string[] = ['months_of_data >= 3'];
  const values: any[] = [];
  let idx = startIdx;

  if (params.msaId) { conditions.push(`msa_id = $${idx++}`); values.push(params.msaId); }
  if (params.submarketId) { conditions.push(`submarket_id = $${idx++}`); values.push(params.submarketId); }
  if (params.state) { conditions.push(`state = $${idx++}`); values.push(params.state.toUpperCase()); }
  if (params.city) { conditions.push(`LOWER(city) = LOWER($${idx++})`); values.push(params.city); }
  if (params.propertyType) { conditions.push(`property_type = $${idx++}`); values.push(params.propertyType); }
  if (params.productType) { conditions.push(`product_type = $${idx++}`); values.push(params.productType); }
  if (params.minUnits != null) { conditions.push(`total_units >= $${idx++}`); values.push(params.minUnits); }
  if (params.maxUnits != null) { conditions.push(`total_units <= $${idx++}`); values.push(params.maxUnits); }
  if (params.minYearBuilt != null) { conditions.push(`year_built >= $${idx++}`); values.push(params.minYearBuilt); }
  if (params.maxYearBuilt != null) { conditions.push(`year_built <= $${idx++}`); values.push(params.maxYearBuilt); }
  if (params.minRent != null) { conditions.push(`t12_avg_rent >= $${idx++}`); values.push(params.minRent); }
  if (params.maxRent != null) { conditions.push(`t12_avg_rent <= $${idx++}`); values.push(params.maxRent); }
  if (params.minOccupancy != null) { conditions.push(`t12_avg_occupancy >= $${idx++}`); values.push(params.minOccupancy); }
  if (params.minNoiPerUnit != null) { conditions.push(`t12_avg_noi_per_unit >= $${idx++}`); values.push(params.minNoiPerUnit); }
  if (params.maxOpexRatio != null) { conditions.push(`t12_avg_opex_ratio <= $${idx++}`); values.push(params.maxOpexRatio); }
  if (params.excludePropertyId) { conditions.push(`property_id != $${idx++}`); values.push(params.excludePropertyId); }

  return { clause: conditions.join(' AND '), values, nextIdx: idx };
}

export async function searchComps(params: CompSearchParams): Promise<CompSearchResponse> {
  const { clause, values, nextIdx } = buildParameterizedWhere(params);
  const sortBy = VALID_SORT_FIELDS.has(params.sortBy ?? '') ? params.sortBy! : 't12_avg_noi_per_unit';
  const sortDir = params.sortDesc !== false ? 'DESC' : 'ASC';
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const limitIdx = nextIdx;
  const offsetIdx = nextIdx + 1;
  const dataValues = [...values, limit, offset];

  const dataSQL = `
    SELECT * FROM v_comp_search
    WHERE ${clause}
    ORDER BY ${sortBy} ${sortDir} NULLS LAST
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { clause: countClause, values: countValues } = buildParameterizedWhere(params);

  const countSQL = `SELECT COUNT(*)::int AS total FROM v_comp_search WHERE ${countClause}`;

  const statsSQL = `
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
    WHERE ${countClause}
  `;

  const [dataResult, countResult, statsResult] = await Promise.all([
    query(dataSQL, dataValues),
    query(countSQL, countValues),
    query(statsSQL, countValues),
  ]);

  const results: CompResult[] = dataResult.rows.map(mapRowToCompResult);
  const totalCount = countResult.rows[0]?.total ?? 0;

  const s = statsResult.rows[0];
  const stats: CompStats | null = s
    ? {
        count: s.count,
        avgRent: s.avg_rent ? Number(s.avg_rent) : null,
        medianRent: s.median_rent ? Number(s.median_rent) : null,
        avgOccupancy: s.avg_occupancy ? Number(s.avg_occupancy) : null,
        avgNoiPerUnit: s.avg_noi_per_unit ? Number(s.avg_noi_per_unit) : null,
        avgOpexRatio: s.avg_opex_ratio ? Number(s.avg_opex_ratio) : null,
        rentRange: s.min_rent != null ? { min: Number(s.min_rent), max: Number(s.max_rent) } : null,
        noiRange: s.min_noi != null ? { min: Number(s.min_noi), max: Number(s.max_noi) } : null,
      }
    : null;

  const filtersApplied: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(params)) {
    if (val != null && key !== 'limit' && key !== 'offset') {
      filtersApplied[key] = val;
    }
  }

  return { results, totalCount, stats, filtersApplied };
}

export async function getRentComps(
  propertyId: string,
  radiusMiles: number = 3.0,
): Promise<{ comps: RentCompResult[]; subjectRent: number | null; avgCompRent: number | null; rentPremiumPct: number | null }> {
  const safeRadius = Math.min(Math.max(0.1, Number(radiusMiles) || 3), 50);

  const rentCompSQL = `
    WITH subject AS (
      SELECT id, lat AS latitude, lng AS longitude, units AS total_units,
             year_built, product_type, submarket_id
      FROM properties WHERE id = $1
    ),
    subject_rent AS (
      SELECT t12_avg_rent FROM v_comp_search WHERE property_id = $1
    ),
    nearby AS (
      SELECT
        cs.*,
        (3959 * ACOS(
          LEAST(1.0, GREATEST(-1.0,
            COS(RADIANS(s.latitude)) * COS(RADIANS(p.lat)) *
            COS(RADIANS(p.lng) - RADIANS(s.longitude)) +
            SIN(RADIANS(s.latitude)) * SIN(RADIANS(p.lat))
          ))
        )) AS distance_miles
      FROM v_comp_search cs
      JOIN properties p ON p.id = cs.property_id
      CROSS JOIN subject s
      WHERE cs.property_id != s.id
        AND cs.months_of_data >= 3
        AND p.lat IS NOT NULL
        AND s.latitude IS NOT NULL
    )
    SELECT
      n.*,
      n.distance_miles,
      sr.t12_avg_rent AS subject_rent,
      CASE WHEN sr.t12_avg_rent > 0 AND n.t12_avg_rent > 0
        THEN ((sr.t12_avg_rent - n.t12_avg_rent) / n.t12_avg_rent * 100)::numeric(5,2)
        ELSE NULL
      END AS rent_premium_pct
    FROM nearby n
    CROSS JOIN subject_rent sr
    WHERE n.distance_miles <= $2
    ORDER BY n.distance_miles ASC
    LIMIT 20
  `;

  const result = await query(rentCompSQL, [propertyId, safeRadius]);

  const comps: RentCompResult[] = result.rows.map((row: any) => ({
    ...mapRowToCompResult(row),
    distanceMiles: Number(row.distance_miles),
    rentPremiumPct: row.rent_premium_pct != null ? Number(row.rent_premium_pct) : null,
  }));

  const subjectRent = result.rows.length > 0 && result.rows[0].subject_rent != null
    ? Number(result.rows[0].subject_rent)
    : null;

  const compRents = comps.map((c) => c.t12AvgRent).filter(Boolean) as number[];
  const avgCompRent = compRents.length > 0
    ? Math.round(compRents.reduce((a, b) => a + b, 0) / compRents.length * 100) / 100
    : null;

  let rentPremiumPct: number | null = null;
  if (subjectRent && avgCompRent && avgCompRent > 0) {
    rentPremiumPct = Math.round((subjectRent - avgCompRent) / avgCompRent * 10000) / 100;
  }

  return { comps, subjectRent, avgCompRent, rentPremiumPct };
}

export async function getSubmarketStats(submarketId: string): Promise<CompStats | null> {
  const result = await searchComps({ submarketId, limit: 1 });
  return result.stats;
}

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
