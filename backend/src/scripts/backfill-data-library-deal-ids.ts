/**
 * One-time backfill: associate existing data_library_files rows with deals
 * where a relationship can be derived from existing data.
 *
 * Strategy (in priority order):
 *   1. deal_files table: rows where file_id matches data_library_files.id
 *   2. Parsed storage path: if file_path contains a UUID that maps to deals.id
 *
 * Files that cannot be associated stay NULL (legitimate Unaffiliated cases).
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill-data-library-deal-ids.ts
 *
 * Flags:
 *   --dry-run    Print what would change without writing
 */

import { Pool } from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let associated = 0;
  let skipped = 0;

  try {
    console.log(`[backfill] Starting data_library_files → deal_id association${DRY_RUN ? ' (DRY RUN)' : ''}`);

    // ── Strategy 1: join via deal_files table ────────────────────────────────
    // deal_files.file_id is an INTEGER FK to data_library_files.id in some
    // schemas. Check if the column exists before querying.
    const dealFilesCheck = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'deal_files'
           AND column_name = 'file_id'
      ) AS exists
    `);

    if (dealFilesCheck.rows[0]?.exists) {
      const candidates = await pool.query<{ dlf_id: number; deal_id: string }>(`
        SELECT dlf.id AS dlf_id, df.deal_id
          FROM data_library_files dlf
          JOIN deal_files df ON df.file_id = dlf.id
         WHERE dlf.deal_id IS NULL
           AND df.deal_id IS NOT NULL
      `);

      console.log(`[backfill] Strategy 1 (deal_files): ${candidates.rows.length} candidate(s)`);

      for (const row of candidates.rows) {
        if (!DRY_RUN) {
          await pool.query(
            `UPDATE data_library_files SET deal_id = $1 WHERE id = $2 AND deal_id IS NULL`,
            [row.deal_id, row.dlf_id],
          );
        } else {
          console.log(`  [dry-run] Would set data_library_files.id=${row.dlf_id} → deal_id=${row.deal_id}`);
        }
        associated++;
      }
    } else {
      console.log('[backfill] Strategy 1: deal_files.file_id column not found — skipping');
    }

    // ── Strategy 2: parse UUID from file_path ────────────────────────────────
    // If the upload route embedded a deal UUID in the path hierarchy, extract it.
    const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

    const dealIds = await pool.query<{ id: string }>(`SELECT id FROM deals`);
    const dealIdSet = new Set(dealIds.rows.map(r => r.id));

    const unassociated = await pool.query<{ id: number; file_path: string }>(`
      SELECT id, file_path FROM data_library_files WHERE deal_id IS NULL
    `);

    console.log(`[backfill] Strategy 2 (file_path UUID): ${unassociated.rows.length} unassociated file(s) to check`);

    for (const row of unassociated.rows) {
      const matches = row.file_path.match(UUID_RE) ?? [];
      const matched = matches.find(m => dealIdSet.has(m.toLowerCase()));
      if (matched) {
        if (!DRY_RUN) {
          await pool.query(
            `UPDATE data_library_files SET deal_id = $1 WHERE id = $2 AND deal_id IS NULL`,
            [matched, row.id],
          );
        } else {
          console.log(`  [dry-run] Would set data_library_files.id=${row.id} → deal_id=${matched} (from file_path)`);
        }
        associated++;
      } else {
        skipped++;
      }
    }

    // ── Report ───────────────────────────────────────────────────────────────
    console.log('');
    console.log('─────────────────────────────────────────────');
    console.log(`[backfill] Complete${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);
    console.log(`  Files associated : ${associated}`);
    console.log(`  Files left NULL  : ${skipped}  (legitimate Unaffiliated)`);
    console.log('─────────────────────────────────────────────');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
