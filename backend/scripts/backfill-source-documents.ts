/**
 * Backfill source_documents catalogue for existing deals
 *
 * The writeSourceDocument() call in data-router.ts was added 2026-05-19.
 * Deals extracted before that date have deal_files rows with
 * extraction_status='done' but no corresponding source_documents entry in
 * deals.deal_data.  This script reconstructs those entries from the
 * extraction_result JSONB that was already persisted on each deal_files row.
 *
 * Idempotent: upsert semantics strip any prior entry for the same file_id
 * before appending (same contract as writeSourceDocument in data-router.ts).
 * Re-running is safe.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-source-documents.ts
 *   cd backend && npx ts-node --transpile-only scripts/backfill-source-documents.ts --dry-run
 */

import { getPool, connectDatabase } from '../src/database/connection';
import { logger } from '../src/utils/logger';

const DRY_RUN = process.argv.includes('--dry-run');

// Mirrors SOURCE_DOC_KEY_FIELDS in data-router.ts
const SOURCE_DOC_KEY_FIELDS: Record<string, string[]> = {
  T12:                ['gpr', 'noi', 'vacancy_loss', 'opex', 'monthly_actuals_12mo'],
  RENT_ROLL:          ['unit_mix', 'in_place_rents', 'occupancy', 'other_income_monthly'],
  OM:                 ['asking_price', 'units', 'year_built', 'noi', 'broker_proforma'],
  TAX_BILL:           ['assessed_value', 'annual_tax', 'tax_year'],
  AGED_RECEIVABLES:   ['total_outstanding', 'bucket_30d', 'bucket_60d', 'bucket_90d_plus'],
  BOX_SCORE:          ['occupancy_pct', 'move_ins', 'move_outs', 'renewals'],
  CONCESSION_BURNOFF: ['concession_months', 'effective_rent', 'burnoff_schedule'],
  T30_LTO:            ['lease_transactions_30d', 'traffic_count', 'conversion_rate'],
  OTHER_INCOME:       ['other_income_sources', 'total_other_income_monthly'],
};

interface DealFileRow {
  id: string;
  deal_id: string;
  filename: string;
  original_filename: string;
  mime_type: string | null;
  file_size: string | null;
  extraction_completed_at: string | null;
  extraction_result: {
    documentType?: string;
    rowsInserted?: number;
  } | null;
}

async function main() {
  logger.info('[backfill-source-docs] Starting', { dryRun: DRY_RUN });

  await connectDatabase();
  const pool = getPool();

  // Find all deal_files that have completed extraction with a known documentType
  // but where deals.deal_data->'source_documents' has no entry for that file_id.
  const res = await pool.query<DealFileRow>(`
    SELECT
      df.id,
      df.deal_id,
      df.filename,
      df.original_filename,
      df.mime_type,
      df.file_size::text,
      df.extraction_completed_at::text,
      df.extraction_result
    FROM deal_files df
    WHERE df.extraction_status = 'done'
      AND df.deleted_at IS NULL
      AND df.extraction_result IS NOT NULL
      AND df.extraction_result->>'documentType' IS NOT NULL
      AND df.extraction_result->>'documentType' != ''
      -- Exclude files that are already in source_documents for their deal
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          COALESCE(
            (SELECT deal_data->'source_documents' FROM deals WHERE id = df.deal_id),
            '[]'::jsonb
          )
        ) AS elem
        WHERE elem->>'file_id' = df.id::text
      )
    ORDER BY df.deal_id, df.extraction_completed_at
  `);

  logger.info('[backfill-source-docs] Files needing backfill', { count: res.rows.length });

  if (res.rows.length === 0) {
    logger.info('[backfill-source-docs] Nothing to do — all extracted files already catalogued.');
    return;
  }

  // Pre-run: print per-deal summary
  const dealCounts: Record<string, number> = {};
  for (const row of res.rows) {
    dealCounts[row.deal_id] = (dealCounts[row.deal_id] ?? 0) + 1;
  }
  for (const [dealId, count] of Object.entries(dealCounts)) {
    logger.info('[backfill-source-docs] Deal needs backfill', { dealId, fileCount: count });
  }

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of res.rows) {
    const er = row.extraction_result!;
    const documentType = er.documentType!;
    const rowsInserted = er.rowsInserted ?? 0;

    const record = {
      file_id:         row.id,
      filename:        row.original_filename || row.filename,
      document_type:   documentType,
      mime_type:       row.mime_type ?? null,
      file_size_bytes: row.file_size ? parseInt(row.file_size, 10) : null,
      extracted_at:    row.extraction_completed_at ?? new Date().toISOString(),
      key_fields:      SOURCE_DOC_KEY_FIELDS[documentType] ?? ['extracted_summary'],
      rows_inserted:   rowsInserted,
      source_ref:      row.original_filename || row.filename,
    };

    if (DRY_RUN) {
      logger.info('[backfill-source-docs] DRY RUN — would upsert', {
        dealId: row.deal_id,
        fileId: row.id,
        filename: record.filename,
        documentType,
        rowsInserted,
      });
      skipped++;
      continue;
    }

    try {
      // Upsert semantics: strip any prior entry for this file_id (re-extraction
      // safety) then append the reconstructed record.  Mirrors writeSourceDocument
      // in data-router.ts exactly.
      await pool.query(
        `UPDATE deals
            SET deal_data   = jsonb_set(
                  COALESCE(deal_data, '{}'),
                  '{source_documents}',
                  (
                    SELECT COALESCE(
                      jsonb_agg(elem) FILTER (
                        WHERE ($2::text IS NULL)
                           OR (elem->>'file_id' IS DISTINCT FROM $2::text)
                      ),
                      '[]'::jsonb
                    )
                    FROM jsonb_array_elements(
                      COALESCE(deal_data->'source_documents', '[]'::jsonb)
                    ) AS elem
                  ) || jsonb_build_array($3::jsonb)
                ),
                updated_at  = NOW()
          WHERE id = $1`,
        [row.deal_id, row.id, JSON.stringify(record)]
      );

      logger.info('[backfill-source-docs] Seeded', {
        dealId: row.deal_id,
        fileId: row.id,
        filename: record.filename,
        documentType,
        rowsInserted,
      });
      seeded++;
    } catch (err) {
      logger.error('[backfill-source-docs] Failed to upsert', {
        dealId: row.deal_id,
        fileId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  logger.info('[backfill-source-docs] Complete', {
    total:   res.rows.length,
    seeded,
    skipped,
    failed,
    dryRun:  DRY_RUN,
  });

  // Post-run verification: print source_documents counts per deal
  if (!DRY_RUN && seeded > 0) {
    logger.info('[backfill-source-docs] Post-run verification:');
    const check = await pool.query(`
      SELECT
        d.id AS deal_id,
        d.name AS deal_name,
        jsonb_array_length(COALESCE(d.deal_data->'source_documents', '[]'::jsonb)) AS source_doc_count
      FROM deals d
      WHERE d.id = ANY($1::uuid[])
      ORDER BY d.name
    `, [Object.keys(dealCounts)]);

    for (const r of check.rows) {
      logger.info('[backfill-source-docs] Verification', {
        dealId:       r.deal_id,
        dealName:     r.deal_name,
        sourceDocCount: r.source_doc_count,
      });
    }
  }
}

main().catch(err => {
  logger.error('[backfill-source-docs] Fatal error', { error: String(err) });
  process.exit(1);
});
