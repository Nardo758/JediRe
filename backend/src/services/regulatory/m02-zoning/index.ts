/**
 * M02 Zoning Module — registry + entry point
 *
 * Usage:
 *   import { lookupRegulatory } from '../regulatory/m02-zoning';
 *   const rc = await lookupRegulatory({ address, lat, lng, county_fips, state });
 *
 * Routing logic:
 *   Selects the correct jurisdiction adapter based on state + county_fips.
 *   Returns emptyRegulatoryConstraints() if no adapter covers the jurisdiction.
 *
 * Adding a new metro:
 *   1. Create adapters/<metro>.ts implementing RegulatoryAdapter.
 *   2. Import and register below in FIPS_REGISTRY or STATE_REGISTRY.
 *   3. Add zoning-codes/<jurisdiction>.json lookup table.
 *   4. See docs/operations/M02_ADAPTER_TEMPLATE.md for the full checklist.
 */

import { logger } from '../../../utils/logger';
import { emptyRegulatoryConstraints } from '../types';
import type { RegulatoryConstraints } from '../types';
import type { RegulatoryAdapter, RegulatoryLookupInput } from './adapter-interface';
import { atlantaAdapter } from './adapters/atlanta';

export type { RegulatoryConstraints } from '../types';
export type { RegulatoryLookupInput } from './adapter-interface';

// ── FIPS-based registry ────────────────────────────────────────────────────
// Maps 5-digit county FIPS → adapter.
// Highest-specificity routing: used when Census Geocoder has resolved a FIPS.

const FIPS_REGISTRY: Record<string, RegulatoryAdapter> = {
  // Atlanta metro GA
  '13121': atlantaAdapter,  // Fulton
  '13089': atlantaAdapter,  // DeKalb
  '13067': atlantaAdapter,  // Cobb
  '13135': atlantaAdapter,  // Gwinnett
  '13057': atlantaAdapter,  // Cherokee
  '13063': atlantaAdapter,  // Clayton
  '13151': atlantaAdapter,  // Henry
  '13117': atlantaAdapter,  // Forsyth
  '13223': atlantaAdapter,  // Paulding
  // Miami-Dade: add when Miami-Dade adapter ships
  // '12086': miamiDadeAdapter,
};

// ── State-based registry ───────────────────────────────────────────────────
// Fallback when no FIPS is available.  Only used if FIPS lookup misses.

const STATE_REGISTRY: Record<string, RegulatoryAdapter> = {
  // 'GA': atlantaAdapter,  // uncomment when Atlanta covers all GA counties
};

// ── Main lookup ────────────────────────────────────────────────────────────

/**
 * Look up regulatory constraints for a property.
 *
 * Never throws.  Returns a fully-populated RegulatoryConstraints object;
 * unknown fields are null-valued LayeredValues.
 */
export async function lookupRegulatory(
  input: RegulatoryLookupInput,
): Promise<RegulatoryConstraints> {
  const fips = input.county_fips?.trim() ?? null;
  const state = input.state.trim().toUpperCase();

  // ── FIPS route (preferred) ─────────────────────────────────────────────
  if (fips && FIPS_REGISTRY[fips]) {
    const adapter = FIPS_REGISTRY[fips];
    logger.debug(
      `[m02] FIPS route: fips=${fips} → adapter="${adapter.id}" for "${input.address}"`,
    );
    try {
      return await adapter.lookupRegulatory(input);
    } catch (err: any) {
      logger.error(
        `[m02] adapter "${adapter.id}" threw unexpectedly for "${input.address}": ${err?.message ?? String(err)}`,
      );
      return emptyRegulatoryConstraints(
        `Unknown (adapter error)`,
        'zoning',
        'not_available',
        [adapter.id, `error:${err?.message ?? 'unknown'}`],
      );
    }
  }

  // ── State route (fallback) ─────────────────────────────────────────────
  if (STATE_REGISTRY[state]) {
    const adapter = STATE_REGISTRY[state];
    logger.debug(
      `[m02] state route: state=${state} → adapter="${adapter.id}" for "${input.address}"`,
    );
    try {
      return await adapter.lookupRegulatory(input);
    } catch (err: any) {
      logger.error(`[m02] adapter "${adapter.id}" threw: ${err?.message ?? String(err)}`);
      return emptyRegulatoryConstraints(
        `Unknown (adapter error)`,
        'zoning',
        'not_available',
        [adapter.id, `error:${err?.message ?? 'unknown'}`],
      );
    }
  }

  // ── No adapter for this jurisdiction ──────────────────────────────────
  logger.debug(`[m02] no adapter for state=${state} fips=${fips ?? 'n/a'} — returning empty`);
  return emptyRegulatoryConstraints(
    fips ? `Unknown county (FIPS ${fips})` : `${state} (not implemented)`,
    'zoning',
    'not_available',
    ['m02:not_implemented'],
  );
}
