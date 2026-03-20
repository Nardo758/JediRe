/**
 * Enhanced Pro Forma Mock Data (M09)
 *
 * Three-layer assumption model: Baseline → Platform-Adjusted → User Override.
 * 10-year income statement, and returns summary with probability weighting.
 */

// ============================================================================
// 3-Layer Assumptions
// ============================================================================

export interface ProFormaAssumption {
  id: string;
  label: string;
  baseline: number;
  baselineSource: string;
  platformAdjusted: number;
  platformDelta: number;
  platformReason: string;
  userOverride: number | null;
  overrideReason: string | null;
  effective: number;
  format: 'percentage' | 'currency' | 'number';
  unit: string;
  deviationWarning: boolean;
}

export const proFormaAssumptions: ProFormaAssumption[] = [
  {
    id: 'rent-growth',
    label: 'Rent Growth',
    baseline: 3.2,
    baselineSource: '3-yr historical avg (apartments.com)',
    platformAdjusted: 4.1,
    platformDelta: 0.9,
    platformReason: '+0.9% from Amazon HQ demand event (M06)',
    userOverride: 3.5,
    overrideReason: 'Conservative — want margin of safety',
    effective: 3.5,
    format: 'percentage',
    unit: '%',
    deviationWarning: true,
  },
  {
    id: 'vacancy',
    label: 'Vacancy Rate',
    baseline: 5.8,
    baselineSource: 'Current submarket vacancy (M05)',
    platformAdjusted: 4.9,
    platformDelta: -0.9,
    platformReason: '-0.9% from net demand absorbing supply (M06+M04)',
    userOverride: null,
    overrideReason: null,
    effective: 4.9,
    format: 'percentage',
    unit: '%',
    deviationWarning: false,
  },
  {
    id: 'exit-cap',
    label: 'Exit Cap Rate',
    baseline: 5.5,
    baselineSource: 'Trailing 12mo avg transaction cap (M05+M15)',
    platformAdjusted: 5.3,
    platformDelta: -0.2,
    platformReason: '-20bps: momentum score indicates cap compression trend',
    userOverride: null,
    overrideReason: null,
    effective: 5.3,
    format: 'percentage',
    unit: '%',
    deviationWarning: false,
  },
  {
    id: 'opex-growth',
    label: 'OpEx Growth',
    baseline: 2.5,
    baselineSource: 'CPI-linked historical (BLS data)',
    platformAdjusted: 2.8,
    platformDelta: 0.3,
    platformReason: '+0.3% from insurance cost trend in SE region',
    userOverride: null,
    overrideReason: null,
    effective: 2.8,
    format: 'percentage',
    unit: '%',
    deviationWarning: false,
  },
  {
    id: 'acquisition-price',
    label: 'Acquisition Price',
    baseline: 45000000,
    baselineSource: 'Asking price',
    platformAdjusted: 45000000,
    platformDelta: 0,
    platformReason: 'No adjustment — in line with comps',
    userOverride: 43500000,
    overrideReason: 'Targeting 3.3% below ask per comp analysis',
    effective: 43500000,
    format: 'currency',
    unit: '$',
    deviationWarning: false,
  },
];

// ============================================================================
// 10-Year Income Statement
// ============================================================================

export interface YearProjection {
  year: number;
  grossRent: number;
  vacancy: number;
  effectiveGrossIncome: number;
  opex: number;
  noi: number;
  debtService: number;
  cashFlowAfterDebt: number;
  cumulativeReturn: number;
}

export const incomeProjections: YearProjection[] = [
  { year: 1, grossRent: 5475000, vacancy: 268275, effectiveGrossIncome: 5206725, opex: 2076000, noi: 3130725, debtService: 2019600, cashFlowAfterDebt: 1111125, cumulativeReturn: 1111125 },
  { year: 2, grossRent: 5666625, vacancy: 277655, effectiveGrossIncome: 5388970, opex: 2134128, noi: 3254842, debtService: 2019600, cashFlowAfterDebt: 1235242, cumulativeReturn: 2346367 },
  { year: 3, grossRent: 5864957, vacancy: 287383, effectiveGrossIncome: 5577574, opex: 2193884, noi: 3383690, debtService: 2019600, cashFlowAfterDebt: 1364090, cumulativeReturn: 3710457 },
  { year: 4, grossRent: 6070230, vacancy: 297441, effectiveGrossIncome: 5772789, opex: 2255303, noi: 3517486, debtService: 2019600, cashFlowAfterDebt: 1497886, cumulativeReturn: 5208343 },
  { year: 5, grossRent: 6282688, vacancy: 307852, effectiveGrossIncome: 5974836, opex: 2318452, noi: 3656384, debtService: 2019600, cashFlowAfterDebt: 1636784, cumulativeReturn: 6845127 },
  { year: 6, grossRent: 6502582, vacancy: 318627, effectiveGrossIncome: 6183955, opex: 2383357, noi: 3800598, debtService: 2019600, cashFlowAfterDebt: 1780998, cumulativeReturn: 8626125 },
  { year: 7, grossRent: 6730172, vacancy: 329778, effectiveGrossIncome: 6400394, opex: 2450013, noi: 3950381, debtService: 2019600, cashFlowAfterDebt: 1930781, cumulativeReturn: 10556906 },
  { year: 8, grossRent: 6965728, vacancy: 341321, effectiveGrossIncome: 6624407, opex: 2518513, noi: 4105894, debtService: 2019600, cashFlowAfterDebt: 2086294, cumulativeReturn: 12643200 },
  { year: 9, grossRent: 7209528, vacancy: 353267, effectiveGrossIncome: 6856261, opex: 2589032, noi: 4267229, debtService: 2019600, cashFlowAfterDebt: 2247629, cumulativeReturn: 14890829 },
  { year: 10, grossRent: 7461862, vacancy: 365631, effectiveGrossIncome: 7096231, opex: 2661545, noi: 4434686, debtService: 2019600, cashFlowAfterDebt: 2415086, cumulativeReturn: 17305915 },
];

// ============================================================================
// Returns Summary
// ============================================================================

export interface ReturnsSummary {
  irr: number;
  equityMultiple: number;
  cashOnCash_y1: number;
  dscrMin: number;
  dscrMinYear: number;
  probWeightedIRR: number;
  riskPremium: number;
  hurdleRate: number;
  meetsHurdle: boolean;
}

export const returnsSummary: ReturnsSummary = {
  irr: 16.8,
  equityMultiple: 2.1,
  cashOnCash_y1: 8.5,
  dscrMin: 1.32,
  dscrMinYear: 1,
  probWeightedIRR: 14.2,
  riskPremium: 2.6,
  hurdleRate: 12.0,
  meetsHurdle: true,
};
