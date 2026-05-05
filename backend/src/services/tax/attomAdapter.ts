/**
 * ATTOM Property Detail Adapter
 *
 * Calls the ATTOM Data Solutions Property Detail API (v3) and maps the
 * response to a NormalizedParcel for use by GeneralPropertyAppraiserFetcher.
 *
 * API docs: https://api.attomdata.com/property/v3/property/detail
 * Auth: ATTOM-APIKEY header (process.env.ATTOM_API_KEY)
 *
 * Tier routing: this adapter is Tier 2 in the PropertyAppraiserFetcher stack.
 *   Tier 1 (tax bill PDF) is higher priority and bypasses this adapter.
 *   Tier 3 (county adapters) is the fallback when ATTOM is unavailable.
 *
 * Staleness:
 *   COUNTY_FRESHNESS_PROFILE defines the maximum acceptable staleness_days
 *   per county. If the returned record exceeds the threshold, a warning is
 *   added to the result but the data is still returned (caller decides).
 */

import https from 'https';
import type { NormalizedParcel } from './types';

// ── Freshness profiles ────────────────────────────────────────────────────────

/**
 * Maximum staleness (days) before a warning is emitted for this county.
 * Jurisdictions with annual reassessment cycles (e.g. FL) tolerate up to
 * 365 days; more frequent counties (e.g. TX biennial) are given 730.
 */
const COUNTY_FRESHNESS_PROFILE: Record<string, number> = {
  'Miami-Dade': 180,
  Broward:      180,
  'Palm Beach': 180,
  Fulton:       365,
  Harris:       365,
  Travis:       365,
  Dallas:       365,
  Tarrant:      365,
  Bexar:        365,
};

const DEFAULT_MAX_STALENESS_DAYS = 365;

// ── ATTOM API response shape (partial) ───────────────────────────────────────

interface AttomPropertyDetail {
  identifier?: {
    apn?: string;
    fips?: string;
  };
  address?: {
    line1?: string;
    countyfips?: string;
    statecode?: string;
    countrysubdivisioncode?: string;
  };
  assessment?: {
    assessed?: {
      assdttlvalue?: number;
      assdlandvalue?: number;
      assdimprvalue?: number;
    };
    market?: {
      mktttlvalue?: number;
      mktlandvalue?: number;
      mktimprvalue?: number;
    };
    tax?: {
      taxamt?: number;
      taxyear?: number;
    };
    exemption?: {
      exemtotValue?: number;
    };
  };
  avm?: {
    amount?: {
      value?: number;
    };
  };
  sale?: {
    saleshistory?: Array<{
      amount?: { saleamt?: number };
      calculation?: { priceperbed?: number };
    }>;
  };
  summary?: {
    propertytype?: string;
    yearbuilt?: number;
  };
  vintage?: {
    lastModified?: string;
    pubDate?: string;
  };
}

interface AttomApiResponse {
  status?: {
    code?: number;
    msg?: string;
    total?: number;
  };
  property?: AttomPropertyDetail[];
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpsGet(url: string, headers: Record<string, string>, timeoutMs = 15000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location, headers, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`ATTOM API HTTP ${res.statusCode}: ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('ATTOM API request timed out')); });
    req.on('error', reject);
  });
}

// ── Staleness calculation ─────────────────────────────────────────────────────

function computeStaleness(lastUpdated: string | null | undefined): number | null {
  if (!lastUpdated) return null;
  const d = new Date(lastUpdated);
  if (!isFinite(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export interface AttomFetchResult {
  parcel: NormalizedParcel | null;
  warnings: string[];
}

/**
 * Fetch parcel data from ATTOM by parcel ID (APN) and state.
 *
 * Returns { parcel: null, warnings } when:
 *   - ATTOM_API_KEY is not set
 *   - ATTOM returns no matching property
 *   - ATTOM returns an HTTP error
 *
 * Never throws — all errors are captured as warnings so the caller can fall
 * through to the next tier gracefully.
 */
export async function fetchFromAttom(
  parcelId: string,
  state: string,
  county: string | null,
): Promise<AttomFetchResult> {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) {
    return {
      parcel: null,
      warnings: ['ATTOM_API_KEY not configured — Tier 2 (ATTOM) skipped'],
    };
  }

  const warnings: string[] = [];

  // Build query: ATTOM accepts APN + state or APN + FIPS.
  // We use the address-based parcel lookup by APN + state.
  const params = new URLSearchParams({
    attomId: parcelId,
  });

  const url = `https://api.attomdata.com/property/v3/property/detail?${params.toString()}`;

  let raw: AttomApiResponse;
  try {
    const buf = await httpsGet(url, {
      'Accept': 'application/json',
      'apikey': apiKey,
    });
    raw = JSON.parse(buf.toString('utf-8')) as AttomApiResponse;
  } catch (err: any) {
    warnings.push(`ATTOM fetch failed: ${err?.message ?? String(err)}`);
    return { parcel: null, warnings };
  }

  const prop = raw.property?.[0];
  if (!prop) {
    warnings.push(`ATTOM returned 0 properties for parcel "${parcelId}" in ${state}`);
    return { parcel: null, warnings };
  }

  // Map ATTOM fields to NormalizedParcel
  const lastUpdated = prop.vintage?.lastModified ?? prop.vintage?.pubDate ?? null;
  const staleness = computeStaleness(lastUpdated);

  // Staleness check
  const maxStaleness = county
    ? (COUNTY_FRESHNESS_PROFILE[county] ?? DEFAULT_MAX_STALENESS_DAYS)
    : DEFAULT_MAX_STALENESS_DAYS;
  if (staleness != null && staleness > maxStaleness) {
    warnings.push(
      `ATTOM data for parcel "${parcelId}" is ${staleness} days old ` +
      `(max for ${county ?? state}: ${maxStaleness} days)`,
    );
  }

  const assessment = prop.assessment;
  const justValue = assessment?.market?.mktttlvalue ?? prop.avm?.amount?.value ?? null;
  const assessedValue = assessment?.assessed?.assdttlvalue ?? null;
  const taxAmt = assessment?.tax?.taxamt ?? null;
  const taxYear = assessment?.tax?.taxyear ?? null;
  const exemptTotal = assessment?.exemption?.exemtotValue ?? null;

  // Compute aggregate millage from assessed value + tax amount
  let millageRate: number | null = null;
  if (assessedValue != null && assessedValue > 0 && taxAmt != null) {
    millageRate = Math.round((taxAmt / assessedValue) * 1000 * 100) / 100; // mills × 10
  }

  const parcel: NormalizedParcel = {
    parcel_id: parcelId,
    state: state.toUpperCase(),
    county,
    just_value: justValue ?? null,
    assessed_value: assessedValue ?? null,
    land_value: assessment?.assessed?.assdlandvalue ?? assessment?.market?.mktlandvalue ?? null,
    improvement_value: assessment?.assessed?.assdimprvalue ?? assessment?.market?.mktimprvalue ?? null,
    exemptions_total: exemptTotal ?? null,
    millage_rate: millageRate,
    annual_tax: taxAmt ?? null,
    tax_year: taxYear ?? null,
    last_updated: lastUpdated,
    staleness_days: staleness,
    source: 'attom',
  };

  return { parcel, warnings };
}

export const attomAdapter = { fetchFromAttom };
