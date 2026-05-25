import { Router, Request, Response } from 'express';
import { calibrationLedger } from '../../services/sigma/calibration-ledger';
import type { PredictionRecord, RealizationRecord, StratumKey } from '../../services/sigma/calibration-ledger';
import { query } from '../../database/connection';

const router = Router();

/**
 * POST /api/v1/calibration/predictions
 * Record a prediction emission.
 * spec §9
 */
router.post('/predictions', (req: Request, res: Response) => {
  try {
    const prediction = req.body as PredictionRecord;
    if (!prediction.predictionId || !prediction.source?.module || !prediction.metric) {
      return res.status(400).json({ success: false, error: 'Missing required fields: predictionId, source.module, metric' });
    }
    calibrationLedger.recordPrediction(prediction);
    return res.json({ success: true, data: { predictionId: prediction.predictionId } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Prediction recording error' });
  }
});

/**
 * POST /api/v1/calibration/realizations
 * Record a realized outcome.
 * spec §9
 */
router.post('/realizations', (req: Request, res: Response) => {
  try {
    const realization = req.body as RealizationRecord;
    if (!realization.realizationId || !realization.metric || realization.observedValue == null) {
      return res.status(400).json({ success: false, error: 'Missing required fields: realizationId, metric, observedValue' });
    }
    calibrationLedger.recordRealization(realization);
    return res.json({ success: true, data: { realizationId: realization.realizationId } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Realization recording error' });
  }
});

/**
 * POST /api/v1/calibration/pair
 * Run the pairing engine.
 * spec §9
 */
router.post('/pair', (req: Request, res: Response) => {
  try {
    const { since } = req.body as { since?: string };
    const sinceDate = since ? new Date(since) : undefined;
    const pairings = calibrationLedger.runPairing(sinceDate);
    return res.json({ success: true, data: { pairingsCreated: pairings.length } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Pairing error' });
  }
});

/**
 * GET /api/v1/calibration/reliability
 * Get reliability stats for a stratum.
 * spec §9
 */
router.get('/reliability', (req: Request, res: Response) => {
  try {
    const { source, metric, assetClass, regime, horizon } = req.query as Record<string, string>;
    const stratum: StratumKey = {
      source: source ?? 'all',
      metric: metric ?? 'all',
      assetClass: assetClass ?? 'multifamily',
      regime: regime ?? 'Expansion',
      horizon: horizon ?? 'medium',
    };
    const stats = calibrationLedger.computeReliability(stratum);
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Reliability error' });
  }
});

/**
 * GET /api/v1/calibration/factors
 * Get calibration factors for a stratum.
 * spec §9
 */
router.get('/factors', (req: Request, res: Response) => {
  try {
    const { source, metric, assetClass, regime } = req.query as Record<string, string>;
    const stratum: StratumKey = {
      source: source ?? 'all',
      metric: metric ?? 'all',
      assetClass: assetClass ?? 'multifamily',
      regime: regime ?? 'Expansion',
      horizon: 'medium',
    };
    const factors = calibrationLedger.computeCalibrationFactors(stratum);
    return res.json({ success: true, data: factors });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Factors error' });
  }
});

/**
 * GET /api/v1/calibration/profile
 * Get calibration profile for an agent.
 * spec §9
 */
router.get('/profile', (req: Request, res: Response) => {
  try {
    const { source, version, assetClass, regime } = req.query as Record<string, string>;
    if (!source) {
      return res.status(400).json({ success: false, error: 'Missing required field: source' });
    }
    const profile = calibrationLedger.getAgentProfile(source, version, assetClass, regime);
    return res.json({ success: true, data: profile });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Profile error' });
  }
});

/**
 * GET /api/v1/calibration/drift
 * Get drift alerts.
 * spec §9
 */
router.get('/drift', (req: Request, res: Response) => {
  try {
    const { status, since, metric } = req.query as Record<string, string>;
    const sinceDate = since ? new Date(since) : undefined;
    const alerts = calibrationLedger.getDriftAlerts(status, sinceDate, metric);
    return res.json({ success: true, data: alerts });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Drift error' });
  }
});

/**
 * POST /api/v1/calibration/drift/:id/acknowledge
 * Acknowledge a drift alert.
 */
router.post('/drift/:id/acknowledge', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body as { resolutionNotes?: string };
    const ok = calibrationLedger.acknowledgeDrift(id, resolutionNotes ?? 'Acknowledged');
    if (!ok) {
      return res.status(404).json({ success: false, error: `Alert ${id} not found` });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Acknowledge error' });
  }
});

/**
 * GET /api/v1/calibration/diagram
 * Get reliability diagram data for UI rendering.
 */
router.get('/diagram', (req: Request, res: Response) => {
  try {
    const { source, metric, assetClass, regime } = req.query as Record<string, string>;
    const stratum: StratumKey = {
      source: source ?? 'all',
      metric: metric ?? 'all',
      assetClass: assetClass ?? 'multifamily',
      regime: regime ?? 'Expansion',
      horizon: 'medium',
    };
    const stats = calibrationLedger.computeReliability(stratum);
    const points = [
      { stated: 0.50, captured: stats.captured50 },
      { stated: 0.80, captured: stats.captured80 },
      { stated: 0.90, captured: stats.captured90 },
      { stated: 0.95, captured: stats.captured95 },
    ];
    return res.json({ success: true, data: { points, nPairings: stats.nPairings, reliabilityScore: stats.reliabilityScore } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Diagram error' });
  }
});

/**
 * GET /api/v1/calibration/stats
 * Get ledger statistics.
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = calibrationLedger.getStats();
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Stats error' });
  }
});

/**
 * POST /api/v1/calibration/realize
 * Manual trigger for the M38 realization + pairing loop.
 *
 * Equivalent to one run of the nightly calibrationRealizationCron.
 * Useful for admin testing, seeding actuals after backfill, or
 * verifying that a newly composed deal's predictions can be matched.
 *
 * Query params (all optional):
 *   dealId — limit to a single deal (still queries T-12 from DB)
 *
 * Returns: { realizations, pairings, driftAlerts }
 */
router.post('/realize', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.query as { dealId?: string };
    const now = new Date();

    // Walk matured active predictions
    let active = calibrationLedger.getActivePredictions().filter(
      p => p.realizationTargetDate <= now && p.source.dealId,
    );
    if (dealId) {
      active = active.filter(p => p.source.dealId === dealId);
    }

    if (active.length === 0) {
      return res.json({ success: true, data: { realizations: 0, pairings: 0, driftAlerts: 0, message: 'No matured predictions found' } });
    }

    // Fetch T-12 actuals for relevant deals
    const dealIds = [...new Set(active.map(p => p.source.dealId!))];
    let t12ByDeal: Record<string, { noi: number | null; gpr: number | null; vacancy_loss: number | null; vacancy_pct: number | null; updated_at: string | null }> = {};

    try {
      const t12Res = await query<{ deal_id: string; noi: string | null; gpr: string | null; vacancy_loss: string | null; vacancy_pct: string | null; updated_at: string | null }>(
        `SELECT
           id                                                      AS deal_id,
           (deal_data->'extraction_t12'->>'noi')::numeric          AS noi,
           (deal_data->'extraction_t12'->>'gpr')::numeric          AS gpr,
           (deal_data->'extraction_t12'->>'vacancy_loss')::numeric  AS vacancy_loss,
           (deal_data->'extraction_t12'->>'vacancy_pct')::numeric   AS vacancy_pct,
           updated_at::text                                        AS updated_at
         FROM deals
         WHERE id = ANY($1::uuid[])
           AND deal_data->'extraction_t12' IS NOT NULL`,
        [dealIds],
      );
      for (const r of t12Res.rows) {
        t12ByDeal[r.deal_id] = {
          noi:          r.noi != null ? parseFloat(r.noi as unknown as string) : null,
          gpr:          r.gpr != null ? parseFloat(r.gpr as unknown as string) : null,
          vacancy_loss: r.vacancy_loss != null ? parseFloat(r.vacancy_loss as unknown as string) : null,
          vacancy_pct:  r.vacancy_pct != null ? parseFloat(r.vacancy_pct as unknown as string) : null,
          updated_at:   r.updated_at ?? null,
        };
      }
    } catch (_dbErr) {
      // Non-fatal — proceed with empty T-12 map (will result in 0 realizations)
    }

    // Post realization records
    let realized = 0;
    for (const pred of active) {
      const t12 = t12ByDeal[pred.source.dealId!];
      if (!t12) continue;

      const targetDate = pred.realizationTargetDate;
      const ym = `${targetDate.getUTCFullYear()}${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}`;
      const obsDate = t12.updated_at ? new Date(t12.updated_at) : targetDate;

      if (pred.metric === 'noi_year1' && t12.noi != null && Number.isFinite(t12.noi) && t12.noi !== 0) {
        calibrationLedger.recordRealization({
          realizationId:        `real_${pred.source.dealId}_noi_year1_${ym}`,
          recordedAt:           now,
          metric:               'noi_year1',
          scope:                { dealId: pred.source.dealId!, assetClass: pred.assetClass },
          observationDate:      obsDate,
          observedValue:        t12.noi,
          observationSource:    'extraction_t12',
          measurementUncertainty: 0.05,
        });
        realized++;
      } else if (pred.metric === 'occupancy_year1') {
        let occupancy: number | null = null;
        if (t12.vacancy_pct != null && Number.isFinite(t12.vacancy_pct)) {
          occupancy = 1 - t12.vacancy_pct;
        } else if (t12.gpr != null && t12.gpr > 0 && t12.vacancy_loss != null) {
          occupancy = Math.max(0, Math.min(1, 1 - Math.abs(t12.vacancy_loss) / t12.gpr));
        }
        if (occupancy != null && Number.isFinite(occupancy)) {
          calibrationLedger.recordRealization({
            realizationId:     `real_${pred.source.dealId}_occupancy_year1_${ym}`,
            recordedAt:        now,
            metric:            'occupancy_year1',
            scope:             { dealId: pred.source.dealId!, assetClass: pred.assetClass },
            observationDate:   obsDate,
            observedValue:     occupancy,
            observationSource: 'extraction_t12',
            measurementUncertainty: 0.02,
          });
          realized++;
        }
      }
    }

    // Run pairing
    const newPairings = calibrationLedger.runPairing();

    // Drift detection across affected strata
    let driftAlerts = 0;
    if (newPairings.length > 0) {
      const strataMap = new Map<string, { source: string; metric: string; assetClass: string; regime: string; horizon: string }>();
      for (const pred of active) {
        const h = pred.realizationHorizonMonths;
        const horizon = h <= 12 ? 'short' : h <= 36 ? 'medium' : 'long';
        const key = `${pred.source.module}|${pred.metric}|${pred.assetClass}|${pred.regimeAtPrediction}|${horizon}`;
        if (!strataMap.has(key)) {
          strataMap.set(key, { source: pred.source.module, metric: pred.metric, assetClass: pred.assetClass, regime: pred.regimeAtPrediction, horizon });
        }
      }
      for (const [, stratum] of strataMap) {
        try {
          const alerts = calibrationLedger.detectDrift(stratum);
          driftAlerts += alerts.length;
        } catch { /* non-fatal */ }
      }
    }

    return res.json({
      success: true,
      data: {
        maturedPredictions: active.length,
        dealsWithT12:       Object.keys(t12ByDeal).length,
        realizations:       realized,
        pairings:           newPairings.length,
        driftAlerts,
        ledger:             calibrationLedger.getStats(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Realization error' });
  }
});

export default router;
