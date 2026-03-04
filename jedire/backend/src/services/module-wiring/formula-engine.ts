/**
 * Formula Engine
 *
 * Implements all 35 formulas (F01-F35) from the JEDI RE Module Wiring Blueprint.
 * Each formula is a pure function that takes typed inputs and returns typed outputs.
 * The engine provides a registry for dynamic formula lookup and execution.
 */

// ============================================================================
// Types
// ============================================================================

export type FormulaId =
  | 'F01' | 'F02' | 'F03' | 'F04' | 'F05' | 'F06' | 'F07' | 'F08' | 'F09' | 'F10'
  | 'F11' | 'F12' | 'F13' | 'F14' | 'F15' | 'F16' | 'F17' | 'F18' | 'F19' | 'F20'
  | 'F21' | 'F22' | 'F23' | 'F24' | 'F25' | 'F26' | 'F27' | 'F28' | 'F29' | 'F30'
  | 'F31' | 'F32' | 'F33' | 'F34' | 'F35'
  | 'F40' | 'F41' | 'F42' | 'F43' | 'F44' | 'F45' | 'F46' | 'F47' | 'F48' | 'F49'
  | 'F50' | 'F51' | 'F52' | 'F53' | 'F54' | 'F55' | 'F56' | 'F57' | 'F58' | 'F59'
  | 'F60' | 'F61' | 'F62' | 'F63' | 'F64' | 'F65' | 'F66';

export type FormulaCategory =
  | 'Scoring' | 'Supply' | 'Demand' | 'Zoning' | 'Development'
  | 'Financial' | 'Strategy' | 'Market' | 'Traffic' | 'Scenario' | 'Portfolio'
  | 'Capital Structure' | 'Rate Environment' | 'Equity Waterfall' | 'Debt Lifecycle';

export type FormulaStatus = 'Built' | 'Partial' | 'New';

export interface FormulaDefinition {
  id: FormulaId;
  name: string;
  modules: string[];
  category: FormulaCategory;
  description: string;
  inputKeys: string[];
  outputKey: string;
  unit: string;
  updateTrigger: string;
  agentRequired: boolean;
  status: FormulaStatus;
  calculate: (inputs: Record<string, any>) => any;
}

// ============================================================================
// Formula Implementations
// ============================================================================

const F01_JEDIScoreComposite: FormulaDefinition = {
  id: 'F01',
  name: 'JEDI Score (Composite)',
  modules: ['M25'],
  category: 'Scoring',
  description: '(demand × 0.30) + (supply × 0.25) + (momentum × 0.20) + (position × 0.15) + (risk × 0.10)',
  inputKeys: ['demand_score', 'supply_score', 'momentum_score', 'position_score', 'risk_score'],
  outputKey: 'jedi_score',
  unit: 'Score (0-100)',
  updateTrigger: 'On any sub-score change',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const { demand_score, supply_score, momentum_score, position_score, risk_score } = inputs;
    return parseFloat((
      (demand_score * 0.30) +
      (supply_score * 0.25) +
      (momentum_score * 0.20) +
      (position_score * 0.15) +
      (risk_score * 0.10)
    ).toFixed(2));
  },
};

const F02_DemandSubScore: FormulaDefinition = {
  id: 'F02',
  name: 'Demand Sub-Score',
  modules: ['M06', 'M25'],
  category: 'Scoring',
  description: 'Σ(event_impact × confidence_weight × distance_decay) / normalizer',
  inputKeys: ['demand_events', 'confidence_weights'],
  outputKey: 'demand_score',
  unit: 'Score (0-100)',
  updateTrigger: 'On new demand event',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const { demand_events = [] } = inputs;
    if (demand_events.length === 0) return 50.0;

    const confidenceMap: Record<string, number> = { high: 1.0, medium: 0.7, low: 0.4 };
    let totalImpact = 0;

    for (const event of demand_events) {
      const confidence = confidenceMap[event.confidence] || 0.5;
      const distanceDecay = 1 / (1 + (event.distance_miles || 0) / 5);
      totalImpact += (event.impact || 0) * confidence * distanceDecay;
    }

    const normalizer = Math.max(1, demand_events.length);
    const score = 50 + (totalImpact / normalizer);
    return parseFloat(Math.max(0, Math.min(100, score)).toFixed(2));
  },
};

const F03_SupplySubScore: FormulaDefinition = {
  id: 'F03',
  name: 'Supply Sub-Score',
  modules: ['M04', 'M25'],
  category: 'Scoring',
  description: '100 - (supply_pressure × 100)',
  inputKeys: ['pipeline_units', 'existing_units', 'absorption_rate'],
  outputKey: 'supply_score',
  unit: 'Score (0-100)',
  updateTrigger: 'On new supply event',
  agentRequired: true,
  status: 'Built',
  calculate: (inputs) => {
    const { pipeline_units, existing_units, absorption_rate } = inputs;
    if (!existing_units || !absorption_rate) return 50.0;
    const supplyPressure = pipeline_units / (existing_units * absorption_rate * 12);
    const score = 100 - (supplyPressure * 100);
    return parseFloat(Math.max(0, Math.min(100, score)).toFixed(2));
  },
};

const F04_MomentumSubScore: FormulaDefinition = {
  id: 'F04',
  name: 'Momentum Sub-Score',
  modules: ['M05', 'M25'],
  category: 'Scoring',
  description: '(rent_growth_percentile × 0.4) + (transaction_velocity_percentile × 0.3) + (sentiment × 0.3)',
  inputKeys: ['rent_growth_rate', 'transaction_count', 'market_sentiment'],
  outputKey: 'momentum_score',
  unit: 'Score (0-100)',
  updateTrigger: 'Monthly recalc',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { rent_growth_rate = 0, transaction_count = 0, market_sentiment = 50 } = inputs;
    // Convert rent growth to percentile (3% = ~50th, 6% = ~85th, 0% = ~15th)
    const rentGrowthPercentile = Math.max(0, Math.min(100, 50 + (rent_growth_rate - 3) * 17));
    // Transaction velocity percentile (5 = ~50th, 10+ = ~90th)
    const transactionPercentile = Math.max(0, Math.min(100, transaction_count * 10));
    const score = (rentGrowthPercentile * 0.4) + (transactionPercentile * 0.3) + (market_sentiment * 0.3);
    return parseFloat(Math.max(0, Math.min(100, score)).toFixed(2));
  },
};

const F05_PositionSubScore: FormulaDefinition = {
  id: 'F05',
  name: 'Position Sub-Score',
  modules: ['M05', 'M25'],
  category: 'Scoring',
  description: '(submarket_rank_percentile × 0.5) + (amenity_score × 0.25) + (competitive_position × 0.25)',
  inputKeys: ['submarket_rank', 'amenity_proximity_scores', 'comp_set_position'],
  outputKey: 'position_score',
  unit: 'Score (0-100)',
  updateTrigger: 'On property change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { submarket_rank = 50, amenity_proximity_scores = [], comp_set_position = 50 } = inputs;
    const amenityScore = amenity_proximity_scores.length > 0
      ? amenity_proximity_scores.reduce((sum: number, s: number) => sum + s, 0) / amenity_proximity_scores.length
      : 50;
    const score = (submarket_rank * 0.5) + (amenityScore * 0.25) + (comp_set_position * 0.25);
    return parseFloat(Math.max(0, Math.min(100, score)).toFixed(2));
  },
};

const F06_RiskSubScoreComposite: FormulaDefinition = {
  id: 'F06',
  name: 'Risk Sub-Score (Composite)',
  modules: ['M14', 'M25'],
  category: 'Scoring',
  description: '(supply_risk × 0.35) + (demand_risk × 0.35) + (regulatory × 0.10) + (market × 0.10) + (execution × 0.05) + (climate × 0.05)',
  inputKeys: ['supply_risk', 'demand_risk', 'regulatory_risk', 'market_risk', 'execution_risk', 'climate_risk'],
  outputKey: 'risk_score',
  unit: 'Score (0-100, inverted)',
  updateTrigger: 'On risk factor change',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const {
      supply_risk = 50, demand_risk = 50,
      regulatory_risk = 50, market_risk = 50,
      execution_risk = 50, climate_risk = 50,
    } = inputs;
    // Composite risk (higher = more risky)
    const rawRisk =
      (supply_risk * 0.35) + (demand_risk * 0.35) +
      (regulatory_risk * 0.10) + (market_risk * 0.10) +
      (execution_risk * 0.05) + (climate_risk * 0.05);
    // Invert: lower risk = higher score for JEDI
    return parseFloat((100 - rawRisk).toFixed(2));
  },
};

