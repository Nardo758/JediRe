/**
 * OperatorStance — frontend canonical type file.
 *
 * This is the single source of truth for OperatorStance types on the frontend.
 * The backend canonical is backend/src/types/operator-stance.ts.
 * These two files must be kept in sync by hand (no shared package layer).
 *
 * dealContext.types.ts re-exports everything from here so existing import paths
 * continue to work without change.
 */

export type RateEnvironment = 'CUTTING' | 'NORMALIZING' | 'HIGHER_FOR_LONGER';
export type CyclePosition = 'EARLY' | 'MID' | 'LATE';
export type UnderwritingPosture = 'CONSERVATIVE' | 'MARKET' | 'AGGRESSIVE';
export type ConcessionStrategy = 'CONSERVATIVE' | 'MARKET' | 'AGGRESSIVE';
export type MarketingIntensity = 'LOW' | 'MARKET' | 'AGGRESSIVE';
export type ExpenseGrowthPosture = 'CONTAINED' | 'INFLATION' | 'STRESSED';

/** Provenance of the current stance values. */
export type SetBy = 'operator' | 'platform_default' | 'agent_inferred';

export interface OperatorStance {
  /** Federal Reserve rate trajectory — modulates exit cap and opex growth. */
  rateEnvironment: RateEnvironment;
  /** Where we are in the real estate cycle — modulates rent growth and vacancy assumptions. */
  cyclePosition: CyclePosition;
  /** Subjective recession probability 0–1 — activates stress overlays above 0.4. */
  recessionProbability: number;
  /** Master underwriting posture — the "one dial" version of stance. */
  underwritingPosture: UnderwritingPosture;
  /** How aggressively to project concession burn-off. */
  concessionStrategy: ConcessionStrategy;
  /** Lease-up marketing spend assumption. */
  marketingIntensity: MarketingIntensity;
  /** Controllable expense growth — independent of insurance/tax jurisdiction models. */
  expenseGrowthPosture: ExpenseGrowthPosture;
  /** Additional haircut on rent growth Y1-Y3, in basis points (e.g. 25 = -0.25%). */
  stressRentGrowthHaircut: number;
  /** Additional widening of exit cap rate, in basis points (e.g. 50 = +0.50%). */
  stressExitCapWiden: number;
  /** Additional vacancy floor added on top of posture-derived floor, in percentage points. */
  stressVacancyFloor: number;
  /** True when all values are platform-derived defaults (operator has not touched this deal). */
  defaulted: boolean;
  /**
   * Provenance: operator = explicit choice, platform_default = no data,
   * agent_inferred = Cashflow Agent observed signals and suggested these values.
   */
  setBy?: SetBy;
  /** ISO timestamp of last operator edit. */
  updatedAt: string;
}

/** Partial input for PATCH /stance — any subset of fields can be provided. */
export type OperatorStancePatch = Partial<Omit<OperatorStance, 'defaulted' | 'updatedAt'>>;

export interface AffectedStanceField {
  fieldPath: string;
  deltaBps: number;
  trace: string;
}
