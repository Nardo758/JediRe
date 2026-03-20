/**
 * Example 3D Design Data for Testing
 */

import type { Design3D, FinancialAssumptions } from '../types/financial.types';

/**
 * Example 1: Mid-rise Multifamily (Boston)
 * 287 units, 8 stories, structured parking
 */
export const bostonMidrise: Design3D = {
  id: 'design-boston-midrise',
  dealId: 'deal-boston-001',
  totalUnits: 287,
  unitMix: {
    studio: 43,
    oneBed: 130,
    twoBed: 86,
    threeBed: 28,
  },
  rentableSF: 175000,
  grossSF: 213415,
  efficiency: 0.82,
  parkingSpaces: 315,
  parkingType: 'structured',
  amenitySF: 15000,
  stories: 8,
  farUtilized: 4.2,
  farMax: 5.0,
  lastModified: '2025-01-10T12:00:00Z',
};

export const bostonAssumptions: FinancialAssumptions = {
  landCost: 8500000,
  marketRents: {
    studio: 1450,
    oneBed: 1850,
    twoBed: 2450,
    threeBed: 3250,
  },
  constructionCosts: {
    residentialPerSF: 300,
    parkingSurface: 5000,
    parkingStructured: 15000,
    parkingUnderground: 25000,
    amenityPerSF: 150,
    siteWork: 2300000,
    contingency: 0.05,
  },
  softCosts: {
    architectureEngineering: 0.05,
    legalPermitting: 0.03,
    financing: 0.03,
    marketing: 500,
    developerFee: 0.05,
  },
  operating: {
    vacancyRate: 0.05,
    managementFee: 0.03,
    operatingExpensesPerUnit: 4000,
    propertyTaxRate: 0.012,
    insurancePerUnit: 500,
    utilitiesPerUnit: 600,
    repairsMaintenancePerUnit: 800,
    payrollPerUnit: 500,
  },
  debt: {
    loanToValue: 0.65,
    interestRate: 0.0825,
    loanTerm: 10,
    amortization: 30,
    constructionLoanRate: 0.085,
    constructionPeriod: 24,
  },
  exitCapRate: 0.055,
  holdPeriod: 5,
  rentGrowth: 0.03,
  expenseGrowth: 0.025,
  leaseUpMonths: 18,
};

/**
 * Example 2: Garden-Style Apartments (Austin)
 * 156 units, 3 stories, surface parking
 */
export const austinGardenStyle: Design3D = {
  id: 'design-austin-garden',
  dealId: 'deal-austin-001',
  totalUnits: 156,
  unitMix: {
    studio: 0,
    oneBed: 52,
    twoBed: 78,
    threeBed: 26,
  },
  rentableSF: 124800,
  grossSF: 145000,
  efficiency: 0.86,
  parkingSpaces: 280,
  parkingType: 'surface',
  amenitySF: 8000,
  stories: 3,
  farUtilized: 0.8,
  farMax: 1.5,
  lastModified: '2025-01-10T12:00:00Z',
};

export const austinAssumptions: FinancialAssumptions = {
  landCost: 4200000,
  marketRents: {
    studio: 0,
    oneBed: 1350,
    twoBed: 1750,
    threeBed: 2200,
  },
  constructionCosts: {
    residentialPerSF: 220,
    parkingSurface: 5000,
    parkingStructured: 15000,
    parkingUnderground: 25000,
    amenityPerSF: 120,
    siteWork: 850000,
    contingency: 0.05,
  },
  softCosts: {
    architectureEngineering: 0.04,
    legalPermitting: 0.025,
    financing: 0.03,
    marketing: 400,
    developerFee: 0.05,
  },
  operating: {
    vacancyRate: 0.05,
    managementFee: 0.03,
    operatingExpensesPerUnit: 3200,
    propertyTaxRate: 0.018,
    insurancePerUnit: 400,
    utilitiesPerUnit: 500,
    repairsMaintenancePerUnit: 650,
    payrollPerUnit: 350,
  },
  debt: {
    loanToValue: 0.70,
    interestRate: 0.08,
    loanTerm: 10,
    amortization: 30,
    constructionLoanRate: 0.085,
    constructionPeriod: 18,
  },
  exitCapRate: 0.05,
  holdPeriod: 7,
  rentGrowth: 0.04,
  expenseGrowth: 0.03,
  leaseUpMonths: 12,
};

/**
 * Example 3: High-Rise Luxury (Miami)
 * 412 units, 22 stories, underground parking
 */
