/**
 * Backfill: populate deal_id and recompute is_subject_property on all
 * historical_observations rows that can be linked to a deal.
 *
 * Phase 1 — populate deal_id:
 *   For rows with parcel_id but no deal_id, join through
 *   deal_properties → properties to find the owning deal.
 *   When a parcel appears in multiple deals, each row gets the deal whose
 *   parcel_id match is exact (or the first match, if ambiguous).
 *
 * Phase 2 — recompute is_subject_property per row's own deal_id:
 *   TRUE  iff  deals.status IN ('owned', 'closed', 'portfolio')
 *   FALSE for all other statuses (pipeline, archived, etc.)
 *
 * Rows with no deal link (unaffiliated parcels) are left untouched.
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

    // ── Phase 1: populate deal_id on rows that have a parcel_id but no deal_id ─

    // Find corpus rows with no deal_id but with a parcel_id that maps to a deal
    const toLink = await pool.query<{
      corpus_id: string;
      parcel_id: string;
      deal_id: string;
    }>(`
      SELECT DISTINCT ON (ho.id)
        ho.id           AS corpus_id,
        ho.parcel_id,
        dp.deal_id
      FROM historical_observations ho
      JOIN deal_properties dp
        ON COALESCE(p.parcel_id, dp.property_id::text) = ho.parcel_id
      LEFT JOIN properties p ON p.id = dp.property_id
      WHERE ho.deal_id IS NULL
        AND ho.parcel_id IS NOT NULL
        AND ho.parcel_id <> ''
      ORDER BY ho.id, dp.deal_id
    `);

    console.log(`[Phase 1] ${toLink.rows.length} corpus row(s) eligible for deal_id population`);

    let linked = 0;
    for (const row of toLink.rows) {
      if (!DRY_RUN) {
        await pool.query(
          `UPDATE historical_observations SET deal_id = $1 WHERE id = $2 AND deal_id IS NULL`,
          [row.deal_id, row.corpus_id],
        );
      } else {
        console.log(`  [dry-run] Would set id=${row.corpus_id} → deal_id=${row.deal_id}`);
      }
      linked++;
    }
    console.log(`[Phase 1] deal_id populated on ${linked} row(s)${DRY_RUN ? ' (would)' : ''}`);
    console.log('');

    // ── Phase 2: recompute is_subject_property based on each row's own deal ───

    // Fetch all corpus rows that now have a deal_id (including newly linked)
    const corpusRows = await pool.query<{
      id: string;
      deal_id: string;
      is_subject_property: boolean;
      deal_status: string;
    }>(`
      SELECT ho.id, ho.deal_id, ho.is_subject_property, d.status AS deal_status
        FROM historical_observations ho
        JOIN deals d ON d.id = ho.deal_id
       WHERE ho.deal_id IS NOT NULL
    `);

    console.log(`[Phase 2] ${corpusRows.rows.length} corpus row(s) with deal_id to evaluate`);

    let setTrue = 0;
    let setFalse = 0;
    let unchanged = 0;

    for (const row of corpusRows.rows) {
      const isSubject = SUBJECT_STATUSES.includes(row.deal_status);

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

      if (isSubject) setTrue++;
      else setFalse++;
    }

    // Rows with no deal link (unaffiliated parcels)
    const unlinkedResult = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM historical_observations WHERE deal_id IS NULL`,
    );
    const unlinked = parseInt(unlinkedResult.rows[0]?.cnt ?? '0', 10);

    // ── Report ─────────────────────────────────────────────────────────────────
    console.log('');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`[backfill] Complete${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);
    console.log(`  deal_id linked   : ${linked}`);
    console.log(`  Set TRUE         : ${setTrue}  (deal is owned/closed/portfolio)`);
    console.log(`  Set FALSE        : ${setFalse}  (deal is pipeline/archived/other)`);
    console.log(`  Unchanged        : ${unchanged}`);
    console.log(`  No deal link     : ${unlinked}  (unaffiliated parcels — untouched)`);
    console.log('─────────────────────────────────────────────────────────────');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[backfill-corpus-subject-property] Fatal error:', err);
  process.exit(1);
});
