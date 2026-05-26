/**
 * Miami-Dade County Planning Application Adapter
 *
 * Scrapes the BCC (Board of County Commissioners) zoning hearing case tracker at
 * https://www8.miamidade.gov/Apps/RER/Track/case_track.aspx
 *
 * The case tracker is a custom ASP.NET WebForms application (not Accela) maintained
 * by the Miami-Dade Department of Regulatory and Economic Resources (RER).
 *
 * Session flow (correct ASP.NET token chain):
 *   1. GET case_track.aspx → ASP.NET session cookie + page-scoped __VIEWSTATE tokens
 *   2. POST case_track.aspx with those tokens + date-range + case-type filter
 *   3. Cheerio-parse the GridView results table
 *   4. Follow paginated __doPostBack links (if > 1 page)
 *
 * Folio bridge:
 *   The case tracker embeds the Miami-Dade folio number in each record row.
 *   Folio is stored directly as planning_applications.parcel_id.
 *   resolveFolioPA() provides on-demand PA API enrichment (owner, legal desc,
 *   property class) via the Miami-Dade Property Appraiser JSON proxy at
 *   apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx.
 *   It is NOT called per-record during the nightly sweep to keep the sweep fast;
 *   it is exported for use in future targeted-enrichment passes.
 *
 * Auth required: none — BCC case tracker is public.
 * Rate limit: 1.2 s courtesy gap between requests.
 *
 * Task: #1077
 */

import * as cheerio from 'cheerio';
import { logger } from '../../../utils/logger';
import type { RawPlanningApplication } from '../planning-ingest.service';

// ── Constants ────────────────────────────────────────────────────────────────

const CASE_TRACKER_URL  = 'https://www8.miamidade.gov/Apps/RER/Track/case_track.aspx';
const PA_API_BASE       = 'https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx';
const JURISDICTION      = 'miami_dade_county';
const SOURCE_URL        = CASE_TRACKER_URL;
const REQUEST_TIMEOUT_MS = 20_000;
const RATE_LIMIT_MS      = 1_200;   // ~1 req/sec courtesy limit
const MAX_PAGES          = 20;      // safety cap

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ── Cookie jar helpers ───────────────────────────────────────────────────────

function parseCookies(raw: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const cookie of raw) {
    const [kv] = cookie.split(';');
    const eqIdx = kv.indexOf('=');
    if (eqIdx > 0) {
      map.set(kv.slice(0, eqIdx).trim(), kv.slice(eqIdx + 1).trim());
    }
  }
  return map;
}

function mergeCookies(jar: Map<string, string>, incoming: Map<string, string>): void {
  incoming.forEach((v, k) => jar.set(k, v));
}

function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

function getSetCookies(resp: Response): string[] {
  // Node 18+: getSetCookie() returns string[]; fallback to get('set-cookie') for older runtimes
  if (typeof (resp.headers as any).getSetCookie === 'function') {
    return (resp.headers as any).getSetCookie();
  }
  const raw = resp.headers.get('set-cookie');
  return raw ? raw.split(/,(?=\s*\w+=)/) : [];
}

// ── ASP.NET ViewState extraction ─────────────────────────────────────────────

interface AspNetState {
  __VIEWSTATE:          string;
  __VIEWSTATEGENERATOR: string;
  __EVENTVALIDATION:    string;
  __VIEWSTATEENCRYPTED: string;
}

function extractAspNetState(html: string): AspNetState {
  const $ = cheerio.load(html);
  const val = (name: string) => $(`input[name="${name}"]`).val() as string ?? '';
  return {
    __VIEWSTATE:          val('__VIEWSTATE'),
    __VIEWSTATEGENERATOR: val('__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION:    val('__EVENTVALIDATION'),
    __VIEWSTATEENCRYPTED: val('__VIEWSTATEENCRYPTED'),
  };
}

// ── Session-aware fetch wrapper ───────────────────────────────────────────────

class MdcSession {
  private cookieJar: Map<string, string> = new Map();

  private commonHeaders(): Record<string, string> {
    const jar = cookieHeader(this.cookieJar);
    return {
      'User-Agent':      'Mozilla/5.0 (compatible; JediRE-PlanningBot/1.0)',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      ...(jar ? { Cookie: jar } : {}),
    };
  }

  async get(url: string): Promise<string | null> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const resp = await fetch(url, { headers: this.commonHeaders(), signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) {
        logger.warn(`[miami-dade] GET ${url} → HTTP ${resp.status}`);
        return null;
      }
      mergeCookies(this.cookieJar, parseCookies(getSetCookies(resp)));
      return await resp.text();
    } catch (err: any) {
      logger.warn(`[miami-dade] GET error: ${err?.message ?? String(err)}`);
      return null;
    }
  }

  async post(url: string, body: URLSearchParams): Promise<string | null> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.commonHeaders(),
          'Content-Type':   'application/x-www-form-urlencoded',
          'Referer':        url,
          'Origin':         new URL(url).origin,
        },
        body: body.toString(),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!resp.ok) {
        logger.warn(`[miami-dade] POST ${url} → HTTP ${resp.status}`);
        return null;
      }
      mergeCookies(this.cookieJar, parseCookies(getSetCookies(resp)));
      return await resp.text();
    } catch (err: any) {
      logger.warn(`[miami-dade] POST error: ${err?.message ?? String(err)}`);
      return null;
    }
  }
}

