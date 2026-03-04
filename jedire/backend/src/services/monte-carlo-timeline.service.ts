/**
 * Monte Carlo Timeline Simulation Service
 *
 * Samples from county benchmark data using log-normal distributions
 * to produce P10/P25/P50/P75/P90 timeline projections for each
 * development path. Used by Time-to-Shovel tab (M02 Phase 3).
 *
 * Inputs: county, state, entitlement_type, unit_count
 * Output: Percentile distribution, phase breakdown, carrying cost impact
 */

import { logger } from '../utils/logger';
import { query } from '../database/connection';

// ============================================================================
// Types
// ============================================================================

export interface MonteCarloInput {
  dealId: string;
  county: string;
  state: string;
  developmentPath: 'by_right' | 'overlay_bonus' | 'variance' | 'rezone';
  unitCount: number;
  projectType?: string;
  landBasis?: number;      // total land + soft costs already committed
  loanRate?: number;       // annual interest rate for carrying cost calc
  targetIrr?: number;      // baseline IRR to show impact
}

export interface MonteCarloResult {
  dealId: string;
  developmentPath: string;
  county: string;
  state: string;

  sampleSize: number;
  nSimulations: number;
  distributionType: 'lognormal';

  // Timeline percentiles (months)
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
    stdDev: number;
  };

  // Phase breakdown (median months)
  phases: {
    preApp: number;
    sitePlan: number;
    hearing: number;
    approval: number;
    permit: number;
    construction: number;
    total: number;
  };

  // Carrying cost impact at key percentiles
  financialImpact: {
    p10: { carryingCost: number; irrImpact: number };
    p50: { carryingCost: number; irrImpact: number };
    p90: { carryingCost: number; irrImpact: number };
  };

  // Gantt-style phase ranges for visualization
  ganttPhases: Array<{
    name: string;
    startMonth: number;
    p10Duration: number;
    p50Duration: number;
    p90Duration: number;
  }>;

  // Raw histogram buckets for probability distribution chart
  histogram: Array<{
    monthBucket: number;
    probability: number;
    cumulative: number;
  }>;

  computedAt: string;
}

interface BenchmarkRow {
  total_entitlement_days: number;
  pre_app_days: number | null;
  site_plan_review_days: number | null;
  zoning_hearing_days: number | null;
  approval_days: number | null;
  permit_issuance_days: number | null;
  impact_fee_per_unit: number | null;
  unit_count: number | null;
}

// ============================================================================
// Monte Carlo Engine
// ============================================================================

class MonteCarloTimelineService {
  private readonly N_SIMULATIONS = 10000;

  /**
   * Run Monte Carlo simulation for a deal's development path.
   * Falls back to synthetic data if insufficient county benchmarks.
   */
  async simulate(input: MonteCarloInput): Promise<MonteCarloResult> {
    const entitlementType = this.mapPathToEntitlementType(input.developmentPath);

    // Try to load benchmark data from DB
    let benchmarks: BenchmarkRow[];
    try {
      benchmarks = await this.loadBenchmarks(input.county, input.state, entitlementType, input.projectType);
    } catch {
      benchmarks = [];
    }

    // Fall back to synthetic benchmarks if insufficient data
    if (benchmarks.length < 3) {
      logger.info('Insufficient benchmark data, using synthetic distribution', {
        county: input.county,
        path: input.developmentPath,
        found: benchmarks.length,
      });
      benchmarks = this.getSyntheticBenchmarks(entitlementType, input.unitCount);
    }

    // Extract total days and fit log-normal distribution
    const totalDays = benchmarks.map(b => b.total_entitlement_days).filter(d => d > 0);
    const { mu, sigma } = this.fitLogNormal(totalDays);

    // Run simulations
    const samples = this.generateLogNormalSamples(mu, sigma, this.N_SIMULATIONS);
    const monthSamples = samples.map(d => d / 30.44); // days -> months

    // Sort for percentile extraction
    monthSamples.sort((a, b) => a - b);

    const percentiles = {
      p10: this.percentile(monthSamples, 10),
      p25: this.percentile(monthSamples, 25),
      p50: this.percentile(monthSamples, 50),
      p75: this.percentile(monthSamples, 75),
      p90: this.percentile(monthSamples, 90),
      mean: parseFloat((monthSamples.reduce((s, v) => s + v, 0) / monthSamples.length).toFixed(1)),
      stdDev: parseFloat(this.stdDev(monthSamples).toFixed(1)),
    };

    // Phase breakdown from benchmark medians
    const phases = this.computePhaseBreakdown(benchmarks, input.developmentPath, input.unitCount);

    // Financial impact
    const landBasis = input.landBasis || input.unitCount * 35000; // default ~$35K/unit land
    const loanRate = input.loanRate || 0.065;
    const monthlyRate = loanRate / 12;

    const financialImpact = {
      p10: this.computeFinancialImpact(percentiles.p10, landBasis, monthlyRate, input.targetIrr || 18),
      p50: this.computeFinancialImpact(percentiles.p50, landBasis, monthlyRate, input.targetIrr || 18),
      p90: this.computeFinancialImpact(percentiles.p90, landBasis, monthlyRate, input.targetIrr || 18),
    };

    // Build Gantt phases
    const ganttPhases = this.buildGanttPhases(phases, percentiles);

    // Build histogram (2-month buckets)
    const histogram = this.buildHistogram(monthSamples);

    return {
      dealId: input.dealId,
      developmentPath: input.developmentPath,
      county: input.county,
      state: input.state,
      sampleSize: benchmarks.length,
      nSimulations: this.N_SIMULATIONS,
      distributionType: 'lognormal',
      percentiles,
      phases,
      financialImpact,
      ganttPhases,
      histogram,
      computedAt: new Date().toISOString(),
    };
  }

