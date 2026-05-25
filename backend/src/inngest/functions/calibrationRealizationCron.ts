/**
 * Inngest Cron: M38 Calibration Realization & Pairing
 *
 * Fires nightly at 01:30 UTC.
 *
 * Closes the M35/M38 calibration loop by:
 *   Step 1 — Scan active predictions whose realizationTargetDate has passed
 *   Step 2 — For each matured prediction, extract observed actuals from the
 *             deal's T-12 data (extraction_t12 in deal_data JSONB)
 *   Step 3 — Post RealizationRecords to the calibration ledger
 *   Step 4 — Run the pairing engine (matches predictions ↔ realizations)
 *   Step 5 — Run drift detection across strata that gained new pairings
 *   Step 6 — Log summary
 *
 * Metrics resolved from T-12:
 *   noi_year1       → extraction_t12.noi   (annualized T-12 NOI)
 *   occupancy_year1 → 1 − extraction_t12.vacancy_pct  (or derived from
 *                     vacancy_loss / gpr when vacancy_pct is absent)
 *   rent_growth_yr1 → skipped (T-12 is level-data; growth requires two periods)
 *
 * Without this job:
 *   - The pairing engine has no realizations to match against
 *   - reliability stats stay at nPairings = 0
 *   - Drift alerts never fire
 *   - CI widening factors remain at their bootstrap defaults
 */

