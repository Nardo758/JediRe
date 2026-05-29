/**
 * Property Entity Types
 * Phase 1 — Property Plumbing Refactor
 *
 * These types mirror the new schema tables. Services use raw SQL (query())
 * consistent with the rest of the codebase; Drizzle types are in
 * backend/src/db/schema/propertyEntity.ts.
 */

// ----------------------------------------------------------------
// property_characteristics
// ----------------------------------------------------------------

export interface PropertyCharacteristic {
  id: string;
  propertyId: string;
  effectiveFrom: string;           // ISO date
  effectiveTo: string | null;      // null = currently active
  currentBuildingClass: string | null;
  unitCount: number | null;
  buildingSf: number | null;
  unitMix: Record<string, { count: number; sf: number }> | null;
  condition: string | null;
  lastRenovationYear: number | null;
  renovationScope: 'light' | 'moderate' | 'heavy' | 'gut' | null;
  source: 'county' | 'om' | 'costar' | 'operator' | 'agent' | null;
  sourceDate: string | null;
  confidence: number | null;
  provenance: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyCharacteristicInput {
  propertyId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  currentBuildingClass?: string | null;
  unitCount?: number | null;
  buildingSf?: number | null;
  unitMix?: Record<string, { count: number; sf: number }> | null;
  condition?: string | null;
  lastRenovationYear?: number | null;
  renovationScope?: string | null;
  source?: string | null;
  sourceDate?: string | null;
  confidence?: number | null;
  provenance?: Record<string, unknown> | null;
}

// ----------------------------------------------------------------
// property_operating_data
// ----------------------------------------------------------------

export type OperatingPeriodType = 'ttm' | 'monthly' | 'point_in_time';
export type OperatingDataSource = 't12' | 'rent_roll' | 'costar' | 'broker' | 'operator' | 'agent_derived' | 'county';

export interface PropertyOperatingData {
  id: string;
  propertyId: string;
  periodType: OperatingPeriodType;
  periodEnd: string;
  periodStart: string | null;
  avgRentPerUnit: number | null;
  askingRentPerUnit: number | null;
  effectiveRentPerUnit: number | null;
  occupancy: number | null;
  concessions: number | null;
  grossPotentialRent: number | null;
  effectiveGrossRevenue: number | null;
  totalOpex: number | null;
  noi: number | null;
  opexByLine: Record<string, number> | null;
  source: OperatingDataSource;
  sourceDate: string | null;
  confidence: number | null;
  isOwned: boolean;
  operatorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyOperatingDataInput {
  propertyId: string;
  periodType: OperatingPeriodType;
  periodEnd: string;
  periodStart?: string | null;
  avgRentPerUnit?: number | null;
  askingRentPerUnit?: number | null;
  effectiveRentPerUnit?: number | null;
  occupancy?: number | null;
  concessions?: number | null;
  grossPotentialRent?: number | null;
  effectiveGrossRevenue?: number | null;
  totalOpex?: number | null;
  noi?: number | null;
  opexByLine?: Record<string, number> | null;
  source: OperatingDataSource;
  sourceDate?: string | null;
  confidence?: number | null;
  isOwned?: boolean;
  operatorId?: string | null;
}

// ----------------------------------------------------------------
// property_sales
// ----------------------------------------------------------------

export type SaleSource = 'county_recorded' | 'costar' | 'operator_upload' | 'jedi_deal_close';

export interface PropertySale {
  id: string;
  propertyId: string;
  saleDate: string | null;
  salePrice: number | null;
  pricePerUnit: number | null;
  pricePerSf: number | null;
  buyer: string | null;
  seller: string | null;
  buyerOperatorId: string | null;
  sellerOperatorId: string | null;
  deedType: string | null;
  deedBookPage: string | null;
  financingType: string | null;
  loanAmount: number | null;
  loanTerms: Record<string, unknown> | null;
  impliedCapRate: number | null;
  relatedOperatingDataId: string | null;
  source: SaleSource;
  sourceId: string | null;
  sourceDate: string | null;
  confidence: number | null;
  isJediTracked: boolean;
  qualified: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertySaleInput {
  propertyId: string;
  saleDate?: string | null;
  salePrice?: number | null;
  pricePerUnit?: number | null;
  pricePerSf?: number | null;
  buyer?: string | null;
  seller?: string | null;
  buyerOperatorId?: string | null;
  sellerOperatorId?: string | null;
  deedType?: string | null;
  deedBookPage?: string | null;
  financingType?: string | null;
  loanAmount?: number | null;
  loanTerms?: Record<string, unknown> | null;
  impliedCapRate?: number | null;
  relatedOperatingDataId?: string | null;
  source: SaleSource;
  sourceId?: string | null;
  sourceDate?: string | null;
  confidence?: number | null;
  isJediTracked?: boolean;
  qualified?: boolean | null;
}
