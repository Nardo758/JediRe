/**
 * OperatorStance Service
 *
 * Handles persistence and application of OperatorStance for each deal.
 *
 * Responsibilities:
 *   1. Read / write / reset stance to deals.operator_stance (JSONB)
 *   2. Apply stance modulation to a proforma_fields map (stanceOnly re-blend)
 *   3. Return affected-fields list (fields currently flagged stanceModulated in snapshot)
 *
 * ── IDEMPOTENCY CONTRACT ─────────────────────────────────────────────────────
 * Every re-blend (including reset to MARKET defaults) reads from the BASELINE
 * snapshot — the most-recent snapshot whose agent_run_id does NOT begin with
 * "stance_reblend_". This guarantees:
 *
 *   - Applying CONSERVATIVE twice → same result as applying once.
 *   - Flipping CONSERVATIVE → MARKET → reset → same original values are restored.
 *   - Delta of 0 (MARKET defaults) strips stanceModulated=true, restoring originals.
 *
 * The stance_reblend snapshot is a VIEW of the baseline, never the new baseline.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { type Pool } from 'pg';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import {
  OperatorStance,
  OperatorStancePatch,
  OperatorStanceSchema,
  PLATFORM_STANCE_DEFAULTS,
  STANCE_MODULATED_FIELD_PATHS,
  resolveStance,
  computeStanceDelta,
  buildStanceTrace,
} from '../types/operator-stance';
import { randomUUID } from 'crypto';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDb(): Pool {
  return getPool();
}

/**
 * Load the BASELINE snapshot for a deal — the most-recent snapshot whose
 * agent_run_id does NOT begin with "stance_reblend_".
 *
 * This is the anchor for all re-blends.  Stance snapshots are ephemeral views;
 * the baseline is the immutable agent output we always apply deltas on top of.
 */
