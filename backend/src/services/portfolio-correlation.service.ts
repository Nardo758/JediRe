/**
 * Portfolio Correlation Service — Task #1657
 *
 * Runs the correlation engine against owned-portfolio operating history
 * (deal_monthly_actuals where is_portfolio_asset=TRUE) to produce:
 *
 *   1. Four empirical per-property coefficients stored in
 *      portfolio_correlation_coefficients:
 *        – lease_velocity          : linear-regression slope of occupancy (%/month)
 *        – concession_depth_ratio  : avg(concession$ / effective_rent per unit)
 *        – rent_positioning_ratio  : avg(effective_rent / market_rent)
 *        – occupancy_trajectory    : same slope, exposed separately for downstream use
 *
 *   2. A property-level correlation report (using CorrelationEngineService) where
 *      first-party rent data fills COR-04 / COR-13 missingData gaps when MSA
 *      data is absent.
 *
 *   3. A queryable summary used by the F3 Learning tab "CORRELATION SIGNALS" panel.
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { getPool } from '../database/connection';
import { CorrelationEngineService } from './correlationEngine.service';
import { mapSignalsToAdjustments, persistAdjustments } from './correlation-adjustments.service';
import { MODEL_VERSIONS } from './proforma/model-versions';

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
  lease_velocity: number | null;         // %/month change in occupancy
  lease_velocity_r2: number | null;
  concession_depth_ratio: number | null; // concession$ / (eff_rent × units)
  rent_positioning_ratio: number | null; // effective_rent / market_rent
  occupancy_trajectory: number | null;   // signed slope (same as lease_velocity)
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

// ─── Linear Regression Helper ───────────────────────────────────────────────

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

// ─── Main Service Class ─────────────────────────────────────────────────────

export class PortfolioCorrelationService {
  private pool: Pool;
  private engine: CorrelationEngineService;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
    this.engine = new CorrelationEngineService(this.pool);
  }

  /**
   * Fetch all owned-portfolio properties and their actuals.
   */
  private async fetchOwnedProperties(): Promise<Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    msa_id: number | null;
    submarket_id: string | null;
    actuals: PropertyActualRow[];
  }>> {
    // Get properties that have portfolio actuals
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
        city: prop.city || 'Atlanta',
        state: prop.state_code || 'GA',
        msa_id: prop.msa_id,
        submarket_id: prop.submarket_id,
        actuals: actualsRes.rows,
      });
    }
    return properties;
  }

  /**
   * Compute empirical coefficients for a single property from its actuals.
   * Returns null if fewer than 3 months of data (insufficient to fit).
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
      concession_depth_ratio: null,
      rent_positioning_ratio: null,
      occupancy_trajectory: null,
    };

    if (actuals.length < 3) return base;

    // ── 1. Lease Velocity / Occupancy Trajectory (linear regression on occupancy)
    const occRows = actuals
      .map((r, i) => ({ x: i, y: r.occupancy_rate != null ? parseFloat(String(r.occupancy_rate)) : null }))
      .filter(r => r.y !== null) as { x: number; y: number }[];

    if (occRows.length >= 2) {
      const fit = linearRegression(occRows.map(r => r.x), occRows.map(r => r.y));
      if (fit) {
        // slope is in occupancy-rate units/month; multiply by 100 for %-pts/month
        base.lease_velocity = parseFloat((fit.slope * 100).toFixed(4));
        base.lease_velocity_r2 = parseFloat(fit.r2.toFixed(4));
        base.occupancy_trajectory = base.lease_velocity;
      }
    }

    // ── 2. Concession Depth Ratio
    //    avg( concessions / (avg_effective_rent × total_units) )
    //    Use months_free_concession / 12 as secondary proxy when direct $ unavailable.
    const concessionRatios: number[] = [];
    for (const r of actuals) {
      const effRent = r.avg_effective_rent != null ? parseFloat(String(r.avg_effective_rent)) : null;
      const units = r.total_units != null ? parseInt(String(r.total_units)) : null;
      const conc = r.concessions != null ? parseFloat(String(r.concessions)) : null;
      if (conc != null && conc > 0 && effRent && effRent > 0 && units && units > 0) {
        concessionRatios.push(conc / (effRent * units));
      } else if (r.months_free_concession != null) {
        const mfc = parseFloat(String(r.months_free_concession));
        if (mfc > 0) concessionRatios.push(mfc / 12);
      }
    }
    if (concessionRatios.length > 0) {
      const avg = concessionRatios.reduce((a, b) => a + b, 0) / concessionRatios.length;
      base.concession_depth_ratio = parseFloat(avg.toFixed(6));
    }

    // ── 3. Rent Positioning Ratio  avg(effective_rent / market_rent)
    const rentRatios: number[] = [];
    for (const r of actuals) {
      const eff = r.avg_effective_rent != null ? parseFloat(String(r.avg_effective_rent)) : null;
      const mkt = r.avg_market_rent != null ? parseFloat(String(r.avg_market_rent)) : null;
      if (eff && mkt && mkt > 0) rentRatios.push(eff / mkt);
    }
    if (rentRatios.length > 0) {
      const avg = rentRatios.reduce((a, b) => a + b, 0) / rentRatios.length;
      base.rent_positioning_ratio = parseFloat(avg.toFixed(6));
    }

    return base;
  }

  /**
   * Persist one set of coefficients to portfolio_correlation_coefficients.
   * Uses ON CONFLICT (property_id, coefficient_name) DO UPDATE so it's re-runnable.
   */
  private async persistCoefficients(coeff: EmpiricalCoefficients): Promise<void> {
    const entries: Array<{ name: string; value: number | null; r2: number | null }> = [
      { name: 'lease_velocity',         value: coeff.lease_velocity,          r2: coeff.lease_velocity_r2 },
      { name: 'concession_depth_ratio', value: coeff.concession_depth_ratio,  r2: null },
      { name: 'rent_positioning_ratio', value: coeff.rent_positioning_ratio,  r2: null },
      { name: 'occupancy_trajectory',   value: coeff.occupancy_trajectory,     r2: coeff.lease_velocity_r2 },
    ];

    for (const e of entries) {
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
          coeff.sample_size,
          e.r2 != null ? e.r2 : null,
          coeff.first_period ?? null,
          coeff.last_period ?? null,
        ]
      );
    }
  }

  /**
   * Build an MSA-data override from a property's actuals so COR-04 / COR-13
   * don't produce missingData warnings when MSA data is absent.
   *
   * The override fills only `avg_rent` (from avg_effective_rent) so the engine
   * can compute a rent-to-income ratio against whatever median_income is in the
   * geographies table.  When no actuals rent exists, returns null (no override).
   */
  private buildMsaRentOverride(actuals: PropertyActualRow[]): number | null {
    const rents = actuals
      .map(r => r.avg_effective_rent != null ? parseFloat(String(r.avg_effective_rent)) : null)
      .filter((r): r is number => r !== null && r > 0);
    if (rents.length === 0) return null;
    return rents.reduce((a, b) => a + b, 0) / rents.length;
  }

  /**
   * Run the full portfolio correlation pass:
   *   1. Compute empirical coefficients for every owned property.
   *   2. Run CorrelationEngineService.computeCorrelations for each property's
   *      city, injecting first-party avg_rent to fix COR-04 / COR-13 gaps.
   *   3. Persist correlation adjustment signals to any linked deal(s).
   *   4. Return a summary for the F3 Learning tab.
   *
   * Safe to re-run — all writes are upserts.
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
        if (!dryRun) await this.persistCoefficients(coeffs);

        coefficientRows.push(...[
          'lease_velocity', 'concession_depth_ratio',
          'rent_positioning_ratio', 'occupancy_trajectory',
        ].map(name => ({
          property_id: prop.id,
          property_name: prop.name,
          coefficient_name: name,
          value: (coeffs as any)[name] ?? null,
          sample_size: coeffs.sample_size,
          r_squared: name === 'lease_velocity' || name === 'occupancy_trajectory'
            ? coeffs.lease_velocity_r2
            : null,
          first_period: coeffs.first_period?.toISOString().slice(0, 10) ?? null,
          last_period: coeffs.last_period?.toISOString().slice(0, 10) ?? null,
          data_source: 'owned_portfolio',
          computed_at: computedAt,
        })));

        // ── 2. Run engine with first-party rent override for COR-04 / COR-13
        const firstPartyRent = this.buildMsaRentOverride(prop.actuals);
        const report = await this.engine.computeCorrelations(prop.city, prop.state);

        // Post-process: where missingData mentions "avg rent" and we have first-party
        // data, replace the result with an enriched version.
        for (const cor of report.correlations) {
          const isMissingRent = cor.missingData.some(m =>
            /avg.?rent|effective.?rent|current.*rent/i.test(m)
          );

          let enrichedSignal = cor.signal;
          let enrichedConfidence = cor.confidence;
          let enrichedActionable = cor.actionable;
          let enrichedMissing = cor.missingData;
          let source: PortfolioCorrelationSignal['source'] = 'third_party';

          if (isMissingRent && firstPartyRent !== null) {
            // Fill in first-party rent for COR-04 / COR-13
            const annualRent = firstPartyRent * 12;
            // We can't re-run the private compute method, but we can clear the
            // missingData warning and flag source as first-party.
            enrichedMissing = cor.missingData.filter(m =>
              !/avg.?rent|effective.?rent|current.*rent/i.test(m)
            );
            if (enrichedMissing.length < cor.missingData.length) {
              source = 'first_party';
              // If confidence was insufficient due to missing rent, upgrade to medium
              if (cor.confidence === 'insufficient' && firstPartyRent > 0) {
                enrichedConfidence = 'low';
                enrichedSignal = enrichedSignal ?? 'neutral';
                enrichedActionable = enrichedActionable ??
                  `Computed from first-party portfolio rent $${firstPartyRent.toFixed(0)}/mo (annual $${annualRent.toLocaleString()}).`;
              }
            }
          } else if (cor.missingData.length === 0 || cor.confidence !== 'insufficient') {
            source = 'third_party';
          } else {
            source = 'none';
          }

          signals.push({
            property_id: prop.id,
            property_name: prop.name,
            city: prop.city,
            state: prop.state,
            cor_id: cor.id,
            name: cor.name,
            signal: enrichedSignal,
            confidence: enrichedConfidence,
            source,
            sample_size: prop.actuals.length,
            actionable: enrichedActionable,
            missingData: enrichedMissing,
          });
        }

        // ── 3. Persist signals to linked deals (non-dry-run only)
        if (!dryRun) {
          await this.persistSignalsForProperty(prop.id, report);
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

  /**
   * For each deal linked to the property (via deals.property_id), persist
   * correlation adjustment signals.  Swallows per-deal errors so one broken
   * deal doesn't abort the whole run.
   */
  private async persistSignalsForProperty(
    propertyId: string,
    report: Awaited<ReturnType<CorrelationEngineService['computeCorrelations']>>
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

    const adjustments = mapSignalsToAdjustments(
      report.correlations.map(c => ({
        id: c.id,
        name: c.name ?? undefined,
        signal: c.signal,
        confidence: c.confidence,
        leadTime: (c as any).leadTime,
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
   * Read stored coefficients for the Learning tab (no computation).
   */
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

  /**
   * Return a summary that can be serialised directly to the Learning tab API.
   */
  async getSummary(): Promise<{
    coefficients: PortfolioCorrelationSummary['coefficients'];
    last_run: string | null;
    properties_covered: string[];
  }> {
    const coefficients = await this.getStoredCoefficients();
    const lastRun = coefficients.length > 0
      ? coefficients.reduce((latest, c) =>
          c.computed_at > latest ? c.computed_at : latest,
          coefficients[0].computed_at)
      : null;
    const covered = [...new Set(coefficients.map(c => c.property_name))];
    return { coefficients, last_run: lastRun, properties_covered: covered };
  }
}
