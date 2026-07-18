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
