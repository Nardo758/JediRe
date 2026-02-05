// Core types for JediRe platform

export interface Property {
  id: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  opportunityScore: number;
  municipality: string;
  districtCode?: string;
  districtName?: string;
  lotSizeSqft?: number;
  currentUse?: string;
  
  // Agent insights
  zoning?: ZoningInsight;
  supply?: SupplyInsight;
  cashFlow?: CashFlowInsight;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
  annotations?: Annotation[];
}

export interface ZoningInsight {
  districtCode: string;
  districtName: string;
  maxUnits: number;
  maxGfaSqft: number;
  maxHeightFt: number;
  maxStories: number;
  parkingRequired: number;
  setbacks: {
    frontFt: number;
    rearFt: number;
    sideFt: number;
  };
  buildableEnvelope?: GeoJSON.Polygon;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface SupplyInsight {
  activeListings: number;
  daysOnMarket: number;
  absorptionRate: number;
  inventoryTrend: 'increasing' | 'stable' | 'decreasing';
  comparableProperties: number;
  medianPrice: number;
  reasoning: string;
}

export interface CashFlowInsight {
  estimatedRent: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  capRate: number;
  cashOnCashReturn: number;
  breakEvenOccupancy: number;
  reasoning: string;
  scenarios: CashFlowScenario[];
}

export interface CashFlowScenario {
  name: string;
  purchasePrice: number;
  downPayment: number;
  loanAmount: number;
  interestRate: number;
  monthlyPayment: number;
  monthlyCashFlow: number;
  annualReturn: number;
}

export interface Annotation {
  id: string;
  propertyId: string;
  userId: string;
  userName: string;
  text: string;
  type: 'comment' | 'note' | 'flag';
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user' | 'viewer';
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    modules: ModuleType[];
  };
}

export type ModuleType = 'zoning' | 'supply' | 'demand' | 'cashflow' | 'news' | 'events';

export interface MapFilter {
  minScore?: number;
  maxScore?: number;
  modules?: ModuleType[];
  municipalities?: string[];
  zoningDistricts?: string[];
  minPrice?: number;
  maxPrice?: number;
}

export interface SearchResult {
  properties: Property[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WebSocketMessage {
  type: 'property_update' | 'user_join' | 'user_leave' | 'annotation_added' | 'pin_toggle';
  payload: any;
  timestamp: string;
}

export interface CollaborationSession {
  id: string;
  users: CollaborationUser[];
  properties: string[]; // Property IDs
  createdAt: string;
}

export interface CollaborationUser {
  id: string;
  name: string;
  avatar?: string;
  cursor?: {
    lat: number;
    lng: number;
  };
  color: string;
}

// Deal types for Agent Dashboard
export type DealStage = 'lead' | 'qualified' | 'under_contract' | 'closed' | 'lost';
export type DealType = 'buyer' | 'seller' | 'both';
export type DealPriority = 'low' | 'medium' | 'high';

export interface Deal {
  id: string;
  clientId: string;
  clientName: string;
  propertyAddress: string;
  dealType: DealType;
  stage: DealStage;
  dealValue: number;
  commissionRate: number;
  commissionEstimate: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  priority: DealPriority;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  daysInStage: number;
  // Activity timeline
  activities?: DealActivity[];
}

export interface DealActivity {
  id: string;
  dealId: string;
  userId: string;
  userName: string;
  type: 'stage_change' | 'note_added' | 'value_updated' | 'created' | 'archived';
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: 'buyer' | 'seller' | 'both';
  createdAt: string;
}

export interface DealFormData {
  clientId: string;
  propertyAddress: string;
  dealType: DealType;
  dealValue: number;
  commissionRate: number;
  expectedCloseDate: string | null;
  priority: DealPriority;
  notes?: string;
}

// Agent/Lead Management types
export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyInterest?: string;
  source: 'referral' | 'website' | 'social' | 'open_house' | 'other';
  priority: 'low' | 'medium' | 'high';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'dead';
  notes?: string;
  lastContact?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Commission {
  id: string;
  dealId?: string;
  dealValue: number;
  commissionRate: number;
  splitPercentage: number;
  grossCommission: number;
  netCommission: number;
  status: 'pending' | 'paid';
  datePaid?: string;
  dealType?: 'sale' | 'lease' | 'rental';
  propertyAddress?: string;
  createdAt: string;
}

export interface CommissionSummary {
  ytdTotal: number;
  mtdTotal: number;
  pendingTotal: number;
  commissionsByType: {
    sale: number;
    lease: number;
    rental: number;
  };
}

// Export agent types
export * from './agent';