const F07_SupplyPressureRatio: FormulaDefinition = {
  id: 'F07',
  name: 'Supply Pressure Ratio',
  modules: ['M04'],
  category: 'Supply',
  description: 'pipeline_units / (existing_units × annual_absorption_rate)',
  inputKeys: ['pipeline_units', 'existing_units', 'absorption_rate'],
  outputKey: 'supply_pressure',
  unit: 'Ratio (>1.0 = oversupply)',
  updateTrigger: 'On supply event',
  agentRequired: true,
  status: 'Built',
  calculate: (inputs) => {
    const { pipeline_units, existing_units, absorption_rate } = inputs;
    if (!existing_units || !absorption_rate) return 0;
    return parseFloat((pipeline_units / (existing_units * absorption_rate)).toFixed(4));
  },
};

const F08_MonthsOfSupply: FormulaDefinition = {
  id: 'F08',
  name: 'Months of Supply',
  modules: ['M04'],
  category: 'Supply',
  description: 'pipeline_units / monthly_absorption',
  inputKeys: ['pipeline_units', 'existing_units', 'absorption_rate'],
  outputKey: 'months_to_absorb',
  unit: 'Months',
  updateTrigger: 'On supply event',
  agentRequired: true,
  status: 'Built',
  calculate: (inputs) => {
    const { pipeline_units, existing_units, absorption_rate } = inputs;
    if (!existing_units || !absorption_rate) return 0;
    const monthlyAbsorption = existing_units * (absorption_rate / 12);
    if (monthlyAbsorption === 0) return 999;
    return parseFloat((pipeline_units / monthlyAbsorption).toFixed(2));
  },
};

const F09_SupplyRiskScore: FormulaDefinition = {
  id: 'F09',
  name: 'Supply Risk Score',
  modules: ['M04', 'M14'],
  category: 'Supply',
  description: 'Base = min(100, months_to_absorb × 10) + escalation - de-escalation',
  inputKeys: ['months_to_absorb', 'luxury_pct', 'developer_concentration', 'absorption_trend'],
  outputKey: 'supply_risk_score',
  unit: 'Score (0-100)',
  updateTrigger: 'On supply event',
  agentRequired: true,
  status: 'Built',
  calculate: (inputs) => {
    const {
      months_to_absorb = 0,
      luxury_pct = 0,
      developer_concentration = 0,
      absorption_trend = 'stable',
    } = inputs;
    let base = Math.min(100, months_to_absorb * 10);
    // Escalation factors
    if (luxury_pct > 0.40) base += 15;
    if (developer_concentration > 0.30) base += 10;
    // De-escalation factors
    if (absorption_trend === 'accelerating') base -= 10;
    return parseFloat(Math.max(0, Math.min(100, base)).toFixed(2));
  },
};

const F10_HousingDemandConversion: FormulaDefinition = {
  id: 'F10',
  name: 'Housing Demand Conversion',
  modules: ['M06'],
  category: 'Demand',
  description: 'people_count × conversion_rate × (1 - remote_work_pct) × geographic_concentration',
  inputKeys: ['people_count', 'category', 'remote_work_pct', 'geographic_concentration'],
  outputKey: 'total_housing_units_demanded',
  unit: 'Units',
  updateTrigger: 'On news event',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const { people_count, category, remote_work_pct = 0, geographic_concentration = 1.0 } = inputs;
    const conversionRates: Record<string, number> = {
      employment: 0.3,
      university: 0.8,
      military: 0.9,
    };
    const rate = conversionRates[category] || 0.3;
    return Math.round(people_count * rate * (1 - remote_work_pct) * geographic_concentration);
  },
};

const F11_DemandPhasing: FormulaDefinition = {
  id: 'F11',
  name: 'Demand Phasing (Quarterly)',
  modules: ['M06'],
  category: 'Demand',
  description: 'Phasing templates by category: Employment: Q1=10%, Q2=25%, Q3=35%, Q4=30%',
  inputKeys: ['total_units', 'category', 'start_date'],
  outputKey: 'quarterly_demand_projections',
  unit: 'Units/Quarter',
  updateTrigger: 'On event creation',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const { total_units, category } = inputs;
    const templates: Record<string, number[]> = {
      employment: [0.10, 0.25, 0.35, 0.30],
      university: [0.05, 0.10, 0.70, 0.15],
      military: [0.15, 0.30, 0.30, 0.25],
      default: [0.25, 0.25, 0.25, 0.25],
    };
    const phasing = templates[category] || templates.default;
    return phasing.map((pct, i) => ({
      quarter: `Q${i + 1}`,
      units: Math.round(total_units * pct),
      percentage: pct,
    }));
  },
};

const F12_IncomeTierStratification: FormulaDefinition = {
  id: 'F12',
  name: 'Income Tier Stratification',
  modules: ['M06'],
  category: 'Demand',
  description: 'Stratify demand units by income tier',
  inputKeys: ['income_tier', 'total_units'],
  outputKey: 'units_by_tier',
  unit: 'Units',
  updateTrigger: 'On event creation',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const { income_tier, total_units } = inputs;
    const tierDistributions: Record<string, { affordable: number; workforce: number; market: number; luxury: number }> = {
      low: { affordable: 0.60, workforce: 0.30, market: 0.08, luxury: 0.02 },
      standard: { affordable: 0.20, workforce: 0.60, market: 0.15, luxury: 0.05 },
      high: { affordable: 0.10, workforce: 0.40, market: 0.30, luxury: 0.20 },
      luxury: { affordable: 0.05, workforce: 0.15, market: 0.25, luxury: 0.55 },
    };
    const dist = tierDistributions[income_tier] || tierDistributions.standard;
    return {
      affordable: Math.round(total_units * dist.affordable),
      workforce: Math.round(total_units * dist.workforce),
      market: Math.round(total_units * dist.market),
      luxury: Math.round(total_units * dist.luxury),
    };
  },
};

const F13_ZoningUtilization: FormulaDefinition = {
  id: 'F13',
  name: 'Zoning Utilization %',
  modules: ['M02'],
  category: 'Zoning',
  description: '(current_units / max_allowed_units) × 100',
  inputKeys: ['current_units', 'land_area_acres', 'max_density_per_acre'],
  outputKey: 'zoning_utilization_pct',
  unit: '%',
  updateTrigger: 'On zoning data update',
  agentRequired: true,
  status: 'Built',
  calculate: (inputs) => {
    const { current_units, land_area_acres, max_density_per_acre } = inputs;
    const maxUnits = land_area_acres * max_density_per_acre;
    if (maxUnits === 0) return 0;
    return parseFloat(((current_units / maxUnits) * 100).toFixed(2));
  },
};

const F14_BuildingEnvelope: FormulaDefinition = {
  id: 'F14',
  name: 'Building Envelope (As-of-Right)',
  modules: ['M03'],
  category: 'Development',
  description: 'Calculate max buildable area, GFA, units, parking from zoning constraints',
  inputKeys: ['land_area', 'setbacks', 'far', 'max_height', 'avg_unit_size', 'parking_ratio'],
  outputKey: 'building_envelope',
  unit: 'Units/SF',
  updateTrigger: 'On zoning change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { land_area, setbacks, far, max_height, avg_unit_size = 850, parking_ratio = 1.0 } = inputs;
    // Calculate setback area reduction
    const frontSetback = setbacks?.front || 0;
    const sideSetback = setbacks?.side || 0;
    const rearSetback = setbacks?.rear || 0;
    // Rough approximation: reduce each dimension by setbacks
    const sideLength = Math.sqrt(land_area);
    const buildableWidth = Math.max(0, sideLength - (2 * sideSetback));
    const buildableDepth = Math.max(0, sideLength - frontSetback - rearSetback);
    const buildableArea = buildableWidth * buildableDepth;

    const maxGFA = buildableArea * far;
    const maxUnits = Math.floor(maxGFA / avg_unit_size);
    const floorHeight = 10; // feet
    const buildingHeight = max_height || (far * floorHeight);
    const parkingSpaces = Math.ceil(maxUnits * parking_ratio);

    return {
      buildable_area: parseFloat(buildableArea.toFixed(0)),
      max_gfa: parseFloat(maxGFA.toFixed(0)),
      max_units: maxUnits,
      building_height: buildingHeight,
      parking_spaces: parkingSpaces,
    };
  },
};

