// Central type exports
export * from './deal';
export * from './analysis';

// User type
export interface User {
  id: string;
  email: string;
  name?: string;
  subscription?: any;
  role?: string;
}

// Search result
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: string;
  properties?: any[];
}

// Zoning
export interface ZoningInsight {
  id: string;
  zone: string;
  description: string;
  reasoning?: string;
  confidence?: 'high' | 'medium' | 'low';
  districtCode?: string;
  districtName?: string;
  maxUnits?: number;
  maxGfaSqft?: number;
  maxHeightFt?: number;
  maxStories?: number;
  setbacks?: {
    front?: number;
    side?: number;
    rear?: number;
    frontFt?: number;
    sideFt?: number;
    rearFt?: number;
  };
  parkingRequired?: number;
  buildableEnvelope?: any;
}

// Lead
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  status?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  message?: string;
  propertyInterest?: string;
  assignedAgent?: string;
  createdAt?: string;
  lastContact?: string;
  notes?: string;
}

// Commission
export interface Commission {
  id: string;
  dealId?: string;
  amount?: number;
  rate?: number;
  status: string;
  propertyAddress?: string;
  dealType?: string;
  dealValue?: number;
  commissionRate?: number;
  splitPercentage?: number;
  grossCommission?: number;
  netCommission?: number;
  datePaid?: string;
  createdAt?: string;
}

export interface CommissionSummary {
  total: number;
  pending: number;
  paid: number;
  count: number;
  ytdTotal?: number;
  mtdTotal?: number;
  pendingTotal?: number;
  commissionsByType?: {
    sale: number;
    lease: number;
    rental: number;
  };
}

// Map filter
export interface MapFilter {
  bounds?: any;
  propertyType?: string;
  priceRange?: [number, number];
  minScore?: number;
  maxScore?: number;
  minPrice?: number;
  maxPrice?: number;
  municipalities?: string[];
}

export type ModuleType = 'map' | 'properties' | 'strategy' | 'pipeline' | 'market' | 'reports' | 'team' | 'zoning' | 'supply' | 'cashflow' | 'news' | 'email' | 'tasks' | 'demand' | 'events';

// Collaboration
export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  color?: string;
  cursor?: {
    lat: number;
    lng: number;
  };
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

// Annotation
export interface Annotation {
  id: string;
  propertyId: string;
  userId: string;
  userName?: string;
  content: string;
  text?: string;
  type?: string;
  createdAt: string;
}

// Supply Insight
export interface SupplyInsight {
  activeListings?: number;
  inventoryTrend?: 'increasing' | 'decreasing' | 'stable';
  daysOnMarket?: number;
  absorptionRate: number;
  comparableProperties?: number;
  medianPrice?: number;
  reasoning?: string;
}

// Cash Flow Insight
export interface CashFlowInsight {
  netOperatingIncome?: number;
  estimatedRent?: number;
  operatingExpenses?: number;
  capRate?: number;
  cashOnCashReturn?: number;
  breakEvenOccupancy?: number;
  scenarios?: {
    name: string;
    noi: number;
    capRate: number;
    cashOnCash: number;
    purchasePrice?: number;
    downPayment?: number;
    interestRate?: number;
    monthlyPayment?: number;
    monthlyCashFlow?: number;
    annualReturn?: number;
  }[];
  reasoning?: string;
}

// Property
export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  rent: number;
  beds: number;
  baths: number;
  sqft: number;
  class?: string;
  building_class?: string;
  lease_expiration_date?: string;
  current_lease_amount?: number;
  lease_start_date?: string;
  renewal_status?: string;
  yearBuilt?: number;
  comparableScore?: number;
  amenities?: string[];
  notes?: string;
  coordinates?: { lat: number; lng: number };
  isPinned?: boolean;
  opportunityScore?: number;
  currentUse?: string;
  lotSizeSqft?: number;
  municipality?: string;
  districtCode?: string;
  zoning?: ZoningInsight;
  supply?: SupplyInsight;
  cashFlow?: CashFlowInsight;
  annotations?: Annotation[];
}

// Agent Deal types
export type DealType = 'buyer' | 'seller' | 'dual' | 'both' | 'referral' | 'lease';
export type DealPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DealStage = 'lead' | 'qualified' | 'prospecting' | 'contacted' | 'proposal' | 'negotiation' | 'under_contract' | 'closed' | 'lost';

export interface DealFormData {
  clientId: string;
  propertyAddress: string;
  dealType: string;
  dealValue: number;
  commissionRate: number;
  expectedCloseDate: string | null;
  priority: string;
  notes: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type?: string;
  status?: string;
}

export interface DealActivity {
  id: string;
  dealId: string;
  type: string;
  description: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

// Deal Sidebar Props
export interface DealSidebarProps {
  deal: any;
  modules: any[];
  currentModule: string;
  onModuleChange: (module: string) => void;
}
