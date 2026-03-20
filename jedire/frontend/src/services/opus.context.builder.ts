/**
 * Opus Context Builder
 * 
 * Helper utilities for building OpusDealContext from existing deal data
 * Map your Deal type to the Opus data contract
 */

import type {
  OpusDealContext,
  OverviewData,
  CompetitionData,
  SupplyData,
  DebtData,
  FinancialData,
  StrategyData,
  DueDiligenceData,
  MarketData,
  TeamData,
  DocumentData
} from '../types/opus.types';

/**
 * Build complete Opus deal context from your Deal object
 * 
 * @param deal - Your deal object
 * @param options - Optional additional data from tabs
 * @returns Complete OpusDealContext ready for analysis
 */
export function buildOpusContext(
  deal: any,
  options?: {
    comps?: any[];
    supplyProjects?: any[];
    debtInfo?: any;
    proForma?: any;
    strategies?: any[];
    ddChecklist?: any[];
    marketData?: any;
    teamMembers?: any[];
    documents?: any[];
  }
): OpusDealContext {
  const context: OpusDealContext = {
    dealId: deal.id,
    dealName: deal.name,
    status: determineDealStatus(deal),
    
    // Always include overview if possible
    overview: buildOverviewData(deal),
    
    // Add optional tab data if provided
    competition: options?.comps ? buildCompetitionData(options.comps) : undefined,
    supply: options?.supplyProjects ? buildSupplyData(options.supplyProjects) : undefined,
    debt: options?.debtInfo ? buildDebtData(options.debtInfo) : undefined,
    financial: options?.proForma ? buildFinancialData(options.proForma) : undefined,
    strategy: options?.strategies ? buildStrategyData(options.strategies) : undefined,
    dueDiligence: options?.ddChecklist ? buildDueDiligenceData(options.ddChecklist) : undefined,
    market: options?.marketData ? buildMarketData(options.marketData) : undefined,
    team: options?.teamMembers ? buildTeamData(options.teamMembers) : undefined,
    documents: options?.documents ? buildDocumentData(options.documents) : undefined,
    
    lastUpdated: new Date().toISOString(),
    dataCompleteness: calculateDataCompleteness(context),
    analysisVersion: '1.0'
  };

  return context;
}

/**
 * Determine if deal is pipeline or owned
 */
function determineDealStatus(deal: any): 'pipeline' | 'owned' {
  // Customize based on your deal status fields
  const ownedStates = ['EXECUTION', 'POST_CLOSE', 'owned'];
  const status = deal.status || deal.state || '';
  
  return ownedStates.some(s => status.includes(s)) ? 'owned' : 'pipeline';
}

/**
 * Build Overview data from deal
 */
function buildOverviewData(deal: any): OverviewData | undefined {
  try {
    return {
      propertySpecs: {
        address: deal.propertyAddress || deal.address || 'Unknown',
        propertyType: deal.projectType || deal.propertyType || deal.dealCategory || 'Unknown',
        units: deal.targetUnits || deal.units,
        squareFeet: deal.squareFeet || deal.sqft,
        yearBuilt: deal.yearBuilt,
        lotSize: deal.acres ? deal.acres * 43560 : deal.lotSizeSqft,
        zoning: deal.zoning || deal.districtCode,
        condition: deal.condition,
        occupancy: deal.occupancy
      },
      metrics: {
        purchasePrice: deal.dealValue || deal.purchasePrice,
        currentValue: deal.currentValue,
        askingPrice: deal.askingPrice,
        projectedValue: deal.projectedValue,
        capRate: deal.capRate,
        cashOnCash: deal.cashOnCash,
        irr: deal.irr,
        equity: deal.equity,
        debt: deal.debt,
        ltv: deal.ltv
      },
      location: deal.boundary?.center ? {
        lat: deal.boundary.center.lat,
        lng: deal.boundary.center.lng,
        city: deal.city || '',
        state: deal.state || '',
        zip: deal.zip || '',
        neighborhood: deal.neighborhood
      } : undefined
    };
  } catch (error) {
    console.warn('Failed to build overview data:', error);
    return undefined;
  }
}

