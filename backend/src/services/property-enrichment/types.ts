/**
 * Property Enrichment Types
 * Universal types for property data across all providers
 */

// ============================================================================
// STREAM 1: PROPERTY INFO (Public Records)
// ============================================================================

export interface PropertyInfo {
  // Identifiers
  parcelId: string;
  parcelNumber?: string;
  altParcelId?: string;
  
  // Address
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  
  // Location
  latitude: number;
  longitude: number;
  
  // Physical Characteristics
  yearBuilt?: number;
  effectiveYearBuilt?: number;
  numberOfBuildings?: number;
  numberOfUnits?: number;
  stories?: number;
  livingAreaSqFt?: number;
  grossAreaSqFt?: number;
  landSqFt?: number;
  acres?: number;
  hasPool?: boolean;
  
  // Land Use & Zoning
  zoning?: string;
  zoningDescription?: string;
  landUseCode?: string;
  landUseDescription?: string;
  futureLandUse?: string;
  propertyType?: 'multifamily' | 'office' | 'retail' | 'industrial' | 'land' | 'mixed_use' | 'other';
  
  // Ownership
  ownerName?: string;
  ownerName2?: string;
  ownerMailingAddress?: string;
  ownerMailingCity?: string;
  ownerMailingState?: string;
  ownerMailingZip?: string;
  
  // Subdivision
  subdivisionName?: string;
  subdivisionUnit?: string;
  legalDescription?: string;
  
  // Valuation
  justValue?: number;
  assessedValue?: number;
  landValue?: number;
  buildingValue?: number;
  extraFeatureValue?: number;
  taxableValueCounty?: number;
  taxableValueSchool?: number;
  
  // Sales History
  lastSaleDate?: Date;
  lastSaleAmount?: number;
  lastSaleBook?: string;
  lastSalePage?: string;
  previousOwnerName?: string;
  
  // Risk/Environmental
  femaFloodZone?: string;
  windCode?: string;
  evacuationZone?: string;
  wetlands?: string;
  
  // Utilities
  waterProvider?: string;
  sewerProvider?: string;
  
  // Administrative
  jurisdiction?: string;
  taxArea?: string;
  commissionDistrict?: string;
  censusTract?: string;
  censusBlockGroup?: string;
  
  // Metadata
  provider: string;
  fetchedAt: Date;
  rawData?: Record<string, unknown>;
}

// ============================================================================
// STREAM 2: RENT DATA (Market Data)
// ============================================================================

export interface UnitType {
  beds: number;
  baths: number;
  sqFt: number;
  unitCount: number;
  askingRent: number;
  effectiveRent?: number;
  rentPerSqFt?: number;
  floorPlanName?: string;
}

export interface RentData {
  propertyName?: string;
  
  // Unit Mix
  unitMix: UnitType[];
  totalUnits: number;
  
  // Rent Metrics
  avgAskingRent: number;
  avgEffectiveRent?: number;
  avgRentPerSqFt?: number;
  minRent?: number;
  maxRent?: number;
  
  // Occupancy
  occupancyPct?: number;
  availableUnits?: number;
  
  // Concessions
  concessions?: string;
  concessionValue?: number;
  concessionPct?: number;
  
  // Amenities
  unitAmenities?: string[];
  communityAmenities?: string[];
  
  // Lease Terms
  leaseTerms?: string[];
  petPolicy?: string;
  applicationFee?: number;
  depositRange?: string;
  
  // Contact
  propertyWebsite?: string;
  phoneNumber?: string;
  
  // Metadata
  provider: string;
  asOfDate: Date;
  fetchedAt: Date;
  rawData?: Record<string, unknown>;
}

// ============================================================================
// UNIFIED PROPERTY PROFILE
// ============================================================================

export interface PropertyProfile {
  id: string;
  
  // Core Identity
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  propertyName?: string;
  
  // Coordinates
  latitude: number;
  longitude: number;
  
  // Combined Data
  propertyInfo?: PropertyInfo;
  rentData?: RentData;
  
  // Data Quality
  dataQualityScore: number; // 0-100
  missingFields: string[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  propertyInfoFetchedAt?: Date;
  rentDataFetchedAt?: Date;
}

// ============================================================================
// PROVIDER INTERFACES
// ============================================================================

export interface ProviderConfig {
  name: string;
  type: 'property_info' | 'rent_data';
  enabled: boolean;
  priority: number; // Lower = higher priority
  
  // Coverage
  coverageStates?: string[];
  coverageCounties?: string[];
  coverageMSAs?: string[];
  
  // Rate Limiting
  requestsPerMinute?: number;
  requestsPerDay?: number;
  
