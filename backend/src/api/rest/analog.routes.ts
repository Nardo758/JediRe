import { Router, Request, Response } from 'express';
import { analogEngine, type ForwardQueryParams, type BackwardQueryParams, type CounterfactualQueryParams } from '../../services/sigma/analog-engine';

const router = Router();

// ─── Forward Mode ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/analogs/forecast/forward
 * Event-driven forecast.
 * spec §5.1
 */
router.post('/forecast/forward', (req: Request, res: Response) => {
  try {
    const params = req.body as ForwardQueryParams;

    if (!params.targetMarket?.msaId || !params.targetMarket?.assetClass) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: targetMarket.msaId, targetMarket.assetClass',
      });
    }

    if (!params.metrics || params.metrics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: metrics',
      });
    }

    if (!params.horizonsMonths || params.horizonsMonths.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: horizonsMonths',
      });
    }

    const result = analogEngine.forwardQuery(params);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Forward query error' });
  }
});

// ─── Backward Mode ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/analogs/forecast/backward
 * Market-profile response distribution.
 * spec §5.2
 */
router.post('/forecast/backward', (req: Request, res: Response) => {
  try {
    const params = req.body as BackwardQueryParams;

    if (!params.targetMarket?.msaId || !params.targetMarket?.assetClass) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: targetMarket.msaId, targetMarket.assetClass',
      });
    }

    if (!params.metrics || params.metrics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: metrics',
      });
    }

    if (!params.horizonsMonths || params.horizonsMonths.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: horizonsMonths',
      });
    }

    const result = analogEngine.backwardQuery(params);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Backward query error' });
  }
});

// ─── Counterfactual Mode ─────────────────────────────────────────────────────

/**
 * POST /api/v1/analogs/forecast/counterfactual
 * Hypothetical event trajectory.
 * spec §5.3
 */
router.post('/forecast/counterfactual', (req: Request, res: Response) => {
  try {
    const params = req.body as CounterfactualQueryParams;

    if (!params.targetMarket?.msaId || !params.targetMarket?.assetClass) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: targetMarket.msaId, targetMarket.assetClass',
      });
    }

    if (!params.hypotheticalEvent?.subtype) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: hypotheticalEvent.subtype',
      });
    }

    if (!params.metrics || params.metrics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: metrics',
      });
    }

    if (!params.horizonsMonths || params.horizonsMonths.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: horizonsMonths',
      });
    }

    const result = analogEngine.counterfactualQuery(params);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Counterfactual query error' });
  }
});

// ─── Diagnostics ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/analogs/similarity
 * Compute similarity between a target and analog.
 */
router.post('/similarity', (req: Request, res: Response) => {
  try {
    const { targetMarketId, analogMarketId, eventId } = req.body as {
      targetMarketId: string;
      analogMarketId: string;
      eventId?: string;
    };

    if (!targetMarketId || !analogMarketId) {
      return res.status(400).json({ error: 'Missing targetMarketId or analogMarketId' });
    }

    // For diagnostics, we compute a simplified breakdown
    return res.json({
      success: true,
      data: {
        message: 'Full similarity requires TargetContext with factor loadings. ' +
          'Use forward/backward queries with real market data.',
        targetMarketId,
        analogMarketId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Similarity error' });
  }
});

/**
 * GET /api/v1/analogs/pool/stats
 * Get pool statistics.
 */
router.get('/pool/stats', (_req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      data: {
        poolSize: analogEngine.getPoolSize(),
        bandwidths: analogEngine.getBandwidths(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Pool stats error' });
  }
});

export default router;
