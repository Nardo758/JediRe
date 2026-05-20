/**
 * Sentiment Trend REST routes (Task #382)
 *
 * Mounted at /api/v1/sentiment.
 *
 * GET /api/v1/sentiment/trend/:entityType/:entityId?window=12
 *   Returns the time-series of sentiment observations for the entity over the
 *   requested window (months, 1..24, default 12) plus current-vs-30d and
 *   current-vs-12mo deltas and the latest top-driver news headlines.
 */

import { Router, Request, Response } from 'express';
import { getSentimentTrend } from '../../services/sentiment-history.service';
import { logger } from '../../utils/logger';

export const sentimentRouter = Router();

sentimentRouter.get('/trend/:entityType/:entityId', async (req: Request, res: Response) => {
  const entityType = req.params.entityType;
  const entityId = req.params.entityId;

  if (entityType !== 'msa' && entityType !== 'submarket' && entityType !== 'property') {
    res.status(400).json({ success: false, error: "entityType must be 'msa', 'submarket', or 'property'" });
    return;
  }

  const windowParam = parseInt((req.query.window as string) ?? '12', 10);
  const windowMonths = Number.isFinite(windowParam) ? Math.min(Math.max(windowParam, 1), 24) : 12;

  try {
    // getSentimentTrend canonicalizes the entity ID internally so URL aliases
    // (numeric PK / CBSA / slug / UUID) all collapse to the same history row.
    const trend = await getSentimentTrend(entityType, entityId, windowMonths);

    res.json({
      success: true,
      entityType,
      entityId,
      canonicalEntityId: trend.canonicalEntityId,
      entityName: trend.resolvedEntityName,
      window: { months: windowMonths },
      trend,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('sentiment.routes: trend lookup failed', { err: msg, entityType, entityId });
    res.status(500).json({ success: false, error: msg });
  }
});
