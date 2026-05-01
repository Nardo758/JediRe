import { Router, Request, Response } from 'express';
import { 
  computePlausibility,
  goalSeek,
  DEBT_BUNDLES,
  VARIABLE_META,
} from '../../services/sigma/sigma-engine';

const router = Router();

/**
 * POST /api/v1/sigma/plausibility
 * Score an assumption set for plausibility via Mahalanobis distance.
 */
router.post('/plausibility', async (req: Request, res: Response) => {
  try {
    const { assumptions } = req.body;
    if (!assumptions || typeof assumptions !== 'object') {
      return res.status(400).json({ success: false, error: 'assumptions object required' });
    }

    const result = computePlausibility(assumptions);

    res.json({
      success: true,
      data: {
        mahalanobisD: parseFloat(result.dScore.toFixed(3)),
        band: result.band,
        contributions: result.contributions,
        nVariables: Object.keys(result.contributions).length,
        topContributors: result.topContributors,
      },
    });
  } catch (error: any) {
    console.error('Plausibility error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to compute plausibility' });
  }
});

/**
 * POST /api/v1/sigma/goal-seek
 * Given a target IRR and current deal state, find the least-aggressive
 * assumption set (lowest d) that hits the target. Evaluates each debt bundle.
 */
router.post('/goal-seek', async (req: Request, res: Response) => {
  try {
    const {
      targetIrR,
      holdYears,
      currentAssumptions = {},
      lockVariables = [],
      bundleFilter = [],
    } = req.body;

    if (targetIrR == null || holdYears == null) {
      return res.status(400).json({ success: false, error: 'targetIrR and holdYears required' });
    }

    const result = goalSeek(targetIrR, holdYears, currentAssumptions, {
      lockedVariables: lockVariables,
      bundleFilter,
    });

    res.json({
      success: true,
      data: {
        targetIrR: result.targetIrR,
        holdYears: result.holdYears,
        currentIrRPerBundle: result.currentIrRMap,
        results: result.results.map(r => ({
          bundle: r.bundle.id,
          bundleName: r.bundle.name,
          baseIrR: r.baseIrR,
          achievedIrR: r.achievedIrR,
          dScore: r.dScore,
          band: r.band,
          changedVars: r.changedVars,
          narrative: r.narrative,
        })),
        recommendation: result.recommendation ? {
          bundle: result.recommendation.bundle.id,
          bundleName: result.recommendation.bundle.name,
          dScore: result.recommendation.dScore,
          band: result.recommendation.band,
          achievedIrR: result.recommendation.achievedIrR,
          narrative: result.recommendation.narrative,
        } : null,
        bundlesEvaluated: result.bundlesEvaluated,
      },
    });
  } catch (error: any) {
    console.error('Goal-seek error:', error);
    res.status(500).json({ success: false, error: error.message || 'Goal-seeking failed' });
  }
});

/**
 * GET /api/v1/sigma/bundles
 * List available debt bundles.
 */
router.get('/bundles', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: DEBT_BUNDLES.map(b => ({
      id: b.id,
      name: b.name,
      ltv: b.ltv,
      rate: b.rate,
      ioPeriod: b.ioPeriod,
      amortYears: b.amortYears,
      minDscr: b.minDscr,
      description: b.description,
    })),
  });
});

/**
 * GET /api/v1/sigma/variables
 * List variable metadata for the assumption schema.
 */
router.get('/variables', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.entries(VARIABLE_META).map(([key, meta]) => ({
      key,
      unit: meta.unit,
      min: meta.min,
      max: meta.max,
      prior: meta.prior,
      std: meta.std,
    })),
  });
});

export default router;
