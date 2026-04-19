/**
 * SEC-API.io Client
 * Fetches parsed 10-K / 10-Q financials for public comps by ticker symbol.
 * Extracts: revenue, operating income, operating margin.
 *
 * Docs: https://sec-api.io/docs
 * Pricing: $49/mo — requires SEC_API_KEY environment variable.
 *
 * Endpoint used: Query API (full-text + XBRL financial data)
 * XBRL: https://data.sec.gov/api/xbrl/companyfacts/{CIK}.json (free, no key needed)
 * We use sec-api.io for normalized, ticker-based lookup.
 */

import axios from 'axios';

// ─── Ticker map: business type → public comps ─────────────────────────────────
export const SEC_COMP_TICKERS: Record<string, { ticker: string; name: string }[]> = {
  SELF_STORAGE:    [
    { ticker: 'PSA',  name: 'Public Storage' },
    { ticker: 'EXR',  name: 'Extra Space Storage' },
    { ticker: 'CUBE', name: 'CubeSmart' },
  ],
  APARTMENT:       [
    { ticker: 'AVB',  name: 'AvalonBay Communities' },
    { ticker: 'EQR',  name: 'Equity Residential' },
    { ticker: 'MAA',  name: 'Mid-America Apartment' },
  ],
  OFFICE:          [
    { ticker: 'BXP',  name: 'Boston Properties' },
    { ticker: 'VNO',  name: 'Vornado Realty' },
    { ticker: 'SLG',  name: 'SL Green Realty' },
  ],
  RETAIL:          [
    { ticker: 'SPG',  name: 'Simon Property Group' },
    { ticker: 'REG',  name: 'Regency Centers' },
    { ticker: 'KIM',  name: 'Kimco Realty' },
  ],
  INDUSTRIAL:      [
    { ticker: 'PLD',  name: 'Prologis' },
    { ticker: 'DRE',  name: 'Duke Realty' },
    { ticker: 'EGP',  name: 'EastGroup Properties' },
  ],
  HOTEL:           [
    { ticker: 'HST',  name: 'Host Hotels & Resorts' },
    { ticker: 'PK',   name: 'Park Hotels & Resorts' },
    { ticker: 'RLJ',  name: 'RLJ Lodging Trust' },
  ],
  HEALTHCARE:      [
    { ticker: 'WELL', name: 'Welltower' },
    { ticker: 'VTR',  name: 'Ventas' },
    { ticker: 'HR',   name: 'Healthcare Realty' },
  ],
  SENIOR_HOUSING:  [
    { ticker: 'WELL', name: 'Welltower' },
    { ticker: 'VTR',  name: 'Ventas' },
  ],
  STUDENT_HOUSING: [
    { ticker: 'ACC',  name: 'American Campus Communities' },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecFilingFinancials {
  ticker: string;
  companyName: string;
  filingType: '10-K' | '10-Q';
  filingYear: number;
  filingQuarter?: number;
  revenue: number | null;           // USD
  operatingIncome: number | null;   // USD
  operatingMarginPct: number | null;
  citationTag: string;             // e.g. "SEC 10-K FY2024"
}

export interface SecCompSnapshot {
  businessType: string;
  comps: SecFilingFinancials[];
  avgOperatingMarginPct: number | null;
  medianRevenue: number | null;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class SecApiClient {
  private apiKey: string;
  private baseURL = 'https://api.sec-api.io';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SEC_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[SEC-API] SEC_API_KEY not set — financial comp data unavailable');
    }
  }

  /**
   * Fetch latest annual (10-K) financials for a single ticker.
   * Uses the XBRL-to-JSON API from sec-api.io.
   */
  async getLatestAnnual(ticker: string, companyName: string): Promise<SecFilingFinancials | null> {
    if (!this.apiKey) return null;
    try {
      // Query latest 10-K filing via sec-api.io
      const queryUrl = `${this.baseURL}/query`;
      const response = await axios.post(
        queryUrl,
        {
          query: {
            query_string: {
              query: `ticker:${ticker} AND formType:"10-K"`,
            },
          },
          from: '0',
          size: '1',
          sort: [{ filedAt: { order: 'desc' } }],
        },
        {
          headers: {
            Authorization: this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const filings = response.data?.filings ?? [];
      if (!filings.length) return null;

      const filing = filings[0];
      const filedAt = new Date(filing.filedAt || filing.periodOfReport || '');
      const filingYear = isNaN(filedAt.getTime()) ? new Date().getFullYear() - 1 : filedAt.getFullYear();

      // Fetch XBRL financials for the specific CIK
      const cik = filing.cik?.replace(/^0+/, '') ?? null;
      if (!cik) return null;

      const xbrlUrl = `${this.baseURL}/xbrl/companyfacts`;
      const xbrlRes = await axios.get(xbrlUrl, {
        params: { ticker, token: this.apiKey },
        timeout: 15000,
      });

      const facts = xbrlRes.data?.facts ?? {};
      const us_gaap = facts['us-gaap'] ?? {};

      const extractLatestAnnual = (conceptKey: string): number | null => {
        const concept = us_gaap[conceptKey];
        if (!concept?.units?.USD) return null;
        const annualEntries = concept.units.USD.filter(
          (e: any) => e.form === '10-K' && e.frame?.startsWith(`CY${filingYear}`),
        );
        if (!annualEntries.length) {
          // Fallback: most recent 10-K entry
          const sorted = concept.units.USD
            .filter((e: any) => e.form === '10-K')
            .sort((a: any, b: any) => new Date(b.end).getTime() - new Date(a.end).getTime());
          return sorted[0]?.val ?? null;
        }
        return annualEntries[0].val;
      };

      const revenue        = extractLatestAnnual('Revenues') ?? extractLatestAnnual('RevenueFromContractWithCustomerExcludingAssessedTax');
      const operatingIncome = extractLatestAnnual('OperatingIncomeLoss');
      const operatingMarginPct = (revenue && operatingIncome !== null && revenue > 0)
        ? (operatingIncome / revenue) * 100
        : null;

      return {
        ticker,
        companyName,
        filingType: '10-K',
        filingYear,
        revenue,
        operatingIncome,
        operatingMarginPct,
        citationTag: `SEC 10-K FY${filingYear}`,
      };
    } catch (err: any) {
      console.warn(`[SEC-API] getLatestAnnual failed for ${ticker}:`, err.message);
      return null;
    }
  }

  /**
   * Get comp snapshot for a business type: fetch top 3 tickers, compute averages.
   */
  async getCompSnapshot(businessType: string): Promise<SecCompSnapshot | null> {
    const compsConfig = SEC_COMP_TICKERS[businessType];
    if (!compsConfig?.length) return null;

    // Limit to top 2 to keep latency reasonable
    const top2 = compsConfig.slice(0, 2);
    const results = await Promise.all(
      top2.map(c => this.getLatestAnnual(c.ticker, c.name)),
    );

    const comps = results.filter((r): r is SecFilingFinancials => r !== null);
    if (!comps.length) return null;

    const margins = comps.map(c => c.operatingMarginPct).filter((m): m is number => m !== null);
    const revenues = comps.map(c => c.revenue).filter((r): r is number => r !== null).sort((a, b) => a - b);

    const avgOperatingMarginPct = margins.length
      ? margins.reduce((sum, m) => sum + m, 0) / margins.length
      : null;
    const medianRevenue = revenues.length
      ? revenues[Math.floor(revenues.length / 2)]
      : null;

    return { businessType, comps, avgOperatingMarginPct, medianRevenue };
  }
}

export const secApiClient = new SecApiClient();
