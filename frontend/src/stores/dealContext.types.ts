// ============================================================================
// JEDI RE — DealContext: Single Source of Truth Type System
// ============================================================================
//
// ARCHITECTURE PRINCIPLE:
// Every module reads from and writes to the same DealContext object held in
// dealStore (Zustand). No module owns its own copy of deal data.
//
// KEYSTONE PATTERN:
// For Development deals, the selectedDevelopmentPathId is the keystone.
// Changing it cascades through: unitMix → proforma → strategy → scores.
// The store exposes a `selectDevelopmentPath(pathId)` action that triggers
// this full recomputation chain.
//
// THREE-LAYER COLLISION:
// Every mutable field carries { value, source, updatedAt, confidence }.
// Resolution order: user > platform > broker.
// ============================================================================

// ---------------------------------------------------------------------------
// Layer metadata — tracks provenance of every data point
// ---------------------------------------------------------------------------

export type DataSource = 'broker' | 'platform' | 'user' | 'agent' | 'computed';

export interface LayeredValue<T> {
  /** The resolved value (what modules should render) */
  value: T;
  /** Who set this value */
  source: DataSource;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** 0-1 confidence score (1 = verified, 0.5 = estimated, 0 = unknown) */
  confidence: number;
  /** Preserved original layers for collision display */
  layers?: {
    broker?: { value: T; updatedAt: string; confidence: number };
    platform?: { value: T; updatedAt: string; confidence: number };
    user?: { value: T; updatedAt: string; confidence: number };
  };
}

/** Helper: create a simple layered value (used during hydration) */
export function layered<T>(
  value: T,
  source: DataSource = 'broker',
  confidence: number = 0.5
): LayeredValue<T> {
  return { value, source, updatedAt: new Date().toISOString(), confidence };
}

// ---------------------------------------------------------------------------
// Deal identity & classification
// ---------------------------------------------------------------------------

export type DealMode = 'existing' | 'development';
export type DealStage =
  | 'lead'
  | 'screening'
  | 'loi'
  | 'due_diligence'
  | 'under_contract'
  | 'closed'
  | 'passed'
  | 'dead';

