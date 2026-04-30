/**
 * Design Massing Generator — API endpoint for F7 AI Generate button.
 *
 * POST /api/v1/design/generate-massing
 *   Accepts program targets + parcel constraints, returns building sections.
 *
 * Calls the generate_design_massing tool internally.
 * Optionally calls compute_envelope first if no envelope provided.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateDesignMassingTool } from '../../agents/tools/generate_design_massing';
import { computeEnvelopeTool } from '../../agents/tools/compute_envelope';

const router = Router();

const generateMassingSchema = z.object({
  // Parcel / zoning constraints
  lot_sqft: z.number(),
  max_gfa_sqft: z.number().optional(),
  max_stories: z.number().optional(),
  max_footprint_sqft: z.number().optional(),
  buildable_lot_sqft: z.number().optional(),

  // Zoning input for compute_envelope (fallback if max_gfa not provided)
  far: z.number().optional(),
  max_height_ft: z.number().optional(),
  setback_front_ft: z.number().optional(),
  setback_rear_ft: z.number().optional(),
  setback_side_ft: z.number().optional(),
  max_lot_coverage_pct: z.number().optional(),

  // Program targets
  target_units: z.number().min(1),
  target_gfa: z.number().min(1),
  unit_mix_studio: z.number().optional(),
  unit_mix_one_bed: z.number().optional(),
  unit_mix_two_bed: z.number().optional(),
  unit_mix_three_bed: z.number().optional(),
  parking_ratio: z.number().optional().default(1.5),
  parking_structure: z.enum(['surface', 'podium', 'underground', 'garage']).optional().default('podium'),

  // Design preferences
  design_priority: z.enum(['density', 'unit_mix', 'open_space', 'parking']).optional().default('density'),
  form_factor: z.enum(['auto', 'bar', 'l_shape', 'u_shape', 'courtyard', 'point_tower']).optional().default('auto'),
});

/**
 * POST /api/v1/design/generate-massing
 */
router.post('/generate-massing', async (req: Request, res: Response) => {
  try {
    const body = generateMassingSchema.parse(req.body);

    // If no max_gfa given, run compute_envelope first
    let maxGfa = body.max_gfa_sqft;
    let maxStories = body.max_stories;
    let maxFootprint = body.max_footprint_sqft;
    let buildableLot = body.buildable_lot_sqft || body.lot_sqft;

    if (!maxGfa && body.far) {
      const envelopeResult = await computeEnvelopeTool.execute({
        lot_sqft: body.lot_sqft,
        far: body.far,
        max_height_ft: body.max_height_ft,
        setback_front_ft: body.setback_front_ft,
        setback_rear_ft: body.setback_rear_ft,
        setback_side_ft: body.setback_side_ft,
        max_lot_coverage_pct: body.max_lot_coverage_pct,
        avg_unit_size_sqft: 900,
      });
      maxGfa = envelopeResult.max_gfa_sqft;
      maxStories = envelopeResult.max_stories ?? maxStories;
      maxFootprint = envelopeResult.max_footprint_sqft ?? maxFootprint;
      buildableLot = envelopeResult.buildable_lot_sqft;
    }

    if (!maxGfa) {
      return res.status(400).json({ error: 'Could not determine max GFA. Provide max_gfa_sqft or far parameter.' });
    }

    const result = await generateDesignMassingTool.execute({
      lot_sqft: body.lot_sqft,
      max_gfa_sqft: maxGfa,
      max_stories: maxStories || 8,
      max_footprint_sqft: maxFootprint || body.lot_sqft,
      buildable_lot_sqft: buildableLot,
      target_units: body.target_units,
      target_gfa: body.target_gfa,
      unit_mix: {
        studio: body.unit_mix_studio ?? 10,
        oneBed: body.unit_mix_one_bed ?? 40,
        twoBed: body.unit_mix_two_bed ?? 35,
        threeBed: body.unit_mix_three_bed ?? 15,
      },
      parking_ratio: body.parking_ratio,
      parking_structure: body.parking_structure,
      design_priority: body.design_priority,
      form_factor: body.form_factor,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Design massing generation failed:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(500).json({ error: err.message || 'Massing generation failed' });
  }
});

export { router as designMassingRouter };
