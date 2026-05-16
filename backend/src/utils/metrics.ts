/**
 * Metrics stub — structured-log-backed implementation.
 *
 * A real push-to-Prometheus/Datadog integration can slot in here later.
 * For now every metric write is a no-op on the wire but the call sites are
 * wired up so telemetry is trivially enabled by replacing this module.
 */

import { logger } from './logger';

interface Tags {
  [key: string]: string | number | boolean | undefined;
}

function stringify(tags?: Tags): string {
  if (!tags || Object.keys(tags).length === 0) return '';
  return ' ' + Object.entries(tags)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
}

export const metrics = {
  /**
   * Increment a counter metric.
   * Example: metrics.increment('cashflow.evidence.repaired', 1, { prompt_version: 'v5.1.0' })
   */
  increment(name: string, value: number = 1, tags?: Tags): void {
    logger.debug(`[metric:counter] ${name}=${value}${stringify(tags)}`);
  },

  /**
   * Set a gauge metric.
   * Example: metrics.gauge('cashflow.evidence.conformance_rate', 0.95, { prompt_version: 'v5.1.0' })
   */
  gauge(name: string, value: number, tags?: Tags): void {
    logger.debug(`[metric:gauge] ${name}=${value}${stringify(tags)}`);
  },

  /**
   * Record a timing metric (milliseconds).
   */
  timing(name: string, ms: number, tags?: Tags): void {
    logger.debug(`[metric:timing] ${name}=${ms}ms${stringify(tags)}`);
  },
};
