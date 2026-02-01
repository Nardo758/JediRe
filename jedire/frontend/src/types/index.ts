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