async function loadBaselineSnapshot(
  db: Pool,
  dealId: string,
): Promise<{ id: string; proforma_json: Record<string, any>; evidence_map: Record<string, any> } | null> {
  const res = await db.query(
    `SELECT id, proforma_json, evidence_map
     FROM deal_underwriting_snapshots
     WHERE deal_id = $1
       AND (agent_run_id IS NULL OR agent_run_id NOT LIKE 'stance_reblend_%')
     ORDER BY created_at DESC LIMIT 1`,
    [dealId],
  );
  if (res.rows.length === 0) return null;
  return {
    id: res.rows[0].id,
    proforma_json: res.rows[0].proforma_json ?? {},
    evidence_map: res.rows[0].evidence_map ?? {},
  };
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get the effective stance for a deal.
 * Returns persisted stance (if set) with defaulted=false,
 * or platform defaults with defaulted=true.
 */
export async function getStanceForDeal(
  dealId: string,
  userId: string,
): Promise<OperatorStance> {
  const db = getDb();
  const res = await db.query(
    `SELECT operator_stance FROM deals WHERE id = $1 AND user_id = $2`,
    [dealId, userId],
  );
  if (res.rows.length === 0) {
    throw new Error(`Deal ${dealId} not found or not accessible`);
  }
  const raw = res.rows[0].operator_stance;
  return resolveStance(raw);
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Merge a partial stance patch into the deal's persisted stance.
 * Triggers a background stance reblend from the baseline snapshot
 * (no LLM call, no data fetches — zero credit cost).
 */
export async function saveStance(
  dealId: string,
  userId: string,
  patch: OperatorStancePatch,
): Promise<OperatorStance> {
  const db = getDb();

  const existing = await getStanceForDeal(dealId, userId);
  const merged: OperatorStance = {
    ...existing,
    ...patch,
    defaulted: false,
    updatedAt: new Date().toISOString(),
  };

  const parsed = OperatorStanceSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid stance: ${parsed.error.message}`);
  }

  await db.query(
    `UPDATE deals SET operator_stance = $1::jsonb WHERE id = $2 AND user_id = $3`,
    [JSON.stringify(parsed.data), dealId, userId],
  );

  logger.info('[OperatorStance] stance saved', {
    dealId,
    underwritingPosture: parsed.data.underwritingPosture,
    cyclePosition: parsed.data.cyclePosition,
  });

  // Background reblend from baseline — does not block the REST response
  setImmediate(() => {
    applyStanceReblend(dealId, parsed.data).catch(err => {
      logger.warn('[OperatorStance] background reblend failed (non-fatal)', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  });

  return parsed.data;
}

/**
 * Reset stance to platform defaults (delete persisted stance).
 * Triggers a background reblend so the reset takes effect immediately in the
 * cached snapshot — the re-blend applies zero deltas which strips all
 * stanceModulated flags, restoring original agent-run values.
 */
export async function resetStance(
  dealId: string,
  userId: string,
): Promise<OperatorStance> {
  const db = getDb();
  const res = await db.query(
    `UPDATE deals SET operator_stance = NULL WHERE id = $1 AND user_id = $2 RETURNING id`,
    [dealId, userId],
  );
  if (res.rows.length === 0) {
    throw new Error(`Deal ${dealId} not found or not accessible`);
  }

  const defaults: OperatorStance = { ...PLATFORM_STANCE_DEFAULTS, updatedAt: new Date().toISOString() };
  logger.info('[OperatorStance] stance reset to defaults', { dealId });

  // Background reblend with MARKET defaults — strips all stanceModulated flags
  setImmediate(() => {
    applyStanceReblend(dealId, defaults).catch(err => {
      logger.warn('[OperatorStance] background reblend (reset) failed (non-fatal)', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  });

  return defaults;
}

// ── Affected fields ───────────────────────────────────────────────────────────

export interface AffectedField {
  fieldPath: string;
  deltaBps: number;
  trace: string;
  source: 'snapshot' | 'rules';
}

/**
 * Return the list of field paths currently flagged stanceModulated=true in the
 * persisted financial outputs (latest snapshot), along with their stanceTrace.
 *
 * PRIMARY PATH — snapshot query (reflects actual persisted state):
 *   Scans the latest deal_underwriting_snapshots.proforma_json for fields where
 *   stanceModulated=true. This is what the Console yellow markers should read.
 *
 * FALLBACK — deterministic rule inference (no snapshot yet):
 *   When no snapshot exists (agent hasn't run), compute from stance rules
 *   so the UI can preview which fields WILL be affected when the agent runs.
 *   Fields from this path are tagged source='rules'.
 */
export async function computeAffectedFields(
  dealId: string,
  stance: OperatorStance,
): Promise<AffectedField[]> {
  const db = getDb();

  // Primary: query latest snapshot (including stance_reblend snapshots)
  const snapRes = await db.query(
    `SELECT proforma_json
     FROM deal_underwriting_snapshots
     WHERE deal_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [dealId],
  );

  if (snapRes.rows.length > 0 && snapRes.rows[0].proforma_json) {
    const proformaJson: Record<string, any> = snapRes.rows[0].proforma_json;
    const result: AffectedField[] = [];

    for (const [fieldPath, field] of Object.entries(proformaJson)) {
      if (field && typeof field === 'object' && field.stanceModulated === true) {
        const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);
        result.push({
          fieldPath,
          deltaBps,
          trace: field.stanceTrace ?? buildStanceTrace(stance, fieldPath, deltaBps, firedRules),
          source: 'snapshot',
        });
      }
    }

    // Also include fields that WILL be affected by current stance but aren't
    // yet in the snapshot (e.g. stance was updated after last reblend completed)
    for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
      if (result.some(f => f.fieldPath === fieldPath)) continue; // already in snapshot result
      const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);
      if (deltaBps !== 0) {
        result.push({
          fieldPath,
          deltaBps,
          trace: buildStanceTrace(stance, fieldPath, deltaBps, firedRules),
          source: 'rules',
        });
      }
    }

    return result;
  }

  // Fallback: no snapshot — deterministic rule inference only
  const result: AffectedField[] = [];
  for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
    const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);
    if (deltaBps !== 0) {
      result.push({
        fieldPath,
        deltaBps,
        trace: buildStanceTrace(stance, fieldPath, deltaBps, firedRules),
        source: 'rules',
      });
    }
  }
  return result;
}

// ── Stance-only reblend ───────────────────────────────────────────────────────

