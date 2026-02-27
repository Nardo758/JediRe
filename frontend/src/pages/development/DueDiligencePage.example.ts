/**
 * Example Mock Data for Development Due Diligence Module
 * Use this for testing and development without backend integration
 */

import type {
  DueDiligenceState,
  ZoningAnalysis,
  EnvironmentalAssessment,
  GeotechnicalReport,
  UtilityCapacity,
  AssemblageDueDiligence,
  RiskMatrix,
  DDInsights,
} from '../../types/development/dueDiligence.types';

// Example Due Diligence State (Multi-Parcel Assemblage)
export const exampleDueDiligence: DueDiligenceState = {
  id: 'dd-001',
  dealId: 'deal-sunset-towers',
  overallProgress: 65,
  overallRisk: 'medium',
  criticalPathItem: 'North Parcel Environmental Phase II',
  lastUpdated: '2025-01-10T14:30:00Z',
  parcels: [
    {
      parcelId: 'parcel-main',
      address: '123 Main St',
      parcelType: 'main',
      progress: 85,
      title: { status: 'complete', completedDate: '2024-12-15' },
      survey: { status: 'complete', completedDate: '2024-12-20' },
      environmental: { status: 'complete', riskLevel: 'low' },
      geotechnical: { status: 'complete' },
      zoning: { status: 'complete' },
      utilities: { status: 'complete' },
    },
    {
      parcelId: 'parcel-north',
      address: '125 Main St',
      parcelType: 'adjacent',
      progress: 60,
      title: { status: 'complete', completedDate: '2025-01-05' },
      survey: { status: 'in_progress', dueDate: '2025-01-20' },
      environmental: { status: 'issue', riskLevel: 'high', notes: 'UST found, Phase II underway' },
      geotechnical: { status: 'in_progress' },
      zoning: { status: 'complete' },
      utilities: { status: 'in_progress' },
    },
    {
      parcelId: 'parcel-south',
      address: '121 Main St',
      parcelType: 'adjacent',
      progress: 40,
      title: { status: 'in_progress', dueDate: '2025-01-25' },
      survey: { status: 'in_progress' },
      environmental: { status: 'not_started' },
      geotechnical: { status: 'not_started' },
      zoning: { status: 'not_started', notes: 'Waiting on seller cooperation' },
      utilities: { status: 'not_started' },
    },
  ],
};

// Example Zoning Analysis with Upzoning Potential
export const exampleZoningAnalysis: ZoningAnalysis = {
  id: 'zoning-001',
  dealId: 'deal-sunset-towers',
  currentZoning: 'RM-4',
  byRightUnits: 180,
  byRightHeight: 85,
  byRightFAR: 4.0,
  communitySupport: 'mixed',
  councilMemberPosition: 'supportive',
  lastUpdated: '2025-01-08T10:00:00Z',
  upzoningPotential: {
    proposedZoning: 'RM-5',
    proposedUnits: 287,
    proposedHeight: 120,
    proposedFAR: 5.0,
    processTimeline: 8, // months
    successLikelihood: 75,
    estimatedCost: 180000,
    keyRequirements: [
      'Community meeting presentation',
      'Traffic impact study',
      'Affordable housing component (15% units)',
      'Design review board approval',
      'City council hearing and vote',
    ],
  },
};

// Example Environmental Assessments
export const exampleEnvironmental: EnvironmentalAssessment[] = [
  {
    id: 'env-main',
    dealId: 'deal-sunset-towers',
    parcelId: 'parcel-main',
    overallRisk: 'low',
    phaseI: {
      status: 'complete',
      completedDate: '2024-12-10',
      findings: 'clean',
      recognizedEnvironmentalConditions: [],
      phaseIIRequired: false,
      reportDocId: 'doc-phase1-main',
      cost: 7500,
    },
  },
  {
    id: 'env-north',
    dealId: 'deal-sunset-towers',
    parcelId: 'parcel-north',
    overallRisk: 'high',
    phaseI: {
      status: 'complete',
      completedDate: '2024-12-18',
      findings: 'rec',
      recognizedEnvironmentalConditions: [
        'Underground storage tank (UST) - 1,000 gallon gasoline',
        'Historic auto repair use (1950-1985)',
        'Potential soil contamination',
      ],
      phaseIIRequired: true,
      reportDocId: 'doc-phase1-north',
      cost: 8200,
    },
    phaseII: {
      status: 'in_progress',
      contaminantsFound: ['Benzene', 'Toluene', 'Xylene (BTEX)'],
      remediationRequired: true,
      estimatedCost: 45000,
      timeline: 6,
      cost: 45000,
    },
    remediation: {
      description: 'UST removal and soil excavation/disposal. Estimated 200 cubic yards contaminated soil.',
      estimatedCost: 125000,
      timeline: 8,
      impact: 'moderate',
      permitRequired: true,
      contractor: 'EnviroClean Solutions',
    },
  },
];

