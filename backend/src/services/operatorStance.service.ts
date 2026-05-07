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
  type RateEnvironment,
} from '../types/operator-stance';
import { randomUUID } from 'crypto';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDb(): Pool {
  return getPool();
}

/**
 * P3-01: Map m28_rate_environment.policy_stance + forward_direction to
 * the OperatorStance RateEnvironment enum. Used to seed a platform-default
 * rateEnvironment when the operator has not set a stance yet.
 */
function mapM28ToRateEnvironment(
  policyStance: string | null,
  forwardDirection: string | null,
): RateEnvironment {
  if (policyStance === 'easing' || policyStance === 'emergency') return 'CUTTING';
  if (policyStance === 'tightening') return 'HIGHER_FOR_LONGER';
  // neutral — use forward_direction as secondary signal
  if (forwardDirection === 'falling') return 'CUTTING';
  if (forwardDirection === 'rising') return 'HIGHER_FOR_LONGER';
  return 'NORMALIZING';
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

  // P3-01 bridge: when operator has not set a stance, seed rateEnvironment from
  // live m28_rate_environment macro data so platform defaults reflect current
  // monetary conditions rather than always defaulting to NORMALIZING.
  if (!raw) {
    try {
      const m28 = await db.query(
        `SELECT policy_stance, forward_direction FROM m28_rate_environment ORDER BY snapshot_date DESC LIMIT 1`,
      );
      if (m28.rows.length > 0) {
        const { policy_stance, forward_direction } = m28.rows[0];
        const rateEnvironment = mapM28ToRateEnvironment(policy_stance, forward_direction);
        return resolveStance({ rateEnvironment });
      }
    } catch {
      // m28 table not seeded yet — fall through to full platform defaults
    }
  }

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
    setBy: 'operator',
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

// ── Agent-inferred stance suggestion ────────────────────────────────────────

/**
 * P3-03: Write agent-observed market signals as an `agent_inferred` stance
 * suggestion. Only writes when the operator has not yet set a stance
 * (defaulted = true). Never clobbers an operator's explicit choices.
 *
 * Unlike saveStance(), this does NOT:
 *   - set defaulted = false (operator still hasn't confirmed)
 *   - trigger a background reblend (suggestion only — no model re-run)
 */
export async function suggestAgentInferredStance(
  dealId: string,
  suggestion: Partial<import('../types/operator-stance').OperatorStancePatch>,
): Promise<void> {
  const db = getDb();

  // Read current persisted stance directly (bypass getStanceForDeal to avoid
  // m28 enrichment — we need the raw DB value to check defaulted status)
  const res = await db.query(
    `SELECT operator_stance FROM deals WHERE id = $1 LIMIT 1`,
    [dealId],
  );
  if (res.rows.length === 0) return;

  const raw = res.rows[0].operator_stance;
  // If operator has explicitly set stance, do not overwrite
  if (raw && raw.defaulted === false) {
    logger.debug('[OperatorStance] agent_inferred suggestion skipped — operator has set stance', { dealId });
    return;
  }

  const existing = resolveStance(raw);
  const inferred: OperatorStance = {
    ...existing,
    ...suggestion,
    defaulted: true,        // still a platform default — operator hasn't confirmed
    setBy: 'agent_inferred',
    updatedAt: new Date().toISOString(),
  };

  const parsed = OperatorStanceSchema.safeParse(inferred);
  if (!parsed.success) {
    logger.warn('[OperatorStance] agent_inferred stance invalid — suggestion dropped', {
      dealId, errors: parsed.error.message,
    });
    return;
  }

  await db.query(
    `UPDATE deals SET operator_stance = $1::jsonb WHERE id = $2`,
    [JSON.stringify(parsed.data), dealId],
  );

  logger.info('[OperatorStance] agent_inferred stance suggestion written', {
    dealId,
    suggestion: Object.keys(suggestion),
    cyclePosition: parsed.data.cyclePosition,
    underwritingPosture: parsed.data.underwritingPosture,
    stressVacancyFloor: parsed.data.stressVacancyFloor,
  });
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

// ── DealFinancials in-place modulation ───────────────────────────────────────

/**
 * StanceModulation — per-field record appended to the GET /financials response.
 * Each entry describes an in-place adjustment made to data.assumptions values.
 */
export interface StanceModulation {
  fieldPath: string;
  originalValue: number | null;
  modulatedValue: number | null;
  stanceModulated: true;
  stanceTrace: string;
  deltaBps: number;
}

/**
 * Apply stance deltas IN-PLACE to a DealFinancials object.
 *
 * Mutates the following fields in data.assumptions:
 *   rentGrowthYr1      ← rentGrowth delta
 *   rentGrowthStabilized ← rentGrowthStabilized delta
 *   exitCap            ← exitCapRate delta
 *   opexGrowthPct      ← expenseGrowth delta
 *   perYear[].vacancyPct ← vacancy delta (all years)
 *   perYear[].rentGrowthPct ← rentGrowth delta (all years)
 *
 * Returns the list of StanceModulation records applied (one per field path
 * that had a non-zero delta), which the route appends as `stanceModulations`
 * to the GET /financials response. Returns [] for MARKET defaults (no mutation).
 *
 * CONTRACT: call this on a fresh getDealFinancials() result only.
 * Idempotent for a given stance — same input stance always produces same output.
 */
export function applyStanceToFinancials(
  data: {
    assumptions: {
      rentGrowthYr1: number | null;
      rentGrowthStabilized: number | null;
      exitCap: number | null;
      opexGrowthPct: number | null;
      perYear: Array<{ vacancyPct: number | null; rentGrowthPct: number | null; exitCapIfLastYear: number | null }>;
    };
  },
  stance: OperatorStance,
): StanceModulation[] {
  const modulations: StanceModulation[] = [];
  const a = data.assumptions;

  // Helper: apply a bps delta to a number | null value; returns new value
  const applyDelta = (base: number | null, deltaBps: number): number | null => {
    if (base == null) return null;
    return Math.max(0, base + deltaBps / 10000);
  };

  // ── rentGrowth → rentGrowthYr1 ───────────────────────────────────────────
  {
    const { deltaBps, firedRules } = computeStanceDelta(stance, 'rentGrowth');
    if (deltaBps !== 0) {
      const orig = a.rentGrowthYr1;
      a.rentGrowthYr1 = applyDelta(orig, deltaBps);
      modulations.push({
        fieldPath: 'rentGrowth',
        originalValue: orig,
        modulatedValue: a.rentGrowthYr1,
        stanceModulated: true,
        stanceTrace: buildStanceTrace(stance, 'rentGrowth', deltaBps, firedRules),
        deltaBps,
      });
      // Also propagate to perYear.rentGrowthPct
      for (const yr of a.perYear) {
        yr.rentGrowthPct = applyDelta(yr.rentGrowthPct, deltaBps);
      }
    }
  }

  // ── rentGrowthStabilized ─────────────────────────────────────────────────
  {
    const { deltaBps, firedRules } = computeStanceDelta(stance, 'rentGrowthStabilized');
    if (deltaBps !== 0) {
      const orig = a.rentGrowthStabilized;
      a.rentGrowthStabilized = applyDelta(orig, deltaBps);
      modulations.push({
        fieldPath: 'rentGrowthStabilized',
        originalValue: orig,
        modulatedValue: a.rentGrowthStabilized,
        stanceModulated: true,
        stanceTrace: buildStanceTrace(stance, 'rentGrowthStabilized', deltaBps, firedRules),
        deltaBps,
      });
    }
  }

  // ── exitCapRate → exitCap ─────────────────────────────────────────────────
  {
    const { deltaBps, firedRules } = computeStanceDelta(stance, 'exitCapRate');
    if (deltaBps !== 0) {
      const orig = a.exitCap;
      a.exitCap = applyDelta(orig, deltaBps);
      modulations.push({
        fieldPath: 'exitCapRate',
        originalValue: orig,
        modulatedValue: a.exitCap,
        stanceModulated: true,
        stanceTrace: buildStanceTrace(stance, 'exitCapRate', deltaBps, firedRules),
        deltaBps,
      });
      // Also propagate to perYear.exitCapIfLastYear
      for (const yr of a.perYear) {
        yr.exitCapIfLastYear = applyDelta(yr.exitCapIfLastYear, deltaBps);
      }
    }
  }

  // ── vacancy → perYear[].vacancyPct ────────────────────────────────────────
  {
    const { deltaBps, firedRules } = computeStanceDelta(stance, 'vacancy');
    if (deltaBps !== 0) {
      // perYear carries the time-series; vacancyPct is a % (e.g. 0.05 = 5%)
      const firstOrigVacancy = a.perYear[0]?.vacancyPct ?? null;
      for (const yr of a.perYear) {
        yr.vacancyPct = applyDelta(yr.vacancyPct, deltaBps);
      }
      modulations.push({
        fieldPath: 'vacancy',
        originalValue: firstOrigVacancy,
        modulatedValue: a.perYear[0]?.vacancyPct ?? null,
        stanceModulated: true,
        stanceTrace: buildStanceTrace(stance, 'vacancy', deltaBps, firedRules),
        deltaBps,
      });
    }
  }

  // ── expenseGrowth → opexGrowthPct ─────────────────────────────────────────
  {
    const { deltaBps, firedRules } = computeStanceDelta(stance, 'expenseGrowth');
    if (deltaBps !== 0) {
      const orig = a.opexGrowthPct;
      a.opexGrowthPct = applyDelta(orig, deltaBps);
      modulations.push({
        fieldPath: 'expenseGrowth',
        originalValue: orig,
        modulatedValue: a.opexGrowthPct,
        stanceModulated: true,
        stanceTrace: buildStanceTrace(stance, 'expenseGrowth', deltaBps, firedRules),
        deltaBps,
      });
    }
  }

  if (modulations.length > 0) {
    logger.info('[OperatorStance] in-place financials modulation', {
      count: modulations.length,
      fields: modulations.map(m => `${m.fieldPath}(${m.deltaBps > 0 ? '+' : ''}${m.deltaBps}bps)`),
      underwritingPosture: stance.underwritingPosture,
    });
  }

  return modulations;
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
