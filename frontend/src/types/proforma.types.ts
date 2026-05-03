// ── ProForma Types ─────────────────────────────────────────────────────────
// Per F9_PROFORMA_WIRING_HANDOFF.md Phase 1 deliverable.
// Maps to backend proforma-adjustment.service.ts response shape.

export type ProjectType = 'existing' | 'value_add' | 'lease_up' | 'development' | 'redevelopment';
export type AssetClass = 'multifamily' | 'sfr' | 'retail' | 'office' | 'industrial' | 'hospitality';
export type LayeredValueSource =
  | 'tier1:t12'
  | 'tier1:rent_roll'
  | 'tier1:tax_bill'
  | 'tier2:owned_asset'
  | 'tier3:platform'
  | 'tier3:market_comp'
  | 'tier3:jurisdiction'
  | 'tier4:broker'
  | 'override'
  | 'agent:research'
  | 'agent:zoning'
  | 'agent:supply'
  | 'agent:cashflow'
  | 'agent:commentary'
  | 'subject_history:s1'
  | 'subject_history:s2'
  | 'subject_history:s3'
  | 'subject_history:s4'
  | 't12'
  | 'rent_roll'
  | 'tax_bill'
  | 'platform';

export interface LayeredValue<T = number> {
  value: T;
  source: LayeredValueSource;
  agent_run_id?: string;
  set_at: string;
  set_by?: string;
  confidence?: 'high' | 'medium' | 'low';
  evidence?: Evidence;
}

export interface Evidence {
  primary_tier: 1 | 2 | 3;
  data_points: EvidencePoint[];
  reasoning: string;
  alternatives_considered: Alternative[];
  collision?: CollisionReport;
}

export interface EvidencePoint {
  source_type: 't12' | 'rent_roll' | 'tax_bill' | 'owned_asset' | 'submarket_ttm' | 'comp' | 'archive';
  source_id: string;
  source_label: string;
  value: number | string;
  as_of: string;
  weight: number;
}

export interface Alternative {
  candidate_value: number | string;
  rationale: string;
  rejected_because: string;
}

export interface CollisionReport {
  broker_value: number | string;
  agent_value: number | string;
  delta_pct: number;
  delta_magnitude_usd?: number;
  severity: 'minor' | 'material' | 'severe';
  narrative: string;
}

// ── Top-level ProForma ─────────────────────────────────────────────────────

export interface ProForma {
  deal_id: string;
  project_type: ProjectType;
  asset_class: AssetClass;
  hold_years: number;
  as_of: string;
  agent_run_id?: string;
  assumptions: ProFormaAssumptions;
  computed: ProFormaComputed;
  summary: ProFormaSummary;
  collision_count: { minor: number; material: number; severe: number };
  confidence_distribution: { high: number; medium: number; low: number };
  tier_distribution: { tier1: number; tier2: number; tier3: number };
  archive_percentile?: number;
}

// ── Assumptions ────────────────────────────────────────────────────────────

export interface ProFormaAssumptions {
  units: LayeredValue<number>;
  avg_rent_per_unit: LayeredValue<number>;
  purchase_price: LayeredValue<number>;
  closing_cost_pct: LayeredValue<number>;

  rent_growth_y1: LayeredValue<number>;
  rent_growth_terminal: LayeredValue<number>;
  vacancy_baseline: LayeredValue<number>;
  vacancy_ramp: LayeredValue<number[]>;
  other_income_per_unit: LayeredValue<number>;
  concessions_pct: LayeredValue<number>;
  bad_debt_pct: LayeredValue<number>;

  opex_per_unit: LayeredValue<number>;
  opex_growth: LayeredValue<number>;
  property_tax: LayeredValue<number>;
  insurance: LayeredValue<number>;
  management_fee_pct: LayeredValue<number>;
  capex_reserve_per_unit: LayeredValue<number>;

  exit_cap_rate: LayeredValue<number>;
  selling_cost_pct: LayeredValue<number>;
  hold_years: LayeredValue<number>;

  value_add?: ValueAddAssumptions;
  lease_up?: LeaseUpAssumptions;
  development?: DevelopmentAssumptions;
  redevelopment?: RedevelopmentAssumptions;
}

