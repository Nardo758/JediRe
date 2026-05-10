/**
 * Extraction Events Service — DQA Phase 2 (Task #698)
 *
 * Records per-field write timestamps in `extraction_events` so the Data Quality
 * Agent can use precise, field-level source-write times when classifying
 * SEED_PLUMBING_WRITE_RACE vs SEED_PLUMBING_STALE_SEED findings (Task #696).
 *
 * Phase 1 used `deals.updated_at` as a coarse proxy — it fires on any deal edit,
 * not specifically on extraction writes. Phase 2 replaces that proxy with this
 * dedicated audit table.
 *
 * Usage:
 *   // After writing broker_claims.proforma in routeOM:
 *   await emitExtractionEvents(pool, { dealId, sourceType: 'OM', proformaFields: data.brokerProforma });
 *
 *   // In the DQA timestamp lookup:
 *   const writtenAt = await fetchFieldWriteTime(pool, dealId, 'OM', 'gpr');
 */

import { Pool } from 'pg';

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Tolerance window for near-simultaneous seed and source writes.
 * Matches WRITE_RACE_WINDOW_SECONDS in data-quality-agent.service.ts.
 * Seed and source written within this window → SEED_PLUMBING_WRITE_RACE.
 */
export const WRITE_RACE_WINDOW_SECONDS = 300;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EmitExtractionEventsOpts {
  dealId:         string;
  sourceType:     'OM' | 'T12' | 'RENT_ROLL' | 'TAX_BILL' | 'manual';
  /** Map of proforma field names (DQA row keys) to their numeric values. */
  fields:         Record<string, number | null | undefined>;
  /** Actor string stored in written_by. Default: 'extraction_pipeline'. */
  writtenBy?:     string;
}

/**
 * OM broker_claims.proforma field name → DQA proforma row key mapping.
 * Aligns with PROFORMA_KEY_MAP in data-quality-agent.service.ts (inverted).
 */
export const OM_PROFORMA_FIELD_MAP: Record<string, string> = {
  stabilizedGpr:           'gpr',
  stabilizedVacancy:       'vacancy_pct',
  realEstateTaxesAnnual:   'real_estate_tax',
  contractServicesAnnual:  'contract_services',
  payrollAnnual:           'payroll',
  insuranceAnnual:         'insurance',
  managementFeePct:        'management_fee_pct',
  yearOneNOI:              'noi',
};

// ── Write: emit events ─────────────────────────────────────────────────────────

/**
 * Emit per-field extraction events. Fire-and-forget safe — errors are caught
 * and logged; callers must not await this on the critical path.
 *
 * Emits one row per field in `opts.fields`, including fields with null values
 * (so absence is auditable).
 */
