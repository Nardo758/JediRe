/**
 * ArcGIS FeatureServer Provider
 * 
 * Universal template for counties using Esri ArcGIS FeatureServer.
 * Most Florida counties (and many nationwide) use this pattern.
 * 
 * The provider is configured via CountyAPIConfig which defines:
 * - Endpoints (parcel, address, zoning layers)
 * - Field mappings (county-specific field names → standard names)
 * - Search parameters
 */

import { PropertyInfo, ProviderConfig, CountyAPIConfig, CountyFieldMappings } from '../types';
import { BasePropertyInfoProvider } from './base-provider';

export class ArcGISFeatureServerProvider extends BasePropertyInfoProvider {
  readonly config: ProviderConfig;
  private countyConfig: CountyAPIConfig;
  
  constructor(countyConfig: CountyAPIConfig) {
    super();
    this.countyConfig = countyConfig;
    
    this.config = {
      name: `${countyConfig.county.toLowerCase().replace(/\s+/g, '_')}_${countyConfig.state.toLowerCase()}`,
      type: 'property_info',
      enabled: true,
      priority: 100,
      coverageStates: [countyConfig.state],
      coverageCounties: [countyConfig.county],
    };
  }
  
  async canHandle(
    address: string,
    city: string,
    state: string,
    county?: string
  ): Promise<boolean> {
    // Check state
    if (state.toUpperCase() !== this.countyConfig.state.toUpperCase()) {
      return false;
    }
    
    // Check county if provided
    if (county) {
      const normalizedCounty = county.toUpperCase().replace(/\s+COUNTY$/i, '');
      const configCounty = this.countyConfig.county.toUpperCase().replace(/\s+COUNTY$/i, '');
      if (normalizedCounty !== configCounty) {
        return false;
      }
    }
    
    // Could add city-based validation here if needed
    return true;
  }
  
