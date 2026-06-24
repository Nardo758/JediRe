/**
 * Data Library Upload → IntakeJob source adapter.
 *
 * Converts a browser-uploaded file (already in R2) into a data_library_files
 * row + intake_jobs row. Idempotent via sha256 dedup:
 *
 *   data_library_files: ON CONFLICT (sha256) DO NOTHING
 *   intake_jobs:        ON CONFLICT (source_type, source_record_id)
 *                         WHERE source_type IS NOT NULL AND source_record_id IS NOT NULL
 *                       DO UPDATE SET raw_input = EXCLUDED.raw_input, updated_at = NOW()
 *                       (state is NOT touched — preserves in-flight processing)
 *
 * Dedup key: (source_type='data_library_upload', source_record_id=sha256)
 *
 * After registration the adapter backfills historical_observations.source_file_ids
 * for any rows that share the same parcel_id, so downstream enrichment can trace
 * which files contributed to each observation window.
 */

import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

export interface UploadedFileMetadata {
  parcel_id?: string | null;
  sha256: string;
  original_filename: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  storage_key: string;
  storage_bucket?: string | null;
  document_type?: string | null;
  uploaded_by?: string | null;
}

export interface RegisterResult {
  file_id: string;
  status: 'registered' | 'duplicate';
  intake_job_id: string;
  linked_observations: number;
}

const VALID_DOC_TYPES = new Set(['OM', 'T12', 'RENT_ROLL', 'TAX_BILL', 'LEASING_STATS', 'OTHER']);

function normalizeDocType(raw?: string | null): string {
  if (!raw) return 'OTHER';
  const up = raw.trim().toUpperCase();
  return VALID_DOC_TYPES.has(up) ? up : 'OTHER';
}

/**
 * Register one uploaded file.
 *
 * Returns status='duplicate' when the sha256 already exists in
 * data_library_files (idempotent re-drag of the same folder).
 * The intake_jobs row is upserted regardless so raw_input stays current.
 */
export async function registerUploadedFile(
  meta: UploadedFileMetadata,
): Promise<RegisterResult> {
  if (!meta.sha256) throw new Error('[data-library-upload] sha256 is required');
  if (!meta.storage_key) throw new Error('[data-library-upload] storage_key is required');
  if (!meta.original_filename) throw new Error('[data-library-upload] original_filename is required');

  const docType = normalizeDocType(meta.document_type);
  const parcelId = meta.parcel_id?.trim() || null;

  // ── 1. data_library_files INSERT (dedup on sha256) ────────────────────────
  const fileRes = await query<{ id: string; inserted: boolean }>(
    `INSERT INTO data_library_files
       (original_filename, sha256, mime_type, size_bytes,
        storage_provider, storage_bucket, storage_key,
        document_type, parser_status, parcel_id, uploaded_by, scope_id, redistribution_restricted)
     VALUES ($1, $2, $3, $4, 'r2', $5, $6, $7, 'unparsed', $8, $9, $10, FALSE)
     ON CONFLICT (sha256) DO NOTHING
     RETURNING id, true AS inserted`,
    [
      meta.original_filename,
      meta.sha256,
      meta.mime_type ?? null,
      meta.size_bytes ?? null,
      meta.storage_bucket ?? null,
      meta.storage_key,
      docType,
      parcelId,
      meta.uploaded_by ?? null,
      meta.uploaded_by ? 'user:' + meta.uploaded_by : 'GLOBAL',
    ],
  );

  let fileId: string;
  let status: 'registered' | 'duplicate';

  if (fileRes.rows.length > 0) {
    fileId = fileRes.rows[0].id;
    status = 'registered';
  } else {
    // sha256 conflict — fetch the existing row's id
    const existing = await query<{ id: string }>(
      `SELECT id FROM data_library_files WHERE sha256 = $1`,
      [meta.sha256],
    );
    if (existing.rows.length === 0) {
      throw new Error(`[data-library-upload] sha256 conflict but row not found: ${meta.sha256}`);
    }
    fileId = existing.rows[0].id;
    status = 'duplicate';
    logger.debug(`[data-library-upload] duplicate sha256 ${meta.sha256}, existing file_id=${fileId}`);
  }

  // ── 2. intake_jobs UPSERT ─────────────────────────────────────────────────
  const rawInput = JSON.stringify({
    original_filename: meta.original_filename,
    sha256: meta.sha256,
    document_type: docType,
    size_bytes: meta.size_bytes ?? null,
    mime_type: meta.mime_type ?? null,
    storage_key: meta.storage_key,
    parcel_id: parcelId,
    uploaded_by: meta.uploaded_by ?? null,
  });

  const jobRes = await query<{ id: string }>(
    `INSERT INTO intake_jobs (
        file_id,
        parcel_id,
        source_type,
        source_record_id,
        raw_input,
        source_data,
        state
      ) VALUES (
        $1, $2,
        'data_library_upload',
        $3,
        $4::jsonb,
        $4::jsonb,
        'pending'
      )
      ON CONFLICT (source_type, source_record_id)
        WHERE source_type IS NOT NULL AND source_record_id IS NOT NULL
      DO UPDATE SET
        raw_input   = EXCLUDED.raw_input,
        source_data = EXCLUDED.source_data,
        file_id     = COALESCE(intake_jobs.file_id, EXCLUDED.file_id),
        updated_at  = NOW()
      RETURNING id`,
    [fileId, parcelId, meta.sha256, rawInput],
  );

  const intakeJobId = jobRes.rows[0].id;

  // ── 3. Backfill historical_observations.source_file_ids ───────────────────
  //    Link this file_id into any observation rows that share the same parcel_id.
  //    source_file_ids is a jsonb array; we append only if not already present.
  let linkedObservations = 0;
  if (parcelId) {
    try {
      const backfillRes = await query<{ count: string }>(
        `UPDATE historical_observations
            SET source_file_ids = CASE
              WHEN source_file_ids IS NULL THEN jsonb_build_array($1::text)
              WHEN source_file_ids @> jsonb_build_array($1::text) THEN source_file_ids
              ELSE source_file_ids || jsonb_build_array($1::text)
            END
          WHERE parcel_id = $2
          RETURNING id`,
        [fileId, parcelId],
      );
      linkedObservations = backfillRes.rows.length;
    } catch (err) {
      // Non-fatal: backfill is best-effort; log and continue
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[data-library-upload] backfill failed for parcel ${parcelId}`, { error: msg });
    }
  }

  logger.info(`[data-library-upload] ${status} file_id=${fileId} job_id=${intakeJobId} sha256=${meta.sha256.slice(0, 12)}… linked_obs=${linkedObservations}`);

  return { file_id: fileId, status, intake_job_id: intakeJobId, linked_observations: linkedObservations };
}
