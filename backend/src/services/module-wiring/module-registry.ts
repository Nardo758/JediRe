/**
 * Module Registry
 *
 * Typed definitions for all 25 modules (M01-M25) from the JEDI RE Module Wiring Blueprint.
 * Each module defines its ID, dependencies, outputs, formulas, priority, and build status.
 * This registry is the single source of truth for module metadata and inter-module contracts.
 */

// ============================================================================
// Types
// ============================================================================

export type ModuleId =
  | 'M01' | 'M02' | 'M03' | 'M04' | 'M05'
  | 'M06' | 'M07' | 'M08' | 'M09' | 'M10'
  | 'M11' | 'M12' | 'M13' | 'M14' | 'M15'
  | 'M16' | 'M17' | 'M18' | 'M19' | 'M20'
  | 'M21' | 'M22' | 'M23' | 'M24' | 'M25';

export type ModuleStage =
  | 'S1: Overview'
  | 'S2: Market Intel'
  | 'S3: Financial'
  | 'S4: DD & Risk'
  | 'S5: Execution'
  | 'S6: Platform';

export type ModuleCategory = 'Core' | 'Intelligence' | 'Financial' | 'Operations';

export type BuildStatus = 'Built' | 'Partial' | 'New';
export type Priority = 'P0' | 'P1' | 'P2';

export interface ModuleOutput {
  key: string;
  type: 'number' | 'string' | 'object' | 'array' | 'boolean' | 'score';
  unit?: string;
  description: string;
}

export interface ModuleDependency {
  moduleId: ModuleId;
  dataKeys: string[];
  strength: 'required' | 'optional';
}

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  stage: ModuleStage;
  category: ModuleCategory;
  purpose: string;
  hasAgent: boolean;
  agentName?: string;
  outputs: ModuleOutput[];
  feedsInto: ModuleId[];
  receivesFrom: ModuleDependency[];
  formulas: string[];
  buildStatus: BuildStatus;
  priority: Priority;
  uiLocation: string;
  serviceFile?: string;
}

// ============================================================================
// Module Registry
// ============================================================================

