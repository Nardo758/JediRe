import { Router, Request, Response } from 'express';
import { causalDisciplineEngine } from '../services/sigma/causal-discipline-engine';
import type { ExpectedState, ObservedState } from '../services/sigma/causal-discipline-engine';

const router = Router();

/**
 * GET /api/v1/causal/events
 * List all event type declarations.
 */
router.get('/events', (_req: Request, res: Response) => {
  try {
    const events = causalDisciplineEngine.getAllEventDeclarations();
    return res.json({ success: true, data: events });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Events error' });
  }
});

/**
 * GET /api/v1/causal/events/:subtype/policy
 * Get channel routing policy for an event subtype.
 */
router.get('/events/:subtype/policy', (req: Request, res: Response) => {
  try {
    const policy = causalDisciplineEngine.getChannelPolicy(req.params.subtype);
    if (!policy) return res.status(404).json({ success: false, error: 'No policy for event subtype' });
    return res.json({ success: true, data: policy });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Policy error' });
  }
});

/**
 * GET /api/v1/causal/routing/validate
 * Validate event routing for a subscriber.
 */
router.get('/routing/validate', (req: Request, res: Response) => {
  try {
    const { subtype, subscriber } = req.query as Record<string, string>;
    if (!subtype || !subscriber) {
      return res.status(400).json({ success: false, error: 'Missing required: subtype, subscriber' });
    }
    const result = causalDisciplineEngine.validateEventRouting(subtype, subscriber);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Validation error' });
  }
});

/**
 * GET /api/v1/causal/metrics
 * List cause/symptom metrics.
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const { category } = req.query as Record<string, string>;
    const causes = causalDisciplineEngine.getCauseMetrics(category);
    const symptoms = causalDisciplineEngine.getSymptomMetrics(category);
    return res.json({ success: true, data: { causes, symptoms } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Metrics error' });
  }
});

/**
 * GET /api/v1/causal/classify/:metricId
 * Classify a metric as cause, symptom, or state.
 */
router.get('/classify/:metricId', (req: Request, res: Response) => {
  try {
    const result = causalDisciplineEngine.classifyMetric(req.params.metricId);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Classification error' });
  }
});

/**
 * POST /api/v1/causal/expected
 * Record expected state (from M07).
 */
router.post('/expected', (req: Request, res: Response) => {
  try {
    const state = req.body as ExpectedState;
    if (!state.marketId || state.expectedDemandStrength == null || state.expectedSupplyPressure == null) {
      return res.status(400).json({ success: false, error: 'Missing required fields: marketId, expectedDemandStrength, expectedSupplyPressure' });
    }
    causalDisciplineEngine.recordExpectedState(state);
    return res.json({ success: true, data: { marketId: state.marketId } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Expected state error' });
  }
});

/**
 * POST /api/v1/causal/observed
 * Record observed state (from symptoms).
 */
router.post('/observed', (req: Request, res: Response) => {
  try {
    const state = req.body as ObservedState;
    if (!state.marketId || state.observedDemandIntensity == null || state.observedSupplyPressure == null) {
      return res.status(400).json({ success: false, error: 'Missing required fields: marketId, observedDemandIntensity, observedSupplyPressure' });
    }
    causalDisciplineEngine.recordObservedState(state);
    return res.json({ success: true, data: { marketId: state.marketId } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Observed state error' });
  }
});

/**
 * POST /api/v1/causal/validate
 * Compute validation factor between expected and observed.
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { expected, observed, isDemand } = req.body as { expected: number; observed: number; isDemand: boolean };
    if (expected == null || observed == null || isDemand == null) {
      return res.status(400).json({ success: false, error: 'Missing required fields: expected, observed, isDemand' });
    }
    const result = causalDisciplineEngine.computeValidationFactor(expected, observed, isDemand);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Validation error' });
  }
});

/**
 * POST /api/v1/causal/scoreDeal
 * Score a deal using cause/symptom split.
 */
router.post('/scoreDeal', (req: Request, res: Response) => {
  try {
    const { dealId, marketId, inputs, regime, nEffective } = req.body as any;
    if (!dealId || !marketId || !inputs) {
      return res.status(400).json({ success: false, error: 'Missing required fields: dealId, marketId, inputs' });
    }
    const result = causalDisciplineEngine.scoreDeal(dealId, marketId, inputs, regime, nEffective);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Score error' });
  }
});

/**
 * POST /api/v1/causal/discrepancy
 * Detect persistent discrepancies.
 */
router.post('/discrepancy', (req: Request, res: Response) => {
  try {
    const { weeklyStates, minWeeks } = req.body as any;
    if (!weeklyStates) {
      return res.status(400).json({ success: false, error: 'Missing required: weeklyStates' });
    }
    const states = weeklyStates.map((ws: any) => ({
      expected: ws.expected as ExpectedState,
      observed: ws.observed as ObservedState,
      date: new Date(ws.date),
    }));
    const results = causalDisciplineEngine.detectDiscrepancies(states, minWeeks ?? 4);
    return res.json({ success: true, data: results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Discrepancy error' });
  }
});

/**
 * GET /api/v1/causal/stats
 * Get engine stats.
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = causalDisciplineEngine.getStats();
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Stats error' });
  }
});

export default router;
