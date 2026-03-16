import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

interface EdgarFinancials {
  ticker: string;
  fiscalQuarter: string;
  fiscalYear: number;
  revenueTtm: number | null;
  revenueYoyPct: number | null;
  epsActual: number | null;
  totalEmployees: number | null;
  employeeYoyPct: number | null;
  operatingMargin: number | null;
  netIncomeTtm: number | null;
  capexTtm: number | null;
  freeCashFlowTtm: number | null;
}

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export class SecEdgarService {
  private readonly userAgent = 'JediRe/1.0 (contact@jedire.com)';

  async fetchAndStore(ticker: string): Promise<EdgarFinancials | null> {
    try {
      const cikResult = await this.lookupCIK(ticker);
      if (!cikResult) {
        logger.warn(`[SEC-EDGAR] Could not find CIK for ${ticker}`);
        return null;
      }

      const { cik, companyName } = cikResult;
      const facts = await this.fetchCompanyFacts(cik);
      if (!facts) return null;

      const financials = this.extractFinancials(ticker, facts);
      if (!financials) return null;

      const pool = getPool();
      await pool.query(
        `INSERT INTO corporate_financials
         (ticker, fiscal_quarter, fiscal_year, revenue_ttm, revenue_yoy_pct,
          eps_actual, total_employees, employee_yoy_pct, operating_margin,
          net_income_ttm, capex_ttm, free_cash_flow_ttm, data_source, filed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'sec_edgar', NOW())
         ON CONFLICT (ticker, fiscal_quarter) DO UPDATE SET
           revenue_ttm = EXCLUDED.revenue_ttm,
           revenue_yoy_pct = EXCLUDED.revenue_yoy_pct,
           eps_actual = EXCLUDED.eps_actual,
           total_employees = EXCLUDED.total_employees,
           employee_yoy_pct = EXCLUDED.employee_yoy_pct,
           operating_margin = EXCLUDED.operating_margin,
           net_income_ttm = EXCLUDED.net_income_ttm,
           capex_ttm = EXCLUDED.capex_ttm,
           free_cash_flow_ttm = EXCLUDED.free_cash_flow_ttm,
           filed_at = NOW()`,
        [
          financials.ticker, financials.fiscalQuarter, financials.fiscalYear,
          financials.revenueTtm, financials.revenueYoyPct,
          financials.epsActual, financials.totalEmployees, financials.employeeYoyPct,
          financials.operatingMargin, financials.netIncomeTtm,
          financials.capexTtm, financials.freeCashFlowTtm,
        ],
      );

      logger.info(`[SEC-EDGAR] Stored financials for ${ticker} (${financials.fiscalQuarter})`);
      return financials;
    } catch (err: any) {
      logger.error(`[SEC-EDGAR] Error fetching ${ticker}: ${err.message}`);
      return null;
    }
  }

  private async lookupCIK(ticker: string): Promise<{ cik: string; companyName: string } | null> {
    try {
      const resp = await fetch('https://efts.sec.gov/LATEST/search-index?q=' + encodeURIComponent(ticker) + '&dateRange=custom&startdt=2024-01-01&forms=10-K,10-Q', {
        headers: { 'User-Agent': this.userAgent },
      });
      if (!resp.ok) {
        const tickerResp = await fetch(`https://www.sec.gov/cgi-bin/browse-edgar?company=&CIK=${ticker}&type=10-K&dateb=&owner=include&count=1&search_text=&action=getcompany`, {
          headers: { 'User-Agent': this.userAgent },
          redirect: 'manual',
        });
        return null;
      }
    } catch {}

    try {
      const tickerMapResp = await fetch('https://www.sec.gov/files/company_tickers.json', {
        headers: { 'User-Agent': this.userAgent },
      });
      if (tickerMapResp.ok) {
        const tickerMap = await tickerMapResp.json();
        for (const key of Object.keys(tickerMap)) {
          const entry = tickerMap[key];
          if (entry.ticker?.toUpperCase() === ticker.toUpperCase()) {
            const cik = String(entry.cik_str).padStart(10, '0');
            return { cik, companyName: entry.title || ticker };
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[SEC-EDGAR] Ticker map fetch failed: ${err.message}`);
    }

    return null;
  }

  private async fetchCompanyFacts(cik: string): Promise<any | null> {
    try {
      const resp = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
        headers: { 'User-Agent': this.userAgent },
      });
      if (!resp.ok) {
        logger.warn(`[SEC-EDGAR] Company facts not found for CIK ${cik}`);
        return null;
      }
      return await resp.json();
    } catch (err: any) {
      logger.warn(`[SEC-EDGAR] Error fetching company facts: ${err.message}`);
      return null;
    }
  }

  private extractFinancials(ticker: string, facts: any): EdgarFinancials | null {
    const quarter = getCurrentQuarter();
    const year = new Date().getFullYear();

    const usGaap = facts?.facts?.['us-gaap'] || {};

    const getLatestValue = (concept: string): number | null => {
      const entries = usGaap[concept]?.units?.USD || usGaap[concept]?.units?.shares || usGaap[concept]?.units?.pure;
      if (!entries || entries.length === 0) return null;
      const sorted = [...entries].sort((a: any, b: any) =>
        new Date(b.end || b.filed || '2000-01-01').getTime() - new Date(a.end || a.filed || '2000-01-01').getTime()
      );
      return sorted[0]?.val ?? null;
    };

    const getYoYPct = (concept: string): number | null => {
      const entries = usGaap[concept]?.units?.USD || usGaap[concept]?.units?.shares;
      if (!entries || entries.length < 2) return null;
      const sorted = [...entries]
        .filter((e: any) => e.form === '10-K' || e.form === '10-Q')
        .sort((a: any, b: any) =>
          new Date(b.end || b.filed || '2000-01-01').getTime() - new Date(a.end || a.filed || '2000-01-01').getTime()
        );
      if (sorted.length < 2) return null;
      const current = sorted[0]?.val;
      const prior = sorted[1]?.val;
      if (!current || !prior || prior === 0) return null;
      return Math.round(((current - prior) / Math.abs(prior)) * 10000) / 100;
    };

    const revenue = getLatestValue('Revenues') || getLatestValue('RevenueFromContractWithCustomerExcludingAssessedTax') || getLatestValue('SalesRevenueNet');
    const netIncome = getLatestValue('NetIncomeLoss');
    const eps = getLatestValue('EarningsPerShareDiluted') || getLatestValue('EarningsPerShareBasic');
    const employees = getLatestValue('EntityNumberOfEmployees') || (facts?.facts?.dei?.EntityNumberOfEmployees?.units?.employees?.[0]?.val ?? null);
    const capex = getLatestValue('PaymentsToAcquirePropertyPlantAndEquipment');
    const opIncome = getLatestValue('OperatingIncomeLoss');

    const revenueYoy = getYoYPct('Revenues') || getYoYPct('RevenueFromContractWithCustomerExcludingAssessedTax');
    const employeeYoy = getYoYPct('EntityNumberOfEmployees');

    let operatingMargin: number | null = null;
    if (revenue && opIncome && revenue !== 0) {
      operatingMargin = Math.round((opIncome / revenue) * 10000) / 100;
    }

    return {
      ticker,
      fiscalQuarter: quarter,
      fiscalYear: year,
      revenueTtm: revenue ? Math.round(revenue) : null,
      revenueYoyPct: revenueYoy,
      epsActual: eps,
      totalEmployees: employees ? Math.round(employees) : null,
      employeeYoyPct: employeeYoy,
      operatingMargin,
      netIncomeTtm: netIncome ? Math.round(netIncome) : null,
      capexTtm: capex ? Math.round(capex) : null,
      freeCashFlowTtm: null,
    };
  }

  async getLatestFinancials(ticker: string): Promise<any | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM corporate_financials
       WHERE ticker = $1 ORDER BY fiscal_quarter DESC LIMIT 5`,
      [ticker],
    );
    return result.rows;
  }
}

export const secEdgarService = new SecEdgarService();
