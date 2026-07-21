import type { DealType } from '../canonical-keys';

/** Full 6-value canonical deal-type axis (W1-1 canonical-keys module). */
export type ProjectType = DealType;

const EXISTING_ALIASES = new Set([
  'existing', 'acquisition', 'existing_acquisition',
  'multifamily', 'multi-family', 'multi_family',
  'office', 'retail', 'industrial', 'flex',
  'mixed_use', 'mixed-use', 'mixeduse',
  'hotel', 'hospitality', 'self_storage', 'self-storage',
  'senior_housing', 'senior-housing', 'student_housing',
  'single_family', 'single-family', 'sfr',
  'build_to_rent', 'build-to-rent',
]);

const STABILIZED_ALIASES = new Set([
  'stabilized', 'stabilised',
]);

const VALUE_ADD_ALIASES = new Set([
  'value-add', 'value_add', 'valueadd',
]);

const LEASE_UP_ALIASES = new Set([
  'lease-up', 'lease_up', 'leaseup', 'leasing',
]);

const DEVELOPMENT_ALIASES = new Set([
  'development', 'ground_up', 'ground-up',
  'new_construction', 'new construction',
  'new_development', 'new-development',
  'land', 'vacant',
]);

const REDEVELOPMENT_ALIASES = new Set([
  'redevelopment', 'redev', 'rehab', 'repositioning',
  'adaptive_reuse', 'adaptive-reuse',
  'gut_rehab', 'gut-rehab',
  'tear-down', 'teardown', 'tear_down',
  'conversion', 'partial_demo', 'partial-demo',
]);

/**
 * Resolve a raw string to the full 6-value canonical DealType.
 * W1-2: STOP collapsing lease_up / value_add / stabilized → existing.
 */
export function resolveProjectType(raw: string | null | undefined): ProjectType {
  if (!raw) return 'existing';

  const normalized = raw.toLowerCase().trim();
  if (!normalized) return 'existing';

  if (EXISTING_ALIASES.has(normalized)) return 'existing';
  if (STABILIZED_ALIASES.has(normalized)) return 'stabilized';
  if (VALUE_ADD_ALIASES.has(normalized)) return 'value_add';
  if (LEASE_UP_ALIASES.has(normalized)) return 'lease_up';
  if (DEVELOPMENT_ALIASES.has(normalized)) return 'development';
  if (REDEVELOPMENT_ALIASES.has(normalized)) return 'redevelopment';

  return 'existing';
}

/**
 * Derive the 3-value tab-visibility projection from the 6-value canonical mode.
 * This is the ONLY place the 3-value collapse should live, and it is explicit.
 */
export function toTabVisibilityType(mode: ProjectType): 'existing' | 'development' | 'redevelopment' {
  if (mode === 'development') return 'development';
  if (mode === 'redevelopment') return 'redevelopment';
  // All existing-like variants map to 'existing' for tab visibility only
  return 'existing';
}

export function isExisting(type: ProjectType): boolean {
  return type === 'existing' || type === 'stabilized' || type === 'value_add' || type === 'lease_up';
}

export function isDevelopment(type: ProjectType): boolean {
  return type === 'development';
}

export function isRedevelopment(type: ProjectType): boolean {
  return type === 'redevelopment';
}

export function requiresZoningCapacity(type: ProjectType): boolean {
  return type === 'development' || type === 'redevelopment';
}

export function supportsUnitMixBuilder(type: ProjectType): boolean {
  return type === 'development' || type === 'redevelopment';
}

export function hasExistingBaseline(type: ProjectType): boolean {
  return isExisting(type) || type === 'redevelopment';
}
