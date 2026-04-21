/**
 * write_comp_set Tool
 * 
 * Adds comparable properties to a deal's competitive set.
 * Used by Research Agent when discovering comps during market research.
 */

import { z } from 'zod';
import { query, getClient } from '../../database/connection';
import { logger } from '../../utils/logger';

export const writeCompSetSchema = z.object({
  deal_id: z.string().describe('Deal ID to add comps to'),
  comps: z.array(z.object({
    comp_name: z.string().describe('Property name'),
    comp_address: z.string().optional(),
    comp_city: z.string().optional(),
    comp_state: z.string().optional(),
    comp_zip: z.string().optional(),
    comp_units: z.number().optional().describe('Unit count'),
    comp_year_built: z.number().optional(),
    comp_asset_class: z.enum(['A', 'B', 'C', 'A+', 'B+', 'C+']).optional(),
    comp_distance_miles: z.number().optional(),
    
    // Pricing data if known
    avg_asking_rent: z.number().optional().describe('Average asking rent'),
    avg_effective_rent: z.number().optional().describe('Average effective rent'),
    estimated_occupancy: z.number().optional().describe('Estimated occupancy %'),
    concessions: z.string().optional().describe('Current concessions offered'),
    
    // Source tracking
    source: z.enum(['costar', 'yardi_matrix', 'apartments_com', 'web_research', 'broker', 'manual']).default('web_research'),
    source_url: z.string().optional(),
    source_id: z.string().optional().describe('ID in source system'),
    
    // Relevance
    relevance_notes: z.string().optional().describe('Why this comp is relevant'),
  })).min(1).describe('Comparable properties to add'),
  
  created_at_stage: z.enum(['underwriting', 'operations']).default('underwriting'),
});

export type WriteCompSetInput = z.infer<typeof writeCompSetSchema>;

export interface WriteCompSetResult {
  dealId: string;
  compsAdded: number;
  compIds: string[];
  duplicatesSkipped: number;
  pricingSnapshotsCreated: number;
}

/**
 * Calculate relevance score based on property similarity
 */
function calculateRelevanceScore(
  comp: WriteCompSetInput['comps'][0],
  dealContext?: { units?: number; year_built?: number; asset_class?: string }
): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};
  let totalWeight = 0;
  let weightedScore = 0;

  // Distance (40% weight if available)
  if (comp.comp_distance_miles != null) {
    const distanceScore = comp.comp_distance_miles <= 1 ? 100 :
      comp.comp_distance_miles <= 3 ? 80 :
      comp.comp_distance_miles <= 5 ? 60 :
      comp.comp_distance_miles <= 10 ? 40 : 20;
    factors.distance = distanceScore;
    weightedScore += distanceScore * 0.4;
    totalWeight += 0.4;
  }

  // Asset class match (30% weight if both available)
  if (comp.comp_asset_class && dealContext?.asset_class) {
    const compClass = comp.comp_asset_class.charAt(0);
    const dealClass = dealContext.asset_class.charAt(0);
    const classScore = compClass === dealClass ? 100 : 
      Math.abs(compClass.charCodeAt(0) - dealClass.charCodeAt(0)) === 1 ? 60 : 30;
    factors.asset_class = classScore;
    weightedScore += classScore * 0.3;
    totalWeight += 0.3;
  }

  // Vintage similarity (15% weight if both available)
  if (comp.comp_year_built && dealContext?.year_built) {
    const yearDiff = Math.abs(comp.comp_year_built - dealContext.year_built);
    const vintageScore = yearDiff <= 5 ? 100 : yearDiff <= 10 ? 80 : yearDiff <= 20 ? 50 : 20;
    factors.vintage = vintageScore;
    weightedScore += vintageScore * 0.15;
    totalWeight += 0.15;
  }

  // Size similarity (15% weight if both available)
  if (comp.comp_units && dealContext?.units) {
    const sizeDiff = Math.abs(comp.comp_units - dealContext.units) / dealContext.units;
    const sizeScore = sizeDiff <= 0.2 ? 100 : sizeDiff <= 0.5 ? 70 : sizeDiff <= 1.0 ? 40 : 20;
    factors.size = sizeScore;
    weightedScore += sizeScore * 0.15;
    totalWeight += 0.15;
  }

  // Normalize to 100 if we have partial data
  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;

  return { score, factors };
}

/**
 * Write comps to competitive set
 */
