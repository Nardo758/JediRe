/**
 * Property Info Providers
 * Stream 1: County GIS, Property Appraiser, Public Records
 */

export { BasePropertyInfoProvider } from './base-provider';
export { ArcGISFeatureServerProvider } from './arcgis-provider';
export { PropertyInfoProviderRegistry, getPropertyInfoRegistry } from './provider-registry';
export {
  COUNTY_CONFIGS,
  getCountyConfig,
  getStateConfigs,
  hasCountyCoverage,
  // Florida
  PASCO_COUNTY_FL,
  HILLSBOROUGH_COUNTY_FL,
  ORANGE_COUNTY_FL,
  OSCEOLA_COUNTY_FL,
  PINELLAS_COUNTY_FL,
  // Georgia
  FULTON_COUNTY_GA,
  DEKALB_COUNTY_GA,
  GWINNETT_COUNTY_GA,
  COBB_COUNTY_GA,
  // Arizona
  MARICOPA_COUNTY_AZ,
  // Texas
  HARRIS_COUNTY_TX,
  DALLAS_COUNTY_TX
} from './county-configs';
