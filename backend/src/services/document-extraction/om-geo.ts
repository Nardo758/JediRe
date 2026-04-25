/**
 * om-geo — resolves a Broker OM's property address to canonical
 * MSA / submarket keys (Task #383).
 *
 * Composition only — reuses existing services:
 *   - geocodingService.geocode (Mapbox + Nominatim fallback) for address → lat/lng
 *   - PostGIS ST_Contains spatial lookup against `submarkets` and `msas`
 *   - canonicalMsaKey / canonicalSubmarketKey for the storage key shape
 *     used by the sentiment-history time-series and the new broker-narratives
 *     feed.
 *
 * No silent fallback: if geocoding or the spatial lookup find nothing we
 * return `{msaKey: null, submarketKey: null}` so callers can decide whether
 * the OM is unrouteable instead of inventing fake market tags.
 */

import { Pool } from 'pg';
import { geocodingService } from './geocoding.shim';
import {
  canonicalMsaKey,
  canonicalSubmarketKey,
  type MsaResolution,
  type SubmarketResolution,
} from '../../api/rest/_market-resolution';
import { logger } from '../../utils/logger';

export interface OmGeoTags {
  msaKey: string | null;
  submarketKey: string | null;
  msaName: string | null;
  submarketName: string | null;
  lat: number | null;
  lng: number | null;
}

interface AddressInput {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

function buildGeocodeQuery(addr: AddressInput): string {
  const parts: string[] = [];
  if (addr.address) parts.push(addr.address);
  if (addr.city) parts.push(addr.city);
  if (addr.state) parts.push(addr.state);
  if (addr.zip) parts.push(addr.zip);
  return parts.join(', ').trim();
}

export async function tagOmWithMarket(
  pool: Pool,
  addr: AddressInput,
): Promise<OmGeoTags> {
  const empty: OmGeoTags = {
    msaKey: null, submarketKey: null,
    msaName: null, submarketName: null,
    lat: null, lng: null,
  };

  const query = buildGeocodeQuery(addr);
  if (!query) {
    logger.debug('[om-geo] empty address — skipping geocode');
    return empty;
  }

  const geo = await geocodingService.geocode(query);
  if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') {
    logger.warn('[om-geo] geocode failed', { query });
    return empty;
  }

  // Submarket spatial lookup (also returns msa_id when matched).
  const subRow = await pool.query(
    `SELECT s.id, s.name, s.msa_id, m.name AS msa_name
       FROM submarkets s
       LEFT JOIN msas m ON m.id = s.msa_id
      WHERE ST_Contains(s.geometry, ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326))
      LIMIT 1`,
    [geo.lng, geo.lat],
  ).then(r => r.rows[0] || null).catch(err => {
    logger.warn('[om-geo] submarket spatial lookup failed', { error: err instanceof Error ? err.message : 'unknown' });
    return null;
  });

  let msaResolution: MsaResolution | null = null;
  let submarketResolution: SubmarketResolution | null = null;
  let msaName: string | null = null;
  let submarketName: string | null = null;

  if (subRow) {
    submarketName = subRow.name as string;
    submarketResolution = {
      source: 'submarket',
      id: Number(subRow.id),
      name: submarketName ?? '',
      municipality: null,
      state: null,
    };
    if (subRow.msa_id != null) {
      msaName = subRow.msa_name ? String(subRow.msa_name) : null;
      msaResolution = {
        id: Number(subRow.msa_id),
        name: msaName ?? '',
        primaryCity: '',
        stateCodes: [],
      };
    }
  }

  // If we got coords but no submarket polygon match, try MSA polygons directly.
  if (!msaResolution) {
    const msaRow = await pool.query(
      `SELECT id, name FROM msas
        WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326))
        LIMIT 1`,
      [geo.lng, geo.lat],
    ).then(r => r.rows[0] || null).catch(() => null);

    if (msaRow) {
      msaName = String(msaRow.name);
      msaResolution = {
        id: Number(msaRow.id),
        name: msaName ?? '',
        primaryCity: '',
        stateCodes: [],
      };
    }
  }

  // Build keys only when we actually resolved something — otherwise keep null
  // so consumers can flag the OM as unrouteable.
  const msaKey = msaResolution
    ? canonicalMsaKey(msaResolution, String(msaResolution.id))
    : null;
  const submarketKey = submarketResolution
    ? canonicalSubmarketKey(submarketResolution, String(submarketResolution.id))
    : null;

  return {
    msaKey,
    submarketKey,
    msaName,
    submarketName,
    lat: geo.lat,
    lng: geo.lng,
  };
}
