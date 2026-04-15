/**
 * M35 Metric Key Translation Layer  (Phase 6)
 *
 * Bridges M35 shorthand metric keys (used in playbooks + forecasts) with the
 * platform-canonical metric_time_series.metric_id values used by M06, M08, M09.
 *
 * Why this exists:
 *   - M35 playbooks store metric keys as readable shorthands: "rent_growth_yoy"
 *   - metric_time_series uses canonical IDs: "CS_EFF_RENT_GROWTH"
 *   - M06 Demand Signal, M08 Strategies, M09 Market Intelligence each have their
 *     own label conventions; this layer allows any module to consume M35 forecasts
 *     using its own vocabulary.
 *
 * Usage:
 *   import { toCanonicalId, fromCanonicalId, resolveMetricForQuery } from './m35-metric-mapping';
 */

// ─── Core mapping: M35 key → canonical DB metric_id ──────────────────────────

export const M35_TO_CANONICAL: Record<string, string> = {
  // Rent / Price
  rent_growth_yoy:         'CS_EFF_RENT_GROWTH',
  rent_growth_qtr:         'CS_EFF_RENT_GROWTH_QTR',
  effective_rent:          'CS_EFFECTIVE_RENT',
  market_rent:             'CS_MARKET_RENT',
  rent_index:              'CS_RENT_INDEX',
  price_growth:            'CS_PRICE_GROWTH',
  price_index:             'CS_PRICE_INDEX',
  median_price_unit:       'CS_MEDIAN_PRICE_UNIT',
  sale_price_unit:         'CS_SALE_PRICE_UNIT',
  txn_price_unit:          'CS_TXN_PRICE_UNIT',

  // Occupancy / Vacancy / Absorption
  occupancy_rate:          'CS_OCCUPANCY_RATE',
  vacancy_rate:            'CS_VACANCY_RATE',
  stabilized_vacancy:      'CS_STABILIZED_VACANCY',
  net_absorption:          'CS_NET_ABSORPTION',
  absorption_pct:          'CS_ABSORPTION_PCT',
  absorption_units:        'CS_ABSORPTION_UNITS',
  demand_units:            'CS_DEMAND_UNITS',

  // Supply / Construction
  permits_issued:          'CS_CONSTR_STARTS',
  constr_starts:           'CS_CONSTR_STARTS',
  constr_starts_12mo:      'CS_CONSTR_STARTS_12MO',
  deliveries:              'CS_DELIVERIES',
  net_deliveries:          'CS_NET_DELIVERIES',
  net_deliveries_12mo:     'CS_NET_DELIVERIES_12MO',
  under_construction:      'CS_UNDER_CONSTRUCTION',
  under_constr_pct:        'CS_UNDER_CONSTR_PCT',
  inventory_units:         'CS_INVENTORY_UNITS',

  // Transactions / Investment
  cap_rate:                'CS_CAP_RATE',
  median_cap_rate:         'CS_MEDIAN_CAP_RATE',
  transaction_cap_rate:    'CS_TRANSACTION_CAP_RATE',
  asset_value:             'CS_ASSET_VALUE',
  sales_volume:            'CS_SALES_VOLUME',
  sales_vol_growth:        'CS_SALES_VOL_GROWTH',
  avg_sale_price:          'CS_AVG_SALE_PRICE',

  // Digital / Traffic / Demand signals (M06 / CoStar Traffic)
  search_growth:           'C_SEARCH_GROWTH_INDEX',
  traffic_growth:          'C_TRAFFIC_GROWTH_INDEX',
  surge_index:             'C_SURGE_INDEX',
  tpi:                     'C_TPI',
  tvs:                     'C_TVS',
  digital_physical_gap:    'C_DIGITAL_PHYSICAL_GAP',
};

// ─── Inverse mapping: canonical → M35 key ─────────────────────────────────────

export const CANONICAL_TO_M35: Record<string, string> = Object.fromEntries(
  Object.entries(M35_TO_CANONICAL).map(([k, v]) => [v, k]),
);

