import { Router, Response } from 'express';
import { Pool } from 'pg';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ZoningKnowledgeService } from '../../services/zoning-knowledge.service';
import { ZoningReasoningService } from '../../services/zoning-reasoning.service';
import { ZoningQueryRouter } from '../../services/zoning-query-router.service';
import { ZoningApplicationPipeline } from '../../services/zoning-application-pipeline.service';

export function createZoningIntelligenceRoutes(pool: Pool): Router {
  const router = Router();
  const knowledgeService = new ZoningKnowledgeService(pool);
  const reasoningService = new ZoningReasoningService(pool, knowledgeService);
  const queryRouter = new ZoningQueryRouter(pool, knowledgeService, reasoningService);
  const pipeline = new ZoningApplicationPipeline(pool, knowledgeService, reasoningService);

  router.post('/query', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { question, districtCode, municipality, state, parcelContext, dealId } = req.body;
      if (!question) {
        return res.status(400).json({ success: false, error: 'Question is required' });
      }

      const result = await queryRouter.route({
        question,
        districtCode,
        municipality,
        state,
        parcelContext,
        dealId,
        intent: queryRouter.classifyIntent(question),
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Zoning intelligence query error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/analyze', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId, address, lat, lng, municipality, state, districtCode, landAreaSf, setbacks, propertyType } = req.body;
      if (!municipality || !state || !districtCode || !landAreaSf) {
        return res.status(400).json({
          success: false,
          error: 'Required: municipality, state, districtCode, landAreaSf',
        });
      }

      const result = await pipeline.execute({
        dealId, address, lat, lng, municipality, state, districtCode, landAreaSf, setbacks, propertyType,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Zoning intelligence analysis error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/profile/:districtCode/:municipality', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { districtCode, municipality } = req.params;
      const lookup = await knowledgeService.lookupDistrict(districtCode, municipality);

      if (!lookup.found) {
        return res.status(404).json({ success: false, error: 'District not found' });
      }

      res.json({
        success: true,
        data: {
          profile: lookup.profile,
          source: lookup.source,
          confidence: lookup.confidence,
          districtId: lookup.districtId,
          citations: lookup.citations,
        },
      });
    } catch (error: any) {
      console.error('Profile lookup error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/extract-profile', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { districtCode, municipality, state } = req.body;
      if (!districtCode || !municipality || !state) {
        return res.status(400).json({ success: false, error: 'Required: districtCode, municipality, state' });
      }

      const existingLookup = await knowledgeService.lookupDistrict(districtCode, municipality);
      const extraction = await reasoningService.extractStructuredProfile(districtCode, municipality, state);

      if (existingLookup.districtId) {
        await knowledgeService.saveStructuredProfile(
          existingLookup.districtId,
          extraction.profile,
          extraction.confidence
        );
      }

      res.json({
        success: true,
        data: {
          profile: extraction.profile,
          confidence: extraction.confidence,
          notes: extraction.extractionNotes,
          savedToDistrictId: existingLookup.districtId || null,
        },
      });
    } catch (error: any) {
      console.error('Profile extraction error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/use-check', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { districtCode, municipality, useType } = req.body;
      if (!districtCode || !municipality || !useType) {
        return res.status(400).json({ success: false, error: 'Required: districtCode, municipality, useType' });
      }

      const result = await knowledgeService.checkUsePermission(districtCode, municipality, useType);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Use check error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/parking-calc', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { districtCode, municipality, units, commercialSf, transitProximity } = req.body;
      if (!districtCode || !municipality) {
        return res.status(400).json({ success: false, error: 'Required: districtCode, municipality' });
      }

      const lookup = await knowledgeService.lookupDistrict(districtCode, municipality);
      if (!lookup.found || !lookup.profile) {
        return res.status(404).json({ success: false, error: 'District profile not found' });
      }

      const result = knowledgeService.calculateParking(
        lookup.profile,
        units || 0,
        commercialSf || 0,
        transitProximity || false
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Parking calc error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/maturity/:municipality', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { municipality } = req.params;
      const maturity = await knowledgeService.getJurisdictionMaturity(municipality);
      res.json({ success: true, data: maturity });
    } catch (error: any) {
      console.error('Maturity check error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/analyses', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId, municipality, limit = '20' } = req.query;
      let sql = 'SELECT * FROM zoning_agent_analyses';
      const params: any[] = [];
      const conditions: string[] = [];

      if (dealId) {
        params.push(dealId);
        conditions.push(`deal_id = $${params.length}`);
      }
      if (municipality) {
        params.push(municipality);
        conditions.push(`UPPER(municipality) = UPPER($${params.length})`);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(limit as string));

      const result = await pool.query(sql, params);
      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error('Analyses list error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/analyses/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM zoning_agent_analyses WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Analysis not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('Analysis detail error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
