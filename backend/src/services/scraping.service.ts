import axios from 'axios';
import * as cheerio from 'cheerio';
import { Pool } from 'pg';
import { getPool } from '../database/connection';

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_BR_TOKEN = process.env.CLOUDFLARE_BR_TOKEN;
const CF_BR_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering`;

const CACHE_TTL_DAYS = 30;

const EMPTY_PAGE_SIGNALS = [
  'content not found',
  "can't find the content",
  'page not found',
  '404',
  'start over',
  'please use the table of contents',
  'unable to find',
];

export interface ScrapedZoningCode {
  districtCode: string;
  municipalityId: string;
  codeSection: string | null;
  text: string;
  wordCount: number;
  source: string;
  cachedAt: string;
  fromCache: boolean;
}

export interface ScrapedProperty {
  parcelId: string | null;
  owner: string | null;
  address: string | null;
  landValue: number | null;
  improvementValue: number | null;
  totalValue: number | null;
  landAreaSqft: number | null;
  landAreaAcres: number | null;
  zoningCode: string | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  source: string;
  scrapedAt: string;
}

export interface ScrapedMunicodeRecord {
  documentId: string | null;
  meetingDate: string | null;
  documentTitle: string;
  documentType: string;
  pdfUrl: string | null;
  accessLink: string | null;
  year: number | null;
  ancestryPath: string | null;
}

export interface MunicodeRecordOptions {
  documentType?: 'minutes' | 'agendas' | 'resolutions' | 'ordinances' | 'all';
  startYear?: number;
  endYear?: number;
  maxItems?: number;
}

export class ScrapingService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  private async fetchRenderedHtml(url: string, waitForSelector?: string): Promise<string> {
    if (!CF_ACCOUNT_ID || !CF_BR_TOKEN) {
      throw new Error('Cloudflare Browser Rendering credentials not configured (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_BR_TOKEN)');
    }

    const payload: Record<string, unknown> = {
      url,
      gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
    };

    if (waitForSelector) {
      payload.waitForSelector = waitForSelector;
    }

    const response = await axios.post(`${CF_BR_BASE}/content`, payload, {
      headers: {
        Authorization: `Bearer ${CF_BR_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 45000,
    });

    if (typeof response.data === 'string') return response.data;
    if (response.data?.result) return response.data.result;
    if (response.data?.html) return response.data.html;

    throw new Error(`Unexpected Cloudflare BR response shape: ${JSON.stringify(response.data).substring(0, 200)}`);
  }

  private isEmptyPage(text: string): boolean {
    const lower = text.toLowerCase().trim();
    if (text.trim().split(/\s+/).length < 50) return true;
    return EMPTY_PAGE_SIGNALS.some(signal => lower.includes(signal));
  }

  private cleanText(raw: string): string {
    return raw.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  private buildOrdinanceTextFromDB(district: Record<string, any>): string {
    const lines: string[] = [];

    const code = district.district_code || district.zoning_code;
    const name = district.district_name || code;
    const section = district.code_section;

    lines.push(`ZONING DISTRICT: ${code} — ${name}`);
    if (section) lines.push(`CODE SECTION: Section ${section}, Atlanta Land Development Code`);
    lines.push('');

    if (district.description) {
      lines.push('DISTRICT OVERVIEW');
      lines.push(district.description);
      lines.push('');
    }

    lines.push('DEVELOPMENT STANDARDS');

    const resFar = parseFloat(district.residential_far);
    const nonResFar = parseFloat(district.nonresidential_far);
    const maxFar = parseFloat(district.max_far);

    if (!isNaN(resFar) && !isNaN(nonResFar)) {
      lines.push(`Floor Area Ratio (FAR):`);
      lines.push(`  Residential FAR: ${resFar}`);
      lines.push(`  Nonresidential FAR: ${nonResFar}`);
      lines.push(`  Combined maximum FAR: ${(resFar + nonResFar).toFixed(3)} (residential + nonresidential)`);
      if (!isNaN(maxFar)) lines.push(`  Absolute FAR ceiling: ${maxFar} (applies to individual uses separately, not combined)`);
    } else if (!isNaN(maxFar)) {
      lines.push(`Maximum FAR: ${maxFar}`);
    }

    if (district.max_stories) lines.push(`Maximum Stories: ${district.max_stories}`);
    if (district.max_height_feet || district.max_building_height_ft) {
      lines.push(`Maximum Height: ${district.max_height_feet || district.max_building_height_ft} feet`);
    }

    if (district.max_density_per_acre) {
      const method = district.density_method === 'far_derived'
        ? '(FAR-derived; density is a function of FAR, not an independent limit)'
        : '';
      lines.push(`Maximum Density: ${district.max_density_per_acre} units/acre ${method}`);
    }

    if (district.max_lot_coverage) {
      const pct = parseFloat(district.max_lot_coverage) > 1
        ? district.max_lot_coverage
        : (parseFloat(district.max_lot_coverage) * 100).toFixed(0) + '%';
      lines.push(`Maximum Lot Coverage: ${pct}`);
    }

    const front = district.setback_front_ft ?? district.min_front_setback_ft;
    const side = district.setback_side_ft ?? district.min_side_setback_ft;
    const rear = district.setback_rear_ft ?? district.min_rear_setback_ft;
    if (front !== null || side !== null || rear !== null) {
      const parts = [];
      if (front !== null) parts.push(`Front: ${front} ft`);
      if (side !== null) parts.push(`Side: ${side} ft`);
      if (rear !== null) parts.push(`Rear: ${rear} ft`);
      lines.push(`Setbacks: ${parts.join(', ')}`);
    }

    if (district.min_parking_per_unit !== null && district.min_parking_per_unit !== undefined) {
      lines.push(`Parking Requirement: ${district.min_parking_per_unit} spaces per unit`);
    } else if (district.parking_per_unit !== null && district.parking_per_unit !== undefined) {
      lines.push(`Parking Requirement: ${district.parking_per_unit} spaces per unit`);
    } else {
      lines.push('Parking Requirement: Not specified in base district (may be waived by overlay)');
    }

    lines.push('');

    const permitted = district.permitted_uses;
    if (Array.isArray(permitted) && permitted.length > 0) {
      lines.push('PERMITTED USES');
      lines.push(permitted.map((u: string) => `  • ${u.replace(/_/g, ' ')}`).join('\n'));
      lines.push('');
    }

    const conditional = district.conditional_uses;
    if (Array.isArray(conditional) && conditional.length > 0) {
      lines.push('CONDITIONAL USES (require separate approval)');
      lines.push(conditional.map((u: string) => `  • ${u.replace(/_/g, ' ')}`).join('\n'));
      lines.push('');
    }

    const prohibited = district.prohibited_uses;
    if (Array.isArray(prohibited) && prohibited.length > 0) {
      lines.push('PROHIBITED USES');
      lines.push(prohibited.map((u: string) => `  • ${u.replace(/_/g, ' ')}`).join('\n'));
      lines.push('');
    }

    if (district.special_conditions) {
      lines.push('SPECIAL CONDITIONS');
      lines.push(district.special_conditions);
      lines.push('');
    }

    lines.push('NOTE: This summary was synthesized from the JediRe zoning database. Source: Atlanta Land Development Code, Section 16-19A.');

    return lines.join('\n');
  }

  private isDistrictRelevant(text: string, districtCode: string, codeSection: string | null): boolean {
    const lower = text.toLowerCase();
    const codeVariants = [
      districtCode.toLowerCase(),
      districtCode.replace(/-/g, '').toLowerCase(),
      ...(codeSection ? [codeSection.toLowerCase()] : []),
    ];
    return codeVariants.some(v => lower.includes(v));
  }

  async scrapeZoningCode(municipalityId: string, districtCode: string): Promise<ScrapedZoningCode> {
    const result = await this.pool.query(
      `SELECT zd.*, m.municode_url, m.state, m.name AS municipality_name
       FROM zoning_districts zd
       JOIN municipalities m ON m.id = zd.municipality_id
       WHERE zd.municipality_id = $1 AND zd.district_code = $2`,
      [municipalityId, districtCode],
    );

    if (result.rows.length === 0) {
      throw new Error(`District not found: ${districtCode} in ${municipalityId}`);
    }

    const district = result.rows[0];

    const cacheAge = district.last_verified_at
      ? (Date.now() - new Date(district.last_verified_at).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    if (
      district.full_code_text &&
      district.full_code_text.length > 300 &&
      !this.isEmptyPage(district.full_code_text) &&
      this.isDistrictRelevant(district.full_code_text, districtCode, district.code_section) &&
      cacheAge < CACHE_TTL_DAYS
    ) {
      return {
        districtCode: district.district_code,
        municipalityId,
        codeSection: district.code_section,
        text: district.full_code_text,
        wordCount: district.full_code_text.split(/\s+/).length,
        source: 'cache',
        cachedAt: district.last_verified_at,
        fromCache: true,
      };
    }

    let webScrapedContext: string | null = null;

    if (district.municode_node_id && district.municode_url) {
      const urlsToTry = [
        `${district.municode_url}?nodeId=${district.municode_node_id}`,
        `${district.municode_url}#!${district.municode_node_id}`,
      ];

      for (const url of urlsToTry) {
        try {
          const html = await this.fetchRenderedHtml(url);
          const $ = cheerio.load(html);
          $('script, style, nav, header, footer, .sidebar, [class*="navigation"], [class*="breadcrumb"]').remove();

          let text = '';
          for (const selector of ['.chunk-content', '.MuniCodeContent', '.code-content', 'article', 'main']) {
            const el = $(selector);
            if (el.length && el.text().trim().length > 200) {
              text = el.text();
              break;
            }
          }

          if (!text) text = $('body').text();
          text = this.cleanText(text);

          if (
            text &&
            !this.isEmptyPage(text) &&
            this.isDistrictRelevant(text, districtCode, district.code_section)
          ) {
            webScrapedContext = text;
            break;
          }
        } catch (err: any) {
          console.warn(`[scraping] Cloudflare BR fetch failed for ${url}: ${err.message}`);
        }
      }
    }

    const dbText = this.buildOrdinanceTextFromDB(district);

    const finalText = webScrapedContext
      ? `${dbText}\n\n---\nADDITIONAL ORDINANCE TEXT (scraped from Municode):\n${webScrapedContext}`
      : dbText;

    const scrapeSource = webScrapedContext ? 'cloudflare_scrape' : 'database_synthesized';

    await this.pool.query(
      `UPDATE zoning_districts
       SET full_code_text = $1, source = $2, last_verified_at = NOW()
       WHERE municipality_id = $3 AND district_code = $4`,
      [finalText, scrapeSource, municipalityId, districtCode],
    );

    return {
      districtCode: district.district_code,
      municipalityId,
      codeSection: district.code_section,
      text: finalText,
      wordCount: finalText.split(/\s+/).length,
      source: scrapeSource,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    };
  }

  async scrapeProperty(params: {
    address?: string;
    parcelId?: string;
    countyFips?: string;
    countyUrl?: string;
  }): Promise<ScrapedProperty> {
    const { address, parcelId, countyFips, countyUrl } = params;

    if (!address && !parcelId) throw new Error('Either address or parcelId is required');

    let targetUrl: string;

    if (countyUrl) {
      targetUrl = countyUrl;
    } else if (countyFips) {
      targetUrl = this.buildAssessorUrl(countyFips, address, parcelId);
    } else if (address) {
      targetUrl = `https://www.qpublic.net/search/?q=${encodeURIComponent(address)}`;
    } else {
      throw new Error('countyUrl or countyFips required when only parcelId is provided');
    }

    const html = await this.fetchRenderedHtml(targetUrl);
    const $ = cheerio.load(html);
    $('script, style, nav, header, footer').remove();

    const extractNumber = (text: string): number | null => {
      const n = parseFloat(text.replace(/[$,\s]/g, ''));
      return isNaN(n) ? null : n;
    };

    const findFieldValue = (labels: string[]): string | null => {
      for (const label of labels) {
        const el = $(`td:contains("${label}"), th:contains("${label}"), dt:contains("${label}")`).first();
        if (el.length) {
          const val = el.next().text().trim() || el.closest('tr').find('td').last().text().trim();
          if (val && val !== label) return val;
        }
      }
      return null;
    };

    const landAreaSqft = findFieldValue(['Land Area', 'Lot Size', 'Acreage', 'Sq Ft'])
      ? extractNumber(findFieldValue(['Land Area', 'Lot Size', 'Acreage', 'Sq Ft'])!)
      : null;

    return {
      parcelId: findFieldValue(['Parcel ID', 'Parcel Number', 'APN', 'PIN']) || parcelId || null,
      owner: findFieldValue(['Owner', 'Owner Name', 'Property Owner']),
      address: address || findFieldValue(['Property Address', 'Situs Address', 'Site Address']),
      landValue: extractNumber(findFieldValue(['Land Value', 'Land Assessment']) || ''),
      improvementValue: extractNumber(findFieldValue(['Improvement Value', 'Building Value']) || ''),
      totalValue: extractNumber(findFieldValue(['Total Value', 'Market Value', 'Appraised Value']) || ''),
      landAreaSqft,
      landAreaAcres: landAreaSqft ? Math.round((landAreaSqft / 43560) * 1000) / 1000 : null,
      zoningCode: findFieldValue(['Zoning', 'Zone', 'Zoning Code']),
      lastSaleDate: findFieldValue(['Sale Date', 'Last Sale Date', 'Deed Date']),
      lastSalePrice: extractNumber(findFieldValue(['Sale Price', 'Last Sale Price']) || ''),
      source: targetUrl,
      scrapedAt: new Date().toISOString(),
    };
  }

  async scrapeMunicodeRecords(
    municipalityId: string,
    options: MunicodeRecordOptions = {},
  ): Promise<ScrapedMunicodeRecord[]> {
    const { documentType = 'all', startYear, endYear, maxItems = 100 } = options;

    const munRow = await this.pool.query(
      'SELECT id, name, state, municode_url FROM municipalities WHERE id = $1',
      [municipalityId],
    );

    if (munRow.rows.length === 0) throw new Error(`Municipality not found: ${municipalityId}`);
    const mun = munRow.rows[0];
    if (!mun.municode_url) throw new Error(`No Municode URL configured for ${municipalityId}`);

    const baseUrl = mun.municode_url.replace('/codes/code_of_ordinances', '');
    const urlsToTry = [
      `${baseUrl}/MinutesTreasurer/search`,
      baseUrl,
      mun.municode_url,
    ];

    let html = '';
    for (const url of urlsToTry) {
      try {
        html = await this.fetchRenderedHtml(url, 'table, .search-results, .document-list');
        if (html && html.length > 200) break;
      } catch {
        continue;
      }
    }

    if (!html) throw new Error(`Could not fetch Municode records page for ${municipalityId}`);

    const $ = cheerio.load(html);
    const records: ScrapedMunicodeRecord[] = [];

    const typeKeywords: Record<string, string[]> = {
      minutes: ['minutes', 'meeting minutes'],
      agendas: ['agenda'],
      resolutions: ['resolution'],
      ordinances: ['ordinance', 'ord.'],
    };

    const matchesType = (title: string) => {
      if (documentType === 'all') return true;
      return (typeKeywords[documentType] || []).some(kw => title.toLowerCase().includes(kw));
    };

    const extractYear = (text: string) => {
      const m = text.match(/\b(20\d{2}|19\d{2})\b/);
      return m ? parseInt(m[1]) : null;
    };

    const inferDocType = (title: string) => {
      const t = title.toLowerCase();
      if (t.includes('minute')) return 'minutes';
      if (t.includes('agenda')) return 'agenda';
      if (t.includes('resolution')) return 'resolution';
      if (t.includes('ordinance') || t.includes(' ord.')) return 'ordinance';
      return 'document';
    };

    $('a[href*=".pdf"], tr').each((_, el) => {
      if (records.length >= maxItems) return false;
      const $el = $(el);
      const title = ($el.text().trim() || $el.find('td').first().text().trim()).substring(0, 300);
      if (!title || title.length < 3 || !matchesType(title)) return;

      const year = extractYear(title) || extractYear($el.closest('tr').text());
      if (startYear && year && year < startYear) return;
      if (endYear && year && year > endYear) return;

      const href = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
      const absHref = href?.startsWith('http') ? href : href ? `${mun.municode_url}${href}` : null;

      records.push({
        documentId: null,
        meetingDate: null,
        documentTitle: title,
        documentType: inferDocType(title),
        pdfUrl: href?.endsWith('.pdf') ? absHref : null,
        accessLink: absHref,
        year,
        ancestryPath: null,
      });
    });

    return records;
  }

  private buildAssessorUrl(countyFips: string, address?: string, parcelId?: string): string {
    const knownAssessors: Record<string, string> = {
      '13121': 'https://qpublic.schneidercorp.com/Application.aspx?AppID=1011&LayerID=22783&PageTypeID=4&PageID=9541',
      '13089': 'https://qpublic.schneidercorp.com/Application.aspx?AppID=818',
      '12086': 'https://www.miamidade.gov/propertysearch/',
      '48201': 'https://hcad.org/property-search/real-property/',
      '06037': 'https://portal.assessor.lacounty.gov/',
      '17031': 'https://www.cookcountyassessor.com/property-search',
    };

    const base = knownAssessors[countyFips];
    if (!base) return `https://www.qpublic.net/search/?q=${encodeURIComponent(address || parcelId || '')}&fips=${countyFips}`;
    if (parcelId) return `${base}?parcelId=${encodeURIComponent(parcelId)}`;
    if (address) return `${base}?address=${encodeURIComponent(address)}`;
    return base;
  }
}

export const scrapingService = new ScrapingService();
