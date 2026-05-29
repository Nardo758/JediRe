/**
 * Property Entity Service Layer
 * Phase 1, 2 & 3 — Property Plumbing Refactor
 *
 * Services covering the new schema tables, identity resolution, dual-write,
 * and Phase 3 reader migration infrastructure.
 *
 * Services:
 *   PropertyCharacteristicsService — time-varying physical state
 *   PropertyOperatingDataService   — period-specific operating metrics
 *   PropertySalesService           — canonical transaction history
 *   PropertyResolverService        — identity resolution (find-or-create, dedup, merge)
 *   DealPropertyLinkService        — dual-write deal→property link (new FK + legacy join)
 *   PropertyDualWriteService       — Phase 2 orchestrator: routes all ingest writes to new schema
 *   Phase3ShadowService            — Phase 3 shadow comparison logging
 *   phase3-flags                   — Phase 3 reader migration feature flags
 */

export { propertyCharacteristicsService, PropertyCharacteristicsService } from './property-characteristics.service';
export { propertyOperatingDataService, PropertyOperatingDataService } from './property-operating-data.service';
export { propertySalesService, PropertySalesService } from './property-sales.service';
export { propertyResolverService, PropertyResolverService } from './property-resolver.service';
export { dealPropertyLinkService, DealPropertyLinkService } from './deal-property-link.service';
export { propertyDualWriteService, PropertyDualWriteService } from './property-dual-write.service';
export { phase3ShadowService, Phase3ShadowService } from './phase3-shadow.service';
export {
  shouldUseNewPath,
  shouldRunShadow,
  allFlagStates,
  DEAL_RESOLVE_FLAG,
  CASHFLOW_AGENT_FLAG,
  DATA_ROUTER_FLAG,
  LEASING_TRAFFIC_FLAG,
  OPERATIONS_FLAG,
  AGENT_RUNNERS_FLAG,
  INLINE_DEALS_FLAG,
  VALUATION_SUBJECT_FLAG,
  VALUATION_COMPS_FLAG,
  COMP_SET_FLAG,
  COMP_QUERY_FLAG,
  COMP_SET_DISCOVERY_FLAG,
  GEORGIA_SALE_COMPS_FLAG,
  CORRELATION_COMPS_FLAG,
  COMP_DEDUP_FLAG,
  BACKTEST_SNAPSHOT_FLAG,
  GEORGIA_CAPITAL_TAB_FLAG,
  PROPERTY_GRID_FLAG,
  COMPETITION_FLAG,
  RANKINGS_FLAG,
  PROPERTY_METRICS_FLAG,
  PROPERTY_SCORING_FLAG,
  SPATIAL_FLAG,
  NEIGHBORING_FLAG,
  SUPPLY_FLAG,
  TRAFFIC_FLAG,
  NEURAL_MATRIX_FLAG,
  INFLATION_FLAG,
  DEAL_MARKET_INTEL_FLAG,
  JEDI_SCORE_FLAG,
  UNIT_MIX_FLAG,
  TAX_COMPS_FLAG,
  STRATEGY_COMPS_FLAG,
  STRATEGY_PROJECTION_FLAG,
  M22_POST_CLOSE_FLAG,
  DEAL_CAPSULE_FLAG,
  FREEZE_SNAPSHOT_FLAG,
} from './phase3-flags';
export type { FlagState } from './phase3-flags';

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
