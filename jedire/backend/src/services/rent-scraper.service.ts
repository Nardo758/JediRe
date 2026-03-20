import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

interface ScrapedUnit {
  type: string;
  rent: number;
  sqft?: number;
  beds?: number;
  baths?: number;
}

interface ScrapeResult {
  units: ScrapedUnit[];
  avgRent: number | null;
  minRent: number | null;
  maxRent: number | null;
  error?: string;
}

interface RentChange {
  targetId: string;
  name: string;
  address: string;
  market: string;
  previousAvg: number | null;
  currentAvg: number | null;
  changePercent: number | null;
  previousDate: string | null;
  currentDate: string | null;
}

interface ScrapeTarget {
  id: string;
  name: string;
  address: string;
  market: string;
  website_url: string;
  active: boolean;
  created_at: string;
}

interface ScrapeJobResult {
  total: number;
  success: number;
  failed: number;
  results: ScrapeTargetResult[];
}

interface ScrapeTargetResult {
  name: string;
  units?: ScrapedUnit[];
  avgRent?: number | null;
  minRent?: number | null;
  maxRent?: number | null;
  error?: string;
}

interface CloudflareBRResponse {
  result?: {
    content?: string;
    html?: string;
  } | string;
  html?: string;
  success?: boolean;
  errors?: Array<{ code: number; message: string }>;
}

interface MarketRow {
  market: string;
}

