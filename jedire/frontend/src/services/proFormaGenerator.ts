/**
 * Pro Forma Generator
 * Formula-based financial calculations from 3D design
 */

import type {
  Design3D,
  FinancialAssumptions,
  DevelopmentBudget,
  HardCosts,
  SoftCostBreakdown,
  OperatingProForma,
  YearlyProForma,
  RevenueProjection,
  OperatingExpenses,
  CashFlow,
  ReturnsMetrics,
  SensitivityAnalysis,
  SensitivityVariable,
  ProForma,
} from '../types/financial.types';

/**
 * Generate complete pro forma from 3D design
 */
export function generateProForma(
  design3D: Design3D,
  assumptions: FinancialAssumptions,
  dealId: string
): ProForma {
  const developmentBudget = calculateDevelopmentBudget(design3D, assumptions);
  const operatingProForma = calculateOperatingProForma(design3D, assumptions, developmentBudget);
  const returns = calculateReturns(
    developmentBudget,
    operatingProForma,
    assumptions
  );
  const sensitivity = calculateSensitivityAnalysis(
    design3D,
    assumptions,
    developmentBudget,
    operatingProForma
  );

  return {
    id: `proforma-${Date.now()}`,
    dealId,
    design3D,
    assumptions,
    developmentBudget,
    operatingProForma,
    returns,
    sensitivity,
    calculatedAt: new Date().toISOString(),
    version: 1,
  };
}

/**
 * Calculate development budget from 3D design
 */
export function calculateDevelopmentBudget(
  design: Design3D,
  assumptions: FinancialAssumptions
): DevelopmentBudget {
  // Hard Costs
  const residential = design.rentableSF * assumptions.constructionCosts.residentialPerSF;
  
  const parkingCostPerSpace = 
    design.parkingType === 'surface' 
      ? assumptions.constructionCosts.parkingSurface
      : design.parkingType === 'underground'
      ? assumptions.constructionCosts.parkingUnderground
      : assumptions.constructionCosts.parkingStructured;
  
  const parking = design.parkingSpaces * parkingCostPerSpace;
  
  const amenities = design.amenitySF * assumptions.constructionCosts.amenityPerSF;
  
  const siteWork = 
    typeof assumptions.constructionCosts.siteWork === 'number'
      ? assumptions.constructionCosts.siteWork
      : (residential + parking + amenities) * 0.05; // Default 5% of hard costs
  
  const hardCostsSubtotal = residential + parking + amenities + siteWork;
  const contingency = hardCostsSubtotal * (assumptions.constructionCosts.contingency || 0.05);
  
  const hardCosts: HardCosts = {
    residential,
    parking,
    amenities,
    siteWork,
    contingency,
    total: hardCostsSubtotal + contingency,
  };

  // Soft Costs
  const ae = hardCosts.total * (assumptions.softCosts.architectureEngineering || 0.05);
  const legal = hardCosts.total * (assumptions.softCosts.legalPermitting || 0.03);
  const marketing = assumptions.softCosts.marketing || design.totalUnits * 500;
  
  const subtotalBeforeFees = assumptions.landCost + hardCosts.total + ae + legal + marketing;
  
  const financing = subtotalBeforeFees * (assumptions.softCosts.financing || 0.03);
  const developerFee = subtotalBeforeFees * (assumptions.softCosts.developerFee || 0.05);
  
  const softCosts: SoftCostBreakdown = {
    architectureEngineering: ae,
    legalPermitting: legal,
    financing,
    marketing,
    developerFee,
    other: 0,
    total: ae + legal + financing + marketing + developerFee,
  };

  const totalDevelopmentCost = assumptions.landCost + hardCosts.total + softCosts.total;

  return {
    landAcquisition: assumptions.landCost,
    hardCosts,
    softCosts,
    totalDevelopmentCost,
    costPerUnit: totalDevelopmentCost / design.totalUnits,
    costPerSF: totalDevelopmentCost / design.rentableSF,
  };
}

