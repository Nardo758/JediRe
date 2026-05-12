/**
 * M07 Traffic Engine — Calibration Type System
 *
 * Defines the Bayesian coefficient hierarchy, starting state discriminated union,
 * and the calibration metadata shape attached to every prediction output.
 */

// ============================================================================
// Layered Value — Subject → Deal → Platform → Baseline
// ============================================================================

export type MatchTier = 'SUBJECT' | 'DEAL' | 'PLATFORM' | 'BASELINE';
export type CalibrationWindow = 'TTM' | 'PYTM' | 'TTM_24';

/**
 * A coefficient resolved from the four-layer Bayesian hierarchy.
 * `subject` is populated when subject_traffic_history ≥ S1 exists.
 * `deal` is populated only when the deal has uploaded rent rolls.
 * `platform` is the submarket/class/vintage-bucketed posterior.
 * `baseline` is the hard-coded constant from the original engine.
 * `resolved` is the value the engine actually uses.
 *
 * Generic: T defaults to number.  Use LayeredValue<string> for label-typed
 * coefficients (e.g. a calibrated unit-mix label).
 */
export interface LayeredValue<T = number> {
  baseline: T;
  platform: T | null;    // null = no platform data for this scope
  deal: T | null;        // null = no rent roll data for this deal
  subject: T | null;     // null = no subject history at ≥S1 tier
  resolved: T;
  match_tier: MatchTier;
  window: CalibrationWindow;
  n_peer_properties: number;
  /** Bayesian blend weight applied to subject value (0–1); null when tier is not SUBJECT */
  subject_weight: number | null;
}

// ============================================================================
// Coefficient Family
// ============================================================================

export interface TrafficCoefficientFamily {
  visibility_capture_rate: LayeredValue;
  apartment_seeker_pct: LayeredValue;
  stop_probability: LayeredValue;
  walkin_to_tour: LayeredValue;
  tour_to_app: LayeredValue;
  app_to_signed: LayeredValue;
}

// ============================================================================
// Calibration Metadata (attached to every prediction)
// ============================================================================

/**
 * Asymmetric percentile confidence band (FIX-3+).
 * p50 and median are aliases for the same value.
 * low = p10 equivalent; high = p90 equivalent.
 */
export interface AsymmetricConfidenceBand {
  low: number;
  p25: number;
  p50: number;
  median: number;
  p75: number;
  high: number;
}

/**
 * Legacy ±1σ confidence band emitted by trafficCalibrationJob pre-FIX-3.
 * Consumers should detect by absence of `p25` and convert on the fly.
 */
export interface LegacyConfidenceBand {
  low: number;
  mid: number;
  high: number;
}

export interface CalibrationMeta {
  match_tier: MatchTier;
  window: CalibrationWindow;
  calibration_source: string;   // e.g. "submarket:atl_midtown | class:A | vintage:post_2015"
  n_peer_properties: number;
  /**
   * Asymmetric percentile confidence band derived from per-evidence values (FIX-3+).
   * Pre-FIX-3 rows carry LegacyConfidenceBand { low, mid, high }.
   * Detect shape via `'p25' in band`.
   */
  confidence_band: AsymmetricConfidenceBand | LegacyConfidenceBand;
  /**
   * Per-evidence array used to compute the band. Available for FIX-3+ rows;
   * null for pre-FIX-3 rows. M38 reads this for percentile recomputation.
   */
  evidence_values: Array<{
    deal_id: string;
    value: number;
    recorded_at: string;
  }> | null;
  coefficients: TrafficCoefficientFamily;
  /** Starting-state mode resolved for this prediction (§4.2 output contract).
   *  Populated by the engine after starting-state resolution; absent if no deal context. */
  mode?: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
  /** Subject history tier, if available (S1/S2/S3/S4) */
  subject_history_tier?: string;
  /**
   * Full subject traffic history record — included in the /coefficients response
   * so downstream consumers (UI, agents) can access observed_dynamics,
   * confidence_weights, and peer_collisions without a separate fetch.
   * Null when no rent roll has been uploaded for this deal.
   */
  subject_history?: {
    tier: string;
    snapshot_count: number;
    coverage_months: number | null;
    observed_dynamics: SubjectObservedDynamics | null;
    confidence_weights: Record<string, SubjectWeightEntry>;
    peer_collisions: SubjectPeerCollision[];
  } | null;
}

// ============================================================================
// Starting State — discriminated union (spec §4.4)
// ============================================================================

export interface StabilizedState {
  mode: 'STABILIZED';
  current_occupancy: number;          // 0.0–1.0
  renewal_rate: number;               // 0.0–1.0 (single-snapshot proxy)
  expiration_waterfall: Array<{       // 24 months forward
    months_out: number;
    expiring_units: number;
    expiring_pct: number;
  }>;
  avg_days_vacant: number;
  churn_replacement_rate: number;     // derived: (1 - renewal_rate) / avg_tenancy_months
}