export const miamiHighRise: Design3D = {
  id: 'design-miami-highrise',
  dealId: 'deal-miami-001',
  totalUnits: 412,
  unitMix: {
    studio: 62,
    oneBed: 186,
    twoBed: 124,
    threeBed: 40,
  },
  rentableSF: 298000,
  grossSF: 365000,
  efficiency: 0.816,
  parkingSpaces: 450,
  parkingType: 'underground',
  amenitySF: 28000,
  stories: 22,
  farUtilized: 8.5,
  farMax: 10.0,
  lastModified: '2025-01-10T12:00:00Z',
};

export const miamiAssumptions: FinancialAssumptions = {
  landCost: 18000000,
  marketRents: {
    studio: 1800,
    oneBed: 2400,
    twoBed: 3200,
    threeBed: 4500,
  },
  constructionCosts: {
    residentialPerSF: 380,
    parkingSurface: 5000,
    parkingStructured: 15000,
    parkingUnderground: 28000,
    amenityPerSF: 200,
    siteWork: 4500000,
    contingency: 0.06,
  },
  softCosts: {
    architectureEngineering: 0.06,
    legalPermitting: 0.035,
    financing: 0.035,
    marketing: 750,
    developerFee: 0.06,
  },
  operating: {
    vacancyRate: 0.05,
    managementFee: 0.035,
    operatingExpensesPerUnit: 5500,
    propertyTaxRate: 0.015,
    insurancePerUnit: 700,
    utilitiesPerUnit: 800,
    repairsMaintenancePerUnit: 1000,
    payrollPerUnit: 700,
  },
  debt: {
    loanToValue: 0.60,
    interestRate: 0.08,
    loanTerm: 10,
    amortization: 30,
    constructionLoanRate: 0.085,
    constructionPeriod: 36,
  },
  exitCapRate: 0.045,
  holdPeriod: 5,
  rentGrowth: 0.035,
  expenseGrowth: 0.03,
  leaseUpMonths: 24,
};

/**
 * Example 4: Small Infill Project (Portland)
 * 48 units, 5 stories, structured parking
 */
export const portlandInfill: Design3D = {
  id: 'design-portland-infill',
  dealId: 'deal-portland-001',
  totalUnits: 48,
  unitMix: {
    studio: 12,
    oneBed: 24,
    twoBed: 12,
    threeBed: 0,
  },
  rentableSF: 36000,
  grossSF: 42000,
  efficiency: 0.857,
  parkingSpaces: 40,
  parkingType: 'structured',
  amenitySF: 2500,
  stories: 5,
  farUtilized: 3.2,
  farMax: 4.0,
  lastModified: '2025-01-10T12:00:00Z',
};

export const portlandAssumptions: FinancialAssumptions = {
  landCost: 2800000,
  marketRents: {
    studio: 1100,
    oneBed: 1500,
    twoBed: 2000,
    threeBed: 0,
  },
  constructionCosts: {
    residentialPerSF: 280,
    parkingSurface: 5000,
    parkingStructured: 16000,
    parkingUnderground: 25000,
    amenityPerSF: 140,
    siteWork: 450000,
    contingency: 0.05,
  },
  softCosts: {
    architectureEngineering: 0.05,
    legalPermitting: 0.03,
    financing: 0.03,
    marketing: 600,
    developerFee: 0.05,
  },
  operating: {
    vacancyRate: 0.05,
    managementFee: 0.04,
    operatingExpensesPerUnit: 3800,
    propertyTaxRate: 0.011,
    insurancePerUnit: 450,
    utilitiesPerUnit: 550,
    repairsMaintenancePerUnit: 700,
    payrollPerUnit: 450,
  },
  debt: {
    loanToValue: 0.65,
    interestRate: 0.08,
    loanTerm: 10,
    amortization: 30,
    constructionLoanRate: 0.085,
    constructionPeriod: 20,
  },
  exitCapRate: 0.0525,
  holdPeriod: 5,
  rentGrowth: 0.035,
  expenseGrowth: 0.03,
  leaseUpMonths: 15,
};

/**
 * All example projects
 */
export const exampleProjects = [
  { name: 'Boston Mid-Rise', design: bostonMidrise, assumptions: bostonAssumptions },
  { name: 'Austin Garden-Style', design: austinGardenStyle, assumptions: austinAssumptions },
  { name: 'Miami High-Rise', design: miamiHighRise, assumptions: miamiAssumptions },
  { name: 'Portland Infill', design: portlandInfill, assumptions: portlandAssumptions },
];
