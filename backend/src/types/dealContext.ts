/**
 * DealContext — Research Agent's assembled output package
 * This IS the Deal Capsule, born from a chat message or web request.
 * Single source of truth consumed by Zoning, Supply, and Cashflow agents.
 */

// ── Shared Layer Types (aligned with frontend dealContext.types.ts) ──

export type DataSourceLayer = 'broker' | 'platform' | 'user' | 'agent' | 'computed';

/**
 * Fine-grained LayeredValueSource for the Agent Platform.
 *
 * Merge order (lowest → highest priority):
 *   1. platform  (defaults)
 *   2. agent:*   (any agent-written value)
 *   3. t12 / rent_roll / tax_bill  (document-derived)
 *   4. override  (user edit — always wins)
 *
 * User overrides always sit on top. An agent-written value remains in history
 * even after a user override, and can be recalled on rollback.
 */
export type LayeredValueSource =
  | 'platform'          // default / fallback values
  | 'broker'            // from broker-supplied data
  | 'agent:research'    // written by Research Agent
  | 'agent:zoning'      // written by Zoning Agent
  | 'agent:supply'      // written by Supply Agent
  | 'agent:cashflow'    // written by CashFlow Agent
  | 'agent:commentary'  // written by Commentary Agent
  | 't12'               // from uploaded T12 document
  | 'rent_roll'         // from uploaded Rent Roll
  | 'tax_bill'          // from uploaded Tax Bill
  | 'override'          // user edit
  | 'user'              // user-entered value
  | 'computed';         // derived value

export type AlertLevel = 'none' | 'info' | 'warn' | 'block';
export type InputClass = 'identity' | 'override' | 'scope';
export type ProjectType = 'existing' | 'development' | 'redevelopment';

export interface LayeredValue<T> {
  value: T;
  source: LayeredValueSource | DataSourceLayer;
  resolvedFrom: 'broker' | 'platform' | 'user';
  updatedAt: string;
  confidence: number;
  alertLevel: AlertLevel;
  userReviewed: boolean;
  /** Links to agent_runs table when source starts with 'agent:' */
  agent_run_id?: string;
  layers?: {
    broker?: { value: T; updatedAt: string; confidence: number; source?: string };
    platform?: { value: T; updatedAt: string; confidence: number; source?: string };
    user?: { value: T; updatedAt: string; confidence: number };
  };
}

export interface EditLogEntry {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: string;
  actor: 'user' | 'agent' | 'platform';
  actorId?: string;
}

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

export interface InputFieldMeta {
  path: string;
  label: string;
  inputClass: InputClass;
  highSensitivity: boolean;
  appliesTo: ProjectType[];
  category: 'identity' | 'market' | 'cost' | 'capital' | 'exit' | 'site' | 'zoning';
}

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
    const denom = (platform.value as number) || 1;
    const divergence = Math.abs(((broker.value as number) - (platform.value as number)) / denom);
    if (divergence > 0.15) return 'warn';
  }

  if (lv.confidence <= 0.7) return 'warn';
  if (!lv.userReviewed) return 'info';
  return 'info';
}

const EXISTING_ALIASES = new Set([
  'existing', 'acquisition', 'existing_acquisition', 'stabilized',
  'value-add', 'value_add',
  'multifamily', 'multi-family', 'multi_family',
  'office', 'retail', 'industrial', 'flex',
  'mixed_use', 'mixed-use', 'mixeduse',
  'hotel', 'hospitality', 'self_storage', 'self-storage',
  'senior_housing', 'senior-housing', 'student_housing',
  'single_family', 'single-family', 'sfr',
  'build_to_rent', 'build-to-rent',
]);

const DEVELOPMENT_ALIASES = new Set([
  'development', 'ground_up', 'ground-up',
  'new_construction', 'new construction',
  'new_development', 'new-development',
  'land', 'vacant',
]);

const REDEVELOPMENT_ALIASES = new Set([
  'redevelopment', 'redev', 'rehab', 'repositioning',
  'adaptive_reuse', 'adaptive-reuse',
  'gut_rehab', 'gut-rehab',
  'tear-down', 'teardown', 'tear_down',
  'conversion', 'partial_demo', 'partial-demo',
]);

