/**
 * Accela Civic Platform (ACA) Planning Application Scraper
 *
 * Generic session-aware HTML scraper for the Accela Citizen Access (ACA) portal.
 * Handles ASP.NET ViewState, session cookies, and paginated results.
 * Parameterized by agency config — one class serves Gwinnett, DeKalb, and Cobb.
 *
 * Flow:
 *   1. GET Default.aspx / Welcome.aspx → ASP.NET session cookie + hidden form tokens
 *   2. POST Cap/CapSearch.aspx with date-range filter + record-type selectors
 *   3. Cheerio-parse the results table (class ACA_TabRow_Odd / ACA_TabRow_Even)
 *   4. Follow paginated "Next" postbacks until exhausted
 *
 * Auth required: none — all three portals support anonymous public record search.
 * Rate limit: 1 request/sec courtesy limit; enforced between pages via sleep.
 *
 * PIN field mapping:
 *   - Gwinnett: `PIN`-format  (e.g. "6195 151")  from gwinnett-ga.adapter.ts
 *   - DeKalb:   `PARCELID`    (e.g. "15 062 02 004") from dekalb-ga.adapter.ts
 *   - Cobb:     `PIN`         (numeric string, e.g. "20011200890") from cobb-ga.adapter.ts
 *
 * Task: #1076
 */

import * as cheerio from 'cheerio';
import { logger } from '../../../utils/logger';
import type { RawPlanningApplication } from '../planning-ingest.service';

// ── Agency configs ─────────────────────────────────────────────────────────

export interface AccelaAgencyConfig {
  /** Accela agency code (used in URL and as jurisdiction label) */
  agencyCode: string;
  /** Value written to planning_applications.jurisdiction */
  jurisdiction: string;
  /** Base portal URL — no trailing slash, no path */
  baseUrl: string;
  /**
   * Accela record-type category strings to search.
   * Sent as the module filter on the General Search form.
   * Empty = search all types (broadest net, slowest).
   */
  recordTypes: string[];
  /** Link label for the source_url in stored records */
  sourceLabel: string;
}

export const GWINNETT_CONFIG: AccelaAgencyConfig = {
  agencyCode:   'GWINNETT',
  jurisdiction: 'gwinnett_county',
  baseUrl:      'https://aca-prod.accela.com/GWINNETT',
  recordTypes:  ['Planning', 'Zoning'],
  sourceLabel:  'Gwinnett County Accela ZIP Portal',
};

export const DEKALB_CONFIG: AccelaAgencyConfig = {
  agencyCode:   'DEKALB',
  jurisdiction: 'dekalb_county',
  baseUrl:      'https://epermits.dekalbcountyga.gov',
  recordTypes:  ['Zoning'],
  sourceLabel:  'DeKalb County Accela ePermits Portal',
};

export const COBB_CONFIG: AccelaAgencyConfig = {
  agencyCode:   'COBB',
  jurisdiction: 'cobb_county',
  baseUrl:      'https://cobbca.cobbcounty.gov/CitizenAccess',
  recordTypes:  ['Planning'],
  sourceLabel:  'Cobb County Accela Citizen Access Portal',
};

// ── Helpers ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 20_000;
const RATE_LIMIT_MS      = 1_200;   // ~1 req/sec courtesy limit
const MAX_PAGES          = 20;      // safety cap — avoids runaway pagination

/** MM/DD/YYYY — the date format Accela forms expect */
function toAccelaDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Extract all cookies from Set-Cookie headers into a key→value map. */
function parseCookies(raw: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const cookie of raw) {
    const [kv] = cookie.split(';');
    const eqIdx = kv.indexOf('=');
    if (eqIdx > 0) {
      const k = kv.slice(0, eqIdx).trim();
      const v = kv.slice(eqIdx + 1).trim();
      map.set(k, v);
    }
  }
  return map;
}

/** Merge new cookies into the jar; newer values win. */
function mergeCookies(jar: Map<string, string>, incoming: Map<string, string>): void {
  incoming.forEach((v, k) => jar.set(k, v));
}

function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── ASP.NET ViewState extraction ───────────────────────────────────────────

interface AspNetState {
  __VIEWSTATE:          string;
  __VIEWSTATEGENERATOR: string;
  __EVENTVALIDATION:    string;
  __VIEWSTATEENCRYPTED: string;
}

function extractAspNetState(html: string): AspNetState {
  const $ = cheerio.load(html);
  return {
    __VIEWSTATE:          (String($('#__VIEWSTATE').val() ?? '')),
    __VIEWSTATEGENERATOR: (String($('#__VIEWSTATEGENERATOR').val() ?? '')),
    __EVENTVALIDATION:    (String($('#__EVENTVALIDATION').val() ?? '')),
    __VIEWSTATEENCRYPTED: (String($('#__VIEWSTATEENCRYPTED').val() ?? '')),
  };
}

