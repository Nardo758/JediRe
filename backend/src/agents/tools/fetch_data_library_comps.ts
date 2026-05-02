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

import { z } from 'zod';
import { getPool } from '../../database/connection';
import { dataLibraryService } from '../../services/dataLibrary.service';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  city: z.string().describe('City to search for comps (e.g., "Atlanta")'),
  propertyType: z.string().optional().describe('Property type filter (e.g., "multifamily", "garden", "mid-rise")'),
  units: z.number().optional().describe('Target unit count — returns properties within 30% of this size'),
  radiusMiles: z.number().optional().describe('Search radius in miles (currently unused — reserved for future spatial filter)'),
  limit: z.number().optional().describe('Max number of comps to return (default: 10)'),
});

const DataLibraryCompSchema = z.object({
  fileId: z.union([z.number(), z.string()]),
  fileName: z.string(),
  city: z.string(),
  propertyType: z.string(),
  unitCount: z.number().optional(),
  yearBuilt: z.number().optional(),
  sourceType: z.string(),
  askingPricePerUnit: z.number().optional(),
  capRate: z.number().optional(),
  grossPotentialRent: z.number().optional(),
  vacancyRate: z.number().optional(),
  operatingExpenseRatio: z.number().optional(),
  noi: z.number().optional(),
  managementFeePct: z.number().optional(),
  propertyTaxPerUnit: z.number().optional(),
  insurancePerUnit: z.number().optional(),
  repairsPerUnit: z.number().optional(),
  dataFreshness: z.enum(['fresh', 'stale', 'unknown']),
  confidence: z.number(),
});

const OutputSchema = z.object({
  comps: z.array(DataLibraryCompSchema),
  summary: z.object({
    count: z.number(),
    avgRent: z.number().optional(),
    avgVacancy: z.number().optional(),
    avgExpenseRatio: z.number().optional(),
    avgCapRate: z.number().optional(),
    avgPricePerUnit: z.number().optional(),
    rentRange: z.object({ min: z.number(), max: z.number() }).optional(),
    capRateRange: z.object({ min: z.number(), max: z.number() }).optional(),
  }),
  dataQuality: z.enum(['high', 'medium', 'low']),
  gaps: z.array(z.string()),
});

type FetchDataLibraryCompsInput = z.infer<typeof InputSchema>;
type FetchDataLibraryCompsOutput = z.infer<typeof OutputSchema>;
type DataLibraryComp = z.infer<typeof DataLibraryCompSchema>;

export const fetchDataLibraryCompsTool: ToolDefinition<
  FetchDataLibraryCompsInput,
  FetchDataLibraryCompsOutput
> = {
  name: 'fetch_data_library_comps',
  description:
    'Fetch comparable financial data from the Data Library — T12s, rent rolls, OMs, and sales comps for similar properties in the target market.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  execute: async (input) => {
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
          a.created_at,
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
        ORDER BY a.created_at DESC
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
      const rents = comps.map(c => c.grossPotentialRent).filter((v): v is number => v !== undefined && v > 0);
      const vacancies = comps.map(c => c.vacancyRate).filter((v): v is number => v !== undefined);
      const expenses = comps.map(c => c.operatingExpenseRatio).filter((v): v is number => v !== undefined && v > 0);
      const capRates = comps.map(c => c.capRate).filter((v): v is number => v !== undefined && v > 0);
      const prices = comps.map(c => c.askingPricePerUnit).filter((v): v is number => v !== undefined && v > 0);

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
