/**
 * Gwinnett County HTML Applications-Received Fallback Adapter
 *
 * Gwinnett County publishes a curated HTML table of planning applications
 * received at:
 *   https://www.gwinnettcounty.com/government/departments/planning-development/
 *   land-use-planning/applications-received/{year}
 *
 * This is updated monthly (not daily like Accela), so it serves as a
 * supplementary cross-check rather than the primary real-time source.
 * No ViewState or session management required — plain GET + parse.
 *
 * Fields available on the page: case number, applicant, address, parcel ID,
 * application type, action requested, scheduled hearing date.
 *
 * Task: #1076
 */

import * as cheerio from 'cheerio';
import { logger } from '../../../utils/logger';
import type { RawPlanningApplication } from '../planning-ingest.service';

const BASE_URL = 'https://www.gwinnettcounty.com';
const APPLICATIONS_PATH = '/government/departments/planning-development/land-use-planning/applications-received';
const FETCH_TIMEOUT_MS  = 20_000;
const JURISDICTION       = 'gwinnett_county';

// ── HTTP helper ────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!resp.ok) {
      logger.debug(`[gwinnett-html] HTTP ${resp.status} from ${url}`);
      return null;
    }
    return resp.text();
  } catch (err: any) {
    clearTimeout(timer);
    logger.debug(`[gwinnett-html] fetch error from ${url}: ${err?.message}`);
    return null;
  }
}

// ── Parsing ────────────────────────────────────────────────────────────────

function findColIdx(headers: string[], candidates: string[]): number {
  const lowers = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lowers.findIndex((h) => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseDate(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? null : d;
}

function normaliseType(raw: string): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u.includes('REZONE') || u.includes('REZONING'))         return 'REZONING';
  if (u.includes('SLUP') || u.includes('SPECIAL LAND USE'))   return 'SLUP';
  if (u.includes('VARIANCE'))                                  return 'VARIANCE';
  if (u.includes('SPECIAL USE'))                               return 'SLUP';
  if (u.includes('SITE PLAN'))                                 return 'SITE_PLAN';
  if (u.includes('CONDITIONAL USE') || u.includes(' CUP'))    return 'CONDITIONAL_USE';
  if (u.includes('SUBDIVISION'))                               return 'SUBDIVISION';
  return raw.trim() || null;
}

/**
 * Parse the Gwinnett applications-received HTML page.
 * Returns records for the specified year.
 */
function parseApplicationsPage(html: string, year: number): RawPlanningApplication[] {
  const $ = cheerio.load(html);
  const results: RawPlanningApplication[] = [];
  const sourceUrl = `${BASE_URL}${APPLICATIONS_PATH}/${year}`;

  // Gwinnett uses a <table> — find the first data table on the page
  const $tables = $('table');
  if (!$tables.length) {
    logger.debug(`[gwinnett-html] No tables found on ${year} page`);
    return results;
  }

  $tables.each((_tIdx, tableEl) => {
    const $table = $(tableEl);
    const rows   = $table.find('tr');
    if (rows.length < 2) return; // skip tables without data rows

    // Parse header row
    const headerCells: string[] = [];
    rows.first().find('th, td').each((_i, el) => {
      headerCells.push($(el).text().trim());
    });

    if (headerCells.every((h) => !h)) return; // no headers = not a data table

    const colIdx = {
      caseNumber:   findColIdx(headerCells, ['case number', 'case no', 'application no', 'permit no', 'record no', 'case #']),
      applicant:    findColIdx(headerCells, ['applicant', 'owner', 'contact']),
      address:      findColIdx(headerCells, ['address', 'location', 'site address', 'property']),
      parcelId:     findColIdx(headerCells, ['parcel', 'parcel id', 'parcel number', 'pin', 'parcel no']),
      appType:      findColIdx(headerCells, ['type', 'application type', 'record type', 'zoning type', 'request']),
      action:       findColIdx(headerCells, ['action', 'action requested', 'request type']),
      filedDate:    findColIdx(headerCells, ['filed', 'date filed', 'application date', 'received', 'date received']),
      hearingDate:  findColIdx(headerCells, ['hearing', 'hearing date', 'scheduled', 'meeting date']),
      status:       findColIdx(headerCells, ['status']),
    };

    // Data rows (skip header)
    rows.slice(1).each((_rIdx, rowEl) => {
      const cells = $(rowEl).find('td');
      if (!cells.length) return;

      const cell = (idx: number): string => {
        if (idx < 0 || idx >= cells.length) return '';
        return cells.eq(idx).text().trim().replace(/\s+/g, ' ');
      };

      const caseNumber = cell(colIdx.caseNumber);
      if (!caseNumber) return; // skip empty / spacer rows

      results.push({
        case_number:      caseNumber,
        jurisdiction:     JURISDICTION,
        application_type: normaliseType(cell(colIdx.appType) || cell(colIdx.action)),
        applicant_name:   cell(colIdx.applicant) || null,
        property_address: cell(colIdx.address)   || null,
        parcel_id:        cell(colIdx.parcelId)  || null,
        current_zoning:   null,
        proposed_zoning:  null,
        filed_date:       parseDate(cell(colIdx.filedDate)),
        status:           cell(colIdx.status) || null,
        hearing_date:     parseDate(cell(colIdx.hearingDate)),
        source_url:       sourceUrl,
        raw_json:         {
          case_number: caseNumber,
          applicant:   cell(colIdx.applicant),
          address:     cell(colIdx.address),
          parcel_id:   cell(colIdx.parcelId),
          app_type:    cell(colIdx.appType),
          action:      cell(colIdx.action),
          filed_date:  cell(colIdx.filedDate),
          hearing_date: cell(colIdx.hearingDate),
          status:      cell(colIdx.status),
          source:      'gwinnett_html_fallback',
          year,
        },
      });
    });
  });

  return results;
}

// ── Adapter entry point ────────────────────────────────────────────────────

/**
 * Fetch and parse the Gwinnett County applications-received HTML index.
 * Fetches the current year and, when lookbackDays spans a year boundary, also
 * the previous year's page.
 *
 * Returns all applications found; callers should filter by filed_date if needed.
 */
export async function fetchGwinnettHtmlFallback(
  lookbackDays = 7,
): Promise<RawPlanningApplication[]> {
  const now           = new Date();
  const currentYear   = now.getFullYear();
  const cutoff        = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const needsPrevYear = cutoff.getFullYear() < currentYear;

  const yearsToFetch = needsPrevYear ? [currentYear - 1, currentYear] : [currentYear];
  const results: RawPlanningApplication[] = [];

  for (const year of yearsToFetch) {
    const url  = `${BASE_URL}${APPLICATIONS_PATH}/${year}`;
    logger.info(`[gwinnett-html] Fetching ${url}`);

    const html = await fetchHtml(url);
    if (!html) {
      logger.warn(`[gwinnett-html] Could not fetch ${year} page`);
      continue;
    }

    const pageResults = parseApplicationsPage(html, year);
    logger.info(`[gwinnett-html] Parsed ${pageResults.length} application(s) for ${year}`);

    // Filter to lookback window where filed_date is known
    for (const r of pageResults) {
      if (!r.filed_date || r.filed_date >= cutoff) {
        results.push(r);
      }
    }
  }

  logger.info(`[gwinnett-html] Fallback complete`, { total: results.length });
  return results;
}
