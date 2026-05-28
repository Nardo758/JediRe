/**
 * fetch_comp_set Tool
 * 
 * Retrieves competitive set for a deal with pricing data.
 * Used by CashFlow agent to benchmark rents against comps.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export const fetchCompSetSchema = z.object({
  deal_id: z.string().describe('Deal ID to fetch comp set for'),
  include_pricing_history: z.boolean().default(true).describe('Include recent pricing snapshots'),
  include_inactive: z.boolean().default(false).describe('Include deactivated comps'),
});

export type FetchCompSetInput = z.infer<typeof fetchCompSetSchema>;

export interface CompSetResult {
  dealId: string;
  comps: {
    id: string;
    compName: string;
    compAddress: string;
    compCity: string;
    compState: string;
    compUnits: number;
    compYearBuilt: number;
    compAssetClass: string;
    compDistanceMiles: number;
    relevanceScore: number;
    source: string;
    latestPricing: {
      snapshotDate: string;
      avgAskingRent: number;
      avgEffectiveRent: number;
      estimatedOccupancy: number;
      concessions: string;
    } | null;
    pricingTrend: {
      threeMonthChange: number;
      sixMonthChange: number;
      twelveMonthChange: number;
    } | null;
  }[];
  summary: {
    compCount: number;
    avgCompRent: number;
    avgCompOccupancy: number;
    rentRange: { min: number; max: number };
    avgYearBuilt: number;
    avgUnits: number;
    avgDistanceMiles: number;
  };
  competitivePosition: {
    subjectRent: number;
    rentPremiumPct: number;
    position: 'premium' | 'market' | 'discount';
  } | null;
}

/**
 * Fetch competitive set with pricing
 */