export interface DealIdentity {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  parcelIds: string[];
  /** Lat/lng for map centering */
  coordinates: { lat: number; lng: number };
  /** Existing acquisition vs ground-up development */
  mode: DealMode;
  stage: DealStage;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Zoning (M02) — upstream constraint for everything
// ---------------------------------------------------------------------------

export interface ZoningContext {
  designation: LayeredValue<string>;          // e.g. "MRC-3"
  maxDensity: LayeredValue<number>;           // units per acre
  maxHeight: LayeredValue<number>;            // feet
  maxFAR: LayeredValue<number>;               // floor area ratio
  maxLotCoverage: LayeredValue<number>;       // percentage
  setbacks: LayeredValue<{
    front: number;
    side: number;
    rear: number;
  }>;
  parkingRatio: LayeredValue<number>;         // spaces per unit
  guestParkingRatio: LayeredValue<number>;    // additional guest spaces/unit
  /** Municode or municipal source URL */
  sourceUrl: string | null;
  /** Confidence in zoning interpretation */
  verified: boolean;
  /** Overlay districts, special area plans, etc. */
  overlays: string[];
}

// ---------------------------------------------------------------------------
// Development Paths (M03) — THE KEYSTONE for development deals
// ---------------------------------------------------------------------------

export type BuildingType =
  | 'garden'        // 1-3 stories, surface parking
  | 'wrap'          // 4-5 stories, wrapped parking
  | 'midrise'       // 5-8 stories, podium parking
  | 'highrise'      // 9+ stories, structured parking
  | 'townhome'      // attached units
  | 'mixed_use';    // ground-floor retail + residential above

export interface DevelopmentPath {
  /** Unique ID for this path — the key used in selectedDevelopmentPathId */
  id: string;
  /** Display name: e.g. "5-Story Wrap — 220 Units" */
  name: string;
  /** Who generated this path */
  generatedBy: 'massing_ai' | 'user' | 'agent' | 'template';
  /** Building configuration */
  buildingType: BuildingType;
  stories: number;
  /** Total buildable GFA in square feet */
  grossFloorArea: number;
  /** Net residential square feet (after corridors, mechanical, etc.) */
  netResidentialSF: number;
  /** Total unit count for this path */
  totalUnits: number;
  /** The unit mix program this path produces */
  unitMixProgram: UnitMixRow[];
  /** Parking spaces provided */
  parkingSpaces: number;
  parkingType: 'surface' | 'structured' | 'podium' | 'underground' | 'tuck_under';
  /** Amenity SF allocation */
  amenitySF: number;
  /** Ground-floor retail SF (mixed-use only) */
  retailSF: number;
  /** Estimated construction cost */
  constructionCost: {
    hardCostPerSF: number;
    softCostPct: number;        // % of hard costs
    totalHardCost: number;
    totalSoftCost: number;
    landCost: number;
    totalDevelopmentCost: number;
    costPerUnit: number;
  };
  /** Estimated timeline */
  timeline: {
    entitlementMonths: number;
    constructionMonths: number;
    leaseUpMonths: number;
    totalMonths: number;
  };
  /** Zoning compliance status */
  zoningCompliance: {
    densityUsed: number;        // % of max density consumed
    heightUsed: number;         // % of max height consumed
    farUsed: number;            // % of max FAR consumed
    lotCoverageUsed: number;    // % of max lot coverage consumed
    parkingMet: boolean;
    setbacksMet: boolean;
    requiresVariance: boolean;
    varianceNotes: string | null;
  };
  /** M03 massing geometry (for 3D renderer) */
  massingResult?: {
    boxes: Array<{
      x: number; y: number; z: number;
      width: number; depth: number; height: number;
      use: 'residential' | 'parking' | 'retail' | 'amenity';
    }>;
  };
}

// ---------------------------------------------------------------------------
// Unit Mix Program — shared by M01, M-PIE, M03, M09
// ---------------------------------------------------------------------------

export type UnitType = 'studio' | '1br' | '1br_den' | '2br' | '2br_den' | '3br' | '4br';

export interface UnitMixRow {
  id: string;
  unitType: UnitType;
  /** Display label: e.g. "1BR / 1BA" */
  label: string;
  count: number;
  avgSF: number;
  /** Target monthly rent */
  targetRent: LayeredValue<number>;
  /** Rent per SF (computed: targetRent / avgSF) */
  rentPerSF: number;
  /** Mix percentage (computed: count / totalUnits) */
  mixPct: number;
  /** Comp-derived market rent for this unit type */
  marketRent?: LayeredValue<number>;
  /** Premium or discount vs market */
  rentPremiumPct?: number;
}

// ---------------------------------------------------------------------------
// Property (for Existing deals — broker-provided)
// ---------------------------------------------------------------------------

export interface ExistingPropertyContext {
  yearBuilt: LayeredValue<number>;
  totalUnits: LayeredValue<number>;
  totalSF: LayeredValue<number>;
  /** Current unit mix (broker-stated, platform may override) */
  unitMixProgram: UnitMixRow[];
  occupancy: LayeredValue<number>;
  currentNOI: LayeredValue<number>;
  askingPrice: LayeredValue<number>;
  pricePerUnit: number;                 // computed
  goingInCapRate: number;               // computed: NOI / price
  /** Last renovation year, if any */
  lastRenovated: LayeredValue<number | null>;
  /** Property class assessment */
  propertyClass: LayeredValue<'A' | 'B+' | 'B' | 'B-' | 'C' | 'D'>;
  /** Amenities present */
  amenities: string[];
}

// ---------------------------------------------------------------------------
// Site (shared by both modes)
// ---------------------------------------------------------------------------

export interface SiteContext {
  /** Gross site area in acres */
  acreage: LayeredValue<number>;
  /** Usable/buildable area after setbacks, easements, etc. */
  buildableAcreage: LayeredValue<number>;
  /** GeoJSON polygon of property boundary */
  boundary: GeoJSON.Polygon | null;
  /** Trade area definition (if set) */
  tradeArea?: {
    method: 'radius' | 'drivetime' | 'custom';
    radiusMiles?: number;
    driveTimeMinutes?: number;
    geometry?: GeoJSON.Polygon;
  };
  /** Environmental or physical constraints */
  constraints: string[];
  /** Flood zone designation */
  floodZone: LayeredValue<string | null>;
}

// ---------------------------------------------------------------------------
// Market Intelligence (M05)
// ---------------------------------------------------------------------------

export interface MarketContext {
  submarketName: string;
  submarketId: string;
  /** Key market stats */
  avgRent: LayeredValue<number>;
  avgOccupancy: LayeredValue<number>;
  rentGrowthYoY: LayeredValue<number>;
  /** Absorption rate (units/month absorbed in submarket) */
  absorptionRate: LayeredValue<number>;
  /** Median household income */
  medianHHI: LayeredValue<number>;
  /** Population growth rate */
  popGrowthPct: LayeredValue<number>;
  /** Employment growth rate */
  employmentGrowthPct: LayeredValue<number>;
}

// ---------------------------------------------------------------------------
// Supply Pipeline (M04)
// ---------------------------------------------------------------------------

export interface SupplyContext {
  /** Total pipeline units within trade area */
  pipelineUnits: LayeredValue<number>;
  /** Supply pressure ratio: pipeline / (existing × absorption) */
  supplyPressureRatio: number;          // computed
  /** Months of supply: pipeline / monthly_absorption */
  monthsOfSupply: number;               // computed
  /** Individual pipeline projects */
  projects: Array<{
    id: string;
    name: string;
    units: number;
    status: 'permitted' | 'under_construction' | 'delivered';
    expectedDelivery: string;
    distanceMiles: number;
    threatScore: 'high' | 'medium' | 'low';
  }>;
}

// ---------------------------------------------------------------------------
// Financial / ProForma (M09)
// ---------------------------------------------------------------------------

export interface FinancialContext {
  /** Assumptions that drive the model — each is layered for collision */
  assumptions: {
    rentGrowth: LayeredValue<number>;     // annual %
    expenseGrowth: LayeredValue<number>;  // annual %
    vacancy: LayeredValue<number>;        // stabilized vacancy %
    exitCapRate: LayeredValue<number>;    // terminal cap rate
    holdPeriod: LayeredValue<number>;     // years
    capexPerUnit: LayeredValue<number>;   // renovation budget (existing)
    managementFee: LayeredValue<number>;  // % of EGI
  };
  /** ProForma outputs (computed from assumptions + unit mix) */
  outputs?: {
    grossPotentialRent: number;
    effectiveGrossIncome: number;
    totalOpEx: number;
    noi: number;
    noiMargin: number;
    irr: number | null;
    equityMultiple: number | null;
    cashOnCash: number | null;
    /** For development: yield on cost */
    yieldOnCost?: number;
    /** For development: development spread (YOC - exit cap) */
    developmentSpread?: number;
  };
}

// ---------------------------------------------------------------------------
// Capital Structure (M11)
// ---------------------------------------------------------------------------

export interface CapitalContext {
  /** Total capitalization */
  totalCapital: LayeredValue<number>;
  /** Debt stack */
  debt: Array<{
    id: string;
    name: string;                         // "Senior Construction Loan", "Perm Loan"
    amount: number;
    ltv: number;
    rate: LayeredValue<number>;
    termYears: number;
    amortizationYears: number;
    ioPeriodMonths: number;
    lender?: string;
  }>;
  /** Equity stack */
  equity: Array<{
    id: string;
    name: string;                         // "GP Equity", "LP Equity"
    amount: number;
    preferredReturn: number;
    promoteSplits: Array<{ above: number; gpShare: number; lpShare: number }>;
  }>;
  /** Computed LTV, DSCR */
  metrics?: {
    totalLTV: number;
    dscr: number;
    debtYield: number;
  };
}

// ---------------------------------------------------------------------------
// Strategy Arbitrage (M08)
// ---------------------------------------------------------------------------

export type StrategyType = 'bts' | 'flip' | 'rental' | 'str';

export interface StrategyScore {
  strategy: StrategyType;
  label: string;                          // "Build-to-Sell", "Flip", "Rental", "STR/Airbnb"
  score: number;                          // 0-100
  /** Signal breakdown feeding this score */
  signals: {
    demand: number;
    supply: number;
    momentum: number;
    position: number;
    risk: number;
  };
  /** Estimated returns for this strategy */
  projectedIRR: number | null;
  projectedEquityMultiple: number | null;
  /** Key risk flags specific to this strategy */
  riskFlags: string[];
  /** Is this strategy feasible given zoning/site? */
  feasible: boolean;
  feasibilityNotes: string | null;
}

export interface StrategyContext {
  /** All four strategies scored */
  scores: StrategyScore[];
  /** Which strategy the user/platform selected */
  selectedStrategy: LayeredValue<StrategyType>;
  /** Arbitrage gap: max score - min score among feasible strategies */
  arbitrageGap: number;
  /** Alert when gap > 15 points */
  arbitrageAlert: boolean;
  /** The "verdict" sentence */
  verdict: string;
}

// ---------------------------------------------------------------------------
// JEDI Score (M25)
// ---------------------------------------------------------------------------

export interface JEDIScoreContext {
  /** Composite score 0-100 */
  overall: number;
  /** Five master signals */
  demand: number;     // weight: 0.30
  supply: number;     // weight: 0.25
  momentum: number;   // weight: 0.20
  position: number;   // weight: 0.15
  risk: number;       // weight: 0.10 (inverted: high risk = low score)
  /** Score 30 days ago for delta display */
  score30dAgo: number | null;
  /** Data completeness driving confidence */
  confidence: number;
  /** Verdict string */
  verdict: 'Strong Opportunity' | 'Opportunity' | 'Neutral' | 'Caution' | 'Avoid';
}

// ---------------------------------------------------------------------------
// Risk (M14)
// ---------------------------------------------------------------------------

export interface RiskContext {
  /** Overall risk score 0-100 */
  overall: number;
  categories: {
    supply: number;
    demand: number;
    regulatory: number;
    market: number;
    execution: number;
    climate: number;
  };
  /** Top risk with detail */
  topRisk: {
    category: string;
    score: number;
    detail: string;
    mitigationAvailable: boolean;
  };
}

// ============================================================================
// THE DEAL CONTEXT — the single object in dealStore
// ============================================================================

export interface DealContext {
  /** Deal identity — always present */
  identity: DealIdentity;

