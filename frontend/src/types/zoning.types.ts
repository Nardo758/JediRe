export type EntitlementStatus = 'pre_application' | 'submitted' | 'under_review' | 'hearing' | 'approved' | 'denied' | 'withdrawn';
export type EntitlementType = 'rezone' | 'variance' | 'cup' | 'site_plan' | 'annexation' | 'lot_split' | 'sap' | 'other';
export type RiskLevel = 'low' | 'medium' | 'high';
export type AlertSeverity = 'critical' | 'warning' | 'watch' | 'info';
export type RegulatoryCategory = 'zoning_changes' | 'rent_control' | 'str_restrictions' | 'impact_fees' | 'inclusionary_housing' | 'environmental' | 'moratorium' | 'other';
export type TimelineScenario = 'by_right' | 'variance' | 'rezone';
export type ComparisonMode = 'district' | 'parcel' | 'jurisdiction';
export type ZoningTabId = 'boundary_zoning' | 'capacity' | 'hbu' | 'risk' | 'timeline';

// ============================================================================
// Development Path Selection (Phase 2 enhancement)
// ============================================================================

export type DevelopmentPath = 'by_right' | 'overlay_bonus' | 'variance' | 'rezone';

export interface BuildingEnvelope {
  max_units: number;
  max_gfa_sf: number;
  max_stories: number;
  max_footprint_sf: number;
  buildable_polygon: any | null; // GeoJSON.Polygon -> 3D model footprint
  required_parking_spaces: number;
  parking_structure_type: 'surface' | 'podium' | 'underground' | 'garage';
  parking_levels: number;
  residential_floors: number;
  ground_floor_retail_sf: number;
  construction_type: 'wood_frame' | 'podium_wood' | 'steel_concrete';
}

export interface SelectedPathData {
  pathId: DevelopmentPath;
  colKey: string;
  zoningCode: string | null;
  density: string | null;
  far: string | null;
  maxUnits: number;
  maxGba: number;
  maxStories: number;
  parkingRequired: number;
  bindingConstraint: string | null;
  appliedFar: number | null;
  risk: string | null;
  successRate: string | null;
  timeline: string | null;
  aiInsight: string | null;
  aiSummary: string | null;
  allCellData: Record<string, string>;
}

export interface PathAnalysis {
  envelope: BuildingEnvelope;
  entitlement_cost: number;
  entitlement_timeline_months: { min: number; median: number; max: number };
  construction_timeline_months: { min: number; median: number; max: number };
  total_construction_cost: number;
  estimated_exit_value: number;
  estimated_irr: number;
  risk_level: 'low' | 'moderate' | 'high' | 'very_high';
  approval_probability: number;
}

export interface DevCapacityOutput {
  selected_path: DevelopmentPath;
  selected_envelope: BuildingEnvelope;
  all_paths: {
    by_right: PathAnalysis;
    overlay_bonus: PathAnalysis | null;
    variance: PathAnalysis;
    rezone: PathAnalysis;
  };
  binding_constraint: 'density' | 'far' | 'height' | 'coverage' | 'parking';
}

/** Downstream to 3D Model (Design Dashboard) */
export interface ParcelFor3D {
  polygon: any; // GeoJSON.Polygon
  lot_size_sf: number;
  frontage: { road: string; length_ft: number }[];
  is_corner: boolean;
  topography: {
    min_elev_ft: number;
    max_elev_ft: number;
    avg_slope_pct: number;
  };
  setbacks: {
    front_ft: number;
    side_ft: number;
    rear_ft: number;
    stepped?: { threshold_ft: number; step_factor: number };
  };
  max_height_ft: number;
  max_lot_coverage_pct: number;
  open_space_required_pct: number;
  overlay_modifiers: {
    name: string;
    height_modifier_ft?: number;
    density_modifier_pct?: number;
    design_requirements?: string[];
  }[];
}

/** Downstream to Financial Model (M09 ProForma) */
export interface ZoningForFinance {
  max_density_units_per_acre: number;
  max_height_ft: number;
  far_allowed: number;
  far_applied: number;
  far_utilization_pct: number;
  parking_ratio: number;
  parking_guest_ratio: number;
  parking_reduction_eligible: boolean;
  open_space_pct: number;
  overlay_cost_impacts: {
    name: string;
    est_additional_cost: number;
    est_additional_months: number;
  }[];
  tree_mitigation_risk: boolean;
}

/** Full Tab 1 output — Boundary + Zoning combined */
export interface BoundaryAndZoningOutput {
  parcel: ParcelFor3D;
  zoning: {
    code: string;
    verification_status: 'MATCH' | 'MISMATCH' | 'UNVERIFIED';
    source_link: string;
    source_section: string;
    municipality: string;
    parameters: ZoningForFinance;
    permitted_uses: string[];
    conditional_uses: string[];
    overlay_districts: OverlayDistrict[];
  };
}

