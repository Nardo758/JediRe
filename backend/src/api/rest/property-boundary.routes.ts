/**
 * Property Boundary API Routes
 * Handles site boundary definition for development deals
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Validation schemas
const SetbacksSchema = z.object({
  front: z.number().min(0).max(100),
  side: z.number().min(0).max(100),
  rear: z.number().min(0).max(100),
});

const ConstraintSchema = z.object({
  type: z.string(),
  geoJSON: z.any(), // GeoJSON.Feature
  description: z.string().optional(),
});

const BoundarySchema = z.object({
  dealId: z.string().uuid(),
  boundaryGeoJSON: z.any(), // GeoJSON.Feature<GeoJSON.Polygon>
  parcelArea: z.number().nullable(),
  parcelAreaSF: z.number().nullable(),
  perimeter: z.number().nullable(),
  centroid: z.tuple([z.number(), z.number()]).nullable(),
  setbacks: SetbacksSchema,
  buildableArea: z.number().nullable(),
  buildableAreaSF: z.number().nullable(),
  buildablePercentage: z.number().nullable(),
  constraints: z.object({
    easements: z.array(ConstraintSchema).optional(),
    floodplain: z.boolean().optional(),
    floodplainZone: z.string().optional(),
    wetlands: z.boolean().optional(),
    protectedArea: z.boolean().optional(),
  }).optional(),
  surveyDocumentUrl: z.string().url().optional(),
});

/**
 * GET /api/v1/deals/:dealId/boundary
 * Retrieve property boundary for a deal
 */
router.get('/deals/:dealId/boundary', async (req, res) => {
  try {
    const { dealId } = req.params;

    const { data, error } = await req.supabase
      .from('property_boundaries')
      .select('*')
      .eq('deal_id', dealId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No boundary found - return 404
        return res.status(404).json({ error: 'Boundary not found' });
      }
      throw error;
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching boundary:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch boundary' });
  }
});

/**
 * POST /api/v1/deals/:dealId/boundary
 * Create or update property boundary
 */
router.post('/deals/:dealId/boundary', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    // Validate request body
    const validatedData = BoundarySchema.parse({
      ...req.body,
      dealId,
    });

    // Check if boundary already exists
    const { data: existing } = await req.supabase
      .from('property_boundaries')
      .select('id')
      .eq('deal_id', dealId)
      .single();

    let result;

    if (existing) {
      // Update existing boundary
      const { data, error } = await req.supabase
        .from('property_boundaries')
        .update({
          boundary_geojson: validatedData.boundaryGeoJSON,
          parcel_area: validatedData.parcelArea,
          parcel_area_sf: validatedData.parcelAreaSF,
          perimeter: validatedData.perimeter,
          centroid: validatedData.centroid,
          setbacks: validatedData.setbacks,
          buildable_area: validatedData.buildableArea,
          buildable_area_sf: validatedData.buildableAreaSF,
          buildable_percentage: validatedData.buildablePercentage,
          constraints: validatedData.constraints || {},
          survey_document_url: validatedData.surveyDocumentUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('deal_id', dealId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new boundary
      const { data, error } = await req.supabase
        .from('property_boundaries')
        .insert({
          deal_id: dealId,
          boundary_geojson: validatedData.boundaryGeoJSON,
          parcel_area: validatedData.parcelArea,
          parcel_area_sf: validatedData.parcelAreaSF,
          perimeter: validatedData.perimeter,
          centroid: validatedData.centroid,
          setbacks: validatedData.setbacks,
          buildable_area: validatedData.buildableArea,
          buildable_area_sf: validatedData.buildableAreaSF,
          buildable_percentage: validatedData.buildablePercentage,
          constraints: validatedData.constraints || {},
          survey_document_url: validatedData.surveyDocumentUrl,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error saving boundary:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: error.message || 'Failed to save boundary' });
  }
});

/**
 * DELETE /api/v1/deals/:dealId/boundary
 * Delete property boundary
 */
router.delete('/deals/:dealId/boundary', async (req, res) => {
  try {
    const { dealId } = req.params;

    const { error } = await req.supabase
      .from('property_boundaries')
      .delete()
      .eq('deal_id', dealId);

    if (error) throw error;

    res.json({ success: true, message: 'Boundary deleted' });
  } catch (error: any) {
    console.error('Error deleting boundary:', error);
    res.status(500).json({ error: error.message || 'Failed to delete boundary' });
  }
});

/**
 * GET /api/v1/deals/:dealId/boundary/export
 * Export boundary in various formats (GeoJSON, KML, etc.)
 */
router.get('/deals/:dealId/boundary/export', async (req, res) => {
  try {
    const { dealId } = req.params;
    const format = req.query.format || 'geojson';

    const { data, error } = await req.supabase
      .from('property_boundaries')
      .select('*')
      .eq('deal_id', dealId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Boundary not found' });
    }

    // For now, only support GeoJSON export
    // TODO: Add KML, DXF, PDF exports
    if (format === 'geojson') {
      res.setHeader('Content-Type', 'application/geo+json');
      res.setHeader('Content-Disposition', `attachment; filename="boundary-${dealId}.geojson"`);
      res.json(data.boundary_geojson);
    } else {
      res.status(400).json({ error: 'Unsupported export format' });
    }
  } catch (error: any) {
    console.error('Error exporting boundary:', error);
    res.status(500).json({ error: error.message || 'Failed to export boundary' });
  }
});

/**
 * GET /api/v1/deals/:dealId/development-capacity
 * Calculate development capacity based on boundary and zoning
 */
router.get('/deals/:dealId/development-capacity', async (req, res) => {
  try {
    const { dealId } = req.params;

    // Get boundary data
    const { data: boundary, error: boundaryError } = await req.supabase
      .from('property_boundaries')
      .select('*')
      .eq('deal_id', dealId)
      .single();

    if (boundaryError) throw boundaryError;
    if (!boundary) {
      return res.status(404).json({ error: 'Boundary not defined' });
    }

    // Get deal data (for zoning info)
    const { data: deal, error: dealError } = await req.supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single();

    if (dealError) throw dealError;

    // TODO: Get actual zoning data from database or API
    // For now, use defaults
    const zoningData = deal.zoning_data || {
      maxUnitsPerAcre: 60,
      maxFAR: 2.5,
      maxStories: 6,
      maxHeight: 75,
      parkingRatio: 1.5,
    };

    // Calculate by-right capacity
    const byRightMaxUnits = Math.floor(
      (boundary.buildable_area || 0) * zoningData.maxUnitsPerAcre
    );
    const byRightMaxBuildingSF = Math.floor(
      (boundary.parcel_area_sf || 0) * zoningData.maxFAR
    );

    // Calculate with-variances capacity (example: 20% density bonus)
    const withVariancesMaxUnits = Math.floor(byRightMaxUnits * 1.2);

    const capacity = {
      parcelArea: boundary.parcel_area,
      buildableArea: boundary.buildable_area,
      byRight: {
        maxUnits: byRightMaxUnits,
        maxBuildingSF: byRightMaxBuildingSF,
        maxStories: zoningData.maxStories,
        maxHeight: zoningData.maxHeight,
        parkingRequired: Math.ceil(byRightMaxUnits * zoningData.parkingRatio),
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