/**
 * Build Competition data from comps
 */
function buildCompetitionData(comps: any[]): CompetitionData | undefined {
  try {
    return {
      comps: comps.map(comp => ({
        address: comp.address || '',
        distance: comp.distance || 0,
        propertyType: comp.propertyType || comp.type || '',
        units: comp.units,
        squareFeet: comp.sqft || comp.squareFeet,
        salePrice: comp.salePrice || comp.price,
        saleDate: comp.saleDate || comp.date,
        pricePerUnit: comp.pricePerUnit || (comp.price && comp.units ? comp.price / comp.units : undefined),
        pricePerSqFt: comp.pricePerSqFt || (comp.price && comp.sqft ? comp.price / comp.sqft : undefined),
        capRate: comp.capRate,
        similarity: comp.similarity || comp.comparableScore || 50
      })),
      marketPosition: {
        pricingCompetitiveness: calculatePricingCompetitiveness(comps),
        demandLevel: determineDemandLevel(comps),
        vacancyRate: calculateAvgVacancy(comps),
        absorptionRate: calculateAbsorptionRate(comps)
      }
    };
  } catch (error) {
    console.warn('Failed to build competition data:', error);
    return undefined;
  }
}

/**
 * Build Supply data from pipeline projects
 */
function buildSupplyData(projects: any[]): SupplyData | undefined {
  try {
    const pipelineProjects = projects.map(p => ({
      projectName: p.name || p.projectName || 'Unnamed Project',
      address: p.address || '',
      distance: p.distance || 0,
      units: p.units || p.targetUnits || 0,
      propertyType: p.propertyType || p.type || '',
      status: mapSupplyStatus(p.status),
      expectedCompletion: p.expectedCompletion || p.deliveryDate,
      deliveryDate: p.deliveryDate,
      impactLevel: determineImpactLevel(p)
    }));

    const totalUnits = pipelineProjects.reduce((sum, p) => sum + p.units, 0);
    const unitsWithin3Miles = pipelineProjects.filter(p => p.distance <= 3).reduce((sum, p) => sum + p.units, 0);

    return {
      pipelineProjects,
      impactAnalysis: {
        totalPipelineUnits: totalUnits,
        totalPipelineUnitsWithin3Miles: unitsWithin3Miles,
        expectedDeliveryNext12Months: calculateDelivery(pipelineProjects, 12),
        expectedDeliveryNext24Months: calculateDelivery(pipelineProjects, 24),
        overallImpact: determineOverallSupplyImpact(unitsWithin3Miles),
        absorptionProjection: calculateAbsorption(unitsWithin3Miles)
      }
    };
  } catch (error) {
    console.warn('Failed to build supply data:', error);
    return undefined;
  }
}

/**
 * Build Debt market data
 */
function buildDebtData(debtInfo: any): DebtData | undefined {
  try {
    return {
      currentRates: {
        currentRate: debtInfo.currentRate || debtInfo.rate,
        rateType: debtInfo.rateType || 'fixed',
        term: debtInfo.term,
        spread: debtInfo.spread,
        indexRate: debtInfo.indexRate,
        marketTrend: debtInfo.marketTrend || 'stable'
      },
      lendingConditions: {
        maxLtv: debtInfo.maxLtv || debtInfo.ltv,
        minDscr: debtInfo.minDscr || debtInfo.dscr,
        recourse: debtInfo.recourse || 'non-recourse',
        loanAmount: debtInfo.loanAmount,
        amortization: debtInfo.amortization,
        prepaymentPenalty: debtInfo.prepaymentPenalty,
        lenderAppetite: debtInfo.lenderAppetite || 'moderate'
      },
      refinanceOpportunity: debtInfo.refinanceOpportunity,
      debtServiceCoverage: debtInfo.debtServiceCoverage || debtInfo.dscr
    };
  } catch (error) {
    console.warn('Failed to build debt data:', error);
    return undefined;
  }
}

