/**
 * Property Entity Service Layer
 * Phase 1 — Property Plumbing Refactor
 *
 * Four services covering the new schema tables and identity resolution.
 * No production reads/writes yet — Phase 2 dual-write wires these in.
 *
 * Services:
 *   PropertyCharacteristicsService — time-varying physical state
 *   PropertyOperatingDataService   — period-specific operating metrics
 *   PropertySalesService           — canonical transaction history
 *   PropertyResolverService        — identity resolution (find-or-create, dedup, merge)
 *   DealPropertyLinkService        — dual-write deal→property link (new FK + legacy join)
 *
 * Phase 2 will activate dual-write by calling DealPropertyLinkService.linkDealToProperty
 * from DealService write paths, and PropertyResolverService.resolveByAddress/Parcel
 * from all ingest pipelines.
 */

export { propertyCharacteristicsService, PropertyCharacteristicsService } from './property-characteristics.service';
export { propertyOperatingDataService, PropertyOperatingDataService } from './property-operating-data.service';
export { propertySalesService, PropertySalesService } from './property-sales.service';
export { propertyResolverService, PropertyResolverService } from './property-resolver.service';
export { dealPropertyLinkService, DealPropertyLinkService } from './deal-property-link.service';

export type {
  PropertyCharacteristic,
  CreatePropertyCharacteristicInput,
  PropertyOperatingData,
  CreatePropertyOperatingDataInput,
  OperatingPeriodType,
  OperatingDataSource,
  PropertySale,
  CreatePropertySaleInput,
  SaleSource,
} from './types';

export type {
  ResolvedProperty,
  ResolveByAddressInput,
  ResolveByParcelInput,
  MergeResult,
} from './property-resolver.service';

export type { DealPropertyLink } from './deal-property-link.service';
