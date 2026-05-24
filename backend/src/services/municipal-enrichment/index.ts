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
 *   GA → Census Geocoder preprocessing (county FIPS → direct adapter route)
 *       → Fulton County ArcGIS adapter      (FIPS 13121 / Atlanta/Fulton)
 *       → DeKalb County ArcGIS adapter     (FIPS 13089 / fallback for non-Fulton GA)
 *       → Cobb County ArcGIS adapter       (FIPS 13067 / Cumberland/Vinings/Smyrna)
 *       → Gwinnett County ArcGIS adapter   (FIPS 13135 / Duluth/Lawrenceville/Norcross)
 *       → Cherokee County ArcGIS adapter   (FIPS 13057 / Canton/Woodstock)
 *       → Clayton County ArcGIS adapter    (FIPS 13063 / Jonesboro/Forest Park)
 *       [Henry County FIPS 13151: no publicly accessible ArcGIS endpoint found]
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
import { stripUnitSuffix } from './address-normalize';
import { lookupFultonGA, lookupFultonGAByParcelId }           from './adapters/fulton-ga.adapter';
import { lookupDeKalbGA, lookupDeKalbGAByParcelId }           from './adapters/dekalb-ga.adapter';
import { lookupCobbGA, lookupCobbGAByParcelId }               from './adapters/cobb-ga.adapter';
import { lookupGwinnettGA, lookupGwinnettGAByParcelId }       from './adapters/gwinnett-ga.adapter';
import { lookupCherokeeGA, lookupCherokeeGAByParcelId }       from './adapters/cherokee-ga.adapter';
import { lookupClaytonGA, lookupClaytonGAByParcelId }         from './adapters/clayton-ga.adapter';
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
   * @param options  Optional geocoder hints:
   *   countyFips        — 5-digit FIPS (e.g. "13121") → skip directly to the right adapter
   *   normalizedAddress — Census-normalized street+number to use instead of raw input
   *   lat / lng         — WGS84 coordinates from Census Geocoder; forwarded to adapters
   *                       that can use them directly (e.g. Cobb, which has a weaker local
   *                       geocoder that misses some addresses Census can resolve)
   */
  async lookup(
    address: string,
    state: string,
    city?: string | null,
    options?: { countyFips?: string; normalizedAddress?: string; lat?: number; lng?: number },
  ): Promise<MunicipalLookupResult> {
    const normalizedState = (state ?? '').trim().toUpperCase();
    const normalizedCity  = normalizeCity(city);

    if (!address || !address.trim()) {
      return { status: 'not_found', error: 'address is empty' };
    }

    // Strip unit/apartment/suite qualifiers (e.g. "Apt 4", "Suite 200", "#501")
    // before any adapter sees the address.  County GIS layers store parcel-level
    // addresses without unit designators; these suffixes would cause LIKE misses.
    const baseAddress = stripUnitSuffix(address.trim());

    switch (normalizedState) {
      case 'GA': {
        // Use Census-normalized street address if available, otherwise raw input.
        // Also strip unit suffix from the Census-normalized form in case Census
        // preserves the unit designator.
        const rawLookup    = options?.normalizedAddress ?? baseAddress;
        const lookupAddr   = stripUnitSuffix(rawLookup.trim());

        // ── FIPS-direct route ────────────────────────────────────────────────
        // When the Census Geocoder has already resolved the county, skip straight
        // to the right adapter. On a not_found we still fall through to the full
        // sequential chain (with the normalized address) so nothing is lost.
        if (options?.countyFips) {
          const fips = options.countyFips;
          logger.debug(
            `[municipal-enrichment] GA FIPS-direct route: FIPS=${fips}, addr="${lookupAddr}"`,
          );
          let fipsResult: MunicipalLookupResult | null = null;
          // Build WGS84 coords object for adapters that can use Census lat/lng directly.
          const knownCoords =
            options?.lat != null && options?.lng != null
              ? { lat: options.lat, lng: options.lng }
              : undefined;

          switch (fips) {
            case '13121': fipsResult = await lookupFultonGA(lookupAddr);                    break;
            case '13089': fipsResult = await lookupDeKalbGA(lookupAddr, knownCoords);         break;
            case '13067': fipsResult = await lookupCobbGA(lookupAddr, knownCoords);         break;
            case '13135': fipsResult = await lookupGwinnettGA(lookupAddr, knownCoords);     break;
            case '13057': fipsResult = await lookupCherokeeGA(lookupAddr);                  break;
            case '13063': fipsResult = await lookupClaytonGA(lookupAddr);                   break;
            default:
              logger.debug(
                `[municipal-enrichment] GA unknown FIPS ${fips} — falling back to sequential chain`,
              );
          }
          if (fipsResult !== null) {
            if (fipsResult.status === 'ok') return fipsResult;
            // Adapter returned not_found / error → fall through to sequential chain
            logger.debug(
              `[municipal-enrichment] GA FIPS-${fips} adapter returned ${fipsResult.status} ` +
              `for "${lookupAddr}" — falling back to sequential chain`,
            );
          }
        }

        // ── Sequential fallback chain ────────────────────────────────────────
        // Try all GA county adapters in order. Uses the normalized address
        // (from Census) if available, which improves match rates.
        logger.debug(
          `[municipal-enrichment] GA sequential lookup for "${lookupAddr}" — trying Fulton first`,
        );
        const fultonResult = await lookupFultonGA(lookupAddr);
        if (fultonResult.status === 'ok') return fultonResult;
        logger.debug(
          `[municipal-enrichment] Fulton miss (${fultonResult.status}), falling back to DeKalb for "${lookupAddr}"`,
        );
        const dekalbResult = await lookupDeKalbGA(lookupAddr);
        if (dekalbResult.status === 'ok') return dekalbResult;
        logger.debug(
          `[municipal-enrichment] DeKalb miss (${dekalbResult.status}), falling back to Cobb for "${lookupAddr}"`,
        );
        const cobbResult = await lookupCobbGA(lookupAddr);
        if (cobbResult.status === 'ok') return cobbResult;
        logger.debug(
          `[municipal-enrichment] Cobb miss (${cobbResult.status}), falling back to Gwinnett for "${lookupAddr}"`,
        );
        const gwinnettResult = await lookupGwinnettGA(lookupAddr);
        if (gwinnettResult.status === 'ok') return gwinnettResult;
        logger.debug(
          `[municipal-enrichment] Gwinnett miss (${gwinnettResult.status}), falling back to Cherokee for "${lookupAddr}"`,
        );
        const cherokeeResult = await lookupCherokeeGA(lookupAddr);
        if (cherokeeResult.status === 'ok') return cherokeeResult;
        logger.debug(
          `[municipal-enrichment] Cherokee miss (${cherokeeResult.status}), falling back to Clayton for "${lookupAddr}"`,
        );
        return lookupClaytonGA(lookupAddr);
      }

      case 'NC':
        if (!normalizedCity || normalizedCity.includes('charlotte') || normalizedCity.includes('mecklenburg')) {
          logger.debug(`[municipal-enrichment] NC/Mecklenburg address lookup for "${baseAddress}"`);
          return lookupMecklenburgNC(baseAddress);
        }
        logger.debug(`[municipal-enrichment] NC city "${city}" not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'TN':
        if (!normalizedCity || normalizedCity.includes('nashville') || normalizedCity.includes('davidson')) {
          logger.debug(`[municipal-enrichment] TN/Davidson address lookup for "${baseAddress}"`);
          return lookupDavidsonTN(baseAddress);
        }
        logger.debug(`[municipal-enrichment] TN city "${city}" not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'TX':
        if (normalizedCity.includes('dallas')) {
          logger.debug(`[municipal-enrichment] TX/Dallas address lookup for "${baseAddress}"`);
          return lookupDallasTX(baseAddress);
        }
        if (normalizedCity.includes('houston')) {
          logger.debug(`[municipal-enrichment] TX/Harris address lookup for "${baseAddress}"`);
          return lookupHarrisTX(baseAddress);
        }
        logger.debug(`[municipal-enrichment] TX city "${city}" not implemented`);
        return { status: 'not_implemented', state: normalizedState, source: 'stub' };

      case 'FL':
        if (normalizedCity.includes('jacksonville')) {
          logger.debug(`[municipal-enrichment] FL/Duval address lookup for "${baseAddress}"`);
          return lookupDuvalFL(baseAddress);
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
        const cobbResult = await lookupCobbGAByParcelId(parcelId.trim());
        if (cobbResult.status === 'ok') return cobbResult;
        // Cobb miss → try Gwinnett
        logger.debug(`[municipal-enrichment] Cobb parcel-id miss (${cobbResult.status}), falling back to Gwinnett for "${parcelId}"`);
        const gwinnettResult = await lookupGwinnettGAByParcelId(parcelId.trim());
        if (gwinnettResult.status === 'ok') return gwinnettResult;
        // Gwinnett miss → try Cherokee (Canton/Woodstock/Ball Ground area)
        logger.debug(`[municipal-enrichment] Gwinnett parcel-id miss (${gwinnettResult.status}), falling back to Cherokee for "${parcelId}"`);
        const cherokeeResult = await lookupCherokeeGAByParcelId(parcelId.trim());
        if (cherokeeResult.status === 'ok') return cherokeeResult;
        // Cherokee miss → try Clayton (Jonesboro/Forest Park/Morrow/Riverdale area)
        logger.debug(`[municipal-enrichment] Cherokee parcel-id miss (${cherokeeResult.status}), falling back to Clayton for "${parcelId}"`);
        return lookupClaytonGAByParcelId(parcelId.trim());
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
