/**
 * Outcome Panel Service
 *
 * Populates the outcome_panel table from existing data sources.
 * This is the critical bridge that transforms the platform's raw data
 * into paired (leading, realized) observations for correlation fitting.
 *
 * Two modes:
 *   1. BACKFILL — from historical data already in the database
 *   2. FORWARD-FILL — from new data as it arrives (cron-driven)
 *
 * The outcome_panel is the #1 missing data structure for the correlation engine.
 * Without it, every correlation coefficient is "hypothesized, not fitted."
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OutcomePanelRow {
  submarket_id: string;
  msa_id: string | null;
  period_date: string;           // YYYY-MM-DD
  as_of_date: string;            // YYYY-MM-DD (usually CURRENT_DATE)
  regime_tag: string | null;

  // Leading metrics
  surge_index?: number | null;
  search_momentum?: number | null;
  wage_growth_yoy?: number | null;
  formation_count?: number | null;
  corporate_health_index?: number | null;
  sentiment_score?: number | null;
  pipeline_pct?: number | null;
  permit_count?: number | null;
  delivery_count?: number | null;
  absorption_rate?: number | null;
  macro_rate?: number | null;
  cpi_shelter_yoy?: number | null;
  unemployment_rate?: number | null;
  market_rent_growth_yoy?: number | null;
  market_vacancy?: number | null;

  // Realized outcomes (at lag)
  rent_growth_t3?: number | null;
  rent_growth_t6?: number | null;
  rent_growth_t12?: number | null;
  rent_growth_t18?: number | null;
  vacancy_t2?: number | null;
  vacancy_t4?: number | null;
  vacancy_t6?: number | null;
  cap_rate_t18?: number | null;
  cap_rate_t24?: number | null;
  cap_rate_t30?: number | null;
  concession_t1?: number | null;
  concession_t3?: number | null;
  concession_t6?: number | null;
  absorption_t0?: number | null;
  transaction_volume_t6?: number | null;
  transaction_volume_t12?: number | null;

  data_sources?: string[];
  confidence_level?: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface BackfillOptions {
  submarketIds?: string[];       // null = all submarkets
  startDate?: string;            // YYYY-MM-DD
  endDate?: string;              // YYYY-MM-DD
  dryRun?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REGIME_TAGS: Array<{ start: string; end: string; tag: string }> = [
  { start: '2016-01-01', end: '2020-02-29', tag: '2016-2019_expansion' },
  { start: '2020-03-01', end: '2022-02-28', tag: '2020-2022_covid_recovery' },
  { start: '2022-03-01', end: '2024-12-31', tag: '2022-2024_rate_hike' },
  { start: '2025-01-01', end: '9999-12-31', tag: '2025-_normalizing' },
];

// ─── Service ─────────────────────────────────────────────────────────────────

export class OutcomePanelService {
  constructor(private pool: Pool) {}

  /**
   * Backfill the outcome_panel from existing data sources.
   * This is the critical step that makes correlations "fitted" instead of "hypothesized."
   */
  async backfill(opts: BackfillOptions = {}): Promise<{
    rowsInserted: number;
    submarketsProcessed: number;
    dateRange: { start: string; end: string };
  }> {
    const { submarketIds, startDate, endDate, dryRun = false } = opts;

    const start = startDate || '2016-01-01';
    const end = endDate || new Date().toISOString().slice(0, 10);

    logger.info('OutcomePanel: starting backfill', { start, end, dryRun });

    let rowsInserted = 0;
    let submarketsProcessed = 0;

    // Get all submarkets with data
    const submarketResult = await this.pool.query(
      `SELECT DISTINCT submarket_id, msa_id
       FROM metric_time_series
       WHERE submarket_id IS NOT NULL
         AND period_date BETWEEN $1 AND $2
       ${submarketIds ? 'AND submarket_id = ANY($3)' : ''}
       ORDER BY submarket_id`,
      submarketIds ? [start, end, submarketIds] : [start, end]
    );

    for (const row of submarketResult.rows) {
      const submarketId = row.submarket_id;
      const msaId = row.msa_id;
      submarketsProcessed++;

      // Generate monthly periods for this submarket
      const periods = await this.generatePeriods(submarketId, start, end);

      for (const period of periods) {
        const panelRow = await this.buildOutcomeRow(submarketId, msaId, period);
        if (!panelRow) continue;

        if (!dryRun) {
          await this.upsertRow(panelRow);
          rowsInserted++;
        } else {
          rowsInserted++;
        }
      }

      if (submarketsProcessed % 10 === 0) {
        logger.info('OutcomePanel: backfill progress', {
          submarketsProcessed,
          rowsInserted,
        });
      }
    }

    // Refresh the materialized view
    if (!dryRun) {
      await this.pool.query('SELECT refresh_outcome_panel_current()');
      logger.info('OutcomePanel: refreshed materialized view');
    }

    logger.info('OutcomePanel: backfill complete', {
      rowsInserted,
      submarketsProcessed,
      dateRange: { start, end },
    });

    return { rowsInserted, submarketsProcessed, dateRange: { start, end } };
  }

  /**
   * Forward-fill: add a new period's data to the outcome panel.
   * Called by the monthly cron after new metric_time_series data arrives.
   */
  async forwardFill(submarketId: string, periodDate: string): Promise<boolean> {
    const msaResult = await this.pool.query(
      'SELECT msa_id FROM submarkets WHERE id = $1 LIMIT 1',
      [submarketId]
    );
    const msaId = msaResult.rows[0]?.msa_id || null;

    const panelRow = await this.buildOutcomeRow(submarketId, msaId, periodDate);
    if (!panelRow) return false;

    await this.upsertRow(panelRow);
    logger.info('OutcomePanel: forward-filled', { submarketId, periodDate });
    return true;
  }

  /**
   * Get the current vintage of the outcome panel for a given submarket and period.
   * This is the safe function for fitting — it uses the latest as_of date.
   */
  async getCurrentVintage(
    submarketId: string,
    periodDate: string
  ): Promise<OutcomePanelRow | null> {
    const result = await this.pool.query(
      `SELECT * FROM outcome_panel_current
       WHERE submarket_id = $1 AND period_date = $2
       LIMIT 1`,
      [submarketId, periodDate]
    );

    if (result.rows.length === 0) return null;
    return this.rowToOutcomePanel(result.rows[0]);
  }

  /**
   * Get a time series for a specific pairing (leading metric + realized outcome).
   * Used by the correlation engine to compute r.
   */
  async getPairingSeries(
    submarketId: string,
    leadingMetric: string,         // e.g., 'pipeline_pct'
    realizedOutcome: string,         // e.g., 'rent_growth_t12'
    startDate: string,
    endDate: string
  ): Promise<Array<{ period: string; leading: number | null; realized: number | null }>> {
    const result = await this.pool.query(
      `SELECT
         period_date,
         ${leadingMetric} AS leading,
         ${realizedOutcome} AS realized
       FROM outcome_panel_current
       WHERE submarket_id = $1
         AND period_date BETWEEN $2 AND $3
         AND ${leadingMetric} IS NOT NULL
         AND ${realizedOutcome} IS NOT NULL
       ORDER BY period_date`,
      [submarketId, startDate, endDate]
    );

    return result.rows.map((r) => ({
      period: r.period_date.toISOString().slice(0, 10),
      leading: r.leading != null ? parseFloat(r.leading) : null,
      realized: r.realized != null ? parseFloat(r.realized) : null,
    }));
  }

  /**
   * Check whether a pairing has enough data to be "fitted" (not just hypothesized).
   */
  async isPairingFittable(
    submarketId: string,
    leadingMetric: string,
    realizedOutcome: string,
    minSamples: number = 24
  ): Promise<{ fittable: boolean; sampleSize: number; calibFloor: number }> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS n
       FROM outcome_panel_current
       WHERE submarket_id = $1
         AND ${leadingMetric} IS NOT NULL
         AND ${realizedOutcome} IS NOT NULL`,
      [submarketId]
    );

    const sampleSize = parseInt(result.rows[0].n) || 0;

    // Calib-Floor from the lookback spec
    const calibFloorMap: Record<string, number> = {
      rent_growth_t3: 24,
      rent_growth_t6: 36,
      rent_growth_t12: 48,
      rent_growth_t18: 48,
      vacancy_t2: 36,
      vacancy_t4: 36,
      vacancy_t6: 36,
      cap_rate_t18: 60,
      cap_rate_t24: 60,
      cap_rate_t30: 60,
      concession_t1: 48,
      concession_t3: 48,
      concession_t6: 48,
      absorption_t0: 36,
      transaction_volume_t6: 48,
      transaction_volume_t12: 60,
    };

    const calibFloor = calibFloorMap[realizedOutcome] || 24;
    const fittable = sampleSize >= Math.max(minSamples, calibFloor);

    return { fittable, sampleSize, calibFloor };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async generatePeriods(
    submarketId: string,
    start: string,
    end: string
  ): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT period_date
       FROM metric_time_series
       WHERE submarket_id = $1
         AND period_date BETWEEN $2 AND $3
       ORDER BY period_date`,
      [submarketId, start, end]
    );
    return result.rows.map((r) => r.period_date.toISOString().slice(0, 10));
  }

  private async buildOutcomeRow(
    submarketId: string,
    msaId: string | null,
    periodDate: string
  ): Promise<OutcomePanelRow | null> {
    const dataSources: string[] = [];
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    const notes: string[] = [];

    // ─── Fetch leading metrics from metric_time_series ──────────────────────
    const leading = await this.fetchLeadingMetrics(submarketId, periodDate);
    if (leading.dataSources.length > 0) {
      dataSources.push(...leading.dataSources);
      confidenceLevel = leading.confidence;
    }

    // ─── Fetch realized outcomes from market_snapshots ──────────────────────
    const outcomes = await this.fetchRealizedOutcomes(submarketId, periodDate);
    if (outcomes.dataSources.length > 0) {
      dataSources.push(...outcomes.dataSources);
      if (outcomes.confidence === 'high') confidenceLevel = 'high';
      else if (outcomes.confidence === 'medium' && confidenceLevel === 'low') {
        confidenceLevel = 'medium';
      }
    }

    // If we have no leading metrics and no outcomes, skip this row
    if (leading.isEmpty && outcomes.isEmpty) return null;

    // ─── Determine regime tag ───────────────────────────────────────────────
    const regimeTag = this.getRegimeTag(periodDate);

    // ─── Build the row ──────────────────────────────────────────────────────
    return {
      submarket_id: submarketId,
      msa_id: msaId,
      period_date: periodDate,
      as_of_date: new Date().toISOString().slice(0, 10),
      regime_tag: regimeTag,

      // Leading
      surge_index: leading.surgeIndex,
      search_momentum: leading.searchMomentum,
      wage_growth_yoy: leading.wageGrowth,
      formation_count: leading.formationCount,
      corporate_health_index: leading.corporateHealth,
      sentiment_score: leading.sentimentScore,
      pipeline_pct: leading.pipelinePct,
      permit_count: leading.permitCount,
      delivery_count: leading.deliveryCount,
      absorption_rate: leading.absorptionRate,
      macro_rate: leading.macroRate,
      cpi_shelter_yoy: leading.cpiShelter,
      unemployment_rate: leading.unemployment,
      market_rent_growth_yoy: leading.marketRentGrowth,
      market_vacancy: leading.marketVacancy,

      // Outcomes
      rent_growth_t3: outcomes.rentGrowthT3,
      rent_growth_t6: outcomes.rentGrowthT6,
      rent_growth_t12: outcomes.rentGrowthT12,
      rent_growth_t18: outcomes.rentGrowthT18,
      vacancy_t2: outcomes.vacancyT2,
      vacancy_t4: outcomes.vacancyT4,
      vacancy_t6: outcomes.vacancyT6,
      cap_rate_t18: outcomes.capRateT18,
      cap_rate_t24: outcomes.capRateT24,
      cap_rate_t30: outcomes.capRateT30,
      concession_t1: outcomes.concessionT1,
      concession_t3: outcomes.concessionT3,
      concession_t6: outcomes.concessionT6,
      absorption_t0: outcomes.absorptionT0,
      transaction_volume_t6: outcomes.transactionVolumeT6,
      transaction_volume_t12: outcomes.transactionVolumeT12,

      data_sources: [...new Set(dataSources)],
      confidence_level: confidenceLevel,
      notes: notes.length > 0 ? notes.join('; ') : undefined,
    };
  }

  private async fetchLeadingMetrics(
    submarketId: string,
    periodDate: string
  ): Promise<{
    isEmpty: boolean;
    dataSources: string[];
    confidence: 'high' | 'medium' | 'low';
    surgeIndex?: number | null;
    searchMomentum?: number | null;
    wageGrowth?: number | null;
    formationCount?: number | null;
    corporateHealth?: number | null;
    sentimentScore?: number | null;
    pipelinePct?: number | null;
    permitCount?: number | null;
    deliveryCount?: number | null;
    absorptionRate?: number | null;
    macroRate?: number | null;
    cpiShelter?: number | null;
    unemployment?: number | null;
    marketRentGrowth?: number | null;
    marketVacancy?: number | null;
  }> {
    const dataSources: string[] = [];
    let hasData = false;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    const result = await this.pool.query(
      `SELECT metric_id, value
       FROM metric_time_series
       WHERE submarket_id = $1 AND period_date = $2`,
      [submarketId, periodDate]
    );

    const metrics: Record<string, number | null> = {};
    for (const row of result.rows) {
      metrics[row.metric_id] = row.value != null ? parseFloat(row.value) : null;
      if (row.value != null) hasData = true;
    }

    if (hasData) {
      dataSources.push('metric_time_series');
      confidence = 'high';
    }

    // Also try market_snapshots for concurrent rent/vacancy
    const snapshot = await this.pool.query(
      `SELECT rent_growth_yoy, vacancy_rate, pipeline_pct, absorption_rate,
              concession_rate, transaction_volume
       FROM market_snapshots
       WHERE submarket_id = $1 AND snapshot_date = $2
       LIMIT 1`,
      [submarketId, periodDate]
    );

    if (snapshot.rows.length > 0) {
      dataSources.push('market_snapshots');
      if (confidence === 'low') confidence = 'medium';
      const s = snapshot.rows[0];
      metrics['market_rent_growth_yoy'] = s.rent_growth_yoy != null ? parseFloat(s.rent_growth_yoy) : null;
      metrics['market_vacancy'] = s.vacancy_rate != null ? parseFloat(s.vacancy_rate) : null;
      metrics['pipeline_pct'] = s.pipeline_pct != null ? parseFloat(s.pipeline_pct) : null;
      metrics['absorption_rate'] = s.absorption_rate != null ? parseFloat(s.absorption_rate) : null;
    }

    return {
      isEmpty: !hasData && snapshot.rows.length === 0,
      dataSources,
      confidence,
      surgeIndex: metrics['surge_index'] ?? null,
      searchMomentum: metrics['search_momentum'] ?? null,
      wageGrowth: metrics['wage_growth_yoy'] ?? null,
      formationCount: metrics['formation_count'] ?? null,
      corporateHealth: metrics['corporate_health_index'] ?? null,
      sentimentScore: metrics['sentiment_score'] ?? null,
      pipelinePct: metrics['pipeline_pct'] ?? null,
      permitCount: metrics['permit_count'] ?? null,
      deliveryCount: metrics['delivery_count'] ?? null,
      absorptionRate: metrics['absorption_rate'] ?? null,
      macroRate: metrics['macro_rate'] ?? null,
      cpiShelter: metrics['cpi_shelter_yoy'] ?? null,
      unemployment: metrics['unemployment_rate'] ?? null,
      marketRentGrowth: metrics['market_rent_growth_yoy'] ?? null,
      marketVacancy: metrics['market_vacancy'] ?? null,
    };
  }

  private async fetchRealizedOutcomes(
    submarketId: string,
    periodDate: string
  ): Promise<{
    isEmpty: boolean;
    dataSources: string[];
    confidence: 'high' | 'medium' | 'low';
    rentGrowthT3?: number | null;
    rentGrowthT6?: number | null;
    rentGrowthT12?: number | null;
    rentGrowthT18?: number | null;
    vacancyT2?: number | null;
    vacancyT4?: number | null;
    vacancyT6?: number | null;
    capRateT18?: number | null;
    capRateT24?: number | null;
    capRateT30?: number | null;
    concessionT1?: number | null;
    concessionT3?: number | null;
    concessionT6?: number | null;
    absorptionT0?: number | null;
    transactionVolumeT6?: number | null;
    transactionVolumeT12?: number | null;
  }> {
    const dataSources: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    const outcomes: Record<string, number | null> = {};

    // Query market_snapshots at each lag date
    const lags = [
      { months: 1, keys: ['concession_t1'] },
      { months: 2, keys: ['vacancy_t2'] },
      { months: 3, keys: ['rent_growth_t3', 'concession_t3'] },
      { months: 4, keys: ['vacancy_t4'] },
      { months: 6, keys: ['rent_growth_t6', 'vacancy_t6', 'concession_t6'] },
      { months: 12, keys: ['rent_growth_t12', 'transaction_volume_t6'] },
      { months: 18, keys: ['rent_growth_t18', 'cap_rate_t18'] },
      { months: 24, keys: ['cap_rate_t24'] },
      { months: 30, keys: ['cap_rate_t30'] },
    ];

    for (const lag of lags) {
      const lagDate = this.addMonths(periodDate, lag.months);
      const result = await this.pool.query(
        `SELECT rent_growth_yoy, vacancy_rate, cap_rate,
                concession_rate, transaction_volume, absorption_rate
         FROM market_snapshots
         WHERE submarket_id = $1 AND snapshot_date = $2
         LIMIT 1`,
        [submarketId, lagDate]
      );

      if (result.rows.length > 0) {
        dataSources.push('market_snapshots');
        confidence = 'high';
        const row = result.rows[0];

        // Map the lagged values to the correct outcome keys
        for (const key of lag.keys) {
          if (key === 'rent_growth_t3' || key === 'rent_growth_t6' ||
              key === 'rent_growth_t12' || key === 'rent_growth_t18') {
            outcomes[key] = row.rent_growth_yoy != null ? parseFloat(row.rent_growth_yoy) : null;
          }
          if (key === 'vacancy_t2' || key === 'vacancy_t4' || key === 'vacancy_t6') {
            outcomes[key] = row.vacancy_rate != null ? parseFloat(row.vacancy_rate) : null;
          }
          if (key === 'cap_rate_t18' || key === 'cap_rate_t24' || key === 'cap_rate_t30') {
            outcomes[key] = row.cap_rate != null ? parseFloat(row.cap_rate) : null;
          }
          if (key === 'concession_t1' || key === 'concession_t3' || key === 'concession_t6') {
            outcomes[key] = row.concession_rate != null ? parseFloat(row.concession_rate) : null;
          }
          if (key === 'transaction_volume_t6') {
            outcomes[key] = row.transaction_volume != null ? parseFloat(row.transaction_volume) : null;
          }
        }
      }
    }

    // Concurrent absorption (t+0)
    const concurrent = await this.pool.query(
      `SELECT absorption_rate
       FROM market_snapshots
       WHERE submarket_id = $1 AND snapshot_date = $2
       LIMIT 1`,
      [submarketId, periodDate]
    );
    if (concurrent.rows.length > 0) {
      outcomes['absorption_t0'] = concurrent.rows[0].absorption_rate != null
        ? parseFloat(concurrent.rows[0].absorption_rate)
        : null;
    }

    // Transaction volume at t+12 (separate query since it might not be in the same snapshot)
    const tv12Date = this.addMonths(periodDate, 12);
    const tvResult = await this.pool.query(
      `SELECT transaction_volume
       FROM market_snapshots
       WHERE submarket_id = $1 AND snapshot_date = $2
       LIMIT 1`,
      [submarketId, tv12Date]
    );
    if (tvResult.rows.length > 0) {
      outcomes['transaction_volume_t12'] = tvResult.rows[0].transaction_volume != null
        ? parseFloat(tvResult.rows[0].transaction_volume)
        : null;
    }

    const isEmpty = Object.keys(outcomes).length === 0;

    return {
      isEmpty,
      dataSources: [...new Set(dataSources)],
      confidence,
      rentGrowthT3: outcomes['rent_growth_t3'] ?? null,
      rentGrowthT6: outcomes['rent_growth_t6'] ?? null,
      rentGrowthT12: outcomes['rent_growth_t12'] ?? null,
      rentGrowthT18: outcomes['rent_growth_t18'] ?? null,
      vacancyT2: outcomes['vacancy_t2'] ?? null,
      vacancyT4: outcomes['vacancy_t4'] ?? null,
      vacancyT6: outcomes['vacancy_t6'] ?? null,
      capRateT18: outcomes['cap_rate_t18'] ?? null,
      capRateT24: outcomes['cap_rate_t24'] ?? null,
      capRateT30: outcomes['cap_rate_t30'] ?? null,
      concessionT1: outcomes['concession_t1'] ?? null,
      concessionT3: outcomes['concession_t3'] ?? null,
      concessionT6: outcomes['concession_t6'] ?? null,
      absorptionT0: outcomes['absorption_t0'] ?? null,
      transactionVolumeT6: outcomes['transaction_volume_t6'] ?? null,
      transactionVolumeT12: outcomes['transaction_volume_t12'] ?? null,
    };
  }

  private async upsertRow(row: OutcomePanelRow): Promise<void> {
    const columns = Object.keys(row).filter((k) => row[k as keyof OutcomePanelRow] !== undefined);
    const values = columns.map((k) => row[k as keyof OutcomePanelRow]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const updateSet = columns
      .filter((k) => k !== 'submarket_id' && k !== 'period_date' && k !== 'as_of_date')
      .map((k) => `${k} = EXCLUDED.${k}`)
      .join(', ');

    const query = `
      INSERT INTO outcome_panel (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (submarket_id, period_date, as_of_date)
      DO UPDATE SET ${updateSet}
    `;

    await this.pool.query(query, values);
  }

  private getRegimeTag(periodDate: string): string | null {
    for (const regime of REGIME_TAGS) {
      if (periodDate >= regime.start && periodDate <= regime.end) {
        return regime.tag;
      }
    }
    return null;
  }

  private addMonths(dateStr: string, months: number): string {
    const date = new Date(dateStr + 'T00:00:00');
    date.setMonth(date.getMonth() + months);
    return date.toISOString().slice(0, 10);
  }

  private rowToOutcomePanel(row: Record<string, any>): OutcomePanelRow {
    return {
      submarket_id: row.submarket_id,
      msa_id: row.msa_id,
      period_date: row.period_date.toISOString().slice(0, 10),
      as_of_date: row.as_of_date.toISOString().slice(0, 10),
      regime_tag: row.regime_tag,
      surge_index: row.surge_index != null ? parseFloat(row.surge_index) : null,
      search_momentum: row.search_momentum != null ? parseFloat(row.search_momentum) : null,
      wage_growth_yoy: row.wage_growth_yoy != null ? parseFloat(row.wage_growth_yoy) : null,
      formation_count: row.formation_count != null ? parseFloat(row.formation_count) : null,
      corporate_health_index: row.corporate_health_index != null ? parseFloat(row.corporate_health_index) : null,
      sentiment_score: row.sentiment_score != null ? parseFloat(row.sentiment_score) : null,
      pipeline_pct: row.pipeline_pct != null ? parseFloat(row.pipeline_pct) : null,
      permit_count: row.permit_count != null ? parseFloat(row.permit_count) : null,
      delivery_count: row.delivery_count != null ? parseFloat(row.delivery_count) : null,
      absorption_rate: row.absorption_rate != null ? parseFloat(row.absorption_rate) : null,
      macro_rate: row.macro_rate != null ? parseFloat(row.macro_rate) : null,
      cpi_shelter_yoy: row.cpi_shelter_yoy != null ? parseFloat(row.cpi_shelter_yoy) : null,
      unemployment_rate: row.unemployment_rate != null ? parseFloat(row.unemployment_rate) : null,
      market_rent_growth_yoy: row.market_rent_growth_yoy != null ? parseFloat(row.market_rent_growth_yoy) : null,
      market_vacancy: row.market_vacancy != null ? parseFloat(row.market_vacancy) : null,
      rent_growth_t3: row.rent_growth_t3 != null ? parseFloat(row.rent_growth_t3) : null,
      rent_growth_t6: row.rent_growth_t6 != null ? parseFloat(row.rent_growth_t6) : null,
      rent_growth_t12: row.rent_growth_t12 != null ? parseFloat(row.rent_growth_t12) : null,
      rent_growth_t18: row.rent_growth_t18 != null ? parseFloat(row.rent_growth_t18) : null,
      vacancy_t2: row.vacancy_t2 != null ? parseFloat(row.vacancy_t2) : null,
      vacancy_t4: row.vacancy_t4 != null ? parseFloat(row.vacancy_t4) : null,
      vacancy_t6: row.vacancy_t6 != null ? parseFloat(row.vacancy_t6) : null,
      cap_rate_t18: row.cap_rate_t18 != null ? parseFloat(row.cap_rate_t18) : null,
      cap_rate_t24: row.cap_rate_t24 != null ? parseFloat(row.cap_rate_t24) : null,
      cap_rate_t30: row.cap_rate_t30 != null ? parseFloat(row.cap_rate_t30) : null,
      concession_t1: row.concession_t1 != null ? parseFloat(row.concession_t1) : null,
      concession_t3: row.concession_t3 != null ? parseFloat(row.concession_t3) : null,
      concession_t6: row.concession_t6 != null ? parseFloat(row.concession_t6) : null,
      absorption_t0: row.absorption_t0 != null ? parseFloat(row.absorption_t0) : null,
      transaction_volume_t6: row.transaction_volume_t6 != null ? parseFloat(row.transaction_volume_t6) : null,
      transaction_volume_t12: row.transaction_volume_t12 != null ? parseFloat(row.transaction_volume_t12) : null,
      data_sources: row.data_sources || [],
      confidence_level: row.confidence_level || 'low',
      notes: row.notes,
    };
  }
}

// ─── Singleton instance ──────────────────────────────────────────────────────

import { pool } from '../database';
export const outcomePanelService = new OutcomePanelService(pool);