// ─── Module-specific alias mapping ───────────────────────────────────────────

/**
 * Aliases used by each module — allows M35 forecasts to be consumed using
 * the vocabulary each module already knows.
 */
export const MODULE_ALIASES: Record<string, Record<string, string>> = {
  // M06 Demand Signal: its own signal keys
  M06: {
    demand_signal_rent:      'rent_growth_yoy',
    demand_signal_traffic:   'search_growth',
    demand_signal_vacancy:   'vacancy_rate',
    demand_signal_absorption:'net_absorption',
    jedi_score_driver_rent:  'rent_growth_yoy',
    jedi_score_driver_occ:   'occupancy_rate',
  },
  // M08 Strategies: outcome metric keys used in strategy conditions
  M08: {
    outcome_rent_growth:     'rent_growth_yoy',
    outcome_cap_rate:        'cap_rate',
    outcome_absorption:      'net_absorption',
    outcome_vacancy:         'vacancy_rate',
    outcome_price_growth:    'price_growth',
    outcome_constr:          'permits_issued',
    outcome_search:          'search_growth',
  },
  // M09 Market Intelligence: report-layer names
  M09: {
    mi_rent_growth:          'rent_growth_yoy',
    mi_occupancy:            'occupancy_rate',
    mi_cap_rate:             'cap_rate',
    mi_net_absorption:       'net_absorption',
    mi_price_psf:            'median_price_unit',
    mi_construction_starts:  'permits_issued',
    mi_traffic:              'search_growth',
  },
};

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Convert M35 shorthand to canonical DB metric_id.
 * Falls through: if the key is already canonical, returns as-is.
 */
export function toCanonicalId(m35Key: string): string {
  // Already canonical?
  if (m35Key.startsWith('CS_') || m35Key.startsWith('C_')) return m35Key;
  return M35_TO_CANONICAL[m35Key] ?? m35Key;
}

/**
 * Convert canonical DB metric_id to M35 shorthand key.
 */
export function fromCanonicalId(canonicalId: string): string {
  return CANONICAL_TO_M35[canonicalId] ?? canonicalId;
}

/**
 * Resolve an incoming metric key from any module (M06/M08/M09) to M35 key.
 * Falls through if not found.
 */
export function fromModuleAlias(moduleId: 'M06' | 'M08' | 'M09', aliasKey: string): string {
  return MODULE_ALIASES[moduleId]?.[aliasKey] ?? aliasKey;
}

/**
 * Convert an M35 metric key to the M06-specific alias (e.g. 'demand_signal_rent').
 * Returns undefined when the metric is not tracked by M06.
 */
export function toM06Key(metricKey: string): string | undefined {
  return Object.entries(MODULE_ALIASES.M06).find(([, v]) => v === metricKey)?.[0];
}

/**
 * Convert an M35 metric key to the M08-specific alias (e.g. 'outcome_rent_growth').
 * Returns undefined when the metric is not tracked by M08.
 */
export function toM08Key(metricKey: string): string | undefined {
  return Object.entries(MODULE_ALIASES.M08).find(([, v]) => v === metricKey)?.[0];
}

/**
 * Convert an M35 metric key to the M09-specific alias (e.g. 'mi_rent_growth').
 * Returns undefined when the metric is not tracked by M09.
 */
export function toM09Key(metricKey: string): string | undefined {
  return Object.entries(MODULE_ALIASES.M09).find(([, v]) => v === metricKey)?.[0];
}

/**
 * Resolve M35 shorthand → canonical for DB queries.
 * Returns the canonical ID to use in metric_time_series WHERE metric_id = ?
 */
export function resolveMetricForQuery(m35Key: string): string {
  return toCanonicalId(m35Key);
}

/**
 * Get all M35 shorthand keys for a given canonical ID (may be multiple).
 */
export function getM35KeysForCanonical(canonicalId: string): string[] {
  return Object.entries(M35_TO_CANONICAL)
    .filter(([, v]) => v === canonicalId)
    .map(([k]) => k);
}

