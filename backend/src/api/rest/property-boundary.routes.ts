import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPool } from '../../database/connection';

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
  centroid: z.tuple([z.number(), z.number()]).nullable().optional(),
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
});

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

    const centroidValue = validatedData.centroid
      ? `(${validatedData.centroid[0]},${validatedData.centroid[1]})`
      : null;

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

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error saving boundary:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({ error: error.message || 'Failed to save boundary' });
  }
});

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
