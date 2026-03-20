import { Router, Response } from 'express';
import { Pool } from 'pg';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ZoningCorrectionService } from '../../services/zoning-correction.service';
import { ZoningPrecedentService } from '../../services/zoning-precedent.service';
import { ZoningOutcomeService } from '../../services/zoning-outcome.service';
import { ZoningConfidenceV2Service } from '../../services/zoning-confidence-v2.service';
import { UserCredibilityService, CredibilityTier } from '../../services/user-credibility.service';

export function createZoningLearningRoutes(pool: Pool): Router {
  const router = Router();
  const correctionService = new ZoningCorrectionService(pool);
  const precedentService = new ZoningPrecedentService(pool);
  const outcomeService = new ZoningOutcomeService(pool);
  const confidenceService = new ZoningConfidenceV2Service(pool);
  const credibilityService = new UserCredibilityService(pool);

  router.post('/corrections', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId || req.body.userId;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID required' });
      }

      const { municipality, state, districtId, districtCode, fieldCorrected,
              oldValue, newValue, justification, codeReference, userTier } = req.body;

      if (!municipality || !fieldCorrected || !newValue || !justification) {
        return res.status(400).json({
          success: false,
          error: 'municipality, fieldCorrected, newValue, and justification are required',
        });
      }

      const result = await correctionService.submitCorrection({
        districtId,
        municipality,
        state: state || '',
        districtCode,
        fieldCorrected,
        oldValue: oldValue || '',
        newValue,
        justification,
        codeReference,
        userId,
        userTier: userTier as CredibilityTier,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Correction submission error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/corrections', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { municipality, status, userId, limit, offset } = req.query;
      const result = await correctionService.getCorrections({
        municipality: municipality as string,
        status: status as string,
        userId: userId as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json({ success: true, data: result.corrections, total: result.total });
    } catch (error: any) {
      console.error('Corrections list error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/corrections/:id/resolve', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { approved, resolutionNotes } = req.body;
      const resolvedBy = req.user?.userId || 'system';

      await correctionService.resolveCorrection(id, approved, resolutionNotes || '', resolvedBy);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Correction resolve error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/precedents', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const precedent = await precedentService.addPrecedent(req.body);
      res.json({ success: true, data: precedent });
    } catch (error: any) {
      console.error('Precedent add error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/precedents/search', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { municipality, state, districtCode, applicationType, outcome,
              minScale, maxScale, limit, offset } = req.query;

      const result = await precedentService.search({
        municipality: municipality as string,
        state: state as string,
        districtCode: districtCode as string,
        applicationType: applicationType as string,
        outcome: outcome as string,
        minScale: minScale ? parseInt(minScale as string) : undefined,
        maxScale: maxScale ? parseInt(maxScale as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({ success: true, data: result.precedents, total: result.total });
    } catch (error: any) {
      console.error('Precedent search error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/precedents/similar', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { districtCode, municipality, applicationType, scaleUnits } = req.query;
      if (!districtCode || !municipality || !applicationType) {
        return res.status(400).json({
          success: false,
          error: 'districtCode, municipality, and applicationType are required',
        });
      }

      const results = await precedentService.findSimilar(
        districtCode as string,
        municipality as string,
        applicationType as string,
        scaleUnits ? parseInt(scaleUnits as string) : undefined
      );

      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error('Similar precedents error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/precedents/patterns', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { municipality, districtCode, applicationType } = req.query;
      if (!municipality) {
        return res.status(400).json({ success: false, error: 'municipality is required' });
      }

      const patterns = await precedentService.analyzePatterns(
        municipality as string,
        districtCode as string,
        applicationType as string
      );

      res.json({ success: true, data: patterns });
    } catch (error: any) {
      console.error('Pattern analysis error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/outcomes', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reportedBy = req.user?.userId || req.body.reportedBy;
      if (!reportedBy) {
        return res.status(400).json({ success: false, error: 'reportedBy required' });
      }

      const { predictionId, dealId, municipality, state, districtCode,
              outcomeType, actualOutcome, actualValue, actualTimelineMonths,
              actualCost, conditions, notes } = req.body;

      if (!municipality || !outcomeType || !actualOutcome) {
        return res.status(400).json({
          success: false,
          error: 'municipality, outcomeType, and actualOutcome are required',
        });
      }

      const id = await outcomeService.recordOutcome({
        predictionId, dealId, municipality, state, districtCode,
        outcomeType, actualOutcome, actualValue, actualTimelineMonths,
        actualCost, conditions, notes, reportedBy,
      });

      res.json({ success: true, data: { id } });
    } catch (error: any) {
      console.error('Outcome report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/calibration/:municipality', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { municipality } = req.params;
      const { districtCode } = req.query;

      const calibrations = await outcomeService.calibrate(
        municipality, districtCode as string
      );

      res.json({ success: true, data: calibrations });
    } catch (error: any) {
      console.error('Calibration error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/confidence/:municipality', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { municipality } = req.params;
      const { districtCode } = req.query;

      const confidence = await confidenceService.calculateConfidence(municipality, {
        districtCode: districtCode as string,
      });

      res.json({ success: true, data: confidence });
    } catch (error: any) {
      console.error('Confidence calculation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/maturity', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dashboard = await confidenceService.getMaturityDashboard();
      res.json({ success: true, data: dashboard });
    } catch (error: any) {
      console.error('Maturity dashboard error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/maturity/:municipality', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { municipality } = req.params;
      const maturity = await confidenceService.assessMaturity(municipality);
      res.json({ success: true, data: maturity });
    } catch (error: any) {
      console.error('Maturity assessment error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/credibility/:userId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const cred = await credibilityService.getOrCreate(userId);
      res.json({ success: true, data: cred });
    } catch (error: any) {
      console.error('Credibility fetch error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/credibility/:userId/tier', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { tier } = req.body;
      if (!tier) {
        return res.status(400).json({ success: false, error: 'tier is required' });
      }
      const cred = await credibilityService.updateTier(userId, tier as CredibilityTier);
      res.json({ success: true, data: cred });
    } catch (error: any) {
      console.error('Credibility update error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