/**
 * Given a list of M35 metric keys, return their canonical IDs.
 */
export function batchToCanonical(m35Keys: string[]): string[] {
  return m35Keys.map(toCanonicalId);
}

/**
 * Given a list of canonical IDs, return M35 shorthands (for display).
 */
export function batchFromCanonical(canonicalIds: string[]): string[] {
  return canonicalIds.map(fromCanonicalId);
}

/**
 * Human-readable display label for a metric key (M35 or canonical).
 */
export const METRIC_DISPLAY_LABELS: Record<string, string> = {
  rent_growth_yoy:   'Rent Growth (YoY)',
  rent_growth_qtr:   'Rent Growth (QTR)',
  effective_rent:    'Effective Rent',
  market_rent:       'Market Rent',
  occupancy_rate:    'Occupancy Rate',
  vacancy_rate:      'Vacancy Rate',
  net_absorption:    'Net Absorption',
  absorption_pct:    'Absorption %',
  permits_issued:    'Permits Issued / Constr. Starts',
  deliveries:        'Deliveries',
  cap_rate:          'Cap Rate',
  median_cap_rate:   'Median Cap Rate',
  asset_value:       'Asset Value',
  sales_volume:      'Sales Volume',
  price_growth:      'Price Growth',
  search_growth:     'Search / Traffic Growth',
  traffic_growth:    'Traffic Growth Index',
  surge_index:       'Surge Index',
  tpi:               'Traffic Performance Index',
  tvs:               'Traffic Volume Score',
  median_price_unit: 'Median Price per Unit',
  under_construction:'Under Construction',
  inventory_units:   'Inventory Units',
};

export function getDisplayLabel(key: string): string {
  return METRIC_DISPLAY_LABELS[key]
    ?? METRIC_DISPLAY_LABELS[fromCanonicalId(key)]
    ?? key;
}

/**
 * Direction conventions per metric:
 * 'up' = higher is bullish, 'down' = lower is bullish
 */
export const METRIC_BULL_DIRECTION: Record<string, 'up' | 'down'> = {
  rent_growth_yoy:  'up',
  effective_rent:   'up',
  occupancy_rate:   'up',
  net_absorption:   'up',
  absorption_pct:   'up',
  price_growth:     'up',
  asset_value:      'up',
  sales_volume:     'up',
  search_growth:    'up',
  traffic_growth:   'up',
  surge_index:      'up',
  tpi:              'up',
  permits_issued:   'up',
  deliveries:       'down',   // high deliveries = supply pressure
  vacancy_rate:     'down',   // lower vacancy = better
  cap_rate:         'down',   // cap rate compression = appreciation
};

/**
 * Returns whether a positive point estimate is bullish or bearish.
 */
export function isBullishSignal(m35Key: string, pointEstimate: number): boolean {
  const dir = METRIC_BULL_DIRECTION[m35Key] ?? 'up';
  return dir === 'up' ? pointEstimate > 0 : pointEstimate < 0;
}

/**
 * Metric unit suffixes for formatting forecast outputs.
 */
export const METRIC_FORMAT: Record<string, { suffix: string; decimals: number; isPercent: boolean }> = {
  rent_growth_yoy:   { suffix: '%', decimals: 1, isPercent: true },
  rent_growth_qtr:   { suffix: '%', decimals: 1, isPercent: true },
  occupancy_rate:    { suffix: '%', decimals: 1, isPercent: true },
  vacancy_rate:      { suffix: '%', decimals: 1, isPercent: true },
  absorption_pct:    { suffix: '%', decimals: 1, isPercent: true },
  net_absorption:    { suffix: ' units', decimals: 0, isPercent: false },
  cap_rate:          { suffix: '%', decimals: 2, isPercent: true },
  median_cap_rate:   { suffix: '%', decimals: 2, isPercent: true },
  price_growth:      { suffix: '%', decimals: 1, isPercent: true },
  search_growth:     { suffix: '%', decimals: 0, isPercent: true },
  traffic_growth:    { suffix: '%', decimals: 0, isPercent: true },
  permits_issued:    { suffix: ' starts', decimals: 0, isPercent: false },
  deliveries:        { suffix: ' units', decimals: 0, isPercent: false },
  effective_rent:    { suffix: '/mo', decimals: 0, isPercent: false },
  median_price_unit: { suffix: '/unit', decimals: 0, isPercent: false },
  asset_value:       { suffix: 'M', decimals: 1, isPercent: false },
  sales_volume:      { suffix: 'M', decimals: 0, isPercent: false },
};

