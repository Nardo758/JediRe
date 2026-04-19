/**
 * Tool: write_underwriting
 *
 * Persists evidence rows to underwriting_evidence and a proforma snapshot to
 * deal_underwriting_snapshots. All writes via direct DB (same exception as write_dealcontext).
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
  evidence_rows: z.array(EvidenceRowInputSchema).min(1).max(100),
  proforma_snapshot: z.record(z.string(), z.unknown()).optional()
    .describe('Full proforma_fields map for the snapshot table'),
  evidence_map: z.record(z.string(), z.unknown()).optional()
    .describe('Evidence map for the snapshot table'),
});

const OutputSchema = z.object({
  success: z.boolean(),
  evidence_ids: z.array(z.string()),
  snapshot_id: z.string().nullable(),
  written_at: z.string(),
});

export const writeUnderwritingTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'write_underwriting',
  description:
    'Persist evidence rows to underwriting_evidence and optionally a proforma snapshot. ' +
    'Call once per run after all evidence is gathered. Include ALL fields you underwrite, ' +
    'even fields with no collision.',
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

    let snapshotId: string | null = null;
    if (input.proforma_snapshot && input.evidence_map) {
      const snapResult = await query(
        `INSERT INTO deal_underwriting_snapshots
           (deal_id, agent_run_id, proforma_json, evidence_map)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          input.deal_id,
          ctx.correlationId ?? null,
          JSON.stringify(input.proforma_snapshot),
          JSON.stringify(input.evidence_map),
        ]
      );
      snapshotId = snapResult.rows[0]?.id as string ?? null;
    }

    logger.info('write_underwriting', {
      runId: ctx.correlationId,
      dealId: input.deal_id,
      evidenceCount: evidenceIds.length,
      snapshotId,
    });

    return {
      success: true,
      evidence_ids: evidenceIds,
      snapshot_id: snapshotId,
      written_at: new Date().toISOString(),
    };
  },
};
