/**
 * MunicipalEnrichmentService
 *
 * State router for county property-records lookups.
 * Currently implements: GA → Fulton County ArcGIS adapter.
 * All other states return status:'not_implemented' (no regression).
 *
 * Usage:
 *   import { municipalEnrichment } from '../municipal-enrichment';
 *   const result = await municipalEnrichment.lookup('720 Ralph McGill Blvd NE', 'GA');
 */

import { logger } from '../../utils/logger';
import { lookupFultonGA } from './adapters/fulton-ga.adapter';
import type { MunicipalLookupResult } from './types';

export type { MunicipalLookupResult } from './types';

// ─── State router ─────────────────────────────────────────────────────────────

class MunicipalEnrichmentService {
  /**
   * Look up property records for the given address and state.
   *
   * @param address  Street address (e.g. "720 Ralph McGill Blvd NE")
   * @param state    Two-letter state code (e.g. "GA")
   * @param county   Optional county hint (unused for GA — Fulton is the only adapter)
   */
  async lookup(
    address: string,
    state:   string,
    county?: string,
  ): Promise<MunicipalLookupResult> {
    const normalizedState = (state ?? '').trim().toUpperCase();

    if (!address || !address.trim()) {
      return { status: 'not_found', error: 'address is empty' };
    }

    switch (normalizedState) {
      case 'GA':
        logger.debug(`[municipal-enrichment] GA → Fulton adapter for "${address}"`);
        return lookupFultonGA(address.trim());

      default:
        logger.debug(`[municipal-enrichment] state ${normalizedState} not implemented`);
        return {
          status: 'not_implemented',
          state:  normalizedState,
          source: 'stub',
        };
    }
  }
}

export const municipalEnrichment = new MunicipalEnrichmentService();
