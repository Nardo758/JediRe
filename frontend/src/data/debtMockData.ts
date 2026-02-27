/**
 * Mock Data for Debt/Financing Section
 * Provides realistic debt market data for both acquisition and performance modes
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
  status?: 'good' | 'warning' | 'critical';
}

export interface LenderQuote {
  id: string;
  lenderName: string;
  lenderType: 'Agency' | 'Bank' | 'CMBS' | 'Debt Fund' | 'Life Company' | 'Bridge';
  interestRate: number;
  ltv: number;
  loanAmount: number;
  term: number;
  amortization: number;
  dscr: number;
  fees: {
    origination: number;
    closing: number;
    legal: number;
  };
  prepaymentPenalty: string;
  recourse: 'Non-Recourse' | 'Partial Recourse' | 'Full Recourse';
  assumable: boolean;
  lockPeriod: number; // days
  specialTerms?: string;
  score: number; // 1-100
  monthlyPayment: number;
}

export interface RateEnvironment {
  fedFunds: number;
  treasury10Y: number;
  sofr: number;
  prime: number;
  spread: number; // typical spread over treasury
  lastUpdated: string;
}

export interface RateTrend {
  date: string;
  treasury10Y: number;
  sofr: number;
  cmbs: number;
  agency: number;
}

export interface DebtServiceCalculation {
  loanAmount: number;
  interestRate: number;
  term: number;
  amortization: number;
  monthlyPayment: number;
  annualDebtService: number;
  noi: number;
  dscr: number;
}

export interface AmortizationScheduleRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface RefinanceOpportunity {
  id: string;
  type: 'rate_drop' | 'maturity_approaching' | 'cash_out' | 'term_improvement';
  title: string;
  description: string;
  potentialSavings: number;
  urgency: 'high' | 'medium' | 'low';
  icon: string;
  action: string;
}

// ==================== RATE ENVIRONMENT ====================

export const currentRateEnvironment: RateEnvironment = {
  fedFunds: 5.50,
  treasury10Y: 4.35,
  sofr: 5.32,
  prime: 8.50,
  spread: 275, // basis points over treasury
  lastUpdated: '2024-02-13'
};

export const rateTrends: RateTrend[] = [
  { date: '2023-08', treasury10Y: 4.18, sofr: 5.15, cmbs: 6.95, agency: 6.15 },
  { date: '2023-09', treasury10Y: 4.28, sofr: 5.21, cmbs: 7.08, agency: 6.28 },
  { date: '2023-10', treasury10Y: 4.45, sofr: 5.28, cmbs: 7.25, agency: 6.45 },
  { date: '2023-11', treasury10Y: 4.38, sofr: 5.25, cmbs: 7.18, agency: 6.38 },
  { date: '2023-12', treasury10Y: 4.25, sofr: 5.18, cmbs: 7.05, agency: 6.25 },
  { date: '2024-01', treasury10Y: 4.32, sofr: 5.28, cmbs: 7.12, agency: 6.32 },
  { date: '2024-02', treasury10Y: 4.35, sofr: 5.32, cmbs: 7.10, agency: 6.35 }
];

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionStats: QuickStat[] = [
  {
    label: 'Target LTV',
    value: 70,
    icon: '📊',
    format: 'percentage',
    subtext: '$31.5M loan',
    status: 'good'
  },
  {
    label: 'Best Rate Available',
    value: 6.25,
    icon: '💰',
    format: 'percentage',
    subtext: 'Agency financing',
    trend: {
      direction: 'up',
      value: '+15 bps'
    }
  },
  {
    label: 'Projected DSCR',
    value: 1.42,
    icon: '🎯',
    format: 'number',
    subtext: 'Above 1.25x min',
    status: 'good'
  },
  {
    label: 'Monthly Debt Service',
    value: 183750,
    icon: '📅',
    format: 'currency',
    subtext: '$2.21M annual'
  },
  {
    label: 'Rate Lock Window',
    value: 45,
    icon: '⏱️',
    format: 'number',
    subtext: 'days remaining',
    status: 'warning'
  }
];

export const acquisitionLenderQuotes: LenderQuote[] = [
  {
    id: 'quote-1',
    lenderName: 'Fannie Mae DUS',
    lenderType: 'Agency',
    interestRate: 6.25,
    ltv: 75,
    loanAmount: 33750000,
    term: 10,
    amortization: 30,
    dscr: 1.35,
    fees: {
      origination: 1.5,
      closing: 0.5,
      legal: 75000
    },
    prepaymentPenalty: 'Yield Maintenance (10 years)',
    recourse: 'Non-Recourse',
    assumable: true,
    lockPeriod: 90,
    specialTerms: 'Green financing available with 10 bps reduction',
    score: 92,
    monthlyPayment: 206953
  },
  {
    id: 'quote-2',
    lenderName: 'Wells Fargo Bank',
    lenderType: 'Bank',
    interestRate: 6.45,
    ltv: 70,
    loanAmount: 31500000,
    term: 10,
    amortization: 25,
    dscr: 1.42,
    fees: {
      origination: 1.0,
      closing: 0.75,
      legal: 50000
    },
    prepaymentPenalty: 'Step-down (5-4-3-2-1)',
    recourse: 'Partial Recourse',
    assumable: false,
    lockPeriod: 60,
    score: 85,
    monthlyPayment: 215287
  },
  {
    id: 'quote-3',
    lenderName: 'Goldman Sachs CMBS',
    lenderType: 'CMBS',
    interestRate: 6.85,
    ltv: 70,
    loanAmount: 31500000,
    term: 10,
    amortization: 30,
    dscr: 1.42,
    fees: {
      origination: 2.0,
      closing: 1.0,
      legal: 125000
    },
    prepaymentPenalty: 'Defeasance',
    recourse: 'Non-Recourse',
    assumable: true,
    lockPeriod: 45,
    score: 78,
    monthlyPayment: 208144
  },
  {
    id: 'quote-4',
    lenderName: 'Blackstone Debt Fund',
    lenderType: 'Debt Fund',
    interestRate: 9.50,
    ltv: 65,
    loanAmount: 29250000,
    term: 3,
    amortization: 30,
    dscr: 1.53,
    fees: {
      origination: 3.0,
      closing: 1.5,
      legal: 100000
    },
    prepaymentPenalty: '1% entire term',
    recourse: 'Full Recourse',
    assumable: false,
    lockPeriod: 30,
    specialTerms: 'Bridge to agency refinancing, 2 extension options',
    score: 72,
    monthlyPayment: 245588
  },
  {
    id: 'quote-5',
    lenderName: 'MetLife Life Company',
    lenderType: 'Life Company',
    interestRate: 6.15,
    ltv: 65,
    loanAmount: 29250000,
    term: 12,
    amortization: 30,
    dscr: 1.53,
    fees: {
      origination: 1.25,
      closing: 0.5,
      legal: 60000
    },
    prepaymentPenalty: 'Yield Maintenance (12 years)',
    recourse: 'Non-Recourse',
    assumable: true,
    lockPeriod: 120,
    specialTerms: 'Rate locked for 120 days at no cost',
    score: 88,
    monthlyPayment: 179211
  }
];

export const debtServiceCalculation: DebtServiceCalculation = {
  loanAmount: 31500000,
  interestRate: 6.25,
  term: 10,
  amortization: 30,
  monthlyPayment: 193858,
  annualDebtService: 2326296,
  noi: 3300000,
  dscr: 1.42
};

// ==================== PERFORMANCE MODE DATA ====================

export const performanceStats: QuickStat[] = [
  {
    label: 'Current DSCR',
    value: 1.38,
    icon: '📊',
    format: 'number',
    subtext: 'vs 1.25x covenant',
    status: 'good',
    trend: {
      direction: 'down',
      value: '-0.04'
    }
  },
  {
    label: 'Loan Balance',
    value: 29850000,
    icon: '💰',
    format: 'currency',
    subtext: '$32M original',
    trend: {
      direction: 'down',
      value: '-$2.15M'
    }
  },
  {
    label: 'Current Rate',
    value: 6.75,
    icon: '📈',
    format: 'percentage',
    subtext: 'Fixed rate',
    status: 'warning'
  },
  {
    label: 'Maturity Date',
    value: 'Aug 2029',
    icon: '📅',
    format: 'text',
    subtext: '1,978 days left'
  },
  {
    label: 'Refi Savings Available',
    value: 425000,
    icon: '💡',
    format: 'currency',
    subtext: 'Over 5 years',
    status: 'good'
  }
];

export const currentDebtProfile = {
  lender: 'Wells Fargo Bank',
  loanType: 'Fixed Rate Permanent',
  originalAmount: 32000000,
  currentBalance: 29850000,
  interestRate: 6.75,
  originationDate: '2022-08-15',
  maturityDate: '2029-08-15',
  amortization: 25,
  monthlyPayment: 219450,
  prepaymentPenalty: 'Step-down (3-2-1)',
  prepaymentPenaltyAmount: 596250, // Current penalty if refinanced today
  recourse: 'Partial Recourse',
  covenants: [
    { type: 'DSCR', requirement: '1.25x minimum', current: 1.38, status: 'compliant' },
    { type: 'Occupancy', requirement: '85% minimum', current: 95, status: 'compliant' },
    { type: 'Reserves', requirement: '$150k minimum', current: 225000, status: 'compliant' }
  ]
};

export const refinanceOpportunities: RefinanceOpportunity[] = [
  {
    id: 'refi-1',
    type: 'rate_drop',
    title: 'Rate Reduction Opportunity',
    description: 'Current market rates ~50 bps lower than your existing rate. Refi could save $85k/year.',
    potentialSavings: 425000,
    urgency: 'medium',
    icon: '💰',
    action: 'Get Refi Quotes'
  },
  {
    id: 'refi-2',
    type: 'cash_out',
    title: 'Cash-Out Refinance Available',
    description: 'Property value increased 18%. Extract $4.2M in equity at attractive rates.',
    potentialSavings: 4200000,
    urgency: 'low',
    icon: '💸',
    action: 'Explore Cash-Out'
  },
  {
    id: 'refi-3',
    type: 'term_improvement',
    title: 'Extend Maturity',
    description: 'Lock in current low rates for 10+ years instead of 5 years remaining.',
    potentialSavings: 0,
    urgency: 'low',
    icon: '📅',
    action: 'Compare Terms'
  }
];

export const performanceLenderQuotes: LenderQuote[] = [
  {
    id: 'refi-quote-1',
    lenderName: 'Freddie Mac Optigo',
    lenderType: 'Agency',
    interestRate: 6.15,
    ltv: 70,
    loanAmount: 30800000,
    term: 10,
    amortization: 30,
    dscr: 1.43,
    fees: {
      origination: 1.5,
      closing: 0.5,
      legal: 75000
    },
    prepaymentPenalty: 'Yield Maintenance (10 years)',
    recourse: 'Non-Recourse',
    assumable: true,
    lockPeriod: 90,
    score: 94,
    monthlyPayment: 188738
  },
  {
    id: 'refi-quote-2',
    lenderName: 'Bank of America',
    lenderType: 'Bank',
    interestRate: 6.35,
    ltv: 68,
    loanAmount: 29920000,
    term: 7,
    amortization: 25,
    dscr: 1.47,
    fees: {
      origination: 1.0,
      closing: 0.75,
      legal: 50000
    },
    prepaymentPenalty: 'Step-down (5-4-3-2-1)',
    recourse: 'Partial Recourse',
    assumable: false,
    lockPeriod: 60,
    score: 87,
    monthlyPayment: 203821
  }
];

// ==================== AMORTIZATION SCHEDULE ====================

export const generateAmortizationSchedule = (
  loanAmount: number,
  annualRate: number,
  termYears: number,
  amortizationYears: number
): AmortizationScheduleRow[] => {
  const monthlyRate = annualRate / 100 / 12;
  const totalPayments = amortizationYears * 12;
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
                         (Math.pow(1 + monthlyRate, totalPayments) - 1);
  
  const schedule: AmortizationScheduleRow[] = [];
  let balance = loanAmount;
  
  for (let month = 1; month <= Math.min(termYears * 12, 60); month++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance -= principal;
    
    schedule.push({
      month,
      payment: Math.round(monthlyPayment),
      principal: Math.round(principal),
      interest: Math.round(interest),
      balance: Math.round(balance)
    });
  }
  
  return schedule;
};

// Sample amortization schedule for acquisition
export const sampleAmortizationSchedule = generateAmortizationSchedule(
  31500000,
  6.25,
  10,
  30
);

// ==================== RATE ALERTS & INSIGHTS ====================

export const rateAlerts = [
  {
    id: 'alert-1',
    type: 'warning',
    message: 'Fed meeting scheduled Feb 28 - potential rate movement',
    impact: 'Possible +25 bps increase in Fed Funds rate',
    recommendation: 'Consider locking rate before meeting'
  },
  {
    id: 'alert-2',
    type: 'info',
    message: 'Agency debt spreads tightening',
    impact: 'Agency financing becoming more competitive',
    recommendation: 'Good time for agency quotes'
  },
  {
    id: 'alert-3',
    type: 'positive',
    message: 'CMBS issuance increased 15% this quarter',
    impact: 'More liquidity in conduit lending market',
    recommendation: 'Multiple CMBS options available'
  }
];

export const marketInsights = {
  sentiment: 'Cautiously Optimistic' as const,
  lendingEnvironment: 'Competitive' as const,
  recommendation: 'Lock rates within 30-45 days',
  keyTrends: [
    'Agency lenders most competitive for stabilized assets',
    'Bridge debt spreads remain elevated (+400-500 bps)',
    'Life companies pulling back slightly on multifamily',
    'DSCR requirements holding steady at 1.25x',
    'LTV generally capped at 70-75% for new originations'
  ]
};
