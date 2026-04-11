export type ProjectType = 'existing' | 'development' | 'redevelopment';

const EXISTING_ALIASES = new Set([
  'existing', 'acquisition', 'existing_acquisition', 'stabilized',
  'value-add', 'value_add',
  'multifamily', 'multi-family', 'multi_family',
  'office', 'retail', 'industrial', 'flex',
  'mixed_use', 'mixed-use', 'mixeduse',
  'hotel', 'hospitality', 'self_storage', 'self-storage',
  'senior_housing', 'senior-housing', 'student_housing',
  'single_family', 'single-family', 'sfr',
  'build_to_rent', 'build-to-rent',
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

export function resolveProjectType(raw: string | null | undefined): ProjectType {
  if (!raw) return 'existing';

  const normalized = raw.toLowerCase().trim();
  if (!normalized) return 'existing';

  if (EXISTING_ALIASES.has(normalized)) return 'existing';
  if (DEVELOPMENT_ALIASES.has(normalized)) return 'development';
  if (REDEVELOPMENT_ALIASES.has(normalized)) return 'redevelopment';

  return 'existing';
}

export function isExisting(type: ProjectType): boolean {
  return type === 'existing';
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
  return type === 'existing' || type === 'redevelopment';
}