  /** Project type for deal-type-driven visibility and configuration */
  projectType: 'existing' | 'development' | 'redevelopment';

  /** Product type for strategy and financial model adaptation */
  productType: 'mf_garden' | 'mf_wrap' | 'mf_midrise' | 'mf_highrise' | 'mf_townhome' | 'office' | 'retail' | 'industrial' | 'hospitality' | 'mixed_use';

  /** Site information — always present */
  site: SiteContext;

  /** Zoning constraints — always present, drives dev capacity */
  zoning: ZoningContext;

  /**
   * Zoning Agent typed output — written by the Zoning Agent when analysis
   * completes. All downstream modules (DevelopmentCapacity, ProForma, 3D,
   * Strategy, Risk) should read from here rather than from raw agent results.
   *
   * Import the ZoningOutput type from types/zoning.types.ts.
   * Null until the Zoning Agent has run for this deal.
   */
  zoningOutput: import('../types/zoning.types').ZoningOutput | null;

  // ─── MODE-SPECIFIC: DEVELOPMENT ───────────────────────────

  /**
   * DEVELOPMENT PATH SYSTEM (development mode only)
   *
   * This is THE KEYSTONE for development deals.
   *
   * Flow:
   *   1. M03 (or AI agent) generates multiple DevelopmentPaths
   *   2. Each path includes its own unitMixProgram, costs, timeline
   *   3. User selects one via selectedDevelopmentPathId
   *   4. dealStore.selectDevelopmentPath(pathId) triggers cascade:
   *      - resolvedUnitMix updates to selected path's program
   *      - financial.assumptions adjust (construction costs, timeline)
   *      - strategy scores recompute (BTS feasibility changes per path)
   *      - JEDI score updates
   *   5. ALL modules re-render from the same resolved state
   *
   * If no path is selected, the first path is used as default.
   * For existing deals, developmentPaths is empty and
   * resolvedUnitMix comes from existingProperty.unitMixProgram.
   */
  developmentPaths: DevelopmentPath[];
  selectedDevelopmentPathId: string | null;