export interface LeaseUpState {
  mode: 'LEASE_UP';
  start_occupancy: number;
  target_occupancy: number;            // typically 0.93–0.95
  absorption_curve: number[];          // monthly net-lease rates from peer benchmark
  months_to_stabilization_p50: number;
  months_to_stabilization_p25: number;
  months_to_stabilization_p75: number;
  seasonality_overlay: number[];       // 12-element seasonal multipliers
  concession_intensity_curve: number[]; // monthly concession weeks free
}

export interface RedevelopmentPhase {
  phase_number: number;
  units_count: number;
  co_date_months_out: number;         // months until Certificate of Occupancy
  start_occupancy: number;
  target_occupancy: number;
  mini_lease_up_months: number;       // estimated per-phase lease-up duration
}

export interface RedevelopmentState {
  mode: 'REDEVELOPMENT';
  total_units: number;
  occupied_units: number;             // currently occupied (renovation complete)
  offline_units: number;              // currently under renovation
  phases: RedevelopmentPhase[];
  overall_occupancy: number;          // blended current occ across all phases
}

export type StartingState = StabilizedState | LeaseUpState | RedevelopmentState;

// ============================================================================
// Absorption Benchmark (platform-level, per submarket/class/size_band)
// ============================================================================

export interface AbsorptionBenchmark {
  submarket_id: string;
  property_class: string;
  size_band: string;              // e.g. '<50', '50-150', '150-300', '>300' units
  months_to_80_pct_p50: number;
  months_to_90_pct_p50: number;
  months_to_stabilization_p50: number;
  months_to_stabilization_p25: number;
  months_to_stabilization_p75: number;
  monthly_absorption_curve: number[];   // net leases per month (normalized to 100 units)
  concession_intensity_curve: number[]; // weeks free rent per month
  sample_size: number;
  last_updated: Date;
}

// ============================================================================
// Rent Roll Snapshot (parsed output from parser pipeline)
// ============================================================================

export interface RentRollLeaseEvent {
  unit_id?: string;
  unit_type?: string;
  unit_sf?: number;
  contract_rent?: number;
  market_rent?: number;
  concession_value?: number;
  concession_months?: number;
  lease_start?: Date;
  lease_end?: Date;
  move_in_date?: Date;
  move_out_date?: Date;
  notice_date?: Date;
  unit_status?: 'occupied' | 'vacant' | 'notice' | 'model' | 'down';
  is_renewal?: boolean;
  days_vacant?: number;
  row_confidence: number;
}

export interface ParsedRentRoll {
  deal_id: string;
  snapshot_date: Date;
  file_format: 'yardi_csv' | 'yardi_xlsx' | 'generic_csv' | 'generic_xlsx';
  row_count: number;
  extraction_confidence: number;
  lease_events: RentRollLeaseEvent[];
}

// ============================================================================
// Derived Snapshot Metrics (spec §5.x)
// ============================================================================

export interface UnitTypeMetrics {
  unit_type: string;
  signing_velocity: number;       // leases per month
  days_vacant_avg: number;
  concession_intensity: number;   // avg free weeks
  renewal_rate: number;           // 0.0–1.0
}

export interface DerivedSnapshotMetrics {
  signing_velocity_24m: number[];          // monthly histogram (24 buckets, oldest first)
  renewal_rate_proxy: number;              // spec §5.8
  expiration_waterfall: Array<{
    months_out: number;                    // 1..24
    expiring_units: number;
    expiring_pct: number;
  }>;
  unit_type_breakdown: UnitTypeMetrics[];
}

// ============================================================================
// Catalog Metric Weights (Layer A + C, spec §2.1)
// ============================================================================

export interface CatalogMetricWeight {
  metric_name: string;
  metric_layer: 'A' | 'B' | 'C';
  weight: number;     // signed: positive = boost, negative = damper
  is_active: boolean;
}

export interface CatalogMetricValues {
  search_momentum_qoq?: number;
  business_formation_velocity?: number;
  wage_growth_yoy?: number;
  pipeline_pct?: number;
  concession_intensity?: number;
  months_of_supply?: number;
}

// ============================================================================
// Extended Prediction Output with Calibration Metadata (spec §4.2)
// ============================================================================

export interface TrafficPredictionCalibrated {
  // Core prediction output (pass-through from existing engine)
  weekly_walk_ins: number;
  daily_average: number;

  // Starting state
  starting_state: StartingState;

  // Calibration
  calibration: CalibrationMeta;

  // Unit-type breakdown (from rent roll if available)
  unit_type_breakdown?: UnitTypeMetrics[];

  // Expiration waterfall (from rent roll if available)
  expiration_waterfall?: Array<{
    months_out: number;
    expiring_units: number;
    expiring_pct: number;
  }>;
}

// ============================================================================
// Subject Traffic History — per-deal historical data (M07 §6)
// ============================================================================

/**
 * N_REQUIRED thresholds — minimum observations needed before a subject value
 * receives full weight (w_subject = 1.0) in the Bayesian blend.
 * Below this count: w_subject = n_obs / n_required (linear interpolation).
 */
