import { Router, Request, Response } from 'express';
import { calibrationLedger } from '../services/sigma/calibration-ledger';
import type { PredictionRecord, RealizationRecord, StratumKey } from '../services/sigma/calibration-ledger';

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

export default router;
