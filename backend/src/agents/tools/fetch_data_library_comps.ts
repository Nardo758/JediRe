/**
 * fetch_data_library_comps
 *
 * Agent tool that pulls comparable financial data from the Data Library.
 * Used by CashFlow, Research, and Commentary agents to ground assumptions
 * in real deal data rather than market-level estimates.
 *
 * Returns: T12 benchmarks, rent comps, cap rate comps, expense ratios
 * from similar properties in the user's Data Library.
 */

import { getPool } from '../../database/connection';
import { dataLibraryService } from '../dataLibrary.service';
import { logger } from '../../utils/logger';

interface FetchDataLibraryCompsInput {
  city: string;
  propertyType?: string;
  units?: number;
  radiusMiles?: number;
  limit?: number;
}

interface DataLibraryComp {
  fileId: number | string;
  fileName: string;
  city: string;
  propertyType: string;
  unitCount?: number;
  yearBuilt?: number;
  sourceType: string;
  // Financial metrics
  askingPricePerUnit?: number;
  capRate?: number;
  grossPotentialRent?: number;
  vacancyRate?: number;
  operatingExpenseRatio?: number;
  noi?: number;
  managementFeePct?: number;
  propertyTaxPerUnit?: number;
  insurancePerUnit?: number;
  repairsPerUnit?: number;
  // Metadata
  dataFreshness: 'fresh' | 'stale' | 'unknown';
  confidence: number;
}

