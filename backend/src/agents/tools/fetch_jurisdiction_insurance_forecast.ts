/**
 * Tool: fetch_jurisdiction_insurance_forecast
 *
 * Thin wrapper over insuranceService.forecast() from task #240.
 * Returns insurance benchmark for the deal's jurisdiction with FL/TX/GA rulesets.
 *
 * Tier 3 evidence source — market-rate benchmark.
 * Requires capability: read:all
 */

import { z } from 'zod';
import { insuranceService } from '../../services/insurance/insuranceService';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid(),
  units: z.number().int().positive(),
  year_built: z.number().int().nullable().optional(),
  purchase_price: z.number().positive().nullable().optional(),
  replacement_cost_per_unit: z.number().positive().nullable().optional(),
  stories: z.number().int().positive().nullable().optional(),
  construction_type: z.enum(['wood-frame', 'masonry', 'concrete', 'steel']).nullable().optional(),
  is_coastal: z.boolean().nullable().optional(),
  flood_zone: z.string().nullable().optional(),
  t12_insurance_annual: z.number().nonnegative().nullable().optional()
    .describe('Annual insurance cost from T-12 operating statement'),
});

const InsuranceCoverageSchema = z.object({
  name: z.string(),
  description: z.string(),
  estimated_annual_cost_per_unit: z.number(),
  required: z.boolean(),
  notes: z.string().nullable(),
});

const OutputSchema = z.object({
  jurisdiction: z.string(),
  ruleset_used: z.string(),
  benchmark_per_unit: z.number(),
  benchmark_annual_total: z.number(),
  components: z.array(InsuranceCoverageSchema),
  escalation: z.object({
    base_rate: z.number(),
    rationale: z.string(),
    recent_trend: z.string(),
  }),
  t12_per_unit: z.number().nullable(),
  t12_vs_benchmark_pct: z.number().nullable(),
  flag_low: z.boolean(),
  flag_high: z.boolean(),
  flag_notes: z.array(z.string()),
});

export const fetchJurisdictionInsuranceForecastTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_jurisdiction_insurance_forecast',
  description:
    'Returns jurisdiction-specific insurance benchmark (FL, TX, GA) for a multifamily asset. ' +
    'Flags underinsurance (T-12 < 75% of benchmark) and overinsurance (> 150%). ' +
    'Use as Tier 3 evidence for insurance assumption.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (input, ctx) => {
    const dealResult = await query(
      `SELECT d.state_code, d.city,
              dc.value->>'county' AS county
       FROM deals d
       LEFT JOIN deal_context_fields dc
         ON dc.deal_id = d.id AND dc.field_path = 'parcel.county'
       WHERE d.id = $1
       LIMIT 1`,
      [input.deal_id]
    );

    const deal = dealResult.rows[0] ?? {};
    const state = String(deal.state_code ?? '').toUpperCase();
    const county = (deal.county as string) ?? null;
    const city = (deal.city as string) ?? null;

    const forecast = insuranceService.forecast({
      state,
      county,
      city,
      units: input.units,
      yearBuilt: input.year_built ?? null,
      purchasePrice: input.purchase_price ?? null,
      replacementCostPerUnit: input.replacement_cost_per_unit ?? null,
      stories: input.stories ?? null,
      constructionType: (input.construction_type as 'wood-frame' | 'masonry' | 'concrete' | 'steel' | null) ?? null,
      isCoastal: input.is_coastal ?? null,
      floodZone: input.flood_zone ?? null,
      t12InsuranceAnnual: input.t12_insurance_annual ?? null,
    });

    logger.debug('fetch_jurisdiction_insurance_forecast', {
      runId: ctx.dealId,
      dealId: ctx.dealId,
      state,
      flagLow: forecast.flagLow,
      flagHigh: forecast.flagHigh,
    });

    return {
      jurisdiction: forecast.jurisdiction,
      ruleset_used: forecast.rulesetUsed,
      benchmark_per_unit: forecast.benchmarkPerUnit,
      benchmark_annual_total: forecast.benchmarkAnnualTotal,
      components: forecast.components.map(c => ({
        name: c.name,
        description: c.description,
        estimated_annual_cost_per_unit: c.estimatedAnnualCostPerUnit,
        required: c.required,
        notes: c.notes,
      })),
      escalation: {
        base_rate: forecast.escalation.baseRate,
        rationale: forecast.escalation.rationale,
        recent_trend: forecast.escalation.recentTrend,
      },
      t12_per_unit: forecast.t12PerUnit,
      t12_vs_benchmark_pct: forecast.t12VsBenchmarkPct,
      flag_low: forecast.flagLow,
      flag_high: forecast.flagHigh,
      flag_notes: forecast.flagNotes ?? [],
    };
  },
};
