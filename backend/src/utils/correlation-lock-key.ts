import { createHash } from 'crypto';

/**
 * SCH-04: Generate a 64-bit advisory-lock key from a correlation pair identifier.
 *
 * Used by pg_advisory_xact_lock to serialize writes for a specific
 * (metricA, metricB, geographyType, geographyId, windowMonths, scope) combination.
 *
 * Both CorrelationEngineService and MetricCorrelationEngine import this single
 * free function so their lock keys are identical by construction. Any change
 * to the derivation is applied in one place and affects both callers.
 */
export function hashLockKey(
  metricA: string,
  metricB: string,
  geographyType: string,
  geographyId: string,
  windowMonths: number,
  scope: string
): number {
  const str = [metricA, metricB, geographyType, geographyId, String(windowMonths), scope].join('::');
  const hash = createHash('sha256').update(str).digest('hex');
  // Take the first 15 hex digits (60 bits) and convert to a signed 53-bit integer
  // so it fits safely in a JavaScript number and PostgreSQL bigint.
  return parseInt(hash.slice(0, 15), 16) % 9007199254740991;
}
