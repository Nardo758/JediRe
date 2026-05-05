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
  // Optional — used for jurisdiction_unmapped event emission when state is unmapped
  dealId?: string | null;
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
  /** County-level surtax on deed stamp (Miami-Dade $0.45/$100). Null for all other jurisdictions. */
  countySurtaxAmount?: number | null;
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
 * SectionCForecast — federal income tax & depreciation results.
 * Computed by taxService.forecast() using the federal ruleset and rate sheet.
 * Maps directly onto the `taxes.incomeTax` shape sent to the frontend.
 */
export interface SectionCForecast {
  /** Land allocation fraction used (e.g. 0.20 = 20% land / 80% improvement) */
  landAllocationPct: number;
  /** Depreciable basis = purchasePrice × (1 - landAllocationPct) */
  depreciableBase: number | null;
  /** Annual straight-line depreciation = depreciableBase / depreciationLife */
  annualDepreciation: number | null;
  /** Bonus depreciation percentage for the placed-in-service year (e.g. 0.20 for 2026) */
  bonusDepreciationCurrentYearPct: number;
  /** Fraction of depreciable basis eligible for cost segregation (0 when not eligible) */
  costSegAvailablePct: number;
  /** Federal income tax rate for the entity type, sourced from federal rate sheet */
  federalIncomeTaxRate: number;
  /** State income tax rate (0 for TX/FL; 5.39% for GA) */
  stateIncomeTaxRate: number;
  /** Combined effective rate = federalIncomeTaxRate + stateIncomeTaxRate */
  effectiveCombinedRate: number;
  /** Whether this state conforms to the federal bonus depreciation schedule (GA: false) */
  conformsToBonusDep: boolean;
  /** Whether this state conforms to federal cost segregation treatment */
  conformsToCostSeg: boolean;
}

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
  /**
   * True when state (and optionally county) resolved to a specific ruleset.
   * False when the default fallback ruleset is used (unknown/unsupported jurisdiction).
   * Callers may emit a `jurisdiction_unmapped` event when this is false.
   */
  jurisdictionMapped: boolean;
  /** Forecast confidence level. 'high' = county overlay; 'medium' = state only; 'low' = default fallback. */
  confidence: 'high' | 'medium' | 'low';

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

  /**
   * Section C — Federal income tax & depreciation forecast.
   * Always populated by taxService.forecast() using the federal ruleset.
   * Additive field — callers that don't read it are unaffected.
   */
  sectionC: SectionCForecast;

  /**
   * Phase 4 provenance — optional LayeredValue wrappers for key numeric outputs.
   * Populated when buildTaxContext() is used (Phase 4+). Undefined when the
   * caller builds TaxContext manually without provenance tracking (backward compat).
   * Existing callers that don't read this field are completely unaffected.
   */
  provenance?: TaxForecastProvenance;
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

// ── Phase 4: LayeredValue provenance wrapper ──────────────────────────────────

/**
 * LayeredValue<T> — wraps any tax output field with source provenance and
 * audit metadata. Callers that only need the raw value read `.value`.
 * The F9 UI and audit trail consumers read the full object.
 */
export interface LayeredValue<T> {
  /** The computed or fetched value. Mirrors the corresponding raw field on TaxForecast. */
  value: T;
  /**
   * Origin of the value:
   *   'tax_bill_pdf'        — parsed from an uploaded tax bill PDF (highest trust)
   *   'attom'               — fetched from ATTOM property detail API
   *   'county_adapter'      — fetched from a direct county PA adapter
   *   'live_millage_service'— TX Comptroller live rates
   *   'tax_service_computed'— derived by taxService.forecast() from ruleset + context
   *   'user_override'       — explicit user-supplied override
   *   'fallback'            — purchase price or ruleset default used (low confidence)
   */
  source: string;
  metadata: {
    /** Ruleset jurisdiction + year used to compute this value, e.g. "FL-2026". */
    ruleset_version?: string;
    /** Human-readable formula trace, e.g. "$50,000,000 × 1.05% doc stamp". */
    formula?: string;
    /** Named inputs consumed by this calculation with their own sources. */
    inputs?: Record<string, { value: unknown; source: string }>;
    /** Confidence level of this specific value. */
    confidence: 'high' | 'medium' | 'low';
    /** ISO timestamp when this value was computed / fetched. */
    computed_at: string;
  };
}

// ── Phase 4: NormalizedParcel from PropertyAppraiserFetcher ───────────────────

