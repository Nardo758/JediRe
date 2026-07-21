/**
 * Canonical Classification Keys — Wave 1 W1
 *
 * ONE shared source of truth for every classification key that was previously
 * fragmented across 24+ definitions. Both frontend and backend import from here.
 *
 * Rulings encoded:
 *   - deal_type   = property-level lifecycle classification (what IS this deal)
 *   - strategy    = investment strategy (what do we DO with it)
 *   - asset_class = property type (multifamily, retail, etc.)
 *   - deal_mode   = operational underwriting state (STABILIZED | LEASE_UP | REDEVELOPMENT)
 *   - view_mode   = UI view mode (acquisition | performance) — RENAMED from DealMode
 *
 * Naming convention: PascalCase for types, camelCase for runtime values.
 */

// ═════════════════════════════════════════════════════════════════════════════
// 1. DEAL TYPE — property lifecycle classification
// ═════════════════════════════════════════════════════════════════════════════

/**
 * What this deal IS at the property level.
 * Previously fragmented: frontend had 3 values, backend DB comment had 6,
 * agent tool had 5 different ones. This is the reconciled canonical set.
 */
export type DealType =
  | 'existing'      // stabilized or lease-up acquisition
  | 'development'   // ground-up construction
  | 'redevelopment' // adaptive reuse / major renovation
  | 'value_add';    // light renovation with business plan

export const DEAL_TYPES: readonly DealType[] = [
  'existing',
  'development',
  'redevelopment',
  'value_add',
] as const;

/** Human-readable labels for UI. */
export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  existing: 'Existing / Stabilized',
  development: 'Ground-Up Development',
  redevelopment: 'Redevelopment',
  value_add: 'Value-Add',
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. STRATEGY — investment strategy (what we DO with the deal)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Investment strategy. Previously 4 incompatible definitions across frontend
 * and backend. Consolidated to 4 canonical families with sub-strategy mapping
 * living in asset-class-detection.service.ts (not duplicated here).
 */
export type StrategyType =
  | 'build_to_sell'   // BTS — develop and sell (was 'bts')
  | 'flip'            // buy, renovate, sell (was 'flip')
  | 'rental'          // buy and hold for income (was 'rental', 'rental_value_add', 'rental_stabilized')
  | 'str';            // short-term rental (was 'str')

export const STRATEGY_TYPES: readonly StrategyType[] = [
  'build_to_sell',
  'flip',
  'rental',
  'str',
] as const;

export const STRATEGY_LABELS: Record<StrategyType, string> = {
  build_to_sell: 'Build-to-Sell',
  flip: 'Fix-and-Flip',
  rental: 'Rental / Buy-and-Hold',
  str: 'Short-Term Rental',
};

/** Legacy → canonical mapping for data migration. */
export const STRATEGY_LEGACY_MAP: Record<string, StrategyType> = {
  bts: 'build_to_sell',
  BTS: 'build_to_sell',
  'Build-to-Sell': 'build_to_sell',
  flip: 'flip',
  FLIP: 'flip',
  Flip: 'flip',
  rental: 'rental',
  RENTAL: 'rental',
  Rental: 'rental',
  'rental_value_add': 'rental',
  'rental_stabilized': 'rental',
  str: 'str',
  STR: 'str',
  'Short-Term Rental': 'str',
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. ASSET CLASS — property type
// ═════════════════════════════════════════════════════════════════════════════

export type AssetClass =
  | 'multifamily'
  | 'sfr'
  | 'retail'
  | 'office'
  | 'industrial'
  | 'hospitality'
  | 'mixed_use'
  | 'vacant_land'
  | 'other';

export const ASSET_CLASSES: readonly AssetClass[] = [
  'multifamily',
  'sfr',
  'retail',
  'office',
  'industrial',
  'hospitality',
  'mixed_use',
  'vacant_land',
  'other',
] as const;

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  multifamily: 'Multifamily',
  sfr: 'Single-Family Rental',
  retail: 'Retail',
  office: 'Office',
  industrial: 'Industrial',
  hospitality: 'Hospitality',
  mixed_use: 'Mixed-Use',
  vacant_land: 'Vacant Land',
  other: 'Other',
};

