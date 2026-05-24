/**
 * MunicipalEnrichmentService
 *
 * State router for county property-records lookups.
 *
 * Supports two lookup modes:
 *   lookup(address, state, city?)      — primary path (address → county ArcGIS)
 *   lookupByParcelId(id, state, city?) — fallback path when address is unavailable
 *
 * City is used to disambiguate multi-county states (TX, FL).
 *
 * Currently implements:
 *   GA → Fulton County ArcGIS adapter      (Atlanta/Fulton)
 *       → DeKalb County ArcGIS adapter     (fallback for non-Fulton GA addresses)
 *       → Cobb County ArcGIS adapter       (Cumberland/Vinings/Smyrna area)
 *   NC → Mecklenburg County ArcGIS adapter (Charlotte)
 *   TN → Davidson County ArcGIS adapter    (Nashville)
 *   TX → Dallas County DCAD adapter        (Dallas)
 *       → Harris County HCAD adapter       (Houston)
 *   FL → Duval County COJ adapter          (Jacksonville)
 *
 * All other states/cities return status:'not_implemented' (no regression).
 *
 * Usage:
 *   import { municipalEnrichment } from '../municipal-enrichment';
 *   const result = await municipalEnrichment.lookup('720 Ralph McGill Blvd NE', 'GA');
 *   const result = await municipalEnrichment.lookup('900 Church St', 'TN', 'Nashville');
 *   const result = await municipalEnrichment.lookupByParcelId('14 001800080417', 'GA');
 */

import { logger } from '../../utils/logger';
import { lookupFultonGA, lookupFultonGAByParcelId }           from './adapters/fulton-ga.adapter';
import { lookupDeKalbGA, lookupDeKalbGAByParcelId }           from './adapters/dekalb-ga.adapter';
import { lookupCobbGA, lookupCobbGAByParcelId }               from './adapters/cobb-ga.adapter';
import { lookupMecklenburgNC, lookupMecklenburgNCByParcelId } from './adapters/mecklenburg-nc.adapter';
import { lookupDavidsonTN, lookupDavidsonTNByParcelId }       from './adapters/davidson-tn.adapter';
import { lookupDallasTX, lookupDallasTXByParcelId }           from './adapters/dallas-tx.adapter';
import { lookupHarrisTX, lookupHarrisTXByParcelId }           from './adapters/harris-tx.adapter';
import { lookupDuvalFL, lookupDuvalFLByParcelId }             from './adapters/duval-fl.adapter';
import type { MunicipalLookupResult } from './types';

export type { MunicipalLookupResult } from './types';

// ─── City normalization ────────────────────────────────────────────────────────

function normalizeCity(city?: string | null): string {
  return (city ?? '').toLowerCase().trim();
}

// ─── Service ──────────────────────────────────────────────────────────────────