export interface OverlayDistrict {
  id: string;
  name: string;
  code: string;
  density_bonus_pct: number | null;
  height_modifier_ft: number | null;
  additional_requirements: string[];
  source_link: string | null;
}

export interface ZoningDistrict {
  id: string;
  code: string;
  name: string;
  municipalityId: string;
  municipality: string;
  state: string;
  maxDensityPerAcre: number | null;
  maxHeightFeet: number | null;
  maxFar: number | null;
  maxStories: number | null;
  maxLotCoveragePercent: number | null;
  minOpenSpacePercent: number | null;
  setbackFrontFt: number | null;
  setbackSideFt: number | null;
  setbackRearFt: number | null;
  minParkingPerUnit: number | null;
  guestParkingPerUnit: number | null;
  commercialParkingPer1000sf: number | null;
  bicycleParkingPerUnit: number | null;
  source: string;
  lastAmended: string | null;
  codeReference: string | null;
  specialConditions: Record<string, any> | null;
}

export interface Parcel {
  id: string;
  parcelNumber: string;
  address: string;
  zoningDistrictId: string;
  lotAreaSf: number;
  lotAreaAcres: number;
  geometry: any | null;
}

export interface PermittedUse {
  name: string;
  category: 'by_right' | 'conditional' | 'prohibited';
}

export interface DevelopmentParameters {
  maxDensity: number | null;
  maxHeight: number | null;
  maxFar: number | null;
  maxLotCoverage: number | null;
  minOpenSpace: number | null;
  setbacks: {
    front: number | null;
    side: number | null;
    rear: number | null;
  };
  parking: {
    residential: number | null;
    guest: number | null;
    commercial: number | null;
    bicycle: number | null;
  };
  aiNotes: string[];
}

export interface StrategyAlignment {
  strategy: string;
  status: 'compatible' | 'conditional' | 'incompatible';
  note: string;
}

export interface CapacityScenario {
  label: string;
  scenarioType: TimelineScenario;
  maxUnits: number;
  maxHeight: number;
  maxFar: number;
  maxGfa: number;
  parkingRequired: string;
  openSpace: number;
  timeline: string;
  cost: string;
  riskLevel: RiskLevel;
  successPercent: number;
  estimatedValue: number;
  deltaVsByRight: number;
  deltaPercent: number;
}

export interface StrategyArbitrageImpact {
  strategy: string;
  applicable: boolean;
  reason: string;
  scenarios: {
    label: string;
    irr: number | null;
    capRate: number | null;
    units: number;
  }[];
  bestPath: string | null;
}