  // ─── MODE-SPECIFIC: EXISTING ──────────────────────────────

  /** Existing property data (existing mode only) */
  existingProperty: ExistingPropertyContext | null;

  // ─── RESOLVED STATE (computed from mode + selection) ──────

  /**
   * THE RESOLVED UNIT MIX
   *
   * This is what every module reads. It's computed, not stored directly.
   *
   * Resolution logic:
   *   - Development mode: selectedPath.unitMixProgram
   *     (with user overrides from M-PIE applied on top)
   *   - Existing mode: existingProperty.unitMixProgram
   *     (with user overrides from M-PIE applied on top)
   *
   * User overrides are tracked separately in unitMixOverrides.
   * The resolved mix merges base + overrides.
   */
  resolvedUnitMix: UnitMixRow[];

  /**
   * User-level overrides to the unit mix (from M-PIE edits).
   * Keyed by UnitMixRow.id → partial override fields.
   * Applied on top of the base program from path or existing property.
   */
  unitMixOverrides: Record<string, Partial<Pick<UnitMixRow, 'count' | 'avgSF' | 'targetRent'>>>;

  /** Total unit count (computed from resolvedUnitMix) */
  totalUnits: number;

  // ─── INTELLIGENCE LAYERS ──────────────────────────────────

  market: MarketContext;
  supply: SupplyContext;
  financial: FinancialContext;
  capital: CapitalContext;
  strategy: StrategyContext;
  scores: JEDIScoreContext;
  risk: RiskContext;