export function resolveProjectType(raw: string | null | undefined): ProjectType {
  if (!raw) return 'existing';
  const n = raw.toLowerCase().trim();
  if (!n) return 'existing';
  if (EXISTING_ALIASES.has(n)) return 'existing';
  if (DEVELOPMENT_ALIASES.has(n)) return 'development';
  if (REDEVELOPMENT_ALIASES.has(n)) return 'redevelopment';
  return 'existing';
}

// ── Research Agent Context (legacy name: DealContext) ────────────
// NOTE: This is the Research Agent's assembled output package — NOT the
// frontend Deal Capsule union. For frontend-aligned deal types, use
// DealCapsuleContext (ExistingDealCapsule | DevelopmentDealCapsule | RedevelopmentDealCapsule).

export interface ResearchAgentContext {
  // ── Identity ──
  requestId: string;
  address: string;
  coordinates: { lat: number; lng: number };
  parcelId: string;
  createdAt: string;

  // ── Parcel Data (County Records) ──
  parcel: ParcelData;

  // ── Zoning (ArcGIS + Municode) ──
  zoning: ZoningData;

  // ── Market Data (RentCast + Apartment Locator) ──
  market: MarketData;

  // ── Comps (Apartment Locator + RentCast) ──
  comps: CompData[];

  // ── Supply Pipeline (County Permits) ──
  pipeline: PipelineData;

  // ── Demographics (Census / GeoEnrichment) ──
  demographics: DemographicsData;

  // ── Digital Signals (SpyFu + Google) ──
  digital: DigitalSignals;

  // ── News (NewsAPI) ──
  news: NewsItem[];

  // ── Macro (FRED / BLS) ──
  macro: MacroData;

  // ── Assembly Metadata ──
  meta: AssemblyMeta;
}

// ── Sub-interfaces ──────────────────────────────────────────────

export interface ParcelData {
  lotSizeSqFt: number;
  lotSizeAcres: number;
  assessedValue: number;
  lastSaleDate: string;
  lastSalePrice: number;
  ownerName: string;
  ownerType: 'individual' | 'entity' | 'government';
  legalDescription: string;
}

export interface ZoningData {
  district: string;
  description: string;
  maxStories: number;
  maxHeight: number;
  maxDensity: number;
  far: number;
  maxBuildableUnits: number;
  parkingRatio: number;
  setbacks: {
    front: number;
    side: number;
    rear: number;
  };
  overlays: string[];
  floodZone: string;
  sourceUrl: string;
  confidence: number;
}

export interface MarketData {
  msa: string;
  submarket: string;
  avgRent: number;
  avgRentPSF: number;
  vacancyRate: number;
  absorptionUnitsPerMonth: number;
  daysOnMarket: number;
  rentGrowthYoY: number;
  concessionRate: number;
}

export interface CompData {
  name: string;
  address: string;
  distanceMi: number;
  units: number;
  yearBuilt: number;
  avgRent: number;
  occupancy: number;
  rating: number;
}

export interface PipelineData {
  activePermits: number;
  totalPipelineUnits: number;
  nearestDeliveryDate: string;
  monthsOfPipelineSupply: number;
}

export interface DemographicsData {
  populationGrowthYoY: number;
  medianHouseholdIncome: number;
  employmentGrowthYoY: number;
  topEmployers: string[];
  netMigration: number;
}

export interface DigitalSignals {
  trafficIndex: number;
  searchMomentum: number;
  googleRatingAvg: number;
  reviewVolume: number;
}

export interface NewsItem {
  headline: string;
  source: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  relevance: 'market' | 'property' | 'regulatory' | 'economic';
}

export interface MacroData {
  fed30YrMortgageRate: number;
  freddieMacPMMS: number;
  msaUnemploymentRate: number;
  cpiYoY: number;
}

export interface AssemblyMeta {
  sourcesQueried: string[];
  sourcesSucceeded: string[];
  sourcesFailed: string[];
  assemblyTimeMs: number;
  dataFreshnessHours: number;
  confidenceScore: number;
}

// ── Agent Result Types ──────────────────────────────────────────