/**
 * Calculate revenue projections
 */
function calculateRevenue(design: Design3D, assumptions: FinancialAssumptions): RevenueProjection {
  const { unitMix } = design;
  const { marketRents, operating } = assumptions;

  const studioRevenue = unitMix.studio * marketRents.studio * 12;
  const oneBedRevenue = unitMix.oneBed * marketRents.oneBed * 12;
  const twoBedRevenue = unitMix.twoBed * marketRents.twoBed * 12;
  const threeBedRevenue = unitMix.threeBed * marketRents.threeBed * 12;
  const fourBedRevenue = (unitMix.fourBedPlus || 0) * (marketRents.fourBedPlus || 0) * 12;

  const grossPotentialIncome = 
    studioRevenue + oneBedRevenue + twoBedRevenue + threeBedRevenue + fourBedRevenue;
  
  const vacancy = grossPotentialIncome * operating.vacancyRate;
  const effectiveGrossIncome = grossPotentialIncome - vacancy;

  return {
    studio: { 
      units: unitMix.studio, 
      rent: marketRents.studio, 
      total: studioRevenue 
    },
    oneBed: { 
      units: unitMix.oneBed, 
      rent: marketRents.oneBed, 
      total: oneBedRevenue 
    },
    twoBed: { 
      units: unitMix.twoBed, 
      rent: marketRents.twoBed, 
      total: twoBedRevenue 
    },
    threeBed: { 
      units: unitMix.threeBed, 
      rent: marketRents.threeBed, 
      total: threeBedRevenue 
    },
    ...(unitMix.fourBedPlus && {
      fourBedPlus: {
        units: unitMix.fourBedPlus,
        rent: marketRents.fourBedPlus || 0,
        total: fourBedRevenue,
      },
    }),
    grossPotentialIncome,
    vacancy,
    effectiveGrossIncome,
  };
}

/**
 * Calculate operating expenses
 */
function calculateExpenses(
  design: Design3D,
  revenue: RevenueProjection,
  assumptions: FinancialAssumptions,
  budget: DevelopmentBudget
): OperatingExpenses {
  const { operating } = assumptions;
  const { effectiveGrossIncome } = revenue;

  const management = effectiveGrossIncome * operating.managementFee;
  const propertyTax = budget.totalDevelopmentCost * operating.propertyTaxRate;
  const insurance = design.totalUnits * operating.insurancePerUnit;
  const utilities = design.totalUnits * operating.utilitiesPerUnit;
  const repairsMaintenance = design.totalUnits * operating.repairsMaintenancePerUnit;
  const payroll = design.totalUnits * operating.payrollPerUnit;
  const other = design.totalUnits * 100; // Miscellaneous

  const total = management + propertyTax + insurance + utilities + repairsMaintenance + payroll + other;

  return {
    management,
    propertyTax,
    insurance,
    utilities,
    repairsMaintenance,
    payroll,
    other,
    total,
    perUnit: total / design.totalUnits,
    percentOfEGI: total / effectiveGrossIncome,
  };
}

/**
 * Calculate cash flow
 */
function calculateCashFlow(
  revenue: RevenueProjection,
  expenses: OperatingExpenses,
  assumptions: FinancialAssumptions,
  budget: DevelopmentBudget
): CashFlow {
  const noi = revenue.effectiveGrossIncome - expenses.total;
  
  let debtService = 0;
  if (assumptions.debt) {
    const loanAmount = budget.totalDevelopmentCost * assumptions.debt.loanToValue;
    const monthlyRate = assumptions.debt.interestRate / 12;
    const numPayments = assumptions.debt.amortization * 12;
    
    // Monthly payment calculation
    const monthlyPayment = 
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    
    debtService = monthlyPayment * 12;
  }

  return {
    effectiveGrossIncome: revenue.effectiveGrossIncome,
    operatingExpenses: expenses.total,
    netOperatingIncome: noi,
    debtService,
    cashFlowBeforeTax: noi - debtService,
  };
}