export const SUBJECT_N_REQUIRED: Record<string, number> = {
  walkin_to_tour:          6,
  stop_probability:        6,
  app_to_signed:           6,
  apartment_seeker_pct:    6,
  tour_to_app:             6,
  visibility_capture_rate: 6,
  renewal_rate:           12,   // S2: requires at least 12 observed renewals
  turnover_rate:          12,
  signing_velocity:        8,
  days_vacant_median:      8,
  loss_to_lease:           4,   // S1: only 4 obs needed (direct rent measurement)
  concession_trend:        3,   // S2: need 3 diff periods
};

/** S1 current-state payload — computed from a single snapshot's parsed_payload */
export interface SubjectCurrentState {
  /** 0.0–1.0 occupancy fraction at snapshot date */
  occupancy_rate: number;
  unit_count: number;
  occupied_count: number;
  vacant_count: number;
  notice_count: number;
  /** (market_rent − contract_rent) / market_rent; null when market_rent absent */
  loss_to_lease: number | null;
  /** Avg concession_value across occupied units; null when absent */
  avg_concession_value: number | null;
  /** Avg contract_rent across occupied units; null when absent */
  avg_contract_rent: number | null;
  /** Avg market_rent across all units; null when absent */
  avg_market_rent: number | null;
  /** Forward 24-month lease expiration waterfall (inherited from derivations) */
  expiration_waterfall: Array<{
    months_out: number;
    expiring_units: number;
    expiring_pct: number;
  }>;
  /** Signing velocity from derivations (leases/month) */
  signing_velocity: number | null;
  /**
   * Distribution of occupied-unit lease terms bucketed by months remaining or total duration.
   * Keys are term-length buckets (e.g. 'month_to_month', '3_month', '6_month', '12_month', '24_month', 'other').
   * Values are the count of occupied units in that bucket.
   */
  lease_term_distribution: Record<string, number>;
}

/** S2 observed-dynamics payload — computed from ≥2 snapshots ≥60 days apart */
export interface SubjectObservedDynamics {
  renewal_rate: number | null;
  turnover_rate: number | null;
  new_lease_trade_out_pct: number | null;
  renewal_trade_out_pct: number | null;
  signing_velocity: number | null;
  days_vacant_median: number | null;
  concession_trend: 'increasing' | 'stable' | 'decreasing' | null;
  loss_to_lease: number | null;
  /** Number of diff periods aggregated into S2 */
  diff_period_count: number;
}

export interface SubjectWeightEntry {
  n_obs: number;
  n_required: number;
  weight: number;     // min(1, n_obs / n_required)
}

export interface SubjectPeerCollision {
  coefficient: string;
  subject_value: number;
  peer_value: number;
  sigma_deviation: number;
}

/** Full subject_traffic_history record shape (mirrors DB row) */
export interface SubjectTrafficHistory {
  id: number;
  deal_id: string;
  tier: 'S1' | 'S2' | 'S3' | 'S4';
  snapshot_count: number;
  coverage_months: number | null;
  current_state: SubjectCurrentState | null;
  observed_dynamics: SubjectObservedDynamics | null;
  confidence_weights: Record<string, SubjectWeightEntry>;
  peer_collisions: SubjectPeerCollision[];
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Concession Environment Sub-Engine — M07 Task #525
// ============================================================================

export type ConcessionConfidence = 'HIGH' | 'MED' | 'LOW';
export type ConcessionSeverity = 'MINOR' | 'MATERIAL' | 'SEVERE';

/**
 * Per-year source blend weights (must sum to ≤ 1; remainder is class_default).
 * Captures how much each data layer contributed to the resolved value.
 */
export interface ConcessionSourceBlend {
  class_default_weight: number;
  submarket_weight: number;
  subject_weight: number;
}

/**
 * Collision logged when subject-history S2+ concession diverges
 * materially (≥1.5σ) from the M05 submarket baseline.
 */
export interface ConcessionCollision {
  year: number;
  subject_value_months: number;
  submarket_value_months: number;
  std_dev: number;
  delta_sigma: number;
  severity: ConcessionSeverity;
  narrative: string;
}

/**
 * Resolved concession environment for a single hold-period year.
 * This is the canonical output consumed by the M09 Projections Adapter
 * and the CashFlow Agent.
 */
export interface PerYearConcessionEnv {
  year: number;
  free_months: number;
  concession_pct: number;
  supply_pressure_modifier: number;
  confidence: ConcessionConfidence;
  source_blend: ConcessionSourceBlend;
  renovated_free_months?: number;
  untouched_free_months?: number;
}

/** Top-level output written to dealContext.traffic.concession_environment */
export interface ConcessionEnvironmentOutput {
  deal_id: string;
  mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
  property_class: string;
  hold_years: number;
  per_year: PerYearConcessionEnv[];
  collisions: ConcessionCollision[];
  computed_at: string;
  supply_pressure_score: number | null;
  submarket_sample_size: number | null;
  subject_s2_available: boolean;
  /**
   * Machine-readable reason code for degraded or empty outputs.
   * Null when the output is fully computed without data-quality issues.
   * Examples: 'MISSING_DEAL', 'INVALID_INPUT', 'COMPUTATION_ERROR',
   *           'NO_M05_DATA', 'BAD_POOL_DATA'
   */
  degraded_reason: string | null;
}
