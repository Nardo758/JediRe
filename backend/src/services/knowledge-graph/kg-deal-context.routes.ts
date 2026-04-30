/**
 * KG Deal Context Routes — Week 4 output adapter.
 *
 * Frontend-facing endpoints that surface knowledge graph context
 * for deals, markets, and zoning precedents.
 *
 * Endpoints:
 *   GET /knowledge-graph/context/deals/:dealId        → Full deal context panel
 *   GET /knowledge-graph/context/markets/:msa          → Market insights
 *   GET /knowledge-graph/context/zoning/:jurisdiction/:code → Zoning precedents
 *   GET /knowledge-graph/context/search                → Semantic search across KG
 *   GET /knowledge-graph/context/similar               → Find similar deals
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getKGDealContextService } from './kg-deal-context.service';

export function createKGDealContextRoutes(pool: Pool): Router {
  const router = Router();
  const svc = getKGDealContextService(pool);

  // ── Full deal context panel ─────────────────────────────────────────────

  router.get('/deals/:dealId', async (req: Request, res: Response) => {
    try {
      const context = await svc.getDealContext(req.params.dealId);
      if (!context) {
        res.status(404).json({ error: 'No KG context found for this deal' });
        return;
      }
      res.json(context);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch deal context' });
    }
  });

  // ── Market insights ────────────────────────────────────────────────────

  router.get('/markets/:msa', async (req: Request, res: Response) => {
    try {
      const insights = await svc.getMarketInsights(req.params.msa);
      if (!insights) {
        res.status(404).json({ error: 'No market insights found' });
        return;
      }
      res.json(insights);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch market insights' });
    }
  });

  // ── Zoning precedents ──────────────────────────────────────────────────

  router.get('/zoning/:jurisdiction/:code', async (req: Request, res: Response) => {
    try {
      const precedents = await svc.getZoningPrecedents(
        req.params.code,
        req.params.jurisdiction,
      );
      res.json({ precedents, count: precedents.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch zoning precedents' });
    }
  });

  // ── Semantic search ────────────────────────────────────────────────────

  router.get('/search', async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const limit = parseInt(req.query.limit as string, 10) || 10;
      if (!query) {
        res.status(400).json({ error: 'Query parameter "q" is required' });
        return;
      }
      const results = await svc.semanticSearch(query, limit);
      res.json({ query, results, count: results.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Search failed' });
    }
  });

  // ── Find similar deals ─────────────────────────────────────────────────

  router.get('/similar', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const results = await svc.searchSimilarDeals({
        jurisdiction: req.query.jurisdiction as string,
        zoneCode: req.query.zoneCode as string,
        market: req.query.market as string,
        limit,
      });
      res.json({ results, count: results.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Search failed' });
    }
  });

  return router;
}
