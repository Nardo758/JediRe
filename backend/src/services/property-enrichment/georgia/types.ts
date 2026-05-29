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
  // Populated by ArcGIS returnCentroid=true, outSR=4326
  centroid_x?: number; // longitude (WGS84)
  centroid_y?: number; // latitude  (WGS84)
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
  // Populated by ArcGIS returnCentroid=true, outSR=4326
  centroid_x?: number; // longitude (WGS84)
  centroid_y?: number; // latitude  (WGS84)
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

/**
 * DeKalb parcel attributes sourced from iasWorldParcels/MapServer/0.
 * SALES FIELDS — NOT AVAILABLE: DeKalb's public ArcGIS server does not expose
 * any sale/transfer data. LSALEAMT/LSALEDT stubs are retained so saveSales()
 * can silently no-op; they will always be undefined at runtime.
 */
export interface DeKalbParcel {
  PARCELID: string;
  LOWPARCELID?: string;   // alternate parcel ID format
  CLASSCD?: string;       // class code (e.g. R1, R4)
  CLASSDSCRP?: string;    // class description
  SITEADDRESS?: string;
  OWNERNME1?: string;
  OWNERNME2?: string;
  CNTASSDVAL?: number;    // current assessed value
  LNDVALUE?: number;      // land value
  TOTAPR1?: number;       // total appraised value
  ZONING?: string;
  // iasWorldParcels-specific enrichment fields
  RESYRBLT?: number;      // year built (residential)
  BLDGAREA?: number;      // total building area (sqft)
  RESFLRAREA?: number;    // residential floor area (sqft)
  FLOORCOUNT?: number;    // number of stories
  USECD?: string;         // use code
  USEDSCRP?: string;      // use description
  NGHBRHDCD?: string;     // neighborhood code
  CITY?: string;
  // Populated by ArcGIS returnCentroid=true, outSR=4326
  centroid_x?: number;    // longitude (WGS84)
  centroid_y?: number;    // latitude  (WGS84)
  // Sale stubs — confirmed absent from all DeKalb ArcGIS layers (2025-05-29)
  SALEDATE?: number;
  SALEPRICE?: number;
  SALEAMT?: number;
  LSALEAMT?: number;
  LSALEDT?: number;
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
  TotAppr?: number;  // not exposed by gismaps.fultoncountyga.gov/arcgispub
  LUCode: string;
  ClassCode?: string;
  // Populated by centroid extraction from polygon rings (server doesn't support returnCentroid)
  centroid_x?: number; // longitude (WGS84)
  centroid_y?: number; // latitude  (WGS84)
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
  
  // Geocoordinates (WGS84)
  latitude?: number;
  longitude?: number;

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
