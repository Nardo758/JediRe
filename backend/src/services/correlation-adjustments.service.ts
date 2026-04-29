/**
 * Correlation Adjustments Persistence — F9 Pro Forma Tier-2 (Spec §3).
 *
 * Stores Correlation Engine outputs on the deal so they survive process
 * restarts and feed:
 *   - audit trail (who adjusted what, when, why)
 *   - M22 post-close attribution (was the COR signal predictive?)
 *   - defending platform values when broker numbers diverge
 *
 * Persisted as a JSONB array on `deals.correlation_adjustments`.
 */

import { getPool } from '../database/connection';
import { MODEL_VERSIONS } from './proforma/model-versions';

export interface CorrelationAdjustment {
  cor_id: string;              // e.g. "COR-01"
  target_field: string;        // e.g. "rentGrowthYr1"
  delta_pct: number;           // signed % delta applied to target
  signal: string;              // human-readable signal name
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  computed_at: string;         // ISO-8601
  model_version: string;
  lead_time?: string;
  source_refs?: Array<{ moduleId?: string; documentId?: string; note?: string }>;
}

/** Replace the full correlation_adjustments array on a deal. */
export async function persistAdjustments(
  dealId: string,
  adjustments: CorrelationAdjustment[]
): Promise<void> {
  const pool = getPool();
  const stamped = adjustments.map((a) => ({
    ...a,
    model_version: a.model_version || MODEL_VERSIONS.correlation_engine,
    computed_at: a.computed_at || new Date().toISOString(),
  }));
  await pool.query(
    `UPDATE deals SET correlation_adjustments = $1::jsonb WHERE id = $2`,
    [JSON.stringify(stamped), dealId]
  );
}

/** Append one adjustment without overwriting prior history. */
export async function appendAdjustment(
  dealId: string,
  adjustment: CorrelationAdjustment
): Promise<void> {
  const pool = getPool();
  const stamped = {
    ...adjustment,
    model_version: adjustment.model_version || MODEL_VERSIONS.correlation_engine,
    computed_at: adjustment.computed_at || new Date().toISOString(),
  };
  await pool.query(
    `UPDATE deals
       SET correlation_adjustments = COALESCE(correlation_adjustments, '[]'::jsonb) || $1::jsonb
     WHERE id = $2`,
    [JSON.stringify([stamped]), dealId]
  );
}

/** Read all adjustments for a deal, newest first. */
export async function readAdjustments(dealId: string): Promise<CorrelationAdjustment[]> {
  const pool = getPool();
  const r = await pool.query<{ correlation_adjustments: CorrelationAdjustment[] }>(
    `SELECT correlation_adjustments FROM deals WHERE id = $1`,
    [dealId]
  );
  if (r.rowCount === 0) return [];
  const arr = r.rows[0].correlation_adjustments || [];
  return [...arr].sort((a, b) => (b.computed_at || '').localeCompare(a.computed_at || ''));
}

/** Read only the most recent adjustment per (cor_id, target_field) pair. */
export async function readLatestPerSignal(dealId: string): Promise<CorrelationAdjustment[]> {
  const all = await readAdjustments(dealId);
  const seen = new Set<string>();
  const out: CorrelationAdjustment[] = [];
  for (const a of all) {
    const key = `${a.cor_id}::${a.target_field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