/**
 * Calculate operating pro forma (10-year projection)
 */
export function calculateOperatingProForma(
  design: Design3D,
  assumptions: FinancialAssumptions,
  budget: DevelopmentBudget
): OperatingProForma {
  const stabilizedRevenue = calculateRevenue(design, assumptions);
  const stabilizedExpenses = calculateExpenses(design, stabilizedRevenue, assumptions, budget);
  const stabilizedCashFlow = calculateCashFlow(stabilizedRevenue, stabilizedExpenses, assumptions, budget);

  const stabilizedYear: YearlyProForma = {
    year: 1,
    revenue: stabilizedRevenue,
    expenses: stabilizedExpenses,
    cashFlow: stabilizedCashFlow,
  };

  // Project 10 years with growth
  const tenYearProjection: YearlyProForma[] = [];
  for (let year = 1; year <= 10; year++) {
    const rentGrowthFactor = Math.pow(1 + assumptions.rentGrowth, year - 1);
    const expenseGrowthFactor = Math.pow(1 + assumptions.expenseGrowth, year - 1);

    // Grow revenues
    const yearRevenue = { ...stabilizedRevenue };
    yearRevenue.studio.total *= rentGrowthFactor;
    yearRevenue.oneBed.total *= rentGrowthFactor;
    yearRevenue.twoBed.total *= rentGrowthFactor;
    yearRevenue.threeBed.total *= rentGrowthFactor;
    if (yearRevenue.fourBedPlus) {
      yearRevenue.fourBedPlus.total *= rentGrowthFactor;
    }
    yearRevenue.grossPotentialIncome *= rentGrowthFactor;
    yearRevenue.vacancy *= rentGrowthFactor;
    yearRevenue.effectiveGrossIncome *= rentGrowthFactor;

    // Grow expenses
    const yearExpenses = { ...stabilizedExpenses };
    yearExpenses.management *= expenseGrowthFactor;
    yearExpenses.insurance *= expenseGrowthFactor;
    yearExpenses.utilities *= expenseGrowthFactor;
    yearExpenses.repairsMaintenance *= expenseGrowthFactor;
    yearExpenses.payroll *= expenseGrowthFactor;
    yearExpenses.other *= expenseGrowthFactor;
    yearExpenses.total = 
      yearExpenses.management + 
      yearExpenses.propertyTax + // Property tax doesn't grow with expenses
      yearExpenses.insurance + 
      yearExpenses.utilities + 
      yearExpenses.repairsMaintenance + 
      yearExpenses.payroll + 
      yearExpenses.other;
    yearExpenses.perUnit = yearExpenses.total / design.totalUnits;
    yearExpenses.percentOfEGI = yearExpenses.total / yearRevenue.effectiveGrossIncome;

    const yearCashFlow = calculateCashFlow(yearRevenue, yearExpenses, assumptions, budget);

    tenYearProjection.push({
      year,
      revenue: yearRevenue,
      expenses: yearExpenses,
      cashFlow: yearCashFlow,
    });
  }

  return {
    stabilizedYear,
    tenYearProjection,
  };
}

/**
 * Calculate returns metrics
 */
