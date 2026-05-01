/**
 * Sigma Variable Registry
 *
 * Defines the canonical ~55 variables in the M36 Joint Distribution Engine.
 * Each variable has an ID, block assignment, factor loadings, units, and
 * typical range. This is the master list that all Σ estimation, plausibility
 * scoring, and goal-seeking reference.
 *
 * Blocks:
 *   A — Market signals (~35 variables)
 *   B — Underwriting assumptions (~12 variables)
 *   C — Macro factors (~8 variables)
 *
 * Factors (K=6):
 *   F1 — Rate environment (10Y treasury, cap rate spread)
 *   F2 — National employment (unemployment, wage growth)
 *   F3 — Regional migration (net migration, demand metrics)
 *   F4 — Asset-class beta (sector-specific transaction volume)
 *   F5 — Supply pressure (permit velocity, completions)
 *   F6 — Sentiment / liquidity (VIX, transaction volume, DOM)
 *
 * Phase A uses hand-calibrated heuristic values for factor loadings,
 * shown in the `initialFactorLoading` field. These get replaced with
 * data-driven values once Phase C (empirical Σ) completes.
 */

export interface SigmaVariable {
  id: string;
  block: 'A' | 'B' | 'C';
  label: string;
  unit: string;
  description: string;
  /** Factor loading — what this variable correlates with */
  factorLoadings: Record<string, number>; // { F1: 0.71, F2: 0.18, ... }
  /** Typical empirical range [min, max] */
  range: [number, number];
  /** Default value (current market mid-point) */
  default: number;
  /** Annualized standard deviation (hand-calibrated; replaced by data) */
  annualStdDev: number;
  /** Is this macro-anchored? (has CPI/PPI/treasury baseline) */
  macroAnchored: boolean;
  /** For underwriting assumptions: max per-variable move per iteration */
  maxMovePerIteration?: number;
  /** Box constraint for goal-seeking */
  minFeasible?: number;
  maxFeasible?: number;
}

// ─── Block A: Market Signals — Demographics / Demand ────────────────────────

const demandVariables: SigmaVariable[] = [
  {
    id: 'D_SEARCH_MOMENTUM',
    block: 'A',
    label: 'Search Momentum',
    unit: 'z-score',
    description: 'Online search volume for rentals in submarket, z-scored vs national baseline',
    factorLoadings: { F3: 0.65, F6: 0.30 },
    range: [-2, 3],
    default: 0.0,
    annualStdDev: 1.0,
    macroAnchored: false,
  },
  {
    id: 'D_OUT_OF_STATE',
    block: 'A',
    label: 'Out-of-State Inquiries',
    unit: '% of total',
    description: 'Share of rental inquiries originating from out-of-state IP addresses',
    factorLoadings: { F3: 0.80, F2: 0.15 },
    range: [5, 45],
    default: 22,
    annualStdDev: 6,
    macroAnchored: false,
  },
  {
    id: 'D_TRENDS_INDEX',
    block: 'A',
    label: 'Demand Trends Index',
    unit: 'composite 0-100',
    description: 'Composite demand signal from Google Trends, Redfin, ApartmentList',
    factorLoadings: { F3: 0.60, F6: 0.35 },
    range: [20, 80],
    default: 50,
    annualStdDev: 10,
    macroAnchored: false,
  },
  {
    id: 'employment_growth_yoy',
    block: 'A',
    label: 'Employment Growth',
    unit: '% YoY',
    description: 'MSA-level total nonfarm employment growth, year-over-year',
    factorLoadings: { F2: 0.85, F1: -0.10 },
    range: [-5, 8],
    default: 2.1,
    annualStdDev: 2.0,
    macroAnchored: false,
  },
  {
    id: 'wage_growth_yoy',
    block: 'A',
    label: 'Wage Growth',
    unit: '% YoY',
    description: 'MSA-level average wage growth, sourced from BLS CES',
    factorLoadings: { F2: 0.75, F4: 0.15 },
    range: [0, 8],
    default: 3.5,
    annualStdDev: 1.5,
    macroAnchored: true, // ECI anchored
  },
  {
    id: 'migration_net_flow',
    block: 'A',
    label: 'Net Migration Flow',
    unit: '% of population',
    description: 'Annual net domestic migration as share of MSA population',
    factorLoadings: { F3: 0.85, F2: 0.10 },
    range: [-2, 4],
    default: 0.5,
    annualStdDev: 1.2,
    macroAnchored: false,
  },
];