/**
 * Apply stance modulation to the BASELINE underwriting snapshot for a deal.
 *
 * IDEMPOTENCY GUARANTEE:
 *   Always reads from the baseline (last non-stance_reblend snapshot), so:
 *   - Applying CONSERVATIVE twice → same result as once (delta applied to original value)
 *   - Reverting to MARKET (defaulted=true, all deltas=0) restores original values
 *   - Reset → same as MARKET revert
 *
 * Zero-delta fields (delta=0) strip stanceModulated=true, restoring original values.
 * Positive/negative delta fields set stanceModulated=true and stanceTrace.
 *
 * Credit savings: 100% (zero LLM tokens, zero data fetches).
 */
export async function applyStanceReblend(
  dealId: string,
  stance: OperatorStance,
): Promise<{ reblendId: string | null; fieldsModulated: string[]; baselineSnapshotId: string | null }> {
  const db = getDb();

  // Load BASELINE snapshot (never a prior stance_reblend)
  const baseline = await loadBaselineSnapshot(db, dealId);
  if (!baseline) {
    logger.info('[OperatorStance] no baseline snapshot found — skipping reblend', { dealId });
    return { reblendId: null, fieldsModulated: [], baselineSnapshotId: null };
  }

  // Deep-clone the baseline proforma fields so we never mutate the baseline in-memory
  const proformaFields: Record<string, any> = JSON.parse(JSON.stringify(baseline.proforma_json));
  const fieldsModulated: string[] = [];

  for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
    const field = proformaFields[fieldPath];
    if (!field || field.value == null) continue;

    const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);

    if (deltaBps === 0) {
      // MARKET baseline — ensure no stale stance flags remain in the cloned output
      if (field.stanceModulated) {
        field.stanceModulated = false;
        field.stanceTrace = undefined;
      }
      continue;
    }

    // Apply delta to the baseline value (field comes from the unmodulated baseline)
    const deltaDecimal = deltaBps / 10000;
    const baseValue = typeof field.value === 'number' ? field.value : 0;
    field.value = Math.max(0, baseValue + deltaDecimal);
    field.stanceModulated = true;
    field.stanceTrace = buildStanceTrace(stance, fieldPath, deltaBps, firedRules);
    fieldsModulated.push(fieldPath);
  }

  // Write the stance reblend snapshot
  const reblendId = randomUUID();
  const reblendRunId = `stance_reblend_${reblendId}`;

  await db.query(
    `INSERT INTO deal_underwriting_snapshots
       (id, deal_id, agent_run_id, proforma_json, evidence_map, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW())`,
    [
      reblendId,
      dealId,
      reblendRunId,
      JSON.stringify(proformaFields),
      JSON.stringify(baseline.evidence_map),
    ],
  );

  logger.info('[OperatorStance] reblend complete', {
    dealId,
    reblendId,
    baselineSnapshotId: baseline.id,
    fieldsModulated,
    underwritingPosture: stance.underwritingPosture,
    defaulted: stance.defaulted,
  });

  return { reblendId, fieldsModulated, baselineSnapshotId: baseline.id };
}

/**
 * Apply stance modulation to a live proforma_fields map in-memory.
 * Used by the Cashflow Agent tool fetch_operator_stance to tag values
 * after tier-hierarchy resolution, before write_underwriting persists them.
 *
 * IMPORTANT: Call this on a freshly-derived map, NOT a previously-modulated one.
 * The Cashflow Agent always derives values from raw data — this is always idempotent.
 *
 * Mutates the input map and returns the list of modulated field paths.
 */
export function applyStanceToProformaFields(
  proformaFields: Record<string, any>,
  stance: OperatorStance,
): string[] {
  const modulated: string[] = [];
  for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
    const field = proformaFields[fieldPath];
    if (!field || field.value == null) continue;

    const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);
    if (deltaBps === 0) continue;

    const deltaDecimal = deltaBps / 10000;
    const baseValue = typeof field.value === 'number' ? field.value : 0;
    field.value = Math.max(0, baseValue + deltaDecimal);
    field.stanceModulated = true;
    field.stanceTrace = buildStanceTrace(stance, fieldPath, deltaBps, firedRules);
    modulated.push(fieldPath);
  }
  return modulated;
}
