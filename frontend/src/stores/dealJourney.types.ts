// ============================================================================
// JEDI RE — DealJourney: Unified Semantic Model
// ============================================================================
//
// The Deal Journey is a derived view over DealContext that names what the
// underwriter is actually thinking about: where the deal is today (State A),
// where it goes if the thesis works (State B), the gap between them, the
// year-by-year path, the levers that drive it, and how aggressive the thesis
// is relative to historical norms.
//
// ARCHITECTURE:
//   - DealJourney is NOT a parallel storage layer. It is computed at read time
//     from existing DealContext fields via `useDealJourney(ctx)` in
//     dealJourney.selector.ts.
//   - Optional (`?`) slots are PENDING — they will be filled as M36 (aggressiveness),
//     M07 backend (confidence bands), M35 (event path), and M38 (calibration) ship.
//   - No backend changes, no migration, no new tables in Phase 1.
//
// See docs/architecture/deal-journey-framework.md for the full spec.
// ============================================================================

import type {
  FinancialContext,
  StrategyContext,
  ExistingPropertyContext,
  LayeredValue,
} from './dealContext.types';
import type { OperatorStance } from '../types/operator-stance';

// ---------------------------------------------------------------------------
// State A — current financial reality, source-document-grounded
// ---------------------------------------------------------------------------

export interface JourneyStateA {
  /** ISO timestamp; when State A was sampled (typically now for existing deals). */
  asOf: string;
  /** In-place NOI from the resolved Pro Forma (broker/T-12 layers, no forward growth). */
  noi: number;
  /** Current occupancy % (0-1). */
  occupancy: number;
  /** Weighted-average in-place rent across rent roll. */
  inPlaceRentPerUnit: number;
  /** M05-derived market reference rent. */
  marketRentPerUnit: number;
  /** OpEx / EGI ratio (0-1). */
  expenseRatio: number;
  /** Property class from ExistingPropertyContext (null for dev deals). */
  propertyClass: ExistingPropertyContext['propertyClass']['value'] | null;
  /** Year the property was built (null for dev deals). */
  yearBuilt: number | null;
  /** Deferred CapEx estimate as a LayeredValue (capexPerUnit × totalUnits). */
  capexBacklog: LayeredValue<number>;
  /** Which Pro Forma source layers are present for this deal. */
  sourceLayers: {
    broker: 'present' | 'absent';
    t12: 'present' | 'absent';
    rentRoll: 'present' | 'absent';
    taxBill: 'present' | 'absent';
  };
  /**
   * DQA-protected — count of active data_quality_alerts on State A inputs.
   * Sourced from the DQA alerts endpoint (Task #707). 0 when none or not yet loaded.
   */
  dataQualityFindings: number;
}

// ---------------------------------------------------------------------------
// State B — stabilized underwriting target
// ---------------------------------------------------------------------------

export interface JourneyStateB {
  /** Stabilized NOI at the end of the assumed hold (from outputs or assumptions). */
  targetNoi: number;
  /** Assumed stabilized occupancy (0-1). */
  targetOccupancy: number;
  /** Achieved market rent at stabilization (from market context or unit mix). */
  targetRentPerUnit: number;
  /** Normalized expense ratio at stabilization. */
  targetExpenseRatio: number;
  /** Terminal cap rate (from assumptions.exitCapRate). */
  exitCapRate: number;
  /** Years to hold (from assumptions.holdPeriod). */
  holdPeriodYears: number;
  /**
   * Which year the path reaches B (1-indexed). Derived from M07 leaseUp.weeksTo95
   * when available; falls back to 1 (Year 1 = stabilized for underwriting purposes).
   */
  yearOfStabilization: number;
}

// ---------------------------------------------------------------------------
// Gap — quantified delta between A and B per metric (NEW)
// ---------------------------------------------------------------------------