export interface ZoningResult {
  summary: string;
  buildableUnits: number;
  maxStories: number;
  farUtilization: number;
  parkingRequired: number;
  overlayRestrictions: string[];
  developmentCapacity: string;
  confidence: number;
  details: Record<string, unknown>;
}

export interface SupplyResult {
  summary: string;
  absorptionRate: number;
  vacancyTrend: 'rising' | 'falling' | 'stable';
  monthsOfSupply: number;
  pipelineDeliveries: number;
  competitivePositioning: string;
  marketCyclePhase: 'expansion' | 'peak' | 'contraction' | 'trough';
  confidence: number;
  details: Record<string, unknown>;
}

export interface CashflowResult {
  summary: string;
  noiProjection: number;
  cashOnCashReturn: number;
  irrEstimate: number;
  dscr: number;
  recommendedStrategy: 'build' | 'flip' | 'hold' | 'str' | 'pass';
  riskFlags: string[];
  confidence: number;
  details: Record<string, unknown>;
}

export interface CoordinatorResult {
  address: string;
  dealId: string;
  jediScore: number;
  recommendation: 'BUY' | 'PASS' | 'INVESTIGATE';
  fullSummary: string;
  zoning: ZoningResult;
  supply: SupplyResult;
  cashflow: CashflowResult;
  followUpOptions: Array<{ label: string; action: string }>;
  creditsUsed: number;
  creditsRemaining: number;
  mapThumbnailUrl?: string;
}

// ── Chat Types ──────────────────────────────────────────────────

export type ChatPlatform = 'whatsapp' | 'imessage' | 'sms' | 'telegram';
export type Surface = 'chat' | 'web' | 'api' | 'autonomous';
export type SubscriptionTier = 'scout' | 'operator' | 'principal' | 'institutional';
export type AutomationLevel = 1 | 2 | 3 | 4;
export type AgentId = 'research' | 'zoning' | 'supply' | 'cashflow' | 'coordinator' | 'commentary';

export interface ChatMessage {
  platform: ChatPlatform;
  platformUserId: string;
  text: string;
  attachments?: Array<{
    type: 'image' | 'document' | 'location';
    url: string;
  }>;
  timestamp: string;
}

