/**
 * Economic & Industry Context Service
 *
 * Assembles a structured, cited data block for injection into Claude prompts.
 * Sources:
 *   • FRED  (free)  — macroeconomic indicators with citation "FRED, [date]"
 *   • BLS   (free)  — QCEW labor data by NAICS with citation "BLS QCEW [year]"
 *   • SEC-API.io ($49/mo) — parsed 10-K comp financials with citation "SEC 10-K FY[year]"
 *
 * The output is a plain-text block Claude is instructed to cite verbatim.
 * Fetches are cached in-process (1h TTL) to avoid redundant API calls per request.
 */

import { fredApiClient, FRED_SERIES } from '../utils/fred-api.client';
import { blsApiClient, BLS_NAICS_MAP, LaborSnapshot } from '../utils/bls-api.client';
import { secApiClient, SecCompSnapshot } from '../utils/sec-api.client';

// ─── In-process cache (lightweight — no Redis dependency) ────────────────────
interface CacheEntry<T> { value: T; expiresAt: number }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.value as T;
}
function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── FRED macro snapshot ──────────────────────────────────────────────────────

export interface FredMacroSnapshot {
  gdpGrowthPct: number | null;       // GDPC1 real GDP YoY
  cpiYoYPct: number | null;          // CPIAUCSL YoY
  federalFundsRate: number | null;   // DFF
  unemploymentRate: number | null;   // UNRATE
  consumerSentiment: number | null;  // UMCSENT
  mortgage30yRate: number | null;    // MORTGAGE30US
  asOfDate: string;
  citationTag: string;              // "FRED, YYYY-MM-DD"
}

async function fetchFredMacro(): Promise<FredMacroSnapshot> {
  const cacheKey = 'fred_macro';
  const cached = getCached<FredMacroSnapshot>(cacheKey);
  if (cached) return cached;

  const today = new Date().toISOString().split('T')[0];

  const seriesIds = [
    'GDPC1',         // Real GDP (quarterly, lags)
    FRED_SERIES.FFR, // Federal Funds Rate
    'UNRATE',        // Unemployment Rate
    'UMCSENT',       // U Michigan Consumer Sentiment
    FRED_SERIES.MTG30Y,
    'CPIAUCSL',      // CPI All Urban Consumers
  ];

  try {
    // Fetch last observation for each series
    const [gdpData, ffrData, urData, sentData, mtgData, cpiData] = await Promise.allSettled([
      fredApiClient.getSeries('GDPC1', undefined, undefined, 5),
      fredApiClient.getSeries(FRED_SERIES.FFR, undefined, undefined, 1),
      fredApiClient.getSeries('UNRATE', undefined, undefined, 1),
      fredApiClient.getSeries('UMCSENT', undefined, undefined, 1),
      fredApiClient.getSeries(FRED_SERIES.MTG30Y, undefined, undefined, 1),
      fredApiClient.getSeries('CPIAUCSL', undefined, undefined, 13), // 13 for YoY
    ]);

    // Real GDP YoY (compare latest vs 4 quarters ago)
    let gdpGrowthPct: number | null = null;
    if (gdpData.status === 'fulfilled' && gdpData.value.length >= 5) {
      const arr = gdpData.value;
      const latest = parseFloat(arr[arr.length - 1].value);
      const yearAgo = parseFloat(arr[arr.length - 5].value);
      if (!isNaN(latest) && !isNaN(yearAgo) && yearAgo > 0) {
        gdpGrowthPct = ((latest - yearAgo) / yearAgo) * 100;
      }
    }

    // CPI YoY
    let cpiYoYPct: number | null = null;
    if (cpiData.status === 'fulfilled' && cpiData.value.length >= 13) {
      const arr = cpiData.value;
      const latest = parseFloat(arr[arr.length - 1].value);
      const yearAgo = parseFloat(arr[arr.length - 13].value);
      if (!isNaN(latest) && !isNaN(yearAgo) && yearAgo > 0) {
        cpiYoYPct = ((latest - yearAgo) / yearAgo) * 100;
      }
    }

    const snapshot: FredMacroSnapshot = {
      gdpGrowthPct,
      cpiYoYPct,
      federalFundsRate: ffrData.status === 'fulfilled' && ffrData.value[0]
        ? parseFloat(ffrData.value[0].value) : null,
      unemploymentRate: urData.status === 'fulfilled' && urData.value[0]
        ? parseFloat(urData.value[0].value) : null,
      consumerSentiment: sentData.status === 'fulfilled' && sentData.value[0]
        ? parseFloat(sentData.value[0].value) : null,
      mortgage30yRate: mtgData.status === 'fulfilled' && mtgData.value[0]
        ? parseFloat(mtgData.value[0].value) : null,
      asOfDate: today,
      citationTag: `FRED, ${today}`,
    };

    setCached(cacheKey, snapshot);
    return snapshot;
  } catch (err: any) {
    console.warn('[EconomicContext] FRED fetch failed:', err.message);
    return {
      gdpGrowthPct: null, cpiYoYPct: null, federalFundsRate: null,
      unemploymentRate: null, consumerSentiment: null, mortgage30yRate: null,
      asOfDate: today, citationTag: `FRED, ${today}`,
    };
  }
}

// ─── BLS labor snapshot ───────────────────────────────────────────────────────

async function fetchBlsLabor(businessType: string): Promise<LaborSnapshot | null> {
  const naicsEntry = BLS_NAICS_MAP[businessType?.toUpperCase()];
  if (!naicsEntry) return null;

  const cacheKey = `bls_${naicsEntry.naics}`;
  const cached = getCached<LaborSnapshot>(cacheKey);
  if (cached) return cached;

  try {
    const snapshot = await blsApiClient.getLaborSnapshot(naicsEntry.naics);
    if (snapshot) setCached(cacheKey, snapshot);
    return snapshot;
  } catch (err: any) {
    console.warn('[EconomicContext] BLS fetch failed:', err.message);
    return null;
  }
}

