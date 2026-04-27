/**
 * Cashflow Agent — Post-processor
 *
 * Aggregates tool-persisted data from the database after the model's loop
 * completes. This removes the need for the model to echo back its own tool
 * history in the final response — the runtime reads proforma_fields,
 * collision_summary, confidence_distribution, and tier_distribution from
 * the actual agent_steps that were persisted during the run.
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';

interface FieldOutput {
  value: unknown;
  source: string;
  evidence: string;
  archive_percentile?: number;
}

interface CollisionCounts {
  minor_count: number;
  material_count: number;
  severe_count: number;
}

export async function cashflowPostProcess(
  rawOutput: Record<string, unknown>,
  ctx: RunContext,
  runId: string,
): Promise<Record<string, unknown>> {
  const output = { ...rawOutput };

  try {
    // ── Aggregate proforma_fields from write_underwriting tool calls ──────────
    if (!output.proforma_fields || Object.keys(output.proforma_fields as Record<string, unknown>).length === 0) {
      const rows = await query(
        `SELECT payload
         FROM agent_run_steps
         WHERE agent_run_id = $1 AND step_type = 'tool_call' AND tool_name = 'write_underwriting'
         ORDER BY step_index ASC`,
        [runId]
      );
      const proformaFields: Record<string, FieldOutput> = {};
      for (const row of rows) {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        if (payload?.field_path && payload?.value !== undefined) {
          proformaFields[payload.field_path] = {
            value: payload.value,
            source: payload.source ?? 'ai',
            evidence: payload.evidence ?? '',
            archive_percentile: payload.archive_percentile,
          };
        }
        // Also handle write_underwriting's top-level shape (field_path → { value, ... })
        if (payload?.input?.field_path) {
          proformaFields[payload.input.field_path] = {
            value: payload.input.value,
            source: payload.input.source ?? 'ai',
            evidence: payload.input.evidence ?? '',
            archive_percentile: payload.input.archive_percentile,
          };
        }
      }
      if (Object.keys(proformaFields).length > 0) {
        output.proforma_fields = proformaFields;
        logger.info(`[CashflowPostProcess] Aggregated ${Object.keys(proformaFields).length} proforma fields from agent_steps`);
      }
    }

    // ── Aggregate collision_summary from detect_collision tool calls ──────────
    if (!output.collision_summary) {
      const collRows = await query(
        `SELECT payload
         FROM agent_run_steps
         WHERE agent_run_id = $1 AND step_type = 'tool_call' AND tool_name = 'detect_collision'
         ORDER BY step_index ASC`,
        [runId]
      );
      const counts: CollisionCounts = { minor_count: 0, material_count: 0, severe_count: 0 };
      for (const row of collRows) {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        const input = payload?.input ?? payload;
        if (input?.severity === 'minor') counts.minor_count++;
        else if (input?.severity === 'material') counts.material_count++;
        else if (input?.severity === 'severe') counts.severe_count++;
      }
      output.collision_summary = counts;
      logger.info(`[CashflowPostProcess] Aggregated collision_summary from ${collRows.length} detect_collision calls`);
    }

    // ── Aggregate confidence_distribution from write_underwriting ────────────
    // Each write_underwriting call includes a confidence_level. Count them.
    if (!output.confidence_distribution) {
      const confRows = await query(
        `SELECT payload
         FROM agent_run_steps
         WHERE agent_run_id = $1 AND step_type = 'tool_call'
           AND tool_name = 'write_underwriting'
         ORDER BY step_index ASC`,
        [runId]
      );
      const dist = { high: 0, medium: 0, low: 0 };
      for (const row of confRows) {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        const confidence = payload?.input?.confidence_level ?? payload?.confidence_level;
        if (confidence === 'high') dist.high++;
        else if (confidence === 'medium') dist.medium++;
        else if (confidence === 'low') dist.low++;
      }
      output.confidence_distribution = dist;
      logger.info(`[CashflowPostProcess] Aggregated confidence_distribution: ${JSON.stringify(dist)}`);
    }

    // ── Aggregate tier_distribution from write_underwriting ──────────────────
    if (!output.tier_distribution) {
      const tierRows = await query(
        `SELECT payload
         FROM agent_run_steps
         WHERE agent_run_id = $1 AND step_type = 'tool_call'
           AND tool_name = 'write_underwriting'
         ORDER BY step_index ASC`,
        [runId]
      );
      const tiers = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
      for (const row of tierRows) {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        const tier = payload?.input?.evidence_tier ?? payload?.evidence_tier;
        if (tier === 1 || tier === '1') tiers.tier1++;
        else if (tier === 2 || tier === '2') tiers.tier2++;
        else if (tier === 3 || tier === '3') tiers.tier3++;
        else if (tier === 4 || tier === '4') tiers.tier4++;
      }
      output.tier_distribution = tiers;
      logger.info(`[CashflowPostProcess] Aggregated tier_distribution: ${JSON.stringify(tiers)}`);
    }

    // Ensure required string fields
    if (!output.summary) output.summary = rawOutput.summary ?? 'Underwriting analysis completed';
    if (!output.completed_at) output.completed_at = new Date().toISOString();

  } catch (err) {
    logger.error('[CashflowPostProcess] Error during aggregation, falling back to raw output', { err });
  }

  return output;
}
