/**
 * Inngest Cron: Nightly Property Reconciliation
 * Phase 2 — Property Plumbing Refactor
 *
 * Fires nightly at 03:00 UTC.
 * Checks:
 *   1. Row-count parity between old tables and new tables (within tolerance)
 *   2. Random 100-row sample field-level comparison
 *   3. Dual-write failure log review (any unresolved failures from prior day)
 *   4. Deal linkage audit (any deals still missing deals.property_id)
 *
 * Must run clean for 5 consecutive nights before Phase 3 starts.
 * A "clean" run = no parity divergence and no unresolved dual-write failures.
 */

import { inngest } from '../../lib/inngest';
import { getPool } from '../../database/connection';
import { dealPropertyLinkService } from '../../services/property-entity/deal-property-link.service';
import { logger } from '../../utils/logger';

const PARITY_TOLERANCE = 0.05; // 5% row-count variance allowed during active backfill

export const propertyReconciliationNightly = inngest.createFunction(
  {
    id: 'property-reconciliation-nightly',
    name: 'Property Plumbing: nightly reconciliation (Phase 2)',
    triggers: [{ cron: '0 3 * * *' }],
    retries: 1,
    timeouts: { finish: '10m' },
  },
  async ({ step }) => {
    const pool = getPool();

    // ── Step 1: Row-count parity ─────────────────────────────────────────────
    const parityResult = await step.run('row-count-parity', async () => {
      const checks: Array<{
        label: string;
        oldCount: number;
        newCount: number;
        ratio: number;
        pass: boolean;
      }> = [];

      // property_info_cache vs property_characteristics
      const picRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM property_info_cache WHERE property_id IS NOT NULL`
      );
      const charRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM property_characteristics`
      );
      const picCount = parseInt(picRes.rows[0].cnt, 10);
      const charCount = parseInt(charRes.rows[0].cnt, 10);
      const charRatio = picCount > 0 ? charCount / picCount : 0;
      checks.push({
        label: 'property_info_cache → property_characteristics',
        oldCount: picCount,
        newCount: charCount,
        ratio: charRatio,
        pass: charRatio >= (1 - PARITY_TOLERANCE),
      });

      // georgia_property_sales vs property_sales (county_recorded)
      const gpsRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM georgia_property_sales`
      );
      const psRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM property_sales WHERE source = 'county_recorded'`
      );
      const gpsCount = parseInt(gpsRes.rows[0].cnt, 10);
      const psCount = parseInt(psRes.rows[0].cnt, 10);
      const psRatio = gpsCount > 0 ? psCount / gpsCount : 0;
      checks.push({
        label: 'georgia_property_sales → property_sales',
        oldCount: gpsCount,
        newCount: psCount,
        ratio: psRatio,
        pass: psRatio >= (1 - PARITY_TOLERANCE),
      });

      // deals without property_id
      const unlinkedRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM deals WHERE property_id IS NULL`
      );
      const unlinkedCount = parseInt(unlinkedRes.rows[0].cnt, 10);
      checks.push({
        label: 'deals.property_id coverage',
        oldCount: unlinkedCount,
        newCount: unlinkedCount,
        ratio: 1,
        pass: unlinkedCount === 0,
      });

      const allPass = checks.every((c) => c.pass);
      logger.info('[PropertyReconciliation] Row-count parity', { checks, allPass });

      return { checks, allPass };
    });

    // ── Step 2: 100-row sample field comparison ──────────────────────────────
    const sampleResult = await step.run('sample-field-comparison', async () => {
      // Sample property_characteristics vs property_info_cache
      const sample = await pool.query(`
        SELECT
          pc.property_id,
          pc.unit_count       AS char_units,
          pc.building_sf      AS char_sf,
          pic.number_of_units AS cache_units,
          pic.living_area_sqft AS cache_sf
        FROM property_characteristics pc
        JOIN property_info_cache pic
          ON  pic.property_id = pc.property_id
          AND pic.fetched_at::date = pc.effective_from
        ORDER BY RANDOM()
        LIMIT 100
      `);

      let mismatches = 0;
      const mismatchDetails: string[] = [];

      for (const row of sample.rows) {
        const unitMismatch =
          row.char_units !== null &&
          row.cache_units !== null &&
          String(row.char_units) !== String(row.cache_units);
        if (unitMismatch) {
          mismatches++;
          mismatchDetails.push(
            `property_id=${row.property_id}: char.unit_count=${row.char_units} vs pic.number_of_units=${row.cache_units}`
          );
        }
      }

      const pass = mismatches === 0;
      logger.info('[PropertyReconciliation] Sample field comparison', {
        sampleSize: sample.rows.length,
        mismatches,
        pass,
      });

      return { sampleSize: sample.rows.length, mismatches, mismatchDetails, pass };
    });

    // ── Step 3: Dual-write failure review ────────────────────────────────────
    const failureResult = await step.run('dual-write-failure-review', async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const recentFailures = await pool.query(
        `SELECT write_path, old_table, new_table, parcel_id, county,
                deal_id, error_message, occurred_at
         FROM property_dual_write_failures
         WHERE occurred_at >= $1
           AND resolved_at IS NULL
         ORDER BY occurred_at DESC
         LIMIT 50`,
        [dayAgo]
      );

      const unresolvedOld = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM property_dual_write_failures
         WHERE resolved_at IS NULL
           AND occurred_at < $1`,
        [dayAgo]
      );

      const recentCount = recentFailures.rows.length;
      const unresolvedOldCount = parseInt(unresolvedOld.rows[0].cnt, 10);
      const pass = recentCount === 0 && unresolvedOldCount === 0;

      if (!pass) {
        logger.warn('[PropertyReconciliation] Dual-write failures detected', {
          recentCount,
          unresolvedOldCount,
          sample: recentFailures.rows.slice(0, 5),
        });
      } else {
        logger.info('[PropertyReconciliation] No dual-write failures in rolling window');
      }

      return { recentCount, unresolvedOldCount, pass };
    });

    // ── Step 4: Deal linkage audit ───────────────────────────────────────────
    const linkageResult = await step.run('deal-linkage-audit', async () => {
      const unlinked = await dealPropertyLinkService.getUnlinkedDeals();
      const pass = unlinked.length === 0;

      if (!pass) {
        logger.warn('[PropertyReconciliation] Unlinked deals detected', {
          count: unlinked.length,
          sample: unlinked.slice(0, 10),
        });
      } else {
        logger.info('[PropertyReconciliation] All deals have deals.property_id populated');
      }

      return { unlinkedCount: unlinked.length, pass };
    });

    // ── Step 5: Summary ──────────────────────────────────────────────────────
    const overallPass =
      parityResult.allPass &&
      sampleResult.pass &&
      failureResult.pass &&
      linkageResult.pass;

    await step.run('log-summary', async () => {
      logger.info('[PropertyReconciliation] Nightly run complete', {
        overallPass,
        parity: parityResult,
        sample: {
          size: sampleResult.sampleSize,
          mismatches: sampleResult.mismatches,
          pass: sampleResult.pass,
        },
        failures: {
          recentCount: failureResult.recentCount,
          unresolvedOldCount: failureResult.unresolvedOldCount,
          pass: failureResult.pass,
        },
        linkage: linkageResult,
      });

      if (!overallPass) {
        logger.error(
          '[PropertyReconciliation] ALERT: reconciliation failed — Phase 3 gate NOT clear',
          {
            parityFailed: !parityResult.allPass,
            sampleFailed: !sampleResult.pass,
            failuresFailed: !failureResult.pass,
            linkageFailed: !linkageResult.pass,
          }
        );
      }
    });

    return {
      overallPass,
      parity: parityResult,
      sampleMismatches: sampleResult.mismatches,
      dualWriteFailures: failureResult.recentCount,
      unlinkedDeals: linkageResult.unlinkedCount,
    };
  }
);
