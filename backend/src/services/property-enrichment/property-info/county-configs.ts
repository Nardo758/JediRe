/**
 * County API Configurations
 * 
 * Registry of county-specific configurations for property data APIs.
 * Each entry defines endpoints, layer IDs, and field mappings for that county.
 * 
 * To add a new county:
 * 1. Identify the county's GIS portal (usually `[county]gis.com` or `gis.[county].gov`)
 * 2. Find the FeatureServer endpoint
 * 3. Explore the layers to find Parcels, Address, Zoning
 * 4. Document the field names and map them to standard names
 * 5. Add the config to COUNTY_CONFIGS
 */

import { CountyAPIConfig } from '../types';

/**
 * Pasco County, FL
 * 
 * Rich data from Accela-integrated ArcGIS:
 * - Address layer with parcel linkage
 * - Parcels layer with full property appraiser data
 * 
 * Discovered at: https://pascogis.pascocountyfl.net/
 */
export const PASCO_COUNTY_FL: CountyAPIConfig = {
  county: 'Pasco',
  state: 'FL',
  fipsCode: '12101',
  pattern: 'accela_gis',
  
  baseUrl: 'https://pascogis.pascocountyfl.net/gisweb/rest/services/Accela/PascoAccela_OP/FeatureServer',
  addressEndpoint: 'https://pascogis.pascocountyfl.net/gisweb/rest/services/Accela/PascoAccela_OP/FeatureServer',
  parcelsEndpoint: 'https://pascogis.pascocountyfl.net/gisweb/rest/services/Accela/PascoAccela_OP/FeatureServer',
  
  addressLayerId: 0,
  parcelsLayerId: 5,
  
  searchField: 'FULL_ADDRESS',
  searchType: 'address',
  
  fieldMappings: {
    // Identifiers (from Address layer)
    parcelId: 'PARCEL_ID',
    parcelNumber: 'PARCEL_NUMBER',
    
    // Address (from Address layer)
    fullAddress: 'FULL_ADDRESS',
    streetNumber: 'ADDRESS_NUMBER',
    streetName: 'BASE_NAME',
    city: 'SITE_MAILING_CITY',
    zip: 'ZIP_CODE5',
    
    // Physical (from Parcels layer)
    yearBuilt: 'ACTUAL_YEAR_BUILT',
    effectiveYearBuilt: 'EFFECTIVE_YEAR_BUILT',
    numberOfBuildings: 'NUMBER_BUILDINGS',
    numberOfUnits: 'NUMBER_RESIDENTIAL_UNITS',
    livingArea: 'LIVING_AREA',
    grossArea: 'GROSS_AREA',
    landSqFt: 'LAND_SQ_FT',
    acres: 'SITE_ACRES',
    
    // Zoning
    zoning: 'ZONING',
    landUseCode: 'LAND_USE_CODE',
    landUseDescription: 'LAND_USE_DESC',
    futureLandUse: 'FUTURELANDUSE',
    
    // Ownership
    ownerName: 'OWNER_NAME_1',
    ownerName2: 'OWNER_NAME_2',
    ownerAddress: 'MAILING_ADDRESS_1',
    ownerCity: 'MAILING_CITY',
    ownerState: 'MAILING_STATE',
    ownerZip: 'MAILING_ZIP',
    
    // Valuation
    justValue: 'JUST_VALUE',
    landValue: 'LAND_VALUE',
    buildingValue: 'BUILDING_VALUE',
    taxableValue: 'TAXABLE_VAL_COUNTY',
    
    // Sales
    saleDate: 'SALE_DATE',
    saleAmount: 'SALE_AMOUNT',
    saleBook: 'SALE_BOOK',
    salePage: 'SALE_PAGE',
    
    // Subdivision
    subdivisionName: 'SUBDIVISION_NAME',
    legalDescription: 'LEGAL_DESCRIPTION',
    
    // Risk
    floodZone: 'FEMA',
    
    // Location
    latitude: 'LATITUDE',
    longitude: 'LONGITUDE',
    
    // Admin
    jurisdiction: 'JURISDICTION_NAME',
    censusTract: 'CENSUS_TRACT',
  }
};

/**
 * Hillsborough County, FL (Tampa)
 * 
 * Major Florida county with comprehensive GIS
 */