/**
 * NormalizedParcel — canonical parcel record returned by any PropertyAppraiserFetcher tier.
 * All monetary fields are in USD. Millage rate is in mills (per $1,000 of assessed value).
 */
export interface NormalizedParcel {
  parcel_id: string;
  state: string;
  county: string | null;
  /** Market / just value (ATTOM: marketValue / marketValueNational). */
  just_value: number | null;
  /** Taxable assessed value after exemptions. */
  assessed_value: number | null;
  land_value: number | null;
  improvement_value: number | null;
  /** Total exemptions applied (homestead + SOH benefit + other). */
  exemptions_total: number | null;
  /** Aggregate millage rate if provided by the data source (mills per $1,000). */
  millage_rate: number | null;
  /** Annual tax bill amount for the tax_year. */
  annual_tax: number | null;
  tax_year: number | null;
  /** ISO date string of last data update from the source (ATTOM: lastUpdated). */
  last_updated: string | null;
  /** Days elapsed since last_updated. Null when last_updated is unknown. */
  staleness_days: number | null;
  /** Which tier/source provided this record. */
  source: 'attom' | 'tax_bill_pdf' | 'county_adapter' | 'manual';
}

/**
 * PropertyAppraiserResult — output of PropertyAppraiserFetcher.fetch().
 * Tier numbering matches spec §8:
 *   Tier 1 = tax bill PDF parser
 *   Tier 2 = ATTOM
 *   Tier 3 = placeholder county adapter
 *   Tier 4 = null / fallback
 */
export interface PropertyAppraiserResult {
  parcel: NormalizedParcel | null;
  confidence: 'high' | 'medium' | 'low';
  tier: 1 | 2 | 3 | 4;
  tier_label: 'tax_bill_pdf' | 'attom' | 'county_adapter' | 'fallback';
  warnings: string[];
}

// ── Phase 4: TaxForecastProvenance ────────────────────────────────────────────

/**
 * TaxForecastProvenance — additive companion to TaxForecast carrying LayeredValue
 * wrappers for key numeric outputs. Callers that don't need provenance can ignore this.
 */
export interface TaxForecastProvenance {
  computed_at: string;
  /** E.g. "FL-2026" or "TX-2026" — jurisdiction + year of active ruleset. */
  ruleset_version: string;
  /** Source label for the parcel data used. Null when ATTOM was not called. */
  parcel_source: string | null;
  parcel_confidence: 'high' | 'medium' | 'low' | null;
  assessed_value: LayeredValue<number | null>;
  millage_rate: LayeredValue<number | null>;
  platform_annual_tax: LayeredValue<number | null>;
  state_income_tax_rate: LayeredValue<number>;
  tpp_exemption_amount: LayeredValue<number>;
}

// ── County Overlay ────────────────────────────────────────────────────────────

/**
 * CountyOverlayRuleset — extends TaxRuleset with a county-level surtax method.
 *
 * County overlays delegate all methods to their parent state ruleset except:
 *   - annualPropertyTax() → uses county-specific millage from the rate sheet
 *   - countySurtax()      → county deed stamp surtax (Miami-Dade only; others return null)
 *
 * Used by the three-layer resolver stack: { federal, state, county }.
 */
export interface CountyOverlayRuleset extends TaxRuleset {
  /**
   * Additional county-level surtax applied to deed stamps at acquisition or disposition.
   * Currently only Miami-Dade implements this ($0.45/$100 = 0.45%).
   * Returns null for all other county overlays (no surtax).
   */
  countySurtax(salePrice: number): number | null;
}

// ── Three-layer resolver stack ────────────────────────────────────────────────

/**
 * RulesetStack — result of resolveRulesetStack().
 *
 * taxService.forecast() composes this stack per the Section composition rules:
 *   - county (if present): provides millage override for Section A
 *   - state:               owns Section A cap logic, Section B (TPP), Section D transfer tax
 *   - federal:             owns Section C (income tax & depreciation)
 */
export interface RulesetStack {
  federal: TaxRuleset;
  state: TaxRuleset;
  /** Null when no county overlay is registered for the resolved state + county. */
  county: CountyOverlayRuleset | null;
  /**
   * True when the state resolved to a specific ruleset (FL, GA, TX).
   * False when the default fallback ruleset is used (unknown/unsupported jurisdiction).
   * Callers should emit a `jurisdiction_unmapped` event when this is false.
   */
  jurisdictionMapped: boolean;
}
