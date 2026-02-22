/**
 * Financial Model Types
 * Types for 3D-integrated financial modeling
 */

// ===== 3D DESIGN INPUT TYPES =====

export interface UnitMix {
  studio: number;
  oneBed: number;
  twoBed: number;
  threeBed: number;
  fourBedPlus?: number;
}

export interface Design3D {
  id: string;
  dealId: string;
  totalUnits: number;
  unitMix: UnitMix;
  rentableSF: number;
  grossSF: number;
  efficiency: number; // rentableSF / grossSF
  parkingSpaces: number;
  parkingType: 'surface' | 'structured' | 'underground' | 'mixed';
  amenitySF: number;
  stories: number;
  farUtilized: number;
  farMax?: number;
  lastModified: string;
}

// ===== FINANCIAL ASSUMPTIONS =====

export interface MarketRents {
  studio: number;
  oneBed: number;
  twoBed: number;
  threeBed: number;
  fourBedPlus?: number;
}

export interface ConstructionCosts {
  residentialPerSF: number; // $/SF for residential space
  parkingSurface: number; // $/space for surface parking
  parkingStructured: number; // $/space for structured parking
  parkingUnderground: number; // $/space for underground parking
  amenityPerSF: number; // $/SF for amenity space
  siteWork: number; // Lump sum or % of hard costs
  contingency: number; // % of hard costs
}

export interface SoftCosts {
  architectureEngineering: number; // % of hard costs
  legalPermitting: number; // % of hard costs
  financing: number; // % of total dev cost
  marketing: number; // $ lump sum
  developerFee: number; // % of total dev cost
  totalPercent?: number; // Total soft costs as % of hard costs
}

export interface OperatingAssumptions {
  vacancyRate: number; // %
  managementFee: number; // % of EGI
  operatingExpensesPerUnit: number; // $/unit/year
  propertyTaxRate: number; // % of value
  insurancePerUnit: number; // $/unit/year
  utilitiesPerUnit: number; // $/unit/year
  repairsMaintenancePerUnit: number; // $/unit/year
  payrollPerUnit: number; // $/unit/year
}

export interface DebtAssumptions {
  loanToValue: number; // % (e.g., 0.65 for 65%)
  interestRate: number; // % (e.g., 0.08 for 8%)
  loanTerm: number; // years
  amortization: number; // years
  constructionLoanRate: number; // % for construction period
  constructionPeriod: number; // months
}

export interface FinancialAssumptions {
  landCost: number;
  marketRents: MarketRents;
  constructionCosts: ConstructionCosts;
  softCosts: SoftCosts;
  operating: OperatingAssumptions;
  debt?: DebtAssumptions;
  exitCapRate: number;
  holdPeriod: number; // years
  rentGrowth: number; // % annual
  expenseGrowth: number; // % annual
  leaseUpMonths: number; // months to stabilization
}

// ===== DEVELOPMENT BUDGET =====

export interface HardCosts {
  residential: number;
  parking: number;
  amenities: number;
  siteWork: number;
  contingency: number;
  total: number;
}

export interface SoftCostBreakdown {
  architectureEngineering: number;
  legalPermitting: number;
  financing: number;
  marketing: number;
  developerFee: number;
  other: number;
  total: number;
}

export interface DevelopmentBudget {
  landAcquisition: number;
  hardCosts: HardCosts;
  softCosts: SoftCostBreakdown;
  totalDevelopmentCost: number;
  costPerUnit: number;
  costPerSF: number;
}

// ===== OPERATING PRO FORMA =====

export interface RevenueProjection {
  studio: { units: number; rent: number; total: number };
  oneBed: { units: number; rent: number; total: number };
  twoBed: { units: number; rent: number; total: number };
  threeBed: { units: number; rent: number; total: number };
  fourBedPlus?: { units: number; rent: number; total: number };
  grossPotentialIncome: number;
  vacancy: number;
  effectiveGrossIncome: number;
}

