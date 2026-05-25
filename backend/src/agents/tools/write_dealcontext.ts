/**
 * Tool: write_dealcontext
 *
 * Writes (upserts) a field into the DealContext assembly target for a given deal.
 *
 * EXCEPTION: This tool writes directly to the database via the deal-context service,
 * bypassing the platform API. Rationale (documented in CLAUDE.md):
 *   1. DealContext is the assembly target — there is no user-editable equivalent write path.
 *   2. Research assembly involves many rapid writes; direct-service avoids HTTP overhead.
 *   3. The dogfooding argument does not apply: no UI write path exists to mirror.
 *
 * Do NOT expand this exception to any other tool without explicit architectural review.
 *
 * Required capability: write:deal_context
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid('deal_id must be a valid UUID'),
  field_path: z.string().describe(
    'Dot-separated path within DealContext, e.g. "market.vacancy_rate" or "parcel.acres"'
  ),
  value: z.unknown().describe('The value to set at field_path'),
  source_label: z.string().default('agent:research').describe(
    'LayeredValueSource tag, e.g. "agent:research"'
  ),
  derived_from_search: z.boolean().optional().describe(
    'Set true when this value was sourced via web_search rather than structured data. ' +
    'Writes { derived_from_search: true } into the deal_context_fields.metadata column ' +
    'so the UI can surface a "sourced from web" indicator per the LayeredValue provenance spec.'
  ),
});

const OutputSchema = z.object({
  success: z.boolean(),
  deal_id: z.string(),
  field_path: z.string(),
  updated_at: z.string(),
  deal_id_mismatch: z.boolean().optional().describe(
    'True when input.deal_id differs from ctx.dealId — indicates the model wrote to a ' +
    'deal other than the one this run was started for. Logged as a warning.'
  ),
});

export const writeDealContextTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'write_dealcontext',
  description:
    'Write (upsert) a field into the DealContext assembly target for a deal. ' +
    'Use to persist research findings so downstream agents and the UI can read them. ' +
    'Provide a dot-separated field_path (e.g. "parcel.zoning_code") and the value.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:deal_context',

  execute: async (input, ctx) => {
    // Direct DB write — the one documented exception to the platformClient pattern.
    // See CLAUDE.md "write_dealcontext exception" for full rationale.
    //
    // Table deal_context_fields was created in migration 010 (agent_platform_foundation).
    // Schema: (deal_id, field_path) UNIQUE, value JSONB, source_label, agent_run_id.

    const now = new Date().toISOString();

    // Guardrail (finding P5-01): warn when the model supplies a deal_id that differs
    // from the runtime-injected ctx.dealId. Every other write tool uses ctx.dealId
    // exclusively; write_dealcontext intentionally accepts input.deal_id for flexibility,
    // but a mismatch almost always indicates a hallucinated or stale UUID.
    const dealIdMismatch =
      ctx.dealId !== undefined && input.deal_id !== ctx.dealId;

    if (dealIdMismatch) {
      logger.warn('write_dealcontext: deal_id mismatch — model supplied a different deal than the run context', {
        inputDealId: input.deal_id,
        ctxDealId: ctx.dealId,
        fieldPath: input.field_path,
        correlationId: ctx.correlationId,
      });
    }

    // Build field metadata. derived_from_search: true marks that this value was
    // sourced via web_search rather than structured data — fulfils the LayeredValue
    // metadata.derived_from_search provenance requirement in the agent spec.
    const fieldMetadata: Record<string, unknown> = {};
    if (input.derived_from_search) {
      fieldMetadata['derived_from_search'] = true;
    }

    await query(
      `INSERT INTO deal_context_fields
         (deal_id, field_path, value, source_label, agent_run_id, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (deal_id, field_path)
       DO UPDATE SET
         value        = EXCLUDED.value,
         source_label = EXCLUDED.source_label,
         agent_run_id = EXCLUDED.agent_run_id,
         metadata     = EXCLUDED.metadata,
         updated_at   = NOW()`,
      [
        input.deal_id,
        input.field_path,
        JSON.stringify(input.value),
        input.source_label,
        ctx.correlationId ?? null,
        JSON.stringify(fieldMetadata),
      ]
    );

    logger.debug('write_dealcontext: field written', {
      dealId: input.deal_id,
      fieldPath: input.field_path,
      source: input.source_label,
      metadata: fieldMetadata,
    });

    return {
      success: true,
      deal_id: input.deal_id,
      field_path: input.field_path,
      updated_at: now,
      ...(dealIdMismatch ? { deal_id_mismatch: true } : {}),
    };
  },
};