export interface JourneyGap {
  /** NOI uplift absolute ($) and percent. */
  noiUplift: { absolute: number; percent: number };
  /** Occupancy uplift in percentage points (e.g. 20 = 20pp). */
  occupancyUplift: { points: number };
  /** Rent uplift per unit absolute ($) and percent. */
  rentUplift: { perUnit: number; percent: number };
  /** Expense ratio change in percentage points (negative = improvement). */
  expenseRatioChange: { points: number };
  /** Dollar capex to bridge A → B (capexPerUnit × totalUnits). */
  capexRequired: number;
  /**
   * Per-metric "lift required" expressed as σ from historical typical lifts.
   * PENDING M36 Phase A — undefined until M36 ships.
   */
  liftAggressiveness?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Path — year-by-year trajectory between A and B
// ---------------------------------------------------------------------------

export interface JourneyPathYear {
  /** 1-indexed year number. */
  year: number;
  /** NOI for this year (from projections). */
  noi: number;
  /** Occupancy this year (0-1). */
  occupancy: number;
  /** Effective rent per unit this year. */
  effRentPerUnit: number;
  /** Rent growth % this year. */
  rentGrowthPct: number;
  /** Vacancy % this year (0-1). */
  vacancyPct: number;
  /**
   * Confidence band — PENDING M07 backend wiring of asymmetric percentile output.
   * Undefined until M07 ships per-year percentile bands.
   */
  confidenceBand?: {
    p10: number;
    p25: number;
    median: number;
    p75: number;
    p90: number;
  };
}

export interface JourneyPath {
  yearByYear: JourneyPathYear[];
  /** Lease-up timeline from M07. null values when M07 data is unavailable. */
  leaseUpTimeline: {
    weeksTo90: number | null;
    weeksTo93: number | null;
    weeksTo95: number | null;
  };
  /**
   * Event-adjusted trajectory from M35 — same shape as yearByYear, with event
   * impacts overlaid. PENDING M35 integration.
   */
  eventAdjustedTrajectory?: Array<{
    year: number;
    deltas: Record<string, number>;
    eventIds: string[];
  }>;
  /**
   * Calibration confidence per year from M38 Calibration Ledger.
   * PENDING M38 build.
   */
  pathConfidence?: Array<{
    year: number;
    calibratedCi: { lo: number; hi: number };
  }>;
}

// ---------------------------------------------------------------------------
// Levers — the assumption set that drives A → B
// ---------------------------------------------------------------------------

export type LeverEvidenceModule = 'M05' | 'M07' | 'M04' | 'M26' | 'M37' | 'platform_default';

export interface LeverEvidence {
  /** Which module's data populated the platform layer for this assumption. */
  sourceModule: LeverEvidenceModule;
  /** 0-1 confidence in the evidence (derived from the LayeredValue.confidence). */
  sourceConfidence: number;
  /** ISO timestamp of last calibration (derived from LayeredValue.updatedAt). */
  lastCalibrated: string | null;
}

export interface JourneyLevers {
  rentGrowth: LayeredValue<number>;
  expenseGrowth: LayeredValue<number>;
  vacancy: LayeredValue<number>;
  exitCapRate: LayeredValue<number>;
  holdPeriod: LayeredValue<number>;
  capexPerUnit: LayeredValue<number>;
  managementFee: LayeredValue<number>;
  /**
   * Per-lever evidence source — which module's data populated the platform layer.
   * Derived at read time from LayeredValueSource (no new persistence).
   * Keys match the FinancialContext.assumptions property names.
   */
  perLeverEvidence: Partial<Record<keyof FinancialContext['assumptions'], LeverEvidence>>;
  /**
   * OperatorStance modulators currently applied to this deal.
   * null when no stance has been set (defaults apply).
   */
  stanceModulators: {
    stressRentGrowthHaircut: number;
    stressExitCapWiden: number;
    stressVacancyFloor: number;
    concessionStrategy: OperatorStance['concessionStrategy'];
    leasingCostTreatment: OperatorStance['leasingCostTreatment'];
  } | null;
}

// ---------------------------------------------------------------------------
// Aggressiveness — M36 plausibility scoring (PENDING M36 Phase A)
// ---------------------------------------------------------------------------

export interface JourneyAggressiveness {
  /** d² distance from historical center of assumption space. */
  mahalanobisD: number;
  /** Qualitative band based on d² thresholds (≤1 Realistic, ≤2 Stretch, ≤3 Aggressive, >3 Heroic). */
  band: 'Realistic' | 'Stretch' | 'Aggressive' | 'Heroic';
  /** Per-variable contribution to the d² score. */
  perVariableContribution: Array<{
    variable: string;
    contribution: number;
    direction: 'aggressive' | 'conservative';
  }>;
  /** Pareto frontier from M36 goal-seek — only populated when Cashflow Agent runs goal-seek. */
  paretoFrontier?: Array<{
    targetIrr: number;
    achievedAtD: number;
    xStar: Record<string, number>;
  }>;
}

// ---------------------------------------------------------------------------
// Strategy Frame — M08 classification (LOCKED)
// ---------------------------------------------------------------------------

export interface JourneyStrategyFrame {
  detectedStrategy: StrategyContext['selectedStrategy']['value'];
  /** Score gap between the highest and lowest feasible strategy scores. */
  arbitrageGap: number;
  /** The platform's verdict sentence about the strategy fit. */
  verdict: string;
}

// ---------------------------------------------------------------------------
// Calibration Confidence — M38 reliability (PENDING M38)
// ---------------------------------------------------------------------------

export interface JourneyCalibration {
  /** 0-1: fraction of historical predictions where the median fell within the realized range. */
  pathPredictionReliability: number;
  /** Multiplier to widen CIs to achieve target reliability (typically ≥1.0). */
  ciWideningFactor: number;
  /** Drift detection status on rolling reliability scores. */
  driftStatus: 'stable' | 'drift_detected' | 'no_data';
}

// ---------------------------------------------------------------------------
// Score Trajectory — JEDI Score A → B
// ---------------------------------------------------------------------------

export interface JourneyScoreTrajectory {
  /** Current JEDI Score from JEDIScoreContext.overall. */
  scoreAtA: number;
  /**
   * Projected stabilized JEDI Score.
   * TODO: No current code projects forward. Left null until M25 extension ships.
   */
  scoreAtB: number | null;
  /**
   * Per-dimension score deltas at stabilization.
   * null until scoreAtB is computed.
   */
  subScoreDeltas: {
    demand: number;
    supply: number;
    momentum: number;
    position: number;
    risk: number;
  } | null;
}

// ---------------------------------------------------------------------------
// DealJourney — the unified object
// ---------------------------------------------------------------------------

/**
 * The Deal Journey is a derived view over DealContext that names what the
 * underwriter is actually reasoning about. Composed from existing DealContext
 * fields; not a parallel storage layer.
 *
 * Runtime construction: `useDealJourney(ctx)` in dealJourney.selector.ts.
 *
 * LOCKED slots: populated in Phase 1 from existing platform data.
 * PENDING slots (marked `?`): filled as M36/M07/M35/M38 ship.
 */
export interface DealJourney {
  /** State A — current financial reality, source-document-grounded. */
  stateA: JourneyStateA;

  /** State B — stabilized underwriting target. */
  stateB: JourneyStateB;

  /**
   * Gap — quantified delta between A and B per metric.
   * NEW: first-class derivation — no equivalent existed before this framework.
   */
  gap: JourneyGap;

  /** Path — year-by-year trajectory between A and B. */
  path: JourneyPath;

  /** Levers — the assumption set that drives A → B. */
  levers: JourneyLevers;

  /**
   * Aggressiveness — M36 plausibility scoring of the assumption set.
   * PENDING M36 Phase A completion.
   */
  aggressiveness?: JourneyAggressiveness;

  /** Strategy Frame — M08 classification. LOCKED. */
  strategyFrame: JourneyStrategyFrame;

  /**
   * Calibration Confidence — M38 reliability of platform predictions.
   * PENDING M38 build.
   */
  calibration?: JourneyCalibration;

  /** JEDI Score trajectory from current to stabilized. */
  scoreTrajectory: JourneyScoreTrajectory;
}