// ═════════════════════════════════════════════════════════════════════════════
// 4. DEAL MODE — operational underwriting state
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Operational state used by the underwriting engine (M07/M09).
 * Previously uppercase DB values with a name collision on DealMode in frontend.
 */
export type DealMode = 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';

export const DEAL_MODES: readonly DealMode[] = [
  'STABILIZED',
  'LEASE_UP',
  'REDEVELOPMENT',
] as const;

export const DEAL_MODE_LABELS: Record<DealMode, string> = {
  STABILIZED: 'Stabilized',
  LEASE_UP: 'Lease-Up',
  REDEVELOPMENT: 'Redevelopment',
};

// ═════════════════════════════════════════════════════════════════════════════
// 5. VIEW MODE — UI view mode (RENAMED from frontend DealMode collision)
// ═════════════════════════════════════════════════════════════════════════════

/** Previously `DealMode` in `useDealMode.ts` — renamed to avoid collision. */
export type ViewMode = 'acquisition' | 'performance';

export const VIEW_MODES: readonly ViewMode[] = ['acquisition', 'performance'] as const;

// ═════════════════════════════════════════════════════════════════════════════
// 6. PROJECT INTENT — high-level intent (from validation/schemas.ts)
// ═════════════════════════════════════════════════════════════════════════════

export type ProjectIntent =
  | 'acquisition'
  | 'development'
  | 'redevelopment'
  | 'disposition'
  | 'refinance';

export const PROJECT_INTENTS: readonly ProjectIntent[] = [
  'acquisition',
  'development',
  'redevelopment',
  'disposition',
  'refinance',
] as const;

// ═════════════════════════════════════════════════════════════════════════════
// 7. GUARDS + RUNTIME VALIDATION
// ═════════════════════════════════════════════════════════════════════════════

export function isDealType(v: unknown): v is DealType {
  return typeof v === 'string' && DEAL_TYPES.includes(v as DealType);
}

export function isStrategyType(v: unknown): v is StrategyType {
  return typeof v === 'string' && STRATEGY_TYPES.includes(v as StrategyType);
}

export function isAssetClass(v: unknown): v is AssetClass {
  return typeof v === 'string' && ASSET_CLASSES.includes(v as AssetClass);
}

export function isDealMode(v: unknown): v is DealMode {
  return typeof v === 'string' && DEAL_MODES.includes(v as DealMode);
}

export function isViewMode(v: unknown): v is ViewMode {
  return typeof v === 'string' && VIEW_MODES.includes(v as ViewMode);
}

/** Coerce legacy strategy spelling to canonical. Returns null if unmapped. */
export function canonicalizeStrategy(raw: string): StrategyType | null {
  return STRATEGY_LEGACY_MAP[raw] ?? null;
}

// ═════════════════════════════════════════════════════════════════════════════
// 2b. SUB-STRATEGY SEAM — asset-class × strategy matrix (W1-5)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Canonical sub-strategy slugs: `{assetClass}_{strategyType}[_variant]`.
 * Previously fragmented across `asset-class-detection.service.ts`,
 * `m08-strategies.service.ts`, `deal-type-detection.service.ts`, and the debt
 * advisor. This is the reconciled canonical set — ONE import point.
 */
export type SubStrategySlug =
  | 'mf_core'
  | 'mf_core_plus'
  | 'mf_value_add_standard'
  | 'mf_deep_value_add'
  | 'mf_distressed'
  | 'mf_lease_up'
  | 'mf_bts_ground_up'
  | 'mf_str'
  | 'sfr_fix_flip'
  | 'sfr_brrrr'
  | 'sfr_hold'
  | 'sfr_portfolio_agg'
  | 'sfr_btr'
  | 'sfr_str'
  | 'sfr_mtr'
  | 'sfr_wholesale'
  | 'retail_nnn_core'
  | 'retail_grocery_anchored'
  | 'retail_value_add'
  | 'retail_last_mile'
  | 'office_adaptive_reuse'
  | 'office_medical'
  | 'office_tenant_rollup'
  | 'industrial_last_mile'
  | 'industrial_core'
  | 'hospitality_reflag'
  | 'hospitality_extended_stay';

