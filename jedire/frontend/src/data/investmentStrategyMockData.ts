/**
 * Investment Strategy Module - Unified Mock Data
 * Consolidates Strategy + Exit planning into single comprehensive view
 */

import { Deal } from '../types/deal';

// ==================== TYPE DEFINITIONS ====================

export interface InvestmentStrategyOverview {
  strategyType: 'value-add' | 'core-plus' | 'opportunistic' | 'core';
  holdPeriod: number; // years
  currentPhase: 'entry' | 'value-creation' | 'exit-prep' | 'exit';
  projectedROI: number;
  projectedExitValue: number;
  acquisitionDate?: string;
  targetExitDate: string;
}

export interface StrategyTimeline {
  phase: 'Entry' | 'Value Creation' | 'Exit';
  status: 'completed' | 'active' | 'upcoming';
  startDate: string;
  endDate: string;
  progress: number; // 0-100
  keyMilestones: string[];
}

export interface AcquisitionStrategy {
  strategyType: string;
  targetIRR: number;
  investmentThesis: string;
  capexBudget: number;
  timeToStabilize: string;
  keyValueDrivers: string[];
  competitiveAdvantage: string[];
}

export interface ValueCreationPlan {
  initiatives: ValueCreationInitiative[];
  totalProjectedLift: number; // NOI increase
  implementationStatus: {
    completed: number;
    inProgress: number;
    planned: number;
  };
}

export interface ValueCreationInitiative {
  id: string;
  category: 'Revenue' | 'Operations' | 'Capex' | 'Positioning';
  action: string;
  impact: string;
  status: 'completed' | 'in-progress' | 'planned';
  timeline: string;
  annualImpact?: number;
}

export interface ExitStrategy {
  targetTiming: string;
  exitVehicles: string[];
  marketReadiness: number; // 0-100
  preparationStatus: {
    property: number;
    financials: number;
    marketing: number;
    legal: number;
  };
  scenarios: ExitScenario[];
  recommendedBrokers?: BrokerRecommendation[];
}

export interface ExitScenario {
  id: string;
  name: string;
  type: 'sale' | 'refinance' | 'hold';
  timing: string;
  exitCap: number;
  projectedNOI: number;
  salePrice?: number;
  refinanceAmount?: number;
  cashOut?: number;
  equityMultiple?: number;
  irr: number;
  probability: 'high' | 'medium' | 'low';
  description: string;
  keyAssumptions: string[];
}

export interface BrokerRecommendation {
  id: string;
  brokerName: string;
  firm: string;
  specialty: string;
  rating: number;
  recentSales: number;
  avgDaysOnMarket: number;
  avgPricePremium: number;
  pros: string[];
  cons: string[];
}

export interface RiskFactor {
  category: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
  impact: 'minor' | 'moderate' | 'major';
}

// ==================== MOCK DATA GENERATORS ====================

/**
 * Get Investment Strategy Overview
 */
