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
 *
 * Section B (TPP) and Section C (Income/Depreciation) methods were added in
 * Phase 1 of the Tax Service spec. Existing rulesets return safe defaults
 * until Phase 3 expansion populates correct values.
 */

// ── Supporting enumerations ────────────────────────────────────────────────────

export type AssetClass =
  | 'multifamily'
  | 'sfr'
  | 'retail'
  | 'office'
  | 'industrial'
  | 'hospitality';

export type EntityType =
  | 'individual'
  | 'pass_through'
  | 'c_corp'
  | 'reit'
  | 'partnership';

// ── Input contexts ──────────────────────────────────────────────────────────────

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
  // Section C inputs
  propertyType?: AssetClass;            // asset class — defaults to 'multifamily' when absent
  entityType?: EntityType;              // entity structure — defaults to 'pass_through'
  placedInServiceYear?: number;         // year building placed in service — defaults to current year
  landAllocationPct?: number;           // fraction of price allocated to land (non-depreciable); default 0.20
}

/**
 * TPPContext — subset of TaxContext plus TPP-specific fields.
 * Used by Section B (Tangible Personal Property) methods.
 */
export interface TPPContext {
  state: string;
  county: string | null;
  purchasePrice: number | null;
  units: number;
  ffEAssessedValue: number | null;     // FF&E assessed value; null = use platform estimate
  ffEAgeYears: number;                  // weighted average age of furniture/appliances
  ffEFilingStatus: 'filed' | 'waived' | 'not_filed';
}

// ── Section B supporting types ────────────────────────────────────────────────

export interface TPPFiling {
  formName: string;       // e.g. 'DR-405' (FL), 'Rendition Form 50-144' (TX)
  deadline: string;       // e.g. 'April 1' (FL), 'April 15' (TX)
  penaltyPct: number;     // penalty for late filing as a fraction (e.g. 0.25 = 25%)
}

export interface TPPDepTable {
  years: number;          // depreciation schedule length
  residualPct: number;    // residual value fraction after full depreciation
  annualRatePct: number;  // straight-line annual depreciation rate
}

// ── Section C supporting types ────────────────────────────────────────────────

export interface CostSegRanges {
  personalPropertyPct: number;    // fraction of building basis typically reclassified as 5/7yr
  landImprovementPct: number;     // fraction reclassified as 15yr
  buildingPct: number;            // fraction remaining as 27.5/39yr building
}

/**
 * TaxLineResult — output of a single tax computation method.
 * Carries formula trace and input provenance for the F9 UI and audit trail.
 */
export interface TaxLineResult {
  amount: number;
  formula: string;
  inputs: Record<string, { value: unknown; source: string }>;
  reassessmentEventInYear: boolean;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

// ── Section A/D existing types ─────────────────────────────────────────────────

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

export interface MillageLine {
  authority: string;            // 'Miami-Dade County', 'School Board', 'Water Mgmt'
  rate: number;                 // mills (per $1,000 of taxable value)
  appliesTo: 'all' | 'homestead' | 'non_homestead';
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

// ── TaxForecast output ─────────────────────────────────────────────────────────

/**
 * TaxForecast — output of taxService.forecast().
 *
 * Structured to map directly onto the existing `taxes.reTax` and
 * `taxes.transferTax` sections of DealFinancials without contract changes.
 * sectionC is additive — existing callers that don't read it are unaffected.
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

  /**
   * Section C — Income Tax & Depreciation.
   * Populated by the federal ruleset (Phase 2+). Fields are null until
   * the federal ruleset is wired in.
   */
  sectionC: {
    depreciableBase: number | null;
    annualDepreciation: number | null;
    bonusDepreciationCurrentYearPct: number;
    bonusDepreciationAmount: number | null;
    costSegAvailablePct: number;
    costSegEligible: boolean;
    stateIncomeTaxRate: number;
    conformsToBonusDep: boolean;
    conformsToCostSeg: boolean;
  } | null;

