import { query } from '../database/connection';

// ═════════════════════════════════════════════════════════════════════════════
// Alias sets — matching W1-2 frontend resolveProjectType exactly.
// These are the canonical 6-value DealType mappings.
// ═════════════════════════════════════════════════════════════════════════════

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

function resolveModelType(raw: string | null | undefined): string {
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
 * Infer the canonical model type for a deal from its `deals.project_type`.
 *
 * W1-4: Queries the DB, normalizes via alias sets matching W1-2's
 * resolveProjectType, and returns the canonical 6-value DealType.
 */
export async function inferModelType(dealId: string): Promise<string> {
  const result = await query(
    `SELECT project_type FROM deals WHERE id = $1 LIMIT 1`,
    [dealId]
  );
  const raw = result.rows[0]?.project_type;
  return resolveModelType(raw);
}