const F15_DevelopmentCapacityGap: FormulaDefinition = {
  id: 'F15',
  name: 'Development Capacity Gap',
  modules: ['M03'],
  category: 'Development',
  description: 'max_buildable_units - existing_units; 10yr gap = (projected_demand × 10) - (existing + pipeline)',
  inputKeys: ['max_buildable_units', 'existing_units', 'projected_annual_demand', 'pipeline_units'],
  outputKey: 'capacity_gap',
  unit: 'Units',
  updateTrigger: 'On demand/supply change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { max_buildable_units, existing_units, projected_annual_demand = 0, pipeline_units = 0 } = inputs;
    const capacityGap = max_buildable_units - existing_units;
    const tenYearGap = (projected_annual_demand * 10) - (existing_units + pipeline_units);
    return {
      capacity_gap_units: capacityGap,
      ten_year_supply_gap: tenYearGap,
    };
  },
};

const F16_NOI: FormulaDefinition = {
  id: 'F16',
  name: 'Net Operating Income (NOI)',
  modules: ['M09'],
  category: 'Financial',
  description: 'EGI - OpEx; EGI = (units × avg_rent × 12) × (1 - vacancy) + other_income',
  inputKeys: ['units', 'avg_rent', 'vacancy_rate', 'other_income', 'opex_ratio'],
  outputKey: 'noi',
  unit: '$',
  updateTrigger: 'On assumption change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { units, avg_rent, vacancy_rate = 0.05, other_income = 0, opex_ratio = 0.40 } = inputs;
    const grossPotentialIncome = units * avg_rent * 12;
    const effectiveGrossIncome = (grossPotentialIncome * (1 - vacancy_rate)) + other_income;
    const operatingExpenses = effectiveGrossIncome * opex_ratio;
    return parseFloat((effectiveGrossIncome - operatingExpenses).toFixed(2));
  },
};

const F17_CapRate: FormulaDefinition = {
  id: 'F17',
  name: 'Cap Rate (Going-In)',
  modules: ['M09'],
  category: 'Financial',
  description: 'NOI / purchase_price',
  inputKeys: ['noi', 'purchase_price'],
  outputKey: 'cap_rate',
  unit: '%',
  updateTrigger: 'On price or NOI change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { noi, purchase_price } = inputs;
    if (!purchase_price || purchase_price === 0) return 0;
    return parseFloat(((noi / purchase_price) * 100).toFixed(2));
  },
};

const F18_CashOnCash: FormulaDefinition = {
  id: 'F18',
  name: 'Cash-on-Cash Return',
  modules: ['M09'],
  category: 'Financial',
  description: 'annual_btcf / total_equity_invested',
  inputKeys: ['noi', 'annual_debt_service', 'total_equity'],
  outputKey: 'coc_return',
  unit: '%',
  updateTrigger: 'On financial change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { noi, annual_debt_service = 0, total_equity } = inputs;
    if (!total_equity || total_equity === 0) return 0;
    const btcf = noi - annual_debt_service;
    return parseFloat(((btcf / total_equity) * 100).toFixed(2));
  },
};

const F19_IRR: FormulaDefinition = {
  id: 'F19',
  name: 'IRR (Internal Rate of Return)',
  modules: ['M09'],
  category: 'Financial',
  description: 'Solve for r: 0 = -equity + Σ(CFt / (1+r)^t) + (sale_proceeds / (1+r)^n)',
  inputKeys: ['initial_equity', 'annual_cash_flows', 'exit_proceeds', 'hold_years'],
  outputKey: 'irr',
  unit: '%',
  updateTrigger: 'On any financial change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { initial_equity, annual_cash_flows = [], exit_proceeds = 0 } = inputs;
    // Newton-Raphson IRR approximation
    const cashFlows = [-initial_equity, ...annual_cash_flows];
    cashFlows[cashFlows.length - 1] = (cashFlows[cashFlows.length - 1] || 0) + exit_proceeds;

    let rate = 0.10; // initial guess
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0;
      let dnpv = 0;
      for (let t = 0; t < cashFlows.length; t++) {
        npv += cashFlows[t] / Math.pow(1 + rate, t);
        dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(npv) < 0.01) break;
      if (dnpv === 0) break;
      rate = rate - npv / dnpv;
    }
    return parseFloat((rate * 100).toFixed(2));
  },
};

const F20_EquityMultiple: FormulaDefinition = {
  id: 'F20',
  name: 'Equity Multiple',
  modules: ['M09'],
  category: 'Financial',
  description: '(total_distributions + exit_proceeds) / total_equity_invested',
  inputKeys: ['annual_cash_flows', 'exit_proceeds', 'total_equity'],
  outputKey: 'equity_multiple',
  unit: 'x',
  updateTrigger: 'On financial change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { annual_cash_flows = [], exit_proceeds = 0, total_equity } = inputs;
    if (!total_equity || total_equity === 0) return 0;
    const totalDistributions = annual_cash_flows.reduce((sum: number, cf: number) => sum + cf, 0);
    return parseFloat(((totalDistributions + exit_proceeds) / total_equity).toFixed(2));
  },
};

const F21_DSCR: FormulaDefinition = {
  id: 'F21',
  name: 'DSCR (Debt Service Coverage)',
  modules: ['M11'],
  category: 'Financial',
  description: 'NOI / annual_debt_service',
  inputKeys: ['noi', 'loan_amount', 'interest_rate', 'amortization_years'],
  outputKey: 'dscr',
  unit: 'Ratio (>1.25 = healthy)',
  updateTrigger: 'On NOI or debt change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { noi, loan_amount, interest_rate, amortization_years = 30 } = inputs;
    if (!loan_amount || !interest_rate) return 0;
    const monthlyRate = interest_rate / 12;
    const n = amortization_years * 12;
    const monthlyPayment = loan_amount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    const annualDebtService = monthlyPayment * 12;
    if (annualDebtService === 0) return 0;
    return parseFloat((noi / annualDebtService).toFixed(2));
  },
};

const F22_DebtYield: FormulaDefinition = {
  id: 'F22',
  name: 'Debt Yield',
  modules: ['M11'],
  category: 'Financial',
  description: 'NOI / loan_amount',
  inputKeys: ['noi', 'loan_amount'],
  outputKey: 'debt_yield',
  unit: '%',
  updateTrigger: 'On NOI or debt change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { noi, loan_amount } = inputs;
    if (!loan_amount || loan_amount === 0) return 0;
    return parseFloat(((noi / loan_amount) * 100).toFixed(2));
  },
};

const F23_StrategyScore: FormulaDefinition = {
  id: 'F23',
  name: 'Strategy Score (per strategy)',
  modules: ['M08'],
  category: 'Strategy',
  description: 'For each strategy: score = Σ(signal_score × strategy_weight)',
  inputKeys: ['demand_score', 'supply_score', 'momentum_score', 'position_score', 'risk_score', 'strategy_weights'],
  outputKey: 'strategy_score',
  unit: 'Score (0-100)',
  updateTrigger: 'On any JEDI sub-score change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { demand_score, supply_score, momentum_score, position_score, risk_score, strategy_weights } = inputs;
    const signals = { demand_score, supply_score, momentum_score, position_score, risk_score };
    const signalKeys = ['demand_score', 'supply_score', 'momentum_score', 'position_score', 'risk_score'];

    let score = 0;
    for (const key of signalKeys) {
      const weight = strategy_weights?.[key] || 0.2;
      score += (signals[key as keyof typeof signals] || 50) * weight;
    }
    return parseFloat(Math.max(0, Math.min(100, score)).toFixed(2));
  },
};