export const HILLSBOROUGH_COUNTY_FL: CountyAPIConfig = {
  county: 'Hillsborough',
  state: 'FL',
  fipsCode: '12057',
  pattern: 'arcgis_featureserver',
  
  baseUrl: 'https://maps.hillsboroughcounty.org/arcgis/rest/services',
  parcelsEndpoint: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/Parcels/FeatureServer',
  
  parcelsLayerId: 0,
  
  searchField: 'SITUS_ADDR',
  searchType: 'address',
  
  fieldMappings: {
    parcelId: 'FOLIO',
    parcelNumber: 'FOLIO',
    
    fullAddress: 'SITUS_ADDR',
    city: 'SITUS_CITY',
    zip: 'SITUS_ZIP',
    
    yearBuilt: 'YR_BLT',
    livingArea: 'LIVING_AREA',
    landSqFt: 'LAND_SQFT',
    acres: 'ACRES',
    
    zoning: 'ZONING',
    landUseCode: 'DOR_CODE',
    landUseDescription: 'DOR_DESC',
    
    ownerName: 'OWN_NAME',
    ownerAddress: 'OWN_ADDR1',
    ownerCity: 'OWN_CITY',
    ownerState: 'OWN_STATE',
    ownerZip: 'OWN_ZIP',
    
    justValue: 'JUST_VAL',
    landValue: 'LAND_VAL',
    buildingValue: 'BLDG_VAL',
    taxableValue: 'TAXABLE_VAL',
    
    saleDate: 'SALE_DATE',
    saleAmount: 'SALE_AMT',
  }
};

/**
 * Orange County, FL (Orlando)
 */
export const ORANGE_COUNTY_FL: CountyAPIConfig = {
  county: 'Orange',
  state: 'FL',
  fipsCode: '12095',
  pattern: 'arcgis_featureserver',
  
  baseUrl: 'https://maps.ocpafl.org/arcgis/rest/services',
  parcelsEndpoint: 'https://maps.ocpafl.org/arcgis/rest/services/PublicMap/MapServer',
  
  parcelsLayerId: 0,
  
  searchField: 'SITEADDR',
  searchType: 'address',
  
  fieldMappings: {
    parcelId: 'PARCEL_ID',
    parcelNumber: 'PARCELNO',
    
    fullAddress: 'SITEADDR',
    city: 'SITECITY',
    zip: 'SITEZIP',
    
    yearBuilt: 'ACTYRBLT',
    numberOfUnits: 'UNITS',
    livingArea: 'TOTLVGAREA',
    landSqFt: 'LANDSF',
    acres: 'ACRES',
    
    zoning: 'ZONING',
    landUseCode: 'DORCODE',
    
    ownerName: 'OWNERNAME1',
    ownerAddress: 'OWNERADDR1',
    ownerCity: 'OWNERCITY',
    ownerState: 'OWNERSTATE',
    ownerZip: 'OWNERZIP',
    
    justValue: 'JUSTVAL',
    landValue: 'LANDVAL',
    buildingValue: 'BLDGVAL',
    
    saleDate: 'SALEDATE',
    saleAmount: 'SALEPRICE',
    
    subdivisionName: 'SUBDIVISION',
    legalDescription: 'LEGALDESC',
  }
};

/**
 * Osceola County, FL (Kissimmee)
 */
export const OSCEOLA_COUNTY_FL: CountyAPIConfig = {
  county: 'Osceola',
  state: 'FL',
  fipsCode: '12097',
  pattern: 'arcgis_featureserver',
  
  baseUrl: 'https://services8.arcgis.com/FmKMwUEmDSC75SQm/ArcGIS/rest/services',
  parcelsEndpoint: 'https://services8.arcgis.com/FmKMwUEmDSC75SQm/ArcGIS/rest/services/OsceolaCountyParcels_view/FeatureServer',
  
  parcelsLayerId: 0,
  
  searchField: 'SITUS_ADDR',
  searchType: 'address',
  
  fieldMappings: {
    parcelId: 'PARCEL_ID',
    parcelNumber: 'PARCEL_NUM',
    
    fullAddress: 'SITUS_ADDR',
    city: 'SITUS_CITY',
    zip: 'SITUS_ZIP',
    
    yearBuilt: 'YEAR_BUILT',
    livingArea: 'LIVING_SQFT',
    landSqFt: 'LAND_SQFT',
    acres: 'ACRES',
    
    zoning: 'ZONING_CODE',
    landUseCode: 'DOR_CODE',
    landUseDescription: 'DOR_DESC',
    
    ownerName: 'OWNER_NAME',
    ownerAddress: 'OWNER_ADDR',
    ownerCity: 'OWNER_CITY',
    ownerState: 'OWNER_STATE',
    ownerZip: 'OWNER_ZIP',
    
    justValue: 'JUST_VALUE',
    landValue: 'LAND_VALUE',
    buildingValue: 'BLDG_VALUE',
    taxableValue: 'TAXABLE_VAL',
    
    saleDate: 'SALE_DATE',
    saleAmount: 'SALE_PRICE',
  }
};