export const MODULE_REGISTRY: Record<ModuleId, ModuleDefinition> = {
  M01: {
    id: 'M01',
    name: 'Deal Overview',
    stage: 'S1: Overview',
    category: 'Core',
    purpose: 'Single-pane summary: JEDI Score, property basics, owner intel, quick stats.',
    hasAgent: false,
    outputs: [
      { key: 'jedi_score_display', type: 'score', unit: '0-100', description: 'JEDI Score for display' },
      { key: 'property_snapshot', type: 'object', description: 'Property basics summary' },
      { key: 'owner_propensity_score', type: 'score', unit: '0-100', description: 'Owner propensity to sell' },
    ],
    feedsInto: ['M02', 'M06', 'M08', 'M09', 'M14'],
    receivesFrom: [
      { moduleId: 'M25', dataKeys: ['jedi_score', 'sub_scores'], strength: 'required' },
      { moduleId: 'M08', dataKeys: ['strategy_recommendation', 'strategy_scores'], strength: 'required' },
      { moduleId: 'M16', dataKeys: ['pipeline_stage'], strength: 'optional' },
      { moduleId: 'M14', dataKeys: ['composite_risk_score', 'risk_heatmap'], strength: 'required' },
      { moduleId: 'M13', dataKeys: ['dd_completion_pct'], strength: 'optional' },
      { moduleId: 'M09', dataKeys: ['key_financials'], strength: 'required' },
      { moduleId: 'M10', dataKeys: ['probability_weighted_returns'], strength: 'optional' },
      { moduleId: 'M11', dataKeys: ['debt_terms_summary'], strength: 'optional' },
    ],
    formulas: [],
    buildStatus: 'Built',
    priority: 'P0',
    uiLocation: 'Deal Capsule → Overview Tab',
  },

  M02: {
    id: 'M02',
    name: 'Zoning & Entitlements',
    stage: 'S1: Overview',
    category: 'Intelligence',
    purpose: 'Current zoning code, density utilization %, max buildable, entitlement pathway, regulatory risk.',
    hasAgent: true,
    agentName: 'Zoning Agent',
    outputs: [
      { key: 'zoning_code', type: 'string', description: 'Zoning district code' },
      { key: 'max_density', type: 'number', unit: 'units/acre', description: 'Maximum allowed density' },
      { key: 'far', type: 'number', description: 'Floor Area Ratio' },
      { key: 'setbacks', type: 'object', description: 'Front/side/rear setbacks in feet' },
      { key: 'entitlement_risk_score', type: 'score', unit: '0-100', description: 'Entitlement difficulty' },
      { key: 'zoning_utilization_pct', type: 'number', unit: '%', description: 'Current vs max density usage' },
    ],
    feedsInto: ['M03', 'M05', 'M08', 'M14'],
    receivesFrom: [],
    formulas: ['F13'],
    buildStatus: 'Partial',
    priority: 'P0',
    uiLocation: 'Deal Capsule → Zoning Tab',
    serviceFile: 'zoning.service.ts',
  },

  M03: {
    id: 'M03',
    name: 'Development Capacity',
    stage: 'S1: Overview',
    category: 'Intelligence',
    purpose: '10-year supply forecast. Building envelope calculator: what CAN be built vs what IS built.',
    hasAgent: false,
    outputs: [
      { key: 'max_units_by_right', type: 'number', unit: 'units', description: 'Max units as-of-right' },
      { key: 'envelope_dimensions', type: 'object', description: 'Building envelope (GFA, height, parking)' },
      { key: 'scenario_comparison', type: 'array', description: 'As-right/variance/rezone scenarios' },
      { key: 'ten_year_supply_gap', type: 'number', unit: 'units', description: '10yr demand minus supply' },
    ],
    feedsInto: ['M05', 'M08', 'M09', 'M14'],
    receivesFrom: [
      { moduleId: 'M02', dataKeys: ['zoning_code', 'far', 'setbacks', 'max_density'], strength: 'required' },
      { moduleId: 'M04', dataKeys: ['pipeline_units'], strength: 'optional' },
    ],
    formulas: ['F14', 'F15'],
    buildStatus: 'Partial',
    priority: 'P1',
    uiLocation: 'Deal Capsule → Development Tab',
    serviceFile: 'building-envelope.service.ts',
  },

  M04: {
    id: 'M04',
    name: 'Supply Pipeline',
    stage: 'S1: Overview',
    category: 'Intelligence',
    purpose: 'Track all permitted/under-construction/delivered units in trade area. Pipeline pressure score.',
    hasAgent: true,
    agentName: 'Supply Agent',
    outputs: [
      { key: 'pipeline_units_by_status', type: 'object', description: 'Units by permit/UC/delivered' },
      { key: 'absorption_rate', type: 'number', unit: 'units/month', description: 'Monthly absorption' },
      { key: 'months_of_supply', type: 'number', unit: 'months', description: 'Months to absorb pipeline' },
      { key: 'supply_pressure_score', type: 'score', unit: '0-100', description: 'Supply pressure indicator' },
      { key: 'competitive_projects', type: 'array', description: 'Nearby competitive projects list' },
    ],
    feedsInto: ['M03', 'M05', 'M08', 'M09', 'M14', 'M15', 'M25'],
    receivesFrom: [
      { moduleId: 'M19', dataKeys: ['classified_supply_events'], strength: 'optional' },
    ],
    formulas: ['F03', 'F07', 'F08', 'F09'],
    buildStatus: 'Partial',
    priority: 'P0',
    uiLocation: 'Deal Capsule → Supply Tab',
    serviceFile: 'supply-signal.service.ts',
  },

  M05: {
    id: 'M05',
    name: 'Market Analysis',
    stage: 'S2: Market Intel',
    category: 'Intelligence',
    purpose: 'Submarket fundamentals: rent levels, vacancy, absorption, rent growth trends, demographic shifts.',
    hasAgent: false,
    outputs: [
      { key: 'avg_rent_psf', type: 'number', unit: '$/SF', description: 'Average rent per square foot' },
      { key: 'vacancy_rate', type: 'number', unit: '%', description: 'Market vacancy rate' },
      { key: 'absorption_rate', type: 'number', unit: 'units/yr', description: 'Annual absorption' },
      { key: 'rent_growth_pct', type: 'number', unit: '%', description: 'Rent growth rate' },
      { key: 'demographic_trends', type: 'object', description: 'Population, income, employment trends' },
      { key: 'submarket_rank', type: 'number', unit: 'percentile', description: 'Submarket rank (0-100)' },
    ],
    feedsInto: ['M08', 'M09', 'M10', 'M14', 'M25'],
    receivesFrom: [
      { moduleId: 'M02', dataKeys: ['zoning_code'], strength: 'optional' },
      { moduleId: 'M04', dataKeys: ['supply_pressure_score', 'absorption_rate'], strength: 'required' },
      { moduleId: 'M06', dataKeys: ['demand_score'], strength: 'optional' },
      { moduleId: 'M15', dataKeys: ['rent_comp_data', 'competitive_positioning'], strength: 'optional' },
    ],
    formulas: ['F04', 'F05', 'F26', 'F27'],
    buildStatus: 'Partial',
    priority: 'P0',
    uiLocation: 'Deal Capsule → Market Tab',
    serviceFile: 'marketResearchEngine.ts',
  },

  M06: {
    id: 'M06',
    name: 'Demand Signals',
    stage: 'S2: Market Intel',
    category: 'Intelligence',
    purpose: 'Convert news events into quantified housing demand: employment expansions, university growth, migration.',
    hasAgent: false,
    outputs: [
      { key: 'demand_units_total', type: 'number', unit: 'units', description: 'Total housing units demanded' },
      { key: 'demand_units_phased', type: 'array', description: 'Quarterly demand projections' },
      { key: 'income_tier_breakdown', type: 'object', description: 'Units by income tier' },
      { key: 'demand_score', type: 'score', unit: '0-100', description: 'Demand signal strength' },
      { key: 'employer_concentration_risk', type: 'number', unit: '%', description: 'Top employer share' },
    ],
    feedsInto: ['M05', 'M08', 'M09', 'M14', 'M25'],
    receivesFrom: [
      { moduleId: 'M19', dataKeys: ['classified_demand_events'], strength: 'required' },
    ],
    formulas: ['F02', 'F10', 'F11', 'F12'],
    buildStatus: 'Built',
    priority: 'P0',
    uiLocation: 'Deal Capsule → Market Tab (sub-section)',
    serviceFile: 'demand-signal.service.ts',
  },

  M07: {
    id: 'M07',
    name: 'Traffic Intelligence',
    stage: 'S2: Market Intel',
    category: 'Intelligence',
    purpose: 'Three-Layer Traffic Fusion: FDOT AADT baseline + temporal distribution + digital leading indicators → lease prediction with trend pattern detection.',
    hasAgent: false,
    outputs: [
      { key: 'predicted_leases_week', type: 'number', unit: 'leases/wk', description: 'Predicted weekly leases' },
      { key: 'traffic_to_lease_ratio', type: 'number', description: 'Traffic-to-lease conversion ratio' },
      { key: 'traffic_trend', type: 'string', description: 'Increasing/Decreasing/Stable' },
      { key: 'search_volume_index', type: 'number', description: 'Search interest index' },
      { key: 'visibility_score', type: 'score', unit: '0-100', description: 'Location visibility composite score' },
      { key: 'capture_rate', type: 'number', unit: '%', description: 'Visibility-derived capture rate' },
      { key: 'comp_averages', type: 'object', description: 'Trade area comp traffic averages' },
      { key: 'data_quality_score', type: 'score', unit: '0-5', description: 'Number of connected data sources' },
      { key: 'effective_base_adt', type: 'number', unit: 'vehicles/day', description: 'Layer 1 effective base ADT with decay, road weight, frontage factor' },
      { key: 'temporal_adjusted_adt', type: 'number', unit: 'vehicles/day', description: 'Layer 2 temporally-adjusted ADT (hourly/seasonal/DOW/directional)' },
      { key: 'traffic_trajectory', type: 'number', description: 'T-07 trajectory signal combining digital momentum, AADT growth, seasonal deviation' },
      { key: 'detected_patterns', type: 'array', description: 'Cross-layer trend patterns: DEMAND_SURGE, MOMENTUM_CONFIRMED, DIGITAL_DIVERGENCE, MARKET_EXHAUSTION, SEASONAL_NOISE' },
      { key: 'digital_share', type: 'number', unit: '0-1', description: 'Layer 3 digital share vs submarket competitors' },
      { key: 'daily_breakdown', type: 'array', description: 'Mon-Sun daily walk-in breakdown using DOW factors' },
    ],
    feedsInto: ['M05', 'M08', 'M09', 'M14', 'M25'],
    receivesFrom: [],
    formulas: ['F28', 'F29'],
    buildStatus: 'Built',
    priority: 'P2',
    uiLocation: 'Deal Capsule → Traffic Tab',
    serviceFile: 'trafficPredictionEngine.ts',
  },

  M08: {
    id: 'M08',
    name: 'Strategy Arbitrage',
    stage: 'S2: Market Intel',
    category: 'Core',
    purpose: 'Simultaneously analyze all 4 strategies (BTS, Flip, Rental, STR). Identify hidden ROI gaps.',
    hasAgent: false,
    outputs: [
      { key: 'strategy_scores', type: 'object', description: 'Scores for BTS/Flip/Rental/STR (0-100 each)' },
      { key: 'roi_comparison_matrix', type: 'object', description: 'ROI comparison across strategies' },
      { key: 'recommended_strategy', type: 'string', description: 'Best strategy recommendation' },
      { key: 'arbitrage_flag', type: 'boolean', description: 'Arbitrage opportunity detected' },
      { key: 'arbitrage_delta', type: 'number', description: 'Score gap between top 2 strategies' },
    ],
    feedsInto: ['M09', 'M10', 'M14', 'M01', 'M25'],
    receivesFrom: [
      { moduleId: 'M02', dataKeys: ['zoning_code', 'entitlement_risk_score'], strength: 'optional' },
      { moduleId: 'M03', dataKeys: ['max_units_by_right', 'envelope_dimensions'], strength: 'required' },
      { moduleId: 'M04', dataKeys: ['supply_pressure_score', 'pipeline_units_by_status'], strength: 'required' },
      { moduleId: 'M05', dataKeys: ['rent_growth_pct', 'vacancy_rate', 'submarket_rank'], strength: 'required' },
      { moduleId: 'M06', dataKeys: ['demand_score', 'demand_units_total'], strength: 'required' },
      { moduleId: 'M07', dataKeys: ['traffic_trend', 'predicted_leases_week', 'detected_patterns', 'traffic_trajectory'], strength: 'optional' },
    ],
    formulas: ['F23', 'F24', 'F25'],
    buildStatus: 'Partial',
    priority: 'P0',
    uiLocation: 'Deal Capsule → Strategy Tab',
  },

  M09: {
    id: 'M09',
    name: 'Pro Forma Engine',
    stage: 'S3: Financial',
    category: 'Financial',
    purpose: 'Dynamic pro forma per strategy. Baseline vs news-adjusted assumptions. User override capability.',
    hasAgent: false,
    outputs: [
      { key: 'noi', type: 'number', unit: '$', description: 'Net Operating Income' },
      { key: 'cash_flow_projections', type: 'array', description: 'Annual cash flow array' },
      { key: 'irr', type: 'number', unit: '%', description: 'Internal Rate of Return' },
      { key: 'equity_multiple', type: 'number', unit: 'x', description: 'Equity Multiple' },
      { key: 'coc_return', type: 'number', unit: '%', description: 'Cash-on-Cash return' },
      { key: 'cap_rate', type: 'number', unit: '%', description: 'Going-in cap rate' },
    ],
    feedsInto: ['M10', 'M11', 'M12', 'M14', 'M01', 'M22'],
    receivesFrom: [
      { moduleId: 'M02', dataKeys: ['zoning_code', 'far'], strength: 'optional' },
      { moduleId: 'M03', dataKeys: ['max_units_by_right', 'envelope_dimensions'], strength: 'optional' },
      { moduleId: 'M04', dataKeys: ['vacancy_rate'], strength: 'optional' },
      { moduleId: 'M05', dataKeys: ['avg_rent_psf', 'vacancy_rate', 'rent_growth_pct'], strength: 'required' },
      { moduleId: 'M06', dataKeys: ['demand_units_total', 'demand_units_phased'], strength: 'optional' },
      { moduleId: 'M08', dataKeys: ['recommended_strategy', 'strategy_scores'], strength: 'required' },
    ],
    formulas: ['F16', 'F17', 'F18', 'F19', 'F20', 'F32', 'F33'],
    buildStatus: 'Partial',
    priority: 'P0',
    uiLocation: 'Deal Capsule → Financial Tab',
    serviceFile: 'proforma-adjustment.service.ts',
  },

  M10: {
    id: 'M10',
    name: 'Scenario Engine',
    stage: 'S3: Financial',
    category: 'Financial',
    purpose: 'Bull/Base/Bear/Stress scenarios. Evidence-based parameters from actual news events.',
    hasAgent: false,
    outputs: [
      { key: 'scenario_comparison', type: 'object', description: 'Bull/Base/Bear/Stress comparison' },
      { key: 'probability_weighted_returns', type: 'object', description: 'Expected IRR/equity multiple' },
      { key: 'scenario_narratives', type: 'object', description: 'Evidence-based scenario descriptions' },
      { key: 'sensitivity_ranges', type: 'object', description: 'Parameter sensitivity ranges' },
    ],
    feedsInto: ['M09', 'M14', 'M01'],
    receivesFrom: [
      { moduleId: 'M06', dataKeys: ['demand_units_total', 'demand_units_phased'], strength: 'required' },
      { moduleId: 'M04', dataKeys: ['pipeline_units_by_status', 'supply_pressure_score'], strength: 'required' },
      { moduleId: 'M09', dataKeys: ['noi', 'cash_flow_projections', 'irr'], strength: 'required' },
    ],
    formulas: ['F30', 'F31'],
    buildStatus: 'Built',
    priority: 'P1',
    uiLocation: 'Deal Capsule → Scenarios Tab',
    serviceFile: 'scenario-generation.service.ts',
  },

  M11: {
    id: 'M11',
    name: 'Capital Structure Engine',
    stage: 'S3: Financial',
    category: 'Financial',
    purpose: 'Full capital stack design, strategy-aware debt selection, rate environment analysis, equity waterfall, scenario comparison, debt lifecycle timeline, cross-module integration.',
    hasAgent: false,
    outputs: [
      { key: 'dscr', type: 'number', description: 'Debt Service Coverage Ratio' },
      { key: 'ltv', type: 'number', unit: '%', description: 'Loan-to-Value ratio' },
      { key: 'ltc', type: 'number', unit: '%', description: 'Loan-to-Cost ratio' },
      { key: 'debt_yield', type: 'number', unit: '%', description: 'Debt yield' },
      { key: 'wacc', type: 'number', unit: '%', description: 'Weighted avg cost of capital' },
      { key: 'capital_stack', type: 'object', description: 'Full capital stack with layers' },
      { key: 'equity_waterfall', type: 'object', description: 'LP/GP waterfall distributions' },
      { key: 'rate_environment', type: 'object', description: 'Current rates and cycle phase' },
      { key: 'scenario_comparison', type: 'object', description: 'Multi-scenario capital analysis' },
      { key: 'debt_timeline', type: 'object', description: 'Lifecycle events and draw schedule' },
      { key: 'rate_sensitivity_matrix', type: 'object', description: 'Rate scenario grid' },
      { key: 'lender_recommendations', type: 'array', description: 'Strategy-matched debt products' },
      { key: 'capital_risk_score', type: 'number', description: 'Composite capital risk (0-100)' },
    ],
    feedsInto: ['M09', 'M14', 'M01', 'M12'],
    receivesFrom: [
      { moduleId: 'M09', dataKeys: ['noi', 'cash_flow_projections'], strength: 'required' },
      { moduleId: 'M08', dataKeys: ['strategy', 'strategy_scores'], strength: 'required' },
    ],
    formulas: ['F21', 'F22', 'F40', 'F41', 'F42', 'F43', 'F44', 'F45', 'F46', 'F47', 'F48', 'F49', 'F50', 'F51', 'F52', 'F53', 'F54', 'F55', 'F56', 'F57', 'F58', 'F59', 'F60', 'F61', 'F62', 'F63', 'F64', 'F65', 'F66'],
    buildStatus: 'Built',
    priority: 'P1',
    uiLocation: 'Deal Capsule → Capital Structure Tab',
  },

  M12: {
    id: 'M12',
    name: 'Exit Analysis',
    stage: 'S3: Financial',
    category: 'Financial',
    purpose: 'Exit timing optimization. Cap rate forecast, disposition strategy, hold vs sell analysis.',
    hasAgent: false,
    outputs: [
      { key: 'optimal_exit_year', type: 'number', unit: 'year', description: 'Best exit year' },
      { key: 'exit_cap_rate_range', type: 'object', description: 'Exit cap rate low/mid/high' },
      { key: 'disposition_value', type: 'number', unit: '$', description: 'Expected sale price' },
      { key: 'hold_vs_sell_npv', type: 'object', description: 'NPV comparison by year' },
    ],
    feedsInto: ['M14'],
    receivesFrom: [
      { moduleId: 'M09', dataKeys: ['noi', 'cash_flow_projections'], strength: 'required' },
      { moduleId: 'M05', dataKeys: ['rent_growth_pct'], strength: 'optional' },
      { moduleId: 'M04', dataKeys: ['supply_pressure_score'], strength: 'optional' },
    ],
    formulas: ['F34'],
    buildStatus: 'Partial',
    priority: 'P2',
    uiLocation: 'Deal Capsule → Exit Tab',
  },

  M13: {
    id: 'M13',
    name: 'Due Diligence Tracker',
    stage: 'S4: DD & Risk',
    category: 'Operations',
    purpose: 'Checklist-driven DD workflow. Document tracking, inspection scheduling, vendor management.',
    hasAgent: false,
    outputs: [
      { key: 'dd_completion_pct', type: 'number', unit: '%', description: 'DD completion percentage' },
      { key: 'critical_findings', type: 'array', description: 'Critical DD findings' },
      { key: 'timeline_status', type: 'string', description: 'On track / At risk / Delayed' },
      { key: 'document_checklist', type: 'array', description: 'Document completion status' },
    ],
    feedsInto: ['M14', 'M15'],
    receivesFrom: [],
    formulas: [],
    buildStatus: 'Partial',
    priority: 'P1',
    uiLocation: 'Deal Capsule → DD Tab',
  },

  M14: {
    id: 'M14',
    name: 'Risk Dashboard',
    stage: 'S4: DD & Risk',
    category: 'Intelligence',
    purpose: 'Composite risk: supply, demand, regulatory, market, execution, climate. Auto-calculated.',
    hasAgent: false,
    outputs: [
      { key: 'composite_risk_score', type: 'score', unit: '0-100', description: 'Overall risk score' },
      { key: 'risk_heatmap', type: 'object', description: '6-category risk breakdown' },
      { key: 'risk_trend', type: 'string', description: 'Improving / Worsening / Stable' },
      { key: 'alert_triggers', type: 'array', description: 'Active risk alerts' },
    ],
    feedsInto: ['M01', 'M08', 'M09', 'M25'],
    receivesFrom: [
      { moduleId: 'M04', dataKeys: ['supply_pressure_score', 'months_of_supply'], strength: 'required' },
      { moduleId: 'M06', dataKeys: ['demand_score', 'employer_concentration_risk'], strength: 'required' },
      { moduleId: 'M02', dataKeys: ['entitlement_risk_score'], strength: 'optional' },
      { moduleId: 'M05', dataKeys: ['vacancy_rate', 'rent_growth_pct'], strength: 'optional' },
      { moduleId: 'M07', dataKeys: ['detected_patterns', 'traffic_trajectory'], strength: 'optional' },
      { moduleId: 'M13', dataKeys: ['critical_findings'], strength: 'optional' },
    ],
    formulas: ['F06', 'F09'],
    buildStatus: 'Built',
    priority: 'P0',
    uiLocation: 'Deal Capsule → Risk section in Overview',
    serviceFile: 'risk-scoring.service.ts',
  },

  M15: {
    id: 'M15',
    name: 'Competition Analysis',
    stage: 'S4: DD & Risk',
    category: 'Intelligence',
    purpose: 'Competitive set: identify, track, compare properties within trade area.',
    hasAgent: false,
    outputs: [
      { key: 'comp_set', type: 'array', description: 'Competitive property list' },
      { key: 'rent_comp_matrix', type: 'object', description: 'Rent comparison grid' },
      { key: 'amenity_gap_analysis', type: 'object', description: 'Amenity comparison' },
      { key: 'competitive_position_score', type: 'score', unit: '0-100', description: 'Competitive position' },
    ],
    feedsInto: ['M05', 'M08', 'M09'],
    receivesFrom: [
      { moduleId: 'M04', dataKeys: ['competitive_projects'], strength: 'optional' },
    ],
    formulas: ['F27'],
    buildStatus: 'Partial',
    priority: 'P1',
    uiLocation: 'Deal Capsule → Competition Tab',
  },

  M16: {
    id: 'M16',
    name: 'Deal Pipeline',
    stage: 'S5: Execution',
    category: 'Operations',
    purpose: 'Kanban pipeline: Lead → Prospect → LOI → DD → Close → Asset.',
    hasAgent: false,
    outputs: [
      { key: 'pipeline_stage', type: 'string', description: 'Current deal stage' },
      { key: 'days_in_stage', type: 'number', unit: 'days', description: 'Days in current stage' },
      { key: 'conversion_rates', type: 'object', description: 'Stage conversion metrics' },
      { key: 'deal_velocity', type: 'object', description: 'Deal progression speed metrics' },
    ],
    feedsInto: ['M01', 'M17'],
    receivesFrom: [],
    formulas: [],
    buildStatus: 'Built',
    priority: 'P0',
    uiLocation: 'Dashboard → Pipeline View',
  },

  M17: {
    id: 'M17',
    name: 'Team & Collaboration',
    stage: 'S5: Execution',
    category: 'Operations',
    purpose: 'Multi-user deal access, role-based permissions, activity feed, task assignment.',
    hasAgent: false,
    outputs: [
      { key: 'team_members', type: 'array', description: 'Assigned team members' },
      { key: 'task_status', type: 'object', description: 'Task completion metrics' },
      { key: 'activity_log', type: 'array', description: 'Recent activity feed' },
      { key: 'permission_levels', type: 'object', description: 'Role-based access map' },
    ],
    feedsInto: ['M16', 'M13'],
    receivesFrom: [],
    formulas: [],
    buildStatus: 'Partial',
    priority: 'P2',
    uiLocation: 'Deal Capsule → Team Tab',
  },

  M18: {
    id: 'M18',
    name: 'Documents & Files',
    stage: 'S5: Execution',
    category: 'Operations',
    purpose: 'Document management: upload, version, categorize, OCR. Template library.',
    hasAgent: false,
    outputs: [
      { key: 'document_index', type: 'array', description: 'Document list with metadata' },
      { key: 'version_history', type: 'array', description: 'File version tracking' },
      { key: 'auto_tags', type: 'array', description: 'Auto-classified document tags' },
      { key: 'ocr_extracted_data', type: 'object', description: 'OCR-extracted structured data' },
    ],
    feedsInto: ['M13', 'M09'],
    receivesFrom: [],
    formulas: [],
    buildStatus: 'Partial',
    priority: 'P1',
    uiLocation: 'Deal Capsule → Documents Tab',
    serviceFile: 'documentsFiles.service.ts',
  },

  M19: {
    id: 'M19',
    name: 'News Intelligence',
    stage: 'S6: Platform',
    category: 'Intelligence',
    purpose: 'Scrape, classify, extract structured data from news. Employment events, zoning changes.',
    hasAgent: false,
    outputs: [
      { key: 'classified_events', type: 'array', description: 'Structured news events' },
      { key: 'classified_demand_events', type: 'array', description: 'Demand-classified events' },
      { key: 'classified_supply_events', type: 'array', description: 'Supply-classified events' },
      { key: 'sentiment_score', type: 'number', description: 'Market sentiment' },
      { key: 'geographic_tagging', type: 'object', description: 'Event location tags' },
    ],
    feedsInto: ['M06', 'M04', 'M14'],
    receivesFrom: [],
    formulas: [],
    buildStatus: 'Partial',
    priority: 'P0',
    uiLocation: 'Dashboard → News Feed',
    serviceFile: 'email-news-extraction.service.ts',
  },

  M20: {
    id: 'M20',
    name: 'Map Intelligence',
    stage: 'S6: Platform',
    category: 'Core',
    purpose: 'Interactive war map. Property bubbles with JEDI scores. Layer toggles.',
    hasAgent: false,
    outputs: [
      { key: 'property_map', type: 'object', description: 'Map data with property locations' },
      { key: 'heat_maps', type: 'object', description: 'Heat map layer data' },
      { key: 'layer_overlays', type: 'array', description: 'Active map layers' },
      { key: 'trade_area_boundaries', type: 'object', description: 'Drawn trade area GeoJSON' },
    ],
    feedsInto: ['M01', 'M16'],
    receivesFrom: [
      { moduleId: 'M25', dataKeys: ['jedi_score'], strength: 'required' },
      { moduleId: 'M04', dataKeys: ['competitive_projects'], strength: 'optional' },
      { moduleId: 'M06', dataKeys: ['demand_units_total'], strength: 'optional' },
      { moduleId: 'M02', dataKeys: ['zoning_code'], strength: 'optional' },
    ],
    formulas: [],
    buildStatus: 'Partial',
    priority: 'P0',
    uiLocation: 'Dashboard → Map View',
  },

  M21: {
    id: 'M21',
    name: 'AI Chat (Opus)',
    stage: 'S6: Platform',
    category: 'Core',
    purpose: 'Claude-powered conversational analysis. Natural language to structured queries.',
    hasAgent: false,
    outputs: [
      { key: 'insights', type: 'array', description: 'NL analysis results' },
      { key: 'analysis_requests', type: 'array', description: 'Structured queries generated' },
      { key: 'report_generation', type: 'object', description: 'Generated reports' },
    ],
    feedsInto: [],
    receivesFrom: [],
    formulas: [],
    buildStatus: 'Partial',
    priority: 'P1',
    uiLocation: 'Global → Chat Panel',
    serviceFile: 'opus.service.ts',
  },

  M22: {
    id: 'M22',
    name: 'Portfolio Manager',
    stage: 'S6: Platform',
    category: 'Financial',
    purpose: 'Owned assets view. Actual vs projected performance. Budget tracking.',
    hasAgent: false,
    outputs: [
      { key: 'portfolio_noi', type: 'number', unit: '$', description: 'Total portfolio NOI' },
      { key: 'actual_vs_budget', type: 'object', description: 'Variance tracking' },
      { key: 'asset_performance_ranking', type: 'array', description: 'Asset ranking' },
      { key: 'portfolio_risk_score', type: 'score', unit: '0-100', description: 'Portfolio-level risk' },
    ],
    feedsInto: ['M01', 'M20'],
    receivesFrom: [
      { moduleId: 'M09', dataKeys: ['noi', 'cash_flow_projections'], strength: 'required' },
    ],
    formulas: ['F35'],
    buildStatus: 'Partial',
    priority: 'P1',
    uiLocation: 'Dashboard → Assets View',
  },

  M23: {
    id: 'M23',
    name: 'Alerts & Notifications',
    stage: 'S6: Platform',
    category: 'Operations',
    purpose: 'Real-time alerts: JEDI score changes, news events, risk threshold breaches.',
    hasAgent: false,
    outputs: [
      { key: 'alert_feed', type: 'array', description: 'Active alerts list' },
      { key: 'alert_rules', type: 'array', description: 'Configured alert rules' },
      { key: 'notification_preferences', type: 'object', description: 'User notification settings' },
      { key: 'alert_history', type: 'array', description: 'Past alerts' },
    ],
    feedsInto: [],
    receivesFrom: [
      { moduleId: 'M25', dataKeys: ['jedi_score'], strength: 'required' },
      { moduleId: 'M06', dataKeys: ['demand_score'], strength: 'optional' },
      { moduleId: 'M04', dataKeys: ['supply_pressure_score'], strength: 'optional' },
      { moduleId: 'M14', dataKeys: ['composite_risk_score', 'alert_triggers'], strength: 'optional' },
      { moduleId: 'M16', dataKeys: ['pipeline_stage'], strength: 'optional' },
    ],
    formulas: [],
    buildStatus: 'Partial',
    priority: 'P1',
    uiLocation: 'Global → Notification Bell',
    serviceFile: 'notification.service.ts',
  },

  M24: {
    id: 'M24',
    name: 'Settings & Preferences',
    stage: 'S6: Platform',
    category: 'Core',
    purpose: 'User preferences: keywords, trade areas, data sources, module activation.',
    hasAgent: false,
    outputs: [
      { key: 'user_config', type: 'object', description: 'User configuration' },
      { key: 'active_modules', type: 'array', description: 'Enabled modules list' },
      { key: 'keyword_lists', type: 'array', description: 'Tracked keywords' },
      { key: 'trade_area_definitions', type: 'array', description: 'Saved trade areas' },
    ],
    feedsInto: [],
    receivesFrom: [],
    formulas: [],
    buildStatus: 'Partial',
    priority: 'P2',
    uiLocation: 'Settings Page',
  },

  M25: {
    id: 'M25',
    name: 'JEDI Score Engine',
    stage: 'S6: Platform',
    category: 'Core',
    purpose: 'Master scoring: Demand(30%) + Supply(25%) + Momentum(20%) + Position(15%) + Risk(10%).',
    hasAgent: false,
    outputs: [
      { key: 'jedi_score', type: 'score', unit: '0-100', description: 'Composite JEDI Score' },
      { key: 'sub_scores', type: 'object', description: '5 sub-score breakdown' },
      { key: 'score_delta', type: 'number', description: 'Change from last calculation' },
      { key: 'score_history', type: 'array', description: 'Historical scores' },
      { key: 'confidence_level', type: 'number', unit: '0-100', description: 'Score confidence' },
    ],
    feedsInto: ['M01', 'M08', 'M14', 'M20', 'M23'],
    receivesFrom: [
      { moduleId: 'M04', dataKeys: ['supply_pressure_score'], strength: 'required' },
      { moduleId: 'M05', dataKeys: ['rent_growth_pct', 'vacancy_rate', 'submarket_rank'], strength: 'required' },
      { moduleId: 'M06', dataKeys: ['demand_score'], strength: 'required' },
      { moduleId: 'M07', dataKeys: ['predicted_leases_week', 'traffic_trend', 'traffic_trajectory', 'trend_momentum', 'trend_direction'], strength: 'optional' },
      { moduleId: 'M14', dataKeys: ['composite_risk_score'], strength: 'required' },
    ],
    formulas: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06'],
    buildStatus: 'Built',
    priority: 'P0',
    uiLocation: 'Embedded in M01, M20',
    serviceFile: 'jedi-score.service.ts',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getModule(id: ModuleId): ModuleDefinition {
  return MODULE_REGISTRY[id];
}

export function getModulesByPriority(priority: Priority): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(m => m.priority === priority);
}

export function getModulesByStage(stage: ModuleStage): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(m => m.stage === stage);
}

