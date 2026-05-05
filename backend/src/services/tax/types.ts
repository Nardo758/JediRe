/**
 * Tax Service — Type Contracts
 *
 * TaxRuleset: interface every jurisdiction ruleset implements.
 * TaxContext:  input to the ruleset (deal fields + user overrides).
 * TaxForecast: output of taxService.forecast() — maps directly to the
 *              `taxes.reTax` and `taxes.transferTax` sections of DealFinancials.
 *
 * Adding a new jurisdiction: create a new file in rulesets/, implement TaxRuleset,
 * and register it in resolver.ts. No other files need to change.
 */

export interface TaxContext {
  state: string;              // 'FL', 'TX', 'GA', '' (unknown)
  county: string | null;      // 'Miami-Dade', 'Harris', 'Fulton', 'DeKalb', etc.
  city: string | null;        // used by FL Miami-Dade detection
  purchasePrice: number | null;
  loanAmount: number | null;
  assessedValueOverride: number | null;  // user-supplied override
  millageRateOverride: number | null;    // user-supplied override
  countyOverride: boolean | null;        // FL: true=Miami-Dade, false=statewide
  units: number;
  t12AnnualTax: number | null;
  holdYears: number;
  isRefi: boolean;
  refiEnabled: boolean;
  refiTriggerYear: number;
  refiNewLoanType: string | null;
}

export interface ReTaxYear {
  year: number;
  assessedValue: number;
  /**
   * Internal unrounded assessed value — used by taxService to carry forward the exact
   * cap-limited baseline to the next year, avoiding cumulative rounding drift in
   * jurisdictions with an annual assessment cap (e.g. FL SOH cap).
   * Display always uses the rounded `assessedValue`; callers outside taxService should ignore this.
   */
  _rawAssessedValue?: number;
  millageRate: number;
  taxAmount: number;
  sohCapBinding: boolean;
  reassessmentEvent: boolean;
}

export interface SpecialTax {
  name: string;
  description: string;
  amount: number;
  trigger: 'acquisition' | 'annual' | 'disposition' | 'refi';
}

export interface AbatementProgram {
  name: string;
  description: string;
  estimatedAnnualSavings: number | null;
  eligibilityUrl: string | null;
}

export interface TransferTaxResult {
  isMiamiDade: boolean;
  miamiDadeRatePct: number;
  statewideFlatRatePct: number;
  appliedRatePct: number;
  docStampAmount: number | null;
  intangibleTaxAmount: number | null;
  loanAmount: number | null;
  totalTransferTax: number | null;
  refi: {
    enabled: boolean;
    triggerYear: number;
    newLoanType: string | null;
    refiLoanAmount: number | null;
    refiDocStampAmount: number | null;
    refiIntangibleTaxAmount: number | null;
    refiTotalTax: number | null;
  } | null;
}

/**
 * TaxForecast — output of taxService.forecast().
 *
 * Structured to map directly onto the existing `taxes.reTax` and
 * `taxes.transferTax` sections of DealFinancials without contract changes.
 */
export interface TaxForecast {
  jurisdiction: string;
  rulesetUsed: string;
  /** Human-readable county label, e.g. "Fulton County" / "Miami-Dade County" / null for statewide */
  countyLabel: string | null;
  /** Annual assessment growth rate used by this ruleset (0 = no cap / full reassessment each year) */
  assessmentGrowthPct: number;

  reTax: {
    t12AssessedValue: number | null;
    t12MillageRate: number | null;
    t12AnnualTax: number | null;
    platformAssessedValue: number | null;
    platformAnnualTax: number | null;
    isMiamiDade: boolean;
    sohCapPct: number;
    perYear: ReTaxYear[];
    deltaVsT12Pct: number | null;
  };

  transferTax: TransferTaxResult;

  specialTaxes: SpecialTax[];
  abatementPrograms: AbatementProgram[];
}

/**
 * TaxRuleset — every ruleset file implements this interface.
 *
 * Conventions:
 * - annualPropertyTax() is called once per hold year (year=1 is acquisition year)
 * - acquisitionTransferTax() and refiTransferTax() are called once per run
 * - All methods are synchronous and deterministic — no I/O, no LLM calls
 */
export interface TaxRuleset {
  readonly jurisdiction: string;

  /**
   * Annual RE tax for a given year. Year 1 = acquisition year (reassessment fires).
   * Returns full per-year record including soh cap flag.
   */
  annualPropertyTax(
    ctx: TaxContext,
    year: number,
    prevAssessedValue: number,
  ): ReTaxYear;

  /**
   * Transfer taxes due at acquisition (doc stamps, deed recording, etc.)
   */
  acquisitionTransferTax(ctx: TaxContext): TransferTaxResult;

  /**
   * Transfer taxes due at disposition. Returns total amount.
   */
  dispositionTransferTax(salePrice: number, ctx: TaxContext): number;

  /**
   * What happens to assessed value when property sells?
   * 'full' = reassessed to purchase price (FL, GA)
   * 'capped' = capped increase (some jurisdictions)
   * 'none' = no change (Prop 13 style)
   */
  reassessmentOnSale(ctx: TaxContext): 'full' | 'capped' | 'none';

  /**
   * Annual assessment cap percentage (e.g. 0.10 = 10% FL non-homestead cap).
   * null = no cap applies (most commercial properties outside FL).
   */
  annualAssessmentCap(): number | null;

  /**
   * One-off special taxes: FL intangible tax on mortgage, NYC mortgage recording tax, etc.
   */
  specialTaxes(ctx: TaxContext): SpecialTax[];

  /**
   * Known abatement / exemption programs. Returns [] if none applicable.
   */
  abatementEligibility(ctx: TaxContext): AbatementProgram[];

  /**
   * Fields that must be present in TaxContext for accurate calculation.
   */
  requiresInputs(): string[];

  /**
   * Hints for where to source the required inputs.
   */
  dataSourceHints(): string[];
}