// ─── Block A: Market Signals — Supply ───────────────────────────────────────

const supplyVariables: SigmaVariable[] = [
  {
    id: 'pipeline_units',
    block: 'A',
    label: 'Pipeline Units',
    unit: 'units under construction',
    description: 'Total multifamily units under construction in submarket/MSA',
    factorLoadings: { F5: 0.85, F4: 0.10 },
    range: [0, 5000],
    default: 800,
    annualStdDev: 1200,
    macroAnchored: false,
  },
  {
    id: 'months_to_absorb',
    block: 'A',
    label: 'Months to Absorb',
    unit: 'months',
    description: 'Number of months needed to absorb pipeline at current absorption rate',
    factorLoadings: { F5: 0.70, F6: 0.20 },
    range: [3, 36],
    default: 12,
    annualStdDev: 6,
    macroAnchored: false,
  },
  {
    id: 'permit_velocity_yoy',
    block: 'A',
    label: 'Permit Velocity',
    unit: '% YoY',
    description: 'Multifamily building permit growth, year-over-year',
    factorLoadings: { F5: 0.80, F1: 0.20 },
    range: [-40, 60],
    default: 5,
    annualStdDev: 20,
    macroAnchored: false,
  },
  {
    id: 'completions_yoy',
    block: 'A',
    label: 'Completions YoY',
    unit: '% YoY',
    description: 'Multifamily unit completions growth, year-over-year',
    factorLoadings: { F5: 0.75, F4: 0.15 },
    range: [-30, 50],
    default: 3,
    annualStdDev: 15,
    macroAnchored: false,
  },
  {
    id: 'supply_pressure_ratio',
    block: 'A',
    label: 'Supply Pressure Ratio',
    unit: 'ratio',
    description: 'Pipeline units / annual absorption. >1.5 = oversupplied',
    factorLoadings: { F5: 0.80, F6: -0.15 },
    range: [0.2, 4.0],
    default: 1.2,
    annualStdDev: 0.8,
    macroAnchored: false,
  },
];

// ─── Block A: Market Signals — Traffic / Momentum ───────────────────────────