  // ─── Private Methods ───

  private mapPathToEntitlementType(path: string): string {
    const map: Record<string, string> = {
      by_right: 'by_right',
      overlay_bonus: 'variance', // overlay treated like variance for benchmark matching
      variance: 'variance',
      rezone: 'rezone',
    };
    return map[path] || 'by_right';
  }

  private async loadBenchmarks(
    county: string,
    state: string,
    entitlementType: string,
    projectType?: string,
  ): Promise<BenchmarkRow[]> {
    const result = await query<BenchmarkRow>(
      `SELECT total_entitlement_days, pre_app_days, site_plan_review_days,
              zoning_hearing_days, approval_days, permit_issuance_days,
              impact_fee_per_unit, unit_count
       FROM benchmark_projects
       WHERE county ILIKE $1 AND state = $2 AND entitlement_type = $3
         AND outcome IN ('approved', 'modified')
       ORDER BY application_date DESC NULLS LAST
       LIMIT 50`,
      [county, state, entitlementType]
    );

    logger.info('Loaded benchmark projects from DB', {
      county,
      state,
      entitlementType,
      count: result.rows.length,
    });

    return result.rows;
  }

  private getSyntheticBenchmarks(entitlementType: string, unitCount: number): BenchmarkRow[] {
    // Synthetic benchmarks calibrated to Atlanta metro actuals
    const baseProfiles: Record<string, { meanDays: number; stdDays: number }> = {
      by_right: { meanDays: 72, stdDays: 20 },
      variance: { meanDays: 210, stdDays: 55 },
      rezone: { meanDays: 420, stdDays: 90 },
      site_plan: { meanDays: 120, stdDays: 30 },
    };

    const base = baseProfiles[entitlementType] || baseProfiles.by_right;

    // Scale slightly by unit count (larger projects take longer)
    const scaleFactor = unitCount > 250 ? 1.15 : unitCount > 150 ? 1.05 : 1.0;

    // Generate 20 synthetic benchmark rows
    const rows: BenchmarkRow[] = [];
    for (let i = 0; i < 20; i++) {
      const totalDays = Math.max(14, Math.round(
        base.meanDays * scaleFactor + (Math.random() - 0.5) * 2 * base.stdDays
      ));
      rows.push({
        total_entitlement_days: totalDays,
        pre_app_days: Math.round(totalDays * 0.1),
        site_plan_review_days: Math.round(totalDays * 0.25),
        zoning_hearing_days: entitlementType !== 'by_right' ? Math.round(totalDays * 0.2) : null,
        approval_days: Math.round(totalDays * 0.15),
        permit_issuance_days: Math.round(totalDays * 0.1),
        impact_fee_per_unit: 7500 + Math.round(Math.random() * 2000),
        unit_count: unitCount,
      });
    }

    return rows;
  }

  private fitLogNormal(values: number[]): { mu: number; sigma: number } {
    // Fit log-normal parameters using method of moments
    const logValues = values.map(v => Math.log(Math.max(1, v)));
    const n = logValues.length;
    const mu = logValues.reduce((s, v) => s + v, 0) / n;
    const variance = logValues.reduce((s, v) => s + (v - mu) ** 2, 0) / (n - 1);
    const sigma = Math.sqrt(Math.max(0.01, variance));
    return { mu, sigma };
  }

  private generateLogNormalSamples(mu: number, sigma: number, n: number): number[] {
    const samples: number[] = [];
    for (let i = 0; i < n; i++) {
      // Box-Muller transform for normal random
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const logNormalSample = Math.exp(mu + sigma * z);
      samples.push(Math.max(7, logNormalSample)); // minimum 1 week
    }
    return samples;
  }

