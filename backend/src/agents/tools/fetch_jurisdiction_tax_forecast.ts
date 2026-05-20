/**
 * Tool: fetch_jurisdiction_tax_forecast
 *
 * Thin wrapper over taxService.forecast() from task #240.
 * Returns post-acquisition tax reassessment schedule for the deal.
 *
 * Tier 3 evidence source — jurisdiction ruleset (FL, TX, GA, default).
 * Requires capability: read:all
 */

import { z } from 'zod';
import { taxService } from '../../services/tax/taxService';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid(),
  purchase_price: z.number().positive().nullable().optional(),
  loan_amount: z.number().nonnegative().nullable().optional(),
  units: z.number().int().positive().default(1),
  hold_years: z.number().int().min(1).max(36).default(10),
  t12_annual_tax: z.number().nonnegative().nullable().optional()
    .describe('Annual property tax from T-12 operating statement'),
  assessed_value_override: z.number().positive().nullable().optional(),
  millage_rate_override: z.number().positive().nullable().optional(),
  is_refi: z.boolean().default(false),
});

const ReTaxYearSchema = z.object({
  year: z.number().int(),
  assessed_value: z.number(),
  millage_rate: z.number(),
  tax_amount: z.number(),
  soh_cap_binding: z.boolean(),
  reassessment_event: z.boolean(),
});

const OutputSchema = z.object({
  jurisdiction: z.string(),
  ruleset_used: z.string(),
  re_tax: z.object({
    t12_assessed_value: z.number().nullable(),
    t12_millage_rate: z.number().nullable(),
    t12_annual_tax: z.number().nullable(),
    platform_assessed_value: z.number().nullable(),
    platform_annual_tax: z.number().nullable(),
    soh_cap_pct: z.number(),
    per_year: z.array(ReTaxYearSchema),
    delta_vs_t12_pct: z.number().nullable(),
  }),
  transfer_tax: z.object({
    total: z.number().nullable(),
  }),
  flag_notes: z.array(z.string()),
});

export const fetchJurisdictionTaxForecastTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_jurisdiction_tax_forecast',
  description:
    'Returns a post-acquisition property tax forecast using jurisdiction-specific rulesets (FL, TX, GA). ' +
    'Accounts for reassessment on acquisition, SOH/homestead cap rules, and annual escalation. ' +
    'Use as Tier 3 evidence for tax assumption — always cross-check against T-12.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (input, ctx) => {
    // Fetch deal state/county from DB
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

    const forecast = taxService.forecast({
      state,
      county,
      city,
      purchasePrice: input.purchase_price ?? null,
      loanAmount: input.loan_amount ?? null,
      assessedValueOverride: input.assessed_value_override ?? null,
      millageRateOverride: input.millage_rate_override ?? null,
      countyOverride: null,
      units: input.units,
      t12AnnualTax: input.t12_annual_tax ?? null,
      holdYears: input.hold_years,
      isRefi: input.is_refi,
      refiEnabled: false,
      refiTriggerYear: 5,
      refiNewLoanType: null,
    });

    logger.debug('fetch_jurisdiction_tax_forecast', {
      runId: ctx.dealId,
      dealId: ctx.dealId,
      state,
      jurisdiction: forecast.jurisdiction,
    });

    return {
      jurisdiction: forecast.jurisdiction,
      ruleset_used: forecast.rulesetUsed,
      re_tax: {
        t12_assessed_value: forecast.reTax.t12AssessedValue,
        t12_millage_rate: forecast.reTax.t12MillageRate,
        t12_annual_tax: forecast.reTax.t12AnnualTax,
        platform_assessed_value: forecast.reTax.platformAssessedValue,
        platform_annual_tax: forecast.reTax.platformAnnualTax,
        soh_cap_pct: forecast.reTax.sohCapPct,
        per_year: forecast.reTax.perYear.slice(0, input.hold_years).map(y => ({
          year: y.year,
          assessed_value: y.assessedValue,
          millage_rate: y.millageRate,
          tax_amount: y.taxAmount,
          soh_cap_binding: y.sohCapBinding,
          reassessment_event: y.reassessmentEvent,
        })),
        delta_vs_t12_pct: forecast.reTax.deltaVsT12Pct,
      },
      transfer_tax: {
        total: forecast.transferTax.totalTransferTax,
      },
      flag_notes: [
        ...forecast.specialTaxes.map(t => `${t.name}: ${t.description}`),
        ...(forecast.reTax.deltaVsT12Pct != null && Math.abs(forecast.reTax.deltaVsT12Pct) > 0.1
          ? [`Post-acquisition tax delta vs T-12: ${(forecast.reTax.deltaVsT12Pct * 100).toFixed(1)}%`]
          : []),
      ],
    };
  },
};