const trafficVariables: SigmaVariable[] = [
  {
    id: 'T_AADT_YOY',
    block: 'A',
    label: 'Traffic AADT YoY',
    unit: '% YoY',
    description: 'Annual average daily traffic growth in submarket (proximity-weighted)',
    factorLoadings: { F3: 0.50, F6: 0.30 },
    range: [-10, 20],
    default: 3,
    annualStdDev: 5,
    macroAnchored: false,
  },
  {
    id: 'C_SURGE_INDEX',
    block: 'A',
    label: 'Surge Index',
    unit: 'z-score',
    description: 'Short-term surge in property searches, z-scored vs 4-week moving avg',
    factorLoadings: { F6: 0.55, F3: 0.35 },
    range: [-2, 4],
    default: 0.0,
    annualStdDev: 1.0,
    macroAnchored: false,
  },
  {
    id: 'C_DIGITAL_PHYSICAL_GAP',
    block: 'A',
    label: 'Digital-Physical Gap',
    unit: 'z-score',
    description: 'Gap between online search intensity and actual tour/app volume',
    factorLoadings: { F6: 0.50, F3: 0.25 },
    range: [-2, 3],
    default: 0.0,
    annualStdDev: 1.0,
    macroAnchored: false,
  },
  {
    id: 'C_TPI',
    block: 'A',
    label: 'Tour-to-Property Index (TPI)',
    unit: 'index 0-100',
    description: 'Normalized tour request volume per 1,000 property views',
    factorLoadings: { F6: 0.60, F3: 0.30 },
    range: [20, 80],
    default: 50,
    annualStdDev: 10,
    macroAnchored: false,
  },
  {
    id: 'C_TVS',
    block: 'A',
    label: 'Tour Velocity Score (TVS)',
    unit: 'z-score',
    description: 'Speed of tour conversion (views to tours), z-scored vs market average',
    factorLoadings: { F6: 0.55, F3: 0.30 },
    range: [-2, 3],
    default: 0.0,
    annualStdDev: 1.0,
    macroAnchored: false,
  },
  {
    id: 'cap_rate_yoy',
    block: 'A',
    label: 'Cap Rate YoY Change',
    unit: 'bps',
    description: 'Year-over-year change in submarket cap rate (negative = compression)',
    factorLoadings: { F1: 0.60, F4: 0.30, F6: 0.10 },
    range: [-150, 150],
    default: -10,
    annualStdDev: 50,
    macroAnchored: false,
  },
  {
    id: 'rent_growth_yoy',
    block: 'A',
    label: 'Rent Growth YoY',
    unit: '% YoY',
    description: 'Effective rent growth in submarket, year-over-year',
    factorLoadings: { F3: 0.50, F2: 0.30, F5: -0.15 },
    range: [-5, 15],
    default: 3.2,
    annualStdDev: 3.0,
    macroAnchored: true, // CPI-OER anchored
  },
  {
    id: 'transaction_velocity_yoy',
    block: 'A',
    label: 'Transaction Velocity',
    unit: '% YoY',
    description: 'Year-over-year change in number of multifamily transactions',
    factorLoadings: { F4: 0.60, F1: 0.25, F6: 0.15 },
    range: [-40, 60],
    default: 5,
    annualStdDev: 20,
    macroAnchored: false,
  },
  {
    id: 'days_on_market',
    block: 'A',
    label: 'Days on Market',
    unit: 'days',
    description: 'Median days on market for multifamily listings in submarket',
    factorLoadings: { F6: 0.50, F5: 0.30 },
    range: [30, 180],
    default: 75,
    annualStdDev: 25,
    macroAnchored: false,
  },
  {
    id: 'sentiment_score',
    block: 'A',
    label: 'Sentiment Score',
    unit: 'composite 0-100',
    description: 'Composite sentiment from investor surveys, social media, news tone',
    factorLoadings: { F6: 0.70, F4: 0.20 },
    range: [20, 80],
    default: 50,
    annualStdDev: 10,
    macroAnchored: false,
  },
];

// ─── Block A: Market Signals — Position / Quality ───────────────────────────

const positionVariables: SigmaVariable[] = [
  {
    id: 'submarket_rank',
    block: 'A',
    label: 'Submarket Rank',
    unit: 'decile 1-10',
    description: 'Rank of submarket vs MSA peers on rent growth, occupancy, desirability',
    factorLoadings: { F3: 0.40, F2: 0.30, F4: 0.20 },
    range: [1, 10],
    default: 5,
    annualStdDev: 2,
    macroAnchored: false,
  },
  {
    id: 'amenity_score',
    block: 'A',
    label: 'Submarket Amenity Score',
    unit: 'z-score',
    description: 'Walkability, transit access, school quality, retail density (indexed)',
    factorLoadings: { F3: 0.45, F2: 0.25 },
    range: [-2, 3],
    default: 0.0,
    annualStdDev: 1.0,
    macroAnchored: false,
  },
  {
    id: 'comp_set_position',
    block: 'A',
    label: 'Comp Set Position',
    unit: 'percentile 0-100',
    description: 'Subject property percentile vs comp set on rent/amenities/age',
    factorLoadings: { F4: 0.40, F3: 0.20 },
    range: [10, 90],
    default: 50,
    annualStdDev: 15,
    macroAnchored: false,
  },
  {
    id: 'regulatory_risk',
    block: 'A',
    label: 'Regulatory Risk Score',
    unit: '1-10 (higher = riskier)',
    description: 'Rent control risk, eviction moratoria, zoning restrictions',
    factorLoadings: { F1: 0.20, F4: 0.30 },
    range: [1, 10],
    default: 3,
    annualStdDev: 2,
    macroAnchored: false,
  },
  {
    id: 'climate_risk',
    block: 'A',
    label: 'Climate Risk Score',
    unit: '1-10 (higher = riskier)',
    description: 'Flood, hurricane, wildfire risk for the submarket',
    factorLoadings: { F4: 0.20, F1: 0.10 },
    range: [1, 10],
    default: 3,
    annualStdDev: 2,
    macroAnchored: false,
  },
  {
    id: 'insurance_cost_yoy',
    block: 'A',
    label: 'Insurance Cost Growth',
    unit: '% YoY',
    description: 'Property insurance premium growth in the submarket',
    factorLoadings: { F1: 0.25, F4: 0.25 },
    range: [-5, 30],
    default: 8,
    annualStdDev: 8,
    macroAnchored: false,
  },
  {
    id: 'occupancy_rate',
    block: 'A',
    label: 'Occupancy Rate',
    unit: '%',
    description: 'Submarket average stabilized occupancy',
    factorLoadings: { F5: -0.40, F3: 0.35, F2: 0.15 },
    range: [85, 98],
    default: 93.5,
    annualStdDev: 2.5,
    macroAnchored: false,
  },
];

