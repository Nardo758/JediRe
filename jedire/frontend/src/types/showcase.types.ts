// ============================================================================
// JEDI RE Feature Showcase - Type Definitions
// ============================================================================

export type ViewMode = 'basic' | 'enhanced';

export interface Deal {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: 'sourcing' | 'analyzing' | 'due-diligence' | 'closing' | 'closed';
  stage: string;
  purchasePrice: number;
  currentValue: number;
  targetIRR: number;
  actualIRR?: number;
  capRate: number;
  noi: number;
  cashOnCash: number;
  closingDate?: string;
  daysInDeal: number;
  primaryStrategy: string;
  riskScore: number;
  confidence: number;
  lat: number;
  lng: number;
  propertyType: string;
  units: number;
  sqft: number;
  yearBuilt: number;
  occupancy: number;
  imageUrl?: string;
  team: TeamMember[];
  timeline: TimelineEvent[];
  documents: Document[];
  tasks: Task[];
  notes: Note[];
  activities: Activity[];
  properties: Property[];
  financials: FinancialSnapshot;
  risks: RiskFlag[];
  decisions: Decision[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'broker' | 'lender' | 'attorney' | 'inspector' | 'contractor' | 'property-manager' | 'other';
  email: string;
  phone: string;
  company: string;
  responsiveness: 'high' | 'medium' | 'low';
  lastContact: string;
  dealCount: number;
  avgResponseTime: string;
  reliability: number;
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: 'email' | 'call' | 'meeting' | 'document' | 'task' | 'milestone' | 'status-change' | 'note';
  title: string;
  description: string;
  icon: string;
  color: string;
  actor?: string;
  metadata?: Record<string, any>;
  expandable?: boolean;
}

export interface Activity extends TimelineEvent {
  dealId: string;
}

export interface Document {
  id: string;
  name: string;
  category: 'financial' | 'legal' | 'due-diligence' | 'property' | 'other';
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  version: number;
  status: 'pending' | 'review' | 'approved' | 'rejected';
  aiExtracted: boolean;
  extractionData?: any;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: 'financial' | 'legal' | 'inspection' | 'environmental' | 'title' | 'zoning' | 'other';
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  dueDate?: string;
  completedAt?: string;
  dependencies?: string[];
  contextual: boolean;
  aiGenerated: boolean;
}

export interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  mentions: string[];
  attachments: string[];
  comments: Comment[];
  tags: string[];
}

export interface Comment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  units: number;
  sqft: number;
  yearBuilt: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  estimatedValue: number;
  capRate: number;
  noi: number;
  lat: number;
  lng: number;
  comps?: Comparable[];
  images: string[];
}

export interface Comparable {
  id: string;
  address: string;
  distance: number;
  propertyType: string;
  units: number;
  sqft: number;
  salePrice: number;
  saleDate: string;
  capRate: number;
  pricePerUnit: number;
  pricePerSqft: number;
  similarity: number;
}

export interface FinancialSnapshot {
  purchasePrice: number;
  closingCosts: number;
  rehabBudget: number;
  totalInvestment: number;
  currentNOI: number;
  projectedNOI: number;
  currentCapRate: number;
  projectedCapRate: number;
  currentCashOnCash: number;
  projectedCashOnCash: number;
  irr: number;
  equity: number;
  debt: number;
  ltv: number;
  dscr: number;
  changes: FinancialChange[];
}

export interface FinancialChange {
  date: string;
  metric: string;
  previousValue: number;
  newValue: number;
  variance: number;
  reason: string;
}

export interface RiskFlag {
  id: string;
  category: 'financial' | 'market' | 'property' | 'legal' | 'environmental' | 'operational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  status: 'open' | 'monitoring' | 'mitigated' | 'resolved';
  mitigation?: string;
  impact: number;
  probability: number;
  aiDetected: boolean;
  dataSources: string[];
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  date: string;
  decidedBy: string;
  aiRecommendation?: string;
  actualChoice: string;
  reasoning: string;
  dataSources: string[];
  outcome?: 'positive' | 'neutral' | 'negative';
  impactScore?: number;
}