  async fetchPropertyInfo(
    address: string,
    city: string,
    state: string,
    zip?: string,
    coordinates?: { lat: number; lng: number }
  ): Promise<PropertyInfo | null> {
    const { countyConfig } = this;
    const mappings = countyConfig.fieldMappings;
    
    try {
      // Strategy 1: Search by address in address layer
      if (countyConfig.addressEndpoint && countyConfig.addressLayerId !== undefined) {
        const addressResult = await this.searchAddressLayer(address);
        if (addressResult) {
          // Got address - now get full parcel data
          const parcelId = this.extractFieldValue(addressResult, mappings.parcelId) ||
                          this.extractFieldValue(addressResult, mappings.parcelNumber);
          
          if (parcelId && countyConfig.parcelsEndpoint) {
            const parcelResult = await this.searchParcelsLayer(parcelId);
            if (parcelResult) {
              return this.mapToPropertyInfo(parcelResult, addressResult);
            }
          }
          
          // Address layer might have all the data
          return this.mapToPropertyInfo(addressResult);
        }
      }
      
      // Strategy 2: Search by coordinates
      if (coordinates && countyConfig.parcelsEndpoint) {
        const parcelResult = await this.searchByCoordinates(coordinates);
        if (parcelResult) {
          return this.mapToPropertyInfo(parcelResult);
        }
      }
      
      // Strategy 3: Direct parcel search by address
      if (countyConfig.parcelsEndpoint) {
        const parcelResult = await this.searchParcelsLayerByAddress(address);
        if (parcelResult) {
          return this.mapToPropertyInfo(parcelResult);
        }
      }
      
      return null;
    } catch (error) {
      console.error(`[${this.config.name}] Error fetching property info:`, error);
      return null;
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.countyConfig.baseUrl}?f=json`;
      const response = await fetch(url);
      const data = await response.json();
      return !!data.layers || !!data.currentVersion;
    } catch {
      return false;
    }
  }
  
  // =========================================================================
  // SEARCH METHODS
  // =========================================================================
  
  private async searchAddressLayer(address: string): Promise<Record<string, unknown> | null> {
    const { countyConfig } = this;
    if (!countyConfig.addressEndpoint || countyConfig.addressLayerId === undefined) {
      return null;
    }
    
    const normalizedAddress = this.normalizeAddress(address);
    const streetNumber = this.extractStreetNumber(address);
    const streetName = this.extractStreetName(address);
    
    // Build where clause based on available fields
    let whereClause: string;
    
    if (countyConfig.fieldMappings.fullAddress) {
      // Search by full address
      whereClause = `UPPER(${countyConfig.fieldMappings.fullAddress}) LIKE '%${normalizedAddress}%'`;
    } else if (streetNumber && streetName && countyConfig.fieldMappings.streetNumber && countyConfig.fieldMappings.streetName) {
      // Search by street number + name
      whereClause = `${countyConfig.fieldMappings.streetNumber}='${streetNumber}' AND UPPER(${countyConfig.fieldMappings.streetName}) LIKE '%${streetName}%'`;
    } else {
      // Fallback: search by street number in any text field
      whereClause = `1=1`; // Will rely on other strategies
      return null;
    }
    
    const url = this.buildQueryUrl(
      countyConfig.addressEndpoint,
      countyConfig.addressLayerId,
      whereClause
    );
    
    return this.executeQuery(url);
  }
  
  private async searchParcelsLayer(parcelId: string): Promise<Record<string, unknown> | null> {
    const { countyConfig } = this;
    if (!countyConfig.parcelsEndpoint || countyConfig.parcelsLayerId === undefined) {
      return null;
    }
    
    const mappings = countyConfig.fieldMappings;
    const parcelField = mappings.parcelNumber || mappings.parcelId;
    
    const whereClause = `${parcelField}='${parcelId}'`;
    
    const url = this.buildQueryUrl(
      countyConfig.parcelsEndpoint,
      countyConfig.parcelsLayerId,
      whereClause
    );
    
    return this.executeQuery(url);
  }
  
  private async searchParcelsLayerByAddress(address: string): Promise<Record<string, unknown> | null> {
    const { countyConfig } = this;
    if (!countyConfig.parcelsEndpoint || countyConfig.parcelsLayerId === undefined) {
      return null;
    }
    
    const mappings = countyConfig.fieldMappings;
    const normalizedAddress = this.normalizeAddress(address);
    
    // Try to find an address field in parcel layer
    const addressField = mappings.fullAddress || 'SITE_ADDRESS';
    const whereClause = `UPPER(${addressField}) LIKE '%${normalizedAddress}%'`;
    
    const url = this.buildQueryUrl(
      countyConfig.parcelsEndpoint,
      countyConfig.parcelsLayerId,
      whereClause
    );
    
    return this.executeQuery(url);
  }
  
  private async searchByCoordinates(
    coordinates: { lat: number; lng: number }
  ): Promise<Record<string, unknown> | null> {
    const { countyConfig } = this;
    if (!countyConfig.parcelsEndpoint || countyConfig.parcelsLayerId === undefined) {
      return null;
    }
    
    // ArcGIS geometry query
    const geometry = JSON.stringify({
      x: coordinates.lng,
      y: coordinates.lat,
      spatialReference: { wkid: 4326 }
    });
    
    const params = new URLSearchParams({
      where: '1=1',
      geometry,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'false',
      f: 'json'
    });
    
    const url = `${countyConfig.parcelsEndpoint}/${countyConfig.parcelsLayerId}/query?${params}`;
    
    return this.executeQuery(url, false);
  }
  
  // =========================================================================
  // QUERY EXECUTION
  // =========================================================================
  
  private buildQueryUrl(
    baseEndpoint: string,
    layerId: number,
    whereClause: string
  ): string {
    const params = new URLSearchParams({
      where: whereClause,
      outFields: '*',
      returnGeometry: 'false',
      f: 'json'
    });
    
    return `${baseEndpoint}/${layerId}/query?${params}`;
  }
  
  private async executeQuery(
    url: string,
    isSingleResult: boolean = true
  ): Promise<Record<string, unknown> | null> {
    try {
      await this.enforceRateLimit();
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`[${this.config.name}] HTTP ${response.status}: ${url}`);
        return null;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error(`[${this.config.name}] API Error:`, data.error);
        return null;
      }
      
      if (!data.features || data.features.length === 0) {
        return null;
      }
      
      // Return first result's attributes
      const feature = data.features[0];
      return feature.attributes || feature;
    } catch (error) {
      console.error(`[${this.config.name}] Query error:`, error);
      return null;
    }
  }
  
  // =========================================================================
  // DATA MAPPING
  // =========================================================================
  
  private mapToPropertyInfo(
    parcelData: Record<string, unknown>,
    addressData?: Record<string, unknown>
  ): PropertyInfo {
    const mappings = this.countyConfig.fieldMappings;
    
    // Helper to get value from either data source
    const getValue = (field: string | undefined): unknown => {
      if (!field) return undefined;
      return parcelData[field] ?? addressData?.[field];
    };
    
    // Build coordinates from various possible fields
    let latitude: number | undefined;
    let longitude: number | undefined;
    
    if (mappings.latitude && mappings.longitude) {
      latitude = this.parseNumber(getValue(mappings.latitude));
      longitude = this.parseNumber(getValue(mappings.longitude));
    }
    
    // If no explicit lat/lng, check common field names
    if (!latitude || !longitude) {
      latitude = this.parseNumber(
        parcelData['LATITUDE'] || parcelData['LAT'] || parcelData['Y'] ||
        addressData?.['LATITUDE'] || addressData?.['LAT'] || addressData?.['Y']
      );
      longitude = this.parseNumber(
        parcelData['LONGITUDE'] || parcelData['LNG'] || parcelData['LON'] || parcelData['X'] ||
        addressData?.['LONGITUDE'] || addressData?.['LNG'] || addressData?.['LON'] || addressData?.['X']
      );
    }
    
    const landUseCode = this.cleanString(getValue(mappings.landUseCode));
    const landUseDesc = this.cleanString(getValue(mappings.landUseDescription));
    
    const result: PropertyInfo = {
      // Identifiers
      parcelId: this.cleanString(getValue(mappings.parcelId)) || '',
      parcelNumber: this.cleanString(getValue(mappings.parcelNumber)),
      
      // Address - try multiple field combinations
      address: this.cleanString(getValue(mappings.fullAddress)) ||
               this.buildAddress(
                 this.cleanString(getValue(mappings.streetNumber)),
                 this.cleanString(getValue(mappings.streetName))
               ) || '',
      city: this.cleanString(getValue(mappings.city)) || 
            this.cleanString(parcelData['SITE_MAILING_CITY']) ||
            this.cleanString(parcelData['MAILING_CITY']) || '',
      state: this.countyConfig.state,
      zip: this.cleanString(getValue(mappings.zip)) ||
           this.cleanString(parcelData['SITE_ZIP']) ||
           this.cleanString(parcelData['ZIP_CODE5']) || '',
      county: this.countyConfig.county,
      
      // Location
      latitude: latitude || 0,
      longitude: longitude || 0,
      
      // Physical Characteristics
      yearBuilt: this.parseYear(getValue(mappings.yearBuilt)),
      effectiveYearBuilt: this.parseYear(getValue(mappings.effectiveYearBuilt)),
      numberOfBuildings: this.parseNumber(getValue(mappings.numberOfBuildings)),
      numberOfUnits: this.parseNumber(getValue(mappings.numberOfUnits)),
      livingAreaSqFt: this.parseNumber(getValue(mappings.livingArea)),
      grossAreaSqFt: this.parseNumber(getValue(mappings.grossArea)),
      landSqFt: this.parseNumber(getValue(mappings.landSqFt)),
      acres: this.parseNumber(getValue(mappings.acres)),
      hasPool: this.parseBoolean(parcelData['HAS_POOL']),
      
      // Land Use & Zoning
      zoning: this.cleanString(getValue(mappings.zoning)),
      landUseCode,
      landUseDescription: landUseDesc,
      futureLandUse: this.cleanString(getValue(mappings.futureLandUse)),
      propertyType: this.detectPropertyType(landUseCode, landUseDesc),
      
      // Ownership
      ownerName: this.cleanString(getValue(mappings.ownerName)),
      ownerName2: this.cleanString(getValue(mappings.ownerName2)),
      ownerMailingAddress: this.cleanString(getValue(mappings.ownerAddress)),
      ownerMailingCity: this.cleanString(getValue(mappings.ownerCity)),
      ownerMailingState: this.cleanString(getValue(mappings.ownerState)),
      ownerMailingZip: this.cleanString(getValue(mappings.ownerZip)),
      
      // Subdivision
      subdivisionName: this.cleanString(getValue(mappings.subdivisionName)),
      legalDescription: this.cleanString(getValue(mappings.legalDescription)),
      
      // Valuation
      justValue: this.parseNumber(getValue(mappings.justValue)),
      assessedValue: this.parseNumber(getValue(mappings.assessedValue)),
      landValue: this.parseNumber(getValue(mappings.landValue)),
      buildingValue: this.parseNumber(getValue(mappings.buildingValue)),
      taxableValueCounty: this.parseNumber(getValue(mappings.taxableValue)),
      
      // Sales History
      lastSaleDate: this.parseDate(getValue(mappings.saleDate)),
      lastSaleAmount: this.parseNumber(getValue(mappings.saleAmount)),
      lastSaleBook: this.cleanString(getValue(mappings.saleBook)),
      lastSalePage: this.cleanString(getValue(mappings.salePage)),
      
      // Risk/Environmental
      femaFloodZone: this.cleanString(parcelData['FEMA'] as string)?.replace(/-\d+\s*$/, '').trim(),
      
      // Administrative
      jurisdiction: this.cleanString(getValue(mappings.jurisdiction)),
      censusTract: this.cleanString(getValue(mappings.censusTract)),
      
      // Metadata
      provider: this.config.name,
      fetchedAt: new Date(),
      rawData: { ...parcelData, ...(addressData || {}) }
    };
    
    return result;
  }
  
  private buildAddress(streetNumber?: string, streetName?: string): string {
    if (!streetNumber && !streetName) return '';
    if (!streetNumber) return streetName || '';
    if (!streetName) return streetNumber;
    return `${streetNumber} ${streetName}`;
  }
  
  private extractFieldValue(
    data: Record<string, unknown>,
    fieldName?: string
  ): string | undefined {
    if (!fieldName) return undefined;
    const value = data[fieldName];
    return value ? String(value) : undefined;
  }
}
