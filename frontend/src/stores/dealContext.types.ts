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

export type AlertLevel = 'none' | 'info' | 'warn' | 'block';

export type InputClass = 'identity' | 'override' | 'scope';

export interface LayeredValue<T> {
  /** The resolved value (what modules should render) */
  value: T;
  /** Who set this value */
  source: DataSource;
  /** Which layer the resolved value came from */
  resolvedFrom: 'broker' | 'platform' | 'user';
  /** ISO timestamp of last update */
  updatedAt: string;
  /** 0-1 confidence score (1 = verified, 0.5 = estimated, 0 = unknown) */
  confidence: number;
  /** Computed alert level for this field */
  alertLevel: AlertLevel;
  /** Whether the user has viewed/reviewed this value at least once */
  userReviewed: boolean;
  /** Preserved original layers for collision display */
  layers?: {
    broker?: { value: T; updatedAt: string; confidence: number; source?: string };
    platform?: { value: T; updatedAt: string; confidence: number; source?: string };
    user?: { value: T; updatedAt: string; confidence: number };
  };
}

/**
 * Compute alert level for a LayeredValue field.
 *
 * Rules:
 * - `block`: Identity input missing, OR confidence < 0.4 on a high-sensitivity field
 * - `warn`: Confidence 0.4–0.7, OR broker/platform divergence > 15%
 * - `info`: Confidence > 0.7 but user has never reviewed
 * - `none`: User has explicitly edited, OR confidence > 0.9 and user has viewed
 */
export function computeAlertLevel<T>(
  lv: LayeredValue<T>,
  opts?: { isIdentity?: boolean; highSensitivity?: boolean }
): AlertLevel {
  const isIdentity = opts?.isIdentity ?? false;
  const highSensitivity = opts?.highSensitivity ?? false;

  if (isIdentity && (lv.value === null || lv.value === undefined || lv.value === '')) return 'block';
  if (highSensitivity && lv.confidence < 0.4) return 'block';

  if (lv.resolvedFrom === 'user' || lv.source === 'user') return 'none';

  if (lv.confidence >= 0.9 && lv.userReviewed) return 'none';

  const broker = lv.layers?.broker;
  const platform = lv.layers?.platform;
  if (broker && platform && typeof broker.value === 'number' && typeof platform.value === 'number') {
    const denom = platform.value || 1;
    const divergence = Math.abs((broker.value - platform.value) / denom);
    if (divergence > 0.15) return 'warn';
  }

  if (lv.confidence <= 0.7) return 'warn';

  if (!lv.userReviewed) return 'info';

  return 'info';
}

/** Helper: create a simple layered value (used during hydration) */
export function layered<T>(
  value: T,
  source: DataSource = 'broker',
  confidence: number = 0.5
): LayeredValue<T> {
  const resolvedFrom: 'broker' | 'platform' | 'user' =
    source === 'user' ? 'user'
    : source === 'broker' ? 'broker'
    : 'platform';
  const now = new Date().toISOString();
  const lv: LayeredValue<T> = {
    value,
    source,
    resolvedFrom,
    updatedAt: now,
    confidence,
    alertLevel: 'none',
    userReviewed: source === 'user',
    layers: {
      [resolvedFrom]: { value, updatedAt: now, confidence },
    },
  };
  lv.alertLevel = computeAlertLevel(lv);
  return lv;
}

// ---------------------------------------------------------------------------
// Deal identity & classification
// ---------------------------------------------------------------------------

export type DealMode = 'existing' | 'development' | 'redevelopment';
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
  /** True when user overrides zoning fields — flags that a variance is assumed */
  varianceAssumed: boolean;
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

// ---------------------------------------------------------------------------
// Edit Log — audit trail for every assumption change
// ---------------------------------------------------------------------------

export interface EditLogEntry {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: string;
  actor: 'user' | 'agent' | 'platform';
  actorId?: string;
}

// ---------------------------------------------------------------------------
// Redevelopment Context — delta layer for redev deals
// ---------------------------------------------------------------------------

export interface RedevelopmentDelta {
  id: string;
  type: 'unit_reconfig' | 'amenity_add' | 'envelope_mod' | 'demo' | 'systems_upgrade';
  description: string;
  costEstimate: number;
  timelineMonths: number;
  impactOnUnits: number;
  impactOnRent: number;
}

export interface RedevelopmentContext {
  deltas: RedevelopmentDelta[];
  demoScope: 'none' | 'partial' | 'full';
  existingNOI: LayeredValue<number>;
  projectedNOI: LayeredValue<number>;
  nonConformingReview: boolean;
  varianceRequired: boolean;
  varianceNotes: string | null;
}

// ---------------------------------------------------------------------------
// Input Field Metadata — registry mapping field paths to their taxonomy
// ---------------------------------------------------------------------------

export interface InputFieldMeta {
  path: string;
  label: string;
  inputClass: InputClass;
  highSensitivity: boolean;
  appliesTo: Array<'existing' | 'development' | 'redevelopment'>;
  category: 'identity' | 'market' | 'cost' | 'capital' | 'exit' | 'site' | 'zoning';
}

