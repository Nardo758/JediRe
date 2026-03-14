// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Product Type Strategy Adaptation
// ═══════════════════════════════════════════════════════════════════════════════
//
// For a given DealType × ProductType combination, determines which strategy
// columns are available in the Strategy Arbitrage module (M08).
//
// Strategy availability is driven by the feasibility of each strategy for
// the specific product type and deal type.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { DealType, StrategyId } from './deal-type-visibility';

// ─── Product Types ──────────────────────────────────────────────────────────

export type ProductType =
  | 'mf_garden'       // Garden-style multifamily
  | 'mf_wrap'         // Wrap parking multifamily
  | 'mf_midrise'      // Mid-rise multifamily
  | 'mf_highrise'     // High-rise multifamily
  | 'mf_townhome'     // Townhomes
  | 'office'          // Office
  | 'retail'          // Retail
  | 'industrial'      // Industrial/Warehouse
  | 'hospitality'     // Hotels/Lodging
  | 'mixed_use';      // Mixed-use

// ─── Strategy Strength Assessment ───────────────────────────────────────────

export type StrategyStrength = 'na' | 'weak' | 'moderate' | 'strong';

export interface StrategyProductFit {
  strength: StrategyStrength;
  description: string;
}

// ─── Strategy Availability by Deal Type × Product Type ──────────────────────

/**
 * Defines which strategies are available and how strong they are for each
 * DealType × ProductType combination.
 *
 * Strategy strength:
 *   - 'na': Strategy not applicable for this combination (hidden from UI)
 *   - 'weak': Technically possible but not commonly pursued
 *   - 'moderate': Common approach for this product type
 *   - 'strong': Primary strategy for this product type
 */
export const STRATEGY_PRODUCT_MATRIX: Record<
  DealType,
  Record<ProductType, Record<StrategyId, StrategyProductFit>>