export function getModulesByCategory(category: ModuleCategory): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(m => m.category === category);
}

export function getModulesByBuildStatus(status: BuildStatus): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(m => m.buildStatus === status);
}

export function getUpstreamModules(id: ModuleId): ModuleId[] {
  return MODULE_REGISTRY[id].receivesFrom.map(d => d.moduleId);
}

export function getDownstreamModules(id: ModuleId): ModuleId[] {
  return MODULE_REGISTRY[id].feedsInto;
}

/**
 * Topological sort of modules based on dependency graph.
 * Returns modules in build order (dependencies first).
 */
export function getModuleBuildOrder(): ModuleId[] {
  const visited = new Set<ModuleId>();
  const result: ModuleId[] = [];

  function visit(id: ModuleId) {
    if (visited.has(id)) return;
    visited.add(id);
    const deps = MODULE_REGISTRY[id].receivesFrom
      .filter(d => d.strength === 'required')
      .map(d => d.moduleId);
    for (const dep of deps) {
      visit(dep);
    }
    result.push(id);
  }

  for (const id of Object.keys(MODULE_REGISTRY) as ModuleId[]) {
    visit(id);
  }

  return result;
}

/**
 * Get all modules that a given module transitively depends on.
 */
export function getTransitiveDependencies(id: ModuleId): Set<ModuleId> {
  const deps = new Set<ModuleId>();

  function collect(moduleId: ModuleId) {
    for (const dep of MODULE_REGISTRY[moduleId].receivesFrom) {
      if (!deps.has(dep.moduleId)) {
        deps.add(dep.moduleId);
        collect(dep.moduleId);
      }
    }
  }

  collect(id);
  return deps;
}

export const ALL_MODULE_IDS = Object.keys(MODULE_REGISTRY) as ModuleId[];
