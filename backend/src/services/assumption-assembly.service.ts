import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import type {
  AcquisitionAssumptions,
  DevelopmentAssumptions,
  RedevelopmentAssumptions,
  TrackedAssumption,
  ModelType,
} from '../types/financial-model.types';

/**
 * Assemble complete assumptions for a financial model from all sources.
 * 
 * Sources (in priority order):
 * 1. User overrides (Layer 3) - highest priority
 * 2. Platform intelligence (Layer 2) - from M02-M08, M14, M15, M25, F32, F33
 * 3. Broker data (Layer 1) - from OM/T-12
 * 4. Defaults - market benchmarks
 */
export async function assembleAssumptions(
  dealId: string,
  modelType: ModelType
): Promise<AcquisitionAssumptions | DevelopmentAssumptions | RedevelopmentAssumptions> {
  const pool = getPool();

  // Fetch all data sources
  const dealResult = await pool.query(
    `SELECT * FROM deals WHERE id = $1`,
    [dealId]
  );

  if (dealResult.rows.length === 0) {
    throw new Error(`Deal ${dealId} not found`);
  }

  const deal = dealResult.rows[0];
  const dealData = deal.deal_data || {};

  // Helper to create tracked assumptions with layering
  function tracked<T>(
    value: T,
    brokerValue?: T,
    platformValue?: T,
    userValue?: T
  ): TrackedAssumption<T> {
    // Priority: user > platform > broker
    const resolved = userValue !== undefined ? userValue : 
                     platformValue !== undefined ? platformValue :
                     brokerValue !== undefined ? brokerValue : value;

    const source = userValue !== undefined ? 
      { layer: 'user' as const, origin: 'manual_override' } :
      platformValue !== undefined ?
      { layer: 'platform' as const, origin: 'platform_intelligence', confidence: 0.7, module: 'M05' } :
      brokerValue !== undefined ?
      { layer: 'broker' as const, origin: 'broker_om', confidence: 0.5 } :
      { layer: 'default' as const, origin: 'market_benchmark' };

    return {
      value: resolved,
      source,
      platformSuggested: platformValue,
      overrideDelta: userValue !== undefined && platformValue !== undefined ?
        (Number(userValue) - Number(platformValue)) : undefined,
    };
  }

  // Common property data
  const commonProperty = {
    name: deal.name,
    address: deal.address_line1,
    city: deal.city,
    state: deal.state,
    msa: dealData.market?.msa || '',
    submarket: dealData.market?.submarket || '',
    coordinates: deal.coordinates || { lat: 0, lng: 0 },
  };

  // Build assumptions based on model type
  switch (modelType) {
    case 'acquisition':
      return assembleAcquisitionAssumptions(deal, dealData, commonProperty, tracked);
    
    case 'development':
      return assembleDevelopmentAssumptions(deal, dealData, commonProperty, tracked);
    
    case 'redevelopment':
      return assembleRedevelopmentAssumptions(deal, dealData, commonProperty, tracked);
    
    default:
      throw new Error(`Unknown model type: ${modelType}`);
  }
}

function assembleAcquisitionAssumptions(
  deal: any,
  dealData: any,
  commonProperty: any,
  tracked: any
): AcquisitionAssumptions {
  return {
    modelType: 'acquisition',
    modelVersion: '1.0',
    property: {
      ...commonProperty,
      units: dealData.totalUnits || 0,
      yearBuilt: dealData.existingProperty?.yearBuilt || 2000,
      propertyClass: dealData.existingProperty?.propertyClass || 'B',
      propertyType: 'garden',
      grossSF: dealData.existingProperty?.grossSF || 0,
      avgUnitSF: dealData.existingProperty?.avgUnitSF || 0,
    },
    acquisition: {
      purchasePrice: tracked(dealData.acquisition?.purchasePrice || 0),
      closingCostsPct: tracked(0.03, 0.03, 0.03),
      reserves: tracked(0),
      capexBudget: tracked(0),
      closingDate: new Date().toISOString().split('T')[0],
    },
    revenue: {
      inPlaceRentPerUnit: tracked(dealData.revenue?.inPlaceRent || 0),
      marketRentPerUnit: tracked(dealData.market?.avgRent?.value || 0),
      rentGrowth: tracked(0.03, 0.03, dealData.financial?.assumptions?.rentGrowth?.value),
      vacancySchedule: tracked([0.05, 0.05, 0.05, 0.05, 0.05]),
      concessionsPct: tracked(0.02),
      badDebtPct: tracked(0.01),
      otherIncomePerUnit: tracked(50),
      otherIncomeGrowth: tracked(0.02),
    },
    expenses: {
      opexPerUnit: tracked(dealData.expenses?.opexPerUnit || 0),
      expenseGrowth: tracked(0.025, 0.025, dealData.financial?.assumptions?.expenseGrowth?.value),
      managementFeePct: tracked(0.04),
      reservesPerUnit: tracked(250),
    },
    debt: {
      primary: {
        loanAmount: 0, // Calculated from LTV
        leverageMetric: { type: 'LTV', value: 0.65 },
        interestRate: 0.055,
        rateType: 'fixed',
        amortizationYears: 30,
        ioMonths: 0,
        loanTermMonths: 120,
      },
    },
    disposition: {
      holdYears: tracked(5, 5, 5, dealData.financial?.assumptions?.holdPeriod?.value),
      exitCapRate: tracked(0.055, 0.055, dealData.financial?.assumptions?.exitCapRate?.value),
      sellingCostsPct: tracked(0.02),
    },
  };
}

