/**
 * Phase 3 — Reader Migration Feature Flags
 *
 * Each flag independently gates a single reader's new code path.
 * Flags default OFF. Promotion sequence:
 *   1. Create flag (default OFF) — shadow comparison running
 *   2. After ≥ 7 days shadow clean → promote to 10% canary (set env to "canary")
 *   3. After canary metrics OK → 100% (set env to "true")
 *   4. After ≥ 30 days at 100% → remove old code path + flag
 *
 * Environment variable format:
 *   USE_NEW_PROPERTY_SCHEMA_<READER_NAME>=false|shadow|canary|true
 *
 * "shadow" = old path serves; new path runs in parallel and logs divergences
 * "canary"  = new path serves for ~10% of requests (use random sampling at call site)
 * "true"    = new path serves for all requests
 * "false"   = old path only (default)
 */

export type FlagState = 'false' | 'shadow' | 'canary' | 'true';

function readFlag(envKey: string): FlagState {
  const v = (process.env[envKey] ?? 'false').toLowerCase().trim();
  if (v === 'shadow' || v === 'canary' || v === 'true') return v;
  return 'false';
}

/**
 * Returns true if the new code path should serve this request.
 * For "canary" state, uses the provided random value (0–1) to gate ~10%.
 */
export function shouldUseNewPath(flag: FlagState, rand = Math.random()): boolean {
  if (flag === 'true') return true;
  if (flag === 'canary') return rand < 0.1;
  return false;
}

/**
 * Returns true if shadow comparison should run for this request.
 * Shadow runs when flag is "shadow" or "canary" (for canary, shadow logs non-serving path).
 */
export function shouldRunShadow(flag: FlagState): boolean {
  return flag === 'shadow' || flag === 'canary';
}

// ---------------------------------------------------------------
// Wave 1 — Foundation readers
// ---------------------------------------------------------------

/** R-001: DealService deal→property resolution */
export const DEAL_RESOLVE_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_DEAL_RESOLVE');

/** R-002: Cashflow Agent property context */
export const CASHFLOW_AGENT_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_CASHFLOW_AGENT');

/** R-003: Document extraction data-router deal→property */
export const DATA_ROUTER_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_DATA_ROUTER');

/** R-004: Leasing/traffic routes deal→property */
export const LEASING_TRAFFIC_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_LEASING_TRAFFIC');

/** R-005: Operations routes deal→property */
export const OPERATIONS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_OPERATIONS');

/** R-006: Agent inngest runners deal→property */
export const AGENT_RUNNERS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_AGENT_RUNNERS');

/** R-007: Inline-deals listing deal→property */
export const INLINE_DEALS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_INLINE_DEALS');

// ---------------------------------------------------------------
// Wave 2 — Valuation readers
// ---------------------------------------------------------------

/** R-008: Valuation Grid subject side */
export const VALUATION_SUBJECT_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_VALUATION_SUBJECT');

/** R-009: Valuation Grid comp side (largest behavioral change) */
export const VALUATION_COMPS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_VALUATION_COMPS');

/** R-010: CompSet service */
export const COMP_SET_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_COMP_SET');

/** R-011: Comp-query service + CompQueryEngine */
export const COMP_QUERY_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_COMP_QUERY');

/** R-012: Comp-set-discovery service */
export const COMP_SET_DISCOVERY_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_COMP_SET_DISCOVERY');

/** R-013: Georgia sale comps service */
export const GEORGIA_SALE_COMPS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_GEORGIA_SALE_COMPS');

/** R-014: Correlation engine sale comps */
export const CORRELATION_COMPS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_CORRELATION_COMPS');

/** R-015: Comp-dedup + comp-cascade services */
export const COMP_DEDUP_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_COMP_DEDUP');

/** R-016: Backtest snapshot capture */
export const BACKTEST_SNAPSHOT_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_BACKTEST_SNAPSHOT');

/** R-017: Georgia ingestion capital tab */
export const GEORGIA_CAPITAL_TAB_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_GEORGIA_CAPITAL_TAB');

// ---------------------------------------------------------------
// Wave 3 — Analytical readers
// ---------------------------------------------------------------

/** R-018: F3 Markets / property grid */
export const PROPERTY_GRID_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_PROPERTY_GRID');

/** R-019: Competition module */
export const COMPETITION_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_COMPETITION');

/** R-020: Property rankings */
export const RANKINGS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_RANKINGS');

/** R-021: PropertyMetrics service */
export const PROPERTY_METRICS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_PROPERTY_METRICS');

/** R-022: PropertyScoring service */
export const PROPERTY_SCORING_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_PROPERTY_SCORING');

/** R-023: Spatial analysis */
export const SPATIAL_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_SPATIAL');

/** R-024: Neighboring property engine */
export const NEIGHBORING_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_NEIGHBORING');