const F24_ArbitrageFlag: FormulaDefinition = {
  id: 'F24',
  name: 'Arbitrage Opportunity Flag',
  modules: ['M08'],
  category: 'Strategy',
  description: 'Flag if MAX - second_max > 15 points and max > 70',
  inputKeys: ['strategy_scores'],
  outputKey: 'arbitrage_result',
  unit: 'Flag',
  updateTrigger: 'On strategy score change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { strategy_scores } = inputs;
    const scores = Object.entries(strategy_scores || {})
      .map(([strategy, score]) => ({ strategy, score: score as number }))
      .sort((a, b) => b.score - a.score);

    if (scores.length < 2) return { arbitrage_flag: false, arbitrage_delta: 0, recommended_strategy: scores[0]?.strategy || 'rental' };

    const delta = scores[0].score - scores[1].score;
    return {
      arbitrage_flag: delta > 15 && scores[0].score > 70,
      arbitrage_delta: parseFloat(delta.toFixed(2)),
      recommended_strategy: scores[0].strategy,
    };
  },
};

const F25_StrategyROI: FormulaDefinition = {
  id: 'F25',
  name: 'Strategy-Specific ROI',
  modules: ['M08', 'M09'],
  category: 'Strategy',
  description: 'BTS: yield_on_cost; Flip: profit_margin; Rental: CoC; STR: RevPAR premium',
  inputKeys: ['strategy', 'stabilized_noi', 'total_dev_cost', 'arv', 'acquisition_cost', 'rehab_cost', 'btcf', 'equity', 'revpar', 'long_term_rent'],
  outputKey: 'roi_by_strategy',
  unit: '%',
  updateTrigger: 'On financial change',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { strategy } = inputs;
    switch (strategy) {
      case 'build_to_sell':
        return inputs.total_dev_cost ? parseFloat(((inputs.stabilized_noi / inputs.total_dev_cost) * 100).toFixed(2)) : 0;
      case 'flip':
        return inputs.acquisition_cost ? parseFloat((((inputs.arv - inputs.acquisition_cost - (inputs.rehab_cost || 0)) / (inputs.acquisition_cost + (inputs.rehab_cost || 0))) * 100).toFixed(2)) : 0;
      case 'rental':
        return inputs.equity ? parseFloat(((inputs.btcf / inputs.equity) * 100).toFixed(2)) : 0;
      case 'str':
        return inputs.long_term_rent ? parseFloat((((inputs.revpar - inputs.long_term_rent) / inputs.long_term_rent) * 100).toFixed(2)) : 0;
      default:
        return 0;
    }
  },
};

const F26_SubmarketRank: FormulaDefinition = {
  id: 'F26',
  name: 'Submarket Rank',
  modules: ['M05'],
  category: 'Market',
  description: 'percentile_rank(rent_growth × 0.3 + absorption × 0.25 + vacancy_inverse × 0.25 + pop_growth × 0.2)',
  inputKeys: ['rent_growth', 'absorption_rate', 'vacancy_rate', 'population_growth_rate'],
  outputKey: 'submarket_rank_percentile',
  unit: 'Percentile (0-100)',
  updateTrigger: 'Monthly',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { rent_growth = 0, absorption_rate = 0, vacancy_rate = 0.05, population_growth_rate = 0 } = inputs;
    // Normalize each metric to 0-100 scale
    const rentGrowthScore = Math.max(0, Math.min(100, (rent_growth + 5) * 10)); // -5% to +5% → 0-100
    const absorptionScore = Math.max(0, Math.min(100, absorption_rate * 100)); // 0-1 → 0-100
    const vacancyInverseScore = Math.max(0, Math.min(100, (1 - vacancy_rate) * 100)); // lower vacancy = higher
    const popGrowthScore = Math.max(0, Math.min(100, (population_growth_rate + 2) * 25)); // -2% to +2% → 0-100

    const composite =
      (rentGrowthScore * 0.3) +
      (absorptionScore * 0.25) +
      (vacancyInverseScore * 0.25) +
      (popGrowthScore * 0.2);

    return parseFloat(Math.max(0, Math.min(100, composite)).toFixed(2));
  },
};

const F27_RentCompAnalysis: FormulaDefinition = {
  id: 'F27',
  name: 'Rent Comp Analysis',
  modules: ['M05', 'M15'],
  category: 'Market',
  description: 'subject_rent_psf / avg_comp_rent_psf; premium = (subject - avg) / avg × 100',
  inputKeys: ['subject_rent', 'comp_rents', 'comp_sizes', 'comp_amenities'],
  outputKey: 'rent_comp_result',
  unit: '%',
  updateTrigger: 'On comp data update',
  agentRequired: false,
  status: 'Partial',
  calculate: (inputs) => {
    const { subject_rent, comp_rents = [] } = inputs;
    if (comp_rents.length === 0) return { rent_premium_pct: 0, comp_position: 50 };
    const avgCompRent = comp_rents.reduce((sum: number, r: number) => sum + r, 0) / comp_rents.length;
    if (avgCompRent === 0) return { rent_premium_pct: 0, comp_position: 50 };
    const premiumPct = ((subject_rent - avgCompRent) / avgCompRent) * 100;
    // Position: what percentile is subject among comps
    const belowCount = comp_rents.filter((r: number) => r < subject_rent).length;
    const compPosition = (belowCount / comp_rents.length) * 100;
    return {
      rent_premium_pct: parseFloat(premiumPct.toFixed(2)),
      comp_position: parseFloat(compPosition.toFixed(2)),
    };
  },
};

const F28_TrafficToLease: FormulaDefinition = {
  id: 'F28',
  name: 'Traffic-to-Lease Prediction',
  modules: ['M07'],
  category: 'Traffic',
  description: 'predicted_leases = β0 + β1(drive_bys) + β2(web_visits) + β3(search_volume)',
  inputKeys: ['daily_drive_bys', 'weekly_web_visits', 'monthly_search_volume'],
  outputKey: 'predicted_weekly_leases',
  unit: 'Leases/week',
  updateTrigger: 'Weekly',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { daily_drive_bys = 0, weekly_web_visits = 0, monthly_search_volume = 0 } = inputs;
    // Default beta coefficients (trainable with user data)
    const beta0 = 0.5;
    const beta1 = 0.002; // drive-bys
    const beta2 = 0.01;  // web visits
    const beta3 = 0.001; // search volume
    const predicted = beta0 + (beta1 * daily_drive_bys * 7) + (beta2 * weekly_web_visits) + (beta3 * monthly_search_volume / 4);
    return {
      predicted_leases: parseFloat(Math.max(0, predicted).toFixed(2)),
      confidence: 0.5, // low confidence with default betas
    };
  },
};

const F29_LeaseVelocityIndex: FormulaDefinition = {
  id: 'F29',
  name: 'Lease Velocity Index',
  modules: ['M07', 'M05'],
  category: 'Traffic',
  description: 'actual_leases_per_month / available_units × 100',
  inputKeys: ['monthly_leases', 'available_units'],
  outputKey: 'lease_velocity',
  unit: '%',
  updateTrigger: 'Monthly',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { monthly_leases = 0, available_units = 1 } = inputs;
    const velocity = (monthly_leases / available_units) * 100;
    let rating: 'slow' | 'normal' | 'hot' = 'normal';
    if (velocity < 5) rating = 'slow';
    else if (velocity > 10) rating = 'hot';
    return {
      lease_velocity_pct: parseFloat(velocity.toFixed(2)),
      velocity_rating: rating,
    };
  },
};