export const SUB_STRATEGY_SLUGS: readonly SubStrategySlug[] = [
  'mf_core',
  'mf_core_plus',
  'mf_value_add_standard',
  'mf_deep_value_add',
  'mf_distressed',
  'mf_lease_up',
  'mf_bts_ground_up',
  'mf_str',
  'sfr_fix_flip',
  'sfr_brrrr',
  'sfr_hold',
  'sfr_portfolio_agg',
  'sfr_btr',
  'sfr_str',
  'sfr_mtr',
  'sfr_wholesale',
  'retail_nnn_core',
  'retail_grocery_anchored',
  'retail_value_add',
  'retail_last_mile',
  'office_adaptive_reuse',
  'office_medical',
  'office_tenant_rollup',
  'industrial_last_mile',
  'industrial_core',
  'hospitality_reflag',
  'hospitality_extended_stay',
] as const;

/** Human-readable display names (M08 v2 spec). */
export const SUB_STRATEGY_NAMES: Record<SubStrategySlug, string> = {
  mf_core: 'Multifamily Core',
  mf_core_plus: 'Multifamily Core-Plus',
  mf_value_add_standard: 'Multifamily Value-Add',
  mf_deep_value_add: 'Multifamily Deep Value-Add',
  mf_distressed: 'Multifamily Distressed / Opportunistic',
  mf_lease_up: 'Multifamily Lease-Up',
  mf_bts_ground_up: 'Multifamily Ground-Up Development',
  mf_str: 'Short-Term Rental (MF)',
  sfr_fix_flip: 'SFR Fix-and-Flip',
  sfr_brrrr: 'SFR BRRRR',
  sfr_hold: 'SFR Hold (Scattered)',
  sfr_portfolio_agg: 'SFR Portfolio Aggregation',
  sfr_btr: 'SFR Build-to-Rent',
  sfr_str: 'SFR STR (Vacation Rental)',
  sfr_mtr: 'SFR MTR (Mid-Term)',
  sfr_wholesale: 'SFR Wholesale',
  retail_nnn_core: 'Retail NNN Core',
  retail_grocery_anchored: 'Retail Grocery-Anchored Reposition',
  retail_value_add: 'Retail Value-Add Reposition',
  retail_last_mile: 'Retail → Flex / Last-Mile Conversion',
  office_adaptive_reuse: 'Office Adaptive Reuse',
  office_medical: 'Office Medical Conversion',
  office_tenant_rollup: 'Office Tenant Rollup Reposition',
  industrial_last_mile: 'Industrial Last-Mile',
  industrial_core: 'Industrial Core',
  hospitality_reflag: 'Hospitality Reflag',
  hospitality_extended_stay: 'Hospitality Extended-Stay Conversion',
};

/** Strategy family mapping (M08 v2 spec Section 4.1). */
export const SUB_STRATEGY_FAMILY: Record<SubStrategySlug, StrategyType> = {
  mf_core: 'rental',
  mf_core_plus: 'rental',
  mf_value_add_standard: 'rental',
  mf_deep_value_add: 'rental',
  mf_distressed: 'rental',
  mf_lease_up: 'rental',
  mf_bts_ground_up: 'build_to_sell',
  mf_str: 'str',
  sfr_fix_flip: 'flip',
  sfr_brrrr: 'rental',
  sfr_hold: 'rental',
  sfr_portfolio_agg: 'rental',
  sfr_btr: 'rental',
  sfr_str: 'str',
  sfr_mtr: 'str',
  sfr_wholesale: 'flip',
  retail_nnn_core: 'rental',
  retail_grocery_anchored: 'rental',
  retail_value_add: 'rental',
  retail_last_mile: 'rental',
  office_adaptive_reuse: 'rental',
  office_medical: 'rental',
  office_tenant_rollup: 'rental',
  industrial_last_mile: 'rental',
  industrial_core: 'rental',
  hospitality_reflag: 'rental',
  hospitality_extended_stay: 'rental',
};

/** Signal weight matrix per sub-strategy (Demand, Supply, Momentum, Position, Risk).
 *  Weights sum to 1.0 per row — spec Section 4.1. */
