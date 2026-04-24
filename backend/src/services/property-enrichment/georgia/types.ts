/**
 * Georgia Metro Data Types
 * Shared types for Cobb, Gwinnett, DeKalb, Fulton county data ingestion
 */

// ============================================================================
// COBB COUNTY
// ============================================================================

export interface CobbParcel {
  PIN: string;
  PARID: string;
  SITUS_ADDR: string;
  OWNER_NAM1: string;
  OWNER_NAM2?: string;
  FMV_LAND: number;
  FMV_BLDG: number;
  FMV_TOTAL: number;
  ASV_TOTAL: number;
  CLASS: string;
  HAS_MULTIUNIT: string; // 'Y' or 'N'
}

export interface CobbYearBuilt {
  PIN: string;
  TAXYR: number;
  CARD: number;
  YRBLT: number;
  SQFT: number;
}

export interface CobbParcelSale {
  PIN: string;
  SALEDT: number; // Unix timestamp
  PRICE: number;
  SALETYPE: string;
  SALEVAL: string;
  INSTRTYP: string;
  APRTOT: number;
  ASR: number;
  NBHD: string;
}

// ============================================================================
// GWINNETT COUNTY
// ============================================================================

export interface GwinnettParcel {
  PIN: string;
  TAXPIN: string;
  LRSN: string; // Primary join key
  ADDRESS: string;
}

export interface GwinnettTaxMaster {
  LRSN: string;
  OWNER1: string;
  OWNER2?: string;
  TOTVAL1: number;
  PROPCLAS: string;
  PCDESC: string;
  ZONING: string;
  GRANTOR1?: string;
  GRANTOR2?: string;
  GRANTOR3?: string;
  DOC1REF?: string;
}

export interface GwinnettPropertyImprovement {
  LRSN: string;
  YRBUILT: number;
  STORIES: number;
  FINSIZE: number; // sqft
  USECODE: string;
  USEDESC: string;
  CONDCODE: string;
  NUMBDRMS: number;
}

export interface GwinnettLandValue {
  LRSN: string;
  SALE1D?: number; // Sale 1 date
  SALE1AMT?: number;
  SALE2D?: number;
  SALE2AMT?: number;
  SALE3D?: number;
  SALE3AMT?: number;
  GRANTOR1?: string;
  GRANTOR2?: string;
  GRANTOR3?: string;
  NUMDWLG: number;
}

// ============================================================================
// DEKALB COUNTY
// ============================================================================

export interface DeKalbParcel {
  PARCELID: string;
  CLASSCD: string;
  SITEADDRESS: string;
  OWNERNME1: string;
  CNTASSDVAL: number;
  TOTAPR1: number;
  ZONING: string;
}

export interface DeKalbPermit {
  OBJECTID: number;
  cooIssuedDateTime: number; // CO date = year built proxy
  squareFootage: number;
  WorkTypeDescription: string;
  locationLine1: string; // Address for matching
  PermitNumber?: string;
  PermitType?: string;
}

// ============================================================================
// FULTON COUNTY
// ============================================================================

export interface FultonParcel {
  ParcelID: string;
  LivUnits: number;
  TotAppr: number;
  LUCode: string;
}

export interface FultonYearlySale {
  ParID: string;
  Price: number;
  TaxYear: number;
}

export interface FultonStructure {
  FeatureID: string;
  YearBuilt: number;
  Stories: number;
  LiveUnits: number;
  AreaSqFt: number;
  // Geometry for spatial join
  geometry?: {
    rings: number[][][];
    spatialReference: { wkid: number };
  };
}

// ============================================================================
// UNIFIED TYPES
// ============================================================================

export interface PropertySale {
  id?: string;
  parcelId: string;
  county: string;
  state: string;
  saleDate: Date;
  salePrice: number;
  grantorName?: string;
  granteeName?: string;
  saleType?: string;
  bookPage?: string;
  qualified?: boolean;
  createdAt?: Date;
}

export interface EnrichedProperty {
  parcelId: string;
  address: string;
  city?: string;
  county: string;
  state: string;
  
  // Owner
  ownerName: string;
  ownerName2?: string;
  
  // Physical
  yearBuilt?: number;
  sqft?: number;
  stories?: number;
  units?: number;
  
  // Values
  landValue?: number;
  buildingValue?: number;
  totalValue?: number;
  assessedValue?: number;
  
  // Classification
  propertyClass?: string;
  zoning?: string;
  isMultifamily: boolean;
  
  // Sales history
  sales?: PropertySale[];
  
  // Metadata
  provider: string;
  fetchedAt: Date;
}

export interface IngestionJob {
  id: string;
  county: string;
  state: string;
  jobType: 'parcels' | 'year_built' | 'sales' | 'permits' | 'full';
  status: 'pending' | 'running' | 'complete' | 'failed';
  
  // Progress
  totalRecords: number;
  processedRecords: number;
  insertedRecords: number;
  updatedRecords: number;
  errorCount: number;
  errors: string[];
  
  // Timing
  startedAt?: Date;
  completedAt?: Date;
}

export interface IngestionConfig {
  batchSize: number;
  maxRecords?: number;
  filterMultifamilyOnly: boolean;
  includeResidential: boolean;
  minUnits?: number;
}

export const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
  batchSize: 1000,
  filterMultifamilyOnly: false,
  includeResidential: true,
};
