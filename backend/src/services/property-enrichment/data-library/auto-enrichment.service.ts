/**
 * Data Library Auto-Enrichment Service
 * 
 * When a user uploads a deal with missing information, this service
 * automatically taps the appropriate APIs to fill in the gaps:
 * - Municipal APIs for property info (year built, units, SF, zoning, owner)
 * - Apartment Locator AI for rent data (unit mix, asking rents, occupancy)
 */

import { getEnrichmentOrchestrator } from '../enrichment-orchestrator';
import { getPropertyDiscoveryService } from '../discovery/property-discovery.service';
import { getPropertyMatcherService } from '../matching/property-matcher.service';
import { PropertyInfo, RentData, PropertyProfile } from '../types';

export interface DataLibraryAsset {
  id: string;
  userId: string;
  
  // Core identity
  propertyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  
  // Property data
  propertyType?: string;
  assetClass?: string;
  dealType?: string;
  
  // Physical
  units?: number;
  yearBuilt?: number;
  stories?: number;
  avgRent?: number;
  occupancyPct?: number;
  livingAreaSqFt?: number;
  
  // Financial
  capRate?: number;
  askingPrice?: number;
  noi?: number;
  
  // Data quality
  dataQualityScore?: number;
  
  // Metadata
  sourceDocument?: string;
  extractedAt?: Date;
}

export interface EnrichmentResult {
  assetId: string;
  success: boolean;
  
  // What was filled in
  fieldsEnriched: string[];
  fieldsStillMissing: string[];
  
  // Sources used
  municipalApiUsed: boolean;
  municipalProvider?: string;
  apartmentLocatorUsed: boolean;
  apartmentLocatorId?: string;
  
  // Data quality improvement
  previousScore: number;
  newScore: number;
  
  // Enriched data (for preview/confirmation)
  enrichedData: Partial<DataLibraryAsset>;
  
  // Conflicts (if enriched data differs from existing)
  conflicts: Array<{
    field: string;
    existingValue: unknown;
    enrichedValue: unknown;
    source: string;
  }>;
}

export interface EnrichmentConfig {
  // Auto-enrich on upload
  autoEnrichOnUpload: boolean;
  
  // Minimum DQ score to trigger auto-enrichment
  minDqScoreForAutoEnrich: number;
  
  // Fields to enrich
  enrichPropertyInfo: boolean;  // Municipal APIs
  enrichRentData: boolean;      // Apartment Locator AI
  
  // Conflict resolution
  overwriteExisting: boolean;   // If true, enriched data overwrites existing
  requireConfirmation: boolean; // If true, conflicts require user confirmation
}

const DEFAULT_CONFIG: EnrichmentConfig = {
  autoEnrichOnUpload: true,
  minDqScoreForAutoEnrich: 50,
  enrichPropertyInfo: true,
  enrichRentData: true,
  overwriteExisting: false,
  requireConfirmation: true
};

export class DataLibraryAutoEnrichmentService {
  private enrichmentOrchestrator = getEnrichmentOrchestrator();
  private discoveryService = getPropertyDiscoveryService();
  private matcherService = getPropertyMatcherService();
  
  /**
   * Enrich a Data Library asset with missing information
   */
  async enrichAsset(
    asset: DataLibraryAsset,
    config: Partial<EnrichmentConfig> = {}
  ): Promise<EnrichmentResult> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    const result: EnrichmentResult = {
      assetId: asset.id,
      success: false,
      fieldsEnriched: [],
      fieldsStillMissing: [],
      municipalApiUsed: false,
      apartmentLocatorUsed: false,
      previousScore: asset.dataQualityScore || 0,
      newScore: 0,
      enrichedData: {},
      conflicts: []
    };
    
    // Check if we have enough to search
    if (!asset.address || !asset.city || !asset.state) {
      result.fieldsStillMissing = ['address', 'city', 'state'];
      return result;
    }
    
    try {
      // Step 1: Get property info from municipal APIs
      if (cfg.enrichPropertyInfo) {
        const propertyInfo = await this.fetchPropertyInfo(asset);
        
        if (propertyInfo) {
          result.municipalApiUsed = true;
          result.municipalProvider = propertyInfo.provider;
          
          this.applyPropertyInfo(asset, propertyInfo, result, cfg);
        }
      }
      
      // Step 2: Get rent data from Apartment Locator AI
      if (cfg.enrichRentData) {
        const rentData = await this.fetchRentData(asset);
        
        if (rentData) {
          result.apartmentLocatorUsed = true;
          
          this.applyRentData(asset, rentData, result, cfg);
        }
      }
      
      // Calculate new data quality score
      result.newScore = this.calculateDataQualityScore(asset, result.enrichedData);
      
      // Determine what's still missing
      result.fieldsStillMissing = this.getMissingFields(asset, result.enrichedData);
      
      result.success = result.fieldsEnriched.length > 0;
      
    } catch (error) {
      console.error(`[AutoEnrichment] Error enriching asset ${asset.id}:`, error);
    }
    
