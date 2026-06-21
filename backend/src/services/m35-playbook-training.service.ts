/**
 * M35 Playbook Training Service — Admin override as training signal
 *
 * When an analyst overrides a platform-derived assumption (e.g., rent growth
 * computed from M35 event deltas), the override is logged as a training signal.
 * Over time, these signals reveal where the playbook systematically over- or
 * under-predicts, allowing targeted playbook refinement.
 *
 * The table `assumption_override_training_signals` stores:
 *   - What the platform predicted (previous_value, previous_resolution)
 *   - What the analyst overrode it to (override_value, override_reason)
 *   - Which events were active at the time (active_event_ids)
 *   - The computed delta vs. the analyst's delta (computed_delta, override_delta)
 *
 * Future work:
 *   - Backfill outcome_actual_value from actual rent rolls after 12 months
 *   - Run periodic playbook drift analysis comparing computed_delta vs. override_delta
 *   - Surface override patterns to the playbook admin dashboard
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Resolutions that indicate the previous value came from a platform/forecast source. */
const PLATFORM_DERIVED_RESOLUTIONS = new Set([
  'platform',
  'platform_fallback',
  'derived',
  'event_timeline',
  'agent',
  'strategy',
]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogOverrideTrainingSignalOptions {
  dealId: string;
  userId: string;
  fieldPath: string;
  assumptionType?: string;
  previousValue: number | null;
  overrideValue: number | null;
  baselineValue?: number | null;
  previousResolution: string | null;
  previousSource: string | null;
  overrideReason?: string | null;
  computedDelta?: number | null;
}

// ─── Main function ───────────────────────────────────────────────────────────

/**
 * Log an analyst override as a training signal for the M35 playbook.
 *
 * Only logs when the previous value was platform-derived (not from T-12,
 * rent roll, OM, or user override). This avoids polluting the training
 * dataset with overrides on already-manual values.
 */
export async function logOverrideTrainingSignal(
  pool: Pool,
  options: LogOverrideTrainingSignalOptions
): Promise<void> {
  const {
    dealId,
    userId,
    fieldPath,
    assumptionType,
    previousValue,
    overrideValue,
    baselineValue,
    previousResolution,
    previousSource,
    overrideReason,
    computedDelta,
  } = options;

  // Skip if previous resolution was not platform-derived
  if (!previousResolution || !PLATFORM_DERIVED_RESOLUTIONS.has(previousResolution)) {
    logger.debug('[M35Training] Skipping non-platform override', {
      dealId, fieldPath, previousResolution, previousSource,
    });
    return;
  }

  // Resolve deal location to query active events
  const locRes = await pool.query(
    `SELECT
       COALESCE(p.msa_id, d.deal_data->>'msaId', lower(trim(d.city))) AS msa_id,
       p.submarket_id,
       p.latitude,
       p.longitude
     FROM deals d
     LEFT JOIN deal_properties dp ON dp.deal_id = d.id
     LEFT JOIN properties p ON p.id = dp.property_id
     WHERE d.id = $1
     ORDER BY dp.created_at ASC NULLS LAST
     LIMIT 1`,
    [dealId]
  );

  const deal = locRes.rows[0];
  const msaId = deal?.msa_id ?? null;
  const submarketId = deal?.submarket_id ?? null;

  // Query active key events for this deal
  let activeEventIds: string[] | null = null;
  if (msaId) {
    try {
      const evRes = await pool.query(
        `SELECT id
         FROM key_events
         WHERE (
           msa_id = $1
           OR ($2::text IS NOT NULL AND submarket_id = $2)
           OR ($3::text IS NOT NULL AND property_id = $3)
         )
         AND status NOT IN ('cancelled','reversed','draft')
         ORDER BY magnitude_score DESC`,
        [msaId, submarketId, dealId]
      );
      activeEventIds = evRes.rows.map(r => r.id as string);
    } catch (err) {
      logger.warn('[M35Training] Failed to query active events', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Compute deltas
  const overrideDelta =
    baselineValue != null && overrideValue != null
      ? overrideValue - baselineValue
      : null;

  try {
    await pool.query(
      `INSERT INTO assumption_override_training_signals (
        deal_id, user_id, field_path, assumption_type,
        previous_value, override_value, baseline_value,
        previous_resolution, previous_source, override_reason,
        active_event_ids, computed_delta, override_delta
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13
      )`,
      [
        dealId,
        userId,
        fieldPath,
        assumptionType ?? null,
        previousValue,
        overrideValue,
        baselineValue ?? null,
        previousResolution,
        previousSource ?? null,
        overrideReason ?? null,
        activeEventIds ? `{${activeEventIds.join(',')}}` : null,
        computedDelta ?? null,
        overrideDelta,
      ]
    );

    logger.info('[M35Training] Logged override training signal', {
      dealId, fieldPath, previousResolution, previousSource,
      activeEventCount: activeEventIds?.length ?? 0,
      computedDelta, overrideDelta,
    });
  } catch (err) {
    logger.warn('[M35Training] Failed to log training signal (non-fatal)', {
      dealId, fieldPath, error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Determine if a field path is relevant for M35 playbook training.
 * Only rent-growth, vacancy, exit-cap, and absorption overrides are
 * currently playbook-relevant. Other fields (e.g., opex line items)
 * are not driven by the M35 event engine.
 */
export function isPlaybookRelevantField(fieldPath: string): boolean {
  const lower = fieldPath.toLowerCase();
  return (
    lower.includes('rent_growth') ||
    lower.includes('rentgrowth') ||
    lower.includes('vacancy') ||
    lower.includes('exit_cap') ||
    lower.includes('exitcap') ||
    lower.includes('absorption') ||
    lower.includes('opex_growth') ||
    lower.includes('opexgrowth')
  );
}

/**
 * Derive assumption_type from a field path.
 */
export function assumptionTypeFromFieldPath(fieldPath: string): string | undefined {
  const lower = fieldPath.toLowerCase();
  if (lower.includes('rent_growth') || lower.includes('rentgrowth')) return 'rent_growth';
  if (lower.includes('vacancy')) return 'vacancy';
  if (lower.includes('exit_cap') || lower.includes('exitcap')) return 'exit_cap';
  if (lower.includes('absorption')) return 'absorption';
  if (lower.includes('opex_growth') || lower.includes('opexgrowth')) return 'opex_growth';
  return undefined;
}
