/**
 * OPUS (Claude 3 Opus) AI Integration - Type Definitions
 * 
 * Complete data contract for AI-powered deal analysis across all tabs
 */

// ============================================================================
// Core Opus Types
// ============================================================================

export type DealStatus = 'pipeline' | 'owned';
export type AnalysisMode = 'acquisition' | 'performance';

export type OpusRecommendation =
  | 'strong-buy'
  | 'buy'
  | 'hold'
  | 'pass'
  | 'strong-pass'
  | 'optimize'
  | 'hold-asset'
  | 'sell';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type OpportunityType = 
  | 'value-add' 
  | 'development' 
  | 'arbitrage' 
  | 'market-timing'
  | 'operational'
  | 'financing';

// ============================================================================
// Tab-Specific Data Contracts
// ============================================================================

// Overview Tab Data
export interface PropertySpecs {
  address: string;
  propertyType: string;
  units?: number;
  squareFeet?: number;
  yearBuilt?: number;
  lotSize?: number;
  zoning?: string;
  condition?: string;
  occupancy?: number;
}

export interface DealMetrics {
  purchasePrice?: number;
  currentValue?: number;
  askingPrice?: number;
  projectedValue?: number;
  capRate?: number;
  cashOnCash?: number;
  irr?: number;
  equity?: number;
  debt?: number;
  ltv?: number;
}

export interface OverviewData {
  propertySpecs: PropertySpecs;
  metrics: DealMetrics;
  location?: {
    lat: number;
    lng: number;
    city: string;
    state: string;
    zip: string;
    neighborhood?: string;
  };
}

// Market Competition Tab Data
export interface ComparableProperty {
  address: string;
  distance: number; // miles
  propertyType: string;
  units?: number;
  squareFeet?: number;
  salePrice?: number;
  saleDate?: string;
  pricePerUnit?: number;
  pricePerSqFt?: number;
  capRate?: number;
  similarity: number; // 0-100%
}

export interface MarketPosition {
  marketRank?: string; // 'top-quartile' | 'above-average' | 'average' | 'below-average'
  pricingCompetitiveness: number; // -100 to +100 (negative = below market, positive = above)
  demandLevel?: 'very-high' | 'high' | 'moderate' | 'low' | 'very-low';
  absorptionRate?: number; // months
  vacancyRate?: number; // percentage
}

export interface CompetitionData {
  comps: ComparableProperty[];
  marketPosition: MarketPosition;
  competitiveAdvantages?: string[];
  competitiveDisadvantages?: string[];
}

// Supply Tracking Tab Data
export interface SupplyProject {
  projectName: string;
  address: string;
  distance: number; // miles
  units: number;
  propertyType: string;
  status: 'planned' | 'under-construction' | 'pre-leasing' | 'delivered';
  expectedCompletion?: string;
  deliveryDate?: string;
  impactLevel: 'low' | 'medium' | 'high';
}

export interface SupplyImpact {
  totalPipelineUnits: number;
  totalPipelineUnitsWithin3Miles: number;
  expectedDeliveryNext12Months: number;
  expectedDeliveryNext24Months: number;
  overallImpact: 'minimal' | 'moderate' | 'significant' | 'severe';
  absorptionProjection?: number; // months to absorb new supply
}

export interface SupplyData {
  pipelineProjects: SupplyProject[];
  impactAnalysis: SupplyImpact;
  recommendations?: string[];
}

