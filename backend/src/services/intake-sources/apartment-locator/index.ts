/**
 * Apartment Locator → IntakeJob source adapter.
 *
 * Converts a raw Apartment Locator scrape record into an intake_jobs row.
 * Idempotent: uses INSERT … ON CONFLICT (source_type, source_record_id)
 * DO UPDATE so re-scraping the same record refreshes raw_input without
 * restarting processing or creating duplicate rows.
 *
 * Dedup key: (source_type='apartment_locator', source_record_id=prop.id)
 * This matches the unique partial index created in Task A migration:
 *   idx_intake_jobs_source_record_unique
 *   ON intake_jobs (source_type, source_record_id)
 *   WHERE source_type IS NOT NULL AND source_record_id IS NOT NULL
 *
 * The parcel_id is left intentionally blank — the orchestrator's
 * municipal_lookup step resolves the canonical ArcGIS parcel_id using
 * address/name lookups and writes it back once enrichment completes.
 */

import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

export interface ApartmentLocatorRecord {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string | null;
  total_units?: number | null;
  rent?: number | null;
  bedrooms?: number | null;
  bathrooms?: string | number | null;
  square_feet?: number | null;
  units_available?: number | null;
  concessions?: string | null;
  [key: string]: unknown;
}

export interface UpsertResult {
  action: 'inserted' | 'updated';
  sourceRecordId: string;
}

/**
 * Upserts one Apartment Locator record as an intake_jobs row.
 *
 * ON CONFLICT semantics:
 *   - raw_input refreshed to latest scrape
 *   - updated_at bumped
 *   - state, attempts, enrichment_log, last_error are NOT touched
 *     (preserves any in-flight processing state)
 */
export async function upsertApartmentLocatorJob(
  record: ApartmentLocatorRecord,
): Promise<UpsertResult> {
  const sourceRecordId = String(record.id);

  if (!sourceRecordId) {
    throw new Error('[apartment-locator-adapter] record.id is required');
  }

  const rawInput = JSON.stringify({
    apartment_locator_id: record.id,
    name:        record.name,
    address:     record.address,
    city:        record.city,
    state:       record.state,
    zip_code:    record.zip_code ?? null,
    total_units: record.total_units ?? null,
    rent:        record.rent ?? null,
  });

  const result = await query<{ inserted: boolean }>(
    `INSERT INTO intake_jobs (
        source_type,
        source_record_id,
        raw_input,
        state,
        source_data
      ) VALUES (
        'apartment_locator',
        $1,
        $2::jsonb,
        'pending',
        $2::jsonb
      )
      ON CONFLICT (source_type, source_record_id)
        WHERE source_type IS NOT NULL AND source_record_id IS NOT NULL
      DO UPDATE SET
        raw_input   = EXCLUDED.raw_input,
        source_data = EXCLUDED.source_data,
        updated_at  = NOW()
      RETURNING (xmax = 0) AS inserted`,
    [sourceRecordId, rawInput],
  );

  const inserted = result.rows[0]?.inserted ?? false;
  const action: 'inserted' | 'updated' = inserted ? 'inserted' : 'updated';

  logger.debug(
    `[apartment-locator-adapter] ${action} intake_jobs row for record ${sourceRecordId}`,
  );

  return { action, sourceRecordId };
}

/**
 * Batch upsert for an array of records.
 * Processes sequentially to keep error isolation per record.
 * Returns summary stats.
 */
export async function upsertApartmentLocatorBatch(
  records: ApartmentLocatorRecord[],
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const result = await upsertApartmentLocatorJob(record);
      if (result.action === 'inserted') inserted++;
      else updated++;
    } catch (err: unknown) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[apartment-locator-adapter] upsert failed', {
        recordId: record.id,
        error: msg,
      });
    }
  }

  return { inserted, updated, errors };
}
