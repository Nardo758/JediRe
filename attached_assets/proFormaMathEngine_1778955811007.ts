/**
 * Pro Forma Math Engine v1.1 — extends v1.0 with hierarchical subtotals
 *
 * v1.1 changes:
 *   - Other Income reframed as a subtotal with breakdown components
 *     (Parking, Pet, Storage, Washer/Dryer, RUBS, Fees, Insurance Admin,
 *     Other, Cable, custom lines)
 *   - New concept: HierarchicalSubtotal — a subtotal where the same value
 *     can come from EITHER an aggregate source (e.g., T-12 publishes a
 *     single number) OR from summing breakdown components (e.g., Rent Roll
 *     publishes per-category detail). The engine reconciles the two.
 *   - Source resolution rule for mixed-source subtotals:
 *       Priority: Rent Roll breakdown > OM breakdown > T-12 aggregate
 *       If breakdown source available, use breakdown sum.
 *       If only T-12 aggregate, use T-12 value with explicit flag.
 *       If both, reconcile and surface delta if > tolerance.
 *   - Validation extended to check breakdown-vs-aggregate consistency
 *   - New finding type: 'breakdown_aggregate_mismatch'
 *
 * Replaces: v1.0
 */

import type { Logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

// ---------------------------------------------------------------------------
// Types (extended from v1.0)
// ---------------------------------------------------------------------------

export type LineItemKind =
  | 'revenue'
  | 'revenue_deduction'
  | 'expense'
  | 'reserves'
  | 'subtotal'
  | 'hierarchical_subtotal'    // NEW in v1.1 — has both aggregate sources and breakdown sources
  | 'below_line'
  | 'metadata';

export type DisplayFormat =
  | 'plain'
  | 'parentheses'
  | 'negative_sign'
  | 'percent'
  | 'currency_per_unit';

export type SourceType =
  | 'rent_roll'
  | 'om'
  | 't12'
  | 'platform_fallback'
  | 'user_override'
  | 'computed';

export interface LineItemBehavior {
  path: string;
  kind: LineItemKind;
  display_format: DisplayFormat;
  subtotal_formula?: SubtotalFormula;
  hierarchical_config?: HierarchicalSubtotalConfig;
  is_deduction?: boolean;
  display_label?: string;
  required: boolean;
  parent_subtotal?: string;     // for breakdown leaves, points to their parent subtotal
}

export interface SubtotalFormula {
  description: string;
  add: string[];
  subtract?: string[];
  subtotal_of?: string[];
}

/**
 * Config for a hierarchical subtotal — one whose value can come from either:
 *   (a) an aggregate published by one or more sources (e.g., T-12 publishes
 *       Other Income as a single number)
 *   (b) the sum of its breakdown components (e.g., Rent Roll publishes
 *       per-category detail and the platform sums them)
 *
 * The engine prioritizes sources per the source_priority list. If the
 * highest-priority source available is a breakdown source, use the breakdown
 * sum. If the highest-priority available is an aggregate source, use the
 * aggregate. Either way, reconcile against alternative sources and flag
 * material discrepancies.
 */
export interface HierarchicalSubtotalConfig {
  breakdown_paths: string[];                              // child line items that sum to this subtotal
  aggregate_sources: SourceType[];                        // sources that publish this as a single number
  breakdown_sources: SourceType[];                        // sources that publish per-component detail
  source_priority: SourceType[];                          // priority order (first match wins)
  reconciliation_tolerance_pct: number;                   // alert threshold for breakdown-vs-aggregate delta
  reconciliation_tolerance_dollars: number;
}

// ---------------------------------------------------------------------------
// THE CANONICAL LINE-ITEM BEHAVIOR CONFIG (v1.1)
// ---------------------------------------------------------------------------

export const LINE_ITEM_CONFIG: Record<string, LineItemBehavior> = {

  // ===== REVENUE STACK (unchanged from v1.0) =====

  'proforma.revenue.gpr': {
    path: 'proforma.revenue.gpr',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Gross Potential Rent',
    required: true,
  },

  'proforma.revenue.loss_to_lease': {
    path: 'proforma.revenue.loss_to_lease',
    kind: 'revenue_deduction',
    display_format: 'parentheses',
    display_label: 'Loss to Lease',
    is_deduction: true,
    required: true,
  },

  'proforma.revenue.vacancy_loss': {
    path: 'proforma.revenue.vacancy_loss',
    kind: 'revenue_deduction',
    display_format: 'parentheses',
    display_label: 'Vacancy & Credit Loss',
    is_deduction: true,
    required: true,
  },

  'proforma.revenue.concessions': {
    path: 'proforma.revenue.concessions',
    kind: 'revenue_deduction',
    display_format: 'parentheses',
    display_label: 'Concessions',
    is_deduction: true,
    required: true,
  },

  'proforma.revenue.bad_debt': {
    path: 'proforma.revenue.bad_debt',
    kind: 'revenue_deduction',
    display_format: 'parentheses',
    display_label: 'Bad Debt',
    is_deduction: true,
    required: true,
  },

  'proforma.revenue.non_revenue_units': {
    path: 'proforma.revenue.non_revenue_units',
    kind: 'revenue_deduction',
    display_format: 'parentheses',
    display_label: 'Non-Revenue Units',
    is_deduction: true,
    required: false,
  },

  // ===== REVENUE SUBTOTAL 1 (unchanged from v1.0) =====

  'proforma.revenue.base_rental_revenue': {
    path: 'proforma.revenue.base_rental_revenue',
    kind: 'subtotal',
    display_format: 'plain',
    display_label: 'Base Rental Revenue',
    required: true,
    subtotal_formula: {
      description: 'GPR minus all rental revenue deductions',
      add: ['proforma.revenue.gpr'],
      subtract: [
        'proforma.revenue.loss_to_lease',
        'proforma.revenue.vacancy_loss',
        'proforma.revenue.concessions',
        'proforma.revenue.bad_debt',
        'proforma.revenue.non_revenue_units',
      ],
    },
  },

  // ===== OTHER INCOME BREAKDOWN — NEW STRUCTURE IN v1.1 =====

  'proforma.revenue.other_income.parking': {
    path: 'proforma.revenue.other_income.parking',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Parking / Garage',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  'proforma.revenue.other_income.pet': {
    path: 'proforma.revenue.other_income.pet',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Pet',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  'proforma.revenue.other_income.storage': {
    path: 'proforma.revenue.other_income.storage',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Storage',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  'proforma.revenue.other_income.washer_dryer': {
    path: 'proforma.revenue.other_income.washer_dryer',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Washer / Dryer',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  'proforma.revenue.other_income.rubs': {
    path: 'proforma.revenue.other_income.rubs',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Utility Reimbursements (RUBS)',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  'proforma.revenue.other_income.fees': {
    path: 'proforma.revenue.other_income.fees',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Fees',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  'proforma.revenue.other_income.insurance_admin': {
    path: 'proforma.revenue.other_income.insurance_admin',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Insurance Admin',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  'proforma.revenue.other_income.cable': {
    path: 'proforma.revenue.other_income.cable',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Cable',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  'proforma.revenue.other_income.other': {
    path: 'proforma.revenue.other_income.other',
    kind: 'revenue',
    display_format: 'plain',
    display_label: 'Other',
    required: false,
    parent_subtotal: 'proforma.revenue.other_income',
  },

  // ===== OTHER INCOME HIERARCHICAL SUBTOTAL (v1.1) =====

  'proforma.revenue.other_income': {
    path: 'proforma.revenue.other_income',
    kind: 'hierarchical_subtotal',
    display_format: 'plain',
    display_label: 'Other Income',
    required: true,
    hierarchical_config: {
      breakdown_paths: [
        'proforma.revenue.other_income.parking',
        'proforma.revenue.other_income.pet',
        'proforma.revenue.other_income.storage',
        'proforma.revenue.other_income.washer_dryer',
        'proforma.revenue.other_income.rubs',
        'proforma.revenue.other_income.fees',
        'proforma.revenue.other_income.insurance_admin',
        'proforma.revenue.other_income.cable',
        'proforma.revenue.other_income.other',
      ],
      aggregate_sources: ['t12'],          // T-12 publishes Other Income as one number
      breakdown_sources: ['rent_roll', 'om'],  // Rent Roll and OM provide per-category detail
      source_priority: ['rent_roll', 'om', 't12', 'platform_fallback'],
      reconciliation_tolerance_pct: 0.05,  // 5% tolerance band
      reconciliation_tolerance_dollars: 5000,
    },
  },

  // ===== REVENUE FINAL SUBTOTAL (unchanged) =====

  'proforma.revenue.egi': {
    path: 'proforma.revenue.egi',
    kind: 'subtotal',
    display_format: 'plain',
    display_label: 'Effective Gross Income (EGI)',
    required: true,
    subtotal_formula: {
      description: 'Base Rental Revenue + Other Income',
      add: ['proforma.revenue.other_income'],
      subtotal_of: ['proforma.revenue.base_rental_revenue'],
    },
  },

  // ===== CONTROLLABLE EXPENSES (unchanged from v1.0) =====

  'proforma.opex.personnel': {
    path: 'proforma.opex.personnel',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Personnel',
    required: true,
  },

  'proforma.opex.repairs_maintenance': {
    path: 'proforma.opex.repairs_maintenance',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Repair & Maintenance',
    required: true,
  },

  'proforma.opex.turnover': {
    path: 'proforma.opex.turnover',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Turnover / Make-Ready',
    required: true,
  },

  'proforma.opex.contract_services': {
    path: 'proforma.opex.contract_services',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Contract Services',
    required: true,
  },

  'proforma.opex.marketing': {
    path: 'proforma.opex.marketing',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Marketing / Advertising',
    required: true,
  },

  'proforma.opex.administrative': {
    path: 'proforma.opex.administrative',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Administrative',
    required: true,
  },

  // ===== CONTROLLABLE OPEX SUBTOTAL (unchanged) =====

  'proforma.opex.controllable_total': {
    path: 'proforma.opex.controllable_total',
    kind: 'subtotal',
    display_format: 'parentheses',
    display_label: 'Controllable OpEx',
    required: true,
    subtotal_formula: {
      description: 'Sum of all controllable expense line items',
      add: [
        'proforma.opex.personnel',
        'proforma.opex.repairs_maintenance',
        'proforma.opex.turnover',
        'proforma.opex.contract_services',
        'proforma.opex.marketing',
        'proforma.opex.administrative',
      ],
    },
  },

  // ===== NON-CONTROLLABLE EXPENSES (unchanged) =====

  'proforma.opex.management_fee': {
    path: 'proforma.opex.management_fee',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Management Fee',
    required: true,
  },

  'proforma.opex.insurance': {
    path: 'proforma.opex.insurance',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Insurance',
    required: true,
  },

  'proforma.opex.property_tax': {
    path: 'proforma.opex.property_tax',
    kind: 'expense',
    display_format: 'parentheses',
    display_label: 'Property Tax',
    required: true,
  },

  'proforma.opex.non_controllable_total': {
    path: 'proforma.opex.non_controllable_total',
    kind: 'subtotal',
    display_format: 'parentheses',
    display_label: 'Non-Controllable OpEx',
    required: true,
    subtotal_formula: {
      description: 'Sum of all non-controllable expense line items',
      add: [
        'proforma.opex.management_fee',
        'proforma.opex.insurance',
        'proforma.opex.property_tax',
      ],
    },
  },

  // ===== TOTAL OPEX (unchanged from v1.0 fix) =====

  'proforma.opex.total': {
    path: 'proforma.opex.total',
    kind: 'subtotal',
    display_format: 'parentheses',
    display_label: 'Total OpEx',
    required: true,
    subtotal_formula: {
      description: 'Controllable OpEx + Non-Controllable OpEx',
      add: [],
      subtotal_of: [
        'proforma.opex.controllable_total',
        'proforma.opex.non_controllable_total',
      ],
    },
  },

  // ===== NOI AND BELOW (unchanged from v1.0) =====

  'proforma.noi': {
    path: 'proforma.noi',
    kind: 'subtotal',
    display_format: 'plain',
    display_label: 'Net Operating Income',
    required: true,
    subtotal_formula: {
      description: 'EGI minus Total OpEx',
      add: [],
      subtotal_of: ['proforma.revenue.egi'],
    },
  },

  'proforma.reserves.capex': {
    path: 'proforma.reserves.capex',
    kind: 'reserves',
    display_format: 'parentheses',
    display_label: 'Replacement Reserves',
    required: true,
  },

  'proforma.noi_after_reserves': {
    path: 'proforma.noi_after_reserves',
    kind: 'subtotal',
    display_format: 'plain',
    display_label: 'NOI After Reserves',
    required: true,
    subtotal_formula: {
      description: 'NOI minus Replacement Reserves',
      add: [],
      subtotal_of: ['proforma.noi'],
      subtract: ['proforma.reserves.capex'],
    },
  },

  'proforma.valuation.cap_rate': {
    path: 'proforma.valuation.cap_rate',
    kind: 'below_line',
    display_format: 'percent',
    display_label: 'Cap Rate',
    required: true,
  },

  'proforma.valuation.stabilized_value': {
    path: 'proforma.valuation.stabilized_value',
    kind: 'below_line',
    display_format: 'plain',
    display_label: 'Stabilized Value',
    required: true,
  },
};

// ---------------------------------------------------------------------------
// Special Formula Handlers (unchanged)
// ---------------------------------------------------------------------------

const SPECIAL_FORMULAS: Record<string, (values: Record<string, number>) => number> = {
  'proforma.noi': (values) => {
    const egi = values['proforma.revenue.egi'] ?? 0;
    const totalOpex = values['proforma.opex.total'] ?? 0;
    return egi - totalOpex;
  },

  'proforma.noi_after_reserves': (values) => {
    const noi = values['proforma.noi'] ?? 0;
    const reserves = values['proforma.reserves.capex'] ?? 0;
    return noi - reserves;
  },

  'proforma.valuation.stabilized_value': (values) => {
    const noi = values['proforma.noi'] ?? 0;
    const capRate = values['proforma.valuation.cap_rate'] ?? 0;
    if (capRate <= 0) return 0;
    return noi / capRate;
  },
};

// ---------------------------------------------------------------------------
// Hierarchical Subtotal Resolution (NEW in v1.1)
// ---------------------------------------------------------------------------

export interface SourceMetadata {
  path: string;
  source: SourceType;
  has_breakdown: boolean;
}

export interface HierarchicalResolution {
  resolved_value: number;
  resolution_source: SourceType;
  resolution_method: 'breakdown_sum' | 'aggregate' | 'fallback';
  breakdown_sum?: number;
  aggregate_value?: number;
  reconciliation_delta?: number;
  reconciliation_delta_pct?: number;
  reconciliation_status: 'no_conflict' | 'within_tolerance' | 'minor_mismatch' | 'major_mismatch';
}

/**
 * Resolve a hierarchical subtotal value from breakdown components and/or
 * aggregate sources, applying the configured source priority and tolerance
 * rules.
 *
 * Returns the resolved value plus diagnostic metadata about how it was resolved
 * and any reconciliation findings.
 */
export function resolveHierarchicalSubtotal(
  path: string,
  columnValues: Record<string, number>,
  sourceMetadata: Record<string, SourceType>,
  storedAggregate?: number,
): HierarchicalResolution {
  const config = LINE_ITEM_CONFIG[path];
  if (!config?.hierarchical_config) {
    throw new Error(`No hierarchical config for path: ${path}`);
  }

  const hConfig = config.hierarchical_config;

  // Step 1 — Determine if breakdown components are present
  const breakdownValues = hConfig.breakdown_paths
    .map(p => ({ path: p, value: columnValues[p], source: sourceMetadata[p] }))
    .filter(b => b.value !== undefined && b.value !== null);

  const hasBreakdown = breakdownValues.length > 0;
  const breakdownSum = hasBreakdown
    ? breakdownValues.reduce((sum, b) => sum + (b.value ?? 0), 0)
    : undefined;

  const breakdownSources = new Set(breakdownValues.map(b => b.source).filter(Boolean));

  // Step 2 — Apply source priority to decide which value to use
  let resolvedValue: number;
  let resolutionSource: SourceType;
  let resolutionMethod: 'breakdown_sum' | 'aggregate' | 'fallback';

  // Find the highest-priority source that has data
  const highestPrioritySource = hConfig.source_priority.find(s => {
    if (hConfig.breakdown_sources.includes(s) && breakdownSources.has(s)) {
      return true;
    }
    if (hConfig.aggregate_sources.includes(s) && storedAggregate !== undefined) {
      return true;
    }
    return false;
  });

  if (highestPrioritySource && hConfig.breakdown_sources.includes(highestPrioritySource)) {
    // Breakdown source wins — use breakdown sum
    resolvedValue = breakdownSum ?? 0;
    resolutionSource = highestPrioritySource;
    resolutionMethod = 'breakdown_sum';
  } else if (highestPrioritySource && hConfig.aggregate_sources.includes(highestPrioritySource)) {
    // Aggregate source wins — use the aggregate value
    resolvedValue = storedAggregate ?? 0;
    resolutionSource = highestPrioritySource;
    resolutionMethod = 'aggregate';
  } else {
    // No source available — fall back to whatever is present
    if (hasBreakdown) {
      resolvedValue = breakdownSum ?? 0;
      resolutionSource = 'platform_fallback';
      resolutionMethod = 'breakdown_sum';
    } else if (storedAggregate !== undefined) {
      resolvedValue = storedAggregate;
      resolutionSource = 'platform_fallback';
      resolutionMethod = 'aggregate';
    } else {
      resolvedValue = 0;
      resolutionSource = 'platform_fallback';
      resolutionMethod = 'fallback';
    }
  }

  // Step 3 — Reconciliation (compare breakdown sum vs aggregate when both exist)
  let reconciliationStatus: HierarchicalResolution['reconciliation_status'] = 'no_conflict';
  let reconciliationDelta: number | undefined;
  let reconciliationDeltaPct: number | undefined;

  if (hasBreakdown && storedAggregate !== undefined && breakdownSum !== undefined) {
    reconciliationDelta = breakdownSum - storedAggregate;
    reconciliationDeltaPct =
      Math.abs(storedAggregate) > 0
        ? Math.abs(reconciliationDelta) / Math.abs(storedAggregate)
        : 0;

    const absDelta = Math.abs(reconciliationDelta);

    if (
      absDelta <= hConfig.reconciliation_tolerance_dollars &&
      reconciliationDeltaPct <= hConfig.reconciliation_tolerance_pct
    ) {
      reconciliationStatus = 'within_tolerance';
    } else if (absDelta <= hConfig.reconciliation_tolerance_dollars * 5 ||
               reconciliationDeltaPct <= hConfig.reconciliation_tolerance_pct * 5) {
      reconciliationStatus = 'minor_mismatch';
    } else {
      reconciliationStatus = 'major_mismatch';
    }
  }

  return {
    resolved_value: resolvedValue,
    resolution_source: resolutionSource,
    resolution_method: resolutionMethod,
    breakdown_sum: breakdownSum,
    aggregate_value: storedAggregate,
    reconciliation_delta: reconciliationDelta,
    reconciliation_delta_pct: reconciliationDeltaPct,
    reconciliation_status: reconciliationStatus,
  };
}

// ---------------------------------------------------------------------------
// Aggregation Engine (updated for hierarchical subtotals)
// ---------------------------------------------------------------------------

export function computeSubtotal(
  path: string,
  columnValues: Record<string, number>,
): number {
  if (SPECIAL_FORMULAS[path]) {
    return SPECIAL_FORMULAS[path](columnValues);
  }

  const config = LINE_ITEM_CONFIG[path];
  if (!config) {
    throw new Error(`No config for path: ${path}`);
  }

  // Hierarchical subtotals: sum breakdown components by default
  // (full source-resolution happens via resolveHierarchicalSubtotal)
  if (config.kind === 'hierarchical_subtotal' && config.hierarchical_config) {
    return config.hierarchical_config.breakdown_paths.reduce(
      (sum, p) => sum + (columnValues[p] ?? 0),
      0,
    );
  }

  if (!config.subtotal_formula) {
    throw new Error(`No subtotal formula for path: ${path}`);
  }

  const formula = config.subtotal_formula;
  let result = 0;

  for (const addPath of formula.add) {
    result += columnValues[addPath] ?? 0;
  }

  for (const subPath of formula.subtract ?? []) {
    result -= columnValues[subPath] ?? 0;
  }

  for (const subtotalPath of formula.subtotal_of ?? []) {
    result += columnValues[subtotalPath] ?? 0;
  }

  return result;
}

const COMPUTATION_ORDER: string[] = [
  // Hierarchical subtotals first (compute from their breakdown leaves)
  'proforma.revenue.other_income',

  // First-level subtotals
  'proforma.revenue.base_rental_revenue',
  'proforma.revenue.egi',
  'proforma.opex.controllable_total',
  'proforma.opex.non_controllable_total',

  // Second-level
  'proforma.opex.total',
  'proforma.noi',

  // Third-level
  'proforma.noi_after_reserves',
  'proforma.valuation.stabilized_value',
];

export function recomputeAllSubtotals(
  columnValues: Record<string, number>,
): Record<string, number> {
  const result = { ...columnValues };

  for (const subtotalPath of COMPUTATION_ORDER) {
    const config = LINE_ITEM_CONFIG[subtotalPath];
    if (!config) continue;

    if (
      config.subtotal_formula ||
      SPECIAL_FORMULAS[subtotalPath] ||
      config.kind === 'hierarchical_subtotal'
    ) {
      result[subtotalPath] = computeSubtotal(subtotalPath, result);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Math Integrity Validator (extended for hierarchical findings)
// ---------------------------------------------------------------------------

export type FindingType =
  | 'subtotal_mismatch'
  | 'breakdown_aggregate_mismatch'    // NEW in v1.1
  | 'missing_required_field';

export interface ValidationFinding {
  field_path: string;
  finding_type: FindingType;
  expected: number;
  actual: number;
  delta: number;
  delta_pct: number;
  severity: 'critical' | 'major' | 'minor';
  formula_description: string;
  reconciliation_details?: HierarchicalResolution;  // populated for breakdown_aggregate_mismatch
}

export interface ValidationReport {
  column_name: string;
  passed: boolean;
  total_findings: number;
  findings: ValidationFinding[];
  recomputed_values: Record<string, number>;
  hierarchical_resolutions: Record<string, HierarchicalResolution>;
}

const TOLERANCE_CRITICAL_DOLLARS = 1000;
const TOLERANCE_CRITICAL_PCT = 0.01;
const TOLERANCE_MAJOR_DOLLARS = 100;
const TOLERANCE_MAJOR_PCT = 0.001;
const TOLERANCE_MINOR_DOLLARS = 1;

function classifySeverity(delta: number, expected: number): 'critical' | 'major' | 'minor' {
  const absDelta = Math.abs(delta);
  const absExpected = Math.abs(expected);
  const pct = absExpected > 0 ? absDelta / absExpected : 0;

  if (absDelta > TOLERANCE_CRITICAL_DOLLARS || pct > TOLERANCE_CRITICAL_PCT) {
    return 'critical';
  }
  if (absDelta > TOLERANCE_MAJOR_DOLLARS || pct > TOLERANCE_MAJOR_PCT) {
    return 'major';
  }
  return 'minor';
}

export function validateColumnMath(
  columnName: string,
  columnValues: Record<string, number>,
  sourceMetadata?: Record<string, SourceType>,
): ValidationReport {
  const findings: ValidationFinding[] = [];
  const recomputed = recomputeAllSubtotals(columnValues);
  const hierarchicalResolutions: Record<string, HierarchicalResolution> = {};

  // First pass — check hierarchical subtotals for breakdown-vs-aggregate consistency
  for (const [path, config] of Object.entries(LINE_ITEM_CONFIG)) {
    if (config.kind === 'hierarchical_subtotal' && config.hierarchical_config) {
      const resolution = resolveHierarchicalSubtotal(
        path,
        columnValues,
        sourceMetadata ?? {},
        columnValues[path],
      );

      hierarchicalResolutions[path] = resolution;

      if (
        resolution.reconciliation_status === 'minor_mismatch' ||
        resolution.reconciliation_status === 'major_mismatch'
      ) {
        const delta = resolution.reconciliation_delta ?? 0;
        const expected = resolution.aggregate_value ?? 0;
        findings.push({
          field_path: path,
          finding_type: 'breakdown_aggregate_mismatch',
          expected: expected,
          actual: resolution.breakdown_sum ?? 0,
          delta,
          delta_pct: resolution.reconciliation_delta_pct ?? 0,
          severity:
            resolution.reconciliation_status === 'major_mismatch' ? 'critical' : 'major',
          formula_description: `Breakdown sum vs aggregate source mismatch for ${config.display_label}. Resolution: ${resolution.resolution_method} from ${resolution.resolution_source}.`,
          reconciliation_details: resolution,
        });
      }
    }
  }

  // Second pass — check standard subtotal formulas
  for (const subtotalPath of COMPUTATION_ORDER) {
    const config = LINE_ITEM_CONFIG[subtotalPath];
    if (!config) continue;
    if (config.kind === 'hierarchical_subtotal') continue;  // handled above

    const expected = recomputed[subtotalPath];
    const actual = columnValues[subtotalPath] ?? 0;
    const delta = actual - expected;

    if (Math.abs(delta) >= TOLERANCE_MINOR_DOLLARS) {
      const absExpected = Math.abs(expected);
      const deltaPct = absExpected > 0 ? Math.abs(delta) / absExpected : 0;

      findings.push({
        field_path: subtotalPath,
        finding_type: 'subtotal_mismatch',
        expected,
        actual,
        delta,
        delta_pct: deltaPct,
        severity: classifySeverity(delta, expected),
        formula_description:
          config.subtotal_formula?.description ??
          (SPECIAL_FORMULAS[subtotalPath] ? '[special formula]' : 'unknown'),
      });
    }
  }

  return {
    column_name: columnName,
    passed: findings.filter(f => f.severity !== 'minor').length === 0,
    total_findings: findings.length,
    findings,
    recomputed_values: recomputed,
    hierarchical_resolutions: hierarchicalResolutions,
  };
}

// ---------------------------------------------------------------------------
// Snapshot Validation and Auto-Correction (extended)
// ---------------------------------------------------------------------------

export interface ProFormaSnapshot {
  broker?: Record<string, number>;
  t12?: Record<string, number>;
  platform?: Record<string, number>;
  resolved: Record<string, number>;
  source_metadata?: Record<string, Record<string, SourceType>>;  // per column, per field
}

export interface SnapshotValidationReport {
  passed: boolean;
  per_column: Record<string, ValidationReport>;
  recommended_corrections: Record<string, Record<string, number>>;
  summary: {
    total_critical: number;
    total_major: number;
    total_minor: number;
    breakdown_aggregate_mismatches: number;
  };
}

export function validateSnapshot(snapshot: ProFormaSnapshot): SnapshotValidationReport {
  const perColumn: Record<string, ValidationReport> = {};
  const recommendedCorrections: Record<string, Record<string, number>> = {};

  for (const [columnName, columnValues] of Object.entries(snapshot)) {
    if (columnName === 'source_metadata' || !columnValues) continue;
    const sourceMetadata = snapshot.source_metadata?.[columnName];
    const report = validateColumnMath(columnName, columnValues as Record<string, number>, sourceMetadata);
    perColumn[columnName] = report;
    recommendedCorrections[columnName] = report.recomputed_values;
  }

  const allFindings = Object.values(perColumn).flatMap(r => r.findings);
  const summary = {
    total_critical: allFindings.filter(f => f.severity === 'critical').length,
    total_major: allFindings.filter(f => f.severity === 'major').length,
    total_minor: allFindings.filter(f => f.severity === 'minor').length,
    breakdown_aggregate_mismatches: allFindings.filter(
      f => f.finding_type === 'breakdown_aggregate_mismatch'
    ).length,
  };

  return {
    passed: summary.total_critical === 0 && summary.total_major === 0,
    per_column: perColumn,
    recommended_corrections: recommendedCorrections,
    summary,
  };
}

export interface CorrectionResult {
  corrected_snapshot: ProFormaSnapshot;
  validation_report: SnapshotValidationReport;
  was_corrected: boolean;
}

export function correctSnapshotMath(
  snapshot: ProFormaSnapshot,
  context: {
    deal_id: string;
    run_id: string;
    prompt_version: string;
    logger: Logger;
  },
): CorrectionResult {
  const report = validateSnapshot(snapshot);

  if (report.passed && report.summary.total_minor === 0) {
    return {
      corrected_snapshot: snapshot,
      validation_report: report,
      was_corrected: false,
    };
  }

  const correctedSnapshot: ProFormaSnapshot = {
    resolved: snapshot.resolved,
    source_metadata: snapshot.source_metadata,
  };

  for (const columnName of ['broker', 't12', 'platform', 'resolved'] as const) {
    const original = snapshot[columnName];
    if (!original) continue;

    const corrected = { ...original };
    const columnReport = report.per_column[columnName];

    if (columnReport) {
      for (const finding of columnReport.findings) {
        if (finding.finding_type === 'subtotal_mismatch') {
          // Replace wrong subtotal with computed value
          corrected[finding.field_path] = finding.expected;
        } else if (finding.finding_type === 'breakdown_aggregate_mismatch') {
          // For hierarchical mismatch, use the resolution's resolved_value
          // (which already applied source priority)
          if (finding.reconciliation_details) {
            corrected[finding.field_path] = finding.reconciliation_details.resolved_value;
          }
        }

        context.logger.warn('proforma_math_corrected', {
          deal_id: context.deal_id,
          run_id: context.run_id,
          prompt_version: context.prompt_version,
          column: columnName,
          field_path: finding.field_path,
          finding_type: finding.finding_type,
          stored_value: finding.actual,
          computed_value: finding.expected,
          delta: finding.delta,
          delta_pct: finding.delta_pct,
          severity: finding.severity,
        });

        metrics.increment('proforma.math.corrected', 1, {
          field_path: finding.field_path,
          finding_type: finding.finding_type,
          severity: finding.severity,
          prompt_version: context.prompt_version,
        });
      }
    }

    correctedSnapshot[columnName] = corrected;
  }

  if (report.summary.total_critical > 0) {
    context.logger.error('proforma_critical_math_errors', {
      deal_id: context.deal_id,
      run_id: context.run_id,
      prompt_version: context.prompt_version,
      total_critical: report.summary.total_critical,
      total_major: report.summary.total_major,
      breakdown_aggregate_mismatches: report.summary.breakdown_aggregate_mismatches,
    });
  }

  return {
    corrected_snapshot: correctedSnapshot,
    validation_report: report,
    was_corrected: true,
  };
}

// ---------------------------------------------------------------------------
// Display Layer Helpers (unchanged from v1.0)
// ---------------------------------------------------------------------------

export function formatValue(path: string, value: number): string {
  const config = LINE_ITEM_CONFIG[path];
  if (!config) return String(value);

  switch (config.display_format) {
    case 'parentheses':
      if (value === 0) return '$0';
      return `($${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })})`;

    case 'negative_sign':
      if (value === 0) return '$0';
      return `-$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

    case 'percent':
      return `${(value * 100).toFixed(2)}%`;

    case 'currency_per_unit':
      return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}/unit`;

    case 'plain':
    default:
      if (value < 0) {
        return `-$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      }
      return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
}

// ---------------------------------------------------------------------------
// Integration Example
// ---------------------------------------------------------------------------

/*

import { correctSnapshotMath, ProFormaSnapshot } from './proFormaMathEngine';

export async function cashflowPostProcess(
  agentOutput: CashflowAgentOutput,
  ctx: PostProcessContext,
): Promise<PostProcessResult> {
  // ... existing evidence normalization ...

  const snapshot: ProFormaSnapshot = {
    broker:   agentOutput.broker_column,
    t12:      agentOutput.t12_column,
    platform: agentOutput.platform_column,
    resolved: agentOutput.resolved_column,
    source_metadata: agentOutput.source_metadata,
  };

  const { corrected_snapshot, validation_report, was_corrected } = correctSnapshotMath(
    snapshot,
    {
      deal_id: ctx.deal_id,
      run_id: ctx.run_id,
      prompt_version: ctx.prompt_version,
      logger: ctx.logger,
    },
  );

  const finalSnapshot = await writeUnderwritingSnapshot({
    deal_id: ctx.deal_id,
    run_id: ctx.run_id,
    broker_column:   corrected_snapshot.broker,
    t12_column:      corrected_snapshot.t12,
    platform_column: corrected_snapshot.platform,
    resolved_column: corrected_snapshot.resolved,
    math_validation_report: validation_report,
    was_math_corrected: was_corrected,
  });

  return {
    snapshot_id: finalSnapshot.id,
    math_was_corrected: was_corrected,
    math_critical_findings: validation_report.summary.total_critical,
    breakdown_aggregate_mismatches: validation_report.summary.breakdown_aggregate_mismatches,
  };
}

*/

// ---------------------------------------------------------------------------
// Unit Test Sketches (v1.1 additions)
// ---------------------------------------------------------------------------

/*

describe('Hierarchical Other Income — v1.1', () => {
  it('sums breakdown components to produce subtotal', () => {
    const values = {
      'proforma.revenue.other_income.parking': 0,
      'proforma.revenue.other_income.pet': 8648,
      'proforma.revenue.other_income.storage': 4920,
      'proforma.revenue.other_income.washer_dryer': 0,
      'proforma.revenue.other_income.rubs': 15936,
      'proforma.revenue.other_income.fees': 0,
      'proforma.revenue.other_income.insurance_admin': 0,
      'proforma.revenue.other_income.cable': 139200,
      'proforma.revenue.other_income.other': 158884,
    };
    const result = computeSubtotal('proforma.revenue.other_income', values);
    expect(result).toBe(327588);
  });

  it('flags breakdown-vs-aggregate mismatch', () => {
    const values = {
      'proforma.revenue.other_income.parking': 0,
      'proforma.revenue.other_income.pet': 8648,
      'proforma.revenue.other_income.storage': 4920,
      'proforma.revenue.other_income.washer_dryer': 0,
      'proforma.revenue.other_income.rubs': 15936,
      'proforma.revenue.other_income.fees': 0,
      'proforma.revenue.other_income.insurance_admin': 0,
      'proforma.revenue.other_income.cable': 139200,
      'proforma.revenue.other_income.other': 158884,
      'proforma.revenue.other_income': 319500,    // T-12 aggregate disagrees with breakdown sum
    };
    const sourceMetadata = {
      'proforma.revenue.other_income.parking': 'rent_roll' as const,
      'proforma.revenue.other_income.pet': 'rent_roll' as const,
      'proforma.revenue.other_income.storage': 'rent_roll' as const,
      'proforma.revenue.other_income.rubs': 'om' as const,
      'proforma.revenue.other_income.cable': 'om' as const,
      'proforma.revenue.other_income.other': 'om' as const,
      'proforma.revenue.other_income': 't12' as const,
    };

    const report = validateColumnMath('resolved', values, sourceMetadata);
    const mismatch = report.findings.find(
      f => f.finding_type === 'breakdown_aggregate_mismatch'
    );
    expect(mismatch).toBeDefined();
    expect(mismatch!.delta).toBe(327588 - 319500);   // 8088
    expect(mismatch!.severity).toBe('major');         // ~2.5% delta
  });

  it('uses breakdown sum (highest priority) when both sources available', () => {
    const values = {
      'proforma.revenue.other_income.pet': 8648,
      'proforma.revenue.other_income.cable': 139200,
      'proforma.revenue.other_income.other': 158884,
      'proforma.revenue.other_income': 319500,
    };
    const sourceMetadata = {
      'proforma.revenue.other_income.pet': 'rent_roll' as const,
      'proforma.revenue.other_income.cable': 'om' as const,
      'proforma.revenue.other_income.other': 'om' as const,
      'proforma.revenue.other_income': 't12' as const,
    };

    const resolution = resolveHierarchicalSubtotal(
      'proforma.revenue.other_income',
      values,
      sourceMetadata,
      319500,
    );

    expect(resolution.resolution_method).toBe('breakdown_sum');
    expect(resolution.resolution_source).toBe('rent_roll');
    expect(resolution.resolved_value).toBe(306732);   // 8648 + 139200 + 158884
    expect(resolution.aggregate_value).toBe(319500);
  });

  it('falls back to t12 aggregate when no breakdown available', () => {
    const values = {
      'proforma.revenue.other_income': 319500,
    };
    const sourceMetadata = {
      'proforma.revenue.other_income': 't12' as const,
    };

    const resolution = resolveHierarchicalSubtotal(
      'proforma.revenue.other_income',
      values,
      sourceMetadata,
      319500,
    );

    expect(resolution.resolution_method).toBe('aggregate');
    expect(resolution.resolution_source).toBe('t12');
    expect(resolution.resolved_value).toBe(319500);
  });
});

*/
