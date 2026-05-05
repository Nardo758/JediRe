// ── Lease Velocity Engine — Type Definitions ─────────────────────────────────
// Spec: attached_assets/LEASE_VELOCITY_ENGINE_SPEC_1777935885256.md

import type { ConcessionRecord } from '../types/concessions';

export type LeaseMode =
  | 'LEASE_UP_NEW_CONSTRUCTION'
  | 'STABILIZED_MAINTENANCE'
  | 'OCCUPANCY_RECOVERY'
  | 'V2_PENDING_VALUE_ADD';

export type LeasingCostTreatment = 'OPERATING' | 'CAPITALIZED' | 'HYBRID';
export type StabilizationDefinition = 'PHYSICAL_95' | 'ECONOMIC_95' | 'AGENCY_90_30_60_90';
export type MarketingIntensity = 'LOW' | 'MARKET' | 'AGGRESSIVE';
export type ConcessionStrategy = 'CONSERVATIVE' | 'MARKET' | 'AGGRESSIVE';

export interface DealContext {
  deal: {
    total_units: number;
    year_built: number;
    property_class?: 'A' | 'B' | 'C';
    city?: string;
    state?: string;
  };
  traffic?: {
    subject_history?: {
      current_state?: { units_occupied?: number };
      observed_dynamics?: Record<string, unknown>;
      peer_set_values?: Record<string, number>;
      confidence_weights?: Record<string, { n_obs: number; n_required: number; weight: number }>;
    };
    expiration_waterfall?: number[];
    renewal_rate?: { value: number };
    days_vacant_median?: { value: number };
    peer_set?: { max_monthly_absorption_per_class_msa?: number };
    funnel_conversion_ratios?: { value: Record<string, number> };
  };
  capex_schedule?: { has_active_phase?: boolean };
  has_prior_history?: boolean;
}

export interface LeaseVelocityInputs {
  // Required
  total_units: number;
  target_occupancy: number;
  current_occupancy?: number;
  mode?: LeaseMode;
  // Optional
  stabilization_definition?: StabilizationDefinition;
  leasing_cost_treatment?: LeasingCostTreatment;
  time_horizon_months?: number;
  // Mode-specific
  delivery_month?: number;
  pre_leased_count?: number;
  pre_lease_window_months?: number;
  sign_to_move_in_lag_days?: number;
  marketing_intensity?: MarketingIntensity;
  concession_strategy?: ConcessionStrategy;
  catch_up_period_months?: number;
  // Platform defaults
  avg_market_rent?: number;
  avg_in_place_rent?: number;
  avg_lease_term_months?: number;
  turn_cost_per_unit?: number;
  property_class?: 'A' | 'B' | 'C';
  /**
   * Optional deal identifier.
   * When present, the engine embeds it in generated ConcessionRecord.deal_id
   * and the API route persists concession_records to deal_data.
   */
  deal_id?: string;
}

export interface MonthOutput {
  month_index: number;
  calendar_month: string;
  mode_for_month: LeaseMode;
  expirations: number;
  renewals: number;
  replacement_leases: number;
  gap_close_leases: number;
  pre_lease_signings: number;
  lease_up_signings: number;
  total_signings: number;
  move_ins: number;
  move_outs: number;
  cumulative_occupied: number;
  physical_occupancy_pct: number;
  economic_occupancy_pct: number;
  gpr: number;
  vacancy_loss: number;
  concessions_new_lease: number;
  concessions_renewal: number;
  loss_to_lease_dollars: number;
  effective_rent: number;
  marketing_spend: number;
  locator_fees: number;
  make_ready: number;
  bad_debt: number;
  opex: number;
  noi: number;
  debt_service: number;
  cash_flow: number;
  lease_up_reserve_burn: number;
  cumulative_lease_up_reserve: number;
  implied_prospect_volume: number;
  stabilization_marker: boolean;
}

export interface LeaseVelocityResult {
  success: boolean;
  mode: LeaseMode;
  inputs: LeaseVelocityInputs;
  months: MonthOutput[];
  narrative: string;
  stabilization_month: number | null;
  cumulative_reserve_required: number;
  warnings: string[];
  /**
   * ConcessionRecord[] assembled from every lease-event month in the forward table.
   * Task #573: LV Engine Output Assembly (§13 step 5).
   *
   * Each new-lease and renewal event with concession dollars produces one record,
   * using the §4 platform default amortization method for the event type.
   * Records are ready for direct consumption by amortizeConcessions().
   *
   * Empty array when no concession dollars are projected (zero-concession runs).
   */
  concession_records: ConcessionRecord[];
}

export type { ConcessionRecord };
