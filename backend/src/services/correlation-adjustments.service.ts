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

/**
 * Replace the full correlation_adjustments array on a deal.
 *
 * Audit-critical: throws if the deal does not exist (rowCount !== 1) so the
 * caller cannot mistake a silent no-op UPDATE for a successful persist when
 * the deal was deleted between the authz check and the write.
 */
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
  const r = await pool.query(
    `UPDATE deals SET correlation_adjustments = $1::jsonb WHERE id = $2`,
    [JSON.stringify(stamped), dealId]
  );
  if (r.rowCount !== 1) {
    throw new Error(`Deal not found for correlation persist: ${dealId}`);
  }
}

/**
 * Append one adjustment without overwriting prior history.
 * Same rowCount guard as persistAdjustments — fail loud when the deal is gone.
 */
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
  const r = await pool.query(
    `UPDATE deals
       SET correlation_adjustments = COALESCE(correlation_adjustments, '[]'::jsonb) || $1::jsonb
     WHERE id = $2`,
    [JSON.stringify([stamped]), dealId]
  );
  if (r.rowCount !== 1) {
    throw new Error(`Deal not found for correlation append: ${dealId}`);
  }
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

/**
 * Map of correlation_id -> default target field that the signal influences.
 * This is a conservative default mapping — product can override per-correlation
 * by providing an explicit `target_field` in the source signal. The intent is
 * to give every persisted signal at least one assumption-field anchor so M22
 * attribution can join historical signals back to the assumptions that moved.
 */
const DEFAULT_TARGETS: Record<string, string> = {
  'COR-01': 'rentGrowthYr1',
  'COR-02': 'rentGrowthYr1',
  'COR-03': 'occupancy',
  'COR-04': 'rentGrowthYr1',
  'COR-05': 'occupancy',
  'COR-06': 'occupancy',
  'COR-07': 'occupancy',
  'COR-13': 'rentGrowthYr1',
  'COR-14': 'opexGrowthYr1',
  'COR-15': 'occupancy',
};

const SIGNAL_DELTA_PCT: Record<string, number> = {
  bullish: 0.5,
  bearish: -0.5,
  neutral: 0.0,
};

const CONFIDENCE_NORMALIZE: Record<string, 'high' | 'medium' | 'low' | 'insufficient'> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  insufficient: 'insufficient',
};

/**
 * Pure mapping: convert engine signal outputs into adjustment records.
 * Extracted from persistCorrelationsForDeal so it's unit-testable without a DB.
 */
export function mapSignalsToAdjustments(
  correlations: Array<{
    id: string;
    name?: string;
    signal: string | null;
    confidence: string;
    leadTime?: string;
    targetField?: string | null;
  }>,
  now: string = new Date().toISOString()
): CorrelationAdjustment[] {
  const adjustments: CorrelationAdjustment[] = [];
  for (const c of correlations) {
    if (!c.signal) continue;
    if (c.confidence === 'insufficient') continue;
    const target = c.targetField || DEFAULT_TARGETS[c.id];
    if (!target) continue;
    adjustments.push({
      cor_id: c.id,
      target_field: target,
      delta_pct: SIGNAL_DELTA_PCT[c.signal] ?? 0,
      signal: c.name ? `${c.signal}: ${c.name}` : c.signal,
      confidence: CONFIDENCE_NORMALIZE[c.confidence] ?? 'low',
      computed_at: now,
      model_version: MODEL_VERSIONS.correlation_engine,
      lead_time: c.leadTime,
    });
  }
  return adjustments;
}

/**
 * Convert a list of correlation engine outputs into adjustment records and
 * persist them on the deal. Engine-shape input intentionally loose so we can
 * accept the existing `CorrelationResult` shape without a hard dependency.
 */
export async function persistCorrelationsForDeal(
  dealId: string,
  correlations: Array<{
    id: string;
    name?: string;
    signal: string | null;
    confidence: string;
    leadTime?: string;
    targetField?: string | null;
  }>
): Promise<{ persisted: number }> {
  const adjustments = mapSignalsToAdjustments(correlations);
  if (adjustments.length === 0) return { persisted: 0 };
  await persistAdjustments(dealId, adjustments);
  return { persisted: adjustments.length };
}
