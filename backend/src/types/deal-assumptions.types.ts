/**
 * Deal Assumptions Types
 * 
 * Complete type definitions for deal underwriting data
 */

// ============================================
// SITE DATA (from Municipal API)
// ============================================

export interface SiteData {
  // Parcel
  lotSizeAcres: number | null;
  lotSizeSqft: number | null;
  parcelId: string | null;
  
  // Zoning
  zoningCode: string | null;
  zoningDescription: string | null;
  maxFar: number | null;
  maxStories: number | null;
  maxHeightFt: number | null;
  maxDensityUpa: number | null;  // units per acre
  maxUnits: number | null;
  
  // Parking
  parkingRequired: number | null;  // spaces per unit
  parkingSpaces: number | null;
  
  // Setbacks
  frontSetbackFt: number | null;
  sideSetbackFt: number | null;
  rearSetbackFt: number | null;
  
  // Coverage
  maxLotCoverage: number | null;  // percentage
  buildableAreaSqft: number | null;
  
  // Location
  municipality: string | null;
  jurisdiction: string | null;
  
  // Source tracking
  zoningSource: 'manual' | 'municipal_api' | 'county_gis';
  zoningConfidence: number;  // 0-100
  zoningUpdatedAt: Date | null;
}

// ============================================
// DEVELOPMENT ASSUMPTIONS
// ============================================

export interface UnitMixItem {
  type: 'studio' | '1br' | '2br' | '3br';
  count: number;
  sf: number;
  rent: number;
  pct?: number;
}

export interface DealAssumptions {
  id: string;
  dealId: string;
  
  // Land & Acquisition
  landCost: number | null;
  landCostPerAcre: number | null;
  acquisitionCosts: number | null;
  
  // Construction Costs
  hardCostPsf: number | null;
  hardCostTotal: number | null;
  softCostPct: number;  // default 25%
  softCostTotal: number | null;
  contingencyPct: number;  // default 5%
  contingencyTotal: number | null;
  developerFeePct: number;  // default 4%
  developerFeeTotal: number | null;
  
  // Total Development Cost
  tdc: number | null;
  tdcPerUnit: number | null;
  tdcPerSf: number | null;
  
  // Building Design
  totalUnits: number | null;
  avgUnitSf: number;  // default 900
  grossSf: number | null;
  rentableSf: number | null;
  efficiency: number;  // default 0.85
  stories: number | null;
  constructionType: 'wood_frame' | 'podium' | 'concrete' | 'steel' | null;
  parkingType: 'surface' | 'tuck_under' | 'structured' | 'none' | null;
  
  // Unit Mix
  unitMix: UnitMixItem[];
  
  // Revenue Assumptions
  avgRentPerUnit: number | null;
  avgRentPsf: number | null;
  otherIncomePerUnit: number;  // default 50
  vacancyPct: number;  // default 5%
  concessionsPct: number;  // default 0%
  rentGrowthYr1: number;  // default 3%
  rentGrowthStabilized: number;  // default 2.5%
  
  // Operating Expenses
  opexRatio: number;  // default 35%
  opexPerUnit: number | null;
  propertyTaxRate: number | null;
  insurancePerUnit: number | null;
  managementFeePct: number;  // default 3%
  replacementReservesPerUnit: number;  // default 250
  
  // Financing
  interestRate: number | null;
  loanTermYears: number;  // default 3
  ltc: number;  // default 65%
  ltv: number | null;
  debtYieldMin: number | null;
  dscrMin: number;  // default 1.25
  amortizationYears: number;  // default 30
  ioPeriodMonths: number;  // default 36
  originationFeePct: number;  // default 1%
  
  // Exit Assumptions
  exitCap: number;  // default 5%
  holdPeriodYears: number;  // default 5
  dispositionCostPct: number;  // default 2%
  
  // Computed Returns
  noiStabilized: number | null;
  yieldOnCost: number | null;
  cashOnCashYr1: number | null;
  irrLevered: number | null;
  irrUnlevered: number | null;
  equityMultiple: number | null;
  profitMargin: number | null;
  stabilizedValue: number | null;
  
