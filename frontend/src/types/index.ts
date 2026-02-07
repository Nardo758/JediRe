// Central type exports
export * from './deal';

// User type
export interface User {
  id: string;
  email: string;
  name?: string;
  subscription?: string;
  role?: string;
}

// Additional types that may be referenced
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: string;
}

export interface ZoningInsight {
  id: string;
  zone: string;
  description: string;
  reasoning?: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  status?: string;
}

export interface Commission {
  id: string;
  dealId: string;
  amount: number;
  rate: number;
  status: string;
}

export interface CommissionSummary {
  total: number;
  pending: number;
  paid: number;
  count: number;
}

export interface MapFilter {
  bounds?: any;
  propertyType?: string;
  priceRange?: [number, number];
}

export type ModuleType = 'map' | 'properties' | 'strategy' | 'pipeline' | 'market' | 'reports' | 'team' | 'zoning' | 'supply' | 'cashflow';

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