const F30_ScenarioParameterGeneration: FormulaDefinition = {
  id: 'F30',
  name: 'Scenario Parameter Generation',
  modules: ['M10'],
  category: 'Scenario',
  description: 'Generate Bull/Bear/Stress parameters from actual events',
  inputKeys: ['demand_events', 'supply_events', 'scenario_template'],
  outputKey: 'scenario_assumptions',
  unit: 'Assumptions',
  updateTrigger: 'On event change',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const { demand_events = [], supply_events = [] } = inputs;
    const positiveEvents = demand_events.filter((e: any) => e.impact > 0);
    const negativeEvents = demand_events.filter((e: any) => e.impact < 0);
    const supplyPositive = supply_events.filter((e: any) => e.units > 0);

    return {
      bull: {
        demand_multiplier: 1.2,
        include_events: positiveEvents.map((e: any) => e.id),
        rent_growth_adj: 0.02,
        vacancy_adj: -0.02,
      },
      base: {
        demand_multiplier: 1.0,
        include_events: [...positiveEvents, ...negativeEvents].map((e: any) => e.id),
        rent_growth_adj: 0,
        vacancy_adj: 0,
      },
      bear: {
        demand_multiplier: 0.8,
        supply_multiplier: 1.3,
        include_events: [...negativeEvents, ...supplyPositive].map((e: any) => e.id),
        rent_growth_adj: -0.02,
        vacancy_adj: 0.03,
      },
      stress: {
        demand_multiplier: 0.5,
        supply_multiplier: 1.5,
        demand_delay_months: 6,
        rent_growth_adj: -0.05,
        vacancy_adj: 0.08,
      },
    };
  },
};

const F31_ProbabilityWeightedReturn: FormulaDefinition = {
  id: 'F31',
  name: 'Probability-Weighted Return',
  modules: ['M10'],
  category: 'Scenario',
  description: 'Σ(scenario_probability × scenario_irr)',
  inputKeys: ['scenario_irrs', 'scenario_probabilities'],
  outputKey: 'expected_returns',
  unit: '%',
  updateTrigger: 'On scenario change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const {
      scenario_irrs = { bull: 20, base: 12, bear: 5, stress: -3 },
      scenario_probabilities = { bull: 0.20, base: 0.50, bear: 0.25, stress: 0.05 },
    } = inputs;
    let expectedIRR = 0;
    let expectedEM = 0;
    for (const scenario of Object.keys(scenario_irrs)) {
      const prob = scenario_probabilities[scenario] || 0;
      expectedIRR += prob * (scenario_irrs[scenario] || 0);
    }
    return {
      expected_irr: parseFloat(expectedIRR.toFixed(2)),
      expected_equity_multiple: parseFloat(expectedEM.toFixed(2)),
    };
  },
};

const F32_NewsAdjustedRentGrowth: FormulaDefinition = {
  id: 'F32',
  name: 'News-Adjusted Rent Growth',
  modules: ['M09'],
  category: 'Financial',
  description: 'baseline_rent_growth + Σ(event_rent_impact)',
  inputKeys: ['baseline_rent_growth', 'demand_events', 'rent_sensitivity_factor'],
  outputKey: 'adjusted_rent_growth',
  unit: '%',
  updateTrigger: 'On demand event',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const { baseline_rent_growth = 0.03, demand_events = [], rent_sensitivity_factor = 0.001 } = inputs;
    let eventImpact = 0;
    for (const event of demand_events) {
      const demandUnits = event.units_demanded || 0;
      const confidence = event.confidence === 'high' ? 1.0 : event.confidence === 'medium' ? 0.7 : 0.4;
      eventImpact += demandUnits * rent_sensitivity_factor * confidence;
    }
    return parseFloat((baseline_rent_growth + eventImpact).toFixed(4));
  },
};

const F33_NewsAdjustedVacancy: FormulaDefinition = {
  id: 'F33',
  name: 'News-Adjusted Vacancy',
  modules: ['M09'],
  category: 'Financial',
  description: 'baseline_vacancy - (net_demand_units / existing_units × vacancy_sensitivity)',
  inputKeys: ['baseline_vacancy', 'net_demand_units', 'existing_units', 'vacancy_sensitivity'],
  outputKey: 'adjusted_vacancy',
  unit: '%',
  updateTrigger: 'On demand/supply event',
  agentRequired: false,
  status: 'Built',
  calculate: (inputs) => {
    const { baseline_vacancy = 0.05, net_demand_units = 0, existing_units = 1, vacancy_sensitivity = 1.0 } = inputs;
    const adjustment = (net_demand_units / existing_units) * vacancy_sensitivity;
    const adjusted = baseline_vacancy - adjustment;
    // Floor at 2%
    return parseFloat(Math.max(0.02, adjusted).toFixed(4));
  },
};

const F34_OptimalExitYear: FormulaDefinition = {
  id: 'F34',
  name: 'Optimal Exit Year',
  modules: ['M12'],
  category: 'Financial',
  description: 'Find year where exit_value > hold_value first time',
  inputKeys: ['projected_nois', 'projected_exit_caps', 'discount_rate', 'annual_cfs'],
  outputKey: 'exit_analysis',
  unit: 'Year/$',
  updateTrigger: 'On financial change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { projected_nois = [], projected_exit_caps = [], discount_rate = 0.10, annual_cfs = [] } = inputs;
    let optimalYear = projected_nois.length;
    let exitValueAtOptimal = 0;

    for (let y = 0; y < projected_nois.length; y++) {
      const exitCap = projected_exit_caps[y] || 0.06;
      const exitValue = (projected_nois[y + 1] || projected_nois[y]) / exitCap;

      // Calculate remaining hold value
      let holdValue = 0;
      for (let t = y + 1; t < annual_cfs.length; t++) {
        holdValue += (annual_cfs[t] || 0) / Math.pow(1 + discount_rate, t - y);
      }

      if (exitValue > holdValue && y > 0) {
        optimalYear = y + 1;
        exitValueAtOptimal = exitValue;
        break;
      }
    }

    return {
      optimal_exit_year: optimalYear,
      exit_value_at_optimal: parseFloat(exitValueAtOptimal.toFixed(0)),
    };
  },
};

const F35_PortfolioPerformance: FormulaDefinition = {
  id: 'F35',
  name: 'Portfolio Performance',
  modules: ['M22'],
  category: 'Portfolio',
  description: 'Portfolio NOI, actual vs budget variance, portfolio JEDI score',
  inputKeys: ['asset_nois', 'budget_nois', 'asset_values', 'asset_jedi_scores'],
  outputKey: 'portfolio_metrics',
  unit: '$/%/Score',
  updateTrigger: 'On actual data upload',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { asset_nois = [], budget_nois = [], asset_values = [], asset_jedi_scores = [] } = inputs;
    const portfolioNOI = asset_nois.reduce((sum: number, noi: number) => sum + noi, 0);
    const budgetNOI = budget_nois.reduce((sum: number, noi: number) => sum + noi, 0);
    const variancePct = budgetNOI !== 0 ? ((portfolioNOI - budgetNOI) / budgetNOI) * 100 : 0;

    // Value-weighted JEDI score
    const totalValue = asset_values.reduce((sum: number, v: number) => sum + v, 0);
    let portfolioJEDI = 0;
    if (totalValue > 0) {
      for (let i = 0; i < asset_values.length; i++) {
        portfolioJEDI += ((asset_values[i] || 0) / totalValue) * (asset_jedi_scores[i] || 0);
      }
    }

    return {
      portfolio_noi: parseFloat(portfolioNOI.toFixed(0)),
      variance_pct: parseFloat(variancePct.toFixed(2)),
      portfolio_jedi_score: parseFloat(portfolioJEDI.toFixed(2)),
    };
  },
};

// ============================================================================
// Capital Structure Engine Formulas (F40-F66)
// ============================================================================

const F40_SeniorDebtSizing: FormulaDefinition = {
  id: 'F40',
  name: 'Senior Debt Sizing',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'min(max_LTC × cost, DSCR constraint, LTV constraint)',
  inputKeys: ['total_cost', 'max_ltc', 'noi', 'dscr_min', 'property_value', 'max_ltv', 'interest_rate', 'amort_years'],
  outputKey: 'max_senior_debt',
  unit: '$',
  updateTrigger: 'On stack or assumption change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_cost, max_ltc, noi, dscr_min, property_value, max_ltv, interest_rate, amort_years = 30 } = inputs;
    const ltcConstraint = total_cost * max_ltc;
    const ltvConstraint = property_value * max_ltv;
    const monthlyRate = interest_rate / 100 / 12;
    const n = amort_years * 12;
    const maxPayment = noi / 12 / dscr_min;
    const dscrConstraint = amort_years > 0
      ? maxPayment * (Math.pow(1 + monthlyRate, n) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, n))
      : noi / (interest_rate / 100) / dscr_min;
    return parseFloat(Math.min(ltcConstraint, ltvConstraint, dscrConstraint).toFixed(0));
  },
};