// Example Geotechnical Report
export const exampleGeotechnical: GeotechnicalReport[] = [
  {
    id: 'geo-main',
    dealId: 'deal-sunset-towers',
    parcelId: 'parcel-main',
    status: 'complete',
    completedDate: '2024-12-22',
    waterTableDepth: 18,
    reportDocId: 'doc-geo-main',
    cost: 12500,
    soilConditions: [
      { depthStart: 0, depthEnd: 15, description: 'Fill material - sandy clay', bearingCapacity: 1500 },
      { depthStart: 15, depthEnd: 25, description: 'Dense sand', bearingCapacity: 3000 },
      { depthStart: 25, depthEnd: 50, description: 'Bedrock - sandstone', bearingCapacity: 8000 },
    ],
    foundationRecommendation: {
      type: 'auger_cast_piles',
      depth: 30,
      costImpact: 850000,
      dewateringRequired: true,
      shoringRequired: true,
      specialRequirements: [
        'Dewatering system required during excavation',
        'Shoring for adjacent building protection',
        'Vibration monitoring during pile installation',
        'Bedrock socket minimum 5 feet',
      ],
    },
    specialConsiderations: [
      'Adjacent 3-story masonry building requires underpinning',
      'Water table at 18 feet requires dewatering pumps',
      'Historic building to south - vibration limits apply',
    ],
  },
];

// Example Utility Capacity
export const exampleUtilities: UtilityCapacity = {
  id: 'util-001',
  dealId: 'deal-sunset-towers',
  overallStatus: 'adequate',
  water: {
    available: true,
    mainSize: '12 inch',
    capacity: 'adequate',
    currentUtilization: 55,
    upgradeRequired: false,
    provider: 'City Water Department',
  },
  sewer: {
    available: true,
    mainSize: '24 inch',
    capacity: 'adequate',
    currentUtilization: 70,
    upgradeRequired: false,
    provider: 'City Wastewater',
    notes: 'Pre-treatment may be required for commercial kitchen discharge',
  },
  electric: {
    available: true,
    capacity: 'adequate',
    upgradeRequired: false,
    provider: 'Metro Power & Light',
    serviceVoltage: '4160V',
    substationDistance: 0.5,
    notes: 'Transformer vault required on-site',
  },
  gas: {
    available: true,
    mainSize: '6 inch',
    capacity: 'adequate',
    upgradeRequired: false,
    provider: 'City Gas',
  },
  telecom: {
    available: true,
    capacity: 'adequate',
    upgradeRequired: false,
    provider: 'Multiple fiber providers',
    notes: 'Fiber available from 3 providers',
  },
};

// Example Assemblage DD
export const exampleAssemblageDD: AssemblageDueDiligence = {
  id: 'assemblage-001',
  dealId: 'deal-sunset-towers',
  parcels: exampleDueDiligence.parcels,
  overallProgress: 65,
  criticalPathParcel: '125 Main St (North Parcel) - Environmental Phase II',
  closingStrategy: 'contingent',
  estimatedTotalCost: 28500000,
  synchronizationRisks: [
    'North parcel remediation may delay closing by 8-12 weeks',
    'South parcel owner unresponsive - may need to proceed without',
    'Simultaneous closings require complex escrow coordination',
    'Construction loan contingent on all parcels acquired',
  ],
};

// Example Risk Matrix
export const exampleRiskMatrix: RiskMatrix = {
  id: 'risk-001',
  dealId: 'deal-sunset-towers',
  overallRiskScore: 58,
  lastUpdated: '2025-01-10T15:00:00Z',
  risks: [
    {
      id: 'risk-1',
      category: 'environmental',
      description: 'North parcel contamination exceeds remediation budget',
      probability: 40,
      impact: 8,
      riskScore: 3.2,
      status: 'monitoring',
      mitigationPlan: 'Capped remediation cost at $200k in PSA. Negotiate price reduction if exceeded.',
      owner: 'Development Manager',
      createdDate: '2024-12-20',
      updatedDate: '2025-01-05',
    },
    {
      id: 'risk-2',
      category: 'entitlement',
      description: 'Upzoning denied - project limited to 180 units instead of 287',
      probability: 25,
      impact: 9,
      riskScore: 2.25,
      status: 'mitigating',
      mitigationPlan: 'Design flexibility for both scenarios. Community engagement campaign. Council member support secured.',
      owner: 'Entitlements Consultant',
      createdDate: '2024-11-15',
      updatedDate: '2025-01-08',
    },
    {
      id: 'risk-3',
      category: 'assemblage',
      description: 'South parcel owner refuses to sell - assemblage incomplete',
      probability: 35,
      impact: 7,
      riskScore: 2.45,
      status: 'monitoring',
      mitigationPlan: 'Project viable with just main + north parcels (220 units). South is bonus density.',
      owner: 'Acquisitions',
      createdDate: '2024-12-01',
      updatedDate: '2025-01-10',
    },
    {
      id: 'risk-4',
      category: 'geotechnical',
      description: 'Foundation costs exceed estimate due to bedrock depth variation',
      probability: 30,
      impact: 6,
      riskScore: 1.8,
      status: 'mitigating',
      mitigationPlan: '15% contingency built into foundation budget. Additional borings planned.',
      owner: 'Project Manager',
      createdDate: '2024-12-22',
    },
    {
      id: 'risk-5',
      category: 'financial',
      description: 'Interest rates rise before construction loan closing',
      probability: 50,
      impact: 5,
      riskScore: 2.5,
      status: 'accepted',
      mitigationPlan: 'Rate lock available at 7.5% for 90 days. Modeled returns at 8.5% worst case.',
      owner: 'CFO',
      createdDate: '2025-01-05',
    },
  ],
};

