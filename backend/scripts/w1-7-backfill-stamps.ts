/**
 * W1-7 Backfill — Add _provenance stamp to intake_jobs missing it.
 *
 * Run in Replit (needs live DB):
 *   npx ts-node --transpile-only backend/scripts/w1-7-backfill-stamps.ts
 */

import { getPool } from '../src/database/connection';

async function main() {
  const pool = getPool();

  // Find intake_jobs in the last 14 days missing _provenance
  const { rows } = await pool.query(`
    SELECT id, raw_input, source_type, created_at
    FROM intake_jobs
    WHERE created_at > NOW() - INTERVAL '14 days'
      AND raw_input->>'_provenance' IS NULL
  `);

  console.log(`Found ${rows.length} intake_jobs missing _provenance`);

  for (const row of rows) {
    const raw = row.raw_input || {};
    const docType = raw.document_type || 'OTHER';
    const sha256 = raw.sha256 || 'unknown';
    const uploadedBy = raw.uploaded_by || null;

    // Construct a retroactive provenance stamp
    const provenance = {
      ingestionSource: 'document_extraction',
      userId: uploadedBy,
      documentSource: docType,
      rawSourceRef: sha256,
      stampedAt: row.created_at.toISOString(),
      _backfilled: true,
    };

    const updatedRaw = {
      ...raw,
      _provenance: provenance,
    };

    await pool.query(
      `UPDATE intake_jobs SET raw_input = $1::jsonb WHERE id = $2`,
      [JSON.stringify(updatedRaw), row.id]
    );

    console.log(`  ✅ Backfilled ${row.id} (${docType}, ${sha256.substring(0, 16)}...)`);
  }

  console.log('\nBackfill complete. Run w1-7-verify-stamps.ts to confirm.');
  process.exit(0);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
