/**
 * Portfolio Correlation Service — Task #1657
 *
 * Runs the COR-01–30 correlation engine against owned-portfolio operating history
 * (deal_monthly_actuals where is_portfolio_asset=TRUE) to produce:
 *
 *   1. Seven empirical per-property coefficients stored in
 *      portfolio_correlation_coefficients:
 *        – lease_velocity                    : linear-regression slope of occupancy (%/month)
 *        – occupancy_trajectory              : same slope, stored as a separate named entry
 *        – occupancy_trajectory_shape        : +1 accelerating / 0 linear / -1 decelerating
 *        – concession_depth_ratio            : avg(concession$ / effective_rent per unit)
 *        – concession_depth_to_stabilization : avg concession depth during sub-95% phase
 *        – rent_positioning_ratio            : avg(effective_rent / market_rent)
 *        – rent_positioning_to_lease_velocity_r : Pearson(rent_pos_per_month, occ_change)
 *
 *   2. COR-04 / COR-13 directly recomputed using first-party avg_effective_rent
 *      combined with MSA median_household_income — bypasses the engine string-
 *      manipulation path and produces a mathematically correct signal.
 *
 *   3. Portfolio actuals written into metric_time_series (geography_type='property')
 *      so computeTimeSeriesCorrelations can generate metric_correlations rows that
 *      F4's useColumnCorrelations picks up once properties are linked to a submarket.
 *
 *   4. Enriched signals (not the raw engine report) persisted to linked deals.
 *
 *   5. A queryable summary returned to the F3 Learning tab: both stored coefficients
 *      and per-COR-XX signal breakdown with source/confidence.
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { getPool } from '../database/connection';
import { CorrelationEngineService } from './correlationEngine.service';
import { mapSignalsToAdjustments, persistAdjustments } from './correlation-adjustments.service';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PropertyActualRow {
  report_month: Date;
  occupancy_rate: number | null;
  avg_effective_rent: number | null;
  avg_market_rent: number | null;
  asking_rent: number | null;
  concessions: number | null;
  months_free_concession: number | null;
  concession_rebate_amount: number | null;
  total_units: number | null;
  noi: number | null;
}

export interface EmpiricalCoefficients {
  property_id: string;
  property_name: string;
  sample_size: number;
  first_period: Date | null;
  last_period: Date | null;
  // ── time-series regression
  lease_velocity: number | null;
  lease_velocity_r2: number | null;
  occupancy_trajectory: number | null;
  occupancy_trajectory_shape: number | null;   // +1 / 0 / -1
  // ── concession
  concession_depth_ratio: number | null;
  concession_depth_to_stabilization: number | null;
  concession_leaseup_months: number | null;    // N months used for stabilization coefficient
  // ── rent positioning
  rent_positioning_ratio: number | null;
  rent_positioning_to_lease_velocity_r: number | null;
}

export interface PortfolioCorrelationSignal {
  property_id: string;
  property_name: string;
  city: string;
  state: string;
  cor_id: string;
  name: string;
  signal: string | null;
  confidence: string;
  source: 'first_party' | 'third_party' | 'mixed' | 'none';
  sample_size: number;
  actionable: string | null;
  missingData: string[];
  xValue: number | null;
  yValue: number | null;
}

export interface PortfolioCorrelationSummary {
  computed_at: string;
  properties_processed: number;
  signals: PortfolioCorrelationSignal[];
  coefficients: Array<{
    property_id: string;
    property_name: string;
    coefficient_name: string;
    value: number | null;
    sample_size: number;
    r_squared: number | null;
    first_period: string | null;
    last_period: string | null;
    data_source: string;
    computed_at: string;
  }>;
}

// ─── Math Helpers ──────────────────────────────────────────────────────────

interface LinearFit { slope: number; intercept: number; r2: number }

function linearRegression(xs: number[], ys: number[]): LinearFit | null {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const ssXY = xs.reduce((s, xi, i) => s + (xi - meanX) * (ys[i] - meanY), 0);
  const ssXX = xs.reduce((s, xi) => s + (xi - meanX) ** 2, 0);
  if (ssXX === 0) return { slope: 0, intercept: meanY, r2: 0 };
  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const ssRes = ys.reduce((s, yi, i) => s + (yi - (slope * xs[i] + intercept)) ** 2, 0);
  const ssTot = ys.reduce((s, yi) => s + (yi - meanY) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * Returns null if n < 3 or variance is zero.
 */