export interface ValueAddAssumptions {
  reno_units_per_month: LayeredValue<number>;
  reno_cost_per_unit: LayeredValue<number>;
  rent_premium_per_unit: LayeredValue<number>;
  premium_ramp_months: LayeredValue<number>;
}

export interface LeaseUpAssumptions {
  absorption_curve_24mo: LayeredValue<number[]>;
  pre_leased_units: LayeredValue<number>;
  stabilized_occupancy: LayeredValue<number>;
  tco_date: LayeredValue<string>;
}

export interface DevelopmentAssumptions {
  hard_costs_psf: LayeredValue<number>;
  soft_costs_pct: LayeredValue<number>;
  contingency_pct: LayeredValue<number>;
  construction_months: LayeredValue<number>;
  land_basis: LayeredValue<number>;
}

export interface RedevelopmentAssumptions {
  units_under_reno: LayeredValue<number>;
  reno_phases: LayeredValue<number>;
  partial_t12_units: LayeredValue<number>;
}

// ── Computed Outputs ───────────────────────────────────────────────────────

export interface ProFormaComputed {
  annual: AnnualLine[];
  monthly?: MonthlyLine[];
  returns: ReturnsBlock;
  metrics: MetricsBlock;
  sources_uses: SourcesAndUses;
}

export interface AnnualLine {
  year: number;
  gpr: number;
  vacancy_loss: number;
  concessions: number;
  bad_debt: number;
  other_income: number;
  egi: number;
  property_tax: number;
  insurance: number;
  management: number;
  utilities: number;
  repairs_maintenance: number;
  payroll: number;
  marketing: number;
  general_admin: number;
  other_opex: number;
  total_opex: number;
  noi: number;
  capex_reserve: number;
  noi_after_reserves: number;
  debt_service: number;
  cash_flow: number;
  dscr: number;
  occupancy: number;
  expense_ratio: number;
}

export interface MonthlyLine {
  year: number;
  month: number;
  noi: number;
  debt_service: number;
  cash_flow: number;
  occupancy: number;
}

export interface ReturnsBlock {
  irr: number;
  equity_multiple: number;
  cash_on_cash_y1: number;
  cash_on_cash_avg: number;
  yield_on_cost: number;
  total_distributions: number;
  total_equity_invested: number;
  exit_proceeds: number;
}

export interface MetricsBlock {
  going_in_cap_rate: number;
  exit_cap_rate: number;
  noi_yr1: number;
  noi_stabilized: number;
  debt_yield: number;
  ltv: number;
  ltc: number;
  break_even_occupancy: number;
}

export interface SourcesAndUses {
  sources: {
    senior_debt: number;
    mezz_debt: number;
    lp_equity: number;
    gp_equity: number;
    preferred_equity?: number;
  };
  uses: {
    purchase_price: number;
    closing_costs: number;
    reno_budget?: number;
    dev_budget?: number;
    reserves: number;
    financing_fees: number;
  };
}

// ── Summary ────────────────────────────────────────────────────────────────

export interface ProFormaSummary {
  irr: number;
  equity_multiple: number;
  cash_on_cash_y1: number;
  going_in_cap_rate: number;
  noi_yr1: number;
  dscr_yr1: number;
  total_equity: number;
  exit_value: number;
}

// ── Update / Override Payloads ────────────────────────────────────────────

export type AssumptionPath =
  | `assumptions.${keyof ProFormaAssumptions}`
  | `assumptions.value_add.${keyof ValueAddAssumptions}`
  | `assumptions.lease_up.${keyof LeaseUpAssumptions}`
  | `assumptions.development.${keyof DevelopmentAssumptions}`
  | `assumptions.redevelopment.${keyof RedevelopmentAssumptions}`;

export interface ProFormaUpdate {
  deal_id: string;
  changes: Array<{
    path: AssumptionPath;
    value: number | string | number[];
    source: 'override';
    reason?: string;
  }>;
}

export interface OverridePayload {
  field_path: AssumptionPath;
  value: number | string | number[];
  reason?: string;
}

// ── Scenarios ──────────────────────────────────────────────────────────────

export interface ScenarioBundle {
  base: ProFormaSummary;
  bull: ProFormaSummary;
  bear: ProFormaSummary;
  stress: ProFormaSummary;
  probabilities: { bull: number; base: number; bear: number; stress: number };
  expected_irr: number;
  expected_equity_multiple: number;
}