import { inngest } from '../../lib/inngest';
import { query } from '../../database/connection';
import { calibrationLedger } from '../../services/sigma/calibration-ledger';
import type { RealizationRecord, StratumKey } from '../../services/sigma/calibration-ledger';
import { logger } from '../../utils/logger';
import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealT12Row {
  deal_id: string;
  noi: number | null;
  gpr: number | null;
  vacancy_loss: number | null;
  vacancy_pct: number | null;
  updated_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive occupancy from T-12 data.
 * Prefers vacancy_pct; falls back to vacancy_loss / gpr.
 */
function deriveOccupancy(row: DealT12Row): number | null {
  if (row.vacancy_pct != null && Number.isFinite(row.vacancy_pct)) {
    return 1 - row.vacancy_pct;
  }
  if (row.gpr != null && row.gpr > 0 && row.vacancy_loss != null) {
    return Math.max(0, Math.min(1, 1 - Math.abs(row.vacancy_loss) / row.gpr));
  }
  return null;
}

/**
 * Build a unique realization ID that is idempotent across runs.
 * Format: real_<dealId>_<metric>_<targetDateYYYYMM>
 */
function realizationId(dealId: string, metric: string, targetDate: Date): string {
  const ym = `${targetDate.getUTCFullYear()}${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}`;
  return `real_${dealId}_${metric}_${ym}`;
}

// ─── Cron Function ────────────────────────────────────────────────────────────

export const calibrationRealizationCron = inngest.createFunction(
  {
    id: 'calibration-realization-nightly',
    name: 'M38: Nightly Calibration Realization & Pairing',
    triggers: [{ cron: '30 1 * * *' }], // Every day at 01:30 UTC
    retries: 2,
  },
  async ({ step }) => {
    // ── Step 1: Find matured predictions ──────────────────────────────────────
    const maturedPredictions = await step.run('find-matured-predictions', async () => {
      const now = new Date();
      const active = calibrationLedger.getActivePredictions();
      const matured = active.filter(p => p.realizationTargetDate <= now && p.source.dealId);

      logger.info('[CalibrationRealizationCron] Matured predictions found', {
        total: active.length,
        matured: matured.length,
      });

      return matured.map(p => ({
        predictionId:          p.predictionId,
        dealId:                p.source.dealId!,
        metric:                p.metric,
        assetClass:            p.assetClass,
        regimeAtPrediction:    p.regimeAtPrediction,
        realizationHorizon:    p.realizationHorizonMonths,
        realizationTargetDate: p.realizationTargetDate.toISOString(),
        submarketId:           p.source.submarketId ?? null,
      }));
    });

    if (maturedPredictions.length === 0) {
      logger.info('[CalibrationRealizationCron] No matured predictions — skipping realization step');
      return { matured: 0, realizations: 0, pairings: 0, driftAlerts: 0 };
    }

    // ── Step 2: Fetch T-12 actuals for each unique deal ───────────────────────
    const t12ByDeal = await step.run('fetch-t12-actuals', async () => {
      const dealIds = [...new Set(maturedPredictions.map(p => p.dealId))];

      if (dealIds.length === 0) return {} as Record<string, DealT12Row>;

      let rows: DealT12Row[] = [];
      try {
        const result = await query<{
          deal_id: string;
          noi: string | null;
          gpr: string | null;
          vacancy_loss: string | null;
          vacancy_pct: string | null;
          updated_at: string | null;
        }>(
          `SELECT
             id                                                    AS deal_id,
             (deal_data->'extraction_t12'->>'noi')::numeric        AS noi,
             (deal_data->'extraction_t12'->>'gpr')::numeric        AS gpr,
             (deal_data->'extraction_t12'->>'vacancy_loss')::numeric AS vacancy_loss,
             (deal_data->'extraction_t12'->>'vacancy_pct')::numeric  AS vacancy_pct,
             updated_at::text                                      AS updated_at
           FROM deals
           WHERE id = ANY($1::uuid[])
             AND deal_data->'extraction_t12' IS NOT NULL`,
          [dealIds],
        );
        rows = result.rows.map(r => ({
          deal_id:      r.deal_id,
          noi:          r.noi != null ? parseFloat(r.noi as unknown as string) : null,
          gpr:          r.gpr != null ? parseFloat(r.gpr as unknown as string) : null,
          vacancy_loss: r.vacancy_loss != null ? parseFloat(r.vacancy_loss as unknown as string) : null,
          vacancy_pct:  r.vacancy_pct != null ? parseFloat(r.vacancy_pct as unknown as string) : null,
          updated_at:   r.updated_at ?? null,
        }));
      } catch (err: any) {
        logger.warn('[CalibrationRealizationCron] T-12 query failed', { err: err?.message });
      }

      const byDeal: Record<string, DealT12Row> = {};
      for (const row of rows) byDeal[row.deal_id] = row;

      logger.info('[CalibrationRealizationCron] T-12 data fetched', {
        dealsRequested: dealIds.length,
        dealsWithT12:   rows.length,
      });

      return byDeal;
    });

    // ── Step 3: Post realization records ──────────────────────────────────────
    const realizationsPosted = await step.run('post-realizations', async () => {
      let posted = 0;
      let skipped = 0;

      for (const pred of maturedPredictions) {
        const t12 = t12ByDeal[pred.dealId];
        if (!t12) {
          skipped++;
          continue;
        }

        const targetDate = new Date(pred.realizationTargetDate);
        const observationDate = t12.updated_at ? new Date(t12.updated_at) : targetDate;

        if (pred.metric === 'noi_year1' && t12.noi != null && Number.isFinite(t12.noi) && t12.noi !== 0) {
          const rid = realizationId(pred.dealId, 'noi_year1', targetDate);
          calibrationLedger.recordRealization({
            realizationId:        rid,
            recordedAt:           new Date(),
            metric:               'noi_year1',
            scope: {
              dealId:     pred.dealId,
              assetClass: t12.noi != null ? pred.assetClass : undefined,
            },
            observationDate,
            observedValue:        t12.noi,
            observationSource:    'extraction_t12',
            measurementUncertainty: 0.05, // ~5% T-12 measurement uncertainty
          } satisfies RealizationRecord);
          posted++;
          logger.debug('[CalibrationRealizationCron] NOI realization posted', {
            dealId: pred.dealId,
            noi: t12.noi,
            rid,
          });
        } else if (pred.metric === 'occupancy_year1') {
          const occupancy = deriveOccupancy(t12);
          if (occupancy != null && Number.isFinite(occupancy)) {
            const rid = realizationId(pred.dealId, 'occupancy_year1', targetDate);
            calibrationLedger.recordRealization({
              realizationId:     rid,
              recordedAt:        new Date(),
              metric:            'occupancy_year1',
              scope: {
                dealId:     pred.dealId,
                assetClass: pred.assetClass,
              },
              observationDate,
              observedValue:     occupancy,
              observationSource: 'extraction_t12',
              measurementUncertainty: 0.02,
            } satisfies RealizationRecord);
            posted++;
            logger.debug('[CalibrationRealizationCron] Occupancy realization posted', {
              dealId: pred.dealId,
              occupancy,
            });
          } else {
            skipped++;
          }
        } else {
          // rent_growth_yr1 and other metrics: T-12 is level-data, not growth-data.
          // Skip until a two-period comparison source is available.
          skipped++;
        }
      }

      logger.info('[CalibrationRealizationCron] Realizations posted', { posted, skipped });
      return { posted, skipped };
    });

    // ── Step 4: Run the pairing engine ────────────────────────────────────────
    const pairingResult = await step.run('run-pairing', async () => {
      try {
        const newPairings = calibrationLedger.runPairing();
        logger.info('[CalibrationRealizationCron] Pairing complete', {
          newPairings: newPairings.length,
        });
        return { newPairings: newPairings.length };
      } catch (err: any) {
        logger.warn('[CalibrationRealizationCron] Pairing failed', { err: err?.message });
        return { newPairings: 0 };
      }
    });

    // ── Step 5: Run drift detection across active strata ──────────────────────
    const driftResult = await step.run('detect-drift', async () => {
      let totalAlerts = 0;

      if (pairingResult.newPairings === 0) {
        return { newAlerts: 0 };
      }

      // Gather unique strata from active predictions that now have pairings
      const strataSet = new Set<string>();
      const strataMap = new Map<string, StratumKey>();

      for (const pred of maturedPredictions) {
        const horizonMonths = pred.realizationHorizon;
        const horizon = horizonMonths <= 12 ? 'short' : horizonMonths <= 36 ? 'medium' : 'long';
        const key: StratumKey = {
          source:     'M38.financials-composer',
          metric:     pred.metric,
          assetClass: pred.assetClass,
          regime:     pred.regimeAtPrediction,
          horizon,
        };
        const keyStr = `${key.source}|${key.metric}|${key.assetClass}|${key.regime}|${key.horizon}`;
        if (!strataSet.has(keyStr)) {
          strataSet.add(keyStr);
          strataMap.set(keyStr, key);
        }
      }

      for (const [, stratum] of strataMap) {
        try {
          const alerts = calibrationLedger.detectDrift(stratum);
          totalAlerts += alerts.length;
          if (alerts.length > 0) {
            logger.info('[CalibrationRealizationCron] Drift alerts raised', {
              stratum: `${stratum.metric}/${stratum.assetClass}/${stratum.regime}`,
              count: alerts.length,
              severities: alerts.map(a => a.severity),
            });
          }
        } catch (err: any) {
          logger.warn('[CalibrationRealizationCron] Drift detection failed for stratum', {
            stratum,
            err: err?.message,
          });
        }
      }

      return { newAlerts: totalAlerts };
    });

    // ── Step 6: Log summary ────────────────────────────────────────────────────
    await step.run('log-summary', async () => {
      const ledgerStats = calibrationLedger.getStats();
      logger.info('[CalibrationRealizationCron] Run complete', {
        maturedPredictions:   maturedPredictions.length,
        realizationsPosted:   realizationsPosted.posted,
        realizationsSkipped:  realizationsPosted.skipped,
        newPairings:          pairingResult.newPairings,
        driftAlertsRaised:    driftResult.newAlerts,
        ledger: {
          nPredictions:     ledgerStats.nPredictions,
          nRealizations:    ledgerStats.nRealizations,
          nPairings:        ledgerStats.nPairings,
          nDriftAlertsOpen: ledgerStats.nDriftAlertsOpen,
        },
      });
    });

    return {
      matured:      maturedPredictions.length,
      realizations: realizationsPosted.posted,
      pairings:     pairingResult.newPairings,
      driftAlerts:  driftResult.newAlerts,
    };
  },
);
