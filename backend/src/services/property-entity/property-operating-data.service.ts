/**
 * PropertyOperatingDataService
 * Phase 1 — Property Plumbing Refactor
 *
 * Manages period-specific operating metrics per property.
 * No production reads yet — Phase 2 dual-write wires this in.
 */

import { query } from '../../database/connection';
import type {
  PropertyOperatingData,
  CreatePropertyOperatingDataInput,
  OperatingPeriodType,
} from './types';

function mapRow(row: Record<string, unknown>): PropertyOperatingData {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    periodType: row.period_type as OperatingPeriodType,
    periodEnd: row.period_end as string,
    periodStart: (row.period_start as string) ?? null,
    avgRentPerUnit: row.avg_rent_per_unit != null ? parseFloat(row.avg_rent_per_unit as string) : null,
    askingRentPerUnit: row.asking_rent_per_unit != null ? parseFloat(row.asking_rent_per_unit as string) : null,
    effectiveRentPerUnit: row.effective_rent_per_unit != null ? parseFloat(row.effective_rent_per_unit as string) : null,
    occupancy: row.occupancy != null ? parseFloat(row.occupancy as string) : null,
    concessions: row.concessions != null ? parseFloat(row.concessions as string) : null,
    grossPotentialRent: row.gross_potential_rent != null ? parseFloat(row.gross_potential_rent as string) : null,
    effectiveGrossRevenue: row.effective_gross_revenue != null ? parseFloat(row.effective_gross_revenue as string) : null,
    totalOpex: row.total_opex != null ? parseFloat(row.total_opex as string) : null,
    noi: row.noi != null ? parseFloat(row.noi as string) : null,
    opexByLine: (row.opex_by_line as Record<string, number>) ?? null,
    source: row.source as PropertyOperatingData['source'],
    sourceDate: (row.source_date as string) ?? null,
    confidence: row.confidence != null ? parseFloat(row.confidence as string) : null,
    isOwned: Boolean(row.is_owned),
    operatorId: (row.operator_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class PropertyOperatingDataService {
  /**
   * Get the most recent TTM operating data for a property.
   */
  async getLatestTtm(propertyId: string): Promise<PropertyOperatingData | null> {
    const result = await query(
      `SELECT * FROM property_operating_data
       WHERE property_id = $1 AND period_type = 'ttm'
       ORDER BY period_end DESC
       LIMIT 1`,
      [propertyId]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  /**
   * Get all operating data for a property, newest period first.
   */
  async getAll(
    propertyId: string,
    opts: { periodType?: OperatingPeriodType; isOwned?: boolean } = {}
  ): Promise<PropertyOperatingData[]> {
    const conditions = ['property_id = $1'];
    const params: unknown[] = [propertyId];
    let idx = 2;

    if (opts.periodType) {
      conditions.push(`period_type = $${idx++}`);
      params.push(opts.periodType);
    }
    if (opts.isOwned !== undefined) {
      conditions.push(`is_owned = $${idx++}`);
      params.push(opts.isOwned);
    }

    const result = await query(
      `SELECT * FROM property_operating_data
       WHERE ${conditions.join(' AND ')}
       ORDER BY period_end DESC`,
      params
    );
    return result.rows.map(mapRow);
  }

  /**
   * Create a new operating data record.
   */
  async create(input: CreatePropertyOperatingDataInput): Promise<PropertyOperatingData> {
    const result = await query(
      `INSERT INTO property_operating_data (
        property_id, period_type, period_end, period_start,
        avg_rent_per_unit, asking_rent_per_unit, effective_rent_per_unit,
        occupancy, concessions, gross_potential_rent, effective_gross_revenue,
        total_opex, noi, opex_by_line,
        source, source_date, confidence, is_owned, operator_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        input.propertyId,
        input.periodType,
        input.periodEnd,
        input.periodStart ?? null,
        input.avgRentPerUnit ?? null,
        input.askingRentPerUnit ?? null,
        input.effectiveRentPerUnit ?? null,
        input.occupancy ?? null,
        input.concessions ?? null,
        input.grossPotentialRent ?? null,
        input.effectiveGrossRevenue ?? null,
        input.totalOpex ?? null,
        input.noi ?? null,
        input.opexByLine ? JSON.stringify(input.opexByLine) : null,
        input.source,
        input.sourceDate ?? null,
        input.confidence ?? null,
        input.isOwned ?? false,
        input.operatorId ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  }

  /**
   * Get NOI at or near a sale date — used to compute implied cap rates.
   * Returns the closest TTM record within 12 months of the sale date.
   */
  async getNearSaleDate(
    propertyId: string,
    saleDate: string
  ): Promise<PropertyOperatingData | null> {
    const result = await query(
      `SELECT * FROM property_operating_data
       WHERE property_id = $1
         AND period_type = 'ttm'
         AND ABS(period_end - $2::date) <= 365
       ORDER BY ABS(period_end - $2::date)
       LIMIT 1`,
      [propertyId, saleDate]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }
}

export const propertyOperatingDataService = new PropertyOperatingDataService();