class MunicipalEnrichmentService {
  /**
   * Look up property records by street address.
   *
   * @param address  Street address (e.g. "720 Ralph McGill Blvd NE")
   * @param state    Two-letter state code (e.g. "GA")
   * @param city     City name — used to route multi-county states (e.g. TX, FL)
   */
  async lookup(address: string, state: string, city?: string | null): Promise<MunicipalLookupResult> {
    const normalizedState = (state ?? '').trim().toUpperCase();
    const normalizedCity  = normalizeCity(city);

    if (!address || !address.trim()) {
      return { status: 'not_found', error: 'address is empty' };
    }

    switch (normalizedState) {
      case 'GA': {
        logger.debug(`[municipal-enrichment] GA address lookup for "${address}" — trying Fulton first`);
        const fultonResult = await lookupFultonGA(address.trim());
        if (fultonResult.status === 'ok') return fultonResult;
        // Fulton miss → try DeKalb
        logger.debug(`[municipal-enrichment] Fulton miss (${fultonResult.status}), falling back to DeKalb for "${address}"`);
        const dekalbResult = await lookupDeKalbGA(address.trim());
        if (dekalbResult.status === 'ok') return dekalbResult;
        // DeKalb miss → try Cobb (Cumberland/Vinings/Smyrna area)
        logger.debug(`[municipal-enrichment] DeKalb miss (${dekalbResult.status}), falling back to Cobb for "${address}"`);
        return lookupCobbGA(address.trim());
      }

      case 'NC':
        if (!normalizedCity || normalizedCity.includes('charlotte') || normalizedCity.includes('mecklenburg')) {
          logger.debug(`[municipal-enrichment] NC/Mecklenburg address lookup for "${address}"`);
          return lookupMecklenburgNC(address.trim());
        }
        logger.debug(`[municipal-enrichment] NC city "${city}" not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'TN':
        if (!normalizedCity || normalizedCity.includes('nashville') || normalizedCity.includes('davidson')) {
          logger.debug(`[municipal-enrichment] TN/Davidson address lookup for "${address}"`);
          return lookupDavidsonTN(address.trim());
        }
        logger.debug(`[municipal-enrichment] TN city "${city}" not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'TX':
        if (normalizedCity.includes('dallas')) {
          logger.debug(`[municipal-enrichment] TX/Dallas address lookup for "${address}"`);
          return lookupDallasTX(address.trim());
        }
        if (normalizedCity.includes('houston')) {
          logger.debug(`[municipal-enrichment] TX/Harris address lookup for "${address}"`);
          return lookupHarrisTX(address.trim());
        }
        logger.debug(`[municipal-enrichment] TX city "${city}" not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'FL':
        if (normalizedCity.includes('jacksonville')) {
          logger.debug(`[municipal-enrichment] FL/Duval address lookup for "${address}"`);
          return lookupDuvalFL(address.trim());
        }
        logger.debug(`[municipal-enrichment] FL city "${city}" not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

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
   * @param city      City name — used to route multi-county states (e.g. TX, FL)
   */
  async lookupByParcelId(parcelId: string, state: string, city?: string | null): Promise<MunicipalLookupResult> {
    const normalizedState = (state ?? '').trim().toUpperCase();
    const normalizedCity  = normalizeCity(city);

    if (!parcelId || !parcelId.trim()) {
      return { status: 'not_found', error: 'parcelId is empty' };
    }

    switch (normalizedState) {
      case 'GA': {
        logger.debug(`[municipal-enrichment] GA parcel-id lookup for "${parcelId}" — trying Fulton first`);
        const fultonResult = await lookupFultonGAByParcelId(parcelId.trim());
        if (fultonResult.status === 'ok') return fultonResult;
        // Fulton miss → try DeKalb
        logger.debug(`[municipal-enrichment] Fulton parcel-id miss (${fultonResult.status}), falling back to DeKalb for "${parcelId}"`);
        const dekalbResult = await lookupDeKalbGAByParcelId(parcelId.trim());
        if (dekalbResult.status === 'ok') return dekalbResult;
        // DeKalb miss → try Cobb
        logger.debug(`[municipal-enrichment] DeKalb parcel-id miss (${dekalbResult.status}), falling back to Cobb for "${parcelId}"`);
        return lookupCobbGAByParcelId(parcelId.trim());
      }

      case 'NC':
        if (!normalizedCity || normalizedCity.includes('charlotte') || normalizedCity.includes('mecklenburg')) {
          logger.debug(`[municipal-enrichment] NC/Mecklenburg parcel-id lookup for "${parcelId}"`);
          return lookupMecklenburgNCByParcelId(parcelId.trim());
        }
        logger.debug(`[municipal-enrichment] NC city "${city}" parcel-id not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'TN':
        if (!normalizedCity || normalizedCity.includes('nashville') || normalizedCity.includes('davidson')) {
          logger.debug(`[municipal-enrichment] TN/Davidson parcel-id lookup for "${parcelId}"`);
          return lookupDavidsonTNByParcelId(parcelId.trim());
        }
        logger.debug(`[municipal-enrichment] TN city "${city}" parcel-id not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'TX':
        if (normalizedCity.includes('dallas')) {
          logger.debug(`[municipal-enrichment] TX/Dallas parcel-id lookup for "${parcelId}"`);
          return lookupDallasTXByParcelId(parcelId.trim());
        }
        if (normalizedCity.includes('houston')) {
          logger.debug(`[municipal-enrichment] TX/Harris parcel-id lookup for "${parcelId}"`);
          return lookupHarrisTXByParcelId(parcelId.trim());
        }
        logger.debug(`[municipal-enrichment] TX city "${city}" parcel-id not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'FL':
        if (normalizedCity.includes('jacksonville')) {
          logger.debug(`[municipal-enrichment] FL/Duval parcel-id lookup for "${parcelId}"`);
          return lookupDuvalFLByParcelId(parcelId.trim());
        }
        logger.debug(`[municipal-enrichment] FL city "${city}" parcel-id not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      default:
        logger.debug(`[municipal-enrichment] state ${normalizedState} parcel-id lookup not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };
    }
  }
}

export const municipalEnrichment = new MunicipalEnrichmentService();
