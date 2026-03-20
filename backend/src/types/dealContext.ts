/**
 * DealContext — Research Agent's assembled output package
 * This IS the Deal Capsule, born from a chat message or web request.
 * Single source of truth consumed by Zoning, Supply, and Cashflow agents.
 */

// ── Core DealContext Interface ──────────────────────────────────

export interface DealContext {
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
export type AgentId = 'research' | 'zoning' | 'supply' | 'cashflow' | 'coordinator';

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
    dealContext?: DealContext;
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
