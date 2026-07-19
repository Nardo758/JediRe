/**
 * agent-overlay-writer.ts
 *
 * D3-W2/W3/W4/W5: Agent writes through the seam.
 *
 * Provides two functions:
 *   writeAgentConfirmedOverlay() — W2/W3/W5
 *     Writes an agent-proposed assumption value into deal_assumption_overlays
 *     with source_tag='agent_confirmed' (base scope, scenario_id=NULL) AND
 *     patches deal_assumptions.year1[year1Field].agent_confirmed for fields
 *     that have a year1 LayeredValue representation, so the resolution chain
 *     in get-field-value.service.ts picks up the value on the next build.
 *
 *     Plausibility bounds check (W3): values outside per-field deterministic
 *     bounds are written with confidence='LOW' and a human-readable note.
 *     The write is NEVER rejected — escalate, never drop (R4 ruling).
 *
 *     Hash stamp (W5): the overlay row carries deal_financial_models.assumptions_hash
 *     from the latest build run, stamping provenance to the build that informed it.
 *
 *   writeBrokerClaimFlag() — W4
 *     Flags a field via the overlay seam with source_tag='broker_claim'.
 *     Never writes deal_data directly.
 *
 * Resolution order (R1c): storedResolved < Engine A < agent_confirmed < perYearOverride < override
 */

import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

// ── Field → year1 JSONB key mapping ──────────────────────────────────────────
// Only fields that exist as LayeredValue<number> in ProFormaYear1Seed get a
// year1 patch (so the resolution chain picks them up during the next build).
// Fields without a year1 mapping still get an overlay row for provenance.

const YEAR1_FIELD_MAP: Record<string, string> = {
  vacancy_rate:      'vacancy_pct',
  management_fee_pct: 'management_fee_pct',
  capex_per_unit:    'replacement_reserves',
  interest_rate:     'rate',
  ltv_pct:           'ltv',
  loan_term_years:   'term',
  amortization_years: 'amort',
  io_period_months:  'io_period',
  dscr_floor:        'dscr_floor',
  debt_yield_floor:  'debt_yield_floor',
  exit_cap_rate:     'exit_cap_rate',
};

// ── Plausibility bounds (W3) ──────────────────────────────────────────────────
// Deterministic, not judgement. Values outside bounds → confidence='LOW' + note.
// Never reject — R4: escalate, never drop.

const PLAUSIBILITY_BOUNDS: Record<string, [min: number, max: number]> = {
  cap_rate:           [0.02, 0.20],
  exit_cap_rate:      [0.02, 0.20],
  exit_year:          [1,    30],
  rent_growth:        [-0.10, 0.30],
  expense_growth:     [-0.05, 0.30],
  vacancy_rate:       [0.00, 0.50],
  management_fee_pct: [0.00, 0.20],
  capex_per_unit:     [0,    50000],
  renovation_budget:  [0,    100_000_000],
  interest_rate:      [0.01, 0.20],
  ltv_pct:            [0.0,  1.0],
  loan_term_years:    [1,    40],
  amortization_years: [1,    50],
  io_period_months:   [0,    120],
  dscr_floor:         [1.0,  3.0],
  debt_yield_floor:   [0.05, 0.20],
};

// ── Public types ──────────────────────────────────────────────────────────────

export interface EvidenceRef {
  /** Semantic kind of evidence (original narrow shape). */
  kind?: 'correlation' | 'comp' | 'doc' | 'observation';
  /** Row id within the referenced table (original narrow shape). */
  ref_id?: string;
  /** Whether the referenced data is realised actuals or a forward projection. */
  data_kind?: 'actual' | 'forecast';

  // ── Extended shape (W3 provenance enrichment) ─────────────────────────────
  /** Table / entity type (e.g. 'metric_time_series', 'deal_assumption'). */
  type?: string;
  /** Row id within the referenced entity (string form of any PK). */
  id?: string;
  /** Human-readable description of the reference. */
  label?: string;
  /** Source tag from the originating row (e.g. 'costar_forecast', 'om', 'platform'). */
  sourceTag?: string;
}