/** R-025: F4 Supply module */
export const SUPPLY_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_SUPPLY');

/** R-026: F6 Traffic module */
export const TRAFFIC_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_TRAFFIC');

/** R-027: Neural network data matrix */
export const NEURAL_MATRIX_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_NEURAL_MATRIX');

/** R-028: Inflation engine */
export const INFLATION_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_INFLATION');

/** R-029: Deal-market-intelligence routes */
export const DEAL_MARKET_INTEL_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_DEAL_MARKET_INTEL');

/** R-030: JEDI score service */
export const JEDI_SCORE_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_JEDI_SCORE');

/** R-031: Unit mix intelligence */
export const UNIT_MIX_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_UNIT_MIX');

/** R-032: Tax comp analysis */
export const TAX_COMPS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_TAX_COMPS');

// ---------------------------------------------------------------
// Wave 4 — Strategy-aware readers
// ---------------------------------------------------------------

/** R-033: Strategy-aware comp selection */
export const STRATEGY_COMPS_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_STRATEGY_COMPS');

/** R-034: Strategy projection service */
export const STRATEGY_PROJECTION_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_STRATEGY_PROJECTION');

// ---------------------------------------------------------------
// Wave 5 — Post-close and capsule
// ---------------------------------------------------------------

/** R-035: M22 post-close intelligence */
export const M22_POST_CLOSE_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_M22_POST_CLOSE');

/** R-036: Deal Capsule rendering */
export const DEAL_CAPSULE_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_DEAL_CAPSULE');

/** R-037: Freeze-on-share snapshot */
export const FREEZE_SNAPSHOT_FLAG = (): FlagState =>
  readFlag('USE_NEW_PROPERTY_SCHEMA_FREEZE_SNAPSHOT');

// ---------------------------------------------------------------
// Utility: dump current flag state (for admin/debug)
// ---------------------------------------------------------------

export function allFlagStates(): Record<string, FlagState> {
  return {
    DEAL_RESOLVE: DEAL_RESOLVE_FLAG(),
    CASHFLOW_AGENT: CASHFLOW_AGENT_FLAG(),
    DATA_ROUTER: DATA_ROUTER_FLAG(),
    LEASING_TRAFFIC: LEASING_TRAFFIC_FLAG(),
    OPERATIONS: OPERATIONS_FLAG(),
    AGENT_RUNNERS: AGENT_RUNNERS_FLAG(),
    INLINE_DEALS: INLINE_DEALS_FLAG(),
    VALUATION_SUBJECT: VALUATION_SUBJECT_FLAG(),
    VALUATION_COMPS: VALUATION_COMPS_FLAG(),
    COMP_SET: COMP_SET_FLAG(),
    COMP_QUERY: COMP_QUERY_FLAG(),
    COMP_SET_DISCOVERY: COMP_SET_DISCOVERY_FLAG(),
    GEORGIA_SALE_COMPS: GEORGIA_SALE_COMPS_FLAG(),
    CORRELATION_COMPS: CORRELATION_COMPS_FLAG(),
    COMP_DEDUP: COMP_DEDUP_FLAG(),
    BACKTEST_SNAPSHOT: BACKTEST_SNAPSHOT_FLAG(),
    GEORGIA_CAPITAL_TAB: GEORGIA_CAPITAL_TAB_FLAG(),
    PROPERTY_GRID: PROPERTY_GRID_FLAG(),
    COMPETITION: COMPETITION_FLAG(),
    RANKINGS: RANKINGS_FLAG(),
    PROPERTY_METRICS: PROPERTY_METRICS_FLAG(),
    PROPERTY_SCORING: PROPERTY_SCORING_FLAG(),
    SPATIAL: SPATIAL_FLAG(),
    NEIGHBORING: NEIGHBORING_FLAG(),
    SUPPLY: SUPPLY_FLAG(),
    TRAFFIC: TRAFFIC_FLAG(),
    NEURAL_MATRIX: NEURAL_MATRIX_FLAG(),
    INFLATION: INFLATION_FLAG(),
    DEAL_MARKET_INTEL: DEAL_MARKET_INTEL_FLAG(),
    JEDI_SCORE: JEDI_SCORE_FLAG(),
    UNIT_MIX: UNIT_MIX_FLAG(),
    TAX_COMPS: TAX_COMPS_FLAG(),
    STRATEGY_COMPS: STRATEGY_COMPS_FLAG(),
    STRATEGY_PROJECTION: STRATEGY_PROJECTION_FLAG(),
    M22_POST_CLOSE: M22_POST_CLOSE_FLAG(),
    DEAL_CAPSULE: DEAL_CAPSULE_FLAG(),
    FREEZE_SNAPSHOT: FREEZE_SNAPSHOT_FLAG(),
  };
}