/**
 * Build Financial data from pro forma
 */
function buildFinancialData(proForma: any): FinancialData | undefined {
  try {
    return {
      proForma: {
        revenue: {
          grossRent: proForma.grossRent || proForma.revenue?.grossRent,
          otherIncome: proForma.otherIncome || proForma.revenue?.other,
          vacancy: proForma.vacancy || proForma.revenue?.vacancy,
          effectiveGrossIncome: proForma.egi || proForma.effectiveGrossIncome
        },
        expenses: {
          operating: proForma.opex || proForma.expenses?.operating,
          propertyTax: proForma.propertyTax || proForma.expenses?.propertyTax,
          insurance: proForma.insurance || proForma.expenses?.insurance,
          maintenance: proForma.maintenance || proForma.expenses?.maintenance,
          utilities: proForma.utilities || proForma.expenses?.utilities,
          management: proForma.management || proForma.expenses?.management,
          totalExpenses: proForma.totalExpenses || proForma.expenses?.total
        },
        noi: proForma.noi,
        debtService: proForma.debtService,
        cashFlow: proForma.cashFlow || proForma.netCashFlow
      },
      projections: proForma.projections,
      sensitivityAnalysis: proForma.sensitivityAnalysis
    };
  } catch (error) {
    console.warn('Failed to build financial data:', error);
    return undefined;
  }
}

/**
 * Build Strategy data
 */
function buildStrategyData(strategies: any[]): StrategyData | undefined {
  try {
    return {
      primaryStrategy: strategies[0] ? {
        strategyType: strategies[0].type || strategies[0].strategyType,
        description: strategies[0].description,
        expectedReturn: strategies[0].expectedReturn || strategies[0].irr,
        riskLevel: strategies[0].riskLevel || 'medium',
        implementation: strategies[0].implementation || strategies[0].steps || [],
        timeline: strategies[0].timeline
      } : undefined,
      alternativeStrategies: strategies.slice(1).map(s => ({
        strategyType: s.type || s.strategyType,
        description: s.description,
        expectedReturn: s.expectedReturn || s.irr,
        riskLevel: s.riskLevel || 'medium',
        implementation: s.implementation || s.steps || [],
        timeline: s.timeline
      }))
    };
  } catch (error) {
    console.warn('Failed to build strategy data:', error);
    return undefined;
  }
}

/**
 * Build Due Diligence data
 */
function buildDueDiligenceData(checklist: any[]): DueDiligenceData | undefined {
  try {
    const items = checklist.map(item => ({
      category: item.category || 'General',
      item: item.item || item.name || item.description,
      status: item.status || 'pending',
      priority: item.priority || 'medium',
      findings: item.findings || item.notes,
      concern: item.concern || item.redFlag
    }));

    const completedCount = items.filter(i => i.status === 'complete').length;
    const completionPercentage = items.length > 0 ? (completedCount / items.length) * 100 : 0;
    const redFlags = items.filter(i => i.concern).map(i => i.findings || i.item);

    return {
      checklistItems: items,
      completionPercentage,
      redFlags,
      documentsReviewed: items.filter(i => i.status === 'complete').length,
      inspectionsCompleted: items.filter(i => i.category?.includes('Inspection') && i.status === 'complete').map(i => i.item)
    };
  } catch (error) {
    console.warn('Failed to build DD data:', error);
    return undefined;
  }
}

/**
 * Build Market data
 */
