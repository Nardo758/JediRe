/**
 * Tool: fetch_tax_bill
 *
 * Fetches the tax projection and summary for a given deal from the M26 tax service.
 * Routes through GET /deals/:dealId/tax/summary via the platform API.
 *
 * Required capability: read:financials
 */

import { z } from 'zod';
import { platformClient } from '../../lib/platform-client';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid('deal_id must be a valid UUID'),
});

const OutputSchema = z.object({
  deal_id: z.string(),
  annual_tax_amount: z.number().nullable(),
  effective_tax_rate: z.number().nullable(),
  assessed_value: z.number().nullable(),
  tax_year: z.number().nullable(),
  source: z.string(),
  fetched_at: z.string(),
});

export const fetchTaxBillTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_tax_bill',
  description:
    'Fetch the property tax projection and summary for a deal. ' +
    'Returns annual tax amount, effective rate, and assessed value from county records.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:financials',

  execute: async (input, ctx) => {
    const client = platformClient.as({
      agentId: ctx.agentId ?? 'research',
      runId: ctx.correlationId,
    });

    const now = new Date().toISOString();

    try {
      const data = await client.get<{
        annualTaxAmount?: number | null;
        effectiveTaxRate?: number | null;
        assessedValue?: number | null;
        taxYear?: number | null;
        source?: string;
      }>(`/deals/${input.deal_id}/tax/summary`);

      logger.debug('fetch_tax_bill: fetched tax summary', {
        dealId: input.deal_id,
        annualTax: data?.annualTaxAmount,
      });

      return {
        deal_id: input.deal_id,
        annual_tax_amount: data?.annualTaxAmount ?? null,
        effective_tax_rate: data?.effectiveTaxRate ?? null,
        assessed_value: data?.assessedValue ?? null,
        tax_year: data?.taxYear ?? null,
        source: data?.source ?? 'county_records',
        fetched_at: now,
      };
    } catch (err) {
      logger.warn('fetch_tax_bill: request failed', {
        dealId: input.deal_id,
        err: err instanceof Error ? err.message : String(err),
      });

      return {
        deal_id: input.deal_id,
        annual_tax_amount: null,
        effective_tax_rate: null,
        assessed_value: null,
        tax_year: null,
        source: 'unavailable',
        fetched_at: now,
      };
    }
  },
};