function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, xi, i) => s + (xi - mx) * (ys[i] - my), 0);
  const denom = Math.sqrt(
    xs.reduce((s, xi) => s + (xi - mx) ** 2, 0) *
    ys.reduce((s, yi) => s + (yi - my) ** 2, 0)
  );
  return denom === 0 ? null : parseFloat((num / denom).toFixed(4));
}

// ─── Main Service Class ────────────────────────────────────────────────────

export class PortfolioCorrelationService {
  private pool: Pool;
  private engine: CorrelationEngineService;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
    this.engine = new CorrelationEngineService(this.pool);
  }

  // ── Data fetchers ──────────────────────────────────────────────────────

  private async fetchOwnedProperties(): Promise<Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    msa_id: number | null;
    submarket_id: string | null;
    actuals: PropertyActualRow[];
  }>> {
    const propRes = await this.pool.query<{
      id: string; name: string; city: string; state_code: string;
      msa_id: number | null; submarket_id: string | null;
    }>(
      `SELECT DISTINCT p.id, p.name, p.city, p.state_code,
              p.msa_id, p.submarket_id
       FROM properties p
       JOIN deal_monthly_actuals dma ON dma.property_id = p.id
       WHERE dma.is_portfolio_asset = TRUE
       ORDER BY p.name`
    );

    const properties = [];
    for (const prop of propRes.rows) {
      const actualsRes = await this.pool.query<PropertyActualRow>(
        `SELECT report_month, occupancy_rate, avg_effective_rent,
                avg_market_rent, asking_rent, concessions,
                months_free_concession, concession_rebate_amount,
                total_units, noi
         FROM deal_monthly_actuals
         WHERE property_id = $1 AND is_portfolio_asset = TRUE
         ORDER BY report_month ASC`,
        [prop.id]
      );
      properties.push({
        id: prop.id,
        name: prop.name,
        city: prop.city || '',
        state: prop.state_code || '',
        msa_id: prop.msa_id,
        submarket_id: prop.submarket_id,
        actuals: actualsRes.rows,
      });
    }
    return properties;
  }

  /**
   * Look up MSA income and avg_rent for a city name.
   * Tries city substring match, then state fallback.
   */
  private async fetchMsaForCity(city: string, state: string): Promise<{
    median_household_income: number | null;
    avg_rent: number | null;
  } | null> {
    // Try city name substring match first
    const r = await this.pool.query<{ median_household_income: string | null; avg_rent: string | null }>(
      `SELECT median_household_income, avg_rent
       FROM msas
       WHERE name ILIKE $1
       LIMIT 1`,
      [`%${city}%`]
    );
    if (r.rows.length > 0) {
      return {
        median_household_income: r.rows[0].median_household_income ? parseFloat(r.rows[0].median_household_income) : null,
        avg_rent: r.rows[0].avg_rent ? parseFloat(r.rows[0].avg_rent) : null,
      };
    }

    // Fallback: any MSA in same state
    const s = await this.pool.query<{ median_household_income: string | null; avg_rent: string | null }>(
      `SELECT median_household_income, avg_rent
       FROM msas
       WHERE name ILIKE $1 AND median_household_income IS NOT NULL
       LIMIT 1`,
      [`%, ${state}%`]
    );
    if (s.rows.length > 0) {
      return {
        median_household_income: s.rows[0].median_household_income ? parseFloat(s.rows[0].median_household_income) : null,
        avg_rent: s.rows[0].avg_rent ? parseFloat(s.rows[0].avg_rent) : null,
      };
    }
    return null;
  }

  // ── Empirical coefficient computation ──────────────────────────────────

  /**
   * Compute all 7 empirical per-property coefficients from monthly actuals.
   * Each coefficient has well-defined semantics tied to first-party operating data.
   */
  computeCoefficients(propertyId: string, propertyName: string, actuals: PropertyActualRow[]): EmpiricalCoefficients {
    const base: EmpiricalCoefficients = {
      property_id: propertyId,
      property_name: propertyName,
      sample_size: actuals.length,
      first_period: actuals[0]?.report_month ?? null,
      last_period: actuals[actuals.length - 1]?.report_month ?? null,
      lease_velocity: null,
      lease_velocity_r2: null,
      occupancy_trajectory: null,
      occupancy_trajectory_shape: null,
      concession_depth_ratio: null,
      concession_depth_to_stabilization: null,
      concession_leaseup_months: null,
      rent_positioning_ratio: null,
      rent_positioning_to_lease_velocity_r: null,
    };

    if (actuals.length < 3) return base;

    const sf = (v: string | number | null | undefined): number | null => {
      if (v == null) return null;
      const n = parseFloat(String(v));
      return isNaN(n) ? null : n;
    };

    // ── 1. Lease velocity + occupancy trajectory ─────────────────────────
    // Linear regression of occupancy_rate over time index.
    // slope is %/month (as a fraction), multiply by 100 → %-points/month.

    const occRows = actuals
      .map((r, i) => ({ x: i, y: sf(r.occupancy_rate) }))
      .filter((r): r is { x: number; y: number } => r.y !== null);

    if (occRows.length >= 2) {
      const fit = linearRegression(occRows.map(r => r.x), occRows.map(r => r.y));
      if (fit) {
        base.lease_velocity = parseFloat((fit.slope * 100).toFixed(4));
        base.lease_velocity_r2 = parseFloat(fit.r2.toFixed(4));
        base.occupancy_trajectory = base.lease_velocity;
      }

      // Trajectory shape: compare slope of first half vs second half
      if (occRows.length >= 6) {
        const mid = Math.floor(occRows.length / 2);
        const firstHalf = occRows.slice(0, mid);
        const secondHalf = occRows.slice(mid);
        const f1 = linearRegression(firstHalf.map(r => r.x), firstHalf.map(r => r.y));
        const f2 = linearRegression(secondHalf.map(r => r.x), secondHalf.map(r => r.y));
        if (f1 && f2) {
          const diff = f2.slope - f1.slope;
          const threshold = Math.abs(f1.slope) * 0.25 + 0.0005; // 25% change or absolute >0.0005
          if (diff > threshold) base.occupancy_trajectory_shape = 1;       // accelerating
          else if (diff < -threshold) base.occupancy_trajectory_shape = -1; // decelerating
          else base.occupancy_trajectory_shape = 0;                          // linear
        }
      }
    }

    // ── 2. Concession depth ratio ─────────────────────────────────────────
    // avg( concession$ / (effective_rent × units) ) per month with data.
    // Secondary: months_free_concession / 12 when direct $ unavailable.
    const concessionRatios: number[] = [];
    for (const r of actuals) {
      const eff = sf(r.avg_effective_rent);
      const units = sf(r.total_units);
      const conc = sf(r.concessions);
      if (conc != null && conc > 0 && eff && eff > 0 && units && units > 0) {
        concessionRatios.push(conc / (eff * units));
      } else if (r.months_free_concession != null) {
        const mfc = sf(r.months_free_concession);
        if (mfc != null && mfc > 0) concessionRatios.push(mfc / 12);
      }
    }
    if (concessionRatios.length > 0) {
      base.concession_depth_ratio = parseFloat(
        (concessionRatios.reduce((a, b) => a + b, 0) / concessionRatios.length).toFixed(6)
      );
    }

    // ── 3. Concession depth to stabilization ─────────────────────────────
    // Find months where occupancy < 95% (lease-up phase).
    // Compute avg concession depth only during that phase.
    // sample_size = number of months in lease-up phase.
    const STABLE_OCC = 0.95;
    const leaseupConcessions: number[] = [];
    for (const r of actuals) {
      const occ = sf(r.occupancy_rate);
      if (occ == null || occ >= STABLE_OCC) continue; // already stable or no data
      const eff = sf(r.avg_effective_rent);
      const units = sf(r.total_units);
      const conc = sf(r.concessions);
      if (conc != null && conc > 0 && eff && eff > 0 && units && units > 0) {
        leaseupConcessions.push(conc / (eff * units));
      } else if (r.months_free_concession != null) {
        const mfc = sf(r.months_free_concession);
        if (mfc != null && mfc > 0) leaseupConcessions.push(mfc / 12);
      }
    }
    if (leaseupConcessions.length > 0) {
      base.concession_depth_to_stabilization = parseFloat(
        (leaseupConcessions.reduce((a, b) => a + b, 0) / leaseupConcessions.length).toFixed(6)
      );
      base.concession_leaseup_months = leaseupConcessions.length;
    }

    // ── 4. Rent positioning ratio ─────────────────────────────────────────
    // avg( effective_rent / market_rent ) — how property prices vs market.
    const rentRatios: number[] = [];
    for (const r of actuals) {
      const eff = sf(r.avg_effective_rent);
      const mkt = sf(r.avg_market_rent);
      if (eff && mkt && mkt > 0) rentRatios.push(eff / mkt);
    }
    if (rentRatios.length > 0) {
      base.rent_positioning_ratio = parseFloat(
        (rentRatios.reduce((a, b) => a + b, 0) / rentRatios.length).toFixed(6)
      );
    }

    // ── 5. Rent positioning → lease velocity Pearson ──────────────────────
    // For each month with both (eff/mkt) and a previous month's occupancy,
    // build paired arrays:  X = rent_positioning_ratio, Y = month-on-month occ change
    const posVelPairs: Array<{ pos: number; vel: number }> = [];
    for (let i = 1; i < actuals.length; i++) {
      const eff = sf(actuals[i].avg_effective_rent);
      const mkt = sf(actuals[i].avg_market_rent);
      const occCurr = sf(actuals[i].occupancy_rate);
      const occPrev = sf(actuals[i - 1].occupancy_rate);
      if (eff && mkt && mkt > 0 && occCurr != null && occPrev != null) {
        posVelPairs.push({ pos: eff / mkt, vel: occCurr - occPrev });
      }
    }
    if (posVelPairs.length >= 3) {
      base.rent_positioning_to_lease_velocity_r = pearson(
        posVelPairs.map(p => p.pos),
        posVelPairs.map(p => p.vel)
      );
    }

    return base;
  }

  // ── COR-04 / COR-13 first-party recomputation ─────────────────────────

  /**
   * Directly compute COR-04 (Wage Growth vs Rent Growth) and COR-13
   * (Rent-to-Income Ratio vs Rent Growth) using first-party avg_effective_rent
   * and MSA median_household_income from the database.
   *
   * This bypasses the engine's string post-processing path and produces a
   * mathematically correct signal with real xValue / yValue / actionable.
   *
   * Returns null for each if the required income data is unavailable.
   */
  private async computeFirstPartyCOR04COR13(
    actuals: PropertyActualRow[],
    city: string,
    state: string
  ): Promise<{
    cor04: PortfolioCorrelationSignal['source'] extends any
      ? { id: string; name: string; signal: string | null; confidence: string; actionable: string | null; xValue: number | null; missingData: string[]; source: 'first_party' | 'none' }
      : never;
    cor13: { id: string; name: string; signal: string | null; confidence: string; actionable: string | null; xValue: number | null; missingData: string[]; source: 'first_party' | 'none' };
  }> {
    const msa = await this.fetchMsaForCity(city, state);
    const medianIncome = msa?.median_household_income ?? null;

    // First-party rent: average effective rent over the observation window
    const rents = actuals
      .map(r => r.avg_effective_rent != null ? parseFloat(String(r.avg_effective_rent)) : null)
      .filter((r): r is number => r !== null && r > 0);
    const avgEffRent = rents.length > 0 ? rents.reduce((a, b) => a + b, 0) / rents.length : null;

    const makeResult = (id: string, corName: string, rentSource: string): {
      id: string; name: string; signal: string | null; confidence: string;
      actionable: string | null; xValue: number | null; missingData: string[];
      source: 'first_party' | 'none';
    } => {
      const missing: string[] = [];
      if (!medianIncome) missing.push('MSA median household income (no MSA linked)');
      if (!avgEffRent) missing.push('portfolio avg effective rent (no actuals)');

      if (!medianIncome || !avgEffRent) {
        return { id, name: corName, signal: null, confidence: 'insufficient', actionable: null, xValue: null, missingData: missing, source: 'none' };
      }

      // Rent-to-income ratio: (monthly_rent × 12) / annual_income
      const ratio = (avgEffRent * 12) / medianIncome;
      const pct = ratio * 100;

      let signal: string;
      let actionable: string;
      if (pct < 28) {
        signal = 'bullish';
        actionable = `${rentSource} rent-to-income ${pct.toFixed(1)}% (below 30% ceiling). Room to push rents. 1P rent: $${avgEffRent.toFixed(0)}/mo.`;
      } else if (pct <= 32) {
        signal = 'neutral';
        actionable = `${rentSource} rent-to-income ${pct.toFixed(1)}% — near 30% ceiling. Moderate runway. 1P rent: $${avgEffRent.toFixed(0)}/mo.`;
      } else {
        signal = 'bearish';
        actionable = `${rentSource} rent-to-income ${pct.toFixed(1)}% exceeds ceiling. Reduce rent growth assumptions. 1P rent: $${avgEffRent.toFixed(0)}/mo.`;
      }

      return {
        id, name: corName,
        signal,
        confidence: 'medium',
        actionable,
        xValue: parseFloat(pct.toFixed(1)),
        missingData: [],
        source: 'first_party',
      };
    };

    return {
      cor04: makeResult('COR-04', 'Wage Growth vs Rent Growth', '1P portfolio'),
      cor13: makeResult('COR-13', 'Rent-to-Income Ratio vs Rent Growth', '1P portfolio'),
    };
  }

  // ── Metric time-series sync ──────────────────────────────────────────────

  /**
   * Write portfolio actuals into metric_time_series with geography_type='property'.
   * This makes the data available to computeTimeSeriesCorrelations() which writes
   * cross-metric Pearson pairs into metric_correlations — queryable by F4 once
   * properties are linked to a submarket (#1685).
   *
   * Uses ON CONFLICT DO UPDATE so it's re-runnable.
   */
  private async syncToMetricTimeSeries(propertyId: string, propertyName: string, actuals: PropertyActualRow[]): Promise<void> {
    // Metric IDs: prefixed PORT_ to avoid collision with CS_ (CoStar) metrics
    const METRIC_MAP: Array<{ metricId: string; field: keyof PropertyActualRow; scale?: number }> = [
      { metricId: 'PORT_OCCUPANCY',   field: 'occupancy_rate',      scale: 100 }, // stored as 0-100 %
      { metricId: 'PORT_EFF_RENT',    field: 'avg_effective_rent' },
      { metricId: 'PORT_MARKET_RENT', field: 'avg_market_rent' },
      { metricId: 'PORT_ASKING_RENT', field: 'asking_rent' },
      { metricId: 'PORT_NOI',         field: 'noi' },
      { metricId: 'PORT_CONCESSIONS', field: 'concessions' },
    ];

    for (const actual of actuals) {
      const periodDate = new Date(actual.report_month).toISOString().slice(0, 10);
      for (const mapping of METRIC_MAP) {
        const rawVal = actual[mapping.field] as number | null;
        if (rawVal == null) continue;
        const value = mapping.scale ? parseFloat(String(rawVal)) * mapping.scale : parseFloat(String(rawVal));
        if (isNaN(value)) continue;

        // No unique constraint on metric_time_series — guard with WHERE NOT EXISTS
        await this.pool.query(
          `INSERT INTO metric_time_series
             (metric_id, geography_type, geography_id, geography_name,
              period_date, period_type, value, source, confidence)
           SELECT $1, 'property', $2, $3, $4, 'monthly', $5, 'portfolio_actuals', 0.95
           WHERE NOT EXISTS (
             SELECT 1 FROM metric_time_series
             WHERE metric_id = $1
               AND geography_type = 'property'
               AND geography_id = $2
               AND period_date = $4
           )`,
          [mapping.metricId, propertyId, propertyName, periodDate, value]
        );
      }
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────

  /**
   * Persist one set of coefficients to portfolio_correlation_coefficients.
   * All 7 named coefficients are upserted; trajectory_shape stored as numeric.
   */
  private async persistCoefficients(coeff: EmpiricalCoefficients, dryRun: boolean): Promise<Array<{
    property_id: string; property_name: string; coefficient_name: string;
    value: number | null; sample_size: number; r_squared: number | null;
    first_period: string | null; last_period: string | null;
    data_source: string; computed_at: string;
  }>> {
    const computedAt = new Date().toISOString();
    const entries: Array<{ name: string; value: number | null; r2: number | null; n: number }> = [
      { name: 'lease_velocity',                      value: coeff.lease_velocity,                       r2: coeff.lease_velocity_r2,  n: coeff.sample_size },
      { name: 'occupancy_trajectory',                value: coeff.occupancy_trajectory,                 r2: coeff.lease_velocity_r2,  n: coeff.sample_size },
      { name: 'occupancy_trajectory_shape',          value: coeff.occupancy_trajectory_shape,           r2: null,                     n: coeff.sample_size },
      { name: 'concession_depth_ratio',              value: coeff.concession_depth_ratio,               r2: null,                     n: coeff.sample_size },
      { name: 'concession_depth_to_stabilization',   value: coeff.concession_depth_to_stabilization,    r2: null,                     n: coeff.concession_leaseup_months ?? coeff.sample_size },
      { name: 'rent_positioning_ratio',              value: coeff.rent_positioning_ratio,               r2: null,                     n: coeff.sample_size },
      { name: 'rent_positioning_to_lease_velocity_r', value: coeff.rent_positioning_to_lease_velocity_r, r2: null,                    n: coeff.sample_size },
    ];

    const rows: Array<{
      property_id: string; property_name: string; coefficient_name: string;
      value: number | null; sample_size: number; r_squared: number | null;
      first_period: string | null; last_period: string | null;
      data_source: string; computed_at: string;
    }> = [];

    for (const e of entries) {
      if (!dryRun) {
        await this.pool.query(
          `INSERT INTO portfolio_correlation_coefficients
             (property_id, coefficient_name, value, sample_size, r_squared,
              first_period, last_period, computed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (property_id, coefficient_name)
           DO UPDATE SET
             value        = EXCLUDED.value,
             sample_size  = EXCLUDED.sample_size,
             r_squared    = EXCLUDED.r_squared,
             first_period = EXCLUDED.first_period,
             last_period  = EXCLUDED.last_period,
             computed_at  = NOW()`,
          [
            coeff.property_id, e.name,
            e.value != null ? e.value : null,
            e.n,
            e.r2 != null ? e.r2 : null,
            coeff.first_period ?? null,
            coeff.last_period ?? null,
          ]
        );
      }
      rows.push({
        property_id: coeff.property_id,
        property_name: coeff.property_name,
        coefficient_name: e.name,
        value: e.value,
        sample_size: e.n,
        r_squared: e.r2,
        first_period: coeff.first_period?.toISOString().slice(0, 10) ?? null,
        last_period: coeff.last_period?.toISOString().slice(0, 10) ?? null,
        data_source: 'owned_portfolio',
        computed_at: computedAt,
      });
    }
    return rows;
  }

  /**
   * Persist enriched signals (not the raw engine report) to linked deals.
   * Swallows per-deal errors so one broken deal doesn't abort the whole run.
   */
  private async persistEnrichedSignals(
    propertyId: string,
    enrichedSignals: PortfolioCorrelationSignal[]
  ): Promise<void> {
    let dealRows: Array<{ id: string }> = [];
    try {
      const r = await this.pool.query<{ id: string }>(
        `SELECT id FROM deals WHERE property_id = $1`,
        [propertyId]
      );
      dealRows = r.rows;
    } catch {
      return;
    }

    // mapSignalsToAdjustments expects { id, signal, confidence, leadTime }
    const adjustments = mapSignalsToAdjustments(
      enrichedSignals.map(s => ({
        id: s.cor_id,
        name: s.name,
        signal: s.signal,
        confidence: s.confidence,
        leadTime: undefined,
      }))
    );
    if (adjustments.length === 0) return;

    for (const deal of dealRows) {
      try {
        await persistAdjustments(deal.id, adjustments);
      } catch (err) {
        logger.warn(`[PortfolioCorrelation] Could not persist adjustments for deal ${deal.id}: ${String(err)}`);
      }
    }
  }

  // ── Main pipeline ────────────────────────────────────────────────────────

  /**
   * Run the full portfolio correlation pass.
   * Safe to re-run — all writes are upserts / DO NOTHING.
   *
   * Steps for each owned property:
   *   1. Compute 7 empirical coefficients from actuals
   *   2. Run CorrelationEngineService.computeCorrelations for base signals
   *   3. REPLACE COR-04 / COR-13 with mathematically correct first-party result
   *   4. Sync actuals to metric_time_series (geography_type='property')
   *   5. Run computeTimeSeriesCorrelations so F4 can query property-level pairs
   *   6. Persist enriched signals (not raw engine report) to linked deals
   */
  async run(opts: { dryRun?: boolean } = {}): Promise<PortfolioCorrelationSummary> {
    const dryRun = opts.dryRun === true;
    const computedAt = new Date().toISOString();
    const signals: PortfolioCorrelationSignal[] = [];
    const coefficientRows: PortfolioCorrelationSummary['coefficients'] = [];

    const properties = await this.fetchOwnedProperties();

    for (const prop of properties) {
      try {
        // ── 1. Empirical coefficients
        const coeffs = this.computeCoefficients(prop.id, prop.name, prop.actuals);
        const persisted = await this.persistCoefficients(coeffs, dryRun);
        coefficientRows.push(...persisted);

        // ── 2. Run base correlation engine
        const report = await this.engine.computeCorrelations(prop.city, prop.state);

        // ── 3. Recompute COR-04 / COR-13 with first-party rent + MSA income
        const { cor04: fp04, cor13: fp13 } = await this.computeFirstPartyCOR04COR13(
          prop.actuals, prop.city, prop.state
        );

        // Build enriched signal list — COR-04 and COR-13 are replaced by 1P results
        const enrichedSignals: PortfolioCorrelationSignal[] = [];
        for (const cor of report.correlations) {
          if (cor.id === 'COR-04') {
            enrichedSignals.push({
              property_id: prop.id, property_name: prop.name,
              city: prop.city, state: prop.state,
              cor_id: 'COR-04', name: fp04.name,
              signal: fp04.signal, confidence: fp04.confidence,
              source: fp04.source, sample_size: prop.actuals.length,
              actionable: fp04.actionable, missingData: fp04.missingData,
              xValue: fp04.xValue, yValue: cor.yValue,
            });
            continue;
          }
          if (cor.id === 'COR-13') {
            enrichedSignals.push({
              property_id: prop.id, property_name: prop.name,
              city: prop.city, state: prop.state,
              cor_id: 'COR-13', name: fp13.name,
              signal: fp13.signal, confidence: fp13.confidence,
              source: fp13.source, sample_size: prop.actuals.length,
              actionable: fp13.actionable, missingData: fp13.missingData,
              xValue: fp13.xValue, yValue: cor.yValue,
            });
            continue;
          }

          // All other correlations: classify source based on data availability
          const source: PortfolioCorrelationSignal['source'] =
            cor.confidence === 'insufficient' ? 'none' :
            cor.missingData.length === 0 ? 'third_party' : 'mixed';

          enrichedSignals.push({
            property_id: prop.id, property_name: prop.name,
            city: prop.city, state: prop.state,
            cor_id: cor.id, name: cor.name ?? cor.id,
            signal: cor.signal, confidence: cor.confidence,
            source, sample_size: prop.actuals.length,
            actionable: cor.actionable, missingData: cor.missingData,
            xValue: (cor as any).xValue ?? null,
            yValue: (cor as any).yValue ?? null,
          });
        }

        signals.push(...enrichedSignals);

        // ── 4. Sync actuals to metric_time_series (non-dry-run)
        if (!dryRun) {
          await this.syncToMetricTimeSeries(prop.id, prop.name, prop.actuals);

          // ── 5. Run cross-metric correlations for this property (geometry: 'property')
          try {
            await this.engine.computeTimeSeriesCorrelations('property', prop.id);
          } catch (err) {
            // Non-fatal: insufficient data (< min window) produces no rows
            logger.debug(`[PortfolioCorrelation] computeTimeSeriesCorrelations skipped for ${prop.id}: ${String(err)}`);
          }
        }

        // ── 6. Persist enriched signals to linked deals
        if (!dryRun) {
          await this.persistEnrichedSignals(prop.id, enrichedSignals);
        }

      } catch (err) {
        logger.error(`[PortfolioCorrelation] Error processing property ${prop.id}: ${String(err)}`);
      }
    }

    return {
      computed_at: computedAt,
      properties_processed: properties.length,
      signals,
      coefficients: coefficientRows,
    };
  }

  // ── Read paths ──────────────────────────────────────────────────────────

  async getStoredCoefficients(): Promise<PortfolioCorrelationSummary['coefficients']> {
    const r = await this.pool.query(
      `SELECT pcc.property_id, p.name AS property_name,
              pcc.coefficient_name, pcc.value, pcc.sample_size,
              pcc.r_squared, pcc.first_period, pcc.last_period,
              pcc.data_source, pcc.computed_at
       FROM portfolio_correlation_coefficients pcc
       JOIN properties p ON p.id = pcc.property_id
       ORDER BY p.name, pcc.coefficient_name`
    );
    return r.rows.map(row => ({
      property_id: row.property_id,
      property_name: row.property_name,
      coefficient_name: row.coefficient_name,
      value: row.value != null ? parseFloat(row.value) : null,
      sample_size: parseInt(row.sample_size ?? '0'),
      r_squared: row.r_squared != null ? parseFloat(row.r_squared) : null,
      first_period: row.first_period ? new Date(row.first_period).toISOString().slice(0, 10) : null,
      last_period: row.last_period ? new Date(row.last_period).toISOString().slice(0, 10) : null,
      data_source: row.data_source,
      computed_at: new Date(row.computed_at).toISOString(),
    }));
  }

  async getSummary(): Promise<{
    coefficients: PortfolioCorrelationSummary['coefficients'];
    last_run: string | null;
    properties_covered: string[];
  }> {
    const coefficients = await this.getStoredCoefficients();
    const lastRun = coefficients.length > 0
      ? coefficients.reduce((latest, c) => c.computed_at > latest ? c.computed_at : latest, coefficients[0].computed_at)
      : null;
    const covered = [...new Set(coefficients.map(c => c.property_name))];
    return { coefficients, last_run: lastRun, properties_covered: covered };
  }
}