// ── HTTP layer (cookie-aware fetch wrapper) ────────────────────────────────

class AccelaSession {
  private jar: Map<string, string> = new Map();
  private readonly config: AccelaAgencyConfig;

  constructor(config: AccelaAgencyConfig) {
    this.config = config;
  }

  private makeHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept:           'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      Cookie:            cookieHeader(this.jar),
      ...extra,
    };
  }

  async get(path: string): Promise<string | null> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        signal:  controller.signal,
        headers: this.makeHeaders(),
        redirect: 'follow',
      });
      clearTimeout(timer);

      const setCookie = resp.headers.getSetCookie?.() ?? [];
      mergeCookies(this.jar, parseCookies(setCookie));

      if (!resp.ok) {
        logger.debug(`[accela/${this.config.agencyCode}] GET ${url} → HTTP ${resp.status}`);
        return null;
      }
      return resp.text();
    } catch (err: any) {
      clearTimeout(timer);
      logger.debug(`[accela/${this.config.agencyCode}] GET ${url} error: ${err?.message}`);
      return null;
    }
  }

  async post(path: string, form: URLSearchParams): Promise<string | null> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        method:  'POST',
        signal:  controller.signal,
        headers: this.makeHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer:        `${this.config.baseUrl}/Default.aspx`,
        }),
        body:     form.toString(),
        redirect: 'follow',
      });
      clearTimeout(timer);

      const setCookie = resp.headers.getSetCookie?.() ?? [];
      mergeCookies(this.jar, parseCookies(setCookie));

      if (!resp.ok) {
        logger.debug(`[accela/${this.config.agencyCode}] POST ${url} → HTTP ${resp.status}`);
        return null;
      }
      return resp.text();
    } catch (err: any) {
      clearTimeout(timer);
      logger.debug(`[accela/${this.config.agencyCode}] POST ${url} error: ${err?.message}`);
      return null;
    }
  }
}

// ── Result table parsing ───────────────────────────────────────────────────

interface AccelaRawRow {
  recordNumber:  string;
  recordType:    string;
  status:        string;
  applicant:     string;
  address:       string;
  description:   string;
  filedDate:     string;
  parcelNumber:  string;
}

/**
 * Parse the Accela ACA search results table.
 *
 * Accela renders results in a <table> with rows classed ACA_TabRow_Odd /
 * ACA_TabRow_Even.  Column order varies by installation; we identify columns
 * by their header text and map positionally.
 *
 * Returns empty array (not throws) when no table is found — used for "0 results" pages.
 */
