import { Router, Request, Response } from 'express';
import { PropertyScoringService } from '../../services/propertyScoring.service';
import { Pool } from 'pg';

export function createPropertyScoringRouter(pool: Pool): Router {
  const router = Router();
  const scoring = new PropertyScoringService(pool);

  router.get('/seller-propensity', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await scoring.getSellerPropensityScores(limit);
      res.json(result);
    } catch (err: any) {
      console.error('Seller propensity error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/value-add', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const result = await scoring.getValueAddScores(limit);
      res.json(result);
    } catch (err: any) {
      console.error('Value-add scoring error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/hidden-gems', async (req: Request, res: Response) => {
    try {
      const result = await scoring.getHiddenGems();
      res.json(result);
    } catch (err: any) {
      console.error('Hidden gems error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/cap-rates', async (req: Request, res: Response) => {
    try {
      const result = await scoring.getCapRateEstimates();
      res.json(result);
    } catch (err: any) {
      console.error('Cap rate estimation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/tax-burden', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await scoring.getTaxBurdenAnalysis(limit);
      res.json(result);
    } catch (err: any) {
      console.error('Tax burden error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/supply-intelligence', async (req: Request, res: Response) => {
    try {
      const result = await scoring.getSupplyIntelligence();
      res.json(result);
    } catch (err: any) {
      console.error('Supply intelligence error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/design-inputs', async (req: Request, res: Response) => {
    try {
      const neighborhoodCode = req.query.neighborhood as string | undefined;
      const result = await scoring.getDesignInputs(neighborhoodCode);
      res.json(result);
    } catch (err: any) {
      console.error('Design inputs error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
