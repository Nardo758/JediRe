/**
 * Zoning Recommendations API Routes
 *
 * POST /zoning/recommendations/:dealId/analyze — Trigger the 5-step orchestrator pipeline
 * GET  /zoning/recommendations/:dealId          — Retrieve cached or latest recommendation
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ZoningRecommendationOrchestrator } from '../../services/zoning-recommendation-orchestrator.service';

const router = Router();
const pool = getPool();
const orchestrator = new ZoningRecommendationOrchestrator(pool);

/**
 * POST /zoning/recommendations/:dealId/analyze
 * Runs the full 5-step pipeline (or returns cached result if fresh).
 */
router.post('/zoning/recommendations/:dealId/analyze', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!dealId) {
      return res.status(400).json({ error: 'dealId is required' });
    }

    const result = await orchestrator.analyze(dealId);
    res.json(result);
  } catch (error: any) {
    console.error('Error running zoning recommendation orchestrator:', error);
    const message = error.message || 'Failed to analyze zoning recommendations';
    const status = message.includes('No confirmed zoning') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

/**
 * GET /zoning/recommendations/:dealId
 * Returns the latest recommendation (cached or stale). Does NOT trigger a new analysis.
 */
router.get('/zoning/recommendations/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!dealId) {
      return res.status(400).json({ error: 'dealId is required' });
    }

    const result = await orchestrator.getResult(dealId);
    if (!result) {
      return res.status(404).json({ error: 'No recommendations found. Run analysis first.' });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching zoning recommendations:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch zoning recommendations' });
  }
});

export default router;
