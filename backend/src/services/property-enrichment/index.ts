/**
 * Property Enrichment Service
 * 
 * Two-stream architecture for property data:
 * - Stream 1: Property Info (county GIS, property appraiser, public records)
 * - Stream 2: Rent Data (Apartments.com, CoStar, scraped data)
 * 
 * @example
 * ```typescript
 * import { getEnrichmentOrchestrator } from './services/property-enrichment';
 * 
 * const orchestrator = getEnrichmentOrchestrator();
 * 
 * // Enrich a property
 * const job = await orchestrator.enrichProperty(
 *   '7852 Tranquility Loop',
 *   'Wesley Chapel',
 *   'FL',
 *   { propertyName: 'Sentosa Epperson' }
 * );
 * 
 * // Build unified profile
 * const profile = orchestrator.buildPropertyProfile(job);
 * 
 * console.log('Year Built:', profile.propertyInfo?.yearBuilt);
 * console.log('Avg Rent:', profile.rentData?.avgAskingRent);
 * console.log('Data Quality:', profile.dataQualityScore);
 * ```
 */

// Main orchestrator
export { 
  PropertyEnrichmentOrchestrator, 
  getEnrichmentOrchestrator 
} from './enrichment-orchestrator';

// Types
export * from './types';

// Property Info
export { 
  PropertyInfoProviderRegistry, 
  getPropertyInfoRegistry 
} from './property-info/provider-registry';

export { BasePropertyInfoProvider } from './property-info/base-provider';
export { ArcGISFeatureServerProvider } from './property-info/arcgis-provider';
export { 
  COUNTY_CONFIGS,
  getCountyConfig,
  getStateConfigs,
  hasCountyCoverage,
  // Individual county configs
  PASCO_COUNTY_FL,
  HILLSBOROUGH_COUNTY_FL,
  ORANGE_COUNTY_FL,
  OSCEOLA_COUNTY_FL,
  PINELLAS_COUNTY_FL,
  MARICOPA_COUNTY_AZ,
  HARRIS_COUNTY_TX,
  DALLAS_COUNTY_TX
} from './property-info/county-configs';

// Rent Data
export { 
  RentDataProviderRegistry, 
  getRentDataRegistry 
} from './rent-data/provider-registry';

export { BaseRentDataProvider } from './rent-data/base-provider';
export { ApartmentsComProvider } from './rent-data/apartments-com-provider';

// Discovery
export {
  PropertyDiscoveryService,
  getPropertyDiscoveryService,
  DiscoveredProperty,
  DiscoveryJob
} from './discovery';

// Matching
export {
  PropertyMatcherService,
  getPropertyMatcherService,
  ApartmentLocatorProperty,
  MatchResult
} from './matching';

// Data Library Auto-Enrichment
export {
  DataLibraryAutoEnrichmentService,
  getDataLibraryAutoEnrichmentService,
  DataLibraryAsset,
  EnrichmentResult,
  EnrichmentConfig
} from './data-library';