// Example AI Insights
export const exampleAIInsights: DDInsights = {
  confidence: 82,
  goNoGoRecommendation: 'proceed_with_caution',
  criticalRisks: [
    'North parcel environmental remediation may exceed budget by $75k-$150k',
    'Upzoning approval timeline extends project start by 6-9 months',
    'South parcel acquisition uncertain - owner not engaging',
    'Foundation costs +$850k above initial estimate',
    'Construction loan rate lock expires in 45 days',
  ],
  recommendedActions: [
    {
      priority: 'critical',
      action: 'Start Phase II Environmental on north parcel immediately',
      reasoning: 'This is the critical path item. Every week of delay pushes closing and construction start.',
      estimatedImpact: 'Saves 2-3 weeks on overall timeline',
    },
    {
      priority: 'high',
      action: 'Engage community early for upzoning support',
      reasoning: 'Mixed community sentiment. Early engagement improves success odds from 75% to 85%.',
      estimatedImpact: 'Increases upzoning probability +10%, worth ~$3.2M in additional unit value',
    },
    {
      priority: 'high',
      action: 'Design flexibility for 180 or 287 units',
      reasoning: 'Upzoning uncertain. Having both schemes ready allows fast pivot.',
      estimatedImpact: 'Eliminates 2-3 month redesign delay if upzoning denied',
    },
    {
      priority: 'medium',
      action: 'Update pro forma with actual foundation costs',
      reasoning: 'Current model has $3.2M foundation. Actual will be $4.05M based on geotech.',
      estimatedImpact: 'More accurate returns modeling',
    },
    {
      priority: 'medium',
      action: 'Set deadline for south parcel - drop if not responsive',
      reasoning: 'Project viable without south parcel. Don\'t let it delay the entire assemblage.',
      estimatedImpact: 'De-risks critical path timing',
    },
  ],
  timelineImpacts: [
    {
      item: 'North parcel Phase II ESA + Remediation',
      delayWeeks: 8,
      criticalPath: true,
      recommendation: 'Expedite Phase II. Consider premium pricing for faster turnaround.',
    },
    {
      item: 'Upzoning process',
      delayWeeks: 28,
      criticalPath: true,
      recommendation: 'Start pre-application meetings now. Engage consultant.',
    },
    {
      item: 'South parcel acquisition',
      delayWeeks: 4,
      criticalPath: false,
      recommendation: 'Set 30-day deadline. Proceed without if unresponsive.',
    },
  ],
  costImpacts: [
    {
      item: 'Foundation upgrade (auger cast piles)',
      costChange: 850000,
      category: 'hard_cost',
      recommendation: 'Increase hard cost budget. Consider value engineering on other items.',
    },
    {
      item: 'Environmental remediation (north parcel)',
      costChange: 125000,
      category: 'soft_cost',
      recommendation: 'Negotiate seller credit or price reduction.',
    },
    {
      item: 'Upzoning process (legal, consulting, studies)',
      costChange: 180000,
      category: 'soft_cost',
      recommendation: 'Budget approved. Worth it for +107 units.',
    },
  ],
};

// Helper function to mock API delay
export const mockApiDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API responses
export const mockDDApi = {
  async getDueDiligence(dealId: string) {
    await mockApiDelay();
    return { success: true, data: exampleDueDiligence };
  },

  async getZoningAnalysis(dealId: string) {
    await mockApiDelay();
    return { success: true, data: exampleZoningAnalysis };
  },

  async getEnvironmental(dealId: string) {
    await mockApiDelay();
    return { success: true, data: exampleEnvironmental };
  },

  async getGeotechnical(dealId: string) {
    await mockApiDelay();
    return { success: true, data: exampleGeotechnical };
  },

  async getUtilities(dealId: string) {
    await mockApiDelay();
    return { success: true, data: exampleUtilities };
  },

  async getAssemblageDD(dealId: string) {
    await mockApiDelay();
    return { success: true, data: exampleAssemblageDD };
  },

  async getRiskMatrix(dealId: string) {
    await mockApiDelay();
    return { success: true, data: exampleRiskMatrix };
  },

  async generateAIInsights(dealId: string) {
    await mockApiDelay(1000); // AI takes longer
    return { success: true, data: exampleAIInsights };
  },
};