export function getInvestmentStrategyOverview(deal: Deal): InvestmentStrategyOverview {
  const isPipeline = !deal.actualCloseDate;
  const isValueAdd = deal.name?.toLowerCase().includes('value') || true;
  
  if (isPipeline) {
    return {
      strategyType: isValueAdd ? 'value-add' : 'core-plus',
      holdPeriod: isValueAdd ? 5 : 7,
      currentPhase: 'entry',
      projectedROI: isValueAdd ? 85 : 45,
      projectedExitValue: 43500000,
      targetExitDate: new Date(Date.now() + (isValueAdd ? 5 : 7) * 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  
  // Assets Owned
  const acquisitionDate = deal.actualCloseDate || deal.createdAt;
  const monthsOwned = Math.floor((Date.now() - new Date(acquisitionDate).getTime()) / (30 * 24 * 60 * 60 * 1000));
  const currentPhase: 'entry' | 'value-creation' | 'exit-prep' | 'exit' = 
    monthsOwned < 6 ? 'entry' :
    monthsOwned < 48 ? 'value-creation' :
    monthsOwned < 60 ? 'exit-prep' : 'exit';
  
  return {
    strategyType: 'value-add',
    holdPeriod: 5,
    currentPhase,
    projectedROI: 85,
    projectedExitValue: 43500000,
    acquisitionDate,
    targetExitDate: new Date(new Date(acquisitionDate).getTime() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Get Strategy Timeline (Entry → Value → Exit)
 */
export function getStrategyTimeline(deal: Deal): StrategyTimeline[] {
  const isPipeline = !deal.actualCloseDate;
  const overview = getInvestmentStrategyOverview(deal);
  
  const acquisitionDate = overview.acquisitionDate || new Date().toISOString();
  const acqDate = new Date(acquisitionDate);
  
  const entry: StrategyTimeline = {
    phase: 'Entry',
    status: isPipeline ? 'active' : 'completed',
    startDate: isPipeline ? new Date().toISOString() : acquisitionDate,
    endDate: new Date(acqDate.getTime() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    progress: isPipeline ? 45 : 100,
    keyMilestones: [
      'Property acquisition closed',
      'Renovation plans finalized',
      'Capital deployment begun',
      'Initial tenant communications'
    ]
  };
  
  const valueCreation: StrategyTimeline = {
    phase: 'Value Creation',
    status: isPipeline ? 'upcoming' : overview.currentPhase === 'value-creation' ? 'active' : overview.currentPhase === 'entry' ? 'upcoming' : 'completed',
    startDate: new Date(acqDate.getTime() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(acqDate.getTime() + 48 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    progress: isPipeline ? 0 : overview.currentPhase === 'value-creation' ? 60 : overview.currentPhase === 'entry' ? 0 : 100,
    keyMilestones: [
      'Unit renovations completed',
      'NOI stabilization achieved',
      'Occupancy targets met',
      'Operating efficiency optimized'
    ]
  };
  
  const exit: StrategyTimeline = {
    phase: 'Exit',
    status: isPipeline ? 'upcoming' : ['exit-prep', 'exit'].includes(overview.currentPhase) ? 'active' : 'upcoming',
    startDate: new Date(acqDate.getTime() + 48 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(acqDate.getTime() + 60 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    progress: isPipeline ? 0 : overview.currentPhase === 'exit-prep' ? 50 : overview.currentPhase === 'exit' ? 90 : 0,
    keyMilestones: [
      'Market analysis completed',
      'Broker selection finalized',
      'Marketing materials prepared',
      'Transaction closed'
    ]
  };
  
  return [entry, valueCreation, exit];
}

/**
 * Get Acquisition Strategy (Pipeline focus)
 */
export function getAcquisitionStrategy(deal: Deal): AcquisitionStrategy {
  return {
    strategyType: 'Value-Add Multifamily',
    targetIRR: 22.5,
    investmentThesis: 'Acquire under-managed Class B property in high-growth submarket. Execute interior renovations to achieve premium rents and drive NOI growth through operational improvements.',
    capexBudget: 3250000,
    timeToStabilize: '18-24 months',
    keyValueDrivers: [
      'Unit interior upgrades (+$200/unit/month)',
      'Common area modernization',
      'Operational efficiency improvements',
      'Improved tenant services and retention'
    ],
    competitiveAdvantage: [
      'Off-market acquisition below replacement cost',
      'Strong submarket rent growth (8% YoY)',
      'Proven renovation playbook',
      'Experienced property management partner'
    ]
  };
}

/**
 * Get Value Creation Plan
 */
export function getValueCreationPlan(deal: Deal): ValueCreationPlan {
  const isPipeline = !deal.actualCloseDate;
  
  const initiatives: ValueCreationInitiative[] = [
    {
      id: 'rev-1',
      category: 'Revenue',
      action: 'Unit Interior Renovations',
      impact: '+$200/unit/month (175 units)',
      status: isPipeline ? 'planned' : 'in-progress',
      timeline: '18 months',
      annualImpact: 420000
    },
    {
      id: 'rev-2',
      category: 'Revenue',
      action: 'Implement Utility Billing (RUBS)',
      impact: '+$50/unit/month utility recovery',
      status: isPipeline ? 'planned' : 'completed',
      timeline: '3 months',
      annualImpact: 105000
    },
    {
      id: 'ops-1',
      category: 'Operations',
      action: 'Property Management Transition',
      impact: 'Reduce OpEx by 12%',
      status: isPipeline ? 'planned' : 'completed',
      timeline: '2 months',
      annualImpact: 85000
    },
    {
      id: 'ops-2',
      category: 'Operations',
      action: 'Energy Efficiency Upgrades',
      impact: 'Reduce utility costs 15%',
      status: isPipeline ? 'planned' : 'in-progress',
      timeline: '12 months',
      annualImpact: 45000
    },
    {
      id: 'cap-1',
      category: 'Capex',
      action: 'Common Area Renovation',
      impact: 'Improved curb appeal, retention',
      status: isPipeline ? 'planned' : 'completed',
      timeline: '6 months',
      annualImpact: 35000
    },
    {
      id: 'pos-1',
      category: 'Positioning',
      action: 'Rebranding & Marketing',
      impact: 'Premium positioning, reduced vacancy',
      status: isPipeline ? 'planned' : 'in-progress',
      timeline: '9 months',
      annualImpact: 60000
    }
  ];
  
  const status = isPipeline ? {
    completed: 0,
    inProgress: 0,
    planned: 6
  } : {
    completed: 3,
    inProgress: 2,
    planned: 1
  };
  
  return {
    initiatives,
    totalProjectedLift: 750000, // Total annual NOI increase
    implementationStatus: status
  };
}

/**
 * Get Exit Strategy
 */
export function getExitStrategy(deal: Deal): ExitStrategy {
  const isPipeline = !deal.actualCloseDate;
  const overview = getInvestmentStrategyOverview(deal);
  
  // Market readiness based on phase
  const marketReadiness = 
    overview.currentPhase === 'entry' ? 25 :
    overview.currentPhase === 'value-creation' ? 60 :
    overview.currentPhase === 'exit-prep' ? 85 : 95;
  
  const preparationStatus = isPipeline ? {
    property: 30,
    financials: 40,
    marketing: 20,
    legal: 35
  } : {
    property: 85,
    financials: 90,
    marketing: 75,
    legal: 80
  };
  
  const scenarios: ExitScenario[] = [
    {
      id: 'base-sale',
      name: 'Base Case Sale',
      type: 'sale',
      timing: 'Year 5 (Q4 2029)',
      exitCap: 5.25,
      projectedNOI: 2283750,
      salePrice: 43500000,
      equityMultiple: 2.1,
      irr: 22.5,
      probability: 'high',
      description: 'Sale to institutional buyer at stabilized NOI and market cap rate',
      keyAssumptions: [
        'Full stabilization achieved',
        'Cap rate compression continues',
        'Strong buyer demand for stabilized assets',
        'Completed renovation program'
      ]
    },
    {
      id: 'early-exit',
      name: 'Opportunistic Early Exit',
      type: 'sale',
      timing: 'Year 3 (Q2 2027)',
      exitCap: 5.5,
      projectedNOI: 1950000,
      salePrice: 35500000,
      equityMultiple: 1.6,
      irr: 18.2,
      probability: 'medium',
      description: 'Early sale if market conditions exceptional or buyer premium offered',
      keyAssumptions: [
        'Partial stabilization (70% complete)',
        'Cap rates compress further',
        'Premium buyer emerges',
        'Opportunity cost justified'
      ]
    },
    {
      id: 'refi-hold',
      name: 'Refinance & Hold',
      type: 'refinance',
      timing: 'Year 4 (Q1 2028)',
      exitCap: 5.0,
      projectedNOI: 2150000,
      refinanceAmount: 30100000,
      cashOut: 8600000,
      irr: 24.8,
      probability: 'medium',
      description: 'Cash-out refinance to return capital while maintaining ownership',
      keyAssumptions: [
        'Stabilized operations',
        'Favorable debt markets',
        'Strong cash flow supports debt service',
        'Long-term hold strategy preferred'
      ]
    }
  ];
  
  const brokers: BrokerRecommendation[] = isPipeline ? [] : [
    {
      id: 'broker-1',
      brokerName: 'Marcus & Millichap',
      firm: 'Marcus & Millichap',
      specialty: 'Southeast Multifamily',
      rating: 4.5,
      recentSales: 28,
      avgDaysOnMarket: 87,
      avgPricePremium: 3.2,
      pros: [
        'Largest multifamily brokerage network',
        'Strong institutional buyer relationships',
        'Proven track record in market'
      ],
      cons: [
        'Higher fee structure',
        'Less personalized service at scale'
      ]
    },
    {
      id: 'broker-2',
      brokerName: 'CBRE Multifamily',
      firm: 'CBRE',
      specialty: 'Institutional Multifamily',
      rating: 4.7,
      recentSales: 19,
      avgDaysOnMarket: 72,
      avgPricePremium: 4.1,
      pros: [
        'Global reach and buyer network',
        'Excellent marketing materials',
        'Strong analytical capabilities'
      ],
      cons: [
        'Minimum deal size preferences',
        'Longer marketing timelines'
      ]
    },
    {
      id: 'broker-3',
      brokerName: 'JLL Capital Markets',
      firm: 'JLL',
      specialty: 'Value-Add Multifamily',
      rating: 4.6,
      recentSales: 15,
      avgDaysOnMarket: 79,
      avgPricePremium: 3.8,
      pros: [
        'Excellent for value-add stories',
        'Strong private equity relationships',
        'Innovative marketing approaches'
      ],
      cons: [
        'Smaller local presence',
        'Can be selective on assignments'
      ]
    }
  ];
  
  return {
    targetTiming: overview.targetExitDate,
    exitVehicles: ['Direct Sale', 'Cash-Out Refinance', '1031 Exchange'],
    marketReadiness,
    preparationStatus,
    scenarios,
    recommendedBrokers: brokers
  };
}

/**
 * Get Risk Factors
 */
export function getRiskFactors(deal: Deal): RiskFactor[] {
  const isPipeline = !deal.actualCloseDate;
  
  if (isPipeline) {
    return [
      {
        category: 'Market Risk',
        level: 'medium',
        description: 'Market rent growth may not meet projections',
        mitigation: 'Conservative underwriting at 3% annual growth vs 5-8% market projections',
        impact: 'moderate'
      },
      {
        category: 'Execution Risk',
        level: 'medium',
        description: 'Renovation timeline or budget could be exceeded',
        mitigation: '15% contingency budget and proven GC partnership',
        impact: 'moderate'
      },
      {
        category: 'Financing Risk',
        level: 'low',
        description: 'Interest rate increases impacting returns',
        mitigation: 'Fixed-rate financing and conservative debt load (65% LTV)',
        impact: 'minor'
      },
      {
        category: 'Exit Risk',
        level: 'low',
        description: 'Cap rate expansion at exit reducing proceeds',
        mitigation: 'Multiple exit scenarios modeled, 7-year hold optionality',
        impact: 'moderate'
      }
    ];
  }
  
  // Assets Owned
  return [
    {
      category: 'Operational Risk',
      level: 'low',
      description: 'Property performing above projections, minimal risk',
      mitigation: 'Strong property management and leasing momentum',
      impact: 'minor'
    },
    {
      category: 'Market Risk',
      level: 'medium',
      description: 'Market cap rates could expand before planned exit',
      mitigation: 'Monitor market conditions, flexible exit timing',
      impact: 'moderate'
    },
    {
      category: 'Execution Risk',
      level: 'low',
      description: 'Remaining renovations on schedule and on budget',
      mitigation: 'Proven processes and experienced team',
      impact: 'minor'
    },
    {
      category: 'Exit Timing Risk',
      level: 'medium',
      description: 'Market window may not align with target exit date',
      mitigation: 'Multiple exit options including refinance and extended hold',
      impact: 'moderate'
    }
  ];
}

// ==================== QUICK STATS ====================

export interface InvestmentStrategyQuickStat {
  icon: string;
  label: string;
  value: number | string;
  format: 'currency' | 'percentage' | 'years' | 'number' | 'text';
  subtext?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

export function getInvestmentStrategyQuickStats(deal: Deal): InvestmentStrategyQuickStat[] {
  const overview = getInvestmentStrategyOverview(deal);
  const isPipeline = !deal.actualCloseDate;
  
  if (isPipeline) {
    return [
      {
        icon: '🎯',
        label: 'Strategy Type',
        value: overview.strategyType === 'value-add' ? 'Value-Add' : 'Core-Plus',
        format: 'text'
      },
      {
        icon: '💰',
        label: 'Target IRR',
        value: 22.5,
        format: 'percentage',
        trend: { direction: 'up', value: '+2.5%' }
      },
      {
        icon: '⏱️',
        label: 'Hold Period',
        value: overview.holdPeriod,
        format: 'years'
      },
      {
        icon: '📈',
        label: 'Projected ROI',
        value: overview.projectedROI,
        format: 'percentage',
        subtext: 'Total return'
      },
      {
        icon: '🏆',
        label: 'Exit Value',
        value: overview.projectedExitValue,
        format: 'currency',
        subtext: 'Base case'
      }
    ];
  }
  
  // Assets Owned
  const monthsOwned = Math.floor((Date.now() - new Date(overview.acquisitionDate!).getTime()) / (30 * 24 * 60 * 60 * 1000));
  const progressPct = Math.min(100, (monthsOwned / (overview.holdPeriod * 12)) * 100);
  
  return [
    {
      icon: '📊',
      label: 'Current Phase',
      value: overview.currentPhase === 'entry' ? 'Entry' :
             overview.currentPhase === 'value-creation' ? 'Value Creation' :
             overview.currentPhase === 'exit-prep' ? 'Exit Prep' : 'Exit',
      format: 'text'
    },
    {
      icon: '⏱️',
      label: 'Months Owned',
      value: monthsOwned,
      format: 'number',
      subtext: `${Math.round(progressPct)}% through hold`
    },
    {
      icon: '💰',
      label: 'Current IRR',
      value: 24.2,
      format: 'percentage',
      trend: { direction: 'up', value: '+1.7%' }
    },
    {
      icon: '📈',
      label: 'Value Lift',
      value: 28,
      format: 'percentage',
      subtext: 'Since acquisition',
      trend: { direction: 'up', value: '+$8.5M' }
    },
    {
      icon: '🎯',
      label: 'Exit Readiness',
      value: overview.currentPhase === 'entry' ? 25 :
             overview.currentPhase === 'value-creation' ? 60 :
             overview.currentPhase === 'exit-prep' ? 85 : 95,
      format: 'percentage',
      subtext: 'Market ready'
    }
  ];
}
