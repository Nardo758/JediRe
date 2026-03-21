import axios from 'axios';
import { Pool } from 'pg';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const SERP_API_KEY = process.env.SERP_API_KEY;
const SERP_BASE = 'https://serpapi.com/search.json';

const AGGREGATOR_BLOCKLIST = [
  'apartments.com', 'zillow.com', 'realtor.com', 'apartmentlist.com',
  'rent.com', 'rentcafe.com', 'hotpads.com', 'trulia.com', 'padmapper.com',
  'abodo.com', 'forrent.com', 'apartmentguide.com', 'costar.com',
  'loopnet.com', 'crexi.com', 'myapartmentmap.com', 'zumper.com',
  'furnishedfinder.com', 'doorsteps.com', 'redfin.com',
];

// Known REIT and major property-management company domains.
// A Google web search for a property name will surface these in organic results
// even when Google Maps has no website listed.
const REIT_DOMAINS = [
  'equityapartments.com',       // Equity Residential
  'maac.com',                   // Mid-America Apartment (MAA)
  'camdenliving.com',           // Camden Property Trust
  'cortland.com',               // Cortland
  'amli.com',                   // AMLI Residential
  'udr.com',                    // UDR Inc.
  'avaloncommunities.com',      // AvalonBay Communities
  'lincolnapts.com',            // Lincoln Property Company
  'gables.com',                 // Gables Residential
  'greystar.com',               // Greystar (PM)
  'bozzuto.com',                // Bozzuto
  'essexapartmenthomes.com',    // Essex Property Trust
  'aimco.com',                  // Aimco
  'highmarkresidential.com',    // Highmark Residential
  'pegasusresidential.com',     // Pegasus Residential
  'alliancerp.com',             // Alliance Residential (Broadstone)
  'broadstone.com',             // Broadstone
  'bell-residential.com',       // Bell Partners
  'bh-management.com',          // BH Management
  'trinitypropertygroup.com',   // Trinity Property Group
  'prospera-housing.com',       // Prospera Housing
  'greystarproperties.com',     // Greystar (alternate)
  'nuveen.com',                 // Nuveen Real Estate
  'postproperties.com',         // Post Properties
  'windsong-properties.com',    // Windsong Properties
  'lumiresidential.com',        // Lumi Residential
  'presidio-residential.com',   // Presidio Residential
  'nexapartments.com',          // Nex Apartments
  'ventasresidential.com',      // Ventas Residential
  'missionrockresidential.com', // Mission Rock Residential
  'irtliving.com',              // IRT Living (Independence Realty)
  'bellapartmentliving.com',    // Bella Apartment Living
  'liveatthepaxton.com',        // The Paxton
  'liveherehousing.com',        // Live Here Housing
  'liveatwoodlandheights.com',  // Woodland Heights
  'alexanapts.com',             // Alexan Apartments (Trammell Crow)
];

function isAggregator(url: string): boolean {
  const lower = url.toLowerCase();
  return AGGREGATOR_BLOCKLIST.some(domain => lower.includes(domain));
}

function matchesReitDomain(url: string): boolean {
  const lower = url.toLowerCase();
  return REIT_DOMAINS.some(domain => lower.includes(domain));
}

// A URL is a "direct property site" only if it matches a known REIT/PM domain.
// We deliberately avoid path-based heuristics because they cause false positives
// (e.g. bbb.org/profile/apartments/..., knockrentals.com/community/...).
function isDirectPropertyUrl(url: string): boolean {
  if (isAggregator(url)) return false;
  return matchesReitDomain(url);
}

export interface DiscoveryResult {
  targetId: number;
  propertyName: string;
  websiteUrl: string | null;
  googleRating: number | null;
  reviewCount: number | null;
  phone: string | null;
  success: boolean;
  nameDiscovered: boolean;
  error?: string;
}

