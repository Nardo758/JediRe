/**
 * Portfolio Correlation Service — Task #1657
 *
 * Runs COR-01–30 against owned-portfolio operating history (deal_monthly_actuals
 * where is_portfolio_asset=TRUE). "Property ownership" follows the same convention
 * as all other portfolio routes: properties.created_by = userId OR created_by IS NULL
 * (seed properties). Every public method that returns property-specific data requires
 * a userId and scopes its queries accordingly.
 *
 * NOTE: property_operating_history does not exist in this schema. The canonical
 * owned-portfolio data source is deal_monthly_actuals where is_portfolio_asset=TRUE
 * (per replit.md).
 *
 * Outputs:
 *   1. Seven empirical per-property coefficients → portfolio_correlation_coefficients
 *   2. Thirty per-property enriched COR signals  → portfolio_correlation_signals
 *      (durable; GET /correlation-signals reads these after page refresh)
 *   3. Portfolio actuals → metric_time_series (geography_type='property')
 *   4. If property.submarket_id is set: cross-metric correlations are also written to
 *      metric_correlations for that submarket — F4 useColumnCorrelations picks them up
 *      once the submarket link exists (see task #1685 for mass-linking)
 *   5. Enriched signals (not raw engine report) persisted to linked deals
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { getPool } from '../database/connection';
import { CorrelationEngineService, CorrelationResult } from './correlationEngine.service';
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

  // ── Scoped data fetchers ─────────────────────────────────────────────────

  /**
   * Fetch owned-portfolio properties for a specific user.
   * Scoping: (created_by = userId OR created_by IS NULL) — same pattern as all
   * other portfolio routes (see GET /portfolio/assets).
   */
  private async fetchOwnedProperties(userId: string): Promise<Array<{
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
         AND (p.created_by = $1 OR p.created_by IS NULL)
       ORDER BY p.name`,
      [userId]
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
        median_household_income: sf(r.rows[0].median_household_income),
        avg_rent: sf(r.rows[0].avg_rent),
      };
    }
    const s = await this.pool.query<{ median_household_income: string | null; avg_rent: string | null }>(
      `SELECT median_household_income, avg_rent FROM msas
       WHERE name ILIKE $1 AND median_household_income IS NOT NULL LIMIT 1`,
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

  computeCoefficients(
    propertyId: string, propertyName: string, actuals: PropertyActualRow[]
  ): EmpiricalCoefficients {
    // ── Occupancy scale: deal_monthly_actuals.occupancy_rate is stored as FRACTIONAL 0–1
    // (e.g. 0.944 = 94.4%). Verified from DB: min=0.907, max=0.976 across all seed rows.
    // All occupancy comparisons below use 0–1 thresholds (e.g. STABLE_OCC=0.95).
    // lease_velocity = slope × 100 converts the regression slope (fraction/month) to
    // percentage-point/month for display (e.g. 0.002/month → 0.20 pp/month).
    const OCC_SCALE_IS_FRACTIONAL = true; // 0–1 confirmed; do not change without DB migration
    void OCC_SCALE_IS_FRACTIONAL;         // consumed — suppresses unused-var lint

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

    // 1. Lease velocity + occupancy trajectory (fractional occupancy input, pp/month output)
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

    // 2. Concession depth ratio (all-period average)
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

    // 3. Concession depth during sub-95% phase (lease-up only)
    // STABLE_OCC=0.95 in 0–1 fractional scale = 95% occupancy threshold
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

    // 4. Rent positioning ratio
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

    // 5. Pearson(rent_positioning_per_month, monthly_occ_change)
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

  // ── Per-property COR signal computation ─────────────────────────────────

  /**
   * Compute per-property COR signals from the merged dataset:
   *   - City-level engine report provides the baseline for COR signals that measure
   *     market-wide conditions (supply pipeline, employment, transit, permit trends, etc.)
   *     These are city-wide by design and correctly identical for all properties in a city.
   *   - First-party property actuals provide PROPERTY-SPECIFIC inputs for COR signals
   *     where the unit of analysis is the property itself (rent, occupancy, concessions).
   *
   * For the following signals, first-party actuals replace or augment the engine result
   * with property-specific computation (not just enrichment):
   *
   *   COR-04 / COR-13 : rent-to-income ratio computed fresh from 1P avg_effective_rent
   *                     + MSA median_household_income. If no MSA income data, result
   *                     is 'none' / 'insufficient' (honest; TX props have no MSA link).
   *   COR-05          : property vacancy = 1 - avg(occupancy_rate) from 1P actuals.
   *                     search_activity_index has no 1P substitute so xValue stays null.
   *   COR-09          : concession rate = 1P concession_depth_ratio × 100. Signal
   *                     direction derived directly from this rate (bullish <1%, etc.).
   *   COR-22          : No first-party substitute for job_growth_yoy — explicitly
   *                     source='insufficient_history' with a clear explanation.
   *   All other COR   : "avg rent" / "effective rent" / "vacancy" in missingData
   *                     → filled from 1P actuals, source upgraded to 'mixed'.
   */
  private computePerPropertySignals(
    engineCorrelations: CorrelationResult[],
    actuals: PropertyActualRow[],
    coefficients: EmpiricalCoefficients,
    msa: { median_household_income: number | null; avg_rent: number | null } | null
  ): Array<Omit<PortfolioCorrelationSignal, 'property_id' | 'property_name' | 'city' | 'state' | 'sample_size'>> {

    // Property-level computed stats (the "first-party time-series" inputs)
    // occupancy_rate is FRACTIONAL 0–1 (e.g. 0.944 = 94.4%). Verified from DB.
    // avgVacancy = 1 - avgOcc is therefore also 0–1 (e.g. 0.056 = 5.6%).
    // vacPct = avgVacancy * 100 converts to percentage for display/thresholds.
    const rents = actuals.map(r => sf(r.avg_effective_rent)).filter((v): v is number => v !== null && v > 0);
    const avgEffRent = rents.length > 0 ? rents.reduce((a, b) => a + b, 0) / rents.length : null;

    const occs = actuals.map(r => sf(r.occupancy_rate)).filter((v): v is number => v !== null);
    const avgOcc = occs.length > 0 ? occs.reduce((a, b) => a + b, 0) / occs.length : null;
    // avgVacancy: 0–1 fractional (e.g. 0.056 for 94.4% occ). 1 - fractional_occ.
    const avgVacancy = avgOcc != null ? 1 - avgOcc : null;

    const medianIncome = msa?.median_household_income ?? null;

    // Rent-to-income computation (used by COR-04 and COR-13)
    const computeRentToIncome = (): {
      signal: string | null; confidence: string; source: PortfolioCorrelationSignal['source'];
      actionable: string | null; xValue: number | null; missingData: string[];
    } => {
      if (!medianIncome) {
        return {
          signal: null, confidence: 'insufficient', source: 'none', actionable: null,
          xValue: null,
          missingData: ['MSA median household income (no MSA record linked for this city)'],
        };
      }
      if (!avgEffRent) {
        return {
          signal: null, confidence: 'insufficient', source: 'none', actionable: null,
          xValue: null,
          missingData: ['portfolio avg effective rent (no actuals with rent data)'],
        };
      }
      const pct = (avgEffRent * 12) / medianIncome * 100;
      const xVal = parseFloat(pct.toFixed(1));
      if (pct < 28) {
        return { signal: 'bullish', confidence: 'medium', source: 'first_party', xValue: xVal, missingData: [],
          actionable: `1P rent-to-income ${pct.toFixed(1)}% (below 30% ceiling). Room to push rents. 1P rent: $${avgEffRent.toFixed(0)}/mo.` };
      }
      if (pct <= 32) {
        return { signal: 'neutral', confidence: 'medium', source: 'first_party', xValue: xVal, missingData: [],
          actionable: `1P rent-to-income ${pct.toFixed(1)}% — near 30% ceiling. Moderate runway. 1P rent: $${avgEffRent.toFixed(0)}/mo.` };
      }
      return { signal: 'bearish', confidence: 'medium', source: 'first_party', xValue: xVal, missingData: [],
        actionable: `1P rent-to-income ${pct.toFixed(1)}% exceeds ceiling. Reduce rent growth assumptions. 1P rent: $${avgEffRent.toFixed(0)}/mo.` };
    };

    const RENT_RE = /avg.?rent|effective.?rent|current.*rent|market.?rent/i;
    const VAC_RE  = /vacancy.?rate|avg.?occupancy|occupancy.?rate/i;

    return engineCorrelations.map(cor => {
      // ── COR-04: Wage Growth vs Rent Growth
      if (cor.id === 'COR-04') {
        const r = computeRentToIncome();
        return { cor_id: 'COR-04', name: cor.name ?? 'Wage Growth vs Rent Growth', ...r,
          yValue: (cor.yValue as number | null) ?? null };
      }

      // ── COR-13: Rent-to-Income Ratio vs Rent Growth
      if (cor.id === 'COR-13') {
        const r = computeRentToIncome();
        return { cor_id: 'COR-13', name: cor.name ?? 'Rent-to-Income Ratio vs Rent Growth', ...r,
          yValue: (cor.yValue as number | null) ?? null };
      }

      // ── COR-05: Traffic Surge Index vs Vacancy Rate
      // search_activity_index has no 1P substitute. When engine computed a signal, preserve
      // it and annotate yValue with 1P property vacancy. When engine is insufficient but
      // 1P vacancy is available, derive a signal from vacancy rate alone.
      if (cor.id === 'COR-05' && avgVacancy !== null) {
        const vacPct = avgVacancy * 100;
        const missing = cor.missingData.filter(m => !VAC_RE.test(m));
        if (cor.confidence !== 'insufficient' && cor.signal) {
          // Engine has a valid signal: preserve it, enrich with 1P vacancy context
          return {
            cor_id: 'COR-05', name: cor.name ?? 'Traffic Surge Index vs Vacancy Rate',
            signal: cor.signal, confidence: cor.confidence, source: 'mixed' as const,
            xValue: cor.xValue ?? null, yValue: parseFloat(vacPct.toFixed(1)),
            missingData: missing,
            actionable: cor.actionable
              ? `${cor.actionable} [1P vacancy ${vacPct.toFixed(1)}%]`
              : `1P property vacancy: ${vacPct.toFixed(1)}%.`,
          };
        }
        // Engine is insufficient: derive signal from 1P vacancy rate
        // Low vacancy (<7%) → bullish; moderate (7-12%) → neutral; high (>12%) → bearish
        let derivedSignal: string;
        let derivedActionable: string;
        if (vacPct < 7) {
          derivedSignal = 'bullish';
          derivedActionable = `1P vacancy ${vacPct.toFixed(1)}% (below 7% threshold) — tight occupancy supports rent growth.`;
        } else if (vacPct <= 12) {
          derivedSignal = 'neutral';
          derivedActionable = `1P vacancy ${vacPct.toFixed(1)}% (7–12% range) — moderate occupancy pressure.`;
        } else {
          derivedSignal = 'bearish';
          derivedActionable = `1P vacancy ${vacPct.toFixed(1)}% (above 12%) — elevated vacancy suppresses rent growth.`;
        }
        return {
          cor_id: 'COR-05', name: cor.name ?? 'Traffic Surge Index vs Vacancy Rate',
          signal: derivedSignal, confidence: 'low', source: 'mixed' as const,
          xValue: null, yValue: parseFloat(vacPct.toFixed(1)),
          missingData: missing.concat(['search activity index (no 1P substitute)']),
          actionable: derivedActionable,
        };
      }

      // ── COR-09: Concession Trend vs Supply Delivery
      // Concession rate computed directly from 1P concession_depth_ratio (property-specific).
      if (cor.id === 'COR-09' && coefficients.concession_depth_ratio !== null) {
        const concPct = coefficients.concession_depth_ratio * 100;
        const missing = cor.missingData.filter(m => !/concession/i.test(m));
        let signal: string;
        let actionable: string;
        if (concPct < 1) { signal = 'bullish'; actionable = `Low concessions: 1P depth ${concPct.toFixed(2)}% — low giveaway pressure.`; }
        else if (concPct < 3) { signal = 'neutral'; actionable = `Moderate concessions: 1P depth ${concPct.toFixed(2)}%.`; }
        else { signal = 'bearish'; actionable = `High concessions: 1P depth ${concPct.toFixed(2)}% — elevated giveaway pressure.`; }
        return {
          cor_id: 'COR-09', name: cor.name ?? 'Concession Trend vs Supply Delivery',
          signal, confidence: 'medium', source: 'first_party' as const,
          xValue: parseFloat(concPct.toFixed(2)), yValue: (cor.yValue as number | null) ?? null,
          missingData: missing, actionable,
        };
      }

      // ── COR-22: Job Growth → Absorption (6-month lag)
      // No first-party substitute for job_growth_yoy. Only downgrade to insufficient_history
      // when the engine itself was already insufficient — preserve a valid engine computation.
      if (cor.id === 'COR-22') {
        if (cor.confidence !== 'insufficient') {
          // Engine has real macro data — preserve it
          const source: PortfolioCorrelationSignal['source'] =
            cor.missingData.length === 0 ? 'third_party' : 'mixed';
          return {
            cor_id: 'COR-22', name: cor.name ?? 'Job Growth → Absorption (6mo lag)',
            signal: cor.signal, confidence: cor.confidence, source,
            xValue: cor.xValue ?? null, yValue: cor.yValue ?? null,
            missingData: cor.missingData, actionable: cor.actionable,
          };
        }
        // Engine was insufficient: mark as insufficient_history with explanation
        return {
          cor_id: 'COR-22', name: cor.name ?? 'Job Growth → Absorption (6mo lag)',
          signal: null, confidence: 'insufficient', source: 'insufficient_history' as const,
          xValue: null, yValue: null,
          missingData: ['job_growth_yoy macro data (city-level employment feed required — no 1P substitute)'],
          actionable: null,
        };
      }

      // ── All other COR: fill rent/vacancy from 1P actuals where missingData lists them
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

        return {
          cor_id: cor.id, name: cor.name ?? cor.id,
          signal: cor.signal, confidence: newConf, source: 'mixed' as const,
          xValue: (cor.xValue as number | null) ?? null,
          yValue: (cor.yValue as number | null) ?? null,
          missingData: updatedMissing,
          actionable: cor.actionable
            ? `${cor.actionable} [${filledNote.join(', ')} from 1P actuals]`
            : `Data partially filled from 1P actuals: ${filledNote.join(', ')}.`,
        };
      }

      // Default: return engine result with source classification
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
      { name: 'lease_velocity',                       value: coeff.lease_velocity,                       r2: coeff.lease_velocity_r2, n: coeff.sample_size },
      { name: 'occupancy_trajectory',                 value: coeff.occupancy_trajectory,                 r2: coeff.lease_velocity_r2, n: coeff.sample_size },
      { name: 'occupancy_trajectory_shape',           value: coeff.occupancy_trajectory_shape,           r2: null, n: coeff.sample_size },
      { name: 'concession_depth_ratio',               value: coeff.concession_depth_ratio,               r2: null, n: coeff.sample_size },
      { name: 'concession_depth_to_stabilization',    value: coeff.concession_depth_to_stabilization,    r2: null, n: coeff.concession_leaseup_months ?? coeff.sample_size },
      { name: 'rent_positioning_ratio',               value: coeff.rent_positioning_ratio,               r2: null, n: coeff.sample_size },
      { name: 'rent_positioning_to_lease_velocity_r', value: coeff.rent_positioning_to_lease_velocity_r, r2: null, n: coeff.sample_size },
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
   * Upsert enriched per-COR signals to portfolio_correlation_signals.
   * UNIQUE(property_id, cor_id) ensures re-runs update in place.
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
        [propertyId, s.cor_id, s.name, s.signal, s.confidence, s.source,
         s.xValue, s.yValue, s.actionable, s.missingData]
      );
    }
  }

  /**
   * Persist enriched signals to deals that are (a) linked to this property AND (b) owned
   * by this user. Scoping on user_id prevents cross-tenant writes when multiple users
   * reference the same seed property.
   */
  private async persistEnrichedSignalsToDeal(
    propertyId: string, userId: string, signals: PortfolioCorrelationSignal[]
  ): Promise<void> {
    let dealRows: Array<{ id: string }> = [];
    try {
      const r = await this.pool.query<{ id: string }>(
        `SELECT id FROM deals WHERE property_id = $1 AND user_id = $2 AND archived_at IS NULL`,
        [propertyId, userId]
      );
      dealRows = r.rows;
    } catch { return; }

    const adjustments = mapSignalsToAdjustments(
      signals.map(s => ({ id: s.cor_id, name: s.name, signal: s.signal, confidence: s.confidence, leadTime: undefined }))
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
   * Write portfolio actuals into metric_time_series for geography_type='property'.
   * Uses WHERE NOT EXISTS guard (metric_time_series has no unique constraint).
   *
   * Additionally: if the property has a submarket_id, trigger
   * computeTimeSeriesCorrelations for that submarket so F4 useColumnCorrelations
   * can reflect the updated portfolio data. (Submarket linkage is set via task #1685.)
   */
  private async syncToMetricTimeSeries(
    propertyId: string, propertyName: string,
    actuals: PropertyActualRow[], submarket_id: string | null
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
        const value = mapping.scale
          ? parseFloat(String(rawVal)) * mapping.scale
          : parseFloat(String(rawVal));
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

    // Compute cross-metric correlations for property geography
    try {
      await this.engine.computeTimeSeriesCorrelations('property', propertyId);
    } catch (err) {
      logger.debug(`[PortfolioCorrelation] computeTimeSeriesCorrelations(property/${propertyId}) skipped: ${String(err)}`);
    }

    // If property is linked to a submarket, also refresh submarket-level correlations
    // so F4 useColumnCorrelations picks up updated signals.
    if (submarket_id) {
      try {
        await this.engine.computeTimeSeriesCorrelations('submarket', submarket_id);
      } catch (err) {
        logger.debug(`[PortfolioCorrelation] computeTimeSeriesCorrelations(submarket/${submarket_id}) skipped: ${String(err)}`);
      }
    }
  }

  // ── Main pipeline ────────────────────────────────────────────────────────

  /**
   * Run the correlation pipeline for a specific user's owned portfolio.
   * @param userId - Required. Scopes property lookup to (created_by=userId OR created_by IS NULL).
   * @param opts.dryRun - If true, skips all database writes (coefficients, signals, time-series).
   */
  async run(userId: string, opts: { dryRun?: boolean } = {}): Promise<PortfolioCorrelationSummary> {
    const dryRun = opts.dryRun === true;
    const computedAt = new Date().toISOString();
    const allSignals: PortfolioCorrelationSignal[] = [];
    const allCoefficients: PortfolioCorrelationSummary['coefficients'] = [];

    const properties = await this.fetchOwnedProperties(userId);

    for (const prop of properties) {
      try {
        // 1. Empirical coefficients from first-party actuals
        const coeffs = this.computeCoefficients(prop.id, prop.name, prop.actuals);
        const coeffRows = await this.persistCoefficients(coeffs, dryRun);
        allCoefficients.push(...coeffRows);

        // 2. City-level engine report: baseline for market-wide COR signals
        //    (COR-01–30 cover both market-wide conditions AND property-level metrics;
        //     the engine handles market-wide signals; we override property-level ones below)
        const report = await this.engine.computeCorrelations(prop.city, prop.state);

        // 3. MSA income data for COR-04/COR-13 rent-to-income computation
        const msa = await this.fetchMsaForCity(prop.city, prop.state);

        // 4. Per-property computation: override signals where first-party data is superior
        const perPropertyPartial = this.computePerPropertySignals(
          report.correlations, prop.actuals, coeffs, msa
        );
        const perPropertySignals: PortfolioCorrelationSignal[] = perPropertyPartial.map(e => ({
          ...e,
          property_id: prop.id,
          property_name: prop.name,
          city: prop.city,
          state: prop.state,
          sample_size: prop.actuals.length,
        }));
        allSignals.push(...perPropertySignals);

        if (!dryRun) {
          // 5. Persist per-property signals to portfolio_correlation_signals (durable)
          await this.persistSignalsToTable(prop.id, perPropertySignals, false);

          // 6. Sync actuals to metric_time_series; refresh submarket correlations if linked
          await this.syncToMetricTimeSeries(prop.id, prop.name, prop.actuals, prop.submarket_id);

          // 7. Persist per-property enriched signals to linked deals (userId-scoped)
          await this.persistEnrichedSignalsToDeal(prop.id, userId, perPropertySignals);
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

  // ── Read paths (scoped by userId) ────────────────────────────────────────

  /**
   * Read stored coefficients for the user's owned portfolio properties.
   * Scoping: same (created_by = userId OR created_by IS NULL) join as write path.
   */
  async getStoredCoefficients(userId: string): Promise<PortfolioCorrelationSummary['coefficients']> {
    const r = await this.pool.query(
      `SELECT pcc.property_id, p.name AS property_name,
              pcc.coefficient_name, pcc.value, pcc.sample_size,
              pcc.r_squared, pcc.first_period, pcc.last_period,
              pcc.data_source, pcc.computed_at
       FROM portfolio_correlation_coefficients pcc
       JOIN properties p ON p.id = pcc.property_id
       WHERE (p.created_by = $1 OR p.created_by IS NULL)
       ORDER BY p.name, pcc.coefficient_name`,
      [userId]
    );
    return r.rows.map(row => ({
      property_id: row.property_id,
      property_name: row.property_name,
      coefficient_name: row.coefficient_name,
      value: row.value != null ? parseFloat(row.value) : null,
      sample_size: parseInt(row.sample_size ?? '0'),
      r_squared: row.r_squared != null ? parseFloat(row.r_squared) : null,
      first_period: row.first_period ? new Date(row.first_period).toISOString().slice(0, 10) : null,
      last_period:  row.last_period  ? new Date(row.last_period).toISOString().slice(0, 10)  : null,
      data_source: row.data_source,
      computed_at: new Date(row.computed_at).toISOString(),
    }));
  }

  /**
   * Read stored COR signals for the user's owned portfolio properties.
   * Scoping: same (created_by = userId OR created_by IS NULL) join as write path.
   */
  async getStoredSignals(userId: string): Promise<PortfolioCorrelationSignal[]> {
    const r = await this.pool.query(
      `SELECT pcs.property_id, p.name AS property_name, p.city, p.state_code,
              pcs.cor_id, pcs.cor_name, pcs.signal, pcs.confidence, pcs.source,
              pcs.x_value, pcs.y_value, pcs.actionable, pcs.missing_data,
              pcs.computed_at
       FROM portfolio_correlation_signals pcs
       JOIN properties p ON p.id = pcs.property_id
       WHERE (p.created_by = $1 OR p.created_by IS NULL)
       ORDER BY p.name, pcs.cor_id`,
      [userId]
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

  /**
   * Returns both stored coefficients and durably-stored enriched signals.
   * Used by GET /correlation-signals. All data is scoped to the requesting user.
   */
  async getSummary(userId: string): Promise<{
    coefficients: PortfolioCorrelationSummary['coefficients'];
    signals: PortfolioCorrelationSignal[];
    last_run: string | null;
    properties_covered: string[];
  }> {
    const [coefficients, signals] = await Promise.all([
      this.getStoredCoefficients(userId),
      this.getStoredSignals(userId),
    ]);
    const lastRun = coefficients.length > 0
      ? coefficients.reduce((latest, c) =>
          c.computed_at > latest ? c.computed_at : latest, coefficients[0].computed_at)
      : null;
    const covered = [...new Set(coefficients.map(c => c.property_name))];
    return { coefficients, signals, last_run: lastRun, properties_covered: covered };
  }
}