export function calculateReturns(
  budget: DevelopmentBudget,
  proForma: OperatingProForma,
  assumptions: FinancialAssumptions
): ReturnsMetrics {
  const stabilizedNOI = proForma.stabilizedYear.cashFlow.netOperatingIncome;
  const exitValue = stabilizedNOI / assumptions.exitCapRate;
  
  // Equity calculation
  const loanAmount = assumptions.debt 
    ? budget.totalDevelopmentCost * assumptions.debt.loanToValue 
    : 0;
  const equity = budget.totalDevelopmentCost - loanAmount;

  // Levered returns
  const cashFlows = proForma.tenYearProjection
    .slice(0, assumptions.holdPeriod)
    .map(y => y.cashFlow.cashFlowBeforeTax);
  
  // Add exit proceeds to final year
  const loanBalance = loanAmount; // Simplified - should calculate actual balance
  const exitProceeds = exitValue - loanBalance;
  cashFlows[cashFlows.length - 1] += exitProceeds;

  const leveredIRR = calculateIRR([-equity, ...cashFlows]);
  const totalCashReturned = cashFlows.reduce((sum, cf) => sum + cf, 0);
  const leveredEquityMultiple = totalCashReturned / equity;
  const cashOnCashReturn = proForma.stabilizedYear.cashFlow.cashFlowBeforeTax / equity;

  // Unlevered returns
  const unleveredCashFlows = proForma.tenYearProjection
    .slice(0, assumptions.holdPeriod)
    .map(y => y.cashFlow.netOperatingIncome);
  unleveredCashFlows[unleveredCashFlows.length - 1] += exitValue;
  
  const unleveredIRR = calculateIRR([-budget.totalDevelopmentCost, ...unleveredCashFlows]);
  const totalUnleveredReturns = unleveredCashFlows.reduce((sum, cf) => sum + cf, 0);
  const unleveredEquityMultiple = totalUnleveredReturns / budget.totalDevelopmentCost;

  // Development metrics
  const yieldOnCost = stabilizedNOI / budget.totalDevelopmentCost;
  const developmentSpread = (yieldOnCost - assumptions.exitCapRate) * 10000; // Basis points

  // Payback period (simplified)
  let cumulativeCashFlow = -equity;
  let paybackPeriod = 0;
  for (let i = 0; i < cashFlows.length; i++) {
    cumulativeCashFlow += cashFlows[i];
    if (cumulativeCashFlow >= 0) {
      paybackPeriod = i + 1;
      break;
    }
  }
  if (paybackPeriod === 0) paybackPeriod = assumptions.holdPeriod; // Never paid back

  // Debt metrics
  const dscr = assumptions.debt && proForma.stabilizedYear.cashFlow.debtService
    ? stabilizedNOI / proForma.stabilizedYear.cashFlow.debtService
    : 0;

  return {
    leveredIRR,
    leveredEquityMultiple,
    cashOnCashReturn,
    unleveredIRR,
    unleveredEquityMultiple,
    yieldOnCost,
    developmentSpread,
    paybackPeriod,
    debtServiceCoverageRatio: dscr,
    loanToValue: loanAmount / exitValue,
    loanToCost: loanAmount / budget.totalDevelopmentCost,
  };
}

/**
 * Calculate sensitivity analysis
 */
