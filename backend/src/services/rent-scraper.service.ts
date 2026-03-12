import axios from 'axios';
import * as cheerio from 'cheerio';
import { Pool } from 'pg';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_BR_TOKEN = process.env.CLOUDFLARE_BR_TOKEN;
const CF_BR_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering`;

interface ScrapedUnit {
  unitType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  rentAmount: number | null;
  rentMax: number | null;
  availableUnits: number | null;
  floorPlanName: string | null;
  specials: string | null;
}

interface ScrapeResult {
  targetId: number;
  propertyName: string;
  jobId: number;
  units: ScrapedUnit[];
  status: 'success' | 'error';
  error?: string;
}

export class RentScraperService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  private async fetchRenderedHtml(url: string): Promise<string> {
    if (!CF_ACCOUNT_ID || !CF_BR_TOKEN) {
      throw new Error('Cloudflare Browser Rendering credentials not configured (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_BR_TOKEN)');
    }

    const response = await axios.post(`${CF_BR_BASE}/content`, {
      url,
      gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
    }, {
      headers: {
        Authorization: `Bearer ${CF_BR_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 45000,
    });

    if (typeof response.data === 'string') return response.data;
    if (response.data?.result) return response.data.result;
    if (response.data?.html) return response.data.html;
    throw new Error(`Unexpected Cloudflare BR response shape`);
  }

  private parseNumber(text: string | undefined | null): number | null {
    if (!text) return null;
    const n = parseFloat(text.replace(/[$,\s]/g, ''));
    return isNaN(n) ? null : n;
  }

  private parseBedrooms(text: string): number | null {
    const lower = text.toLowerCase().trim();
    if (lower.includes('studio') || lower === '0') return 0;
    const m = lower.match(/(\d+)\s*(?:bed|br|bedroom)/i);
    if (m) return parseInt(m[1]);
    const n = parseInt(lower);
    return isNaN(n) ? null : n;
  }

  private parseBathrooms(text: string): number | null {
    const m = text.match(/([\d.]+)\s*(?:bath|ba)/i);
    if (m) return parseFloat(m[1]);
    return null;
  }

  private extractUnitsFromHtml(html: string): ScrapedUnit[] {
    const $ = cheerio.load(html);
    const units: ScrapedUnit[] = [];

    $('script, style, nav, header, footer').remove();

    const pricingRows = $('[class*="pricing"], [class*="floor-plan"], [class*="floorplan"], [class*="unit-type"], [data-tab-content], .pricingGridItem, .rentRollupItem');

    if (pricingRows.length > 0) {
      pricingRows.each((_, el) => {
        const $el = $(el);
        const text = $el.text();

        const rentMatch = text.match(/\$[\d,]+/g);
        const sqftMatch = text.match(/([\d,]+)\s*(?:sq\.?\s*ft|SF)/i);
        const bedMatch = text.match(/(?:studio|(\d+)\s*(?:bed|br|bedroom))/i);
        const bathMatch = text.match(/([\d.]+)\s*(?:bath|ba)/i);
        const availMatch = text.match(/(\d+)\s*(?:avail|unit)/i);

        if (rentMatch && rentMatch.length > 0) {
          const rents = rentMatch.map(r => this.parseNumber(r)).filter(Boolean) as number[];
          units.push({
            unitType: bedMatch ? (bedMatch[0].toLowerCase().includes('studio') ? 'Studio' : `${bedMatch[1]}BR`) : null,
            bedrooms: bedMatch ? this.parseBedrooms(bedMatch[0]) : null,
            bathrooms: bathMatch ? parseFloat(bathMatch[1]) : null,
            sqft: sqftMatch ? this.parseNumber(sqftMatch[1]) : null,
            rentAmount: Math.min(...rents),
            rentMax: rents.length > 1 ? Math.max(...rents) : null,
            availableUnits: availMatch ? parseInt(availMatch[1]) : null,
            floorPlanName: $el.find('[class*="name"], [class*="title"], h3, h4').first().text().trim() || null,
            specials: null,
          });
        }
      });
    }

    if (units.length === 0) {
      const tables = $('table');
      tables.each((_, table) => {
        const $table = $(table);
        const headerText = $table.find('th, thead td').text().toLowerCase();
        if (headerText.includes('rent') || headerText.includes('price') || headerText.includes('bed')) {
          $table.find('tbody tr, tr').each((rowIdx, row) => {
            if (rowIdx === 0 && $(row).find('th').length > 0) return;
            const cells = $(row).find('td');
            if (cells.length < 2) return;
            const rowText = $(row).text();
            const rentMatch = rowText.match(/\$[\d,]+/g);
            if (!rentMatch) return;
            const rents = rentMatch.map(r => this.parseNumber(r)).filter(Boolean) as number[];
            const bedMatch = rowText.match(/(?:studio|(\d+)\s*(?:bed|br))/i);
            const sqftMatch = rowText.match(/([\d,]+)\s*(?:sq\.?\s*ft|SF)/i);
            units.push({
              unitType: bedMatch ? (bedMatch[0].toLowerCase().includes('studio') ? 'Studio' : `${bedMatch[1]}BR`) : null,
              bedrooms: bedMatch ? this.parseBedrooms(bedMatch[0]) : null,
              bathrooms: null,
              sqft: sqftMatch ? this.parseNumber(sqftMatch[1]) : null,
              rentAmount: Math.min(...rents),
              rentMax: rents.length > 1 ? Math.max(...rents) : null,
              availableUnits: null,
              floorPlanName: null,
              specials: null,
            });
          });
        }
      });
    }

    const specials = $('[class*="special"], [class*="promo"], [class*="offer"]').first().text().trim();
    if (specials && units.length > 0) {
      units[0].specials = specials.substring(0, 500);
    }

    return units;
  }

  async scrapeProperty(targetId: number): Promise<ScrapeResult> {
    const targetResult = await this.pool.query(
      'SELECT * FROM rent_scrape_targets WHERE id = $1',
      [targetId]
    );

    if (targetResult.rows.length === 0) {
      throw new Error(`Scrape target not found: ${targetId}`);
    }

    const target = targetResult.rows[0];

    if (!target.url) {
      throw new Error(`No URL configured for target ${targetId} (${target.property_name})`);
    }

    const jobResult = await this.pool.query(
      `INSERT INTO rent_scrape_jobs (target_id, status, started_at)
       VALUES ($1, 'running', NOW())
       RETURNING id`,
      [targetId]
    );
    const jobId = jobResult.rows[0].id;

    try {
      const html = await this.fetchRenderedHtml(target.url);
      const units = this.extractUnitsFromHtml(html);

      for (const unit of units) {
        await this.pool.query(
          `INSERT INTO scraped_rents
           (target_id, job_id, unit_type, bedrooms, bathrooms, sqft, rent_amount, rent_max, date_scraped, available_units, floor_plan_name, specials)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9, $10, $11)`,
          [targetId, jobId, unit.unitType, unit.bedrooms, unit.bathrooms, unit.sqft,
           unit.rentAmount, unit.rentMax, unit.availableUnits, unit.floorPlanName, unit.specials]
        );
      }

      await this.pool.query(
        `UPDATE rent_scrape_jobs SET status = 'completed', completed_at = NOW(), records_scraped = $1 WHERE id = $2`,
        [units.length, jobId]
      );

      logger.info(`[rent-scraper] Scraped ${units.length} unit types from ${target.property_name}`);

      return {
        targetId,
        propertyName: target.property_name,
        jobId,
        units,
        status: 'success',
      };
    } catch (err: any) {
      await this.pool.query(
        `UPDATE rent_scrape_jobs SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
        [err.message.substring(0, 2000), jobId]
      );

      logger.error(`[rent-scraper] Failed to scrape ${target.property_name}: ${err.message}`);

      return {
        targetId,
        propertyName: target.property_name,
        jobId,
        units: [],
        status: 'error',
        error: err.message,
      };
    }
  }

  async runScrapeJob(options: { market?: string; limit?: number } = {}): Promise<{
    jobCount: number;
    results: ScrapeResult[];
  }> {
    const { market = 'Atlanta', limit = 50 } = options;

    const targets = await this.pool.query(
      `SELECT id FROM rent_scrape_targets WHERE active = TRUE AND market = $1 ORDER BY updated_at ASC LIMIT $2`,
      [market, limit]
    );

    const results: ScrapeResult[] = [];

    for (const target of targets.rows) {
      try {
        const result = await this.scrapeProperty(target.id);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        logger.error(`[rent-scraper] Error scraping target ${target.id}: ${err.message}`);
        results.push({
          targetId: target.id,
          propertyName: 'unknown',
          jobId: 0,
          units: [],
          status: 'error',
          error: err.message,
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

    let query = `
      WITH current_rents AS (
        SELECT DISTINCT ON (sr.target_id, sr.unit_type)
          sr.target_id,
          t.property_name,
          t.city,
          sr.unit_type,
          sr.bedrooms,
          sr.sqft,
          sr.rent_amount AS current_rent,
          sr.date_scraped AS current_date
        FROM scraped_rents sr
        JOIN rent_scrape_targets t ON t.id = sr.target_id
        WHERE sr.rent_amount IS NOT NULL
    `;

    const params: any[] = [];
    let paramIdx = 1;

    if (targetId) {
      query += ` AND sr.target_id = $${paramIdx++}`;
      params.push(targetId);
    } else {
      query += ` AND t.market = $${paramIdx++}`;
      params.push(market);
    }

    query += `
        ORDER BY sr.target_id, sr.unit_type, sr.date_scraped DESC
      ),
      prior_rents AS (
        SELECT DISTINCT ON (sr.target_id, sr.unit_type)
          sr.target_id,
          sr.unit_type,
          sr.rent_amount AS prior_rent,
          sr.date_scraped AS prior_date
        FROM scraped_rents sr
        JOIN rent_scrape_targets t ON t.id = sr.target_id
        WHERE sr.rent_amount IS NOT NULL
          AND sr.date_scraped < CURRENT_DATE - INTERVAL '${daysBack} days'
    `;

    if (targetId) {
      query += ` AND sr.target_id = $${paramIdx++}`;
      params.push(targetId);
    } else {
      query += ` AND t.market = $${paramIdx++}`;
      params.push(market);
    }

    query += `
        ORDER BY sr.target_id, sr.unit_type, sr.date_scraped DESC
      )
      SELECT
        c.target_id,
        c.property_name,
        c.city,
        c.unit_type,
        c.bedrooms,
        c.sqft,
        c.current_rent,
        p.prior_rent,
        c.current_date,
        p.prior_date,
        ROUND(((c.current_rent - p.prior_rent) / NULLIF(p.prior_rent, 0) * 100)::numeric, 2) AS change_pct,
        (c.current_rent - p.prior_rent) AS change_amount
      FROM current_rents c
      JOIN prior_rents p ON p.target_id = c.target_id AND p.unit_type = c.unit_type
      WHERE ABS((c.current_rent - p.prior_rent) / NULLIF(p.prior_rent, 0) * 100) >= $${paramIdx}
      ORDER BY ABS((c.current_rent - p.prior_rent) / NULLIF(p.prior_rent, 0) * 100) DESC
    `;
    params.push(minChangePercent);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async addScrapeTarget(target: {
    propertyName: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    url?: string;
    unitCount?: number;
    yearBuilt?: number;
    market?: string;
    submarket?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO rent_scrape_targets
       (property_name, address, city, state, zip, url, unit_count, year_built, market, submarket, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        target.propertyName,
        target.address || null,
        target.city || 'Atlanta',
        target.state || 'GA',
        target.zip || null,
        target.url || null,
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

    let query = 'SELECT * FROM rent_scrape_targets WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (active !== undefined) {
      query += ` AND active = $${paramIdx++}`;
      params.push(active);
    }

    if (market) {
      query += ` AND market = $${paramIdx++}`;
      params.push(market);
    }

    const countResult = await this.pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params
    );

    query += ` ORDER BY property_name ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    return {
      targets: result.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }
}