const F41_MezzanineSizing: FormulaDefinition = {
  id: 'F41',
  name: 'Mezzanine Sizing',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'total_cost × max_combined_ltc - senior_debt',
  inputKeys: ['total_cost', 'max_combined_ltc', 'senior_debt'],
  outputKey: 'max_mezz',
  unit: '$',
  updateTrigger: 'On stack change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_cost, max_combined_ltc, senior_debt } = inputs;
    return parseFloat(Math.max(0, total_cost * max_combined_ltc - senior_debt).toFixed(0));
  },
};

const F42_TotalEquityRequired: FormulaDefinition = {
  id: 'F42',
  name: 'Total Equity Required',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'total_uses - total_debt',
  inputKeys: ['total_uses', 'senior_debt', 'mezz_debt'],
  outputKey: 'total_equity',
  unit: '$',
  updateTrigger: 'On stack change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_uses, senior_debt = 0, mezz_debt = 0 } = inputs;
    return parseFloat(Math.max(0, total_uses - senior_debt - mezz_debt).toFixed(0));
  },
};

const F43_LTV: FormulaDefinition = {
  id: 'F43',
  name: 'Loan-to-Value (Capital Structure)',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'total_debt / property_value × 100',
  inputKeys: ['total_debt', 'property_value'],
  outputKey: 'ltv',
  unit: '%',
  updateTrigger: 'On debt or value change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_debt, property_value } = inputs;
    if (!property_value || property_value === 0) return 0;
    return parseFloat(((total_debt / property_value) * 100).toFixed(2));
  },
};

const F44_LTC: FormulaDefinition = {
  id: 'F44',
  name: 'Loan-to-Cost',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'total_debt / total_cost × 100',
  inputKeys: ['total_debt', 'total_cost'],
  outputKey: 'ltc',
  unit: '%',
  updateTrigger: 'On debt or cost change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_debt, total_cost } = inputs;
    if (!total_cost || total_cost === 0) return 0;
    return parseFloat(((total_debt / total_cost) * 100).toFixed(2));
  },
};

const F45_WACC: FormulaDefinition = {
  id: 'F45',
  name: 'Weighted Avg Cost of Capital',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'Sum(layer_amount × layer_rate) / total_sources',
  inputKeys: ['layers'],
  outputKey: 'wacc',
  unit: '%',
  updateTrigger: 'On any layer change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { layers = [] } = inputs;
    const totalSources = layers.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
    if (totalSources === 0) return 0;
    const weightedSum = layers.reduce((sum: number, l: any) => sum + (l.amount || 0) * (l.rate || 0), 0);
    return parseFloat((weightedSum / totalSources).toFixed(2));
  },
};

const F46_SourcesEqualsUses: FormulaDefinition = {
  id: 'F46',
  name: 'Sources = Uses Validation',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'total_sources - total_uses (must equal 0)',
  inputKeys: ['total_sources', 'total_uses'],
  outputKey: 'balance_check',
  unit: '$/boolean',
  updateTrigger: 'On any stack change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_sources, total_uses } = inputs;
    const imbalance = total_sources - total_uses;
    return { balanced: Math.abs(imbalance) < 1, imbalance: parseFloat(imbalance.toFixed(0)) };
  },
};

const F47_CyclePhaseClassification: FormulaDefinition = {
  id: 'F47',
  name: 'Rate Cycle Phase',
  modules: ['M11'],
  category: 'Rate Environment',
  description: 'Classify rate cycle from Fed direction, duration, yield curve slope',
  inputKeys: ['fed_direction', 'duration_months', 'yield_curve_slope'],
  outputKey: 'cycle_phase',
  unit: 'Phase label',
  updateTrigger: 'On rate data refresh',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { fed_direction, duration_months, yield_curve_slope } = inputs;
    if (fed_direction === 'hiking') return duration_months > 12 ? 'peak' : 'tightening';
    if (fed_direction === 'cutting') return duration_months > 12 ? 'trough' : 'easing';
    return yield_curve_slope < 0 ? 'peak' : 'trough';
  },
};

const F48_SpreadOverIndex: FormulaDefinition = {
  id: 'F48',
  name: 'All-In Rate from Spread',
  modules: ['M11'],
  category: 'Rate Environment',
  description: 'index_rate + spread_bps / 100',
  inputKeys: ['index_rate', 'spread_bps'],
  outputKey: 'all_in_rate',
  unit: '%',
  updateTrigger: 'On rate or spread change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { index_rate, spread_bps } = inputs;
    return parseFloat((index_rate + spread_bps / 100).toFixed(3));
  },
};

const F49_LockVsFloat: FormulaDefinition = {
  id: 'F49',
  name: 'Lock vs Float NPV',
  modules: ['M11'],
  category: 'Rate Environment',
  description: 'NPV comparison of locking rate now vs floating with expected rate trajectory',
  inputKeys: ['loan_amount', 'lock_rate', 'expected_float_rates', 'term_months', 'discount_rate'],
  outputKey: 'lock_vs_float',
  unit: '$/recommendation',
  updateTrigger: 'On rate forecast change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { loan_amount, lock_rate, expected_float_rates = [], term_months, discount_rate = 0.05 } = inputs;
    const monthlyDiscount = discount_rate / 12;
    let lockNPV = 0;
    let floatNPV = 0;
    for (let m = 0; m < term_months; m++) {
      const df = 1 / Math.pow(1 + monthlyDiscount, m + 1);
      const lockPayment = loan_amount * (lock_rate / 100 / 12);
      const floatRate = expected_float_rates[Math.min(m, expected_float_rates.length - 1)] || lock_rate;
      const floatPayment = loan_amount * (floatRate / 100 / 12);
      lockNPV += lockPayment * df;
      floatNPV += floatPayment * df;
    }
    return {
      lock_npv: parseFloat(lockNPV.toFixed(0)),
      float_npv: parseFloat(floatNPV.toFixed(0)),
      savings: parseFloat((lockNPV - floatNPV).toFixed(0)),
      recommendation: floatNPV < lockNPV ? 'float' : 'lock',
    };
  },
};

const F50_SpreadPercentile: FormulaDefinition = {
  id: 'F50',
  name: 'Spread vs Historical Percentile',
  modules: ['M11'],
  category: 'Rate Environment',
  description: 'Where current spread sits relative to 5-year range',
  inputKeys: ['current_spread', 'five_year_min', 'five_year_max'],
  outputKey: 'spread_percentile',
  unit: '% (0-100)',
  updateTrigger: 'On spread data refresh',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { current_spread, five_year_min, five_year_max } = inputs;
    const range = five_year_max - five_year_min;
    if (range === 0) return 50;
    return parseFloat(Math.max(0, Math.min(100, ((current_spread - five_year_min) / range) * 100)).toFixed(1));
  },
};

const F51_RateSensitivity: FormulaDefinition = {
  id: 'F51',
  name: 'Rate Sensitivity',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'Impact of rate change on annual debt service over hold period',
  inputKeys: ['loan_amount', 'rate_change_bps', 'hold_years'],
  outputKey: 'rate_impact',
  unit: '$',
  updateTrigger: 'On rate or loan change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { loan_amount, rate_change_bps, hold_years } = inputs;
    return parseFloat((loan_amount * (rate_change_bps / 10000) * hold_years).toFixed(0));
  },
};

