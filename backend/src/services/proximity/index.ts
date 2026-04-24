/**
 * Proximity, Events & Backtest Services
 * 
 * Provides spatial context, market event tracking, and historical validation
 * for the JediRe neural network.
 */

// Types
export * from './types';

// Services
export { ProximityService, getProximityService } from './proximity.service';
export { MarketEventsService, getMarketEventsService } from './events.service';
export { BacktestService, getBacktestService, BacktestConfig, BacktestResult } from './backtest.service';
