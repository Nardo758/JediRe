/**
 * Tool: compute_envelope
 *
 * Computes the maximum buildable envelope for a parcel given its lot dimensions
 * and applicable zoning standards (FAR, height limit, setbacks, lot coverage).
 * Returns theoretical max GFA and unit counts under current zoning.
 *
 * All computation is local — no API call needed.
 *
 * Required capability: read:zoning
 */

import { z } from 'zod';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  lot_sqft: z.number().describe('Gross lot area in square feet'),
  lot_width_ft: z.number().optional().describe('Lot frontage width in feet'),
  lot_depth_ft: z.number().optional().describe('Lot depth in feet'),
  far: z.number().describe('Floor-to-area ratio from zoning code'),
  max_height_ft: z.number().optional().describe('Maximum building height in feet'),
  setback_front_ft: z.number().optional().default(0).describe('Front setback in feet'),
  setback_rear_ft: z.number().optional().default(0).describe('Rear setback in feet'),
  setback_side_ft: z.number().optional().default(0).describe('Side setback per side in feet (applied twice)'),
  max_lot_coverage_pct: z.number().optional().describe('Maximum impervious/building coverage 0-100'),
  avg_unit_size_sqft: z.number().optional().default(900).describe('Average unit size for unit count estimate'),
  floor_to_floor_height_ft: z.number().optional().default(12).describe('Floor-to-floor height for story estimate'),
});

const OutputSchema = z.object({
  max_gfa_sqft: z.number(),
  max_stories: z.number().nullable(),
  max_footprint_sqft: z.number().nullable(),
  est_max_units: z.number().nullable(),
  buildable_lot_sqft: z.number(),
  notes: z.array(z.string()).default([]),
});

export const computeEnvelopeTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'compute_envelope',
  description:
    'Compute the maximum buildable envelope (GFA, stories, unit count) for a parcel given ' +
    'its lot size and zoning parameters (FAR, height limit, setbacks, lot coverage). ' +
    'All inputs are required from prior fetch_zoning_code and fetch_parcel calls.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:zoning',

  execute: async (input) => {
    const notes: string[] = [];

    // Compute setback-reduced buildable area
    let buildable = input.lot_sqft;
    if (input.lot_width_ft && input.lot_depth_ft) {
      const w = input.lot_width_ft - 2 * (input.setback_side_ft ?? 0);
      const d = input.lot_depth_ft - (input.setback_front_ft ?? 0) - (input.setback_rear_ft ?? 0);
      buildable = Math.max(0, w * d);
      notes.push(`Setback-reduced footprint: ${Math.round(buildable).toLocaleString()} sq ft`);
    } else {
      const setbackReduction =
        ((input.setback_front_ft ?? 0) + (input.setback_rear_ft ?? 0) + 2 * (input.setback_side_ft ?? 0)) /
        (Math.sqrt(input.lot_sqft) || 1);
      if (setbackReduction > 0) {
        notes.push('Lot dimensions not provided — setback reduction estimated from lot area');
      }
    }

    // FAR-limited GFA
    const gfaFromFar = input.lot_sqft * input.far;

    // Lot-coverage-limited footprint
    let maxFootprint: number | null = null;
    if (input.max_lot_coverage_pct) {
      maxFootprint = Math.min(buildable, input.lot_sqft * (input.max_lot_coverage_pct / 100));
    } else {
      maxFootprint = buildable;
    }

    // Stories from height limit
    let maxStories: number | null = null;
    if (input.max_height_ft) {
      maxStories = Math.floor(input.max_height_ft / (input.floor_to_floor_height_ft ?? 12));
    }

    // Apply footprint × stories cap if footprint known
    let maxGfa = gfaFromFar;
    if (maxFootprint != null && maxStories != null) {
      const gfaFromFootprintHeight = maxFootprint * maxStories;
      maxGfa = Math.min(gfaFromFar, gfaFromFootprintHeight);
    }

    const estMaxUnits = input.avg_unit_size_sqft
      ? Math.floor(maxGfa / input.avg_unit_size_sqft)
      : null;

    notes.push(`FAR: ${input.far} → max GFA: ${Math.round(maxGfa).toLocaleString()} sq ft`);
    if (maxStories) notes.push(`Height limit ${input.max_height_ft} ft → up to ${maxStories} stories`);

    return {
      max_gfa_sqft: Math.round(maxGfa),
      max_stories: maxStories,
      max_footprint_sqft: maxFootprint ? Math.round(maxFootprint) : null,
      est_max_units: estMaxUnits,
      buildable_lot_sqft: Math.round(buildable),
      notes,
    };
  },
};
