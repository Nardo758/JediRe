/**
 * M02 Zoning — adapter interface
 *
 * Every jurisdiction adapter implements this interface.  The registry in
 * index.ts selects the right adapter based on county FIPS / state and
 * calls lookupRegulatory().
 *
 * Adapter contract:
 *   - MUST return a complete RegulatoryConstraints object (never undefined).
 *   - Unknown / unavailable fields MUST use null values (not omitted keys).
 *   - All constraint values MUST be wrapped in LayeredValue with correct source tag.
 *   - source_chain MUST list every endpoint / file consulted, in order.
 *   - If the jurisdiction cannot be resolved, return emptyRegulatoryConstraints()
 *     with jurisdiction = best-known value and source_chain noting the failure.
 */

import type { RegulatoryConstraints } from '../types';

export interface RegulatoryLookupInput {
  /** Normalized street address (without unit suffix). */
  address: string;
  /** WGS84 latitude — preferred when available (avoids second geocode round-trip). */
  lat?: number | null;
  /** WGS84 longitude. */
  lng?: number | null;
  /** County FIPS code from Census Geocoder (e.g. "13121" for Fulton). */
  county_fips?: string | null;
  /** County parcel ID, if already resolved by municipal lookup. */
  parcel_id?: string | null;
  /** City / municipality hint. */
  city?: string | null;
  /** Two-letter state code. */
  state: string;
}

export interface RegulatoryAdapter {
  /**
   * Unique identifier for this adapter.
   * Used in source_chain and log entries.
   * Format: "m02_<jurisdiction>" e.g. "m02_atlanta_city", "m02_fulton_ga"
   */
  readonly id: string;

  /**
   * Human-readable name for this adapter.
   */
  readonly name: string;

  /**
   * Look up regulatory constraints for the given address / coordinates.
   * Must never throw — catch all errors internally and return a degraded
   * (empty) result with the error noted in source_chain.
   */
  lookupRegulatory(input: RegulatoryLookupInput): Promise<RegulatoryConstraints>;
}
