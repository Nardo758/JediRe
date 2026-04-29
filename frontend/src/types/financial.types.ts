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

  // ─── Spec §5/§11 extensions (Tier 0) ───
  /** Which revenue formula generated this projection. */
  formula?: RevenueFormulaId;
  /** Decomposed rent terminology that fed the formula. */
  rentTerms?: RentTerminology;
  /** Concessions deducted (already netted into effectiveGrossIncome). */
  concessions?: number;
  /** Loss-to-lease deducted (already netted into effectiveGrossIncome). */
  lossToLease?: number;
}

/**
 * Operating Expenses — 9-line stack
 *
 * Per F9 Pro Forma spec §7 the canonical OPEX taxonomy is exactly nine lines,
 * each with its own growth driver (CPI, wage index, % of EGI, M26 tax growth).
 * Legacy callers still set `management`, `payroll`, `other`; new code should
 * prefer the explicit 9-line keys.
 */
export interface OperatingExpenses {
  // ─── Spec §7 canonical 9-line stack ───
  propertyTax: number;
  insurance: number;
  utilities: number;
  repairsMaintenance: number;
  managementFee: number;       // % of EGI driver (preferred over `management`)
  payroll: number;             // wage-index driver
  marketingAdmin: number;      // CPI driver
  replacementReserves: number; // CPI driver
  other: number;               // CPI driver

  // ─── Legacy alias (kept for backwards compat — equals managementFee) ───
  management?: number;

  // ─── Roll-ups ───
  total: number;
  perUnit: number;
  percentOfEGI: number;
}

/**
 * Selectable revenue formula (spec §11). The default is `mark_to_market`:
 * every unit re-rents at market on turnover, closing the loss-to-lease gap.
 */
export type RevenueFormulaId =
  | 'mark_to_market'
  | 'in_place_compounding'
  | 'renewal_aware'
  | 'rent_ramp_value_add'
  | 'gpr_minus_loss_to_lease';

export const DEFAULT_REVENUE_FORMULA: RevenueFormulaId = 'mark_to_market';

/**
 * Rent terminology (spec §5). Each field is optional so callers can populate
 * progressively as data arrives. Used by the new `mark_to_market` formula.
 */
export interface RentTerminology {
  grossPotentialRent?: number;   // GPR — sum of contracted rent at full occupancy
  marketRent?: number;           // What a unit leases for today on a new lease
  inPlaceRent?: number;          // Rent currently being paid
  effectiveRent?: number;        // Market rent net of concessions
  concessions?: number;          // Free months / gift cards amortised over lease term
  lossToLease?: number;          // Market - in-place, % of GPR
  newLeaseRent?: number;         // Brand-new lease rent
  renewalRent?: number;          // Renewing tenant rent
  turnoverRatePerYear?: number;  // Annual turnover ratio (drives mark_to_market)
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