export async function emitExtractionEvents(
  pool: Pool,
  opts: EmitExtractionEventsOpts
): Promise<void> {
  const { dealId, sourceType, fields, writtenBy = 'extraction_pipeline' } = opts;
  const now = new Date();

  const entries = Object.entries(fields);
  if (entries.length === 0) return;

  for (const [fieldName, fieldValue] of entries) {
    const numericValue = (fieldValue === null || fieldValue === undefined)
      ? null
      : Number(fieldValue);

    await pool.query(
      `INSERT INTO extraction_events (deal_id, source_type, field_name, field_value, written_at, written_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [dealId, sourceType, fieldName, numericValue, now, writtenBy]
    );
  }
}

/**
 * Emit extraction events from an OM brokerProforma object.
 * Translates OM field names to DQA row keys via OM_PROFORMA_FIELD_MAP.
 * Only emits events for fields that appear in the map (ignores unknown fields).
 */
export async function emitOmProformaEvents(
  pool: Pool,
  dealId: string,
  brokerProforma: Record<string, unknown>,
  writtenBy = 'extraction_pipeline'
): Promise<void> {
  const fields: Record<string, number | null> = {};
  for (const [omKey, rowKey] of Object.entries(OM_PROFORMA_FIELD_MAP)) {
    const raw = brokerProforma[omKey];
    fields[rowKey] = (raw === null || raw === undefined) ? null : Number(raw);
  }
  await emitExtractionEvents(pool, { dealId, sourceType: 'OM', fields, writtenBy });
}

// ── Read: fetch write time ─────────────────────────────────────────────────────

/**
 * Fetch the most-recent write timestamp for a specific field on a deal.
 *
 * Returns null if no extraction event has been recorded for this field yet
 * (deal predates Phase 2, or field was never extracted).
 *
 * Phase 2 DQA integration: use this in place of deals.updated_at when computing
 * deltaSeconds for WRITE_RACE vs STALE_SEED classification. The callsite in
 * data-quality-agent.service.ts should query this once per (dealId, documentType,
 * fieldName) tuple before building the seedGaps array.
 */
export async function fetchFieldWriteTime(
  pool: Pool,
  dealId: string,
  sourceType: string,
  fieldName: string
): Promise<Date | null> {
  const res = await pool.query<{ written_at: Date }>(
    `SELECT written_at
       FROM extraction_events
      WHERE deal_id    = $1
        AND source_type = $2
        AND field_name  = $3
      ORDER BY written_at DESC
      LIMIT 1`,
    [dealId, sourceType, fieldName]
  );
  return res.rows[0]?.written_at ?? null;
}

/**
 * Fetch write times for a batch of fields in a single query.
 * Returns a map of fieldName → most-recent written_at (or null if not found).
 *
 * More efficient than calling fetchFieldWriteTime() in a loop when auditing
 * multiple fields for the same (dealId, sourceType).
 */
export async function fetchFieldWriteTimes(
  pool: Pool,
  dealId: string,
  sourceType: string,
  fieldNames: string[]
): Promise<Record<string, Date | null>> {
  if (fieldNames.length === 0) return {};

  const res = await pool.query<{ field_name: string; written_at: Date }>(
    `SELECT DISTINCT ON (field_name)
            field_name,
            written_at
       FROM extraction_events
      WHERE deal_id     = $1
        AND source_type = $2
        AND field_name  = ANY($3::text[])
      ORDER BY field_name, written_at DESC`,
    [dealId, sourceType, fieldNames]
  );

  const result: Record<string, Date | null> = {};
  for (const name of fieldNames) result[name] = null;
  for (const row of res.rows) result[row.field_name] = row.written_at;
  return result;
}

// ── Signed-delta classification ────────────────────────────────────────────────

/**
 * Classify a null year1 slot as WRITE_RACE or STALE_SEED using signed-delta
 * semantics (Phase 2 replacement for Phase 1 absolute-delta heuristic).
 *
 * Phase 1 (deals.updated_at proxy) used: |deltaSeconds| < 300 → WRITE_RACE.
 * Phase 2 (field-level timestamps) uses signed comparison:
 *   seedWrittenAt >= sourceWrittenAt → WRITE_RACE (source was available; pipeline dropped it)
 *   seedWrittenAt <  sourceWrittenAt → STALE_SEED (seed ran before source existed)
 *
 * WRITE_RACE_WINDOW_SECONDS is retained as a tolerance for near-simultaneous writes
 * when both timestamps are very close (implementation detail, not a hard cutoff in
 * Phase 2 — the sign alone determines classification).
 *
 * @param sourceWrittenAt - When the value was written to broker_claims.proforma
 *                          (from extraction_events). Null → unknown → STALE_SEED.
 * @param seedWrittenAt   - When the Pro Forma year1 seed was written
 *                          (from deal_assumptions.updated_at).
 *                          Null → unknown → STALE_SEED.
 */
export function classifyTimestampDelta(
  sourceWrittenAt: Date | null,
  seedWrittenAt: Date | null
): 'SEED_PLUMBING_WRITE_RACE' | 'SEED_PLUMBING_STALE_SEED' {
  if (!sourceWrittenAt || !seedWrittenAt) {
    // Unknown timestamps: default to STALE_SEED (conservative; avoids false
    // engineering-ticket noise from WRITE_RACE misclassification).
    return 'SEED_PLUMBING_STALE_SEED';
  }

  const deltaSeconds = (seedWrittenAt.getTime() - sourceWrittenAt.getTime()) / 1000;

  // WRITE_RACE tolerance window: if seed and source were written within
  // WRITE_RACE_WINDOW_SECONDS of each other (in either direction), treat as a
  // concurrent-write race — the seeder may have snapshotted a null because the
  // extraction transaction had not yet committed.
  if (Math.abs(deltaSeconds) <= WRITE_RACE_WINDOW_SECONDS) {
    return 'SEED_PLUMBING_WRITE_RACE';
  }

  // Outside the window: seed ran well before or well after source.
  // In both cases the seeder had a clear opportunity to read the value and
  // failed to propagate it — an explicit re-seed is needed.
  return 'SEED_PLUMBING_STALE_SEED';
}

/**
 * Compute deltaSeconds between source write and seed write.
 * Positive: seed written after source (WRITE_RACE territory).
 * Negative: seed written before source (STALE_SEED territory).
 * null: either timestamp is unknown.
 */
export function computeDeltaSeconds(
  sourceWrittenAt: Date | null,
  seedWrittenAt: Date | null
): number | null {
  if (!sourceWrittenAt || !seedWrittenAt) return null;
  return (seedWrittenAt.getTime() - sourceWrittenAt.getTime()) / 1000;
}
