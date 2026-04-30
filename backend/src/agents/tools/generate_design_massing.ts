/**
 * Tool: generate_design_massing
 *
 * Takes approved program targets + zoning envelope and generates an optimized
 * building massing: section-by-section form factor, floor counts, unit distribution.
 *
 * This drives the "AI Generate" button in the F7 3D Design tab.
 *
 * The algorithm:
 *   1. Determine if site fits a single bar, L-shape, U-shape, or courtyard
 *   2. Allocate residential floors vs podium vs parking
 *   3. Distribute unit mix across sections
 *   4. Return sections as typed data the Building3DEditor can consume
 *
 * Required capability: read:zoning + read:program
 */

import { z } from 'zod';
import type { ToolDefinition } from '../runtime/types';

// ─── Schema ─────────────────────────────────────────────────────────────────

const UnitMixSchema = z.object({
  studio: z.number().min(0).max(100).describe('Studio unit %'),
  oneBed: z.number().min(0).max(100).describe('1BR unit %'),
  twoBed: z.number().min(0).max(100).describe('2BR unit %'),
  threeBed: z.number().min(0).max(100).describe('3BR unit %'),
});

const InputSchema = z.object({
  // Parcel constraints (from compute_envelope or F2)
  lot_sqft: z.number().describe('Gross lot area in sqft'),
  max_gfa_sqft: z.number().describe('Max GFA from zoning envelope'),
  max_stories: z.number().describe('Max stories from zoning envelope'),
  max_footprint_sqft: z.number().describe('Max building footprint in sqft'),
  buildable_lot_sqft: z.number().describe('Buildable area after setbacks'),

  // Program targets (from F3 Programming tab)
  target_units: z.number().min(1).describe('Target unit count'),
  target_gfa: z.number().min(1).describe('Target GFA in sqft'),
  unit_mix: UnitMixSchema.optional().describe('Unit mix percentages'),
  parking_ratio: z.number().optional().default(1.5).describe('Parking spaces per unit'),
  parking_structure: z.enum(['surface', 'podium', 'underground', 'garage']).optional().default('podium'),

  // Design preferences
  design_priority: z.enum(['density', 'unit_mix', 'open_space', 'parking']).optional().default('density'),
  form_factor: z.enum(['auto', 'bar', 'l_shape', 'u_shape', 'courtyard', 'point_tower']).optional().default('auto'),
});

const SectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Width of the section in feet */
  width: z.number(),
  /** Depth of the section in feet */
  depth: z.number(),
  /** Number of residential floors in this section */
  floors: z.number(),
  /** Total stories (including parking/podium) */
  totalStories: z.number(),
  /** Position relative to site origin {x, y} in feet */
  position: z.object({ x: z.number(), y: z.number() }),
  /** Rotation in degrees */
  rotation: z.number().default(0),
  /** Unit breakdown by bedroom count */
  units: z.object({
    studio: z.number(),
    oneBed: z.number(),
    twoBed: z.number(),
    threeBed: z.number(),
    total: z.number(),
  }),
  /** Average unit size in sqft for this section */
  avgUnitSize: z.number(),
  /** Floor plate area (width * depth) */
  floorPlateSf: z.number(),
  /** Whether this section has ground-floor retail */
  hasRetail: z.boolean().default(false),
  /** Ground floor retail square footage (if applicable) */
  retailSf: z.number().default(0),
});

const OutputSchema = z.object({
  success: z.boolean(),
  /** Sections of the building */
  sections: z.array(SectionSchema),
  /** Aggregate totals */
  totals: z.object({
    totalGFA: z.number(),
    totalUnits: z.number(),
    totalFloors: z.number(),
    averageFloors: z.number(),
    far: z.number(),
    buildingFootprintSf: z.number(),
    lotCoverage: z.number(),
    parkingSpaces: z.number(),
    parkingLevels: z.number(),
  }),
  /** Design rationale */
  rationale: z.string(),
  warnings: z.array(z.string()),
});

// ─── Default Unit Mix ───────────────────────────────────────────────────────

const DEFAULT_MIX = { studio: 10, oneBed: 40, twoBed: 35, threeBed: 15 };

// ─── Helper: distribute units across sections ───────────────────────────────

function distributeUnits(
  totalUnits: number,
  mix: { studio: number; oneBed: number; twoBed: number; threeBed: number },
  sections: { floors: number; floorPlateSf: number }[],
  avgUnitSizeSf: number,
): { studio: number; oneBed: number; twoBed: number; threeBed: number; total: number }[] {
  // Weight distribution by floor plate area × floors
  const totalWeight = sections.reduce((s, sec) => s + sec.floorPlateSf * sec.floors, 0);

  return sections.map((sec) => {
    const weight = totalWeight > 0 ? (sec.floorPlateSf * sec.floors) / totalWeight : 1 / sections.length;
    const sectionUnits = Math.round(totalUnits * weight);

    return {
      studio: Math.round(sectionUnits * (mix.studio / 100)),
      oneBed: Math.round(sectionUnits * (mix.oneBed / 100)),
      twoBed: Math.round(sectionUnits * (mix.twoBed / 100)),
      threeBed: totalUnits > 0
        ? sectionUnits - Math.round(sectionUnits * ((mix.studio + mix.oneBed + mix.twoBed) / 100))
        : 0,
      total: sectionUnits,
    };
  });
}

