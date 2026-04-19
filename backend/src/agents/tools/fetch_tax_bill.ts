/**
 * Tool: fetch_tax_bill
 *
 * Fetches the tax projection for a deal via GET /deals/:dealId/tax/summary.
 *
 * Actual endpoint response shape:
 *   { success: true, data: {
 *       hasProjection: boolean,
 *       projected_total_tax?: number,      ← annual tax amount (projected)
 *       current_annual_tax?: number,       ← baseline annual tax
 *       projected_tax_per_unit?: number,
 *       effective_tax_rate?: number,       ← 0–1 fraction
 *       delta_amount?: number,
 *       delta_pct?: number
 *   }}
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
  projected_tax_amount: z.number().nullable(),
  effective_tax_rate: z.number().nullable(),
  delta_amount: z.number().nullable(),
  delta_pct: z.number().nullable(),
  source: z.string(),
  fetched_at: z.string(),
});

type TaxSummaryResponse = {
  success: boolean;
  data?: {
    hasProjection?: boolean;
    projected_total_tax?: number | null;
    current_annual_tax?: number | null;
    effective_tax_rate?: number | null;
    delta_amount?: number | null;
    delta_pct?: number | null;
  };
};

export const fetchTaxBillTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_tax_bill',
  description:
    'Fetch the property tax projection and baseline for a deal. ' +
    'Returns projected annual tax, effective rate, and delta vs current from county records.',
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
      const resp = await client.get<TaxSummaryResponse>(`/deals/${input.deal_id}/tax/summary`);

      if (!resp.success || !resp.data?.hasProjection) {
        logger.debug('fetch_tax_bill: no projection available', { dealId: input.deal_id });
        return {
          deal_id: input.deal_id,
          annual_tax_amount: null,
          projected_tax_amount: null,
          effective_tax_rate: null,
          delta_amount: null,
          delta_pct: null,
          source: 'no_projection',
          fetched_at: now,
        };
      }

      const d = resp.data;

      logger.debug('fetch_tax_bill: fetched tax summary', {
        dealId: input.deal_id,
        projectedTax: d.projected_total_tax,
        effectiveRate: d.effective_tax_rate,
      });

      return {
        deal_id: input.deal_id,
        annual_tax_amount: d.current_annual_tax ?? null,
        projected_tax_amount: d.projected_total_tax ?? null,
        effective_tax_rate: d.effective_tax_rate ?? null,
        delta_amount: d.delta_amount ?? null,
        delta_pct: d.delta_pct ?? null,
        source: 'tax_projection_service',
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
        projected_tax_amount: null,
        effective_tax_rate: null,
        delta_amount: null,
        delta_pct: null,
        source: 'unavailable',
        fetched_at: now,
      };
    }
  },
};