export function calculateSensitivityAnalysis(
  design: Design3D,
  assumptions: FinancialAssumptions,
  baseBudget: DevelopmentBudget,
  baseProForma: OperatingProForma
): SensitivityAnalysis {
  const baseReturns = calculateReturns(baseBudget, baseProForma, assumptions);

  // Test variables at +/- 10%
  const variables: SensitivityVariable[] = [];

  // 1. Rents
  const rentAssumptions = { ...assumptions };
  rentAssumptions.marketRents = {
    ...assumptions.marketRents,
    studio: assumptions.marketRents.studio * 0.9,
    oneBed: assumptions.marketRents.oneBed * 0.9,
    twoBed: assumptions.marketRents.twoBed * 0.9,
    threeBed: assumptions.marketRents.threeBed * 0.9,
  };
  const rentProFormaDown = calculateOperatingProForma(design, rentAssumptions, baseBudget);
  const rentReturnsDown = calculateReturns(baseBudget, rentProFormaDown, rentAssumptions);
  
  rentAssumptions.marketRents = {
    ...assumptions.marketRents,
    studio: assumptions.marketRents.studio * 1.1,
    oneBed: assumptions.marketRents.oneBed * 1.1,
    twoBed: assumptions.marketRents.twoBed * 1.1,
    threeBed: assumptions.marketRents.threeBed * 1.1,
  };
  const rentProFormaUp = calculateOperatingProForma(design, rentAssumptions, baseBudget);
  const rentReturnsUp = calculateReturns(baseBudget, rentProFormaUp, rentAssumptions);

  variables.push({
    name: 'Market Rents',
    baseValue: assumptions.marketRents.oneBed,
    negTenPercent: assumptions.marketRents.oneBed * 0.9,
    posTenPercent: assumptions.marketRents.oneBed * 1.1,
    impactOnIRR: {
      negTen: rentReturnsDown.leveredIRR,
      base: baseReturns.leveredIRR,
      posTen: rentReturnsUp.leveredIRR,
    },
  });

  // 2. Construction Cost
  const costAssumptions = { ...assumptions };
  costAssumptions.constructionCosts = {
    ...assumptions.constructionCosts,
    residentialPerSF: assumptions.constructionCosts.residentialPerSF * 1.1,
  };
  const costBudgetUp = calculateDevelopmentBudget(design, costAssumptions);
  const costProFormaUp = calculateOperatingProForma(design, costAssumptions, costBudgetUp);
  const costReturnsUp = calculateReturns(costBudgetUp, costProFormaUp, costAssumptions);

  costAssumptions.constructionCosts.residentialPerSF = assumptions.constructionCosts.residentialPerSF * 0.9;
  const costBudgetDown = calculateDevelopmentBudget(design, costAssumptions);
  const costProFormaDown = calculateOperatingProForma(design, costAssumptions, costBudgetDown);
  const costReturnsDown = calculateReturns(costBudgetDown, costProFormaDown, costAssumptions);

  variables.push({
    name: 'Construction Cost',
    baseValue: assumptions.constructionCosts.residentialPerSF,
    negTenPercent: assumptions.constructionCosts.residentialPerSF * 0.9,
    posTenPercent: assumptions.constructionCosts.residentialPerSF * 1.1,
    impactOnIRR: {
      negTen: costReturnsDown.leveredIRR,
      base: baseReturns.leveredIRR,
      posTen: costReturnsUp.leveredIRR,
    },
  });

  // 3. Exit Cap Rate
  const capAssumptions = { ...assumptions, exitCapRate: assumptions.exitCapRate * 1.1 };
  const capReturnsUp = calculateReturns(baseBudget, baseProForma, capAssumptions);
  
  capAssumptions.exitCapRate = assumptions.exitCapRate * 0.9;
  const capReturnsDown = calculateReturns(baseBudget, baseProForma, capAssumptions);

  variables.push({
    name: 'Exit Cap Rate',
    baseValue: assumptions.exitCapRate,
    negTenPercent: assumptions.exitCapRate * 0.9,
    posTenPercent: assumptions.exitCapRate * 1.1,
    impactOnIRR: {
      negTen: capReturnsDown.leveredIRR,
      base: baseReturns.leveredIRR,
      posTen: capReturnsUp.leveredIRR,
    },
  });

  // Find most sensitive variable
  const mostSensitive = variables.reduce((prev, current) => {
    const prevRange = Math.abs(prev.impactOnIRR.posTen - prev.impactOnIRR.negTen);
    const currentRange = Math.abs(current.impactOnIRR.posTen - current.impactOnIRR.negTen);
    return currentRange > prevRange ? current : prev;
  });

  return {
    variables,
    mostSensitive: mostSensitive.name,
  };
}

/**
 * Calculate IRR using Newton-Raphson method
 */
function calculateIRR(cashFlows: number[], guess: number = 0.1): number {
  const maxIterations = 100;
  const tolerance = 0.00001;
  
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    
    const newRate = rate - npv / dnpv;
    
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }
    
    rate = newRate;
  }
  
  return rate;
}