const F52_LPCapital: FormulaDefinition = {
  id: 'F52',
  name: 'LP Capital Contribution',
  modules: ['M11'],
  category: 'Equity Waterfall',
  description: 'total_equity × lp_percentage',
  inputKeys: ['total_equity', 'lp_pct'],
  outputKey: 'lp_capital',
  unit: '$',
  updateTrigger: 'On equity or split change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_equity, lp_pct } = inputs;
    return parseFloat((total_equity * (lp_pct / 100)).toFixed(0));
  },
};

const F53_GPCapital: FormulaDefinition = {
  id: 'F53',
  name: 'GP Co-Invest',
  modules: ['M11'],
  category: 'Equity Waterfall',
  description: 'total_equity × gp_percentage',
  inputKeys: ['total_equity', 'gp_pct'],
  outputKey: 'gp_capital',
  unit: '$',
  updateTrigger: 'On equity or split change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_equity, gp_pct } = inputs;
    return parseFloat((total_equity * (gp_pct / 100)).toFixed(0));
  },
};

const F54_PreferredReturn: FormulaDefinition = {
  id: 'F54',
  name: 'Preferred Return (Accrued)',
  modules: ['M11'],
  category: 'Equity Waterfall',
  description: 'lp_capital × pref_rate × years',
  inputKeys: ['lp_capital', 'pref_rate', 'years'],
  outputKey: 'pref_return',
  unit: '$',
  updateTrigger: 'On equity or pref change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { lp_capital, pref_rate, years } = inputs;
    return parseFloat((lp_capital * (pref_rate / 100) * years).toFixed(0));
  },
};

const F55_CatchUpDistribution: FormulaDefinition = {
  id: 'F55',
  name: 'GP Catch-Up',
  modules: ['M11'],
  category: 'Equity Waterfall',
  description: 'Catch-up to GP until GP share of cumulative = target split',
  inputKeys: ['pref_distributed_to_lp', 'catch_up_pct', 'gp_target_split'],
  outputKey: 'catch_up_amount',
  unit: '$',
  updateTrigger: 'On waterfall change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { pref_distributed_to_lp, catch_up_pct = 100, gp_target_split = 0.20 } = inputs;
    // GP catch-up: bring GP to target_split of total distributed so far
    const targetGP = pref_distributed_to_lp * gp_target_split / (1 - gp_target_split);
    return parseFloat((targetGP * (catch_up_pct / 100)).toFixed(0));
  },
};

const F56_TierDistribution: FormulaDefinition = {
  id: 'F56',
  name: 'Waterfall Tier Distribution',
  modules: ['M11'],
  category: 'Equity Waterfall',
  description: 'Split remaining proceeds by GP/LP split at each tier',
  inputKeys: ['distributable_amount', 'gp_split', 'lp_split'],
  outputKey: 'tier_distribution',
  unit: '$/split',
  updateTrigger: 'On waterfall change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { distributable_amount, gp_split, lp_split } = inputs;
    return {
      gp_distribution: parseFloat((distributable_amount * gp_split).toFixed(0)),
      lp_distribution: parseFloat((distributable_amount * lp_split).toFixed(0)),
      total: parseFloat(distributable_amount.toFixed(0)),
    };
  },
};

const F57_LPEquityMultiple: FormulaDefinition = {
  id: 'F57',
  name: 'LP Equity Multiple',
  modules: ['M11'],
  category: 'Equity Waterfall',
  description: 'total_lp_distributions / lp_capital',
  inputKeys: ['total_lp_distributions', 'lp_capital'],
  outputKey: 'lp_equity_multiple',
  unit: 'x',
  updateTrigger: 'On distribution change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { total_lp_distributions, lp_capital } = inputs;
    if (!lp_capital || lp_capital === 0) return 0;
    return parseFloat((total_lp_distributions / lp_capital).toFixed(2));
  },
};

const F58_GPEffectiveShare: FormulaDefinition = {
  id: 'F58',
  name: 'GP Effective Percentage',
  modules: ['M11'],
  category: 'Equity Waterfall',
  description: 'gp_total_distributions / total_distributions',
  inputKeys: ['gp_distributions', 'total_distributions'],
  outputKey: 'gp_effective_share',
  unit: '%',
  updateTrigger: 'On distribution change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { gp_distributions, total_distributions } = inputs;
    if (!total_distributions || total_distributions === 0) return 0;
    return parseFloat((gp_distributions / total_distributions).toFixed(4));
  },
};

const F59_WaterfallIRR: FormulaDefinition = {
  id: 'F59',
  name: 'Waterfall IRR (LP/GP)',
  modules: ['M11'],
  category: 'Equity Waterfall',
  description: 'IRR from cash flow series for LP and GP separately',
  inputKeys: ['initial_investment', 'cash_flows', 'terminal_value'],
  outputKey: 'irr',
  unit: '%',
  updateTrigger: 'On distribution change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { initial_investment, cash_flows = [], terminal_value = 0 } = inputs;
    // Newton-Raphson IRR approximation
    const allFlows = [-initial_investment, ...cash_flows.slice(0, -1), (cash_flows[cash_flows.length - 1] || 0) + terminal_value];
    let guess = 0.10;
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0;
      let dnpv = 0;
      for (let t = 0; t < allFlows.length; t++) {
        npv += allFlows[t] / Math.pow(1 + guess, t);
        dnpv -= t * allFlows[t] / Math.pow(1 + guess, t + 1);
      }
      if (Math.abs(npv) < 0.01) break;
      if (dnpv === 0) break;
      guess = guess - npv / dnpv;
    }
    return parseFloat((guess * 100).toFixed(2));
  },
};

const F60_ScenarioReturns: FormulaDefinition = {
  id: 'F60',
  name: 'Scenario Returns Bundle',
  modules: ['M11'],
  category: 'Scenario',
  description: 'Calculate IRR, equity multiple, CoC, DSCR for a given capital scenario',
  inputKeys: ['noi', 'total_equity', 'annual_cash_flow', 'exit_proceeds', 'loan_amount', 'interest_rate', 'amort_years', 'hold_years'],
  outputKey: 'scenario_returns',
  unit: 'Bundle',
  updateTrigger: 'On scenario parameter change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { noi, total_equity, annual_cash_flow, exit_proceeds, loan_amount, interest_rate, amort_years = 30, hold_years = 5 } = inputs;
    // DSCR
    const monthlyRate = interest_rate / 100 / 12;
    const n = amort_years * 12;
    const monthlyPayment = n > 0 ? loan_amount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1) : loan_amount * monthlyRate;
    const annualDS = monthlyPayment * 12;
    const dscr = annualDS > 0 ? parseFloat((noi / annualDS).toFixed(2)) : 0;
    // CoC
    const cocReturn = total_equity > 0 ? parseFloat(((annual_cash_flow / total_equity) * 100).toFixed(2)) : 0;
    // Equity Multiple
    const totalDistributions = annual_cash_flow * hold_years + exit_proceeds;
    const equityMultiple = total_equity > 0 ? parseFloat((totalDistributions / total_equity).toFixed(2)) : 0;
    return { dscr, coc_return: cocReturn, equity_multiple: equityMultiple };
  },
};

const F61_ScenarioDelta: FormulaDefinition = {
  id: 'F61',
  name: 'Scenario Delta',
  modules: ['M11'],
  category: 'Scenario',
  description: 'Difference in IRR/EM/DSCR between two scenarios',
  inputKeys: ['scenario_a_irr', 'scenario_b_irr', 'scenario_a_em', 'scenario_b_em', 'scenario_a_dscr', 'scenario_b_dscr'],
  outputKey: 'scenario_delta',
  unit: 'Spread',
  updateTrigger: 'On scenario change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { scenario_a_irr, scenario_b_irr, scenario_a_em, scenario_b_em, scenario_a_dscr, scenario_b_dscr } = inputs;
    return {
      irr_delta: parseFloat((scenario_a_irr - scenario_b_irr).toFixed(2)),
      em_delta: parseFloat((scenario_a_em - scenario_b_em).toFixed(2)),
      dscr_delta: parseFloat((scenario_a_dscr - scenario_b_dscr).toFixed(2)),
    };
  },
};