  private percentile(sorted: number[], p: number): number {
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return parseFloat(sorted[lower].toFixed(1));
    const frac = idx - lower;
    return parseFloat((sorted[lower] * (1 - frac) + sorted[upper] * frac).toFixed(1));
  }

  private stdDev(values: number[]): number {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private computePhaseBreakdown(
    benchmarks: BenchmarkRow[],
    path: string,
    unitCount: number,
  ): MonteCarloResult['phases'] {
    const median = (arr: number[]) => {
      const sorted = arr.filter(v => v > 0).sort((a, b) => a - b);
      if (sorted.length === 0) return 0;
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const toDays = (field: keyof BenchmarkRow): number[] =>
      benchmarks.map(b => (b[field] as number) || 0).filter(v => v > 0);

    const preApp = parseFloat((median(toDays('pre_app_days')) / 30.44).toFixed(1));
    const sitePlan = parseFloat((median(toDays('site_plan_review_days')) / 30.44).toFixed(1));
    const hearing = parseFloat((median(toDays('zoning_hearing_days')) / 30.44).toFixed(1));
    const approval = parseFloat((median(toDays('approval_days')) / 30.44).toFixed(1));
    const permit = parseFloat((median(toDays('permit_issuance_days')) / 30.44).toFixed(1));

    // Construction timeline estimate based on unit count
    const constructionMonths = unitCount > 300 ? 24 : unitCount > 200 ? 20 : unitCount > 100 ? 16 : 12;

    const entitlementTotal = preApp + sitePlan + hearing + approval + permit;

    return {
      preApp,
      sitePlan,
      hearing,
      approval,
      permit,
      construction: constructionMonths,
      total: parseFloat((entitlementTotal + constructionMonths).toFixed(1)),
    };
  }

  private computeFinancialImpact(
    months: number,
    landBasis: number,
    monthlyRate: number,
    baselineIrr: number,
  ): { carryingCost: number; irrImpact: number } {
    // Carrying cost = land_basis * monthly_rate * months
    const carryingCost = parseFloat((landBasis * monthlyRate * months).toFixed(0));

    // IRR impact: roughly -0.15% per extra month of entitlement over baseline
    const baselineMonths = 2; // by-right baseline
    const extraMonths = Math.max(0, months - baselineMonths);
    const irrImpact = parseFloat((-extraMonths * 0.15).toFixed(2));

    return { carryingCost, irrImpact };
  }

  private buildGanttPhases(
    phases: MonteCarloResult['phases'],
    percentiles: MonteCarloResult['percentiles'],
  ): MonteCarloResult['ganttPhases'] {
    // Scale factor: p90/p50 ratio for spreading phase durations
    const spreadFactor = percentiles.p90 / Math.max(0.1, percentiles.p50);
    const tightFactor = percentiles.p10 / Math.max(0.1, percentiles.p50);

    let cumulativeStart = 0;
    const phaseList = [
      { name: 'Pre-Application', duration: phases.preApp },
      { name: 'Site Plan Review', duration: phases.sitePlan },
      { name: 'Hearing / Public Comment', duration: phases.hearing },
      { name: 'Approval', duration: phases.approval },
      { name: 'Permit Issuance', duration: phases.permit },
      { name: 'Construction', duration: phases.construction },
    ].filter(p => p.duration > 0);

    return phaseList.map(p => {
      const result = {
        name: p.name,
        startMonth: parseFloat(cumulativeStart.toFixed(1)),
        p10Duration: parseFloat(Math.max(0.5, p.duration * tightFactor).toFixed(1)),
        p50Duration: p.duration,
        p90Duration: parseFloat((p.duration * spreadFactor).toFixed(1)),
      };
      cumulativeStart += p.duration;
      return result;
    });
  }

  private buildHistogram(
    monthSamples: number[],
    bucketSize: number = 2,
  ): MonteCarloResult['histogram'] {
    const maxMonth = Math.ceil(monthSamples[monthSamples.length - 1] / bucketSize) * bucketSize;
    const buckets: Map<number, number> = new Map();

    for (let m = 0; m <= maxMonth; m += bucketSize) {
      buckets.set(m, 0);
    }

    for (const sample of monthSamples) {
      const bucket = Math.floor(sample / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }

    const n = monthSamples.length;
    let cumulative = 0;
    const result: MonteCarloResult['histogram'] = [];

    for (const [month, count] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
      cumulative += count / n;
      result.push({
        monthBucket: month,
        probability: parseFloat((count / n).toFixed(4)),
        cumulative: parseFloat(cumulative.toFixed(4)),
      });
    }

    return result;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const monteCarloTimelineService = new MonteCarloTimelineService();