    return result;
  }
  
  /**
   * Fetch property info from municipal APIs
   */
  private async fetchPropertyInfo(asset: DataLibraryAsset): Promise<PropertyInfo | null> {
    const { info } = await this.enrichmentOrchestrator['fetchPropertyInfo'](
      asset.address!,
      asset.city!,
      asset.state!,
      asset.zip,
      asset.county,
      undefined // coordinates
    );
    
    return info;
  }
  
  /**
   * Fetch rent data from Apartment Locator AI
   */
  private async fetchRentData(asset: DataLibraryAsset): Promise<RentData | null> {
    // First try to find a matched property in Apartment Locator
    const matched = await this.findApartmentLocatorMatch(asset);
    
    if (matched) {
      return matched;
    }
    
    // Fall back to web scraping
    const { data } = await this.enrichmentOrchestrator['fetchRentData'](
      asset.address!,
      asset.city!,
      asset.state!,
      asset.propertyName
    );
    
    return data;
  }
  
  /**
   * Find matching property in Apartment Locator database
   */
  private async findApartmentLocatorMatch(
    asset: DataLibraryAsset
  ): Promise<RentData | null> {
    // TODO: Query apartment_locator_properties table by address/name
    // SELECT * FROM apartment_locator_properties 
    // WHERE state = $1 AND city = $2 
    //   AND (address ILIKE $3 OR property_name ILIKE $4)
    
    return null;
  }
  
  /**
   * Apply property info to enrichment result
   */
  private applyPropertyInfo(
    asset: DataLibraryAsset,
    info: PropertyInfo,
    result: EnrichmentResult,
    config: EnrichmentConfig
  ): void {
    const mappings: Array<{
      assetField: keyof DataLibraryAsset;
      infoField: keyof PropertyInfo;
      transform?: (v: unknown) => unknown;
    }> = [
      { assetField: 'units', infoField: 'numberOfUnits' },
      { assetField: 'yearBuilt', infoField: 'yearBuilt' },
      { assetField: 'livingAreaSqFt', infoField: 'livingAreaSqFt' },
      { assetField: 'stories', infoField: 'stories' },
      { assetField: 'county', infoField: 'county' },
      { assetField: 'zip', infoField: 'zip' },
    ];
    
    for (const mapping of mappings) {
      const enrichedValue = info[mapping.infoField];
      
      if (enrichedValue !== undefined && enrichedValue !== null) {
        const transformedValue = mapping.transform 
          ? mapping.transform(enrichedValue) 
          : enrichedValue;
        
        const existingValue = asset[mapping.assetField];
        
        // Check for conflict
        if (existingValue !== undefined && existingValue !== null && existingValue !== transformedValue) {
          if (config.overwriteExisting) {
            result.enrichedData[mapping.assetField] = transformedValue as any;
            result.fieldsEnriched.push(mapping.assetField);
          }
          
          result.conflicts.push({
            field: mapping.assetField,
            existingValue,
            enrichedValue: transformedValue,
            source: info.provider
          });
        } else if (existingValue === undefined || existingValue === null) {
          // No conflict - field was missing
          result.enrichedData[mapping.assetField] = transformedValue as any;
          result.fieldsEnriched.push(mapping.assetField);
        }
      }
    }
  }
  
  /**
   * Apply rent data to enrichment result
   */
  private applyRentData(
    asset: DataLibraryAsset,
    rentData: RentData,
    result: EnrichmentResult,
    config: EnrichmentConfig
  ): void {
    // Average rent
    if (rentData.avgAskingRent && !asset.avgRent) {
      result.enrichedData.avgRent = Math.round(rentData.avgAskingRent);
      result.fieldsEnriched.push('avgRent');
    } else if (rentData.avgAskingRent && asset.avgRent) {
      result.conflicts.push({
        field: 'avgRent',
        existingValue: asset.avgRent,
        enrichedValue: Math.round(rentData.avgAskingRent),
        source: rentData.provider
      });
    }
    
    // Occupancy
    if (rentData.occupancyPct !== undefined && !asset.occupancyPct) {
      result.enrichedData.occupancyPct = rentData.occupancyPct;
      result.fieldsEnriched.push('occupancyPct');
    }
    
    // Total units (if we have unit mix but not units)
    if (rentData.totalUnits && !asset.units) {
      result.enrichedData.units = rentData.totalUnits;
      result.fieldsEnriched.push('units');
    }
    
    // Property name
    if (rentData.propertyName && !asset.propertyName) {
      result.enrichedData.propertyName = rentData.propertyName;
      result.fieldsEnriched.push('propertyName');
    }
  }
  
  /**
   * Calculate data quality score
   */
  private calculateDataQualityScore(
    asset: DataLibraryAsset,
    enriched: Partial<DataLibraryAsset>
  ): number {
    const combined = { ...asset, ...enriched };
    
    const weights: Record<string, number> = {
      address: 10,
      city: 5,
      state: 5,
      propertyName: 5,
      units: 15,
      yearBuilt: 10,
      livingAreaSqFt: 8,
      avgRent: 12,
      occupancyPct: 10,
      capRate: 8,
      askingPrice: 7,
      noi: 5
    };
    
    let score = 0;
    
    for (const [field, weight] of Object.entries(weights)) {
      if (combined[field as keyof DataLibraryAsset]) {
        score += weight;
      }
    }
    
    return score;
  }
  
  /**
   * Get list of still-missing fields
   */
  private getMissingFields(
    asset: DataLibraryAsset,
    enriched: Partial<DataLibraryAsset>
  ): string[] {
    const combined = { ...asset, ...enriched };
    const criticalFields = [
      'address', 'city', 'state', 'propertyName',
      'units', 'yearBuilt', 'avgRent', 'occupancyPct'
    ];
    
    return criticalFields.filter(
      field => !combined[field as keyof DataLibraryAsset]
    );
  }
  
  /**
   * Apply enrichment result to database
   */
  async applyEnrichment(
    assetId: string,
    result: EnrichmentResult,
    resolvedConflicts?: Record<string, 'keep' | 'overwrite'>
  ): Promise<void> {
    const updateData: Partial<DataLibraryAsset> = { ...result.enrichedData };
    
    // Apply conflict resolutions
    if (resolvedConflicts) {
      for (const conflict of result.conflicts) {
        if (resolvedConflicts[conflict.field] === 'overwrite') {
          (updateData as any)[conflict.field] = conflict.enrichedValue;
        }
      }
    }
    
    // Update data quality score
    updateData.dataQualityScore = result.newScore;
    
    // TODO: Update database
    // UPDATE data_library_assets SET ... WHERE id = $1
    console.log(`[AutoEnrichment] Applied enrichment to asset ${assetId}:`, updateData);
  }
  
  /**
   * Batch enrich multiple assets
   */
  async batchEnrich(
    assets: DataLibraryAsset[],
    config: Partial<EnrichmentConfig> = {}
  ): Promise<{
    total: number;
    enriched: number;
    failed: number;
    results: EnrichmentResult[];
  }> {
    const results: EnrichmentResult[] = [];
    let enriched = 0;
    let failed = 0;
    
    for (const asset of assets) {
      try {
        const result = await this.enrichAsset(asset, config);
        results.push(result);
        
        if (result.success) {
          enriched++;
        }
      } catch (error) {
        failed++;
        console.error(`[AutoEnrichment] Failed to enrich asset ${asset.id}:`, error);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return {
      total: assets.length,
      enriched,
      failed,
      results
    };
  }
  
  /**
   * Get assets that need enrichment
   */
  async getAssetsNeedingEnrichment(
    userId: string,
    minScore?: number
  ): Promise<DataLibraryAsset[]> {
    // TODO: Query database
    // SELECT * FROM data_library_assets 
    // WHERE user_id = $1 
    //   AND (data_quality_score IS NULL OR data_quality_score < $2)
    //   AND address IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL
    
    return [];
  }
}

// Singleton
let autoEnrichmentInstance: DataLibraryAutoEnrichmentService | null = null;

export function getDataLibraryAutoEnrichmentService(): DataLibraryAutoEnrichmentService {
  if (!autoEnrichmentInstance) {
    autoEnrichmentInstance = new DataLibraryAutoEnrichmentService();
  }
  return autoEnrichmentInstance;
}