function assembleDevelopmentAssumptions(
  deal: any,
  dealData: any,
  commonProperty: any,
  tracked: any
): DevelopmentAssumptions {
  const selectedPath = dealData.selectedDevelopmentPathId ?
    dealData.developmentPaths?.find((p: any) => p.id === dealData.selectedDevelopmentPathId) :
    dealData.developmentPaths?.[0];

  if (!selectedPath) {
    throw new Error('No development path selected');
  }

  return {
    modelType: 'development',
    modelVersion: '1.0',
    property: {
      ...commonProperty,
      zoning: {
        code: dealData.zoning?.designation?.value || '',
        maxDensity: dealData.zoning?.maxDensity?.value || 0,
        far: dealData.zoning?.maxFAR?.value || 0,
        maxHeight: dealData.zoning?.maxHeight?.value || 0,
        setbacks: dealData.zoning?.setbacks?.value || { front: 0, side: 0, rear: 0 },
        parkingRatio: dealData.zoning?.parkingRatio?.value || 1.0,
        source: dealData.zoning?.sourceUrl || '',
      },
    },
    unitMix: {
      totalUnits: selectedPath.totalUnits,
      mix: selectedPath.unitMixProgram.map((row: any) => ({
        type: row.unitType,
        count: row.count,
        avgSF: row.avgSF,
        targetRent: tracked(row.targetRent.value),
      })),
      avgUnitSF: selectedPath.netResidentialSF / selectedPath.totalUnits,
      totalGrossSF: selectedPath.grossFloorArea,
    },
    constructionBudget: {
      landCost: tracked(dealData.acquisition?.purchasePrice || 0),
      hardCosts: {
        totalHardCost: tracked(selectedPath.constructionCost.totalHardCost),
        hardCostPerSF: selectedPath.constructionCost.hardCostPerSF,
        lineItems: [],
      },
      softCosts: {
        totalSoftCost: tracked(selectedPath.constructionCost.totalSoftCost),
        lineItems: [],
      },
      developerFee: tracked(selectedPath.constructionCost.totalDevelopmentCost * 0.03),
      contingency: tracked(selectedPath.constructionCost.totalDevelopmentCost * 0.05),
      interestReserve: tracked(0),
      totalDevelopmentCost: selectedPath.constructionCost.totalDevelopmentCost,
      totalCostPerUnit: selectedPath.constructionCost.costPerUnit,
      totalCostPerSF: selectedPath.constructionCost.totalDevelopmentCost / selectedPath.grossFloorArea,
    },
    timeline: {
      preDevelopmentMonths: selectedPath.timeline.entitlementMonths,
      constructionMonths: selectedPath.timeline.constructionMonths,
      leaseUpMonths: tracked(selectedPath.timeline.leaseUpMonths),
      totalProjectMonths: selectedPath.timeline.totalMonths,
      stabilizedOccupancy: tracked(0.95),
      absorptionRate: tracked(8),
    },
    constructionDebt: {
      ltc: tracked(0.65),
      loanAmount: 0, // Calculated
      index: 'SOFR',
      spread: 0.03,
      indexRate: 0.045,
      allInRate: 0.075,
      interestReserveMonths: 18,
      loanTermMonths: 36,
      equityRequiredBeforeFirstDraw: 0.25,
      drawMethod: 's_curve',
    },
    permanentDebt: {
      estimatedLoanAmount: tracked(0),
      leverageMetric: { type: 'DSCR_constrained', value: 1.25 },
      interestRate: tracked(0.055),
      rateType: 'fixed',
      amortizationYears: 30,
      ioMonths: 0,
      loanTermMonths: 120,
    },
    revenue: {
      weightedAvgRent: selectedPath.unitMixProgram.reduce((sum: number, row: any) => 
        sum + (row.targetRent.value * row.count), 0) / selectedPath.totalUnits,
      rentGrowth: tracked(0.03),
      stabilizedVacancy: tracked(0.05),
      concessionsPct: tracked(0.02),
      badDebtPct: tracked(0.01),
      otherIncomePerUnit: tracked(50),
      otherIncomeGrowth: tracked(0.02),
      leaseUpConcessions: tracked(0.05),
    },
    expenses: {
      opexPerUnit: tracked(5000),
      expenseGrowth: tracked(0.025),
      managementFeePct: tracked(0.04),
      reservesPerUnit: tracked(250),
      leaseUpExpensePct: tracked(0.70),
    },
    disposition: {
      holdYearsPostStabilization: tracked(5),
      exitCapRate: tracked(0.055),
      sellingCostsPct: tracked(0.02),
    },
  };
}

