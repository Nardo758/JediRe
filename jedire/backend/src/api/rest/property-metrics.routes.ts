import { Router, Request, Response } from 'express';
import { PropertyMetricsService } from '../../services/propertyMetrics.service';
import { Pool } from 'pg';

export function createPropertyMetricsRouter(pool: Pool): Router {
  const router = Router();
  const metrics = new PropertyMetricsService(pool);

  router.get('/property/:parcelId/metrics', async (req: Request, res: Response) => {
    try {
      const result = await metrics.getPropertyMetrics(req.params.parcelId);
      if (!result) return res.status(404).json({ error: 'Property not found' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/property/:parcelId/density', async (req: Request, res: Response) => {
    try {
      const result = await metrics.getDensityMetrics(req.params.parcelId);
      if (!result) return res.status(404).json({ error: 'Property not found' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/neighborhoods/benchmarks', async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string | undefined;
      const result = await metrics.getNeighborhoodBenchmarks(code);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/submarkets/comparison', async (req: Request, res: Response) => {
    try {
      const result = await metrics.getSubmarketComparison();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/owners/top', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await metrics.getTopOwners(limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/owners/search', async (req: Request, res: Response) => {
    try {
      const name = req.query.name as string;
      if (!name) return res.status(400).json({ error: 'name query required' });
      const result = await metrics.getOwnerPortfolio(name);
      if (!result) return res.status(404).json({ error: 'Owner not found' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/rent-comps', async (req: Request, res: Response) => {
    try {
      const market = req.query.market as string | undefined;
      const result = await metrics.getRentComps(market);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/rent-comps/summary', async (req: Request, res: Response) => {
    try {
      const market = req.query.market as string | undefined;
      const result = await metrics.getMarketSummary(market);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
