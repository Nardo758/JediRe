/**
 * property-writeback.ts
 *
 * Task C: writes enrichment data from a completed intake_job's enrichment_log
 * into the corresponding property_descriptions row.
 *
 * RULES:
 * - Source of truth is always the cached enrichment_log — never re-runs
 *   enrichment or makes external API calls.
 * - Every write carries full LayeredValue provenance (value + source + runAt).
 * - Does not overwrite fields whose current source is 'user' (manual override).
 * - If property_descriptions row is missing, it is inserted first (upsert).
 * - Wraps all writes in a single transaction per parcel.
 *
 * Fields mapped from municipal_lookup → property_descriptions:
 *   address    → address       (LayeredValue<string>)
 *   county     → county        (LayeredValue<string>)
 *   units      → unit_count    (LayeredValue<number>)
 *   land_acres → lot_size_acres (LayeredValue<number>)
 *
 * Intentionally NOT mapped (no matching column in property_descriptions):
 *   owner, assessed_value, appraised_value, neighborhood, geometry_area_sqft
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

interface LogEntry {
  step: string;
  status: string;
  ts: string;
  detail?: Record<string, unknown>;
}

export interface WriteBackResult {
  parcelId: string;
  fieldsWritten: string[];
  source: string | null;
  skipped: boolean;
  skipReason?: string;
}

function buildLV(value: unknown, source: string, runAt: string): object {
  return { value, source, runAt };
}

/**
 * Extracts the first successful municipal_lookup entry from an enrichment_log
 * array. Returns null if none found.
 */
function extractMunicipalDetail(
  log: LogEntry[],
): { detail: Record<string, unknown>; ts: string } | null {
  const entry = log.find(
    (e) => e.step === 'municipal_lookup' && e.status === 'ok' && e.detail,
  );
  return entry ? { detail: entry.detail!, ts: entry.ts } : null;
}

/**
 * Writes enrichment data from the log into property_descriptions for the given
 * parcel. Returns a summary of what was written.
 *
 * Safe to call multiple times (idempotent when log values haven't changed).
 */
export async function writeBackToPropertyDescriptions(
  parcelId: string,
  enrichmentLog: LogEntry[],
): Promise<WriteBackResult> {
  if (!parcelId) {
    return { parcelId: '', fieldsWritten: [], source: null, skipped: true, skipReason: 'no_parcel_id' };
  }

  const municipal = extractMunicipalDetail(enrichmentLog);
  if (!municipal) {
    return { parcelId, fieldsWritten: [], source: null, skipped: true, skipReason: 'no_municipal_ok_entry' };
  }

  const { detail: d, ts: runAt } = municipal;
  const arcgisSource = typeof d.source === 'string' ? d.source : 'unknown';
  const lvSource = `municipal:${arcgisSource}`;

  // Build the SET clauses. Each field is only written when:
  //   (a) the current column value is NULL, OR
  //   (b) the current source is NOT 'user' (preserves manual overrides)
  type FieldSpec = { col: string; value: unknown };
  const fields: FieldSpec[] = [];

  if (typeof d.address === 'string' && d.address) {
    fields.push({ col: 'address', value: d.address });
  }
  if (typeof d.county === 'string' && d.county) {
    fields.push({ col: 'county', value: d.county });
  }
  if (d.units != null && typeof d.units === 'number') {
    fields.push({ col: 'unit_count', value: d.units });
  }
  if (d.land_acres != null && typeof d.land_acres === 'number') {
    fields.push({ col: 'lot_size_acres', value: d.land_acres });
  }

  if (fields.length === 0) {
    return { parcelId, fieldsWritten: [], source: lvSource, skipped: true, skipReason: 'no_mappable_fields' };
  }

  // Build parameterised UPDATE
  // For each field: only overwrite if NULL or source != 'user'
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const f of fields) {
    const lv = JSON.stringify(buildLV(f.value, lvSource, runAt));
    setClauses.push(
      `${f.col} = CASE
         WHEN ${f.col} IS NULL THEN $${idx}::jsonb
         WHEN ${f.col}->>'source' = 'user' THEN ${f.col}
         ELSE $${idx}::jsonb
       END`,
    );
    params.push(lv);
    idx++;
  }

  params.push(parcelId);
  const parcelParamIdx = idx;

  await query('BEGIN', []);
  try {
    // Insert row if missing
    await query(
      `INSERT INTO property_descriptions (parcel_id) VALUES ($1)
       ON CONFLICT (parcel_id) DO NOTHING`,
      [parcelId],
    );

    // Write fields
    await query(
      `UPDATE property_descriptions
          SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE parcel_id = $${parcelParamIdx}`,
      params,
    );

    await query('COMMIT', []);
  } catch (err) {
    await query('ROLLBACK', []).catch(() => {});
    throw err;
  }

  const fieldsWritten = fields.map((f) => f.col);
  logger.debug(
    `[property-writeback] parcel ${parcelId} → wrote [${fieldsWritten.join(', ')}] (source: ${lvSource})`,
  );

  return { parcelId, fieldsWritten, source: lvSource, skipped: false };
}