export const SUB_STRATEGY_WEIGHTS: Record<SubStrategySlug, Record<string, number>> = {
  mf_core: { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  mf_core_plus: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
  mf_value_add_standard: { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  mf_deep_value_add: { demand: 0.25, supply: 0.20, momentum: 0.25, position: 0.15, risk: 0.15 },
  mf_distressed: { demand: 0.20, supply: 0.15, momentum: 0.15, position: 0.20, risk: 0.30 },
  mf_lease_up: { demand: 0.35, supply: 0.30, momentum: 0.15, position: 0.10, risk: 0.10 },
  mf_bts_ground_up: { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  mf_str: { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_fix_flip: { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  sfr_brrrr: { demand: 0.20, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.15 },
  sfr_hold: { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  sfr_portfolio_agg: { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  sfr_btr: { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  sfr_str: { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_mtr: { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_wholesale: { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  retail_nnn_core: { demand: 0.20, supply: 0.10, momentum: 0.10, position: 0.35, risk: 0.25 },
  retail_grocery_anchored: { demand: 0.25, supply: 0.15, momentum: 0.15, position: 0.30, risk: 0.15 },
  retail_value_add: { demand: 0.30, supply: 0.15, momentum: 0.20, position: 0.25, risk: 0.10 },
  retail_last_mile: { demand: 0.30, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.10 },
  office_adaptive_reuse: { demand: 0.35, supply: 0.20, momentum: 0.15, position: 0.15, risk: 0.15 },
  office_medical: { demand: 0.30, supply: 0.20, momentum: 0.15, position: 0.20, risk: 0.15 },
  office_tenant_rollup: { demand: 0.15, supply: 0.20, momentum: 0.25, position: 0.20, risk: 0.20 },
  industrial_last_mile: { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.20, risk: 0.05 },
  industrial_core: { demand: 0.20, supply: 0.25, momentum: 0.15, position: 0.25, risk: 0.15 },
  hospitality_reflag: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.25, risk: 0.10 },
  hospitality_extended_stay: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
};

/** Extract asset-class prefix from a sub-strategy slug. */
export function subStrategyAssetClass(slug: SubStrategySlug): AssetClass | null {
  const map: Record<string, AssetClass> = {
    mf: 'multifamily',
    sfr: 'sfr',
    retail: 'retail',
    office: 'office',
    industrial: 'industrial',
    hospitality: 'hospitality',
  };
  const prefix = slug.split('_')[0];
  return map[prefix] ?? null;
}

/** Normalize loose/legacy/alias input to a canonical `SubStrategySlug`.
 *  Covers the debt-advisor alias matrix and saved-slug variations. */
export function canonicalizeSubStrategySlug(raw: string): SubStrategySlug | null {
  const s = raw.toLowerCase().replace(/[-\s]+/g, '_');
  if (SUB_STRATEGY_SLUGS.includes(s as SubStrategySlug)) return s as SubStrategySlug;

  // Debt-advisor / legacy aliases
  const aliases: Record<string, SubStrategySlug> = {
    'value_add_multifamily': 'mf_value_add_standard',
    'value_add_multifamily_standard': 'mf_value_add_standard',
    'core_multifamily': 'mf_core',
    'core_plus_multifamily': 'mf_core_plus',
    'deep_value_multifamily': 'mf_deep_value_add',
    'distressed_multifamily': 'mf_distressed',
    'distressed_debt': 'mf_distressed',
    'lease_up_multifamily': 'mf_lease_up',
    'lease_up': 'mf_lease_up',
    'fix_and_flip': 'sfr_fix_flip',
    'fix_flip': 'sfr_fix_flip',
    'flip': 'sfr_fix_flip',
    'brrrr': 'sfr_brrrr',
    'nnn_retail': 'retail_nnn_core',
    'net_lease': 'retail_nnn_core',
    'nnn_retail_core': 'retail_nnn_core',
    'heavy_value_add': 'mf_deep_value_add',
  };
  return aliases[s] ?? null;
}

/** Runtime guard. */
export function isSubStrategySlug(v: unknown): v is SubStrategySlug {
  return typeof v === 'string' && SUB_STRATEGY_SLUGS.includes(v as SubStrategySlug);
}