  // Auth
  requiresAuth?: boolean;
  authConfig?: Record<string, unknown>;
}

export interface PropertyInfoProvider {
  readonly config: ProviderConfig;
  
  // Check if provider can handle this location
  canHandle(address: string, city: string, state: string, county?: string): Promise<boolean>;
  
  // Fetch property info
  fetchPropertyInfo(
    address: string,
    city: string,
    state: string,
    zip?: string,
    coordinates?: { lat: number; lng: number }
  ): Promise<PropertyInfo | null>;
  
  // Health check
  healthCheck(): Promise<boolean>;
}

export interface RentDataProvider {
  readonly config: ProviderConfig;
  
  // Check if provider can handle this property
  canHandle(address: string, city: string, state: string): Promise<boolean>;
  
  // Fetch rent data
  fetchRentData(
    address: string,
    city: string,
    state: string,
    propertyName?: string
  ): Promise<RentData | null>;
  
  // Health check
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// ENRICHMENT JOB
// ============================================================================

export type EnrichmentStatus = 'pending' | 'running' | 'complete' | 'partial' | 'failed';

export interface EnrichmentJob {
  id: string;
  propertyId?: string;
  
  // Input
  address: string;
  city: string;
  state: string;
  zip?: string;
  county?: string;
  coordinates?: { lat: number; lng: number };
  
  // Stream 1: Property Info
  propertyInfoStatus: EnrichmentStatus;
  propertyInfoProvider?: string;
  propertyInfoError?: string;
  propertyInfo?: PropertyInfo;
  
  // Stream 2: Rent Data
  rentDataStatus: EnrichmentStatus;
  rentDataProvider?: string;
  rentDataError?: string;
  rentData?: RentData;
  
  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// GEOCODING
// ============================================================================

export interface GeocodeResult {
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  latitude: number;
  longitude: number;
  confidence: number;
  provider: string;
}

// ============================================================================
// COUNTY API PATTERNS
// ============================================================================

/**
 * County GIS systems generally fall into these patterns:
 */
export type CountyAPIPattern = 
  | 'arcgis_featureserver'    // Esri ArcGIS FeatureServer (most common)
  | 'arcgis_mapserver'        // Esri ArcGIS MapServer
  | 'accela_gis'              // Accela-integrated ArcGIS
  | 'cama_api'                // CAMA system API
  | 'property_appraiser_web'  // Web scraping required
  | 'custom_api';             // Custom county API

export interface CountyAPIConfig {
  county: string;
  state: string;
  fipsCode: string;
  pattern: CountyAPIPattern;
  
  // Endpoints
  baseUrl: string;
  parcelsEndpoint?: string;
  addressEndpoint?: string;
  permitsEndpoint?: string;
  
  // Layer IDs (for ArcGIS)
  parcelsLayerId?: number;
  addressLayerId?: number;
  zoningLayerId?: number;
  
  // Field Mappings
  fieldMappings: CountyFieldMappings;
  
  // Search Config
  searchField: string;
  searchType: 'address' | 'parcel' | 'coordinates';
  
  // Quirks
  requiresGeometry?: boolean;
  spatialReferenceWkid?: number;

  // Set true to skip this provider during enrichment runs (e.g. endpoint is dead/blocked)
  disabled?: boolean;
}

/**
 * Field mappings from county-specific names to standard names
 */
export interface CountyFieldMappings {
  // Identifiers
  parcelId: string;
  parcelNumber?: string;
  
  // Address
  fullAddress?: string;
  streetNumber?: string;
  streetName?: string;
  city?: string;
  zip?: string;
  
  // Physical
  yearBuilt?: string;
  effectiveYearBuilt?: string;
  numberOfBuildings?: string;
  numberOfUnits?: string;
  livingArea?: string;
  grossArea?: string;
  landSqFt?: string;
  acres?: string;
  
  // Zoning
  zoning?: string;
  landUseCode?: string;
  landUseDescription?: string;
  futureLandUse?: string;
  
  // Ownership
  ownerName?: string;
  ownerName2?: string;
  ownerAddress?: string;
  ownerCity?: string;
  ownerState?: string;
  ownerZip?: string;
  
  // Valuation
  justValue?: string;
  assessedValue?: string;
  landValue?: string;
  buildingValue?: string;
  taxableValue?: string;
  
  // Sales
  saleDate?: string;
  saleAmount?: string;
  saleBook?: string;
  salePage?: string;
  
  // Subdivision
  subdivisionName?: string;
  legalDescription?: string;
  
  // Risk
  floodZone?: string;
  
  // Location
  latitude?: string;
  longitude?: string;
  
  // Misc
  jurisdiction?: string;
  censusTract?: string;
}
