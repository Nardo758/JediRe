import { z } from 'zod';

/**
 * score_fit_against_profile
 *
 * Deterministic scoring of extracted deal fields against the user's
 * acquisition preferences (from user_acquisition_preferences table).
 * No LLM call — pure code scoring.
 *
 * Scoring dimensions (each 0 or 1):
 *   1. market_match  — city/state in target_markets
 *   2. asset_match   — asset_class in property_types
 *   3. unit_range    — units within [min_units, max_units]
 *   4. price_range   — asking_price within [min_price, max_price]
 *   5. strategy_match— deal type (value-add, core, etc.) in strategies
 *
 * fit_score = sum / 5 (0.0 – 1.0), deal_fits = fit_score >= 0.4
 */

import { query } from '../../database/connection';
import { ExtractedDealFields } from './extract_deal_fields';

export interface FitScoreResult {
  fit_score: number;
  fit_breakdown: {
    market_match: boolean;
    asset_match: boolean;
    unit_range: boolean;
    price_range: boolean;
    strategy_match: boolean;
  };
  deal_fits: boolean;
  profile_found: boolean;
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(s => s.toLowerCase().trim());
  if (typeof value === 'string') {
    try { return JSON.parse(value).map(String); } catch { return [value.toLowerCase().trim()]; }
  }
  return [];
}

/**
 * Score extracted deal fields against the user's acquisition preferences.
 * Returns a dimensioned fit breakdown and composite score.
 */
export async function scoreFitAgainstProfile(
  fields: ExtractedDealFields,
  userId: string
): Promise<FitScoreResult> {
  const noProfile: FitScoreResult = {
    fit_score: 0.5,
    fit_breakdown: {
      market_match: true,
      asset_match: true,
      unit_range: true,
      price_range: true,
      strategy_match: true,
    },
    deal_fits: true,
    profile_found: false,
  };

  const prefResult = await query(
    `SELECT target_markets, property_types, min_units, max_units,
            min_price, max_price, strategies
     FROM user_acquisition_preferences
     WHERE user_id = $1 AND is_active = true
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  if (prefResult.rows.length === 0) {
    return noProfile;
  }

  const p = prefResult.rows[0];

  const targetMarkets = normalizeList(p.target_markets);
  const propertyTypes = normalizeList(p.property_types);
  const strategies = normalizeList(p.strategies);

  const marketMatch =
    targetMarkets.length === 0 ||
    (fields.city != null && targetMarkets.some(m =>
      fields.city!.toLowerCase().includes(m) || m.includes(fields.city!.toLowerCase())
    )) ||
    (fields.state != null && targetMarkets.some(m =>
      m === fields.state!.toLowerCase()
    ));

  const assetMatch =
    propertyTypes.length === 0 ||
    fields.asset_class == null ||
    propertyTypes.some(t =>
      t.includes(fields.asset_class!.toLowerCase()) ||
      fields.asset_class!.toLowerCase().includes(t)
    );

  const unitRange =
    fields.units == null ||
    ((p.min_units == null || fields.units >= p.min_units) &&
     (p.max_units == null || fields.units <= p.max_units));

  const priceRange =
    fields.asking_price == null ||
    ((p.min_price == null || fields.asking_price >= Number(p.min_price)) &&
     (p.max_price == null || fields.asking_price <= Number(p.max_price)));

  const strategyMatch =
    strategies.length === 0 ||
    fields.asset_class == null ||
    strategies.some(s =>
      fields.asset_class!.toLowerCase().includes(s) || s.includes(fields.asset_class!.toLowerCase())
    );

  const passed = [marketMatch, assetMatch, unitRange, priceRange, strategyMatch];
  const fit_score = passed.filter(Boolean).length / passed.length;

  return {
    fit_score,
    fit_breakdown: { market_match: marketMatch, asset_match: assetMatch, unit_range: unitRange, price_range: priceRange, strategy_match: strategyMatch },
    deal_fits: fit_score >= 0.4,
    profile_found: true,
  };
}


export const scoreFitAgainstProfileTool = {
  name: 'score_fit_against_profile',
  description: `Deterministic scoring of extracted deal fields against the user's acquisition preferences.
No LLM call — pure code scoring against user_acquisition_preferences table.
Scores on: market_match, asset_match, unit_range, price_range, strategy_match.
fit_score = dimensions_passed / 5 (0.0–1.0). Returns deal_fits if score >= 0.4.`,
  inputSchema: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    asking_price: z.number().optional(),
    units: z.number().optional(),
    asset_class: z.string().optional(),
    deal_type: z.string().optional().describe('value_add | core_plus | core | opportunistic'),
  }),
  outputSchema: z.object({
    fit_score: z.number(),
    fit_breakdown: z.object({
      market_match: z.boolean(),
      asset_match: z.boolean(),
      unit_range: z.boolean(),
      price_range: z.boolean(),
      strategy_match: z.boolean(),
    }),
    deal_fits: z.boolean(),
    profile_found: z.boolean(),
  }),
  execute: scoreFitAgainstProfile,
};