  // ─── METADATA ─────────────────────────────────────────────

  /** Data freshness tracker — which modules have been hydrated */
  hydrationStatus: Record<string, {
    hydrated: boolean;
    lastFetchedAt: string | null;
    source: 'cache' | 'live' | 'mock';
  }>;

  /** Pipeline stage timestamps */
  stageHistory: Array<{
    stage: DealStage;
    enteredAt: string;
    exitedAt: string | null;
  }>;
}

// ============================================================================
// RESOLUTION HELPERS
// ============================================================================

/**
 * Get the currently selected development path (or null).
 */
export function getSelectedPath(ctx: DealContext): DevelopmentPath | null {
  if (!ctx.selectedDevelopmentPathId || ctx.developmentPaths.length === 0) {
    return ctx.developmentPaths[0] ?? null;
  }
  return (
    ctx.developmentPaths.find((p) => p.id === ctx.selectedDevelopmentPathId) ??
    ctx.developmentPaths[0] ??
    null
  );
}

/**
 * Compute the resolved unit mix from base program + user overrides.
 * This is the function dealStore calls whenever path selection or overrides change.
 */
export function resolveUnitMix(
  baseProgram: UnitMixRow[],
  overrides: Record<string, Partial<Pick<UnitMixRow, 'count' | 'avgSF' | 'targetRent'>>>
): UnitMixRow[] {
  const totalUnits = baseProgram.reduce((sum, row) => {
    const override = overrides[row.id];
    return sum + (override?.count ?? row.count);
  }, 0);

  return baseProgram.map((row) => {
    const override = overrides[row.id];
    const count = override?.count ?? row.count;
    const avgSF = override?.avgSF ?? row.avgSF;
    const targetRent = override?.targetRent
      ? { ...row.targetRent, value: override.targetRent, source: 'user' as DataSource, updatedAt: new Date().toISOString() }
      : row.targetRent;

    return {
      ...row,
      count,
      avgSF,
      targetRent,
      rentPerSF: targetRent.value / avgSF,
      mixPct: totalUnits > 0 ? count / totalUnits : 0,
    };
  });
}

/**
 * Resolve a LayeredValue — returns the highest-priority layer's value.
 * Priority: user > platform > broker
 */
export function resolveLayered<T>(lv: LayeredValue<T>): T {
  if (lv.layers?.user) return lv.layers.user.value;
  if (lv.layers?.platform) return lv.layers.platform.value;
  if (lv.layers?.broker) return lv.layers.broker.value;
  return lv.value;
}