function assembleRedevelopmentAssumptions(
  deal: any,
  dealData: any,
  commonProperty: any,
  tracked: any
): RedevelopmentAssumptions {
  return {
    modelType: 'redevelopment',
    modelVersion: '1.0',
    property: {
      ...commonProperty,
      units: dealData.totalUnits || 0,
      yearBuilt: dealData.existingProperty?.yearBuilt || 1990,
      propertyClass: dealData.existingProperty?.propertyClass || 'C',
      targetClass: 'B',
      propertyType: 'garden',
      grossSF: dealData.existingProperty?.grossSF || 0,
      avgUnitSF: dealData.existingProperty?.avgUnitSF || 0,
    },
    acquisition: {
      purchasePrice: tracked(dealData.acquisition?.purchasePrice || 0),
      pricePerUnit: 0, // Calculated
      closingCostsPct: tracked(0.03),
      reserves: tracked(0),
      closingDate: new Date().toISOString().split('T')[0],
    },
    currentPerformance: {
      inPlaceRentPerUnit: tracked(dealData.currentPerformance?.inPlaceRent || 0),
      currentOccupancy: tracked(0.85),
      trailingNOI: tracked(dealData.currentPerformance?.trailingNOI || 0),
      currentOpexPerUnit: tracked(dealData.currentPerformance?.opexPerUnit || 0),
    },
    renovation: {
      totalBudget: tracked(dealData.renovation?.totalBudget || 0),
      interiorPerUnit: tracked(dealData.renovation?.interiorPerUnit || 0),
      commonAreaBudget: tracked(dealData.renovation?.commonAreaBudget || 0),
      contingencyPct: tracked(0.10),
      phases: dealData.renovation?.phases || [],
      totalRenovationMonths: 24,
      avgDowntimeDays: tracked(30),
    },
    revenue: {
      vintageRentPerUnit: tracked(dealData.revenue?.vintageRent || 0),
      renovatedRentPerUnit: tracked(dealData.revenue?.renovatedRent || 0),
      renovationPremium: tracked(0.25),
      vintageRentGrowth: tracked(0.02),
      renovatedRentGrowth: tracked(0.03),
      vintageVacancy: tracked(0.15),
      renovatedLeaseUpVacancy: tracked(0.10),
      stabilizedVacancy: tracked(0.05),
      concessionsPct: tracked(0.02),
      badDebtPct: tracked(0.01),
      otherIncomePerUnit: tracked(50),
      otherIncomeGrowth: tracked(0.02),
    },
    expenses: {
      opexPerUnit: tracked(dealData.expenses?.opexPerUnit || 0),
      expenseGrowth: tracked(0.025),
      managementFeePct: tracked(0.04),
      reservesPerUnit: tracked(250),
    },
    bridgeDebt: {
      loanAmount: tracked(0),
      ltc: 0, // Calculated
      interestRate: 0.08,
      rateType: 'floating',
      floatingSpread: 0.03,
      floatingIndex: 'SOFR',
      ioMonths: 24,
      loanTermMonths: 36,
      interestReserveMonths: 18,
    },
    permanentDebt: {
      targetRefiMonth: tracked(24),
      estimatedLoanAmount: tracked(0),
      leverageMetric: { type: 'DSCR_constrained', value: 1.25 },
      interestRate: tracked(0.055),
      rateType: 'fixed',
      amortizationYears: 30,
      ioMonths: 0,
      loanTermMonths: 120,
    },
    disposition: {
      holdYears: tracked(5),
      exitCapRate: tracked(0.055),
      sellingCostsPct: tracked(0.02),
    },
  };
}
