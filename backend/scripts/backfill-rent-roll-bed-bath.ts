/**
 * Task #1184 — One-time backfill: bedroom/bathroom counts on extracted rent rolls
 *
 * Deals whose rent rolls were extracted before Task #1150 have floor_plan_mix
 * entries without `bedrooms`/`bathrooms` fields. This script infers those values
 * from the plan-name key using the same helpers used in rent-roll-parser.ts and
 * writes the enriched object back to deals.deal_data JSONB.
 *
 * Safe to re-run: only touches plan entries where bedrooms IS NULL (pg cast) or
 * the key is absent — already-enriched entries are skipped.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-rent-roll-bed-bath.ts
 *   cd backend && npx ts-node --transpile-only scripts/backfill-rent-roll-bed-bath.ts --dry-run
 */

import { getPool, connectDatabase } from '../src/database/connection';
import { logger } from '../src/utils/logger';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Inference helpers (mirrors rent-roll-parser.ts) ──────────────────────────

function inferBedrooms(unitType: string): string {
  const t = unitType.toLowerCase();
  if (/\b(studio|stu|eff|^s\d|_s\d|_sa)\b/.test(t)) return 'Studio';
  if (/(^|_|\b)1[a-z]?(\d|$|_)/.test(t) || /1br/.test(t)) return '1BR';
  if (/(^|_|\b)2[a-z]?(\d|$|_)/.test(t) || /2br/.test(t)) return '2BR';
  if (/(^|_|\b)3[a-z]?(\d|$|_)/.test(t) || /3br/.test(t)) return '3BR';
  if (/(^|_|\b)4[a-z]?(\d|$|_)/.test(t) || /4br/.test(t)) return '4BR+';
  return 'Unknown';
}

function bedroomCountFromCategory(category: string): number {
  if (category === 'Studio') return 0;
  if (category === '1BR') return 1;
  if (category === '2BR') return 2;
  if (category === '3BR') return 3;
  if (category === '4BR+') return 4;
  return 1;
}

function inferBathrooms(unitType: string, beds: number): number {
  const t = unitType.toLowerCase();
  const baM = t.match(/[\/\s](\d)\s*ba/) ?? t.match(/(\d)\s*ba/);
  if (baM) return parseInt(baM[1], 10);
  const slashM = t.match(/\d+\s*\/\s*(\d+)/);
  if (slashM) return parseInt(slashM[1], 10);
  return beds === 0 ? 1 : beds >= 3 ? 2 : beds;
}

// ─────────────────────────────────────────────────────────────────────────────

interface DealRow {
  id: string;
  floor_plan_mix: Record<string, Record<string, unknown>>;
}

async function main() {
  logger.info('[backfill-rent-roll-bed-bath] Starting', { dryRun: DRY_RUN });

  await connectDatabase();
  const pool = getPool();

  // Select deals that have an extraction_rent_roll with a non-empty floor_plan_mix
  // where at least one plan entry is missing the bedrooms key.
  const res = await pool.query<{ id: string; floor_plan_mix: string }>(`
    SELECT d.id,
           d.deal_data -> 'extraction_rent_roll' -> 'floor_plan_mix' AS floor_plan_mix
      FROM deals d
     WHERE d.deal_data -> 'extraction_rent_roll' -> 'floor_plan_mix' IS NOT NULL
       AND d.deal_data -> 'extraction_rent_roll' -> 'floor_plan_mix' != 'null'::jsonb
       AND EXISTS (
         SELECT 1
           FROM jsonb_each(d.deal_data -> 'extraction_rent_roll' -> 'floor_plan_mix') kv
          WHERE (kv.value -> 'bedrooms') IS NULL
       )
     ORDER BY d.id
  `);

  const rows = res.rows;
  logger.info('[backfill-rent-roll-bed-bath] Deals needing backfill', { count: rows.length });

  if (rows.length === 0) {
    logger.info('[backfill-rent-roll-bed-bath] Nothing to do — all floor_plan_mix entries already have bed/bath counts.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const dealId = row.id;

    // floor_plan_mix arrives as a parsed JS object from pg's JSONB handling
    const fpm = (typeof row.floor_plan_mix === 'string'
      ? JSON.parse(row.floor_plan_mix)
      : row.floor_plan_mix) as Record<string, Record<string, unknown>>;

    if (!fpm || typeof fpm !== 'object') {
      logger.warn('[backfill-rent-roll-bed-bath] Unexpected floor_plan_mix shape', { dealId });
      skipped++;
      continue;
    }

    let enriched = false;
    for (const planName of Object.keys(fpm)) {
      const entry = fpm[planName];
      if (entry == null || typeof entry !== 'object') continue;

      // Only fill in missing fields — leave explicit nulls/zeros already present
      if (entry.bedrooms == null || entry.bathrooms == null) {
        const beds = bedroomCountFromCategory(inferBedrooms(planName));
        const baths = inferBathrooms(planName, beds);
        if (entry.bedrooms == null) {
          entry.bedrooms = beds;
          enriched = true;
        }
        if (entry.bathrooms == null) {
          entry.bathrooms = baths;
          enriched = true;
        }
      }
    }

    if (!enriched) {
      // All entries already had both fields (race condition or mis-filter)
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      logger.info('[backfill-rent-roll-bed-bath] DRY RUN — would update', {
        dealId,
        plans: Object.entries(fpm).map(([k, v]) => ({ plan: k, bedrooms: v.bedrooms, bathrooms: v.bathrooms })),
      });
      skipped++;
      continue;
    }

    try {
      await pool.query(
        `UPDATE deals
            SET deal_data = jsonb_set(
                  deal_data,
                  '{extraction_rent_roll,floor_plan_mix}',
                  $2::jsonb,
                  false
                )
          WHERE id = $1`,
        [dealId, JSON.stringify(fpm)],
      );
      logger.info('[backfill-rent-roll-bed-bath] Updated', {
        dealId,
        plans: Object.keys(fpm).length,
      });
      updated++;
    } catch (err) {
      logger.error('[backfill-rent-roll-bed-bath] Failed to update', {
        dealId,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  logger.info('[backfill-rent-roll-bed-bath] Complete', {
    total: rows.length,
    updated,
    skipped,
    failed,
    dryRun: DRY_RUN,
  });
}

main().catch(err => {
  logger.error('[backfill-rent-roll-bed-bath] Fatal error', { error: String(err) });
  process.exit(1);
});
