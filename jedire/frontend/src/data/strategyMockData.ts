/**
 * Mock Data for Dual-Mode Strategy Section
 * Provides realistic data for both acquisition and performance modes
 */

export interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
  format?: 'currency' | 'percentage' | 'text' | 'number' | 'years';
  subtext?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

export interface StrategyCard {
  id: string;
  name: string;
  type: 'core' | 'value-add' | 'opportunistic' | 'development';
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  targetIRR: number;
  holdPeriod: string;
  riskLevel: 'low' | 'medium' | 'high' | 'very-high';
  keyFeatures: string[];
  capexRequired: number;
  timeToStabilize?: string;
  exitStrategy: string[];
  description: string;
}

export interface ImplementationTask {
  id: string;
  task: string;
  status: 'completed' | 'in-progress' | 'pending';
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface TimelinePhase {
  name: string;
  duration: string;
  startMonth: number;
  durationMonths: number;
  color: string;
  tasks: string[];
}

export interface ROIProjection {
  strategy: string;
  year1: number;
  year3: number;
  year5: number;
  exit: number;
  totalReturn: number;
}

export interface RiskFactor {
  category: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface StrategyProgress {
  phase: string;
  percentage: number;
  status: 'completed' | 'active' | 'upcoming';
  completedTasks: number;
  totalTasks: number;
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionStats: QuickStat[] = [
  {
    label: 'Primary Strategy',
    value: 'Value-Add',
    icon: '🎯',
    format: 'text',
    subtext: 'Moderate Risk'
  },
  {
    label: 'Hold Period',
    value: '5-7',
    icon: '📅',
    format: 'years'
  },
  {
    label: 'Target IRR',
    value: 18.5,
    icon: '📈',
    format: 'percentage',
    trend: {
      direction: 'up',
      value: 'Above market'
    }
  },
  {
    label: 'Capex Budget',
    value: 4500000,
    icon: '💰',
    format: 'currency',
    subtext: '$18k/unit'
  },
  {
    label: 'Time to Stabilize',
    value: '18-24',
    icon: '⏱️',
    format: 'text',
    subtext: 'months'
  }
];

export const strategyCards: StrategyCard[] = [
  {
    id: 'core',
    name: 'Core Strategy',
    type: 'core',
    icon: '🏦',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    targetIRR: 8.5,
    holdPeriod: '7-10 years',
    riskLevel: 'low',
    keyFeatures: [
      'Stable, income-producing asset',
      'Class A property in prime location',
      'High occupancy (95%+)',
      'Minimal capital expenditure'
    ],
    capexRequired: 500000,
    timeToStabilize: 'Already stabilized',
    exitStrategy: ['Long-term hold', 'Portfolio sale', 'Refinance'],
    description: 'Conservative approach focused on steady income and capital preservation'
  },
  {
    id: 'value-add',
    name: 'Value-Add Strategy',
    type: 'value-add',
    icon: '🔧',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    targetIRR: 18.5,
    holdPeriod: '5-7 years',
    riskLevel: 'medium',
    keyFeatures: [
      'Unit renovations & upgrades',
      'Operational improvements',
      'Rent growth opportunity 15-20%',
      'Strong exit multiple'
    ],
    capexRequired: 4500000,
    timeToStabilize: '18-24 months',
    exitStrategy: ['Strategic sale', 'Refinance & hold', '1031 exchange'],
    description: 'Targeted improvements to increase NOI and property value'
  },
  {
    id: 'opportunistic',
    name: 'Opportunistic Strategy',
    type: 'opportunistic',
    icon: '⚡',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    targetIRR: 25.0,
    holdPeriod: '3-5 years',
    riskLevel: 'high',
    keyFeatures: [
      'Heavy repositioning required',
      'Lease-up & stabilization play',
      'Aggressive rent premiums',
      'Potential conversion opportunity'
    ],
    capexRequired: 8500000,
    timeToStabilize: '24-36 months',
    exitStrategy: ['Quick flip', 'Stabilize & sell', 'Institutional buyer'],
    description: 'High-risk, high-reward approach with significant value creation'
  },
  {
    id: 'development',
    name: 'Ground-Up Development',
    type: 'development',
    icon: '🏗️',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    targetIRR: 22.0,
    holdPeriod: '4-6 years',
    riskLevel: 'very-high',
    keyFeatures: [
      'New construction from ground up',
      'Zoning & entitlement process',
      'Modern amenities & design',
      'Market-rate positioning'
    ],
    capexRequired: 42000000,
    timeToStabilize: '36-48 months',
    exitStrategy: ['Stabilize & sell', 'Core conversion', 'REIT sale'],
    description: 'Maximum risk and return through new development'
  }
];

export const acquisitionImplementationTasks: ImplementationTask[] = [
  {
    id: 'task-1',
    task: 'Complete property condition assessment',
    status: 'completed',
    assignee: 'Property Inspector',
    dueDate: '2024-01-15',
    priority: 'high'
  },
  {
    id: 'task-2',
    task: 'Finalize renovation scope & budget',
    status: 'in-progress',
    assignee: 'Construction Manager',
    dueDate: '2024-02-01',
    priority: 'high'
  },
  {
    id: 'task-3',
    task: 'Hire property management company',
    status: 'in-progress',
    assignee: 'Asset Manager',
    dueDate: '2024-02-15',
    priority: 'medium'
  },
  {
    id: 'task-4',
    task: 'Develop marketing & leasing strategy',
    status: 'pending',
    assignee: 'Leasing Director',
    dueDate: '2024-03-01',
    priority: 'medium'
  },
  {
    id: 'task-5',
    task: 'Set up capital call schedule',
    status: 'pending',
    assignee: 'CFO',
    dueDate: '2024-02-20',
    priority: 'low'
  },
  {
    id: 'task-6',
    task: 'Establish contractor relationships',
    status: 'completed',
    assignee: 'Construction Manager',
    dueDate: '2024-01-20',
    priority: 'high'
  }
];

export const acquisitionTimeline: TimelinePhase[] = [
  {
    name: 'Acquisition & Due Diligence',
    duration: 'Months 1-3',
    startMonth: 0,
    durationMonths: 3,
    color: 'bg-blue-500',
    tasks: ['Property inspection', 'Financial analysis', 'Legal review', 'Financing close']
  },
  {
    name: 'Capital Improvements',
    duration: 'Months 4-18',
    startMonth: 3,
    durationMonths: 15,
    color: 'bg-green-500',
    tasks: ['Unit renovations', 'Common area upgrades', 'Systems replacement', 'Exterior work']
  },
  {
    name: 'Lease-Up & Stabilization',
    duration: 'Months 12-24',
    startMonth: 11,
    durationMonths: 13,
    color: 'bg-yellow-500',
    tasks: ['Marketing campaigns', 'Tenant acquisition', 'Rent optimization', 'Occupancy 95%+']
  },
  {
    name: 'Hold & Optimize',
    duration: 'Months 25-60',
    startMonth: 24,
    durationMonths: 36,
    color: 'bg-purple-500',
    tasks: ['Operational excellence', 'Rent growth', 'Expense management', 'Value monitoring']
  },
  {
    name: 'Exit Preparation',
    duration: 'Months 55-72',
    startMonth: 54,
    durationMonths: 18,
    color: 'bg-red-500',
    tasks: ['Market analysis', 'Property marketing', 'Buyer qualification', 'Transaction close']
  }
];

export const roiProjections: ROIProjection[] = [
  {
    strategy: 'Core',
    year1: 3.2,
    year3: 10.5,
    year5: 18.2,
    exit: 28.5,
    totalReturn: 42.3
  },
  {
    strategy: 'Value-Add',
    year1: -2.5,
    year3: 25.8,
    year5: 52.4,
    exit: 118.5,
    totalReturn: 165.2
  },
  {
    strategy: 'Opportunistic',
    year1: -8.5,
    year3: 35.2,
    year5: 98.5,
    exit: 210.0,
    totalReturn: 285.5
  },
  {
    strategy: 'Development',
    year1: -15.0,
    year3: 18.5,
    year5: 75.2,
    exit: 175.0,
    totalReturn: 245.8
  }
];

export const riskFactors: RiskFactor[] = [
  {
    category: 'Market Risk',
    level: 'medium',
    description: 'Atlanta multifamily market showing softness in Class B segments',
    mitigation: 'Focus on submarkets with job growth and limited new supply'
  },
  {
    category: 'Construction Risk',
    level: 'medium',
    description: 'Renovation timeline and budget overruns',
    mitigation: '15% contingency budget and experienced GC with fixed-price contract'
  },
  {
    category: 'Lease-Up Risk',
    level: 'low',
    description: 'Slower than expected absorption at target rents',
    mitigation: 'Strong submarket fundamentals and conservative rent assumptions'
  },
  {
    category: 'Interest Rate Risk',
    level: 'high',
    description: 'Rising rates impacting exit cap rates and refinancing',
    mitigation: 'Fixed-rate debt and sensitivity analysis on exit assumptions'
  },
  {
    category: 'Regulatory Risk',
    level: 'low',
    description: 'Potential rent control or tenant protection ordinances',
    mitigation: 'Monitoring local legislation and conservative rent growth'
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceStats: QuickStat[] = [
  {
    label: 'Active Strategy',
    value: 'Value-Add',
    icon: '🎯',
    format: 'text',
    subtext: 'Year 2 of 5'
  },
  {
    label: 'Current IRR',
    value: 16.2,
    icon: '📈',
    format: 'percentage',
    trend: {
      direction: 'up',
      value: '+1.8% YoY'
    }
  },
  {
    label: 'Hold Period',
    value: '1.8',
    icon: '📅',
    format: 'years',
    subtext: 'of 5-7 planned'
  },
  {
    label: 'Capex Deployed',
    value: 3200000,
    icon: '💰',
    format: 'currency',
    subtext: '71% of budget',
    trend: {
      direction: 'neutral',
      value: 'On track'
    }
  },
  {
    label: 'Value Creation',
    value: 8500000,
    icon: '💎',
    format: 'currency',
    subtext: '+19% from purchase',
    trend: {
      direction: 'up',
      value: 'Ahead of plan'
    }
  }
];

export const performanceStrategyProgress: StrategyProgress[] = [
  {
    phase: 'Capital Improvements',
    percentage: 85,
    status: 'active',
    completedTasks: 17,
    totalTasks: 20
  },
  {
    phase: 'Lease-Up & Stabilization',
    percentage: 60,
    status: 'active',
    completedTasks: 12,
    totalTasks: 20
  },
  {
    phase: 'Hold & Optimize',
    percentage: 0,
    status: 'upcoming',
    completedTasks: 0,
    totalTasks: 25
  },
  {
    phase: 'Exit Preparation',
    percentage: 0,
    status: 'upcoming',
    completedTasks: 0,
    totalTasks: 15
  }
];

export const performanceImplementationTasks: ImplementationTask[] = [
  {
    id: 'perf-task-1',
    task: 'Complete Phase 2 unit renovations (Units 51-100)',
    status: 'in-progress',
    assignee: 'Construction Team',
    dueDate: '2024-03-31',
    priority: 'high'
  },
  {
    id: 'perf-task-2',
    task: 'Launch premium amenity marketing campaign',
    status: 'in-progress',
    assignee: 'Marketing Team',
    dueDate: '2024-02-15',
    priority: 'high'
  },
  {
    id: 'perf-task-3',
    task: 'Negotiate bulk utility rate reduction',
    status: 'completed',
    assignee: 'Operations Manager',
    dueDate: '2024-01-30',
    priority: 'medium'
  },
  {
    id: 'perf-task-4',
    task: 'Implement resident retention program',
    status: 'pending',
    assignee: 'Property Manager',
    dueDate: '2024-04-01',
    priority: 'medium'
  },
  {
    id: 'perf-task-5',
    task: 'Upgrade property management software',
    status: 'completed',
    assignee: 'IT Team',
    dueDate: '2024-01-15',
    priority: 'low'
  },
  {
    id: 'perf-task-6',
    task: 'Refinance analysis & preparation',
    status: 'pending',
    assignee: 'Finance Team',
    dueDate: '2024-06-30',
    priority: 'low'
  }
];

export const performanceOptimizations: {
  category: string;
  action: string;
  impact: string;
  status: 'implemented' | 'in-progress' | 'planned';
  annualSavings?: number;
}[] = [
  {
    category: 'Revenue',
    action: 'Implement dynamic pricing for renewals',
    impact: '+$125K annual NOI',
    status: 'implemented',
    annualSavings: 125000
  },
  {
    category: 'Revenue',
    action: 'Add premium parking & storage fees',
    impact: '+$48K annual NOI',
    status: 'implemented',
    annualSavings: 48000
  },
  {
    category: 'Expense',
    action: 'LED lighting retrofit (common areas)',
    impact: '-$32K annual utility costs',
    status: 'implemented',
    annualSavings: 32000
  },
  {
    category: 'Expense',
    action: 'Negotiate insurance & service contracts',
    impact: '-$55K annual expenses',
    status: 'in-progress',
    annualSavings: 55000
  },
  {
    category: 'Operations',
    action: 'Implement self-service maintenance portal',
    impact: 'Reduce response time by 40%',
    status: 'implemented'
  },
  {
    category: 'Revenue',
    action: 'Launch co-working space amenity ($50/mo)',
    impact: '+$60K annual NOI potential',
    status: 'planned',
    annualSavings: 60000
  }
];

export const performanceRiskFactors: RiskFactor[] = [
  {
    category: 'Market Risk',
    level: 'low',
    description: 'Market rents stabilizing but new supply concerns in 2025',
    mitigation: 'Strong occupancy and resident retention focus'
  },
  {
    category: 'Execution Risk',
    level: 'medium',
    description: 'Renovation timeline delayed by 2 months due to supply chain',
    mitigation: 'Adjusted timeline and reallocated crews to catch up'
  },
  {
    category: 'Exit Risk',
    level: 'medium',
    description: 'Cap rate compression limiting exit value potential',
    mitigation: 'Focus on NOI growth and alternative exit strategies'
  },
  {
    category: 'Operational Risk',
    level: 'low',
    description: 'Property management transition completed successfully',
    mitigation: 'Strong PM partnership and regular performance reviews'
  }
];

export const exitScenarios: {
  name: string;
  timing: string;
  exitCap: number;
  projectedNOI: number;
  salePrice: number;
  netProceeds: number;
  equityMultiple: number;
  irr: number;
}[] = [
  {
    name: 'Base Case',
    timing: 'Year 5 (2027)',
    exitCap: 5.8,
    projectedNOI: 3400000,
    salePrice: 58620000,
    netProceeds: 18250000,
    equityMultiple: 2.1,
    irr: 18.5
  },
  {
    name: 'Opportunistic',
    timing: 'Year 3 (2025)',
    exitCap: 5.5,
    projectedNOI: 3150000,
    salePrice: 57270000,
    netProceeds: 16850000,
    equityMultiple: 1.95,
    irr: 22.3
  },
  {
    name: 'Conservative',
    timing: 'Year 7 (2029)',
    exitCap: 6.2,
    projectedNOI: 3650000,
    salePrice: 58870000,
    netProceeds: 19200000,
    equityMultiple: 2.25,
    irr: 15.8
  }
];
