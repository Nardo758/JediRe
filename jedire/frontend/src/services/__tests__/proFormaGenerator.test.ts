/**
 * Pro Forma Generator Tests
 */

import {
  generateProForma,
  calculateDevelopmentBudget,
  calculateOperatingProForma,
  calculateReturns,
  calculateSensitivityAnalysis,
} from '../proFormaGenerator';
import type { Design3D, FinancialAssumptions } from '../../types/financial.types';

// Test data
const testDesign: Design3D = {
  id: 'design-123',
  dealId: 'deal-456',
  totalUnits: 100,
  unitMix: {
    studio: 20,
    oneBed: 40,
    twoBed: 30,
    threeBed: 10,
  },
  rentableSF: 80000,
  grossSF: 100000,
  efficiency: 0.8,
  parkingSpaces: 120,
  parkingType: 'structured',
  amenitySF: 5000,
  stories: 6,
  farUtilized: 3.5,
  farMax: 4.0,
  lastModified: new Date().toISOString(),
};

const testAssumptions: FinancialAssumptions = {
  landCost: 5000000,
  marketRents: {
    studio: 1200,
    oneBed: 1600,
    twoBed: 2100,
    threeBed: 2800,
  },
  constructionCosts: {
    residentialPerSF: 250,
    parkingSurface: 5000,
    parkingStructured: 15000,
    parkingUnderground: 25000,
    amenityPerSF: 150,
    siteWork: 1000000,
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
    operatingExpensesPerUnit: 3500,
    propertyTaxRate: 0.01,
    insurancePerUnit: 400,
    utilitiesPerUnit: 500,
    repairsMaintenancePerUnit: 600,
    payrollPerUnit: 400,
  },
  debt: {
    loanToValue: 0.65,
    interestRate: 0.075,
    loanTerm: 10,
    amortization: 30,
    constructionLoanRate: 0.08,
    constructionPeriod: 24,
  },
  exitCapRate: 0.05,
  holdPeriod: 5,
  rentGrowth: 0.03,
  expenseGrowth: 0.025,
  leaseUpMonths: 12,
};

describe('calculateDevelopmentBudget', () => {
  it('should calculate hard costs correctly', () => {
    const budget = calculateDevelopmentBudget(testDesign, testAssumptions);

    // Residential: 80,000 SF * $250 = $20M
    expect(budget.hardCosts.residential).toBe(20000000);

    // Parking: 120 spaces * $15k (structured) = $1.8M
    expect(budget.hardCosts.parking).toBe(1800000);

    // Amenities: 5,000 SF * $150 = $750k
    expect(budget.hardCosts.amenities).toBe(750000);

    // Site work
    expect(budget.hardCosts.siteWork).toBe(1000000);

    // Contingency: 5% of subtotal
    const subtotal = 20000000 + 1800000 + 750000 + 1000000;
    expect(budget.hardCosts.contingency).toBeCloseTo(subtotal * 0.05, 0);

    // Total hard costs
    expect(budget.hardCosts.total).toBeCloseTo(subtotal + subtotal * 0.05, 0);
  });

  it('should calculate soft costs correctly', () => {
    const budget = calculateDevelopmentBudget(testDesign, testAssumptions);

    // A&E: 5% of hard costs
    expect(budget.softCosts.architectureEngineering).toBeCloseTo(budget.hardCosts.total * 0.05, 0);

    // Legal: 3% of hard costs
    expect(budget.softCosts.legalPermitting).toBeCloseTo(budget.hardCosts.total * 0.03, 0);

    // Marketing: $500/unit
    expect(budget.softCosts.marketing).toBe(50000);

    // Total soft costs should be sum of all components
    expect(budget.softCosts.total).toBeGreaterThan(0);
  });

  it('should calculate total development cost', () => {
    const budget = calculateDevelopmentBudget(testDesign, testAssumptions);

    const expectedTotal =
      testAssumptions.landCost + budget.hardCosts.total + budget.softCosts.total;

    expect(budget.totalDevelopmentCost).toBeCloseTo(expectedTotal, 0);
  });

  it('should calculate per-unit metrics', () => {
    const budget = calculateDevelopmentBudget(testDesign, testAssumptions);

    expect(budget.costPerUnit).toBe(budget.totalDevelopmentCost / testDesign.totalUnits);
    expect(budget.costPerSF).toBe(budget.totalDevelopmentCost / testDesign.rentableSF);
  });

  it('should handle different parking types', () => {
    const surfaceDesign = { ...testDesign, parkingType: 'surface' as const };
    const surfaceBudget = calculateDevelopmentBudget(surfaceDesign, testAssumptions);

    const undergroundDesign = { ...testDesign, parkingType: 'underground' as const };
    const undergroundBudget = calculateDevelopmentBudget(undergroundDesign, testAssumptions);

    const structuredBudget = calculateDevelopmentBudget(testDesign, testAssumptions);

    // Surface < Structured < Underground
    expect(surfaceBudget.hardCosts.parking).toBeLessThan(structuredBudget.hardCosts.parking);
    expect(structuredBudget.hardCosts.parking).toBeLessThan(undergroundBudget.hardCosts.parking);
  });
});

