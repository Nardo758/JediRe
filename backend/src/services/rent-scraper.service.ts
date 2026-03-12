import axios from 'axios';
import { Pool } from 'pg';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_BR_TOKEN = process.env.CLOUDFLARE_BR_TOKEN;
const CF_BR_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering`;

const FLOOR_PLAN_PATH_KEYWORDS = ['floor-plan', 'floorplan', 'floor_plan', 'availability', 'available-units', 'pricing', 'apartments-for-rent', 'rent-now'];
const EXCLUDE_EXTENSIONS = /\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|webp|pdf|zip|xml|json)(\?|$)/i;

const EXTRACTION_PROMPT = `Extract all apartment floor plans showing 12-month lease pricing. \
For each floor plan return: floor plan name, bedrooms (0 for studio), bathrooms, \
sqft min and max (use same value if only one given), \
12-month monthly rent min and max as plain numbers without $ or commas, \
number of available units (null if not shown), \
earliest available date as YYYY-MM-DD or the string "now" if available immediately. \
If multiple lease terms are shown, return ONLY the 12-month lease rent. \
If a floor plan has no available units, still include it with available_units as 0.`;

const EXTRACTION_SCHEMA = {
  name: 'floor_plans',
  schema: {
    type: 'object',
    properties: {
      floor_plans: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:             { type: 'string' },
            bedrooms:         { type: 'number' },
            bathrooms:        { type: 'number' },
            sqft_min:         { type: 'number' },
            sqft_max:         { type: 'number' },
            rent_min_12mo:    { type: 'number' },
            rent_max_12mo:    { type: 'number' },
            available_units:  { type: ['number', 'null'] },
            earliest_available: { type: 'string' },
          },
          required: ['name', 'bedrooms', 'bathrooms', 'rent_min_12mo'],
        },
      },
    },
    required: ['floor_plans'],
  },
};

export interface ScrapedUnit {
  unitType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  sqftMin: number | null;
  sqftMax: number | null;
  rentAmount: number | null;
  rentMax: number | null;
  availableUnits: number | null;
  availableDate: string | null;
  floorPlanName: string | null;
  specials: string | null;
}

export interface ScrapeResult {
  targetId: number;
  propertyName: string;
  jobId: number;
  units: ScrapedUnit[];
  floorPlanUrl: string | null;
  status: 'success' | 'error' | 'no_website';
  error?: string;
}

export class RentScraperService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  private cfHeaders() {
    return {
      Authorization: `Bearer ${CF_BR_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  private ensureCfCredentials() {
    if (!CF_ACCOUNT_ID || !CF_BR_TOKEN) {
      throw new Error('Cloudflare Browser Rendering credentials not configured');
    }
  }

  // ── Step 1: Find the floor plan page URL ────────────────────────────────────
  async findFloorPlanUrl(websiteUrl: string): Promise<string> {
    this.ensureCfCredentials();

    let base: URL;
    try {
      base = new URL(websiteUrl);
    } catch {
      return websiteUrl;
    }

    // First try common floor plan path suffixes on the known website URL
    // (avoids an extra root page fetch when the URL structure is predictable)
    const baseClean = websiteUrl.replace(/\/$/, '');
    const COMMON_PATHS = ['/floorplans', '/floor-plans', '/floorplan', '/floor-plans/all',
                          '/apartments/available', '/availability', '/apartments'];
    for (const p of COMMON_PATHS) {
      const candidate = baseClean + p;
      try {
        const headResp = await axios.post(`${CF_BR_BASE}/content`, {
          url: candidate,
          gotoOptions: { waitUntil: 'domcontentloaded', timeout: 10000 },
        }, { headers: this.cfHeaders(), timeout: 20000 });

        const html: string = typeof headResp.data === 'string'
          ? headResp.data
          : headResp.data?.result || '';

        // Check it returned a real page (not a 404 redirect back to root)
        const meta: any = headResp.data?.meta || {};
        if (meta.status === 200 && html.length > 20000) {
          logger.info(`[scraper] Floor plan path hit: ${candidate}`);
          return candidate;
        }
      } catch {
        // Path didn't work, try next
      }
    }

    // Fallback: scan root page HTML for nav links
    let html = '';
    try {
      const resp = await axios.post(`${CF_BR_BASE}/content`, {
        url: websiteUrl,
        gotoOptions: { waitUntil: 'domcontentloaded', timeout: 15000 },
      }, { headers: this.cfHeaders(), timeout: 25000 });

      if (typeof resp.data === 'string') html = resp.data;
      else if (resp.data?.result) html = resp.data.result;
    } catch (err: any) {
      logger.warn(`[scraper] Could not fetch root page ${websiteUrl}: ${err.message}`);
      return websiteUrl;
    }

    // Extract all href values and filter to same-domain, path-keyword matches only
    const hrefRegex = /href=["']([^"'#?][^"']*?)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefRegex.exec(html)) !== null) {
      const raw = match[1];
      if (EXCLUDE_EXTENSIONS.test(raw)) continue;

      let resolved: URL;
      try {
        resolved = new URL(raw, base);
      } catch {
        continue;
      }

      // Only same-domain links
      if (resolved.hostname !== base.hostname) continue;

      // Check path only (not hostname, not query string)
      const pathLower = resolved.pathname.toLowerCase();
      if (FLOOR_PLAN_PATH_KEYWORDS.some(kw => pathLower.includes(kw))) {
        logger.info(`[scraper] Found floor plan link: ${resolved.toString()}`);
        return resolved.toString();
      }
    }

    logger.info(`[scraper] No floor plan link found on ${websiteUrl}, using root`);
    return websiteUrl;
  }

  // ── Step 2: AI extraction of floor plan data ────────────────────────────────
  async extractFloorPlans(floorPlanUrl: string): Promise<ScrapedUnit[]> {
    this.ensureCfCredentials();

    const resp = await axios.post(`${CF_BR_BASE}/json`, {
      url: floorPlanUrl,
      prompt: EXTRACTION_PROMPT,
      response_format: {
        type: 'json_schema',
        json_schema: EXTRACTION_SCHEMA,
      },
      gotoOptions: { waitUntil: 'networkidle0', timeout: 20000 },
    }, { headers: this.cfHeaders(), timeout: 60000 });

    const raw = resp.data?.result;
    if (!raw || !raw.floor_plans) {
      throw new Error(`AI extraction returned no floor_plans. Response: ${JSON.stringify(resp.data).substring(0, 200)}`);
    }

    return raw.floor_plans.map((fp: any) => {
      const beds = typeof fp.bedrooms === 'number' ? fp.bedrooms : null;
      const sqftMin = fp.sqft_min ? Math.round(fp.sqft_min) : null;
      const sqftMax = fp.sqft_max ? Math.round(fp.sqft_max) : null;
      const sqftAvg = sqftMin !== null && sqftMax !== null
        ? Math.round((sqftMin + sqftMax) / 2)
        : (sqftMin ?? sqftMax);

      // Parse available_date
      let availableDate: string | null = null;
      if (fp.earliest_available) {
        const val = fp.earliest_available.trim().toLowerCase();
        if (val === 'now' || val === 'available now' || val === 'immediately') {
          availableDate = new Date().toISOString().split('T')[0];
        } else if (/\d{4}-\d{2}-\d{2}/.test(val)) {
          availableDate = val.match(/\d{4}-\d{2}-\d{2}/)![0];
        } else {
          // Try to parse MM/DD/YYYY
          const parts = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (parts) {
            availableDate = `${parts[3]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
          }
        }
      }

      let unitType: string;
      if (beds === 0) unitType = 'Studio';
      else if (beds === 1) unitType = '1BR';
      else if (beds === 2) unitType = '2BR';
      else if (beds === 3) unitType = '3BR';
      else unitType = beds !== null ? `${beds}BR` : 'Unknown';

      return {
        unitType,
        bedrooms: beds,
        bathrooms: typeof fp.bathrooms === 'number' ? fp.bathrooms : null,
        sqft: sqftAvg,
        sqftMin,
        sqftMax,
        rentAmount: fp.rent_min_12mo ?? null,
        rentMax: fp.rent_max_12mo ?? null,
        availableUnits: fp.available_units ?? null,
        availableDate,
        floorPlanName: fp.name || null,
        specials: null,
      } as ScrapedUnit;
    });
  }

  // ── Main scrape method ───────────────────────────────────────────────────────
  async scrapeProperty(targetId: number): Promise<ScrapeResult> {
    const targetResult = await this.pool.query(
      'SELECT * FROM rent_scrape_targets WHERE id = $1',
      [targetId]
    );

    if (targetResult.rows.length === 0) {
      throw new Error(`Scrape target not found: ${targetId}`);
    }

    const target = targetResult.rows[0];

    const websiteUrl: string | null = target.website_url || null;

    if (!websiteUrl) {
      logger.warn(`[scraper] No website_url for target ${targetId} (${target.property_name}) — run discover_property_urls first`);
      return {
        targetId,
        propertyName: target.property_name,
        jobId: 0,
        units: [],
        floorPlanUrl: null,
        status: 'no_website',
        error: 'No website_url — run discover_property_urls first',
      };
    }

    const jobResult = await this.pool.query(
      `INSERT INTO rent_scrape_jobs (target_id, status, started_at)
       VALUES ($1, 'running', NOW())
       RETURNING id`,
      [targetId]
    );
    const jobId = jobResult.rows[0].id;

    let floorPlanUrl: string | null = null;

    try {
      floorPlanUrl = await this.findFloorPlanUrl(websiteUrl);
      const units = await this.extractFloorPlans(floorPlanUrl);

      for (const unit of units) {
        await this.pool.query(
          `INSERT INTO scraped_rents
           (target_id, job_id, unit_type, bedrooms, bathrooms, sqft, sqft_min, sqft_max,
            rent_amount, rent_max, date_scraped, available_units, available_date,
            floor_plan_name, specials, platform_detected)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,$11,$12,$13,$14,'ai_extracted')`,
          [
            targetId, jobId,
            unit.unitType, unit.bedrooms, unit.bathrooms,
            unit.sqft, unit.sqftMin, unit.sqftMax,
            unit.rentAmount, unit.rentMax,
            unit.availableUnits,
            unit.availableDate,
            unit.floorPlanName, unit.specials,
          ]
        );
      }

      await this.pool.query(
        `UPDATE rent_scrape_jobs SET status = 'completed', completed_at = NOW(), records_scraped = $1 WHERE id = $2`,
        [units.length, jobId]
      );

      logger.info(`[scraper] ${target.property_name}: ${units.length} floor plans from ${floorPlanUrl}`);

      return { targetId, propertyName: target.property_name, jobId, units, floorPlanUrl, status: 'success' };

    } catch (err: any) {
      await this.pool.query(
        `UPDATE rent_scrape_jobs SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
        [err.message.substring(0, 2000), jobId]
      );
      logger.error(`[scraper] Failed ${target.property_name}: ${err.message}`);

      return {
        targetId, propertyName: target.property_name, jobId,
        units: [], floorPlanUrl, status: 'error', error: err.message,
      };
    }
  }

  async runScrapeJob(options: {
    market?: string;
    limit?: number;
    discoverFirst?: boolean;
    onlyWithWebsite?: boolean;
  } = {}): Promise<{ jobCount: number; results: ScrapeResult[] }> {
    const { market = 'Atlanta', limit = 10, onlyWithWebsite = true } = options;

    let query = `SELECT id FROM rent_scrape_targets WHERE active = TRUE AND market = $1`;
    if (onlyWithWebsite) query += ` AND website_url IS NOT NULL`;
    query += ` ORDER BY updated_at ASC LIMIT $2`;

    const targets = await this.pool.query(query, [market, limit]);
    const results: ScrapeResult[] = [];

    for (const target of targets.rows) {
      try {
        const result = await this.scrapeProperty(target.id);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (err: any) {
        logger.error(`[scraper] Error on target ${target.id}: ${err.message}`);
        results.push({
          targetId: target.id, propertyName: 'unknown', jobId: 0,
          units: [], floorPlanUrl: null, status: 'error', error: err.message,
        });
      }
    }

    return { jobCount: results.length, results };
  }

  async getRentChanges(options: {
    targetId?: number;
    market?: string;
    daysBack?: number;
    minChangePercent?: number;
  } = {}): Promise<any[]> {
    const { targetId, market = 'Atlanta', daysBack = 30, minChangePercent = 0 } = options;

    const marketClause = targetId ? `AND sr.target_id = $1` : `AND t.market = $1`;
    const marketValue = targetId || market;
    const safeDaysBack = Math.max(1, Math.min(365, Math.floor(Number(daysBack) || 30)));

    const query = `
      WITH current_rents AS (
        SELECT DISTINCT ON (sr.target_id, sr.unit_type)
          sr.target_id, t.property_name, t.submarket,
          sr.unit_type, sr.bedrooms, sr.sqft,
          sr.rent_amount AS current_rent, sr.date_scraped AS current_date
        FROM scraped_rents sr
        JOIN rent_scrape_targets t ON t.id = sr.target_id
        WHERE sr.rent_amount IS NOT NULL ${marketClause}
        ORDER BY sr.target_id, sr.unit_type, sr.date_scraped DESC
      ),
      prior_rents AS (
        SELECT DISTINCT ON (sr.target_id, sr.unit_type)
          sr.target_id, sr.unit_type,
          sr.rent_amount AS prior_rent, sr.date_scraped AS prior_date
        FROM scraped_rents sr
        JOIN rent_scrape_targets t ON t.id = sr.target_id
        WHERE sr.rent_amount IS NOT NULL
          AND sr.date_scraped < CURRENT_DATE - make_interval(days => $2)
          ${marketClause}
        ORDER BY sr.target_id, sr.unit_type, sr.date_scraped DESC
      )
      SELECT
        c.target_id, c.property_name, c.submarket,
        c.unit_type, c.bedrooms, c.sqft,
        c.current_rent, p.prior_rent,
        c.current_date, p.prior_date,
        ROUND(((c.current_rent - p.prior_rent) / NULLIF(p.prior_rent,0) * 100)::numeric, 2) AS change_pct,
        (c.current_rent - p.prior_rent) AS change_amount
      FROM current_rents c
      JOIN prior_rents p ON p.target_id = c.target_id AND p.unit_type = c.unit_type
      WHERE ABS((c.current_rent - p.prior_rent) / NULLIF(p.prior_rent,0) * 100) >= $3
      ORDER BY ABS((c.current_rent - p.prior_rent) / NULLIF(p.prior_rent,0) * 100) DESC
    `;

    const result = await this.pool.query(query, [marketValue, safeDaysBack, minChangePercent]);
    return result.rows;
  }

  async addScrapeTarget(target: {
    propertyName: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    url?: string;
    websiteUrl?: string;
    unitCount?: number;
    yearBuilt?: number;
    market?: string;
    submarket?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO rent_scrape_targets
       (property_name, address, city, state, zip, listing_url, website_url, unit_count, year_built, market, submarket, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        target.propertyName,
        target.address || null,
        target.city || 'Atlanta',
        target.state || 'GA',
        target.zip || null,
        target.url || null,
        target.websiteUrl || null,
        target.unitCount || null,
        target.yearBuilt || null,
        target.market || 'Atlanta',
        target.submarket || null,
        target.latitude || null,
        target.longitude || null,
      ]
    );
    return result.rows[0];
  }

  async listScrapeTargets(options: {
    market?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ targets: any[]; total: number }> {
    const { market, active = true, limit = 50, offset = 0 } = options;

    let query = `SELECT id, property_name, address, city, submarket, unit_count, year_built,
                        website_url, listing_url, places_search_done, google_rating,
                        review_count, phone, active, updated_at
                 FROM rent_scrape_targets WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (active !== undefined) { query += ` AND active = $${idx++}`; params.push(active); }
    if (market) { query += ` AND market = $${idx++}`; params.push(market); }

    const countParams: any[] = [];
    let countQuery = `SELECT COUNT(*) FROM rent_scrape_targets WHERE 1=1`;
    let cIdx = 1;
    if (active !== undefined) { countQuery += ` AND active = $${cIdx++}`; countParams.push(active); }
    if (market) { countQuery += ` AND market = $${cIdx++}`; countParams.push(market); }
    const countResult = await this.pool.query(countQuery, countParams);

    query += ` ORDER BY property_name ASC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    return { targets: result.rows, total: parseInt(countResult.rows[0].count) };
  }
}