export interface Strategy {
  id: string;
  name: string;
  category: 'arbitrage' | 'value-add' | 'development' | 'operational' | 'financial' | 'market-timing';
  description: string;
  applicability: number;
  projectedROI: number;
  implementationCost: number;
  timeframe: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  requirements: string[];
  keyMetrics: StrategyMetric[];
}

export interface StrategyMetric {
  name: string;
  current: number;
  projected: number;
  change: number;
  unit: string;
}

export interface MarketSignal {
  id: string;
  type: 'supply' | 'demand' | 'pricing' | 'regulatory' | 'economic' | 'competition';
  severity: 'info' | 'warning' | 'alert' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  location: string;
  impact: 'positive' | 'neutral' | 'negative';
  confidence: number;
  dataSources: string[];
  relatedDeals: string[];
}

export interface SupplyPipelineUnit {
  id: string;
  name: string;
  address: string;
  units: number;
  status: 'planned' | 'approved' | 'under-construction' | 'completed';
  completionDate: string;
  developer: string;
  targetRent: number;
  distance: number;
  lat: number;
  lng: number;
  impactScore: number;
}

export interface NewsEvent {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  category: 'market' | 'regulatory' | 'economic' | 'development' | 'other';
  sentiment: 'positive' | 'neutral' | 'negative';
  relevance: number;
  summary: string;
  url: string;
  relatedDeals: string[];
  keyTopics: string[];
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  responsiveness: 'high' | 'medium' | 'low';
  reliability: number;
  deals: string[];
  lastContact: string;
  totalInteractions: number;
  avgResponseTime: string;
  preferredContact: 'email' | 'phone' | 'text';
  notes: string;
}

export interface Module {
  id: string;
  name: string;
  category: 'financial' | 'analysis' | 'operations' | 'market' | 'risk';
  tier: 'basic' | 'pro' | 'enterprise';
  description: string;
  features: string[];
  price: number;
  enabled: boolean;
  icon: string;
  color: string;
}

export interface DealSection {
  id: string;
  name: string;
  description: string;
  basicFeatures: string[];
  enhancedFeatures: string[];
  componentCount: number;
  dataPoints: number;
}

// Financial Modeling Pro types
export interface FinancialComponent {
  id: string;
  type: 'income' | 'expense' | 'capex' | 'financing' | 'assumption' | 'output';
  name: string;
  formula?: string;
  value: number;
  editable: boolean;
}

export interface SensitivityAnalysis {
  variable1: string;
  variable2: string;
  baseCase: number;
  scenarios: SensitivityScenario[][];
}

export interface SensitivityScenario {
  value1: number;
  value2: number;
  result: number;
}

export interface MonteCarloResult {
  metric: string;
  mean: number;
  median: number;
  stdDev: number;
  percentile5: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
  distribution: number[];
}

// Due Diligence types
export interface DDChecklist {
  category: string;
  tasks: DDTask[];
  completion: number;
  riskScore: number;
}

export interface DDTask {
  id: string;
  title: string;
  required: boolean;
  status: 'pending' | 'in-progress' | 'completed' | 'na';
  assignee?: string;
  dueDate?: string;
  findings?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

// Development Tracker types
export interface DevelopmentPhase {
  id: string;
  name: string;
  status: 'planning' | 'in-progress' | 'completed' | 'delayed';
  startDate: string;
  endDate: string;
  progress: number;
  budget: number;
  spent: number;
  variance: number;
  tasks: DevelopmentTask[];
}

export interface DevelopmentTask {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  startDate: string;
  endDate: string;
  dependencies: string[];
}

export interface Permit {
  id: string;
  type: string;
  status: 'applied' | 'under-review' | 'approved' | 'rejected';
  appliedDate: string;
  approvalDate?: string;
  expirationDate?: string;
  notes: string;
}