// ─── Block B: Underwriting Assumptions (~12) ────────────────────────────────

const underwritingVariables: SigmaVariable[] = [
  {
    id: 'rent_growth',
    block: 'B',
    label: 'Projected Rent Growth',
    unit: '% YoY',
    description: 'User or agent-selected rent growth assumption for the hold period',
    factorLoadings: { F3: 0.50, F2: 0.30, F5: -0.15 },
    range: [-2, 8],
    default: 3.0,
    annualStdDev: 2.0,
    macroAnchored: true,
    maxMovePerIteration: 0.01,
    minFeasible: -0.02,
    maxFeasible: 0.08,
  },
  {
    id: 'vacancy_rate',
    block: 'B',
    label: 'Projected Vacancy',
    unit: '%',
    description: 'Projected stabilized vacancy rate for the hold period',
    factorLoadings: { F5: 0.40, F3: -0.30, F2: -0.15 },
    range: [2, 15],
    default: 5,
    annualStdDev: 2.5,
    macroAnchored: false,
    maxMovePerIteration: 0.005,
    minFeasible: 0.02,
    maxFeasible: 0.15,
  },
  {
    id: 'expense_growth',
    block: 'B',
    label: 'Projected Expense Growth',
    unit: '% YoY',
    description: 'Projected annual expense growth rate',
    factorLoadings: { F1: 0.20, F4: 0.15 },
    range: [1, 8],
    default: 3.0,
    annualStdDev: 1.5,
    macroAnchored: true,
    maxMovePerIteration: 0.005,
    minFeasible: 0.01,
    maxFeasible: 0.08,
  },
  {
    id: 'exit_cap_rate',
    block: 'B',
    label: 'Exit Cap Rate',
    unit: '%',
    description: 'Cap rate at disposition, expressed as decimal (0.055 = 5.5%)',
    factorLoadings: { F1: 0.65, F4: 0.25, F5: 0.10 },
    range: [0.04, 0.09],
    default: 0.055,
    annualStdDev: 0.008,
    macroAnchored: true,
    maxMovePerIteration: 0.0025,
    minFeasible: 0.04,
    maxFeasible: 0.09,
  },
  {
    id: 'entry_cap_rate',
    block: 'B',
    label: 'Entry Cap Rate',
    unit: '%',
    description: 'Cap rate at acquisition',
    factorLoadings: { F1: 0.70, F4: 0.20 },
    range: [0.04, 0.09],
    default: 0.0575,
    annualStdDev: 0.008,
    macroAnchored: true,
    maxMovePerIteration: 0.0025,
    minFeasible: 0.04,
    maxFeasible: 0.09,
  },
  {
    id: 'debt_rate',
    block: 'B',
    label: 'Debt Rate',
    unit: '%',
    description: 'Interest rate on acquisition debt',
    factorLoadings: { F1: 0.90, F4: 0.05 },
    range: [0.04, 0.10],
    default: 0.065,
    annualStdDev: 0.012,
    macroAnchored: false,
    maxMovePerIteration: 0.005,
    minFeasible: 0.04,
    maxFeasible: 0.10,
  },
  {
    id: 'ltv',
    block: 'B',
    label: 'Loan-to-Value',
    unit: '%',
    description: 'Loan-to-value ratio at acquisition',
    factorLoadings: { F1: 0.25, F4: 0.20 },
    range: [0.50, 0.85],
    default: 0.70,
    annualStdDev: 0.08,
    macroAnchored: false,
    maxMovePerIteration: 0.02,
    minFeasible: 0.50,
    maxFeasible: 0.85,
  },
  {
    id: 'dscr',
    block: 'B',
    label: 'Debt Service Coverage Ratio',
    unit: 'ratio',
    description: 'Year-1 DSCR',
    factorLoadings: { F1: -0.30, F3: 0.20 },
    range: [1.0, 2.0],
    default: 1.35,
    annualStdDev: 0.20,
    macroAnchored: false,
    maxMovePerIteration: 0.10,
    minFeasible: 1.0,
    maxFeasible: 2.0,
  },
  {
    id: 'loss_to_lease',
    block: 'B',
    label: 'Loss-to-Lease',
    unit: '%',
    description: 'Gap between market rent and in-place rent at rollover',
    factorLoadings: { F3: 0.30, F2: 0.20 },
    range: [0.01, 0.10],
    default: 0.03,
    annualStdDev: 0.015,
    macroAnchored: false,
    maxMovePerIteration: 0.005,
    minFeasible: 0.01,
    maxFeasible: 0.10,
  },
  {
    id: 'collection_loss',
    block: 'B',
    label: 'Collection Loss',
    unit: '%',
    description: 'Bad debt / uncollectible rent as fraction of gross rent',
    factorLoadings: { F2: 0.20, F4: -0.10 },
    range: [0.005, 0.05],
    default: 0.015,
    annualStdDev: 0.01,
    macroAnchored: false,
    maxMovePerIteration: 0.0025,
    minFeasible: 0.005,
    maxFeasible: 0.05,
  },
  {
    id: 'refinance_spread',
    block: 'B',
    label: 'Refinance Spread',
    unit: 'bps',
    description: 'Spread over benchmark when refinancing at exit / maturity',
    factorLoadings: { F1: 0.40, F4: 0.20 },
    range: [100, 400],
    default: 200,
    annualStdDev: 60,
    macroAnchored: false,
    maxMovePerIteration: 25,
    minFeasible: 100,
    maxFeasible: 400,
  },
  {
    id: 'construction_cost_yoy',
    block: 'B',
    label: 'Construction Cost Growth',
    unit: '% YoY',
    description: 'Annual growth in hard construction costs for development deals',
    factorLoadings: { F1: 0.25, F5: 0.15 },
    range: [1, 10],
    default: 4.0,
    annualStdDev: 2.0,
    macroAnchored: true, // PPI anchored
    maxMovePerIteration: 0.01,
    minFeasible: 0.01,
    maxFeasible: 0.10,
  },
  {
    id: 'lease_up_period_months',
    block: 'B',
    label: 'Lease-Up Period',
    unit: 'months',
    description: 'Expected months to reach stabilized occupancy for new construction',
    factorLoadings: { F5: 0.30, F3: -0.25 },
    range: [6, 36],
    default: 18,
    annualStdDev: 6,
    macroAnchored: false,
    minFeasible: 6,
    maxFeasible: 36,
  },
  {
    id: 'capex_per_unit',
    block: 'B',
    label: 'CapEx per Unit',
    unit: '$/unit',
    description: 'Annual capital expenditure per unit',
    factorLoadings: { F4: 0.15 },
    range: [250, 1500],
    default: 500,
    annualStdDev: 250,
    macroAnchored: false,
    minFeasible: 250,
    maxFeasible: 1500,
  },
];