// ── Date formatting ───────────────────────────────────────────────────────────

/** MM/DD/YYYY — the date format MDC RER search forms expect */
function toMdcDate(d: Date): string {
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

/** Parse MM/DD/YYYY or YYYY-MM-DD or Month DD, YYYY date strings from the portal */
function parseMdcDate(raw: string | undefined | null): Date | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(parseInt(mdy[3]), parseInt(mdy[1]) - 1, parseInt(mdy[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  // YYYY-MM-DD (ISO)
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

// ── Type + status normalization ───────────────────────────────────────────────

/**
 * Map MDC BCC case types to our standard application_type codes.
 *
 * MDC BCC case type labels observed on the case tracker portal:
 *   REZONING / REZN       → REZONING
 *   VARIANCE / VAR        → VARIANCE
 *   CDMP / CDMP AMENDMENT → MODIFICATION  (Comprehensive Development Master Plan)
 *   SPECIAL EXCEPTION     → CONDITIONAL_USE
 *   SPECIAL USE PERMIT    → SLUP
 *   WAIVER                → VARIANCE       (closest standard type)
 *   SITE PLAN             → SITE_PLAN
 *   PLAT / SUBDIVISION    → SUBDIVISION
 */
function normaliseType(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.toUpperCase().trim();
  if (t.includes('REZONING') || t.includes('REZN'))               return 'REZONING';
  if (t.includes('CDMP') || t.includes('COMPREHENSIVE DEV'))      return 'MODIFICATION';
  if (t.includes('SPECIAL EXCEPTION') || t.startsWith('SPE EXC')) return 'CONDITIONAL_USE';
  if (t.includes('SPECIAL USE') || t.includes('SUP '))            return 'SLUP';
  if (t.includes('VARIANCE') || t.startsWith('VAR'))              return 'VARIANCE';
  if (t.includes('WAIVER'))                                        return 'VARIANCE';
  if (t.includes('SITE PLAN') || t === 'SP' || t.startsWith('SP ')) return 'SITE_PLAN';
  if (t.includes('PLAT') || t.includes('SUBDIVISION') || t.includes('SUB DIV')) return 'SUBDIVISION';
  if (t.includes('MODIFICATION') || t.includes('MOD'))            return 'MODIFICATION';
  return null;
}

function normaliseStatus(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.toUpperCase().trim();
  if (s.includes('PENDING') || s.includes('OPEN') || s.includes('ACTIVE') || s.includes('FILED')) return 'PENDING';
  if (s.includes('SCHEDULED') || s.includes('HEARING'))                                            return 'SCHEDULED';
  if (s.includes('APPROVED') || s.includes('GRANTED'))                                             return 'APPROVED';
  if (s.includes('DENIED') || s.includes('REJECTED'))                                              return 'DENIED';
  if (s.includes('CONTINUED') || s.includes('TABLED') || s.includes('DEFERRED'))                  return 'CONTINUED';
  if (s.includes('WITHDRAWN') || s.includes('CLOSED') || s.includes('VOID'))                      return 'WITHDRAWN';
  return raw.trim() || null;
}

// ── Column detection helper ───────────────────────────────────────────────────

function findCol(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.some((c) => h.includes(c)));
}

// ── Raw row type from the case tracker results table ─────────────────────────

interface CaseTrackerRow {
  caseNumber:   string;
  caseType:     string;
  applicant:    string;
  address:      string;
  folio:        string;
  status:       string;
  filedDate:    string;
  hearingDate:  string;
  description:  string;
}

// ── Results table parser ──────────────────────────────────────────────────────

/**
 * Parse the BCC case tracker results table.
 *
 * The MDC RER portal renders results in a standard ASP.NET GridView.
 * We detect column positions from header text to avoid fragile index dependencies.
 */
function parseResultsTable(html: string): CaseTrackerRow[] {
  const $ = cheerio.load(html);
  const rows: CaseTrackerRow[] = [];

  // MDC RER GridView selectors — try multiple in priority order
  const gridSelectors = [
    'table[id*="gvCases"]',
    'table[id*="gridCases"]',
    'table[id*="GridView"]',
    'table[id*="dgResults"]',
    'table[id*="tblResults"]',
    'table.gridview',
    'table.GridView',
    // Fallback: any table with recognizable header cells
    'table:has(th)',
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
    const noResults = $('body').text().toLowerCase();
    if (!noResults.includes('no record') && !noResults.includes('no result') && !noResults.includes('0 record')) {
      logger.debug('[miami-dade] Results table not found (unexpected layout or 0 results)');
    }
    return rows;
  }

  // Parse header row
  const headerCells: string[] = [];
  $table!.find('tr').first().find('th, td').each((_i, el) => {
    headerCells.push($(el).text().trim().toLowerCase());
  });

  const colIdx = {
    caseNumber:  findCol(headerCells, ['case no', 'case number', 'application no', 'record no', 'case #']),
    caseType:    findCol(headerCells, ['case type', 'type', 'application type', 'request type']),
    applicant:   findCol(headerCells, ['applicant', 'owner', 'petitioner', 'contact']),
    address:     findCol(headerCells, ['address', 'property address', 'location', 'site address', 'situs']),
    folio:       findCol(headerCells, ['folio', 'folio no', 'folio number', 'parcel', 'parcel id']),
    status:      findCol(headerCells, ['status', 'case status', 'disposition']),
    filedDate:   findCol(headerCells, ['filed', 'filed date', 'date filed', 'application date', 'open date', 'submit date']),
    hearingDate: findCol(headerCells, ['hearing', 'hearing date', 'bcc date', 'meeting date', 'scheduled date']),
    description: findCol(headerCells, ['description', 'project', 'request', 'proposed use', 'notes']),
  };

  // Data rows — GridView rows use tr:not(:first-child) or alternating CSS classes
  $table!.find('tr').slice(1).each((_i, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return;

    const cell = (idx: number): string => {
      if (idx < 0 || idx >= cells.length) return '';
      return cells.eq(idx).text().trim().replace(/\s+/g, ' ');
    };

    // Case number may be an <a> link
    let caseNumber = '';
    if (colIdx.caseNumber >= 0) {
      caseNumber = cells.eq(colIdx.caseNumber).find('a').first().text().trim()
                || cells.eq(colIdx.caseNumber).text().trim();
    }
    if (!caseNumber) return; // skip spacer/empty rows

    // Folio: strip non-numeric chars for storage; MDC folio is 13 digits
    const rawFolio = cell(colIdx.folio);
    const cleanFolio = rawFolio.replace(/[^0-9]/g, '');

    rows.push({
      caseNumber:  caseNumber.replace(/\s+/g, ' '),
      caseType:    cell(colIdx.caseType),
      applicant:   cell(colIdx.applicant),
      address:     cell(colIdx.address),
      folio:       cleanFolio || rawFolio,   // prefer cleaned numeric; fallback to raw
      status:      cell(colIdx.status),
      filedDate:   cell(colIdx.filedDate),
      hearingDate: cell(colIdx.hearingDate),
      description: cell(colIdx.description),
    });
  });

  return rows;
}

// ── Pagination state ─────────────────────────────────────────────────────────

interface PagerState {
  hasNext:          boolean;
  nextEventTarget:  string | null;
  __VIEWSTATE:          string;
  __VIEWSTATEGENERATOR: string;
  __EVENTVALIDATION:    string;
  __VIEWSTATEENCRYPTED: string;
}

function extractPagerState(html: string): PagerState {
  const $ = cheerio.load(html);
  const val = (name: string) => $(`input[name="${name}"]`).val() as string ?? '';

  // Look for a "Next" pager link rendered by ASP.NET GridView paging
  let hasNext = false;
  let nextTarget: string | null = null;

  // Pattern: <a href="javascript:__doPostBack('...$lnkNext','')">Next</a>
  // or <a href="javascript:__doPostBack('...$lnkPageNext','')">...</a>
  $('a').each((_i, el) => {
    const text = $(el).text().toLowerCase().trim();
    const href = $(el).attr('href') ?? '';
    const isNext = text === '>' || text === 'next' || text === '»';
    if (!isNext && !href.toLowerCase().includes('next')) return;

    const match = href.match(/__doPostBack\('([^']+)'/i);
    if (match) {
      hasNext    = true;
      nextTarget = match[1];
    }
  });

  return {
    hasNext,
    nextEventTarget: nextTarget,
    __VIEWSTATE:          val('__VIEWSTATE'),
    __VIEWSTATEGENERATOR: val('__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION:    val('__EVENTVALIDATION'),
    __VIEWSTATEENCRYPTED: val('__VIEWSTATEENCRYPTED'),
  };
}

// ── PA API folio bridge ───────────────────────────────────────────────────────

export interface FolioParcelInfo {
  folio:             string;
  owner:             string | null;
  legal_description: string | null;
  property_class:    string | null;
  primary_zone:      string | null;
  site_address:      string | null;
  assessed_value:    number | null;
}

/**
 * Resolve a Miami-Dade folio number to property details via the MDC Property
 * Appraiser JSON proxy service.
 *
 * Endpoint:
 *   GET apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx
 *     ?Operation=GetPropertySearchByFolio
 *     &clientAppName=PropertySearch
 *     &myfolio={folio}
 *
 * This function is exported for use in targeted enrichment passes.
 * It is NOT called per-record during the nightly planning sweep.
 *
 * Returns null on any error — folio resolution is non-critical; the planning
 * application record is still stored with the folio as parcel_id.
 */
export async function resolveFolioPA(folio: string): Promise<FolioParcelInfo | null> {
  const cleanFolio = folio.replace(/[^0-9]/g, '');
  if (!cleanFolio || cleanFolio.length < 10) return null;

  const params = new URLSearchParams({
    Operation:      'GetPropertySearchByFolio',
    clientAppName:  'PropertySearch',
    myfolio:        cleanFolio,
  });
  const url = `${PA_API_BASE}?${params.toString()}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JediRE-PlanningBot/1.0)',
        'Accept':     'application/json, text/plain, */*',
        'Referer':    'https://www.miamidade.gov/propertysearch/',
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!resp.ok) {
      logger.debug(`[miami-dade/pa-api] HTTP ${resp.status} for folio ${cleanFolio}`);
      return null;
    }

    const data: any = await resp.json();

    // The PA API response can vary across versions; handle multiple known shapes:
    // Shape A: { MinimumPropertyInfos: [{ PropertyInfo: {...} }] }
    // Shape B: flat object with FolioNumber, SiteAddress, etc.
    // Shape C: array at root level
    const infos: any[] =
      data?.MinimumPropertyInfos ??
      data?.PropertyInfos ??
      (Array.isArray(data) ? data : null) ??
      (data?.PropertyInfo ? [data] : []);

    const rec: any = infos[0]?.PropertyInfo ?? infos[0] ?? data;
    if (!rec) return null;

    // Owner: may be in Owner[0].Name, OwnerName, Owner1, etc.
    const ownerArr: any[] = rec.Owner ?? rec.Owners ?? [];
    const owner = (Array.isArray(ownerArr) && ownerArr[0]?.Name)
      ? ownerArr[0].Name
      : (rec.OwnerName ?? rec.Owner1 ?? null);

    // Legal description: may be in Legal[0].Description or LegalDesc
    const legalArr: any[] = rec.Legal ?? rec.LegalDesc ?? [];
    const legal = (Array.isArray(legalArr) && legalArr[0]?.Description)
      ? legalArr[0].Description
      : (typeof legalArr === 'string' ? legalArr : null);

    return {
      folio:             cleanFolio,
      owner:             owner ?? null,
      legal_description: legal ?? null,
      property_class:    rec.DORCodeDesc ?? rec.PropertyClass ?? rec.LandUseDesc ?? null,
      primary_zone:      rec.PrimaryZone ?? rec.ZoningCode ?? null,
      site_address:      rec.SiteAddress ?? rec.Address ?? null,
      assessed_value:    rec.Assessment?.TotalValue ?? rec.AssessedValue ?? null,
    };
  } catch (err: any) {
    logger.debug(`[miami-dade/pa-api] Error resolving folio ${cleanFolio}: ${err?.message ?? String(err)}`);
    return null;
  }
}

/**
 * Resolve a Miami-Dade folio by property address (for the municipal enrichment adapter).
 * Returns null on any error.
 */
export async function resolveFolioByAddress(address: string, city = 'MIAMI'): Promise<FolioParcelInfo | null> {
  if (!address?.trim()) return null;

  const params = new URLSearchParams({
    Operation:      'GetPropertySearchByAddress',
    clientAppName:  'PropertySearch',
    myAddress:      address.trim(),
    myUnit:         '',
    myCity:         city.trim(),
    myZip:          '',
  });
  const url = `${PA_API_BASE}?${params.toString()}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JediRE-PlanningBot/1.0)',
        'Accept':     'application/json, text/plain, */*',
        'Referer':    'https://www.miamidade.gov/propertysearch/',
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;

    const data: any = await resp.json();
    const infos: any[] =
      data?.MinimumPropertyInfos ??
      data?.PropertyInfos ??
      (Array.isArray(data) ? data : []);

    const rec: any = infos[0]?.PropertyInfo ?? infos[0] ?? null;
    if (!rec) return null;

    const folio = String(rec.Folio ?? rec.FolioNumber ?? rec.Strap ?? '').replace(/[^0-9]/g, '');
    if (!folio) return null;

    const ownerArr: any[] = rec.Owner ?? rec.Owners ?? [];
    const owner = (Array.isArray(ownerArr) && ownerArr[0]?.Name)
      ? ownerArr[0].Name
      : (rec.OwnerName ?? null);

    const legalArr: any[] = rec.Legal ?? [];
    const legal = (Array.isArray(legalArr) && legalArr[0]?.Description)
      ? legalArr[0].Description : null;

    return {
      folio,
      owner:             owner ?? null,
      legal_description: legal ?? null,
      property_class:    rec.DORCodeDesc ?? null,
      primary_zone:      rec.PrimaryZone ?? null,
      site_address:      rec.SiteAddress ?? rec.Address ?? null,
      assessed_value:    rec.Assessment?.TotalValue ?? null,
    };
  } catch {
    return null;
  }
}

// ── Main scraper ─────────────────────────────────────────────────────────────

/**
 * Scrape the Miami-Dade BCC case tracker for planning applications filed within
 * the last `lookbackDays` days.
 *
 * Session flow:
 *   1. GET case_track.aspx → session cookie + page-scoped __VIEWSTATE tokens
 *   2. POST case_track.aspx with date-range search for BCC planning case types
 *   3. Parse + paginate results (up to MAX_PAGES)
 *
 * The folio from the case tracker is stored directly as parcel_id.
 * PA API enrichment (owner, legal desc) is available via resolveFolioPA() but is
 * NOT called per-record here to keep the sweep fast.
 *
 * Returns [] on any fatal error; partial results on individual record parse failures.
 */
export async function fetchMiamiDadePlanningApps(
  lookbackDays = 7,
): Promise<RawPlanningApplication[]> {
  const session   = new MdcSession();
  const results:  RawPlanningApplication[] = [];

  const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const endDate   = new Date();
  const startStr  = toMdcDate(startDate);
  const endStr    = toMdcDate(endDate);

  logger.info('[miami-dade] Starting BCC case tracker scrape', {
    startDate:   startStr,
    endDate:     endStr,
    lookbackDays,
  });

  // ── Step 1: GET case_track.aspx for page-scoped ViewState tokens ──────────
  const initHtml = await session.get(CASE_TRACKER_URL);
  if (!initHtml) {
    logger.warn('[miami-dade] Could not reach BCC case tracker — skipping');
    return [];
  }

  const state = extractAspNetState(initHtml);

  await sleep(RATE_LIMIT_MS);

  // ── Step 2: POST search form ───────────────────────────────────────────────
  // MDC RER case tracker form fields.
  // We include both the standard ContentPlaceHolder1 naming and short-name aliases
  // since MDC custom ASP.NET portals use varied control prefixes.
  //
  // Case type: submit search for all planning-related types.
  // The MDC case tracker may require submitting one type per POST (like Accela),
  // but some installations accept a comma-separated value or "All Planning" option.
  // We first attempt a broad "All" search, then filter client-side by type.
  const searchForm = new URLSearchParams({
    __EVENTTARGET:   '',
    __EVENTARGUMENT: '',
    ...state,
    // ── Date range ─────────────────────────────────────────────────────────
    // Standard naming patterns for MDC RER ASP.NET controls
    'ctl00$ContentPlaceHolder1$txtDateFrom': startStr,
    'ctl00$ContentPlaceHolder1$txtDateTo':   endStr,
    'ctl00$cphMain$txtDateFrom':             startStr,
    'ctl00$cphMain$txtDateTo':               endStr,
    // Short-name aliases
    'txtDateFrom': startStr,
    'txtDateTo':   endStr,
    'txtFromDate': startStr,
    'txtToDate':   endStr,
    // ── Case type: search all planning/zoning types ────────────────────────
    // Leaving blank or "All" returns all case types; we filter client-side.
    // This avoids making N separate POSTs for each case type.
    'ctl00$ContentPlaceHolder1$ddlCaseType': '',
    'ctl00$cphMain$ddlCaseType':             '',
    'ddlCaseType': '',
    'ddlStatus':   '',
    // ── Search trigger ─────────────────────────────────────────────────────
    // The search button name can vary; include both common patterns.
    'ctl00$ContentPlaceHolder1$btnSearch': 'Search',
    'ctl00$cphMain$btnSearch':             'Search',
    'btnSearch':                           'Search',
  });

  const searchHtml = await session.post(CASE_TRACKER_URL, searchForm);
  if (!searchHtml) {
    logger.warn('[miami-dade] Search POST returned no HTML');
    return [];
  }

  // ── Step 3: Parse + paginate ───────────────────────────────────────────────
  // Planning-type allowlist — block non-planning BCC cases (building, code enforcement, etc.)
  const PLANNING_KEYWORDS = [
    'rezoning', 'rezn', 'variance', 'var', 'cdmp', 'waiver',
    'special exception', 'special use', 'site plan', 'plat', 'subdivision',
    'modification', 'conditional use', 'cup', 'sup ',
  ];

  function isPlanningCase(caseType: string): boolean {
    const lower = caseType.toLowerCase();
    return PLANNING_KEYWORDS.some((kw) => lower.includes(kw));
  }

  const seenCaseNumbers = new Set<string>();
  let currentHtml = searchHtml;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = parseResultsTable(currentHtml);
    logger.debug(`[miami-dade] Page ${page}: found ${rows.length} row(s)`);

    for (const row of rows) {
      // Guard: only keep planning/zoning cases
      if (row.caseType && !isPlanningCase(row.caseType)) {
        logger.debug(`[miami-dade] Skipping non-planning case: "${row.caseNumber}" type="${row.caseType}"`);
        continue;
      }

      const filedDate   = parseMdcDate(row.filedDate);
      const hearingDate = parseMdcDate(row.hearingDate);

      // Client-side date filter (portal may return records outside our date range)
      if (filedDate && filedDate < startDate) continue;

      if (seenCaseNumbers.has(row.caseNumber)) continue;
      seenCaseNumbers.add(row.caseNumber);

      results.push({
        case_number:      row.caseNumber,
        jurisdiction:     JURISDICTION,
        application_type: normaliseType(row.caseType),
        applicant_name:   row.applicant   || null,
        property_address: row.address     || null,
        parcel_id:        row.folio       || null,   // MDC folio number IS the parcel_id
        current_zoning:   null,                      // not in list view — in case detail page
        proposed_zoning:  null,                      // not in list view — in case detail page
        filed_date:       filedDate,
        status:           normaliseStatus(row.status),
        hearing_date:     hearingDate,
        source_url:       SOURCE_URL,
        raw_json:         {
          ...row,
          pa_api_enrichment_pending: !!row.folio,    // flag for future enrichment pass
        } as unknown as Record<string, unknown>,
      });
    }

    // Pagination
    const pager = extractPagerState(currentHtml);
    if (!pager.hasNext) break;

    await sleep(RATE_LIMIT_MS);

    const pageForm = new URLSearchParams({
      __EVENTTARGET:        pager.nextEventTarget ?? '',
      __EVENTARGUMENT:      '',
      __VIEWSTATE:          pager.__VIEWSTATE,
      __VIEWSTATEGENERATOR: pager.__VIEWSTATEGENERATOR,
      __EVENTVALIDATION:    pager.__EVENTVALIDATION,
      __VIEWSTATEENCRYPTED: pager.__VIEWSTATEENCRYPTED,
    });

    const nextHtml = await session.post(CASE_TRACKER_URL, pageForm);
    if (!nextHtml) break;
    currentHtml = nextHtml;
  }

  logger.info('[miami-dade] BCC case tracker scrape complete', { total: results.length });
  return results;
}