export class RentScraperDiscoveryService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  private buildSearchQuery(target: {
    property_name: string | null;
    address?: string;
    city: string;
    state: string;
    source?: string;
    owner_name?: string;
  }): string {
    const nameIsAddress =
      !target.property_name ||
      target.source === 'property_records' ||
      (target.address && target.property_name.trim().toLowerCase() === target.address.trim().toLowerCase());

    if (nameIsAddress) {
      const parts: string[] = [];
      if (target.owner_name && target.owner_name.trim()) {
        parts.push(target.owner_name.trim());
      }
      parts.push(target.address || target.property_name || '');
      parts.push(target.city);
      parts.push(target.state);
      parts.push('apartment');
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    return `${target.property_name} ${target.address || ''} ${target.city} ${target.state}`
      .replace(/\s+/g, ' ')
      .trim();
  }

  async discoverPropertyWebsite(target: {
    id: number;
    property_name: string | null;
    address?: string;
    city: string;
    state: string;
    source?: string;
    owner_name?: string;
  }): Promise<DiscoveryResult> {
    if (!SERP_API_KEY) {
      throw new Error('SERP_API_KEY environment variable not set');
    }

    const result: DiscoveryResult = {
      targetId: target.id,
      propertyName: target.property_name || target.address || '',
      websiteUrl: null,
      googleRating: null,
      reviewCount: null,
      phone: null,
      success: false,
      nameDiscovered: false,
    };

    try {
      const query = this.buildSearchQuery(target);

      // Step 1: Search Google Maps to get place_id
      const searchResp = await axios.get(SERP_BASE, {
        params: {
          engine: 'google_maps',
          q: query,
          type: 'search',
          api_key: SERP_API_KEY,
        },
        timeout: 15000,
      });

      const placeResults = searchResp.data?.place_results;
      const localResults = searchResp.data?.local_results || [];

      const placeId =
        placeResults?.place_id ||
        (localResults.length > 0 ? localResults[0].place_id : null);

      if (!placeId) {
        logger.warn(`[discovery] No place_id found for ${target.property_name}`);
        await this.markSearchDone(target.id, null, null, null, null);
        return result;
      }

      // Step 2: Fetch full place details to get website URL
      const detailResp = await axios.get(SERP_BASE, {
        params: {
          engine: 'google_maps',
          type: 'place',
          place_id: placeId,
          api_key: SERP_API_KEY,
        },
        timeout: 15000,
      });

      const place = detailResp.data?.place_results;
      if (!place) {
        logger.warn(`[discovery] No place details for ${target.property_name} (place_id: ${placeId})`);
        await this.markSearchDone(target.id, null, null, null, null);
        return result;
      }

      let websiteUrl: string | null = place.website || null;

      // Strip UTM params but keep the base URL
      if (websiteUrl) {
        try {
          const u = new URL(websiteUrl);
          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
            'y_source', 'funnelleasing'].forEach(p => u.searchParams.delete(p));
          websiteUrl = u.toString();
        } catch {
          // Keep original if parse fails
        }
      }

      // Reject if aggregator
      if (websiteUrl && isAggregator(websiteUrl)) {
        logger.warn(`[discovery] Rejected aggregator URL for ${target.property_name}: ${websiteUrl}`);
        websiteUrl = null;
      }

      const googleRating = place.rating ? parseFloat(place.rating) : null;
      const reviewCount = place.reviews ? parseInt(place.reviews) : null;
      const phone = place.phone || null;

      const placeName: string | null = place.title || null;
      const discoveredName = (!target.property_name && placeName) ? placeName : null;

      await this.markSearchDone(target.id, websiteUrl, googleRating, reviewCount, phone, discoveredName);

      if (discoveredName) {
        result.propertyName = discoveredName;
        result.nameDiscovered = true;
      }
      result.websiteUrl = websiteUrl;
      result.googleRating = googleRating;
      result.reviewCount = reviewCount;
      result.phone = phone;
      result.success = !!websiteUrl;

      logger.info(`[discovery] ${discoveredName || target.property_name || target.address}: ${websiteUrl || 'NO WEBSITE FOUND'} (rating: ${googleRating})`);
    } catch (err: any) {
      result.error = err.message;
      logger.error(`[discovery] Error for ${target.property_name}: ${err.message}`);
      // Still mark as done so we don't retry immediately
      await this.markSearchDone(target.id, null, null, null, null);
    }

    return result;
  }

  private async markSearchDone(
    targetId: number,
    websiteUrl: string | null,
    googleRating: number | null,
    reviewCount: number | null,
    phone: string | null,
    discoveredName?: string | null
  ): Promise<void> {
    await this.pool.query(
      `UPDATE rent_scrape_targets SET
         places_search_done = TRUE,
         website_url = COALESCE($2, website_url),
         google_rating = COALESCE($3, google_rating),
         review_count = COALESCE($4, review_count),
         phone = COALESCE($5, phone),
         url_source = CASE WHEN $2 IS NOT NULL THEN 'serp' ELSE url_source END,
         property_name = CASE
           WHEN (property_name IS NULL OR TRIM(property_name) = '') AND $6::text IS NOT NULL THEN $6::text
           ELSE property_name
         END,
         metadata = COALESCE(metadata, '{}'::jsonb) ||
           CASE
             WHEN $6::text IS NOT NULL THEN '{"name_source":"google_maps"}'::jsonb
             WHEN $2 IS NULL AND $3 IS NULL THEN '{"needs_manual_review":true}'::jsonb
             ELSE '{}'::jsonb
           END,
         updated_at = NOW()
       WHERE id = $1`,
      [targetId, websiteUrl, googleRating, reviewCount, phone, discoveredName || null]
    );
  }

  async discoverById(targetId: number): Promise<DiscoveryResult> {
    const row = await this.pool.query(
      `SELECT rst.id, rst.property_name, rst.address, rst.city, rst.state, rst.source,
              pr.owner_name
       FROM rent_scrape_targets rst
       LEFT JOIN property_records pr ON pr.id = rst.property_record_id
       WHERE rst.id = $1`,
      [targetId]
    );
    if (row.rows.length === 0) throw new Error(`Target ${targetId} not found`);
    return this.discoverPropertyWebsite(row.rows[0]);
  }

  async discoverAllPendingUrls(options: {
    limit?: number;
    source?: string;
    market?: string;
  } = {}): Promise<{
    discovered: number;
    failed: number;
    skipped: number;
    results: DiscoveryResult[];
  }> {
    const { limit = 20, source, market } = options;

    const conditions = ['rst.places_search_done = FALSE', 'rst.website_url IS NULL', 'rst.active = TRUE'];
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (source) {
      conditions.push(`rst.source = $${paramIdx}`);
      queryParams.push(source);
      paramIdx++;
    }
    if (market) {
      conditions.push(`(rst.city ILIKE $${paramIdx} OR rst.market ILIKE $${paramIdx})`);
      queryParams.push(market);
      paramIdx++;
    }

    conditions.push(`1=1`);
    queryParams.push(limit);

    const targets = await this.pool.query(
      `SELECT rst.id, rst.property_name, rst.address, rst.city, rst.state,
              rst.source, pr.owner_name
       FROM rent_scrape_targets rst
       LEFT JOIN property_records pr ON pr.id = rst.property_record_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY rst.id ASC
       LIMIT $${paramIdx}`,
      queryParams
    );

    if (targets.rows.length === 0) {
      return { discovered: 0, failed: 0, skipped: 0, results: [] };
    }

    const results: DiscoveryResult[] = [];
    let discovered = 0;
    let failed = 0;

    for (const target of targets.rows) {
      const res = await this.discoverPropertyWebsite(target);
      results.push(res);
      if (res.websiteUrl) discovered++;
      else if (res.error) failed++;

      // 1-second delay to respect SerpAPI rate limit
      await new Promise(resolve => setTimeout(resolve, 1100));
    }

    return {
      discovered,
      failed,
      skipped: 0,
      results,
    };
  }

  async resetDiscovery(targetIds?: number[]): Promise<number> {
    let q: any;
    if (targetIds && targetIds.length > 0) {
      q = await this.pool.query(
        `UPDATE rent_scrape_targets SET places_search_done = FALSE, website_url = NULL WHERE id = ANY($1)`,
        [targetIds]
      );
    } else {
      q = await this.pool.query(
        `UPDATE rent_scrape_targets SET places_search_done = FALSE, website_url = NULL`
      );
    }
    return q.rowCount ?? 0;
  }

  // ── REIT / Web-search pass ────────────────────────────────────────────────
  // For targets that came back with no website from the Google Maps pass,
  // do a regular Google organic search and look for direct REIT property URLs
  // in the top results.

  async discoverViaWebSearch(target: {
    id: number;
    property_name: string | null;
    address: string | null;
    city: string;
    state: string;
  }): Promise<DiscoveryResult> {
    if (!SERP_API_KEY) throw new Error('SERP_API_KEY not set');

    const result: DiscoveryResult = {
      targetId: target.id,
      propertyName: target.property_name || target.address || '',
      websiteUrl: null,
      googleRating: null,
      reviewCount: null,
      phone: null,
      success: false,
      nameDiscovered: false,
    };

    const name = target.property_name || target.address || '';
    const query = `"${name}" ${target.city} ${target.state} apartments`;

    try {
      const resp = await axios.get(SERP_BASE, {
        params: {
          engine: 'google',
          q: query,
          num: 10,
          api_key: SERP_API_KEY,
        },
        timeout: 15000,
      });

      const organicResults: Array<{ link: string; title?: string }> =
        resp.data?.organic_results || [];

      let foundUrl: string | null = null;

      // Prefer REIT-domain hits first, then any non-aggregator direct site
      for (const r of organicResults) {
        if (!r.link) continue;
        if (matchesReitDomain(r.link)) {
          foundUrl = r.link;
          break;
        }
      }
      if (!foundUrl) {
        for (const r of organicResults) {
          if (!r.link) continue;
          if (isDirectPropertyUrl(r.link)) {
            foundUrl = r.link;
            break;
          }
        }
      }

      if (foundUrl) {
        // Strip UTM params
        try {
          const u = new URL(foundUrl);
          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
            .forEach(p => u.searchParams.delete(p));
          foundUrl = u.toString();
        } catch { /* keep original */ }

        await this.pool.query(
          `UPDATE rent_scrape_targets SET
             website_url = $2,
             url_source  = 'reit_web_search',
             metadata    = COALESCE(metadata, '{}'::jsonb) || '{"reit_search_done":true}'::jsonb,
             updated_at  = NOW()
           WHERE id = $1`,
          [target.id, foundUrl]
        );

        result.websiteUrl = foundUrl;
        result.success = true;
        logger.info(`[reit-search] ${name}: ${foundUrl}`);
      } else {
        await this.pool.query(
          `UPDATE rent_scrape_targets SET
             metadata   = COALESCE(metadata, '{}'::jsonb) || '{"reit_search_done":true}'::jsonb,
             updated_at = NOW()
           WHERE id = $1`,
          [target.id]
        );
        logger.info(`[reit-search] ${name}: no REIT URL found`);
      }
    } catch (err: any) {
      result.error = err.message;
      logger.error(`[reit-search] Error for ${name}: ${err.message}`);
    }

    return result;
  }

  async discoverNoWebsiteViaWebSearch(options: {
    market?: string;
    limit?: number;
    delayMs?: number;
  } = {}): Promise<{
    discovered: number;
    failed: number;
    total: number;
    results: DiscoveryResult[];
  }> {
    const { market, limit = 50, delayMs = 1200 } = options;

    const conditions = [
      `active = TRUE`,
      `(website_url IS NULL OR website_url = '')`,
      `(metadata->>'reit_search_done' IS NULL OR metadata->>'reit_search_done' != 'true')`,
    ];
    const params: any[] = [];
    let idx = 1;

    if (market) {
      conditions.push(`market ILIKE $${idx}`);
      params.push(market);
      idx++;
    }

    params.push(limit);

    const rows = await this.pool.query(
      `SELECT id, property_name, address, city, state
       FROM rent_scrape_targets
       WHERE ${conditions.join(' AND ')}
       ORDER BY id ASC
       LIMIT $${idx}`,
      params
    );

    const results: DiscoveryResult[] = [];
    let discovered = 0;
    let failed = 0;

    for (const target of rows.rows) {
      const res = await this.discoverViaWebSearch(target);
      results.push(res);
      if (res.websiteUrl) discovered++;
      else if (res.error) failed++;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return { discovered, failed, total: rows.rows.length, results };
  }
}