function parseResultsTable(html: string, agencyCode: string): AccelaRawRow[] {
  const $ = cheerio.load(html);
  const rows: AccelaRawRow[] = [];

  // Locate the results grid — Accela uses multiple possible selectors
  const gridSelectors = [
    'table[id*="tbl_CapSearchResult"]',
    'table[id*="CapSearchResult"]',
    'table.ACA_Grid',
    'table.ACA_TabRow',
    // Fallback: first table with ACA_TabRow_Odd rows
    'table:has(tr.ACA_TabRow_Odd)',
    'table:has(tr.ACA_TabRow_Even)',
  ];

  let $table: ReturnType<typeof $> | null = null;
  for (const sel of gridSelectors) {
    const candidate = $(sel).first();
    if (candidate.length) {
      $table = candidate;
      break;
    }
  }

  if (!$table || !$table.length) {
    // Log whether there might be a "no records" message vs a structural miss
    const noResults = $('*').text().toLowerCase().includes('no records') ||
                      $('*').text().toLowerCase().includes('no result');
    if (!noResults) {
      logger.debug(`[accela/${agencyCode}] Results table not found in HTML (may be 0 results or unexpected layout)`);
    }
    return rows;
  }

  // Parse header row to determine column positions
  const headerCells: string[] = [];
  $table!.find('tr').first().find('th, td').each((_i, el) => {
    headerCells.push($(el).text().trim().toLowerCase());
  });

  // If no headers found, try the second row (some tables use first row for titles)
  if (headerCells.every((h) => !h)) {
    $table!.find('tr').eq(1).find('th, td').each((_i, el) => {
      headerCells.push($(el).text().trim().toLowerCase());
    });
  }

  const colIdx = {
    recordNumber: findCol(headerCells, ['record no', 'record number', 'permit no', 'application no', 'case number', 'record #']),
    recordType:   findCol(headerCells, ['record type', 'permit type', 'application type', 'type']),
    status:       findCol(headerCells, ['status', 'record status']),
    applicant:    findCol(headerCells, ['applicant', 'owner', 'applicant name', 'contact']),
    address:      findCol(headerCells, ['address', 'property address', 'location', 'site address']),
    description:  findCol(headerCells, ['description', 'project description', 'work description', 'project']),
    filedDate:    findCol(headerCells, ['filed date', 'date filed', 'application date', 'open date', 'submit date', 'date']),
    parcelNumber: findCol(headerCells, ['parcel', 'parcel number', 'parcel no', 'pin', 'parcel id']),
  };

  // Data rows
  $table!.find('tr.ACA_TabRow_Odd, tr.ACA_TabRow_Even, tr[class*="RowColor"]').each((_i, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return;

    const cell = (idx: number): string => {
      if (idx < 0 || idx >= cells.length) return '';
      return cells.eq(idx).text().trim().replace(/\s+/g, ' ');
    };

    // Record number may be in an <a> link
    let recordNumber = '';
    if (colIdx.recordNumber >= 0) {
      recordNumber = cells.eq(colIdx.recordNumber).find('a').first().text().trim() ||
                     cells.eq(colIdx.recordNumber).text().trim();
    }

    if (!recordNumber) return; // skip spacer/empty rows

    rows.push({
      recordNumber:  recordNumber.replace(/\s+/g, ' '),
      recordType:    cell(colIdx.recordType),
      status:        cell(colIdx.status),
      applicant:     cell(colIdx.applicant),
      address:       cell(colIdx.address),
      description:   cell(colIdx.description),
      filedDate:     cell(colIdx.filedDate),
      parcelNumber:  cell(colIdx.parcelNumber),
    });
  });

  return rows;
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Extract the ViewState form tokens needed for pagination POSTs. */
function extractPagerState(html: string): AspNetState & { hasNext: boolean; nextEventTarget: string } {
  const state = extractAspNetState(html);
  const $ = cheerio.load(html);

  // Accela pagination: look for "Next" link / button with __doPostBack
  let hasNext = false;
  let nextEventTarget = '';

  $('a, input[type="submit"]').each((_i, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href') ?? '';
    const onclick = $(el).attr('onclick') ?? '';

    if (text === 'next' || text === '>' || text === '»' || text.includes('next page')) {
      hasNext = true;
      // Extract __doPostBack(eventTarget, ...) target
      const match = (onclick || href).match(/__doPostBack\(['"]([^'"]+)['"]/);
      if (match) nextEventTarget = match[1];
    }
  });

  return { ...state, hasNext, nextEventTarget };
}

// ── Normalization ──────────────────────────────────────────────────────────

function normaliseStatus(raw: string): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u.includes('APPROV')) return 'APPROVED';
  if (u.includes('DENI'))   return 'DENIED';
  if (u.includes('WITHDR')) return 'WITHDRAWN';
  if (u.includes('CONTINU')) return 'CONTINUED';
  if (u.includes('ISSU'))   return 'APPROVED'; // "Issued" = approved in building context
  if (u.includes('PEND') || u.includes('REVIEW') || u.includes('FILED') || u.includes('OPEN') || u.includes('ACTIVE')) return 'PENDING';
  return raw.trim().toUpperCase() || null;
}

function normaliseType(raw: string): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u.includes('REZONE') || u.includes('REZONING'))              return 'REZONING';
  if (u.includes('SLUP') || u.includes('SPECIAL LAND USE'))        return 'SLUP';
  if (u.includes('SPECIAL USE') && !u.includes('LAND'))            return 'SLUP';
  if (u.includes('VARIANCE'))                                       return 'VARIANCE';
  if (u.includes('SITE PLAN') || u.includes('SITE DEVELOPMENT'))   return 'SITE_PLAN';
  if (u.includes('LAND DEVELOPMENT') || u.includes('LAND DEV'))    return 'SITE_PLAN';
  if (u.includes('CONDITIONAL USE') || u.includes(' CUP'))         return 'CONDITIONAL_USE';
  if (u.includes('SUBDIVISION'))                                    return 'SUBDIVISION';
  if (u.includes('MODIFICATION') || u.includes('MOD'))             return 'MODIFICATION';
  return raw.trim() || null;
}

