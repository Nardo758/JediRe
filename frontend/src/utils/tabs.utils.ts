// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPMENT CAPACITY SUB-TAB DEFINITIONS BY DEAL TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export type DealType = 'existing' | 'development' | 'redevelopment';

export interface SubTabDefinition {
  id: string;
  label: string;
  dealTypes: DealType[];
  description?: string;
}

export const CAPACITY_SUBTABS: SubTabDefinition[] = [
  // Development-only tabs
  {
    id: 'envelope_analysis',
    label: 'Envelope Analysis',
    dealTypes: ['development'],
    description: 'Constraint waterfall showing binding constraint and development envelope',
  },
  {
    id: 'path_comparison',
    label: 'Path Comparison',
    dealTypes: ['development'],
    description: 'Side-by-side comparison of By-Right, Overlay, Variance, and Rezone paths',
  },
  {
    id: 'next_best_code',
    label: 'Next-Best Code',
    dealTypes: ['development'],
    description: 'Ranked zoning codes by risk-adjusted value uplift',
  },

  // Existing-only tabs
  {
    id: 'conformance_check',
    label: 'Conformance Check',
    dealTypes: ['existing', 'redevelopment'],
    description: 'Compare existing building to current zoning requirements',
  },
  {
    id: 'expansion_scenarios',
    label: 'Expansion Scenarios',
    dealTypes: ['existing'],
    description: 'Feasibility of adding wings, floors, ADUs, or changing uses',
  },

  // Redevelopment-only tabs
  {
    id: 'current_vs_allowed',
    label: 'Current vs Allowed',
    dealTypes: ['redevelopment'],
    description: 'Existing capacity utilization and untapped entitlement',
  },
  {
    id: 'renovation_scenarios',
    label: 'Renovation Scenarios',
    dealTypes: ['redevelopment'],
    description: 'Options from in-place renovation to full demolition and rebuild',
  },
  {
    id: 'compliance_analysis',
    label: 'Compliance Analysis',
    dealTypes: ['redevelopment'],
    description: 'Code compliance triggers and estimated costs for various scenarios',
  },
];

/**
 * Get the sub-tabs that should be visible for a given deal type
 */
export function getSubTabsForDealType(dealType: DealType | string): SubTabDefinition[] {
  const normalized = (dealType || 'existing').toLowerCase() as DealType;
  return CAPACITY_SUBTABS.filter((tab) => tab.dealTypes.includes(normalized));
}

/**
 * Check if a specific tab is available for a deal type
 */
export function isTabAvailableForDealType(tabId: string, dealType: DealType | string): boolean {
  const tabs = getSubTabsForDealType(dealType);
  return tabs.some((tab) => tab.id === tabId);
}

/**
 * Normalize project type string to canonical deal type
 */
export function normalizeDealType(projectType?: string): DealType {
  const raw = (projectType || '').toLowerCase().trim();

  // Existing variations
  if (
    [
      'existing',
      'acquisition',
      'existing_acquisition',
      'stabilized',
      'value-add',
      'value_add',
      'multifamily',
      'multi-family',
      'multi_family',
      'office',
      'retail',
      'industrial',
      'flex',
      'mixed_use',
      'mixed-use',
      'mixeduse',
      'hotel',
      'hospitality',
      'self_storage',
      'self-storage',
      'senior_housing',
      'senior-housing',
      'student_housing',
      'single_family',
      'single-family',
      'sfr',
      'build_to_rent',
      'build-to-rent',
    ].includes(raw)
  ) {
    return 'existing';
  }

  // Development variations
  if (
    [
      'development',
      'ground_up',
      'ground-up',
      'new_construction',
      'new construction',
      'new_development',
      'new-development',
      'land',
    ].includes(raw)
  ) {
    return 'development';
  }

  // Redevelopment variations
  if (
    [
      'redevelopment',
      'redev',
      'rehab',
      'repositioning',
      'adaptive_reuse',
      'adaptive-reuse',
      'gut_rehab',
      'tear-down',
      'teardown',
      'conversion',
    ].includes(raw)
  ) {
    return 'redevelopment';
  }

  // Default to existing (safest assumption)
  return 'existing';
}