/**
 * Pinellas County, FL (St. Petersburg)
 */
export const PINELLAS_COUNTY_FL: CountyAPIConfig = {
  county: 'Pinellas',
  state: 'FL',
  fipsCode: '12103',
  pattern: 'arcgis_featureserver',
  
  baseUrl: 'https://egis.pinellascounty.org/arcgis/rest/services',
  parcelsEndpoint: 'https://egis.pinellascounty.org/arcgis/rest/services/PropertyAppraiser/Parcels/FeatureServer',
  
  parcelsLayerId: 0,
  
  searchField: 'SITUS',
  searchType: 'address',
  
  fieldMappings: {
    parcelId: 'PARCEL_ID',
    parcelNumber: 'PARCEL_ID',
    
    fullAddress: 'SITUS',
    city: 'SITUS_CITY',
    zip: 'SITUS_ZIP',
    
    yearBuilt: 'YEAR_BUILT',
    livingArea: 'HEATED_SQFT',
    landSqFt: 'LAND_SQFT',
    acres: 'ACRES',
    
    zoning: 'ZONING',
    landUseCode: 'USE_CODE',
    landUseDescription: 'USE_DESC',
    
    ownerName: 'OWNER1',
    ownerName2: 'OWNER2',
    ownerAddress: 'MAIL_ADDR1',
    ownerCity: 'MAIL_CITY',
    ownerState: 'MAIL_STATE',
    ownerZip: 'MAIL_ZIP',
    
    justValue: 'JUST_VAL',
    landValue: 'LAND_VAL',
    buildingValue: 'BLDG_VAL',
    
    saleDate: 'SALE_DATE',
    saleAmount: 'SALE_PRICE',
  }
};

/**
 * Maricopa County, AZ (Phoenix)
 */
export const MARICOPA_COUNTY_AZ: CountyAPIConfig = {
  county: 'Maricopa',
  state: 'AZ',
  fipsCode: '04013',
  pattern: 'arcgis_featureserver',
  
  baseUrl: 'https://maps.mcassessor.maricopa.gov/arcgis/rest/services',
  parcelsEndpoint: 'https://maps.mcassessor.maricopa.gov/arcgis/rest/services/ParcelViewer/MapServer',
  
  parcelsLayerId: 0,
  
  searchField: 'SITUS_ADDRESS',
  searchType: 'address',
  
  fieldMappings: {
    parcelId: 'APN',
    parcelNumber: 'APN',
    
    fullAddress: 'SITUS_ADDRESS',
    city: 'SITUS_CITY',
    zip: 'SITUS_ZIP',
    
    yearBuilt: 'YEAR_BUILT',
    livingArea: 'LIVING_AREA',
    landSqFt: 'LAND_SQFT',
    acres: 'ACREAGE',
    
    zoning: 'ZONING',
    landUseCode: 'LAND_USE_CODE',
    landUseDescription: 'LAND_USE_DESC',
    
    ownerName: 'OWNER_NAME',
    ownerAddress: 'OWNER_ADDRESS',
    ownerCity: 'OWNER_CITY',
    ownerState: 'OWNER_STATE',
    ownerZip: 'OWNER_ZIP',
    
    justValue: 'FULL_CASH_VALUE',
    landValue: 'LAND_VALUE',
    buildingValue: 'IMPROVEMENT_VALUE',
    
    saleDate: 'SALE_DATE',
    saleAmount: 'SALE_PRICE',
  }
};

/**
 * Harris County, TX (Houston)
 */
