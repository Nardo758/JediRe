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
  | 'F31' | 'F32' | 'F33' | 'F34' | 'F35';

export type FormulaCategory =
  | 'Scoring' | 'Supply' | 'Demand' | 'Zoning' | 'Development'
  | 'Financial' | 'Strategy' | 'Market' | 'Traffic' | 'Scenario' | 'Portfolio';

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
