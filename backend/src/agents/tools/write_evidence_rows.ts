/**
 * Tool: write_evidence_rows
 *
 * Persists a batch of evidence rows to underwriting_evidence.
 * Call multiple times (max 15 rows per call) to avoid DeepSeek output-token
 * truncation. The companion tool write_underwriting handles the proforma snapshot.
 *
 * Requires capability: write:deal_context
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const EvidencePointInputSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  source: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  weight: z.number().min(0).max(1),
  notes: z.string().optional(),
});

const AlternativeInputSchema = z.object({
  source: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  delta_pct: z.number().nullable().optional(),
  reason_rejected: z.string(),
});

const CollisionInputSchema = z.object({
  field_path: z.string(),
  agent_value: z.union([z.number(), z.string(), z.null()]),
  broker_value: z.union([z.number(), z.string(), z.null()]),
  delta_pct: z.number().nullable(),
  magnitude: z.enum(['minor', 'material', 'severe']),
  direction: z.enum(['agent_higher', 'agent_lower', 'equal']),
  narrative: z.string(),
}).nullable().optional();

const EvidenceRowInputSchema = z.object({
  field_path: z.string(),
  value_numeric: z.number().nullable().optional(),
  value_text: z.string().nullable().optional(),
  primary_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  data_points: z.array(EvidencePointInputSchema).default([]),
  reasoning: z.string().default(''),
  alternatives: z.array(AlternativeInputSchema).default([]),
  collision: CollisionInputSchema,
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
});

const InputSchema = z.object({
  deal_id: z.string().uuid(),
  evidence_rows: z.array(EvidenceRowInputSchema).min(1).max(15)
    .describe('Up to 15 evidence rows per call. Call again if you have more than 15 fields.'),
});

const OutputSchema = z.object({
  success: z.boolean(),
  evidence_ids: z.array(z.string()),
  written_at: z.string(),
});

export const writeEvidenceRowsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'write_evidence_rows',
  description:
    'Persist a batch of evidence rows (max 15) to underwriting_evidence. ' +
    'Call once per batch — up to 2 calls total for a typical run. ' +
    'After all evidence is written, call write_underwriting once with the proforma snapshot.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:deal_context',

  execute: async (input, ctx) => {
    const evidenceIds: string[] = [];

    for (const row of input.evidence_rows) {
      const result = await query(
        `INSERT INTO underwriting_evidence
           (deal_id, agent_run_id, field_path, value_numeric, value_text,
            primary_tier, data_points, reasoning, alternatives, collision, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          input.deal_id,
          ctx.correlationId ?? null,
          row.field_path,
          row.value_numeric ?? null,
          row.value_text ?? null,
          row.primary_tier,
          JSON.stringify(row.data_points),
          row.reasoning,
          JSON.stringify(row.alternatives),
          row.collision ? JSON.stringify(row.collision) : null,
          row.confidence,
        ]
      );
      evidenceIds.push(result.rows[0]?.id as string ?? '');
    }

    logger.info('write_evidence_rows', {
      runId: ctx.correlationId,
      dealId: input.deal_id,
      batchSize: evidenceIds.length,
    });

    return {
      success: true,
      evidence_ids: evidenceIds,
      written_at: new Date().toISOString(),
    };
  },
};
