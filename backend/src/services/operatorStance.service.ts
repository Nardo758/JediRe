/**
 * OperatorStance Service
 *
 * Handles persistence and application of OperatorStance for each deal.
 *
 * Responsibilities:
 *   1. Read / write / reset stance to deals.operator_stance (JSONB)
 *   2. Apply stance modulation to a proforma_fields map (stanceOnly re-blend)
 *   3. Return affected-fields list (which LayeredValues are currently stance-modulated)
 *
 * Cache-aware re-blend contract (Step 6 of task spec):
 *   PUT /stance → saveStance() → applyStanceReblend() (background, non-blocking)
 *   The reblend reads the last deal_underwriting_snapshots row, applies modulation
 *   to the cached proforma_fields, and writes the result as a new snapshot tagged
 *   as a stance reblend run. No LLM, no fetch_* calls.
 *
 * This file is importable from backend only (uses pg, not Drizzle) so the type
 * re-export is from the canonical types file, not dealContext.types.ts.
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
 * Triggers a background stance reblend against the last cached snapshot
 * (no LLM call, no data fetches).
 */
export async function saveStance(
  dealId: string,
  userId: string,
  patch: OperatorStancePatch,
): Promise<OperatorStance> {
  const db = getDb();

  // Load existing (may be null)
  const existing = await getStanceForDeal(dealId, userId);
  const merged: OperatorStance = {
    ...existing,
    ...patch,
    defaulted: false,
    updatedAt: new Date().toISOString(),
  };

  // Validate merged result
  const parsed = OperatorStanceSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid stance: ${parsed.error.message}`);
  }

  await db.query(
    `UPDATE deals SET operator_stance = $1::jsonb WHERE id = $2 AND user_id = $3`,
    [JSON.stringify(parsed.data), dealId, userId],
  );

  logger.info('[OperatorStance] stance saved', { dealId, underwritingPosture: parsed.data.underwritingPosture });

  // Background reblend — does not block the REST response
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
  logger.info('[OperatorStance] stance reset to defaults', { dealId });
  return { ...PLATFORM_STANCE_DEFAULTS, updatedAt: new Date().toISOString() };
}

// ── Affected fields ──────────────────────────────────────────────────────────

export interface AffectedField {
  fieldPath: string;
  deltaBps: number;
  trace: string;
}

/**
 * Return the list of field paths that the current stance modulates,
 * along with their net bps deltas. Computed deterministically — no DB query.
 * Used by GET /stance/affected-fields for the future Console yellow markers.
 */
export function computeAffectedFields(stance: OperatorStance): AffectedField[] {
  const result: AffectedField[] = [];
  for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
    const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);
    if (deltaBps !== 0) {
      result.push({
        fieldPath,
        deltaBps,
        trace: buildStanceTrace(stance, fieldPath, deltaBps, firedRules),
      });
    }
  }
  return result;
}

// ── Stance-only reblend ───────────────────────────────────────────────────────

/**
 * Apply stance modulation to the last cached underwriting snapshot for a deal.
 *
 * CONTRACT:
 *   - Reads last deal_underwriting_snapshots row (the cached agent output)
 *   - Applies stance modulation rules to the proforma_fields map
 *   - Writes a NEW snapshot tagged stance_reblend (no LLM, no data fetches)
 *   - Tags modulated fields with stanceModulated=true and stanceTrace
 *   - If no snapshot exists, logs and exits (agent hasn't run yet — nothing to reblend)
 *
 * Credit savings: 100% (zero tokens used, no LLM call).
 */
export async function applyStanceReblend(
  dealId: string,
  stance: OperatorStance,
): Promise<{ reblendId: string | null; fieldsModulated: string[] }> {
  const db = getDb();

  // Load last snapshot
  const snapRes = await db.query(
    `SELECT id, proforma_json, evidence_map, agent_run_id
     FROM deal_underwriting_snapshots
     WHERE deal_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [dealId],
  );
  if (snapRes.rows.length === 0) {
    logger.info('[OperatorStance] no snapshot found — skipping reblend', { dealId });
    return { reblendId: null, fieldsModulated: [] };
  }

  const snap = snapRes.rows[0];
  const proformaFields: Record<string, any> = snap.proforma_json ?? {};
  const fieldsModulated: string[] = [];

  // Apply modulation to each stance-aware field
  for (const fieldPath of STANCE_MODULATED_FIELD_PATHS) {
    const field = proformaFields[fieldPath];
    if (!field || field.value == null) continue;

    const { deltaBps, firedRules } = computeStanceDelta(stance, fieldPath);
    if (deltaBps === 0) {
      // Remove stale stance flags if stance was reset
      if (field.stanceModulated) {
        field.stanceModulated = false;
        field.stanceTrace = undefined;
      }
      continue;
    }

    // Convert bps delta to the field's natural unit:
    //   rate fields (rentGrowth, exitCapRate, expenseGrowth, vacancy) are stored as decimals
    //   e.g. 0.03 = 3%. 25bps = 0.0025.
    const deltaDecimal = deltaBps / 10000;
    const baseValue = typeof field.value === 'number' ? field.value : 0;
    field.value = Math.max(0, baseValue + deltaDecimal);
    field.stanceModulated = true;
    field.stanceTrace = buildStanceTrace(stance, fieldPath, deltaBps, firedRules);
    fieldsModulated.push(fieldPath);
  }

  // Write new snapshot tagged as stance reblend
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
      JSON.stringify(snap.evidence_map ?? {}),
    ],
  );

  logger.info('[OperatorStance] reblend complete', {
    dealId,
    reblendId,
    fieldsModulated,
    underwritingPosture: stance.underwritingPosture,
  });

  return { reblendId, fieldsModulated };
}

/**
 * Apply stance modulation to a live proforma_fields map in-memory.
 * Used by the Cashflow Agent tool fetch_operator_stance to tag values
 * after tier-hierarchy resolution, before write_underwriting persists them.
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
