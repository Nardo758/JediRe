/**
 * Canonical Classification Keys — FRONTEND MIRROR
 *
 * This file is a verbatim mirror of backend/src/types/classification.ts.
 * Both sides must stay in sync. If you change one, change the other.
 *
 * Wave 1 W1: ONE shared classification key module.
 */

// ═════════════════════════════════════════════════════════════════════════════
// 1. DEAL TYPE — property lifecycle classification
// ═════════════════════════════════════════════════════════════════════════════

export type DealType =
  | 'existing'
  | 'development'
  | 'redevelopment'
  | 'value_add';

export const DEAL_TYPES: readonly DealType[] = [
  'existing',
  'development',
  'redevelopment',
  'value_add',
] as const;

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  existing: 'Existing / Stabilized',
  development: 'Ground-Up Development',
  redevelopment: 'Redevelopment',
  value_add: 'Value-Add',
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. STRATEGY — investment strategy
// ═════════════════════════════════════════════════════════════════════════════

export type StrategyType =
  | 'build_to_sell'
  | 'flip'
  | 'rental'
  | 'str';

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

export type ViewMode = 'acquisition' | 'performance';

export const VIEW_MODES: readonly ViewMode[] = ['acquisition', 'performance'] as const;

// ═════════════════════════════════════════════════════════════════════════════
// 6. PROJECT INTENT
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

export function canonicalizeStrategy(raw: string): StrategyType | null {
  return STRATEGY_LEGACY_MAP[raw] ?? null;
}