export interface EntitlementMilestone {
  id: string;
  entitlementId: string;
  name: string;
  status: 'completed' | 'in_progress' | 'upcoming' | 'skipped';
  scheduledDate: string | null;
  actualDate: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface EntitlementContact {
  name: string;
  role: string;
  organization: string | null;
}

export interface EntitlementDocument {
  name: string;
  type: string;
  date: string;
  url: string | null;
}

export interface RiskFactor {
  type: 'positive' | 'warning' | 'neutral';
  text: string;
}

export interface Entitlement {
  id: string;
  dealId: string | null;
  parcelAddress: string;
  type: EntitlementType;
  fromDistrict: string | null;
  toDistrict: string | null;
  status: EntitlementStatus;
  riskLevel: RiskLevel;
  filedDate: string | null;
  nextMilestone: string | null;
  nextMilestoneDate: string | null;
  hearingDate: string | null;
  approvalDate: string | null;
  estCostLow: number | null;
  estCostHigh: number | null;
  estTimelineMonths: number | null;
  successProbability: number | null;
  documents: EntitlementDocument[];
  contacts: EntitlementContact[];
  aiRiskFactors: RiskFactor[];
  milestones: EntitlementMilestone[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryAlert {
  id: string;
  municipality: string;
  state: string;
  category: RegulatoryCategory;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  affectedStrategies: string[];
  sourceUrl: string | null;
  sourceName: string | null;
  publishedDate: string | null;
  expiresDate: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface MunicipalBenchmark {
  id: string;
  municipality: string;
  state: string;
  projectType: string;
  unitCountMin: number | null;
  unitCountMax: number | null;
  entitlementType: string;
  medianMonths: number;
  p25Months: number;
  p50Months: number;
  p75Months: number;
  p90Months: number;
  sampleSize: number;
  trend: 'improving' | 'stable' | 'worsening';
  lastUpdated: string;
}

export interface TimelinePhase {
  name: string;
  durationMonths: number;
  cumulativeMonths: number;
  capitalDeployed: number;
  status: 'completed' | 'in_progress' | 'upcoming';
  isParallel: boolean;
  parallelWith: string | null;
}

export interface CarryingCosts {
  interestCarry: number;
  propertyTax: number;
  insurance: number;
  entitlementCosts: number;
  softCosts: number;
  total: number;
  perUnit: number;
}

export interface FinancialImpact {
  projectIrr: number;
  equityMultiple: number;
  devMargin: number;
  cashOnCash: number;
}

export interface DealTimeline {
  id: string;
  dealId: string;
  scenario: TimelineScenario;
  phases: TimelinePhase[];
  totalMonths: number;
  expected: {
    months: number;
    carryingCosts: CarryingCosts;
    financialImpact: FinancialImpact;
  };
  delayed: {
    months: number;
    carryingCosts: CarryingCosts;
    financialImpact: FinancialImpact;
  };
  worst: {
    months: number;
    carryingCosts: CarryingCosts;
    financialImpact: FinancialImpact;
  };
  landBasis: number;
  loanAmount: number;
  loanRate: number;
}

export interface JurisdictionComparison {
  municipality: string;
  state: string;
  medianTts: number;
  rank: number;
  trend: 'improving' | 'stable' | 'worsening';
  carryCostDelta: number;
  carryCostDeltaLabel: string;
}

export interface CapitalCall {
  callNumber: number;
  purpose: string;
  date: string;
  amount: number;
}

export interface ZoningComparison {
  mode: ComparisonMode;
  itemA: ZoningDistrict | Parcel | JurisdictionSummary;
  itemB: ZoningDistrict | Parcel | JurisdictionSummary;
  deltas: ComparisonDelta[];
  aiSynthesis: string | null;
}

export interface JurisdictionSummary {
  municipality: string;
  state: string;
  avgPermitTimeline: number;
  impactFees: number;
  avgDensity: number;
  regulatoryEnvironment: string;
}

export interface ComparisonDelta {
  field: string;
  label: string;
  valueA: string | number | null;
  valueB: string | number | null;
  delta: number | null;
  advantage: 'a' | 'b' | 'neutral';
  citationA?: { section: string; url?: string };
  citationB?: { section: string; url?: string };
}

export interface ZoningLookupResult {
  district: ZoningDistrict;
  parameters: DevelopmentParameters;
  permittedUses: PermittedUse[];
  strategyAlignment: StrategyAlignment[];
  variancePotential: {
    byRightUnits: number;
    varianceUnits: number;
    delta: number;
    deltaPercent: number;
    variancePath: string;
    estTimeline: string;
    estCost: string;
    successRate: number;
    aiRecommendation: string;
  } | null;
}

export interface ZoningModuleState {
  activeTab: ZoningTabId;
  selectedParcel: Parcel | null;
  selectedZoning: ZoningDistrict | null;
  entitlements: Entitlement[];
  entitlementFilter: {
    market: string | null;
    status: EntitlementStatus | null;
    type: EntitlementType | null;
    dealId: string | null;
    sortBy: string;
  };
  capacityScenarios: CapacityScenario[];
  regulatoryAlerts: RegulatoryAlert[];
  selectedJurisdiction: string | null;
  comparisonMode: ComparisonMode;
  comparisonA: any | null;
  comparisonB: any | null;
  selectedDealForTimeline: string | null;
  timelineScenario: TimelineScenario;
  municipalBenchmarks: MunicipalBenchmark[];
  dealTimeline: DealTimeline | null;
  timelineComparisonMarkets: string[];
  layerVisibility: Record<string, boolean>;

  // Phase 2: Development Path Selection
  development_path: DevelopmentPath | null;
  selected_envelope: BuildingEnvelope | null;
  selected_path_data: SelectedPathData | null;
  path_target_code: string | null;

  setActiveTab: (tab: ZoningTabId) => void;
  selectParcel: (parcel: Parcel | null) => void;
  setSelectedZoning: (zoning: ZoningDistrict | null) => void;
  setEntitlements: (entitlements: Entitlement[]) => void;
  updateEntitlementFilter: (filter: Partial<ZoningModuleState['entitlementFilter']>) => void;
  setCapacityScenarios: (scenarios: CapacityScenario[]) => void;
  setRegulatoryAlerts: (alerts: RegulatoryAlert[]) => void;
  setSelectedJurisdiction: (jurisdiction: string | null) => void;
  setComparisonMode: (mode: ComparisonMode) => void;
  setComparisonItems: (a: any, b: any) => void;
  setTimelineScenario: (scenario: TimelineScenario) => void;
  setDealTimeline: (timeline: DealTimeline | null) => void;
  setMunicipalBenchmarks: (benchmarks: MunicipalBenchmark[]) => void;
  toggleLayer: (layerId: string) => void;
  selectDevelopmentPath: (path: DevelopmentPath | null, envelope: BuildingEnvelope | null, pathData?: SelectedPathData | null) => void;
}
