/**
 * Portfolio Correlation Service — Task #1657
 *
 * Runs the COR-01–30 correlation engine against owned-portfolio operating history
 * (deal_monthly_actuals where is_portfolio_asset=TRUE, the canonical owned-portfolio
 * source — property_operating_history does not exist) to produce:
 *
 *   1. Seven empirical per-property coefficients (portfolio_correlation_coefficients):
 *        – lease_velocity                     : regression slope of occupancy (%/month)
 *        – occupancy_trajectory               : same slope, stored separately
 *        – occupancy_trajectory_shape         : +1 accelerating / 0 linear / -1 decelerating
 *        – concession_depth_ratio             : avg(concession$ / eff_rent per unit)
 *        – concession_depth_to_stabilization  : concession depth during sub-95% phase only
 *        – rent_positioning_ratio             : avg(eff_rent / market_rent)
 *        – rent_positioning_to_lease_velocity_r : Pearson(rent_pos, monthly_occ_change)
 *
 *   2. Per-property enriched COR signals (portfolio_correlation_signals), durably stored
 *      so GET /correlation-signals can serve them after page refresh.
 *      Enrichment covers all signals where first-party actuals improve accuracy:
 *        – COR-04/COR-13 : rent-to-income ratio recomputed from 1P rent + MSA income
 *        – COR-05        : property vacancy derived from 1P avg occupancy rate
 *        – COR-09        : concession rate filled from 1P concession_depth_ratio
 *        – COR-22        : explicitly marked insufficient_history (no job_growth_yoy
 *                          in city-level data); source = 'insufficient_history'
 *        – All other COR : "avg rent" / "effective rent" / "vacancy" in missingData
 *                          → filled with 1P rent/occupancy, source upgraded to 'mixed'
 *
 *   3. Portfolio actuals written to metric_time_series (geography_type='property') so
 *      computeTimeSeriesCorrelations generates metric_correlations rows — queryable by
 *      F4 once properties are linked to a submarket (task #1685).
 *
 *   4. Enriched signals (not the raw engine report) persisted to linked deals.
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
  lease_velocity: number | null;
  lease_velocity_r2: number | null;
  occupancy_trajectory: number | null;
  occupancy_trajectory_shape: number | null;
  concession_depth_ratio: number | null;
  concession_depth_to_stabilization: number | null;
  concession_leaseup_months: number | null;
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
  source: 'first_party' | 'third_party' | 'mixed' | 'none' | 'insufficient_history';
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

// ─── Math Helpers ───────────────────────────────────────────────────────────

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

const sf = (v: string | number | null | undefined): number | null => {
  if (v == null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
};

// ─── Main Service Class ─────────────────────────────────────────────────────

export class PortfolioCorrelationService {
  private pool: Pool;
  private engine: CorrelationEngineService;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
    this.engine = new CorrelationEngineService(this.pool);
  }

  // ── Data fetchers ────────────────────────────────────────────────────────

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

  private async fetchMsaForCity(city: string, state: string): Promise<{
    median_household_income: number | null;
    avg_rent: number | null;
  } | null> {
    const r = await this.pool.query<{ median_household_income: string | null; avg_rent: string | null }>(
      `SELECT median_household_income, avg_rent FROM msas WHERE name ILIKE $1 LIMIT 1`,
      [`%${city}%`]
    );
    if (r.rows.length > 0) {
      return {
        median_household_income: r.rows[0].median_household_income ? sf(r.rows[0].median_household_income) : null,
        avg_rent: r.rows[0].avg_rent ? sf(r.rows[0].avg_rent) : null,
      };
    }
    // Fallback: any MSA in same state
    const s = await this.pool.query<{ median_household_income: string | null; avg_rent: string | null }>(
      `SELECT median_household_income, avg_rent FROM msas WHERE name ILIKE $1 AND median_household_income IS NOT NULL LIMIT 1`,
      [`%, ${state}%`]
    );
    if (s.rows.length > 0) {
      return {
        median_household_income: sf(s.rows[0].median_household_income),
        avg_rent: sf(s.rows[0].avg_rent),
      };
    }
    return null;
  }

  // ── Empirical coefficient computation ────────────────────────────────────

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

    // ── 1. Lease velocity + occupancy trajectory (regression on occupancy index)
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
        const f1 = linearRegression(occRows.slice(0, mid).map(r => r.x), occRows.slice(0, mid).map(r => r.y));
        const f2 = linearRegression(occRows.slice(mid).map(r => r.x), occRows.slice(mid).map(r => r.y));
        if (f1 && f2) {
          const diff = f2.slope - f1.slope;
          const threshold = Math.abs(f1.slope) * 0.25 + 0.0005;
          base.occupancy_trajectory_shape = diff > threshold ? 1 : diff < -threshold ? -1 : 0;
        }
      }
    }

    // ── 2. Concession depth ratio (all-period average)
    const concessionRatios: number[] = [];
    for (const r of actuals) {
      const eff = sf(r.avg_effective_rent), units = sf(r.total_units), conc = sf(r.concessions);
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

    // ── 3. Concession depth during sub-95% phase (lease-up only)
    const STABLE_OCC = 0.95;
    const leaseupConc: number[] = [];
    for (const r of actuals) {
      const occ = sf(r.occupancy_rate);
      if (occ == null || occ >= STABLE_OCC) continue;
      const eff = sf(r.avg_effective_rent), units = sf(r.total_units), conc = sf(r.concessions);
      if (conc != null && conc > 0 && eff && eff > 0 && units && units > 0) {
        leaseupConc.push(conc / (eff * units));
      } else if (r.months_free_concession != null) {
        const mfc = sf(r.months_free_concession);
        if (mfc != null && mfc > 0) leaseupConc.push(mfc / 12);
      }
    }
    if (leaseupConc.length > 0) {
      base.concession_depth_to_stabilization = parseFloat(
        (leaseupConc.reduce((a, b) => a + b, 0) / leaseupConc.length).toFixed(6)
      );
      base.concession_leaseup_months = leaseupConc.length;
    }

    // ── 4. Rent positioning ratio
    const rentRatios: number[] = [];
    for (const r of actuals) {
      const eff = sf(r.avg_effective_rent), mkt = sf(r.avg_market_rent);
      if (eff && mkt && mkt > 0) rentRatios.push(eff / mkt);
    }
    if (rentRatios.length > 0) {
      base.rent_positioning_ratio = parseFloat(
        (rentRatios.reduce((a, b) => a + b, 0) / rentRatios.length).toFixed(6)
      );
    }

    // ── 5. Pearson(rent_positioning_per_month, monthly_occ_change)
    const posVelPairs: Array<{ pos: number; vel: number }> = [];
    for (let i = 1; i < actuals.length; i++) {
      const eff = sf(actuals[i].avg_effective_rent), mkt = sf(actuals[i].avg_market_rent);
      const occCurr = sf(actuals[i].occupancy_rate), occPrev = sf(actuals[i - 1].occupancy_rate);
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

  // ── Per-property signal enrichment ───────────────────────────────────────

  /**
   * Build a property-specific enriched signal set from the city-level engine report.
   *
   * For each of the 30 correlation signals, checks whether first-party portfolio
   * actuals provide better (or more granular) inputs than the city-level market data:
   *
   *   COR-04 / COR-13 : rent-to-income ratio recomputed from 1P rent + MSA income.
   *   COR-05          : property vacancy = 1 - avg_occupancy_rate (1P actuals).
   *   COR-09          : concession rate filled from 1P concession_depth_ratio.
   *   COR-22          : explicitly marked insufficient_history (no job_growth_yoy
   *                     in first-party actuals; city-level macro data absent).
   *   All others      : "avg rent" / "effective rent" / "current rent" / "vacancy rate"
   *                     / "occupancy" in missingData → fill from 1P actuals, upgrade
   *                     source to 'mixed' and confidence to 'low' if was 'insufficient'.
   */
  private enrichSignalsWithFirstPartyData(
    engineCorrelations: Array<{
      id: string; name?: string; signal: string | null; confidence: string;
      actionable: string | null; missingData: string[];
      xValue?: number | null; yValue?: number | null; [k: string]: unknown;
    }>,
    actuals: PropertyActualRow[],
    coefficients: EmpiricalCoefficients,
    msa: { median_household_income: number | null; avg_rent: number | null } | null
  ): Array<Omit<PortfolioCorrelationSignal, 'property_id' | 'property_name' | 'city' | 'state' | 'sample_size'>> {

    // First-party computed stats
    const rents = actuals.map(r => sf(r.avg_effective_rent)).filter((v): v is number => v !== null && v > 0);
    const avgEffRent = rents.length > 0 ? rents.reduce((a, b) => a + b, 0) / rents.length : null;

    const occs = actuals.map(r => sf(r.occupancy_rate)).filter((v): v is number => v !== null);
    const avgOcc = occs.length > 0 ? occs.reduce((a, b) => a + b, 0) / occs.length : null;
    const avgVacancy = avgOcc != null ? 1 - avgOcc : null;

    const medianIncome = msa?.median_household_income ?? null;

    // Helper: compute rent-to-income signal
    const rentToIncomeSignal = (corId: string, corName: string): {
      signal: string | null; confidence: string; source: PortfolioCorrelationSignal['source'];
      actionable: string | null; xValue: number | null; missingData: string[];
    } => {
      if (!medianIncome) return { signal: null, confidence: 'insufficient', source: 'none', actionable: null, xValue: null, missingData: ['MSA median household income (no MSA linked for this city)'] };
      if (!avgEffRent)   return { signal: null, confidence: 'insufficient', source: 'none', actionable: null, xValue: null, missingData: ['portfolio avg effective rent (no actuals)'] };
      const pct = (avgEffRent * 12) / medianIncome * 100;
      const xVal = parseFloat(pct.toFixed(1));
      if (pct < 28) return { signal: 'bullish',  confidence: 'medium', source: 'first_party', xValue: xVal, missingData: [], actionable: `1P rent-to-income ${pct.toFixed(1)}% (below 30% ceiling). Room to push rents. 1P rent: $${avgEffRent.toFixed(0)}/mo.` };
      if (pct <= 32) return { signal: 'neutral', confidence: 'medium', source: 'first_party', xValue: xVal, missingData: [], actionable: `1P rent-to-income ${pct.toFixed(1)}% — near 30% ceiling. Moderate runway. 1P rent: $${avgEffRent.toFixed(0)}/mo.` };
      return { signal: 'bearish', confidence: 'medium', source: 'first_party', xValue: xVal, missingData: [], actionable: `1P rent-to-income ${pct.toFixed(1)}% exceeds ceiling. Reduce rent growth assumptions. 1P rent: $${avgEffRent.toFixed(0)}/mo.` };
    };

    return engineCorrelations.map(cor => {
      // ── COR-04: Wage Growth vs Rent Growth
      if (cor.id === 'COR-04') {
        const r = rentToIncomeSignal('COR-04', 'Wage Growth vs Rent Growth');
        return { cor_id: 'COR-04', name: 'Wage Growth vs Rent Growth', ...r, yValue: (cor.yValue as number | null) ?? null };
      }

      // ── COR-13: Rent-to-Income Ratio vs Rent Growth
      if (cor.id === 'COR-13') {
        const r = rentToIncomeSignal('COR-13', 'Rent-to-Income Ratio vs Rent Growth');
        return { cor_id: 'COR-13', name: 'Rent-to-Income Ratio vs Rent Growth', ...r, yValue: (cor.yValue as number | null) ?? null };
      }

      // ── COR-05: Traffic Surge Index vs Vacancy Rate
      // City-level needs search_activity_index (no 1P substitute).
      // Enrich: if city result is insufficient, supply property vacancy from 1P actuals.
      if (cor.id === 'COR-05' && cor.confidence === 'insufficient' && avgVacancy !== null) {
        const vacPct = avgVacancy * 100;
        const missing = cor.missingData.filter(m => !/vacancy/i.test(m));
        // Can annotate with 1P vacancy; signal still requires search_activity (keep null)
        return {
          cor_id: 'COR-05', name: cor.name ?? 'Traffic Surge Index vs Vacancy Rate',
          signal: null, confidence: 'low', source: 'mixed' as const,
          xValue: null, yValue: parseFloat(vacPct.toFixed(1)),
          missingData: missing.concat(['search activity index (no 1P substitute)']),
          actionable: `1P property vacancy: ${vacPct.toFixed(1)}% (occ ${(avgOcc! * 100).toFixed(1)}%). Search activity unavailable.`,
        };
      }

      // ── COR-09: Concession Trend vs Supply Delivery
      // Engine uses concession_rate from market snapshots. Fill from 1P concession_depth_ratio.
      if (cor.id === 'COR-09' && coefficients.concession_depth_ratio !== null) {
        const concPct = coefficients.concession_depth_ratio * 100;
        const missing = cor.missingData.filter(m => !/concession/i.test(m));
        const baseConf = cor.confidence === 'insufficient' ? 'low' : cor.confidence;
        const baseSrc: PortfolioCorrelationSignal['source'] = cor.confidence === 'insufficient' ? 'first_party' : 'mixed';
        let signal = cor.signal;
        let actionable = cor.actionable;
        if (!signal) {
          if (concPct < 1) { signal = 'bullish'; actionable = `Low concessions: 1P depth ${concPct.toFixed(2)}% — low giveaway pressure.`; }
          else if (concPct < 3) { signal = 'neutral'; actionable = `Moderate concessions: 1P depth ${concPct.toFixed(2)}%.`; }
          else { signal = 'bearish'; actionable = `High concessions: 1P depth ${concPct.toFixed(2)}% — elevated giveaway pressure.`; }
        }
        return {
          cor_id: 'COR-09', name: cor.name ?? 'Concession Trend vs Supply Delivery',
          signal, confidence: baseConf, source: baseSrc,
          xValue: parseFloat(concPct.toFixed(2)), yValue: (cor.yValue as number | null) ?? null,
          missingData: missing, actionable,
        };
      }

      // ── COR-22: Job Growth → Absorption (6-month lag)
      // No first-party substitute for job_growth_yoy. Explicitly mark as insufficient_history.
      if (cor.id === 'COR-22') {
        return {
          cor_id: 'COR-22', name: 'Job Growth → Absorption (6mo lag)',
          signal: null, confidence: 'insufficient',
          source: 'insufficient_history' as const,
          xValue: null, yValue: null,
          missingData: ['job_growth_yoy macro data not in portfolio actuals — requires city-level employment data feed'],
          actionable: null,
        };
      }

      // ── All other COR: check missingData for rent/vacancy that 1P actuals can fill
      const RENT_RE = /avg.?rent|effective.?rent|current.*rent|market.?rent/i;
      const VAC_RE  = /vacancy.?rate|avg.?occupancy|occupancy.?rate/i;

      const isMissingRent = cor.missingData.some(m => RENT_RE.test(m));
      const isMissingVac  = cor.missingData.some(m => VAC_RE.test(m));

      if ((isMissingRent && avgEffRent !== null) || (isMissingVac && avgVacancy !== null)) {
        const updatedMissing = cor.missingData.filter(m => {
          if (isMissingRent && avgEffRent !== null && RENT_RE.test(m)) return false;
          if (isMissingVac  && avgVacancy !== null  && VAC_RE.test(m))  return false;
          return true;
        });
        const filledNote: string[] = [];
        if (isMissingRent && avgEffRent !== null) filledNote.push(`1P rent $${avgEffRent.toFixed(0)}/mo`);
        if (isMissingVac  && avgVacancy !== null)  filledNote.push(`1P vacancy ${(avgVacancy * 100).toFixed(1)}%`);

        const newConf = updatedMissing.length === 0
          ? (cor.confidence === 'insufficient' ? 'low' : cor.confidence)
          : cor.confidence;
        const newSrc: PortfolioCorrelationSignal['source'] =
          updatedMissing.length === 0 ? 'mixed' : 'mixed';

        return {
          cor_id: cor.id, name: cor.name ?? cor.id,
          signal: cor.signal, confidence: newConf, source: newSrc,
          xValue: (cor.xValue as number | null) ?? null,
          yValue: (cor.yValue as number | null) ?? null,
          missingData: updatedMissing,
          actionable: cor.actionable
            ? `${cor.actionable} [${filledNote.join(', ')} from 1P actuals]`
            : `Data partially filled from 1P actuals: ${filledNote.join(', ')}.`,
        };
      }

      // ── Default: return engine result classified by data availability
      const source: PortfolioCorrelationSignal['source'] =
        cor.confidence === 'insufficient' ? 'none' :
        cor.missingData.length === 0 ? 'third_party' : 'mixed';

      return {
        cor_id: cor.id, name: cor.name ?? cor.id,
        signal: cor.signal, confidence: cor.confidence, source,
        xValue: (cor.xValue as number | null) ?? null,
        yValue: (cor.yValue as number | null) ?? null,
        missingData: cor.missingData, actionable: cor.actionable,
      };
    });
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private async persistCoefficients(
    coeff: EmpiricalCoefficients, dryRun: boolean
  ): Promise<PortfolioCorrelationSummary['coefficients']> {
    const computedAt = new Date().toISOString();
    const entries: Array<{ name: string; value: number | null; r2: number | null; n: number }> = [
      { name: 'lease_velocity',                       value: coeff.lease_velocity,                        r2: coeff.lease_velocity_r2, n: coeff.sample_size },
      { name: 'occupancy_trajectory',                 value: coeff.occupancy_trajectory,                  r2: coeff.lease_velocity_r2, n: coeff.sample_size },
      { name: 'occupancy_trajectory_shape',           value: coeff.occupancy_trajectory_shape,            r2: null, n: coeff.sample_size },
      { name: 'concession_depth_ratio',               value: coeff.concession_depth_ratio,                r2: null, n: coeff.sample_size },
      { name: 'concession_depth_to_stabilization',    value: coeff.concession_depth_to_stabilization,     r2: null, n: coeff.concession_leaseup_months ?? coeff.sample_size },
      { name: 'rent_positioning_ratio',               value: coeff.rent_positioning_ratio,                r2: null, n: coeff.sample_size },
      { name: 'rent_positioning_to_lease_velocity_r', value: coeff.rent_positioning_to_lease_velocity_r,  r2: null, n: coeff.sample_size },
    ];

    const rows: PortfolioCorrelationSummary['coefficients'] = [];
    for (const e of entries) {
      if (!dryRun) {
        await this.pool.query(
          `INSERT INTO portfolio_correlation_coefficients
             (property_id, coefficient_name, value, sample_size, r_squared,
              first_period, last_period, computed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (property_id, coefficient_name)
           DO UPDATE SET value=$3, sample_size=$4, r_squared=$5,
             first_period=$6, last_period=$7, computed_at=NOW()`,
          [coeff.property_id, e.name, e.value, e.n, e.r2,
           coeff.first_period ?? null, coeff.last_period ?? null]
        );
      }
      rows.push({
        property_id: coeff.property_id, property_name: coeff.property_name,
        coefficient_name: e.name, value: e.value, sample_size: e.n,
        r_squared: e.r2,
        first_period: coeff.first_period?.toISOString().slice(0, 10) ?? null,
        last_period:  coeff.last_period?.toISOString().slice(0, 10) ?? null,
        data_source: 'owned_portfolio', computed_at: computedAt,
      });
    }
    return rows;
  }

  /**
   * Durably persist enriched per-COR signals to portfolio_correlation_signals.
   * Uses UPSERT so re-runs update in place.
   */
  private async persistSignalsToTable(
    propertyId: string, signals: PortfolioCorrelationSignal[], dryRun: boolean
  ): Promise<void> {
    if (dryRun) return;
    for (const s of signals) {
      await this.pool.query(
        `INSERT INTO portfolio_correlation_signals
           (property_id, cor_id, cor_name, signal, confidence, source,
            x_value, y_value, actionable, missing_data, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (property_id, cor_id)
         DO UPDATE SET
           cor_name     = EXCLUDED.cor_name,
           signal       = EXCLUDED.signal,
           confidence   = EXCLUDED.confidence,
           source       = EXCLUDED.source,
           x_value      = EXCLUDED.x_value,
           y_value      = EXCLUDED.y_value,
           actionable   = EXCLUDED.actionable,
           missing_data = EXCLUDED.missing_data,
           computed_at  = NOW()`,
        [
          propertyId, s.cor_id, s.name, s.signal, s.confidence, s.source,
          s.xValue, s.yValue, s.actionable, s.missingData,
        ]
      );
    }
  }

  /**
   * Persist enriched signals (not raw engine report) to linked deals.
   */
  private async persistEnrichedSignalsToDeal(
    propertyId: string, signals: PortfolioCorrelationSignal[]
  ): Promise<void> {
    let dealRows: Array<{ id: string }> = [];
    try {
      const r = await this.pool.query<{ id: string }>(
        `SELECT id FROM deals WHERE property_id = $1`, [propertyId]
      );
      dealRows = r.rows;
    } catch { return; }

    const adjustments = mapSignalsToAdjustments(
      signals.map(s => ({
        id: s.cor_id, name: s.name, signal: s.signal,
        confidence: s.confidence, leadTime: undefined,
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

  /**
   * Write portfolio actuals into metric_time_series (geography_type='property').
   * Enables computeTimeSeriesCorrelations to generate metric_correlations pairs
   * that F4's useColumnCorrelations can pick up once properties are linked to
   * a submarket (#1685).
   */
  private async syncToMetricTimeSeries(
    propertyId: string, propertyName: string, actuals: PropertyActualRow[]
  ): Promise<void> {
    const METRIC_MAP: Array<{ metricId: string; field: keyof PropertyActualRow; scale?: number }> = [
      { metricId: 'PORT_OCCUPANCY',   field: 'occupancy_rate',     scale: 100 },
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

        await this.pool.query(
          `INSERT INTO metric_time_series
             (metric_id, geography_type, geography_id, geography_name,
              period_date, period_type, value, source, confidence)
           SELECT $1, 'property', $2, $3, $4, 'monthly', $5, 'portfolio_actuals', 0.95
           WHERE NOT EXISTS (
             SELECT 1 FROM metric_time_series
             WHERE metric_id = $1 AND geography_type = 'property'
               AND geography_id = $2 AND period_date = $4
           )`,
          [mapping.metricId, propertyId, propertyName, periodDate, value]
        );
      }
    }
  }

  // ── Main pipeline ────────────────────────────────────────────────────────

  async run(opts: { dryRun?: boolean } = {}): Promise<PortfolioCorrelationSummary> {
    const dryRun = opts.dryRun === true;
    const computedAt = new Date().toISOString();
    const allSignals: PortfolioCorrelationSignal[] = [];
    const allCoefficients: PortfolioCorrelationSummary['coefficients'] = [];

    const properties = await this.fetchOwnedProperties();

    for (const prop of properties) {
      try {
        // 1. Empirical coefficients from first-party actuals
        const coeffs = this.computeCoefficients(prop.id, prop.name, prop.actuals);
        const coeffRows = await this.persistCoefficients(coeffs, dryRun);
        allCoefficients.push(...coeffRows);

        // 2. City-level engine report (baseline signals for COR-01–30)
        const report = await this.engine.computeCorrelations(prop.city, prop.state);

        // 3. MSA income data for COR-04/COR-13 recomputation
        const msa = await this.fetchMsaForCity(prop.city, prop.state);

        // 4. Per-property enrichment of all 30 COR signals with first-party data
        const enrichedPartial = this.enrichSignalsWithFirstPartyData(
          report.correlations, prop.actuals, coeffs, msa
        );
        const enrichedSignals: PortfolioCorrelationSignal[] = enrichedPartial.map(e => ({
          ...e,
          property_id: prop.id,
          property_name: prop.name,
          city: prop.city,
          state: prop.state,
          sample_size: prop.actuals.length,
        }));
        allSignals.push(...enrichedSignals);

        if (!dryRun) {
          // 5. Durably persist enriched signals to portfolio_correlation_signals
          await this.persistSignalsToTable(prop.id, enrichedSignals, false);

          // 6. Sync actuals to metric_time_series for F4 pickup
          await this.syncToMetricTimeSeries(prop.id, prop.name, prop.actuals);

          // 7. Run cross-metric correlations for this property
          try {
            await this.engine.computeTimeSeriesCorrelations('property', prop.id);
          } catch (err) {
            logger.debug(`[PortfolioCorrelation] computeTimeSeriesCorrelations skipped for ${prop.id}: ${String(err)}`);
          }

          // 8. Persist enriched signals (not raw engine report) to linked deals
          await this.persistEnrichedSignalsToDeal(prop.id, enrichedSignals);
        }

      } catch (err) {
        logger.error(`[PortfolioCorrelation] Error for property ${prop.id} (${prop.name}): ${String(err)}`);
      }
    }

    return {
      computed_at: computedAt,
      properties_processed: properties.length,
      signals: allSignals,
      coefficients: allCoefficients,
    };
  }

  // ── Read paths ───────────────────────────────────────────────────────────

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

  async getStoredSignals(): Promise<PortfolioCorrelationSignal[]> {
    const r = await this.pool.query(
      `SELECT pcs.property_id, p.name AS property_name, p.city, p.state_code,
              pcs.cor_id, pcs.cor_name, pcs.signal, pcs.confidence, pcs.source,
              pcs.x_value, pcs.y_value, pcs.actionable, pcs.missing_data,
              pcs.computed_at
       FROM portfolio_correlation_signals pcs
       JOIN properties p ON p.id = pcs.property_id
       ORDER BY p.name, pcs.cor_id`
    );
    return r.rows.map(row => ({
      property_id: row.property_id,
      property_name: row.property_name,
      city: row.city ?? '',
      state: row.state_code ?? '',
      cor_id: row.cor_id,
      name: row.cor_name ?? row.cor_id,
      signal: row.signal,
      confidence: row.confidence,
      source: row.source,
      sample_size: 0,
      actionable: row.actionable,
      missingData: row.missing_data ?? [],
      xValue: row.x_value != null ? parseFloat(row.x_value) : null,
      yValue: row.y_value != null ? parseFloat(row.y_value) : null,
    }));
  }

  async getSummary(): Promise<{
    coefficients: PortfolioCorrelationSummary['coefficients'];
    signals: PortfolioCorrelationSignal[];
    last_run: string | null;
    properties_covered: string[];
  }> {
    const [coefficients, signals] = await Promise.all([
      this.getStoredCoefficients(),
      this.getStoredSignals(),
    ]);
    const lastRun = coefficients.length > 0
      ? coefficients.reduce((latest, c) => c.computed_at > latest ? c.computed_at : latest, coefficients[0].computed_at)
      : null;
    const covered = [...new Set(coefficients.map(c => c.property_name))];
    return { coefficients, signals, last_run: lastRun, properties_covered: covered };
  }
}
