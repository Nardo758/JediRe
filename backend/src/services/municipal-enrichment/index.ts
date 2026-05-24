/**
 * MunicipalEnrichmentService
 *
 * State router for county property-records lookups.
 *
 * Supports two lookup modes:
 *   lookup(address, state)          — primary path (address → county ArcGIS)
 *   lookupByParcelId(id, state)     — fallback path when address is unavailable
 *
 * Currently implements: GA → Fulton County ArcGIS adapter.
 * All other states return status:'not_implemented' (no regression).
 *
 * Usage:
 *   import { municipalEnrichment } from '../municipal-enrichment';
 *   const result = await municipalEnrichment.lookup('720 Ralph McGill Blvd NE', 'GA');
 *   const result = await municipalEnrichment.lookupByParcelId('14 001800080417', 'GA');
 */

import { logger } from '../../utils/logger';
import { lookupFultonGA, lookupFultonGAByParcelId } from './adapters/fulton-ga.adapter';
import type { MunicipalLookupResult } from './types';

export type { MunicipalLookupResult } from './types';

// ─── Service ──────────────────────────────────────────────────────────────────

class MunicipalEnrichmentService {
  /**
   * Look up property records by street address.
   *
   * @param address  Street address (e.g. "720 Ralph McGill Blvd NE")
   * @param state    Two-letter state code (e.g. "GA")
   */
  async lookup(address: string, state: string): Promise<MunicipalLookupResult> {
    const normalizedState = (state ?? '').trim().toUpperCase();

    if (!address || !address.trim()) {
      return { status: 'not_found', error: 'address is empty' };
    }

    switch (normalizedState) {
      case 'GA':
        logger.debug(`[municipal-enrichment] GA address lookup for "${address}"`);
        return lookupFultonGA(address.trim());

      default:
        logger.debug(`[municipal-enrichment] state ${normalizedState} not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };
    }
  }

  /**
   * Look up property records by parcel ID (exact match).
   * Use as a fallback when the street address is unavailable.
   *
   * @param parcelId  County parcel ID (e.g. "14 001800080417")
   * @param state     Two-letter state code (e.g. "GA")
   */
  async lookupByParcelId(parcelId: string, state: string): Promise<MunicipalLookupResult> {
    const normalizedState = (state ?? '').trim().toUpperCase();

    if (!parcelId || !parcelId.trim()) {
      return { status: 'not_found', error: 'parcelId is empty' };
    }

    switch (normalizedState) {
      case 'GA':
        logger.debug(`[municipal-enrichment] GA parcel-id lookup for "${parcelId}"`);
        return lookupFultonGAByParcelId(parcelId.trim());

      default:
        logger.debug(`[municipal-enrichment] state ${normalizedState} parcel-id lookup not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };
    }
  }
}

export const municipalEnrichment = new MunicipalEnrichmentService();
