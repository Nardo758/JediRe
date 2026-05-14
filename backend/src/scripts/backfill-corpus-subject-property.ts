/**
 * Backfill: recompute is_subject_property for all historical_observations rows
 * that have a deal association (via parcel → deal_properties → deals.status).
 *
 * Rule: is_subject_property = TRUE only when the linked deal's status is
 *       one of: owned | closed | portfolio.
 *
 * All other statuses (lead, evaluating, underwriting, negotiating,
 * in_diligence, closing, archived, active …) → FALSE.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill-corpus-subject-property.ts
 *
 * Flags:
 *   --dry-run    Print counts without writing
 */

import { Pool } from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');
const SUBJECT_STATUSES = ['owned', 'closed', 'portfolio'];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log(`[backfill-corpus-subject-property] Starting${DRY_RUN ? ' (DRY RUN)' : ''}`);
    console.log(`  Subject statuses : ${SUBJECT_STATUSES.join(', ')}`);
    console.log('');

    // ── Fetch all (parcel_id, deal_status) pairs ──────────────────────────
    // A parcel can be linked to multiple deals; we take the most permissive
    // status — if ANY linked deal is owned/closed/portfolio, the parcel is
    // subject (the operator chose to upload docs for it in that capacity).
    const parcelRows = await pool.query<{ parcel_id: string; deal_status: string }>(`
      SELECT
        COALESCE(p.parcel_id, dp.property_id::text) AS parcel_id,
        d.status AS deal_status
      FROM deal_properties dp
      JOIN deals d ON d.id = dp.deal_id
      LEFT JOIN properties p ON p.id = dp.property_id
      WHERE dp.property_id IS NOT NULL
    `);

    // Build a map: parcel_id → isSubject
    const parcelSubject = new Map<string, boolean>();
    for (const row of parcelRows.rows) {
      const current = parcelSubject.get(row.parcel_id) ?? false;
      const isSubject = SUBJECT_STATUSES.includes(row.deal_status);
      parcelSubject.set(row.parcel_id, current || isSubject);
    }

    console.log(`[backfill] Resolved ${parcelSubject.size} distinct parcel(s) with deal links`);

    // ── Fetch all corpus rows that have a parcel_id ───────────────────────
    const corpusRows = await pool.query<{
      id: string;
      parcel_id: string;
      is_subject_property: boolean;
    }>(`
      SELECT id, parcel_id, is_subject_property
      FROM historical_observations
      WHERE parcel_id IS NOT NULL AND parcel_id <> ''
    `);

    console.log(`[backfill] ${corpusRows.rows.length} corpus row(s) to evaluate`);

    let setTrue = 0;
    let setFalse = 0;
    let unchanged = 0;
    let unlinked = 0;

    for (const row of corpusRows.rows) {
      const isSubject = parcelSubject.get(row.parcel_id);

      if (isSubject === undefined) {
        // No deal link found — leave is_subject_property as-is
        unlinked++;
        continue;
      }

      if (row.is_subject_property === isSubject) {
        unchanged++;
        continue;
      }

      if (!DRY_RUN) {
        await pool.query(
          `UPDATE historical_observations
              SET is_subject_property = $1, updated_at = NOW()
            WHERE id = $2`,
          [isSubject, row.id],
        );
      }

      if (isSubject) {
        setTrue++;
      } else {
        setFalse++;
      }
    }

    // ── Report ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`[backfill] Complete${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);
    console.log(`  Set TRUE   : ${setTrue}  (deal now owned/closed/portfolio)`);
    console.log(`  Set FALSE  : ${setFalse}  (deal is pipeline/archived/other)`);
    console.log(`  Unchanged  : ${unchanged}`);
    console.log(`  No deal link (unlinked parcels — untouched) : ${unlinked}`);
    console.log('─────────────────────────────────────────────────────────────');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[backfill-corpus-subject-property] Fatal error:', err);
  process.exit(1);
});
