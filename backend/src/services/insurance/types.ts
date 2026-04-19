/**
 * Insurance Service — Type Contracts
 *
 * InsuranceRuleset: interface every jurisdiction ruleset implements.
 * InsuranceContext: inputs (deal fields + market context).
 * InsuranceForecast: output — per-unit benchmarks, components, escalation.
 *
 * Adding a new jurisdiction: create a new file in rulesets/, implement InsuranceRuleset,
 * and register it in resolver.ts.
 */

export interface InsuranceContext {
  state: string;
  county: string | null;
  city: string | null;
  units: number;
  yearBuilt: number | null;
  purchasePrice: number | null;
  replacementCostPerUnit: number | null;
  stories: number | null;
  constructionType: 'wood-frame' | 'masonry' | 'concrete' | 'steel' | null;
  isCoastal: boolean | null;     // FL: windstorm/flood exposure
  floodZone: string | null;      // FEMA flood zone designation
  t12InsuranceAnnual: number | null; // existing annual insurance from T-12
}

export interface InsuranceCoverage {
  name: string;
  description: string;
  estimatedAnnualCostPerUnit: number;
  required: boolean;
  notes: string | null;
}

export interface InsuranceEscalation {
  baseRate: number;     // decimal: e.g. 0.035 = 3.5%
  rationale: string;
  recentTrend: string;  // e.g. "FL market hardening: +20-30% past 3 years"
}

/**
 * InsuranceForecast — output of insuranceService.forecast().
 *
 * Primary consumer: CashFlow Agent (benchmarks T-12 insurance against market),
 * and proforma-adjustment.service.ts (populates insurance platform value when T-12 is absent).
 */
export interface InsuranceForecast {
  jurisdiction: string;
  rulesetUsed: string;

  benchmarkPerUnit: number;         // blended benchmark: all coverage types combined
  benchmarkAnnualTotal: number;     // benchmarkPerUnit × units
  components: InsuranceCoverage[];  // breakdown by coverage type

  escalation: InsuranceEscalation;

  t12PerUnit: number | null;        // actual T-12 from deal data (null if not provided)
  t12VsBenchmarkPct: number | null; // positive = operator spends more than benchmark

  flagLow: boolean;    // true if T-12 is >25% below benchmark (underinsured signal)
  flagHigh: boolean;   // true if T-12 is >50% above benchmark (investigate)
  flagNotes: string[];

  dataSourceHints: string[];
}

export interface InsuranceRuleset {
  readonly jurisdiction: string;

  /**
   * Annual benchmark insurance cost per unit for a typical multifamily property.
   * Returns all coverage components so callers can see the breakdown.
   */
  benchmarkPerUnit(ctx: InsuranceContext): InsuranceCoverage[];

  /**
   * Expected annual escalation for this jurisdiction.
   */
  escalationRate(ctx: InsuranceContext): InsuranceEscalation;

  /**
   * Fields required for a reliable benchmark.
   */
  requiresInputs(): string[];

  /**
   * Where to source the required inputs.
   */
  dataSourceHints(): string[];
}
