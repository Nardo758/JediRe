/**
 * Type Definitions
 * Shared TypeScript types for the entire application
 */

// User types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: 'user' | 'agent' | 'admin';
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Property types
export interface Property {
  id: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateCode: string;
  zipCode: string;
  county?: string;
  latitude: number;
  longitude: number;
  zoningDistrictId?: string;
  zoningCode?: string;
  lotSizeSqft?: number;
  buildingSqft?: number;
  yearBuilt?: number;
  bedrooms?: number;
  bathrooms?: number;
  currentUse?: string;
  propertyType?: 'residential' | 'commercial' | 'mixed-use' | 'vacant';
  analyzedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Zoning types
export interface ZoningDistrict {
  id: string;
  municipality: string;
  stateCode: string;
  county?: string;
  districtCode: string;
  districtName?: string;
  districtDescription?: string;
  dataSource?: string;
  lastUpdated: Date;
}

export interface ZoningRules {
  id: string;
  districtId: string;
  permittedUses?: string[];
  conditionalUses?: string[];
  prohibitedUses?: string[];
  minLotSizeSqft?: number;
  maxDensityUnitsPerAcre?: number;
  maxCoveragePercent?: number;
  frontSetbackFt?: number;
  rearSetbackFt?: number;
  sideSetbackFt?: number;
  maxHeightFt?: number;
  maxStories?: number;
  parkingSpacesPerUnit?: number;
  parkingSpacesPerSqft?: number;
  fullCodeText?: string;
}

// Analysis types
export interface PropertyAnalysis {
  id: string;
  propertyId: string;
  userId: string;
  agentType: 'zoning' | 'supply' | 'cashflow' | 'demand' | 'price' | 'news';
  results: Record<string, any>;
  opportunityScore?: number;
  confidenceScore?: number;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
  analysisDurationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Collaboration types
export interface CollaborationSession {
  id: string;
  name?: string;
  ownerId: string;
  isActive: boolean;
  isPublic: boolean;
  shareLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
  lastSeenAt: Date;
}

export interface PropertyPin {
  id: string;
  sessionId: string;
  propertyId: string;
  userId: string;
  color?: string;
  icon?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertyComment {
  id: string;
  propertyId: string;
  userId: string;
  sessionId?: string;
  content: string;
  parentCommentId?: string;
  mentionedUsers?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Market types
export interface MarketInventory {
  id: string;
  city: string;
  stateCode: string;
  zipCode?: string;
  activeListings?: number;
  medianPrice?: number;
  avgDaysOnMarket?: number;
  absorptionRate?: number;
  propertyType?: string;
  snapshotDate: Date;
  createdAt: Date;
}

// Agent task types
export interface AgentTask {
  id: string;
  taskType: string;
  inputData: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  outputData?: Record<string, any>;
  errorMessage?: string;
  priority: number;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  userId?: string;
  retryCount: number;
  maxRetries: number;
  executionTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  count: number;
  limit: number;
  offset: number;
  total?: number;
}

// Geospatial types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// WebSocket event types
export interface SocketEvent {
  type: string;
  data: any;
  timestamp: number;
}

export interface CursorPosition {
  userId: string;
  email: string;
  lat: number;
  lng: number;
  timestamp: number;
}
