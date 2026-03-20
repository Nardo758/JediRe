export type DealType = 'existing_acquisition' | 'new_development' | 'redevelopment';
export type ModuleId = string;
export type StrategyId = 'value_add' | 'core_plus' | 'core' | 'opportunistic' | 'development' | 'distressed';
export type DDChecklistPreset = 'existing_acquisition' | 'new_development' | 'redevelopment';

export interface DDChecklistCategory {
  category: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  items?: string[];
}

export interface DealTypeConfig {
  label: string;
  strategies: StrategyId[];
  defaultStrategy: StrategyId;
  ddPreset: DDChecklistPreset;
  riskWeightProfile: string;
  moduleIds: ModuleId[];
}

export const DEAL_TYPE_CONFIG: Record<DealType, DealTypeConfig> = {
  existing_acquisition: {
    label: 'Existing Acquisition',
    strategies: ['value_add', 'core_plus', 'core'],
    defaultStrategy: 'value_add',
    ddPreset: 'existing_acquisition',
    riskWeightProfile: 'acquisition',
    moduleIds: ['M01','M03','M04','M05','M06','M07','M08','M09','M10','M15','M18','M20','M33'],
  },
  new_development: {
    label: 'New Development',
    strategies: ['development', 'opportunistic'],
    defaultStrategy: 'development',
    ddPreset: 'new_development',
    riskWeightProfile: 'development',
    moduleIds: ['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M15','M18','M20','M33'],
  },
  redevelopment: {
    label: 'Redevelopment',
    strategies: ['value_add', 'opportunistic', 'development'],
    defaultStrategy: 'opportunistic',
    ddPreset: 'redevelopment',
    riskWeightProfile: 'redevelopment',
    moduleIds: ['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M15','M18','M20','M33'],
  },
};

export function getDealType(opts: { projectType?: string } | any): DealType {
  const pt = opts?.projectType || opts?.project_type || opts?.dealType || '';
  if (pt === 'development' || pt === 'new_development') return 'new_development';
  if (pt === 'redevelopment') return 'redevelopment';
  return 'existing_acquisition';
}

export function getDealTypeConfig(opts: { projectType?: string } | any): DealTypeConfig {
  return DEAL_TYPE_CONFIG[getDealType(opts)];
}

export function getDDChecklistPreset(dealType: DealType): DDChecklistPreset {
  return DEAL_TYPE_CONFIG[dealType]?.ddPreset ?? 'existing_acquisition';
}

export function getAvailableStrategies(dealType: DealType): StrategyId[] {
  return DEAL_TYPE_CONFIG[dealType]?.strategies ?? ['value_add'];
}

export function getRiskWeightProfile(dealType: DealType): string {
  return DEAL_TYPE_CONFIG[dealType]?.riskWeightProfile ?? 'acquisition';
}

export const DD_CHECKLISTS: Record<DDChecklistPreset, DDChecklistCategory[]> = {
  existing_acquisition: [
    { category: 'Physical Due Diligence', priority: 'critical', items: ['Property Inspection', 'Environmental Assessment', 'Structural Review'] },
    { category: 'Financial Due Diligence', priority: 'critical', items: ['Rent Roll Verification', 'Expense Review', 'NOI Validation'] },
    { category: 'Legal Due Diligence', priority: 'high', items: ['Title Review', 'Survey', 'Lease Review'] },
    { category: 'Market Due Diligence', priority: 'high', items: ['Comparable Analysis', 'Market Study', 'Demand Assessment'] },
    { category: 'Regulatory Review', priority: 'medium', items: ['Zoning Confirmation', 'Permit Review', 'Code Compliance'] },
  ],
  new_development: [
    { category: 'Site Due Diligence', priority: 'critical', items: ['Geotechnical Study', 'Environmental Assessment', 'Survey'] },
    { category: 'Entitlement Review', priority: 'critical', items: ['Zoning Analysis', 'Permit Pre-Application', 'Community Outreach'] },
    { category: 'Financial Due Diligence', priority: 'critical', items: ['Construction Budget', 'Pro Forma Review', 'Financing Analysis'] },
    { category: 'Legal Due Diligence', priority: 'high', items: ['Title Review', 'Development Agreement', 'Easements'] },
    { category: 'Market Due Diligence', priority: 'high', items: ['Absorption Study', 'Competitive Analysis', 'Demand Forecast'] },
  ],
  redevelopment: [
    { category: 'Existing Conditions', priority: 'critical', items: ['Building Assessment', 'Environmental Study', 'Structural Analysis'] },
    { category: 'Entitlement Review', priority: 'critical', items: ['Zoning Variance', 'Historic Review', 'Permit Strategy'] },
    { category: 'Financial Due Diligence', priority: 'critical', items: ['Renovation Budget', 'Pro Forma', 'Tax Credit Analysis'] },
    { category: 'Legal Due Diligence', priority: 'high', items: ['Title Review', 'Existing Leases', 'Liens and Encumbrances'] },
    { category: 'Market Due Diligence', priority: 'high', items: ['Repositioning Analysis', 'Rent Gap Study', 'Competitive Set'] },
  ],
};

export const RISK_WEIGHTS: Record<string, Record<string, number>> = {
  acquisition: {
    supply: 0.20,
    demand: 0.25,
    regulatory: 0.15,
    market: 0.20,
    execution: 0.10,
    climate: 0.10,
  },
  development: {
    supply: 0.15,
    demand: 0.20,
    regulatory: 0.25,
    market: 0.15,
    execution: 0.15,
    climate: 0.10,
  },
  redevelopment: {
    supply: 0.15,
    demand: 0.20,
    regulatory: 0.20,
    market: 0.15,
    execution: 0.20,
    climate: 0.10,
  },
};

export const MODULE_TABS: Array<{
  moduleId: ModuleId;
  label?: string;
  variants?: Partial<Record<DealType, { documentCategories?: string[]; [key: string]: any }>>;
}> = [
  {
    moduleId: 'M18',
    label: 'Documents & Files',
    variants: {
      existing_acquisition: {
        documentCategories: ['purchase_agreement', 'rent_roll', 'financials', 'inspection', 'title', 'environmental', 'legal', 'insurance', 'marketing'],
      },
      new_development: {
        documentCategories: ['land_contract', 'entitlements', 'plans', 'permits', 'financing', 'construction', 'legal', 'environmental', 'marketing'],
      },
      redevelopment: {
        documentCategories: ['purchase_agreement', 'existing_conditions', 'plans', 'entitlements', 'financing', 'construction', 'legal', 'environmental', 'marketing'],
      },
    },
  },
];
