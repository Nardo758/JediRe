/**
 * Project Type — Investment deal classification
 * 
 * NOT the same as DealType ('buyer' | 'seller' | 'both') which is the 
 * agent/broker transaction type. ProjectType drives:
 *   - Which overview variant renders (§1-§4 vs §1-§7 vs §1-§9)
 *   - Which modules are visible in the sidebar
 *   - Which financial model schema applies
 *   - Which strategies are evaluated in arbitrage
 * 
 * Source: Set at deal creation, stored in deals.project_type column.
 * Read via: deal.project_type || deal.projectType (snake_case from DB, camelCase in store)
 */

export type ProjectType = 'existing' | 'development' | 'redevelopment';

export const PROJECT_TYPE_META: Record<ProjectType, {
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  color: string;
  bgColor: string;
  sectionCount: number;
}> = {
  existing: {
    label: 'Existing Acquisition',
    shortLabel: 'Existing',
    icon: '🏢',
    description: 'Stabilized or value-add property with in-place tenants and operating history',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    sectionCount: 4,
  },
  development: {
    label: 'Ground-Up Development',
    shortLabel: 'Development',
    icon: '🏗️',
    description: 'Vacant land or teardown. New construction from entitlement through lease-up',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    sectionCount: 7,
  },
  redevelopment: {
    label: 'Redevelopment',
    shortLabel: 'Redevelopment',
    icon: '🔄',
    description: 'Existing property with renovation, expansion, or repositioning scope',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    sectionCount: 9,
  },
};

/**
 * Resolve projectType from a deal record.
 * Handles all the field-name variants that exist in the codebase.
 * Falls back to 'existing' if nothing is set.
 */
export function resolveProjectType(deal: any): ProjectType {
  const raw: string | undefined =
    deal?.project_type ||
    deal?.projectType ||
    deal?.development_type ||
    deal?.developmentType;

  if (!raw) return 'existing';

  const normalized = raw.toLowerCase().trim();

  // Exact matches
  if (normalized === 'existing' || normalized === 'acquisition') return 'existing';
  if (normalized === 'development' || normalized === 'ground-up' || normalized === 'ground_up') return 'development';
  if (normalized === 'redevelopment' || normalized === 'renovation' || normalized === 'value-add' || normalized === 'value_add') return 'redevelopment';

  // Fuzzy fallbacks
  if (normalized.includes('dev') && !normalized.includes('redev')) return 'development';
  if (normalized.includes('redev') || normalized.includes('renov') || normalized.includes('expand')) return 'redevelopment';

  return 'existing';
}
