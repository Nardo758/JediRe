// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Deal Capsule Tab Visibility Architecture
// ═══════════════════════════════════════════════════════════════════════════════
//
// Three deal types control which modules are visible and how they behave:
//   - existing:       Buying an operating property (stabilized or value-add)
//   - development:    Ground-up new construction on vacant or cleared land
//   - redevelopment:  Tear-down, gut-rehab, or major repositioning of existing
//
// Each module can be:
//   - "full"    → Visible, standard content
//   - "variant" → Visible, but content/template/weights change per deal type
//   - "hidden"  → Tab not rendered in sidebar navigation
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Core Types ──────────────────────────────────────────────────────────────

export type DealType = 'existing' | 'development' | 'redevelopment';

export type TabVisibility = 'full' | 'variant' | 'hidden';

export type StationId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';

export type ModuleId =
  | 'M01' | 'M02' | 'M03' | 'M04' | 'M05' | 'M06' | 'M07' | 'M08'
  | 'M09' | 'M10' | 'M11' | 'M12' | 'M13' | 'M14' | 'M15'
  | 'M17' | 'M18' | 'M22';

export type FKey =
  | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8'
  | 'F9' | 'F10' | 'F11' | 'F12' | null;

/** Strategy columns available per deal type */
export type StrategyId = 'BTS' | 'FLIP' | 'RENTAL' | 'STR';

/** ProForma template driven by deal type */
export type ProFormaTemplate = 'acquisition' | 'development' | 'redevelopment';

/** DD checklist preset driven by deal type */
export type DDChecklistPreset = 'existing_acquisition' | 'ground_up' | 'redevelopment';

/** Risk weight profile driven by deal type */
export type RiskWeightProfile = 'existing' | 'development' | 'redevelopment';

// ─── Variant Configuration ───────────────────────────────────────────────────

/**
 * When a module is "variant", this describes HOW it changes per deal type.
 * Each variant type maps to specific behavioral differences.
 */
export interface VariantConfig {
  /** Human-readable description of what changes */
  description: string;

  /** For M08 Strategy: which strategy columns are visible */
  strategies?: StrategyId[];

  /** For M09 ProForma: which template to load */
  proformaTemplate?: ProFormaTemplate;

  /** For M13 DD: which checklist preset to load */
  ddPreset?: DDChecklistPreset;

  /** For M14 Risk: which weight profile to apply */
  riskWeights?: RiskWeightProfile;

  /** For M02 Zoning: how many sub-tabs to show */
  zoningDepth?: 'simplified' | 'full';

  /** For M11 Capital: which debt instruments are primary */
  debtInstruments?: string[];

  /** For M18 Documents: which document categories to show */
  documentCategories?: string[];

  /** For M07 Traffic: what data sources are available */
  trafficScope?: 'property_and_trade_area' | 'trade_area_only' | 'property_current_plus_trade_area';
}

// ─── Module Definition ───────────────────────────────────────────────────────

export interface ModuleTabDefinition {
  moduleId: ModuleId;
  name: string;
  fKey: FKey;
  station: StationId;
  stationLabel: string;
  category: 'Core' | 'Intelligence' | 'Financial' | 'Operations';

  /** Visibility per deal type */
  showFor: Record<DealType, TabVisibility>;

  /** When visibility is "variant", this describes the variant behavior */
  variants?: Partial<Record<DealType, VariantConfig>>;

  /** Parent module ID if this is a sub-tab (e.g., M06 is sub of M05) */
  parentModule?: ModuleId;

