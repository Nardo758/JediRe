import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { yahooFinanceService } from './yahoo-finance.service';
import { secEdgarService } from './sec-edgar.service';
import { employerConcentrationService } from './employer-concentration.service';

const CHS_WEIGHTS = {
  revenueMomentum: 0.25,
  earningsTrajectory: 0.20,
  headcountSignal: 0.25,
  guidanceSentiment: 0.15,
  stockMomentum: 0.15,
};

export interface CHSResult {
  ticker: string;
  quarter: string;
  components: {
    revenueMomentum: number;
    earningsTrajectory: number;
    headcountSignal: number;
    guidanceSentiment: number;
    stockMomentum: number;
  };
  compositeCHS: number;
  healthTier: 'healthy' | 'watch' | 'stress';
  deltaQoQ: number;
}

export interface SCHIResult {
  submarketId: number;
  quarter: string;
  schiScore: number;
  schiDeltaQoQ: number;
  reHealthScore: number;
  divergenceScore: number;
  divergenceSignal: 'bullish_divergence' | 'bearish_divergence' | 'aligned';
  herfindahlIndex: number;
  top5Share: number;
  publicCoverage: number;
  employerCount: number;
  publicEmployerCount: number;
  sectorBreakdown: Record<string, number>;
}

function normalizeToScale(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

function getPriorQuarter(quarter: string): string {
  const [y, qStr] = quarter.split('-Q');
  const q = parseInt(qStr);
  if (q === 1) return `${parseInt(y) - 1}-Q4`;
  return `${y}-Q${q - 1}`;
}

export class CorporateHealthService {
  async computeCHS(ticker: string, quarter?: string): Promise<CHSResult> {
    const pool = getPool();
    const q = quarter || getCurrentQuarter();

    const financials = await pool.query(
      `SELECT * FROM corporate_financials
       WHERE ticker = $1 ORDER BY fiscal_quarter DESC LIMIT 5`,
      [ticker],
    );

    const latestStock = await pool.query(
      `SELECT * FROM corporate_stock_prices
       WHERE ticker = $1 ORDER BY price_date DESC LIMIT 1`,
      [ticker],
    );

    const revenueMomentum = this.computeRevenueMomentum(financials.rows);
    const earningsTrajectory = this.computeEarningsTrajectory(financials.rows);
    const headcountSignal = this.computeHeadcountSignal(financials.rows);
    const guidanceSentiment = this.computeGuidanceSentiment(financials.rows);
    const stockMomentum = latestStock.rows[0]?.stock_momentum_score
      ? parseFloat(latestStock.rows[0].stock_momentum_score)
      : 50;

    const compositeCHS =
      revenueMomentum * CHS_WEIGHTS.revenueMomentum +
      earningsTrajectory * CHS_WEIGHTS.earningsTrajectory +
      headcountSignal * CHS_WEIGHTS.headcountSignal +
      guidanceSentiment * CHS_WEIGHTS.guidanceSentiment +
      stockMomentum * CHS_WEIGHTS.stockMomentum;

    const healthTier: 'healthy' | 'watch' | 'stress' =
      compositeCHS >= 70 ? 'healthy' : compositeCHS >= 40 ? 'watch' : 'stress';

    const priorQ = getPriorQuarter(q);
    const priorResult = await pool.query(
      `SELECT composite_chs FROM corporate_health_scores
       WHERE ticker = $1 AND quarter = $2`,
      [ticker, priorQ],
    );
    const priorCHS = priorResult.rows[0]?.composite_chs
      ? parseFloat(priorResult.rows[0].composite_chs)
      : null;
    const deltaQoQ = priorCHS !== null ? Math.round((compositeCHS - priorCHS) * 100) / 100 : 0;

    await pool.query(
      `INSERT INTO corporate_health_scores
       (ticker, quarter, revenue_momentum, earnings_trajectory, headcount_signal,
        guidance_sentiment, stock_momentum, composite_chs, chs_delta_qoq, health_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (ticker, quarter) DO UPDATE SET
         revenue_momentum = EXCLUDED.revenue_momentum,
         earnings_trajectory = EXCLUDED.earnings_trajectory,
         headcount_signal = EXCLUDED.headcount_signal,
         guidance_sentiment = EXCLUDED.guidance_sentiment,
         stock_momentum = EXCLUDED.stock_momentum,
         composite_chs = EXCLUDED.composite_chs,
         chs_delta_qoq = EXCLUDED.chs_delta_qoq,
         health_tier = EXCLUDED.health_tier,
         computed_at = NOW()`,
      [
        ticker, q,
        Math.round(revenueMomentum * 100) / 100,
        Math.round(earningsTrajectory * 100) / 100,
        Math.round(headcountSignal * 100) / 100,
        Math.round(guidanceSentiment * 100) / 100,
        Math.round(stockMomentum * 100) / 100,
        Math.round(compositeCHS * 100) / 100,
        deltaQoQ,
        healthTier,
      ],
    );

    logger.info(`[CorporateHealth] CHS for ${ticker} (${q}): ${compositeCHS.toFixed(1)} [${healthTier}]`);

    return {
      ticker,
      quarter: q,
      components: {
        revenueMomentum: Math.round(revenueMomentum * 100) / 100,
        earningsTrajectory: Math.round(earningsTrajectory * 100) / 100,
        headcountSignal: Math.round(headcountSignal * 100) / 100,
        guidanceSentiment: Math.round(guidanceSentiment * 100) / 100,
        stockMomentum: Math.round(stockMomentum * 100) / 100,
      },
      compositeCHS: Math.round(compositeCHS * 100) / 100,
      healthTier,
      deltaQoQ,
    };
  }

  async computeSCHI(submarketId: number, quarter?: string): Promise<SCHIResult> {
    const pool = getPool();
    const q = quarter || getCurrentQuarter();

    const employers = await pool.query(
      `SELECT se.ticker, se.employment_share, se.is_public,
              chs.composite_chs, chs.health_tier
       FROM submarket_employers se
       LEFT JOIN corporate_health_scores chs ON se.ticker = chs.ticker AND chs.quarter = $2
       WHERE se.submarket_id = $1`,
      [submarketId, q],
    );

    const concentration = await employerConcentrationService.computeConcentration(submarketId);

    let weightedSum = 0;
    let totalPublicShare = 0;

    for (const emp of employers.rows) {
      if (emp.is_public && emp.composite_chs !== null) {
        const share = parseFloat(emp.employment_share) || 0;
        const chs = parseFloat(emp.composite_chs);
        weightedSum += chs * share;
        totalPublicShare += share;
      }
    }

    const publicAdjustment = totalPublicShare > 0 ? 1 / totalPublicShare : 1;
    const schiScore = totalPublicShare > 0
      ? Math.round(weightedSum * publicAdjustment * 100) / 100
      : 50;

    const priorQ = getPriorQuarter(q);
    const priorResult = await pool.query(
      `SELECT schi_score FROM submarket_corporate_health
       WHERE submarket_id = $1 AND quarter = $2`,
      [submarketId, priorQ],
    );
    const priorSCHI = priorResult.rows[0]?.schi_score
      ? parseFloat(priorResult.rows[0].schi_score)
      : null;
    const schiDelta = priorSCHI !== null ? Math.round((schiScore - priorSCHI) * 100) / 100 : 0;

    const reHealthScore = await this.computeREHealth(submarketId);
    const divergenceScore = Math.round((schiScore - reHealthScore) * 100) / 100;

    let divergenceSignal: 'bullish_divergence' | 'bearish_divergence' | 'aligned';
    if (divergenceScore > 15) divergenceSignal = 'bullish_divergence';
    else if (divergenceScore < -15) divergenceSignal = 'bearish_divergence';
    else divergenceSignal = 'aligned';

    await pool.query(
      `INSERT INTO submarket_corporate_health
       (submarket_id, quarter, schi_score, schi_delta_qoq, re_health_score,
        divergence_score, divergence_signal, herfindahl_index, top_5_share,
        public_coverage, employer_count, public_employer_count, sector_breakdown)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (submarket_id, quarter) DO UPDATE SET
         schi_score = EXCLUDED.schi_score,
         schi_delta_qoq = EXCLUDED.schi_delta_qoq,
         re_health_score = EXCLUDED.re_health_score,
         divergence_score = EXCLUDED.divergence_score,
         divergence_signal = EXCLUDED.divergence_signal,
         herfindahl_index = EXCLUDED.herfindahl_index,
         top_5_share = EXCLUDED.top_5_share,
         public_coverage = EXCLUDED.public_coverage,
         employer_count = EXCLUDED.employer_count,
         public_employer_count = EXCLUDED.public_employer_count,
         sector_breakdown = EXCLUDED.sector_breakdown,
         computed_at = NOW()`,
      [
        submarketId, q, schiScore, schiDelta, reHealthScore,
        divergenceScore, divergenceSignal,
        concentration.herfindahlIndex, concentration.top5Share,
        concentration.publicCompanyCoverage,
        concentration.employerCount, concentration.publicEmployerCount,
        JSON.stringify(concentration.sectorBreakdown),
      ],
    );

    logger.info(`[CorporateHealth] SCHI for submarket ${submarketId} (${q}): ${schiScore.toFixed(1)}, divergence=${divergenceScore.toFixed(1)} [${divergenceSignal}]`);

    return {
      submarketId,
      quarter: q,
      schiScore,
      schiDeltaQoQ: schiDelta,
      reHealthScore,
      divergenceScore,
      divergenceSignal,
      herfindahlIndex: concentration.herfindahlIndex,
      top5Share: concentration.top5Share,
      publicCoverage: concentration.publicCompanyCoverage,
      employerCount: concentration.employerCount,
      publicEmployerCount: concentration.publicEmployerCount,
      sectorBreakdown: concentration.sectorBreakdown,
    };
  }

  async refreshTicker(ticker: string): Promise<CHSResult> {
    await yahooFinanceService.fetchAndStore(ticker);
    await secEdgarService.fetchAndStore(ticker);
    return this.computeCHS(ticker);
  }

  async getCompanyDetail(ticker: string): Promise<any> {
    const pool = getPool();

    const scores = await pool.query(
      `SELECT * FROM corporate_health_scores
       WHERE ticker = $1 ORDER BY quarter DESC LIMIT 8`,
      [ticker],
    );

    const financials = await pool.query(
      `SELECT * FROM corporate_financials
       WHERE ticker = $1 ORDER BY fiscal_quarter DESC LIMIT 5`,
      [ticker],
    );

    const facilities = await pool.query(
      `SELECT * FROM corporate_facility_events
       WHERE ticker = $1 ORDER BY announced_at DESC LIMIT 20`,
      [ticker],
    );

    const stock = await pool.query(
      `SELECT * FROM corporate_stock_prices
       WHERE ticker = $1 ORDER BY price_date DESC LIMIT 1`,
      [ticker],
    );

    const latest = scores.rows[0];

    return {
      ticker,
      chs: latest ? {
        composite: parseFloat(latest.composite_chs),
        tier: latest.health_tier,
        deltaQoQ: parseFloat(latest.chs_delta_qoq),
        quarter: latest.quarter,
      } : null,
      components: latest ? {
        revenueMomentum: parseFloat(latest.revenue_momentum),
        earningsTrajectory: parseFloat(latest.earnings_trajectory),
        headcountSignal: parseFloat(latest.headcount_signal),
        guidanceSentiment: parseFloat(latest.guidance_sentiment),
        stockMomentum: parseFloat(latest.stock_momentum),
      } : null,
      history: scores.rows.map((r: any) => ({
        quarter: r.quarter,
        chs: parseFloat(r.composite_chs),
        tier: r.health_tier,
        delta: parseFloat(r.chs_delta_qoq),
      })),
      financials: financials.rows,
      facilities: facilities.rows,
      stock: stock.rows[0] || null,
    };
  }

  async getDealOverlay(dealId: string): Promise<any> {
    const pool = getPool();

    const dealResult = await pool.query(
      `SELECT d.id, d.name, d.city, d.state,
              COALESCE(
                (SELECT s.id FROM submarkets s
                 WHERE ST_Contains(s.geometry, ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326))
                 LIMIT 1),
                (SELECT s.id FROM submarkets s
                 JOIN msas m ON s.msa_id = m.id
                 WHERE LOWER(m.name) LIKE '%' || LOWER(d.city) || '%'
                 LIMIT 1)
              ) as submarket_id
       FROM deals d WHERE d.id = $1`,
      [dealId],
    );

    if (dealResult.rows.length === 0) {
      return { error: 'Deal not found' };
    }

    const deal = dealResult.rows[0];
    const submarketId = deal.submarket_id;

    if (!submarketId) {
      return {
        dealId,
        dealName: deal.name,
        submarkets: [],
        weightedSCHI: null,
        divergence: null,
        topEmployers: [],
        message: 'No submarket mapping found for this deal',
      };
    }

    const q = getCurrentQuarter();
    const health = await pool.query(
      `SELECT * FROM submarket_corporate_health
       WHERE submarket_id = $1 ORDER BY quarter DESC LIMIT 4`,
      [submarketId],
    );

    const employers = await employerConcentrationService.getEmployers(submarketId);
    const topEmployers = employers.slice(0, 5);

    const latest = health.rows[0];

    return {
      dealId,
      dealName: deal.name,
      submarkets: [{
        submarketId,
        schi: latest ? parseFloat(latest.schi_score) : null,
        divergence: latest ? parseFloat(latest.divergence_score) : null,
        signal: latest?.divergence_signal || 'aligned',
        quarter: latest?.quarter,
      }],
      weightedSCHI: latest ? parseFloat(latest.schi_score) : null,
      divergence: latest ? parseFloat(latest.divergence_score) : null,
      topEmployers: topEmployers.map((e: any) => ({
        company: e.company_name,
        ticker: e.ticker,
        chs: e.composite_chs ? parseFloat(e.composite_chs) : null,
        tier: e.health_tier,
        share: parseFloat(e.employment_share),
      })),
      trend: health.rows.map((r: any) => ({
        quarter: r.quarter,
        schi: parseFloat(r.schi_score),
        divergence: parseFloat(r.divergence_score),
      })),
    };
  }

  async getPortfolioDivergence(): Promise<any> {
    const pool = getPool();
    const q = getCurrentQuarter();

    const result = await pool.query(
      `SELECT sch.submarket_id, s.name as submarket_name, m.name as msa_name,
              sch.schi_score, sch.divergence_score, sch.divergence_signal,
              sch.re_health_score, sch.herfindahl_index, sch.top_5_share,
              sch.employer_count, sch.public_employer_count
       FROM submarket_corporate_health sch
       JOIN submarkets s ON sch.submarket_id = s.id
       LEFT JOIN msas m ON s.msa_id = m.id
       WHERE sch.quarter = $1
       ORDER BY ABS(sch.divergence_score) DESC`,
      [q],
    );

    const topEmployers = await pool.query(
      `SELECT se.company_name, se.ticker, se.estimated_local_employees,
              se.employment_share, se.submarket_id, s.name as submarket_name,
              chs.composite_chs, chs.health_tier, chs.chs_delta_qoq, se.naics_code
       FROM submarket_employers se
       JOIN submarkets s ON se.submarket_id = s.id
       LEFT JOIN corporate_health_scores chs ON se.ticker = chs.ticker
         AND chs.quarter = $1
       WHERE se.is_public = true
       ORDER BY se.estimated_local_employees DESC NULLS LAST
       LIMIT 10`,
      [q],
    );

    return {
      submarkets: result.rows.map((r: any) => ({
        submarketId: r.submarket_id,
        name: r.submarket_name,
        msa: r.msa_name,
        schi: parseFloat(r.schi_score || '0'),
        divergence: parseFloat(r.divergence_score || '0'),
        signal: r.divergence_signal,
        reHealth: parseFloat(r.re_health_score || '0'),
        hhi: parseFloat(r.herfindahl_index || '0'),
        top5Share: parseFloat(r.top_5_share || '0'),
        employerCount: parseInt(r.employer_count || '0'),
        publicCount: parseInt(r.public_employer_count || '0'),
      })),
      topEmployers: topEmployers.rows.map((r: any) => ({
        company: r.company_name,
        ticker: r.ticker,
        employees: r.estimated_local_employees,
        share: parseFloat(r.employment_share || '0'),
        submarket: r.submarket_name,
        chs: r.composite_chs ? parseFloat(r.composite_chs) : null,
        tier: r.health_tier,
        delta: r.chs_delta_qoq ? parseFloat(r.chs_delta_qoq) : null,
        naics: r.naics_code,
      })),
      quarter: q,
    };
  }

  async getSectorRotation(): Promise<any> {
    const pool = getPool();
    const q = getCurrentQuarter();

    const result = await pool.query(
      `SELECT se.naics_code, s.name as submarket_name, s.msa_id,
              m.name as msa_name,
              AVG(chs.composite_chs) as avg_chs,
              COUNT(*) as employer_count
       FROM submarket_employers se
       JOIN submarkets s ON se.submarket_id = s.id
       LEFT JOIN msas m ON s.msa_id = m.id
       LEFT JOIN corporate_health_scores chs ON se.ticker = chs.ticker AND chs.quarter = $1
       WHERE se.is_public = true AND se.naics_code IS NOT NULL
       GROUP BY se.naics_code, s.name, s.msa_id, m.name
       ORDER BY se.naics_code, m.name`,
      [q],
    );

    const sectors = new Map<string, any>();
    const markets = new Set<string>();

    for (const row of result.rows) {
      const naics2 = row.naics_code?.substring(0, 2) || 'XX';
      const market = row.msa_name || row.submarket_name;
      markets.add(market);

      if (!sectors.has(naics2)) {
        sectors.set(naics2, { naics: naics2, markets: {} });
      }
      sectors.get(naics2).markets[market] = {
        avgCHS: row.avg_chs ? parseFloat(row.avg_chs) : null,
        count: parseInt(row.employer_count),
      };
    }

    return {
      sectors: Array.from(sectors.values()),
      markets: Array.from(markets),
      quarter: q,
    };
  }

  async getAlerts(): Promise<any[]> {
    const pool = getPool();

    const divergenceAlerts = await pool.query(
      `SELECT sch.*, s.name as submarket_name, m.name as msa_name
       FROM submarket_corporate_health sch
       JOIN submarkets s ON sch.submarket_id = s.id
       LEFT JOIN msas m ON s.msa_id = m.id
       WHERE ABS(sch.divergence_score) > 15
       ORDER BY ABS(sch.divergence_score) DESC
       LIMIT 20`,
    );

    const stressAlerts = await pool.query(
      `SELECT chs.ticker, chs.composite_chs, chs.chs_delta_qoq, chs.health_tier, chs.quarter,
              se.company_name, se.employment_share, se.submarket_id,
              s.name as submarket_name
       FROM corporate_health_scores chs
       JOIN submarket_employers se ON chs.ticker = se.ticker
       JOIN submarkets s ON se.submarket_id = s.id
       WHERE chs.chs_delta_qoq < -15 AND se.employment_share > 0.05
       ORDER BY chs.chs_delta_qoq ASC
       LIMIT 10`,
    );

    const alerts: any[] = [];

    for (const row of divergenceAlerts.rows) {
      alerts.push({
        type: row.divergence_signal === 'bullish_divergence' ? 'BULLISH_DIVERGENCE' : 'BEARISH_DIVERGENCE',
        submarket: row.submarket_name,
        msa: row.msa_name,
        submarketId: row.submarket_id,
        signal: row.divergence_signal,
        magnitude: Math.abs(parseFloat(row.divergence_score)),
        schi: parseFloat(row.schi_score),
        reHealth: parseFloat(row.re_health_score),
        divergence: parseFloat(row.divergence_score),
        quarter: row.quarter,
      });
    }

    for (const row of stressAlerts.rows) {
      alerts.push({
        type: 'EMPLOYER_STRESS',
        company: row.company_name,
        ticker: row.ticker,
        submarket: row.submarket_name,
        submarketId: row.submarket_id,
        chs: parseFloat(row.composite_chs),
        chsDelta: parseFloat(row.chs_delta_qoq),
        employmentShare: parseFloat(row.employment_share),
        quarter: row.quarter,
      });
    }

    return alerts;
  }

  async getCorporateRiskExposure(submarketId: number): Promise<number> {
    const pool = getPool();
    const concentration = await employerConcentrationService.computeConcentration(submarketId);

    const minCHS = await pool.query(
      `SELECT MIN(chs.composite_chs) as min_chs
       FROM submarket_employers se
       JOIN corporate_health_scores chs ON se.ticker = chs.ticker
       WHERE se.submarket_id = $1 AND se.employment_share > 0.03`,
      [submarketId],
    );

    const minCHSVal = minCHS.rows[0]?.min_chs ? parseFloat(minCHS.rows[0].min_chs) : 50;
    const herfNormalized = Math.min(1, concentration.herfindahlIndex / 0.25);
    const riskScore = herfNormalized * (1 - minCHSVal / 100) * 100;

    return Math.round(riskScore * 100) / 100;
  }

  private async computeREHealth(submarketId: number): Promise<number> {
    const pool = getPool();

    const submarket = await pool.query(
      `SELECT avg_occupancy, avg_rent, avg_cap_rate FROM submarkets WHERE id = $1`,
      [submarketId],
    );

    if (submarket.rows.length === 0) return 50;

    const s = submarket.rows[0];
    const occupancy = s.avg_occupancy ? parseFloat(s.avg_occupancy) : null;
    const capRate = s.avg_cap_rate ? parseFloat(s.avg_cap_rate) : null;

    const scores: number[] = [];

    if (occupancy !== null) {
      scores.push(normalizeToScale(occupancy, 80, 98));
    }

    if (capRate !== null) {
      scores.push(normalizeToScale(100 - capRate, 90, 97));
    }

    const marketData = await pool.query(
      `SELECT rent_growth_yoy, absorption_rate FROM market_vitals
       WHERE submarket_id = $1 ORDER BY snapshot_date DESC LIMIT 1`,
      [submarketId],
    );

    if (marketData.rows.length > 0) {
      const mv = marketData.rows[0];
      if (mv.rent_growth_yoy !== null) {
        scores.push(normalizeToScale(parseFloat(mv.rent_growth_yoy), -5, 10));
      }
      if (mv.absorption_rate !== null) {
        scores.push(normalizeToScale(parseFloat(mv.absorption_rate), -5, 15));
      }
    }

    if (scores.length === 0) return 50;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100;
  }

  private computeRevenueMomentum(financials: any[]): number {
    if (financials.length < 2) return 50;
    const yoy = financials[0]?.revenue_yoy_pct;
    if (yoy === null || yoy === undefined) return 50;
    return normalizeToScale(parseFloat(yoy), -20, 30);
  }

  private computeEarningsTrajectory(financials: any[]): number {
    if (financials.length < 2) return 50;

    let beatCount = 0;
    let total = 0;
    for (const f of financials.slice(0, 4)) {
      if (f.eps_actual !== null && f.eps_estimate !== null) {
        total++;
        if (parseFloat(f.eps_actual) >= parseFloat(f.eps_estimate)) beatCount++;
      }
    }

    const beatRate = total > 0 ? beatCount / total : 0.5;

    const margins = financials
      .filter((f: any) => f.operating_margin !== null)
      .map((f: any) => parseFloat(f.operating_margin));

    let marginTrend = 0;
    if (margins.length >= 2) {
      marginTrend = margins[0] - margins[margins.length - 1];
    }

    const beatScore = beatRate * 60;
    const marginScore = normalizeToScale(marginTrend, -10, 10) * 0.4;

    return Math.max(0, Math.min(100, beatScore + marginScore));
  }

  private computeHeadcountSignal(financials: any[]): number {
    if (financials.length < 2) return 50;
    const yoy = financials[0]?.employee_yoy_pct;
    if (yoy === null || yoy === undefined) return 50;
    return normalizeToScale(parseFloat(yoy), -15, 20);
  }

  private computeGuidanceSentiment(financials: any[]): number {
    if (financials.length === 0) return 50;
    const sentiment = financials[0]?.guidance_sentiment;
    if (sentiment === null || sentiment === undefined) return 50;
    return normalizeToScale(parseFloat(sentiment), -100, 100);
  }
}

export const corporateHealthService = new CorporateHealthService();
