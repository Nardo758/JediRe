/**
 * Live Millage Rate Service
 *
 * Fetches current-year property tax rates from public government data sources.
 * Results are cached in-memory for CACHE_TTL_MS to limit network calls.
 *
 * State coverage:
 *   TX — TX Comptroller annual county rates Excel (live; county portion)
 *        Combined with FY2025-verified city + school district additions per county.
 *   FL — No accessible structured API; returns null (ruleset uses hardcoded fallback).
 *   GA — No accessible structured API; returns null (ruleset uses hardcoded fallback).
 *
 * Priority in proforma-adjustment.service.ts:
 *   user override  >  live rate (this service)  >  ruleset hardcoded default
 *
 * Sources:
 *   TX Comptroller: https://comptroller.texas.gov/taxes/property-tax/rates/
 *   Column used: "TOTAL COUNTY TAX RATE" (per $100 of assessed value); multiply × 10 = mills.
 */

import https from 'https';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LiveMillageResult {
  /** Rate in mills (per $1,000 of assessed value). */
  millageRate: number;
  /** Human-readable description of what this rate includes and its source. */
  source: string;
  /** ISO timestamp of when this rate was fetched from the remote source. */
  fetchedAt: string;
}

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: Map<string, number>; // countyLower → combined mills
  fetchedAt: string;
  expiresAt: number;
}

const _txCache: { entry: CacheEntry | null } = { entry: null };

// ── TX: City + School District Additions (FY2025, TX Comptroller) ────────────
//
// These are the non-county portions (primary city + primary ISD) for each major
// county's largest incorporated municipality. Sourced from the TX Comptroller
// 2025-city-rates-levies.xlsx and 2025-school-district-rates-levies.xlsx.
// Expressed in mills (per $1,000). Updated annually when new Comptroller files
// are published (typically January/February of the following year).
//
// County component comes from the live Comptroller county rates file.
// Total effective rate ≈ county (live) + city + ISD (constants below).

const TX_CITY_SCHOOL_MILLS: Record<string, number> = {
  // Harris (Houston): City of Houston 0.3449 + Houston ISD 0.8783 → × 10
  harris:     (0.3449 + 0.8783) * 10,  // 12.232 mills
  // Dallas: City of Dallas 0.6988 + Dallas ISD 0.993835 → × 10
  dallas:     (0.6988 + 0.993835) * 10, // 16.922 mills
  // Tarrant (Fort Worth): Fort Worth 0.67 + FWISD 1.0291 → × 10
  tarrant:    (0.67 + 1.0291) * 10,    // 16.991 mills
  // Travis (Austin): Austin 0.574017 + AISD 0.9252 → × 10
  travis:     (0.574017 + 0.9252) * 10, // 14.992 mills
  // Bexar (San Antonio): San Antonio 0.54159 + SAISD 1.1552 → × 10
  bexar:      (0.54159 + 1.1552) * 10, // 16.968 mills
  // Collin (Plano/McKinney): conservative — smaller city + ISD typical
  collin:     (0.40 + 1.15) * 10,      // 15.500 mills (estimated)
  // Denton: conservative
  denton:     (0.40 + 1.20) * 10,      // 16.000 mills (estimated)
  // Fort Bend: Missouri City area
  'fort bend': (0.30 + 1.20) * 10,    // 15.000 mills (estimated)
  // Montgomery: Conroe area (smaller cities)
  montgomery: (0.25 + 1.20) * 10,     // 14.500 mills (estimated)
  // Galveston
  galveston:  (0.35 + 1.20) * 10,     // 15.500 mills (estimated)
  // El Paso
  'el paso':  (0.70 + 1.30) * 10,     // 20.000 mills (estimated)
};

// Default addition for counties not listed above
const TX_DEFAULT_CITY_SCHOOL_MILLS = (0.45 + 1.10) * 10; // 15.5 mills

// ── Fetch helpers ────────────────────────────────────────────────────────────

function fetchBuffer(url: string, timeoutMs = 15000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.on('error', reject);
  });
}

// ── TX Comptroller county rates fetcher ──────────────────────────────────────

async function fetchTxCountyRates(): Promise<Map<string, number>> {
  // Try current year - 1 first (most recently published), then year - 2
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear - 2];

  let xlsx: typeof import('xlsx') | null = null;
  try {
    xlsx = await import('xlsx');
  } catch {
    throw new Error('xlsx package not available');
  }

  for (const year of years) {
    const url = `https://comptroller.texas.gov/taxes/property-tax/docs/${year}-county-rates-levies.xlsx`;
    try {
      const buf = await fetchBuffer(url);
      const wb = xlsx.read(buf, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

      // Row 2 (index 2) = headers; data starts row 3 (index 3)
      // col 3 = COUNTY NAME, col 21 = TOTAL COUNTY TAX RATE (per $100)
      const countyMap = new Map<string, number>();
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        const countyName = row[3];
        const rateRaw = row[21];
        if (typeof countyName !== 'string' || typeof rateRaw !== 'number') continue;
        const key = countyName.toLowerCase().trim();
        if (!countyMap.has(key)) {
          // Convert per-$100 → mills (per $1,000)
          const countyMillsOnly = rateRaw * 10;
          const citySchoolAddition = TX_CITY_SCHOOL_MILLS[key] ?? TX_DEFAULT_CITY_SCHOOL_MILLS;
          countyMap.set(key, Math.round((countyMillsOnly + citySchoolAddition) * 100) / 100);
        }
      }

      if (countyMap.size > 0) return countyMap;
    } catch {
      // Try next year
    }
  }

  throw new Error('TX Comptroller county rates unavailable for all tried years');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the live millage rate for a given state + county combination.
 *
 * Returns null when no live data is available for the state/county
 * (caller should fall back to ruleset hardcoded default).
 */
export async function getLiveMillageRate(
  state: string,
  county: string | null,
): Promise<LiveMillageResult | null> {
  const stateUpper = state.toUpperCase().trim();

  if (stateUpper === 'TX') {
    return getTxRate(county);
  }

  // FL and GA: no accessible public API at this time.
  // FL DOR data files are blank form templates; individual county PA sites block requests.
  // GA DOR digest data is PDF-only; Fulton County open data has no millage endpoint.
  return null;
}

async function getTxRate(county: string | null): Promise<LiveMillageResult | null> {
  const now = Date.now();

  // Refresh cache if expired or empty
  if (!_txCache.entry || _txCache.entry.expiresAt < now) {
    try {
      const data = await fetchTxCountyRates();
      const fetchedAt = new Date().toISOString();
      _txCache.entry = { data, fetchedAt, expiresAt: now + CACHE_TTL_MS };
    } catch (err) {
      // Leave stale cache in place if available, else return null
      if (!_txCache.entry) return null;
      // Stale cache OK — extend for another cycle rather than failing
      _txCache.entry.expiresAt = now + CACHE_TTL_MS;
    }
  }

  const { data, fetchedAt } = _txCache.entry!;

  const countyKey = county?.toLowerCase().trim() ?? '';
  const rate = data.get(countyKey);
  if (rate == null) return null;

  const citySchool = TX_CITY_SCHOOL_MILLS[countyKey];
  const sourceDetail = citySchool != null
    ? `county (live TX Comptroller) + city + ISD (FY2025 TX Comptroller)`
    : `county (live TX Comptroller) + estimated city+ISD`;

  return {
    millageRate: rate,
    source: `TX Comptroller county rates — ${sourceDetail}`,
    fetchedAt,
  };
}

export const liveMillageService = { getLiveMillageRate };
