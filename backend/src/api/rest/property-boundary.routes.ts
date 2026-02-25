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
      return res.status(404).json({ error: 'No property boundary saved. Draw a boundary in the Property Boundary tab first.' });
    }

    const boundary = boundaryResult.rows[0];
    const parcelAreaSF = parseFloat(boundary.parcel_area_sf) || (parseFloat(boundary.parcel_area) * 43560) || 0;
    const parcelAreaAcres = parseFloat(boundary.parcel_area) || (parcelAreaSF / 43560);
    const savedSetbacks = boundary.setbacks || {};

    const confirmResult = await pool.query(
      'SELECT * FROM deal_zoning_confirmations WHERE deal_id = $1',
      [dealId]
    );

    if (confirmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Zoning not confirmed. Confirm zoning in the Confirm Zoning tab first.' });
    }

    const confirmation = confirmResult.rows[0];
    const zoningCode = confirmation.zoning_code;
    const municipality = confirmation.municipality;

    let districtResult = await pool.query(
      `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
       FROM zoning_districts zd
       LEFT JOIN municipalities m ON m.id = zd.municipality_id
       WHERE UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)
         AND UPPER(COALESCE(zd.municipality, m.name, '')) = UPPER($2)
       LIMIT 1`,
      [zoningCode, municipality]
    );

    if (districtResult.rows.length === 0) {
      districtResult = await pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)
         LIMIT 1`,
        [zoningCode]
      );
    }

    let district = districtResult.rows[0] || null;

    const devStandardFields = [
      'max_density_per_acre', 'max_units_per_acre', 'max_far',
      'max_height_feet', 'max_building_height_ft', 'max_stories',
      'min_parking_per_unit', 'parking_per_unit',
      'setback_front_ft', 'setback_side_ft', 'setback_rear_ft',
      'min_front_setback_ft', 'min_side_setback_ft', 'min_rear_setback_ft',
    ];

    if (district) {
      const hasMissingStandards = devStandardFields.some(f => district[f] == null);
      const baseMatch = zoningCode.toUpperCase().match(/^(.+)-[A-Z]{1,2}$/);
      if (hasMissingStandards && baseMatch) {
        const baseParams: any[] = [baseMatch[1]];
        let baseWhere = 'UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)';
        if (district.municipality_id) {
          baseWhere += ' AND zd.municipality_id = $2';
          baseParams.push(district.municipality_id);
        } else if (district.municipality || municipality) {
          baseWhere += ' AND UPPER(COALESCE(zd.municipality, \'\')) = UPPER($2)';
          baseParams.push(district.municipality || municipality);
        }
        const baseResult = await pool.query(
          `SELECT zd.* FROM zoning_districts zd WHERE ${baseWhere} LIMIT 1`,
          baseParams
        );
        if (baseResult.rows.length > 0) {
          const base = baseResult.rows[0];
          for (const field of [...devStandardFields, 'district_name', 'description', 'permitted_uses']) {
            if (district[field] == null || district[field] === '') {
              if (base[field] != null && base[field] !== '') {
                district[field] = base[field];
              }
            }
          }
        }
      }
    }

    const maxDensity = district ? parseFloat(district.max_density_per_acre || district.max_units_per_acre) || null : null;
    const maxFAR = district ? parseFloat(district.max_far) || null : null;
    const maxHeight = district ? parseFloat(district.max_height_feet || district.max_building_height_ft) || null : null;
    const maxStories = district ? parseInt(district.max_stories) || null : null;
    const minParking = district ? parseFloat(district.min_parking_per_unit || district.parking_per_unit) || null : null;
    const maxLotCoverage = district ? parseFloat(district.max_lot_coverage || district.max_lot_coverage_percent) || null : null;

    const setbacks = {
      front: parseFloat(savedSetbacks.front) || parseFloat(district?.min_front_setback_ft || district?.setback_front_ft) || 25,
      side: parseFloat(savedSetbacks.side) || parseFloat(district?.min_side_setback_ft || district?.setback_side_ft) || 10,
      rear: parseFloat(savedSetbacks.rear) || parseFloat(district?.min_rear_setback_ft || district?.setback_rear_ft) || 20,
    };

    const envelopeService = new (require('../../services/building-envelope.service').BuildingEnvelopeService)();
    const envelope = envelopeService.calculateEnvelope({
      landArea: parcelAreaSF,
      setbacks,
      zoningConstraints: {
        maxDensity,
        maxFAR,
        maxHeight,
        maxStories,
        minParkingPerUnit: minParking,
        maxLotCoverage,
      },
      propertyType: 'multifamily',
    });

    const varianceEnvelope = envelopeService.calculateEnvelope({
      landArea: parcelAreaSF,
      setbacks,
      zoningConstraints: {
        maxDensity: maxDensity ? maxDensity * 1.2 : null,
        maxFAR: maxFAR ? maxFAR * 1.15 : null,
        maxHeight: maxHeight ? maxHeight + 10 : null,
        maxStories: maxStories ? maxStories + 1 : null,
        minParkingPerUnit: minParking ? minParking * 0.85 : null,
        maxLotCoverage,
      },
      propertyType: 'multifamily',
    });

    const rezoneEnvelope = envelopeService.calculateEnvelope({
      landArea: parcelAreaSF,
      setbacks,
      zoningConstraints: {
        maxDensity: maxDensity ? maxDensity * 1.6 : null,
        maxFAR: maxFAR ? maxFAR * 1.5 : null,
        maxHeight: maxHeight ? maxHeight * 1.5 : null,
        maxStories: maxStories ? maxStories + 3 : null,
        minParkingPerUnit: minParking ? minParking * 0.7 : null,
        maxLotCoverage,
      },
      propertyType: 'multifamily',
    });

    const buildScenario = (env: any, type: string) => {
      const meta: Record<string, any> = {
        by_right: { timeline: '6-9 months', cost: '$50K-$150K', riskLevel: 'low', successPercent: 95 },
        variance: { timeline: '9-18 months', cost: '$100K-$350K', riskLevel: 'medium', successPercent: 65 },
        rezone: { timeline: '12-36 months', cost: '$200K-$750K', riskLevel: 'high', successPercent: 35 },
      };
      const m = meta[type] || meta.by_right;
      const estValue = Math.round(env.maxCapacity * 250000);
      const byRightValue = Math.round(envelope.maxCapacity * 250000);
      return {
        scenarioType: type,
        label: type === 'by_right' ? 'Current Zoning' : type === 'variance' ? 'Variance Path' : 'Rezone Path',
        maxUnits: env.maxCapacity,
        maxHeight: env.maxFloors * 10,
        maxFar: maxFAR || 0,
        maxGfa: Math.round(env.maxGFA),
        parkingRequired: `${env.parkingRequired} spaces`,
        openSpace: Math.round(parcelAreaSF * 0.15),
        timeline: m.timeline,
        cost: m.cost,
        riskLevel: m.riskLevel,
        successPercent: m.successPercent,
        estimatedValue: estValue,
        deltaVsByRight: type === 'by_right' ? 0 : estValue - byRightValue,
        deltaPercent: type === 'by_right' ? 0 : byRightValue > 0 ? Math.round(((estValue - byRightValue) / byRightValue) * 100) : 0,
      };
    };

    res.json({
      parcelInfo: {
        address: confirmation.municipality ? `${zoningCode} — ${confirmation.municipality}, ${confirmation.state || ''}` : zoningCode,
        lotSize: `${parcelAreaAcres.toFixed(2)} acres (${Math.round(parcelAreaSF).toLocaleString()} SF)`,
        landAreaSF: Math.round(parcelAreaSF),
        landAreaAcres: parseFloat(parcelAreaAcres.toFixed(2)),
        currentZoning: zoningCode,
        districtName: district?.district_name || zoningCode,
      },
      envelope: {
        buildableArea: Math.round(envelope.buildableArea),
        maxFootprint: Math.round(envelope.maxFootprint),
        maxFloors: envelope.maxFloors,
        maxGFA: Math.round(envelope.maxGFA),
        maxCapacity: envelope.maxCapacity,
        limitingFactor: envelope.limitingFactor,
        parkingRequired: envelope.parkingRequired,
        parkingArea: envelope.parkingArea,
        capacityByConstraint: envelope.capacityByConstraint,
      },
      zoningStandards: {
        maxDensity,
        maxFAR,
        maxHeight,
        maxStories,
        minParking,
        maxLotCoverage,
        setbacks,
      },
      scenarios: [
        buildScenario(envelope, 'by_right'),
        buildScenario(varianceEnvelope, 'variance'),
        buildScenario(rezoneEnvelope, 'rezone'),
      ],
    });
  } catch (error: any) {
    console.error('Error calculating capacity:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate capacity' });
  }
});

// Zoning Confirmation endpoints
router.post('/deals/:dealId/zoning-confirmation', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { zoning_code, municipality, state, confirmed_at } = req.body;

    const existing = await pool.query(
      'SELECT id FROM deal_zoning_confirmations WHERE deal_id = $1',
      [dealId]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE deal_zoning_confirmations 
         SET zoning_code = $1, municipality = $2, state = $3, confirmed_at = $4, updated_at = NOW()
         WHERE deal_id = $5
         RETURNING *`,
        [zoning_code, municipality, state, confirmed_at, dealId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO deal_zoning_confirmations (deal_id, zoning_code, municipality, state, confirmed_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [dealId, zoning_code, municipality, state, confirmed_at]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error saving zoning confirmation:', error);
    res.status(500).json({ error: error.message || 'Failed to save zoning confirmation' });
  }
});

router.get('/deals/:dealId/zoning-confirmation', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const result = await pool.query(
      'SELECT * FROM deal_zoning_confirmations WHERE deal_id = $1',
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.json({ confirmed_at: null });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error fetching zoning confirmation:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch zoning confirmation' });
  }
});

export default router;
