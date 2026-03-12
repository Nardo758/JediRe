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

function isAggregator(url: string): boolean {
  const lower = url.toLowerCase();
  return AGGREGATOR_BLOCKLIST.some(domain => lower.includes(domain));
}

export interface DiscoveryResult {
  targetId: number;
  propertyName: string;
  websiteUrl: string | null;
  googleRating: number | null;
  reviewCount: number | null;
  phone: string | null;
  success: boolean;
  error?: string;
}

export class RentScraperDiscoveryService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  async discoverPropertyWebsite(target: {
    id: number;
    property_name: string;
    address?: string;
    city: string;
    state: string;
  }): Promise<DiscoveryResult> {
    if (!SERP_API_KEY) {
      throw new Error('SERP_API_KEY environment variable not set');
    }

    const result: DiscoveryResult = {
      targetId: target.id,
      propertyName: target.property_name,
      websiteUrl: null,
      googleRating: null,
      reviewCount: null,
      phone: null,
      success: false,
    };

    try {
      const query = `${target.property_name} ${target.address || ''} ${target.city} ${target.state}`.trim();

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

      await this.markSearchDone(target.id, websiteUrl, googleRating, reviewCount, phone);

      result.websiteUrl = websiteUrl;
      result.googleRating = googleRating;
      result.reviewCount = reviewCount;
      result.phone = phone;
      result.success = !!websiteUrl;

      logger.info(`[discovery] ${target.property_name}: ${websiteUrl || 'NO WEBSITE FOUND'} (rating: ${googleRating})`);
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
    phone: string | null
  ): Promise<void> {
    await this.pool.query(
      `UPDATE rent_scrape_targets SET
         places_search_done = TRUE,
         website_url = COALESCE($2, website_url),
         google_rating = COALESCE($3, google_rating),
         review_count = COALESCE($4, review_count),
         phone = COALESCE($5, phone),
         url_source = CASE WHEN $2 IS NOT NULL THEN 'serp' ELSE url_source END,
         updated_at = NOW()
       WHERE id = $1`,
      [targetId, websiteUrl, googleRating, reviewCount, phone]
    );
  }

  async discoverAllPendingUrls(options: { limit?: number } = {}): Promise<{
    discovered: number;
    failed: number;
    skipped: number;
    results: DiscoveryResult[];
  }> {
    const { limit = 20 } = options;

    const targets = await this.pool.query(
      `SELECT id, property_name, address, city, state
       FROM rent_scrape_targets
       WHERE places_search_done = FALSE AND website_url IS NULL AND active = TRUE
       ORDER BY id ASC
       LIMIT $1`,
      [limit]
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
}