export interface OperatingExpenses {
  management: number;
  propertyTax: number;
  insurance: number;
  utilities: number;
  repairsMaintenance: number;
  payroll: number;
  other: number;
  total: number;
  perUnit: number;
  percentOfEGI: number;
}

export interface CashFlow {
  effectiveGrossIncome: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  debtService?: number;
  cashFlowBeforeTax: number;
}

export interface YearlyProForma {
  year: number;
  revenue: RevenueProjection;
  expenses: OperatingExpenses;
  cashFlow: CashFlow;
}

export interface OperatingProForma {
  stabilizedYear: YearlyProForma;
  tenYearProjection: YearlyProForma[];
}

// ===== RETURNS ANALYSIS =====

export interface ReturnsMetrics {
  // Levered returns
  leveredIRR: number;
  leveredEquityMultiple: number;
  cashOnCashReturn: number;
  
  // Unlevered returns
  unleveredIRR: number;
  unleveredEquityMultiple: number;
  
  // Development metrics
  yieldOnCost: number; // NOI / Total Dev Cost
  developmentSpread: number; // Yield on cost - Exit cap rate (basis points)
  paybackPeriod: number; // years
  
  // Debt metrics
  debtServiceCoverageRatio: number;
  loanToValue: number;
  loanToCost: number;
}

// ===== SENSITIVITY ANALYSIS =====

export interface SensitivityVariable {
  name: string;
  baseValue: number;
  negTenPercent: number;
  posTenPercent: number;
  impactOnIRR: {
    negTen: number;
    base: number;
    posTen: number;
  };
}

export interface SensitivityAnalysis {
  variables: SensitivityVariable[];
  mostSensitive: string;
  monteCarlo?: {
    meanIRR: number;
    stdDevIRR: number;
    percentile10: number;
    percentile90: number;
  };
}

// ===== COMPLETE PRO FORMA =====

export interface ProForma {
  id: string;
  dealId: string;
  design3D: Design3D;
  assumptions: FinancialAssumptions;
  developmentBudget: DevelopmentBudget;
  operatingProForma: OperatingProForma;
  returns: ReturnsMetrics;
  sensitivity?: SensitivityAnalysis;
  calculatedAt: string;
  version: number;
}

// ===== NEIGHBORING PROPERTY SCENARIO =====

export interface NeighboringParcel {
  parcelId: string;
  address: string;
  askingPrice: number;
  lotSizeSF: number;
  additionalUnits: number;
  additionalSF: number;
}

export interface DevelopmentScenario {
  name: string;
  design: Design3D;
  landCost: number;
  developmentBudget: DevelopmentBudget;
  returns: ReturnsMetrics;
  incrementalIRR?: number; // Compared to base case
}

export interface NeighboringPropertyAnalysis {
  baseScenario: DevelopmentScenario;
  expansionScenarios: DevelopmentScenario[];
  recommendation?: {
    scenario: string;
    reason: string;
    additionalInvestment: number;
    incrementalIRR: number;
  };
}

// ===== REAL-TIME SYNC =====

export interface FinancialModelChange {
  field: string;
  oldValue: any;
  newValue: any;
  impact: {
    noi?: number;
    irr?: number;
    totalCost?: number;
  };
  timestamp: string;
}

export interface FinancialSyncState {
  isCalculating: boolean;
  lastSync: string | null;
  pendingChanges: FinancialModelChange[];
  errors: string[];
}

// ===== AI INTEGRATION HOOKS (Future) =====

export interface RentForecast {
  unitType: keyof UnitMix;
  predictedRent: number;
  confidence: number;
  marketComps: {
    address: string;
    rent: number;
    distance: number;
  }[];
  reasoning: string;
}

export interface CostBreakdown {
  hardCosts: HardCosts;
  confidence: number;
  comparableProjects: {
    name: string;
    costPerSF: number;
    similarity: number;
  }[];
  reasoning: string;
}
