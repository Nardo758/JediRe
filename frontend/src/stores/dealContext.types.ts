export type DataSource = 'user' | 'platform' | 'broker' | 'mock' | 'api' | 'agent';

export interface LayeredValue<T> {
  value: T;
  source: DataSource | null;
  confidence: number | null;
}

export function layered<T>(value: T, source?: DataSource, confidence?: number): LayeredValue<T> {
  return { value, source: source ?? null, confidence: confidence ?? null };
}

export type DealMode = 'existing' | 'development' | 'redevelopment';

export type DealStage =
  | 'lead'
  | 'pipeline'
  | 'active'
  | 'under_contract'
  | 'due_diligence'
  | 'closed'
  | 'owned'
  | 'archived';

export type StrategyType =
  | 'value_add'
  | 'core_plus'
  | 'core'
  | 'opportunistic'
  | 'development'
  | 'distressed';

export interface UnitMixRow {
  id: string;
  type: string;
  count: number;
  avgSF: number;
  targetRent: number;
  rentPsf?: number;
}

export interface DevelopmentPath {
  id: string;
  label: string;
  description?: string;
  unitMixProgram: UnitMixRow[];
  totalUnits?: number;
  maxGFA?: number;
  maxStories?: number;
  bindingConstraint?: string;
  parkingSpaces?: number;
  estimatedTDC?: number;
  selectedAt?: string | null;
}

export interface DealContext {
  zoningOutput: any | null;
  identity: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    county: string;
    parcelIds: string[];
    coordinates: { lat: number; lng: number };
    mode: DealMode;
    stage: DealStage;
    createdAt: string;
    updatedAt: string;
  };
  projectType: 'existing' | 'development' | 'redevelopment';
  productType: string;
  site: {
    acreage: LayeredValue<number>;
    buildableAcreage: LayeredValue<number>;
    boundary: any | null;
    constraints: any[];
    floodZone: LayeredValue<null | string>;
  };
  zoning: {
    designation: LayeredValue<string>;
    maxDensity: LayeredValue<number>;
    maxHeight: LayeredValue<number>;
    maxFAR: LayeredValue<number>;
    maxLotCoverage: LayeredValue<number>;
    setbacks: LayeredValue<{ front: number; side: number; rear: number }>;
    parkingRatio: LayeredValue<number>;
    guestParkingRatio: LayeredValue<number>;
    sourceUrl: string | null;
    verified: boolean;
    overlays: any[];
  };
  developmentPaths: DevelopmentPath[];
  selectedDevelopmentPathId: string | null;
  developmentEnvelope: {
    max_units: number;
    max_gfa: number;
    max_stories: number;
    units_per_floor: number;
    binding_constraint: string;
    selected_path: string;
    parking: { type: string; spaces: number; cost_per_space: number };
    buildable_area_sf: number;
    impact_fee_credit_units: number;
  } | null;
  existingProperty: { unitMixProgram: UnitMixRow[] } | null;
  resolvedUnitMix: UnitMixRow[];
  unitMixOverrides: Record<string, Partial<Pick<UnitMixRow, 'count' | 'avgSF' | 'targetRent'>>>;
  totalUnits: number;
  market: {
    submarketName: string;
    submarketId: string;
    avgRent: LayeredValue<number>;
    avgOccupancy: LayeredValue<number>;
    rentGrowthYoY: LayeredValue<number>;
    absorptionRate: LayeredValue<number>;
    medianHHI: LayeredValue<number>;
    popGrowthPct: LayeredValue<number>;
    employmentGrowthPct: LayeredValue<number>;
  };
  supply: {
    pipelineUnits: LayeredValue<number>;
    supplyPressureRatio: number;
    monthsOfSupply: number;
    projects: any[];
  };
  financial: {
    assumptions: {
      rentGrowth: LayeredValue<number>;
      expenseGrowth: LayeredValue<number>;
      vacancy: LayeredValue<number>;
      exitCapRate: LayeredValue<number>;
      holdPeriod: LayeredValue<number>;
      capexPerUnit: LayeredValue<number>;
      managementFee: LayeredValue<number>;
    };
  };
  capital: {
    totalCapital: LayeredValue<number>;
    debt: any[];
    equity: any[];
  };
  strategy: {
    scores?: any;
    selectedStrategy?: StrategyType | null;
    arbitrageGap?: number | null;
    arbitrageAlert?: boolean;
    verdict?: string;
  };
  scores: {
    overall: number;
    demand: number;
    supply: number;
    momentum: number;
    position: number;
    risk: number;
    score30dAgo: number | null;
    confidence: number;
    verdict: string;
  };
  risk: {
    overall: number;
    categories: { supply: number; demand: number; regulatory: number; market: number; execution: number; climate: number };
    topRisk: { category: string; score: number; detail: string; mitigationAvailable: boolean };
  };
  hydrationStatus: {
    [section: string]: { hydrated: boolean; lastFetchedAt: string | null; source: DataSource };
  };
  stageHistory: any[];
}

export function getSelectedPath(state: DealContext): DevelopmentPath | null {
  if (!state.selectedDevelopmentPathId) return null;
  return state.developmentPaths.find(p => p.id === state.selectedDevelopmentPathId) ?? null;
}

export function resolveUnitMix(
  base: UnitMixRow[],
  overrides: DealContext['unitMixOverrides']
): UnitMixRow[] {
  return base.map(row => {
    const override = overrides[row.id];
    if (!override) return row;
    return { ...row, ...override };
  });
}
