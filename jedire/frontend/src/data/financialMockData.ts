/**
 * Mock Financial Data for Dual-Mode Financial Section
 * Provides realistic data for both acquisition and performance modes
 */

export interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
  format?: 'currency' | 'percentage' | 'text' | 'number';
  subtext?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

export interface IncomeStatementLine {
  label: string;
  value: number;
  category: 'revenue' | 'expense' | 'noi' | 'subtotal';
  indent?: number;
}

export interface ProjectionData {
  year: number;
  noi: number;
  cashFlow: number;
  equityValue: number;
  occupancy: number;
}

export interface SensitivityScenario {
  label: string;
  rentChange: number; // percentage
  vacancyChange: number; // percentage
  capRateChange: number; // basis points
  irrImpact: number; // percentage
  noiImpact: number; // dollar amount
}

export interface WaterfallTier {
  name: string;
  threshold: number;
  split: string;
  distribution: number;
}

export interface VarianceItem {
  category: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionFinancialStats: QuickStat[] = [
  {
    label: 'Pro Forma NOI',
    value: 3400000,
    icon: '💰',
    format: 'currency',
    subtext: 'Year 1',
    trend: { direction: 'up', value: '+4.2%' }
  },
  {
    label: 'Projected IRR',
    value: 18.5,
    icon: '📈',
    format: 'percentage',
    subtext: '10-year hold',
    trend: { direction: 'up', value: '+2.3%' }
  },
  {
    label: 'Cash-on-Cash',
    value: 8.2,
    icon: '💵',
    format: 'percentage',
    subtext: 'Year 1'
  },
  {
    label: 'Entry Cap Rate',
    value: 6.2,
    icon: '📊',
    format: 'percentage',
    subtext: 'Market: 6.5%'
  },
  {
    label: 'Equity Multiple',
    value: 2.4,
    icon: '🎯',
    format: 'number',
    subtext: '10-year',
    trend: { direction: 'up', value: '+0.3x' }
  }
];

export const acquisitionProForma: IncomeStatementLine[] = [
  // Revenue
  { label: 'Gross Potential Rent', value: 5500000, category: 'revenue' },
  { label: 'Other Income', value: 280000, category: 'revenue', indent: 1 },
  { label: 'Less: Vacancy Loss', value: -385000, category: 'revenue', indent: 1 },
  { label: 'Effective Gross Income', value: 5395000, category: 'subtotal' },
  
  // Operating Expenses
  { label: 'Property Management', value: 270000, category: 'expense' },
  { label: 'Repairs & Maintenance', value: 320000, category: 'expense' },
  { label: 'Utilities', value: 185000, category: 'expense' },
  { label: 'Insurance', value: 95000, category: 'expense' },
  { label: 'Property Taxes', value: 625000, category: 'expense' },
  { label: 'Marketing & Leasing', value: 75000, category: 'expense' },
  { label: 'Administrative', value: 125000, category: 'expense' },
  { label: 'Total Operating Expenses', value: 1695000, category: 'subtotal' },
  
  // NOI
  { label: 'Net Operating Income', value: 3700000, category: 'noi' }
];

export const acquisitionReturnMetrics = {
  purchasePrice: 45000000,
  downPayment: 13500000,
  loanAmount: 31500000,
  interestRate: 4.5,
  loanTerm: 30,
  yearOneNOI: 3400000,
  yearOneCashFlow: 1230000,
  cashOnCash: 9.1,
  entryCapRate: 7.6,
  exitCapRate: 6.8,
  irr: 18.5,
  equityMultiple: 2.4,
  averageAnnualReturn: 12.3
};

export const acquisitionProjections: ProjectionData[] = [
  { year: 1, noi: 3400000, cashFlow: 1230000, equityValue: 13500000, occupancy: 93 },
  { year: 2, noi: 3536000, cashFlow: 1298000, equityValue: 15200000, occupancy: 94 },
  { year: 3, noi: 3677440, cashFlow: 1368000, equityValue: 17100000, occupancy: 95 },
  { year: 4, noi: 3825538, cashFlow: 1441000, equityValue: 19200000, occupancy: 95 },
  { year: 5, noi: 3980760, cashFlow: 1518000, equityValue: 21500000, occupancy: 96 },
  { year: 6, noi: 4143191, cashFlow: 1599000, equityValue: 24000000, occupancy: 96 },
  { year: 7, noi: 4313319, cashFlow: 1684000, equityValue: 26800000, occupancy: 97 },
  { year: 8, noi: 4491652, cashFlow: 1773000, equityValue: 29900000, occupancy: 97 },
  { year: 9, noi: 4678719, cashFlow: 1867000, equityValue: 33200000, occupancy: 97 },
  { year: 10, noi: 4875068, cashFlow: 1966000, equityValue: 36800000, occupancy: 98 }
];

export const sensitivityAnalysis: SensitivityScenario[] = [
  { 
    label: 'Base Case', 
    rentChange: 0, 
    vacancyChange: 0, 
    capRateChange: 0, 
    irrImpact: 18.5,
    noiImpact: 3400000
  },
  { 
    label: 'Bull Case: +5% Rent Growth', 
    rentChange: 5, 
    vacancyChange: 0, 
    capRateChange: -25, 
    irrImpact: 22.3,
    noiImpact: 3570000
  },
  { 
    label: 'Bear Case: +3% Vacancy', 
    rentChange: 0, 
    vacancyChange: 3, 
    capRateChange: 50, 
    irrImpact: 14.1,
    noiImpact: 3235000
  },
  { 
    label: 'High Growth: +3% Rent, -1% Vacancy', 
    rentChange: 3, 
    vacancyChange: -1, 
    capRateChange: -15, 
    irrImpact: 20.8,
    noiImpact: 3502000
  },
  { 
    label: 'Stress Case: -2% Rent, +5% Vacancy', 
    rentChange: -2, 
    vacancyChange: 5, 
    capRateChange: 75, 
    irrImpact: 10.2,
    noiImpact: 3060000
  }
];

export const waterfallDistribution: WaterfallTier[] = [
  {
    name: 'Preferred Return (8%)',
    threshold: 8,
    split: '100% LP',
    distribution: 1080000
  },
  {
    name: 'Return of Capital',
    threshold: 0,
    split: '100% LP',
    distribution: 13500000
  },
  {
    name: 'Catch-Up (to 80/20)',
    threshold: 0,
    split: '100% GP',
    distribution: 3645000
  },
  {
    name: 'Remaining Splits',
    threshold: 0,
    split: '80% LP / 20% GP',
    distribution: 18075000
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceFinancialStats: QuickStat[] = [
  {
    label: 'Current NOI',
    value: 3200000,
    icon: '💰',
    format: 'currency',
    subtext: 'TTM',
    trend: { direction: 'down', value: '-5.9%' }
  },
  {
    label: 'Actual IRR',
    value: 16.2,
    icon: '📈',
    format: 'percentage',
    subtext: 'Since acquisition',
    trend: { direction: 'down', value: '-2.3%' }
  },
  {
    label: 'Cash-on-Cash',
    value: 7.8,
    icon: '💵',
    format: 'percentage',
    subtext: 'TTM'
  },
  {
    label: 'Current Cap Rate',
    value: 6.8,
    icon: '📊',
    format: 'percentage',
    subtext: 'vs 6.2% entry'
  },
  {
    label: 'Unrealized Gain',
    value: 4800000,
    icon: '🎯',
    format: 'currency',
    subtext: '+35.6%',
    trend: { direction: 'up', value: '+12%' }
  }
];

export const performanceActuals: IncomeStatementLine[] = [
  // Revenue
  { label: 'Gross Potential Rent', value: 5280000, category: 'revenue' },
  { label: 'Other Income', value: 265000, category: 'revenue', indent: 1 },
  { label: 'Less: Vacancy Loss', value: -290000, category: 'revenue', indent: 1 },
  { label: 'Effective Gross Income', value: 5255000, category: 'subtotal' },
  
  // Operating Expenses
  { label: 'Property Management', value: 285000, category: 'expense' },
  { label: 'Repairs & Maintenance', value: 348000, category: 'expense' },
  { label: 'Utilities', value: 195000, category: 'expense' },
  { label: 'Insurance', value: 105000, category: 'expense' },
  { label: 'Property Taxes', value: 642000, category: 'expense' },
  { label: 'Marketing & Leasing', value: 85000, category: 'expense' },
  { label: 'Administrative', value: 135000, category: 'expense' },
  { label: 'Total Operating Expenses', value: 1795000, category: 'subtotal' },
  
  // NOI
  { label: 'Net Operating Income', value: 3460000, category: 'noi' }
];

export const performanceMetrics = {
  purchasePrice: 45000000,
  currentValue: 49800000,
  unrealizedGain: 4800000,
  originalEquity: 13500000,
  currentEquity: 18300000,
  cashDistributed: 4200000,
  totalReturn: 22500000,
  holdPeriod: 1.5, // years
  currentIRR: 16.2,
  projectedIRR: 18.5,
  currentOccupancy: 95,
  targetOccupancy: 96
};

export const varianceAnalysis: VarianceItem[] = [
  {
    category: 'Rental Income',
    budget: 5500000,
    actual: 5280000,
    variance: -220000,
    variancePercent: -4.0
  },
  {
    category: 'Other Income',
    budget: 280000,
    actual: 265000,
    variance: -15000,
    variancePercent: -5.4
  },
  {
    category: 'Vacancy Loss',
    budget: -385000,
    actual: -290000,
    variance: 95000,
    variancePercent: 24.7
  },
  {
    category: 'Property Management',
    budget: 270000,
    actual: 285000,
    variance: -15000,
    variancePercent: -5.6
  },
  {
    category: 'Repairs & Maintenance',
    budget: 320000,
    actual: 348000,
    variance: -28000,
    variancePercent: -8.8
  },
  {
    category: 'Utilities',
    budget: 185000,
    actual: 195000,
    variance: -10000,
    variancePercent: -5.4
  },
  {
    category: 'Property Taxes',
    budget: 625000,
    actual: 642000,
    variance: -17000,
    variancePercent: -2.7
  },
  {
    category: 'Insurance',
    budget: 95000,
    actual: 105000,
    variance: -10000,
    variancePercent: -10.5
  },
  {
    category: 'Net Operating Income',
    budget: 3700000,
    actual: 3460000,
    variance: -240000,
    variancePercent: -6.5
  }
];

export const performanceProjections: ProjectionData[] = [
  { year: 1, noi: 3200000, cashFlow: 1050000, equityValue: 14550000, occupancy: 93 },
  { year: 2, noi: 3360000, cashFlow: 1155000, equityValue: 16100000, occupancy: 94 },
  { year: 3, noi: 3528000, cashFlow: 1268000, equityValue: 17800000, occupancy: 95 },
  { year: 4, noi: 3704400, cashFlow: 1389000, equityValue: 19650000, occupancy: 95 },
  { year: 5, noi: 3889620, cashFlow: 1518000, equityValue: 21650000, occupancy: 96 },
  { year: 6, noi: 4084101, cashFlow: 1656000, equityValue: 23900000, occupancy: 96 },
  { year: 7, noi: 4288306, cashFlow: 1803000, equityValue: 26400000, occupancy: 97 },
  { year: 8, noi: 4502721, cashFlow: 1960000, equityValue: 29200000, occupancy: 97 },
  { year: 9, noi: 4727857, cashFlow: 2128000, equityValue: 32300000, occupancy: 97 },
  { year: 10, noi: 4964250, cashFlow: 2307000, equityValue: 35700000, occupancy: 98 }
];

export const quarterlyForecasts = [
  { quarter: 'Q1 2024', noiActual: 820000, noiBudget: 850000, occupancy: 94 },
  { quarter: 'Q2 2024', noiActual: 840000, noiBudget: 875000, occupancy: 95 },
  { quarter: 'Q3 2024', noiActual: 0, noiBudget: 900000, occupancy: 96 },
  { quarter: 'Q4 2024', noiActual: 0, noiBudget: 925000, occupancy: 96 }
];