describe('calculateOperatingProForma', () => {
  const budget = calculateDevelopmentBudget(testDesign, testAssumptions);

  it('should calculate revenue correctly', () => {
    const proForma = calculateOperatingProForma(testDesign, testAssumptions, budget);
    const revenue = proForma.stabilizedYear.revenue;

    // Check individual unit type revenues
    expect(revenue.studio.total).toBe(testDesign.unitMix.studio * testAssumptions.marketRents.studio * 12);
    expect(revenue.oneBed.total).toBe(testDesign.unitMix.oneBed * testAssumptions.marketRents.oneBed * 12);
    expect(revenue.twoBed.total).toBe(testDesign.unitMix.twoBed * testAssumptions.marketRents.twoBed * 12);
    expect(revenue.threeBed.total).toBe(testDesign.unitMix.threeBed * testAssumptions.marketRents.threeBed * 12);

    // Check totals
    const expectedGPI =
      revenue.studio.total + revenue.oneBed.total + revenue.twoBed.total + revenue.threeBed.total;
    expect(revenue.grossPotentialIncome).toBeCloseTo(expectedGPI, 0);

    // Check vacancy
    expect(revenue.vacancy).toBeCloseTo(expectedGPI * testAssumptions.operating.vacancyRate, 0);

    // Check EGI
    expect(revenue.effectiveGrossIncome).toBeCloseTo(expectedGPI - revenue.vacancy, 0);
  });

  it('should calculate expenses correctly', () => {
    const proForma = calculateOperatingProForma(testDesign, testAssumptions, budget);
    const expenses = proForma.stabilizedYear.expenses;

    // Management: 3% of EGI
    const egi = proForma.stabilizedYear.revenue.effectiveGrossIncome;
    expect(expenses.management).toBeCloseTo(egi * 0.03, 0);

    // Property tax: 1% of total dev cost
    expect(expenses.propertyTax).toBeCloseTo(budget.totalDevelopmentCost * 0.01, 0);

    // Per-unit expenses
    expect(expenses.insurance).toBe(testDesign.totalUnits * testAssumptions.operating.insurancePerUnit);
    expect(expenses.utilities).toBe(testDesign.totalUnits * testAssumptions.operating.utilitiesPerUnit);

    // Total
    expect(expenses.total).toBeGreaterThan(0);
    expect(expenses.perUnit).toBe(expenses.total / testDesign.totalUnits);
  });

  it('should calculate NOI correctly', () => {
    const proForma = calculateOperatingProForma(testDesign, testAssumptions, budget);
    const cashFlow = proForma.stabilizedYear.cashFlow;

    const expectedNOI =
      proForma.stabilizedYear.revenue.effectiveGrossIncome - proForma.stabilizedYear.expenses.total;
    expect(cashFlow.netOperatingIncome).toBeCloseTo(expectedNOI, 0);
  });

  it('should calculate debt service when debt assumptions present', () => {
    const proForma = calculateOperatingProForma(testDesign, testAssumptions, budget);
    const cashFlow = proForma.stabilizedYear.cashFlow;

    expect(cashFlow.debtService).toBeGreaterThan(0);
    expect(cashFlow.cashFlowBeforeTax).toBe(cashFlow.netOperatingIncome - cashFlow.debtService);
  });

  it('should project 10 years with growth', () => {
    const proForma = calculateOperatingProForma(testDesign, testAssumptions, budget);

    expect(proForma.tenYearProjection.length).toBe(10);

    // Year 1 revenue should match stabilized
    expect(proForma.tenYearProjection[0].revenue.effectiveGrossIncome).toBeCloseTo(
      proForma.stabilizedYear.revenue.effectiveGrossIncome,
      0
    );

    // Year 10 revenue should be higher (3% annual growth)
    const year10Revenue = proForma.tenYearProjection[9].revenue.effectiveGrossIncome;
    const expectedGrowth = Math.pow(1 + testAssumptions.rentGrowth, 9);
    expect(year10Revenue).toBeCloseTo(
      proForma.stabilizedYear.revenue.effectiveGrossIncome * expectedGrowth,
      0
    );
  });
});

