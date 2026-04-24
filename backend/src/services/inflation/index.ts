/**
 * JediRe Inflation Engine
 * 
 * Proprietary inflation tracking for multifamily real estate.
 */

export {
  InflationEngineService,
  getInflationEngineService,
  InflationContext,
  JediReCompositeScore,
  JediReInflationIndices,
  CPIComponents,
  PPIComponents,
  FREDIndicators,
  InflationDataPoint
} from './inflation-engine.service';

export {
  MarketBasketService,
  getMarketBasketService,
  MarketBasketIndex,
  AffordabilityImpact,
  BasketItem,
  BasketCategory,
  PriceObservation,
  ALL_BASKET_ITEMS,
  RESIDENT_AFFORDABILITY_ITEMS,
  PROPERTY_OPERATIONS_ITEMS,
  LABOR_COST_ITEMS,
  CONSTRUCTION_ITEMS
} from './market-basket.service';

export {
  ReplacementCostService,
  getReplacementCostService,
  ReplacementCostEstimate,
  PropertyInput
} from './replacement-cost.service';