export async function writeCompSet(input: WriteCompSetInput): Promise<WriteCompSetResult> {
  logger.info('[write_comp_set] Adding comps', {
    dealId: input.deal_id,
    compCount: input.comps.length,
  });

  // Get deal context for relevance scoring
  const dealResult = await query(
    `SELECT 
      (deal_data->>'unit_count')::int as units,
      (deal_data->>'year_built')::int as year_built,
      deal_data->>'asset_class' as asset_class
     FROM deals WHERE id = $1`,
    [input.deal_id]
  );
  const dealContext = dealResult.rows[0] as { units?: number; year_built?: number; asset_class?: string } | undefined;

  const client = await getClient();
  const compIds: string[] = [];
  let duplicatesSkipped = 0;
  let pricingSnapshotsCreated = 0;

  try {
    await client.query('BEGIN');

    for (const comp of input.comps) {
      // Check for duplicate (same name + address)
      const existingResult = await client.query(
        `SELECT id FROM competitive_sets 
         WHERE deal_id = $1 AND comp_name = $2 AND (comp_address = $3 OR ($3 IS NULL AND comp_address IS NULL))`,
        [input.deal_id, comp.comp_name, comp.comp_address]
      );

      if (existingResult.rows.length > 0) {
        duplicatesSkipped++;
        // Still update pricing if we have new data
        if (comp.avg_asking_rent || comp.avg_effective_rent) {
          const existingId = existingResult.rows[0].id;
          await client.query(
            `INSERT INTO comp_pricing_snapshots (
              comp_set_id, deal_id, snapshot_date,
              avg_asking_rent, avg_effective_rent, estimated_occupancy, concessions_offered,
              source, source_url
            ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)`,
            [
              existingId, input.deal_id,
              comp.avg_asking_rent, comp.avg_effective_rent, comp.estimated_occupancy, comp.concessions,
              comp.source, comp.source_url,
            ]
          );
          pricingSnapshotsCreated++;
        }
        continue;
      }

      // Calculate relevance score
      const { score, factors } = calculateRelevanceScore(comp, dealContext);

      // Insert comp
      const insertResult = await client.query(
        `INSERT INTO competitive_sets (
          deal_id, created_at_stage,
          comp_name, comp_address, comp_city, comp_state, comp_zip,
          comp_units, comp_year_built, comp_asset_class, comp_distance_miles,
          relevance_score, relevance_factors,
          source, source_id
        ) VALUES (
          $1, $2,
          $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13,
          $14, $15
        ) RETURNING id`,
        [
          input.deal_id, input.created_at_stage,
          comp.comp_name, comp.comp_address, comp.comp_city, comp.comp_state, comp.comp_zip,
          comp.comp_units, comp.comp_year_built, comp.comp_asset_class, comp.comp_distance_miles,
          score, JSON.stringify(factors),
          comp.source, comp.source_id,
        ]
      );

      const compId = insertResult.rows[0].id;
      compIds.push(compId);

      // Create pricing snapshot if we have data
      if (comp.avg_asking_rent || comp.avg_effective_rent) {
        await client.query(
          `INSERT INTO comp_pricing_snapshots (
            comp_set_id, deal_id, snapshot_date,
            avg_asking_rent, avg_effective_rent, estimated_occupancy, concessions_offered,
            source, source_url
          ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)`,
          [
            compId, input.deal_id,
            comp.avg_asking_rent, comp.avg_effective_rent, comp.estimated_occupancy, comp.concessions,
            comp.source, comp.source_url,
          ]
        );
        pricingSnapshotsCreated++;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  logger.info('[write_comp_set] Comps added', {
    dealId: input.deal_id,
    added: compIds.length,
    duplicatesSkipped,
    pricingSnapshotsCreated,
  });

  return {
    dealId: input.deal_id,
    compsAdded: compIds.length,
    compIds,
    duplicatesSkipped,
    pricingSnapshotsCreated,
  };
}

/**
 * Tool definition for agent registration
 */
export const writeCompSetTool = {
  name: 'write_comp_set',
  description: `Add comparable properties to a deal's competitive set.
Used during research to capture discovered comps with their pricing data.

Each comp can include:
- Property details (name, address, units, year built, asset class)
- Distance from subject property
- Current pricing (asking rent, effective rent, occupancy)
- Concessions being offered
- Source tracking (CoStar, Yardi Matrix, web research, etc.)

Automatically:
- Calculates relevance score based on similarity to subject
- Skips duplicates (updates pricing if new data available)
- Creates pricing snapshots for trend tracking`,
  inputSchema: writeCompSetSchema,
  outputSchema: z.any(),
  execute: writeCompSet,
};