describe('calculateReturns', () => {
  const budget = calculateDevelopmentBudget(testDesign, testAssumptions);
  const proForma = calculateOperatingProForma(testDesign, testAssumptions, budget);

  it('should calculate yield on cost', () => {
    const returns = calculateReturns(budget, proForma, testAssumptions);

    const noi = proForma.stabilizedYear.cashFlow.netOperatingIncome;
    const expectedYield = noi / budget.totalDevelopmentCost;

    expect(returns.yieldOnCost).toBeCloseTo(expectedYield, 4);
  });

  it('should calculate development spread', () => {
    const returns = calculateReturns(budget, proForma, testAssumptions);

    const spread = (returns.yieldOnCost - testAssumptions.exitCapRate) * 10000;
    expect(returns.developmentSpread).toBeCloseTo(spread, 0);
  });

  it('should calculate levered IRR', () => {
    const returns = calculateReturns(budget, proForma, testAssumptions);

    expect(returns.leveredIRR).toBeGreaterThan(0);
    expect(returns.leveredIRR).toBeLessThan(1); // Should be < 100%
  });

  it('should calculate equity multiple', () => {
    const returns = calculateReturns(budget, proForma, testAssumptions);

    expect(returns.leveredEquityMultiple).toBeGreaterThan(1);
  });

  it('should calculate DSCR when debt present', () => {
    const returns = calculateReturns(budget, proForma, testAssumptions);

    expect(returns.debtServiceCoverageRatio).toBeGreaterThan(0);

    // DSCR should be NOI / Debt Service
    const noi = proForma.stabilizedYear.cashFlow.netOperatingIncome;
    const ds = proForma.stabilizedYear.cashFlow.debtService || 1;
    expect(returns.debtServiceCoverageRatio).toBeCloseTo(noi / ds, 2);
  });

  it('should calculate unlevered returns', () => {
    const returns = calculateReturns(budget, proForma, testAssumptions);

    expect(returns.unleveredIRR).toBeGreaterThan(0);
    expect(returns.unleveredIRR).toBeLessThan(returns.leveredIRR); // Unlevered should be lower
    expect(returns.unleveredEquityMultiple).toBeGreaterThan(1);
  });
});

