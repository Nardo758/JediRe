// Central type exports
export * from './deal';

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
}

// Lead
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  status?: string;
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

export type ModuleType = 'map' | 'properties' | 'strategy' | 'pipeline' | 'market' | 'reports' | 'team' | 'zoning' | 'supply' | 'cashflow';

// Collaboration
export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
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
  building_class?: string;
  lease_expiration_date?: string;
  current_lease_amount?: number;
  lease_start_date?: string;
  renewal_status?: string;
  yearBuilt?: number;
  comparableScore?: number;
  amenities?: string[];
  notes?: string;
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
