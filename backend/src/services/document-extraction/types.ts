export type DocumentType =
  | 'T12'
  | 'RENT_ROLL'
  | 'AGED_RECEIVABLES'
  | 'BOX_SCORE'
  | 'CONCESSION_BURNOFF'
  | 'T30_LTO'
  | 'TAX_BILL'
  | 'OTHER_INCOME'
  | 'UNKNOWN';

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  hints: string[];
}

export interface ExtractionResult {
  documentType: DocumentType;
  success: boolean;
  error?: string;
  data: any;
  summary: Record<string, any>;
  warnings: string[];
}

export interface T12Data {
  months: T12Month[];
  summary: {
    t12Revenue: number;
    t12OpEx: number;
    t12NOI: number;
    expenseRatio: number;
    impliedOccupancy: number | null;
    totalUnits: number | null;
    periodStart: string;
    periodEnd: string;
  };
}

export interface T12Month {
  reportMonth: string;
  grossPotentialRent: number | null;
  lossToLease: number | null;
  vacancyLoss: number | null;
  concessions: number | null;
  badDebt: number | null;
  netRentalIncome: number | null;
  otherIncome: number | null;
  utilityReimbursement: number | null;
  lateFees: number | null;
  miscIncome: number | null;
  effectiveGrossIncome: number | null;
  payroll: number | null;
  repairsMaintenance: number | null;
  turnoverCosts: number | null;
  marketing: number | null;
  adminGeneral: number | null;
  managementFee: number | null;
  utilities: number | null;
  contractServices: number | null;
  propertyTax: number | null;
  insurance: number | null;
  totalOpex: number | null;
  noi: number | null;
  totalUnits: number | null;
  occupiedUnits: number | null;
}

export interface RentRollUnit {
  unitNumber: string;
  unitType: string;
  sqft: number | null;
  status: string;
  tenantName: string | null;
  marketRent: number | null;
  leaseRent: number | null;
  effectiveRent: number | null;
  charges: Record<string, number>;
  totalCharges: number;
  deposit: number | null;
  balance: number | null;
  moveInDate: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  moveOutDate: string | null;
  isFutureResident: boolean;
}

export interface RentRollData {
  units: RentRollUnit[];
  summary: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    totalMarketRent: number;
    totalLeaseCharges: number;
    lossToLease: number;
    lossToLeasePct: number;
    avgMarketRent: number;
    avgEffectiveRent: number;
    futureResidents: number;
    floorPlanMix: Record<string, { count: number; avgRent: number; avgSqft: number }>;
  };
}

export interface AgingRecord {
  unitNumber: string;
  tenantName: string | null;
  currentBalance: number;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  prepaid: number;
  totalBalance: number;
  leaseStatus: string | null;
}

export interface AgedReceivablesData {
  records: AgingRecord[];
  summary: {
    totalAR: number;
    total_0_30: number;
    total_31_60: number;
    total_61_90: number;
    total_90_plus: number;
    totalPrepaid: number;
    seriousDelinquencyRate: number;
    unitsDelinquent: number;
    totalUnits: number;
  };
}

export interface BoxScoreAvailability {
  floorPlan: string;
  occupied: number;
  vacant: number;
  notice: number;
  rented: number;
  model: number;
  down: number;
  admin: number;
  total: number;
  occupancyPct: number;
  leasedPct: number;
}

export interface BoxScoreActivity {
  moveIns: number;
  moveOuts: number;
  notices: number;
  renewals: number;
  transfers: number;
  mtmConversions: number;
  evictions: number;
  skips: number;
}

export interface BoxScoreConversion {
  channel: string;
  firstContacts: number;
  shows: number;
  applied: number;
  approved: number;
  leased: number;
  conversionRate: number;
}

export interface BoxScoreData {
  availability: BoxScoreAvailability[];
  activity: BoxScoreActivity;
  conversions: BoxScoreConversion[];
  summary: {
    totalUnits: number;
    totalOccupied: number;
    totalVacant: number;
    occupancyPct: number;
    leasedPct: number;
    netAbsorption: number;
    overallConversionRate: number;
  };
}

export interface ConcessionRecord {
  unitNumber: string;
  tenantName: string | null;
  unitType: string | null;
  totalRecurring: number;
  currentConcession: number;
  remainingAmount: number;
  endDate: string | null;
  leaseTerm: number | null;
  marketRent: number | null;
  leaseRent: number | null;
}

export interface ConcessionBurnoffData {
  records: ConcessionRecord[];
  summary: {
    totalActiveConcessions: number;
    totalLiability: number;
    totalRemainingLiability: number;
    avgConcessionDepth: number;
    burnoffCalendar: Array<{ month: string; expiringAmount: number; expiringUnits: number }>;
    byFloorPlan: Record<string, { count: number; avgConcession: number; totalLiability: number }>;
  };
}

export interface LTORecord {
  unitNumber: string;
  unitType: string | null;
  transactionType: string;
  leaseRent: number;
  concession: number;
  effectiveRent: number;
  marketRent: number | null;
  priorRent: number | null;
  rentChange: number | null;
  rentChangePct: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  tenantName: string | null;
}

export interface LTOData {
  records: LTORecord[];
  summary: {
    totalTransactions: number;
    newLeases: number;
    renewals: number;
    avgNewLeaseRent: number;
    avgRenewalRent: number;
    avgTradeOutGain: number;
    avgTradeOutGainPct: number;
    avgNewTradeOut: number;
    avgRenewalTradeOut: number;
  };
}

export interface TaxBillData {
  parcelId: string | null;
  assessedValue: number | null;
  assessedLand: number | null;
  assessedImprovement: number | null;
  assessedValueAppeal: number | null;
  fairMarketValue: number | null;
  totalAnnualTax: number;
  millageRate: number | null;
  taxingAuthority: string | null;
  ownerName: string | null;
  ownerAddress: string | null;
  appealStatus: string | null;
  taxYear: number | null;
  authorities: Array<{ name: string; rate: number; amount: number }>;
}

export interface OtherIncomeCategory {
  category: string;
  description: string | null;
  unitCount: number | null;
  perUnitAmount: number | null;
  totalAnnual: number;
  totalMonthly: number;
  assumptions: string | null;
}

export interface OtherIncomeData {
  categories: OtherIncomeCategory[];
  summary: {
    totalAnnual: number;
    totalMonthly: number;
    categoryCount: number;
    perUnitTotal: number | null;
  };
}

export interface PipelineResult {
  dealId: string;
  documentsProcessed: number;
  results: Array<{
    filename: string;
    documentType: DocumentType;
    success: boolean;
    error?: string;
    rowsInserted?: number;
  }>;
  capsuleUpdated: boolean;
  libraryUpdated: boolean;
  alerts: string[];
}