> = {
  existing: {
    mf_garden: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'strong', description: 'Value-add play: renovate + stabilize + sell' },
      RENTAL: { strength: 'moderate', description: 'Stabilized hold for cash flow' },
      STR: { strength: 'weak', description: 'Less common for garden product in most markets' },
    },
    mf_wrap: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'strong', description: 'Value-add play: renovate + stabilize + sell' },
      RENTAL: { strength: 'strong', description: 'Premium stabilized hold with parking upside' },
      STR: { strength: 'weak', description: 'Possible but less common' },
    },
    mf_midrise: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'strong', description: 'Value-add play: renovate + stabilize + sell' },
      RENTAL: { strength: 'strong', description: 'Stabilized hold for cash flow' },
      STR: { strength: 'weak', description: 'Less common for midrise' },
    },
    mf_highrise: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'moderate', description: 'Value-add possible but capital intensive' },
      RENTAL: { strength: 'strong', description: 'Institutional quality hold' },
      STR: { strength: 'weak', description: 'Not suitable for highrise' },
    },
    mf_townhome: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'strong', description: 'Unit-by-unit or community flip' },
      RENTAL: { strength: 'moderate', description: 'Hold for cash flow' },
      STR: { strength: 'strong', description: 'High STR conversion potential' },
    },
    office: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'moderate', description: 'Value-add office repositioning' },
      RENTAL: { strength: 'strong', description: 'Stabilized office hold' },
      STR: { strength: 'na', description: 'Not applicable for office' },
    },
    retail: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'moderate', description: 'Value-add retail repositioning' },
      RENTAL: { strength: 'strong', description: 'Net lease or stabilized hold' },
      STR: { strength: 'na', description: 'Not applicable for retail' },
    },
    industrial: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'weak', description: 'Industrial flips less common' },
      RENTAL: { strength: 'strong', description: 'Industrial holds for yield' },
      STR: { strength: 'na', description: 'Not applicable for industrial' },
    },
    hospitality: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'moderate', description: 'Possible but complex repositioning' },
      RENTAL: { strength: 'strong', description: 'Stabilized hospitality hold' },
      STR: { strength: 'weak', description: 'Managed hotels less suitable for STR' },
    },
    mixed_use: {
      BTS: { strength: 'na', description: 'Cannot build-to-sell an existing structure' },
      FLIP: { strength: 'moderate', description: 'Mixed-use repositioning complex but possible' },
      RENTAL: { strength: 'strong', description: 'Stabilized mixed-use hold' },
      STR: { strength: 'weak', description: 'Residential component only' },
    },
  },

  development: {
    mf_garden: {
      BTS: { strength: 'strong', description: 'Build and sell to institutional buyers' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'moderate', description: 'Build and stabilize for hold' },
      STR: { strength: 'weak', description: 'Less common for garden product' },
    },
    mf_wrap: {
      BTS: { strength: 'strong', description: 'Build and sell to institutional buyers' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'strong', description: 'Build-to-hold with premium positioning' },
      STR: { strength: 'weak', description: 'Less common for wrap product' },
    },
    mf_midrise: {
      BTS: { strength: 'strong', description: 'Build and sell to institutional buyers' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'strong', description: 'Build and stabilize for hold' },
      STR: { strength: 'weak', description: 'Less common for midrise' },
    },
    mf_highrise: {
      BTS: { strength: 'strong', description: 'Build and sell to institutional buyer' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'strong', description: 'Build and stabilize for long-term hold' },
      STR: { strength: 'na', description: 'Not suitable for highrise' },
    },
    mf_townhome: {
      BTS: { strength: 'strong', description: 'Build and sell to portfolio buyers' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'moderate', description: 'Build and hold for cash flow' },
      STR: { strength: 'strong', description: 'High STR conversion potential' },
    },
    office: {
      BTS: { strength: 'strong', description: 'Build and sell office to institutional buyer' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'strong', description: 'Build and stabilize for hold' },
      STR: { strength: 'na', description: 'Not applicable for office' },
    },
    retail: {
      BTS: { strength: 'strong', description: 'Build and sell retail to institutional buyer' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'strong', description: 'Build and stabilize for hold' },
      STR: { strength: 'na', description: 'Not applicable for retail' },
    },
    industrial: {
      BTS: { strength: 'strong', description: 'Build and sell industrial to investor' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'strong', description: 'Build and hold for yield' },
      STR: { strength: 'na', description: 'Not applicable for industrial' },
    },
    hospitality: {
      BTS: { strength: 'strong', description: 'Build and sell hotel to institutional buyer' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'strong', description: 'Build and stabilize for hold' },
      STR: { strength: 'weak', description: 'Less common for new hotels' },
    },
    mixed_use: {
      BTS: { strength: 'strong', description: 'Build and sell mixed-use project' },
      FLIP: { strength: 'na', description: 'No existing asset to flip' },
      RENTAL: { strength: 'strong', description: 'Build and stabilize mixed-use hold' },
      STR: { strength: 'weak', description: 'Residential component only' },
    },
  },

  redevelopment: {
    mf_garden: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned product' },
      FLIP: { strength: 'strong', description: 'Tear-down and rebuild for sale' },
      RENTAL: { strength: 'moderate', description: 'Redevelop and stabilize for hold' },
      STR: { strength: 'weak', description: 'Less common for garden product' },
    },
    mf_wrap: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned product' },
      FLIP: { strength: 'strong', description: 'Gut-rehab and sell for premium' },
      RENTAL: { strength: 'strong', description: 'Redevelop and stabilize for hold' },
      STR: { strength: 'weak', description: 'Less common for wrap product' },
    },
    mf_midrise: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned product' },
      FLIP: { strength: 'strong', description: 'Gut-rehab and sell for premium' },
      RENTAL: { strength: 'strong', description: 'Redevelop and stabilize for hold' },
      STR: { strength: 'weak', description: 'Less common for midrise' },
    },
    mf_highrise: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned product' },
      FLIP: { strength: 'moderate', description: 'Gut-rehab complex but possible' },
      RENTAL: { strength: 'strong', description: 'Redevelop and stabilize for long-term hold' },
      STR: { strength: 'na', description: 'Not suitable for highrise' },
    },
    mf_townhome: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned product' },
      FLIP: { strength: 'strong', description: 'Unit-by-unit rehab and sale' },
      RENTAL: { strength: 'moderate', description: 'Redevelop and hold for cash flow' },
      STR: { strength: 'strong', description: 'High STR conversion potential' },
    },
    office: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned office' },
      FLIP: { strength: 'moderate', description: 'Office repositioning complex' },
      RENTAL: { strength: 'strong', description: 'Redevelop and stabilize for hold' },
      STR: { strength: 'na', description: 'Not applicable for office' },
    },
    retail: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned retail' },
      FLIP: { strength: 'moderate', description: 'Retail repositioning complex' },
      RENTAL: { strength: 'strong', description: 'Redevelop and stabilize for hold' },
      STR: { strength: 'na', description: 'Not applicable for retail' },
    },
    industrial: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned industrial' },
      FLIP: { strength: 'moderate', description: 'Industrial redevelopment possible' },
      RENTAL: { strength: 'strong', description: 'Redevelop and hold for yield' },
      STR: { strength: 'na', description: 'Not applicable for industrial' },
    },
    hospitality: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned hotel' },
      FLIP: { strength: 'strong', description: 'Complex but possible repositioning' },
      RENTAL: { strength: 'strong', description: 'Redevelop and stabilize for hold' },
      STR: { strength: 'weak', description: 'Redeveloped hotels less suitable for STR' },
    },
    mixed_use: {
      BTS: { strength: 'strong', description: 'Redevelop and sell repositioned mixed-use' },
      FLIP: { strength: 'moderate', description: 'Mixed-use redevelopment complex' },
      RENTAL: { strength: 'strong', description: 'Redevelop and stabilize mixed-use hold' },
      STR: { strength: 'weak', description: 'Residential component only' },
    },
  },
};