export interface ChatResponse {
  text: string;
  quickReplies?: string[];
  inlineKeyboard?: {
    inline_keyboard: Array<Array<{
      text: string;
      callback_data?: string;
      url?: string;
    }>>;
  };
  richLink?: {
    title: string;
    subtitle: string;
    imageUrl?: string;
    url: string;
  };
  listPicker?: {
    title: string;
    items: Array<{ title: string; identifier: string }>;
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  platform: ChatPlatform | 'web' | 'api';
  platformUserId: string;
  stripeCustomerId: string;
  subscriptionTier: SubscriptionTier;

  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;

  activeDeals: Array<{
    dealId: string;
    address: string;
    askingPrice: number;
    dealContext?: ResearchAgentContext;
    agentResults?: {
      zoning?: ZoningResult;
      supply?: SupplyResult;
      cashflow?: CashflowResult;
    };
    jediScore?: number;
    lastAnalyzed: string;
  }>;

  automationLevel: AutomationLevel;
  creditsUsedThisSession: number;
  lastMessageAt: string;
  expiresAt: string;
}

// ── Deal Capsule Context (aligned with frontend DealContext union) ───────

interface DealCapsuleIdentity {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  mode: 'existing' | 'development' | 'redevelopment';
  stage: string;
  createdAt: string;
  updatedAt: string;
}

interface DealCapsuleSite {
  acreage: LayeredValue<number>;
  buildableAcreage: LayeredValue<number>;
  floodZone: LayeredValue<string | null>;
  coordinates?: { lat: number; lng: number };
  parcelId?: string;
  county?: string;
  topography?: string;
  utilities?: string[];
  environmentalFlags?: string[];
}

interface DealCapsuleZoning {
  designation: LayeredValue<string>;
  maxDensity: LayeredValue<number>;
  maxHeight: LayeredValue<number>;
  maxFAR: LayeredValue<number>;
  maxLotCoverage: LayeredValue<number>;
  setbacks: LayeredValue<{
    front: number;
    side: number;
    rear: number;
  }>;
  parkingRatio: LayeredValue<number>;
  guestParkingRatio: LayeredValue<number>;
}

interface DealCapsuleMarket {
  submarketName: string;
  avgRent: LayeredValue<number>;
  avgOccupancy: LayeredValue<number>;
  rentGrowthYoY: LayeredValue<number>;
  absorptionRate: LayeredValue<number>;
  medianHHI: LayeredValue<number>;
  popGrowthPct: LayeredValue<number>;
  employmentGrowthPct: LayeredValue<number>;
}

interface DealCapsuleFinancial {
  assumptions: {
    rentGrowth: LayeredValue<number>;
    expenseGrowth: LayeredValue<number>;
    vacancy: LayeredValue<number>;
    exitCapRate: LayeredValue<number>;
    holdPeriod: LayeredValue<number>;
    capexPerUnit: LayeredValue<number>;
    managementFee: LayeredValue<number>;
  };
}

interface DealCapsuleCapital {
  totalCapital: LayeredValue<number>;
  debt: Array<{
    id: string;
    name: string;
    amount: number;
    ltv: number;
    rate: LayeredValue<number>;
    termYears: number;
    amortizationYears: number;
    ioPeriodMonths: number;
    lender?: string;
  }>;
  equity: Array<{
    id: string;
    name: string;
    amount: number;
    preferredReturn: number;
    promoteSplits: Array<{ above: number; gpShare: number; lpShare: number }>;
  }>;
  metrics?: {
    totalLTV: number;
    blendedRate: number;
    dscr: number;
    debtYield: number;
  };
}

interface DealCapsuleExistingProperty {
  yearBuilt: LayeredValue<number>;
  totalUnits: LayeredValue<number>;
  totalSF: LayeredValue<number>;
  occupancy: LayeredValue<number>;
  currentNOI: LayeredValue<number>;
  askingPrice: LayeredValue<number>;
  pricePerUnit: number;
  goingInCapRate: number;
  lastRenovated: LayeredValue<number | null>;
  propertyClass: LayeredValue<'A' | 'B+' | 'B' | 'B-' | 'C' | 'D'>;
  amenities: string[];
}

interface DealCapsuleBase {
  identity: DealCapsuleIdentity;
  productType: string;
  site: DealCapsuleSite;
  zoning: DealCapsuleZoning;
  market: DealCapsuleMarket;
  financial: DealCapsuleFinancial;
  capital: DealCapsuleCapital;
  editLog: EditLogEntry[];
}

export interface ExistingDealCapsule extends DealCapsuleBase {
  projectType: 'existing';
  existingProperty: DealCapsuleExistingProperty | null;
  redevelopment: null;
}

export interface DevelopmentDealCapsule extends DealCapsuleBase {
  projectType: 'development';
  existingProperty: null;
  redevelopment: null;
}

export interface RedevelopmentDealCapsule extends DealCapsuleBase {
  projectType: 'redevelopment';
  existingProperty: DealCapsuleExistingProperty | null;
  redevelopment: RedevelopmentContext | null;
}

export type DealCapsuleContext = ExistingDealCapsule | DevelopmentDealCapsule | RedevelopmentDealCapsule;

export function isExistingCapsule(ctx: DealCapsuleContext): ctx is ExistingDealCapsule {
  return ctx.projectType === 'existing';
}

export function isDevelopmentCapsule(ctx: DealCapsuleContext): ctx is DevelopmentDealCapsule {
  return ctx.projectType === 'development';
}

export function isRedevelopmentCapsule(ctx: DealCapsuleContext): ctx is RedevelopmentDealCapsule {
  return ctx.projectType === 'redevelopment';
}

/** @deprecated Use ResearchAgentContext instead. Kept for backward compatibility. */
export type DealContext = ResearchAgentContext;

// ── AI Service Types ────────────────────────────────────────────

export interface AICallContext {
  userId: string;
  stripeCustomerId: string;
  dealId?: string;
  operationType: string;
  agentId: AgentId;
  surface: Surface;
  platform?: ChatPlatform;
}