export const INPUT_FIELD_REGISTRY: InputFieldMeta[] = [
  { path: 'identity.id', label: 'Deal ID', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.name', label: 'Deal Name', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.address', label: 'Address', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.city', label: 'City', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.state', label: 'State', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.zip', label: 'ZIP Code', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.county', label: 'County', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.coordinates', label: 'Coordinates', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.mode', label: 'Deal Type', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.stage', label: 'Deal Stage', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.createdAt', label: 'Created At', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },
  { path: 'identity.updatedAt', label: 'Updated At', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'identity' },

  { path: 'financial.assumptions.rentGrowth', label: 'Rent Growth', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'financial.assumptions.expenseGrowth', label: 'Expense Growth', inputClass: 'override', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'cost' },
  { path: 'financial.assumptions.vacancy', label: 'Vacancy Rate', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'financial.assumptions.exitCapRate', label: 'Exit Cap Rate', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'development', 'redevelopment'], category: 'exit' },
  { path: 'financial.assumptions.holdPeriod', label: 'Hold Period', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'development', 'redevelopment'], category: 'exit' },
  { path: 'financial.assumptions.capexPerUnit', label: 'CapEx per Unit', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'redevelopment'], category: 'cost' },
  { path: 'financial.assumptions.managementFee', label: 'Management Fee', inputClass: 'override', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'cost' },

  { path: 'site.acreage', label: 'Site Acreage', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'site' },
  { path: 'site.buildableAcreage', label: 'Buildable Acreage', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'site' },
  { path: 'site.floodZone', label: 'Flood Zone', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'site' },

  { path: 'zoning.designation', label: 'Zoning Designation', inputClass: 'scope', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'zoning' },
  { path: 'zoning.maxDensity', label: 'Max Density', inputClass: 'scope', highSensitivity: true, appliesTo: ['development', 'redevelopment'], category: 'zoning' },
  { path: 'zoning.maxHeight', label: 'Max Height', inputClass: 'scope', highSensitivity: false, appliesTo: ['development', 'redevelopment'], category: 'zoning' },
  { path: 'zoning.maxFAR', label: 'Max FAR', inputClass: 'scope', highSensitivity: true, appliesTo: ['development', 'redevelopment'], category: 'zoning' },
  { path: 'zoning.maxLotCoverage', label: 'Max Lot Coverage', inputClass: 'scope', highSensitivity: false, appliesTo: ['development', 'redevelopment'], category: 'zoning' },
  { path: 'zoning.setbacks', label: 'Setbacks', inputClass: 'scope', highSensitivity: false, appliesTo: ['development', 'redevelopment'], category: 'zoning' },
  { path: 'zoning.parkingRatio', label: 'Parking Ratio', inputClass: 'scope', highSensitivity: false, appliesTo: ['development', 'redevelopment'], category: 'zoning' },
  { path: 'zoning.guestParkingRatio', label: 'Guest Parking Ratio', inputClass: 'scope', highSensitivity: false, appliesTo: ['development', 'redevelopment'], category: 'zoning' },

  { path: 'existingProperty.askingPrice', label: 'Asking Price', inputClass: 'identity', highSensitivity: true, appliesTo: ['existing'], category: 'cost' },
  { path: 'existingProperty.totalUnits', label: 'Total Units', inputClass: 'identity', highSensitivity: true, appliesTo: ['existing'], category: 'identity' },
  { path: 'existingProperty.occupancy', label: 'Occupancy', inputClass: 'override', highSensitivity: true, appliesTo: ['existing'], category: 'market' },
  { path: 'existingProperty.currentNOI', label: 'Current NOI', inputClass: 'override', highSensitivity: true, appliesTo: ['existing'], category: 'cost' },
  { path: 'existingProperty.yearBuilt', label: 'Year Built', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing'], category: 'identity' },
  { path: 'existingProperty.totalSF', label: 'Total Square Footage', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing'], category: 'identity' },
  { path: 'existingProperty.propertyClass', label: 'Property Class', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing'], category: 'identity' },
  { path: 'existingProperty.lastRenovated', label: 'Last Renovated', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing'], category: 'identity' },

  { path: 'market.submarketName', label: 'Submarket', inputClass: 'identity', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'market.avgRent', label: 'Market Avg Rent', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'market.avgOccupancy', label: 'Market Avg Occupancy', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'market.rentGrowthYoY', label: 'Rent Growth YoY', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'market.absorptionRate', label: 'Absorption Rate', inputClass: 'override', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'market.medianHHI', label: 'Median Household Income', inputClass: 'override', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'market.popGrowthPct', label: 'Population Growth %', inputClass: 'override', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },
  { path: 'market.employmentGrowthPct', label: 'Employment Growth %', inputClass: 'override', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },

  { path: 'supply.pipelineUnits', label: 'Pipeline Units', inputClass: 'override', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },

  { path: 'capital.totalCapital', label: 'Total Capital', inputClass: 'override', highSensitivity: true, appliesTo: ['existing', 'development', 'redevelopment'], category: 'capital' },

  { path: 'strategy.selectedStrategy', label: 'Selected Strategy', inputClass: 'override', highSensitivity: false, appliesTo: ['existing', 'development', 'redevelopment'], category: 'market' },

  { path: 'redevelopment.demoScope', label: 'Demo Scope', inputClass: 'scope', highSensitivity: true, appliesTo: ['redevelopment'], category: 'cost' },
  { path: 'redevelopment.existingNOI', label: 'Existing NOI (Redev)', inputClass: 'override', highSensitivity: true, appliesTo: ['redevelopment'], category: 'cost' },
  { path: 'redevelopment.projectedNOI', label: 'Projected NOI (Redev)', inputClass: 'override', highSensitivity: true, appliesTo: ['redevelopment'], category: 'cost' },
  { path: 'redevelopment.varianceRequired', label: 'Variance Required', inputClass: 'scope', highSensitivity: true, appliesTo: ['redevelopment'], category: 'zoning' },
];

export function getFieldMeta(path: string): InputFieldMeta | undefined {
  return INPUT_FIELD_REGISTRY.find(f => f.path === path);
}

export function getFieldsForDealType(dealType: 'existing' | 'development' | 'redevelopment'): InputFieldMeta[] {
  return INPUT_FIELD_REGISTRY.filter(f => f.appliesTo.includes(dealType));
}

export function getIdentityFields(dealType: 'existing' | 'development' | 'redevelopment'): InputFieldMeta[] {
  return INPUT_FIELD_REGISTRY.filter(f => f.inputClass === 'identity' && f.appliesTo.includes(dealType));
}

export function getHighSensitivityFields(dealType: 'existing' | 'development' | 'redevelopment'): InputFieldMeta[] {
  return INPUT_FIELD_REGISTRY.filter(f => f.highSensitivity && f.appliesTo.includes(dealType));
}

// ============================================================================
// THE DEAL CONTEXT — discriminated union on projectType
// ============================================================================

type ProductType = 'mf_garden' | 'mf_wrap' | 'mf_midrise' | 'mf_highrise' | 'mf_townhome' | 'office' | 'retail' | 'industrial' | 'hospitality' | 'mixed_use';

type DevelopmentEnvelope = {
  max_units: number;
  max_gfa: number;
  max_stories: number;
  units_per_floor: number;
  binding_constraint: string;
  selected_path: string;
  parking: { type: string; spaces: number; cost_per_space: number };
  buildable_area_sf: number;
  impact_fee_credit_units: number;
};

interface DealContextBase {
  identity: DealIdentity;
  productType: ProductType;
  site: SiteContext;
  zoning: ZoningContext;
  zoningOutput: import('../types/zoning.types').ZoningOutput | null;

  resolvedUnitMix: UnitMixRow[];
  unitMixOverrides: Record<string, Partial<Pick<UnitMixRow, 'count' | 'avgSF' | 'targetRent'>>>;
  totalUnits: number;

  market: MarketContext;
  supply: SupplyContext;
  financial: FinancialContext;
  capital: CapitalContext;
  strategy: StrategyContext;
  scores: JEDIScoreContext;
  risk: RiskContext;

  hydrationStatus: Record<string, {
    hydrated: boolean;
    lastFetchedAt: string | null;
    source: 'cache' | 'live' | 'mock';
  }>;
  stageHistory: Array<{
    stage: DealStage;
    enteredAt: string;
    exitedAt: string | null;
  }>;
  editLog: EditLogEntry[];
}

export interface ExistingDealContext extends DealContextBase {
  projectType: 'existing';
  existingProperty: ExistingPropertyContext | null;
  developmentPaths: DevelopmentPath[];
  selectedDevelopmentPathId: string | null;
  developmentEnvelope: DevelopmentEnvelope | null;
  redevelopment: null;
}

export interface DevelopmentDealContext extends DealContextBase {
  projectType: 'development';
  developmentPaths: DevelopmentPath[];
  selectedDevelopmentPathId: string | null;
  developmentEnvelope: DevelopmentEnvelope | null;
  existingProperty: null;
  redevelopment: null;
}

export interface RedevelopmentDealContext extends DealContextBase {
  projectType: 'redevelopment';
  existingProperty: ExistingPropertyContext | null;
  redevelopment: RedevelopmentContext | null;
  developmentPaths: DevelopmentPath[];
  selectedDevelopmentPathId: string | null;
  developmentEnvelope: DevelopmentEnvelope | null;
}

export type DealContext = ExistingDealContext | DevelopmentDealContext | RedevelopmentDealContext;

export function isExistingDeal(ctx: DealContext): ctx is ExistingDealContext {
  return ctx.projectType === 'existing';
}

export function isDevelopmentDeal(ctx: DealContext): ctx is DevelopmentDealContext {
  return ctx.projectType === 'development';
}

export function isRedevelopmentDeal(ctx: DealContext): ctx is RedevelopmentDealContext {
  return ctx.projectType === 'redevelopment';
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
