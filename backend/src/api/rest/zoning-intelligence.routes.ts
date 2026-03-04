import { Router, Response } from 'express';
import { Pool } from 'pg';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ZoningKnowledgeService } from '../../services/zoning-knowledge.service';
import { ZoningReasoningService } from '../../services/zoning-reasoning.service';
import { ZoningQueryRouter } from '../../services/zoning-query-router.service';
import { ZoningApplicationPipeline } from '../../services/zoning-application-pipeline.service';
import { PropertyBoundaryResolver } from '../../services/property-boundary-resolver.service';

export function createZoningIntelligenceRoutes(pool: Pool): Router {
  const router = Router();
  const knowledgeService = new ZoningKnowledgeService(pool);
  const reasoningService = new ZoningReasoningService(pool, knowledgeService);
  const queryRouter = new ZoningQueryRouter(pool, knowledgeService, reasoningService);
  const pipeline = new ZoningApplicationPipeline(pool, knowledgeService, reasoningService);
  const boundaryResolver = new PropertyBoundaryResolver(pool);

  /**
   * GET /api/v1/zoning-intelligence
   * Get available zoning intelligence features
   */
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          features: [
            'Natural language zoning queries',
            'Automatic deal-based analysis',
            'Multi-scenario capacity modeling',
            'Regulatory constraint extraction'
          ],
          endpoints: {
            query: 'POST /api/v1/zoning-intelligence/query',
            analyze: 'POST /api/v1/zoning-intelligence/analyze',
            scenarios: 'POST /api/v1/zoning-intelligence/scenarios',
            learn: 'POST /api/v1/zoning-intelligence/learn'
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching zoning intelligence info:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/query', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { question, districtCode, municipality, state, parcelContext, dealId } = req.body;
      if (!question) {
        return res.status(400).json({ success: false, error: 'Question is required' });
      }

      let resolvedDistrict = districtCode;
      let resolvedMunicipality = municipality;
      let resolvedState = state;
      let resolvedParcelContext = parcelContext;

      if (dealId && (!districtCode || !municipality)) {
        try {
          const resolved = await boundaryResolver.resolveForDeal(dealId);
          resolvedDistrict = resolvedDistrict || resolved.zoningLookup.districtCode;
          resolvedMunicipality = resolvedMunicipality || resolved.zoningLookup.municipality;
          resolvedState = resolvedState || resolved.zoningLookup.state;
          if (!resolvedParcelContext && resolved.boundary) {
            resolvedParcelContext = {
              landAreaSf: resolved.pipelineInput.landAreaSf,
              lat: resolved.pipelineInput.lat,
              lng: resolved.pipelineInput.lng,
              address: resolved.pipelineInput.address,
              hasBoundary: true,
              buildableAreaSf: resolved.boundary.buildableAreaSF,
              constraints: resolved.boundary.constraints,
            };
          }
        } catch (e) {
          console.warn('Boundary resolution for query failed, using provided params:', e);
        }
      }

      const result = await queryRouter.route({
        question,
        districtCode: resolvedDistrict,
        municipality: resolvedMunicipality,
        state: resolvedState,
        parcelContext: resolvedParcelContext,
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
      const { dealId, address, lat, lng, municipality, state, districtCode, landAreaSf, setbacks, propertyType, dealType } = req.body;

      if (dealId && (!municipality || !districtCode || !landAreaSf)) {
        try {
          const resolved = await boundaryResolver.resolveForDeal(dealId, {
            address, lat, lng, municipality, state, districtCode, landAreaSf, setbacks, propertyType,
          });

          if (!resolved.pipelineInput.municipality || !resolved.pipelineInput.districtCode || !resolved.pipelineInput.landAreaSf) {
            return res.status(400).json({
              success: false,
              error: 'Could not resolve required data from property boundary. Missing: ' +
                [
                  !resolved.pipelineInput.municipality && 'municipality',
                  !resolved.pipelineInput.districtCode && 'districtCode',
                  !resolved.pipelineInput.landAreaSf && 'landAreaSf',
                ].filter(Boolean).join(', '),
              dataCompleteness: resolved.dataCompleteness,
            });
          }

          const result = await pipeline.execute({
            ...resolved.pipelineInput,
            dealType: dealType || 'BTS', // Pass deal type to pipeline
          });

          return res.json({
            success: true,
            data: result,
            dealType: dealType || 'BTS',
            resolvedFrom: 'property_boundary',
            dataCompleteness: resolved.dataCompleteness,
            boundarySource: resolved.zoningLookup.source,
          });
        } catch (e: any) {
          console.error('Boundary-based analysis failed:', e);
          return res.status(500).json({ success: false, error: e.message });
        }
      }

      if (!municipality || !state || !districtCode || !landAreaSf) {
        return res.status(400).json({
          success: false,
          error: 'Required: municipality, state, districtCode, landAreaSf (or provide dealId for auto-resolution from property boundary)',
        });
      }

      const result = await pipeline.execute({
        dealId, address, lat, lng, municipality, state, districtCode, landAreaSf, setbacks, propertyType,
        dealType: dealType || 'BTS', // Pass deal type to pipeline
      });

      res.json({ success: true, data: result, dealType: dealType || 'BTS' });
    } catch (error: any) {
      console.error('Zoning intelligence analysis error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/resolve/:dealId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      const resolved = await boundaryResolver.resolveForDeal(dealId);

      res.json({
        success: true,
        data: {
          hasBoundary: resolved.dataCompleteness.hasBoundary,
          boundary: resolved.boundary ? {
            parcelAreaSF: resolved.boundary.parcelAreaSF,
            parcelArea: resolved.boundary.parcelArea,
            buildableAreaSF: resolved.boundary.buildableAreaSF,
            buildablePercentage: resolved.boundary.buildablePercentage,
            setbacks: resolved.boundary.setbacks,
            constraints: resolved.boundary.constraints,
            centroid: resolved.boundary.centroid,
            hasGeoJSON: !!resolved.boundary.boundaryGeoJSON,
            updatedAt: resolved.boundary.updatedAt,
          } : null,
          deal: resolved.deal ? {
            name: resolved.deal.name,
            address: resolved.deal.address,
            city: resolved.deal.city,
            state: resolved.deal.state,
            acres: resolved.deal.acres,
            projectType: resolved.deal.projectType,
            zoningCode: resolved.deal.zoningCode,
          } : null,
          zoningLookup: resolved.zoningLookup,
          pipelineInput: resolved.pipelineInput,
          dataCompleteness: resolved.dataCompleteness,
        },
      });
    } catch (error: any) {
      console.error('Boundary resolve error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/constraints/:dealId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      const constraints = await boundaryResolver.getConstraintFlags(dealId);
      res.json({ success: true, data: constraints });
    } catch (error: any) {
      console.error('Constraint flags error:', error);
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