// ─── Block C: Macro Factors (~8) ────────────────────────────────────────────

const macroVariables: SigmaVariable[] = [
  {
    id: 'X10Y_treasury',
    block: 'C',
    label: '10-Year Treasury Yield',
    unit: '%',
    description: 'US Treasury 10-year nominal yield',
    factorLoadings: { F1: 1.0 },
    range: [1.5, 5.5],
    default: 4.2,
    annualStdDev: 1.0,
    macroAnchored: false,
  },
  {
    id: 'sofr_rate',
    block: 'C',
    label: 'SOFR',
    unit: '%',
    description: 'Secured Overnight Financing Rate (short-term benchmark)',
    factorLoadings: { F1: 0.95 },
    range: [1.0, 6.0],
    default: 4.5,
    annualStdDev: 1.5,
    macroAnchored: false,
  },
  {
    id: 'cap_rate_spread',
    block: 'C',
    label: 'Cap Rate Spread over 10Y',
    unit: 'bps',
    description: 'Cap rate minus 10-year treasury (risk premium for RE vs risk-free)',
    factorLoadings: { F1: -0.50, F4: 0.40 },
    range: [100, 500],
    default: 275,
    annualStdDev: 80,
    macroAnchored: false,
  },
  {
    id: 'unemployment_rate',
    block: 'C',
    label: 'Unemployment Rate',
    unit: '%',
    description: 'National unemployment rate',
    factorLoadings: { F2: -0.85, F1: 0.15 },
    range: [3, 10],
    default: 4.0,
    annualStdDev: 1.5,
    macroAnchored: false,
  },
  {
    id: 'gdp_growth_yoy',
    block: 'C',
    label: 'GDP Growth',
    unit: '% YoY',
    description: 'US real GDP growth, year-over-year',
    factorLoadings: { F2: 0.60, F6: 0.25 },
    range: [-4, 8],
    default: 2.5,
    annualStdDev: 2.0,
    macroAnchored: false,
  },
  {
    id: 'inflation_yoy',
    block: 'C',
    label: 'CPI Inflation',
    unit: '% YoY',
    description: 'Headline CPI inflation, year-over-year',
    factorLoadings: { F1: 0.60, F2: 0.30 },
    range: [1, 9],
    default: 3.0,
    annualStdDev: 2.0,
    macroAnchored: false,
  },
  {
    id: 'vix',
    block: 'C',
    label: 'VIX',
    unit: 'index',
    description: 'CBOE Volatility Index',
    factorLoadings: { F6: 0.80, F1: 0.20 },
    range: [10, 40],
    default: 16,
    annualStdDev: 8,
    macroAnchored: false,
  },
  {
    id: 'transaction_volume_index',
    block: 'C',
    label: 'Transaction Volume Index',
    unit: 'index normalized to 100',
    description: 'National multifamily transaction volume, normalized to Jan 2020 = 100',
    factorLoadings: { F4: 0.70, F1: 0.20, F6: 0.10 },
    range: [40, 160],
    default: 95,
    annualStdDev: 25,
    macroAnchored: false,
  },
];

