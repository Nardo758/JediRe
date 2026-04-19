/**
 * Bureau of Labor Statistics (BLS) API Client
 * Fetches QCEW industry labor data by NAICS code:
 * total employment, YoY employment change, average weekly wage, establishment count.
 *
 * Docs: https://www.bls.gov/developers/api_signature_v2.htm
 * Free tier: 500 queries/day, requires registration key (BLS_API_KEY)
 */

import axios from 'axios';

export interface BLSSeriesData {
  seriesID: string;
  data: BLSDataPoint[];
}

export interface BLSDataPoint {
  year: string;
  period: string;   // e.g. "A01" = annual, "Q01"–"Q04" = quarters
  value: string;
  footnotes: { code: string; text: string }[];
}

export interface BLSMultiSeriesResponse {
  status: string;
  responseTime: number;
  message: string[];
  Results: { series: BLSSeriesData[] };
}

// ─── NAICS → QCEW series ID helpers ──────────────────────────────────────────
// QCEW series format:
//   ENUCXXXXXXXX[X]A  (annual, US total)
//   First 10 chars after ENUC = FIPS area (00000 = US) + industry (NAICS 2–6 digit)
//   area_code: 00000 = national; state/county FIPS also valid
//   Measure codes:
//     1 = all employees (thousands)
//     4 = average weekly wages
//     5 = number of establishments
//   Seasonal: U = unadjusted

export const BLS_NAICS_MAP: Record<string, { naics: string; label: string }> = {
  SELF_STORAGE:    { naics: '531130', label: 'Self Storage' },
  APARTMENT:       { naics: '531110', label: 'Apartment / Lessors of Residential Buildings' },
  OFFICE:          { naics: '531120', label: 'Lessors of Nonresidential Buildings' },
  RETAIL:          { naics: '441000', label: 'Retail Trade' },
  INDUSTRIAL:      { naics: '493100', label: 'Warehousing & Storage' },
  HOTEL:           { naics: '721100', label: 'Hotels & Motels' },
  HEALTHCARE:      { naics: '620000', label: 'Health Care & Social Assistance' },
  SENIOR_HOUSING:  { naics: '623100', label: 'Nursing & Residential Care Facilities' },
  STUDENT_HOUSING: { naics: '611000', label: 'Educational Services' },
};

// Build a QCEW series ID for national data
// measure: 1=employment, 4=avg weekly wages, 5=establishments
function buildQCEWSeries(naics: string, measure: '1' | '4' | '5'): string {
  // QCEW series: ENU + area_fips(5) + size_code(1) + ownership(1) + industry(6 pad) + data_type(2)
  // area 00000 = US national, size 0 = all, ownership 5 = private, data_type 01/04/05
  const paddedNaics = naics.padEnd(6, '0').substring(0, 6);
  const dataType = measure === '1' ? '01' : measure === '4' ? '04' : '05';
  return `ENU000005${paddedNaics}${dataType}`;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class BLSApiClient {
  private apiKey: string;
  private baseURL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BLS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[BLS] BLS_API_KEY not set — requests will be rate-limited (25/day)');
    }
  }

  /**
   * Fetch one or more series for a date range (annual or quarterly)
   */
  async getMultipleSeries(
    seriesIds: string[],
    startYear: number,
    endYear: number,
  ): Promise<BLSSeriesData[]> {
    try {
      const body: Record<string, any> = {
        seriesid: seriesIds,
        startyear: String(startYear),
        endyear: String(endYear),
        calculations: true,
        annualaverage: true,
      };
      if (this.apiKey) body.registrationkey = this.apiKey;

      const response = await axios.post<BLSMultiSeriesResponse>(this.baseURL, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      if (response.data.status !== 'REQUEST_SUCCEEDED') {
        throw new Error(`BLS API error: ${response.data.message?.join(', ')}`);
      }

      return response.data.Results?.series ?? [];
    } catch (err: any) {
      console.error('[BLS] getMultipleSeries failed:', err.message);
      throw err;
    }
  }

  /**
   * Get latest annual employment data for a NAICS code.
   * Returns: { totalEmployment, yoyChangePct, avgWeeklyWage, establishments, quarter, year }
   */
  async getLaborSnapshot(naics: string, year?: number): Promise<LaborSnapshot | null> {
    const targetYear = year || new Date().getFullYear() - 1; // QCEW lags ~6 months
    const startYear = targetYear - 1;

    const empSeries   = buildQCEWSeries(naics, '1');
    const wageSeries  = buildQCEWSeries(naics, '4');
    const estabSeries = buildQCEWSeries(naics, '5');

    try {
      const results = await this.getMultipleSeries(
        [empSeries, wageSeries, estabSeries],
        startYear,
        targetYear,
      );

      const findLatest = (seriesId: string): BLSDataPoint | null => {
        const series = results.find(s => s.seriesID === seriesId);
        if (!series?.data?.length) return null;
        return series.data.sort((a, b) => {
          const ay = parseInt(a.year) * 100 + parseInt(a.period.replace(/\D/g, '') || '0');
          const by = parseInt(b.year) * 100 + parseInt(b.period.replace(/\D/g, '') || '0');
          return by - ay;
        })[0];
      };

      const findYear = (seriesId: string, yr: number): BLSDataPoint | null => {
        const series = results.find(s => s.seriesID === seriesId);
        if (!series?.data?.length) return null;
        return series.data.find(d => d.year === String(yr) && d.period === 'A01') ?? null;
      };

      const latestEmp   = findLatest(empSeries);
      const prevEmp     = findYear(empSeries, startYear);
      const latestWage  = findLatest(wageSeries);
      const latestEstab = findLatest(estabSeries);

      if (!latestEmp) return null;

      const emp     = parseFloat(latestEmp.value) * 1000; // BLS reports in thousands
      const prevEmpVal = prevEmp ? parseFloat(prevEmp.value) * 1000 : null;
      const yoyChangePct = prevEmpVal && prevEmpVal > 0
        ? ((emp - prevEmpVal) / prevEmpVal) * 100
        : null;

      return {
        naics,
        year: parseInt(latestEmp.year),
        period: latestEmp.period,
        totalEmployment: emp,
        yoyChangePct,
        avgWeeklyWage: latestWage ? parseFloat(latestWage.value) : null,
        establishments: latestEstab ? parseInt(latestEstab.value) : null,
        citationTag: `BLS QCEW ${latestEmp.year}`,
      };
    } catch (err: any) {
      console.warn(`[BLS] getLaborSnapshot failed for NAICS ${naics}:`, err.message);
      return null;
    }
  }
}

export interface LaborSnapshot {
  naics: string;
  year: number;
  period: string;
  totalEmployment: number;
  yoyChangePct: number | null;
  avgWeeklyWage: number | null;
  establishments: number | null;
  citationTag: string;
}

export const blsApiClient = new BLSApiClient();