export async function fetchCompSet(input: FetchCompSetInput): Promise<CompSetResult> {
  logger.info('[fetch_comp_set] Fetching comp set', { dealId: input.deal_id });

  // Get comp set
  const compQuery = `
    SELECT 
      cs.id,
      cs.comp_name,
      cs.comp_address,
      cs.comp_city,
      cs.comp_state,
      cs.comp_units,
      cs.comp_year_built,
      cs.asset_class,
      cs.comp_distance_miles,
      cs.relevance_score,
      cs.source
    FROM competitive_sets cs
    WHERE cs.deal_id = $1
      ${input.include_inactive ? '' : 'AND cs.is_active = true'}
    ORDER BY cs.relevance_score DESC
  `;

  const compResult = await query(compQuery, [input.deal_id]);

  // Get latest pricing for each comp
  const pricingQuery = `
    SELECT DISTINCT ON (cps.comp_set_id)
      cps.comp_set_id,
      cps.snapshot_date,
      cps.avg_asking_rent,
      cps.avg_effective_rent,
      cps.estimated_occupancy,
      cps.concessions_offered
    FROM comp_pricing_snapshots cps
    WHERE cps.deal_id = $1
    ORDER BY cps.comp_set_id, cps.snapshot_date DESC
  `;

  const pricingResult = input.include_pricing_history
    ? await query(pricingQuery, [input.deal_id])
    : { rows: [] };

  // Get pricing trends (3mo, 6mo, 12mo changes)
  const trendQuery = `
    WITH latest AS (
      SELECT DISTINCT ON (comp_set_id)
        comp_set_id, avg_asking_rent as current_rent
      FROM comp_pricing_snapshots
      WHERE deal_id = $1
      ORDER BY comp_set_id, snapshot_date DESC
    ),
    three_mo AS (
      SELECT DISTINCT ON (comp_set_id)
        comp_set_id, avg_asking_rent as rent_3mo
      FROM comp_pricing_snapshots
      WHERE deal_id = $1 AND snapshot_date <= CURRENT_DATE - INTERVAL '3 months'
      ORDER BY comp_set_id, snapshot_date DESC
    ),
    six_mo AS (
      SELECT DISTINCT ON (comp_set_id)
        comp_set_id, avg_asking_rent as rent_6mo
      FROM comp_pricing_snapshots
      WHERE deal_id = $1 AND snapshot_date <= CURRENT_DATE - INTERVAL '6 months'
      ORDER BY comp_set_id, snapshot_date DESC
    ),
    twelve_mo AS (
      SELECT DISTINCT ON (comp_set_id)
        comp_set_id, avg_asking_rent as rent_12mo
      FROM comp_pricing_snapshots
      WHERE deal_id = $1 AND snapshot_date <= CURRENT_DATE - INTERVAL '12 months'
      ORDER BY comp_set_id, snapshot_date DESC
    )
    SELECT 
      l.comp_set_id,
      CASE WHEN t.rent_3mo > 0 THEN ((l.current_rent - t.rent_3mo) / t.rent_3mo) * 100 ELSE NULL END as change_3mo,
      CASE WHEN s.rent_6mo > 0 THEN ((l.current_rent - s.rent_6mo) / s.rent_6mo) * 100 ELSE NULL END as change_6mo,
      CASE WHEN tw.rent_12mo > 0 THEN ((l.current_rent - tw.rent_12mo) / tw.rent_12mo) * 100 ELSE NULL END as change_12mo
    FROM latest l
    LEFT JOIN three_mo t ON t.comp_set_id = l.comp_set_id
    LEFT JOIN six_mo s ON s.comp_set_id = l.comp_set_id
    LEFT JOIN twelve_mo tw ON tw.comp_set_id = l.comp_set_id
  `;

  const trendResult = input.include_pricing_history
    ? await query(trendQuery, [input.deal_id])
    : { rows: [] };

  // Build pricing maps
  const pricingMap = new Map<string, Record<string, unknown>>();
  for (const row of pricingResult.rows as Record<string, unknown>[]) {
    pricingMap.set(String(row.comp_set_id), row);
  }

  const trendMap = new Map<string, Record<string, number | null>>();
  for (const row of trendResult.rows as Record<string, unknown>[]) {
    trendMap.set(String(row.comp_set_id), {
      change_3mo: row.change_3mo as number | null,
      change_6mo: row.change_6mo as number | null,
      change_12mo: row.change_12mo as number | null,
    });
  }

  // Build comp list
  const comps = (compResult.rows as Record<string, unknown>[]).map(row => {
    const pricing = pricingMap.get(String(row.id));
    const trend = trendMap.get(String(row.id));

    return {
      id: String(row.id),
      compName: String(row.comp_name),
      compAddress: String(row.comp_address ?? ''),
      compCity: String(row.comp_city ?? ''),
      compState: String(row.comp_state ?? ''),
      compUnits: Number(row.comp_units ?? 0),
      compYearBuilt: Number(row.comp_year_built ?? 0),
      compAssetClass: String(row.asset_class ?? ''),
      compDistanceMiles: Number(row.comp_distance_miles ?? 0),
      relevanceScore: Number(row.relevance_score ?? 100),
      source: String(row.source ?? ''),
      latestPricing: pricing
        ? {
            snapshotDate: new Date(pricing.snapshot_date as string).toISOString().split('T')[0],
            avgAskingRent: Number(pricing.avg_asking_rent ?? 0),
            avgEffectiveRent: Number(pricing.avg_effective_rent ?? 0),
            estimatedOccupancy: Number(pricing.estimated_occupancy ?? 0),
            concessions: String(pricing.concessions_offered ?? ''),
          }
        : null,
      pricingTrend: trend
        ? {
            threeMonthChange: trend.change_3mo ?? 0,
            sixMonthChange: trend.change_6mo ?? 0,
            twelveMonthChange: trend.change_12mo ?? 0,
          }
        : null,
    };
  });

  // Calculate summary
  const compsWithPricing = comps.filter(c => c.latestPricing);
  const avgCompRent = compsWithPricing.length > 0
    ? compsWithPricing.reduce((sum, c) => sum + (c.latestPricing?.avgAskingRent ?? 0), 0) / compsWithPricing.length
    : 0;
  const avgCompOccupancy = compsWithPricing.length > 0
    ? compsWithPricing.reduce((sum, c) => sum + (c.latestPricing?.estimatedOccupancy ?? 0), 0) / compsWithPricing.length
    : 0;

  const rentValues = compsWithPricing.map(c => c.latestPricing?.avgAskingRent ?? 0).filter(r => r > 0);
  const rentRange = rentValues.length > 0
    ? { min: Math.min(...rentValues), max: Math.max(...rentValues) }
    : { min: 0, max: 0 };

  // Get subject property's current rent for competitive position
  const subjectRentResult = await query(
    `SELECT AVG(current_rent) as avg_rent
     FROM rent_roll_units
     WHERE deal_id = $1 
       AND as_of_date = (SELECT MAX(as_of_date) FROM rent_roll_units WHERE deal_id = $1)`,
    [input.deal_id]
  );

  const subjectRent = Number((subjectRentResult.rows[0] as Record<string, number>)?.avg_rent ?? 0);

  let competitivePosition: CompSetResult['competitivePosition'] = null;
  if (subjectRent > 0 && avgCompRent > 0) {
    const rentPremiumPct = ((subjectRent - avgCompRent) / avgCompRent) * 100;
    let position: 'premium' | 'market' | 'discount';
    if (rentPremiumPct > 5) position = 'premium';
    else if (rentPremiumPct < -5) position = 'discount';
    else position = 'market';

    competitivePosition = {
      subjectRent,
      rentPremiumPct,
      position,
    };
  }

  const result: CompSetResult = {
    dealId: input.deal_id,
    comps,
    summary: {
      compCount: comps.length,
      avgCompRent,
      avgCompOccupancy,
      rentRange,
      avgYearBuilt: comps.length > 0
        ? Math.round(comps.reduce((sum, c) => sum + c.compYearBuilt, 0) / comps.length)
        : 0,
      avgUnits: comps.length > 0
        ? Math.round(comps.reduce((sum, c) => sum + c.compUnits, 0) / comps.length)
        : 0,
      avgDistanceMiles: comps.length > 0
        ? Number((comps.reduce((sum, c) => sum + c.compDistanceMiles, 0) / comps.length).toFixed(1))
        : 0,
    },
    competitivePosition,
  };

  logger.info('[fetch_comp_set] Fetched comp set', {
    dealId: input.deal_id,
    compCount: comps.length,
    avgCompRent,
  });

  return result;
}

/**
 * Tool definition for agent registration
 */
export const fetchCompSetTool = {
  name: 'fetch_comp_set',
  description: `Retrieve the competitive set for a deal with pricing data.
Returns list of comparable properties with their:
- Latest asking/effective rents
- Occupancy estimates
- 3/6/12 month rent trends
- Distance and relevance scores

Also returns summary metrics and the subject's competitive position (premium/market/discount).

Use to benchmark underwriting rent assumptions against local comps.`,
  inputSchema: fetchCompSetSchema,
  outputSchema: z.any(),
  execute: fetchCompSet,
};