// ─── Full Variable Registry ─────────────────────────────────────────────────

export const SIGMA_VARIABLES: Record<string, SigmaVariable> = {};

function register(vars: SigmaVariable[]): void {
  for (const v of vars) {
    if (SIGMA_VARIABLES[v.id]) {
      throw new Error(`Duplicate variable ID: ${v.id}`);
    }
    SIGMA_VARIABLES[v.id] = v;
  }
}

register(demandVariables);
register(supplyVariables);
register(trafficVariables);
register(positionVariables);
register(underwritingVariables);
register(macroVariables);

export const VARIABLE_COUNT = Object.keys(SIGMA_VARIABLES).length;

export function getVariablesByBlock(block: 'A' | 'B' | 'C'): SigmaVariable[] {
  return Object.values(SIGMA_VARIABLES).filter(v => v.block === block);
}

export function getVariablesByMacroAnchor(): SigmaVariable[] {
  return Object.values(SIGMA_VARIABLES).filter(v => v.macroAnchored);
}

// ─── Factor Definitions ─────────────────────────────────────────────────────

export interface FactorDef {
  id: string;
  label: string;
  description: string;
  primaryIndicator: string;
}

export const FACTORS: FactorDef[] = [
  { id: 'F1', label: 'Rate Environment', description: '10Y treasury, cap rate spreads, debt pricing', primaryIndicator: 'X10Y_treasury' },
  { id: 'F2', label: 'National Employment', description: 'Unemployment, wage growth, GDP', primaryIndicator: 'unemployment_rate' },
  { id: 'F3', label: 'Regional Migration', description: 'Net migration, demand inflow, search activity', primaryIndicator: 'migration_net_flow' },
  { id: 'F4', label: 'Asset-Class Beta', description: 'Transaction volume, capital flows, sector-specific demand', primaryIndicator: 'transaction_volume_index' },
  { id: 'F5', label: 'Supply Pressure', description: 'Permit velocity, completions, pipeline absorption', primaryIndicator: 'supply_pressure_ratio' },
  { id: 'F6', label: 'Sentiment / Liquidity', description: 'VIX, search surge, days on market, transaction velocity', primaryIndicator: 'vix' },
];

export function getFactorIds(): string[] {
  return FACTORS.map(f => f.id);
}
