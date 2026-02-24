import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPool } from '../../database/connection';
import { PropertyBoundaryResolver } from '../../services/property-boundary-resolver.service';
import { ZoningKnowledgeService } from '../../services/zoning-knowledge.service';
import { ZoningReasoningService } from '../../services/zoning-reasoning.service';
import { ZoningApplicationPipeline } from '../../services/zoning-application-pipeline.service';

const router = Router();
const pool = getPool();

const SetbacksSchema = z.object({
  front: z.number().min(0).max(100),
  side: z.number().min(0).max(100),
  rear: z.number().min(0).max(100),
});

const ConstraintSchema = z.object({
  type: z.string(),
  geoJSON: z.any(),
  description: z.string().optional(),
});

const BoundarySchema = z.object({
  boundaryGeoJSON: z.any(),
  parcelArea: z.number().nullable().optional(),
  parcelAreaSF: z.number().nullable().optional(),
  perimeter: z.number().nullable().optional(),
  centroid: z.array(z.number()).length(2).nullable().optional(),
  setbacks: SetbacksSchema.optional(),
  buildableArea: z.number().nullable().optional(),
  buildableAreaSF: z.number().nullable().optional(),
  buildablePercentage: z.number().nullable().optional(),
  constraints: z.object({
    easements: z.array(ConstraintSchema).optional(),
    floodplain: z.boolean().optional(),
    floodplainZone: z.string().optional(),
    wetlands: z.boolean().optional(),
    protectedArea: z.boolean().optional(),
  }).optional(),
  surveyDocumentUrl: z.string().url().optional(),
}).passthrough();

router.get('/deals/:dealId/boundary', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const result = await pool.query(
      'SELECT * FROM property_boundaries WHERE deal_id = $1',
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Boundary not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error fetching boundary:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch boundary' });
  }
});

router.post('/deals/:dealId/boundary', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const validatedData = BoundarySchema.parse(req.body);

    let centroidValue = null;
    if (validatedData.centroid) {
      const c = validatedData.centroid;
      if (Array.isArray(c) && c.length >= 2) {
        centroidValue = `(${c[0]},${c[1]})`;
      }
    }

    const existing = await pool.query(
      'SELECT id FROM property_boundaries WHERE deal_id = $1',
      [dealId]
    );

    let result;

    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE property_boundaries SET
          boundary_geojson = $1,
          parcel_area = $2,
          parcel_area_sf = $3,
          perimeter = $4,
          centroid = $5,
          setbacks = $6,
          buildable_area = $7,
          buildable_area_sf = $8,
          buildable_percentage = $9,
          constraints = $10,
          survey_document_url = $11,
          updated_at = NOW()
        WHERE deal_id = $12
        RETURNING *`,
        [
          JSON.stringify(validatedData.boundaryGeoJSON),
          validatedData.parcelArea || null,
          validatedData.parcelAreaSF || null,
          validatedData.perimeter || null,
          centroidValue,
          JSON.stringify(validatedData.setbacks || {}),
          validatedData.buildableArea || null,
          validatedData.buildableAreaSF || null,
          validatedData.buildablePercentage || null,
          JSON.stringify(validatedData.constraints || {}),
          validatedData.surveyDocumentUrl || null,
          dealId,
        ]
      );
    } else {
      result = await pool.query(
        `INSERT INTO property_boundaries (
          deal_id, boundary_geojson, parcel_area, parcel_area_sf, perimeter,
          centroid, setbacks, buildable_area, buildable_area_sf, buildable_percentage,
          constraints, survey_document_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          dealId,
          JSON.stringify(validatedData.boundaryGeoJSON),
          validatedData.parcelArea || null,
          validatedData.parcelAreaSF || null,
          validatedData.perimeter || null,
          centroidValue,
          JSON.stringify(validatedData.setbacks || {}),
          validatedData.buildableArea || null,
          validatedData.buildableAreaSF || null,
          validatedData.buildablePercentage || null,
          JSON.stringify(validatedData.constraints || {}),
          validatedData.surveyDocumentUrl || null,
        ]
      );
    }

    const savedBoundary = result.rows[0];
    res.json(savedBoundary);

    triggerZoningAutoPopulate(dealId).catch(err => {
      console.error('Auto-populate zoning capacity failed (non-blocking):', err);
    });
  } catch (error: any) {
    console.error('Error saving boundary:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
    }

    res.status(500).json({ error: error.message || 'Failed to save boundary' });
  }
});