// ─── SEC comp snapshot ────────────────────────────────────────────────────────

async function fetchSecComps(businessType: string): Promise<SecCompSnapshot | null> {
  const key = businessType?.toUpperCase();
  const cacheKey = `sec_${key}`;
  const cached = getCached<SecCompSnapshot>(cacheKey);
  if (cached) return cached;

  try {
    const snapshot = await secApiClient.getCompSnapshot(key);
    if (snapshot) setCached(cacheKey, snapshot);
    return snapshot;
  } catch (err: any) {
    console.warn('[EconomicContext] SEC-API fetch failed:', err.message);
    return null;
  }
}

// ─── Formatter helpers ────────────────────────────────────────────────────────

function pctFmt(v: number | null, digits = 1): string {
  return v !== null ? `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%` : 'N/A';
}

function numFmt(v: number | null, prefix = '', suffix = ''): string {
  if (v === null) return 'N/A';
  return `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}${suffix}`;
}

function dollarFmt(v: number | null): string {
  if (v === null) return 'N/A';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface EconomicContextBlock {
  text: string;               // Formatted text block for Claude prompt injection
  hasFred: boolean;
  hasBls: boolean;
  hasSec: boolean;
  fred?: FredMacroSnapshot;
  bls?: LaborSnapshot | null;
  sec?: SecCompSnapshot | null;
}

/**
 * Assemble and format the Economic & Industry Context block.
 *
 * @param businessType  - e.g. "APARTMENT", "SELF_STORAGE" (matches BLS_NAICS_MAP + SEC_COMP_TICKERS keys)
 * @param includeSec    - set false to skip SEC (slower, paid API); default true
 */
export async function buildEconomicContextBlock(
  businessType?: string,
  includeSec = true,
): Promise<EconomicContextBlock> {
  const upperBT = businessType?.toUpperCase() ?? '';

  // Fetch all three sources in parallel
  const [fred, bls, sec] = await Promise.all([
    fetchFredMacro(),
    upperBT ? fetchBlsLabor(upperBT) : Promise.resolve(null),
    (includeSec && upperBT) ? fetchSecComps(upperBT) : Promise.resolve(null),
  ]);

  const lines: string[] = ['=== ECONOMIC & INDUSTRY CONTEXT (cite these numbers, do not fabricate) ==='];

  // FRED block
  lines.push('');
  lines.push('--- Macroeconomic Indicators ---');
  lines.push(`GDP Growth (real, YoY):        ${pctFmt(fred.gdpGrowthPct)}     [${fred.citationTag}]`);
  lines.push(`CPI Inflation (YoY):           ${pctFmt(fred.cpiYoYPct)}     [${fred.citationTag}]`);
  lines.push(`Federal Funds Rate:            ${fred.federalFundsRate !== null ? fred.federalFundsRate.toFixed(2) + '%' : 'N/A'}     [${fred.citationTag}]`);
  lines.push(`Unemployment Rate:             ${fred.unemploymentRate !== null ? fred.unemploymentRate.toFixed(1) + '%' : 'N/A'}     [${fred.citationTag}]`);
  lines.push(`Consumer Sentiment (UMich):    ${fred.consumerSentiment !== null ? fred.consumerSentiment.toFixed(1) : 'N/A'}     [${fred.citationTag}]`);
  lines.push(`30-Year Mortgage Rate:         ${fred.mortgage30yRate !== null ? fred.mortgage30yRate.toFixed(2) + '%' : 'N/A'}     [${fred.citationTag}]`);

  // BLS block
  if (bls) {
    const naicsLabel = BLS_NAICS_MAP[upperBT]?.label ?? upperBT;
    lines.push('');
    lines.push(`--- Industry Labor Data (${naicsLabel}, NAICS ${bls.naics}) ---`);
    lines.push(`Total Employment:              ${numFmt(bls.totalEmployment)} workers     [${bls.citationTag}]`);
    lines.push(`YoY Employment Change:         ${pctFmt(bls.yoyChangePct)}     [${bls.citationTag}]`);
    lines.push(`Average Weekly Wage:           ${numFmt(bls.avgWeeklyWage, '$')}     [${bls.citationTag}]`);
    lines.push(`Establishment Count:           ${numFmt(bls.establishments)} establishments     [${bls.citationTag}]`);
  }

  // SEC block
  if (sec?.comps?.length) {
    lines.push('');
    lines.push(`--- Public Comp Financials (${sec.businessType}) ---`);
    for (const comp of sec.comps) {
      lines.push(`${comp.companyName} (${comp.ticker}):   Revenue ${dollarFmt(comp.revenue)}, Op. Income ${dollarFmt(comp.operatingIncome)}, Op. Margin ${pctFmt(comp.operatingMarginPct)}     [${comp.citationTag}]`);
    }
    if (sec.avgOperatingMarginPct !== null) {
      lines.push(`Sector Avg Op. Margin:         ${pctFmt(sec.avgOperatingMarginPct)}     [SEC 10-K composite]`);
    }
  }

  lines.push('');
  lines.push('=== END ECONOMIC CONTEXT ===');

  return {
    text: lines.join('\n'),
    hasFred: true,
    hasBls: bls !== null,
    hasSec: sec !== null && (sec.comps?.length ?? 0) > 0,
    fred,
    bls,
    sec,
  };
}
