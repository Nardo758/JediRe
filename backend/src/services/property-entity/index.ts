/**
 * Property Entity Service Layer
 * Phase 1 & 2 — Property Plumbing Refactor
 *
 * Services covering the new schema tables, identity resolution, and dual-write.
 *
 * Services:
 *   PropertyCharacteristicsService — time-varying physical state
 *   PropertyOperatingDataService   — period-specific operating metrics
 *   PropertySalesService           — canonical transaction history
 *   PropertyResolverService        — identity resolution (find-or-create, dedup, merge)
 *   DealPropertyLinkService        — dual-write deal→property link (new FK + legacy join)
 *   PropertyDualWriteService       — Phase 2 orchestrator: routes all ingest writes to new schema
 */

export { propertyCharacteristicsService, PropertyCharacteristicsService } from './property-characteristics.service';
export { propertyOperatingDataService, PropertyOperatingDataService } from './property-operating-data.service';
export { propertySalesService, PropertySalesService } from './property-sales.service';
export { propertyResolverService, PropertyResolverService } from './property-resolver.service';
export { dealPropertyLinkService, DealPropertyLinkService } from './deal-property-link.service';
export { propertyDualWriteService, PropertyDualWriteService } from './property-dual-write.service';

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