function buildMarketData(marketData: any): MarketData | undefined {
  try {
    return {
      demographics: marketData.demographics ? {
        population: marketData.demographics.population,
        medianIncome: marketData.demographics.medianIncome,
        medianAge: marketData.demographics.medianAge,
        employmentRate: marketData.demographics.employmentRate,
        populationGrowth: marketData.demographics.populationGrowth,
        incomeGrowth: marketData.demographics.incomeGrowth
      } : undefined,
      trends: marketData.trends ? {
        rentGrowth: marketData.trends.rentGrowth,
        valueAppreciation: marketData.trends.valueAppreciation,
        employmentGrowth: marketData.trends.employmentGrowth,
        constructionActivity: marketData.trends.constructionActivity,
        investorSentiment: marketData.trends.investorSentiment
      } : undefined,
      swot: marketData.swot
    };
  } catch (error) {
    console.warn('Failed to build market data:', error);
    return undefined;
  }
}

/**
 * Build Team data
 */
function buildTeamData(teamMembers: any[]): TeamData | undefined {
  try {
    return {
      teamMembers: teamMembers.map(m => ({
        name: m.name || '',
        role: m.role || '',
        company: m.company,
        email: m.email,
        phone: m.phone,
        involvement: m.involvement || 'supporting'
      })),
      communications: {
        emailCount: 0, // Would come from email integration
        keyDecisions: [],
        openItems: []
      }
    };
  } catch (error) {
    console.warn('Failed to build team data:', error);
    return undefined;
  }
}

/**
 * Build Document data
 */
function buildDocumentData(documents: any[]): DocumentData | undefined {
  try {
    const categories = documents.reduce((acc: any, doc) => {
      const cat = doc.category || 'Other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    return {
      totalDocuments: documents.length,
      categories: Object.entries(categories).map(([category, count]) => ({
        category,
        count: count as number
      })),
      recentlyAdded: documents.slice(-5).map(d => d.name || d.filename)
    };
  } catch (error) {
    console.warn('Failed to build document data:', error);
    return undefined;
  }
}

// Helper calculation functions
function calculateDataCompleteness(context: OpusDealContext): number {
  const sections = [
    context.overview,
    context.competition,
    context.supply,
    context.debt,
    context.financial,
    context.strategy,
    context.dueDiligence,
    context.market,
    context.team,
    context.documents
  ];
  
  const completedSections = sections.filter(s => s !== undefined).length;
  return Math.round((completedSections / sections.length) * 100);
}

function calculatePricingCompetitiveness(comps: any[]): number {
  // Simplified - would need actual deal price for accurate calculation
  return 0;
}

function determineDemandLevel(comps: any[]): 'very-high' | 'high' | 'moderate' | 'low' | 'very-low' {
  return 'moderate';
}

function calculateAvgVacancy(comps: any[]): number | undefined {
  const vacancies = comps.map(c => c.vacancyRate).filter(v => v !== undefined);
  return vacancies.length > 0 ? vacancies.reduce((a, b) => a + b, 0) / vacancies.length : undefined;
}

function calculateAbsorptionRate(comps: any[]): number | undefined {
  return undefined;
}

function mapSupplyStatus(status: string): 'planned' | 'under-construction' | 'pre-leasing' | 'delivered' {
  const s = (status || '').toLowerCase();
  if (s.includes('plan')) return 'planned';
  if (s.includes('construction')) return 'under-construction';
  if (s.includes('lease')) return 'pre-leasing';
  return 'delivered';
}

function determineImpactLevel(project: any): 'low' | 'medium' | 'high' {
  if (project.distance > 3) return 'low';
  if (project.distance > 1) return 'medium';
  return 'high';
}

function calculateDelivery(projects: any[], months: number): number {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() + months);
  
  return projects.filter(p => {
    if (!p.expectedCompletion) return false;
    const deliveryDate = new Date(p.expectedCompletion);
    return deliveryDate <= cutoffDate;
  }).reduce((sum, p) => sum + p.units, 0);
}

function determineOverallSupplyImpact(units: number): 'minimal' | 'moderate' | 'significant' | 'severe' {
  if (units < 100) return 'minimal';
  if (units < 300) return 'moderate';
  if (units < 600) return 'significant';
  return 'severe';
}

function calculateAbsorption(units: number): number {
  // Simplified - would need market absorption rate
  return Math.ceil(units / 50);
}

export default buildOpusContext;
