/**
 * Mock Data for Dual-Mode Exit Section
 * Provides realistic exit planning and execution data for both acquisition and performance modes
 */

export interface ExitQuickStat {
  label: string;
  value: string | number;
  icon: string;
  format?: 'currency' | 'percentage' | 'text' | 'number' | 'years' | 'months';
  subtext?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

export interface ExitScenario {
  id: string;
  name: string;
  type: 'sale' | 'refinance' | 'hold';
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  timing: string;
  exitCap: number;
  projectedNOI: number;
  salePrice?: number;
  refinanceAmount?: number;
  cashOut?: number;
  equityMultiple?: number;
  irr: number;
  probability: 'high' | 'medium' | 'low';
  keyFeatures: string[];
  description: string;
}

export interface ExitTimelineEvent {
  id: string;
  name: string;
  date: string;
  monthsFromNow: number;
  status: 'completed' | 'upcoming' | 'future';
  category: 'preparation' | 'marketing' | 'transaction' | 'closing';
  description: string;
}

export interface ValueProjection {
  year: number;
  noi: number;
  capRate: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  irr: number;
}

export interface MarketReadinessIndicator {
  category: string;
  status: 'ready' | 'needs-attention' | 'not-ready';
  score: number;
  description: string;
  actionItems?: string[];
}

export interface BrokerRecommendation {
  id: string;
  brokerName: string;
  firm: string;
  specialty: string;
  recentSales: number;
  avgDaysOnMarket: number;
  avgPricePremium: number;
  rating: number;
  pros: string[];
  cons: string[];
}

export interface ExitReadinessChecklistItem {
  id: string;
  item: string;
  status: 'completed' | 'in-progress' | 'not-started';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  assignee?: string;
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionExitStats: ExitQuickStat[] = [
  {
    label: 'Target Hold Period',
    value: '5-7',
    icon: '📅',
    format: 'years',
    subtext: 'Value-add timeline'
  },
  {
    label: 'Target Exit Cap',
    value: 5.8,
    icon: '🎯',
    format: 'percentage',
    subtext: 'Market assumption'
  },
  {
    label: 'Projected Exit Value',
    value: 58620000,
    icon: '💰',
    format: 'currency',
    subtext: 'Base case (Year 5)'
  },
  {
    label: 'Target IRR at Exit',
    value: 18.5,
    icon: '📈',
    format: 'percentage',
    trend: {
      direction: 'up',
      value: 'Above target'
    }
  },
  {
    label: 'Projected Equity Multiple',
    value: '2.1x',
    icon: '💎',
    format: 'text',
    subtext: 'Base case return'
  }
];

export const acquisitionExitScenarios: ExitScenario[] = [
  {
    id: 'base-sale',
    name: 'Base Case Sale',
    type: 'sale',
    icon: '🏢',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    timing: 'Year 5 (Q2 2029)',
    exitCap: 5.8,
    projectedNOI: 3400000,
    salePrice: 58620000,
    equityMultiple: 2.1,
    irr: 18.5,
    probability: 'high',
    keyFeatures: [
      'Full stabilization achieved',
      'Peak rent growth captured',
      'Market conditions favorable',
      'Multiple buyer interest expected'
    ],
    description: 'Primary exit strategy with stabilized asset at market cap rate'
  },
  {
    id: 'opportunistic-sale',
    name: 'Opportunistic Early Sale',
    type: 'sale',
    icon: '⚡',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-400',
    timing: 'Year 3 (Q4 2026)',
    exitCap: 5.5,
    projectedNOI: 3150000,
    salePrice: 57270000,
    equityMultiple: 1.95,
    irr: 22.3,
    probability: 'medium',
    keyFeatures: [
      'Strong market compression',
      'Aggressive buyer demand',
      'Early value capture',
      'Accelerated returns'
    ],
    description: 'Early exit if cap rates compress significantly below market'
  },
  {
    id: 'refinance-hold',
    name: 'Refinance & Hold',
    type: 'refinance',
    icon: '🔄',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-400',
    timing: 'Year 4 (Q1 2028)',
    exitCap: 5.6,
    projectedNOI: 3300000,
    refinanceAmount: 42000000,
    cashOut: 12000000,
    equityMultiple: 1.4,
    irr: 14.2,
    probability: 'medium',
    keyFeatures: [
      'Cash-out refinancing',
      'Continue value growth',
      'Maintain ownership',
      'Tax-efficient strategy'
    ],
    description: 'Return capital while maintaining upside potential'
  },
  {
    id: 'extended-hold',
    name: 'Extended Hold',
    type: 'hold',
    icon: '🏛️',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-400',
    timing: 'Year 7+ (2030+)',
    exitCap: 6.2,
    projectedNOI: 3650000,
    salePrice: 58870000,
    equityMultiple: 2.25,
    irr: 15.8,
    probability: 'low',
    keyFeatures: [
      'Long-term income generation',
      'Market timing flexibility',
      'Additional rent growth',
      'Core conversion strategy'
    ],
    description: 'Conservative hold for optimal market timing and maximum NOI'
  }
];

export const acquisitionExitTimeline: ExitTimelineEvent[] = [
  {
    id: 'timeline-1',
    name: 'Property Stabilization Target',
    date: '2026-12-31',
    monthsFromNow: 24,
    status: 'future',
    category: 'preparation',
    description: 'Complete renovations and achieve 95% occupancy'
  },
  {
    id: 'timeline-2',
    name: 'Exit Strategy Review',
    date: '2027-06-30',
    monthsFromNow: 30,
    status: 'future',
    category: 'preparation',
    description: 'Evaluate market conditions and finalize exit approach'
  },
  {
    id: 'timeline-3',
    name: 'Property Marketing Package',
    date: '2028-09-30',
    monthsFromNow: 45,
    status: 'future',
    category: 'preparation',
    description: 'Prepare offering memorandum and marketing materials'
  },
  {
    id: 'timeline-4',
    name: 'Broker Engagement',
    date: '2028-12-31',
    monthsFromNow: 48,
    status: 'future',
    category: 'marketing',
    description: 'Select and engage listing broker(s)'
  },
  {
    id: 'timeline-5',
    name: 'Market Launch',
    date: '2029-03-31',
    monthsFromNow: 51,
    status: 'future',
    category: 'marketing',
    description: 'Begin marketing to qualified buyers'
  },
  {
    id: 'timeline-6',
    name: 'Target Closing',
    date: '2029-09-30',
    monthsFromNow: 57,
    status: 'future',
    category: 'closing',
    description: 'Close transaction and distribute proceeds'
  }
];

export const acquisitionValueProjections: ValueProjection[] = [
  { year: 0, noi: 2200000, capRate: 6.5, propertyValue: 33850000, loanBalance: 25350000, equity: 8500000, irr: 0 },
  { year: 1, noi: 2450000, capRate: 6.3, propertyValue: 38890000, loanBalance: 25100000, equity: 13790000, irr: -2.5 },
  { year: 2, noi: 2800000, capRate: 6.1, propertyValue: 45900000, loanBalance: 24850000, equity: 21050000, irr: 8.2 },
  { year: 3, noi: 3150000, capRate: 5.8, propertyValue: 54310000, loanBalance: 24600000, equity: 29710000, irr: 16.8 },
  { year: 4, noi: 3300000, capRate: 5.7, propertyValue: 57890000, loanBalance: 24350000, equity: 33540000, irr: 17.5 },
  { year: 5, noi: 3400000, capRate: 5.8, propertyValue: 58620000, loanBalance: 24100000, equity: 34520000, irr: 18.5 },
  { year: 6, noi: 3500000, capRate: 6.0, propertyValue: 58330000, loanBalance: 23850000, equity: 34480000, irr: 17.2 },
  { year: 7, noi: 3650000, capRate: 6.2, propertyValue: 58870000, loanBalance: 23600000, equity: 35270000, irr: 15.8 }
];

export const acquisitionMarketReadiness: MarketReadinessIndicator[] = [
  {
    category: 'Property Condition',
    status: 'not-ready',
    score: 45,
    description: 'Renovations in progress, 55% complete',
    actionItems: [
      'Complete Phase 2 renovations',
      'Upgrade common areas',
      'Address deferred maintenance'
    ]
  },
  {
    category: 'Financial Performance',
    status: 'needs-attention',
    score: 65,
    description: 'NOI growing but not yet stabilized',
    actionItems: [
      'Achieve 95% occupancy',
      'Reach target rent levels',
      'Stabilize operating expenses'
    ]
  },
  {
    category: 'Market Conditions',
    status: 'ready',
    score: 80,
    description: 'Strong multifamily demand in submarket',
    actionItems: []
  },
  {
    category: 'Documentation',
    status: 'not-ready',
    score: 30,
    description: 'Exit materials not yet prepared',
    actionItems: [
      'Prepare rent roll and financial statements',
      'Create offering memorandum',
      'Compile property marketing package'
    ]
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceExitStats: ExitQuickStat[] = [
  {
    label: 'Time to Target Exit',
    value: 36,
    icon: '⏱️',
    format: 'months',
    subtext: '3 years remaining',
    trend: {
      direction: 'neutral',
      value: 'On track'
    }
  },
  {
    label: 'Current Exit Value',
    value: 54310000,
    icon: '💰',
    format: 'currency',
    subtext: 'If sold today',
    trend: {
      direction: 'up',
      value: '+19% YoY'
    }
  },
  {
    label: 'Exit Readiness Score',
    value: 68,
    icon: '📊',
    format: 'number',
    subtext: 'Out of 100',
    trend: {
      direction: 'up',
      value: '+12 pts'
    }
  },
  {
    label: 'Projected IRR at Exit',
    value: 18.5,
    icon: '📈',
    format: 'percentage',
    subtext: 'Base case Year 5',
    trend: {
      direction: 'up',
      value: 'Ahead of plan'
    }
  },
  {
    label: 'Market Timing Score',
    value: 'Favorable',
    icon: '🎯',
    format: 'text',
    subtext: 'Cap rates stable'
  }
];

export const performanceExitScenarios: ExitScenario[] = [
  {
    id: 'perf-base-sale',
    name: 'Base Case Sale (Year 5)',
    type: 'sale',
    icon: '🏢',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    timing: 'Q2 2027 (36 months)',
    exitCap: 5.8,
    projectedNOI: 3400000,
    salePrice: 58620000,
    equityMultiple: 2.1,
    irr: 18.5,
    probability: 'high',
    keyFeatures: [
      'Renovations 85% complete',
      'Occupancy at 92% and growing',
      'NOI up 31% from acquisition',
      'Strong buyer demand expected'
    ],
    description: 'Primary strategy: Full stabilization then sale at peak value'
  },
  {
    id: 'perf-early-sale',
    name: 'Opportunistic Sale (Now)',
    type: 'sale',
    icon: '⚡',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-400',
    timing: 'Q2 2024 (Immediate)',
    exitCap: 5.5,
    projectedNOI: 3150000,
    salePrice: 57270000,
    equityMultiple: 1.95,
    irr: 22.3,
    probability: 'medium',
    keyFeatures: [
      'Capture current market strength',
      'Early return of capital',
      'Leave some upside on table',
      'Accelerated investor returns'
    ],
    description: 'Exit now if buyer offers premium pricing due to market compression'
  },
  {
    id: 'perf-refi-hold',
    name: 'Refinance & Continue (Year 4)',
    type: 'refinance',
    icon: '🔄',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-400',
    timing: 'Q1 2026 (24 months)',
    exitCap: 5.6,
    projectedNOI: 3300000,
    refinanceAmount: 42000000,
    cashOut: 12000000,
    equityMultiple: 1.4,
    irr: 14.2,
    probability: 'medium',
    keyFeatures: [
      'Return 140% of equity to investors',
      'Maintain ownership & upside',
      'Continue rent growth story',
      'Tax-efficient cash distribution'
    ],
    description: 'De-risk investment while capturing additional upside'
  }
];

export const performanceExitTimeline: ExitTimelineEvent[] = [
  {
    id: 'perf-timeline-1',
    name: 'Phase 2 Renovations Complete',
    date: '2024-03-31',
    monthsFromNow: 2,
    status: 'upcoming',
    category: 'preparation',
    description: 'Finish remaining 40 units to reach 85% renovation completion'
  },
  {
    id: 'perf-timeline-2',
    name: 'Stabilization Target',
    date: '2024-09-30',
    monthsFromNow: 8,
    status: 'upcoming',
    category: 'preparation',
    description: 'Achieve 95% occupancy with renovated units at target rents'
  },
  {
    id: 'perf-timeline-3',
    name: 'Exit Strategy Decision',
    date: '2025-03-31',
    monthsFromNow: 14,
    status: 'upcoming',
    category: 'preparation',
    description: 'Evaluate sale vs refinance vs hold based on market conditions'
  },
  {
    id: 'perf-timeline-4',
    name: 'Broker Selection Process',
    date: '2026-06-30',
    monthsFromNow: 29,
    status: 'future',
    category: 'marketing',
    description: 'Interview and select listing broker(s) for sale'
  },
  {
    id: 'perf-timeline-5',
    name: 'Marketing Materials Prep',
    date: '2026-09-30',
    monthsFromNow: 32,
    status: 'future',
    category: 'marketing',
    description: 'Create offering memorandum and marketing package'
  },
  {
    id: 'perf-timeline-6',
    name: 'Go-to-Market',
    date: '2027-01-31',
    monthsFromNow: 36,
    status: 'future',
    category: 'marketing',
    description: 'Launch property to market with qualified buyers'
  },
  {
    id: 'perf-timeline-7',
    name: 'Target Close Date',
    date: '2027-06-30',
    monthsFromNow: 41,
    status: 'future',
    category: 'closing',
    description: 'Close transaction and distribute proceeds to investors'
  }
];

export const performanceValueProjections: ValueProjection[] = [
  { year: 0, noi: 2200000, capRate: 6.5, propertyValue: 33850000, loanBalance: 25350000, equity: 8500000, irr: 0 },
  { year: 1, noi: 2450000, capRate: 6.3, propertyValue: 38890000, loanBalance: 25100000, equity: 13790000, irr: -2.5 },
  { year: 2, noi: 2800000, capRate: 6.1, propertyValue: 45900000, loanBalance: 24850000, equity: 21050000, irr: 8.2 },
  { year: 3, noi: 3150000, capRate: 5.8, propertyValue: 54310000, loanBalance: 24600000, equity: 29710000, irr: 16.8 },
  { year: 4, noi: 3300000, capRate: 5.7, propertyValue: 57890000, loanBalance: 24350000, equity: 33540000, irr: 17.5 },
  { year: 5, noi: 3400000, capRate: 5.8, propertyValue: 58620000, loanBalance: 24100000, equity: 34520000, irr: 18.5 },
  { year: 6, noi: 3500000, capRate: 6.0, propertyValue: 58330000, loanBalance: 23850000, equity: 34480000, irr: 17.2 },
  { year: 7, noi: 3650000, capRate: 6.2, propertyValue: 58870000, loanBalance: 23600000, equity: 35270000, irr: 15.8 }
];

export const performanceMarketReadiness: MarketReadinessIndicator[] = [
  {
    category: 'Property Condition',
    status: 'needs-attention',
    score: 75,
    description: 'Renovations 85% complete, strong progress',
    actionItems: [
      'Complete remaining 40 units (Phase 2)',
      'Refresh common areas',
      'Final property cosmetics'
    ]
  },
  {
    category: 'Financial Performance',
    status: 'needs-attention',
    score: 72,
    description: 'NOI growing 31% from purchase, approaching stabilization',
    actionItems: [
      'Push occupancy from 92% to 95%',
      'Achieve full target rent on renovated units',
      'Optimize operating expense ratio'
    ]
  },
  {
    category: 'Market Conditions',
    status: 'ready',
    score: 85,
    description: 'Strong multifamily demand, cap rates stable',
    actionItems: []
  },
  {
    category: 'Documentation',
    status: 'needs-attention',
    score: 60,
    description: 'Basic financials current, need exit package',
    actionItems: [
      'Update rent roll and trailing 12-month financials',
      'Prepare proforma with renovated unit premiums',
      'Begin offering memorandum draft'
    ]
  },
  {
    category: 'Buyer Positioning',
    status: 'ready',
    score: 80,
    description: 'Strong value-add story with proven execution',
    actionItems: [
      'Document renovation ROI',
      'Highlight submarket strengths'
    ]
  }
];

export const performanceBrokerRecommendations: BrokerRecommendation[] = [
  {
    id: 'broker-1',
    brokerName: 'Marcus & Associates',
    firm: 'Marcus & Millichap',
    specialty: 'Multifamily Value-Add',
    recentSales: 12,
    avgDaysOnMarket: 67,
    avgPricePremium: 3.2,
    rating: 4.8,
    pros: [
      'Strong Atlanta multifamily track record',
      'National buyer database',
      'Proven value-add specialist',
      '3 recent comps in submarket'
    ],
    cons: [
      'Higher commission (2.5%)',
      'May prioritize larger deals'
    ]
  },
  {
    id: 'broker-2',
    brokerName: 'CBRE Multifamily Group',
    firm: 'CBRE',
    specialty: 'Institutional Multifamily',
    recentSales: 8,
    avgDaysOnMarket: 82,
    avgPricePremium: 2.8,
    rating: 4.6,
    pros: [
      'Best institutional buyer access',
      'Global platform',
      'Strong marketing materials',
      'Excellent negotiation team'
    ],
    cons: [
      'Longer marketing timeline',
      'Less focus on value-add segment',
      'Premium pricing (2.8%)'
    ]
  },
  {
    id: 'broker-3',
    brokerName: 'Colliers Southeast',
    firm: 'Colliers International',
    specialty: 'Regional Multifamily',
    recentSales: 15,
    avgDaysOnMarket: 54,
    avgPricePremium: 4.1,
    rating: 4.9,
    pros: [
      'Best days-on-market in Atlanta',
      'Strong local private buyer network',
      'Competitive pricing (2.0%)',
      'Excellent market knowledge'
    ],
    cons: [
      'Smaller national reach',
      'Fewer institutional relationships'
    ]
  },
  {
    id: 'broker-4',
    brokerName: 'JLL Multifamily Capital Markets',
    firm: 'JLL',
    specialty: 'Full Multifamily',
    recentSales: 10,
    avgDaysOnMarket: 71,
    avgPricePremium: 3.5,
    rating: 4.7,
    pros: [
      'Integrated debt & equity platform',
      'Strong analytics team',
      'Good institutional & private reach',
      'Flexible fee structure'
    ],
    cons: [
      'Can be bureaucratic',
      'Turnover in local office'
    ]
  }
];

export const performanceExitReadiness: ExitReadinessChecklistItem[] = [
  {
    id: 'ready-1',
    item: 'Complete Phase 2 renovations (40 units)',
    status: 'in-progress',
    priority: 'high',
    dueDate: '2024-03-31',
    assignee: 'Construction Manager'
  },
  {
    id: 'ready-2',
    item: 'Achieve 95% occupancy',
    status: 'in-progress',
    priority: 'high',
    dueDate: '2024-09-30',
    assignee: 'Leasing Team'
  },
  {
    id: 'ready-3',
    item: 'Stabilize NOI at $3.4M annually',
    status: 'in-progress',
    priority: 'high',
    dueDate: '2024-12-31',
    assignee: 'Asset Manager'
  },
  {
    id: 'ready-4',
    item: 'Update all property financials & rent roll',
    status: 'not-started',
    priority: 'medium',
    dueDate: '2026-03-31',
    assignee: 'Finance Team'
  },
  {
    id: 'ready-5',
    item: 'Prepare offering memorandum',
    status: 'not-started',
    priority: 'medium',
    dueDate: '2026-09-30',
    assignee: 'Marketing Team'
  },
  {
    id: 'ready-6',
    item: 'Compile property photos & marketing materials',
    status: 'not-started',
    priority: 'medium',
    dueDate: '2026-09-30',
    assignee: 'Marketing Team'
  },
  {
    id: 'ready-7',
    item: 'Select listing broker',
    status: 'not-started',
    priority: 'high',
    dueDate: '2026-06-30',
    assignee: 'Asset Manager'
  },
  {
    id: 'ready-8',
    item: 'Address any deferred maintenance items',
    status: 'in-progress',
    priority: 'medium',
    dueDate: '2026-03-31',
    assignee: 'Property Manager'
  },
  {
    id: 'ready-9',
    item: 'Document renovation ROI & value creation story',
    status: 'not-started',
    priority: 'low',
    dueDate: '2026-09-30',
    assignee: 'Asset Manager'
  },
  {
    id: 'ready-10',
    item: 'Legal review of all property documents',
    status: 'not-started',
    priority: 'medium',
    dueDate: '2027-01-31',
    assignee: 'Legal Team'
  }
];

export const acquisitionExitReadiness: ExitReadinessChecklistItem[] = [
  {
    id: 'acq-ready-1',
    item: 'Define target exit timeline & strategy',
    status: 'not-started',
    priority: 'high',
    dueDate: '2025-06-30',
    assignee: 'Investment Team'
  },
  {
    id: 'acq-ready-2',
    item: 'Complete property renovations',
    status: 'not-started',
    priority: 'high',
    dueDate: '2026-12-31',
    assignee: 'Construction Manager'
  },
  {
    id: 'acq-ready-3',
    item: 'Achieve stabilized occupancy (95%)',
    status: 'not-started',
    priority: 'high',
    dueDate: '2027-06-30',
    assignee: 'Leasing Team'
  },
  {
    id: 'acq-ready-4',
    item: 'Reach target NOI ($3.4M)',
    status: 'not-started',
    priority: 'high',
    dueDate: '2027-12-31',
    assignee: 'Asset Manager'
  },
  {
    id: 'acq-ready-5',
    item: 'Monitor market conditions & cap rates',
    status: 'not-started',
    priority: 'medium',
    dueDate: '2028-06-30',
    assignee: 'Investment Team'
  },
  {
    id: 'acq-ready-6',
    item: 'Prepare exit decision framework',
    status: 'not-started',
    priority: 'medium',
    dueDate: '2027-12-31',
    assignee: 'Investment Committee'
  },
  {
    id: 'acq-ready-7',
    item: 'Begin broker relationship development',
    status: 'not-started',
    priority: 'low',
    dueDate: '2027-06-30',
    assignee: 'Asset Manager'
  }
];