describe('calculateSensitivityAnalysis', () => {
  const budget = calculateDevelopmentBudget(testDesign, testAssumptions);
  const proForma = calculateOperatingProForma(testDesign, testAssumptions, budget);

  it('should test multiple variables', () => {
    const sensitivity = calculateSensitivityAnalysis(testDesign, testAssumptions, budget, proForma);

    expect(sensitivity.variables.length).toBeGreaterThan(0);
    expect(sensitivity.variables.some((v) => v.name === 'Market Rents')).toBe(true);
    expect(sensitivity.variables.some((v) => v.name === 'Construction Cost')).toBe(true);
    expect(sensitivity.variables.some((v) => v.name === 'Exit Cap Rate')).toBe(true);
  });

  it('should calculate IRR impact for each variable', () => {
    const sensitivity = calculateSensitivityAnalysis(testDesign, testAssumptions, budget, proForma);

    sensitivity.variables.forEach((variable) => {
      expect(variable.impactOnIRR.negTen).toBeDefined();
      expect(variable.impactOnIRR.base).toBeDefined();
      expect(variable.impactOnIRR.posTen).toBeDefined();
    });
  });

  it('should identify most sensitive variable', () => {
    const sensitivity = calculateSensitivityAnalysis(testDesign, testAssumptions, budget, proForma);

    expect(sensitivity.mostSensitive).toBeDefined();
    expect(sensitivity.variables.some((v) => v.name === sensitivity.mostSensitive)).toBe(true);
  });

  it('should show rent sensitivity (higher rents = higher IRR)', () => {
    const sensitivity = calculateSensitivityAnalysis(testDesign, testAssumptions, budget, proForma);
    const rentVariable = sensitivity.variables.find((v) => v.name === 'Market Rents');

    expect(rentVariable).toBeDefined();
    expect(rentVariable!.impactOnIRR.posTen).toBeGreaterThan(rentVariable!.impactOnIRR.base);
    expect(rentVariable!.impactOnIRR.base).toBeGreaterThan(rentVariable!.impactOnIRR.negTen);
  });

  it('should show cost sensitivity (higher costs = lower IRR)', () => {
    const sensitivity = calculateSensitivityAnalysis(testDesign, testAssumptions, budget, proForma);
    const costVariable = sensitivity.variables.find((v) => v.name === 'Construction Cost');

    expect(costVariable).toBeDefined();
    expect(costVariable!.impactOnIRR.negTen).toBeGreaterThan(costVariable!.impactOnIRR.base);
    expect(costVariable!.impactOnIRR.base).toBeGreaterThan(costVariable!.impactOnIRR.posTen);
  });
});

describe('generateProForma (integration)', () => {
  it('should generate complete pro forma', () => {
    const proForma = generateProForma(testDesign, testAssumptions, 'deal-789');

    // Check all components present
    expect(proForma.id).toBeDefined();
    expect(proForma.dealId).toBe('deal-789');
    expect(proForma.design3D).toEqual(testDesign);
    expect(proForma.assumptions).toEqual(testAssumptions);
    expect(proForma.developmentBudget).toBeDefined();
    expect(proForma.operatingProForma).toBeDefined();
    expect(proForma.returns).toBeDefined();
    expect(proForma.sensitivity).toBeDefined();
    expect(proForma.calculatedAt).toBeDefined();
    expect(proForma.version).toBe(1);
  });

  it('should produce realistic financial metrics', () => {
    const proForma = generateProForma(testDesign, testAssumptions, 'deal-789');

    // Development budget should be reasonable
    expect(proForma.developmentBudget.totalDevelopmentCost).toBeGreaterThan(testAssumptions.landCost);
    expect(proForma.developmentBudget.costPerUnit).toBeGreaterThan(100000); // >$100k/unit
    expect(proForma.developmentBudget.costPerUnit).toBeLessThan(1000000); // <$1M/unit

    // NOI should be positive
    expect(proForma.operatingProForma.stabilizedYear.cashFlow.netOperatingIncome).toBeGreaterThan(0);

    // Returns should be realistic
    expect(proForma.returns.leveredIRR).toBeGreaterThan(0.05); // >5%
    expect(proForma.returns.leveredIRR).toBeLessThan(0.50); // <50%
    expect(proForma.returns.yieldOnCost).toBeGreaterThan(0.03); // >3%
    expect(proForma.returns.yieldOnCost).toBeLessThan(0.15); // <15%
  });
});
