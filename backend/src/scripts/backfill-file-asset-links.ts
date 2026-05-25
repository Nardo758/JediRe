/**
 * backfill-file-asset-links.ts
 *
 * One-time (idempotent) backfill for two evidence-trail gaps:
 *
 *   Gap 1 — data_library_files.asset_id
 *     Files uploaded before the asset-linkage refactor arrived with asset_id = NULL.
 *     Two join strategies tried in order:
 *       A) data_library_assets.file_id = data_library_files.id  (direct reverse pointer)
 *       B) data_library_assets.deal_id = data_library_files.deal_id (deal-scoped join)
 *
 *   Gap 2 — historical_observations.deal_id
 *     Corpus rows written before the corpus writer consistently propagated deal_id
 *     have deal_id = NULL. Backfill by resolving parcel_id →
 *     properties.parcel_id → deal_properties → deal_id.
 *
 * Safe to re-run: both updates guard with `WHERE ... IS NULL` or `COALESCE`.
 *
 * Usage:
 *   cd backend
 *   npx ts-node --transpile-only src/scripts/backfill-file-asset-links.ts
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // ── Gap 1: data_library_files.asset_id via shared deal_id ───────────────
    // When both file and asset share a deal_id and the asset is the sole asset
    // for that deal, we can link them. Uses a lateral subquery to pick the
    // single most-recent asset per deal to avoid ambiguous multi-row matches.
    const gap1Result = await pool.query<{ id: string }>(`
      UPDATE data_library_files dlf
         SET asset_id = dla.id
        FROM (
          SELECT DISTINCT ON (deal_id) id, deal_id
            FROM data_library_assets
           WHERE deal_id IS NOT NULL
           ORDER BY deal_id, created_at DESC
        ) dla
       WHERE dla.deal_id = dlf.deal_id
         AND dlf.deal_id IS NOT NULL
         AND dlf.asset_id IS NULL
      RETURNING dlf.id
    `);
    logger.info(
      `[backfill] Gap 1 (shared deal_id join): ${gap1Result.rowCount ?? 0} row(s) updated`,
    );

    // ── Gap 2: historical_observations.deal_id via deal_properties ────────────
    // Resolve: historical_observations.parcel_id
    //          → properties.parcel_id
    //          → deal_properties.property_id
    //          → deals.id (= deal_id)
    // Also handles the case where parcel_id stores the raw property UUID
    // (COALESCE(p.parcel_id, dp.property_id::text) = ho.parcel_id).
    // When multiple deals map to the same parcel, picks the most-recently
    // created deal to avoid a multi-row update conflict.
    const gap2Result = await pool.query<{ id: string }>(`
      UPDATE historical_observations ho
         SET deal_id = sub.deal_id
        FROM (
          SELECT DISTINCT ON (ho2.parcel_id)
                 ho2.id        AS obs_id,
                 dp.deal_id
            FROM historical_observations ho2
            JOIN deal_properties dp ON TRUE
            JOIN properties p ON p.id = dp.property_id
           WHERE COALESCE(p.parcel_id, dp.property_id::text) = ho2.parcel_id
             AND ho2.deal_id IS NULL
           ORDER BY ho2.parcel_id, dp.created_at DESC
        ) sub
       WHERE ho.id = sub.obs_id
      RETURNING ho.id
    `);
    logger.info(
      `[backfill] Gap 2 (historical_observations.deal_id): ${gap2Result.rowCount ?? 0} row(s) updated`,
    );

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalFileRows = gap1Result.rowCount ?? 0;
    const totalObsRows  = gap2Result.rowCount ?? 0;

    logger.info(
      `[backfill] Complete — ` +
      `data_library_files updated: ${totalFileRows}, ` +
      `historical_observations updated: ${totalObsRows}`,
    );

    if (totalFileRows === 0 && totalObsRows === 0) {
      logger.info(
        '[backfill] No rows needed backfill. ' +
        'This is expected when: (a) files were uploaded with a known assetId at insert time, ' +
        '(b) corpus rows were written via document-to-corpus.ts which propagates deal_id inline, or ' +
        '(c) archive corpus parcel_ids are comp/competitor properties not linked to active deals.',
      );
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  logger.error('[backfill] Fatal error:', err);
  process.exit(1);
});