// ─── Strategy Availability Function ──────────────────────────────────────────

/**
 * Get the available strategies for a given DealType × ProductType.
 *
 * Returns only strategies where strength !== 'na'.
 *
 * @param dealType - The deal type (existing, development, redevelopment)
 * @param productType - The product type (mf_garden, office, etc.)
 * @returns Array of strategy IDs available for this combination
 *
 * @example
 * getStrategyAvailability('existing', 'mf_garden')
 * // returns ['FLIP', 'RENTAL', 'STR']
 *
 * getStrategyAvailability('development', 'mf_garden')
 * // returns ['BTS', 'RENTAL', 'STR']
 */
export function getStrategyAvailability(
  dealType: DealType,
  productType: ProductType
): StrategyId[] {
  const matrix = STRATEGY_PRODUCT_MATRIX[dealType][productType];
  if (!matrix) return ['FLIP', 'RENTAL', 'STR']; // Safe default

  return (['BTS', 'FLIP', 'RENTAL', 'STR'] as StrategyId[]).filter(
    (strategy) => matrix[strategy].strength !== 'na'
  );
}

/**
 * Get the strength assessment for a specific strategy in a DealType × ProductType.
 *
 * @param dealType - The deal type
 * @param productType - The product type
 * @param strategy - The strategy ID
 * @returns Strategy strength and description, or { strength: 'na', description: '' } if not found
 */
export function getStrategyStrength(
  dealType: DealType,
  productType: ProductType,
  strategy: StrategyId
): StrategyProductFit {
  const matrix = STRATEGY_PRODUCT_MATRIX[dealType][productType];
  if (!matrix || !matrix[strategy]) {
    return { strength: 'na', description: '' };
  }
  return matrix[strategy];
}