  // Source tracking
  assumptionsSource: 'manual' | 'market_comps' | 'template';
  lastComputedAt: Date | null;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// MARKET DATA
// ============================================

export interface RentByType {
  [unitType: string]: {
    avgRent: number;
    avgSf: number;
    sampleSize: number;
  };
}

export interface DealMarketData {
  id: string;
  dealId: string;
  
  // Submarket Info
  submarketName: string | null;
  submarketId: string | null;
  msa: string | null;
  
  // Rent Comps
  compAvgRent: number | null;
  compAvgRentPsf: number | null;
  compCount: number | null;
  rentPercentile: number | null;  // where subject sits vs comps (1-100)
  rentByType: RentByType;
  
  // Occupancy
  submarketOccupancy: number | null;
  compAvgOccupancy: number | null;
  
  // Supply Pipeline
  pipelineUnits: number | null;
  pipelineDeliveries12mo: number | null;
  pipelineDeliveries24mo: number | null;
  
  // Demand
  absorption12mo: number | null;
  demandScore: number | null;  // 1-100
  
  // Growth
  rentGrowthTrailing12mo: number | null;
  rentGrowthForecast12mo: number | null;
  
  // Demographics
  medianHhIncome: number | null;
  population1mi: number | null;
  population3mi: number | null;
  populationGrowth5yr: number | null;
  
  // Source tracking
  dataSource: 'costar' | 'yardi' | 'apartments_com' | 'manual' | null;
  dataAsOf: Date | null;
  confidence: number;  // 0-100
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// INPUT TYPES (for API)
// ============================================

export interface DealAssumptionsInput {
  landCost?: number;
  hardCostPsf?: number;
  softCostPct?: number;
  contingencyPct?: number;
  developerFeePct?: number;
  totalUnits?: number;
  avgUnitSf?: number;
  efficiency?: number;
  stories?: number;
  constructionType?: string;
  parkingType?: string;
  unitMix?: UnitMixItem[];
  avgRentPerUnit?: number;
  vacancyPct?: number;
  opexRatio?: number;
  interestRate?: number;
  ltc?: number;
  exitCap?: number;
  holdPeriodYears?: number;
}

export interface SiteDataInput {
  lotSizeAcres?: number;
  parcelId?: string;
  zoningCode?: string;
  maxFar?: number;
  maxStories?: number;
  maxUnits?: number;
  parkingRequired?: number;
  zoningSource?: 'manual' | 'municipal_api' | 'county_gis';
}

// ============================================
// COMPUTED RETURNS
// ============================================

export interface ComputedReturns {
  // Development Costs
  tdc: number;
  tdcPerUnit: number;
  tdcPerSf: number;
  
  // Revenue
  grossPotentialRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noiStabilized: number;
  
  // Financing
  loanAmount: number;
  equityRequired: number;
  annualDebtService: number;
  
  // Returns
  yieldOnCost: number;
  stabilizedValue: number;
  profit: number;
  profitMargin: number;
  cashOnCashYr1: number;
  irrLevered: number;
  irrUnlevered: number;
  equityMultiple: number;
  
  // Ratios
  dscr: number;
  debtYield: number;
  ltv: number;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_ASSUMPTIONS: Partial<DealAssumptions> = {
  softCostPct: 25,
  contingencyPct: 5,
  developerFeePct: 4,
  avgUnitSf: 900,
  efficiency: 0.85,
  otherIncomePerUnit: 50,
  vacancyPct: 5,
  concessionsPct: 0,
  rentGrowthYr1: 3,
  rentGrowthStabilized: 2.5,
  opexRatio: 35,
  managementFeePct: 3,
  replacementReservesPerUnit: 250,
  loanTermYears: 3,
  ltc: 0.65,
  dscrMin: 1.25,
  amortizationYears: 30,
  ioPeriodMonths: 36,
  originationFeePct: 1,
  exitCap: 0.05,
  holdPeriodYears: 5,
  dispositionCostPct: 2,
};
