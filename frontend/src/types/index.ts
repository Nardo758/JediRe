// ============================================================================
// JEDI RE - TypeScript Type Definitions
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  tier: 'basic' | 'pro' | 'enterprise';
  maxDeals: number;
  createdAt: string;
}

export interface Deal {
  id: string;
  userId: string;
  name: string;
  projectType: 'multifamily' | 'mixed_use' | 'office' | 'retail' | 'industrial' | 'land';
  projectIntent?: string;
  targetUnits?: number;
  budget?: number;
  timelineStart?: string;
  timelineEnd?: string;
  status: 'active' | 'archived' | 'closed';
  tier: 'basic' | 'pro' | 'enterprise';
  boundary: GeoJSONPolygon;
  acres: number;
  center?: GeoJSONPoint;
  pipelineStage?: string;
  daysInStage?: number;
  propertyCount: number;
  emailCount: number;
  taskCount: number;
  completedTasks: number;
  createdAt: string;
  updatedAt: string;
}

export interface DealModule {
  moduleName: 'map' | 'properties' | 'strategy' | 'market' | 'pipeline' | 'reports' | 'team';
  isEnabled: boolean;
  settings: Record<string, any>;
}

export interface Property {
  id: string;
  address: string;
  lat: number;
  lng: number;
  rent: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  class?: 'A' | 'A+' | 'B' | 'B+' | 'C' | 'C+';
  yearBuilt?: number;
  amenities?: string[];
  photos?: string[];
  comparableScore?: number;
  relationship?: 'comparable' | 'target' | 'competitor' | 'other';
  notes?: string;
  distanceMiles?: number;
}

export interface DealProperty {
  id: string;
  dealId: string;
  propertyId: string;
  relationship: 'comparable' | 'target' | 'competitor' | 'other';
  notes?: string;
  linkedBy: 'auto' | 'manual';
  confidenceScore?: number;
  createdAt: string;
}

export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  parsedEntities?: {
    addresses?: string[];
    contacts?: string[];
    dealReferences?: string[];
    intent?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    actionItems?: string[];
  };
  createdAt: string;
}

export interface DealEmail {
  id: string;
  dealId: string;
  emailId: string;
  confidenceScore: number;
  linkedBy: 'ai' | 'manual';
  createdAt: string;
}

export interface DealAnnotation {
  id: string;
  dealId: string;
  type: 'marker' | 'polygon' | 'line' | 'text' | 'circle';
  geometry: GeoJSONGeometry;
  icon?: string;
  color?: string;
  label?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealPipeline {
  id: string;
  dealId: string;
  stage: 'lead' | 'qualified' | 'due_diligence' | 'under_contract' | 'closing' | 'closed' | 'post_close';
  enteredStageAt: string;
  daysInStage: number;
  notes?: string;
  stageHistory: Array<{
    stage: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface DealTask {
  id: string;
  dealId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface DealActivity {
  id: string;
  dealId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AnalysisResult {
  id: string;
  dealId?: string;
  type: 'signal' | 'capacity' | 'imbalance' | 'jedi';
  inputData: Record<string, any>;
  outputData: {
    score?: number;
    verdict?: string;
    confidence?: number;
    signals?: any;
    capacity?: any;
    imbalance?: any;
    recommendations?: string[];
  };
  confidence: number;
  createdAt: string;
}

// GeoJSON Types
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [[[lng, lat], ...]]
}

export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: any;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  offset: number;
}

// API Request Types
export interface CreateDealRequest {
  name: string;
  boundary: GeoJSONPolygon;
  projectType: Deal['projectType'];
  projectIntent?: string;
  targetUnits?: number;
  budget?: number;
  timelineStart?: string;
  timelineEnd?: string;
}

export interface UpdateDealRequest {
  name?: string;
  boundary?: GeoJSONPolygon;
  projectIntent?: string;
  budget?: number;
  status?: Deal['status'];
}

export interface PropertySearchFilters {
  class?: string;
  minRent?: number;
  maxRent?: number;
  beds?: number;
  baths?: number;
  limit?: number;
  offset?: number;
}

// Component Props Types
export interface DealViewProps {
  dealId: string;
}

export interface PropertyListProps {
  dealId: string;
  properties: Property[];
  onPropertyClick: (property: Property) => void;
}

export interface PropertyCardProps {
  property: Property;
  onClick?: () => void;
}

export interface MapViewProps {
  deal: Deal;
  properties?: Property[];
  annotations?: DealAnnotation[];
  onBoundaryUpdate?: (boundary: GeoJSONPolygon) => void;
}

export interface StrategyAnalysisProps {
  dealId: string;
  analysis?: AnalysisResult;
}

export interface DealSidebarProps {
  deal: Deal;
  modules: DealModule[];
  currentModule: string;
  onModuleChange: (module: string) => void;
}