export interface AgentOverlayWriteParams {
  dealId:       string;
  fieldKey:     string;
  value:        number;
  userId?:      string | null;
  scenarioId?:  string | null;   // NULL = base scope (default, per R1c ruling)
  confidence?:  'HIGH' | 'MEDIUM' | 'LOW';
  reasoning?:   string;
  evidenceRefs?: EvidenceRef[];
}

export interface AgentOverlayWriteResult {
  overlayId:  string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  outOfBounds: boolean;
  year1Patched: boolean;
  buildHash: string | null;
}

// ── W2/W3/W5: write agent_confirmed overlay ───────────────────────────────────

export async function writeAgentConfirmedOverlay(
  params: AgentOverlayWriteParams,
): Promise<AgentOverlayWriteResult> {
  const {
    dealId,
    fieldKey,
    value,
    userId   = null,
    scenarioId = null,
    evidenceRefs,
  } = params;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── W3: plausibility bounds check ──────────────────────────────────────
    const bounds = PLAUSIBILITY_BOUNDS[fieldKey];
    let outOfBounds = false;
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = params.confidence ?? 'MEDIUM';
    let note: string | null = null;

    if (bounds) {
      const [min, max] = bounds;
      if (value < min || value > max) {
        outOfBounds = true;
        confidence = 'LOW';                                  // R4: flag, never reject
        note = `OUT_OF_BOUNDS: value ${value} outside [${min}, ${max}] for field ${fieldKey}. Written as LOW confidence per R4 escalation policy.`;
        logger.warn('[agent-overlay-writer] out-of-bounds value — writing with LOW confidence', {
          dealId, fieldKey, value, bounds,
        });
      }
    }

    // ── W5: stamp latest build hash ────────────────────────────────────────
    const hashRes = await client.query<{ assumptions_hash: string | null }>(
      `SELECT assumptions_hash FROM deal_financial_models
        WHERE deal_id = $1 AND assumptions_hash IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`,
      [dealId],
    );
    const buildHash: string | null = hashRes.rows[0]?.assumptions_hash ?? null;

    // ── year1 patch: set agent_confirmed slot ──────────────────────────────
    const year1Key = YEAR1_FIELD_MAP[fieldKey] ?? null;
    let year1Patched = false;

    if (year1Key) {
      // Two-step jsonb_set so it works even when the field key doesn't yet
      // exist in year1 (fresh deal or legacy flat blob like Bishop's):
      //   Step 1 — ensure year1[year1Key] is an object (create {} if absent)
      //   Step 2 — set year1[year1Key].agent_confirmed = value
      // jsonb_set create_missing=true only creates the FINAL leaf; intermediate
      // keys must already exist. Step 1 guarantees the parent object is present.
      await client.query(
        `UPDATE deal_assumptions
            SET year1 = jsonb_set(
                  jsonb_set(
                    COALESCE(year1, '{}'::jsonb),
                    ARRAY[$1::text],
                    COALESCE(
                      COALESCE(year1, '{}'::jsonb) -> $1::text,
                      '{}'::jsonb
                    ),
                    true
                  ),
                  ARRAY[$1::text, 'agent_confirmed'],
                  to_jsonb($2::float8),
                  true
                ),
                updated_at = NOW()
          WHERE deal_id = $3`,
        [year1Key, value, dealId],
      );
      year1Patched = true;
    }

    // ── Phase 1: supersede previous agent_confirmed overlays for this field ──
    // Mark old rows with superseded_at; superseded_by is back-filled in phase 3
    // once the new row's id is known.
    const supersedeRes = await client.query<{ id: string }>(
      `UPDATE deal_assumption_overlays
          SET superseded_at = NOW()
        WHERE deal_id   = $1
          AND field_key  = $2
          AND source_tag = 'agent_confirmed'
          AND (
            ($3::uuid IS NULL AND scenario_id IS NULL)
            OR scenario_id = $3::uuid
          )
          AND superseded_at IS NULL
       RETURNING id`,
      [dealId, fieldKey, scenarioId],
    );
    const supersededIds = supersedeRes.rows.map(r => r.id);

    // ── Phase 2: insert new overlay row ───────────────────────────────────
    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO deal_assumption_overlays
         (deal_id, field_key, field_path, source_tag, value, value_text,
          confidence, note, reasoning, evidence_refs, build_hash,
          edited_by, edited_at, scenario_id, snapshot_at, created_at, updated_at)
       VALUES
         ($1, $2, $3, 'agent_confirmed', $4, $5,
          $6, $7, $8, $9, $10,
          $11, NOW(), $12, NOW(), NOW(), NOW())
       RETURNING id`,
      [
        dealId,
        fieldKey,
        year1Key ?? fieldKey,                                // field_path
        value,                                               // value
        String(value),                                       // value_text
        confidence,
        note,
        params.reasoning ?? null,
        evidenceRefs ? JSON.stringify(evidenceRefs) : null,
        buildHash,
        userId,
        scenarioId,
      ],
    );

    const overlayId = insertRes.rows[0].id;

    // ── Phase 3: back-fill superseded_by on previously active rows ─────────
    if (supersededIds.length > 0) {
      await client.query(
        `UPDATE deal_assumption_overlays
            SET superseded_by = $1
          WHERE id = ANY($2::uuid[])`,
        [overlayId, supersededIds],
      );
    }

    await client.query('COMMIT');

    logger.info('[agent-overlay-writer] wrote agent_confirmed overlay', {
      dealId, fieldKey, value, confidence, outOfBounds, year1Patched,
      overlayId, buildHash: buildHash?.slice(0, 12),
    });

    return { overlayId, confidence, outOfBounds, year1Patched, buildHash };

  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error('[agent-overlay-writer] transaction failed', { err: err.message, dealId, fieldKey });
    throw err;
  } finally {
    client.release();
  }
}

// ── W4: broker-claim flag via overlay seam ────────────────────────────────────
// Agent flags a field (e.g. 'real_estate_tax.broker_flag') through the overlay
// seam. Never writes deal_data directly (R6 ruling).

export interface BrokerClaimFlagParams {
  dealId:    string;
  fieldKey:  string;   // e.g. 'real_estate_tax.broker_flag'
  reasoning: string;
  userId?:   string | null;
  evidenceRefs?: EvidenceRef[];
}

export interface BrokerClaimFlagResult {
  overlayId: string;
}

export async function writeBrokerClaimFlag(
  params: BrokerClaimFlagParams,
): Promise<BrokerClaimFlagResult> {
  const { dealId, fieldKey, reasoning, userId = null, evidenceRefs } = params;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Supersede previous broker_claim overlay for this field
    const supersedeBrokerRes = await client.query<{ id: string }>(
      `UPDATE deal_assumption_overlays
          SET superseded_at = NOW()
        WHERE deal_id   = $1
          AND field_key  = $2
          AND source_tag = 'broker_claim'
          AND superseded_at IS NULL
       RETURNING id`,
      [dealId, fieldKey],
    );
    const supersededBrokerIds = supersedeBrokerRes.rows.map(r => r.id);

    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO deal_assumption_overlays
         (deal_id, field_key, field_path, source_tag,
          value, value_text, confidence,
          note, reasoning, evidence_refs,
          edited_by, edited_at, snapshot_at, created_at, updated_at)
       VALUES
         ($1, $2, $3, 'broker_claim',
          NULL, 'FLAG', 'MEDIUM',
          'Broker-claim divergence flagged by agent (W4). See reasoning.',
          $4, $5,
          $6, NOW(), NOW(), NOW(), NOW())
       RETURNING id`,
      [
        dealId,
        fieldKey,
        fieldKey,
        reasoning,
        evidenceRefs ? JSON.stringify(evidenceRefs) : null,
        userId,
      ],
    );

    const overlayId = insertRes.rows[0].id;

    if (supersededBrokerIds.length > 0) {
      await client.query(
        `UPDATE deal_assumption_overlays SET superseded_by = $1 WHERE id = ANY($2::uuid[])`,
        [overlayId, supersededBrokerIds],
      );
    }

    await client.query('COMMIT');

    logger.info('[agent-overlay-writer] wrote broker_claim flag', { dealId, fieldKey, overlayId });
    return { overlayId };

  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error('[agent-overlay-writer] broker_claim flag failed', { err: err.message, dealId, fieldKey });
    throw err;
  } finally {
    client.release();
  }
}
