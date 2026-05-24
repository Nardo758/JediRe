/**
 * Henry County GA — NOT IMPLEMENTED
 *
 * FIPS: 13151
 * County seat: McDonough, GA
 * Principal cities: McDonough, Stockbridge, Hampton, Locust Grove
 *
 * Investigation results (2026-05-24):
 *
 * All known Henry County GIS server domains were tested and found unreachable
 * from the Replit hosting environment:
 *
 *   - https://gis.co.henry.ga.us/arcgis/rest/services    — unreachable (connection refused)
 *   - https://maps.hcgov.com/arcgis/rest/services         — unreachable (DNS/connection timeout)
 *   - https://gis.hcgov.com/server/rest/services          — unreachable (DNS/connection timeout)
 *   - https://henrygis.maps.arcgis.com                    — unreachable (not a valid ArcGIS org)
 *
 * ArcGIS Online search for "Henry County Georgia tax parcel assessor" returned:
 *   - "Parcels_AOC" (services.arcgis.com/v01gqwM5QqNysAAi) — confirmed to be Ohio
 *     watershed catchment data (CNTY field contains "Fulton" [Ohio]), not Georgia.
 *   - "Zoning" viewer (c-o-h.maps.arcgis.com) — a web viewer, not a queryable endpoint.
 *
 * Henry County's public GIS portal (henrycountyga.gov) links to an Esri portal at
 * hcgov.com, but the REST endpoint is not accessible from cloud/VPS IP ranges.
 * This is a common pattern for smaller Georgia counties that run on-premise ArcGIS
 * Server instances behind county firewalls that block non-residential IP ranges.
 *
 * Alternative approaches evaluated:
 *   - qPublic (https://qpublic.schneidercorp.com/Application.aspx?AppID=1049) —
 *     blocked by Cloudflare WAF/Managed Challenge (noted in replit.md Gotchas).
 *   - Georgia SAGIS statewide parcel layer — does not include Henry County in the
 *     publicly queryable feature service.
 *
 * Status: PENDING external endpoint access. If Henry County properties appear in the
 * intake pipeline, the job will flow through the full sequential GA chain and return
 * not_found, causing the job to enter blocked_needs_user state.
 *
 * Re-evaluation trigger: if henrycountyga.gov exposes a public ArcGIS REST endpoint
 * or makes their data available via ArcGIS Online/Hub, this adapter should be built
 * following the same pattern as the Clayton or Cherokee adapter.
 */

import type { MunicipalLookupResult } from '../types';
import { logger } from '../../../utils/logger';

/**
 * Henry County GA address lookup — not_implemented.
 *
 * No publicly accessible ArcGIS endpoint was found for Henry County GA from
 * cloud-hosted IP ranges. Returns not_implemented so the orchestrator can
 * handle the gap gracefully (log + block for user review).
 */
export async function lookupHenryGA(_address: string): Promise<MunicipalLookupResult> {
  logger.debug('[henry-ga] address lookup attempted — no public ArcGIS endpoint available');
  return {
    status:  'not_implemented',
    county:  'Henry',
    state:   'GA',
    source:  'arcgis_henry_ga',
    error:   'Henry County GA ArcGIS endpoint not publicly accessible from cloud IPs',
  };
}

/**
 * Henry County GA parcel-ID lookup — not_implemented.
 */
export async function lookupHenryGAByParcelId(_parcelId: string): Promise<MunicipalLookupResult> {
  logger.debug('[henry-ga] parcel-id lookup attempted — no public ArcGIS endpoint available');
  return {
    status:  'not_implemented',
    county:  'Henry',
    state:   'GA',
    source:  'arcgis_henry_ga',
    error:   'Henry County GA ArcGIS endpoint not publicly accessible from cloud IPs',
  };
}
