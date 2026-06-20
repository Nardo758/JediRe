/**
 * Inngest Cron: Asset Class Spread Backtest Calibration
 *
 * Fires on the 10th of each month at 04:00 UTC (after actual_performance
 * has been populated by monthly snapshots and BLS CPI data is fresh).
 *
 * What it does
 * ─────────────
 * Step 1 — Run AssetClassSpreadBacktestService with 5-year lookback
 * Step 2 — Store the calibration report in asset_class_spread_calibration
 *          (so the UI can show the operator a comparison table)
 * Step 3 — Log summary with any asset classes that show significant bias
 *
 * Without this job
 * ─────────────────
 * - ASSET_CLASS_SPREAD_BPS remains static seed values from 2026-04-29
 * - No empirical validation that assumed spreads match realized performance
 * - Rent growth forecasts may systematically over/under-shoot by asset class
 */

import { inngest } from '../../lib/inngest';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { AssetClassSpreadBacktestService } from '../../services/proforma/asset-class-spread-backtest.service';

export const assetClassSpreadBacktestCron = inngest.createFunction(
  {
    id: 'asset-class-spread-backtest',
    name: 'Pro Forma: Monthly asset-class spread backtest calibration',
    triggers: [{ cron: '0 4 10 * *' }], // 10th of each month at 04:00 UTC
    retries: 2,
  },
  async ({ step }) => {

    // ── Step 1: Run backtest ────────────────────────────────────────────────
    const report = await step.run('run-backtest', async () => {
      const pool = getPool();
      const service = new AssetClassSpreadBacktestService(pool);
      return service.runBacktest(5, 10);
    });

    // ── Step 2: Persist report ──────────────────────────────────────────────
    await step.run('persist-report', async () => {
      const pool = getPool();
      for (const result of report.results) {
        await pool.query(
          `INSERT INTO asset_class_spread_calibration (
            computed_at, asset_class, sample_size, assumed_spread_bps,
            empirical_spread_bps, empirical_spread_median, bias_bps,
            t_stat, p_value, recommended_spread_bps, recommendation, confidence,
            property_list, property_details
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (computed_at, asset_class) DO UPDATE SET
            sample_size = EXCLUDED.sample_size,
            assumed_spread_bps = EXCLUDED.assumed_spread_bps,
            empirical_spread_bps = EXCLUDED.empirical_spread_bps,
            empirical_spread_median = EXCLUDED.empirical_spread_median,
            bias_bps = EXCLUDED.bias_bps,
            t_stat = EXCLUDED.t_stat,
            p_value = EXCLUDED.p_value,
            recommended_spread_bps = EXCLUDED.recommended_spread_bps,
            recommendation = EXCLUDED.recommendation,
            confidence = EXCLUDED.confidence,
            property_list = EXCLUDED.property_list,
            property_details = EXCLUDED.property_details,
            updated_at = NOW()`,
          [
            report.computedAt,
            result.assetClass,
            result.sampleSize,
            result.assumedSpreadBps,
            result.empiricalSpreadBps,
            result.empiricalSpreadMedian,
            result.biasBps,
            result.tStat,
            result.pValue,
            result.recommendedSpreadBps,
            result.recommendation,
            result.confidence,
            JSON.stringify(result.properties),
            JSON.stringify(result.propertyDetails),
          ]
        );
      }
      logger.info('[AssetClassSpreadBacktest] Persisted calibration report', {
        classes: report.results.length,
        totalObservations: report.totalObservations,
      });
    });

    // ── Step 3: Log summary ─────────────────────────────────────────────────
    await step.run('log-summary', async () => {
      const significantBias = report.results.filter(
        r => r.confidence === 'high' && Math.abs(r.biasBps) > 15
      );
      const insufficient = report.results.filter(r => r.confidence === 'low');

      logger.info('[AssetClassSpreadBacktest] Monthly calibration complete', {
        computedAt: report.computedAt,
        totalObservations: report.totalObservations,
        totalProperties: report.totalPropertiesAnalyzed,
        classesAnalyzed: report.results.length,
        significantBias: significantBias.map(r => ({
          assetClass: r.assetClass,
          assumed: r.assumedSpreadBps,
          empirical: r.empiricalSpreadMedian,
          bias: r.biasBps,
          recommended: r.recommendedSpreadBps,
        })),
        insufficientData: insufficient.map(r => r.assetClass),
        overall: report.summary.overallRecommendation,
      });
    });

    return {
      classesAnalyzed: report.results.length,
      totalObservations: report.totalObservations,
      significantBiasCount: report.results.filter(
        r => r.confidence === 'high' && Math.abs(r.biasBps) > 15
      ).length,
    };
  },
);
