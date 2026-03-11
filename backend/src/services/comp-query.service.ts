import { query } from '../database/connection';
import { logger } from '../utils/logger';

export interface CompSearchParams {
  propertyType?: string;
  productType?: string;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  minUnits?: number;
  maxUnits?: number;
  latitude?: number;
  longitude?: number;
  maxDistanceMiles?: number;
  submarketId?: string;
  msaId?: number;
  state?: string;
  city?: string;
  excludePropertyId?: string;
  limit?: number;
}

export interface CompResult {
  property_id: string;
  name: string;
  city: string;
  state: string;
  property_type: string;
  product_type: string;
  total_units: number;
  year_built: number;
  latitude: number;
  longitude: number;
  submarket_name: string;
  msa_name: string;
  t12_avg_rent: number;
  t12_avg_occupancy: number;
  t12_avg_monthly_noi: number;
  t12_total_noi: number;
  t12_avg_opex_ratio: number;
  t12_avg_noi_per_unit: number;
  latest_month: string;
  months_of_data: number;
  distance_miles: number | null;
  comp_score: number;
}

function safeNum(val: any): number {
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error('Invalid numeric parameter');
  return n;
}

class CompQueryService {
  async searchComps(params: CompSearchParams): Promise<CompResult[]> {
    const conditions: string[] = [];
    const queryParams: any[] = [];
    let paramIdx = 1;
    const hasGeo = params.latitude !== undefined && params.longitude !== undefined;

    let latParam = 0, lngParam = 0, maxDistParam = 25;
    if (hasGeo) {
      latParam = safeNum(params.latitude);
      lngParam = safeNum(params.longitude);
      maxDistParam = safeNum(params.maxDistanceMiles || 25);
    }
    const safeLimit = Math.min(Math.max(1, Math.round(safeNum(params.limit || 25))), 100);

    if (params.excludePropertyId) {
      conditions.push(`property_id != $${paramIdx}`);
      queryParams.push(params.excludePropertyId);
      paramIdx++;
    }

    if (params.propertyType) {
      conditions.push(`property_type = $${paramIdx}`);
      queryParams.push(params.propertyType);
      paramIdx++;
    }

    if (params.productType) {
      conditions.push(`product_type = $${paramIdx}`);
      queryParams.push(params.productType);
      paramIdx++;
    }

    if (params.state) {
      conditions.push(`state = $${paramIdx}`);
      queryParams.push(params.state);
      paramIdx++;
    }

    if (params.city) {
      conditions.push(`LOWER(city) = LOWER($${paramIdx})`);
      queryParams.push(params.city);
      paramIdx++;
    }

    if (params.yearBuiltMin) {
      conditions.push(`year_built::integer >= $${paramIdx}`);
      queryParams.push(safeNum(params.yearBuiltMin));
      paramIdx++;
    }

    if (params.yearBuiltMax) {
      conditions.push(`year_built::integer <= $${paramIdx}`);
      queryParams.push(safeNum(params.yearBuiltMax));
      paramIdx++;
    }

    if (params.minUnits) {
      conditions.push(`total_units >= $${paramIdx}`);
      queryParams.push(safeNum(params.minUnits));
      paramIdx++;
    }

    if (params.maxUnits) {
      conditions.push(`total_units <= $${paramIdx}`);
      queryParams.push(safeNum(params.maxUnits));
      paramIdx++;
    }

    const latIdx = paramIdx;
    const lngIdx = paramIdx + 1;
    const maxDistIdx = paramIdx + 2;
    queryParams.push(latParam, lngParam, maxDistParam);
    paramIdx += 3;

    const distExpr = hasGeo
      ? `(3959 * acos(LEAST(1.0, GREATEST(-1.0,
          cos(radians($${latIdx})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($${lngIdx})) +
          sin(radians($${latIdx})) * sin(radians(latitude))
        ))))`
      : 'NULL';

    if (hasGeo) {
      conditions.push(`latitude IS NOT NULL AND longitude IS NOT NULL`);
      conditions.push(`${distExpr} <= $${maxDistIdx}`);
    }

    const propTypeScoreIdx = paramIdx;
    queryParams.push(params.propertyType || '');
    paramIdx++;

    const targetYear = (params.yearBuiltMin || params.yearBuiltMax)
      ? Math.round(((params.yearBuiltMin || params.yearBuiltMax!) + (params.yearBuiltMax || params.yearBuiltMin!)) / 2)
      : 2000;
    const targetYearIdx = paramIdx;
    queryParams.push(targetYear);
    paramIdx++;

    const targetUnits = (params.minUnits || params.maxUnits)
      ? Math.round(((params.minUnits || params.maxUnits!) + (params.maxUnits || params.minUnits!)) / 2)
      : 100;
    const targetUnitsIdx = paramIdx;
    queryParams.push(Math.max(targetUnits, 1));
    paramIdx++;

    const limitIdx = paramIdx;
    queryParams.push(safeLimit);
    paramIdx++;

    const typeScoreExpr = params.propertyType
      ? `CASE WHEN property_type = $${propTypeScoreIdx} THEN 40 ELSE 0 END`
      : '20';

    const geoScoreExpr = hasGeo
      ? `GREATEST(0, 25 - (${distExpr} / GREATEST($${maxDistIdx}, 0.01)) * 25)`
      : '12';

    const vintageScoreExpr = (params.yearBuiltMin || params.yearBuiltMax)
      ? `GREATEST(0, 15 - ABS(COALESCE(year_built, 2000) - $${targetYearIdx}) * 0.5)`
      : '7';

    const scaleScoreExpr = (params.minUnits || params.maxUnits)
      ? `GREATEST(0, 10 - ABS(COALESCE(total_units, 0) - $${targetUnitsIdx})::NUMERIC / $${targetUnitsIdx} * 10)`
      : '5';

    const scoreExpr = `${typeScoreExpr} + ${geoScoreExpr} + ${vintageScoreExpr} + ${scaleScoreExpr} + LEAST(10, months_of_data)`;
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT *,
        ${distExpr} AS distance_miles,
        (${scoreExpr}) AS comp_score
      FROM v_comp_search
      ${whereClause}
      ORDER BY comp_score DESC
      LIMIT $${limitIdx}
    `;

    const result = await query(sql, queryParams);
    return result.rows;
  }

  async findCompsForProperty(propertyId: string): Promise<CompResult[]> {
    const propResult = await query(
      `SELECT id, property_type, product_type, year_built, lat AS latitude, lng AS longitude,
              units AS total_units, city, state_code AS state, submarket_id, msa_id
       FROM properties WHERE id = $1`,
      [propertyId]
    );

    if (propResult.rows.length === 0) {
      throw new Error(`Property ${propertyId} not found`);
    }

    const prop = propResult.rows[0];
    const yearBuilt = prop.year_built ? parseInt(prop.year_built) : null;
    const totalUnits = prop.total_units ? parseInt(prop.total_units) : null;

    return this.searchComps({
      propertyType: prop.property_type || undefined,
      productType: prop.product_type || undefined,
      yearBuiltMin: yearBuilt ? yearBuilt - 10 : undefined,
      yearBuiltMax: yearBuilt ? yearBuilt + 10 : undefined,
      minUnits: totalUnits ? Math.round(totalUnits * 0.5) : undefined,
      maxUnits: totalUnits ? Math.round(totalUnits * 2.0) : undefined,
      latitude: prop.latitude ? parseFloat(prop.latitude) : undefined,
      longitude: prop.longitude ? parseFloat(prop.longitude) : undefined,
      maxDistanceMiles: 25,
      excludePropertyId: propertyId,
      limit: 25,
    });
  }

  async getCompSummary(): Promise<{
    totalProperties: number;
    totalMonths: number;
    avgMonthsPerProperty: number;
    propertyTypes: Record<string, number>;
  }> {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT property_id) AS total_properties,
        SUM(months_of_data) AS total_months,
        AVG(months_of_data) AS avg_months,
        property_type,
        COUNT(*) AS type_count
      FROM v_comp_search
      GROUP BY property_type
    `);

    const propertyTypes: Record<string, number> = {};
    let totalProperties = 0;
    let totalMonths = 0;
    let avgMonths = 0;

    for (const row of result.rows) {
      if (row.property_type) propertyTypes[row.property_type] = parseInt(row.type_count);
      totalProperties += parseInt(row.total_properties || '0');
      totalMonths += parseInt(row.total_months || '0');
      avgMonths = parseFloat(row.avg_months || '0');
    }

    return {
      totalProperties,
      totalMonths,
      avgMonthsPerProperty: Math.round(avgMonths * 10) / 10,
      propertyTypes,
    };
  }
}

export const compQueryService = new CompQueryService();