const F62_RiskScore: FormulaDefinition = {
  id: 'F62',
  name: 'Capital Structure Risk Score',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'Composite risk from LTV, DSCR, rate type, term match',
  inputKeys: ['ltv', 'dscr', 'rate_type', 'hold_years', 'loan_term_years', 'has_mezz'],
  outputKey: 'capital_risk_score',
  unit: 'Score (0-100)',
  updateTrigger: 'On stack change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { ltv, dscr, rate_type, hold_years, loan_term_years, has_mezz } = inputs;
    let risk = 0;
    // LTV risk (0-30 pts)
    if (ltv > 80) risk += 30;
    else if (ltv > 75) risk += 20;
    else if (ltv > 70) risk += 10;
    // DSCR risk (0-25 pts)
    if (dscr < 1.10) risk += 25;
    else if (dscr < 1.20) risk += 18;
    else if (dscr < 1.25) risk += 10;
    // Rate type risk (0-15 pts)
    if (rate_type === 'floating') risk += 15;
    // Term mismatch risk (0-20 pts)
    if (loan_term_years < hold_years) risk += 20;
    else if (loan_term_years === hold_years) risk += 5;
    // Mezz complexity (0-10 pts)
    if (has_mezz) risk += 10;
    return Math.min(100, risk);
  },
};

const F63_BreakEvenOccupancy: FormulaDefinition = {
  id: 'F63',
  name: 'Break-Even Occupancy',
  modules: ['M11'],
  category: 'Capital Structure',
  description: '(opex + debt_service) / gross_potential_rent',
  inputKeys: ['opex', 'annual_debt_service', 'gross_potential_rent'],
  outputKey: 'breakeven_occupancy',
  unit: '%',
  updateTrigger: 'On financial change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { opex, annual_debt_service, gross_potential_rent } = inputs;
    if (!gross_potential_rent || gross_potential_rent === 0) return 0;
    return parseFloat(((opex + annual_debt_service) / gross_potential_rent * 100).toFixed(1));
  },
};

const F64_DebtServiceCoverage: FormulaDefinition = {
  id: 'F64',
  name: 'Annual Debt Service (All Layers)',
  modules: ['M11'],
  category: 'Capital Structure',
  description: 'Sum of annual payment across all debt layers (senior + mezz)',
  inputKeys: ['debt_layers'],
  outputKey: 'total_annual_debt_service',
  unit: '$/yr',
  updateTrigger: 'On stack change',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { debt_layers = [] } = inputs;
    let totalDS = 0;
    for (const layer of debt_layers) {
      const { amount, rate, amort_years = 0 } = layer;
      if (amort_years > 0) {
        const mr = rate / 100 / 12;
        const n = amort_years * 12;
        totalDS += amount * (mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1) * 12;
      } else {
        // Interest-only
        totalDS += amount * (rate / 100);
      }
    }
    return parseFloat(totalDS.toFixed(0));
  },
};

const F65_RefiProceeds: FormulaDefinition = {
  id: 'F65',
  name: 'Refinance Proceeds',
  modules: ['M11'],
  category: 'Debt Lifecycle',
  description: 'stabilized_value × refi_ltv - existing_debt',
  inputKeys: ['stabilized_value', 'refi_ltv', 'existing_debt'],
  outputKey: 'refi_proceeds',
  unit: '$',
  updateTrigger: 'On refi analysis',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { stabilized_value, refi_ltv, existing_debt } = inputs;
    return parseFloat((stabilized_value * refi_ltv - existing_debt).toFixed(0));
  },
};

const F66_ConstructionDrawSchedule: FormulaDefinition = {
  id: 'F66',
  name: 'Construction Draw Progress',
  modules: ['M11'],
  category: 'Debt Lifecycle',
  description: 'Cumulative draws / total commitment as construction progress %',
  inputKeys: ['draws', 'total_commitment'],
  outputKey: 'draw_progress',
  unit: '%',
  updateTrigger: 'On draw event',
  agentRequired: false,
  status: 'New',
  calculate: (inputs) => {
    const { draws = [], total_commitment } = inputs;
    const totalDrawn = draws.reduce((sum: number, d: number) => sum + d, 0);
    if (!total_commitment || total_commitment === 0) return 0;
    return parseFloat(((totalDrawn / total_commitment) * 100).toFixed(1));
  },
};

// ============================================================================
// Formula Registry
// ============================================================================

export const FORMULA_REGISTRY: Record<FormulaId, FormulaDefinition> = {
  F01: F01_JEDIScoreComposite,
  F02: F02_DemandSubScore,
  F03: F03_SupplySubScore,
  F04: F04_MomentumSubScore,
  F05: F05_PositionSubScore,
  F06: F06_RiskSubScoreComposite,
  F07: F07_SupplyPressureRatio,
  F08: F08_MonthsOfSupply,
  F09: F09_SupplyRiskScore,
  F10: F10_HousingDemandConversion,
  F11: F11_DemandPhasing,
  F12: F12_IncomeTierStratification,
  F13: F13_ZoningUtilization,
  F14: F14_BuildingEnvelope,
  F15: F15_DevelopmentCapacityGap,
  F16: F16_NOI,
  F17: F17_CapRate,
  F18: F18_CashOnCash,
  F19: F19_IRR,
  F20: F20_EquityMultiple,
  F21: F21_DSCR,
  F22: F22_DebtYield,
  F23: F23_StrategyScore,
  F24: F24_ArbitrageFlag,
  F25: F25_StrategyROI,
  F26: F26_SubmarketRank,
  F27: F27_RentCompAnalysis,
  F28: F28_TrafficToLease,
  F29: F29_LeaseVelocityIndex,
  F30: F30_ScenarioParameterGeneration,
  F31: F31_ProbabilityWeightedReturn,
  F32: F32_NewsAdjustedRentGrowth,
  F33: F33_NewsAdjustedVacancy,
  F34: F34_OptimalExitYear,
  F35: F35_PortfolioPerformance,
  // Capital Structure Engine (F40-F66)
  F40: F40_SeniorDebtSizing,
  F41: F41_MezzanineSizing,
  F42: F42_TotalEquityRequired,
  F43: F43_LTV,
  F44: F44_LTC,
  F45: F45_WACC,
  F46: F46_SourcesEqualsUses,
  F47: F47_CyclePhaseClassification,
  F48: F48_SpreadOverIndex,
  F49: F49_LockVsFloat,
  F50: F50_SpreadPercentile,
  F51: F51_RateSensitivity,
  F52: F52_LPCapital,
  F53: F53_GPCapital,
  F54: F54_PreferredReturn,
  F55: F55_CatchUpDistribution,
  F56: F56_TierDistribution,
  F57: F57_LPEquityMultiple,
  F58: F58_GPEffectiveShare,
  F59: F59_WaterfallIRR,
  F60: F60_ScenarioReturns,
  F61: F61_ScenarioDelta,
  F62: F62_RiskScore,
  F63: F63_BreakEvenOccupancy,
  F64: F64_DebtServiceCoverage,
  F65: F65_RefiProceeds,
  F66: F66_ConstructionDrawSchedule,
};

// ============================================================================
// Engine Functions
// ============================================================================

/**
 * Execute a formula by ID with the given inputs.
 */
export function executeFormula(formulaId: FormulaId, inputs: Record<string, any>): any {
  const formula = FORMULA_REGISTRY[formulaId];
  if (!formula) {
    throw new Error(`Unknown formula: ${formulaId}`);
  }
  return formula.calculate(inputs);
}

/**
 * Get all formulas for a given module.
 */
export function getFormulasForModule(moduleId: string): FormulaDefinition[] {
  return Object.values(FORMULA_REGISTRY).filter(f => f.modules.includes(moduleId));
}

/**
 * Get formulas by category.
 */
export function getFormulasByCategory(category: FormulaCategory): FormulaDefinition[] {
  return Object.values(FORMULA_REGISTRY).filter(f => f.category === category);
}

/**
 * Get formulas by status.
 */
export function getFormulasByStatus(status: FormulaStatus): FormulaDefinition[] {
  return Object.values(FORMULA_REGISTRY).filter(f => f.status === status);
}

export const ALL_FORMULA_IDS = Object.keys(FORMULA_REGISTRY) as FormulaId[];