export const HARRIS_COUNTY_TX: CountyAPIConfig = {
  county: 'Harris',
  state: 'TX',
  fipsCode: '48201',
  pattern: 'arcgis_featureserver',
  
  baseUrl: 'https://arcgis.harriscountytx.gov/arcgis/rest/services',
  parcelsEndpoint: 'https://arcgis.harriscountytx.gov/arcgis/rest/services/HCAD/Parcels/FeatureServer',
  
  parcelsLayerId: 0,
  
  searchField: 'SITE_ADDR',
  searchType: 'address',
  
  fieldMappings: {
    parcelId: 'ACCOUNT',
    parcelNumber: 'ACCOUNT',
    
    fullAddress: 'SITE_ADDR',
    city: 'CITY',
    zip: 'ZIP',
    
    yearBuilt: 'YR_BUILT',
    numberOfBuildings: 'NUM_BLDGS',
    livingArea: 'BLDG_SF',
    landSqFt: 'LAND_SF',
    acres: 'ACREAGE',
    
    zoning: 'ZONING',
    landUseCode: 'STATE_CLASS',
    landUseDescription: 'STATE_CLASS_DESC',
    
    ownerName: 'OWNER',
    ownerAddress: 'MAIL_ADDR',
    ownerCity: 'MAIL_CITY',
    ownerState: 'MAIL_STATE',
    ownerZip: 'MAIL_ZIP',
    
    justValue: 'MARKET_VAL',
    landValue: 'LAND_VAL',
    buildingValue: 'IMPR_VAL',
    taxableValue: 'TAXABLE_VAL',
  }
};

/**
 * Dallas County, TX
 */
export const DALLAS_COUNTY_TX: CountyAPIConfig = {
  county: 'Dallas',
  state: 'TX',
  fipsCode: '48113',
  pattern: 'arcgis_featureserver',
  
  baseUrl: 'https://gis.dallascad.org/arcgis/rest/services',
  parcelsEndpoint: 'https://gis.dallascad.org/arcgis/rest/services/Public/Parcels/FeatureServer',
  
  parcelsLayerId: 0,
  
  searchField: 'SITUS_ADDRESS',
  searchType: 'address',
  
  fieldMappings: {
    parcelId: 'ACCOUNT_NUM',
    parcelNumber: 'ACCOUNT_NUM',
    
    fullAddress: 'SITUS_ADDRESS',
    city: 'SITUS_CITY',
    zip: 'SITUS_ZIP',
    
    yearBuilt: 'YEAR_BUILT',
    livingArea: 'LIVING_AREA',
    landSqFt: 'LAND_SQFT',
    acres: 'ACREAGE',
    
    zoning: 'ZONING',
    landUseCode: 'STATE_CD',
    landUseDescription: 'STATE_CD_DESC',
    
    ownerName: 'OWNER_NAME',
    ownerAddress: 'OWNER_ADDR',
    ownerCity: 'OWNER_CITY',
    ownerState: 'OWNER_STATE',
    ownerZip: 'OWNER_ZIP',
    
    justValue: 'MARKET_VALUE',
    landValue: 'LAND_VALUE',
    buildingValue: 'IMPR_VALUE',
  }
};

/**
 * All configured counties
 */
export const COUNTY_CONFIGS: CountyAPIConfig[] = [
  PASCO_COUNTY_FL,
  HILLSBOROUGH_COUNTY_FL,
  ORANGE_COUNTY_FL,
  OSCEOLA_COUNTY_FL,
  PINELLAS_COUNTY_FL,
  MARICOPA_COUNTY_AZ,
  HARRIS_COUNTY_TX,
  DALLAS_COUNTY_TX,
];

/**
 * Lookup county config by county name and state
 */
export function getCountyConfig(county: string, state: string): CountyAPIConfig | undefined {
  const normalizedCounty = county.toUpperCase().replace(/\s+COUNTY$/i, '').trim();
  const normalizedState = state.toUpperCase().trim();
  
  return COUNTY_CONFIGS.find(config => {
    const configCounty = config.county.toUpperCase();
    const configState = config.state.toUpperCase();
    return configCounty === normalizedCounty && configState === normalizedState;
  });
}

/**
 * Get all configs for a state
 */
export function getStateConfigs(state: string): CountyAPIConfig[] {
  const normalizedState = state.toUpperCase().trim();
  return COUNTY_CONFIGS.filter(config => config.state.toUpperCase() === normalizedState);
}

/**
 * Check if we have coverage for a county
 */
export function hasCountyCoverage(county: string, state: string): boolean {
  return getCountyConfig(county, state) !== undefined;
}
