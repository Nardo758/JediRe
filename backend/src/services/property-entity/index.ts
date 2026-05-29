/**
 * Property Entity Service Layer
 * Phase 1 — Property Plumbing Refactor
 *
 * Exports the three new services for the new schema tables.
 * A fourth service (PropertyService) operates against the existing
 * `properties` table and will be built during Phase 2 once
 * deals.property_id is being populated via dual-write.
 *
 * Phase 2 will add:
 *   - PropertyService.linkDeal(dealId, propertyId) — dual-writes to
 *     both deals.property_id and deal_properties
 *   - PropertyService.getForDeal(dealId) — reads from deals.property_id
 *     (falling back to deal_properties during transition)
 */

export { propertyCharacteristicsService, PropertyCharacteristicsService } from './property-characteristics.service';
export { propertyOperatingDataService, PropertyOperatingDataService } from './property-operating-data.service';
export { propertySalesService, PropertySalesService } from './property-sales.service';

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