async function triggerZoningAutoPopulate(dealId: string) {
  try {
    const resolver = new PropertyBoundaryResolver(pool);
    const resolved = await resolver.resolveForDeal(dealId);

    if (!resolved.pipelineInput.municipality || !resolved.pipelineInput.districtCode || !resolved.pipelineInput.landAreaSf) {
      console.log(`Auto-populate skipped for deal ${dealId}: missing required zoning context`);
      return;
    }

    const knowledgeService = new ZoningKnowledgeService(pool);
    const reasoningService = new ZoningReasoningService(pool, knowledgeService);
    const pipeline = new ZoningApplicationPipeline(pool, knowledgeService, reasoningService);

    const analysisResult = await pipeline.execute(resolved.pipelineInput);

    const byRight = analysisResult.step4_capacityScenarios.find((s: any) => s.name === 'By Right');
    const moduleOutputs = {
      zoningIntelligence: {
        lastAnalysis: new Date().toISOString(),
        byRightUnits: byRight?.maxUnits || null,
        byRightGFA: byRight?.maxGFA || null,
        limitingFactor: byRight?.limitingFactor || null,
        buildableFootprint: analysisResult.step2_baseApplication.buildableFootprint,
        footprintSource: analysisResult.step2_baseApplication.footprintSource,
        confidence: analysisResult.step8_confidence.overall,
        districtCode: resolved.pipelineInput.districtCode,
        municipality: resolved.pipelineInput.municipality,
        scenarioCount: analysisResult.step4_capacityScenarios.length,
        incentiveCount: analysisResult.step5_incentivePrograms.length,
        autoPopulated: true,
      },
    };

    await pool.query(
      `UPDATE deals SET module_outputs = COALESCE(module_outputs, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(moduleOutputs), dealId]
    );

    console.log(`Auto-populated zoning capacity for deal ${dealId}: ${byRight?.maxUnits || 0} by-right units, confidence ${analysisResult.step8_confidence.overall}%`);
  } catch (err) {
    console.error(`Auto-populate error for deal ${dealId}:`, err);
  }
}

router.delete('/deals/:dealId/boundary', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    await pool.query(
      'DELETE FROM property_boundaries WHERE deal_id = $1',
      [dealId]
    );

    res.json({ success: true, message: 'Boundary deleted' });
  } catch (error: any) {
    console.error('Error deleting boundary:', error);
    res.status(500).json({ error: error.message || 'Failed to delete boundary' });
  }
});

router.get('/deals/:dealId/boundary/export', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const format = req.query.format || 'geojson';

    const result = await pool.query(
      'SELECT * FROM property_boundaries WHERE deal_id = $1',
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Boundary not found' });
    }

    if (format === 'geojson') {
      res.setHeader('Content-Type', 'application/geo+json');
      res.setHeader('Content-Disposition', `attachment; filename="boundary-${dealId}.geojson"`);
      res.json(result.rows[0].boundary_geojson);
    } else {
      res.status(400).json({ error: 'Unsupported export format' });
    }
  } catch (error: any) {
    console.error('Error exporting boundary:', error);
    res.status(500).json({ error: error.message || 'Failed to export boundary' });
  }
});

router.get('/deals/:dealId/development-capacity', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const boundaryResult = await pool.query(
      'SELECT * FROM property_boundaries WHERE deal_id = $1',
      [dealId]
    );

    if (boundaryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Boundary not defined' });
    }

    const boundary = boundaryResult.rows[0];

    const zoningResult = await pool.query(
      'SELECT * FROM zoning_capacity WHERE deal_id = $1',
      [dealId]
    );

    const zoning = zoningResult.rows[0] || {};

    const maxUnitsPerAcre = zoning.max_density || 60;
    const maxFAR = zoning.max_far || 2.5;
    const maxStories = zoning.max_stories || 6;
    const maxHeight = zoning.max_height || 75;
    const parkingRatio = zoning.parking_per_unit || 1.5;

    const byRightMaxUnits = Math.floor(
      (boundary.buildable_area || 0) * maxUnitsPerAcre
    );
    const byRightMaxBuildingSF = Math.floor(
      (boundary.parcel_area_sf || 0) * maxFAR
    );

    const withVariancesMaxUnits = Math.floor(byRightMaxUnits * 1.2);

    const capacity = {
      parcelArea: boundary.parcel_area,
      buildableArea: boundary.buildable_area,
      byRight: {
        maxUnits: byRightMaxUnits,
        maxBuildingSF: byRightMaxBuildingSF,
        maxStories,
        maxHeight,
        parkingRequired: Math.ceil(byRightMaxUnits * parkingRatio),
      },
      withVariances: {
        densityBonus: {
          available: true,
          bonusUnits: withVariancesMaxUnits - byRightMaxUnits,
          maxUnits: withVariancesMaxUnits,
        },
      },
    };

    res.json(capacity);
  } catch (error: any) {
    console.error('Error calculating capacity:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate capacity' });
  }
});

export default router;