  /** Short description of what changes between deal types */
  dealTypeNotes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE TAB REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export const MODULE_TABS: ModuleTabDefinition[] = [

  // ─── S1: Intake & Triage ───────────────────────────────────────────────────

  {
    moduleId: 'M01',
    name: 'Deal Overview',
    fKey: 'F1',
    station: 'S1',
    stationLabel: 'Intake & Triage',
    category: 'Core',
    showFor: { existing: 'full', development: 'full', redevelopment: 'full' },
    dealTypeNotes: 'Hero metrics adapt: Existing shows going-in cap/NOI, Development shows yield-on-cost/dev cost/timeline, Redevelopment shows existing NOI + upside delta',
  },

  {
    moduleId: 'M02',
    name: 'Zoning & Entitlements',
    fKey: 'F2',
    station: 'S1',
    stationLabel: 'Intake & Triage',
    category: 'Intelligence',
    showFor: { existing: 'variant', development: 'full', redevelopment: 'full' },
    variants: {
      existing: {
        description: 'Simplified view: current zoning code, permitted uses, nonconforming status. Hides development scenarios and entitlement comparison engine.',
        zoningDepth: 'simplified',
      },
    },
    dealTypeNotes: 'Existing hides dev capacity scenarios + entitlement comparison. Dev/Redev show full 7 sub-tabs.',
  },

  {
    moduleId: 'M03',
    name: 'Development Capacity',
    fKey: null,
    station: 'S1',
    stationLabel: 'Intake & Triage',
    category: 'Intelligence',
    showFor: { existing: 'hidden', development: 'full', redevelopment: 'full' },
    dealTypeNotes: 'Hidden for Existing — no building envelope to calculate. Critical for Dev/Redev.',
  },

  // ─── S2: Intelligence Assembly ─────────────────────────────────────────────

  {
    moduleId: 'M04',
    name: 'Supply Pipeline',
    fKey: 'F4',
    station: 'S2',
    stationLabel: 'Intelligence Assembly',
    category: 'Intelligence',
    showFor: { existing: 'variant', development: 'variant', redevelopment: 'variant' },
    variants: {
      existing: {
        description: 'Focus on competitive pressure to existing rents. Pipeline framed as vacancy/absorption threat.',
      },
      development: {
        description: 'Focus on pipeline-to-stock ratio and absorption capacity for new unit delivery.',
      },
      redevelopment: {
        description: 'Dual lens: competitive pressure on current operations + absorption for repositioned units.',
      },
    },
  },

  {
    moduleId: 'M05',
    name: 'Market Analysis',
    fKey: 'F3',
    station: 'S2',
    stationLabel: 'Intelligence Assembly',
    category: 'Intelligence',
    showFor: { existing: 'full', development: 'full', redevelopment: 'full' },
  },

  {
    moduleId: 'M06',
    name: 'Demand Signals',
    fKey: null,
    station: 'S2',
    stationLabel: 'Intelligence Assembly',
    category: 'Intelligence',
    parentModule: 'M05',
    showFor: { existing: 'full', development: 'full', redevelopment: 'full' },
    dealTypeNotes: 'Sub-section of Market tab. Same content for all deal types.',
  },

  {
    moduleId: 'M07',
    name: 'Traffic Intelligence',
    fKey: 'F10',
    station: 'S2',
    stationLabel: 'Intelligence Assembly',
    category: 'Intelligence',
    showFor: { existing: 'full', development: 'variant', redevelopment: 'variant' },
    variants: {
      development: {
        description: 'Trade area traffic only — the property does not yet exist. Hides property-specific physical/digital traffic.',
        trafficScope: 'trade_area_only',
      },
      redevelopment: {
        description: 'Current property traffic metrics + trade area projections for repositioned product.',
        trafficScope: 'property_current_plus_trade_area',
      },
    },
  },

  {
    moduleId: 'M08',
    name: 'Strategy Arbitrage',
    fKey: 'F5',
    station: 'S2',
    stationLabel: 'Intelligence Assembly',
    category: 'Core',
    showFor: { existing: 'variant', development: 'variant', redevelopment: 'full' },
    variants: {
      existing: {
        description: 'BTS column hidden — cannot build-to-sell an existing structure. Shows Flip, Rental, STR.',
        strategies: ['FLIP', 'RENTAL', 'STR'],
      },
      development: {
        description: 'Flip column hidden — no existing asset to flip. Shows BTS, Rental (build-to-rent), STR.',
        strategies: ['BTS', 'RENTAL', 'STR'],
      },
    },
    dealTypeNotes: 'Redevelopment is the only type where all 4 strategies can apply simultaneously.',
  },

  // ─── S3: Underwriting & Modeling ───────────────────────────────────────────

  {
    moduleId: 'M09',
    name: 'ProForma Engine',
    fKey: 'F6',
    station: 'S3',
    stationLabel: 'Underwriting & Modeling',
    category: 'Financial',
    showFor: { existing: 'variant', development: 'variant', redevelopment: 'variant' },
    variants: {
      existing: {
        description: 'Acquisition template: purchase price, renovation budget, stabilized rents, hold period, exit cap.',
        proformaTemplate: 'acquisition',
      },
      development: {
        description: 'Development template: land cost, hard costs, soft costs, construction timeline phases, absorption schedule, stabilization, exit.',
        proformaTemplate: 'development',
      },
      redevelopment: {
        description: 'Hybrid template: acquisition cost + demo/renovation costs + new construction costs + phased stabilization + exit.',
        proformaTemplate: 'redevelopment',
      },
    },
    dealTypeNotes: 'Template completely changes — different line items, different timeline structure, different return metrics.',
  },

  {
    moduleId: 'M10',
    name: 'Scenario Engine',
    fKey: null,
    station: 'S3',
    stationLabel: 'Underwriting & Modeling',
    category: 'Financial',
    parentModule: 'M09',
    showFor: { existing: 'full', development: 'full', redevelopment: 'full' },
    dealTypeNotes: 'Sub-tab of Financial. Development adds construction delay scenarios. Redevelopment adds phasing/permitting scenarios.',
  },

  {
    moduleId: 'M11',
    name: 'Capital Structure',
    fKey: 'F7',
    station: 'S3',
    stationLabel: 'Underwriting & Modeling',
    category: 'Financial',
    showFor: { existing: 'variant', development: 'variant', redevelopment: 'variant' },
    variants: {
      existing: {
        description: 'Agency/CMBS permanent debt primary. Bridge loan section for value-add scope. Simple equity structure.',
        debtInstruments: ['permanent_agency', 'permanent_cmbs', 'bridge_loan'],
      },
      development: {
        description: 'Construction loan primary with interest reserve. Takeout/permanent financing at stabilization. Full equity waterfall with LP/GP splits.',
        debtInstruments: ['construction_loan', 'takeout_permanent', 'mezzanine', 'preferred_equity'],
      },
      redevelopment: {
        description: 'Hybrid: bridge/construction loan with phased draws. Permanent refinance at stabilization. May include existing debt assumption.',
        debtInstruments: ['bridge_construction', 'debt_assumption', 'takeout_permanent', 'mezzanine'],
      },
    },
  },

  {
    moduleId: 'M12',
    name: 'Exit Analysis',
    fKey: 'F12',
    station: 'S3',
    stationLabel: 'Underwriting & Modeling',
    category: 'Financial',
    showFor: { existing: 'full', development: 'variant', redevelopment: 'variant' },
    variants: {
      development: {
        description: 'Adds sell-at-stabilization vs long-term hold analysis. Different exit timing based on construction + lease-up timeline.',
      },
      redevelopment: {
        description: 'Adds sell-at-completion vs hold analysis. Includes phased exit option if mixed-use with condo component.',
      },
    },
  },

  // ─── S4: Due Diligence & Risk ──────────────────────────────────────────────

  {
    moduleId: 'M13',
    name: 'Due Diligence Tracker',
    fKey: null,
    station: 'S4',
    stationLabel: 'Due Diligence & Risk',
    category: 'Operations',
    showFor: { existing: 'variant', development: 'variant', redevelopment: 'variant' },
    variants: {
      existing: {
        description: 'Checklist categories: physical inspection, environmental Phase I, title & survey, rent roll audit, T-12 financial audit, insurance review.',
        ddPreset: 'existing_acquisition',
      },
      development: {
        description: 'Checklist categories: environmental Phase I/II, geotechnical report, entitlement review, utility capacity, traffic impact study, wetland/flood survey.',
        ddPreset: 'ground_up',
      },
      redevelopment: {
        description: 'Combined checklist: existing structure inspection + environmental + entitlement review + structural/engineering assessment + hazmat survey.',
        ddPreset: 'redevelopment',
      },
    },
  },

  {
    moduleId: 'M14',
    name: 'Risk Dashboard',
    fKey: 'F8',
    station: 'S4',
    stationLabel: 'Due Diligence & Risk',
    category: 'Intelligence',
    showFor: { existing: 'variant', development: 'variant', redevelopment: 'variant' },
    variants: {
      existing: {
        description: 'Risk weights: Market risk highest, Supply pressure elevated, Execution risk lower (no construction). Insurance/climate standard.',
        riskWeights: 'existing',
      },
      development: {
        description: 'Risk weights: Execution risk highest (construction/permitting), Regulatory risk elevated (entitlements), Market timing risk for delivery.',
        riskWeights: 'development',
      },
      redevelopment: {
        description: 'Risk weights: Execution risk highest across all categories. Adds structural/hazmat risk subcategory. Regulatory risk for change-of-use.',
        riskWeights: 'redevelopment',
      },
    },
  },

  {
    moduleId: 'M15',
    name: 'Competition Analysis',
    fKey: 'F9',
    station: 'S4',
    stationLabel: 'Due Diligence & Risk',
    category: 'Intelligence',
    showFor: { existing: 'full', development: 'full', redevelopment: 'full' },
  },

  // ─── S5: Execution ─────────────────────────────────────────────────────────

  {
    moduleId: 'M17',
    name: 'Team & Collaboration',
    fKey: null,
    station: 'S5',
    stationLabel: 'Execution',
    category: 'Operations',
    showFor: { existing: 'full', development: 'full', redevelopment: 'full' },
  },

  {
    moduleId: 'M18',
    name: 'Documents & Files',
    fKey: 'F11',
    station: 'S5',
    stationLabel: 'Execution',
    category: 'Operations',
    showFor: { existing: 'variant', development: 'variant', redevelopment: 'variant' },
    variants: {
      existing: {
        description: 'Categories: Offering Memorandum, Rent Roll, T-12 P&L, Inspection Reports, Appraisal, Title, Survey, Insurance, Loan Docs.',
        documentCategories: ['offering_memo', 'rent_roll', 't12', 'inspection', 'appraisal', 'title', 'survey', 'insurance', 'loan_docs'],
      },
      development: {
        description: 'Categories: Site Plans, Architectural Drawings, Engineering Reports, Permits, Cost Estimates, Environmental Reports, Geotech, Traffic Study.',
        documentCategories: ['site_plans', 'architectural', 'engineering', 'permits', 'cost_estimates', 'environmental', 'geotech', 'traffic_study'],
      },
      redevelopment: {
        description: 'Combined: existing asset docs (rent roll, T-12, inspection) + development docs (plans, permits, cost estimates, structural assessment).',
        documentCategories: ['offering_memo', 'rent_roll', 't12', 'inspection', 'structural_assessment', 'site_plans', 'permits', 'cost_estimates', 'environmental', 'hazmat'],
      },
    },
  },

  // ─── S6: Post-Close ────────────────────────────────────────────────────────

  {
    moduleId: 'M22',
    name: 'Portfolio Manager',
    fKey: null,
    station: 'S6',
    stationLabel: 'Post-Close',
    category: 'Financial',
    showFor: { existing: 'full', development: 'variant', redevelopment: 'variant' },
    variants: {
      development: {
        description: 'Two phases: (1) Construction period tracks draws vs budget, schedule vs plan. (2) After CO/stabilization, transitions to ops tracking with actual vs projected.',
      },
      redevelopment: {
        description: 'Two phases: (1) Redevelopment period tracks renovation spend vs budget. (2) Post-completion transitions to ops tracking with actual vs underwritten.',
      },
    },
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// FILTERING & UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine the deal type from the deal object.
 * This is the single source of truth for deal classification.
 */
export function getDealType(deal: { projectType?: string; dealType?: string }): DealType {
  const raw = (deal.projectType || deal.dealType || '').toLowerCase().trim();

  // Normalize various input strings to canonical types
  if ([
    'existing', 'acquisition', 'existing_acquisition', 'stabilized', 'value-add', 'value_add',
    // Property asset-class strings — all imply acquiring an existing property
    'multifamily', 'multi-family', 'multi_family',
    'office', 'retail', 'industrial', 'flex',
    'mixed_use', 'mixed-use', 'mixeduse',
    'hotel', 'hospitality', 'self_storage', 'self-storage',
    'senior_housing', 'senior-housing', 'student_housing',
    'single_family', 'single-family', 'sfr', 'build_to_rent', 'build-to-rent',
  ].includes(raw)) {
    return 'existing';
  }
  if ([
    'development', 'ground_up', 'ground-up', 'new_construction', 'new construction',
    'new_development', 'new-development', 'land',
  ].includes(raw)) {
    return 'development';
  }
  if ([
    'redevelopment', 'redev', 'rehab', 'repositioning', 'adaptive_reuse', 'adaptive-reuse',
    'gut_rehab', 'tear-down', 'teardown', 'conversion',
  ].includes(raw)) {
    return 'redevelopment';
  }

  // Default to existing if unknown — safest assumption
  console.warn(`[DealType] Unknown project type "${raw}", defaulting to "existing"`);
  return 'existing';
}

/**
 * Filter the full module registry to only tabs visible for a given deal type.
 * Returns modules in station order with their variant configs attached.
 */
export function getVisibleTabs(dealType: DealType): (ModuleTabDefinition & { variantConfig?: VariantConfig })[] {
  return MODULE_TABS
    .filter((tab) => tab.showFor[dealType] !== 'hidden')
    .map((tab) => ({
      ...tab,
      variantConfig: tab.showFor[dealType] === 'variant'
        ? tab.variants?.[dealType]
        : undefined,
    }));
}

/**
 * Get ONLY the top-level tabs (exclude sub-tabs that live inside parent modules).
 * These are the tabs that render in the sidebar / F-key navigation.
 */
export function getNavigationTabs(dealType: DealType): ModuleTabDefinition[] {
  return getVisibleTabs(dealType).filter((tab) => !tab.parentModule);
}

/**
 * Get the F-key navigation array for the Bloomberg Terminal surface.
 * Maps directly to the DEAL_NAV constant in jedi-bloomberg-integrated.jsx.
 */
export function getDealNav(dealType: DealType): { key: string; label: string; m: ModuleId }[] {
  return getNavigationTabs(dealType)
    .filter((tab) => tab.fKey !== null)
    .map((tab) => ({
      key: tab.fKey!,
      label: tab.name.toUpperCase(),
      m: tab.moduleId,
    }));
}

/**
 * Get the available strategies for Strategy Arbitrage (M08) based on deal type.
 */
export function getAvailableStrategies(dealType: DealType): StrategyId[] {
  const m08 = MODULE_TABS.find((t) => t.moduleId === 'M08');
  if (!m08) return ['BTS', 'FLIP', 'RENTAL', 'STR'];

  const variant = m08.variants?.[dealType];
  if (variant?.strategies) return variant.strategies;

  // Redevelopment gets all 4
  return ['BTS', 'FLIP', 'RENTAL', 'STR'];
}

/**
 * Get the ProForma template type based on deal type.
 */
export function getProFormaTemplate(dealType: DealType): ProFormaTemplate {
  const m09 = MODULE_TABS.find((t) => t.moduleId === 'M09');
  const variant = m09?.variants?.[dealType];
  return variant?.proformaTemplate ?? 'acquisition';
}

/**
 * Get the DD checklist preset based on deal type.
 */
export function getDDChecklistPreset(dealType: DealType): DDChecklistPreset {
  const m13 = MODULE_TABS.find((t) => t.moduleId === 'M13');
  const variant = m13?.variants?.[dealType];
  return variant?.ddPreset ?? 'existing_acquisition';
}

/**
 * Get the risk weight profile based on deal type.
 */
export function getRiskWeightProfile(dealType: DealType): RiskWeightProfile {
  const m14 = MODULE_TABS.find((t) => t.moduleId === 'M14');
  const variant = m14?.variants?.[dealType];
  return variant?.riskWeights ?? 'existing';
}

/**
 * Check if a specific module is visible for a given deal type.
 */
export function isModuleVisible(moduleId: ModuleId, dealType: DealType): boolean {
  const tab = MODULE_TABS.find((t) => t.moduleId === moduleId);
  return tab ? tab.showFor[dealType] !== 'hidden' : false;
}

/**
 * Get the zoning depth for the Zoning & Entitlements module.
 */
export function getZoningDepth(dealType: DealType): 'simplified' | 'full' {
  if (dealType === 'existing') return 'simplified';
  return 'full';
}


// ═══════════════════════════════════════════════════════════════════════════════
// RISK WEIGHT PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RiskCategoryWeights {
  supply: number;
  demand: number;
  regulatory: number;
  market: number;
  execution: number;
  climate_insurance: number;
}

export const RISK_WEIGHTS: Record<RiskWeightProfile, RiskCategoryWeights> = {
  existing: {
    supply: 0.20,
    demand: 0.15,
    regulatory: 0.10,
    market: 0.25,
    execution: 0.10,
    climate_insurance: 0.20,
  },
  development: {
    supply: 0.15,
    demand: 0.10,
    regulatory: 0.20,
    market: 0.15,
    execution: 0.25,
    climate_insurance: 0.15,
  },
  redevelopment: {
    supply: 0.12,
    demand: 0.10,
    regulatory: 0.18,
    market: 0.12,
    execution: 0.30,
    climate_insurance: 0.18,
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// DD CHECKLIST ITEMS BY PRESET
// ═══════════════════════════════════════════════════════════════════════════════

export interface DDChecklistCategory {
  category: string;
  items: string[];
}

export const DD_CHECKLISTS: Record<DDChecklistPreset, DDChecklistCategory[]> = {
  existing_acquisition: [
    { category: 'Physical Inspection', items: ['Roof condition', 'HVAC age & condition', 'Plumbing assessment', 'Electrical system', 'Foundation/structural', 'Unit interior condition', 'Common area condition', 'Parking lot/structure', 'Landscaping & curb appeal', 'ADA compliance'] },
    { category: 'Environmental', items: ['Phase I ESA', 'Asbestos survey (pre-1980)', 'Lead paint inspection (pre-1978)', 'Mold assessment', 'Radon testing'] },
    { category: 'Financial Audit', items: ['Trailing 12-month P&L', 'Rent roll verification', 'Lease audit (sample)', 'Utility bill analysis', 'Insurance loss history', 'Tax assessment review', 'Service contract review', 'Capital expenditure history'] },
    { category: 'Legal & Title', items: ['Title commitment', 'ALTA survey', 'Zoning confirmation letter', 'Certificate of occupancy', 'Existing liens & encumbrances', 'HOA/CC&R review', 'Pending litigation search'] },
    { category: 'Insurance', items: ['Property insurance quote', 'Flood zone determination', 'Wind mitigation inspection (FL)', 'Insurance loss run (5yr)'] },
  ],
  ground_up: [
    { category: 'Environmental', items: ['Phase I ESA', 'Phase II ESA (if triggered)', 'Wetland delineation', 'Protected species survey', 'Stormwater management plan'] },
    { category: 'Geotechnical', items: ['Soil borings report', 'Foundation recommendations', 'Groundwater level assessment', 'Compaction testing requirements'] },
    { category: 'Entitlement & Regulatory', items: ['Zoning verification letter', 'Comprehensive plan consistency', 'Concurrency review (FL)', 'DRI/ADA review if applicable', 'Impact fee calculation', 'Utility capacity confirmation', 'Fire department access review'] },
    { category: 'Site & Engineering', items: ['Boundary survey', 'Topographic survey', 'Traffic impact study', 'Utility infrastructure assessment', 'Drainage & flood analysis', 'Environmental permits required'] },
    { category: 'Cost Validation', items: ['Independent cost estimate', 'Hard cost budget review', 'Soft cost budget review', 'Construction schedule review', 'GC qualification & references'] },
  ],
  redevelopment: [
    { category: 'Existing Structure', items: ['Structural engineering assessment', 'Roof condition & remaining life', 'HVAC system evaluation', 'Plumbing & electrical assessment', 'Foundation integrity', 'Load-bearing wall identification', 'Code compliance gap analysis'] },
    { category: 'Environmental & Hazmat', items: ['Phase I ESA', 'Asbestos abatement survey', 'Lead paint assessment', 'Mold remediation assessment', 'Underground storage tank search', 'Hazardous materials inventory'] },
    { category: 'Entitlement & Regulatory', items: ['Zoning change/variance feasibility', 'Historic preservation review', 'Building code upgrade requirements', 'ADA retrofit requirements', 'Change of use permits', 'Impact fee assessment'] },
    { category: 'Financial Audit (Existing Ops)', items: ['Current rent roll', 'Trailing 12-month P&L', 'Tenant relocation cost estimate', 'Lease termination provisions', 'Service contract termination costs'] },
    { category: 'Renovation Scope', items: ['Architectural scope document', 'Demo vs renovation boundary', 'Independent cost estimate', 'Construction phasing plan', 'Temporary relocation plan (if occupied)', 'GC qualification & references'] },
    { category: 'Legal & Title', items: ['Title commitment', 'ALTA survey', 'Existing liens & encumbrances', 'Pending litigation search'] },
  ],
};


// ═══════════════════════════════════════════════════════════════════════════════
// PROFORMA LINE ITEM TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProFormaSection {
  section: string;
  lineItems: string[];
}

export const PROFORMA_TEMPLATES: Record<ProFormaTemplate, ProFormaSection[]> = {
  acquisition: [
    { section: 'Acquisition Costs', lineItems: ['Purchase Price', 'Closing Costs', 'Loan Origination', 'Due Diligence Costs', 'Legal & Accounting'] },
    { section: 'Renovation Budget', lineItems: ['Unit Interior Renovation', 'Common Area Improvements', 'Exterior/Curb Appeal', 'Deferred Maintenance', 'Contingency (10-15%)'] },
    { section: 'Revenue (Stabilized)', lineItems: ['Gross Potential Rent', 'Other Income', 'Vacancy & Credit Loss', 'Concessions', 'Effective Gross Income'] },
    { section: 'Operating Expenses', lineItems: ['Property Management', 'Payroll', 'Repairs & Maintenance', 'Insurance', 'Property Taxes', 'Utilities', 'Marketing', 'General & Administrative', 'Reserves'] },
    { section: 'Returns', lineItems: ['Net Operating Income', 'Debt Service', 'Cash Flow Before Tax', 'Going-In Cap Rate', 'Exit Cap Rate', 'IRR', 'Equity Multiple', 'Cash-on-Cash'] },
  ],
  development: [
    { section: 'Land Costs', lineItems: ['Land Acquisition', 'Closing Costs', 'Impact Fees', 'Site Preparation', 'Demolition (if applicable)'] },
    { section: 'Hard Costs', lineItems: ['Vertical Construction', 'Site Work & Infrastructure', 'Parking Structure', 'Landscaping', 'FF&E (if applicable)', 'Hard Cost Contingency (5-10%)'] },
    { section: 'Soft Costs', lineItems: ['Architecture & Engineering', 'Permits & Fees', 'Legal & Accounting', 'Interest Reserve', 'Developer Fee', 'Marketing & Lease-Up', 'Soft Cost Contingency (5%)'] },
    { section: 'Construction Timeline', lineItems: ['Pre-Development (months)', 'Entitlement (months)', 'Construction (months)', 'Lease-Up to Stabilization (months)', 'Total Timeline'] },
    { section: 'Revenue (Stabilized)', lineItems: ['Gross Potential Rent', 'Other Income', 'Vacancy & Credit Loss', 'Effective Gross Income'] },
    { section: 'Operating Expenses', lineItems: ['Property Management', 'Payroll', 'Repairs & Maintenance', 'Insurance', 'Property Taxes', 'Utilities', 'Reserves'] },
    { section: 'Returns', lineItems: ['Total Development Cost', 'Stabilized NOI', 'Yield on Cost', 'Development Spread', 'IRR (unlevered)', 'IRR (levered)', 'Equity Multiple', 'Profit Margin'] },
  ],
  redevelopment: [
    { section: 'Acquisition Costs', lineItems: ['Purchase Price', 'Closing Costs', 'Existing Debt Assumption/Payoff', 'Due Diligence Costs'] },
    { section: 'Redevelopment Costs', lineItems: ['Demolition / Abatement', 'Structural Modifications', 'Interior Renovation', 'Exterior & Common Area', 'New Construction (if expansion)', 'Hazmat Remediation', 'Tenant Relocation', 'Contingency (15-20%)'] },
    { section: 'Soft Costs', lineItems: ['Architecture & Engineering', 'Permits & Re-Entitlement', 'Legal & Accounting', 'Interest Carry During Renovation', 'Lost Revenue During Downtime', 'Marketing & Re-Lease', 'Developer Fee'] },
    { section: 'Phasing Timeline', lineItems: ['Acquisition to Vacancy/Relocation', 'Renovation/Construction Phase', 'Re-Lease to Stabilization', 'Total Timeline'] },
    { section: 'Revenue (Stabilized)', lineItems: ['Gross Potential Rent (Repositioned)', 'Other Income', 'Vacancy & Credit Loss', 'Effective Gross Income'] },
    { section: 'Operating Expenses', lineItems: ['Property Management', 'Payroll', 'Repairs & Maintenance', 'Insurance', 'Property Taxes', 'Utilities', 'Reserves'] },
    { section: 'Returns', lineItems: ['Total Project Cost', 'Stabilized NOI', 'Yield on Cost', 'Going-In Cap (as-is)', 'Stabilized Cap (as-renovated)', 'IRR', 'Equity Multiple', 'Value Creation Margin'] },
  ],
};


// ═══════════════════════════════════════════════════════════════════════════════
// REACT INTEGRATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook-compatible helper: derive all deal-type-driven configuration from a deal object.
 * Intended to be called inside a useMemo or at the top of the DealDetailPage component.
 *
 * Usage:
 *   const config = getDealTypeConfig(deal);
 *   // config.dealType, config.visibleTabs, config.navTabs, config.strategies, etc.
 */
export function getDealTypeConfig(deal: { projectType?: string; dealType?: string }) {
  const dealType = getDealType(deal);

  return {
    dealType,
    visibleTabs: getVisibleTabs(dealType),
    navTabs: getNavigationTabs(dealType),
    dealNav: getDealNav(dealType),
    strategies: getAvailableStrategies(dealType),
    proformaTemplate: getProFormaTemplate(dealType),
    ddPreset: getDDChecklistPreset(dealType),
    riskWeightProfile: getRiskWeightProfile(dealType),
    riskWeights: RISK_WEIGHTS[getRiskWeightProfile(dealType)],
    zoningDepth: getZoningDepth(dealType),
    ddChecklist: DD_CHECKLISTS[getDDChecklistPreset(dealType)],
    proformaLineItems: PROFORMA_TEMPLATES[getProFormaTemplate(dealType)],
    isModuleVisible: (moduleId: ModuleId) => isModuleVisible(moduleId, dealType),
  };
}