// ─── Determine optimal form factor ──────────────────────────────────────────

function pickFormFactor(
  buildableSf: number,
  maxStories: number,
  targetUnits: number,
  preferred: string,
): { form: string; sections: { width: number; depth: number; floors: number; rotation: number }[] } {
  if (preferred !== 'auto') {
    preferred = preferred as string;
  }

  const lotWidth = Math.sqrt(buildableSf);
  const lotDepth = buildableSf / lotWidth;

  // Estimate needed floor plate per floor
  const unitsPerFloor = Math.max(1, Math.ceil(targetUnits / maxStories));
  const sfPerUnit = 900; // avg unit size
  const neededPlateSf = unitsPerFloor * sfPerUnit * 1.25; // 25% common area

  // Check what fits on the site
  const maxPlateSf = buildableSf;

  if (neededPlateSf <= maxPlateSf * 0.5 && maxStories >= 6) {
    // Point tower — small footprint, tall
    const towerWidth = Math.min(Math.sqrt(neededPlateSf), lotWidth * 0.4);
    const towerDepth = neededPlateSf / towerWidth;
    const floors = Math.min(maxStories, Math.ceil(targetUnits / Math.max(1, Math.floor(towerWidth * towerDepth / sfPerUnit))));
    return {
      form: 'point_tower',
      sections: [{ width: Math.round(towerWidth), depth: Math.round(towerDepth), floors, rotation: 0 }],
    };
  }

  if (neededPlateSf <= maxPlateSf * 0.7) {
    // Single bar — efficient
    const barWidth = Math.min(lotWidth * 0.8, 200); // max 200ft
    const barDepth = Math.min(Math.max(neededPlateSf / barWidth, 50), lotDepth * 0.8);
    const floors = Math.min(maxStories, Math.ceil(targetUnits / Math.max(1, Math.floor(barWidth * barDepth / sfPerUnit))));
    return {
      form: 'bar',
      sections: [{ width: Math.round(barWidth), depth: Math.round(barDepth), floors, rotation: 0 }],
    };
  }

  if (neededPlateSf <= maxPlateSf * 1.2) {
    // L-shape — two wings
    const wingWidth = Math.min(lotWidth * 0.5, 160);
    const wingDepth = Math.min(lotDepth * 0.6, 70);
    const wingFloors = Math.min(maxStories, Math.ceil(targetUnits / Math.max(1, 2 * Math.floor(wingWidth * wingDepth / sfPerUnit))));
    return {
      form: 'l_shape',
      sections: [
        { width: Math.round(wingWidth), depth: Math.round(wingDepth), floors: wingFloors, rotation: 0 },
        { width: Math.round(wingDepth), depth: Math.round(wingWidth * 0.7), floors: wingFloors, rotation: 0 },
      ],
    };
  }

  // U-shape or courtyard as last resort
  const wingWidth = Math.min(lotWidth * 0.35, 140);
  const wingDepth = Math.min(lotDepth * 0.55, 65);
  const courtWingFloors = Math.min(maxStories, Math.ceil(targetUnits / Math.max(1, 3 * Math.floor(wingWidth * wingDepth / sfPerUnit))));

  return {
    form: 'u_shape',
    sections: [
      { width: Math.round(wingWidth), depth: Math.round(wingDepth), floors: courtWingFloors, rotation: 0 },
      { width: Math.round(wingWidth), depth: Math.round(wingDepth), floors: courtWingFloors, rotation: 0 },
      { width: Math.round(lotWidth * 0.7), depth: Math.round(wingDepth * 0.6), floors: courtWingFloors, rotation: 0 },
    ],
  };
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const generateDesignMassingTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'generate_design_massing',
  description:
    'Generate an optimized building massing from program targets and zoning envelope. ' +
    'Returns section-by-section geometry, unit distribution, and aggregate metrics. ' +
    'The output can be fed directly into the F7 3D editor Building3DEditor.state.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:zoning', // and implicitly read:program

  execute: async (input) => {
    const warnings: string[] = [];

    // Validate program vs envelope
    const mix = input.unit_mix || DEFAULT_MIX;
    const mixTotal = mix.studio + mix.oneBed + mix.twoBed + mix.threeBed;
    if (Math.abs(mixTotal - 100) > 5) {
      warnings.push(`Unit mix sums to ${mixTotal}% — expected ~100%. Using defaults.`);
    }

    // Clamp targets to zoning maxes
    const clampedUnits = Math.min(input.target_units, Math.floor(input.max_gfa_sqft / 700));
    const clampedGfa = Math.min(input.target_gfa, input.max_gfa_sqft);

    if (clampedUnits < input.target_units) {
      warnings.push(`Target units (${input.target_units}) exceeds zoning capacity (${clampedUnits}). Clamped.`);
    }
    if (clampedGfa < input.target_gfa) {
      warnings.push(`Target GFA (${input.target_gfa.toLocaleString()}) exceeds zoning max (${input.max_gfa_sqft.toLocaleString()}). Clamped.`);
    }

    // Determine form factor
    const formResult = pickFormFactor(input.buildable_lot_sqft, input.max_stories, clampedUnits, input.form_factor);

    // Compute avg unit size for this design
    const avgUnitSize = Math.min(1200, Math.max(650, clampedGfa / clampedUnits));

    // Distribute parking
    const parkingSpaces = Math.round(clampedUnits * input.parking_ratio);
    const parkingLevels = input.parking_structure === 'surface' ? 1
      : input.parking_structure === 'podium' ? Math.max(1, Math.ceil(parkingSpaces / 60))
      : input.parking_structure === 'garage' ? Math.max(2, Math.ceil(parkingSpaces / 80))
      : Math.max(1, Math.ceil(parkingSpaces / 50));

    // Build sections with unit distribution
    const sectionsData = formResult.sections.map((sec, i) => ({
      floors: sec.floors,
      floorPlateSf: sec.width * sec.depth,
    }));

    const unitDistribution = distributeUnits(clampedUnits, mix, sectionsData, avgUnitSize);

    const sections = formResult.sections.map((sec, i) => {
      const plateSf = sec.width * sec.depth;
      const units_i = unitDistribution[i];
      const totalStories = sec.floors + parkingLevels;
      // Retail on ground floor if total stories >= 4 and this is the front wing
      const hasRetail = i === 0 && sec.floors >= 3;
      const retailSf = hasRetail ? Math.round(plateSf * 0.3) : 0;

      return {
        id: `section-${String.fromCharCode(65 + i)}`,
        name: `Wing ${String.fromCharCode(65 + i)}`,
        width: sec.width,
        depth: sec.depth,
        floors: sec.floors,
        totalStories,
        position: {
          x: i === 0 ? 0 : (i === 1 ? Math.round(sec.width * 0.4) : 0),
          y: i === 2 ? Math.round(sec.depth * 0.5) : 0,
        },
        rotation: sec.rotation,
        units: {
          studio: units_i.studio,
          oneBed: units_i.oneBed,
          twoBed: units_i.twoBed,
          threeBed: units_i.threeBed,
          total: units_i.total,
        },
        avgUnitSize: Math.round(avgUnitSize),
        floorPlateSf: plateSf,
        hasRetail,
        retailSf,
      };
    });

    // Aggregate totals
    const totalGFA = sections.reduce((s, sec) => s + sec.floorPlateSf * sec.totalStories, 0);
    const buildingFootprint = sections.reduce((s, sec) => s + sec.floorPlateSf, 0);
    const totalUnits = sections.reduce((s, sec) => s + sec.units.total, 0);

    // Form factor rationale
    const rationaleMap: Record<string, string> = {
      point_tower: `Point tower: ${sections[0].floors} residential floors on ${parkingLevels} parking level(s). ` +
        `Efficient footprint (${Math.round(sections[0].width)}' x ${sections[0].depth}'), maximizes open space (${Math.round(100 - buildingFootprint / input.lot_sqft * 100)}% lot coverage).`,
      bar: `Single bar: ${sections[0].floors} residential floors on ${parkingLevels} parking level(s). ` +
        `Good efficiency for a ${Math.round(sections[0].width)}' x ${sections[0].depth}' floor plate. ` +
        `Total FAR: ${(totalGFA / input.lot_sqft).toFixed(2)}.`,
      l_shape: `L-shape: two wings forming an L around an open courtyard. ` +
        `Wing A: ${sections[0].floors} floors, Wing B: ${sections[1].floors} floors. ` +
        `Courtyard provides natural light and amenity space.`,
      u_shape: `U-shape: three wings wrapping a central courtyard. ` +
        `Maximizes exterior wall exposure for natural light. ` +
        `Sections: ${sections.map((s) => `${s.name}=${s.floors}f`).join(', ')}.`,
    };

    return {
      success: true,
      sections,
      totals: {
        totalGFA: Math.round(totalGFA),
        totalUnits,
        totalFloors: sections.reduce((s, sec) => Math.max(s, sec.floors), 0),
        averageFloors: Math.round(sections.reduce((s, sec) => s + sec.floors, 0) / sections.length),
        far: parseFloat((totalGFA / input.lot_sqft).toFixed(2)),
        buildingFootprintSf: Math.round(buildingFootprint),
        lotCoverage: parseFloat(((buildingFootprint / input.lot_sqft) * 100).toFixed(1)),
        parkingSpaces,
        parkingLevels,
      },
      rationale: rationaleMap[formResult.form] || `Generated ${formResult.form} massing with ${sections.length} section(s).`,
      warnings,
    };
  },
};