  specialTaxes: SpecialTax[];
  abatementPrograms: AbatementProgram[];
}

// ── TaxRuleset interface ───────────────────────────────────────────────────────

/**
 * TaxRuleset — every ruleset file implements this interface.
 *
 * Conventions:
 * - annualPropertyTax() is called once per hold year (year=1 is acquisition year)
 * - acquisitionTransferTax() and refiTransferTax() are called once per run
 * - All methods are synchronous and deterministic — no I/O, no LLM calls
 *
 * Section B and C methods were added in Tax Service Phase 1.
 * Jurisdiction rulesets that don't yet implement full B/C logic return
 * safe defaults (taxesTPP→false, depreciationLife→27.5, etc.) until
 * Phase 3 expansion.
 */
export interface TaxRuleset {
  readonly jurisdiction: string;

  // ── Section A · Real Estate Tax ──────────────────────────────────────────────

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

  // ── Section B · Tangible Personal Property ───────────────────────────────────

  /**
   * Does this jurisdiction tax tangible personal property?
   * Returns false for jurisdictions that don't tax TPP or where TPP
   * is not yet modeled (safe default for Phase 1).
   */
  taxesTPP(): boolean;

  /**
   * Annual TPP tax for a given year.
   * Returns a zero TaxLineResult when taxesTPP() is false.
   */
  tppTax(ctx: TPPContext, year: number): TaxLineResult;

  /**
   * TPP filing exemption threshold in dollars.
   * Returns 0 when TPP is not taxed in this jurisdiction.
   */
  tppExemptionAmount(): number;

  /**
   * TPP millage rate (mills per $1,000 assessed).
   * Returns 0 when TPP is not taxed. Often equals RE millage ('same_as_re').
   */
  tppMillage(ctx: TaxContext): number;

  /**
   * TPP filing requirement details (form name, deadline, penalty).
   * Returns null when TPP is not taxed or no filing is required.
   */
  tppFilingRequirement(): TPPFiling | null;

  // ── Section C · Income Tax & Depreciation ────────────────────────────────────

  /**
   * Depreciation life for a given asset class (years).
   * Federal: 27.5 for multifamily/SFR, 39 for commercial.
   * State rulesets return 0 (not applicable at state level).
   * Phase 1 default: 27.5 for all asset classes.
   */
  depreciationLife(propertyType: AssetClass): number;

  /**
   * Federal bonus depreciation percentage for the given placed-in-service year.
   * Phase 1 default: 0 (will be correctly wired in Phase 2 via federal ruleset).
   * State rulesets return 0 here (federal owns bonus dep schedule).
   */
  bonusDepreciationPct(placedInServiceYear: number): number;

  /**
   * Is cost segregation available for this property type?
   * Phase 1 default: false. Federal ruleset sets true in Phase 2.
   */
  costSegEligible(propertyType: AssetClass): boolean;

  /**
   * State income tax rate for this entity type (fraction, e.g. 0.055 = 5.5%).
   * Federal ruleset returns 0 (federal income tax brackets are separate).
   * Phase 1 default: 0 (correct for TX; will be set for FL/GA in Phase 3).
   */
  stateIncomeTaxRate(entityType: EntityType): number;

  /**
   * Does this state conform to the federal bonus depreciation schedule?
   * Phase 1 default: true (conservative; GA will override to false in Phase 3).
   */
  conformsToBonusDep(): boolean;

  /**
   * Does this state conform to federal cost segregation treatment?
   * Phase 1 default: true.
   */
  conformsToCostSeg(): boolean;

  // ── Metadata ─────────────────────────────────────────────────────────────────

  /**
   * Fields that must be present in TaxContext for accurate calculation.
   */
  requiresInputs(): string[];

  /**
   * Hints for where to source the required inputs.
   */
  dataSourceHints(): string[];
}
