/**
 * Opus AI Context Data
 * Consolidated mock data from all 13 tabs for AI analysis
 */

import {
  CompetitionData,
  SupplyData,
  MarketData,
  DebtData,
  FinancialData,
  StrategyData,
  DueDiligenceData,
  TeamData,
  DocumentData
} from '../types/opus.types';

// Import from individual mock data files
import { 
  acquisitionComparables,
  performanceComparables,
  acquisitionPositioning,
  competitiveThreats
} from './competitionMockData';

import {
  acquisitionSupplyStats,
  acquisitionPipelineProjects,
  performanceSupplyStats,
  performancePipelineProjects
} from './supplyMockData';

import {
  acquisitionDemographics,
  acquisitionMarketTrends,
  acquisitionSwot,
  performanceMarketTrends,
  performanceSwot
} from './marketMockData';

import {
  currentRateEnvironment,
  acquisitionLenderQuotes,
  performanceLenderQuotes,
  debtServiceCalculation,
  refinanceOpportunities
} from './debtMockData';

import {
  acquisitionProForma,
  acquisitionReturnMetrics,
  acquisitionProjections,
  sensitivityAnalysis,
  performanceActuals,
  performanceMetrics,
  varianceAnalysis
} from './financialMockData';

import {
  strategyCards,
  acquisitionImplementationTasks,
  riskFactors,
  roiProjections
} from './strategyMockData';

import {
  acquisitionChecklist as dueDiligenceChecklist,
  acquisitionDDStats as phaseProgress,
  acquisitionInspections as recentFindings
} from './dueDiligenceMockData';

import {
  acquisitionTeamMembers as teamMembers,
  acquisitionCommunications as communications
} from './teamMockData';

import {
  acquisitionDocumentCategories as documentCategories,
  acquisitionDocuments as recentDocuments
} from './documentsMockData';

// ============================================================================
// Competition Data
// ============================================================================

export const competitionData: CompetitionData = {
  comps: acquisitionComparables.map(comp => ({
    address: comp.address,
    distance: comp.distance,
    propertyType: 'Multifamily',
    units: comp.units,
    squareFeet: comp.units * 850, // Estimated
    pricePerUnit: comp.pricePerUnit,
    capRate: comp.capRate,
    similarity: comp.similarityScore
  })),
  marketPosition: {
    marketRank: 'above-average',
    pricingCompetitiveness: 8, // Slightly above market
    demandLevel: 'high',
    absorptionRate: 6,
    vacancyRate: 5.2
  },
  competitiveAdvantages: [
    'Superior location with walkability score of 92',
    'Recently renovated units with modern finishes',
    'Below-market rents provide upside potential',
    'Strong property management reputation'
  ],
  competitiveDisadvantages: [
    'Limited on-site parking compared to newer competitors',
    'Smaller unit sizes than Class A properties',
    'Older building requires ongoing maintenance investment'
  ]
};

// ============================================================================
// Supply Data
// ============================================================================

export const supplyData: SupplyData = {
  pipelineProjects: acquisitionPipelineProjects.map(project => ({
    projectName: project.name,
    address: project.address,
    distance: project.distance,
    units: project.units,
    propertyType: 'Multifamily',
    status: project.status,
    expectedCompletion: project.deliveryDate,
    deliveryDate: project.deliveryDate,
    impactLevel: project.impactLevel
  })),
  impactAnalysis: {
    totalPipelineUnits: acquisitionSupplyStats.totalPipelineUnits,
    totalPipelineUnitsWithin3Miles: acquisitionSupplyStats.unitsWithin3Miles,
    expectedDeliveryNext12Months: acquisitionSupplyStats.unitsDelivering12Months,
    expectedDeliveryNext24Months: acquisitionSupplyStats.unitsDelivering12Months * 1.8,
    overallImpact: 'moderate',
    absorptionProjection: 14
  },
  recommendations: [
    'Monitor pipeline closely - 1,850 units within 3 miles may pressure rents',
    'Accelerate lease-up to capture demand before new supply delivers',
    'Differentiate through superior amenities and service',
    'Consider concessions strategy if absorption slows'
  ]
};

// ============================================================================
// Market Data
// ============================================================================

export const marketData: MarketData = {
  demographics: {
    population: 125000,
    medianIncome: 78500,
    medianAge: 34,
    employmentRate: 95.2,
    populationGrowth: 2.8,
    incomeGrowth: 4.2
  },
  trends: {
    rentGrowth: 5.2,
    valueAppreciation: 6.8,
    employmentGrowth: 3.5,
    constructionActivity: 'increasing',
    investorSentiment: 'bullish'
  },
  swot: {
    strengths: acquisitionSwot.filter(s => s.type === 'strength').map(s => s.title),
    weaknesses: acquisitionSwot.filter(s => s.type === 'weakness').map(s => s.title),
    opportunities: acquisitionSwot.filter(s => s.type === 'opportunity').map(s => s.title),
    threats: acquisitionSwot.filter(s => s.type === 'threat').map(s => s.title)
  }
};

// ============================================================================
// Debt Data
// ============================================================================