class RentScraperService {
  private accountId: string;
  private brToken: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.brToken = process.env.CLOUDFLARE_BR_TOKEN || '';
  }

  private ensureCredentials(): void {
    if (!this.accountId) {
      this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    }
    if (!this.brToken) {
      this.brToken = process.env.CLOUDFLARE_BR_TOKEN || '';
    }
    if (!this.accountId || !this.brToken) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_BR_TOKEN must be set');
    }
  }

  async fetchRenderedHtml(url: string): Promise<string> {
    this.ensureCredentials();

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/browser-rendering/content`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.brToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        renderOptions: {
          waitUntil: 'networkidle0',
          timeout: 30000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare BR API error (${response.status}): ${errorText}`);
    }

    const data: CloudflareBRResponse = await response.json() as CloudflareBRResponse;

    if (typeof data.result === 'object' && data.result !== null) {
      const content = data.result.content || data.result.html;
      if (content) return content;
    }
    if (typeof data.result === 'string' && data.result.length > 0) {
      return data.result;
    }
    if (data.html) {
      return data.html;
    }

    throw new Error('Cloudflare BR API returned unexpected response shape — no HTML content found');
  }

  parseRentData(html: string): ScrapedUnit[] {
    const units: ScrapedUnit[] = [];

    const pricePatterns = [
      /\$[\s]*([\d,]+)\s*(?:\/\s*mo|per\s*month|\/month)/gi,
      /(?:rent|price|starting\s*(?:at|from))[\s:]*\$\s*([\d,]+)/gi,
      /\$([\d,]+)\s*-\s*\$([\d,]+)/gi,
    ];

    const unitTypePattern = /(?:studio|(\d)\s*(?:bed(?:room)?|br|bd))\s*[\/|,\s]*(?:(\d(?:\.\d)?)\s*(?:bath(?:room)?|ba))?\s*[^$]*?\$\s*([\d,]+)/gi;

    let match;

    while ((match = unitTypePattern.exec(html)) !== null) {
      const beds = match[1] ? parseInt(match[1]) : 0;
      const baths = match[2] ? parseFloat(match[2]) : undefined;
      const rent = parseInt(match[3].replace(/,/g, ''));

      if (rent >= 300 && rent <= 20000) {
        const type = beds === 0 ? 'Studio' : `${beds} Bed`;
        units.push({ type, rent, beds, baths });
      }
    }

    if (units.length === 0) {
      for (const pattern of pricePatterns) {
        pattern.lastIndex = 0;
        while ((match = pattern.exec(html)) !== null) {
          if (match[2]) {
            const minRent = parseInt(match[1].replace(/,/g, ''));
            const maxRent = parseInt(match[2].replace(/,/g, ''));
            if (minRent >= 300 && minRent <= 20000) {
              units.push({ type: 'Unknown', rent: minRent });
            }
            if (maxRent >= 300 && maxRent <= 20000 && maxRent !== minRent) {
              units.push({ type: 'Unknown', rent: maxRent });
            }
          } else {
            const rent = parseInt(match[1].replace(/,/g, ''));
            if (rent >= 300 && rent <= 20000) {
              units.push({ type: 'Unknown', rent });
            }
          }
        }
      }
    }

    return units;
  }

  private validateUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('URL must use http or https protocol');
    }
  }

  private static readonly MAX_RAW_HTML_LENGTH = 500_000;

  async scrapeUrl(url: string): Promise<ScrapeResult> {
    try {
      this.validateUrl(url);
      const html = await this.fetchRenderedHtml(url);
      const units = this.parseRentData(html);

      const rents = units.map(u => u.rent).filter(r => r > 0);
      const avgRent = rents.length > 0 ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null;
      const minRent = rents.length > 0 ? Math.min(...rents) : null;
      const maxRent = rents.length > 0 ? Math.max(...rents) : null;

      return { units, avgRent, minRent, maxRent };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to scrape ${url}: ${message}`);
      return { units: [], avgRent: null, minRent: null, maxRent: null, error: message };
    }
  }

  async scrapeAndPersist(targetId: string, url: string): Promise<ScrapeResult> {
    let rawHtml: string | null = null;
    let result: ScrapeResult;

    try {
      this.validateUrl(url);
      rawHtml = await this.fetchRenderedHtml(url);
      const units = this.parseRentData(rawHtml);

      const rents = units.map(u => u.rent).filter(r => r > 0);
      const avgRent = rents.length > 0 ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null;
      const minRent = rents.length > 0 ? Math.min(...rents) : null;
      const maxRent = rents.length > 0 ? Math.max(...rents) : null;

      result = { units, avgRent, minRent, maxRent };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to scrape ${url}: ${message}`);
      result = { units: [], avgRent: null, minRent: null, maxRent: null, error: message };
    }

    const truncatedHtml = rawHtml && rawHtml.length > RentScraperService.MAX_RAW_HTML_LENGTH
      ? rawHtml.slice(0, RentScraperService.MAX_RAW_HTML_LENGTH)
      : rawHtml;

    const pool = getPool();
    await pool.query(
      `INSERT INTO rent_scrape_results (target_id, raw_html, parsed_units, avg_rent, min_rent, max_rent, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [targetId, truncatedHtml, JSON.stringify(result.units), result.avgRent, result.minRent, result.maxRent, result.error || null]
    );

    return result;
  }

  async scrapeAndPersistUrl(url: string): Promise<ScrapeResult> {
    const pool = getPool();

    const { rows: existing } = await pool.query<ScrapeTarget>(
      `SELECT id FROM rent_scrape_targets WHERE website_url = $1 LIMIT 1`,
      [url]
    );

    let targetId: string;
    if (existing.length > 0) {
      targetId = existing[0].id;
    } else {
      const hostname = new URL(url).hostname.replace('www.', '');
      const { rows: inserted } = await pool.query<ScrapeTarget>(
        `INSERT INTO rent_scrape_targets (name, address, website_url, market, active)
         VALUES ($1, $2, $3, 'Unknown', FALSE) RETURNING id`,
        [`Ad-hoc: ${hostname}`, 'Ad-hoc scrape', url]
      );
      targetId = inserted[0].id;
    }

    return this.scrapeAndPersist(targetId, url);
  }

  async runScrapeJob(market: string): Promise<ScrapeJobResult> {
    const pool = getPool();
    const { rows: targets } = await pool.query<Pick<ScrapeTarget, 'id' | 'name' | 'website_url'>>(
      `SELECT id, name, website_url FROM rent_scrape_targets WHERE market = $1 AND active = TRUE ORDER BY name`,
      [market]
    );

    const results: ScrapeTargetResult[] = [];
    let success = 0;
    let failed = 0;

    for (const target of targets) {
      logger.info(`[RentScraper] Scraping ${target.name} (${target.website_url})`);
      try {
        const result = await this.scrapeAndPersist(target.id, target.website_url);
        results.push({ name: target.name, ...result });
        if (result.error) {
          failed++;
        } else {
          success++;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failed++;
        results.push({ name: target.name, error: message });
      }
    }

    return { total: targets.length, success, failed, results };
  }

  async getRentChanges(market: string, days: number = 30): Promise<RentChange[]> {
    const pool = getPool();

    const { rows } = await pool.query<RentChange>(
      `WITH latest AS (
        SELECT DISTINCT ON (target_id) target_id, avg_rent, scraped_at
        FROM rent_scrape_results
        WHERE error IS NULL AND avg_rent IS NOT NULL
        ORDER BY target_id, scraped_at DESC
      ),
      previous AS (
        SELECT DISTINCT ON (r.target_id) r.target_id, r.avg_rent, r.scraped_at
        FROM rent_scrape_results r
        INNER JOIN latest l ON l.target_id = r.target_id AND r.scraped_at < l.scraped_at
        WHERE r.error IS NULL AND r.avg_rent IS NOT NULL
          AND r.scraped_at >= NOW() - INTERVAL '1 day' * $2
        ORDER BY r.target_id, r.scraped_at DESC
      )
      SELECT
        t.id as "targetId",
        t.name,
        t.address,
        t.market,
        p.avg_rent as "previousAvg",
        l.avg_rent as "currentAvg",
        CASE WHEN p.avg_rent > 0 THEN ROUND(((l.avg_rent - p.avg_rent) / p.avg_rent * 100)::numeric, 2) ELSE NULL END as "changePercent",
        p.scraped_at as "previousDate",
        l.scraped_at as "currentDate"
      FROM rent_scrape_targets t
      INNER JOIN latest l ON l.target_id = t.id
      LEFT JOIN previous p ON p.target_id = t.id
      WHERE t.market = $1 AND t.active = TRUE
      ORDER BY "changePercent" DESC NULLS LAST`,
      [market, days]
    );

    return rows;
  }

  async addTarget(name: string, address: string, websiteUrl: string, market: string = 'Atlanta'): Promise<ScrapeTarget> {
    this.validateUrl(websiteUrl);
    const pool = getPool();
    const { rows } = await pool.query<ScrapeTarget>(
      `INSERT INTO rent_scrape_targets (name, address, website_url, market) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, address, websiteUrl, market]
    );
    return rows[0];
  }

  async listTargets(market?: string): Promise<ScrapeTarget[]> {
    const pool = getPool();
    if (market) {
      const { rows } = await pool.query<ScrapeTarget>(
        `SELECT id, name, address, market, website_url, active, created_at FROM rent_scrape_targets WHERE market = $1 ORDER BY name`,
        [market]
      );
      return rows;
    }
    const { rows } = await pool.query<ScrapeTarget>(
      `SELECT id, name, address, market, website_url, active, created_at FROM rent_scrape_targets ORDER BY market, name`
    );
    return rows;
  }

  async getMarketsWithActiveTargets(): Promise<string[]> {
    const pool = getPool();
    const { rows } = await pool.query<MarketRow>(
      `SELECT DISTINCT market FROM rent_scrape_targets WHERE active = TRUE ORDER BY market`
    );
    return rows.map((r: MarketRow) => r.market);
  }
}

export { ScrapeResult, ScrapeTarget, ScrapeJobResult, ScrapeTargetResult, RentChange };
export const rentScraperService = new RentScraperService();
