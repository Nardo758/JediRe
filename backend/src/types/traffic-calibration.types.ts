/**
 * M07 Traffic Engine — Calibration Type System
 *
 * Defines the Bayesian coefficient hierarchy, starting state discriminated union,
 * and the calibration metadata shape attached to every prediction output.
 */

// ============================================================================
// Layered Value — Deal → Platform → Baseline
// ============================================================================

export type MatchTier = 'DEAL' | 'PLATFORM' | 'BASELINE';
export type CalibrationWindow = 'TTM' | 'PYTM' | 'TTM_24';

/**
 * A coefficient resolved from the three-layer Bayesian hierarchy.
 * `deal` is populated only when the deal has uploaded rent rolls.
 * `platform` is the submarket/class/vintage-bucketed posterior.
 * `baseline` is the hard-coded constant from the original engine.
 * `resolved` is the value the engine actually uses.
 */
export interface LayeredValue {
  baseline: number;
  platform: number | null;    // null = no platform data for this scope
  deal: number | null;        // null = no rent roll data for this deal
  resolved: number;
  match_tier: MatchTier;
  window: CalibrationWindow;
  n_peer_properties: number;
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

export interface CalibrationMeta {
  match_tier: MatchTier;
  window: CalibrationWindow;
  calibration_source: string;   // e.g. "submarket:atl_midtown | class:A | vintage:post_2015"
  n_peer_properties: number;
  confidence_band: {
    low: number;
    mid: number;
    high: number;
  };
  coefficients: TrafficCoefficientFamily;
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
