export interface DueDiligenceState {
  id: string;
  dealId: string;
  status: 'not_started' | 'in_progress' | 'complete' | 'flagged';
  progress: number;
  completedItems: number;
  totalItems: number;
  startDate?: string;
  targetDate?: string;
  lastUpdated: string;
  categories: DDCategory[];
}

export interface DDCategory {
  id: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'complete' | 'flagged';
  progress: number;
  items: DDItem[];
}

export interface DDItem {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'complete' | 'flagged' | 'na';
  assignee?: string;
  dueDate?: string;
  notes?: string;
  documents?: string[];
}

export interface ZoningAnalysis {
  currentZoning: string;
  proposedUse: string;
  allowedUses: string[];
  conditionalUses: string[];
  maxDensity: number;
  maxHeight: number;
  farAllowed: number;
  setbacks: {
    front: number;
    side: number;
    rear: number;
  };
  parkingRequirements: {
    residential: number;
    commercial: number;
  };
  overlayDistricts: string[];
  variancesNeeded: string[];
  entitlementTimeline: number;
  status: 'conforming' | 'non_conforming' | 'variance_needed' | 'rezoning_needed';
}

export interface EnvironmentalAssessment {
  id: string;
  type: 'Phase I' | 'Phase II' | 'Phase III';
  status: 'pending' | 'in_progress' | 'complete' | 'flagged';
  findings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost?: number;
  remediationNeeded: boolean;
  completionDate?: string;
}

export interface GeotechnicalReport {
  id: string;
  status: 'pending' | 'in_progress' | 'complete';
  soilType: string;
  bearingCapacity: number;
  waterTable: number;
  seismicZone?: string;
  foundationType: string;
  specialConsiderations: string[];
  completionDate?: string;
}

export interface UtilityCapacity {
  water: UtilityService;
  sewer: UtilityService;
  electric: UtilityService;
  gas: UtilityService;
  telecom: UtilityService;
  stormwater: UtilityService;
}

export interface UtilityService {
  available: boolean;
  provider: string;
  capacity: 'adequate' | 'upgrade_needed' | 'unavailable';
  connectionCost?: number;
  upgradeRequired?: boolean;
  timeline?: string;
  notes?: string;
}

export interface AssemblageDueDiligence {
  parcels: ParcelDD[];
  totalArea: number;
  estimatedValue: number;
  acquisitionStatus: 'not_started' | 'in_progress' | 'complete';
  challenges: string[];
}

export interface ParcelDD {
  id: string;
  address: string;
  owner: string;
  area: number;
  estimatedValue: number;
  status: 'not_contacted' | 'negotiating' | 'under_contract' | 'acquired' | 'declined';
  notes?: string;
}

export interface RiskMatrix {
  categories: RiskCategory[];
  overallScore: number;
  overallLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskCategory {
  name: string;
  probability: number;
  impact: number;
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  mitigations: string[];
}

export interface DDInsights {
  summary: string;
  keyFindings: string[];
  recommendations: DDRecommendation[];
  riskAlerts: string[];
  overallScore: number;
}

export interface DDRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  estimatedImpact?: string;
}
