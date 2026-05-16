/**
 * Roadmap Mode — Type Definitions
 *
 * Defines the full input/output contract for the Cash Flow Agent's Roadmap Mode.
 * Roadmap Mode is prescriptive: it produces an ordered, year-by-year operational
 * action plan to reach a target return, complementing the descriptive Underwrite Mode.
 *
 * Spec: ROADMAP_MODE_SPEC v1.0
 */

// ── Input Contract ────────────────────────────────────────────────────────────

export type RoadmapReturnMetric = 'irr' | 'equity_multiple' | 'noi_growth_3yr' | 'cash_on_cash_y3';

export type RoadmapActionCategory = 'revenue' | 'expense' | 'other_income' | 'debt' | 'capex' | 'exit';

export type AchievabilityStatus =
  | 'achievable'
  | 'achievable_with_stretch'
  | 'achievable_only_with_overrides'
  | 'not_achievable';

export type PlausibilityClassification =
  | 'within_distribution'
  | 'stretch'
  | 'aggressive'
  | 'implausible';

export interface RoadmapInput {
  deal_id: string;
  target_return: {
    metric: RoadmapReturnMetric;
    value: number;
    hold_years: number;
  };
  constraints?: {
    max_capex_budget?: number;
    max_debt_terms?: { rate: number; ltv: number };
    sponsor_excluded_actions?: string[];
    must_include_actions?: string[];
  };
  sponsor_capabilities?: {
    in_house_pm: boolean;
    renovation_experience: 'low' | 'medium' | 'high';
    leasing_strategy_change_capability: boolean;
  };
}

// ── Action Library Schema ─────────────────────────────────────────────────────

export interface ActionLibraryEntry {
  id: string;
  name: string;
  category: RoadmapActionCategory;
  description: string;
  applicability: {
    deal_types: string[];
    asset_classes: string[];
    requires_posture: string[];
  };
  impact_band: {
    p25_pct: number;
    p50_pct: number;
    p75_pct: number;
    affected_lines: string[];
    dollar_basis: 'annual_noi' | 'annual_revenue' | 'annual_opex';
  };
  cost_profile: {
    typical_upfront: number;
    typical_operating: number;
    sensitivity_to_property_size: 'fixed' | 'per_unit' | 'per_sqft';
  };
  duration: {
    typical_start_lag: number;
    typical_duration: number;
    typical_impact_lag: number;
  };
  evidence_query: string;
  dependencies: string[];
  risks: string[];
}

// ── RoadmapAction — individual action in the output ──────────────────────────

export interface RoadmapAction {
  id: string;
  action_name: string;
  category: RoadmapActionCategory;
  timing: {
    start_month: number;
    duration_months: number;
    impact_starts_month: number;
    impact_fully_realized_month: number;
  };
  expected_impact: {
    annualized_dollar_impact_at_full_realization: number;
    affected_line_items: string[];
    confidence: 'high' | 'medium' | 'low';
  };
  evidence: {
    archive_success_rate: number;
    archive_n: number;
    archive_p50_actual_lift: number;
    archive_p25_p75_actual_lift: [number, number];
    cohort_match_criteria: string;
    market_signal_support: string[];
  };
  cost: {
    upfront_capital: number;
    operating_cost_change: number;
    one_time_disruption: number;
  };
  dependencies: string[];
  risks: string[];
}

// ── YearlyTrajectory ──────────────────────────────────────────────────────────

export interface YearlyTrajectory {
  year: number;
  actions_active: string[];
  posture_classification: string;
  noi_baseline: number;
  noi_with_roadmap: number;
  noi_lift_this_year: number;
  noi_lift_cumulative: number;
  primary_lift_drivers: { action_id: string; dollar_contribution: number }[];
}

// ── CompComparison (optional — Task #787) ─────────────────────────────────────

export interface CompComparison {
  reference_comp: { property_id: string; name: string };
  observed_differences: {
    category: 'physical' | 'operational' | 'pricing' | 'ancillary' | 'tenant_mix';
    description: string;
    rent_or_noi_attribution: number;
  }[];
  replicable_differences: string[];
  non_replicable_differences: string[];
  replicability_score: number;
}

// ── RoadmapOutput — full output contract ─────────────────────────────────────

export interface RoadmapOutput {
  meta: {
    deal_id: string;
    target_return: {
      metric: RoadmapReturnMetric;
      value: number;
      hold_years: number;
    };
    achievability_status: AchievabilityStatus;
    achievability_reasoning: string;
    generated_at: string;
    baseline_irr: number;
    target_irr: number;
    roadmap_irr: number;
  };

  baseline_proforma: {
    description: string;
    irr: number;
    equity_multiple: number;
    noi_path: number[];
  };

  target_proforma: {
    description: string;
    irr: number;
    equity_multiple: number;
    noi_path_required: number[];
  };

  gap_analysis: {
    total_noi_gap: number;
    gap_by_bucket: {
      revenue_lift: number;
      expense_reduction: number;
      other_income_lift: number;
      debt_optimization: number;
      capex_value_add: number;
      exit_timing_lift: number;
    };
  };

  roadmap_actions: RoadmapAction[];

  yearly_trajectory: YearlyTrajectory[];

  plausibility_check: {
    m36_d_value: number;
    classification: PlausibilityClassification;
    notes: string;
  };

  comp_comparison?: CompComparison;
}

// ── DB Row — deal_roadmaps table ─────────────────────────────────────────────

export interface DealRoadmapRow {
  id: string;
  deal_id: string;
  created_by: string;
  target_return_metric: RoadmapReturnMetric;
  target_return_value: number;
  hold_years: number;
  constraints_json: Record<string, unknown> | null;
  output_json: RoadmapOutput | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  created_at: string;
  updated_at: string;
}