export const debtData: DebtData = {
  currentRates: {
    currentRate: 6.25,
    rateType: 'fixed',
    term: 10,
    spread: 225,
    indexRate: 4.0,
    marketTrend: 'stable'
  },
  lendingConditions: {
    maxLtv: 75,
    minDscr: 1.25,
    recourse: 'non-recourse',
    loanAmount: 15000000,
    amortization: 30,
    prepaymentPenalty: 'Step-down from 5% to 1% over 5 years',
    lenderAppetite: 'strong'
  },
  refinanceOpportunity: false,
  debtServiceCoverage: 1.42,
  recommendations: [
    'Current rate environment favorable for long-term fixed-rate debt',
    'Agency financing offers best terms with 75% LTV and non-recourse',
    'Lock rate within 30 days to capture current pricing',
    'Consider 10-year term to match anticipated hold period'
  ]
};

// ============================================================================
// Financial Data
// ============================================================================

export const financialData: FinancialData = {
  proForma: {
    revenue: {
      grossRent: 2400000,
      otherIncome: 120000,
      vacancy: -144000,
      effectiveGrossIncome: 2376000
    },
    expenses: {
      operating: 520000,
      propertyTax: 280000,
      insurance: 85000,
      maintenance: 120000,
      utilities: 95000,
      management: 71280,
      totalExpenses: 1171280
    },
    noi: 1204720,
    debtService: 852000,
    cashFlow: 352720
  },
  projections: acquisitionProjections.map(p => ({
    year: p.year,
    grossIncome: p.grossIncome,
    expenses: p.totalExpenses,
    noi: p.noi,
    debtService: p.debtService,
    cashFlow: p.cashFlow,
    cumulativeCashFlow: p.cumulativeCashFlow
  })),
  sensitivityAnalysis: sensitivityAnalysis.map(s => ({
    scenario: s.scenario,
    irr: s.irr,
    npv: s.npv,
    impact: s.description
  })),
  keyMetrics: {
    returnOnInvestment: acquisitionReturnMetrics.irr,
    paybackPeriod: 8.5,
    breakEvenOccupancy: 82
  }
};

// ============================================================================
// Strategy Data
// ============================================================================

export const strategyData: StrategyData = {
  primaryStrategy: {
    strategyType: strategyCards[0]?.title || 'Value-Add',
    description: strategyCards[0]?.description || 'Acquire below-market asset and implement value-add improvements',
    expectedReturn: roiProjections[0]?.roi || 18.5,
    riskLevel: 'medium',
    implementation: strategyCards[0]?.keyActions || [],
    timeline: '24-36 months'
  },
  alternativeStrategies: strategyCards.slice(1, 3).map(card => ({
    strategyType: card.title,
    description: card.description,
    expectedReturn: 15.0,
    riskLevel: 'medium',
    implementation: card.keyActions || [],
    timeline: card.timeline || '18-24 months'
  })),
  arbitrageOpportunities: [
    {
      type: 'market',
      description: 'Below-market rents provide immediate upside through rent optimization',
      potentialGain: 250000,
      probability: 85,
      requirements: ['Market analysis', 'Phased rent increases', 'Tenant communication']
    },
    {
      type: 'execution',
      description: 'Unit renovations can capture premium pricing',
      potentialGain: 180000,
      probability: 75,
      requirements: ['Capital investment', 'Renovation timeline', 'Temporary vacancy management']
    }
  ],
  recommendations: [
    'Focus on value-add strategy with proven ROI track record',
    'Implement rent optimization immediately upon acquisition',
    'Phase renovations to minimize vacancy impact',
    'Maintain conservative underwriting assumptions'
  ]
};

// ============================================================================
// Due Diligence Data
// ============================================================================

export const dueDiligenceData: DueDiligenceData = {
  checklistItems: dueDiligenceChecklist.map(item => ({
    category: item.category,
    item: item.task,
    status: item.status as any,
    priority: item.priority,
    findings: item.notes,
    concern: item.redFlag
  })),
  completionPercentage: phaseProgress.find(p => p.phase === 'Overall')?.completion || 68,
  redFlags: recentFindings.filter(f => f.severity === 'high').map(f => f.finding),
  documentsReviewed: 127,
  inspectionsCompleted: ['Property Inspection', 'Roof Inspection', 'HVAC Systems', 'Electrical']
};

// ============================================================================
// Team Data
// ============================================================================

export const teamData: TeamData = {
  teamMembers: teamMembers.map(member => ({
    name: member.name,
    role: member.role,
    company: member.company,
    email: member.email,
    phone: member.phone,
    involvement: 'primary' as const
  })),
  communications: {
    emailCount: communications.length,
    lastContact: communications[0]?.date || new Date().toISOString(),
    keyDecisions: communications.filter(c => c.category === 'decision').map(c => c.subject),
    openItems: communications.filter(c => c.status === 'open').map(c => c.subject),
    stakeholderSentiment: 'positive'
  }
};

// ============================================================================
// Documents Data
// ============================================================================

export const documentsData: DocumentData = {
  totalDocuments: documentCategories.reduce((sum, cat) => sum + cat.count, 0),
  categories: documentCategories.map(cat => ({
    category: cat.name,
    count: cat.count
  })),
  recentlyAdded: recentDocuments.slice(0, 5).map(doc => doc.name),
  missingDocuments: [
    'Phase II Environmental Report',
    'Updated Survey',
    'Final Title Commitment',
    'Estoppel Certificates (remaining units)'
  ]
};

export default {
  competitionData,
  supplyData,
  marketData,
  debtData,
  financialData,
  strategyData,
  dueDiligenceData,
  teamData,
  documentsData
};