/** Parse Accela date strings: MM/DD/YYYY or YYYY-MM-DD or epoch ms */
function parseAccelaDate(raw: string): Date | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(parseInt(mdy[3]), parseInt(mdy[1]) - 1, parseInt(mdy[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  // ISO
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

// ── Main scraping function ─────────────────────────────────────────────────

/**
 * Scrape one Accela agency portal for planning applications filed within
 * the last `lookbackDays` days.
 *
 * Returns all records it could extract; on total failure returns [].
 */
export async function scrapeAccelaAgency(
  config: AccelaAgencyConfig,
  lookbackDays = 7,
): Promise<RawPlanningApplication[]> {
  const session = new AccelaSession(config);
  const results: RawPlanningApplication[] = [];

  const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const endDate   = new Date();
  const startStr  = toAccelaDate(startDate);
  const endStr    = toAccelaDate(endDate);

  logger.info(`[accela/${config.agencyCode}] Starting scrape`, { startDate: startStr, endDate: endStr });

  // ── Step 1: Initialise session (GET default page) ──────────────────────
  const initPaths = ['/Default.aspx', '/Welcome.aspx', '/'];
  let initHtml: string | null = null;

  for (const path of initPaths) {
    initHtml = await session.get(path);
    if (initHtml) break;
    await sleep(RATE_LIMIT_MS);
  }

  if (!initHtml) {
    logger.warn(`[accela/${config.agencyCode}] Could not reach portal — skipping`);
    return [];
  }

  const initState = extractAspNetState(initHtml);

  // ── Step 2: Submit General Search ─────────────────────────────────────
  await sleep(RATE_LIMIT_MS);

  // Build the general search form post.
  // Accela ACA uses consistent control naming across versions:
  //   ctl00$PlaceHolderMain$generalSearchForm$txtGSStartDate
  //   ctl00$PlaceHolderMain$generalSearchForm$txtGSEndDate
  // Some installations use shorter names; we include both variants.
  const searchForm = new URLSearchParams({
    __EVENTTARGET:  'ctl00$PlaceHolderMain$btnNewSearch',
    __EVENTARGUMENT: '',
    ...initState,
    // Longer control name pattern (standard ACA)
    'ctl00$PlaceHolderMain$generalSearchForm$txtGSStartDate': startStr,
    'ctl00$PlaceHolderMain$generalSearchForm$txtGSEndDate':   endStr,
    // Shorter pattern (older / custom installations)
    'txtGSStartDate': startStr,
    'txtGSEndDate':   endStr,
    // Search button — the value text differs by installation
    'ctl00$PlaceHolderMain$btnNewSearch': 'Search',
  });

  const searchHtml = await session.post('/Cap/CapSearch.aspx', searchForm);

  if (!searchHtml) {
    logger.warn(`[accela/${config.agencyCode}] Search POST returned no HTML`);
    return [];
  }

  // ── Step 3: Parse + paginate ───────────────────────────────────────────
  let currentHtml = searchHtml;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = parseResultsTable(currentHtml, config.agencyCode);

    for (const row of rows) {
      const filedDate = parseAccelaDate(row.filedDate);
      // Client-side date filter (portal may not honour our date range exactly)
      if (filedDate && filedDate < startDate) continue;

      const raw: RawPlanningApplication = {
        case_number:      row.recordNumber,
        jurisdiction:     config.jurisdiction,
        application_type: normaliseType(row.recordType),
        applicant_name:   row.applicant || null,
        property_address: row.address   || null,
        parcel_id:        row.parcelNumber || null,
        current_zoning:   null,   // Accela list view rarely shows current/proposed zoning; populated in detail scrape (future)
        proposed_zoning:  null,
        filed_date:       filedDate,
        status:           normaliseStatus(row.status),
        hearing_date:     null,   // hearing date requires per-record detail fetch (future)
        source_url:       `${config.baseUrl}/Cap/CapDetail.aspx?agencyCode=${config.agencyCode}`,
        raw_json:         row as unknown as Record<string, unknown>,
      };
      results.push(raw);
    }

    logger.debug(`[accela/${config.agencyCode}] Page ${page}: parsed ${rows.length} row(s)`);

    // Pagination
    const pager = extractPagerState(currentHtml);
    if (!pager.hasNext) break;

    await sleep(RATE_LIMIT_MS);

    const pageForm = new URLSearchParams({
      __EVENTTARGET:   pager.nextEventTarget || 'ctl00$PlaceHolderMain$CapSearchResultList1$PageBar1$lbtnPageNext',
      __EVENTARGUMENT: '',
      __VIEWSTATE:          pager.__VIEWSTATE,
      __VIEWSTATEGENERATOR: pager.__VIEWSTATEGENERATOR,
      __EVENTVALIDATION:    pager.__EVENTVALIDATION,
      __VIEWSTATEENCRYPTED: pager.__VIEWSTATEENCRYPTED,
    });

    const nextHtml = await session.post('/Cap/CapSearch.aspx', pageForm);
    if (!nextHtml) break;
    currentHtml = nextHtml;
  }

  logger.info(`[accela/${config.agencyCode}] Scrape complete`, { total: results.length });
  return results;
}
