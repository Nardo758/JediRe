/**
 * Backfill: populate deal_id and recompute is_subject_property on all
 * historical_observations rows that can be linked to a deal.
 *
 * Phase 1 — populate deal_id (one batch UPDATE via CTE):
 *   For rows with parcel_id but no deal_id, compute effective_parcel_id
 *   in a subquery (COALESCE(properties.parcel_id, deal_properties.property_id::text))
 *   and join against historical_observations.  DISTINCT ON (ho.id) ORDER BY deal_id
 *   gives deterministic selection when a parcel appears in multiple deals.
 *
 * Phase 2 — recompute is_subject_property (two batch UPDATEs via deal-level JOIN):
 *   TRUE  iff  deals.status IN ('owned', 'closed', 'portfolio')
 *   FALSE for all other statuses (pipeline, archived, etc.)
 *
 * Rows with no deal link remain untouched.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill-corpus-subject-property.ts
 *
 * Flags:
 *   --dry-run    Count affected rows without writing
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

    // ── Phase 1: populate deal_id via batch CTE UPDATE ─────────────────────────
    //
    // effective_parcel_id is computed in a subquery so it is defined before the
    // outer join references it (avoids forward-reference bug).
    //
    //   DISTINCT ON (ho.id) ORDER BY ho.id, lnk.deal_id
    //   → deterministic winner when the same parcel is in multiple deals

    const phase1CountSql = `
      SELECT COUNT(*) AS cnt
      FROM historical_observations ho
      JOIN (
        SELECT dp.deal_id, COALESCE(p.parcel_id, dp.property_id::text) AS effective_parcel_id
          FROM deal_properties dp
          LEFT JOIN properties p ON p.id = dp.property_id
      ) lnk ON lnk.effective_parcel_id = ho.parcel_id
      WHERE ho.deal_id IS NULL
        AND ho.parcel_id IS NOT NULL
        AND ho.parcel_id <> ''
    `;

    const phase1CountResult = await pool.query<{ cnt: string }>(phase1CountSql);
    const phase1Eligible = parseInt(phase1CountResult.rows[0]?.cnt ?? '0', 10);
    console.log(`[Phase 1] ${phase1Eligible} corpus row(s) eligible for deal_id population`);

    let linked = 0;
    if (!DRY_RUN && phase1Eligible > 0) {
      const phase1UpdateSql = `
        WITH linked AS (
          SELECT DISTINCT ON (ho.id)
            ho.id      AS corpus_id,
            lnk.deal_id
          FROM historical_observations ho
          JOIN (
            SELECT dp.deal_id, COALESCE(p.parcel_id, dp.property_id::text) AS effective_parcel_id
              FROM deal_properties dp
              LEFT JOIN properties p ON p.id = dp.property_id
          ) lnk ON lnk.effective_parcel_id = ho.parcel_id
          WHERE ho.deal_id IS NULL
            AND ho.parcel_id IS NOT NULL
            AND ho.parcel_id <> ''
          ORDER BY ho.id, lnk.deal_id
        )
        UPDATE historical_observations ho
           SET deal_id = linked.deal_id
          FROM linked
         WHERE ho.id = linked.corpus_id
           AND ho.deal_id IS NULL
      `;
      const r = await pool.query(phase1UpdateSql);
      linked = r.rowCount ?? 0;
    } else if (DRY_RUN) {
      linked = phase1Eligible;
    }

    console.log(`[Phase 1] deal_id populated on ${linked} row(s)${DRY_RUN ? ' (would)' : ''}`);
    console.log('');

    // ── Phase 2: recompute is_subject_property (two batch statements) ───────────
    //
    // Each statement joins historical_observations to deals via deal_id FK — no
    // per-row Python-side loop.

    // Count rows that will change in each direction
    const phase2TrueCountSql = `
      SELECT COUNT(*) AS cnt
      FROM historical_observations ho
      JOIN deals d ON d.id = ho.deal_id
      WHERE d.status = ANY($1::text[])
        AND ho.is_subject_property IS DISTINCT FROM TRUE
    `;
    const phase2FalseCountSql = `
      SELECT COUNT(*) AS cnt
      FROM historical_observations ho
      JOIN deals d ON d.id = ho.deal_id
      WHERE d.status <> ALL($1::text[])
        AND ho.is_subject_property IS DISTINCT FROM FALSE
    `;

    const [trueCountRes, falseCountRes] = await Promise.all([
      pool.query<{ cnt: string }>(phase2TrueCountSql, [SUBJECT_STATUSES]),
      pool.query<{ cnt: string }>(phase2FalseCountSql, [SUBJECT_STATUSES]),
    ]);
    const setTrueCount = parseInt(trueCountRes.rows[0]?.cnt ?? '0', 10);
    const setFalseCount = parseInt(falseCountRes.rows[0]?.cnt ?? '0', 10);

    console.log(`[Phase 2] ${setTrueCount + setFalseCount} corpus row(s) with deal_id need is_subject_property correction`);
    console.log(`  → Set TRUE  : ${setTrueCount}  (deal status in owned/closed/portfolio)`);
    console.log(`  → Set FALSE : ${setFalseCount}  (deal status is pipeline/archived/other)`);

    let setTrue = 0;
    let setFalse = 0;

    if (!DRY_RUN) {
      const [trueRes, falseRes] = await Promise.all([
        pool.query(
          `UPDATE historical_observations ho
              SET is_subject_property = TRUE, updated_at = NOW()
             FROM deals d
            WHERE d.id = ho.deal_id
              AND d.status = ANY($1::text[])
              AND ho.is_subject_property IS DISTINCT FROM TRUE`,
          [SUBJECT_STATUSES],
        ),
        pool.query(
          `UPDATE historical_observations ho
              SET is_subject_property = FALSE, updated_at = NOW()
             FROM deals d
            WHERE d.id = ho.deal_id
              AND d.status <> ALL($1::text[])
              AND ho.is_subject_property IS DISTINCT FROM FALSE`,
          [SUBJECT_STATUSES],
        ),
      ]);
      setTrue = trueRes.rowCount ?? 0;
      setFalse = falseRes.rowCount ?? 0;
    } else {
      setTrue = setTrueCount;
      setFalse = setFalseCount;
    }

    // Count rows still unlinked
    const unlinkedRes = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM historical_observations WHERE deal_id IS NULL`,
    );
    const unlinked = parseInt(unlinkedRes.rows[0]?.cnt ?? '0', 10);

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log('');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`[backfill] Complete${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);
    console.log(`  deal_id linked   : ${linked}`);
    console.log(`  Set TRUE         : ${setTrue}  (deal is owned/closed/portfolio)`);
    console.log(`  Set FALSE        : ${setFalse}  (deal is pipeline/archived/other)`);
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
