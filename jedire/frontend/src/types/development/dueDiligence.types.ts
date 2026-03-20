/**
 * Due Diligence Types - Development-Specific
 * Types for managing pre-development investigations and entitlement tracking
 */

// ===== OVERALL DUE DILIGENCE STATUS =====

export type DDStatus = 'not_started' | 'in_progress' | 'complete' | 'issue' | 'blocked';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DueDiligenceState {
  id: string;
  dealId: string;
  parcels: ParcelDueDiligence[];
  overallProgress: number; // 0-100
  overallRisk: RiskLevel;
  criticalPathItem?: string;
  lastUpdated: string;
}

// ===== PARCEL-SPECIFIC DUE DILIGENCE =====

export interface ParcelDueDiligence {
  parcelId: string;
  address: string;
  parcelType: 'main' | 'adjacent' | 'assemblage';
  progress: number; // 0-100
  title: DDItemStatus;
  survey: DDItemStatus;
  environmental: DDItemStatus;
  geotechnical: DDItemStatus;
  zoning: DDItemStatus;
  utilities: DDItemStatus;
}

export interface DDItemStatus {
  status: DDStatus;
  completedDate?: string;
  dueDate?: string;
  notes?: string;
  documents?: string[]; // Document IDs
  riskLevel?: RiskLevel;
}

// ===== ZONING & ENTITLEMENTS =====

export interface ZoningAnalysis {
  id: string;
  dealId: string;
  currentZoning: string;
  byRightUnits: number;
  byRightHeight: number; // feet
  byRightFAR: number;
  upzoningPotential?: UpzoningScenario;
  communitySupport: 'supportive' | 'neutral' | 'opposed' | 'mixed' | 'unknown';
  councilMemberPosition?: 'supportive' | 'neutral' | 'opposed' | 'unknown';
  lastUpdated: string;
}

export interface UpzoningScenario {
  proposedZoning: string;
  proposedUnits: number;
  proposedHeight: number;
  proposedFAR: number;
  processTimeline: number; // months
  successLikelihood: number; // 0-100%
  estimatedCost: number;
  keyRequirements: string[];
}

export interface EntitlementChecklist {
  id: string;
  dealId: string;
  items: EntitlementItem[];
  timeline: EntitlementTimeline[];
  overallStatus: 'not_started' | 'in_progress' | 'approved' | 'denied' | 'appealing';
}

export interface EntitlementItem {
  id: string;
  type: 'rezoning' | 'variance' | 'conditional_use' | 'site_plan' | 'building_permit' | 'other';
  name: string;
  required: boolean;
  status: DDStatus;
  filingDate?: string;
  hearingDate?: string;
  approvalDate?: string;
  expirationDate?: string;
  notes?: string;
  documents?: string[];
}

export interface EntitlementTimeline {
  id: string;
  stage: string;
  description: string;
  estimatedStart: string;
  estimatedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'delayed';
  dependencies?: string[]; // IDs of prerequisite stages
}

// ===== ENVIRONMENTAL & GEOTECHNICAL =====

export interface EnvironmentalAssessment {
  id: string;
  dealId: string;
  parcelId?: string;
  phaseI: PhaseIESA;
  phaseII?: PhaseIIESA;
  remediation?: RemediationPlan;
  overallRisk: RiskLevel;
}

export interface PhaseIESA {
  status: DDStatus;
  completedDate?: string;
  findings: 'clean' | 'rec' | 'concern' | 'pending';
  recognizedEnvironmentalConditions: string[];
  phaseIIRequired: boolean;
  reportDocId?: string;
  cost: number;
}

export interface PhaseIIESA {
  status: DDStatus;
  completedDate?: string;
  contaminantsFound: string[];
  remediationRequired: boolean;
  estimatedCost: number;
  timeline: number; // weeks
  reportDocId?: string;
  cost: number;
}

export interface RemediationPlan {
  description: string;
  estimatedCost: number;
  timeline: number; // weeks
  impact: 'minimal' | 'moderate' | 'significant';
  contractor?: string;
  permitRequired: boolean;
}

export interface GeotechnicalReport {
  id: string;
  dealId: string;
  parcelId?: string;
  status: DDStatus;
  completedDate?: string;
  soilConditions: SoilLayer[];
  waterTableDepth: number; // feet
  foundationRecommendation: FoundationRecommendation;
  specialConsiderations: string[];
  reportDocId?: string;
  cost: number;
}

export interface SoilLayer {
  depthStart: number; // feet
  depthEnd: number; // feet
  description: string;
  bearingCapacity?: number; // psf
}

export interface FoundationRecommendation {
  type: 'spread_footing' | 'mat' | 'auger_cast_piles' | 'driven_piles' | 'other';
  depth: number; // feet
  costImpact: number; // $ above standard
  specialRequirements: string[];
  dewateringRequired: boolean;
  shoringRequired: boolean;
}

// ===== UTILITY CAPACITY =====

export interface UtilityCapacity {
  id: string;
  dealId: string;
  water: UtilityService;
  sewer: UtilityService;
  electric: UtilityService;
  gas: UtilityService;
  telecom?: UtilityService;
  overallStatus: 'adequate' | 'upgrade_needed' | 'insufficient' | 'unknown';
}

export interface UtilityService {
  available: boolean;
  mainSize?: string; // e.g., "12 inch"
  capacity: 'adequate' | 'marginal' | 'insufficient' | 'unknown';
  currentUtilization?: number; // % used
  upgradeRequired: boolean;
  upgradeCost?: number;
  upgradeTimeline?: number; // weeks
  provider: string;
  serviceVoltage?: string; // for electric
  substationDistance?: number; // miles, for electric
  notes?: string;
}

// ===== ASSEMBLAGE DUE DILIGENCE =====

export interface AssemblageDueDiligence {
  id: string;
  dealId: string;
  parcels: ParcelDueDiligence[];
  overallProgress: number;
  criticalPathParcel?: string;
  synchronizationRisks: string[];
  closingStrategy: 'simultaneous' | 'sequential' | 'contingent';
  estimatedTotalCost: number;
}

// ===== RISK MATRIX =====

export interface RiskMatrix {
  id: string;
  dealId: string;
  risks: RiskItem[];
  overallRiskScore: number; // 0-100
  lastUpdated: string;
}

export interface RiskItem {
  id: string;
  category: 'entitlement' | 'environmental' | 'geotechnical' | 'utility' | 'assemblage' | 'financial' | 'other';
  description: string;
  probability: number; // 0-100%
  impact: number; // 0-10 scale
  riskScore: number; // probability * impact
  mitigationPlan?: string;
  status: 'identified' | 'monitoring' | 'mitigating' | 'resolved' | 'accepted';
  owner?: string;
  createdDate: string;
  updatedDate?: string;
}

// ===== AI INSIGHTS =====

export interface DDInsights {
  criticalRisks: string[];
  recommendedActions: ActionItem[];
  timelineImpacts: TimelineImpact[];
  costImpacts: CostImpact[];
  goNoGoRecommendation?: 'go' | 'proceed_with_caution' | 'no_go';
  confidence: number; // 0-100%
}

export interface ActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  reasoning: string;
  estimatedImpact?: string;
}

export interface TimelineImpact {
  item: string;
  delayWeeks: number;
  criticalPath: boolean;
  recommendation: string;
}

export interface CostImpact {
  item: string;
  costChange: number;
  category: 'hard_cost' | 'soft_cost' | 'timeline' | 'contingency';
  recommendation: string;
}
