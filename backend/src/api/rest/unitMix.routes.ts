import { Router } from 'express';
import type { Pool } from 'pg';
import * as svc from '../../services/unitMixIntelligence.service';

export function createUnitMixRoutes(pool: Pool) {
  const router = Router();

  router.get('/:dealId/comps', async (req, res) => {
    try {
      const { dealId } = req.params;
      const tradeAreaId = req.query.tradeAreaId as string | undefined;
      const comps = await svc.getCompSet(pool, dealId, tradeAreaId);
      const demandScores = svc.computeDemandScores(comps);
      res.json({ comps, demandScores });
    } catch (err) {
      console.error('Unit mix comps error:', err);
      res.status(500).json({ error: 'Failed to load comp set' });
    }
  });

  router.get('/:dealId/trends', async (req, res) => {
    try {
      const tradeAreaId = req.query.tradeAreaId as string | undefined;
      if (!tradeAreaId) {
        return res.json({ trends: {} });
      }
      const trends = await svc.getTrends(pool, tradeAreaId);
      res.json({ trends });
    } catch (err) {
      console.error('Unit mix trends error:', err);
      res.status(500).json({ error: 'Failed to load trend data' });
    }
  });

  router.get('/:dealId/program', async (req, res) => {
    try {
      const program = await svc.getProgram(pool, req.params.dealId);
      res.json({ program });
    } catch (err) {
      console.error('Unit mix program error:', err);
      res.status(500).json({ error: 'Failed to load program' });
    }
  });

  router.post('/:dealId/program', async (req, res) => {
    try {
      const userId = (req as unknown as { user?: { userId?: string } }).user?.userId || 'unknown';
      const result = await svc.saveProgram(pool, req.params.dealId, userId, req.body);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('Unit mix save program error:', err);
      res.status(500).json({ error: 'Failed to save program' });
    }
  });

  router.get('/:dealId/zoning', async (req, res) => {
    try {
      const zoning = await svc.getZoningForUnitMix(pool, req.params.dealId);
      res.json({ zoning });
    } catch (err) {
      console.error('Unit mix zoning error:', err);
      res.status(500).json({ error: 'Failed to load zoning' });
    }
  });

  return router;
}