export const fetchDataLibraryCompsTool = {
  name: 'fetch_data_library_comps',
  description: 'Fetch comparable financial data from the Data Library — T12s, rent rolls, OMs, and sales comps for similar properties in the target market.',
  parameters: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'City to search for comps (e.g., "Atlanta")',
      },
      propertyType: {
        type: 'string',
        description: 'Property type filter (e.g., "multifamily", "garden", "mid-rise")',
      },
      units: {
        type: 'number',
        description: 'Target unit count — returns properties within 30% of this size',
      },
      limit: {
        type: 'number',
        description: 'Max number of comps to return (default: 10)',
      },
    },
    required: ['city'],
  },

  async execute(input: FetchDataLibraryCompsInput): Promise<{
    comps: DataLibraryComp[];
    summary: {
      count: number;
      avgRent?: number;
      avgVacancy?: number;
      avgExpenseRatio?: number;
      avgCapRate?: number;
      avgPricePerUnit?: number;
      rentRange?: { min: number; max: number };
      capRateRange?: { min: number; max: number };
    };
    dataQuality: 'high' | 'medium' | 'low';
    gaps: string[];
  }> {
    const pool = getPool();
    const limit = input.limit || 10;
    const gaps: string[] = [];

    try {
      // Find comparable files
      const files = await dataLibraryService.findComparables({
        city: input.city,
        propertyType: input.propertyType || 'multifamily',
        unitCount: input.units,
      });

      if (!files || files.length === 0) {
        return {
          comps: [],
          summary: { count: 0 },
          dataQuality: 'low',
          gaps: [`No Data Library files found for ${input.city} ${input.propertyType || 'multifamily'}`],
        };
      }

      const fileIds = files.slice(0, limit * 2).map(f => f.id).filter(Boolean);

      // Pull financial data from data_library_assets
      const assetsResult = await pool.query(`
        SELECT
          a.file_id,
          f.file_name,
          f.city,
          f.property_type,
          f.unit_count,
          f.year_built,
          f.source_type,
          f.created_at,
          a.asking_price_per_unit,
          a.cap_rate,
          a.gross_potential_rent,
          a.vacancy_rate,
          a.operating_expense_ratio,
          a.noi,
          a.management_fee_pct,
          a.property_tax_per_unit,
          a.insurance_per_unit,
          a.repairs_maintenance_per_unit
        FROM data_library_assets a
        JOIN data_library_files f ON f.id = a.file_id
        WHERE a.file_id = ANY($1)
          AND (
            a.gross_potential_rent IS NOT NULL OR
            a.cap_rate IS NOT NULL OR
            a.operating_expense_ratio IS NOT NULL OR
            a.asking_price_per_unit IS NOT NULL
          )
        ORDER BY f.created_at DESC
        LIMIT $2
      `, [fileIds, limit]);

      const now = new Date();
      const comps: DataLibraryComp[] = assetsResult.rows.map(row => {
        const ageMonths = (now.getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
        return {
          fileId: row.file_id,
          fileName: row.file_name,
          city: row.city,
          propertyType: row.property_type,
          unitCount: row.unit_count,
          yearBuilt: row.year_built,
          sourceType: row.source_type,
          askingPricePerUnit: row.asking_price_per_unit ? parseFloat(row.asking_price_per_unit) : undefined,
          capRate: row.cap_rate ? parseFloat(row.cap_rate) : undefined,
          grossPotentialRent: row.gross_potential_rent ? parseFloat(row.gross_potential_rent) : undefined,
          vacancyRate: row.vacancy_rate ? parseFloat(row.vacancy_rate) : undefined,
          operatingExpenseRatio: row.operating_expense_ratio ? parseFloat(row.operating_expense_ratio) : undefined,
          noi: row.noi ? parseFloat(row.noi) : undefined,
          managementFeePct: row.management_fee_pct ? parseFloat(row.management_fee_pct) : undefined,
          propertyTaxPerUnit: row.property_tax_per_unit ? parseFloat(row.property_tax_per_unit) : undefined,
          insurancePerUnit: row.insurance_per_unit ? parseFloat(row.insurance_per_unit) : undefined,
          repairsPerUnit: row.repairs_maintenance_per_unit ? parseFloat(row.repairs_maintenance_per_unit) : undefined,
          dataFreshness: ageMonths < 6 ? 'fresh' : ageMonths < 18 ? 'stale' : 'unknown',
          confidence: ageMonths < 6 ? 0.90 : ageMonths < 18 ? 0.70 : 0.50,
        };
      });

      // Build summary stats
      const rents = comps.map(c => c.grossPotentialRent).filter(v => v && v > 0) as number[];
      const vacancies = comps.map(c => c.vacancyRate).filter(v => v !== undefined) as number[];
      const expenses = comps.map(c => c.operatingExpenseRatio).filter(v => v && v > 0) as number[];
      const capRates = comps.map(c => c.capRate).filter(v => v && v > 0) as number[];
      const prices = comps.map(c => c.askingPricePerUnit).filter(v => v && v > 0) as number[];

      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100 : undefined;

      const summary = {
        count: comps.length,
        avgRent: avg(rents),
        avgVacancy: avg(vacancies),
        avgExpenseRatio: avg(expenses),
        avgCapRate: avg(capRates),
        avgPricePerUnit: avg(prices),
        rentRange: rents.length > 0 ? { min: Math.min(...rents), max: Math.max(...rents) } : undefined,
        capRateRange: capRates.length > 0 ? { min: Math.min(...capRates), max: Math.max(...capRates) } : undefined,
      };

      // Identify gaps
      if (!summary.avgRent) gaps.push('No rent data in comps — upload rent rolls');
      if (!summary.avgVacancy) gaps.push('No vacancy data — upload T12 statements');
      if (!summary.avgExpenseRatio) gaps.push('No expense data — upload T12 statements');
      if (!summary.avgCapRate) gaps.push('No cap rate data — upload sales comps');

      const dataQuality: 'high' | 'medium' | 'low' =
        comps.length >= 5 && gaps.length <= 1 ? 'high' :
        comps.length >= 2 && gaps.length <= 2 ? 'medium' : 'low';

      logger.info('[fetch_data_library_comps] Complete', {
        city: input.city,
        compsFound: comps.length,
        dataQuality,
        gapsCount: gaps.length,
      });

      return { comps, summary, dataQuality, gaps };

    } catch (err) {
      logger.error('[fetch_data_library_comps] Error', { err, input });
      return {
        comps: [],
        summary: { count: 0 },
        dataQuality: 'low',
        gaps: ['Data Library query failed — check database connection'],
      };
    }
  },
};

export default fetchDataLibraryCompsTool;