// Debt Market Tab Data
export interface InterestRates {
  currentRate?: number;
  rateType: 'fixed' | 'floating' | 'hybrid';
  term?: number; // years
  spread?: number; // basis points
  indexRate?: number; // e.g., SOFR
  marketTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface LendingTerms {
  maxLtv?: number; // percentage
  minDscr?: number;
  recourse: 'full' | 'non-recourse' | 'partial';
  loanAmount?: number;
  amortization?: number; // years
  prepaymentPenalty?: string;
  lenderAppetite: 'strong' | 'moderate' | 'weak';
}

export interface DebtData {
  currentRates: InterestRates;
  lendingConditions: LendingTerms;
  refinanceOpportunity?: boolean;
  debtServiceCoverage?: number;
  recommendations?: string[];
}

// Financial Analysis Tab Data
export interface ProFormaData {
  revenue: {
    grossRent?: number;
    otherIncome?: number;
    vacancy?: number;
    effectiveGrossIncome?: number;
  };
  expenses: {
    operating?: number;
    propertyTax?: number;
    insurance?: number;
    maintenance?: number;
    utilities?: number;
    management?: number;
    totalExpenses?: number;
  };
  noi?: number;
  debtService?: number;
  cashFlow?: number;
}

export interface CashFlowProjection {
  year: number;
  grossIncome: number;
  expenses: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  cumulativeCashFlow: number;
}

export interface FinancialData {
  proForma: ProFormaData;
  projections?: CashFlowProjection[];
  sensitivityAnalysis?: {
    scenario: string;
    irr: number;
    npv: number;
    impact: string;
  }[];
  keyMetrics?: {
    returnOnInvestment: number;
    paybackPeriod: number;
    breakEvenOccupancy: number;
  };
}

// Strategy & Arbitrage Tab Data
export interface DealStrategy {
  strategyType: string;
  description: string;
  expectedReturn?: number;
  riskLevel: RiskLevel;
  implementation: string[];
  timeline?: string;
}

export interface ArbitrageOpportunity {
  type: 'market' | 'information' | 'execution' | 'regulatory' | 'timing';
  description: string;
  potentialGain?: number;
  probability: number; // 0-100%
  requirements: string[];
}

export interface StrategyData {
  primaryStrategy?: DealStrategy;
  alternativeStrategies?: DealStrategy[];
  arbitrageOpportunities?: ArbitrageOpportunity[];
  recommendations?: string[];
}

// Due Diligence Tab Data
export interface DDChecklistItem {
  category: string;
  item: string;
  status: 'pending' | 'in-progress' | 'complete' | 'not-applicable';
  priority: 'high' | 'medium' | 'low';
  findings?: string;
  concern?: boolean;
}

export interface DueDiligenceData {
  checklistItems: DDChecklistItem[];
  completionPercentage: number;
  redFlags: string[];
  documentsReviewed: number;
  inspectionsCompleted: string[];
}

// Market Analysis Tab Data
export interface DemographicData {
  population?: number;
  medianIncome?: number;
  medianAge?: number;
  employmentRate?: number;
  populationGrowth?: number; // percentage
  incomeGrowth?: number; // percentage
}

export interface MarketTrends {
  rentGrowth?: number; // percentage
  valueAppreciation?: number; // percentage
  employmentGrowth?: number; // percentage
  constructionActivity?: 'increasing' | 'stable' | 'decreasing';
  investorSentiment?: 'bullish' | 'neutral' | 'bearish';
}

export interface MarketData {
  demographics?: DemographicData;
  trends?: MarketTrends;
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}

// Team & Communications Tab Data
export interface TeamMember {
  name: string;
  role: string;
  company?: string;
  email?: string;
  phone?: string;
  involvement: 'primary' | 'supporting' | 'advisor';
}

export interface CommunicationSummary {
  emailCount: number;
  lastContact?: string;
  keyDecisions: string[];
  openItems: string[];
  stakeholderSentiment?: 'positive' | 'neutral' | 'negative';
}

export interface TeamData {
  teamMembers: TeamMember[];
  communications: CommunicationSummary;
}

// Documents Tab Data
export interface DocumentData {
  totalDocuments: number;
  categories: {
    category: string;
    count: number;
  }[];
  recentlyAdded: string[];
  missingDocuments?: string[];
}

// ============================================================================
// Complete Deal Context (All Tabs)
// ============================================================================

export interface OpusDealContext {
  dealId: string;
  dealName: string;
  status: DealStatus;
  
  // Tab data (optional as not all tabs may have data)
  overview?: OverviewData;
  competition?: CompetitionData;
  supply?: SupplyData;
  debt?: DebtData;
  financial?: FinancialData;
  strategy?: StrategyData;
  dueDiligence?: DueDiligenceData;
  market?: MarketData;
  team?: TeamData;
  documents?: DocumentData;
  
  // Metadata
  lastUpdated?: string;
  dataCompleteness?: number; // 0-100%
  analysisVersion?: string;
}

// ============================================================================
// Opus Analysis Results
// ============================================================================

export interface Risk {
  id: string;
  category: string;
  description: string;
  level: RiskLevel;
  impact: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-100%
  mitigation?: string;
  priority: number; // 1-10
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  description: string;
  potentialValue?: number;
  probability: number; // 0-100%
  requirements: string[];
  timeline?: string;
  priority: number; // 1-10
}

export interface ActionItem {
  id: string;
  action: string;
  category: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  timeframe: string;
  owner?: string;
  dependencies?: string[];
}

export interface OpusRecommendationResult {
  // Core recommendation
  score: number; // 0-10
  confidence: number; // 0-100%
  recommendation: OpusRecommendation;
  reasoning: string;
  
  // Insights
  keyInsights: string[];
  executiveSummary?: string;
  
  // Analysis
  risks: Risk[];
  opportunities: Opportunity[];
  actionItems: ActionItem[];
  
  // Supporting data
  strengths: string[];
  weaknesses: string[];
  assumptions: string[];
  
  // Metadata
  analysisDate: string;
  modelVersion: string;
  tokensUsed?: number;
  processingTime?: number; // milliseconds
}

// ============================================================================
// Chat Interface
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    tokensUsed?: number;
    model?: string;
    temperature?: number;
  };
}

export interface ChatSession {
  dealId: string;
  sessionId: string;
  messages: ChatMessage[];
  context?: Partial<OpusDealContext>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  dealId: string;
  message: string;
  sessionId?: string;
  includeContext?: boolean;
  temperature?: number; // 0-1
  maxTokens?: number;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string;
  suggestions?: string[]; // Follow-up question suggestions
}

// ============================================================================
// Service Configuration
// ============================================================================

export interface OpusConfig {
  apiKey?: string;
  model: 'claude-opus-4' | 'claude-3-opus-20240229';
  maxTokens: number;
  temperature: number;
  useMockData: boolean;
  enableCaching?: boolean;
  enableStreaming?: boolean;
  retryAttempts?: number;
  timeoutMs?: number;
}

export interface OpusUsageMetrics {
  totalRequests: number;
  totalTokensUsed: number;
  totalCost: number; // USD
  averageResponseTime: number; // milliseconds
  errorRate: number; // percentage
  lastRequest?: string;
}

// ============================================================================
// Error Handling
// ============================================================================

export interface OpusError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  retryable: boolean;
}

export type OpusErrorCode =
  | 'API_KEY_MISSING'
  | 'API_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_REQUEST'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INSUFFICIENT_DATA'
  | 'UNKNOWN_ERROR';