export function formatMetricValue(key: string, value: number): string {
  const fmt = METRIC_FORMAT[key] ?? { suffix: '', decimals: 2, isPercent: false };
  const scaled = fmt.isPercent ? value * 100 : value;
  return `${scaled.toFixed(fmt.decimals)}${fmt.suffix}`;
}

// ─── Integration exports for M06 / M08 / M09 ─────────────────────────────────

/**
 * M06 Demand Signal Integration:
 * Given an active M35 forecast for an MSA, return a M06-compatible
 * demand signal overlay object that M06 can merge into its JEDI score.
 */
export function toM06DemandOverlay(forecast: {
  eventId: string;
  subtype: string;
  metrics: Array<{ metricKey: string; windowMonths: number; pointEstimate: number | null; confidence: number }>;
}): Record<string, {
  eventId: string;
  subtype: string;
  delta: number | null;
  confidence: number;
  windowMonths: number;
  canonicalId: string;
}> {
  const overlay: Record<string, any> = {};

  for (const m of forecast.metrics) {
    const canonicalId = toCanonicalId(m.metricKey);
    const m06Key = Object.entries(MODULE_ALIASES.M06)
      .find(([, v]) => v === m.metricKey)?.[0] ?? m.metricKey;

    overlay[m06Key] = {
      eventId: forecast.eventId,
      subtype: forecast.subtype,
      delta: m.pointEstimate,
      confidence: m.confidence,
      windowMonths: m.windowMonths,
      canonicalId,
    };
  }

  return overlay;
}

/**
 * M08 Strategies Integration:
 * Convert M35 forecast metrics into M08's outcome_metric format.
 * Used when M08 backtests evaluate strategies that benefited from event-driven demand.
 */
export function toM08OutcomeMetrics(
  metrics: Array<{ metricKey: string; pointEstimate: number | null; confidence: number; windowMonths: number }>,
): Array<{ outcomeMetricId: string; expectedDelta: number | null; confidence: number; windowMonths: number }> {
  return metrics.map(m => ({
    outcomeMetricId: toCanonicalId(m.metricKey),
    expectedDelta: m.pointEstimate,
    confidence: m.confidence,
    windowMonths: m.windowMonths,
  }));
}

/**
 * M09 Market Intelligence Integration:
 * Format M35 forecast as a Market Intelligence report section.
 */
export function toM09ReportSection(
  eventName: string,
  subtype: string,
  metrics: Array<{ metricKey: string; windowMonths: number; pointEstimate: number | null; confidence: number; ciLow: number | null; ciHigh: number | null }>,
): {
  headline: string;
  subtype: string;
  metrics: Array<{
    label: string;
    window: string;
    formatted: string;
    ciFormatted: string | null;
    confidence: number;
    isBullish: boolean;
  }>;
} {
  return {
    headline: `${eventName} — Event Impact Forecast`,
    subtype,
    metrics: metrics
      .filter(m => m.pointEstimate !== null)
      .map(m => ({
        label: getDisplayLabel(m.metricKey),
        window: `T+${m.windowMonths}mo`,
        formatted: formatMetricValue(m.metricKey, m.pointEstimate!),
        ciFormatted: m.ciLow !== null && m.ciHigh !== null
          ? `[${formatMetricValue(m.metricKey, m.ciLow)}, ${formatMetricValue(m.metricKey, m.ciHigh)}]`
          : null,
        confidence: m.confidence,
        isBullish: isBullishSignal(m.metricKey, m.pointEstimate!),
      })),
  };
}
